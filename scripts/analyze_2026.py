# -*- coding: utf-8 -*-
"""2026년 작성분만 추려 전국/부울경/지역/매장/품목/월별 집계 → JSON 산출.
누적본(cumulative-cafe-raw.json) 기준. 본문 수집 후 재실행하면 최근 3개월 매장 매칭이 정밀해진다.
"""
import sys, json, os
from collections import defaultdict, Counter
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
import naver_cafe_scraper as s

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUM = os.path.join(ROOT, "artifacts", "cumulative-cafe-raw.json")
OUT = os.path.join(ROOT, "artifacts", "2026-analysis.json")

REGION = {
    "롯데 부산본점": "부산", "롯데 센텀시티": "부산", "신세계 센텀시티": "부산",
    "롯데 광복점": "부산", "롯데 동래점": "부산",
    "현대 울산점": "울산", "롯데 울산점": "울산", "현대 울산 동구": "울산",
    "롯데 창원점": "경남", "신세계 마산점": "경남", "신세계 김해": "경남", "갤러리아 진주": "경남",
}

def y2026(r):
    d = r.get("addDate", "") or ""
    return d.startswith("2026")

def main():
    recs = json.load(open(CUM, encoding="utf-8"))
    for r in recs:
        if "title_stores" not in r:
            r.update(s.analyze_text(r.get("title", ""), r.get("body_excerpt", "")))
        if "primary_store" not in r:
            r["primary_store"] = s.primary_store(r)
    rec26 = [r for r in recs if y2026(r)]

    # 전국 (2026)
    nat = {"posts": len(rec26),
           "samsung": sum(1 for r in rec26 if r.get("samsung")),
           "lg": sum(1 for r in rec26 if r.get("lg")),
           "both": sum(1 for r in rec26 if r.get("samsung") and r.get("lg"))}

    # 부울경 = primary_store 가 권역 매장으로 확정된 글
    bug = [r for r in rec26 if REGION.get(r.get("primary_store"))]
    bug_sum = {"posts": len(bug),
               "samsung": sum(1 for r in bug if r.get("samsung")),
               "lg": sum(1 for r in bug if r.get("lg"))}

    # 지역별
    region = {}
    for rg in ("부산", "울산", "경남"):
        rr = [r for r in bug if REGION.get(r.get("primary_store")) == rg]
        region[rg] = {"posts": len(rr),
                      "samsung": sum(1 for r in rr if r.get("samsung")),
                      "lg": sum(1 for r in rr if r.get("lg"))}

    # 매장별
    store = {}
    for r in bug:
        st = r["primary_store"]
        d = store.setdefault(st, {"region": REGION[st], "samsung": 0, "lg": 0, "total": 0})
        d["total"] += 1
        if r.get("samsung"): d["samsung"] += 1
        if r.get("lg"): d["lg"] += 1
    stores = [{"name": k, **v} for k, v in store.items()]
    stores.sort(key=lambda x: -(x["samsung"] + x["lg"]))

    # 품목 빈도 / 품목별 브랜드 (전국 2026)
    item_cnt = Counter()
    item_brand = defaultdict(lambda: {"samsung": 0, "lg": 0})
    for r in rec26:
        for it in set(r.get("items", [])):
            item_cnt[it] += 1
            if r.get("samsung"): item_brand[it]["samsung"] += 1
            if r.get("lg"): item_brand[it]["lg"] += 1
    items = [{"name": k, "value": v} for k, v in item_cnt.most_common()]
    itembrand = [{"name": k, "samsung": item_brand[k]["samsung"], "lg": item_brand[k]["lg"]}
                 for k, _ in item_cnt.most_common()]

    # 월별 (2026)
    monthly = {}
    for r in rec26:
        m = (r.get("addDate", "") or "")[:7]
        if not m.startswith("2026"): continue
        d = monthly.setdefault(m, {"total": 0, "samsung": 0, "lg": 0})
        d["total"] += 1
        if r.get("samsung"): d["samsung"] += 1
        if r.get("lg"): d["lg"] += 1
    monthly_rows = [{"label": k, **v} for k, v in sorted(monthly.items())]

    # 본문 확보율(2026)
    body_ok = sum(1 for r in rec26 if r.get("body_ok"))

    out = {
        "scope": "2026 작성분",
        "generated_records": len(rec26),
        "body_ok": body_ok,
        "national": nat,
        "busanUlsanGyeongnam": bug_sum,
        "region": region,
        "stores": stores,
        "items": items,
        "itemBrand": itembrand,
        "monthly": monthly_rows,
    }
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(json.dumps(out, ensure_ascii=False, indent=2))
    print("\n[saved]", OUT)

if __name__ == "__main__":
    main()
