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

# 같은 백화점 안의 삼성 vs LG 를 잇는다.
# 수집 레코드에 dept(백화점명)가 들어 있어 그걸로 묶으면 된다 —
# 손으로 표를 적지 않으므로 매장이 늘어도 고칠 곳이 없다.
def build_pairs(stores):
    by_dept = {}
    for nm, v in stores.items():
        dp = v.get("dept") or ""
        if not dp:
            continue
        by_dept.setdefault(dp, {})[v["brand"]] = nm
    pairs = []
    for dp, br in sorted(by_dept.items()):
        if "삼성" in br and "LG" in br:
            pairs.append([br["삼성"], br["LG"], dp])
    return pairs


# 대시보드 매장명(백화점) → 플레이스 매장. dept 로 그대로 잇는다.
def build_dept_map(stores):
    m = {}
    for nm, v in stores.items():
        if v["brand"] == "삼성" and v.get("dept"):
            m[v["dept"]] = nm
    return m

# 대시보드 매장명(백화점 기준) → 플레이스 매장(상호 기준) 매핑.
# 두 체계가 다르다 — 대시보드는 '신세계 센텀시티', 플레이스는 '삼성스토어 센텀'.
# 부분 일치로는 절대 못 잇는다(실측: 매칭 0). 여기 한 곳에서만 정의한다.



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
            "dept": r.get("dept", ""),
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
        "deptMap": build_dept_map(stores),
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
