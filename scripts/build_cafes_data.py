# -*- coding: utf-8 -*-
"""제휴카페 엑셀 → web/assets/cafes-data.js 생성.

메인페이지 '바이럴세상'에서 보여줄 제휴카페 타일 데이터를 만든다.
카페 성격(유형)으로 카테고리를 묶고, 각 카테고리 안에 개별 카페를 담는다.

사용:
  python scripts/build_cafes_data.py [--src data/제휴카페.xlsx]
"""
import argparse
import io
import json
import os
import sys
from collections import defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 카페 유형 → 카테고리(표시명·색·아이콘 키). 소수 유형은 '기타'로 묶는다.
CATS = {
    "맘": {"key": "mom", "label": "맘카페", "desc": "육아·지역 생활 커뮤니티", "color": "#03C75A"},
    "부동산": {"key": "estate", "label": "부동산", "desc": "분양·입주·재테크", "color": "#1f5fd0"},
    "지역": {"key": "local", "label": "지역 커뮤니티", "desc": "지역 주민 생활정보", "color": "#f59e0b"},
    "인테리어": {"key": "etc", "label": "기타", "desc": "인테리어·IT·쇼핑·모임", "color": "#7c3aed"},
    "IT": {"key": "etc", "label": "기타", "desc": "인테리어·IT·쇼핑·모임", "color": "#7c3aed"},
    "쇼핑": {"key": "etc", "label": "기타", "desc": "인테리어·IT·쇼핑·모임", "color": "#7c3aed"},
    "모임": {"key": "etc", "label": "기타", "desc": "인테리어·IT·쇼핑·모임", "color": "#7c3aed"},
    "소상공인": {"key": "etc", "label": "기타", "desc": "인테리어·IT·쇼핑·모임", "color": "#7c3aed"},
}
ORDER = ["mom", "estate", "local", "etc"]


def clean(v):
    return str(v).strip() if v is not None else ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=os.path.join(ROOT, "data", "제휴카페.xlsx"))
    ap.add_argument("--sheet", default="26.8월")
    ap.add_argument("--out", default=os.path.join(ROOT, "web", "assets", "cafes-data.js"))
    a = ap.parse_args()

    import openpyxl
    ws = openpyxl.load_workbook(a.src, data_only=True)[a.sheet]

    cafes = []
    for row in ws.iter_rows(min_row=9, values_only=True):
        name, url, typ = clean(row[2]), clean(row[3]), clean(row[4])
        if not name or not url.startswith("http"):
            continue
        try:
            mem = int(row[8]) if row[8] else 0
        except (TypeError, ValueError):
            mem = 0
        cat = CATS.get(typ, CATS["소상공인"])
        cafes.append({
            "n": name, "u": url, "t": typ, "c": cat["key"],
            "r1": clean(row[5]), "r2": clean(row[6]), "r3": clean(row[7]), "m": mem,
        })

    by = defaultdict(list)
    for c in cafes:
        by[c["c"]].append(c)
    for k in by:
        by[k].sort(key=lambda x: -x["m"])

    cats = []
    for k in ORDER:
        if not by[k]:
            continue
        meta = next(v for v in CATS.values() if v["key"] == k)
        cats.append({
            "key": k, "label": meta["label"], "desc": meta["desc"], "color": meta["color"],
            "count": len(by[k]), "members": sum(c["m"] for c in by[k]),
            "types": sorted({c["t"] for c in by[k]}),
        })

    data = {"total": len(cafes), "members": sum(c["m"] for c in cafes),
            "cats": cats, "cafes": {k: by[k] for k in by}}

    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        f.write("/* build_cafes_data.py 자동생성 — 제휴카페 리스트. 수정 금지 */\n")
        f.write("window.AFFILIATE_CAFES = " + json.dumps(data, ensure_ascii=False) + ";\n")

    print(f"제휴카페 {len(cafes)}곳 · 총 회원 {data['members']:,}명")
    for c in cats:
        print(f"  {c['label']:8} {c['count']:3}곳 · {c['members']:>9,}명 · {'/'.join(c['types'])}")
    print("→", a.out)


if __name__ == "__main__":
    main()
