# -*- coding: utf-8 -*-
"""옵션 2 재시도 — 검증된 api_search 형식 기반으로 옛 후기 도달 여부 확인.
   1) baseline(검증형) 정상 200 확인 + 깊은 페이지로 얼마나 옛글까지 가는지
   2) menuId=280 한정 + 깊은 페이지
   3) 기간 파라미터 변형
   공개 읽기·로그인 없음.
"""
import sys, json, io
from urllib.parse import quote_plus
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from datetime import datetime
from naver_cafe_scraper import (launch, _page_fetch_json, _req_fetch_json,
                                CLUBID, safe_goto, SEARCH_API)
from playwright.sync_api import sync_playwright

MENU = "280"
Q = quote_plus("가전")
VIEWS = "MEMBER_LEVEL%2CCOUNT%2CSALE_INFO%2CCAFE_MENU"
BASE = SEARCH_API.format(clubid=CLUBID)  # .../search/v2/cafes/{cid}/search/articles


def url(page_no, menu="0", extra=""):
    return (f"{BASE}?query={Q}&perPage=30&page={page_no}"
            f"&menuId={menu}&views={VIEWS}{extra}")


def get(page, u):
    res = _page_fetch_json(page, u)
    if res.get("status") != 200:
        res = _req_fetch_json(page, u)
    try:
        return json.loads(res["body"]), res.get("status")
    except Exception:
        return None, res.get("status")


def arts_of(d):
    if not d:
        return []
    r = d.get("result", d)
    return r.get("articleList") or r.get("articles") or d.get("articleList") or []


def rng(items):
    ds = []
    for a in items:
        it = a.get("item", a) if isinstance(a, dict) else {}
        ts = it.get("writeDateTimestamp") or it.get("writeDate") or it.get("addDate")
        if isinstance(ts, (int, float)) and ts > 0:
            ds.append(datetime.fromtimestamp(ts / 1000).strftime("%Y-%m-%d"))
        elif isinstance(ts, str) and len(ts) >= 8:
            ds.append(ts[:10])
    return (min(ds), max(ds), len(ds)) if ds else ("-", "-", 0)


def show(page, name, u):
    d, s = get(page, u)
    items = arts_of(d)
    o, n, c = rng(items)
    flag = "  <== 옛 자료 도달!" if o != "-" and o < "2024-06" else ""
    print(f"[{name:30}] status={s} items={len(items)} oldest={o} newest={n}{flag}")
    return d


def main():
    with sync_playwright() as p:
        ctx = launch(p, headless=True)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        safe_goto(page, f"https://cafe.naver.com/f-e/cafes/{CLUBID}/menus/{MENU}")
        page.wait_for_timeout(2500)

        d = show(page, "baseline menu=0 p1", url(1))
        if d:
            r = d.get("result", d)
            meta = {k: r.get(k) for k in ("totalCount", "lastPage", "page", "size") if isinstance(r, dict) and k in r}
            print(f"   keys={list(d.keys())} meta={json.dumps(meta, ensure_ascii=False)}")
        # 전체 검색(menu=0) 깊은 페이지 — 검색이 옛글까지 가는지 / 캡 위치
        for pg in (100, 300, 500, 800, 1000, 1001, 1200):
            show(page, f"menu=0 deep p{pg}", url(pg))
        # menuId=280 한정
        for pg in (1, 500, 1000, 1001):
            show(page, f"menu=280 p{pg}", url(pg, MENU))
        # 기간 파라미터 변형 (2022)
        for nm, ex in [
            ("anchorYmd 2022", "&anchorYmd=20221231"),
            ("fromYmd/toYmd 2022", "&fromYmd=20220101&toYmd=20221231"),
            ("startYmd/endYmd 2022", "&startYmd=20220101&endYmd=20221231"),
        ]:
            show(page, nm, url(1, MENU, ex))
        ctx.close()


if __name__ == "__main__":
    main()
