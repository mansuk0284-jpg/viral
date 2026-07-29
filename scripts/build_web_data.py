# -*- coding: utf-8 -*-
"""census(정본) → web/assets/cafe-data.js 생성 (단일 진실원천 파이프라인).

지금까지 인라인 명령으로 만들던 웹 집계를 하나의 재사용 스크립트로 통합한다.
census가 갱신되면 이 스크립트만 다시 돌리면 대시보드 수치가 최신화된다.

집계 범위(하네스 규칙):
  - 전국·지역 = 전체 후기 대상(모든 유통)
  - 매장 = 백화점 입점(롯데·신세계·현대·갤러리아·AK) 삼성 vs LG만
  - 브랜드 귀속 = 삼성 XOR LG(단독 언급)만 카운트, 양사 동시언급은 total에만 포함

사용:
  python scripts/build_web_data.py [--census artifacts/cafe-census.json]
"""
import argparse
import io
import json
import os
import re
import sys
from collections import Counter, defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── 지역(시/도) 추정 키워드 ────────────────────────────────────────────
SIDO = {
    "서울": ["서울", "강남", "잠실", "영등포", "노원", "청량리", "미아", "명동", "관악",
             "신촌", "여의도", "천호", "압구정", "무역센터", "건대", "목동", "왕십리", "코엑스"],
    "경기": ["경기", "수원", "분당", "판교", "일산", "평촌", "안양", "부천", "의정부", "평택",
             "광교", "동탄", "하남", "김포", "고양", "용인", "성남", "안산", "시흥", "남양주",
             "파주", "구리", "오산", "광명", "군포", "이천", "기흥", "죽전", "화성", "안성"],
    "인천": ["인천", "송도", "부평", "청라", "계양", "구월", "논현"],
    "부산": ["부산", "센텀", "서면", "해운대", "광복", "동래", "사상", "남포", "기장", "화명"],
    "대구": ["대구", "동성로", "수성", "범어", "성서", "칠곡", "반월당"],
    "광주": ["광주", "첨단", "봉선", "수완", "상무"],
    "대전": ["대전", "둔산", "유성", "은행동", "관저"],
    "울산": ["울산", "삼산", "무거"],
    "경남": ["창원", "진주", "김해", "마산", "양산", "거제", "통영", "진해", "사천"],
    "경북": ["포항", "구미", "경산", "안동", "경주", "김천"],
    "충남": ["천안", "아산", "당진", "서산", "논산"],
    "충북": ["청주", "충주", "제천"],
    "전북": ["전주", "익산", "군산", "정읍"],
    "전남": ["여수", "순천", "목포", "광양", "나주"],
    "강원": ["춘천", "원주", "강릉", "속초"],
    "제주": ["제주", "서귀포"],
    "세종": ["세종"],
}
SIDO_RE = {k: re.compile("|".join(v)) for k, v in SIDO.items()}

# ── 백화점 체인(매장 집계는 이 5개 체인만) ────────────────────────────
CHAINS = {
    "롯데": ["롯데", "롯백", "롯"],
    "신세계": ["신세계", "신세", "신백"],
    "현대": ["현대", "현백"],
    "갤러리아": ["갤러리아", "갤러리", "갤"],
    "AK": ["AK", "ak플라자", "AK플라자"],
}
# 지점명 후보(백화점 뒤에 붙는 지역 토큰) — SIDO 키워드 재사용
BRANCH_TOKENS = sorted({w for ws in SIDO.values() for w in ws}, key=len, reverse=True)

RETAILERS = {
    "삼성스토어": ["삼성스토어", "디지털프라자", "디지탈프라자", "삼성전자판매"],
    "LG베스트샵": ["베스트샵", "베스트샾", "하이프라자", "LG전자베스트"],
    "백화점": ["백화점", "롯데", "신세계", "현대백", "갤러리아", "AK플라자"],
    "하이마트": ["하이마트", "롯데하이마트"],
}
RET_RE = {k: re.compile("|".join(v)) for k, v in RETAILERS.items()}


def text_of(r):
    return (r.get("title") or "") + " " + (r.get("summary") or "") + " " + (r.get("body_excerpt") or "")


def region_of(txt):
    for k, rx in SIDO_RE.items():
        if rx.search(txt):
            return k
    return None


def dept_store_of(txt):
    """백화점 체인 + 지점 조합을 '롯데 잠실' 형태로 정규화. 없으면 None."""
    for chain, alias in CHAINS.items():
        for a in alias:
            i = txt.find(a)
            if i < 0:
                continue
            window = txt[i:i + 14]          # 체인명 뒤 짧은 구간에서 지점 탐색
            for b in BRANCH_TOKENS:
                if b in window:
                    return f"{chain} {b}"
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--census", default=os.path.join(ROOT, "artifacts", "cafe-census.json"))
    ap.add_argument("--out", default=os.path.join(ROOT, "web", "assets", "cafe-data.js"))
    ap.add_argument("--min-store", type=int, default=8, help="매장 최소 표본(미만은 노이즈로 제외)")
    a = ap.parse_args()

    recs = json.load(open(a.census, encoding="utf-8"))
    print(f"census 로드: {len(recs):,}건")

    months = defaultdict(lambda: [0, 0, 0])       # ym → [total, s, l]
    regions = defaultdict(lambda: {"s": 0, "l": 0})
    stores = defaultdict(lambda: defaultdict(lambda: {"s": 0, "l": 0}))   # 시도 → 매장 → 건수
    retail = Counter()
    tot = s_tot = l_tot = 0

    for r in recs:
        s, l = bool(r.get("samsung")), bool(r.get("lg"))
        if not (s or l):
            continue
        txt = text_of(r)
        ym = r.get("writeMonth") or (r.get("addDate") or "")[:7]
        single_s, single_l = (s and not l), (l and not s)

        tot += 1
        if ym:
            months[ym][0] += 1
            if single_s:
                months[ym][1] += 1
            if single_l:
                months[ym][2] += 1
        if single_s:
            s_tot += 1
        if single_l:
            l_tot += 1

        for k, rx in RET_RE.items():
            if rx.search(txt):
                retail[k] += 1

        rg = region_of(txt)
        if rg and (single_s or single_l):
            regions[rg]["s" if single_s else "l"] += 1
            st = dept_store_of(txt)           # 매장은 백화점만
            if st:
                stores[rg][st]["s" if single_s else "l"] += 1

    months_arr = [[m, v[0], v[1], v[2]] for m, v in sorted(months.items()) if m >= "2021-01"]
    stores_out = {}
    for rg, sd in stores.items():
        lst = [{"n": n, "s": v["s"], "l": v["l"]} for n, v in sd.items() if v["s"] + v["l"] >= a.min_store]
        if lst:
            stores_out[rg] = sorted(lst, key=lambda x: -(x["s"] + x["l"]))

    data = {
        "total": tot,
        "samsung": s_tot,
        "lg": l_tot,
        "retailers": dict(retail),
        "months": months_arr,
        "regions": {k: v for k, v in sorted(regions.items(), key=lambda kv: -(kv[1]["s"] + kv[1]["l"]))},
        "stores": stores_out,
        "scope": "전국·지역=전체 후기 / 매장=백화점 입점(삼성스토어 vs LG)만",
    }

    with open(a.out, "w", encoding="utf-8") as f:
        f.write("/* build_web_data.py 자동생성 — 수정 금지. census 갱신 후 재실행할 것 */\n")
        f.write("window.CAFE_DATA = " + json.dumps(data, ensure_ascii=False) + ";\n")

    share = round(s_tot / (s_tot + l_tot) * 100, 1) if (s_tot + l_tot) else 0
    print(f"집계 완료 total {tot:,} · 삼성 {s_tot:,} / LG {l_tot:,} (삼성 {share}%)")
    print(f"월 {len(months_arr)}개 · 지역 {len(regions)}개 · 매장지역 {len(stores_out)}개")
    print(f"→ {a.out}")


if __name__ == "__main__":
    main()
