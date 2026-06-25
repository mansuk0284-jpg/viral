# -*- coding: utf-8 -*-
"""후기(가전) 게시판(menuId 280) 깊이 프로브.
   목적: 2024-11-30 floor가 (A)게시판 시작인지 (B)네이버 페이징 한계인지 판별.
   - page 1 raw에서 totalCount(총 글수) 확인 → 약 50,015와 비교
   - 깊은 페이지(약 1000쪽 부근)에서 글이 계속 나오는지 / 빈 페이지로 끝나는지 확인
   공개 게시판 읽기. 로그인·비밀번호 입력 없음.
"""
import sys, json, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from naver_cafe_scraper import launch, _page_fetch_json, _req_fetch_json, CLUBID, safe_goto
from playwright.sync_api import sync_playwright

MENU = "280"
TPL = ("https://apis.naver.com/cafe-web/cafe-boardlist-api/v1/cafes/{clubid}"
       "/menus/{menuid}/articles?page={page}&pageSize=50&sortBy=TIME&viewType=L")


def fetch(page, pno):
    url = TPL.format(clubid=CLUBID, menuid=MENU, page=pno)
    res = _page_fetch_json(page, url)
    if res.get("status") != 200:
        res = _req_fetch_json(page, url)
    try:
        data = json.loads(res["body"])
    except Exception:
        return None, res.get("status")
    return data, res.get("status")


def arts_of(data):
    r = data.get("result", data)
    return (r.get("articleList") or r.get("articles") or
            data.get("articleList") or data.get("articles") or [])


def oldest_newest(items):
    ds = []
    for a in items:
        it = a.get("item", a) if isinstance(a, dict) else {}
        ts = it.get("writeDateTimestamp") or it.get("writeDate")
        if isinstance(ts, (int, float)) and ts > 0:
            from datetime import datetime
            ds.append(datetime.fromtimestamp(ts / 1000).strftime("%Y-%m-%d"))
    return (min(ds), max(ds)) if ds else ("-", "-")


def main():
    with sync_playwright() as p:
        ctx = launch(p, headless=True)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        safe_goto(page, f"https://cafe.naver.com/f-e/cafes/{CLUBID}/menus/{MENU}")
        page.wait_for_timeout(2500)

        # 1) page 1 raw — 총 글수/페이지 메타 탐색
        d1, s1 = fetch(page, 1)
        print(f"[page1] status={s1}")
        if d1:
            r = d1.get("result", d1)
            meta = {k: r.get(k) for k in
                    ("totalCount", "totalArticleCount", "articleCount", "totalPage",
                     "totalPageCount", "pageCount", "size", "page") if k in r}
            print(f"[page1] meta(result)= {json.dumps(meta, ensure_ascii=False)}")
            # 메타가 없으면 최상위/ pageInfo 확인
            for key in ("pageInfo", "paging", "totalCount"):
                if key in d1:
                    print(f"[page1] top.{key}= {json.dumps(d1[key], ensure_ascii=False)[:200]}")
            items = arts_of(d1)
            print(f"[page1] items={len(items)} range={oldest_newest(items)}")

        # 2) 깊이 스캔 — 한계/끝 판별
        for pno in (500, 900, 990, 999, 1000, 1001, 1005, 1010, 1050, 1100, 1500):
            d, s = fetch(page, pno)
            n = len(arts_of(d)) if d else 0
            rng = oldest_newest(arts_of(d)) if d and n else ("-", "-")
            print(f"[p{pno:>4}] status={s} items={n} oldest={rng[0]} newest={rng[1]}")
        ctx.close()


if __name__ == "__main__":
    main()
