#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""제휴카페 분석 → web/assets/affiliate-insight.js

화면 요구(사용자 지시):
  - **가전 전반**과 **당사(삼성)**를 나눠 보여준다. 울산처럼 "가전 글은 많은데
    당사는 없다"가 한눈에 드러나야 한다.
  - **월 단위로 확인**할 수 있어야 하고, 첫 진입은 **현재 월**이다.

그래서 미리 합산한 값이 아니라 **글 1건 = 1행**으로 내보낸다.
화면이 고른 달만 잘라 그때그때 집계한다(임의 월·전체 기간 모두 같은 코드로 처리).

사용: python scripts/build_affiliate_web.py
"""
import io
import json
import os
import re
import sys
from collections import Counter
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

# 분류 규칙은 affiliate_insight 한 곳에서만 정의한다(중복 정의 금지)
from affiliate_insight import (        # noqa: E402
    load_cafes, strip, EXTRA_RET,
    CHAT, USED, SERVICE, PROMO, SUBSCRIBE, ONLINE, BUY, REPLACE, OURS as OURS_RE,
)
from build_web_data import ITEMS, RET_RE   # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

SRC_DIR = os.path.join(ROOT, "artifacts", "affiliate")
OUT = os.path.join(ROOT, "web", "assets", "affiliate-insight.js")

RETS = ["삼성스토어", "LG베스트샵", "하이마트", "전자랜드", "이마트·홈플러스", "백화점"]
OURS = "삼성스토어"
RET_ALL = dict(list(RET_RE.items()) + list(EXTRA_RET.items()))

# 축 코드 — 화면과 순서를 맞춰 쓴다(바꾸면 affiliate-view.js도 같이 고쳐야 함)
AXIS = ["교체이사", "경쟁노출", "구매상담", "중고", "구독렌탈", "사후서비스", "온라인", "잡담", "미분류"]
IT_KEYS = list(ITEMS)


def axis_of(txt):
    """affiliate_insight.analyze 와 같은 우선순위로 축을 정한다."""
    if PROMO.search(txt):
        return 1
    if USED.search(txt):
        return 3
    if SERVICE.search(txt):
        return 5
    if SUBSCRIBE.search(txt):
        return 4
    if ONLINE.search(txt):
        return 6
    if BUY.search(txt):
        return 2
    if REPLACE.search(txt):
        return 0
    if CHAT.search(txt):
        return 7
    return 8


def main():
    meta = load_cafes()
    files = sorted(f for f in os.listdir(SRC_DIR) if f.endswith(".json"))
    if not files:
        raise SystemExit("수집 파일 없음 — artifacts/affiliate/*.json")

    cafes, all_months = {}, set()
    total_rows = 0

    for f in files:
        slug = f[:-5]
        recs = json.load(open(os.path.join(SRC_DIR, f), encoding="utf-8"))
        if isinstance(recs, dict):
            recs = recs.get("items") or list(recs.values())[0]
        m = meta.get(slug, {"name": slug, "mem": 0, "rg": "", "type": "", "url": "", "clubId": ""})

        rows = []
        for r in recs:
            t = strip(r.get("title"))
            txt = f"{t} {strip(r.get('summary'))}"
            ym = (r.get("addDate") or "")[:7]
            if not ym:
                continue
            all_months.add(ym)
            ax = axis_of(txt)
            rm = 0
            for i, k in enumerate(RETS):
                if RET_ALL[k].search(txt):
                    rm |= 1 << i
            im = 0
            for i, k in enumerate(IT_KEYS):
                if any(w in txt for w in ITEMS[k]):
                    im |= 1 << i
            fl = 1 if (ax == 1 and OURS_RE.search(txt)) else 0   # 우리가 올린 홍보글
            rows.append([ym, ax, rm, im, fl, t[:80], r.get("articleId") or 0])

        rows.sort(key=lambda x: x[0], reverse=True)
        total_rows += len(rows)
        cafes[slug] = {
            "slug": slug, "name": m["name"], "url": m.get("url", ""),
            "type": m.get("type", ""), "rg": m.get("rg", ""), "mem": m.get("mem", 0),
            "club": str(m.get("clubId") or ""),
            "rows": rows,
        }

    months = sorted(all_months, reverse=True)
    data = {
        "built": datetime.now().strftime("%Y-%m-%d"),
        "now": datetime.now().strftime("%Y-%m"),
        "rets": RETS, "ours": OURS, "axis": AXIS, "items": IT_KEYS,
        "months": months,
        "cafes": cafes,
    }

    with io.open(OUT, "w", encoding="utf-8") as f:
        f.write("/* build_affiliate_web.py 자동생성 — 수정 금지 */\n")
        f.write("window.AFFILIATE_INSIGHT = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")

    cur = data["now"]
    cur_n = sum(1 for c in cafes.values() for r in c["rows"] if r[0] == cur)
    print(f"카페 {len(cafes)}곳 · 글 {total_rows:,}행 · 월 {len(months)}개 ({months[-1]}~{months[0]})")
    print(f"현재 월({cur}) 표본 {cur_n:,}건")
    print(f"→ {OUT}  ({os.path.getsize(OUT)//1024}KB)")


if __name__ == "__main__":
    main()
