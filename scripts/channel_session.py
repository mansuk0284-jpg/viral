#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
채널 접속 세션 관리기 (Playwright) — 6채널 로그인 후 검색 진입 지원.

목적: 공개검색만으로는 표본이 빈약한 채널(오늘의집·인스타·유튜브·맘카페 등)을
사용자가 '직접 로그인'한 세션으로 진입해 더 정확히 수집하도록 돕는다.

핵심 원칙(보안):
  - 비밀번호는 코드가 절대 입력/저장하지 않는다. 사용자가 열린 크롬 창에서 직접 로그인한다.
  - 로그인 결과(쿠키/세션)는 로컬 공유 프로필(.browser-profile)에만 남는다.
  - 개인 모니터링 용도의 소규모·완만한 속도. 각 채널 약관·레이트리밋을 존중한다.

이 스크립트는 사장님 PC에서 직접 실행된다(로컬 Chrome 구동, 샌드박스 차단과 무관).
naver_cafe_scraper.py 와 동일한 .browser-profile 을 공유하므로 네이버 로그인은 호환된다.

서브커맨드
  login   : 채널 로그인 창을 띄우고 대기. 사용자가 직접 로그인하면 세션이 프로필에 저장된다.
  status  : 채널별 로그인 여부를 휴리스틱으로 점검(게스트/로그인).
  open    : 로그인 세션으로 채널 검색결과 페이지를 연다. --dump 시 보이는 링크·텍스트를 JSON으로 저장.

사용 예
  python channel_session.py login  --channel naver
  python channel_session.py login  --channel instagram --seconds 240
  python channel_session.py status
  python channel_session.py open    --channel ohou --query "혼수 비스포크 후기" --dump
"""
import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

from playwright.sync_api import sync_playwright

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = Path(__file__).resolve().parent.parent
PROFILE_DIR = ROOT / ".browser-profile"   # naver_cafe_scraper.py 와 공유
ARTIFACTS = ROOT / "artifacts"

# 채널 정의. login_url=로그인/홈, check_url=로그인 점검 페이지,
# signed_out_hint=이 텍스트가 보이면 '게스트'로 판정(휴리스틱),
# search_url=검색 진입 URL 템플릿({q}=URL인코딩 쿼리).
CHANNELS = {
    "naver": {
        "label": "네이버(카페·블로그·맘카페 공통 로그인)",
        "login_url": "https://nid.naver.com/nidlogin.login",
        "check_url": "https://www.naver.com",
        "signed_out_hint": ["NID.login", "로그인"],
        "signed_in_hint": ["로그아웃", "MYBOX", "메일"],
        "search_url": "https://search.naver.com/search.naver?where=view&query={q}",
    },
    "kakao": {
        "label": "카카오/다음(다음 맘카페 로그인)",
        "login_url": "https://accounts.kakao.com/login",
        "check_url": "https://www.daum.net",
        "signed_out_hint": ["로그인"],
        "signed_in_hint": ["로그아웃"],
        "search_url": "https://search.daum.net/search?w=cafe&q={q}",
    },
    "instagram": {
        "label": "인스타그램",
        "login_url": "https://www.instagram.com/accounts/login/",
        "check_url": "https://www.instagram.com/",
        "signed_out_hint": ["계정에 로그인", "Log in", "비밀번호", "가입하기"],
        "signed_in_hint": ["홈", "검색", "프로필", "스토리"],
        "search_url": "https://www.instagram.com/explore/tags/{q}/",
    },
    "youtube": {
        "label": "유튜브(구글 로그인)",
        "login_url": "https://accounts.google.com/ServiceLogin?service=youtube",
        "check_url": "https://www.youtube.com/",
        "signed_out_hint": ["로그인"],
        "signed_in_hint": ["계정", "내 채널", "보관함"],
        "search_url": "https://www.youtube.com/results?search_query={q}",
    },
    "ohou": {
        "label": "오늘의집",
        "login_url": "https://ohou.se/users/sign_in",
        "check_url": "https://ohou.se/",
        "signed_out_hint": ["로그인", "회원가입"],
        "signed_in_hint": ["마이페이지", "알림", "스크랩", "내 정보"],
        "search_url": "https://ohou.se/search/index?query={q}",
    },
}
# 별칭: 채널 에이전트 소스ID → 로그인 채널
ALIASES = {
    "dagyeolun": "naver",
    "naver-blog": "naver",
    "busan-mom-cafe": "naver",   # 부산맘 다수는 네이버 카페. 다음 카페는 kakao 로그인 추가.
    "momcafe": "naver",
    "blog": "naver",
    "insta": "instagram",
}


def resolve(channel):
    c = channel.lower()
    c = ALIASES.get(c, c)
    if c not in CHANNELS:
        raise SystemExit(
            f"[error] 알 수 없는 채널: {channel}. "
            f"가능: {', '.join(CHANNELS)} (별칭: {', '.join(ALIASES)})"
        )
    return c


def launch(p, headless):
    return p.chromium.launch_persistent_context(
        user_data_dir=str(PROFILE_DIR),
        channel="chrome",
        headless=headless,
        viewport={"width": 1280, "height": 900},
        args=["--disable-blink-features=AutomationControlled"],
    )


def safe_goto(page, url, wait=2000):
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(wait)
        return True
    except Exception as e:
        print(f"[goto] 경고: {url} 이동 예외(무시): {e}")
        page.wait_for_timeout(1000)
        return False


def judge_login(page_text, cfg):
    """휴리스틱: signed_in 힌트가 있고 signed_out 힌트가 약하면 로그인으로 본다."""
    t = page_text or ""
    in_hits = sum(1 for h in cfg.get("signed_in_hint", []) if h in t)
    out_hits = sum(1 for h in cfg.get("signed_out_hint", []) if h in t)
    if in_hits and in_hits >= out_hits:
        return "로그인", in_hits, out_hits
    if out_hits and not in_hits:
        return "게스트", in_hits, out_hits
    return "불명", in_hits, out_hits


def cmd_login(args):
    PROFILE_DIR.mkdir(exist_ok=True)
    targets = list(CHANNELS) if args.channel == "all" else [resolve(args.channel)]
    with sync_playwright() as p:
        ctx = launch(p, headless=False)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        for ch in targets:
            cfg = CHANNELS[ch]
            safe_goto(page, cfg["login_url"])
            print(f"\n[login] === {ch} · {cfg['label']} ===")
            print(f"[login] 크롬 창에서 {args.seconds}초 안에 직접 로그인하세요. (비번은 코드가 만지지 않음)")
            print("[login] 로그인하면 세션이 .browser-profile 에 저장됩니다.")
            for remaining in range(args.seconds, 0, -10):
                print(f"[login] {ch} 남은 시간 {remaining}s ...", flush=True)
                time.sleep(10)
        ctx.close()
    print("\n[login] 완료. `status` 로 로그인 여부를 확인하거나 `open` 으로 검색 진입하세요.")


def cmd_status(args):
    rows = []
    with sync_playwright() as p:
        ctx = launch(p, headless=True)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        for ch, cfg in CHANNELS.items():
            safe_goto(page, cfg["check_url"], wait=2500)
            try:
                text = page.inner_text("body")
            except Exception:
                text = ""
            state, ih, oh = judge_login(text, cfg)
            rows.append((ch, cfg["label"], state, ih, oh))
        ctx.close()
    print("\n채널 로그인 상태 (휴리스틱 점검):")
    print(f"{'채널':<12}{'상태':<8}{'설명'}")
    for ch, label, state, ih, oh in rows:
        print(f"{ch:<12}{state:<8}{label}  (in={ih}/out={oh})")
    print("\n* '불명'은 점검 힌트가 약한 것이라 open 으로 직접 확인 권장. 로그인 안 됐으면 `login --channel <ch>`.")


def cmd_open(args):
    ch = resolve(args.channel)
    cfg = CHANNELS[ch]
    q = quote(args.query)
    url = cfg["search_url"].format(q=q)
    ARTIFACTS.mkdir(exist_ok=True)
    with sync_playwright() as p:
        ctx = launch(p, headless=args.headless)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        safe_goto(page, url, wait=3500)
        try:
            text = page.inner_text("body")
        except Exception:
            text = ""
        state, ih, oh = judge_login(text, cfg)
        print(f"[open] {ch} · 검색 진입: {url}")
        print(f"[open] 로그인 상태(추정): {state} (in={ih}/out={oh})")
        if args.dump:
            links = []
            for a in page.query_selector_all("a"):
                try:
                    t = (a.inner_text() or "").strip()
                    h = a.get_attribute("href") or ""
                except Exception:
                    continue
                if t and h.startswith("http"):
                    links.append({"text": t[:120], "href": h})
            stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            out = ARTIFACTS / f"session-open-{ch}-{stamp}.json"
            out.write_text(json.dumps({
                "channel": ch, "query": args.query, "url": url,
                "login_state": state, "captured_at": stamp,
                "text_excerpt": (text or "")[:2000],
                "links": links[:200],
            }, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"[open] 덤프 저장: {out}  (링크 {len(links)}개)")
        if not args.headless:
            print(f"[open] 창을 {args.seconds}초간 유지합니다. 직접 읽어보세요.")
            time.sleep(args.seconds)
        ctx.close()


def main():
    ap = argparse.ArgumentParser(description="채널 접속 세션 관리기")
    sub = ap.add_subparsers(dest="cmd", required=True)

    pl = sub.add_parser("login", help="채널 로그인 창 띄우고 대기(사용자 직접 로그인)")
    pl.add_argument("--channel", default="naver", help="naver|kakao|instagram|youtube|ohou|all (별칭 허용)")
    pl.add_argument("--seconds", type=int, default=180)
    pl.set_defaults(func=cmd_login)

    ps = sub.add_parser("status", help="채널별 로그인 여부 점검")
    ps.set_defaults(func=cmd_status)

    po = sub.add_parser("open", help="로그인 세션으로 검색결과 진입")
    po.add_argument("--channel", required=True)
    po.add_argument("--query", required=True)
    po.add_argument("--dump", action="store_true", help="보이는 링크·텍스트를 artifacts JSON으로 저장")
    po.add_argument("--headless", action="store_true", help="창 없이 실행(덤프만)")
    po.add_argument("--seconds", type=int, default=120, help="headed 모드에서 창 유지 시간")
    po.set_defaults(func=cmd_open)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
