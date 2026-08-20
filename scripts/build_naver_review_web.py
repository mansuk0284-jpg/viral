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

# 같은 상권 짝 — 삼성 vs LG 를 나란히 보여주기 위한 매칭
PAIRS = [("삼성스토어 센텀", "LG전자 베스트샵 센텀점", "부산 센텀"),
         ("삼성스토어 롯데 부산", "LG전자 베스트샵 롯데 부산점", "부산 롯데본점"),
         ("삼성스토어 동래", "LG전자 베스트샵 동래본점", "부산 동래"),
         ("삼성스토어 울산", "LG전자 베스트샵 북울산본점", "울산"),
         ("삼성스토어 창원", "LG전자 베스트샵 마산본점", "경남 창원·마산"),
         ("삼성스토어 진주", "LG전자 베스트샵 진주성점", "경남 진주"),
         ("삼성스토어 김해", "LG전자베스트샵 장유점", "경남 김해·장유")]

# 대시보드 매장명(백화점 기준) → 플레이스 매장(상호 기준) 매핑.
# 두 체계가 다르다 — 대시보드는 '신세계 센텀시티', 플레이스는 '삼성스토어 센텀'.
# 부분 일치로는 절대 못 잇는다(실측: 매칭 0). 여기 한 곳에서만 정의한다.
DEPT_MAP = {
    "신세계 센텀시티": "삼성스토어 센텀",
    "롯데 센텀시티": "삼성스토어 센텀",
    "롯데 부산본점": "삼성스토어 롯데 부산",
    "롯데 동래": "삼성스토어 동래",
    "롯데 광복": "삼성스토어 롯데 부산",     # 광복점은 별도 플레이스 미수집 → 부산 대표로
    "롯데 울산": "삼성스토어 울산",
    "현대 울산": "삼성스토어 울산",
    "롯데 창원": "삼성스토어 창원",
    "신세계 마산": "삼성스토어 창원",
    "롯데 마산": "삼성스토어 창원",
    "갤러리아 진주": "삼성스토어 진주",
    "신세계 김해": "삼성스토어 김해",
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
        out.append([f"{x['y']}-{x['mo']:02d}", x.get("via") or "", x.get("star") or 0,
                    pm, cm, rm, 1 if neg else 0, mgr, t[:180]])
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
        "pairs": [[a, b, lab] for a, b, lab in PAIRS if a in stores or b in stores],
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
