#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""네이버 리뷰 → web/assets/naver-review.js

화면 요구: 매장별로 리뷰·예약을 보고, LG와 나란히 비교하고, 기간별로 본다.
그래서 미리 합산하지 않고 **리뷰 1건 = 1행**으로 내보낸다(월 단위·전체를 같은 코드로).

사용: python scripts/build_naver_review_web.py
"""
import io, json, os, re, sys
from collections import Counter
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from naver_review_insight import (          # 분류 규칙은 한 곳에서만 정의
    load, PRAISE, COMPLAIN, REASON, NEGWORD, POSWORD, AD, MGR, NOT_NAME, is_negative)
try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass

OUT = os.path.join(ROOT, "web", "assets", "naver-review.js")
P_KEYS, C_KEYS, R_KEYS = list(PRAISE), list(COMPLAIN), list(REASON)

# 같은 상권 짝 — 손으로 적지 않는다.
# 매장이 늘 때마다 표를 고쳐야 하고, 한 번 빠뜨리면 그 매장은 비교가 통째로 사라진다.
# 수집기(naver_place_collect.TARGETS)가 삼성·LG를 **쌍으로** 넣으므로 그 순서로 잇는다.
def build_pairs(stores):
    import naver_place_collect as NPC
    q2name = {}
    for nm, v in stores.items():
        q2name[v["query"]] = nm
    pairs, i = [], 0
    T = NPC.TARGETS
    while i + 1 < len(T):
        a_q, a_br, a_rg = T[i]
        b_q, b_br, b_rg = T[i + 1]
        if a_br == "삼성" and b_br == "LG" and a_rg == b_rg:
            an, bn = q2name.get(a_q), q2name.get(b_q)
            if an and bn:
                # 라벨 = 지역 + 상권(검색어에서 브랜드어를 걷어낸 것)
                spot = (a_q.replace("삼성스토어", "").replace("광주광역시", "")
                        .replace("서울", "").strip()) or a_rg
                pairs.append([an, bn, f"{a_rg} {spot}".strip()])
            i += 2
            continue
        i += 1
    return pairs

# 대시보드 매장명(백화점 기준) → 플레이스 매장(상호 기준) 매핑.
# 두 체계가 다르다 — 대시보드는 '신세계 센텀시티', 플레이스는 '삼성스토어 센텀'.
# 부분 일치로는 절대 못 잇는다(실측: 매칭 0). 여기 한 곳에서만 정의한다.
DEPT_MAP = {
    # 부울경
    "신세계 센텀시티": "삼성스토어 센텀", "롯데 센텀시티": "삼성스토어 센텀",
    "롯데 부산본점": "삼성스토어 롯데 부산", "롯데 광복": "삼성스토어 롯데 부산",
    "롯데 동래": "삼성스토어 동래",
    "롯데 울산": "삼성스토어 울산", "현대 울산": "삼성스토어 울산",
    "롯데 창원": "삼성스토어 창원", "신세계 마산": "삼성스토어 창원", "롯데 마산": "삼성스토어 창원",
    "갤러리아 진주": "삼성스토어 진주", "신세계 김해": "삼성스토어 김해",
    # 서울 — 백화점 21곳을 삼성스토어 6곳에 상권 기준으로 잇는다
    "롯데 잠실": "삼성스토어 롯데 잠실",
    "롯데 강남": "삼성스토어 롯데 강남", "신세계 강남": "삼성스토어 롯데 강남",
    "갤러리아 압구정": "삼성스토어 롯데 강남", "현대 압구정": "삼성스토어 롯데 강남",
    "현대 무역센터": "삼성스토어 롯데 강남",
    "롯데 영등포": "삼성스토어 영등포", "신세계 영등포": "삼성스토어 영등포",
    "현대 여의도": "삼성스토어 영등포",
    "롯데 노원": "삼성스토어 노원", "롯데 미아": "삼성스토어 노원", "현대 미아": "삼성스토어 노원",
    "현대 목동": "삼성스토어 현대 목동",
    "롯데 청량리": "삼성스토어 롯데 청량리", "롯데 건대": "삼성스토어 롯데 청량리",
    "현대 천호": "삼성스토어 롯데 청량리",
    "롯데 본점": "삼성스토어 영등포", "신세계 본점": "삼성스토어 영등포",
    "더현대 서울": "삼성스토어 영등포", "현대 신촌": "삼성스토어 영등포",
    "롯데 관악": "삼성스토어 영등포",
    # 경기
    "롯데 수원": "삼성스토어 수원", "AK 수원": "삼성스토어 수원",
    "갤러리아 광교": "삼성스토어 수원", "신세계 죽전": "삼성스토어 수원",
    "롯데 분당": "삼성스토어 분당", "AK 분당": "삼성스토어 분당", "현대 판교": "삼성스토어 분당",
    "롯데 일산": "삼성스토어 일산", "현대 일산": "삼성스토어 일산",
    "신세계 의정부": "삼성스토어 일산", "롯데 구리": "삼성스토어 일산",
    "롯데 동탄": "삼성스토어 동탄",
    "롯데 부천": "삼성스토어 부천중동", "현대 중동": "삼성스토어 부천중동",
    "롯데 김포": "삼성스토어 부천중동", "신세계 시흥": "삼성스토어 부천중동",
    "롯데 평촌": "삼성스토어 평촌", "AK 광명": "삼성스토어 평촌", "신세계 하남": "삼성스토어 평촌",
    # 광역시·도
    "롯데 인천": "삼성스토어 부평",
    "신세계 대구": "삼성스토어 남대구", "더현대 대구": "삼성스토어 남대구", "롯데 대구": "삼성스토어 남대구",
    "갤러리아 타임월드": "삼성스토어 대전", "신세계 대전": "삼성스토어 대전", "롯데 대전": "삼성스토어 대전",
    "신세계 광주": "삼성스토어 광산", "롯데 광주": "삼성스토어 광산",
    "신세계 천안": "삼성스토어 천안", "갤러리아 천안": "삼성스토어 천안",
    "신세계 아산": "삼성스토어 천안", "갤러리아 아산": "삼성스토어 천안",
    "현대 청주": "삼성스토어 청주",
    "롯데 전주": "삼성스토어 전주",
    "롯데 포항": "삼성스토어 포항", "롯데 안동": "삼성스토어 포항",
    "AK 원주": "삼성스토어 원주",
}


def rows_of(rec):
    out = []
    for x in rec.get("items") or []:
        t = x.get("text") or ""
        if AD.search(t):        # 광고성 제외
            continue
        if not (x.get("y") and x.get("mo")):
            continue
        pm = sum(1 << i for i, k in enumerate(P_KEYS) if any(w in t for w in PRAISE[k]))
        rm = sum(1 << i for i, k in enumerate(R_KEYS) if any(w in t for w in REASON[k]))
        # 판정은 naver_review_insight.is_negative 한 곳에서만 한다.
        # 여기서 따로 계산하면 화면과 리포트의 불만 건수가 갈린다.
        neg = is_negative(t, x.get("star"))
        cm = sum(1 << i for i, k in enumerate(C_KEYS)
                 if neg and any(w in t.lower() for w in COMPLAIN[k]))
        mgr = ""
        for nm, ttl in MGR.findall(t):
            if nm not in NOT_NAME and len(nm) >= 2:
                mgr = f"{nm} {ttl}"; break
        # 본문은 **불만 리뷰만** 원문으로 싣는다(조치용).
        # 전량 180자로 실었더니 전국 확대 시 2.2MB가 됐다 — 칭찬 원문은 화면에서 안 쓴다.
        out.append([f"{x['y']}-{x['mo']:02d}", x.get("via") or "", x.get("star") or 0,
                    pm, cm, rm, 1 if neg else 0, mgr, t[:200] if neg else ""])
    out.sort(key=lambda r: r[0], reverse=True)
    return out


def main():
    recs = load()
    if not recs:
        raise SystemExit("수집 파일 없음 — artifacts/naver-place/*.json")
    stores, months = {}, set()
    for r in recs:
        nm = r["place"]["name"]
        rw = rows_of(r)
        months |= {x[0] for x in rw}
        stores[nm] = {
            "name": nm, "query": r["query"], "brand": r["brand"], "region": r["region"],
            "addr": r["place"].get("addr", ""), "pid": r["place"].get("id"),
            "total": r.get("reviewTotal") or 0, "participants": r.get("participants") or 0,
            "keywords": r.get("keywords") or [], "rows": rw,
        }
    data = {
        "built": datetime.now().strftime("%Y-%m-%d"),
        "now": datetime.now().strftime("%Y-%m"),
        "praise": P_KEYS, "complain": C_KEYS, "reason": R_KEYS,
        "months": sorted(months, reverse=True),
        "pairs": build_pairs(stores),
        "deptMap": {k: v for k, v in DEPT_MAP.items() if v in stores},
        "stores": stores,
    }
    io.open(OUT, "w", encoding="utf-8").write(
        "/* build_naver_review_web.py 자동생성 — 수정 금지 */\n"
        "window.NAVER_REVIEW = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    n = sum(len(s["rows"]) for s in stores.values())
    tot_s = sum(s["total"] for s in stores.values() if s["brand"] == "삼성")
    tot_l = sum(s["total"] for s in stores.values() if s["brand"] == "LG")
    print(f"매장 {len(stores)}곳 · 리뷰행 {n:,} · 월 {len(months)}개")
    print(f"네이버 리뷰 총계 — 삼성 {tot_s:,} / LG {tot_l:,}")
    print(f"→ {OUT} ({os.path.getsize(OUT)//1024}KB)")


if __name__ == "__main__":
    main()
