#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""네이버 블로그 — Playwright 스크래퍼 (검색 API 대체)

네이버 검색 API 는 신규 발급이 중단되어 쓸 수 없다(data/naver-api.md).
그래서 네이버 통합검색 **블로그 탭**을 직접 긁는다 — 로그인 없이 공개다.

  https://search.naver.com/search.naver?ssc=tab.blog.all&query={q}
  + 날짜 지정: &nso=so%3Add%2Cp%3Afrom{YYYYMMDD}to{YYYYMMDD}

수집 범위 = 2026년(CLAUDE.md). 월별 윈도우(2026-01~08)로 잘라 깊게 긁는다 —
날짜 필터 없이 긁으면 관련도순으로 과거 글이 섞이고 상한도 얕다.

사용:
  python scripts/collect_blog.py                      # 전체 (쿼리×월 윈도우)
  python scripts/collect_blog.py --probe "혼수가전 후기"   # 셀렉터 진단 1회
  python scripts/collect_blog.py --scrolls 8          # 윈도우당 스크롤 횟수

재개: 산출 경로 옆 `.done` 파일에 "쿼리|윈도우" 완료 키가 쌓인다.
중단 후 다시 실행하면 완료된 조합은 건너뛴다. URL 로 전역 중복 제거.
"""
import argparse
import hashlib
import io
import json
import os
import re
import sys
from datetime import datetime, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from naver_cafe_scraper import launch, safe_goto  # 브라우저 구동만 재사용
from playwright.sync_api import sync_playwright

# ── 검색어 (collect_history.py 34개 체계를 블로그 문체로 재구성, 36개) ──
# 반드시 가전 낱말·제품명이 들어간다 — "혼수 준비" 같은 넓은 말만 쓰면
# 예식장·드레스 글이 끌려와 걸러내는 데만 힘이 든다(유튜브·인스타 실측).
QUERIES = [
    # 혼수 × 가전 (본류)
    "혼수가전 후기", "혼수가전 구매 후기", "혼수가전 추천", "혼수가전 견적",
    "신혼가전 후기", "신혼가전 내돈내산", "신혼집 가전 후기", "웨딩가전 후기",
    "가전 졸업 후기", "혼수가전 백화점",
    # 브랜드 × 후기 — 블로그 제목이 이 이름으로 달린다
    "삼성스토어 후기", "삼성 혼수가전", "비스포크 후기", "비스포크 혼수",
    "그랑데 후기", "무풍에어컨 후기",
    "LG 베스트샵 후기", "베스트샵 혼수", "LG 혼수가전", "오브제 후기",
    "오브제 혼수", "트롬 후기", "디오스 후기", "워시타워 후기",
    # 품목 × 혼수/신혼 — 품목마다 글쓴이가 다르다
    "혼수 냉장고 후기", "혼수 세탁기 건조기", "신혼 TV 후기", "신혼 에어컨 후기",
    "혼수 김치냉장고", "신혼 식기세척기 후기", "신혼 청소기 후기", "혼수 인덕션",
    "신혼 의류관리기", "스타일러 후기",
    # 유통 × 가전 — 매장 단서가 이 조합에서 나온다
    "백화점 가전 계약 후기", "백화점 혼수가전 견적",
]

# 2026년 월별 윈도우 (수집 범위 = 2026년, CLAUDE.md 2026-08-24)
WINDOWS = [("20260101", "20260131"), ("20260201", "20260228"),
           ("20260301", "20260331"), ("20260401", "20260430"),
           ("20260501", "20260531"), ("20260601", "20260630"),
           ("20260701", "20260731"), ("20260801", "20260826")]

# ── 판정 어휘 (naver_cafe_scraper 와 같은 계열) ──
APPLIANCE = re.compile(
    r"가전|냉장고|세탁기|건조기|에어컨|김치냉장고|스타일러|식기세척기|식세기|"
    r"청소기|TV|티비|공기청정기|정수기|인덕션|전자레인지|워시타워|의류관리기|"
    r"비스포크|오브제|디오스|그랑데|무풍|트롬|에어드레서", re.I)
SAM = re.compile(r"삼성|samsung|비스포크|bespoke|그랑데|무풍|에어드레서|패밀리허브|디지털프라자|디지탈프라자", re.I)
LG = re.compile(r"(?<![A-Za-z])LG(?![A-Za-z])|엘지|오브제|디오스|트롬|tromm|워시타워|워시콤보|"
                r"휘센|스타일러|코드제로|퓨리케어|하이프라자|베스트\s*샵", re.I)
SPONSORED = re.compile(r"체험단|협찬|원고료|소정의\s*수수료|지원\s*받아|제공\s*받아|"
                       r"업체로부터|무상으로\s*제공", re.I)

REL_HOUR = re.compile(r"(\d+)\s*시간\s*전")
REL_MIN = re.compile(r"(\d+)\s*분\s*전")
REL_DAY = re.compile(r"(\d+)\s*일\s*전")
REL_WEEK = re.compile(r"(\d+)\s*주\s*전")
ABS_DATE = re.compile(r"(\d{4})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})")


def parse_date(s, ref=None):
    """'2026.6.14.' / '3일 전' / '어제' → 'YYYY-MM-DD'. 못 읽으면 ''(지어내지 않는다)."""
    if not s:
        return ""
    s = s.strip()
    ref = ref or datetime.now()
    m = ABS_DATE.search(s)
    if m:
        try:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3))).strftime("%Y-%m-%d")
        except ValueError:
            return ""
    if "어제" in s:
        return (ref - timedelta(days=1)).strftime("%Y-%m-%d")
    if REL_MIN.search(s) or REL_HOUR.search(s) or "방금" in s:
        return ref.strftime("%Y-%m-%d")
    m = REL_DAY.search(s)
    if m:
        return (ref - timedelta(days=int(m.group(1)))).strftime("%Y-%m-%d")
    m = REL_WEEK.search(s)
    if m:
        return (ref - timedelta(weeks=int(m.group(1)))).strftime("%Y-%m-%d")
    return ""


# 검색 결과 한 항목씩 (제목·요약·블로거·날짜·URL) 뽑는 JS.
# 2026-08 실측: 블로그 탭이 해시 클래스의 새 UI(sds-comps/fender)로 바뀌어
# 클래스 셀렉터가 무용지물이다. 대신 **글 URL 패턴**(blog.naver.com/{id}/{글번호})으로
# 앵커를 묶고, 조상으로 올라가며 시간 표기를 찾는 구조 무관 방식으로 뽑는다.
EXTRACT_JS = r"""
() => {
  const postRe = /blog\.naver\.com\/([\w.-]+)\/(\d+)/;
  const timeRe = /(\d{4}\s*\.\s*\d{1,2}\s*\.\s*\d{1,2})|(\d+\s*(분|시간|일|주)\s*전)|어제|방금/;
  const clean = (t) => (t || '').replace(/새 창 열림/g, '').trim();
  const groups = new Map();
  for (const a of document.querySelectorAll("a[href*='blog.naver.com']")) {
    const m = (a.href || '').match(postRe);
    if (!m) continue;
    const url = 'https://blog.naver.com/' + m[1] + '/' + m[2];
    let g = groups.get(url);
    if (!g) { g = { url, texts: [], el: a }; groups.set(url, g); }
    const t = clean(a.innerText);
    if (t) g.texts.push(t);
  }
  const out = [];
  for (const g of groups.values()) {
    // 시간 표기를 품는 가장 가까운 조상 = 그 항목의 루트
    let root = g.el, dateText = '';
    for (let i = 0; i < 10 && root; i++) {
      const tm = (root.innerText || '').match(timeRe);
      if (tm) { dateText = tm[0]; break; }
      root = root.parentElement;
    }
    // 블로거명 = 루트 안에서 글번호 없는 프로필 앵커의 텍스트
    let blogger = '';
    if (root) {
      for (const a of root.querySelectorAll("a[href*='blog.naver.com']")) {
        const h = (a.href || '').split('?')[0].replace(/\/$/, '');
        if (!postRe.test(h) && /blog\.naver\.com\/[\w.-]+$/.test(h)) {
          const t = clean(a.innerText);
          if (t) { blogger = t; break; }
        }
      }
    }
    // 짧은 텍스트 = 제목, 긴 텍스트 = 요약. 단 이미지 개수 앵커("3")처럼
    // 숫자뿐이거나 너무 짧은 텍스트는 제목 후보에서 뺀다.
    const texts = g.texts.slice().sort((x, y) => x.length - y.length);
    const cands = texts.filter(t => t.length >= 5 && !/^\d+$/.test(t));
    const title = (cands[0] || texts[0] || '');
    const summary = texts.length > 1 ? texts[texts.length - 1] : '';
    out.push({ url: g.url, title, summary: summary === title ? '' : summary,
               blogger, dateText });
  }
  return out;
}
"""


def search_url(q, win):
    from urllib.parse import quote
    a, b = win
    return ("https://search.naver.com/search.naver?ssc=tab.blog.all&sm=tab_opt"
            f"&query={quote(q)}&nso=so%3Add%2Cp%3Afrom{a}to{b}")


def scrape_window(pg, q, win, scrolls):
    """한 (쿼리, 월 윈도우) 조합을 스크롤하며 항목을 모아 반환."""
    safe_goto(pg, search_url(q, win))
    pg.wait_for_timeout(2200)
    prev, still = 0, 0
    for _ in range(scrolls):
        pg.mouse.wheel(0, 12000)
        pg.wait_for_timeout(1100)
        try:
            n = pg.evaluate("document.querySelectorAll(\"a[href*='blog.naver.com']\").length")
        except Exception:
            n = prev
        if n <= prev:
            still += 1
            if still >= 2:          # 두 번 연속 안 늘면 끝(결과 소진)
                break
        else:
            still = 0
        prev = n
    try:
        return pg.evaluate(EXTRACT_JS)
    except Exception as e:
        print(f"    추출 실패 {type(e).__name__}: {e}", flush=True)
        return []


def build_record(raw, q, win):
    """항목 → 산출 레코드. 가전 무관 글은 None."""
    txt = (raw.get("title") or "") + " " + (raw.get("summary") or "")
    if not APPLIANCE.search(txt):
        return None
    url = raw.get("url") or ""
    date = parse_date(raw.get("dateText", ""))
    # 날짜 필터 윈도우로 요청했으니 파싱된 날짜가 윈도우를 벗어나면 파싱 오류 취급 → 보수적으로 유지
    return {
        "id": hashlib.md5(url.encode("utf-8")).hexdigest()[:12],
        "url": url,
        "title": raw.get("title", ""),
        "summary": (raw.get("summary") or "")[:300],
        "blogger": raw.get("blogger", ""),
        "date": date,
        "samsung": bool(SAM.search(txt)),
        "lg": bool(LG.search(txt)),
        "sponsored": bool(SPONSORED.search(txt)),
        "queries": [q],
        "window": win[0][:6],
    }


def save(dst, by_url):
    rows = sorted(by_url.values(), key=lambda r: (r.get("date") or "", r["id"]))
    body = "[\n" + ",\n".join(
        json.dumps(r, ensure_ascii=False, separators=(",", ":")) for r in rows) + "\n]"
    io.open(dst, "w", encoding="utf-8").write(body)


def cmd_probe(query):
    with sync_playwright() as p:
        ctx = launch(p, True)
        pg = ctx.new_page()
        win = WINDOWS[-1]
        rows = scrape_window(pg, query, win, 3)
        print(f"[probe] {query} {win[0]}~{win[1]} → {len(rows)}항목")
        for r in rows[:5]:
            print(json.dumps(r, ensure_ascii=False)[:220])
        ctx.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--probe", default="", help="셀렉터 진단: 한 쿼리 최신 윈도우만")
    ap.add_argument("--scrolls", type=int, default=8, help="윈도우당 스크롤 횟수")
    ap.add_argument("--out", default="")
    a = ap.parse_args()

    if a.probe:
        cmd_probe(a.probe)
        return

    dst = a.out or os.path.join(ROOT, "artifacts",
                                datetime.now().strftime("%Y%m%d") + "-channel-blog.json")
    donep = dst + ".done"
    done = set()
    if os.path.exists(donep):
        done = set(io.open(donep, encoding="utf-8").read().split("\n"))
    by_url = {}
    if os.path.exists(dst):                       # 재개: 기존 산출 로드
        try:
            for r in json.load(io.open(dst, encoding="utf-8")):
                by_url[r["url"]] = r
        except Exception:
            pass
    print(f"기존 {len(by_url)}건 / 완료 조합 {len([d for d in done if d])}개", flush=True)

    raw_total = 0
    with sync_playwright() as p:
        ctx = launch(p, True)
        pg = ctx.new_page()
        for q in QUERIES:
            for win in WINDOWS:
                key = f"{q}|{win[0]}"
                if key in done:
                    continue
                try:
                    rows = scrape_window(pg, q, win, a.scrolls)
                except Exception as e:
                    print(f"  [{q} {win[0][:6]}] 실패 {type(e).__name__}", flush=True)
                    continue
                raw_total += len(rows)
                kept = 0
                for raw in rows:
                    rec = build_record(raw, q, win)
                    if not rec:
                        continue
                    ex = by_url.get(rec["url"])
                    if ex:
                        if q not in ex.get("queries", []):
                            ex.setdefault("queries", []).append(q)
                    else:
                        by_url[rec["url"]] = rec
                        kept += 1
                done.add(key)
                save(dst, by_url)                 # 중간마다 저장
                io.open(donep, "w", encoding="utf-8").write("\n".join(sorted(d for d in done if d)))
                print(f"  [{q} {win[0][:6]}] 긁음 {len(rows)} / 신규 {kept} / 누적 {len(by_url)}", flush=True)
        ctx.close()

    save(dst, by_url)
    rows = list(by_url.values())
    s = sum(1 for r in rows if r["samsung"] and not r["lg"])
    l = sum(1 for r in rows if r["lg"] and not r["samsung"])
    b = sum(1 for r in rows if r["samsung"] and r["lg"])
    sp = sum(1 for r in rows if r["sponsored"])
    mon = {}
    for r in rows:
        mon[(r.get("date") or "미상")[:7] or "미상"] = mon.get((r.get("date") or "미상")[:7], 0) + 1
    print(f"\n이번 실행 긁은 항목 {raw_total:,} / 저장 총 {len(rows):,}건")
    print(f"삼성단독 {s} / LG단독 {l} / 양브랜드 {b} / 협찬표시 {sp}")
    for k in sorted(mon):
        print(f"  {k}: {mon[k]}")
    print(f"→ {dst}")


if __name__ == "__main__":
    main()
