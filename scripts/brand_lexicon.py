# -*- coding: utf-8 -*-
"""브랜드 어휘 SSOT — 전 채널(카페·블로그·유튜브) 동일 기준 분류기.
   playwright 비의존(가벼움). 유통명 별칭 포함, LG 과소집계 방지가 핵심.
   삼성 중심 분석이나 LG도 정확히 잡아야 '과거 LG 우세→삼성 역전' 추세가 보인다.
"""
import re

# 삼성 별칭(유통명 포함). 과거 표기 디지털프라자·디지탈프라자까지.
SAMSUNG_PATTERNS = [
    r"삼성", r"samsung", r"비스포크", r"bespoke", r"패밀리허브", r"무풍", r"그랑데",
    r"삼성스토어", r"삼성전자", r"디지털프라자", r"디지탈프라자", r"삼성디지털", r"삼디프",
]
LG_PATTERNS = [
    # LG 라틴표기 — 한글 앞뒤(전자 등)에서도 잡히도록 \b 대신 라틴문자 경계 룩어라운드.
    r"(?<![A-Za-z])LG(?![A-Za-z])", r"엘지", r"엘쥐", r"엘지전자",
    r"오브제", r"디오스", r"트롬", r"tromm", r"워시타워", r"워시콤보",
    r"휘센", r"스타일러", r"styler", r"코드제로", r"퓨리케어",
    # LG 직영 유통 — 하이프라자(법인)/베스트샵(매장명)
    r"하이프라자", r"베스트\s*샵", r"lg\s*베스트샵",
]
# 멀티브랜드 유통(브랜드 단정 금지) — 단독 등장만으론 삼성/LG로 분류하지 않는다.
RETAILER_MULTI = [r"하이마트", r"롯데하이마트", r"전자랜드", r"e랜드", r"쿠팡"]

_SP = [re.compile(p, re.I) for p in SAMSUNG_PATTERNS]
_LP = [re.compile(p, re.I) for p in LG_PATTERNS]


def brand_flags(text):
    """(삼성여부, LG여부) 불리언 쌍."""
    t = text or ""
    return (any(p.search(t) for p in _SP), any(p.search(t) for p in _LP))


def brand_label(text):
    """단일 라벨: 삼성 / LG / 삼성·LG / 기타·미상."""
    s, l = brand_flags(text)
    if s and l:
        return "삼성·LG"
    if s:
        return "삼성"
    if l:
        return "LG"
    return "기타/미상"
