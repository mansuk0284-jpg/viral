# -*- coding: utf-8 -*-
"""samsungstore.com selectMakeListAjax.sesc 직접 호출 — 매장목록 응답 형태 탐색."""
import sys, io, json
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from playwright.sync_api import sync_playwright

EP = "https://www.samsungstore.com/shop/selectMakeListAjax.sesc"
TRIES = [
    {"m": "post", "data": {}},
    {"m": "post", "data": {"sido": "서울"}},
    {"m": "post", "data": {"areaCd": "11"}},
    {"m": "post", "data": {"searchType": "area", "sido": "서울"}},
    {"m": "get", "data": {}},
]


def main():
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            user_data_dir="C:/Users/admin/Desktop/viral/.browser-profile",
            channel="chrome", headless=True, args=["--disable-blink-features=AutomationControlled"])
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        # 레퍼러/쿠키 확보 위해 매장찾기 먼저 방문
        try:
            page.goto("https://www.samsungstore.com/shop/selectFindShopMain.sesc?menu=w401",
                      wait_until="domcontentloaded", timeout=40000)
            page.wait_for_timeout(1500)
        except Exception as e:
            print("warm err", e)
        rq = ctx.request
        for i, t in enumerate(TRIES):
            try:
                if t["m"] == "post":
                    r = rq.post(EP, form=t["data"], headers={"X-Requested-With": "XMLHttpRequest"})
                else:
                    r = rq.get(EP)
                body = r.text()
                print(f"[{i}] {t['m']} {t['data']} -> {r.status} len={len(body)}")
                print("    head:", body[:160].replace("\n", " "))
                if len(body) > 500:
                    open(f"C:/Users/admin/Desktop/viral/artifacts/store-ajax-{i}.txt", "w", encoding="utf-8").write(body)
            except Exception as e:
                print(f"[{i}] err", e)
        ctx.close()


if __name__ == "__main__":
    main()
