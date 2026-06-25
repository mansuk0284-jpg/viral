# -*- coding: utf-8 -*-
"""삼성전자판매(samsungstore.com) 매장찾기 — 공식 매장 디렉터리 수집 v2.
   전체 XHR URL 로깅 + 지역(시도) 탭 클릭으로 목록 호출 유도 + 렌더된 매장 텍스트 덤프.
   매장명·주소·시도는 사실(factual) 데이터(점별 매칭 기준표용). 로그인·비번 없음.
"""
import sys, io, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from playwright.sync_api import sync_playwright

URL = "https://www.samsungstore.com/shop/selectFindShopMain.sesc?menu=w401"
SIDO = ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종",
        "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"]
xhrlog = []
bodies = []


def main():
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            user_data_dir="C:/Users/admin/Desktop/viral/.browser-profile",
            channel="chrome", headless=True, viewport={"width": 1360, "height": 1000},
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()

        def on_resp(resp):
            try:
                if resp.request.resource_type in ("xhr", "fetch"):
                    u = resp.url
                    xhrlog.append(u)
                    if "samsungstore.com" in u:
                        b = resp.text()
                        if len(b) > 200 and ("점" in b or "주소" in b or "shop" in b.lower()):
                            bodies.append({"url": u, "len": len(b), "body": b[:300000]})
            except Exception:
                pass
        page.on("response", on_resp)

        page.goto(URL, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(3000)
        # 지역 탭/버튼 클릭 시도 — 텍스트로 시도명 매칭
        clicked = 0
        for sd in SIDO:
            try:
                loc = page.get_by_text(sd, exact=True)
                if loc.count():
                    loc.first.click(timeout=2500)
                    page.wait_for_timeout(1200)
                    clicked += 1
            except Exception:
                pass
        page.wait_for_timeout(1500)
        # 렌더된 매장 영역 텍스트 통째 덤프(서버/JS 렌더 모두 포착)
        try:
            txt = page.inner_text("body")
        except Exception:
            txt = ""
        open("C:/Users/admin/Desktop/viral/artifacts/samsung-store-page.txt", "w", encoding="utf-8").write(txt)
        ctx.close()

    json.dump({"xhr": sorted(set(xhrlog)), "bodies": bodies},
              open("C:/Users/admin/Desktop/viral/artifacts/samsung-store-xhr.json", "w", encoding="utf-8"),
              ensure_ascii=False)
    print(f"지역탭 클릭 {clicked} · XHR 고유 {len(set(xhrlog))} · 매장후보 body {len(bodies)} · page.txt {len(txt)}자")
    print("=== samsungstore.com XHR ===")
    for u in sorted(set(x for x in xhrlog if "samsungstore.com" in x)):
        print("  ", u[:130])
    print("=== 매장후보 body ===")
    for b in sorted(bodies, key=lambda x: -x["len"])[:8]:
        print(f"   len={b['len']:>6} {b['url'][:110]}")


if __name__ == "__main__":
    main()
