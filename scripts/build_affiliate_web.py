#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""제휴카페 분석 → web/assets/affiliate-insight.js

화면 요구(사용자 지시): **가전 전반**과 **당사(삼성)**를 나눠 보여준다.
울산처럼 "가전 글은 많은데 당사는 없다"가 한눈에 드러나야 한다.

  가전 전반  이 카페에서 가전이 얼마나·어떻게 이야기되나 (수요·품목·유통 경쟁)
  당사       그중 삼성이 차지한 몫 (노출·언급·우리 활동 글)

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

from affiliate_insight import (        # noqa: E402  — 분류 규칙은 한 곳에서만 정의
    analyze, load_cafes, strip, EXTRA_RET,
)
from build_web_data import RET_RE      # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

SRC_DIR = os.path.join(ROOT, "artifacts", "affiliate")
OUT = os.path.join(ROOT, "web", "assets", "affiliate-insight.js")

RETS = ["삼성스토어", "LG베스트샵", "하이마트", "전자랜드", "이마트·홈플러스", "백화점"]
OURS = "삼성스토어"


def main():
    meta = load_cafes()
    files = sorted(f for f in os.listdir(SRC_DIR) if f.endswith(".json"))
    if not files:
        raise SystemExit("수집 파일 없음 — artifacts/affiliate/*.json")

    cafes = {}
    for f in files:
        slug = f[:-5]
        rows = json.load(open(os.path.join(SRC_DIR, f), encoding="utf-8"))
        if isinstance(rows, dict):
            rows = rows.get("items") or list(rows.values())[0]
        o = analyze(rows)
        m = meta.get(slug, {"name": slug, "mem": 0, "rg": "", "type": ""})

        ax = o["axis"]
        # 가전 '이야기'로 볼 수 있는 글 = 생활잡담·미분류 제외
        talk = sum(ax.get(k, 0) for k in
                   ["①교체·이사", "②경쟁노출", "③구매상담", "⑤중고", "⑥구독·렌탈", "⑦사후서비스", "⑧온라인"])
        demand = ax.get("③구매상담", 0) + ax.get("①교체·이사", 0) + ax.get("⑥구독·렌탈", 0)
        ours_promo = o["promo_by_ret"].get(OURS, 0)
        ours_ment = o["ret"].get(OURS, 0)
        comp_promo = sum(o["promo_by_ret"].get(k, 0) for k in RETS if k != OURS)
        comp_ment = sum(o["ret"].get(k, 0) for k in RETS if k != OURS)

        cafes[slug] = {
            "slug": slug,
            "name": m["name"],
            "url": m.get("url", ""),
            "type": m.get("type", ""),
            "rg": m.get("rg", ""),
            "mem": m.get("mem", 0),
            "n": o["n"],
            # ── 가전 전반 ──
            "all": {
                "talk": talk,
                "demand": demand,
                "axis": {k: v for k, v in ax.items()},
                "items": o["items"].most_common(8),
                "ret": {k: o["ret"].get(k, 0) for k in RETS},
                "promo": {k: o["promo_by_ret"].get(k, 0) for k in RETS},
                "months": sorted(o["months"].items())[-18:],
            },
            # ── 당사 ──
            "ours": {
                "promo": ours_promo,
                "ment": ours_ment,
                "acts": o["ours_list"][:8],
                "shareP": round(ours_promo / (ours_promo + comp_promo) * 100, 1) if (ours_promo + comp_promo) else 0,
                "shareM": round(ours_ment / (ours_ment + comp_ment) * 100, 1) if (ours_ment + comp_ment) else 0,
                "compP": comp_promo,
                "compM": comp_ment,
            },
            # ── 기회 목록(원문 링크) ──
            "ask": o["ask_list"][:10],
            "sub": o["sub_list"][:6],
            "svc": o["svc_list"][:6],
        }

    # 전체 합계
    tot_ret, tot_promo, tot_axis, tot_items = Counter(), Counter(), Counter(), Counter()
    n = talk = demand = 0
    for c in cafes.values():
        for k in RETS:
            tot_ret[k] += c["all"]["ret"][k]
            tot_promo[k] += c["all"]["promo"][k]
        tot_axis.update(c["all"]["axis"])
        for k, v in c["all"]["items"]:
            tot_items[k] += v
        n += c["n"]
        talk += c["all"]["talk"]
        demand += c["all"]["demand"]

    data = {
        "built": datetime.now().strftime("%Y-%m-%d"),
        "cafes": cafes,
        "rets": RETS,
        "ours": OURS,
        "total": {
            "cafes": len(cafes),
            "n": n,
            "talk": talk,
            "demand": demand,
            "mem": sum(c["mem"] for c in cafes.values()),
            "ret": dict(tot_ret),
            "promo": dict(tot_promo),
            "axis": dict(tot_axis),
            "items": tot_items.most_common(8),
            "shareP": round(tot_promo[OURS] / max(1, sum(tot_promo.values())) * 100, 1),
            "shareM": round(tot_ret[OURS] / max(1, sum(tot_ret.values())) * 100, 1),
        },
    }

    with io.open(OUT, "w", encoding="utf-8") as f:
        f.write("/* build_affiliate_web.py 자동생성 — 수정 금지 */\n")
        f.write("window.AFFILIATE_INSIGHT = " + json.dumps(data, ensure_ascii=False) + ";\n")

    t = data["total"]
    print(f"카페 {t['cafes']}곳 · 수집 {t['n']:,}건 · 가전 이야기 {t['talk']:,}건 · 수요 {t['demand']:,}건")
    print(f"당사 홍보 점유 {t['shareP']}% · 전체 언급 점유 {t['shareM']}%")
    print(f"→ {OUT}  ({os.path.getsize(OUT)//1024}KB)")


if __name__ == "__main__":
    main()
