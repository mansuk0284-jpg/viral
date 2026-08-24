#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""인스타그램 — 넓은 채널에서 혼수가전만 골라 담는다

유튜브와 같은 잣대다. 인스타 전체를 세지 않고 혼수가전 해시태그로 걸러 나온 것만 본다
(사용자 지시 2026-08-24).

**로그인 세션이 있어야 돈다.** 태그 페이지가 로그인월이라 게스트로는 아무것도 안 보인다.
세션은 `scripts/insta_login.py` 로 사람이 직접 로그인해 만든다 — 비번은 코드가 만지지 않는다.

협찬은 지우지 않고 표시만 한다(유튜브와 같은 원칙).
인스타는 특히 협찬 비율이 높아, 섞어 세면 고객 후기가 아니라 광고를 재게 된다.

사용: python scripts/collect_instagram.py --tags 혼수가전 신혼가전 --scroll 4
"""
import argparse
import io
import json
import os
import re
import sys
from datetime import datetime
from urllib.parse import quote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from naver_cafe_scraper import launch, safe_goto
from playwright.sync_api import sync_playwright

APPLIANCE = re.compile(
    r"가전|냉장고|세탁기|건조기|에어컨|김치냉장고|스타일러|식기세척기|식세기|"
    r"청소기|TV|티비|공기청정기|정수기|인덕션|전자레인지|워시타워|비스포크|오브제|"
    r"디오스|그랑데|무풍|트롬", re.I)
WEDDING = re.compile(r"혼수|신혼|웨딩|결혼|예단|살림|집들이")
SAM = re.compile(r"삼성|비스포크|bespoke|무풍|그랑데", re.I)
LG = re.compile(r"엘지|\bLG\b|디오스|트롬|오브제|스타일러|워시타워", re.I)
# 협찬 표기 — 인스타는 이게 특히 잦다
SPON = re.compile(r"협찬|광고|유료광고|제공|sponsored|ad\b|파트너십|체험단", re.I)

# 파는 쪽이 올린 글인가 — 인스타 #혼수가전의 절반이 판매자 홍보다(실측 36/69).
# 고객 후기와 섞어 세면 '고객 반응'이 아니게 되므로 갈라 담는다(지우지는 않는다).
# 잣대는 좁게: 흔한 낱말(매장·할인·상담)이 아니라 **호객 문구**만 본다.
# 넓게 잡았더니 개인 후기까지 홍보로 끌려갔다(62/7 → 실제는 36/33).
BIZ = re.compile(
    r"문의\s*(주세요|환영|DM|📞|☎)|DM\s*(주세요|환영)|"
    r"카톡\s*(문의|상담)|상담\s*(문의|환영|예약|가능)|견적\s*(문의|상담|받아)|"
    r"렌탈\s*(신청|상담)|특가|프로모션|이벤트\s*진행|오픈\s*(이벤트|기념)|"
    r"영업시간|주차\s*(가능|안내)|방문\s*(환영|주세요)|"
    r"(삼성스토어|하이마트|베스트샵|전자랜드)\s*[가-힣A-Za-z]+|"
    r"\b0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}\b", re.I)


def main():
    ap = argparse.ArgumentParser()
    # 해시태그 (2026-08-24 확장: 4 → 18개)
    #   가전 낱말이 든 태그를 고른다. "혼수준비" 처럼 넓은 태그는 드레스·예식장이
    #   대부분이라 걸러내는 데만 힘이 든다 — 남기되 뒤로 뺀다.
    ap.add_argument("--tags", nargs="+", default=[
        # 혼수 × 가전
        "혼수가전", "신혼가전", "가전졸업", "웨딩가전", "혼수가전추천",
        "신혼가전추천", "신혼가전리뷰", "혼수템", "신혼필수가전", "이사가전",
        # 품목·제품명
        "혼수냉장고", "신혼세탁기", "비스포크", "엘지오브제", "김치냉장고추천",
        "건조기추천", "식기세척기추천",
        # 넓은 태그는 마지막 — 가전 필터가 대부분 걸러낸다
        "혼수준비",
    ])
    ap.add_argument("--scroll", type=int, default=4)
    a = ap.parse_args()

    got, blocked = {}, False
    with sync_playwright() as p:
        ctx = launch(p, True)
        pg = ctx.new_page()
        for tag in a.tags:
            # /explore/tags/ 는 검색 페이지로 리다이렉트된다(실측). 최종 형태로 바로 간다.
            url = "https://www.instagram.com/explore/search/keyword/?q=%23" + quote(tag)
            try:
                safe_goto(pg, url)
                pg.wait_for_timeout(5000)
                if "/accounts/login" in (pg.url or ""):
                    print(f"  [{tag}] 로그인월 — 세션 없음", flush=True)
                    blocked = True
                    break
                # 게시물 링크가 하나도 없으면 아직 안 그려진 것 — 조금 더 기다린다
                if not pg.evaluate("""()=>document.querySelectorAll('a[href*="/p/"]').length"""):
                    pg.wait_for_timeout(4000)
                for _ in range(a.scroll):
                    pg.mouse.wheel(0, 2600)
                    pg.wait_for_timeout(1800)
                rows = pg.eval_on_selector_all(
                    'a[href*="/p/"]',
                    """els=>els.map(e=>{
                        const img=e.querySelector('img');
                        return {h:e.href, alt:(img&&img.alt)||''};})""")
                for r in rows:
                    m = re.search(r"/p/([\w-]+)", r.get("h") or "")
                    if not m:
                        continue
                    pid = m.group(1)
                    if pid in got:
                        got[pid]["tags"].append(tag)
                        continue
                    got[pid] = {"id": pid, "url": "https://www.instagram.com/p/" + pid + "/",
                                "alt": r.get("alt", ""), "tags": [tag]}
                print(f"  [{tag}] 누적 {len(got)}", flush=True)
            except Exception as e:
                print(f"  [{tag}] 실패 {type(e).__name__}", flush=True)
        ctx.close()

    if blocked and not got:
        print("\n로그인 세션이 없어 수집할 수 없습니다. scripts/insta_login.py 로 먼저 로그인하세요.")
        return

    keep = []
    for x in got.values():
        t = x["alt"]
        # 넓은 채널에서 혼수가전만 — 가전 신호와 혼수 맥락이 함께 있어야 한다
        if not (APPLIANCE.search(t) and WEDDING.search(t)):
            continue
        keep.append({**x,
                     "samsung": bool(SAM.search(t)), "lg": bool(LG.search(t)),
                     "ad": "sponsored" if SPON.search(t) else "",
                     "biz": bool(BIZ.search(t))})       # 파는 쪽이 올린 글인가

    stamp = datetime.now().strftime("%Y%m%d")
    dst = os.path.join(ROOT, "artifacts", f"{stamp}-channel-instagram.json")
    io.open(dst, "w", encoding="utf-8").write(
        json.dumps(keep, ensure_ascii=False, separators=(",", ":")))
    ads = sum(1 for x in keep if x["ad"])
    print(f"\n긁은 게시물 {len(got):,}개 → 혼수가전 {len(keep):,}개 (협찬 표기 {ads}개)")
    print(f"→ {os.path.basename(dst)}")
    if keep and len(keep) < 20:
        print("표본이 적습니다 — 화면에 올릴 때 그 사실을 함께 적으세요.")


if __name__ == "__main__":
    main()
