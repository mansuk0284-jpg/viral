# -*- coding: utf-8 -*-
"""검색 결과의 '기간' 필터를 실제 조작해 날짜검색 API 요청을 캡처한다.
   1) '가전' 검색 → 결과 화면
   2) 기간/정렬 컨트롤(전체기간·1년·직접입력 등) 탐색·조작
   3) 그때 발생하는 search/articles 요청 URL을 전부 기록 → 진짜 날짜 파라미터 확인
   공개 읽기·로그인 없음.
"""
import sys, json, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from naver_cafe_scraper import launch, CLUBID, safe_goto
from playwright.sync_api import sync_playwright

MENU = "280"
REQ = []


def newreqs(since):
    return [u for u in REQ[since:] if "search" in u.lower() and "articles" in u.lower()]


def main():
    with sync_playwright() as p:
        ctx = launch(p, headless=True)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.on("request", lambda r: REQ.append(r.url) if "apis" in r.url else None)
        safe_goto(page, f"https://cafe.naver.com/f-e/cafes/{CLUBID}/menus/{MENU}")
        page.wait_for_timeout(3500)

        # 1) 검색
        try:
            inp = page.locator('input[placeholder*="검색"]').first
            inp.fill("가전"); inp.press("Enter"); page.wait_for_timeout(4500)
        except Exception as e:
            print("search err", e)
        mark = len(REQ)
        print("검색 후 base 요청:")
        for u in sorted(set(newreqs(0)))[:4]:
            print("  >", u[:200])

        # 2) 기간/정렬 컨트롤 탐색 — 텍스트 기반
        labels = ["전체기간", "전체 기간", "1년", "6개월", "1개월", "기간", "직접입력", "직접 입력", "정렬", "최신순", "오래된순"]
        print("\n발견된 컨트롤(텍스트):")
        seen = set()
        for t in labels:
            try:
                loc = page.get_by_text(t, exact=False)
                cnt = loc.count()
                if cnt:
                    seen.add(t)
                    print(f"  '{t}' x{cnt}")
            except Exception:
                pass

        # 3) 기간 컨트롤 열고 옵션 조작 시도
        for opener in ["전체기간", "전체 기간", "기간"]:
            if opener in seen:
                try:
                    page.get_by_text(opener, exact=False).first.click()
                    page.wait_for_timeout(1200)
                    print(f"\n'{opener}' 클릭 → 드롭다운 열림 시도")
                    break
                except Exception as e:
                    print("opener err", e)
        # 1년 / 오래된순 / 직접입력 클릭 시도 (날짜 요청 유발)
        for opt in ["1년", "오래된순", "직접입력", "직접 입력", "6개월"]:
            try:
                el = page.get_by_text(opt, exact=False)
                if el.count():
                    el.first.click(); page.wait_for_timeout(3000)
                    print(f"  '{opt}' 클릭")
            except Exception:
                pass

        # 4) 새로 발생한 검색요청 전부
        print("\n=== 조작 후 캡처된 search/articles 요청(전부) ===")
        allsr = sorted(set([u for u in REQ if "search" in u.lower() and "articles" in u.lower()]))
        for u in allsr:
            print("  >", u[:300])
        with open("artifacts/capture-period-dump.json", "w", encoding="utf-8") as f:
            json.dump(sorted(set(REQ)), f, ensure_ascii=False, indent=1)
        print("\n[dump] artifacts/capture-period-dump.json  (전체 apis 요청)")
        ctx.close()


if __name__ == "__main__":
    main()
