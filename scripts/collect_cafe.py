# -*- coding: utf-8 -*-
"""네이버 카페 범용 전구간 수집 엔진 — clubId/menuId를 인자화한 collect_history.py.
   search/v2 + writeTime 월 윈도우 × 광역쿼리 union(articleId 중복제거)으로 census 근접.
   브랜드는 보강된 SAMSUNG/LG 별칭(라틴경계 \\bLG\\b 수정 포함)으로 분류 — 전 카페 동일 기준.
   공개 검색·로그인 없음(로그인 세션이 .browser-profile에 있으면 자동 사용).
   사용: python collect_cafe.py --clubid 12345678 --menu 42 --start 2021-01 --end 2026-06 \
         --out ../artifacts/cafe-momsholic-hist.json
"""
import sys, json, io, argparse, re
from urllib.parse import quote_plus
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from naver_cafe_scraper import (launch, _page_fetch_json, _req_fetch_json,
                                safe_goto, SAMSUNG_PATTERNS, LG_PATTERNS)
from playwright.sync_api import sync_playwright

VIEWS = "MEMBER_LEVEL%2CCOUNT%2CSALE_INFO%2CCAFE_MENU"
# census 근접용 광역 쿼리 union (가전후기 board면 아래로 대부분 포착)
DEFAULT_QUERIES = ["가전", "후기", "삼성", "엘지", "LG", "냉장고", "세탁기", "건조기",
                   "에어컨", "TV", "청소기", "디오스", "비스포크", "디지털프라자", "하이프라자"]
SP = [re.compile(p, re.I) for p in SAMSUNG_PATTERNS]
LP = [re.compile(p, re.I) for p in LG_PATTERNS]


def month_range(start, end):
    y, m = map(int, start.split("-")); ey, em = map(int, end.split("-"))
    while (y, m) <= (ey, em):
        last = [31, 29 if y % 4 == 0 and (y % 100 or y % 400 == 0) else 28, 31, 30,
                31, 30, 31, 31, 30, 31, 30, 31][m - 1]
        yield f"{y}{m:02d}01", f"{y}{m:02d}{last:02d}", f"{y}-{m:02d}"
        m += 1
        if m > 12: m = 1; y += 1


def brand(text):
    return any(p.search(text) for p in SP), any(p.search(text) for p in LP)


def fetch(page, clubid, menu, q, wmin, wmax, pno, per=50):
    ep = f"https://apis.cafe.naver.com/search/v2/cafes/{clubid}/search/articles"
    url = (f"{ep}?query={quote_plus(q)}&perPage={per}&page={pno}&menuId={menu}"
           f"&searchBy=1&writeTime.min={wmin}&writeTime.max={wmax}&views={VIEWS}")
    r = _page_fetch_json(page, url)
    if r.get("status") != 200:
        r = _req_fetch_json(page, url)
    try:
        d = json.loads(r["body"])
    except Exception:
        return [], r.get("status")
    res = d.get("result", d)
    return (res.get("articleList") or res.get("articles") or []), r.get("status")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--clubid", required=True)
    ap.add_argument("--menu", required=True, help="가전/후기 board menuId (probe_cafe.py로 확인)")
    ap.add_argument("--start", required=True)
    ap.add_argument("--end", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--max-pages", type=int, default=900)
    ap.add_argument("--queries", default=None, help="콤마구분, 없으면 기본 union")
    args = ap.parse_args()
    qs = args.queries.split(",") if args.queries else DEFAULT_QUERIES
    cid, menu = args.clubid, args.menu

    seen = {}
    with sync_playwright() as p:
        ctx = launch(p, headless=True)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        safe_goto(page, f"https://cafe.naver.com/f-e/cafes/{cid}/menus/{menu}")
        page.wait_for_timeout(2500)
        for wmin, wmax, label in month_range(args.start, args.end):
            mstart = len(seen)
            for q in qs:
                for pno in range(1, args.max_pages + 1):
                    items, st = fetch(page, cid, menu, q, wmin, wmax, pno)
                    if not items:
                        break
                    for a in items:
                        it = a.get("item", a)
                        aid = it.get("articleId")
                        if not aid or aid in seen:
                            continue
                        title = it.get("subject", "") or it.get("title", "")
                        summary = it.get("summary", "")
                        s, l = brand(title + " " + summary)
                        seen[aid] = {
                            "articleId": aid, "title": title, "summary": summary,
                            "addDate": it.get("addDate", ""), "menu": menu, "clubid": cid,
                            "url": f"https://cafe.naver.com/f-e/cafes/{cid}/articles/{aid}",
                            "samsung": s, "lg": l,
                        }
            print(f"[{label}] 누적 {len(seen)} (+{len(seen)-mstart})", flush=True)
        ctx.close()

    recs = list(seen.values())
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(recs, f, ensure_ascii=False)
    ns = sum(1 for r in recs if r["samsung"]); nl = sum(1 for r in recs if r["lg"])
    print(f"\n저장 {len(recs)}건 → {args.out}")
    print(f"삼성 {ns} / LG {nl} / 삼성비중 {ns/(ns+nl)*100:.1f}%" if ns + nl else "브랜드 0")


if __name__ == "__main__":
    main()
