#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""오늘의집(ohou.se) 혼수가전 수집 — 실프로필·헤디드 브라우저 정본 경로.

**왜 헤디드인가**(2026-08-26 실측):
  헤드리스로는 전 경로가 403 Access Denied 다(봇 지문 차단).
  실사용자 프로필 + 실제 창으로 열면 **로그인 없이도** 정상 렌더된다.
  그래서 유튜브·인스타와 같은 방식(naver_cafe_scraper.launch)을 쓴다.
  8/24 기록의 "로그인해도 전 경로 차단"은 사이트 정책이 아니라 헤드리스 차단이었다.

수집 경로(실측 확인):
  통합검색  https://ohou.se/search/index?query={q}
    · 탭: 통합 / 쇼핑 / 이미지 / 콘텐츠
    · 링크: /contents/{id}(콘텐츠) · /projects/{id}(집들이)
  스크롤로 추가 로드되는 SPA 라 스크롤 횟수만큼 더 가져온다.

성격: 집들이·콘텐츠는 **매장 단서가 약하다**. 모델·색상(비스포크/오브제) 같은
트렌드 신호 채널로 쓴다 — 매장 비교를 무리하게 만들지 않는다.

예의: 낮은 속도(기본 1.2초 간격)로 공개 화면에 렌더된 것만 읽는다.

사용:
    python scripts/collect_ohou.py --scrolls 6
    python scripts/collect_ohou.py --probe "혼수가전"     # 셀렉터 진단
"""
import argparse
import io
import json
import os
import re
import sys
import time
from datetime import datetime
from urllib.parse import quote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from naver_cafe_scraper import launch, safe_goto
from playwright.sync_api import sync_playwright

# 가전 낱말이 든 검색어만 쓴다 — "혼수" 같은 넓은 말만 쓰면 가구·소품이 끌려온다
# (유튜브·인스타에서 배운 것: 검색어 수가 곧 표본 크기, 단 가전 낱말은 필수)
QUERIES = [
    # 혼수 × 가전
    "혼수가전", "신혼가전", "혼수가전 후기", "신혼가전 추천", "가전 졸업",
    # 품목
    "냉장고 후기", "세탁기 건조기", "김치냉장고", "식기세척기", "인덕션",
    "의류관리기", "로봇청소기", "에어컨 추천", "TV 거실", "정수기",
    # 제품명(모델·색상 트렌드가 이 이름으로 올라온다 — 이 채널의 강점)
    "비스포크", "비스포크 냉장고", "오브제컬렉션", "무풍에어컨",
    "워시타워", "그랑데", "에어드레서", "스타일러", "트롬", "디오스",
    # 공간 맥락(가전 낱말과 함께)
    "주방가전 인테리어", "거실 TV 배치", "신혼집 가전 배치",
]

APPLIANCE = re.compile(
    "가전|냉장고|세탁기|건조기|에어컨|TV|티비|청소기|김치냉장고|인덕션|식기세척기|"
    "정수기|의류관리기|스타일러|에어드레서|비스포크|오브제|무풍|워시타워|그랑데|"
    "트롬|디오스|올레드|QLED|광파오븐|전기레인지")
SAMSUNG = re.compile("삼성|비스포크|무풍|그랑데|에어드레서|패밀리허브|삼성전자|SAMSUNG", re.I)
LG = re.compile("LG|엘지|오브제|트롬|디오스|스타일러|워시타워|코드제로|퓨리케어|올레드", re.I)
AD = re.compile("협찬|광고|체험단|원고료|제공받아|수수료")


def norm(s):
    return re.sub(r"\s+", " ", (s or "")).strip()


def collect(pg, q, scrolls, delay):
    """검색 한 건 — 통합검색에서 콘텐츠·집들이 카드를 긁는다.

    실측(2026-08-26): 콘텐츠 URL 은 `contents.ohou.se/contents/card_collections/{id}`,
    집들이는 `/projects/{id}` 다. 전용 피드(cards/feed·projects/feed)는 검색어를
    안 먹어 비었고, **통합검색이 가장 실하다**(검색어당 콘텐츠 8·집들이 6).
    """
    url = "https://ohou.se/search/index?query=" + quote(q)
    safe_goto(pg, url)
    time.sleep(2.4)
    for _ in range(scrolls):
        pg.mouse.wheel(0, 2600)
        time.sleep(delay)
    return pg.evaluate("""() => {
      const out = [];
      const seen = {};
      document.querySelectorAll('a[href]').forEach((a) => {
        const h = a.href || '';
        let kind = '', id = '';
        const c = h.indexOf('card_collections/');
        const p2 = h.indexOf('/projects/');
        if (c >= 0) { kind = 'contents'; id = h.slice(c + 17).split(/[^0-9]/)[0]; }
        else if (p2 >= 0) { kind = 'projects'; id = h.slice(p2 + 10).split(/[^0-9]/)[0]; }
        if (!id || seen[kind + id]) return;
        seen[kind + id] = 1;
        /* 카드 텍스트는 **링크 자신**에서 읽는다 — closest('div') 로 올라가면
           검색 결과 전체를 감싼 컨테이너에 닿아 모든 항목이 같은 문구가 된다
           (실측 2026-08-26: 8건 전부 첫 카드 내용으로 복사됐다).
           링크가 비면 한 단계만 올라가되 길이가 튀면(>400자) 버린다. */
        let t = (a.innerText || '').trim().split(String.fromCharCode(10)).join(' ');
        if (t.length < 8) {
          const up = a.parentElement;
          const ut = up ? (up.innerText || '').trim().split(String.fromCharCode(10)).join(' ') : '';
          if (ut && ut.length <= 400) t = ut;
        }
        if (t.length > 400) return;
        const img = a.querySelector ? a.querySelector('img') : null;
        out.push({ kind: kind, id: id, url: h.split('?')[0], text: t.slice(0, 300),
                   thumb: img ? (img.getAttribute('src') || '') : '' });
      });
      return out;
    }""")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scrolls", type=int, default=6, help="검색어당 스크롤 횟수")
    ap.add_argument("--delay", type=float, default=1.2)
    ap.add_argument("--probe", help="셀렉터 진단: 이 검색어 하나만 돌려 결과를 찍는다")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()

    dst = a.out or os.path.join(
        ROOT, "artifacts", datetime.now().strftime("%Y%m%d") + "-channel-ohou.json")
    donep = dst + ".done"
    done = set()
    if os.path.exists(donep):
        done = set(io.open(donep, encoding="utf-8").read().split("\n")) - {""}
    seen = {}
    if os.path.exists(dst):
        for r in json.load(io.open(dst, encoding="utf-8")):
            seen[r["id"]] = r

    qs = [a.probe] if a.probe else [q for q in QUERIES if q not in done]
    print(f"검색어 {len(qs)}개 · 기존 {len(seen)}건")
    if not qs:
        print("남은 검색어가 없습니다(.done 을 지우면 다시 훑습니다).")
        return

    with sync_playwright() as p:
        ctx = launch(p, headless=False)      # 헤드리스는 403 — 실제 창이어야 열린다
        pg = ctx.pages[0] if ctx.pages else ctx.new_page()
        try:
            for i, q in enumerate(qs, 1):
                try:
                    rows = collect(pg, q, a.scrolls, a.delay)
                except Exception as e:
                    print(f"  [{q}] 실패: {str(e)[:70]}")
                    continue
                new = 0
                for r in rows:
                    txt = norm(r["text"])
                    if not APPLIANCE.search(txt):
                        continue              # 가전 낱말이 없으면 이 하네스의 대상이 아니다
                    if r["id"] in seen:
                        seen[r["id"]].setdefault("queries", [])
                        if q not in seen[r["id"]]["queries"]:
                            seen[r["id"]]["queries"].append(q)
                        continue
                    seen[r["id"]] = {
                        "id": r["id"], "kind": r["kind"], "url": r["url"],
                        "text": txt[:260], "thumb": r["thumb"][:200],
                        "samsung": bool(SAMSUNG.search(txt)), "lg": bool(LG.search(txt)),
                        "ad": bool(AD.search(txt)), "queries": [q],
                    }
                    new += 1
                if a.probe:
                    print(f"[진단] 카드 {len(rows)} · 가전 필터 통과 {new}")
                    for r in list(seen.values())[:5]:
                        print("  ·", r["kind"], r["id"], r["text"][:60])
                    return
                io.open(dst, "w", encoding="utf-8").write(
                    json.dumps(list(seen.values()), ensure_ascii=False))
                io.open(donep, "a", encoding="utf-8").write(q + "\n")
                print(f"  {i}/{len(qs)} [{q}] 카드 {len(rows)} · 신규 {new} · 누적 {len(seen)}")
        finally:
            ctx.close()

    rows = list(seen.values())
    print(f"\n총 {len(rows):,}건 · 집들이 {sum(1 for r in rows if r['kind']=='projects'):,} · "
          f"콘텐츠 {sum(1 for r in rows if r['kind']=='contents'):,}")
    print(f"삼성 {sum(1 for r in rows if r['samsung'] and not r['lg']):,} · "
          f"LG {sum(1 for r in rows if r['lg'] and not r['samsung']):,} · "
          f"광고표기 {sum(1 for r in rows if r['ad']):,}")
    print(f"→ {dst}")


if __name__ == "__main__":
    main()
