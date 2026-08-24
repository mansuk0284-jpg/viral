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


AGO = re.compile(r"(\d+)\s*(분|시간|일|주|개월|년)\s*전")


def months_ago(when):
    """'4개월 전' 같은 상대 표기를 개월 수로 바꾼다.

    유튜브 목록은 업로드 **날짜를 주지 않는다** — 상대 표기뿐이다.
    그래서 달력 월로는 못 자르고 '얼마나 오래된 영상인가'로만 자를 수 있다.
    월 단위 기간 탭을 붙이면 없는 정밀도를 있는 것처럼 보이게 되므로
    화면에서도 '최근 1년' 같은 나이 구간으로만 고른다.
    """
    m = AGO.search(when or "")
    if not m:
        return None
    n, unit = int(m.group(1)), m.group(2)
    if unit in ("분", "시간"):
        return 0
    if unit == "일":
        return round(n / 30)
    if unit == "주":
        return round(n * 7 / 30)
    if unit == "개월":
        return n
    return n * 12


# 채널 주인 — 공식이냐 일반 창작자냐 (2026-08-24 사용자 지시)
#   "삼성공식채널과 lg공식채널의 컨텐츠와 일반 유투브들 채널이 있을텐데
#    이것을 구분해서 분석을 해야 하겠어"
#
# 이 구분이 중요한 이유: 공식 채널 영상은 **우리가 튼 것**이고
# 일반 창작자 영상은 **남이 말해 준 것**이다. 같은 재생수라도 뜻이 다르다.
# 실측에서 삼성 공식(삼성스토어·삼성전자)은 3편인데 그중 1편만
# 광고로 잡혀 있었다 — 채널 이름으로 다시 가른다.
SAM_OFFICIAL = re.compile(r"삼성전자|삼성\s*스토어|Samsung\s*(Electronics|Korea|Store)|"
                          r"삼성디지털프라자", re.I)
LG_OFFICIAL = re.compile(r"LG전자|엘지전자|LG\s*(Electronics|Korea)|LG베스트샵|베스트샵", re.I)


def owner_of(channel):
    c = channel or ""
    if SAM_OFFICIAL.search(c):
        return "sam"
    if LG_OFFICIAL.search(c):
        return "lg"
    return ""            # 일반 창작자


def ym_of(ago):
    """개월 수 → 근사 월("2026-04").

    유튜브가 주는 것은 "4개월 전" 같은 상대 표기라 **정확한 날짜가 아니다**.
    그래도 다른 화면과 같은 기간 탭(window.VPER)을 쓰려면 달력 월이 필요하다.
    새 UI 를 만드는 대신 값을 맞추는 쪽을 골랐다 — 화면마다 기간 고르는 법이
    달라지면 옮겨 다닐 때마다 다시 익혀야 하기 때문이다(사용자 지시 2026-08-24).

    근사값이라는 사실은 화면 방법론 줄에 적는다.
    """
    if ago is None:
        return ""
    d = datetime.now()
    y, m = d.year, d.month - ago
    while m <= 0:
        m += 12
        y -= 1
    return f"{y:04d}-{m:02d}"


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
        # 기간 탭(window.VPER)이 쓰는 월 목록 — 영상이 하나라도 있는 달만
        "months": sorted({ym_of(months_ago(x["when"])) for x in rows
                          if months_ago(x["when"]) is not None}),
        # 화면에 띄울 대표 영상 — 조회수 순, 광고 여부를 함께 싣는다
        # 채널명은 칸이 좁다(64px). "삼성전자 Samsung Korea" 같은 긴 이름은
        # 앞부분만 남긴다 — 어느 채널인지는 앞 몇 글자로 충분히 갈린다.
        # 화면에서 기간(영상 나이)으로 걸러야 하므로 전량을 싣는다.
        # 54편이라 용량 부담이 없다.
        "vids": [{"id": x["id"], "t": x["title"][:52], "c": (x["channel"] or "")[:14],
                  "own": owner_of(x["channel"]), "v": x["views"],
                  "w": x["when"], "ago": months_ago(x["when"]),
                  "ym": ym_of(months_ago(x["when"])),
                  "u": x["url"], "ad": x["ad"], "b": side(x),
                  "it": next((k for k in ITEM_KEYS
                              if any(w in x["title"] for w in ITEMS[k])), "")}
                 for x in rows],
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
