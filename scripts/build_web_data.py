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

# ── 매니저(프로·명장·점장) 언급 분석 ────────────────────────────────
MGR_TITLE = re.compile(r"(매니저|프로님|프로|부점장|점장|명장)")
# "홍길동 매니저" 형태의 실명 추출(2~4자 한글 이름 + 호칭)
MGR_NAME = re.compile(r"([가-힣]{2,4})\s*(매니저|프로님|프로|부점장|점장|명장)")
NOT_NAME = {"삼성", "엘지", "베스트", "하이", "가전", "우리", "저희", "담당", "실장", "직원",
            "여기", "이번", "그때", "당시", "정말", "완전", "너무", "친절", "최고", "감사",
            # 실명이 아닌 일반어(호칭 앞에 자주 붙음)
            "판매", "우수", "최우수", "전문", "수석", "책임", "선임", "지역", "본점", "매장",
            "상담", "설치", "배송", "그분", "이분", "해당", "각각", "모든", "다른", "새로"}

# ── 판매 인사이트용 사전 ────────────────────────────────────────────
ITEMS = {
    "냉장고": ["냉장고", "디오스"], "세탁기": ["세탁기", "트롬", "워시타워", "워시콤보"],
    "건조기": ["건조기"], "TV": ["TV", "티비", "올레드", "네오QLED", "QLED"],
    "에어컨": ["에어컨", "무풍"],
    # 카테고리는 일반명 사용 — 스타일러(LG)·에어드레서(삼성)는 각사 제품명이므로 키워드로만
    "의류관리기": ["에어드레서", "스타일러", "의류관리기"],
    "식기세척기": ["식기세척기", "식세기"], "청소기": ["청소기", "제트", "코드제로"],
    "김치냉장고": ["김치냉장고", "김치톡톡"], "인덕션": ["인덕션", "전기레인지"],
    "정수기": ["정수기", "퓨리케어"], "오븐": ["오븐", "광파오븐"],
}
COMPARE_RE = re.compile("발품|비교|고민|둘러")          # 경쟁 접점(비교 상담) 신호
BENEFITS = {
    "사은품": ["사은품", "증정"], "체감가": ["체감가", "실구매가", "최저가"],
    "페이백·상품권": ["페이백", "온누리", "상품권"], "카드할인": ["카드할인", "청구할인", "무이자"],
    "임직원가": ["임직원", "직원가"], "전시품": ["전시품", "전시상품"],
}

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


# 시도명은 지점명이 아니다(예: '현대 서울'은 실제 지점이 아님) — 단독 사용 금지
SIDO_NAMES = set(SIDO.keys())
# 고유 표기 매장(체인+지점 조합으로는 안 잡히는 실제 매장)
SPECIAL_STORES = [
    (["더현대서울", "더 현대 서울", "더현대 서울"], "더현대 서울"),
    (["더현대대구", "더현대 대구"], "더현대 대구"),
    (["롯데본점", "롯백 본점", "롯데 본점", "소공동"], "롯데 본점"),
    (["신세계본점", "신세계 본점"], "신세계 본점"),
    (["현대본점", "현대 본점", "압구정본점"], "현대 압구정본점"),
    (["센텀시티", "신세계센텀", "신세계 센텀"], "신세계 센텀시티"),
    (["부산본점", "롯데부산본점"], "롯데 부산본점"),
]


def dept_store_of(txt):
    """실제 지점명으로 정규화. 시도명 단독(예: 현대+서울)은 지점으로 보지 않는다."""
    for kws, name in SPECIAL_STORES:      # 1) 고유 표기 우선
        if any(k in txt for k in kws):
            return name
    for chain, alias in CHAINS.items():   # 2) 체인 + 실제 지점 토큰
        for a in alias:
            i = txt.find(a)
            if i < 0:
                continue
            window = txt[i:i + 14]
            for b in BRANCH_TOKENS:
                if b in SIDO_NAMES:       # 시도명은 지점명이 아니므로 제외
                    continue
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
    # 매니저 언급: 전체 / 매장별 / 실명
    mgr_all = {"s_on": 0, "l_on": 0, "s_off": 0, "l_off": 0}
    mgr_store = defaultdict(lambda: {"s": 0, "l": 0, "names": Counter()})
    # 판매 인사이트: 품목별 승패 / 비교상담 전환 / 혜택 효과 / 성수기
    items = {k: {"s": 0, "l": 0} for k in ITEMS}
    compare = {"s": 0, "l": 0}
    benefit = {k: {"s": 0, "l": 0} for k in BENEFITS}
    season = Counter()
    # 매장별 상세: 품목 승패 / 혜택 언급 / 월별 추이 / 비교상담
    sdet = defaultdict(lambda: {"items": defaultdict(lambda: {"s": 0, "l": 0}),
                                "ben": Counter(), "mon": Counter(), "cmp": {"s": 0, "l": 0}})
    # 지역(시/도)별 상세 — 매장과 동일 구조
    rdet = defaultdict(lambda: {"items": defaultdict(lambda: {"s": 0, "l": 0}),
                                "ben": Counter(), "mon": Counter(), "cmp": {"s": 0, "l": 0}})

    # ── 기간별(전체/연도/월) 분석 버킷 — 기간 탭과 화면을 연동하기 위함 ──
    def newbucket():
        return {"regions": defaultdict(lambda: {"s": 0, "l": 0}),
                "items": defaultdict(lambda: {"s": 0, "l": 0}),
                "ben": defaultdict(lambda: {"s": 0, "l": 0}),
                "cmp": {"s": 0, "l": 0}}
    perbuk = defaultdict(newbucket)
    # 기간별 매장 집계 + 지역/매장 상세(전체·연도 단위. 월은 표본이 희박해 연도로 폴백)
    per_store = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: {"s": 0, "l": 0})))
    per_sdet = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: {"s": 0, "l": 0})))
    per_rdet = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: {"s": 0, "l": 0})))

    for r in recs:
        s, l = bool(r.get("samsung")), bool(r.get("lg"))
        if not (s or l):
            continue
        txt = text_of(r)
        ym = r.get("writeMonth") or (r.get("addDate") or "")[:7]
        # 화면 표시 범위(2021-01~)와 합계를 일치시킨다 — 그 이전 소량(28건)은 제외
        if ym and ym < "2021-01":
            continue
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

        # ── 판매 인사이트 집계 ──
        bk = "s" if single_s else ("l" if single_l else None)
        if bk:
            for nm, kws in ITEMS.items():
                if any(w in txt for w in kws):
                    items[nm][bk] += 1
            if COMPARE_RE.search(txt):
                compare[bk] += 1
            for nm, kws in BENEFITS.items():
                if any(w in txt for w in kws):
                    benefit[nm][bk] += 1
        if ym and len(ym) == 7:
            season[ym[5:7]] += 1

        # ── 기간별 누적: 전체 / 해당 연도 / 해당 월 ──
        if bk:
            keys = ["all"]
            if ym and len(ym) == 7:
                keys += [ym[:4], ym]
            hit_items = [nm for nm, kws in ITEMS.items() if any(w in txt for w in kws)]
            hit_ben = [nm for nm, kws in BENEFITS.items() if any(w in txt for w in kws)]
            is_cmp = bool(COMPARE_RE.search(txt))
            rg0 = region_of(txt)
            for pk in keys:
                pb = perbuk[pk]
                for nm in hit_items:
                    pb["items"][nm][bk] += 1
                for nm in hit_ben:
                    pb["ben"][nm][bk] += 1
                if is_cmp:
                    pb["cmp"][bk] += 1
                if rg0:
                    pb["regions"][rg0][bk] += 1

        # 매니저 언급 유무 × 브랜드 (실명 후기 경쟁력 지표)
        hasMgr = bool(MGR_TITLE.search(txt))
        if single_s:
            mgr_all["s_on" if hasMgr else "s_off"] += 1
        elif single_l:
            mgr_all["l_on" if hasMgr else "l_off"] += 1

        rg = region_of(txt)
        if rg and (single_s or single_l):
            regions[rg]["s" if single_s else "l"] += 1
            # 지역 상세 — 품목·혜택·월별·비교상담 (매장 유무와 무관하게 지역 전체)
            rd = rdet[rg]
            for nm, kws in ITEMS.items():
                if any(w in txt for w in kws):
                    rd["items"][nm]["s" if single_s else "l"] += 1
            for nm, kws in BENEFITS.items():
                if any(w in txt for w in kws):
                    rd["ben"][nm] += 1
            if ym:
                rd["mon"][ym] += 1
            if COMPARE_RE.search(txt):
                rd["cmp"]["s" if single_s else "l"] += 1
            pkeys = ["all"] + ([ym[:4]] if ym and len(ym) == 7 else [])
            for pk in pkeys:                       # 지역 상세(품목) 기간별
                for nm, kws in ITEMS.items():
                    if any(w in txt for w in kws):
                        per_rdet[pk][rg][nm][bk] += 1
            st = dept_store_of(txt)           # 매장은 백화점만
            if st:
                stores[rg][st]["s" if single_s else "l"] += 1
                for pk in pkeys:                   # 매장 집계·상세 기간별
                    per_store[pk][rg][st][bk] += 1
                    for nm, kws in ITEMS.items():
                        if any(w in txt for w in kws):
                            per_sdet[pk][st][nm][bk] += 1
                # 매장 상세 — 품목·혜택·월별·비교상담
                sd = sdet[st]
                for nm, kws in ITEMS.items():
                    if any(w in txt for w in kws):
                        sd["items"][nm]["s" if single_s else "l"] += 1
                for nm, kws in BENEFITS.items():
                    if any(w in txt for w in kws):
                        sd["ben"][nm] += 1
                if ym:
                    sd["mon"][ym] += 1
                if COMPARE_RE.search(txt):
                    sd["cmp"]["s" if single_s else "l"] += 1
                if hasMgr:
                    m = mgr_store[st]
                    m["s" if single_s else "l"] += 1
                    if single_s:            # 우리 매장 매니저 실명만 수집
                        for nm, ttl in MGR_NAME.findall(txt):
                            if nm not in NOT_NAME and len(nm) >= 2:
                                m["names"][nm + " " + ttl] += 1

    months_arr = [[m, v[0], v[1], v[2]] for m, v in sorted(months.items()) if m >= "2021-01"]
    stores_out = {}
    for rg, sd in stores.items():
        lst = [{"n": n, "s": v["s"], "l": v["l"]} for n, v in sd.items() if v["s"] + v["l"] >= a.min_store]
        if lst:
            stores_out[rg] = sorted(lst, key=lambda x: -(x["s"] + x["l"]))

    mgr_out = {}
    for stn, v in mgr_store.items():
        if v["s"] + v["l"] < 3:
            continue
        mgr_out[stn] = {"s": v["s"], "l": v["l"],
                        "names": [{"n": n, "c": c} for n, c in v["names"].most_common(4)]}

    data = {
        "total": tot,
        "samsung": s_tot,
        "lg": l_tot,
        "retailers": dict(retail),
        "mgr": mgr_all,          # 매니저 언급 유무 × 브랜드(전국)
        "mgrStore": mgr_out,     # 매장별 매니저 언급 + 실명 TOP
        # 판매 인사이트
        "items": {k: v for k, v in sorted(items.items(), key=lambda kv: -(kv[1]["s"] + kv[1]["l"])) if v["s"] + v["l"] >= 50},
        "storeDetail": {},       # 아래에서 채움 (매장별 품목·혜택·추이)
        "compare": compare,      # 비교·발품 상담 후 최종 선택
        "benefit": {k: v for k, v in benefit.items() if v["s"] + v["l"] >= 30},
        "season": dict(sorted(season.items())),
        "months": months_arr,
        "regions": {k: v for k, v in sorted(regions.items(), key=lambda kv: -(kv[1]["s"] + kv[1]["l"]))},
        "stores": stores_out,
        "scope": "전국·지역=전체 후기 / 매장=백화점 입점(삼성스토어 vs LG)만",
    }

    # 매장 상세 — 표본이 충분한 매장만(노이즈 방지), 품목은 상위 6개, 추이는 최근 12개월
    sdet_out = {}
    for stn, v in sdet.items():
        if sum(v["mon"].values()) < 30:
            continue
        its = sorted(v["items"].items(), key=lambda kv: -(kv[1]["s"] + kv[1]["l"]))
        its = [{"n": k, "s": d["s"], "l": d["l"]} for k, d in its if d["s"] + d["l"] >= 3][:6]
        mon = sorted(v["mon"].items())[-12:]
        sdet_out[stn] = {
            "items": its,
            "ben": [{"n": k, "c": c} for k, c in v["ben"].most_common(4)],
            "mon": [[m, c] for m, c in mon],
            "cmp": v["cmp"],
        }
    data["storeDetail"] = sdet_out

    # 지역 상세 — 매장과 동일 구조(표본 50건 이상)
    rdet_out = {}
    for rgn, v in rdet.items():
        if sum(v["mon"].values()) < 50:
            continue
        its = sorted(v["items"].items(), key=lambda kv: -(kv[1]["s"] + kv[1]["l"]))
        its = [{"n": k, "s": d["s"], "l": d["l"]} for k, d in its if d["s"] + d["l"] >= 5][:6]
        rdet_out[rgn] = {
            "items": its,
            "ben": [{"n": k, "c": c} for k, c in v["ben"].most_common(4)],
            "mon": [[m, c] for m, c in sorted(v["mon"].items())[-12:]],
            "cmp": v["cmp"],
        }
    data["regionDetail"] = rdet_out

    # 기간별 분석(표본이 너무 적은 항목은 제외해 노이즈 방지)
    per_out = {}
    for pk, pb in perbuk.items():
        rg = {k: v for k, v in pb["regions"].items() if v["s"] + v["l"] >= 3}
        # 신뢰구간이 없는 소표본은 우위/열세 순위에서 제외하도록 표본수를 함께 보관
        it = {k: v for k, v in pb["items"].items() if v["s"] + v["l"] >= 5}
        bn = {k: v for k, v in pb["ben"].items() if v["s"] + v["l"] >= 3}
        if not rg and not it:
            continue
        per_out[pk] = {"regions": rg, "items": it, "benefit": bn, "compare": pb["cmp"]}
    data["byPeriod"] = per_out

    # 기간별 매장 랭킹 / 매장·지역 품목 상세
    ps_out = {}
    for pk, byrg in per_store.items():
        rgs = {}
        for rg, sd in byrg.items():
            lst = [{"n": n, "s": v["s"], "l": v["l"]} for n, v in sd.items() if v["s"] + v["l"] >= 3]
            if lst:
                rgs[rg] = sorted(lst, key=lambda x: -(x["s"] + x["l"]))
        if rgs:
            ps_out[pk] = rgs
    data["periodStores"] = ps_out

    def top_items(d, minn=3, n=6):
        its = sorted(d.items(), key=lambda kv: -(kv[1]["s"] + kv[1]["l"]))
        return [{"n": k, "s": v["s"], "l": v["l"]} for k, v in its if v["s"] + v["l"] >= minn][:n]
    data["periodStoreItems"] = {pk: {st: top_items(d) for st, d in m.items() if top_items(d)}
                                for pk, m in per_sdet.items()}
    data["periodRegionItems"] = {pk: {rg: top_items(d, 5) for rg, d in m.items() if top_items(d, 5)}
                                 for pk, m in per_rdet.items()}

    with open(a.out, "w", encoding="utf-8") as f:
        f.write("/* build_web_data.py 자동생성 — 수정 금지. census 갱신 후 재실행할 것 */\n")
        f.write("window.CAFE_DATA = " + json.dumps(data, ensure_ascii=False) + ";\n")

    share = round(s_tot / (s_tot + l_tot) * 100, 1) if (s_tot + l_tot) else 0
    print(f"집계 완료 total {tot:,} · 삼성 {s_tot:,} / LG {l_tot:,} (삼성 {share}%)")
    print(f"월 {len(months_arr)}개 · 지역 {len(regions)}개 · 매장지역 {len(stores_out)}개")
    print(f"→ {a.out}")


if __name__ == "__main__":
    main()
