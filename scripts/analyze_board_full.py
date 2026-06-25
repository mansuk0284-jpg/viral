# -*- coding: utf-8 -*-
"""가전(후기) 게시판(menuId 280) 누적본 전수(전 연도) 분석.
연도별 브랜드 점유율 / 품목 인기 / 품목별 브랜드 / 월별 추이 / 부울경 매장(본문확정) 집계.
누적본(cumulative-cafe-raw.json) 기준. 결과는 board-full-analysis.json + 콘솔 요약.
"""
import sys, json, os
from collections import defaultdict, Counter
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
import naver_cafe_scraper as s

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUM = os.path.join(ROOT, "artifacts", "cumulative-cafe-raw.json")
OUT = os.path.join(ROOT, "artifacts", "board-full-analysis.json")

REGION = {
    "롯데 부산본점": "부산", "롯데 센텀시티": "부산", "신세계 센텀시티": "부산",
    "롯데 광복점": "부산", "롯데 동래점": "부산",
    "현대 울산점": "울산", "롯데 울산점": "울산", "현대 울산 동구": "울산",
    "롯데 창원점": "경남", "신세계 마산점": "경남", "신세계 김해": "경남", "갤러리아 진주": "경남",
}

def year(r):
    return (r.get("addDate", "") or "")[:4]

def brand_block(rows):
    return {"posts": len(rows),
            "samsung": sum(1 for r in rows if r.get("samsung")),
            "lg": sum(1 for r in rows if r.get("lg")),
            "both": sum(1 for r in rows if r.get("samsung") and r.get("lg"))}

def main():
    recs = json.load(open(CUM, encoding="utf-8"))
    for r in recs:
        if "title_stores" not in r:
            r.update(s.analyze_text(r.get("title", ""), r.get("body_excerpt", "")))
        if "primary_store" not in r:
            r["primary_store"] = s.primary_store(r)

    # ── 전체 + 연도별 브랜드 점유율
    overall = brand_block(recs)
    overall["body_ok"] = sum(1 for r in recs if r.get("body_ok"))
    by_year = {}
    for y in sorted({year(r) for r in recs if year(r)}):
        rows = [r for r in recs if year(r) == y]
        blk = brand_block(rows)
        blk["body_ok"] = sum(1 for r in rows if r.get("body_ok"))
        by_year[y] = blk

    # ── 품목 인기 / 품목별 브랜드 (전체)
    item_cnt = Counter()
    item_brand = defaultdict(lambda: {"samsung": 0, "lg": 0})
    for r in recs:
        for it in set(r.get("items", [])):
            item_cnt[it] += 1
            if r.get("samsung"): item_brand[it]["samsung"] += 1
            if r.get("lg"): item_brand[it]["lg"] += 1
    items = [{"name": k, "value": v} for k, v in item_cnt.most_common()]
    itembrand = [{"name": k, "samsung": item_brand[k]["samsung"], "lg": item_brand[k]["lg"]}
                 for k, _ in item_cnt.most_common()]

    # ── 월별 추이 (전 기간)
    monthly = {}
    for r in recs:
        m = (r.get("addDate", "") or "")[:7]
        if len(m) != 7: continue
        d = monthly.setdefault(m, {"total": 0, "samsung": 0, "lg": 0})
        d["total"] += 1
        if r.get("samsung"): d["samsung"] += 1
        if r.get("lg"): d["lg"] += 1
    monthly_rows = [{"label": k, **v} for k, v in sorted(monthly.items())]

    # ── 부울경 매장(본문 확정분) — 전 기간 + 2026
    def store_agg(rows):
        store = {}
        for r in rows:
            st = r.get("primary_store")
            if not REGION.get(st): continue
            d = store.setdefault(st, {"region": REGION[st], "samsung": 0, "lg": 0, "total": 0})
            d["total"] += 1
            if r.get("samsung"): d["samsung"] += 1
            if r.get("lg"): d["lg"] += 1
        out = [{"name": k, **v} for k, v in store.items()]
        out.sort(key=lambda x: -(x["samsung"] + x["lg"]))
        return out

    bug_all = [r for r in recs if REGION.get(r.get("primary_store"))]
    stores_all = store_agg(recs)
    stores_2026 = store_agg([r for r in recs if year(r) == "2026"])

    out = {
        "scope": "가전(후기) 게시판 menuId 280 — 누적본 전수(전 연도)",
        "total_records": len(recs),
        "overall_brand": overall,
        "by_year": by_year,
        "items": items,
        "itemBrand": itembrand,
        "monthly": monthly_rows,
        "bug_store_confirmed_posts": len(bug_all),
        "stores_all_years": stores_all,
        "stores_2026": stores_2026,
        "note": "≤2025 본문 미열람(body_ok=0) → 매장 매칭은 사실상 2026 본문확정분 중심. 브랜드/품목/월별은 제목+요약 기반 전수.",
    }
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    # ── 콘솔 요약
    def pct(a, b): return round(a / (a + b) * 100) if (a + b) else 0
    print("=== 가전(후기) 게시판 전수 분석 ===")
    print(f"총 게시물: {len(recs):,}건  (본문열람 {overall['body_ok']:,}건)")
    print(f"전체 브랜드 언급: 삼성 {overall['samsung']:,} / LG {overall['lg']:,}  → 삼성점유율 {pct(overall['samsung'], overall['lg'])}%")
    print("\n[연도별]  글수 | 삼성 | LG | 삼성% | 본문")
    for y, b in by_year.items():
        print(f"  {y}  {b['posts']:6,} | {b['samsung']:5,} | {b['lg']:5,} | {pct(b['samsung'], b['lg']):3}% | {b['body_ok']:,}")
    print("\n[인기 품목 Top10]")
    for it in items[:10]:
        ib = next(x for x in itembrand if x["name"] == it["name"])
        print(f"  {it['name']:8} {it['value']:6,}건  (삼성 {ib['samsung']:,} / LG {ib['lg']:,}, 삼성{pct(ib['samsung'], ib['lg'])}%)")
    print(f"\n[부울경 매장 본문확정] 전기간 {len(bug_all):,}건 / 2026 기준 매장 {len(stores_2026)}곳")
    print("\n[월별 추이]")
    for m in monthly_rows:
        print(f"  {m['label']}  총{m['total']:5,}  삼성{m['samsung']:5,}  LG{m['lg']:5,}  삼성{pct(m['samsung'], m['lg']):3}%")
    print("\n[saved]", OUT)

if __name__ == "__main__":
    main()
