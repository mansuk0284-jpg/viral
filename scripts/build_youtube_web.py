#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""유튜브 채널 → web/assets/youtube.js

채널 축(유튜브 전체 현황)과 매장 축(매장 언급)을 함께 내보낸다 —
채널별 현황과 매장별 현황이 같은 자료를 다른 시각으로 보는 구조이기 때문
(.claude/CLAUDE.md "채널별 현황과 매장별 현황은 같은 데이터다").

유튜브는 '넓은 채널' 이다. 유튜브 전체를 세는 게 아니라
혼수가전 검색어로 걸러 나온 영상만 담는다(사용자 지시 2026-08-24).

광고는 지우지 않고 **표시만** 한다("광고는 표시만 하고 남겨줘").
브랜드 공식 채널 영상이 조회수 1위(374만)라, 섞어서 세면 고객 반응이 아니라
광고 노출을 재는 셈이 된다. 그래서 화면에서 갈라 볼 수 있게 나눠 담는다.
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
          if re.match(r"\d{8}-channel-youtube\.json$", f)]
    if not fs:
        raise SystemExit("유튜브 수집 파일이 없습니다 — collect_youtube.py 먼저")
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

    org = [x for x in rows if not x["ad"]]          # 일반 영상
    ads = [x for x in rows if x["ad"]]              # 광고·공식 채널

    def roll(g):
        s = [x for x in g if side(x) == "s"]
        l = [x for x in g if side(x) == "l"]
        return {"n": len(g), "views": sum(x["views"] for x in g),
                "s": len(s), "l": len(l),
                "sv": sum(x["views"] for x in s), "lv": sum(x["views"] for x in l)}

    items = {}
    for k in ITEM_KEYS:
        g = [x for x in rows if any(w in x["title"] for w in ITEMS[k])]
        if len(g) >= 2:
            items[k] = {"n": len(g), "views": sum(x["views"] for x in g),
                        "s": sum(1 for x in g if side(x) == "s"),
                        "l": sum(1 for x in g if side(x) == "l")}

    # 매장 축 — 영상 제목에 매장이 적히는 일은 드물지만, 있으면 매장 화면이 쓴다
    stores = {}
    for x in rows:
        st = dept_store_of(x["title"])
        if not st or st in STORE_EXCLUDE:
            continue
        v = stores.setdefault(st, {"n": 0, "views": 0, "s": 0, "l": 0, "top": None})
        v["n"] += 1
        v["views"] += x["views"]
        sd = side(x)
        if sd:
            v[sd] += 1
        if not v["top"] or x["views"] > v["top"]["views"]:
            v["top"] = {"t": x["title"][:60], "views": x["views"], "url": x["url"]}

    chans = Counter(x["channel"] for x in rows if x["channel"])

    data = {
        "built": datetime.now().strftime("%Y-%m-%d"),
        "note": "혼수가전 검색어로 걸러낸 영상만 셉니다(유튜브 전체가 아닙니다). "
                "브랜드 공식 채널·협찬 영상은 지우지 않고 따로 표시합니다 — "
                "고객 반응과 광고 노출은 다른 이야기이기 때문입니다.",
        "total": len(rows), "views": sum(x["views"] for x in rows),
        "all": roll(rows), "organic": roll(org), "ad": roll(ads),
        "items": items,
        "stores": stores,
        "channels": [{"n": n, "c": c} for n, c in chans.most_common(6)],
        # 화면에 띄울 대표 영상 — 조회수 순, 광고 여부를 함께 싣는다
        # 채널명은 칸이 좁다(64px). "삼성전자 Samsung Korea" 같은 긴 이름은
        # 앞부분만 남긴다 — 어느 채널인지는 앞 몇 글자로 충분히 갈린다.
        "top": [{"t": x["title"][:46], "c": (x["channel"] or "")[:9], "v": x["views"],
                 "w": x["when"], "u": x["url"], "ad": x["ad"], "b": side(x)}
                for x in rows[:12]],
    }
    out = os.path.join(ROOT, "web", "assets", "youtube.js")
    io.open(out, "w", encoding="utf-8").write(
        "/* build_youtube_web.py 자동생성 — 수정 금지 */\n"
        "window.YOUTUBE = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(f"영상 {data['total']}개 · 조회수 {data['views']:,}회")
    print(f"  일반 {data['organic']['n']}개({data['organic']['views']:,}회) · "
          f"광고·공식 {data['ad']['n']}개({data['ad']['views']:,}회)")
    print(f"  매장 언급 {len(stores)}곳 · 품목 {len(items)}종")
    print(f"→ {out} ({os.path.getsize(out)//1024}KB)")


if __name__ == "__main__":
    main()
