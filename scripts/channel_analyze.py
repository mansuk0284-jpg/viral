#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
채널 덤프 분석기 — session-open-<ch>-*.json(실제 사이트 접속 덤프)을 받아
다이렉트결혼준비 수집가에 준하는 '가전 후기 분석' 표준 산출물로 변환한다.

하는 일:
  - 덤프의 링크(text+href)에서 가전 후기 후보만 추린다(가전 키워드 필터).
  - 광고/판매/협찬 링크는 [광고추정]으로 표기(네이버 ader., 'event','프로모션','할인','쿠폰' 등).
  - 브랜드(삼성/LG/기타), 품목(냉장고·세탁기·건조기·TV·에어컨·스타일러·청소기·식기세척기·김치냉장고),
    톤(긍정/부정/중립)을 제목 텍스트 기반으로 1차 판정한다(제목만이라 '추정').
  - href 도메인으로 하위 소스 구분(blog.naver.com / cafe.naver.com / youtube / ohou / instagram).
  - artifacts/YYYYMMDD-01-raw-<소스ID>.md 표준 양식 + 브랜드·품목 집계를 출력한다.

주의: 제목 기반 1차 분석이라 본문 정밀도는 카페 정본 스크래퍼보다 낮다 → 모두 '(추정)' 표기.
"""
import argparse
import glob
import io
import json
import re
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS = ROOT / "artifacts"

ITEMS = {
    "냉장고": ["냉장고", "비스포크 냉장", "키친핏"],
    "김치냉장고": ["김치냉장고", "김치플러스", "김치톡톡"],
    "세탁기": ["세탁기", "워시타워", "그랑데"],
    "건조기": ["건조기", "건조"],
    "TV": ["tv", "qled", "올레드", "oled", "네오"],
    "에어컨": ["에어컨", "무풍", "휘센"],
    "스타일러": ["스타일러", "에어드레서", "의류관리"],
    "청소기": ["청소기", "제트", "코드제로", "로봇청소"],
    "식기세척기": ["식기세척", "식세기"],
}
SAMSUNG = ["삼성", "비스포크", "samsung", "갤럭시", "무풍", "그랑데", "네오 qled", "에어드레서", "제트", "키친핏"]
LG = ["lg", "엘지", "오브제", "디오스", "트롬", "휘센", "코드제로", "스타일러", "올레드", "워시타워"]
POS = ["만족", "좋아", "좋았", "예뻐", "예쁨", "추천", "최고", "꿀", "성공", "잘 샀", "잘샀", "강추"]
NEG = ["불만", "별로", "후회", "최악", "고장", "소음", "as", "에이에스", "지연", "환불", "실망", "고민"]
AD = ["ader.naver", "event", "이벤트", "프로모션", "할인", "쿠폰", "특가", "최저가", "공구", "체험단", "협찬", "추천인", "적립"]

CHANNEL_LABEL = {
    "naver-blog": "네이버 블로그",
    "busan-mom-cafe": "부울경 맘카페",
    "youtube": "유튜브",
    "ohou": "오늘의집",
    "instagram": "인스타그램",
    "dagyeolun": "다이렉트결혼준비",
}
PREFIX = {"naver-blog": "B", "busan-mom-cafe": "M", "youtube": "Y", "ohou": "O", "instagram": "I", "dagyeolun": "D"}


def latest_dump(channel_login):
    files = sorted(glob.glob(str(ARTIFACTS / f"session-open-{channel_login}-*.json")))
    return files[-1] if files else None


def classify(text):
    t = text.lower()
    s = any(k.lower() in t for k in SAMSUNG)
    l = any(k.lower() in t for k in LG)
    if s and not l:
        brand = "삼성"
    elif l and not s:
        brand = "LG"
    elif s and l:
        brand = "삼성·LG"
    else:
        brand = "기타/미상"
    items = [name for name, kws in ITEMS.items() if any(k.lower() in t for k in kws)]
    if any(k in t for k in NEG):
        tone = "부정"
    elif any(k in t for k in POS):
        tone = "긍정"
    else:
        tone = "중립"
    is_ad = any(k.lower() in t for k in AD)
    return brand, items, tone, is_ad


def domain_filter(href, source_id):
    h = (href or "").lower()
    if source_id == "naver-blog":
        return "blog.naver.com" in h
    if source_id == "busan-mom-cafe":
        return "cafe.naver.com" in h and "directwedding" not in h
    if source_id == "youtube":
        return "watch" in h or "youtu" in h
    if source_id == "ohou":
        return "ohou.se" in h
    if source_id == "instagram":
        return "instagram.com" in h
    return True


def analyze(source_id, login_channel, dump_path, out_date):
    d = json.load(io.open(dump_path, encoding="utf-8"))
    links = d.get("links", [])
    seen = set()
    rows = []
    for lk in links:
        text = (lk.get("text") or "").strip()
        href = lk.get("href") or ""
        if len(text) < 8 or href in seen:
            continue
        if not domain_filter(href, source_id):
            continue
        brand, items, tone, is_ad = classify(text)
        # 가전 신호 없는 순수 광고/네비 링크 제외
        if not items and brand == "기타/미상" and is_ad:
            continue
        if not items and brand == "기타/미상":
            continue
        seen.add(href)
        rows.append({"text": text, "href": href, "brand": brand, "items": items, "tone": tone, "ad": is_ad})

    label = CHANNEL_LABEL.get(source_id, source_id)
    pfx = PREFIX.get(source_id, "X")
    brand_cnt = Counter(r["brand"] for r in rows if not r["ad"])
    item_cnt = Counter(i for r in rows if not r["ad"] for i in r["items"])
    tone_cnt = Counter(r["tone"] for r in rows if not r["ad"])
    ads = sum(1 for r in rows if r["ad"])

    lines = []
    lines.append(f"# 원본 후기 분석 — {label} (실제 접속 덤프 기반)")
    lines.append(f"> 소스ID: {source_id} · 채널: {label} · 로그인채널: {login_channel}")
    lines.append(f"> 덤프: {Path(dump_path).name} · 진입 URL: {d.get('url','')}")
    lines.append(f"> 로그인 상태(추정): {d.get('login_state','?')} · 수집 건수: {len(rows)} (광고추정 {ads} 제외 전)")
    lines.append("> ⚠ 제목 텍스트 기반 1차 분석(본문 미열람) — 모두 추정. 카페 정본 스크래퍼보다 정밀도 낮음.")
    lines.append("")
    lines.append("## 브랜드 집계 (광고추정 제외)")
    lines.append("| 브랜드 | 건수 |")
    lines.append("|---|---|")
    for b in ["삼성", "LG", "삼성·LG", "기타/미상"]:
        lines.append(f"| {b} | {brand_cnt.get(b,0)} |")
    lines.append("")
    lines.append("## 품목 집계 (광고추정 제외)")
    if item_cnt:
        lines.append("| 품목 | 언급 |")
        lines.append("|---|---|")
        for it, c in item_cnt.most_common():
            lines.append(f"| {it} | {c} |")
    else:
        lines.append("_품목 신호 없음(표본 빈약)._")
    lines.append("")
    lines.append(f"## 톤 (광고추정 제외): 긍정 {tone_cnt.get('긍정',0)} / 부정 {tone_cnt.get('부정',0)} / 중립 {tone_cnt.get('중립',0)}")
    lines.append("")
    lines.append("## 후기 레코드")
    if not rows:
        lines.append("_가전 후기 신호 링크 없음 — 이 채널은 정적 접속 표본이 빈약(SPA/로그인월/JS렌더). 전용 API·스크래퍼 필요._")
    for i, r in enumerate(rows, 1):
        tag = " [광고추정]" if r["ad"] else ""
        items = "/".join(r["items"]) if r["items"] else "미상"
        lines.append(f"### {pfx}-{i:02d}{tag}")
        lines.append(f"- 출처: {r['href']}")
        lines.append(f"- 소스ID: {source_id}")
        lines.append(f"- 작성일: (추정)")
        lines.append(f"- 언급 브랜드: {r['brand']} (추정)")
        lines.append(f"- 언급 품목: {items} (추정)")
        lines.append(f"- 톤: {r['tone']} (추정)")
        lines.append(f"- 원문(제목): {r['text'][:120]}")
    out = ARTIFACTS / f"{out_date}-01-raw-{source_id}.md"
    out.write_text("\n".join(lines), encoding="utf-8")

    print(f"[{source_id}] {label}: 후기 {len(rows)}건 (광고 {ads}) · 삼성 {brand_cnt.get('삼성',0)} / LG {brand_cnt.get('LG',0)} / 양사 {brand_cnt.get('삼성·LG',0)}")
    print(f"          품목 TOP: {', '.join(f'{k}{v}' for k,v in item_cnt.most_common(5)) or '없음'}")
    print(f"          → {out}")
    return {"source_id": source_id, "count": len(rows), "ads": ads,
            "samsung": brand_cnt.get("삼성", 0), "lg": brand_cnt.get("LG", 0),
            "both": brand_cnt.get("삼성·LG", 0), "items": dict(item_cnt.most_common()),
            "pos": tone_cnt.get("긍정", 0), "neg": tone_cnt.get("부정", 0)}


def main():
    ap = argparse.ArgumentParser(description="채널 덤프 → 가전 후기 분석")
    ap.add_argument("--source-id", required=True, help="naver-blog|busan-mom-cafe|youtube|ohou|instagram")
    ap.add_argument("--login-channel", required=True, help="덤프 파일의 로그인 채널(naver|youtube|ohou|instagram|kakao)")
    ap.add_argument("--dump", help="덤프 파일 경로(생략 시 login-channel 최신)")
    ap.add_argument("--date", default=datetime.now().strftime("%Y%m%d"))
    args = ap.parse_args()
    dump = args.dump or latest_dump(args.login_channel)
    if not dump:
        raise SystemExit(f"[error] 덤프 없음: session-open-{args.login_channel}-*.json. 먼저 channel_session.py open --dump 실행.")
    analyze(args.source_id, args.login_channel, dump, args.date)


if __name__ == "__main__":
    main()
