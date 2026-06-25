# -*- coding: utf-8 -*-
"""카페 탐색 프로브 — vanity(주소) → clubId 해석 + 게시판(메뉴) 목록 출력.
   네이버 카페 범용 수집의 1단계: 대상 카페의 clubId와 '가전/후기' board menuId를 찾는다.
   공개 페이지 읽기. 로그인·비밀번호 없음.
   사용: python probe_cafe.py imsanbu  (여러 개 가능: python probe_cafe.py imsanbu vanity2 ...)
"""
import sys, json, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from naver_cafe_scraper import launch, safe_goto, _walk_menus, API_HEADERS
from playwright.sync_api import sync_playwright

MENUS_API = "https://apis.naver.com/cafe-web/cafe-cafemain-api/v1.0/cafes/{cid}/menus"
HINT = re.compile(r"가전|후기|혼수|리뷰|review|디지털|신혼", re.I)


def _is_ascii(s):
    try:
        s.encode("ascii"); return True
    except Exception:
        return False


def search_clubid(page, keyword):
    """카페 디렉터리 검색으로 이름→clubId 해석(한글 카페명용). 상위 후보 몇 개를 출력."""
    from urllib.parse import quote
    cands = [
        f"https://apis.naver.com/cafe-web/cafe-search-api/v3.0/cafes?query={quote(keyword)}&page=1&perPage=10",
        f"https://section.cafe.naver.com/ca-fe/home/search/cafes?query={quote(keyword)}&page=1&perPage=10",
    ]
    for url in cands:
        try:
            r = page.request.get(url, headers={
                "Referer": "https://section.cafe.naver.com/",
                "Accept": "application/json",
                "User-Agent": API_HEADERS["User-Agent"],
            })
            if r.status != 200:
                continue
            data = json.loads(r.text())
        except Exception:
            continue
        cafes = []
        _collect_cafes(data, cafes)
        if cafes:
            print(f"  '{keyword}' 검색 후보:")
            for cid, name, members in cafes[:6]:
                print(f"    clubId={cid:>10}  {name}  (회원 {members})")
            return cafes[0][0]
    return None


def _collect_cafes(obj, out):
    if isinstance(obj, dict):
        cid = obj.get("cafeId") or obj.get("clubId") or obj.get("cafeUrl")
        name = obj.get("cafeName") or obj.get("name")
        members = obj.get("memberCount") or obj.get("member") or "-"
        if cid and name and str(cid).isdigit():
            out.append((str(cid), str(name), str(members)))
        for v in obj.values():
            _collect_cafes(v, out)
    elif isinstance(obj, list):
        for v in obj:
            _collect_cafes(v, out)


def resolve_clubid(page, token):
    """숫자=clubId, ASCII=vanity, 한글=이름검색으로 해석."""
    if token.isdigit():
        return token
    if not _is_ascii(token):
        cid = search_clubid(page, token)
        if cid:
            return cid
    for url in (f"https://cafe.naver.com/{token}",
                f"https://cafe.naver.com/f-e/cafes/{token}"):
        safe_goto(page, url)
        page.wait_for_timeout(2500)
        m = re.search(r"/cafes/(\d+)", page.url)
        if m:
            return m.group(1)
        try:
            html = page.content()
        except Exception:
            html = ""
        m = re.search(r'"cafeId"\s*:\s*"?(\d{6,})"?', html) or re.search(r"/cafes/(\d+)", html)
        if m:
            return m.group(1)
    return None


def fetch_json(page, url, clubid):
    try:
        r = page.request.get(url, headers={
            "Referer": f"https://cafe.naver.com/f-e/cafes/{clubid}",
            "Accept": "application/json",
            "User-Agent": API_HEADERS["User-Agent"],
        })
        if r.status != 200:
            return None
        return json.loads(r.text())
    except Exception:
        return None


def probe_one(page, token):
    print(f"\n===== '{token}' =====")
    cid = resolve_clubid(page, token)
    if not cid:
        print("  clubId 해석 실패 — vanity 주소를 다시 확인하세요.")
        return
    print(f"  clubId = {cid}")
    safe_goto(page, f"https://cafe.naver.com/f-e/cafes/{cid}/menus/0")
    page.wait_for_timeout(1500)
    data = fetch_json(page, MENUS_API.format(cid=cid), cid)
    if not data:
        print("  메뉴 API 응답 없음(권한/주소 이슈) — 로그인 세션이 필요할 수 있음.")
        return
    out = []
    _walk_menus(data, out)
    seen = set(); boards = []
    for mid, name, btype in out:
        if mid in seen:
            continue
        seen.add(mid); boards.append((mid, name, btype))
    print(f"  게시판 {len(boards)}개:")
    for mid, name, btype in boards:
        star = "  ★가전후기 후보" if HINT.search(name) else ""
        print(f"    menuId={mid:>6}  {name}  [{btype}]{star}")


def main():
    tokens = sys.argv[1:]
    if not tokens:
        print("사용: python probe_cafe.py <vanity|clubid> [...]"); return
    with sync_playwright() as p:
        ctx = launch(p, headless=True)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        for t in tokens:
            try:
                probe_one(page, t)
            except Exception as e:
                print(f"  [{t}] 오류: {e}")
        ctx.close()


if __name__ == "__main__":
    main()
