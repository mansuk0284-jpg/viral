# -*- coding: utf-8 -*-
"""후기(가전) 게시판 전구간 1회 재수집기 (census) — search/v2 + writeTime 날짜창으로 1000페이지 한계 우회.
   월별 윈도우 × 광역 쿼리 union(articleId 중복제거). 제목+요약 기준 1차 분류(빠름).
   ★ 월별 체크포인트 저장 + 재개(.done) + 유통(삼성스토어/LG베스트샵/하이마트 등) 표시.
   본문(매장·시도·인사이트) 정밀 분류는 별도 2단계(enrich)에서 — 이 census가 그 기초 인덱스.
   공개 검색·로그인 없음. 비밀번호·키 입력 없음.

   사용:
     python collect_history.py --start 2021-01 --end 2026-05 --out ../artifacts/cafe-census.json
     (죽으면 같은 명령 재실행 → .done 의 완료 월은 건너뛰고 이어서)
"""
import sys, json, io, argparse, re, os
from urllib.parse import quote_plus
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from naver_cafe_scraper import (launch, _page_fetch_json, _req_fetch_json, CLUBID,
                                safe_goto, SAMSUNG_PATTERNS, LG_PATTERNS)
from playwright.sync_api import sync_playwright

MENU = "280"
EP = f"https://apis.cafe.naver.com/search/v2/cafes/{CLUBID}/search/articles"
VIEWS = "MEMBER_LEVEL%2CCOUNT%2CSALE_INFO%2CCAFE_MENU"
QUERIES = ["가전", "후기", "삼성", "엘지", "냉장고", "세탁기", "건조기", "에어컨",
           "TV", "청소기", "디오스", "비스포크", "스타일러", "김치냉장고"]
SP = [re.compile(p, re.I) for p in SAMSUNG_PATTERNS]
LP = [re.compile(p, re.I) for p in LG_PATTERNS]
# 유통(어디서 샀나) — 후기에서 자주 보이는 표기. census는 제목+요약만 보므로 신호 약하면 빈 값.
RETAILERS = [
    ("삼성스토어", re.compile(r"삼성\s*스토어|디지[털탈]\s*프라자|디지[털탈]프라자")),
    ("LG베스트샵", re.compile(r"베스트\s*샵|하이프라자|엘지\s*베스트")),
    ("하이마트", re.compile(r"하이마트|롯데\s*하이마트")),
    ("전자랜드", re.compile(r"전자랜드")),
    ("백화점", re.compile(r"백화점|롯데|신세계|현대")),
    ("온라인", re.compile(r"온라인|공식몰|닷컴|쿠팡|이마트몰|쓱|SSG", re.I)),
]


def month_range(start, end):
    y, m = map(int, start.split("-")); ey, em = map(int, end.split("-"))
    while (y, m) <= (ey, em):
        last = [31, 29 if y % 4 == 0 and (y % 100 or y % 400 == 0) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
        yield f"{y}{m:02d}01", f"{y}{m:02d}{last:02d}", f"{y}-{m:02d}"
        m += 1
        if m > 12: m = 1; y += 1


def classify(text):
    s = any(p.search(text) for p in SP)
    l = any(p.search(text) for p in LP)
    rs = [name for name, pat in RETAILERS if pat.search(text)]
    return s, l, rs


def fetch(page, q, wmin, wmax, pno, per=50):
    url = (f"{EP}?query={quote_plus(q)}&perPage={per}&page={pno}&menuId={MENU}"
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


def load_master(path):
    if not os.path.exists(path):
        return {}
    try:
        with open(path, encoding="utf-8") as f:
            return {r["articleId"]: r for r in json.load(f)}
    except Exception:
        return {}


def save_master(path, seen):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(list(seen.values()), f, ensure_ascii=False)
    os.replace(tmp, path)   # 원자적 교체 — 중간에 죽어도 master 손상 방지


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", required=True)
    ap.add_argument("--end", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--max-pages", type=int, default=900)
    ap.add_argument("--queries", default=None)
    args = ap.parse_args()
    qs = args.queries.split(",") if args.queries else QUERIES

    donepath = args.out + ".done"
    done = set()
    if os.path.exists(donepath):
        done = set(open(donepath, encoding="utf-8").read().split())
    seen = load_master(args.out)
    filled = [0]          # 기존 글에 조회수를 채운 건수
    print(f"재개: master {len(seen)}건 · 완료월 {len(done)}개", flush=True)

    with sync_playwright() as p:
        ctx = launch(p, headless=True)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        safe_goto(page, f"https://cafe.naver.com/f-e/cafes/{CLUBID}/menus/{MENU}")
        page.wait_for_timeout(2500)
        for wmin, wmax, label in month_range(args.start, args.end):
            if label in done:
                continue
            mstart = len(seen)
            for q in qs:
                for pno in range(1, args.max_pages + 1):
                    items, stt = fetch(page, q, wmin, wmax, pno)
                    if not items:
                        break
                    for a in items:
                        it = a.get("item", a)
                        aid = it.get("articleId")
                        if not aid:
                            continue
                        if aid in seen:
                            # 이미 있는 글이라도 **조회수가 비어 있으면 채운다**.
                            # 그냥 건너뛰면 예전에 모은 10만 건은 영영 조회수가 없다(실측).
                            old = seen[aid]
                            if "readCount" not in old:
                                old["readCount"] = int(it.get("readCount") or 0)
                                old["likeCount"] = int(it.get("likeItCount") or it.get("likeCount") or 0)
                                old["commentCount"] = int(it.get("commentCount") or 0)
                                filled[0] += 1
                            continue
                        title = it.get("subject", "") or it.get("title", "")
                        summary = it.get("summary", "")
                        s, l, rs = classify(title + " " + summary)
                        seen[aid] = {
                            "articleId": aid, "title": title, "summary": summary,
                            "addDate": it.get("addDate", ""),
                            "writeMonth": label, "menu": MENU,
                            "url": f"https://cafe.naver.com/f-e/cafes/{CLUBID}/articles/{aid}",
                            "samsung": s, "lg": l, "retailers": rs,
                            # 조회수 — 후기 '건수'만큼 중요하다. 한 건이 몇 명에게 읽혔는지가
                            # 실제 노출량이다(사용자 지시 2026-08-21). API 가 주는데 그동안 버렸다.
                            "readCount": int(it.get("readCount") or 0),
                            "likeCount": int(it.get("likeItCount") or it.get("likeCount") or 0),
                            "commentCount": int(it.get("commentCount") or 0),
                            "bodyRead": False,   # 2단계 enrich 대상 표시
                        }
            # 월 단위 체크포인트
            save_master(args.out, seen)
            done.add(label)
            with open(donepath, "w", encoding="utf-8") as f:
                f.write(" ".join(sorted(done)))
            print(f"[{label}] 누적 {len(seen)} (+{len(seen)-mstart}) · 조회수 채움 {filled[0]}", flush=True)
        ctx.close()

    recs = list(seen.values())
    ns = sum(1 for r in recs if r["samsung"]); nl = sum(1 for r in recs if r["lg"])
    print(f"\n완료 저장 {len(recs)}건 → {args.out}", flush=True)
    print(f"삼성 {ns} / LG {nl} / 삼성비중 {ns/(ns+nl)*100:.1f}%" if ns + nl else "브랜드 0", flush=True)
    have = [r for r in recs if r.get("readCount") is not None and "readCount" in r]
    if have:
        tot = sum(r["readCount"] for r in have)
        print(f"조회수 보유 {len(have):,}건 / 전체 {len(recs):,}건 · 합계 {tot:,}회 "
              f"(평균 {tot/max(1,len(have)):.0f}회)", flush=True)


if __name__ == "__main__":
    main()
