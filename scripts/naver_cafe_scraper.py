#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
네이버 다이렉트결혼준비 카페 가전 후기 자동 수집기 (Playwright)

이 스크립트는 사장님 PC에서 직접 실행된다 (샌드박스 브라우저 도구가 아니라
로컬 Chrome을 Playwright로 구동하므로 네이버 차단과 무관).

서브커맨드
  login  : 로그인 전용. 크롬 창을 띄우고 일정 시간 대기. 그동안 사용자가
           네이버에 직접 로그인하면 세션이 프로필에 저장된다 (비번은 코드가 안 만짐).
  probe  : 진단용. 한 키워드로 검색해 화면/DOM 구조를 덤프한다 (셀렉터 보정용).
  scrape : 키워드별로 카페 내 검색 → 글 목록·본문 수집 → 삼성/LG·매장 건수 집계.

사용 예
  python naver_cafe_scraper.py login --seconds 240
  python naver_cafe_scraper.py probe --query "롯데 부산본점 삼성 혼수"
  python naver_cafe_scraper.py scrape --query "롯데 부산본점 삼성 혼수" --pages 3 --max-articles 20
"""
import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

from playwright.sync_api import sync_playwright

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
PROFILE_DIR = ROOT / ".browser-profile"
ARTIFACTS = ROOT / "artifacts"
CAFE_URL = os.environ.get("VIRAL_CAFE_URL", "https://cafe.naver.com/directwedding")
# 기본은 다이렉트결혼준비(probe로 확인). 다른 카페는 VIRAL_CLUBID 환경변수로 교체.
CLUBID = os.environ.get("VIRAL_CLUBID", "25228091")

# 권역 매장 단서 (data/target-stores.md와 동기화)
# 2026-06-11 KakaoMap 검증 12개점. 폐점/미실재(현대 부산점·롯데 김해점) 제거.
STORE_PATTERNS = {
    "롯데 부산본점": [r"롯데.*부산본점", r"부산본점.*롯데", r"서면.*롯데"],
    "롯데 센텀시티": [r"롯데.*센텀", ],
    "신세계 센텀시티": [r"신세계.*센텀", r"센텀.*신세계"],
    "롯데 광복점": [r"롯데.*광복", r"광복.*롯데"],
    "롯데 동래점": [r"롯데.*동래", r"동래.*롯데"],
    "롯데 울산점": [r"롯데.*울산", r"울산.*롯데"],
    "현대 울산점": [r"현대.*울산", r"울산.*현대"],
    "현대 울산 동구": [r"현대.*울산.*(동구|방어진)", r"(동구|방어진).*현대"],
    "롯데 창원점": [r"롯데.*창원", r"창원.*롯데"],
    "신세계 마산점": [r"신세계.*마산", r"마산.*신세계"],
    "신세계 김해": [r"신세계.*김해", r"김해.*신세계"],
    "갤러리아 진주": [r"갤러리아.*진주", r"진주.*갤러리아", r"진주.*갤러리아백화점"],
}
# 브랜드 별칭(유통명 포함) — 과소집계 방지. 삼성중심 분석이나 LG도 정확히 잡아야 추세가 보인다.
SAMSUNG_PATTERNS = [
    r"삼성", r"samsung", r"비스포크", r"bespoke", r"패밀리허브", r"무풍", r"그랑데",
    r"삼성스토어", r"삼성전자", r"디지털프라자", r"디지탈프라자", r"삼성디지털", r"삼디프",
]
LG_PATTERNS = [
    # LG 라틴표기 — 한글 앞뒤(전자 등)에서도 잡히도록 \b 대신 라틴문자 경계 룩어라운드 사용
    r"(?<![A-Za-z])LG(?![A-Za-z])", r"엘지", r"엘쥐", r"엘지전자",
    r"오브제", r"디오스", r"트롬", r"tromm", r"워시타워", r"워시콤보",
    r"휘센", r"스타일러", r"styler", r"코드제로", r"퓨리케어",
    # LG 직영 유통 — 하이프라자(법인)/베스트샵(매장명)
    r"하이프라자", r"베스트\s*샵", r"lg\s*베스트샵",
]
# 멀티브랜드 유통(브랜드 단정 금지) — 참고용. 단독 등장만으론 삼성/LG로 분류하지 않는다.
RETAILER_MULTI = [r"하이마트", r"롯데하이마트", r"전자랜드", r"e랜드", r"쿠팡"]
ITEM_PATTERNS = {
    "냉장고": [r"냉장고"], "김치냉장고": [r"김치냉장고", r"김냉"], "세탁기": [r"세탁기"],
    "건조기": [r"건조기"], "식기세척기": [r"식기세척기", r"식세기"], "TV": [r"\bTV\b", r"티비", r"텔레비전"],
    "에어컨": [r"에어컨"], "스타일러": [r"스타일러"], "청소기": [r"청소기"],
}


def _match_any(text, patterns):
    return any(re.search(p, text, re.IGNORECASE) for p in patterns)


def _match_list(text, pattern_map):
    hits = []
    for name, pats in pattern_map.items():
        if _match_any(text, pats):
            hits.append(name)
    return hits


# ---- 날짜/시계열 헬퍼 ----
def parse_dt(s):
    """addDate(ISO) → datetime. 실패 시 None."""
    if not s:
        return None
    try:
        return datetime.fromisoformat(str(s)[:19])
    except Exception:
        try:
            return datetime.strptime(str(s)[:10], "%Y-%m-%d")
        except Exception:
            return None


def _sl(records):
    """(삼성건수, LG건수) — 양브랜드 동시언급은 양쪽 각각."""
    return (sum(1 for r in records if r.get("samsung")),
            sum(1 for r in records if r.get("lg")))


def _week_key(dt):
    """ISO 연-주차 키와 그 주 월요일 date 반환."""
    iso = dt.isocalendar()
    monday = (dt - timedelta(days=dt.weekday())).date()
    return f"{iso[0]}-W{iso[1]:02d}", monday


def time_summary(records, weeks=12, months=6, ref=None):
    """월별·주차별·최신성 요약 md 라인 리스트 반환. 날짜 파싱된 글만 대상."""
    ref = ref or datetime.now()
    dated = [(parse_dt(r.get("addDate")), r) for r in records]
    dated = [(d, r) for d, r in dated if d]
    n_no_date = len(records) - len(dated)
    if not dated:
        return ["", "## 시계열", "", "(날짜 파싱 가능한 글 없음)"]
    dts = [d for d, _ in dated]
    dmin, dmax = min(dts), max(dts)

    # 월별 버킷
    mon = {}
    for d, r in dated:
        mon.setdefault(d.strftime("%Y-%m"), []).append(r)
    # 주별 버킷
    wk = {}
    for d, r in dated:
        key, monday = _week_key(d)
        wk.setdefault(key, {"monday": monday, "recs": []})
        wk[key]["recs"].append(r)

    # 최신성
    def within(days):
        cut = ref - timedelta(days=days)
        return [r for d, r in dated if d >= cut]
    r30, r90 = within(30), within(90)
    nt = len(dated)

    lines = ["", "## 시계열 (작성일 기준)", "",
             f"- 데이터 기간: **{dmin.date()} ~ {dmax.date()}** (날짜확인 {nt}건"
             + (f", 날짜불명 {n_no_date}건 제외)" if n_no_date else ")"),
             f"- 최근 30일: **{len(r30)}건** ({round(100*len(r30)/nt)}%) · "
             f"최근 90일: **{len(r90)}건** ({round(100*len(r90)/nt)}%)"]

    # 월별 표 (최근 months개월)
    mkeys = sorted(mon.keys())[-months:]
    lines += ["", f"### 월별 (최근 {months}개월)", "",
              "| 월 | 전체 | 삼성 | LG | 삼성비중 |", "|----|----|----|----|----|"]
    prev_total = None
    mom_note = ""
    for k in mkeys:
        recs = mon[k]
        s, l = _sl(recs)
        tot = len(recs)
        share = f"{round(100*s/(s+l))}%" if (s + l) else "-"
        lines.append(f"| {k} | {tot} | {s} | {l} | {share} |")
        prev_total = tot
    # 모멘텀(직전 두 달 비교)
    if len(mkeys) >= 2:
        a, b = len(mon[mkeys[-2]]), len(mon[mkeys[-1]])
        diff = b - a
        arrow = "▲" if diff > 0 else "▼" if diff < 0 else "—"
        mom_note = f"- 모멘텀(전월 대비): {mkeys[-2]} {a}건 → {mkeys[-1]} {b}건 ({arrow}{abs(diff)})"

    # 주별 표 (최근 weeks주)
    wkeys = sorted(wk.keys())[-weeks:]
    lines += ["", f"### 주차별 (최근 {weeks}주)", "",
              "| 주차 | 시작(월) | 전체 | 삼성 | LG |", "|----|----|----|----|----|"]
    for k in wkeys:
        recs = wk[k]["recs"]
        s, l = _sl(recs)
        lines.append(f"| {k} | {wk[k]['monday']} | {len(recs)} | {s} | {l} |")
    if mom_note:
        lines += ["", mom_note]
    return lines


def store_recency(records, ref=None, days=90):
    """매장별 전체/최근건수/최신글일자 → md 라인."""
    ref = ref or datetime.now()
    cut = ref - timedelta(days=days)
    agg = {}
    for r in records:
        ps = r.get("primary_store") or "매장 미상"
        d = parse_dt(r.get("addDate"))
        a = agg.setdefault(ps, {"n": 0, "recent": 0, "last": None})
        a["n"] += 1
        if d:
            if d >= cut:
                a["recent"] += 1
            if a["last"] is None or d > a["last"]:
                a["last"] = d
    lines = ["", f"## 매장별 최신성 (최근 {days}일 비중)", "",
             "| 매장 | 전체 | 최근 | 최근비중 | 최신글 |", "|----|----|----|----|----|"]
    rows = [(s, a) for s, a in agg.items() if s != "매장 미상"]
    for s, a in sorted(rows, key=lambda x: -x[1]["n"]):
        share = f"{round(100*a['recent']/a['n'])}%" if a["n"] else "-"
        last = a["last"].date() if a["last"] else "-"
        lines.append(f"| {s} | {a['n']} | {a['recent']} | {share} | {last} |")
    return lines


def safe_goto(page, url):
    """네이버 카페는 즉시 리다이렉트로 ERR_ABORTED가 잦다. 단계적으로 견딘다."""
    for wait in ("commit", "domcontentloaded", "load"):
        try:
            page.goto(url, wait_until=wait, timeout=20000)
            page.wait_for_timeout(1500)
            return True
        except Exception as e:
            last = e
    print(f"[goto] 경고: {url} 이동 중 예외(무시하고 진행): {last}")
    page.wait_for_timeout(1500)
    return False


def launch(p, headless):
    return p.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR),
        channel="chrome",
        headless=headless,
        viewport={"width": 1280, "height": 900},
        args=["--disable-blink-features=AutomationControlled"],
    )


def cmd_login(args):
    PROFILE_DIR.mkdir(exist_ok=True)
    with sync_playwright() as p:
        ctx = launch(p, headless=False)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        safe_goto(page, CAFE_URL)
        print(f"[login] 크롬 창이 열렸습니다. {args.seconds}초 안에 네이버에 직접 로그인하세요.")
        print("[login] 로그인하면 세션이 프로필에 저장됩니다. 끝나면 창은 자동으로 닫힙니다.")
        for remaining in range(args.seconds, 0, -10):
            print(f"[login] 남은 시간 {remaining}s ...", flush=True)
            time.sleep(10)
        ctx.close()
    print("[login] 완료. 이제 scrape 를 실행하세요.")


def get_cafe_frame(page):
    """클래식 카페는 본문이 #cafe_main iframe 안에 있다. 없으면 메인 프레임."""
    page.wait_for_timeout(1500)
    fr = page.frame(name="cafe_main")
    if fr:
        return fr
    for f in page.frames:
        if "cafe.naver.com" in (f.url or "") and f != page.main_frame:
            return f
    return page.main_frame


def search_url(query, page_no=1):
    from urllib.parse import quote
    inner = (
        f"/ArticleSearchList.nhn?search.clubid={CLUBID}&search.media=0"
        f"&search.searchBy=0&search.sortBy=date&search.searchdate=all"
        f"&search.defaultValue=1&search.query={quote(query)}&search.page={page_no}"
    )
    return f"{CAFE_URL}?iframe_url={quote(inner)}"


def collect_links(fr):
    """검색 결과 프레임에서 (제목, href) 목록 수집. 여러 셀렉터를 폴백으로."""
    out = []
    selectors = [
        "a[href*='ArticleRead']", "a[href*='articleid']",
        "a.article", "a.tit", "a.txt", "div.article-board a",
    ]
    for sel in selectors:
        try:
            for a in fr.query_selector_all(sel):
                t = (a.inner_text() or "").strip()
                h = a.get_attribute("href") or ""
                if t and ("articleid" in h.lower() or "articleread" in h.lower()):
                    out.append((t, h))
        except Exception:
            continue
    # 중복 제거
    seen, uniq = set(), []
    for t, h in out:
        if h not in seen:
            seen.add(h)
            uniq.append((t, h))
    return uniq


def _frame_diag(fr):
    """프레임 안의 a 태그를 전부(필터 없이) 모아 href 패턴을 본다."""
    raw = []
    try:
        for a in fr.query_selector_all("a"):
            h = a.get_attribute("href") or ""
            t = (a.inner_text() or "").strip()
            if h:
                raw.append({"t": t[:40], "h": h[:120]})
    except Exception as e:
        return {"error": str(e)}, 0
    html_len = 0
    try:
        html_len = len(fr.content())
    except Exception:
        pass
    return raw, html_len


def cmd_probe(args):
    with sync_playwright() as p:
        ctx = launch(p, headless=False)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        safe_goto(page, search_url(args.query))
        # 검색 프레임 콘텐츠가 실제로 채워질 때까지 충분히 대기
        page.wait_for_timeout(4000)
        fr = get_cafe_frame(page)
        try:
            fr.wait_for_load_state("networkidle", timeout=8000)
        except Exception:
            pass
        page.wait_for_timeout(2000)
        body_text = ""
        try:
            body_text = fr.inner_text("body")[:2500]
        except Exception as e:
            body_text = f"(본문 추출 실패: {e})"
        links = collect_links(fr)
        raw_anchors, html_len = _frame_diag(fr)
        # 메인 프레임도 같이 진단 (새 카페 SPA 가능성)
        main_anchors, main_html = _frame_diag(page.main_frame)
        info = {
            "query": args.query,
            "search_url": search_url(args.query),
            "main_url": page.url,
            "frames": [f.url for f in page.frames],
            "frame_used": fr.url,
            "frame_html_len": html_len,
            "links_found": len(links),
            "links_sample": links[:15],
            "raw_anchor_count": len(raw_anchors) if isinstance(raw_anchors, list) else raw_anchors,
            "raw_anchors_sample": raw_anchors[:30] if isinstance(raw_anchors, list) else raw_anchors,
            "main_html_len": main_html,
            "main_anchor_count": len(main_anchors) if isinstance(main_anchors, list) else main_anchors,
            "body_preview": body_text,
        }
        ARTIFACTS.mkdir(exist_ok=True)
        out = ARTIFACTS / "probe-dump.json"
        out.write_text(json.dumps(info, ensure_ascii=False, indent=2), encoding="utf-8")
        try:
            page.screenshot(path=str(ARTIFACTS / "probe-shot.png"), full_page=True)
        except Exception:
            pass
        print(f"[probe] 덤프 저장: {out} / 링크 {len(links)}건 / raw a {info['raw_anchor_count']}건")
        page.wait_for_timeout(1000)
        ctx.close()


def analyze_text(title, body=""):
    """제목·본문에서 매장·브랜드·품목 추출. 제목/본문 신호를 분리 보관한다."""
    full = f"{title}\n{body}"
    title_stores = _match_list(title, STORE_PATTERNS)
    body_stores = _match_list(body, STORE_PATTERNS)
    return {
        "title_stores": title_stores,
        "body_stores": body_stores,
        "items": _match_list(full, ITEM_PATTERNS),
        "samsung": _match_any(full, SAMSUNG_PATTERNS),
        "lg": _match_any(full, LG_PATTERNS),
        "title_samsung": _match_any(title, SAMSUNG_PATTERNS),
        "title_lg": _match_any(title, LG_PATTERNS),
    }


def primary_store(rec):
    """글 1건 = 매장 1곳. 제목 우선, 제목에 매장 없으면 본문에서 '정확히 1곳'일 때만 채택.
    제목에 2곳 이상(비교글)·본문에 0곳/여러 곳(리스트·광고)은 '매장 미상'으로 분리."""
    ts = rec.get("title_stores", [])
    if len(ts) == 1:
        return ts[0]
    if len(ts) >= 2:
        return "매장 미상"
    bs = rec.get("body_stores", [])
    if len(bs) == 1:
        return bs[0]
    return "매장 미상"


def aggregate_and_write(records, stamp=None):
    """records → 매장별 삼성/LG 표 (글 1건=매장 1곳, 교정 집계). 파일로 저장하고 md 텍스트 반환."""
    stamp = stamp or datetime.now().strftime("%Y%m%d")
    store_counts = {}
    both_brand = 0
    body_used = 0  # 제목엔 매장 없고 본문으로 매칭된 건수
    for r in records:
        ps = primary_store(r)
        r["primary_store"] = ps
        if r.get("samsung") and r.get("lg"):
            both_brand += 1
        if not r.get("title_stores") and len(r.get("body_stores", [])) == 1:
            body_used += 1
        d = store_counts.setdefault(ps, {"삼성": 0, "LG": 0})
        if r.get("samsung"):
            d["삼성"] += 1
        if r.get("lg"):
            d["LG"] += 1

    ARTIFACTS.mkdir(exist_ok=True)
    raw_out = ARTIFACTS / f"{stamp}-cafe-raw.json"
    raw_out.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")

    n = len(records)
    misc = store_counts.get("매장 미상", {"삼성": 0, "LG": 0})
    lines = [
        f"# 카페 자동 수집 결과 — {stamp}", "",
        f"> 소스: 다이렉트결혼준비 카페 (자동 수집) / 글 {n}건 (articleId 기준 중복제거)",
        f"> 집계 원칙: **글 1건 = 매장 1곳** (제목 매장명 우선, 본문은 단일매장일 때만)",
        f"> 양 브랜드 동시언급 글 {both_brand}건은 삼성·LG 양쪽에 각각 카운트(비교·동시구매 후기)",
        "> ⚠ 표본 기준 추정치 — 전수 아님", "",
        "## 매장별 삼성 vs LG 건수 (권역 백화점)", "",
        "| 매장 | 삼성 | LG | 합 |", "|------|------|----|----|",
    ]
    region_rows = [(s, d) for s, d in store_counts.items() if s != "매장 미상"]
    for s, d in sorted(region_rows, key=lambda x: -(x[1]['삼성'] + x[1]['LG'])):
        lines.append(f"| {s} | {d['삼성']} | {d['LG']} | {d['삼성'] + d['LG']} |")
    lines += [
        "", f"매장 미상(권역 단서 약함·다수매장 언급): 삼성 {misc['삼성']} / LG {misc['LG']}",
        f"본문 단서로 매장 보정된 글: {body_used}건",
    ]
    # 시계열·최신성 요약 동봉
    lines += time_summary(records, weeks=8, months=6)
    lines += store_recency(records, days=90)
    md = "\n".join(lines)
    md_out = ARTIFACTS / f"{stamp}-cafe-counts.md"
    md_out.write_text(md, encoding="utf-8")
    return raw_out, md_out, md


# ===== 누적(증분) 모니터링 =====
# 전략: 최초 1회 전체 기간 백필 → 이후 '당월+직전 2개월' 윈도우만 재수집해 머지.
#   - 과거 후기는 한 번 확정되면 거의 변동이 없으므로 매번 전체를 다시 긁지 않는다.
#   - 누적본은 articleId로 중복 제거하여 시간이 지나도 단일 진실원천(SSOT)을 유지.
CUMULATIVE = ARTIFACTS / "cumulative-cafe-raw.json"


def load_cumulative():
    if CUMULATIVE.exists():
        try:
            return json.loads(CUMULATIVE.read_text(encoding="utf-8"))
        except Exception:
            return []
    return []


def _window_start(months_back):
    """오늘 기준 months_back 개월 전 '그 달 1일' datetime. 예: 2026-06, back=2 → 2026-04-01."""
    now = datetime.now()
    y, m = now.year, now.month
    m -= months_back
    while m <= 0:
        m += 12
        y -= 1
    return datetime(y, m, 1)


def merge_into_cumulative(incoming, window_months=None):
    """incoming 레코드를 누적본에 머지(articleId 기준).
    window_months 지정 시: 그 기간 안의 incoming만 신뢰하여 갱신하고,
    기간 밖 과거분은 기존 누적본을 그대로 보존한다(증분 모드).
    반환: (merged_records, n_new, n_updated)."""
    existing = load_cumulative()
    by_id = {r.get("articleId"): r for r in existing if r.get("articleId")}
    start = _window_start(window_months) if window_months else None

    n_new = n_upd = 0
    for r in incoming:
        aid = r.get("articleId")
        if not aid:
            continue
        if start is not None:
            dt = parse_dt(r.get("addDate"))
            # 윈도우 밖(과거) 글은 증분 수집에서 무시 — 기존 누적본 보존
            if dt is not None and dt < start:
                continue
        if aid in by_id:
            by_id[aid] = r
            n_upd += 1
        else:
            by_id[aid] = r
            n_new += 1
    merged = list(by_id.values())
    return merged, n_new, n_upd


def save_cumulative(records):
    ARTIFACTS.mkdir(exist_ok=True)
    CUMULATIVE.write_text(
        json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8"
    )


SEARCH_API = "https://apis.cafe.naver.com/search/v2/cafes/{clubid}/search/articles"
# 새(SPA) 카페 글 본문 API 후보 (로그인 시 동작). 순서대로 시도.
ARTICLE_API_CANDIDATES = [
    "https://apis.naver.com/cafe-web/cafe-articleapi/v3/cafes/{clubid}/articles/{aid}?query=&useCafeId=true&boardType=L",
    "https://apis.naver.com/cafe-web/cafe-articleapi/v2.1/cafes/{clubid}/articles/{aid}?query=&useCafeId=true&boardType=L",
]
API_HEADERS = {
    "Referer": "https://cafe.naver.com/",
    "User-Agent": ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                   "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"),
}


def _strip_html(html):
    if not html:
        return ""
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&[a-z]+;", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _page_fetch_json(page, url):
    """페이지 컨텍스트에서 fetch (쿠키·오리진 포함). {status, body} 반환."""
    js = """
    async (u) => {
      try {
        const r = await fetch(u, {credentials: 'include',
          headers: {'Accept': 'application/json', 'X-Cafe-Product': 'pc'}});
        const t = await r.text();
        return {status: r.status, body: t};
      } catch (e) { return {status: -1, body: String(e)}; }
    }
    """
    try:
        return page.evaluate(js, url)
    except Exception as e:
        return {"status": -2, "body": str(e)}


def api_search(page, query, page_no, per_page=15):
    """검색 API 호출 → article item 리스트 반환 (로그인 불필요)."""
    from urllib.parse import quote_plus
    url = (SEARCH_API.format(clubid=CLUBID)
           + f"?query={quote_plus(query)}&perPage={per_page}&page={page_no}"
           + "&menuId=0&views=MEMBER_LEVEL%2CCOUNT%2CSALE_INFO%2CCAFE_MENU")
    res = _page_fetch_json(page, url)
    if res["status"] != 200:
        print(f"[scrape]   검색 API status={res['status']} {str(res['body'])[:120]}")
        return []
    try:
        data = json.loads(res["body"])
    except Exception as e:
        print(f"[scrape]   JSON 파싱 실패: {e}")
        return []
    arts = data.get("result", {}).get("articleList", [])
    out = []
    for a in arts:
        it = a.get("item", {})
        if it.get("articleId"):
            out.append(it)
    return out


def api_article_body(page, aid):
    """글 본문 API 시도 (로그인 시 동작). 실패하면 빈 문자열."""
    for tmpl in ARTICLE_API_CANDIDATES:
        url = tmpl.format(clubid=CLUBID, aid=aid)
        res = _page_fetch_json(page, url)
        if res["status"] != 200:
            continue
        try:
            data = json.loads(res["body"])
        except Exception:
            continue
        r = data.get("result", {})
        art = r.get("article", r)
        html = art.get("contentHtml") or art.get("content") or ""
        body = _strip_html(html)
        if body:
            return body
    return ""


def cmd_scrape(args):
    queries = [q.strip() for q in args.query.split("||") if q.strip()]
    records = []
    global_seen = {}  # articleId -> record (전 쿼리 통합 중복 제거)
    with sync_playwright() as p:
        ctx = launch(p, headless=args.headless)
        # 컨텍스트 쿠키를 request에 싣기 위해 카페 1회 접속
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        safe_goto(page, f"https://cafe.naver.com/f-e/cafes/{CLUBID}/menus/0")
        page.wait_for_timeout(2000)

        for q in queries:
            print(f"[scrape] 검색: {q}")
            items = []
            for pg in range(1, args.pages + 1):
                batch = api_search(page, q, pg)
                if not batch:
                    break
                items.extend(batch)
            # 중복(articleId) 제거
            seen, uniq = set(), []
            for it in items:
                aid = it.get("articleId")
                if aid not in seen:
                    seen.add(aid)
                    uniq.append(it)
            uniq = uniq[: args.max_articles]
            print(f"[scrape]  -> 글 {len(uniq)}건 발견")

            for it in uniq:
                aid = it.get("articleId")
                if aid in global_seen:
                    # 이미 다른 쿼리에서 수집됨 → 매칭 쿼리만 기록, 중복 집계 방지
                    global_seen[aid]["matched_queries"].append(q)
                    continue
                subject = it.get("subject", "")
                summary = it.get("summary", "")
                add_date = it.get("addDate", "")
                menu_name = it.get("menuName", "") or str(it.get("menuId", ""))
                url = f"https://cafe.naver.com/f-e/cafes/{CLUBID}/articles/{aid}"
                body = ""
                if args.read_body:
                    body = api_article_body(page, aid)
                    time.sleep(args.delay)
                analysis = analyze_text(f"{subject}\n{summary}", body)
                rec = {
                    "query": q, "matched_queries": [q],
                    "articleId": aid, "title": subject,
                    "summary": summary[:200], "menu": menu_name,
                    "addDate": add_date, "url": url,
                    "body_excerpt": body[:4000],
                    "body_ok": bool(body),
                }
                rec.update(analysis)
                records.append(rec)
                global_seen[aid] = rec
        ctx.close()

    final = records
    if getattr(args, "cumulative", False):
        win = getattr(args, "window_months", None)
        merged, n_new, n_upd = merge_into_cumulative(records, window_months=win)
        save_cumulative(merged)
        mode = f"증분(당월+직전 {win - 1}개월)" if win else "전체 백필"
        print(f"[scrape] 누적 머지({mode}): 신규 {n_new} / 갱신 {n_upd} / 누적 총 {len(merged)}건")
        print(f"[scrape] 누적본 저장: {CUMULATIVE}")
        final = merged

    raw_out, md_out, md = aggregate_and_write(final)
    print(f"[scrape] 원본 저장: {raw_out}")
    print(f"[scrape] 집계 저장: {md_out}")
    print(md)


def cmd_reaggregate(args):
    """저장된 cafe-raw.json을 다시 집계만 한다(재수집 없이 집계 규칙 튜닝용)."""
    src = Path(args.raw) if args.raw else (ARTIFACTS / f"{datetime.now().strftime('%Y%m%d')}-cafe-raw.json")
    records = json.loads(Path(src).read_text(encoding="utf-8"))
    # 구버전 레코드(merged 'stores'만 있음) 호환: title_stores/body_stores 없으면 title로 재유도
    for r in records:
        if "title_stores" not in r:
            a = analyze_text(r.get("title", ""), r.get("body_excerpt", ""))
            r.update(a)
    stamp = Path(src).name.split("-cafe-raw")[0]
    raw_out, md_out, md = aggregate_and_write(records, stamp=stamp)
    print(f"[reaggregate] 집계 저장: {md_out}")
    print(md)


REGION_MAP = {
    "부산": ["롯데 부산본점", "롯데 센텀시티", "신세계 센텀시티", "롯데 광복점", "롯데 동래점"],
    "울산": ["롯데 울산점", "현대 울산점", "현대 울산 동구"],
    "경남": ["롯데 창원점", "신세계 마산점", "신세계 김해", "갤러리아 진주"],
}
_BRAND_WORDS = SAMSUNG_PATTERNS + LG_PATTERNS


def cmd_audit(args):
    """집계 결과를 자동 감사한다(결과검증 에이전트의 결정론적 도구).
    이번 하네스에서 실제로 터졌던 실패유형을 체크한다:
      1) 매장 다중카운트 부풀림  2) 쿼리 브랜드 편향  3) 양브랜드 중복 비중
      4) 매장 미상 과다  5) 표본 부족 매장  6) 권역 합계 산술 검산  7) articleId 중복."""
    src = Path(args.raw) if args.raw else (ARTIFACTS / f"{datetime.now().strftime('%Y%m%d')}-cafe-raw.json")
    records = json.loads(Path(src).read_text(encoding="utf-8"))
    for r in records:
        if "title_stores" not in r:
            r.update(analyze_text(r.get("title", ""), r.get("body_excerpt", "")))

    n = len(records)
    flags, oks = [], []

    # 0) articleId 중복
    ids = [r.get("articleId") for r in records]
    dup = n - len(set(ids))
    (flags if dup else oks).append(f"articleId 중복 {dup}건" if dup else "articleId 고유성 OK")

    # 1) 매장 다중카운트 부풀림 — primary_store 적용 후 다중매장 글이 집계에 누수됐는지
    leak = [r for r in records if len([s for s in r.get("body_stores", []) if s]) >= 3
            and primary_store(r) != "매장 미상"]
    (flags if leak else oks).append(
        f"⚠ 매장 3곳+ 언급인데 특정매장 집계된 글 {len(leak)}건(부풀림 위험)" if leak
        else "매장 다중카운트 부풀림 차단 OK (리스트·비교글 → 매장 미상)")

    # 2) 쿼리 브랜드 편향 — 수집 쿼리에 삼성/LG 단어가 박혀 있나
    qs = set()
    for r in records:
        for q in r.get("matched_queries", [r.get("query", "")]):
            qs.add(q)
    biased = [q for q in qs if _match_any(q, _BRAND_WORDS)]
    (flags if biased else oks).append(
        f"⚠ 브랜드 단어 포함 쿼리 {len(biased)}개 → 브랜드 카운트 오염 위험: {biased}" if biased
        else f"쿼리 브랜드 중립 OK (쿼리 {len(qs)}개 모두 브랜드 단어 없음)")

    # 3) 양브랜드 동시언급 비중
    both = sum(1 for r in records if r.get("samsung") and r.get("lg"))
    share = round(100 * both / n, 1) if n else 0
    oks.append(f"양브랜드 동시언급 {both}건({share}%) — 삼성·LG 양쪽 카운트(중복 아님, 동반언급). 리포트 명시 필요")

    # 4) 매장 미상 비중
    misc = sum(1 for r in records if primary_store(r) == "매장 미상")
    mshare = round(100 * misc / n, 1) if n else 0
    (flags if mshare >= 50 else oks).append(
        f"{'⚠ ' if mshare>=50 else ''}매장 미상 {misc}건({mshare}%)" +
        (" — 절반 이상, 매장 비교 대표성 주의" if mshare >= 50 else " — 허용 범위"))

    # 5) 매장별 표본/신뢰도
    store_n = {}
    for r in records:
        ps = primary_store(r)
        if ps == "매장 미상":
            continue
        store_n[ps] = store_n.get(ps, 0) + 1
    low = {s: c for s, c in store_n.items() if c < 5}
    conf = {s: ("높음" if c >= 15 else "보통" if c >= 5 else "낮음") for s, c in store_n.items()}
    (flags if low else oks).append(
        f"표본 부족(<5건) 매장 {len(low)}곳: {low} — '경향'으로만 해석" if low
        else "모든 매장 표본 5건+ OK")

    # 6) 권역 합계 산술 검산
    region_sum = {}
    for reg, stores in REGION_MAP.items():
        s = sum(1 for r in records if primary_store(r) in stores and r.get("samsung"))
        l = sum(1 for r in records if primary_store(r) in stores and r.get("lg"))
        region_sum[reg] = {"삼성": s, "LG": l}

    # 8) 날짜 커버리지·최신성 — 표본이 오래된 글 위주면 '현재 바이럴' 왜곡
    dts = [parse_dt(r.get("addDate")) for r in records]
    dts = [d for d in dts if d]
    no_date = n - len(dts)
    if dts:
        ref = datetime.now()
        r90 = sum(1 for d in dts if d >= ref - timedelta(days=90))
        share90 = round(100 * r90 / len(dts))
        span = f"{min(dts).date()}~{max(dts).date()}"
        cond = share90 < 30 or no_date > n * 0.1
        (flags if cond else oks).append(
            (f"⚠ 최신성 주의: 최근 90일 글 {share90}%" if share90 < 30 else f"최신성 OK: 최근 90일 {share90}%")
            + (f", 날짜불명 {no_date}건" if no_date else "") + f" (기간 {span})")
    else:
        flags.append("⚠ 날짜 파싱 가능한 글 없음 — 시계열 분석 불가")

    # 결과 md
    stamp = Path(src).name.split("-cafe-raw")[0]
    lines = [f"# 집계 검증(QA) 리포트 — {stamp}", "",
             f"> 대상: `{Path(src).name}` / 글 {n}건",
             f"> 판정: **{'경고 ' + str(len(flags)) + '건' if flags else '통과'}** "
             f"(체크 {len(flags)+len(oks)}항목 중 경고 {len(flags)})", "",
             "## 경고/주의"]
    lines += [f"- {f}" for f in flags] or ["- (없음)"]
    lines += ["", "## 통과 항목"] + [f"- {o}" for o in oks]
    lines += ["", "## 매장별 표본·신뢰도", "", "| 매장 | 표본 | 신뢰도 |", "|------|------|------|"]
    for s, c in sorted(store_n.items(), key=lambda x: -x[1]):
        lines.append(f"| {s} | {c} | {conf[s]} |")
    lines += ["", "## 권역 합계 (검산용)", "", "| 권역 | 삼성 | LG |", "|------|------|----|"]
    for reg, d in region_sum.items():
        lines.append(f"| {reg} | {d['삼성']} | {d['LG']} |")
    md = "\n".join(lines)
    ARTIFACTS.mkdir(exist_ok=True)
    out = ARTIFACTS / f"{stamp}-verify.md"
    out.write_text(md, encoding="utf-8")
    print(f"[audit] 검증 저장: {out} / 경고 {len(flags)}건")
    print(md)


def cmd_timeline(args):
    """저장된 cafe-raw.json에서 월별·주차별·최신성 시계열을 산출(재수집 없이)."""
    src = Path(args.raw) if args.raw else (ARTIFACTS / f"{datetime.now().strftime('%Y%m%d')}-cafe-raw.json")
    records = json.loads(Path(src).read_text(encoding="utf-8"))
    for r in records:
        if "title_stores" not in r:
            r.update(analyze_text(r.get("title", ""), r.get("body_excerpt", "")))
        if "primary_store" not in r:
            r["primary_store"] = primary_store(r)
    stamp = Path(src).name.split("-cafe-raw")[0]
    lines = [f"# 바이럴 시계열 — {stamp}", "",
             f"> 대상: `{Path(src).name}` / 글 {len(records)}건 · ⚠ 표본 기준 추정치"]
    lines += time_summary(records, weeks=args.weeks, months=args.months)
    lines += store_recency(records, days=args.recent_days)
    md = "\n".join(lines)
    out = ARTIFACTS / f"{stamp}-timeline.md"
    out.write_text(md, encoding="utf-8")
    print(f"[timeline] 저장: {out}")
    print(md)


def cmd_netprobe(args):
    """새(SPA) 카페: 검색을 UI로 수행하며 apis.naver.com JSON 호출을 캡처해
    실제 글 검색 API 엔드포인트를 알아낸다."""
    from urllib.parse import quote
    captured = []

    with sync_playwright() as p:
        ctx = launch(p, headless=False)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()

        def on_response(resp):
            u = resp.url
            if "apis.naver.com" in u or "apis.cafe.naver.com" in u or "/cafe-web/" in u or "ArticleList" in u or "search" in u.lower():
                entry = {"url": u, "status": resp.status, "ct": resp.headers.get("content-type", "")}
                try:
                    entry["req_headers"] = dict(resp.request.headers)
                except Exception:
                    pass
                if "json" in entry["ct"].lower():
                    try:
                        body = resp.text()
                        entry["body_preview"] = body[:600]
                    except Exception as e:
                        entry["body_preview"] = f"(read fail: {e})"
                captured.append(entry)

        page.on("response", on_response)

        # 1) 새 카페 검색 라우트 직접 시도
        spa_search = f"{CAFE_URL}?iframe_url=/ArticleSearchList.nhn"  # 폴백용
        new_routes = [
            f"https://cafe.naver.com/f-e/cafes/{CLUBID}/articles/search/list?q={quote(args.query)}&useCafeId=true&searchBy=1",
            f"https://cafe.naver.com/f-e/cafes/{CLUBID}/menus/0?q={quote(args.query)}",
        ]
        for r in new_routes:
            print(f"[netprobe] 이동: {r}")
            safe_goto(page, r)
            page.wait_for_timeout(5000)

        # 2) 메인 페이지에서 검색창에 직접 입력 시도 (UI 경로)
        safe_goto(page, f"https://cafe.naver.com/f-e/cafes/{CLUBID}/menus/0")
        page.wait_for_timeout(4000)

        # 3) 글 1건을 열어 본문(article) API 엔드포인트도 캡처
        if args.article_id:
            safe_goto(page, f"https://cafe.naver.com/f-e/cafes/{CLUBID}/articles/{args.article_id}")
            page.wait_for_timeout(5000)

        ARTIFACTS.mkdir(exist_ok=True)
        out = ARTIFACTS / "netprobe-dump.json"
        # 중복 url 제거
        seen, uniq = set(), []
        for e in captured:
            key = e["url"].split("?")[0] + str(e.get("status"))
            if key not in seen:
                seen.add(key)
                uniq.append(e)
        out.write_text(json.dumps({
            "query": args.query,
            "final_url": page.url,
            "captured_count": len(captured),
            "endpoints": uniq,
        }, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[netprobe] 캡처 {len(captured)}건 / 고유 {len(uniq)}건 → {out}")
        page.wait_for_timeout(1000)
        ctx.close()


# ===== 게시판(메뉴) 기반 수집 =====
# netprobe로 확인한 실제 동작 엔드포인트(2026-06-12).
MENU_LIST_CANDIDATES = [
    "https://apis.naver.com/cafe-web/cafe-cafemain-api/v1.0/cafes/{clubid}/menus",
]
# 게시판 글 목록 API. {menuid}/{page}/{size} 치환.
BOARD_LIST_CANDIDATES = [
    "https://apis.naver.com/cafe-web/cafe-boardlist-api/v1/cafes/{clubid}/menus/{menuid}/articles?page={page}&pageSize={size}&sortBy=TIME&viewType=L",
]


def _req_fetch_json(page, url):
    """Playwright request API로 호출(CORS 무관, 컨텍스트 쿠키 사용). {status, body}."""
    try:
        r = page.request.get(url, headers={
            "Referer": f"https://cafe.naver.com/f-e/cafes/{CLUBID}",
            "Accept": "application/json",
            "User-Agent": API_HEADERS["User-Agent"],
        })
        return {"status": r.status, "body": r.text()}
    except Exception as e:
        return {"status": -1, "body": str(e)}


def _walk_menus(obj, out):
    """JSON 트리를 돌며 menuId/menuName 쌍을 모은다."""
    if isinstance(obj, dict):
        mid = obj.get("menuId") or obj.get("menuid") or obj.get("id")
        mname = obj.get("menuName") or obj.get("menuname") or obj.get("name")
        btype = obj.get("boardType") or obj.get("menuType") or ""
        if mid is not None and mname:
            out.append((str(mid), str(mname), str(btype)))
        for v in obj.values():
            _walk_menus(v, out)
    elif isinstance(obj, list):
        for v in obj:
            _walk_menus(v, out)


def cmd_menus(args):
    """카페 게시판(메뉴) 목록을 찾아 menuId/이름을 출력한다."""
    with sync_playwright() as p:
        ctx = launch(p, headless=args.headless)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        safe_goto(page, f"https://cafe.naver.com/f-e/cafes/{CLUBID}/menus/0")
        page.wait_for_timeout(2000)
        found = []
        for tpl in MENU_LIST_CANDIDATES:
            url = tpl.format(clubid=CLUBID)
            res = _page_fetch_json(page, url)
            if res.get("status") != 200:
                res = _req_fetch_json(page, url)
            if res.get("status") == 200:
                try:
                    data = json.loads(res["body"])
                except Exception:
                    continue
                tmp = []
                _walk_menus(data, tmp)
                if tmp:
                    print(f"[menus] OK {url}")
                    found = tmp
                    break
            else:
                print(f"[menus] status={res.get('status')} {url}")
        ctx.close()
    # 중복 제거 + 출력
    seen, uniq = set(), []
    for mid, name, bt in found:
        if mid not in seen:
            seen.add(mid)
            uniq.append((mid, name, bt))
    print(f"[menus] 게시판 {len(uniq)}개")
    for mid, name, bt in uniq:
        mark = "  <== 후기(가전)?" if ("가전" in name or "후기" in name) else ""
        print(f"  menuId={mid:>6}  type={bt:<8} {name}{mark}")


def board_list(page, menuid, page_no, size=50):
    """게시판 글 목록 한 페이지 → article item 리스트."""
    for tpl in BOARD_LIST_CANDIDATES:
        url = tpl.format(clubid=CLUBID, menuid=menuid, page=page_no, size=size)
        res = _page_fetch_json(page, url)
        if res.get("status") != 200:
            res = _req_fetch_json(page, url)
        if res.get("status") != 200:
            continue
        try:
            data = json.loads(res["body"])
        except Exception:
            continue
        # 다양한 스키마: result.articleList[].item 또는 result.articles[] 등
        arts = (data.get("result", {}).get("articleList")
                or data.get("result", {}).get("articles")
                or data.get("articleList") or data.get("articles") or [])
        out = []
        for a in arts:
            it = a.get("item", a) if isinstance(a, dict) else {}
            aid = it.get("articleId") or it.get("articleid")
            if aid:
                out.append(it)
        if out:
            return out, tpl
    return [], None


def cmd_board(args):
    """특정 게시판(menuId) 글 전체를 열람·수집한다. 후기(가전) 게시판 정본 수집용."""
    records = []
    seen = set()
    used_tpl = None
    win_months = getattr(args, "window_months", None)
    win_start = _window_start(win_months) if win_months else None
    stop_old = False
    with sync_playwright() as p:
        # --login-first: 로그인 창을 띄우고 **그 창을 닫지 않은 채** 계속 수집한다.
        #
        # 왜 이런 것이 필요한가(2026-08-24 실측):
        #   네이버는 '로그인 상태 유지'를 체크하지 않으면 NID_SES 를
        #   **세션 쿠키**로 준다. 그러면 별도 로그인 명령으로 로그인해도
        #   창을 닫는 순간 사라져, 다음 수집이 비로그인으로 돌아간다.
        #   실제로 150건 중 16건(11%)만 본문이 읽혔고 나머지는
        #   `errorCode 0004 로그인하지 않았습니다` 였다.
        #   (프로필 자체는 멀정하다 — 시험 쿠키는 재실행 뒤에도 남았다.)
        #
        # 비번은 코드가 절대 입력하지 않는다. 사용자가 직접 친다.
        want_login = getattr(args, "login_first", False)
        ctx = launch(p, headless=False if want_login else args.headless)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        if want_login:
            safe_goto(page, "https://nid.naver.com/nidlogin.login?url="
                            "https%3A%2F%2Fcafe.naver.com%2Fdirectwedding")
            print("[board] 크롬 창이 열렸습니다 — **이 창에서** 네이버에 로그인하세요.")
            print("[board] 로그인이 확인되면 수집이 자동으로 이어집니다.")
            got = False
            for i in range(120):            # 최대 10분
                time.sleep(5)
                names = {c["name"] for c in ctx.cookies()}
                if "NID_AUT" in names and "NID_SES" in names:
                    print(f"[board] 로그인 확인됨 ({(i + 1) * 5}초) — 수집 시작")
                    got = True
                    break
                if i % 6 == 5:
                    print(f"[board] 로그인 대기 중... {(i + 1) * 5}s")
            if not got:
                print("[board] 로그인이 확인되지 않아 중단합니다.")
                ctx.close()
                return
        safe_goto(page, f"https://cafe.naver.com/f-e/cafes/{CLUBID}/menus/{args.menu_id}")
        page.wait_for_timeout(2000)
        empty = 0
        for pg in range(1, args.pages + 1):
            items, tpl = board_list(page, args.menu_id, pg, size=args.size)
            if tpl:
                used_tpl = tpl
            if not items:
                empty += 1
                if empty >= 2:
                    print(f"[board]  p{pg}: 빈 페이지 — 종료")
                    break
                continue
            empty = 0
            new = 0
            for it in items:
                aid = it.get("articleId") or it.get("articleid")
                if aid in seen:
                    continue
                seen.add(aid)
                subject = it.get("subject", "") or it.get("title", "")
                summary = it.get("summary", "")
                ts = it.get("writeDateTimestamp") or it.get("writeDate")
                add_date = ""
                dt_obj = None
                if isinstance(ts, (int, float)) and ts > 0:
                    dt_obj = datetime.fromtimestamp(ts / 1000)
                    add_date = dt_obj.strftime("%Y-%m-%dT%H:%M:%S")
                else:
                    add_date = it.get("addDate", "") or ""
                # 증분 모드: TIME 정렬이므로 윈도 시작보다 오래된 글을 만나면 이후 전부 과거 → 중단
                if win_start and dt_obj and dt_obj < win_start:
                    stop_old = True
                    continue
                menu_name = it.get("menuName", "") or str(args.menu_id)
                url = f"https://cafe.naver.com/f-e/cafes/{CLUBID}/articles/{aid}"
                body = ""
                if args.read_body:
                    body = api_article_body(page, aid)
                    time.sleep(args.delay)
                rec = {
                    "query": f"board:{args.menu_id}", "matched_queries": [f"board:{args.menu_id}"],
                    "articleId": aid, "title": subject,
                    "summary": summary[:200], "menu": menu_name,
                    "addDate": add_date, "url": url,
                    "body_excerpt": body[:4000], "body_ok": bool(body),
                }
                rec.update(analyze_text(f"{subject}\n{summary}", body))
                records.append(rec)
                new += 1
            print(f"[board]  p{pg}: {len(items)}건 / 신규 {new} / 누적 {len(records)}")
            if stop_old:
                print(f"[board]  윈도({win_months}개월) 경계 도달 — 과거 글 진입, 종료")
                break
            if len(records) >= args.max_articles:
                print(f"[board]  max-articles {args.max_articles} 도달 — 종료")
                break
        ctx.close()
    print(f"[board] 사용 엔드포인트: {used_tpl}")

    final = records
    if getattr(args, "cumulative", False):
        merged, n_new, n_upd = merge_into_cumulative(records, window_months=win_months)
        save_cumulative(merged)
        print(f"[board] 누적 머지: 신규 {n_new} / 갱신 {n_upd} / 누적 총 {len(merged)}건")
        final = merged

    raw_out, md_out, md = aggregate_and_write(final)
    print(f"[board] 원본 저장: {raw_out}")
    print(f"[board] 집계 저장: {md_out}")
    print(md)


def cmd_backfill(args):
    """누적본에서 본문 미열람(body_ok=False) 글만 골라 본문을 채운다(재개 가능).
    이미 본문이 있는 글은 건너뛰고, 목록 페이지를 다시 걷지 않는다(글 단위 직접 API).
    매 --save-every 건마다 누적본을 저장 → 중단해도 다음 실행이 이어서 진행한다."""
    recs = load_cumulative()
    if not recs:
        print("[backfill] 누적본이 비어 있습니다.")
        return

    # 대상: 본문 미열람. 연도 필터/최대 건수 옵션.
    def yr(r):
        return (r.get("addDate", "") or "")[:4]

    targets = [r for r in recs if not r.get("body_ok")]
    if args.year:
        targets = [r for r in targets if yr(r) == args.year]
    # 오래된(과거) 글부터 채우려면 addDate 오름차순, 최신부터면 내림차순
    targets.sort(key=lambda r: r.get("addDate", ""), reverse=args.newest_first)
    total_missing = sum(1 for r in recs if not r.get("body_ok"))
    if args.max:
        targets = targets[: args.max]

    print(f"[backfill] 누적 {len(recs):,}건 / 본문미열람 {total_missing:,}건 "
          f"/ 이번 대상 {len(targets):,}건 (year={args.year or '전체'}, "
          f"순서={'최신' if args.newest_first else '과거'}부터)")
    if not targets:
        print("[backfill] 채울 대상이 없습니다.")
        return

    done = ok = fail = 0
    with sync_playwright() as p:
        ctx = launch(p, headless=args.headless)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        # 로그인 세션 확인용으로 카페 1회 접속(쿠키 적재)
        safe_goto(page, f"https://cafe.naver.com/f-e/cafes/{CLUBID}/menus/0")
        page.wait_for_timeout(2000)
        # 같은 프로세스 내 로그인 대기 모드: 세션 쿠키(NID_AUT/NID_SES)는 브라우저
        # 재시작 시 복원되지 않으므로, 로그인과 백필을 한 프로세스에서 처리한다.
        if args.login_wait > 0:
            print(f"[backfill] 이 창에서 네이버에 직접 로그인하세요. {args.login_wait}초 대기합니다…")
            print("[backfill] 로그인 후 카페 우측 상단에 닉네임이 보이면 그대로 두세요. 자동으로 이어집니다.")
            waited = 0
            while waited < args.login_wait:
                time.sleep(10)
                waited += 10
                probe = api_article_body(page, targets[0].get("articleId"))
                if probe:
                    print(f"[backfill] 로그인 확인됨({waited}s) — 백필을 시작합니다.")
                    break
                print(f"[backfill]  대기 {waited}/{args.login_wait}s … 아직 본문 미수신")
            else:
                print("[backfill] 로그인 대기 시간 종료 — 본문이 여전히 안 받아집니다. 중단합니다.")
                ctx.close()
                return

        for r in targets:
            aid = r.get("articleId")
            if not aid:
                continue
            body = api_article_body(page, aid)
            time.sleep(args.delay)
            done += 1
            if body:
                r["body_excerpt"] = body[:4000]
                r["body_ok"] = True
                r.update(analyze_text(f"{r.get('title','')}\n{r.get('summary','')}", body))
                ok += 1
            else:
                fail += 1
            if done % args.save_every == 0:
                save_cumulative(recs)
                print(f"[backfill]  진행 {done:,}/{len(targets):,} "
                      f"(성공 {ok:,} / 실패 {fail:,}) — 저장됨")
                # 로그인 만료/차단 조기 감지: 연속 실패가 과도하면 중단
                if ok == 0 and done >= args.save_every * 2:
                    print("[backfill]  본문 0건 연속 — 로그인 만료/차단 의심, 중단합니다. "
                          "login 후 다시 실행하세요.")
                    break
        ctx.close()

    save_cumulative(recs)
    remain = sum(1 for r in recs if not r.get("body_ok"))
    print(f"[backfill] 완료: 이번 {done:,}건 처리 (본문확보 {ok:,} / 실패 {fail:,}) "
          f"/ 남은 본문미열람 {remain:,}건")
    if remain and ok:
        print("[backfill] 남은 글이 있습니다. 같은 명령을 다시 실행하면 이어서 채웁니다.")


def main():
    ap = argparse.ArgumentParser(description="네이버 다이렉트결혼준비 카페 가전 후기 수집기")
    sub = ap.add_subparsers(dest="cmd", required=True)

    pm = sub.add_parser("menus")
    pm.add_argument("--headless", action="store_true", default=False)
    pm.set_defaults(func=cmd_menus)

    pb = sub.add_parser("board")
    pb.add_argument("--menu-id", required=True, help="후기(가전) 게시판 menuId")
    pb.add_argument("--pages", type=int, default=200)
    pb.add_argument("--size", type=int, default=50)
    pb.add_argument("--max-articles", type=int, default=5000)
    pb.add_argument("--read-body", action="store_true", default=True)
    pb.add_argument("--no-read-body", dest="read_body", action="store_false")
    pb.add_argument("--login-first", action="store_true",
                    help="로그인 창을 띄우고 그 세션 그대로 수집(본문 읽기에 필수)")
    pb.add_argument("--headless", action="store_true", default=False)
    pb.add_argument("--delay", type=float, default=0.6)
    pb.add_argument("--cumulative", action="store_true")
    pb.add_argument("--window-months", type=int, default=None,
                    help="증분 모드: 현재월 포함 최근 N개월만 수집·머지(과거 보존). 미지정 시 전체 백필")
    pb.set_defaults(func=cmd_board)

    pl = sub.add_parser("login")
    pl.add_argument("--seconds", type=int, default=240)
    pl.set_defaults(func=cmd_login)

    pp = sub.add_parser("probe")
    pp.add_argument("--query", default="롯데 부산본점 삼성 혼수")
    pp.set_defaults(func=cmd_probe)

    pn = sub.add_parser("netprobe")
    pn.add_argument("--query", default="삼성 냉장고 혼수")
    pn.add_argument("--article-id", default="9047802")
    pn.set_defaults(func=cmd_netprobe)

    pr = sub.add_parser("reaggregate")
    pr.add_argument("--raw", default="", help="cafe-raw.json 경로 (생략 시 오늘자)")
    pr.set_defaults(func=cmd_reaggregate)

    pa = sub.add_parser("audit")
    pa.add_argument("--raw", default="", help="cafe-raw.json 경로 (생략 시 오늘자)")
    pa.set_defaults(func=cmd_audit)

    pt = sub.add_parser("timeline")
    pt.add_argument("--raw", default="", help="cafe-raw.json 경로 (생략 시 오늘자)")
    pt.add_argument("--weeks", type=int, default=12)
    pt.add_argument("--months", type=int, default=6)
    pt.add_argument("--recent-days", type=int, default=90)
    pt.set_defaults(func=cmd_timeline)

    ps = sub.add_parser("scrape")
    ps.add_argument("--query", required=True, help="'||'로 여러 키워드 구분")
    ps.add_argument("--pages", type=int, default=1)
    ps.add_argument("--max-articles", type=int, default=20)
    ps.add_argument("--read-body", action="store_true", default=True)
    ps.add_argument("--no-read-body", dest="read_body", action="store_false")
    ps.add_argument("--headless", action="store_true", default=False)
    ps.add_argument("--delay", type=float, default=1.5, help="글 사이 대기(초), 과부하 방지")
    ps.add_argument("--cumulative", action="store_true",
                    help="누적본(cumulative-cafe-raw.json)에 머지 후 전체로 집계")
    ps.add_argument("--window-months", type=int, default=None,
                    help="증분 모드: 최근 N개월 내 글만 갱신(당월+직전 N-1개월). 예: 3=당월+직전2개월. 생략 시 전체 백필")
    ps.set_defaults(func=cmd_scrape)

    pf = sub.add_parser("backfill-bodies",
                        help="누적본의 본문 미열람 글만 재개 가능하게 본문 채움")
    pf.add_argument("--year", default="", help="특정 연도만 (예: 2025). 생략 시 전체")
    pf.add_argument("--max", type=int, default=0, help="이번 실행에서 처리할 최대 건수(0=무제한)")
    pf.add_argument("--save-every", type=int, default=200, help="N건마다 누적본 저장(재개 지점)")
    pf.add_argument("--delay", type=float, default=0.6, help="글 사이 대기(초)")
    pf.add_argument("--newest-first", action="store_true", default=False,
                    help="최신 글부터 채움(기본은 과거 글부터)")
    pf.add_argument("--login-wait", type=int, default=0,
                    help="시작 시 이 창에서 직접 로그인하도록 N초 대기(같은 프로세스에서 백필). 세션 쿠키 복원 문제 회피")
    pf.add_argument("--headless", action="store_true", default=False)
    pf.set_defaults(func=cmd_backfill)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
