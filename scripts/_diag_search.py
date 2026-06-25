# -*- coding: utf-8 -*-
"""검색 수율 진단: 키워드별 totalCount와 실제 수집 가능 건수를 측정한다.
broad(범용) vs store(매장명) 쿼리를 비교해 '건수가 적은' 원인을 규명."""
import json
from urllib.parse import quote_plus
from playwright.sync_api import sync_playwright
import naver_cafe_scraper as S


def total_count(page, query):
    url = (S.SEARCH_API.format(clubid=S.CLUBID)
           + f"?query={quote_plus(query)}&perPage=15&page=1"
           + "&menuId=0&views=MEMBER_LEVEL%2CCOUNT%2CSALE_INFO%2CCAFE_MENU")
    res = S._page_fetch_json(page, url)
    if res["status"] != 200:
        return None, res["status"]
    data = json.loads(res["body"])
    r = data.get("result", {})
    # totalCount 위치 후보 탐색
    tc = r.get("totalCount") or r.get("total") or r.get("searchResultCount")
    return tc, r.get("articleList") and len(r["articleList"])


BROAD = ["혼수 가전", "신혼 가전 후기", "혼수 냉장고", "혼수 세탁기",
         "혼수 가전 후기", "백화점 혼수 가전", "삼성 혼수", "엘지 혼수"]
STORE = ["롯데 부산본점 혼수 가전", "신세계 센텀시티 혼수 가전",
         "현대 울산 혼수 가전", "롯데 창원 혼수 가전"]

with sync_playwright() as p:
    ctx = S.launch(p, headless=True)
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    S.safe_goto(page, f"https://cafe.naver.com/f-e/cafes/{S.CLUBID}/menus/0")
    page.wait_for_timeout(1500)
    print("=== BROAD(범용) 쿼리 totalCount ===")
    for q in BROAD:
        tc, n = total_count(page, q)
        print(f"  {q!r:30s} total={tc} page1={n}")
    print("=== STORE(매장명) 쿼리 totalCount ===")
    for q in STORE:
        tc, n = total_count(page, q)
        print(f"  {q!r:30s} total={tc} page1={n}")
    ctx.close()
