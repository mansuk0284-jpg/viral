#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""유튜브 — 넓은 채널에서 혼수가전만 골라 담는다

사용자 지시(2026-08-24): "오늘의집이나 인스타그램, 유투브는 채널 파급이 크기에
그 안에서 혼수가전과 관련된 내용이 있는지 찾아서 보여주자는 거야."

그래서 유튜브 '전체'를 세지 않는다. 혼수가전 검색어로 걸러 나온 영상만 담는다.

**API 키 없이 동작한다.** Data API v3 키(YOUTUBE_API_KEY)가 없어도
검색 결과 페이지의 DOM 에서 제목·채널·조회수·게시시점을 읽는다(실측 확인).
키가 생기면 youtube_collect.py 로 댓글까지 받을 수 있다.

사용:
  python scripts/collect_youtube.py --pages 2
"""
import argparse
import io
import json
import os
import re
import sys
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from naver_cafe_scraper import launch, safe_goto           # 브라우저 실행만 재사용
from playwright.sync_api import sync_playwright

# 혼수가전을 찾는 검색어. 넓게 던지되 아래 APPLIANCE 로 다시 거른다.
QUERIES = [
    "혼수가전 후기", "신혼가전 추천", "혼수가전 견적", "가전 졸업",
    "신혼집 가전 리뷰", "혼수 냉장고 세탁기", "비스포크 후기", "LG 오브제 후기",
]

APPLIANCE = re.compile(
    r"가전|냉장고|세탁기|건조기|에어컨|김치냉장고|스타일러|식기세척기|식세기|"
    r"청소기|TV|티비|공기청정기|정수기|인덕션|전자레인지|워시타워|비스포크|오브제|"
    r"디오스|그랑데|무풍|트롬", re.I)
WEDDING = re.compile(r"혼수|신혼|웨딩|결혼|예단|살림")

SAM = re.compile(r"삼성|비스포크|bespoke|무풍|그랑데", re.I)
LG = re.compile(r"엘지|\bLG\b|디오스|트롬|오브제|스타일러|워시타워", re.I)

# ── 광고·협찬 가려내기 (2026-08-24 사용자 지시: "광고는 표시만 하고 남겨줘") ──
# 지우지 않는다. 다만 브랜드 공식 채널 영상이나 협찬 표기가 있는 영상은
# 고객 후기와 성격이 다르므로 표시해 두고 화면에서 갈라 볼 수 있게 한다.
# 실측: 조회수 1위(374만)가 삼성전자 공식 채널의 Bespoke 광고였다.
OFFICIAL = re.compile(r"삼성전자|Samsung|LG전자|LG Electronics|공식|Official", re.I)
SPONSORED = re.compile(r"광고|협찬|유료광고|sponsored|제공", re.I)


def ad_kind(title, channel, desc):
    """'' = 일반 / 'official' = 브랜드 공식 채널 / 'sponsored' = 협찬 표기"""
    if OFFICIAL.search(channel or ""):
        return "official"
    if SPONSORED.search((title or "") + " " + (desc or "")):
        return "sponsored"
    return ""


# 조회수 "조회수 1.2만회" / "12K views" 등을 숫자로
def views_of(t):
    if not t:
        return 0
    t = t.replace(",", "")
    m = re.search(r"([\d.]+)\s*만", t)
    if m:
        return int(float(m.group(1)) * 10000)
    m = re.search(r"([\d.]+)\s*천", t)
    if m:
        return int(float(m.group(1)) * 1000)
    m = re.search(r"(\d+)", t)
    return int(m.group(1)) if m else 0


def scrape(pages):
    got = {}
    with sync_playwright() as p:
        ctx = launch(p, True)
        pg = ctx.new_page()
        for q in QUERIES:
            try:
                safe_goto(pg, "https://www.youtube.com/results?search_query=" + q)
                pg.wait_for_timeout(3200)
                for _ in range(max(0, pages - 1)):      # 스크롤로 더 불러온다
                    pg.mouse.wheel(0, 3000)
                    pg.wait_for_timeout(1500)
                rows = pg.eval_on_selector_all(
                    "ytd-video-renderer",
                    """els=>els.map(e=>{
                        const a=e.querySelector('a#video-title');
                        const meta=e.querySelectorAll('#metadata-line span');
                        const ch=e.querySelector('#channel-name a, ytd-channel-name a');
                        return {
                          t:(a&&(a.getAttribute('title')||a.textContent)||'').trim(),
                          h:(a&&a.href)||'',
                          ch:(ch&&ch.textContent||'').trim(),
                          v:(meta[0]&&meta[0].textContent||'').trim(),
                          d:(meta[1]&&meta[1].textContent||'').trim(),
                          desc:(e.querySelector('.metadata-snippet-text')||{}).textContent||''
                        };})""")
                for r in rows:
                    m = re.search(r"v=([\w-]{11})", r.get("h") or "")
                    if not m or not r.get("t"):
                        continue
                    vid = m.group(1)
                    if vid in got:
                        got[vid]["q"].append(q)
                        continue
                    r["id"] = vid
                    r["q"] = [q]
                    got[vid] = r
                print(f"  [{q}] 누적 {len(got)}", flush=True)
            except Exception as e:
                print(f"  [{q}] 실패 {type(e).__name__}", flush=True)
        ctx.close()
    return list(got.values())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pages", type=int, default=2, help="검색어마다 스크롤 횟수")
    a = ap.parse_args()

    rows = scrape(a.pages)
    print(f"\n긁은 영상 {len(rows):,}개", flush=True)

    keep = []
    for r in rows:
        txt = (r.get("t") or "") + " " + (r.get("desc") or "")
        # 넓은 채널에서 **혼수가전만** 골라낸다 — 가전 신호 + 혼수 맥락이 함께 있어야
        if not (APPLIANCE.search(txt) and WEDDING.search(txt)):
            continue
        s, l = bool(SAM.search(txt)), bool(LG.search(txt))
        keep.append({
            "id": r["id"], "title": r.get("t", ""), "channel": r.get("ch", ""),
            "views": views_of(r.get("v", "")), "when": r.get("d", ""),
            "url": "https://www.youtube.com/watch?v=" + r["id"],
            "samsung": s, "lg": l,
            # 광고는 지우지 않고 표시만 한다 — 고객 후기와 섞어 보지 않기 위해
            "ad": ad_kind(r.get("t"), r.get("ch"), r.get("desc")),
            "queries": sorted(set(r.get("q", []))),
        })
    keep.sort(key=lambda x: -x["views"])

    stamp = datetime.now().strftime("%Y%m%d")
    dst = os.path.join(ROOT, "artifacts", f"{stamp}-channel-youtube.json")
    io.open(dst, "w", encoding="utf-8").write(
        json.dumps(keep, ensure_ascii=False, separators=(",", ":")))

    s_n = sum(1 for x in keep if x["samsung"] and not x["lg"])
    l_n = sum(1 for x in keep if x["lg"] and not x["samsung"])
    vw = sum(x["views"] for x in keep)
    ads = [x for x in keep if x["ad"]]
    org = [x for x in keep if not x["ad"]]
    print(f"혼수가전 영상 {len(keep):,}개 · 삼성 {s_n} / LG {l_n}")
    print(f"조회수 합계 {vw:,}회 (평균 {vw // max(1, len(keep)):,}회)")
    print(f"  광고·공식 {len(ads)}개({sum(x['views'] for x in ads):,}회) / "
          f"일반 {len(org)}개({sum(x['views'] for x in org):,}회)")
    print(f"→ {os.path.basename(dst)}")


if __name__ == "__main__":
    main()
