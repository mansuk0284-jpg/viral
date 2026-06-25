# -*- coding: utf-8 -*-
"""월별 삼성 vs LG 후기 추이의 변곡점 탐지 + 원인 단서(제품군 키워드/품목) 분석.
누적본(cumulative-cafe-raw.json) 기준. 결과 JSON: artifacts/inflection-analysis.json
"""
import sys, json, os
from collections import defaultdict, Counter
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUM = os.path.join(ROOT, "artifacts", "cumulative-cafe-raw.json")
OUT = os.path.join(ROOT, "artifacts", "inflection-analysis.json")

# 브랜드별 제품 라인업 키워드 (원인 단서 추적용)
SS_KW = {
    "비스포크": ["비스포크", "BESPOKE", "bespoke"],
    "비스포크 AI": ["비스포크 AI", "비스포크AI", "AI 콤보", "AI콤보"],
    "무풍에어컨": ["무풍"],
    "그랑데": ["그랑데"],
    "Neo QLED": ["네오 QLED", "네오QLED", "Neo QLED", "NeoQLED"],
    "더 프레임": ["더 프레임", "더프레임", "The Frame"],
    "AI 가전": ["AI 가전", "AI세탁", "AI 세탁", "삼성 AI"],
}
LG_KW = {
    "오브제컬렉션": ["오브제"],
    "트롬": ["트롬", "TROMM"],
    "디오스": ["디오스", "DIOS"],
    "휘센": ["휘센"],
    "코드제로": ["코드제로"],
    "스타일러": ["스타일러"],
    "워시타워": ["워시타워", "워시콤보"],
}

def text_of(r):
    return " ".join([r.get("title", "") or "", r.get("summary", "") or "", r.get("body_excerpt", "") or ""])

def kw_hit(txt, variants):
    return any(v.lower() in txt.lower() for v in variants)

def main():
    recs = json.load(open(CUM, encoding="utf-8"))

    # 월별 추이 + MoM 델타
    monthly = {}
    for r in recs:
        m = (r.get("addDate", "") or "")[:7]
        if len(m) != 7: continue
        d = monthly.setdefault(m, {"total": 0, "samsung": 0, "lg": 0})
        d["total"] += 1
        if r.get("samsung"): d["samsung"] += 1
        if r.get("lg"): d["lg"] += 1
    months = sorted(monthly)
    series = []
    prev = None
    for m in months:
        s_, l_ = monthly[m]["samsung"], monthly[m]["lg"]
        share = round(s_ / (s_ + l_) * 100) if (s_ + l_) else 0
        delta = None if prev is None else share - prev
        series.append({"label": m, "total": monthly[m]["total"], "samsung": s_, "lg": l_,
                       "samsung_share": share, "mom_delta": delta})
        prev = share

    # 변곡점: 삼성 점유율 MoM 상승 폭 Top
    risers = sorted([x for x in series if x["mom_delta"] is not None],
                    key=lambda x: -(x["mom_delta"]))[:5]

    # 월별 삼성 제품군 키워드 / 품목 (원인 단서)
    ss_kw_month = defaultdict(lambda: Counter())
    lg_kw_month = defaultdict(lambda: Counter())
    ss_item_month = defaultdict(lambda: Counter())
    for r in recs:
        m = (r.get("addDate", "") or "")[:7]
        if len(m) != 7: continue
        txt = text_of(r)
        if r.get("samsung"):
            for fam, vs in SS_KW.items():
                if kw_hit(txt, vs): ss_kw_month[m][fam] += 1
            for it in set(r.get("items", [])):
                ss_item_month[m][it] += 1
        if r.get("lg"):
            for fam, vs in LG_KW.items():
                if kw_hit(txt, vs): lg_kw_month[m][fam] += 1

    def top(counter, n=6):
        return [{"name": k, "count": v} for k, v in counter.most_common(n)]

    # 최근 12개월 키워드 표
    recent = months[-12:]
    ss_kw_table = {m: top(ss_kw_month[m]) for m in recent}
    lg_kw_table = {m: top(lg_kw_month[m]) for m in recent}
    ss_item_table = {m: top(ss_item_month[m]) for m in recent}

    # 전체 키워드 합계 (라인업 임팩트 랭킹)
    ss_kw_total = Counter()
    for m in months:
        ss_kw_total.update(ss_kw_month[m])

    out = {
        "scope": "월별 삼성 vs LG 변곡점 + 원인 단서",
        "monthly_series": series,
        "top_risers": risers,
        "samsung_keyword_total": top(ss_kw_total, 10),
        "samsung_keyword_recent12": ss_kw_table,
        "lg_keyword_recent12": lg_kw_table,
        "samsung_item_recent12": ss_item_table,
        "note": "키워드는 제목+요약+본문발췌 텍스트 매칭. ≤2025 본문없음→제목/요약만, 2026 본문포함. 인과 아닌 상관 단서.",
    }
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("[saved]", OUT)
    print("months:", len(months), "| top riser:", risers[0]["label"] if risers else None,
          "(+{}%p)".format(risers[0]["mom_delta"]) if risers else "")

if __name__ == "__main__":
    main()
