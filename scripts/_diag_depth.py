# -*- coding: utf-8 -*-
"""쿼리별 페이지 깊이 측정: 결과가 끝날 때까지 몇 페이지·몇 건인지."""
from playwright.sync_api import sync_playwright
import naver_cafe_scraper as S


def depth(page, query, cap_pages=40):
    seen = set()
    last_full = 0
    for pg in range(1, cap_pages + 1):
        batch = S.api_search(page, query, pg)
        if not batch:
            break
        for it in batch:
            seen.add(it.get("articleId"))
        last_full = pg
        if len(batch) < 15:
            break
    return last_full, len(seen)


QUERIES = ["혼수 가전", "혼수 가전 후기", "혼수 냉장고", "혼수 세탁기", "혼수 건조기",
           "혼수 TV", "혼수 청소기", "신혼 가전", "삼성 혼수", "엘지 혼수",
           "롯데 부산본점 혼수 가전", "신세계 센텀시티 혼수 가전", "현대 울산 혼수 가전"]

with sync_playwright() as p:
    ctx = S.launch(p, headless=True)
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    S.safe_goto(page, f"https://cafe.naver.com/f-e/cafes/{S.CLUBID}/menus/0")
    page.wait_for_timeout(1500)
    for q in QUERIES:
        pages, uniq = depth(page, q)
        print(f"  {q!r:28s} pages={pages:2d} uniq={uniq}")
    ctx.close()
