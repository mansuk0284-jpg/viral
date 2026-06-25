# -*- coding: utf-8 -*-
"""캡처한 진짜 검색 엔드포인트(searchBy=1, sortBy 없음)에 기간 파라미터를 얹어
   2021년 글이 실제로 반환되는지 확인. 공개 읽기·로그인 없음.
"""
import sys, json, io
from urllib.parse import quote_plus
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from datetime import datetime
from naver_cafe_scraper import launch, _page_fetch_json, _req_fetch_json, CLUBID, safe_goto
from playwright.sync_api import sync_playwright

MENU = "280"
EP = f"https://apis.cafe.naver.com/search/v2/cafes/{CLUBID}/search/articles"
VIEWS = "MEMBER_LEVEL%2CCOUNT%2CSALE_INFO%2CCAFE_MENU"


def base(q="가전", page=1, per=30, extra=""):
    return (f"{EP}?query={quote_plus(q)}&perPage={per}&page={page}"
            f"&menuId={MENU}&searchBy=1&views={VIEWS}{extra}")


def get(page, u):
    res = _page_fetch_json(page, u)
    if res.get("status") != 200:
        res = _req_fetch_json(page, u)
    try:
        return json.loads(res["body"]), res.get("status")
    except Exception:
        return None, res.get("status")


def arts(d):
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
    o, n, c = rng(arts(d))
    flag = "  <== 2021 도달!" if o != "-" and o < "2022-01" else ("  <== 옛자료!" if o != "-" and o < "2024-06" else "")
    print(f"[{name:32}] status={s} n={c} oldest={o} newest={n}{flag}")
    return d


def main():
    with sync_playwright() as p:
        ctx = launch(p, headless=True)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.on("request", lambda r: None)
        safe_goto(page, f"https://cafe.naver.com/f-e/cafes/{CLUBID}/menus/{MENU}")
        page.wait_for_timeout(3000)

        show(page, "baseline (no date)", base())
        # 기간 파라미터 변형 (2021-01)
        variants = [
            ("period concat 12+12", "&period=202101010000202101312359"),
            ("period concat 8+8",   "&period=2021010120210131"),
            ("period dash",         "&period=2021-01-01%2C2021-01-31"),
            ("start/end ymd",       "&startDate=20210101&endDate=20210131"),
            ("start/end dash",      "&startDate=2021-01-01&endDate=2021-01-31"),
            ("from/to ymd",         "&fromDate=20210101&toDate=20210131"),
            ("searchDate range",    "&searchDate=2021-01-01~2021-01-31"),
            ("periodType+dates",    "&periodType=DATE&startDate=2021-01-01&endDate=2021-01-31"),
            ("dateFrom/dateTo",     "&dateFrom=20210101&dateTo=20210131"),
            ("page deep p300",      "&page_marker_only"),
        ]
        for nm, ex in variants:
            if "page_marker_only" in ex:
                show(page, "deep p300 (no date)", base(page=300))
                continue
            show(page, nm, base(extra=ex))
        # 빈 쿼리 + 기간 (키워드 없이 기간만)
        for nm, ex in [("empty q + period", "&period=202101010000202101312359"),
                       ("empty q + start/end", "&startDate=20210101&endDate=20210131")]:
            show(page, nm, base(q="", extra=ex))
        ctx.close()


if __name__ == "__main__":
    main()
