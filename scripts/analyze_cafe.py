# -*- coding: utf-8 -*-
"""카페 범용 분석 엔진 — collect_cafe.py 산출 JSON → 브랜드·월별추이·매장매칭·샘플.
   다이렉트결혼준비 백필/데이터는 건드리지 않는다. 브라우저 미사용(정적 분석).
   전 카페 동일 기준: brand_lexicon(삼성/LG 별칭) + naver_api_collect.match_store(12개점).
   사용: python analyze_cafe.py --in ../artifacts/cafe-momsholic-hist.json \
         --name 맘스홀릭베이비 --out ../artifacts/cafe-momsholic-analysis.md
"""
import sys, json, io, argparse, re
from collections import Counter, defaultdict
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from brand_lexicon import brand_label
from naver_api_collect import match_store  # 12개점 매칭(브라우저 미실행)

POS = ["만족", "좋아", "좋았", "예뻐", "예쁨", "추천", "최고", "꿀", "성공", "잘 샀", "잘샀", "강추", "이득", "혜자", "졸업"]
NEG = ["불만", "별로", "후회", "최악", "고장", "소음", "에이에스", "지연", "환불", "실망", "하자", "불편", "as접수"]


def tone_of(text):
    t = text.lower()
    if any(k in t for k in NEG):
        return "부정"
    if any(k in t for k in POS):
        return "긍정"
    return "중립"


def month_of(rec):
    """addDate(ISO) 또는 articleId 단서에서 YYYY-MM. 실패 시 None."""
    d = rec.get("addDate") or ""
    m = re.search(r"(\d{4})[-./](\d{2})", d)
    return f"{m.group(1)}-{m.group(2)}" if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--name", required=True, help="카페 표시명")
    ap.add_argument("--out", required=True)
    ap.add_argument("--samples", type=int, default=8)
    args = ap.parse_args()

    recs = json.load(open(args.inp, encoding="utf-8"))
    brand_cnt = Counter()
    tone_cnt = Counter()
    monthly = defaultdict(lambda: {"삼성": 0, "LG": 0})
    store_sl = defaultdict(lambda: {"삼성": 0, "LG": 0, "삼성·LG": 0, "region": ""})
    region_sl = defaultdict(lambda: {"삼성": 0, "LG": 0})
    pos_samples, neg_samples = [], []

    for r in recs:
        text = (r.get("title", "") + " " + r.get("summary", "")).strip()
        # 분류는 SSOT 재판정(수집 시 플래그가 없거나 구버전일 수 있어 일관성 위해 재계산)
        lab = brand_label(text)
        brand_cnt[lab] += 1
        tone = tone_of(text)
        tone_cnt[tone] += 1
        mo = month_of(r)
        if mo and lab in ("삼성", "LG"):
            monthly[mo][lab] += 1
        store, region = match_store(text)
        if store and store != "__OUT__":
            store_sl[store][lab if lab in ("삼성", "LG", "삼성·LG") else "삼성·LG"] += 0
            if lab in ("삼성", "LG", "삼성·LG"):
                store_sl[store][lab] += 1
            store_sl[store]["region"] = region or ""
        if region and lab in ("삼성", "LG"):
            region_sl[region][lab] += 1
        # 권역 매장 특정분 우호/비난 샘플
        if store and store != "__OUT__":
            entry = {"store": store, "brand": lab, "title": r.get("title", "")[:80], "url": r.get("url", "")}
            if tone == "긍정" and len(pos_samples) < args.samples:
                pos_samples.append(entry)
            elif tone == "부정" and len(neg_samples) < args.samples:
                neg_samples.append(entry)

    ns, nl = brand_cnt.get("삼성", 0), brand_cnt.get("LG", 0)
    share = ns / (ns + nl) * 100 if ns + nl else 0
    L = []
    L.append(f"# {args.name} — 카페 가전후기 분석 (범용 엔진)")
    L.append(f"> 입력: {args.inp} · 총 {len(recs)}건 · 브라우저 미사용 정적 분석")
    L.append(f"> ⚠ 표본 기준 추정치(전수 아님). 브랜드=brand_lexicon SSOT, 매장=12개점 매칭.\n")
    L.append("## 브랜드 집계")
    L.append("| 브랜드 | 건수 |\n|---|---|")
    for b in ["삼성", "LG", "삼성·LG", "기타/미상"]:
        L.append(f"| {b} | {brand_cnt.get(b,0)} |")
    L.append(f"\n**삼성 vs LG(단일 언급 기준): 삼성 {ns} / LG {nl} / 삼성비중 {share:.1f}%**\n")
    L.append("## 톤")
    L.append(f"긍정 {tone_cnt.get('긍정',0)} / 부정 {tone_cnt.get('부정',0)} / 중립 {tone_cnt.get('중립',0)}\n")
    L.append("## 월별 삼성 vs LG 추이 (단일 언급)")
    L.append("| 월 | 삼성 | LG | 삼성비중 |\n|---|---|---|---|")
    for mo in sorted(monthly):
        d = monthly[mo]; tot = d["삼성"] + d["LG"]
        sh = f"{d['삼성']/tot*100:.0f}%" if tot else "-"
        L.append(f"| {mo} | {d['삼성']} | {d['LG']} | {sh} |")
    L.append("\n## 권역(부울경) 매장별 삼성 vs LG")
    if store_sl:
        L.append("| 매장 | 권역 | 삼성 | LG | 양사 |\n|---|---|---|---|---|")
        for name, d in sorted(store_sl.items(), key=lambda kv: -(kv[1]["삼성"] + kv[1]["LG"])):
            L.append(f"| {name} | {d['region']} | {d['삼성']} | {d['LG']} | {d['삼성·LG']} |")
    else:
        L.append("_권역 매장 특정 후기 없음(표본/매장단서 부족)._")
    L.append("\n## 우호 후기 샘플(권역 매장 특정)")
    L += [f"- [{e['store']}/{e['brand']}] {e['title']} — {e['url']}" for e in pos_samples] or ["_없음_"]
    L.append("\n## 비난/부정 후기 샘플(권역 매장 특정)")
    L += [f"- [{e['store']}/{e['brand']}] {e['title']} — {e['url']}" for e in neg_samples] or ["_없음_"]

    with open(args.out, "w", encoding="utf-8") as f:
        f.write("\n".join(L))
    print(f"분석 저장 → {args.out}")
    print(f"총 {len(recs)} · 삼성 {ns} / LG {nl} / 삼성비중 {share:.1f}% · 권역매장 {len(store_sl)}곳")


if __name__ == "__main__":
    main()
