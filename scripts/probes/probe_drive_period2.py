# -*- coding: utf-8 -*-
"""기간/정렬 드롭다운을 열고 실제 옵션 DOM을 덤프 → 정확히 클릭해 날짜/정렬 API 캡처.
   공개 읽기·로그인 없음.
"""
import sys, json, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from naver_cafe_scraper import launch, CLUBID, safe_goto
from playwright.sync_api import sync_playwright

MENU = "280"
REQ = []


def sr():  # search/article 요청만
    return sorted(set(u for u in REQ if "search" in u.lower() and "article" in u.lower()))


def dump_clickables(page, tag):
    js = """() => {
      const out=[];
      const els=document.querySelectorAll('button,li,a,[role=option],[role=menuitem],span');
      for (const e of els){
        const t=(e.innerText||'').trim();
        if(!t || t.length>8) continue;
        if(/순$|기간|직접|개월|^1주$|^1년$|전체/.test(t)){
          const r=e.getBoundingClientRect();
          if(r.width>0&&r.height>0) out.push({t, tag:e.tagName, cls:(e.className||'').toString().slice(0,40), role:e.getAttribute('role')||''});
        }
      }
      return out.slice(0,40);
    }"""
    try:
        items = page.evaluate(js)
    except Exception as e:
        items = [{"err": str(e)}]
    print(f"\n[{tag}] 클릭 후보 {len(items)}:")
    seen = set()
    for it in items:
        key = json.dumps(it, ensure_ascii=False)
        if key in seen: continue
        seen.add(key)
        print("   ", key)


def main():
    with sync_playwright() as p:
        ctx = launch(p, headless=True)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.on("request", lambda r: REQ.append(r.url) if "apis" in r.url else None)
        safe_goto(page, f"https://cafe.naver.com/f-e/cafes/{CLUBID}/menus/{MENU}")
        page.wait_for_timeout(3500)
        inp = page.locator('input[placeholder*="검색"]').first
        inp.fill("가전"); inp.press("Enter"); page.wait_for_timeout(4500)

        # 정렬 드롭다운 열기 ('최신순')
        try:
            page.get_by_text("최신순", exact=True).first.click()
            page.wait_for_timeout(1000)
        except Exception as e:
            print("정렬 open err", e)
        dump_clickables(page, "정렬 드롭다운")
        # '오래된순' 클릭 시도
        before = len(REQ)
        for t in ["오래된순", "등록일순", "정확도순"]:
            try:
                loc = page.get_by_text(t, exact=True)
                if loc.count():
                    loc.first.click(); page.wait_for_timeout(2500)
                    print(f"  '{t}' 클릭 → 새 요청 {len(REQ)-before}건")
                    before = len(REQ)
            except Exception:
                pass

        # 기간 드롭다운 열기 ('전체기간')
        try:
            page.get_by_text("전체기간", exact=True).first.click()
            page.wait_for_timeout(1000)
        except Exception as e:
            print("기간 open err", e)
        dump_clickables(page, "기간 드롭다운")
        for t in ["1년", "6개월", "직접입력", "직접설정"]:
            try:
                loc = page.get_by_text(t, exact=True)
                if loc.count():
                    loc.first.click(); page.wait_for_timeout(2500)
                    print(f"  '{t}' 클릭 → 새 요청 {len(REQ)-before}건")
                    before = len(REQ)
            except Exception:
                pass

        print("\n=== 캡처된 search/article 요청 전부 ===")
        for u in sr():
            print("  >", u[:300])
        ctx.close()


if __name__ == "__main__":
    main()
