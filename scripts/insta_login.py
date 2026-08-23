#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""인스타그램 로그인 — 창을 띄우고, 로그인되면 그 자리에서 확인한다

앞선 시도(2026-08-24)에서 창을 닫은 뒤에 확인했더니 세션이 없었다.
그때는 로그인이 안 된 건지, 됐는데 저장이 안 된 건지 알 수 없었다.
그래서 이번에는 **같은 창에서 로그인 여부를 계속 지켜보고**, 되는 순간
태그 페이지까지 열어 실제로 읽히는지 확인한 뒤 창을 닫는다.

비밀번호는 코드가 만지지 않는다. 사람이 직접 입력한다.

사용: python scripts/insta_login.py --seconds 300
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

from naver_cafe_scraper import launch, safe_goto
from playwright.sync_api import sync_playwright

TAG = "https://www.instagram.com/explore/tags/%ED%98%BC%EC%88%98%EA%B0%80%EC%A0%84/"


def logged_in(page):
    """로그인 판정 — 주소가 login 이 아니고, 로그인 폼이 안 보이면 들어간 것."""
    try:
        if "/accounts/login" in (page.url or ""):
            return False
        n = page.evaluate("""() => document.querySelectorAll(
            'input[name="username"], input[name="password"]').length""")
        return n == 0
    except Exception:
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seconds", type=int, default=300)
    a = ap.parse_args()

    with sync_playwright() as p:
        ctx = launch(p, headless=False)          # 사람이 볼 수 있게 창을 띄운다
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        safe_goto(page, "https://www.instagram.com/accounts/login/")
        print("\n[insta] 크롬 창에서 직접 로그인하세요. (비번은 코드가 만지지 않습니다)")
        print(f"[insta] {a.seconds}초 동안 기다리며 5초마다 로그인 여부를 확인합니다.")
        print("[insta] 2단계 인증·보안 확인이 뜨면 그것까지 마쳐 주세요.\n", flush=True)

        ok = False
        for left in range(a.seconds, 0, -5):
            if logged_in(page):
                ok = True
                print(f"[insta] 로그인 확인됨 (남은 시간 {left}s)", flush=True)
                break
            if left % 30 == 0:
                print(f"[insta] 대기 중... {left}s", flush=True)
            time.sleep(5)

        result = {"when": datetime.now().strftime("%Y-%m-%d %H:%M"), "login": ok}
        if ok:
            # 로그인이 됐으면 **그 자리에서** 태그 페이지가 실제로 읽히는지 본다
            time.sleep(2)
            safe_goto(page, TAG)
            page.wait_for_timeout(6000)
            url = page.url or ""
            posts = 0
            try:
                posts = page.evaluate(
                    """() => document.querySelectorAll('a[href*="/p/"]').length""")
            except Exception:
                pass
            body = ""
            try:
                body = page.inner_text("body")[:200].replace("\n", " ")
            except Exception:
                pass
            result.update({"tagUrl": url[:90], "posts": posts, "body": body[:160]})
            print(f"\n[insta] 태그 페이지: {url[:70]}")
            print(f"[insta] 게시물 링크 {posts}개")
            if posts:
                print("[insta] 읽힙니다 — 수집 가능합니다.")
            else:
                print("[insta] 로그인은 됐지만 게시물이 안 보입니다(태그 제한·봇 감지 가능).")
        else:
            print("\n[insta] 시간 안에 로그인이 확인되지 않았습니다.")

        io.open(os.path.join(ROOT, "artifacts", "insta-login.json"), "w",
                encoding="utf-8").write(json.dumps(result, ensure_ascii=False, indent=1))
        print("[insta] 창을 닫습니다. 세션은 .browser-profile 에 남습니다.", flush=True)
        ctx.close()


if __name__ == "__main__":
    main()
