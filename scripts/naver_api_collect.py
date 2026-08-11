#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
네이버 검색 Open API 수집·분석기 — 블로그/카페글을 검색해
'다이렉트결혼준비 수집가'에 준하는 가전 후기 분석 산출물로 변환한다.

세션 덤프(channel_analyze.py)는 제목만 줘서 품목·매장 신호가 빈약했다.
검색 API는 제목+요약(description)+작성일을 주므로, 품목·톤·매장 매칭이
실제로 동작한다(다이렉트결혼준비 게시판 본문 분류에 준하는 정밀도).

키는 환경변수에서만 읽는다(코드/산출물에 키 미기재):
  NAVER_CLIENT_ID, NAVER_CLIENT_SECRET   (data/naver-api.md 참조)

흐름:
  scripts/naver-search.ps1 호출(블로그/카페, 여러 쿼리, date 정렬)
  → link 중복제거 → 제목+요약 기반 brand/item/tone/ad 분류
  → 전국 백화점 매장 매칭(build_web_data 규칙 재사용) → 지역 합계
  → artifacts/YYYYMMDD-01-raw-<소스ID>.md (다이렉트결혼준비 양식)

주의: 요약 일부만 반환 → 본문 전체 아님. 광고성 블로그 다수 → [광고추정] 표기.
"""
import argparse
import io
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS = ROOT / "artifacts"
PS1 = ROOT / "scripts" / "naver-search.ps1"

# --- 분류 어휘 (channel_analyze.py와 동일 기준 유지) ---
ITEMS = {
    "냉장고": ["냉장고", "비스포크 냉장", "키친핏"],
    "김치냉장고": ["김치냉장고", "김치플러스", "김치톡톡"],
    "세탁기": ["세탁기", "워시타워", "그랑데"],
    "건조기": ["건조기", "건조"],
    "TV": ["tv", "qled", "올레드", "oled", "네오"],
    "에어컨": ["에어컨", "무풍", "휘센"],
    # 카테고리는 일반명 — 스타일러(LG)·에어드레서(삼성)는 각사 제품명이라 키워드로만 쓴다
    "의류관리기": ["에어드레서", "스타일러", "의류관리"],
    "청소기": ["청소기", "제트", "코드제로", "로봇청소"],
    "식기세척기": ["식기세척", "식세기"],
}
# 브랜드 분류는 전 채널 공용 SSOT(brand_lexicon)로 통일 — LG 과소집계 방지(라틴경계 룩어라운드 + 유통명 별칭).
from brand_lexicon import brand_label as _brand_label
POS = ["만족", "좋아", "좋았", "예뻐", "예쁨", "추천", "최고", "꿀", "성공", "잘 샀", "잘샀", "강추", "이득", "혜자"]
NEG = ["불만", "별로", "후회", "최악", "고장", "소음", "as", "에이에스", "지연", "환불", "실망", "하자", "불편"]
AD = ["ader.naver", "event", "이벤트", "프로모션", "쿠폰", "특가", "최저가", "공구", "체험단", "협찬", "추천인", "적립", "원고료", "제공받", "광고"]

# --- 매장·지역 매칭 ---
# 매칭 규칙은 census 파이프라인(build_web_data.py)의 것을 그대로 쓴다.
# 여기서 따로 정의하면 같은 후기가 채널마다 다른 매장명으로 잡혀 비교가 깨진다
# (실제로 '롯데 광복점' vs '롯데 광복'처럼 갈렸다). 규칙은 한 곳에서만 고친다.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_web_data import (          # noqa: E402
    SIDO, region_of, dept_store_of, STORE_EXCLUDE, STORE_REGION,
)

# 전국 대상 — 대시보드가 전국 68개 매장을 다루므로 수집도 전국으로 맞춘다.
# (예전에는 부울경 외 지역을 버렸다. 그러면 새 채널만 권역에 갇혀 범위가 어긋난다.)
DEFAULT_QUERIES = [
    "혼수 가전 후기 삼성 LG",
    "신혼 가전 견적 후기",
    "혼수 가전 발품 후기",
    "가전 졸업 후기",
    "웨딩 가전 구매 후기",
    "신혼집 가전 패키지 후기",
    "삼성스토어 혼수 가전 후기",
    "LG 베스트샵 혼수 가전 후기",
    "백화점 혼수 가전 견적",
] + [f"{ch} {br} 혼수 가전" for ch, br in [
    # 지역 대표 백화점 — 시도별로 고르게(전국 균등)
    ("롯데", "잠실"), ("신세계", "강남"), ("현대", "판교"), ("더현대", "서울"),
    ("롯데", "부산본점"), ("신세계", "센텀시티"), ("현대", "울산"), ("롯데", "창원"),
    ("신세계", "대구"), ("롯데", "인천"), ("갤러리아", "타임월드"), ("신세계", "광주"),
    ("롯데", "본점"), ("현대", "중동"), ("갤러리아", "광교"), ("AK", "평택"),
]]

CHANNEL_LABEL = {"naver-blog": "네이버 블로그", "busan-mom-cafe": "맘카페"}
PREFIX = {"naver-blog": "B", "busan-mom-cafe": "M"}

PROFILE_DIR = ROOT / ".browser-profile"


def run_search(query, search_type, display, sort):
    cmd = ["powershell", "-ExecutionPolicy", "Bypass", "-File", str(PS1),
           "-Query", query, "-Type", search_type, "-Display", str(display), "-Sort", sort]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", timeout=60)
    except Exception as e:
        print(f"  [warn] 검색 실패({query[:20]}…): {e}", file=sys.stderr)
        return []
    if out.returncode != 0:
        msg = (out.stderr or "").strip().splitlines()
        print(f"  [warn] API 오류({query[:20]}…): {msg[0] if msg else out.returncode}", file=sys.stderr)
        return []
    try:
        data = json.loads(out.stdout)
    except json.JSONDecodeError:
        return []
    return data.get("items", []) or []


def classify(text):
    t = text.lower()
    brand = _brand_label(text)  # 공용 SSOT — 원문(대소문자 보존)으로 LG 라틴경계 정확 판정
    items = [name for name, kws in ITEMS.items() if any(k.lower() in t for k in kws)]
    if any(k in t for k in NEG):
        tone = "부정"
    elif any(k in t for k in POS):
        tone = "긍정"
    else:
        tone = "중립"
    is_ad = any(k.lower() in t for k in AD)
    return brand, items, tone, is_ad


def match_store(text):
    """반환: (store_name, region) | (None, region) 지역만 | (None, None) 매칭불가.
    census와 같은 규칙을 쓰므로 매장명 표기가 채널 간에 일치한다.
    전국 수집이라 '권역 외 제외(__OUT__)'는 더 이상 쓰지 않는다."""
    region = region_of(text)
    if not region:
        return None, None
    store = dept_store_of(text)
    if store in STORE_EXCLUDE:
        store = None
    if store == "롯데 본점" and region == "부산":
        store = "롯데 부산본점"          # 부산에서 '롯데 본점'은 부산본점
    if store:
        # 지점 토큰이 다른 시도를 가리키면 그 시도로 재배정(census와 동일)
        br = store.split(" ")[-1]
        rg2 = STORE_REGION.get(br)
        if not rg2:
            for tk, r in STORE_REGION.items():
                if tk in br:
                    rg2 = r
                    break
        if rg2:
            region = rg2
    return store, region


def collect(source_id, search_type, queries, display, sort, out_date):
    seen = set()
    rows = []
    for q in queries:
        for it in run_search(q, search_type, display, sort):
            link = it.get("link") or ""
            if not link or link in seen:
                continue
            title = (it.get("title") or "").strip()
            desc = (it.get("description") or "").strip()
            text = f"{title} {desc}".strip()
            if len(text) < 8:
                continue
            brand, items, tone, is_ad = classify(text)
            store, region = match_store(text)
            # 가전 신호 전무 + 브랜드 미상 → 잡음 제외
            if not items and brand == "기타/미상":
                continue
            seen.add(link)
            rows.append({
                "title": title, "desc": desc, "link": link,
                "date": it.get("postdate") or "", "src_name": it.get("cafename") or it.get("bloggername") or "",
                "brand": brand, "items": items, "tone": tone, "ad": is_ad,
                "store": store, "region": region,
            })
    return rows


def read_bodies(rows, headless, max_body):
    """캡처된 link 본문을 Playwright 공유 프로파일로 열어 품목·톤·매장을 재추출한다.
       게시판 --read-body와 동일한 '본문 정독' 정밀도를 검색 채널에도 부여.
       주의: .browser-profile은 스크래퍼/세션관리기와 공유 → 동시 실행 금지(TargetClosedError)."""
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        print("  [warn] playwright 미설치 → 본문 읽기 생략. 제목+요약 기준으로 진행.", file=sys.stderr)
        return 0
    targets = rows[:max_body]
    read = 0
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=str(PROFILE_DIR), channel="chrome", headless=headless,
            viewport={"width": 1280, "height": 900},
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        for r in targets:
            body = _fetch_body(page, r["link"])
            if not body:
                continue
            r["body"] = body[:1500]
            full = f"{r['title']} {r['desc']} {body}"
            brand, items, tone, _ad = classify(full)
            r["brand"], r["items"], r["tone"] = brand, items, tone
            r["store"], r["region"] = match_store(full)
            r["body_read"] = True
            read += 1
            page.wait_for_timeout(800)  # 완만한 속도 (개인 모니터링·ToS 준수)
        ctx.close()
    return read


def _fetch_body(page, url):
    for wait in ("commit", "domcontentloaded", "load"):
        try:
            page.goto(url, wait_until=wait, timeout=20000)
            page.wait_for_timeout(1200)
            break
        except Exception:
            continue
    # 네이버 블로그: 본문이 mainFrame(iframe) 안 — 우선 시도
    for fr in page.frames:
        u = (fr.url or "").lower()
        if "postview" in u or "mainframe" in u or "/post" in u:
            try:
                txt = fr.inner_text("body")
                if txt and len(txt) > 50:
                    return txt
            except Exception:
                pass
    try:
        return page.inner_text("body")
    except Exception:
        return ""


def write_report(source_id, rows, out_date, query_count, body_read=0):
    label = CHANNEL_LABEL.get(source_id, source_id)
    pfx = PREFIX.get(source_id, "X")
    nonad = [r for r in rows if not r["ad"]]
    ads = sum(1 for r in rows if r["ad"])
    brand_cnt = Counter(r["brand"] for r in nonad)
    item_cnt = Counter(i for r in nonad for i in r["items"])
    tone_cnt = Counter(r["tone"] for r in nonad)

    # 매장별 삼성/LG 집계 (광고 제외, 매장 특정분만)
    store_sl = defaultdict(lambda: {"삼성": 0, "LG": 0, "삼성·LG": 0, "기타/미상": 0, "region": ""})
    region_sl = defaultdict(lambda: {"삼성": 0, "LG": 0})
    unknown_region = Counter()
    for r in nonad:
        if r["store"]:
            store_sl[r["store"]][r["brand"]] += 1
            store_sl[r["store"]]["region"] = r["region"] or ""
            if r["brand"] in ("삼성", "LG"):
                region_sl[r["region"]][r["brand"]] += 1
        elif r["region"]:
            unknown_region[r["region"]] += 1

    L = []
    L.append(f"# 원본 후기 분석 — {label} (네이버 검색 API 기반)")
    L.append(f"> 소스ID: {source_id} · 채널: {label} · 수집경로: 네이버 검색 Open API({search_label(source_id)})")
    L.append(f"> 쿼리 {query_count}종 · 수집(중복제거 후): {len(rows)} · 광고추정 {ads} 제외 전")
    if body_read:
        L.append(f"> 생성: {out_date} · 분석단위: 제목+요약+**본문 정독 {body_read}건**(게시판 --read-body 동일 정밀도)")
        L.append("> ✅✅ 본문까지 열람한 레코드는 품목·톤·매장 정밀도가 게시판 정본 수준. 본문 미열람분은 요약 기준 '추정'.")
    else:
        L.append(f"> 생성: {out_date} · 분석단위: 제목+요약(description) — 본문 전체 아님(요약 일부). 정밀도↑ 필요시 --read-body.")
        L.append("> ✅ 세션 덤프(제목만)보다 정밀 — 품목·톤·매장 단서를 요약에서 추출. 단 요약 한계로 '추정' 유지.")
    L.append("")
    L.append("## 브랜드 집계 (광고추정 제외)")
    L.append("| 브랜드 | 건수 |")
    L.append("|---|---|")
    for b in ["삼성", "LG", "삼성·LG", "기타/미상"]:
        L.append(f"| {b} | {brand_cnt.get(b,0)} |")
    L.append("")
    L.append("## 품목 집계 (광고추정 제외)")
    if item_cnt:
        L.append("| 품목 | 언급 |")
        L.append("|---|---|")
        for it, c in item_cnt.most_common():
            L.append(f"| {it} | {c} |")
    else:
        L.append("_품목 신호 없음._")
    L.append("")
    L.append(f"## 톤 (광고추정 제외): 긍정 {tone_cnt.get('긍정',0)} / 부정 {tone_cnt.get('부정',0)} / 중립 {tone_cnt.get('중립',0)}")
    L.append("")
    L.append("## 매장 매칭 — 전국 백화점 (광고추정 제외, 매장 특정분)")
    if store_sl:
        L.append("| 매장 | 지역 | 삼성 | LG | 양사 |")
        L.append("|---|---|---|---|---|")
        for name in sorted(store_sl, key=lambda n: -(store_sl[n]['삼성'] + store_sl[n]['LG'])):
            d = store_sl[name]
            L.append(f"| {name} | {d['region']} | {d['삼성']} | {d['LG']} | {d['삼성·LG']} |")
        L.append("")
        L.append("**지역 합계(매장 특정분, 삼성 vs LG)**")
        L.append("| 지역 | 삼성 | LG |")
        L.append("|---|---|---|")
        for rg in sorted(region_sl, key=lambda r: -(region_sl[r]['삼성'] + region_sl[r]['LG'])):
            L.append(f"| {rg} | {region_sl[rg]['삼성']} | {region_sl[rg]['LG']} |")
    else:
        L.append("_매장 특정 단서 없음 — 전량 매장 미상._")
    if unknown_region:
        L.append("")
        L.append(f"매장 미상(권역만 잡힘): " + " / ".join(f"{k} {v}" for k, v in unknown_region.most_common()))
    L.append("")
    L.append("## 후기 레코드")
    if not rows:
        L.append("_검색 결과 없음 — 키 미설정이거나 쿼리 매칭 0._")
    for i, r in enumerate(rows, 1):
        tag = " [광고추정]" if r["ad"] else ""
        items = "/".join(r["items"]) if r["items"] else "미상"
        store = r["store"] or (f"{r['region']} 매장미상" if r["region"] else "권역/매장 미상")
        L.append(f"### {pfx}-{i:02d}{tag}")
        L.append(f"- 출처: {r['link']}")
        L.append(f"- 소스ID: {source_id}" + (f" · 출처명: {r['src_name']}" if r["src_name"] else ""))
        L.append(f"- 작성일: {fmt_date(r['date'])}")
        L.append(f"- 매장(추정): {store}")
        L.append(f"- 언급 브랜드: {r['brand']} (추정)")
        L.append(f"- 언급 품목: {items} (추정)")
        L.append(f"- 톤: {r['tone']} (추정)")
        L.append(f"- 제목: {r['title'][:120]}")
        if r["desc"]:
            L.append(f"- 요약: {r['desc'][:200]}")
        if r.get("body_read"):
            L.append(f"- 본문(정독): {r.get('body','')[:250]}")
    out = ARTIFACTS / f"{out_date}-01-raw-{source_id}.md"
    out.write_text("\n".join(L), encoding="utf-8")

    print(f"[{source_id}] {label}: 후기 {len(rows)}건 (광고 {ads}) · "
          f"삼성 {brand_cnt.get('삼성',0)} / LG {brand_cnt.get('LG',0)} / 양사 {brand_cnt.get('삼성·LG',0)}")
    print(f"          품목 TOP: {', '.join(f'{k}{v}' for k,v in item_cnt.most_common(5)) or '없음'}")
    print(f"          매장특정 {sum(1 for r in nonad if r['store'])}건 · 권역미상 {sum(unknown_region.values())}건")
    print(f"          → {out}")


def search_label(source_id):
    return "blog" if source_id == "naver-blog" else "cafearticle"


def fmt_date(s):
    if s and len(s) == 8 and s.isdigit():
        return f"{s[:4]}-{s[4:6]}-{s[6:]}"
    return "(추정)"


def main():
    ap = argparse.ArgumentParser(description="네이버 검색 API → 가전 후기 분석")
    ap.add_argument("--source-id", required=True, choices=["naver-blog", "busan-mom-cafe"])
    ap.add_argument("--display", type=int, default=100)
    ap.add_argument("--sort", default="date", choices=["sim", "date"])
    ap.add_argument("--date", default=datetime.now().strftime("%Y%m%d"))
    ap.add_argument("--query", action="append", help="쿼리 추가(반복 가능). 미지정 시 기본 세트.")
    ap.add_argument("--read-body", action="store_true", help="각 링크 본문을 Playwright로 열어 정밀 재분류(게시판 --read-body 동일).")
    ap.add_argument("--max-body", type=int, default=40, help="본문 읽기 최대 건수(완만한 속도).")
    ap.add_argument("--headless", action="store_true", help="본문 읽기 시 창 숨김.")
    args = ap.parse_args()

    import os
    if not (os.environ.get("NAVER_CLIENT_ID") and os.environ.get("NAVER_CLIENT_SECRET")):
        raise SystemExit("[error] 환경변수 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 미설정. "
                         "data/naver-api.md 2절 참조해 사용자가 직접 setx로 등록 후 새 터미널에서 재실행.")

    stype = "blog" if args.source_id == "naver-blog" else "cafearticle"
    queries = args.query or DEFAULT_QUERIES
    rows = collect(args.source_id, stype, queries, args.display, args.sort, args.date)
    body_read = 0
    if args.read_body and rows:
        print(f"  본문 읽기 시작(최대 {args.max_body}건)…")
        body_read = read_bodies(rows, args.headless, args.max_body)
        print(f"  본문 읽기 완료: {body_read}건 정밀 재분류")
    write_report(args.source_id, rows, args.date, len(queries), body_read)


if __name__ == "__main__":
    main()
