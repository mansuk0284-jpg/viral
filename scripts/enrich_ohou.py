#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""오늘의집 2단계 — 게시물을 하나씩 열어 **날짜·좋아요·스크랩·조회수**를 받아온다.

검색 격자에는 날짜도 반응 수도 없다. 그래서 1단계(collect_ohou.py)만으로는
"기간별 트렌드"도 "공감을 얻은 글"도 만들 수 없었다.

**실측으로 찾은 단서(2026-08-26)**: 상세 페이지 본문 끝에
    "07.05좋아요45스크랩36조회63"
형태로 한 덩어리가 붙어 있다. 앞의 `MM.DD` 가 게시일이고, 연도는 없다.
  · 연도 보정: 그 월·일이 **오늘보다 미래면 작년**으로 본다(관용적 표기 방식).
    이건 추정이므로 화면에 "연도 추정"이라고 밝힌다 — 지어내지 않되 숨기지도 않는다.
  · 사이드바에 "2024. 09. 08 ~ 2027. 09. 07"(사업자 정보 기간)이 보이는데
    **이건 게시일이 아니다** — 세 글 모두 같은 값이라 실측으로 걸러냈다.

로그인 불필요(공개 화면). 헤디드 필수 — 헤드리스는 403.
중간에 죽어도 이어서 하도록 매 10건마다 저장한다.

사용:
    python scripts/enrich_ohou.py --limit 5     # 맛보기
    python scripts/enrich_ohou.py               # 전량
"""
import argparse
import glob
import io
import json
import os
import re
import sys
import time
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from naver_cafe_scraper import launch, safe_goto
from playwright.sync_api import sync_playwright

# "07.05좋아요45스크랩36조회63" — 붙어 있으므로 한 정규식으로 통째로 읽는다
STAT_RE = re.compile(
    r"(?:(\d{1,2})\.(\d{1,2}))?\s*좋아요\s*([\d,]+)\s*스크랩\s*([\d,]+)(?:\s*조회\s*([\d,]+))?")


def newest():
    fs = glob.glob(os.path.join(ROOT, "artifacts", "*-channel-ohou.json"))
    if not fs:
        raise SystemExit("오늘의집 수집 파일이 없습니다 — collect_ohou.py 먼저")
    return max(fs, key=os.path.getmtime)


def year_of(mm, dd):
    """연도 없는 MM.DD → 연도 추정. 미래면 작년(관용 표기)."""
    today = date.today()
    y = today.year
    try:
        if date(y, mm, dd) > today:
            y -= 1
    except ValueError:
        return ""
    return f"{y:04d}-{mm:02d}-{dd:02d}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--delay", type=float, default=1.1)
    args = ap.parse_args()

    path = newest()
    rows = json.load(io.open(path, encoding="utf-8"))
    todo = [i for i, r in enumerate(rows) if not r.get("metaRead")]
    if args.limit:
        todo = todo[:args.limit]
    print(f"게시물 {len(rows)}개 · 이번에 열 것 {len(todo)}개")
    if not todo:
        print("열 게시물이 없습니다.")
        return

    def save():
        io.open(path, "w", encoding="utf-8").write(
            json.dumps(rows, ensure_ascii=False, separators=(",", ":")))

    got = dated = liked = 0
    with sync_playwright() as p:
        ctx = launch(p, headless=False)     # 헤드리스는 403 — 실제 창이어야 열린다
        pg = ctx.pages[0] if ctx.pages else ctx.new_page()
        try:
            for n, i in enumerate(rows and todo, 1):
                r = rows[i]
                try:
                    safe_goto(pg, r["url"])
                    pg.wait_for_timeout(1500)
                    pg.mouse.wheel(0, 2200)
                    pg.wait_for_timeout(900)
                    body = pg.evaluate("()=>document.body.innerText")
                    m = STAT_RE.search(body or "")
                    if m:
                        mm, dd, lk, sc, vw = m.groups()
                        if mm and dd:
                            d = year_of(int(mm), int(dd))
                            if d:
                                r["date"] = d
                                dated += 1
                        r["likes"] = int((lk or "0").replace(",", ""))
                        r["scrap"] = int((sc or "0").replace(",", ""))
                        if vw:
                            r["views"] = int(vw.replace(",", ""))
                        liked += 1
                except Exception:
                    pass
                r["metaRead"] = True
                got += 1
                time.sleep(args.delay)
                if n % 10 == 0:
                    save()
                    print(f"  {n}/{len(todo)} · 날짜 {dated} · 반응 {liked}")
        finally:
            ctx.close()

    save()
    print(f"\n연 게시물 {got} · 날짜 확보 {dated} · 반응 확보 {liked}")
    print(f"→ {os.path.basename(path)}")
    print("이어서: python scripts/build_ohou_web.py")


if __name__ == "__main__":
    main()
