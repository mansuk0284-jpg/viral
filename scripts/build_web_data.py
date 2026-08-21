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
    "대구": ["대구", "동성로", "범어", "성서", "칠곡", "반월당"],   # 수성=구 이름, 지점명 아님
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
COMPARE_RE = re.compile("발품|비교|고민|둘러")
# 불만·리스크 신호(매장 방어 포인트) / 계약 금액
NEG_RE = re.compile("불친절|실망|최악|짜증|환불|취소|하자|고장|지연|늦게|안와|기다렸|불만|후회")
PRICE_RE = re.compile(r"(\d{3,4})\s*만\s*원")          # 경쟁 접점(비교 상담) 신호
BENEFITS = {
    "사은품": ["사은품", "증정"], "체감가": ["체감가", "실구매가", "최저가"],
    "페이백·상품권": ["페이백", "온누리", "상품권"], "카드할인": ["카드할인", "청구할인", "무이자"],
    "임직원가": ["임직원", "직원가"], "전시품": ["전시품", "전시상품"],
}

# 팩트 테이블 비트 순서 — 웹에서 그대로 쓰므로 순서를 바꾸면 재생성 필요
ITEM_KEYS = list(ITEMS)
BEN_KEYS = list(BENEFITS)

RETAILERS = {
    "삼성스토어": ["삼성스토어", "디지털프라자", "디지탈프라자", "삼성전자판매"],
    "LG베스트샵": ["베스트샵", "베스트샾", "하이프라자", "LG전자베스트"],
    "백화점": ["백화점", "롯데", "신세계", "현대백", "갤러리아", "AK플라자"],
    "하이마트": ["하이마트", "롯데하이마트"],
}
RET_RE = {k: re.compile("|".join(v)) for k, v in RETAILERS.items()}
RET_KEYS = list(RETAILERS)


def text_of(r):
    return (r.get("title") or "") + " " + (r.get("summary") or "") + " " + (r.get("body_excerpt") or "")


def region_of(txt):
    for k, rx in SIDO_RE.items():
        if rx.search(txt):
            return k
    return None


# 시도명은 원칙적으로 지점명이 아니다(예: '현대 서울'은 실재하지 않음).
# 다만 '신세계 대구'처럼 도시명이 곧 지점명인 실제 매장은 화이트리스트로 허용한다.
SIDO_NAMES = set(SIDO.keys())
CITY_STORE_OK = {
    ("신세계", "대구"), ("롯데", "대구"), ("현대", "대구"),
    ("롯데", "인천"), ("신세계", "인천"), ("현대", "인천"),
    ("신세계", "대전"), ("롯데", "대전"), ("갤러리아", "대전"),
    ("신세계", "광주"), ("롯데", "광주"),
    ("롯데", "울산"), ("현대", "울산"),
    ("롯데", "부산"), ("신세계", "부산"),
}
# 고유 표기 매장(체인+지점 조합으로는 안 잡히는 실제 매장)
# 표기 흔들림을 하나의 실제 매장으로 정규화(앞에 있는 규칙이 우선)
SPECIAL_STORES = [
    # 부산 — 센텀은 신세계/롯데가 별개 매장이므로 구분
    (["롯데센텀", "롯데 센텀"], "롯데 센텀시티"),
    (["신세계센텀", "신세계 센텀", "센텀시티", "센텀 시티"], "신세계 센텀시티"),
    (["롯데부산본점", "부산본점", "롯데부산", "롯데 부산", "부산 롯데", "부산본점롯데"], "롯데 부산본점"),
    (["롯데광복", "롯데 광복", "광복점", "광복 롯데"], "롯데 광복"),
    (["롯데동래", "롯데 동래", "동래점", "동래 롯데"], "롯데 동래"),
    (["롯데서면", "롯데 서면", "서면점", "서면 롯데"], "롯데 부산본점"),  # 서면 소재 = 부산본점
    # 울산 — 현대백화점(삼산), 롯데(울산)
    (["울산현대백화점", "울산 현대백화점", "현대 울산", "울산 현백", "울산현백",
      "현대백화점 울산", "현대삼산", "현대 삼산", "삼산 현대"], "현대 울산"),
    (["롯데울산", "롯데 울산", "울산 롯데", "울산롯데"], "롯데 울산"),
    # 대구·대전·광주·인천 — 도시 대표 백화점(고유 표기 우선)
    (["동대구", "신세계 대구", "신세계대구"], "신세계 대구"),
    (["타임월드", "갤러리아 대전", "갤러리아대전"], "갤러리아 타임월드"),
    (["아트앤사이언스", "신세계 대전", "신세계대전"], "신세계 대전"),
    (["롯데 대전", "롯데대전"], "롯데 대전"),
    (["신세계 광주", "신세계광주", "광주신세계"], "신세계 광주"),
    (["롯데 광주", "롯데광주"], "롯데 광주"),
    (["롯데 인천", "롯데인천", "인천 롯데"], "롯데 인천"),
    (["신세계 인천", "신세계인천"], "신세계 인천"),
    (["현대 중동", "중동 현대", "현대중동"], "현대 중동"),
    # 서울·수도권 대표 표기
    (["더현대서울", "더 현대 서울", "더현대 서울"], "더현대 서울"),
    (["더현대대구", "더현대 대구"], "더현대 대구"),
    (["롯데본점", "롯백 본점", "소공동", "명동 롯데"], "롯데 본점"),
    (["신세계본점", "신세계 본점"], "신세계 본점"),
    (["현대본점", "현대 본점", "압구정본점"], "현대 압구정"),
]


# 체인+지점 조합으로 나온 이름을 표준 매장명으로 흡수
ALIAS_FIX = {
    "신세계 센텀": "신세계 센텀시티",
    "롯데 센텀": "롯데 센텀시티",
    "현대 삼산": "현대 울산",
    "롯데 삼산": "롯데 울산",
    "롯데 부산": "롯데 부산본점",
    "롯데 서면": "롯데 부산본점",          # 롯데 부산본점이 서면 소재 — 별도 매장 아님
    "갤러리아 대전": "갤러리아 타임월드",   # 대전 갤러리아 = 타임월드
    "현대 대구": "더현대 대구",             # 대구 현대 = 더현대 대구
    "롯데 명동": "롯데 본점",               # 롯데 본점(소공동/명동)
    "현대 압구정본점": "현대 압구정",
    "갤러리아 수원": "갤러리아 광교",       # 갤러리아 광교가 수원 광교 소재
}
# 백화점이 아니거나 실재하지 않는 조합 — 매장 집계에서 제외
STORE_EXCLUDE = {
    "신세계 부산",     # 신세계 부산 프리미엄 아울렛(기장) — 백화점 아님
    "롯데 부산",       # 별칭으로 흡수되지만 방어적으로 유지
}
# 매장명 자체가 지역을 결정한다(지점 토큰 → 시도). 본문 지역추정보다 우선.
STORE_REGION = {}
for _rg, _kws in SIDO.items():
    for _k in _kws:
        STORE_REGION.setdefault(_k, _rg)


def dept_store_of(txt):
    """실제 지점명으로 정규화. 시도명 단독(예: 현대+서울)은 지점으로 보지 않는다."""
    for kws, name in SPECIAL_STORES:      # 1) 고유 표기 우선
        if any(k in txt for k in kws):
            return ALIAS_FIX.get(name, name)
    for chain, alias in CHAINS.items():   # 2) 체인 + 실제 지점 토큰
        for a in alias:
            i = txt.find(a)
            if i < 0:
                continue
            # 지점명은 체인명 뒤('롯데 창원')뿐 아니라 앞('창원 롯데백화점')에도 온다
            window = txt[max(0, i - 10):i + 14]
            for b in BRANCH_TOKENS:
                if b in SIDO_NAMES and (chain, b) not in CITY_STORE_OK:
                    continue                  # 실재하지 않는 조합(예: 현대+서울)만 제외
                if b in window:
                    nm = f"{chain} {b}"
                    return ALIAS_FIX.get(nm, nm)
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
    # 신규 분석축: 패키지 규모(품목 수) / 불만 신호 / 계약 금액
    ext_store = defaultdict(lambda: {"pkg": [], "neg": 0, "tot": 0, "price": []})
    ext_region = defaultdict(lambda: {"pkg": [], "neg": 0, "tot": 0, "price": []})

    # ── 일(日) 단위 팩트 테이블 ──
    # 기간 탭(전체/연도/월)은 미리 집계해 두면 되지만, 사용자가 날짜를 직접 지정하는
    # 임의 구간(예: 2025-03-15 ~ 2026-02-20)은 미리 만들 수 없다. 그래서 후기 1건을
    # (일자, 브랜드, 위치, 품목비트, 혜택비트, 플래그) 튜플로 압축해 두고
    # 화면에서 구간을 잘라 그때그때 합산한다. 같은 튜플은 건수로 접어 크기를 줄인다.
    fact_rows = Counter()
    # 조회수(히트) — 후기 '건수'만큼 중요하다. 한 건이 몇 명에게 읽혔는지가 실제 노출량이다
    # (사용자 지시 2026-08-21). 같은 팩트 키에 조회수를 함께 쌓아 기간·매장별로 자를 수 있게 한다.
    fact_hits = Counter()
    fact_day = {}       # 원본 날짜 문자열 보관용(최소·최대 산출)
    hit_tot = hit_s = hit_l = 0     # 조회수(히트) — 전체 / 삼성 / LG
    hit_have = 0                    # 조회수를 가진 레코드 수(보강 진행률 표시용)
    fact_price = []     # 계약 금액은 언급이 드물어(수백 건) 별도 희소 목록으로 보관
    fact_name = []      # 매니저 실명(후기 스타) — 매장 귀속 삼성 후기만

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
        # 팩트 테이블용 — 이 후기의 위치(지역/매장)는 아래 매칭 블록에서 확정된다
        f_day = (r.get("addDate") or "")[:10]
        f_rg = f_srg = f_st = None

        tot += 1
        # 조회수 — 아직 보강 안 된 과거 레코드는 필드가 없다(0으로 센다)
        _h = int(r.get("readCount") or 0)
        if "readCount" in r:
            hit_have += 1
        hit_tot += _h
        if single_s:
            hit_s += _h
        elif single_l:
            hit_l += _h
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
            f_rg = rg
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
            # 신규 축 — 지역 단위
            nItem = sum(1 for kws in ITEMS.values() if any(w in txt for w in kws))
            isNeg = bool(NEG_RE.search(txt))
            pm = PRICE_RE.search(txt)
            pv = int(pm.group(1)) if pm else 0
            er = ext_region[rg]
            er["tot"] += 1
            if nItem:
                er["pkg"].append(nItem)
            if isNeg:
                er["neg"] += 1
            if 200 <= pv <= 5000:
                er["price"].append(pv)

            st = dept_store_of(txt)           # 매장은 백화점만
            if st in STORE_EXCLUDE:
                st = None
            if st == "롯데 본점" and rg == "부산":
                st = "롯데 부산본점"           # 부산에서 '롯데 본점'은 부산본점
            if st:
                # 지점 토큰이 다른 시도를 가리키면 그 시도로 재배정(예: 서울 글에 '롯데 수성')
                _br = st.split(" ")[-1]
                _rg2 = STORE_REGION.get(_br)
                if not _rg2:                    # '부산본점'처럼 복합 토큰 처리
                    for _tk, _r in STORE_REGION.items():
                        if _tk in _br:
                            _rg2 = _r
                            break
                if _rg2 and _rg2 != rg:
                    rg = _rg2
                # 지역 축(regions/byPeriod)은 본문 추정 지역을, 매장 축(stores)은
                # 지점 토큰으로 재배정한 지역을 쓴다 — 기존 집계와 같은 기준을 유지한다
                f_srg, f_st = rg, st
                es = ext_store[st]
                es["tot"] += 1
                if nItem:
                    es["pkg"].append(nItem)
                if isNeg:
                    es["neg"] += 1
                if 200 <= pv <= 5000:
                    es["price"].append(pv)
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

        # ── 팩트 행 적재(임의 기간 집계용) ──
        # 삼성·LG를 함께 언급한 후기(양쪽)는 브랜드 승패에는 넣지 않지만
        # 총건수·유통 언급에는 들어간다 — 원본 집계와 같은 기준을 맞추려면
        # 팩트에도 실어야 한다(브랜드 코드 2 = 양쪽).
        hits = int(r.get("readCount") or 0)     # 없던 시절 레코드는 0
        if (not bk) and f_day:
            rt2 = 0
            for _i, _nm in enumerate(RET_KEYS):
                if RET_RE[_nm].search(txt):
                    rt2 |= 1 << _i
            _k2 = (f_day, 2, "", "", "", 0, 0, 0, rt2)
            fact_rows[_k2] += 1
            fact_hits[_k2] += hits
            fact_day[f_day] = 1
        if bk and f_day:
            im = 0
            for _i, _nm in enumerate(ITEM_KEYS):
                if any(w in txt for w in ITEMS[_nm]):
                    im |= 1 << _i
            bnm = 0
            for _i, _nm in enumerate(BEN_KEYS):
                if any(w in txt for w in BENEFITS[_nm]):
                    bnm |= 1 << _i
            fl = (1 if COMPARE_RE.search(txt) else 0) \
                | (2 if hasMgr else 0) \
                | (4 if NEG_RE.search(txt) else 0)
            rt = 0
            for _i, _nm in enumerate(RET_KEYS):
                if RET_RE[_nm].search(txt):
                    rt |= 1 << _i
            _k = (f_day, 0 if bk == "s" else 1, f_rg or "", f_srg or "", f_st or "",
                  im, bnm, fl, rt)
            fact_rows[_k] += 1
            fact_hits[_k] += hits
            fact_day[f_day] = 1
            _pm = PRICE_RE.search(txt)
            if _pm and 200 <= int(_pm.group(1)) <= 5000:
                fact_price.append([f_day, f_rg or "", f_srg or "", f_st or "", int(_pm.group(1))])
            # 후기 스타 — 매장이 특정된 삼성 후기의 매니저 실명만(우리 매장 인물 지표)
            if f_st and bk == "s" and hasMgr:
                for _nm, _tt in MGR_NAME.findall(txt):
                    if _nm not in NOT_NAME and len(_nm) >= 2:
                        fact_name.append([f_day, f_rg or "", f_srg or "", f_st, _nm + " " + _tt])

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
        # 조회수(히트) — 후기가 몇 명에게 읽혔나. 건수만으로는 노출량을 알 수 없다.
        # have 는 조회수를 가진 레코드 수 — 보강이 진행 중이면 total 보다 작다.
        "hits": {"total": hit_tot, "s": hit_s, "l": hit_l,
                 "have": hit_have, "of": tot},
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

    def ext_out(src, minn):
        o = {}
        for k, v in src.items():
            if v["tot"] < minn:
                continue
            pk = sorted(v["pkg"]); pr = sorted(v["price"])
            o[k] = {
                "tot": v["tot"],
                "pkgAvg": round(sum(pk) / len(pk), 1) if pk else 0,
                "pkgBig": sum(1 for x in pk if x >= 4),          # 4개 이상 대형 묶음
                "negRate": round(v["neg"] / v["tot"] * 100, 1),
                "neg": v["neg"],
                "priceMid": pr[len(pr) // 2] if pr else 0,
                "priceN": len(pr),
            }
        return o
    data["extStore"] = ext_out(ext_store, 30)
    data["extRegion"] = ext_out(ext_region, 100)

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

    # ── 일 단위 팩트 테이블 직렬화 ──
    # 매장은 화면에 쓰는 매장(표본 기준 통과분)만 싣는다. 그 외는 지역까지만 인정.
    # 화면에 이름이 뜨는 매장 = 전역 목록 ∪ 기간별 목록(기간을 좁히면 전역 최소표본에
    # 못 미치는 매장도 그 기간에는 유효한 표본이 된다)
    ok_stores = sorted({x["n"] for lst in stores_out.values() for x in lst}
                       | {x["n"] for m in ps_out.values() for lst in m.values() for x in lst})
    rg_list = sorted({k for k in regions})
    rg_ix = {n: i for i, n in enumerate(rg_list)}
    st_ix = {n: i for i, n in enumerate(ok_stores)}

    # 위치 코드 = 실제로 나타난 (지역, 매장지역, 매장) 조합의 목록 인덱스.
    # 매장에서 지역을 역산하면 안 된다 — '롯데 본점'처럼 서울·경기 양쪽에
    # 걸친 표기가 있어 한쪽으로 몰리면 지역 집계가 어긋난다.
    loc_ix = {(-1, -1, -1): 0}
    loc_list = [[-1, -1, -1]]

    def loc_of(rgn, srg, stn):
        ri = rg_ix.get(rgn, -1) if rgn else -1
        si = st_ix.get(stn, -1) if stn else -1
        sr = rg_ix.get(srg, -1) if (srg and si >= 0) else -1
        if si < 0:
            sr = -1
        key = (ri, sr, si)
        if key not in loc_ix:
            loc_ix[key] = len(loc_list)
            loc_list.append([ri, sr, si])
        return loc_ix[key]

    days = sorted(fact_day)
    d0 = days[0] if days else "2021-01-01"
    from datetime import date, timedelta
    y0, m0, dd0 = (int(x) for x in d0.split("-"))
    base = date(y0, m0, dd0)
    span = (date(*(int(x) for x in days[-1].split("-"))) - base).days + 1 if days else 0

    prepped = []
    for _key, cnt in fact_rows.items():
        (day, b, rgn, srg, stn, im, bnm, fl, rt) = _key
        idx = (date(*(int(x) for x in day.split("-"))) - base).days
        prepped.append((idx, b, loc_of(rgn, srg, stn), im, bnm, fl, rt, cnt,
                        fact_hits.get(_key, 0)))
    # 위치 코드는 아래 비트 폭 계산 전에 모두 확정돼야 한다(나중에 늘면 폭이 모자란다)
    pr_prepped = [[(date(*(int(x) for x in p[0].split("-"))) - base).days,
                   loc_of(p[1], p[2], p[3]), p[4]] for p in fact_price]
    nm_list, nm_ix = [], {}
    nm_prepped = []
    for p in fact_name:
        if p[4] not in nm_ix:
            nm_ix[p[4]] = len(nm_list)
            nm_list.append(p[4])
        nm_prepped.append([(date(*(int(x) for x in p[0].split("-"))) - base).days,
                           loc_of(p[1], p[2], p[3]), nm_ix[p[4]]])

    # 비트 폭은 사전 크기에서 계산해 데이터에 함께 싣는다.
    # (품목·혜택·매장이 늘면 폭도 같이 늘어야 한다. 고정값으로 두면 넘친 비트가
    #  옆 필드를 오염시켜 조용히 틀린 집계가 나온다 — 실제로 혜택 6종/5비트에서 발생)
    W_BR = 2                       # 0=삼성 1=LG 2=양쪽
    W_LOC = max(1, (len(loc_list) - 1).bit_length())
    W_IT, W_BN, W_FL, W_RT = len(ITEM_KEYS), len(BEN_KEYS), 3, len(RET_KEYS)
    SH_LOC, SH_IT = W_BR, W_BR + W_LOC
    SH_BN = SH_IT + W_IT
    SH_FL = SH_BN + W_BN
    SH_RT = SH_FL + W_FL
    W_DAY = max(1, max(0, span - 1).bit_length())
    # 32비트를 넘으므로 웹에서는 나눗셈으로 푼다(JS 비트연산은 32비트까지).
    # 2^53 안이면 안전 — 여유가 큰지 확인만 해 둔다.
    assert SH_RT + W_RT <= 45, "팩트 비트 폭 초과 — 인코딩 재설계 필요"

    buckets = [[] for _ in range(span)]
    for idx, b, loc, im, bnm, fl, rt, cnt, hits in prepped:
        v = b | (loc << SH_LOC) | (im << SH_IT) | (bnm << SH_BN) | (fl << SH_FL) | (rt << SH_RT)
        buckets[idx].append((v, cnt, hits))

    def enc(cell):
        """v[*cnt][~hits] — 건수 1이면 *cnt 생략, 조회수 0이면 ~hits 생략.
        예전 형식(v, v*cnt)과 그대로 호환되므로 웹 디코더만 ~ 를 알면 된다."""
        v, cnt, hits = cell
        out = format(v, "x")
        if cnt != 1:
            out += "*" + format(cnt, "x")
        if hits:
            out += "~" + format(hits, "x")
        return out

    data["fact"] = {
        "d0": d0,
        "d1": days[-1] if days else d0,
        "rg": rg_list,
        "st": ok_stores,
        "loc": loc_list,          # [지역idx, 매장지역idx, 매장idx] — -1은 해당 없음
        "it": ITEM_KEYS,
        "bn": BEN_KEYS,
        "rt": RET_KEYS,
        "sh": {"br": 0, "loc": SH_LOC, "it": SH_IT, "bn": SH_BN, "fl": SH_FL, "rt": SH_RT},
        "w": {"br": W_BR, "loc": W_LOC, "it": W_IT, "bn": W_BN, "fl": W_FL, "rt": W_RT},
        "rows": [",".join(enc(c) for c in b) for b in buckets],
        "pr": pr_prepped,          # 계약 금액 — [일자offset, 위치코드, 금액(만원)] (329건, 그대로)
        "nm": nm_list,             # 매니저 실명 사전
        # 실명 태그는 6천여 건이라 [일자·위치·이름]을 한 정수로 눌러 담는다
        "nmr": ",".join(format(p[0] | (p[1] << W_DAY) | (p[2] << (W_DAY + W_LOC)), "x")
                        for p in nm_prepped),
        "nmw": {"day": W_DAY, "loc": W_LOC},
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
