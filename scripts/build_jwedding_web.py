#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""제이웨딩 채널 → web/assets/jwedding.js

사용자 지시(2026-08-23): "제이웨딩 타일을 만들고 그 안에서 데이터를 정리해야지.
채널별 현황은 채널별 타일에 데이터를 정리하는 거잖아. 그리고 매장별 현황은
해당 매장이 나오는 데이터를 채널별로 정리한거고. … 결국은 서로 연동되어 있어."

그래서 같은 자료를 **두 축으로** 내보낸다:
  · 채널 축  — 제이웨딩 전체 현황(브랜드·품목·매장 순위·월 추이)  → 채널 타일이 쓴다
  · 매장 축  — 매장별 {삼성, LG, 매니저, 최근}                   → 매장 대시보드가 쓴다

매장 이름은 다이렉트웨딩과 **같은 규칙**으로 뽑는다(build_web_data 의 dept_store_of).
그래야 두 화면이 같은 매장을 같은 이름으로 부른다.
"""
import io
import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from build_web_data import dept_store_of, ITEMS, ITEM_KEYS, STORE_EXCLUDE   # 같은 규칙 재사용

SAM = re.compile(r"삼성|비스포크|bespoke|무풍|갤럭시", re.I)
LG = re.compile(r"엘지|LG|디오스|트롬|오브제|스타일러|워시타워", re.I)
MGR = re.compile(r"([가-힣]{2,4})\s*(부지점장|지점장|점장|매니저|프로|사원|팀장)")


def load(stamp=None):
    ds = []
    for f in sorted(os.listdir(os.path.join(ROOT, "artifacts"))):
        if re.match(r"\d{8}-channel-jwedding(-ai)?\.json$", f):
            ds.append(os.path.join(ROOT, "artifacts", f))
    out, seen = [], set()
    for f in ds:
        for r in json.load(io.open(f, encoding="utf-8")):
            aid = r.get("articleId")
            if aid in seen:
                continue
            seen.add(aid)
            out.append(r)
    return out


def main():
    recs = load()
    if not recs:
        raise SystemExit("제이웨딩 수집 파일이 없습니다 — collect_channels.py 먼저")

    total = s_tot = l_tot = 0
    months = defaultdict(lambda: [0, 0, 0])
    items = defaultdict(lambda: {"s": 0, "l": 0})
    stores = defaultdict(lambda: {"s": 0, "l": 0, "mgr": Counter(), "last": ""})
    mon_stores = {}          # ym → 매장 → {s,l} — 매장 카드 기간 연동용
    mgr_on = {"s": 0, "l": 0}
    unknown = 0

    for r in recs:
        txt = (r.get("title") or "") + " " + (r.get("summary") or "")
        s, l = bool(SAM.search(txt)), bool(LG.search(txt))
        if not (s or l):
            continue
        ss, ll = (s and not l), (l and not s)
        ym = (r.get("addDate") or "")[:7]
        total += 1
        if ym:
            months[ym][0] += 1
            if ss:
                months[ym][1] += 1
            if ll:
                months[ym][2] += 1
        if ss:
            s_tot += 1
        elif ll:
            l_tot += 1

        st = dept_store_of(txt)
        if st in STORE_EXCLUDE:
            st = None
        if st and (ss or ll):
            b = "s" if ss else "l"
            stores[st][b] += 1
            d = (r.get("addDate") or "")[:10]
            if d > stores[st]["last"]:
                stores[st]["last"] = d
            if ym:
                mv = mon_stores.setdefault(ym, {}).setdefault(st, {"s": 0, "l": 0, "last": ""})
                mv[b] += 1
                if d > mv["last"]:
                    mv["last"] = d
            m = MGR.search(txt)
            if m:
                stores[st]["mgr"][m.group(1) + " " + m.group(2)] += 1
                mgr_on[b] += 1
        elif ss or ll:
            unknown += 1

        for k in ITEM_KEYS:
            if any(w in txt for w in ITEMS[k]):
                items[k]["s" if ss else "l"] += 1

    st_out = {}
    for k, v in stores.items():
        st_out[k] = {"s": v["s"], "l": v["l"], "last": v["last"],
                     "mgr": [{"n": n, "c": c} for n, c in v["mgr"].most_common(3)]}

    data = {
        "built": datetime.now().strftime("%Y-%m-%d"),
        "source": "제이웨딩 [칭찬] 혼수/선택이유 + 삼성AI가전",
        "note": "혼수 전반 칭찬 게시판에서 가전 글만 걸렀습니다. "
                "삼성AI가전 판은 제휴 이벤트라 삼성 쪽이 많이 잡힙니다 — 브랜드 비교는 참고만.",
        "total": total, "s": s_tot, "l": l_tot,
        "unknown": unknown,                       # 매장이 안 잡힌 건수
        "months": [[m] + months[m] for m in sorted(months)],
        "items": {k: v for k, v in sorted(items.items(),
                                          key=lambda kv: -(kv[1]["s"] + kv[1]["l"])) if v["s"] + v["l"] >= 3},
        "stores": st_out,
        "monStores": mon_stores,
        "mgr": mgr_on,
    }
    out = os.path.join(ROOT, "web", "assets", "jwedding.js")
    io.open(out, "w", encoding="utf-8").write(
        "/* build_jwedding_web.py 자동생성 — 수정 금지 */\n"
        "window.JWEDDING = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(f"제이웨딩 {total:,}건 · 삼성 {s_tot:,} / LG {l_tot:,}")
    print(f"매장 특정 {len(st_out)}곳 · 매장 미상 {unknown:,}건")
    print(f"월 {len(months)}개 · 품목 {len(data['items'])}종")
    print(f"→ {out} ({os.path.getsize(out)//1024}KB)")


if __name__ == "__main__":
    main()
