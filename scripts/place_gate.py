#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""네이버 플레이스 수집분 → 분석 대상 거르기 (공용 SSOT)

왜 따로 뺐나:
  build_naver_review_web.py(화면)와 naver_review_insight.py(리포트)가
  각자 데이터를 읽는 바람에 **화면 119곳 / 리포트 130곳**으로 갈라졌다.
  같은 자료로 만든 두 산출물의 수가 다르면 어느 쪽도 못 믿는다.
  거르는 규칙은 여기 한 곳에만 둔다.

전수 감사(2026-08-21, 139곳 수집)에서 확인한 오염:
  · 검색이 백화점 밖 단독점을 물어왔다 — 'LG 트윈타워점'(LG 사옥), '대전본점', '안동본점'
  · 모바일(MX) 매장이 잡혔다 — LG 에는 대응 매장이 없어 비교가 성립하지 않는다(사용자 지시)
  · 같은 플레이스가 검색어 둘로 중복 — '더현대 서울' = '현대 여의도'

주소로는 못 거른다. 백화점 도로명 주소에는 백화점 이름이 안 들어가서
멀쩡한 71곳이 걸린다. **상호(place.name)를 기준으로 삼는다.**
"""
import re

# AK 는 상호가 "AK PLAZA 원주점"(LG)과 "AK 수원"(삼성) 둘 다라 접두만 본다
# 대백프라자는 대구 지역 백화점이라 체인명이 안 들어간다 — 명부에 있으므로 통과시킨다
DEPT_RE = re.compile(r"롯데|신세계|현대|갤러리아|AK|타임빌라스|스타시티|스타점"
                     r"|사우스시티|타임스퀘어|센터시티|명품관|대백")

# 같은 백화점을 다른 이름으로 부르는 경우 — 안 묶으면 '삼성만/LG만'으로 갈라져
# 정작 비교가 안 된다(더현대 서울에 삼성, 현대 여의도에 LG 로 잡혔다)
DEPT_ALIAS = {
    "현대 여의도": "더현대 서울",
    "신세계 천안": "신세계 아산",      # 상호는 둘 다 '신세계 천안아산'
}


def norm_dept(d):
    return DEPT_ALIAS.get(d, d)


CHAIN_RE = re.compile(r"롯데|신세계|현대|갤러리아|AK|대백")


def _chain(s):
    """이름에서 백화점 체인만 뽑는다. '더현대'는 현대로 읽힌다."""
    m = CHAIN_RE.search(str(s) or "")
    return m.group(0) if m else None


def gate(rec):
    """(통과여부, 사유). 사유는 산출물에 남겨 왜 뺐는지 설명한다."""
    nm = (rec.get("place") or {}).get("name") or ""
    if "모바일" in nm:
        return False, "모바일(MX) 매장 — LG 대응 없음"
    if not DEPT_RE.search(nm):
        return False, "백화점 밖 단독점 — 상호에 백화점 없음"
    # 붙인 이름표와 실제 상호의 백화점 체인이 다르면 검색이 엉뚱한 곳을 문 것이다.
    # 실측(2026-08-21): '분당 삼성스토어 백화점' 이 '삼성스토어 현대 판교'를 물어와
    # '롯데 분당' 이라는 이름표를 달 뻔했다. 이대로 집계하면 매장이 통째로 뒤바뀐다.
    want, have = _chain(rec.get("dept", "")), _chain(nm)
    if want and have and want != have:
        return False, f"이름표({want}) ≠ 실제 상호({have}) — 검색 오매칭"
    return True, ""


def dedup(recs):
    """같은 플레이스가 검색어 둘로 잡히면 하나만 남긴다.
    상호에 든 백화점 표기와 더 많이 겹치는 쪽을 정본으로 삼는다."""
    by = {}
    for r in recs:
        pid = (r.get("place") or {}).get("id")
        if pid not in by:
            by[pid] = r
            continue
        score = lambda x: len(set(x.get("dept", "")) & set((x.get("place") or {}).get("name") or ""))
        if score(r) > score(by[pid]):
            by[pid] = r
    return list(by.values())


def sift(recs):
    """수집 전량 → (분석대상, 탈락목록, 중복제거수). 두 산출물이 똑같이 이걸 쓴다."""
    raw = len(recs)
    recs = dedup(recs)
    dups = raw - len(recs)
    keep, dropped = [], []
    for r in recs:
        ok, why = gate(r)
        if ok:
            r["dept"] = norm_dept(r.get("dept", ""))
            keep.append(r)
        else:
            dropped.append(((r.get("place") or {}).get("name"), r.get("dept", ""), why))
    return keep, dropped, dups

# ─────────────────────────────────────────────────────────────────────────
# 백화점 명부 = data/백화점 리스트.xlsx (→ artifacts/compete.json)
#
# 사용자 지시(2026-08-21): "매장 수와 lg(x사) 대응점은 첨부자료가 확실하니깐
# 정확하게 반영해야 해". 그래서 **첨부자료가 이름과 매장 수의 정본**이다.
# 네이버 검색이 부르는 이름은 제각각이라(롯데 부산본점 / 롯데 부천 / 더현대 서울)
# 명부 이름으로 맞춰야 경쟁력 자료와 짝이 맞는다.
# ─────────────────────────────────────────────────────────────────────────

# 네이버 수집 dept → 첨부자료 명부 이름
TO_ROSTER = {
    "롯데 부산본점": "롯데부산",       "롯데 부천": "롯데중동",
    "롯데 건대": "롯데스타시티",       "롯데 김포": "롯데김포공항",
    "더현대 서울": "현대서울",         "더현대 대구": "현대대구",
    "현대 압구정": "현대본점",         "갤러리아 압구정": "갤러리아본점",
    "현대 무역센터": "현대무역",       "현대 청주": "현대충청",
    "신세계 죽전": "신세계사우스시티", "신세계 아산": "신세계천안아산",
    "갤러리아 천안": "갤러리아센터시티", "현대 일산": "현대킨텍스",
    "신세계 영등포": "신세계타임스퀘어",
    "롯데 메종동부산": "롯데메종동부산점",   # 명부는 '점'까지 붙여 쓴다
}


def roster_name(dept):
    """네이버가 부르는 이름 → 명부 이름. 명부에 없으면 공백만 지워 돌려준다."""
    d = norm_dept(dept)
    if d in TO_ROSTER:
        return TO_ROSTER[d]
    return d.replace(" ", "")


def load_roster(root):
    """명부(양사 입점 백화점) 이름 집합. compete.json 이 없으면 빈 집합."""
    import json
    import os
    f = os.path.join(root, "artifacts", "compete.json")
    if not os.path.isfile(f):
        return set()
    C = json.load(open(f, encoding="utf-8"))
    return {x["name"] for x in C["stores"]}

