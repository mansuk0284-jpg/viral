# -*- coding: utf-8 -*-
"""기간 옵션(button.option)을 정확히 클릭해 날짜검색 API의 진짜 파라미터를 캡처.
   공개 읽기·로그인 없음.
"""
import sys, json, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from datetime import datetime
from naver_cafe_scraper import launch, _page_fetch_json, _req_fetch_json, CLUBID, safe_goto
from playwright.sync_api import sync_playwright

MENU = "280"
REQ = []


def newsr(since):
    return [u for u in REQ[since:] if "search" in u.lower() and "article" in u.lower()]


def main():
    with sync_playwright() as p:
        ctx = launch(p, headless=True)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.on("request", lambda r: REQ.append(r.url) if "apis" in r.url else None)
        safe_goto(page, f"https://cafe.naver.com/f-e/cafes/{CLUBID}/menus/{MENU}")
        page.wait_for_timeout(3500)
        inp = page.locator('input[placeholder*="검색"]').first
        inp.fill("가전"); inp.press("Enter"); page.wait_for_timeout(4500)

        # 기간 드롭다운 열기
        try:
            page.locator('button:has-text("전체기간")').first.click()
            page.wait_for_timeout(1000)
        except Exception as e:
            print("기간 open err", e)

        # '1년' 옵션 버튼 정확히 클릭
        mk = len(REQ)
        clicked = False
        for sel in ['button.option:has-text("1년")', 'li.item:has-text("1년") button',
                    'button:has-text("1년")']:
            try:
                loc = page.locator(sel).first
                if loc.count():
                    loc.click(); page.wait_for_timeout(3000); clicked = True
                    print(f"'1년' 클릭 ({sel}) → 새 검색요청 {len(newsr(mk))}건")
                    break
            except Exception as e:
                print("click err", sel, e)
        for u in sorted(set(newsr(mk))):
            print("  [1년]>", u[:300])

        # '기간 입력'(직접입력) 시도 — 날짜 인풋 채우기
        mk2 = len(REQ)
        try:
            page.locator('button:has-text("전체기간"), button.is_selected').first.click()
            page.wait_for_timeout(700)
        except Exception:
            pass
        try:
            page.get_by_text("기간 입력", exact=False).first.click()
            page.wait_for_timeout(1000)
            # 날짜 인풋 탐색
            dins = page.locator('input[type="text"], input[type="number"], input[placeholder*="."], input[placeholder*="-"]')
            cnt = dins.count()
            print(f"\n날짜 인풋 후보 {cnt}개")
            if cnt >= 2:
                dins.nth(0).fill("2021.01.01")
                dins.nth(1).fill("2021.01.31")
                # 적용/검색 버튼
                for ap in ['button:has-text("적용")', 'button:has-text("검색")', 'button:has-text("확인")']:
                    b = page.locator(ap).first
                    if b.count(): b.click(); page.wait_for_timeout(3000); print("apply:", ap); break
        except Exception as e:
            print("직접입력 err", e)
        for u in sorted(set(newsr(mk2))):
            print("  [직접]>", u[:300])

        print("\n=== 전체 search/article 요청 ===")
        for u in sorted(set(u for u in REQ if "search" in u.lower() and "article" in u.lower())):
            print("  >", u[:320])
        ctx.close()


if __name__ == "__main__":
    main()
