# -*- coding: utf-8 -*-
"""후기(가전) 게시판(menuId 280) 오래된순 정렬 프로브.
   목적: 최신순 1000쪽 한계를 우회할 '오래된순' 진입이 가능한지 확인.
   여러 정렬 파라미터 변형으로 page 1을 받아, 가장 오래된 글이 2021~2024 초로 나오면 성공.
   공개 게시판 읽기. 로그인·비밀번호 없음.
"""
import sys, json, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from datetime import datetime
from naver_cafe_scraper import launch, _page_fetch_json, _req_fetch_json, CLUBID, safe_goto
from playwright.sync_api import sync_playwright

MENU = "280"
BASE = "https://apis.naver.com/cafe-web/cafe-boardlist-api/v1/cafes/{cid}/menus/{mid}/articles?page=1&pageSize=50"
# 정렬 변형 후보 (baseline + 오래된순 추정 파라미터들)
VARIANTS = [
    ("baseline TIME desc",        "&sortBy=TIME&viewType=L"),
    ("sortBy=TIME&order=ASC",     "&sortBy=TIME&order=ASC&viewType=L"),
    ("sortBy=TIME&orderBy=ASC",   "&sortBy=TIME&orderBy=ASC&viewType=L"),
    ("sortBy=TIME&direction=ASC", "&sortBy=TIME&direction=ASC&viewType=L"),
    ("sortBy=TIME_ASC",           "&sortBy=TIME_ASC&viewType=L"),
    ("sortBy=OLD",                "&sortBy=OLD&viewType=L"),
    ("sortBy=REGISTER_ASC",       "&sortBy=REGISTER_ASC&viewType=L"),
    ("sort=asc",                  "&sortBy=TIME&sort=asc&viewType=L"),
    ("asc=true",                  "&sortBy=TIME&asc=true&viewType=L"),
    ("reverse=true",              "&sortBy=TIME&reverse=true&viewType=L"),
]
# 보너스: 모바일/구 ArticleList 엔드포인트 (오래된순 ec=ASC 가능성)
LEGACY = [
    ("legacy ArticleList prevpage",
     "https://apis.naver.com/cafe-web/cafe-articleapi/v2.1/cafes/{cid}/menus/{mid}/articles?page=1&pageSize=50&sortBy=TIME&viewType=L&requestFrom=A"),
]


def arts_of(data):
    r = data.get("result", data)
    return (r.get("articleList") or r.get("articles") or
            data.get("articleList") or data.get("articles") or [])


def rng(items):
    ds = []
    for a in items:
        it = a.get("item", a) if isinstance(a, dict) else {}
        ts = it.get("writeDateTimestamp") or it.get("writeDate")
        if isinstance(ts, (int, float)) and ts > 0:
            ds.append(datetime.fromtimestamp(ts / 1000).strftime("%Y-%m-%d"))
    return (min(ds), max(ds)) if ds else ("-", "-")


def get(page, url):
    res = _page_fetch_json(page, url)
    if res.get("status") != 200:
        res = _req_fetch_json(page, url)
    if res.get("status") != 200:
        return None, res.get("status")
    try:
        return json.loads(res["body"]), 200
    except Exception:
        return None, "parse-fail"


def main():
    with sync_playwright() as p:
        ctx = launch(p, headless=True)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        safe_goto(page, f"https://cafe.naver.com/f-e/cafes/{CLUBID}/menus/{MENU}")
        page.wait_for_timeout(2500)
        base = BASE.format(cid=CLUBID, mid=MENU)
        for name, suffix in VARIANTS:
            d, s = get(page, base + suffix)
            n = len(arts_of(d)) if d else 0
            old, new = rng(arts_of(d)) if d and n else ("-", "-")
            flag = "  <== 오래된순 성공" if old != "-" and old < "2025-06" else ""
            print(f"[{name:28}] status={s} n={n} oldest={old} newest={new}{flag}")
        for name, tpl in LEGACY:
            d, s = get(page, tpl.format(cid=CLUBID, mid=MENU))
            n = len(arts_of(d)) if d else 0
            old, new = rng(arts_of(d)) if d and n else ("-", "-")
            print(f"[{name:28}] status={s} n={n} oldest={old} newest={new}")
        ctx.close()


if __name__ == "__main__":
    main()
