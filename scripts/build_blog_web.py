#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""네이버 블로그 채널 → web/assets/blog.js (window.NBLOG)

채널 축(블로그 전체)과 매장 축(매장 언급)을 함께 내보낸다 —
"채널별 현황과 매장별 현황은 같은 데이터다"(.claude/CLAUDE.md).

체험단·협찬 글은 지우지 않고 표시만 한다(광고 원칙과 동일) —
블로그는 체험단 비중이 높아, 섞어 세면 고객 목소리가 아니라
마케팅 물량을 재게 된다. 화면에서 갈라 본다.
"""
import io
import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from build_web_data import dept_store_of, region_of, ITEMS, ITEM_KEYS, STORE_EXCLUDE


def load():
    fs = [f for f in os.listdir(os.path.join(ROOT, "artifacts"))
          if re.match(r"\d{8}-channel-blog\.json$", f)]
    if not fs:
        raise SystemExit("블로그 수집 파일이 없습니다 — collect_blog.py 먼저")
    f = os.path.join(ROOT, "artifacts", sorted(fs)[-1])
    rows = json.load(io.open(f, encoding="utf-8"))
    print(f"로드: {os.path.basename(f)} · {len(rows):,}건")
    return rows


def main():
    rows = load()
    # 날짜가 없거나 유효 범위(2020~2026) 밖인 글은 빌드에서 제외한다 —
    # 부제(total)와 기간 합산(mon)이 1건 어긋나는 원인이었다(steward 검수 적발).
    # 이 화면의 모든 축이 날짜 기반이라, 날짜를 못 읽은 글은 세지 않는 것이 정직하다.
    before = len(rows)
    rows = [x for x in rows
            if x.get("date") and "2020-01" <= x["date"][:7] <= "2026-12"]
    if before - len(rows):
        print(f"날짜 무효 {before - len(rows)}건 제외 (부제·기간 합산 일치)")

    def side(x):
        s, l = bool(x.get("samsung")), bool(x.get("lg"))
        if s and not l:
            return "s"
        if l and not s:
            return "l"
        return ""

    """16,000건이 넘는 전량을 posts 로 실으면 4.4MB 가 된다(실측) — 첫 화면마다
    내려받기엔 과하다. 그래서 **월별 사전집계**(건수·브랜드·품목·매장)를 싣고,
    글 목록은 화면에 실제로 오르는 만큼(월별 내돈내산 30 · 협찬 15)만 담는다.
    수치는 전량 집계라 정확하고, 목록만 표본이다(화면에 그렇게 밝힌다)."""
    # 상대날짜 오파싱 등으로 1995-07 같은 이상 월이 1건씩 낀다(실측) —
    # 기간 탭·표기가 그 한 건에 끌려가므로 유효 범위(2020~)만 남긴다
    months = sorted({(x.get("date") or "")[:7] for x in rows
                     if x.get("date") and "2020-01" <= x.get("date")[:7] <= "2026-12"})
    mon = defaultdict(lambda: {"n": 0, "s": 0, "l": 0, "sp": 0, "os": 0, "ol": 0})
    mon_items = defaultdict(lambda: defaultdict(lambda: {"n": 0, "s": 0, "l": 0, "sp": 0}))
    mon_stores = defaultdict(lambda: defaultdict(lambda: {"n": 0, "s": 0, "l": 0, "sp": 0}))
    items = defaultdict(lambda: {"n": 0, "s": 0, "l": 0, "sp": 0})
    stores = {}
    by_ym = defaultdict(list)
    n_sp = 0
    for x in rows:
        txt = (x.get("title") or "") + " " + (x.get("summary") or "")
        b = side(x)
        sp = bool(x.get("sponsored"))
        if sp:
            n_sp += 1
        ym = (x.get("date") or "")[:7]
        if ym:
            m = mon[ym]
            m["n"] += 1
            if b:
                m[b] += 1
                if not sp:
                    m["o" + b] += 1
            if sp:
                m["sp"] += 1
        it = next((k for k in ITEM_KEYS if any(w in txt for w in ITEMS[k])), "")
        if it:
            for tgt in (items[it], mon_items[ym][it] if ym else None):
                if tgt is None:
                    continue
                tgt["n"] += 1
                if b:
                    tgt[b] += 1
                if sp:
                    tgt["sp"] += 1
        st = dept_store_of(txt)
        if st and st not in STORE_EXCLUDE:
            v = stores.setdefault(st, {"n": 0, "s": 0, "l": 0, "sp": 0, "top": None})
            v["n"] += 1
            if b:
                v[b] += 1
            if sp:
                v["sp"] += 1
            if not v["top"]:
                v["top"] = {"t": (x.get("title") or "")[:60], "url": x.get("url")}
            if ym:
                mv = mon_stores[ym][st]
                mv["n"] += 1
                if b:
                    mv[b] += 1
                if sp:
                    mv["sp"] += 1
        if ym:
            by_ym[ym].append({
                "id": x.get("id"), "t": (x.get("title") or "")[:56],
                "bg": (x.get("blogger") or "")[:14],
                "d": (x.get("date") or "")[:10], "ym": ym,
                "u": x.get("url"), "b": b, "sp": 1 if sp else 0,
            })
    posts = []
    for ym, lst in by_ym.items():
        lst.sort(key=lambda r: r["d"], reverse=True)
        posts += [r for r in lst if not r["sp"]][:30]
        posts += [r for r in lst if r["sp"]][:15]

    s_tot = sum(1 for x in rows if side(x) == "s")
    l_tot = sum(1 for x in rows if side(x) == "l")
    data = {
        "built": datetime.now().strftime("%Y-%m-%d"),
        "note": "네이버 블로그 검색에서 혼수·가전 검색어로 걸러낸 글만 셉니다(블로그 전체가 아닙니다). "
                "체험단·협찬 표기는 지우지 않고 갈라 셉니다 — 고객 목소리와 마케팅 물량은 다른 이야기입니다.",
        "total": len(rows), "s": s_tot, "l": l_tot, "sp": n_sp,
        "months": months,
        "mon": {k: dict(v) for k, v in mon.items()},
        "monItems": {k: {i: dict(vv) for i, vv in v.items()} for k, v in mon_items.items()},
        "monStores": {k: {s2: dict(vv) for s2, vv in v.items()} for k, v in mon_stores.items()},
        "items": {k: dict(v) for k, v in items.items()},
        "stores": stores,
        "posts": posts,
    }
    out = os.path.join(ROOT, "web", "assets", "blog.js")
    io.open(out, "w", encoding="utf-8").write(
        "/* build_blog_web.py 자동생성 — 수정 금지 */\n"
        "window.NBLOG = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(f"글 {len(rows):,}건 · 삼성 {s_tot:,} / LG {l_tot:,} · 협찬표기 {n_sp:,}")
    print(f"매장 언급 {len(stores)}곳 · 품목 {len(items)}종 · 월 {len(months)}개")
    print(f"→ {out} ({os.path.getsize(out)//1024}KB)")


if __name__ == "__main__":
    main()
