# -*- coding: utf-8 -*-
"""게시판 '기간 검색'이 실제로 호출하는 API를 네트워크 캡처로 잡아낸다.
   SPA가 search 상태로 진입할 때 apis.naver.com 으로 보내는 모든 요청을 기록 →
   날짜 파라미터가 들어간 진짜 엔드포인트를 찾는다. 공개 읽기·로그인 없음.
"""
import sys, json, io, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from naver_cafe_scraper import launch, CLUBID, safe_goto
from playwright.sync_api import sync_playwright

MENU = "280"
ART = []  # 캡처된 API URL

# SPA가 인식할 법한 검색 상태 URL 후보(기간 2021-01)
CANDIDATES = [
    f"https://cafe.naver.com/f-e/cafes/{CLUBID}/menus/{MENU}?viewType=L&search.searchBy=1&search.sortBy=date&search.query=%EA%B0%80%EC%A0%84",
    f"https://cafe.naver.com/f-e/cafes/{CLUBID}/menus/{MENU}?viewType=L&search.searchBy=1&search.sortBy=date&search.query=%EA%B0%80%EC%A0%84&search.startDate=2021-01-01&search.endDate=2021-01-31",
    f"https://cafe.naver.com/f-e/cafes/{CLUBID}?iframe_url=/ArticleSearchList.nhn%3Fsearch.clubid={CLUBID}%26search.menuid={MENU}%26search.media=0%26search.searchdate=2021-01-01%7E2021-01-31%26search.defaultValue=1",
]


def hook(req):
    u = req.url
    if ("apis.naver.com" in u or "apis.cafe.naver.com" in u or "cafe.naver.com" in u) and \
       any(k in u.lower() for k in ("search", "article", "date", "period", "menu")):
        ART.append(u)


def main():
    with sync_playwright() as p:
        ctx = launch(p, headless=True)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.on("request", hook)
        for i, url in enumerate(CANDIDATES, 1):
            ART.clear()
            print(f"\n=== 후보 {i} 진입 ===")
            print("  front:", url[:120])
            try:
                safe_goto(page, url)
            except Exception as e:
                print("  goto err", e)
            page.wait_for_timeout(5000)
            # 캡처된 API 중 날짜/검색 관련 추림
            uniq = sorted(set(ART))
            picks = [u for u in uniq if any(k in u.lower() for k in ("search", "date", "period")) and "apis" in u]
            if not picks:
                picks = [u for u in uniq if "apis" in u][:8]
            for u in picks[:12]:
                print("   API>", u[:240])
        # 전체 덤프 저장
        with open("artifacts/capture-search-dump.json", "w", encoding="utf-8") as f:
            json.dump(sorted(set(ART)), f, ensure_ascii=False, indent=1)
        print("\n[dump] artifacts/capture-search-dump.json")
        ctx.close()


if __name__ == "__main__":
    main()
