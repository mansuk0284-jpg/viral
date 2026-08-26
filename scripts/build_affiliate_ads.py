#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""제휴카페 — **글 주체(광고 vs 고객)** 축 → web/assets/affiliate-ads.js (window.AFFAD)

기존 `build_affiliate_web.py`(축 8개·카페 1곳 화면)와 목적이 다르다.
이쪽은 "이 게시판에서 **누가 말하고 있는가**"를 센다:
  ① 당사 광고·홍보  ② 경쟁사 광고·홍보  ③ 고객 글(유통 언급)  ④ 고객 글(일반)

기간 탭이 모든 수치를 바꿔야 하므로 **월별 사전집계**로 내보낸다
(blog 빌드의 mon/monXxx 패턴과 같다).

사용: python scripts/build_affiliate_ads.py
"""
import io
import json
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

from affil_author import (classify, subject_of, load_rows, T,      # noqa: E402
                          CLASSES, CLASS_LABEL, OURS, COMPETITORS)
from affiliate_insight import load_cafes                            # noqa: E402
from build_web_data import ITEMS, ITEM_KEYS                         # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

OUT = os.path.join(ROOT, "web", "assets", "affiliate-ads.js")
RET_ALL = [OURS] + COMPETITORS


def blank():
    d = {k: 0 for k in CLASSES}
    d["n"] = 0
    return d


def main():
    rows = load_rows()
    meta = load_cafes()

    months = set()
    mon = defaultdict(blank)
    mon_ret = defaultdict(lambda: defaultdict(lambda: {"ad": 0, "cust": 0}))
    mon_item = defaultdict(lambda: defaultdict(lambda: {"n": 0, "ad": 0, "cust": 0}))
    mon_cafe = defaultdict(lambda: defaultdict(blank))
    mon_posts = defaultdict(lambda: defaultdict(list))
    rules = Counter()
    cafe_meta, cafe_tot = {}, defaultdict(blank)

    for r in rows:
        ym = (r.get("addDate") or "")[:7]
        if not ym:
            continue
        months.add(ym)
        t = T(r)
        c = classify(t)
        cls, subj = c["cls"], c["subj"]
        rules[(c["rule"], cls)] += 1
        slug = r["_slug"]

        for tgt in (mon[ym], mon_cafe[ym][slug], cafe_tot[slug]):
            tgt[cls] += 1
            tgt["n"] += 1

        if subj:
            side = "ad" if cls in ("ad_own", "ad_comp") else "cust"
            mon_ret[ym][subj][side] += 1

        it = next((k for k in ITEM_KEYS if any(w in t for w in ITEMS[k])), "")
        if it:
            v = mon_item[ym][it]
            v["n"] += 1
            v["ad" if cls in ("ad_own", "ad_comp") else "cust"] += 1

        if slug not in cafe_meta:
            m = meta.get(slug, {})
            cafe_meta[slug] = {"name": m.get("name", slug), "mem": m.get("mem", 0),
                               "rg": m.get("r3") or m.get("r2") or m.get("rg", ""),
                               "type": m.get("t") or m.get("type", ""),
                               "url": m.get("url", "")}
        # 화면에 실제로 오르는 만큼만 담는다(월×분류 6건) — 전량을 실으면 파일만 커진다
        lst = mon_posts[ym][cls]
        if len(lst) < 6:
            lst.append({"t": t[:64], "s": subj or "", "u": r.get("url", ""),
                        "d": (r.get("addDate") or "")[:10], "c": slug})

    months = sorted(months)
    data = {
        "built": datetime.now().strftime("%Y-%m-%d"),
        "total": sum(v["n"] for v in mon.values()),
        "cafes": len(cafe_meta),
        "months": months,
        "classes": CLASSES,
        "label": CLASS_LABEL,
        "rets": RET_ALL,
        "ours": OURS,
        "mon": {k: dict(v) for k, v in mon.items()},
        "monRet": {k: {r: dict(vv) for r, vv in v.items()} for k, v in mon_ret.items()},
        "monItems": {k: {i: dict(vv) for i, vv in v.items()} for k, v in mon_item.items()},
        "monCafe": {k: {s: dict(vv) for s, vv in v.items()} for k, v in mon_cafe.items()},
        "monPosts": {k: {c2: v2 for c2, v2 in v.items()} for k, v in mon_posts.items()},
        "cafeMeta": cafe_meta,
        "cafeTot": {k: dict(v) for k, v in cafe_tot.items()},
        "rules": [{"r": k[0], "c": k[1], "n": n} for (k, n) in
                  sorted(rules.items(), key=lambda x: -x[1])],
        "note": "제휴카페 14곳(부울경)에서 가전 검색어로 걸러낸 글만 셉니다 — 게시판 전체가 아닙니다. "
                "글의 주체(광고·홍보 / 고객)는 수집 레코드에 작성자·본문이 없어 "
                "제목 문면으로 판정한 추정치입니다.",
    }

    io.open(OUT, "w", encoding="utf-8").write(
        "/* build_affiliate_ads.py 자동생성 — 수정 금지 */\n"
        "window.AFFAD = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")

    tot = Counter()
    for v in mon.values():
        for k in CLASSES:
            tot[k] += v[k]
    print(f"글 {data['total']:,}건 · 카페 {len(cafe_meta)}곳 · 월 {len(months)}개 ({months[0]}~{months[-1]})")
    for k in CLASSES:
        print(f"  {CLASS_LABEL[k]:18s} {tot[k]:>6,}")
    print("--- 규칙별 실측")
    for x in data["rules"]:
        print(f"  {x['r']:16s} {CLASS_LABEL[x['c']]:18s} {x['n']:>6,}")
    print(f"→ {OUT} ({os.path.getsize(OUT)//1024}KB)")


if __name__ == "__main__":
    main()
