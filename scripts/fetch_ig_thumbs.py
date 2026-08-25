#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""인스타 썸네일 로컬 저장 — 화면에 그림을 띄우기 위한 3단계.

인스타는 유튜브(i.ytimg.com)와 달리 게시물 id 로 썸네일을 바로 주지 않는다.
og:image 의 CDN 주소는 **서명이 붙어 며칠이면 만료**되므로 화면에 그 URL 을
박으면 어느 날 전부 깨진다(하네스 원칙: 깨질 것을 알면서 싣지 않는다).
그래서 게시물을 열 때 이미지를 **web/assets/ig/{id}.jpg 로 저장**해 우리 것으로
만든다 — 배포본(GitHub Pages)에 같이 실려 영구히 산다.

전량이 아니라 **화면에 오를 가능성이 있는 글만** 받는다(좋아요 상위 + 최신).
로그인 세션 필요(.browser-profile 공유 — 한 번에 하나만).

사용:
    python scripts/fetch_ig_thumbs.py --top 120
"""
import argparse
import glob
import io
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from naver_cafe_scraper import launch, safe_goto
from playwright.sync_api import sync_playwright

OUT = os.path.join(ROOT, "web", "assets", "ig")


def newest():
    fs = glob.glob(os.path.join(ROOT, "artifacts", "*-channel-instagram.json"))
    if not fs:
        raise SystemExit("인스타 수집 파일이 없습니다")
    return max(fs, key=os.path.getmtime)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=120, help="좋아요 상위+최신 몇 건까지")
    ap.add_argument("--login-wait", type=int, default=300)
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)

    rows = json.load(io.open(newest(), encoding="utf-8"))
    # 화면에 오를 후보: 좋아요 상위 + 최신 글(날짜 내림차순) — 합집합
    liked = sorted([r for r in rows if r.get("likes") is not None],
                   key=lambda r: -(r.get("likes") or 0))[:args.top]
    recent = sorted([r for r in rows if r.get("taken_at")],
                    key=lambda r: r.get("taken_at"), reverse=True)[:args.top]
    todo, seen = [], set()
    for r in liked + recent:
        if r["id"] in seen:
            continue
        seen.add(r["id"])
        if not os.path.exists(os.path.join(OUT, r["id"] + ".jpg")):
            todo.append(r)
    print(f"후보 {len(seen)}건 · 새로 받을 것 {len(todo)}건")
    if not todo:
        return

    got = 0
    with sync_playwright() as p:
        ctx = launch(p, headless=False)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        safe_goto(page, "https://www.instagram.com/")
        import time
        ok = False
        for i in range(args.login_wait // 5):
            time.sleep(5)
            if any(c["name"] == "sessionid" for c in ctx.cookies()):
                ok = True
                break
        if not ok:
            print("[ig] 로그인이 확인되지 않아 중단합니다 — 사용자 직접 로그인 필요")
            ctx.close()
            return
        for n, r in enumerate(todo, 1):
            try:
                safe_goto(page, r["url"])
                page.wait_for_timeout(1200)
                og = page.evaluate(
                    "()=>{const m=document.querySelector('meta[property=\"og:image\"]');"
                    "return m?m.getAttribute('content'):'';}") or ""
                if not og:
                    continue
                req = urllib.request.Request(og, headers={"User-Agent": "Mozilla/5.0"})
                data = urllib.request.urlopen(req, timeout=20).read()
                if len(data) > 1000:
                    io.open(os.path.join(OUT, r["id"] + ".jpg"), "wb").write(data)
                    got += 1
            except Exception:
                pass
            if n % 20 == 0:
                print(f"  {n}/{len(todo)} · 저장 {got}")
        ctx.close()
    print(f"저장 {got}건 → web/assets/ig/")


if __name__ == "__main__":
    main()
