#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
유튜브 전용 수집·분석기 — YouTube Data API v3로 혼수 가전 후기 영상+댓글을 모아
'다이렉트결혼준비 수집가'에 준하는 가전 후기 분석 산출물로 변환한다.

정적 세션 덤프(channel_analyze.py)는 유튜브가 JS 렌더라 링크 8건뿐이었다.
Data API는 영상 제목+설명+상위 댓글을 구조적으로 주므로 품목·톤·매장 매칭이 동작한다.

키는 환경변수에서만 읽는다(코드/산출물에 키 미기재):
  YOUTUBE_API_KEY    (Google Cloud Console → YouTube Data API v3 사용 설정 후 발급)

흐름:
  search.list(q, type=video, KR/ko) → 영상별 commentThreads.list(상위 댓글)
  → 제목+설명+댓글 합쳐 brand/item/tone/ad 분류 + 전국 백화점 매장매칭(naver_api_collect 재사용)
  → artifacts/YYYYMMDD-01-raw-youtube.md (다이렉트결혼준비 양식)

주의: 댓글은 비공개일 수 있고(commentsDisabled), 일 쿼터(기본 10,000 units) 제한.
      search=100 units/회, commentThreads=1 unit/회 → 쿼리 수를 과하게 늘리지 말 것.
"""
import argparse
import os
import sys
import urllib.parse
import urllib.request
import json
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import naver_api_collect as nac  # classify / match_store / 어휘 재사용(매칭 규칙은 build_web_data SSOT)

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS = ROOT / "artifacts"
API = "https://www.googleapis.com/youtube/v3"

DEFAULT_QUERIES = [
    "혼수 가전 후기 삼성 LG 비교",
    "신혼 가전 견적 후기",
    "비스포크 혼수 가전 후기",
    "LG 오브제 혼수 가전 후기",
    "혼수 가전 발품 후기",
]


def _get(path, params):
    params = dict(params)
    params["key"] = os.environ["YOUTUBE_API_KEY"]
    url = f"{API}/{path}?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        msg = e.read().decode("utf-8", "replace")[:200]
        print(f"  [warn] API {path} HTTP {e.code}: {msg}", file=sys.stderr)
        return {}
    except Exception as e:
        print(f"  [warn] API {path} 실패: {e}", file=sys.stderr)
        return {}


def search_videos(query, max_results):
    d = _get("search", {"part": "snippet", "q": query, "type": "video",
                        "maxResults": min(max_results, 50), "order": "relevance",
                        "regionCode": "KR", "relevanceLanguage": "ko"})
    out = []
    for it in d.get("items", []):
        vid = (it.get("id") or {}).get("videoId")
        sn = it.get("snippet") or {}
        if vid:
            out.append({"vid": vid, "title": sn.get("title", ""),
                        "desc": sn.get("description", ""), "date": (sn.get("publishedAt") or "")[:10],
                        "channel": sn.get("channelTitle", "")})
    return out


def top_comments(vid, n):
    d = _get("commentThreads", {"part": "snippet", "videoId": vid,
                                "maxResults": min(n, 100), "order": "relevance", "textFormat": "plainText"})
    cs = []
    for it in d.get("items", []):
        c = (((it.get("snippet") or {}).get("topLevelComment") or {}).get("snippet") or {})
        t = c.get("textDisplay") or ""
        if t:
            cs.append(t)
    return cs


def collect(queries, max_videos, max_comments, out_date):
    seen = set()
    rows = []
    for q in queries:
        for v in search_videos(q, max_videos):
            if v["vid"] in seen:
                continue
            comments = top_comments(v["vid"], max_comments)
            text = f"{v['title']} {v['desc']} " + " ".join(comments)
            brand, items, tone, is_ad = nac.classify(text)
            store, region = nac.match_store(text)
            if store == "__OUT__":
                continue
            if not items and brand == "기타/미상":
                continue
            seen.add(v["vid"])
            rows.append({"title": v["title"], "desc": v["desc"][:300], "link": f"https://youtu.be/{v['vid']}",
                         "date": v["date"], "channel": v["channel"], "comments": len(comments),
                         "brand": brand, "items": items, "tone": tone, "ad": is_ad,
                         "store": store, "region": region})
    return rows


def write_report(rows, out_date, query_count):
    nonad = [r for r in rows if not r["ad"]]
    ads = sum(1 for r in rows if r["ad"])
    brand_cnt = Counter(r["brand"] for r in nonad)
    item_cnt = Counter(i for r in nonad for i in r["items"])
    tone_cnt = Counter(r["tone"] for r in nonad)
    store_sl = defaultdict(lambda: {"삼성": 0, "LG": 0, "삼성·LG": 0, "region": ""})
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
    L.append("# 원본 후기 분석 — 유튜브 (YouTube Data API v3 기반)")
    L.append("> 소스ID: youtube · 채널: 유튜브 · 수집경로: Data API(search + commentThreads)")
    L.append(f"> 쿼리 {query_count}종 · 영상(중복제거): {len(rows)} · 광고추정 {ads} 제외 전 · 생성 {out_date}")
    L.append("> ✅ 영상 제목+설명+상위 댓글 합산 분석 — 정적 덤프(링크 8건)보다 정밀. 댓글 비공개 영상은 제목·설명만.")
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
        L.append("_매장 특정 단서 없음 — 유튜브는 영상 제목·설명에 매장명이 드물다. 트렌드 신호 위주._")
    if unknown_region:
        L.append("")
        L.append("매장 미상(권역만 잡힘): " + " / ".join(f"{k} {v}" for k, v in unknown_region.most_common()))
    L.append("")
    L.append("## 후기 레코드")
    if not rows:
        L.append("_검색 결과 없음 — 키 미설정/쿼터 초과/쿼리 매칭 0._")
    for i, r in enumerate(rows, 1):
        tag = " [광고추정]" if r["ad"] else ""
        items = "/".join(r["items"]) if r["items"] else "미상"
        store = r["store"] or (f"{r['region']} 매장미상" if r["region"] else "전국/매장 미상")
        L.append(f"### Y-{i:02d}{tag}")
        L.append(f"- 출처: {r['link']}")
        L.append(f"- 소스ID: youtube · 채널명: {r['channel']} · 댓글 {r['comments']}건 분석")
        L.append(f"- 작성일: {r['date'] or '(추정)'}")
        L.append(f"- 매장(추정): {store}")
        L.append(f"- 언급 브랜드: {r['brand']} (추정)")
        L.append(f"- 언급 품목: {items} (추정)")
        L.append(f"- 톤: {r['tone']} (추정)")
        L.append(f"- 제목: {r['title'][:120]}")
        if r["desc"]:
            L.append(f"- 설명: {r['desc'][:200]}")
    out = ARTIFACTS / f"{out_date}-01-raw-youtube.md"
    out.write_text("\n".join(L), encoding="utf-8")

    print(f"[youtube] 유튜브: 영상 {len(rows)}건 (광고 {ads}) · "
          f"삼성 {brand_cnt.get('삼성',0)} / LG {brand_cnt.get('LG',0)} / 양사 {brand_cnt.get('삼성·LG',0)}")
    print(f"          품목 TOP: {', '.join(f'{k}{v}' for k,v in item_cnt.most_common(5)) or '없음'}")
    print(f"          → {out}")


def main():
    ap = argparse.ArgumentParser(description="YouTube Data API → 가전 후기 분석")
    ap.add_argument("--max-videos", type=int, default=20, help="쿼리당 영상 수(쿼터 절약).")
    ap.add_argument("--max-comments", type=int, default=30, help="영상당 상위 댓글 수.")
    ap.add_argument("--date", default=datetime.now().strftime("%Y%m%d"))
    ap.add_argument("--query", action="append", help="쿼리 추가(반복 가능). 미지정 시 기본 세트.")
    args = ap.parse_args()

    if not os.environ.get("YOUTUBE_API_KEY"):
        raise SystemExit("[error] 환경변수 YOUTUBE_API_KEY 미설정. Google Cloud Console에서 "
                         "YouTube Data API v3 사용 설정 후 발급 → 사용자가 직접 setx YOUTUBE_API_KEY \"...\" 등록 후 새 터미널에서 재실행. "
                         "(코드는 키를 입력/저장하지 않음)")
    queries = args.query or DEFAULT_QUERIES
    rows = collect(queries, args.max_videos, args.max_comments, args.date)
    write_report(rows, args.date, len(queries))


if __name__ == "__main__":
    main()
