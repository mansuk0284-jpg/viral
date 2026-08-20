#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""네이버 플레이스 매장 리뷰 수집 — 삼성스토어 vs LG베스트샵

혼수 카페(구매 후기)·제휴카페(지역 생활)와 다른 **세 번째 표본**:
매장을 실제 방문한 고객이 남긴 평가. 표본은 작지만 신호가 진하다.

되는 것 / 안 되는 것 (2026-08-14 실측):
  ✅ 리뷰 건수·별점·본문·방문일·칭찬 키워드 집계·**예약 경유 여부**
  ⛔ 예약 '건수' — 스마트플레이스 관리자만 조회. 절대 지어내지 않는다.
     리뷰의 '인증 수단 = 예약' 비율로 **간접 추정**만 하고 추정임을 표기한다.

일반 HTTP 는 403 이라 로컬 Chrome(Playwright)으로 간다.
프로필은 .browser-profile 공유 → 다른 스크래퍼와 동시 실행 금지.

사용:
  python scripts/naver_place_collect.py --region 부울경 --max-reviews 120
  python scripts/naver_place_collect.py --store "삼성스토어 센텀"
"""
import argparse, io, json, os, re, sys, time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "artifacts" / "naver-place"
JS = (ROOT / "scripts" / "place_extract.js").read_text(encoding="utf-8")
try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass

# 부울경 백화점 입점 매장 — 삼성/LG 쌍으로 둔다(같은 상권 비교가 목적)
TARGETS = [
    ("삼성스토어 센텀", "삼성", "부산"), ("LG베스트샵 센텀점", "LG", "부산"),
    ("삼성스토어 서면", "삼성", "부산"), ("LG베스트샵 서면점", "LG", "부산"),
    ("삼성스토어 동래", "삼성", "부산"), ("LG베스트샵 동래점", "LG", "부산"),
    ("삼성스토어 울산", "삼성", "울산"), ("LG베스트샵 울산점", "LG", "울산"),
    ("삼성스토어 창원", "삼성", "경남"), ("LG베스트샵 창원점", "LG", "경남"),
    ("삼성스토어 진주", "삼성", "경남"), ("LG베스트샵 진주점", "LG", "경남"),
    ("삼성스토어 김해", "삼성", "경남"), ("LG베스트샵 김해점", "LG", "경남"),
]

def slug(s): return re.sub(r"[^0-9A-Za-z가-힣]+", "-", s).strip("-")

def find_place(pg, q):
    """매장명 → place id.
    페이지에서 fetch 로 검색 API 를 직접 부르면 400 이 난다(파라미터·헤더 검증).
    지도 페이지가 스스로 부르는 allSearch 응답을 **가로채는** 방식이 확실하다."""
    box = {}
    def on_resp(r):
        if "allSearch" in r.url and not box:
            try:
                j = r.json()
                lst = (((j.get("result") or {}).get("place") or {}).get("list")) or []
                if lst: box["list"] = lst
            except Exception:
                pass
    pg.on("response", on_resp)
    try:
        pg.goto("https://map.naver.com/p/search/" + q, wait_until="domcontentloaded", timeout=45000)
        for _ in range(16):                     # 응답이 늦게 오는 경우가 있어 폴링
            if box.get("list"): break
            pg.wait_for_timeout(500)
    finally:
        pg.remove_listener("response", on_resp)
    lst = box.get("list") or []
    if not lst:
        return None
    x = lst[0]
    return {"id": x.get("id"), "name": x.get("name"),
            "addr": x.get("roadAddress") or x.get("address"),
            "cat": " ".join(x.get("category") or [])}

def collect_reviews(pg, pid, max_reviews, delay):
    """리뷰 목록을 '더보기'로 늘려 가며 수집.
    실측: 버튼을 아무거나 누르면 16건에서 멈춘다(사진 더보기 등 다른 버튼을 누름).
    텍스트가 정확히 '더보기'인 것만 고르고, 스크롤로 뷰포트에 넣은 뒤 누른다."""
    pg.goto(f"https://pcmap.place.naver.com/place/{pid}/review/visitor",
            wait_until="domcontentloaded", timeout=45000)
    pg.wait_for_timeout(4000)
    last, stall = -1, 0
    for _ in range(60):
        d = pg.evaluate(JS)
        n = len(d.get("items") or [])
        if n >= max_reviews:
            break
        if n == last:
            stall += 1
            if stall >= 2:                 # 두 번 연속 증가 없으면 끝
                break
        else:
            stall = 0
        last = n
        clicked = pg.evaluate("""() => {
          // 목록을 늘리는 건 클래스 fvwqf('펼쳐서 더보기') 버튼이다(실측: 클릭당 +10).
          // 텍스트가 '더보기'인 다른 버튼(사진·정보 등)을 누르면 16건에서 멈춘다.
          const bs = [...document.querySelectorAll('a.fvwqf, a,button')]
            .filter(e => /더보기/.test(e.innerText || '') && e.offsetParent !== null);
          if (!bs.length) return false;
          const b = bs[bs.length - 1];
          b.scrollIntoView({block:'center'});
          b.click();
          return true;
        }""")
        if not clicked:
            break
        pg.wait_for_timeout(int(delay * 1000))
    return pg.evaluate(JS)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--store", help="단일 매장만")
    ap.add_argument("--max-reviews", type=int, default=120)
    ap.add_argument("--delay", type=float, default=1.4, help="더보기 사이 대기(초) — 완만하게")
    ap.add_argument("--headless", action="store_true", default=True)
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)

    tg = [t for t in TARGETS if t[0] == a.store] if a.store else TARGETS
    if not tg:
        tg = [(a.store, "삼성" if "삼성" in a.store else "LG", "")]

    from playwright.sync_api import sync_playwright
    ok = fail = 0
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=str(ROOT / ".browser-profile"), channel="chrome",
            headless=a.headless, viewport={"width": 460, "height": 1000},
            args=["--disable-blink-features=AutomationControlled"])
        pg = ctx.pages[0] if ctx.pages else ctx.new_page()
        for name, brand, region in tg:
            try:
                pl = find_place(pg, name)
                if not pl or not pl.get("id"):
                    print(f"  [miss] {name} — 검색 결과 없음"); fail += 1; continue
                d = collect_reviews(pg, pl["id"], a.max_reviews, a.delay)
                rec = {"query": name, "brand": brand, "region": region,
                       "place": pl, "collected": datetime.now().strftime("%Y-%m-%d %H:%M"),
                       "reviewTotal": d.get("reviewTotal"), "participants": d.get("participants"),
                       "keywords": d.get("keywords") or [], "items": d.get("items") or []}
                (OUT / f"{slug(name)}.json").write_text(
                    json.dumps(rec, ensure_ascii=False, indent=1), encoding="utf-8")
                via = sum(1 for x in rec["items"] if x.get("via") == "예약")
                print(f"  [ok] {pl['name']:<22} 리뷰총 {rec['reviewTotal']} · 수집 {len(rec['items'])} · 예약경유 {via}")
                ok += 1
            except Exception as e:
                print(f"  [err] {name}: {type(e).__name__} {str(e)[:80]}"); fail += 1
            time.sleep(a.delay)
        ctx.close()
    print(f"\n완료 — 성공 {ok} / 실패 {fail} → {OUT}")

if __name__ == "__main__":
    main()
