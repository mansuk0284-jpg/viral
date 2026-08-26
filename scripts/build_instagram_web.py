#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""인스타그램 채널 → web/assets/instagram.js

채널 축(인스타 전체 현황)과 매장 축(매장 언급)을 함께 내보낸다 —
채널별 현황과 매장별 현황이 같은 자료를 다른 시각으로 보는 구조이기 때문
(.claude/CLAUDE.md "채널별 현황과 매장별 현황은 같은 데이터다").

인스타는 '넓은 채널' 이다. 인스타 전체를 세는 게 아니라
혼수 해시태그(#혼수가전 #신혼가전 #혼수준비 #가전졸업)로 걸러 나온 글만 담는다.

이 채널의 성격이 유튜브·카페와 결정적으로 다르다:
**절반 가까이가 판매자 홍보 글이다(실측 44/69).**
매장·업체가 올린 호객 글을 고객 후기와 섞어 세면 '고객 반응'이 아니라
'판매자 광고량'을 재게 된다. 그래서 협찬(#광고)과 별개로 **홍보/개인**을 갈라 담는다.
지우지는 않는다 — 광고를 표시만 하고 남기는 것과 같은 원칙.

조회수가 없다. 인스타는 로그인 상태에서도 게시물 조회수를 목록에 주지 않는다.
그러므로 이 채널은 **건수만** 말할 수 있다. 조회수 칸을 억지로 채우지 않는다.
"""
import io
import json
import os
import re
import sys
from collections import Counter
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from build_web_data import dept_store_of, ITEMS, ITEM_KEYS, STORE_EXCLUDE


def load():
    fs = [f for f in os.listdir(os.path.join(ROOT, "artifacts"))
          if re.match(r"\d{8}-channel-instagram\.json$", f)]
    if not fs:
        raise SystemExit("인스타 수집 파일이 없습니다 — collect_instagram.py 먼저")
    f = os.path.join(ROOT, "artifacts", sorted(fs)[-1])
    return json.load(io.open(f, encoding="utf-8"))


def main():
    rows = load()

    def side(x):
        if x["samsung"] and not x["lg"]:
            return "s"
        if x["lg"] and not x["samsung"]:
            return "l"
        return ""

    per = [x for x in rows if not x.get("biz")]     # 개인 글
    biz = [x for x in rows if x.get("biz")]         # 판매자 홍보
    ads = [x for x in rows if x["ad"]]              # 협찬 표기

    def roll(g):
        return {"n": len(g),
                "s": sum(1 for x in g if side(x) == "s"),
                "l": sum(1 for x in g if side(x) == "l")}

    items = {}
    for k in ITEM_KEYS:
        g = [x for x in rows if any(w in (x["alt"] or "") for w in ITEMS[k])]
        if len(g) >= 2:
            items[k] = {"n": len(g),
                        "s": sum(1 for x in g if side(x) == "s"),
                        "l": sum(1 for x in g if side(x) == "l"),
                        # 이 품목 글 중 판매자 홍보가 몇인지 — 품목별로 성격이 다르다
                        "biz": sum(1 for x in g if x.get("biz"))}

    # 매장 축 — 인스타에서 매장이 적히는 글은 대개 그 매장이 직접 올린 홍보다.
    # 그래서 매장 화면에는 '고객 후기 수'가 아니라 '그 매장의 인스타 활동'으로 보여야 한다.
    #
    # 누가 올린 글인지는 **유통 이름**으로 가른다(2026-08-24 실측 교훈).
    # 브랜드 언급(samsung/lg)만으로 가르면 틀린다 — 롯데 잠실 글은
    # "8월 LG가전 BIG SALE" 인데 본문에 '삼성'이 스쳐 지나가서
    # 우리 쪽 홍보로 잡혔다. 화면에는 "잠실에 우리 인스타가 있다"고
    # 거짓이 뜬다. 파는 주체가 누구인지는 상호로만 확정할 수 있다.
    OURS = re.compile(r"삼성스토어|삼성전자판매|디지털프라자|디지탈프라자", re.I)
    RIVAL = re.compile(r"하이마트|베스트샵|베스트샾|하이프라자|전자랜드|LG전자\s*매장", re.I)

    stores = {}
    mon_stores = {}          # ym → 매장 → {n,s,l,ours,rival} — 매장 카드 기간 연동용
    for x in rows:
        st = dept_store_of(x["alt"] or "")
        if not st or st in STORE_EXCLUDE:
            continue
        v = stores.setdefault(st, {"n": 0, "s": 0, "l": 0, "biz": 0,
                                   "ours": 0, "rival": 0, "top": None})
        v["n"] += 1
        sd = side(x)
        if sd:
            v[sd] += 1
        t = x.get("alt") or ""
        ours = rival = 0
        if x.get("biz"):
            v["biz"] += 1
            # 상호가 적힌 홍보만 주체를 확정한다. 둘 다 없으면 어느 쪽도 아니다.
            if OURS.search(t):
                v["ours"] += 1
                ours = 1
            elif RIVAL.search(t):
                v["rival"] += 1
                rival = 1
        if not v["top"]:
            v["top"] = {"t": (x["alt"] or "")[:60].replace("\n", " "),
                        "url": x["url"], "biz": bool(x.get("biz"))}
        ym = (x.get("taken_at") or "")[:7]
        if ym:
            mv = mon_stores.setdefault(ym, {}).setdefault(
                st, {"n": 0, "s": 0, "l": 0, "ours": 0, "rival": 0})
            mv["n"] += 1
            if sd:
                mv[sd] += 1
            mv["ours"] += ours
            mv["rival"] += rival

    tags = Counter(t for x in rows for t in (x.get("tags") or []))

    data = {
        "built": datetime.now().strftime("%Y-%m-%d"),
        "note": "혼수 해시태그로 걸러낸 글만 셉니다. 인스타는 조회수를 주지 않아 건수만 말할 수 있습니다.",
        "total": len(rows),
        "all": roll(rows), "personal": roll(per), "biz": roll(biz), "ad": roll(ads),
        "items": items,
        "stores": stores,
        "monStores": mon_stores,
        "tags": [{"t": t, "n": n} for t, n in tags.most_common(8)],
        # 기간 탭(window.VPER)이 쓰는 월 목록 — 게시물이 하나라도 있는 달만.
        # enrich_instagram.py 로 게시물을 하나씩 열어 받아온 **실제 날짜**다
        # (검색 격자에는 날짜가 없어 처음엔 기간을 만들 수 없었다).
        "months": sorted({(x.get("taken_at") or "")[:7] for x in rows if x.get("taken_at")}),
        # 전량을 싣는다(69건이라 부담 없음). 화면이 기간으로 걸러 순위를 매긴다.
        "posts": [{"t": (x["alt"] or "")[:60].replace(chr(10), " "),
                   "u": x["url"], "ad": x["ad"], "biz": bool(x.get("biz")), "b": side(x),
                   "ym": (x.get("taken_at") or "")[:7], "d": x.get("taken_at") or "",
                   "lk": x.get("likes"), "cm": x.get("comments"),
                   "acc": x.get("account") or "",
                   "it": next((k for k in ITEM_KEYS
                               if any(w in (x["alt"] or "") for w in ITEMS[k])), "")}
                  for x in rows],
    }
    out = os.path.join(ROOT, "web", "assets", "instagram.js")
    io.open(out, "w", encoding="utf-8").write(
        "/* build_instagram_web.py 자동생성 — 수정 금지 */\n"
        "window.INSTAGRAM = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(f"게시물 {data['total']}개")
    print(f"  개인 {data['personal']['n']}개 · 판매자 홍보 {data['biz']['n']}개 "
          f"· 협찬 표기 {data['ad']['n']}개")
    print(f"  매장 언급 {len(stores)}곳 · 품목 {len(items)}종")
    print(f"→ {out} ({os.path.getsize(out)//1024}KB)")


if __name__ == "__main__":
    main()
