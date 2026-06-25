# -*- coding: utf-8 -*-
"""기간 '1년' 옵션을 DOM에서 직접 클릭 → 재조회 유발 → 모든 article 요청 캡처.
   날짜 파라미터의 진짜 이름을 확인한다. 공개 읽기·로그인 없음.
"""
import sys, json, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from naver_cafe_scraper import launch, CLUBID, safe_goto
from playwright.sync_api import sync_playwright

MENU = "280"
REQ = []


def arts(since=0):
    return sorted(set(u for u in REQ[since:] if "article" in u.lower() and "apis" in u))


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
        page.locator('button:has-text("전체기간")').first.click()
        page.wait_for_timeout(800)

        mk = len(REQ)
        # DOM에서 '1년' option_text를 품은 클릭가능 조상(button/li)을 직접 클릭
        clicked = page.evaluate("""() => {
          const spans=[...document.querySelectorAll('span.option_text, span, button, li')];
          const t=spans.find(e=>(e.innerText||'').trim()==='1년');
          if(!t) return 'no-1년';
          let n=t; for(let i=0;i<4 && n;i++){ if(n.tagName==='BUTTON'||n.tagName==='LI'||n.getAttribute('role')){ n.click(); return 'clicked '+n.tagName+'.'+(n.className||'').slice(0,30);} n=n.parentElement;}
          t.click(); return 'clicked span';
        }""")
        print("1년 클릭:", clicked)
        page.wait_for_timeout(3500)
        print(f"1년 후 새 article 요청 {len(arts(mk))}건:")
        for u in arts(mk): print("  >", u[:320])

        # 혹시 재조회가 검색 재제출로만 걸리면: 검색 다시 Enter
        mk2 = len(REQ)
        try:
            inp.click(); inp.press("Enter"); page.wait_for_timeout(3000)
        except Exception:
            pass
        extra = [u for u in arts(mk2)]
        if extra:
            print("재제출 후:")
            for u in extra: print("  >", u[:320])

        print("\n=== 모든 article 요청 (전체) ===")
        for u in arts(0): print("  >", u[:340])
        ctx.close()


if __name__ == "__main__":
    main()
