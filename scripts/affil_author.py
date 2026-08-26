#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""제휴카페 글의 **주체**를 가른다 — 당사 홍보 / 경쟁사 홍보 / 고객 글.

왜 따로 만드나
--------------
제휴카페는 지역 생활 커뮤니티라, 같은 게시판에 **가게가 올린 전단**과
**주민이 쓴 글**이 섞여 있다. 둘을 합쳐 세면 "가전 이야기 1,000건"이
사실은 하이마트 행사 공지 463건일 수 있다. 마케팅 물량과 고객 목소리는
다른 이야기다(블로그 협찬 분리와 같은 원칙).

판정 원칙
--------
1) **브랜드 낱말이 아니라 상호로 가른다.** "LG 노트북 초특가"는 LG 홍보가
   아니라 **하이마트**가 올린 글이다(실측: `하이마트 상남점 LG IT! 노트북
   초특가 행사안내`). 그래서 주체는 제목에 **가장 먼저 등장하는 상호**로 잡는다.
2) **고객 목소리가 홍보 문구를 이긴다.** `오늘 삼성스토어 양산점에서
   행사하나요?` 는 '행사'가 들어 있어도 고객 질문이다.
3) **애매하면 고객/일반으로 보낸다**(과잉 분류 금지). 홍보로 판정하려면
   상호가 있어야 하고, 상호가 없으면 무조건 일반 글이다.

한계(반드시 표기): 수집 레코드에 **작성자 닉네임이 없고 본문·요약도 비어
있다**(실측 4,880건 전량 summary/body 공란). 그래서 판정은 **제목 문면**
기준의 추정이다.
"""
import html as H
import io
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "artifacts", "affiliate")
TAG = re.compile(r"<[^>]+>")


def T(r):
    """제목 정규화 — 검색 API 의 <b> 강조와 HTML 엔티티를 걷어낸다."""
    return H.unescape(TAG.sub("", r.get("title") or "")).strip()


# ── 상호 사전 ────────────────────────────────────────────────
# '삼성'·'LG' 같은 브랜드 낱말은 넣지 않는다. 가게 이름만 넣는다.
# 주의: `이마트` 는 `하이마트` 의 부분문자열이다 — 실측에서 하이마트 619건이
#       통째로 이마트로 잡혔다. 부정형 후방탐색으로 막는다.
RETAILERS = [
    ("삼성스토어", re.compile(r"삼성\s*스토어|삼성전자\s*스토어|삼성전자판매|디지[털탈]\s*프라자|삼성\s*디지털\s*프라자", re.I)),
    ("LG베스트샵", re.compile(r"(?:LG|엘지|엘쥐)\s*(?:전자\s*)?베스트\s*[샵샾숍]|베스트\s*[샵샾]|하이프라자", re.I)),
    ("하이마트", re.compile(r"(?:롯데\s*)?하이\s*마트", re.I)),
    ("전자랜드", re.compile(r"전자\s*랜드", re.I)),
    ("이마트·홈플러스", re.compile(r"(?<!하)이마트|홈플러스|트레이더스|메가마트", re.I)),
    ("온라인몰", re.compile(r"쿠팡|11번가|지마켓|G마켓|옥션|위메프|티몬|네이버\s*쇼핑|오늘의집", re.I)),
    ("백화점", re.compile(r"백화점|아울렛", re.I)),
]
OURS = "삼성스토어"
COMPETITORS = ["LG베스트샵", "하이마트", "전자랜드", "이마트·홈플러스", "온라인몰", "백화점"]

# ── 고객 목소리 ──────────────────────────────────────────────
# R1 상담·질문
# `알려주` 를 통째로 넣으면 `전문가가 알려주는 …` 같은 **가게 홍보문**이 고객
# 질문으로 샌다(실측). 청유 어미까지 함께 요구한다. `추천해` 도 같은 이유로 좁혔다.
ASK = re.compile(r"어디가|어디서|어디에|어느\s*곳|추천\s*좀|추천\s*해\s*주|추천\s*부탁|추천\s*바랍|"
                 r"아시는\s*분|계신가요|"
                 # `만나요`(가게가 손님을 부르는 말)가 `나요` 질문형으로 샜다 — 막는다
                 r"(?<!만)나요\?|(?<!만)나요$|까요|은지요|는지\s*아|궁금|문의\s*드|알려\s*주(?:세요|실|시|셔|십|져|줘)|여쭤|여쭙|어때요|어떤가요|"
                 r"어떨까|괜찮을까|살까요|어느게|뭐가\s*좋", re.I)
# R2 구매·사용 경험
# `구매` 를 통째로 넣으면 `동시구매혜택 받아가세요` 같은 홍보문이 샌다 —
# 어미가 붙은 형태와 **제목 끝의 명사형**만 인정한다(`… 냉장고구매`).
EXP = re.compile(r"후기|샀어요|샀는데|샀네|구입했|구매했|구매\s*완료|구매\s*후기|구매해\s*드|시공했|"
                 r"써보니|써봤|사용중|사용해\s*보|들였|장만했|받았어요|설치했|배송\s*왔|바꿨|교체했|"
                 r"수령했|수령해|다녀왔|갔어요|사왔|질렀|받아갑니다|개시|"
                 r"(?:구매|구입|계약|개통|수령|예약|주문)\s*하?[였했]|"
                 r"(?:구매|구입|계약|개통|수령)\s*(?:완료)?\s*$", re.I)
# 매장 직원을 **실명·호칭으로 부르는 글**은 고객이 쓴 글이다(가게 공지는 자기
# 직원을 `님` 으로 부르지 않는다). 다결 채널의 매니저 실명 축과 같은 신호다.
STAFF = re.compile(r"디테일러|프로님|프로께|담당자님|담당자\s*님|매니저님|과장님|점장님|실장님|팀장님|사원님", re.I)
# R3 구어체 감상 — 가게 공지에는 거의 안 쓰이는 말투
COLLOQ = re.compile(r"네요|더라구|더라고|던데|겠어요|같아요|좋아요|ㅠ|ㅜ|ㅋㅋ|ㅎㅎ|다녀왔|가봤|"
                    r"잠시\s*왔|난리|가지$", re.I)

# ── 가게 목소리 ──────────────────────────────────────────────
# R4 대괄호 머리표(`[롯데하이마트 메가스토어 상남점] …`) — 정기 공지의 서식
# 머리표 안에 **상호가 들어 있을 때만** 인정한다. 괄호로 시작한다는 것만으로는
# 부족하다 — `(바로입주가능) … LG베스트샵 근처 원룸 내놓습니다` 같은 부동산 글이
# 경쟁사 홍보로 잡혔다(실측).
HEAD = re.compile(r"^\s*[\[\(<【]([^\]\)>】]{0,40})[\]\)>】]")
# R5 상호 + 지점명 — 가게가 자기 점포를 밝히는 형식
# `\b` 를 쓰면 안 된다: `김해내동점에서` 는 점과 에가 모두 \w 라 경계가 없어
# 매치에 실패한다(실측에서 하이마트 홍보글이 고객 글로 샜다). 조사를 열거한다.
BRANCH = re.compile(r"(?:[가-힣A-Za-z]{2,10}\s*점|본점|지점)(?=$|[\s\W]|에|은|는|이|을|의|과|도|만|까|부|서)"
                    r"|메가스토어")
# R6 판촉 문구
PROMO = re.compile(r"행사|특가|세일|SALE|할인|이벤트|사전\s*예약|예약\s*판매|오픈|OPEN|그랜드|한정|선착순|"
                   r"증정|사은품|프로모션|페스타|페스티벌|festival|박람회|기획전|특별전|대전|장터|초대|"
                   r"초청|입주민|공동\s*구매|공구|팝업|런칭|출시\s*기념|인사\s*드립|안내\s*드립|안내|"
                   r"지점장|점장|방문해\s*주|오시면|문의\s*주세요|연락\s*주세요|모십니다|혜택|최저가|"
                   r"반값|경품|추첨|쿠폰|마감임박|드립니다|"
                   # 불특정 다수를 향한 청유·명령형 — 가게 화법. 고객의 `알려주세요`
                   # 류는 R1(상담·질문)에서 이미 걸러진 뒤라 안전하다.
                   r"[가-힣]{0,6}하세요|(?:보|오|받|만나|사|들|잡|누리|챙기)세요|해\s*보세요|받아\s*보|만나\s*보", re.I)

# R2 판촉 전용어 — 고객이 쓸 일이 거의 없는 말. 의문형 홍보문
# (`로봇청소기 어디서 구매할지 고민인가요?? 롯데하이마트 …페스타가 시작됩니다`)이
# 질문 규칙에 새는 것을 막는다. 구매 경험(R1)에는 양보한다 — `사전예약후기` 는 고객 글이다.
STRONG = re.compile(r"선착순|사은품|사전\s*예약|한정\s*수량|지점장|점장\s*추천|페스타|페스티벌|"
                    r"초특가|경품|추첨|증정|입주민|박람회|공동\s*구매|그랜드\s*오픈|GRAND\s*OPEN|"
                    r"인사\s*드립|안내\s*드립|모십니다|기획전", re.I)

CLASSES = ["ad_own", "ad_comp", "cust_ret", "cust_own", "plain"]
CLASS_LABEL = {
    "ad_own": "당사 광고·홍보",
    "ad_comp": "경쟁사 광고·홍보",
    "cust_ret": "고객 글 — 타 유통 언급",
    "cust_own": "고객 글 — 당사 언급",
    "plain": "고객 글 — 일반",
}


def subject_of(title):
    """제목에 **가장 먼저** 등장하는 상호 = 그 글의 주체. 없으면 None."""
    subj, pos, seen = None, 10 ** 9, []
    for name, rx in RETAILERS:
        m = rx.search(title)
        if m:
            seen.append(name)
            if m.start() < pos:
                subj, pos = name, m.start()
    return subj, seen


def classify(title):
    """제목 → {cls, rule, subj, rets}. rule 은 어느 규칙이 잡았는지(실측표용)."""
    subj, rets = subject_of(title)
    if subj is None:
        return {"cls": "plain", "rule": "R0 상호없음", "subj": None, "rets": []}

    cust = "cust_own" if subj == OURS else "cust_ret"
    ad = "ad_own" if subj == OURS else "ad_comp"
    if STAFF.search(title):
        return {"cls": cust, "rule": "R1 담당자 실명·호칭", "subj": subj, "rets": rets}
    if EXP.search(title):
        return {"cls": cust, "rule": "R2 구매·사용경험", "subj": subj, "rets": rets}
    if STRONG.search(title):
        return {"cls": ad, "rule": "R3 판촉 전용어", "subj": subj, "rets": rets}
    if ASK.search(title):
        return {"cls": cust, "rule": "R4 상담·질문", "subj": subj, "rets": rets}
    if COLLOQ.search(title):
        return {"cls": cust, "rule": "R5 구어체 감상", "subj": subj, "rets": rets}
    hm = HEAD.match(title)
    if hm and subject_of(hm.group(1))[0] is not None:
        return {"cls": ad, "rule": "R6 머리표 서식", "subj": subj, "rets": rets}
    if PROMO.search(title):
        return {"cls": ad, "rule": "R7 판촉 문구", "subj": subj, "rets": rets}
    if BRANCH.search(title):
        return {"cls": ad, "rule": "R8 상호+지점명", "subj": subj, "rets": rets}
    return {"cls": cust, "rule": "R9 단순 언급", "subj": subj, "rets": rets}


def load_rows():
    rows = []
    for f in sorted(os.listdir(SRC_DIR)):
        if not f.endswith(".json"):
            continue
        rs = json.load(io.open(os.path.join(SRC_DIR, f), encoding="utf-8"))
        if isinstance(rs, dict):
            rs = rs.get("items") or list(rs.values())[0]
        for r in rs:
            r["_slug"] = f[:-5]
            rows.append(r)
    return rows
