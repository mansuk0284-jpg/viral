#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""인스타 2단계 — 게시물을 하나씩 열어 날짜·반응 수를 받아온다.

collect_instagram.py 는 **검색 격자**를 긁는다. 거기서 나오는 것은
이미지 설명(alt)과 링크뿐이다 — 날짜도 좋아요 수도 없다(실측 2026-08-24).

그래서 유튜브 화면처럼 "기간"과 "순위"를 만들 수 없었다.
없는 값으로 기간 탭을 붙이면 눈금만 있고 뜻이 없는 화면이 된다.

이 스크립트는 게시물 URL 을 하나씩 열어 아래를 받아온다:
  - taken_at  : <time datetime="..."> (게시 시각, 정확한 날짜)
  - likes     : 좋아요 수 (계정이 숨기면 없을 수 있다 — 없으면 비운다)
  - comments  : 댓글 수

로그인 세션이 필요하다. **.browser-profile 은 한 번에 하나만** 쓸 수 있으므로
census enrich 같은 다른 수집이 돌고 있으면 끝난 뒤에 실행한다.
비밀번호는 코드가 절대 입력하지 않는다 — 사용자가 직접 친다.

중간에 죽어도 이어서 할 수 있게 매 10건마다 저장한다.

사용:
    python enrich_instagram.py --limit 5     # 맛보기
    python enrich_instagram.py               # 전량
"""
import argparse
import glob
import io
import json
import os
import re
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from naver_cafe_scraper import launch, safe_goto
from playwright.sync_api import sync_playwright

NUM = re.compile(r"([\d,\.]+)\s*(만|천|k|m)?", re.I)


def to_int(txt):
    """'1,234' · '1.2만' · '3.4k' 를 정수로."""
    if not txt:
        return None
    m = NUM.search(txt.replace(" ", ""))
    if not m:
        return None
    try:
        n = float(m.group(1).replace(",", ""))
    except ValueError:
        return None
    u = (m.group(2) or "").lower()
    if u == "만":
        n *= 10000
    elif u == "천":
        n *= 1000
    elif u == "k":
        n *= 1000
    elif u == "m":
        n *= 1000000
    return int(n)


def newest():
    fs = glob.glob(os.path.join(ROOT, "artifacts", "*-channel-instagram.json"))
    if not fs:
        raise SystemExit("인스타 수집 파일이 없습니다 — collect_instagram.py 먼저")
    return max(fs, key=os.path.getmtime)


def grab(page):
    """열린 게시물 페이지에서 날짜·좋아요·댓글을 뽑는다.

    인스타는 화면 구조를 자주 바꾼다. 그래서 한 가지 경로만 믿지 않고
    ①time 태그 ②본문 스크립트의 JSON ③화면 글자 순으로 시도한다.
    못 찾으면 **지어내지 않고 비워 둔다.**
    """
    out = {"taken_at": "", "likes": None, "comments": None, "account": ""}

    # ① <time datetime="2026-04-12T...">
    try:
        t = page.query_selector("time[datetime]")
        if t:
            out["taken_at"] = (t.get_attribute("datetime") or "")[:10]
    except Exception:
        pass

    # ② 페이지에 박힌 JSON(taken_at 유닉스 시각)
    if not out["taken_at"]:
        try:
            html = page.content()
            m = re.search(r'"taken_at(?:_timestamp)?"\s*:\s*(\d{9,})', html)
            if m:
                from datetime import datetime
                out["taken_at"] = datetime.fromtimestamp(int(m.group(1))).strftime("%Y-%m-%d")
        except Exception:
            pass

    # ③ 좋아요·댓글·계정 — og:description 에서.
    #    화면 본문에는 좋아요 수가 안 나온다(인스타가 감춘다). 대신 메타 태그에
    #    "1 likes, 0 comments - nc_daejeonyuseong_himart - August 19, 2026: ..."
    #    형태로 실려 있다(실측 2026-08-24). 여기가 유일하게 믿을 만한 경로다.
    try:
        og = page.evaluate(
            "()=>{const m=document.querySelector('meta[property=\"og:description\"]');"
            "return m?m.getAttribute('content'):'';}") or ""
        m = re.search(r"([\d,\.]+[KMkm]?)\s*likes?,\s*([\d,\.]+[KMkm]?)\s*comments?", og)
        if m:
            out["likes"] = to_int(m.group(1))
            out["comments"] = to_int(m.group(2))
        m = re.search(r"likes?,\s*[\d,\.]+[KMkm]?\s*comments?\s*-\s*([^\s-]+)\s*-", og)
        if m:
            out["account"] = m.group(1)
        # 날짜를 아직 못 찾았으면 여기 적힌 영문 날짜로 채운다
        if not out["taken_at"]:
            m = re.search(r"-\s*([A-Z][a-z]+ \d{1,2}, \d{4})\s*:", og)
            if m:
                from datetime import datetime as _dt
                try:
                    out["taken_at"] = _dt.strptime(m.group(1), "%B %d, %Y").strftime("%Y-%m-%d")
                except ValueError:
                    pass
    except Exception:
        pass

    # 좋아요를 숨긴 계정이면 '외 여러 명' 으로만 뜬다 — 그때는 비워 둔다
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--delay", type=float, default=1.2)
    ap.add_argument("--login-wait", type=int, default=420)
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
        ctx = launch(p, headless=False)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        safe_goto(page, "https://www.instagram.com/")
        print("[insta] 크롬 창이 열렸습니다 — 로그인 상태가 아니면 **이 창에서** 로그인하세요.")
        ok = False
        for i in range(args.login_wait // 5):
            time.sleep(5)
            names = {c["name"] for c in ctx.cookies()}
            if "sessionid" in names:
                print(f"[insta] 로그인 확인됨 ({(i + 1) * 5}초) — 시작")
                ok = True
                break
            if i % 6 == 5:
                print(f"[insta] 로그인 대기 중... {(i + 1) * 5}s")
        if not ok:
            print("[insta] 로그인이 확인되지 않아 중단합니다.")
            ctx.close()
            return

        for n, i in enumerate(todo, 1):
            r = rows[i]
            try:
                safe_goto(page, r["url"])
                page.wait_for_timeout(1400)
                info = grab(page)
            except Exception:
                info = {"taken_at": "", "likes": None, "comments": None, "account": ""}
            r.update(info)
            r["metaRead"] = True
            got += 1
            if info["taken_at"]:
                dated += 1
            if info["likes"] is not None:
                liked += 1
            time.sleep(args.delay)
            if n % 10 == 0:
                save()
                print(f"  {n}/{len(todo)} · 날짜 {dated} · 좋아요 {liked}")
        ctx.close()

    save()
    print(f"\n연 게시물 {got} · 날짜 확보 {dated} · 좋아요 확보 {liked}")
    if dated < got * 0.5:
        print("날짜를 절반도 못 받았습니다 — 화면에 기간 탭을 붙이지 마세요.")
    print(f"→ {os.path.basename(path)}")
    print("이어서: python scripts/build_instagram_web.py")


if __name__ == "__main__":
    main()
