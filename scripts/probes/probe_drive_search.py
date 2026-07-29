# -*- coding: utf-8 -*-
"""게시판 검색창을 실제로 조작해, 검색 시 발생하는 search API 요청을 캡처한다.
   1) 검색 입력창 탐색 → '가전' 입력 → 제출
   2) 그때 apis.naver.com 으로 나가는 search 요청 URL(파라미터 포함) 기록
   3) 검색 결과의 날짜 범위 확인
   공개 읽기·로그인 없음.
"""
import sys, json, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from datetime import datetime
from naver_cafe_scraper import launch, CLUBID, safe_goto
from playwright.sync_api import sync_playwright

MENU = "280"
CAP = []


def main():
    with sync_playwright() as p:
        ctx = launch(p, headless=True)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.on("request", lambda r: CAP.append(r.url)
                 if ("apis" in r.url and "search" in r.url.lower()) else None)
        safe_goto(page, f"https://cafe.naver.com/f-e/cafes/{CLUBID}/menus/{MENU}")
        page.wait_for_timeout(4000)

        # 검색 입력창 후보 셀렉터
        sels = ['input[placeholder*="검색"]', 'input[type="search"]',
                'input[placeholder*="게시판"]', '.SearchBox input', 'input.input_search',
                'input[name="query"]']
        found = None
        for s in sels:
            try:
                loc = page.locator(s).first
                if loc.count() > 0 and loc.is_visible():
                    found = s; break
            except Exception:
                pass
        # 검색 아이콘을 먼저 눌러야 입력창이 열리는 경우
        if not found:
            for icon in ['button[aria-label*="검색"]', 'a[aria-label*="검색"]',
                         '.btn_search', '.ico_search', 'button:has-text("검색")']:
                try:
                    b = page.locator(icon).first
                    if b.count() > 0 and b.is_visible():
                        b.click(); page.wait_for_timeout(1200); print("icon clicked:", icon)
                        break
                except Exception:
                    pass
            for s in sels:
                try:
                    loc = page.locator(s).first
                    if loc.count() > 0 and loc.is_visible():
                        found = s; break
                except Exception:
                    pass

        print("search input:", found)
        if found:
            try:
                page.locator(found).first.fill("가전")
                page.locator(found).first.press("Enter")
                page.wait_for_timeout(5000)
            except Exception as e:
                print("input err", e)
        else:
            # 진단: 검색 관련 DOM 일부 출력
            html = page.content()
            import re
            for m in re.findall(r'placeholder="[^"]*검색[^"]*"', html)[:6]:
                print("  ph>", m)
            for m in re.findall(r'aria-label="[^"]*검색[^"]*"', html)[:6]:
                print("  al>", m)

        caps = sorted(set(CAP))
        print(f"\n캡처된 search API {len(caps)}건:")
        for u in caps[:15]:
            print("  >", u[:260])
        with open("artifacts/capture-search-dump.json", "w", encoding="utf-8") as f:
            json.dump(caps, f, ensure_ascii=False, indent=1)
        ctx.close()


if __name__ == "__main__":
    main()
