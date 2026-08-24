#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""census 2단계 — 본문을 열어 매장을 확정한다 (enrich).

collect_history.py 가 만드는 census 는 **제목 + 검색요약**만 담는다(설계상 인덱스).
그래서 제목에 매장을 안 적은 후기는 전부 '백화점 미상'으로 빠진다.
실측(2026-08-24, 120,625건):

    삼성 표시 44,463건 중 제목에 백화점 매장까지 = 17,506 (39%)
    LG   표시 41,795건 중 제목에 백화점 매장까지 = 13,393 (32%)

39% 대 32% — **삼성 후기 쓰는 사람이 매장명을 더 자주 적는다.**
그래서 여기서 '삼성 글만' 본문을 열면 삼성 매칭률만 뛰고 LG 는 그대로라,
화면에는 실제와 다른 우위가 뜬다. 반드시 **양쪽을 같은 잣대로** 연다.

열 대상 = 브랜드는 잡혔는데 제목에 매장이 없는 글(실측 54,181건).
브랜드도 매장도 없는 글은 열어도 비교표에 들어올 확률이 낮아 뒤로 미룬다.

로그인이 필요하다. 네이버는 '로그인 상태 유지'를 안 하면 NID_SES 를 세션 쿠키로
주기 때문에, 별도 로그인 명령으로 로그인해도 창을 닫는 순간 사라진다
(실측: 본문이 150건 중 16건만 읽혔다). 그래서 **로그인한 창 그대로** 이어서 읽는다.
비밀번호는 코드가 절대 입력하지 않는다 — 사용자가 직접 친다.

중간에 죽어도 이어서 할 수 있게 매 N건마다 저장한다.

사용:
    python enrich_census.py --limit 200        # 맛보기(효과 측정)
    python enrich_census.py                    # 전량
"""
import argparse
import io
import json
import os
import sys
import time
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from naver_cafe_scraper import launch, safe_goto, api_article_body, CLUBID
from build_web_data import dept_store_of, STORE_EXCLUDE
from playwright.sync_api import sync_playwright

CENSUS = os.path.join(ROOT, "artifacts", "cafe-census.json")


def store_of(txt):
    d = dept_store_of(txt or "")
    return d if d and d not in STORE_EXCLUDE else None


def targets(rows, since=None):
    """열 가치가 있는 글만 고른다 — 브랜드는 있는데 매장이 없는 글.

    since("YYYY-MM")를 주면 그 달 이후 글만 연다. 전량은 7.6시간이 걸려서,
    최근 구간부터 채우면 현재 월·최근 분기 화면이 먼저 정확해진다.
    과거분은 나중에 같은 명령을 since 없이 돌리면 이어서 채워진다
    (읽은 글은 bodyRead 로 건너뛴다).
    """
    out = []
    for i, r in enumerate(rows):
        if r.get("bodyRead"):                       # 이미 읽었다
            continue
        if not (r.get("samsung") or r.get("lg")):   # 브랜드가 없으면 뒤로
            continue
        if store_of(r.get("title") or ""):          # 제목에 이미 매장이 있다
            continue
        if since and (r.get("writeMonth") or "") < since:
            continue
        out.append(i)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="이번에 열 글 수(0=전량)")
    ap.add_argument("--since", default=None,
                    help="이 달 이후만(YYYY-MM). 최근 구간부터 채울 때 쓴다")
    ap.add_argument("--delay", type=float, default=0.25)
    ap.add_argument("--save-every", type=int, default=200)
    ap.add_argument("--login-wait", type=int, default=600)
    args = ap.parse_args()

    rows = json.load(io.open(CENSUS, encoding="utf-8"))
    idxs = targets(rows, args.since)
    if args.limit:
        idxs = idxs[:args.limit]
    print(f"census {len(rows):,}건 · 이번에 열 글 {len(idxs):,}건"
          + (f" ({args.since} 이후)" if args.since else ""))
    if not idxs:
        print("열 글이 없습니다.")
        return

    before = sum(1 for r in rows if store_of((r.get("title") or "") + " " +
                                             (r.get("body_excerpt") or "")))
    got = new_store = fail = 0
    t0 = time.time()

    def save():
        io.open(CENSUS, "w", encoding="utf-8").write(
            json.dumps(rows, ensure_ascii=False, separators=(",", ":")))

    with sync_playwright() as p:
        ctx = launch(p, headless=False)          # 로그인 창을 사람이 봐야 한다
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        safe_goto(page, "https://nid.naver.com/nidlogin.login?url="
                        "https%3A%2F%2Fcafe.naver.com%2Fdirectwedding")
        print("[enrich] 크롬 창이 열렸습니다 — **이 창에서** 네이버에 로그인하세요.")
        print("[enrich] 로그인이 확인되면 본문 읽기가 자동으로 이어집니다.")
        ok = False
        for i in range(args.login_wait // 5):
            time.sleep(5)
            names = {c["name"] for c in ctx.cookies()}
            if "NID_AUT" in names and "NID_SES" in names:
                print(f"[enrich] 로그인 확인됨 ({(i + 1) * 5}초) — 시작")
                ok = True
                break
            if i % 6 == 5:
                print(f"[enrich] 로그인 대기 중... {(i + 1) * 5}s")
        if not ok:
            print("[enrich] 로그인이 확인되지 않아 중단합니다.")
            ctx.close()
            return

        safe_goto(page, f"https://cafe.naver.com/f-e/cafes/{CLUBID}/menus/280")
        page.wait_for_timeout(1500)

        for n, i in enumerate(idxs, 1):
            r = rows[i]
            try:
                body = api_article_body(page, r["articleId"])
            except Exception:
                body = ""
            if body:
                got += 1
                r["body_excerpt"] = body[:4000]
                r["bodyRead"] = True
                st = store_of((r.get("title") or "") + " " + body[:4000])
                if st:
                    r["store"] = st
                    new_store += 1
            else:
                fail += 1
                r["bodyRead"] = False
            time.sleep(args.delay)
            if n % args.save_every == 0:
                save()
                el = time.time() - t0
                eta = el / n * (len(idxs) - n) / 60
                print(f"  {n:,}/{len(idxs):,} · 읽힘 {got:,} 실패 {fail:,} · "
                      f"매장 새로 잡힘 {new_store:,} · 남은 시간 약 {eta:.0f}분")
        ctx.close()

    save()
    after = sum(1 for r in rows if store_of((r.get("title") or "") + " " +
                                            (r.get("body_excerpt") or "")))
    print(f"\n열어본 글 {len(idxs):,} · 본문 읽힘 {got:,} · 실패 {fail:,}")
    print(f"매장이 잡힌 글 {before:,} → {after:,} (+{after - before:,})")
    print(f"→ {CENSUS}")
    print("이어서: python scripts/build_web_data.py")


if __name__ == "__main__":
    main()
