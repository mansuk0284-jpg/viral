# -*- coding: utf-8 -*-
"""네이버 카페 URL → clubId + 게시판(menuId) 목록 확인.

채널 확장 시 새 카페를 붙이기 위한 1회성 조사 도구.
공개 정보만 읽으며 로그인·비밀번호를 입력하지 않는다.

사용:
  python scripts/probes/probe_cafe_id.py https://cafe.naver.com/imsanbu [...]
"""
import io
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from naver_cafe_scraper import launch, safe_goto, _page_fetch_json  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

MENU_API = "https://apis.naver.com/cafe-web/cafe-mobile/CafeMenuList.json?cafeId={cid}"
KEYWORDS = ("가전", "후기", "혼수", "신혼", "살림", "리뷰")


def resolve_clubid(page, url):
    safe_goto(page, url)
    page.wait_for_timeout(2500)
    html = page.content()
    for pat in (r'"cafeId"\s*:\s*"?(\d{6,})', r'clubid=(\d{6,})', r'cafeId=(\d{6,})',
                r'"cafeUrl".{0,80}?"cafeId"\s*:\s*"?(\d{6,})'):
        m = re.search(pat, html)
        if m:
            return m.group(1)
    try:
        return page.evaluate("() => window.g_sClubId || (window.__PRELOADED_STATE__||{}).cafeId || ''") or None
    except Exception:
        return None


def menus_of(page, cid):
    res = _page_fetch_json(page, MENU_API.format(cid=cid))
    if res.get("status") != 200:
        return []
    try:
        d = json.loads(res["body"])
    except Exception:
        return []
    arr = (d.get("message", {}).get("result", {}) or {}).get("menus") or d.get("menus") or []
    out = []
    for m in arr:
        name = m.get("menuName") or m.get("name") or ""
        mid = m.get("menuId") or m.get("id")
        if name and mid:
            out.append((str(mid), name))
    return out


def main():
    urls = sys.argv[1:]
    if not urls:
        print("사용: probe_cafe_id.py <카페URL> [...]")
        return
    with sync_playwright() as p:
        ctx = launch(p, headless=True)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        for u in urls:
            print(f"\n=== {u} ===")
            cid = resolve_clubid(page, u)
            if not cid:
                print("  clubId 확인 실패(비공개/구조변경 가능)")
                continue
            print(f"  clubId = {cid}")
            ms = menus_of(page, cid)
            if not ms:
                print("  게시판 목록 조회 실패(로그인 필요할 수 있음)")
                continue
            hits = [(i, n) for i, n in ms if any(k in n for k in KEYWORDS)]
            print(f"  게시판 {len(ms)}개 · 후보 {len(hits)}개")
            for i, n in hits[:15]:
                print(f"    menuId {i:>5} · {n}")
        ctx.close()


if __name__ == "__main__":
    main()
