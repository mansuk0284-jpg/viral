#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""오늘의집 채널 → web/assets/ohou.js (window.OHOU)

이 채널의 성격(실측 2026-08-26):
  · 집들이·콘텐츠 카드라 **매장 단서가 사실상 없다**(집들이 3건·콘텐츠 179건).
    그래서 매장 드릴을 만들지 않는다 — 없는 축을 만들면 화면이 거짓말을 한다.
  · 대신 **모델·색상·공간 트렌드**가 강하다: 비스포크 18 · 키친핏 16 · 오브제 16 …
    "어떤 모델이 신혼집 사진에 놓이는가"를 보는 창이다.
  · 게시일·반응은 **상세 페이지를 열어야** 나온다(enrich_ohou.py) —
    본문 끝의 "07.05좋아요45스크랩36조회63" 한 덩어리가 유일한 단서다.
    연도가 없어 "미래면 작년" 으로 보정한다(추정 — 화면에 밝힌다).
  · 좋아요(공감)·스크랩(사러 갈 목록)·조회수는 뜻이 다르다. 갈라서 싣는다.
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

from build_web_data import ITEMS, ITEM_KEYS

# 모델·색상 — 이 채널의 강점 축. 브랜드 귀속을 함께 적어 화면에서 색을 가른다.
MODELS = [
    ("비스포크", "s"), ("키친핏", ""), ("패밀리허브", "s"), ("무풍", "s"),
    ("그랑데", "s"), ("에어드레서", "s"), ("비스포크 AI", "s"),
    ("오브제", "l"), ("워시타워", "l"), ("스타일러", "l"), ("트롬", "l"),
    ("디오스", "l"), ("코드제로", "l"), ("퓨리케어", "l"), ("올레드", "l"),
]
# 공간 맥락 — 오늘의집다운 축(어느 공간 사진에 가전이 놓이나)
SPACES = {
    "주방": ["주방", "키친", "싱크대", "아일랜드"],
    "거실": ["거실", "리빙", "TV장", "소파"],
    "세탁실": ["세탁실", "베란다", "다용도실", "펜트리"],
    "침실": ["침실", "안방", "드레스룸"],
}


def load():
    fs = [f for f in os.listdir(os.path.join(ROOT, "artifacts"))
          if re.match(r"\d{8}-channel-ohou\.json$", f)]
    if not fs:
        raise SystemExit("오늘의집 수집 파일이 없습니다 — collect_ohou.py 먼저")
    f = os.path.join(ROOT, "artifacts", sorted(fs)[-1])
    rows = json.load(io.open(f, encoding="utf-8"))
    print(f"로드: {os.path.basename(f)} · {len(rows):,}건")
    return rows


def main():
    rows = load()

    def side(x):
        s, l = bool(x.get("samsung")), bool(x.get("lg"))
        if s and not l:
            return "s"
        if l and not s:
            return "l"
        return ""

    items = {}
    for k in ITEM_KEYS:
        g = [x for x in rows if any(w in x["text"] for w in ITEMS[k])]
        if len(g) >= 2:
            items[k] = {"n": len(g), "s": sum(1 for x in g if side(x) == "s"),
                        "l": sum(1 for x in g if side(x) == "l")}

    models = {}
    for name, brand in MODELS:
        g = [x for x in rows if name in x["text"]]
        if len(g) >= 2:
            models[name] = {"n": len(g), "b": brand,
                            "top": {"t": re.sub(r"^\d+\s+", "", g[0]["text"])[:70],
                                    "u": g[0]["url"]}}

    spaces = {}
    for name, kws in SPACES.items():
        g = [x for x in rows if any(w in x["text"] for w in kws)]
        if g:
            spaces[name] = {"n": len(g), "s": sum(1 for x in g if side(x) == "s"),
                            "l": sum(1 for x in g if side(x) == "l")}

    def clean(s):
        """카드 텍스트 앞의 좋아요 수(예: "2 혼수 준비하면서…")를 떼고,
        문장 단위로 잘라 제목처럼 읽히게 한다 — 원문에는 제목 필드가 없다."""
        s = re.sub(r"^\d+\s+", "", s or "").strip()
        return s

    # 썸네일은 지연로딩 자리표시자(1x1 base64)만 잡힌다(실측) — 실 이미지가 아니므로
    # 싣지 않는다. 없는 그림을 넣지 않는 원칙(인스타 썸네일과 같은 판단).
    posts = [{
        "id": x["id"], "k": x["kind"], "u": x["url"],
        "t": clean(x["text"])[:120],
        "b": side(x), "ad": 1 if x.get("ad") else 0,
        "d": (x.get("date") or "")[:10], "ym": (x.get("date") or "")[:7],
        "lk": x.get("likes") or 0, "sc": x.get("scrap") or 0, "vw": x.get("views") or 0,
    } for x in rows]

    # 기간 축 — enrich 로 확보한 게시일(연도 추정 포함)
    from collections import defaultdict
    mon = defaultdict(lambda: {"n": 0, "s": 0, "l": 0, "lk": 0})
    mon_models = defaultdict(lambda: defaultdict(int))
    for x in rows:
        d = (x.get("date") or "")[:7]
        if not d:
            continue
        m = mon[d]
        m["n"] += 1
        b = side(x)
        if b:
            m[b] += 1
        m["lk"] += int(x.get("likes") or 0)
        for name, _br in MODELS:
            if name in x["text"]:
                mon_models[d][name] += 1
    months = sorted(mon.keys())

    # 공감 축 — 좋아요 상위. 스크랩·조회수도 함께(뜻이 다른 신호)
    def clean0(s):
        return re.sub(r"^\d+\s+", "", s or "").strip()
    liked = sorted([x for x in rows if x.get("likes") is not None],
                   key=lambda r: -(r.get("likes") or 0))
    top_liked = [{
        "t": clean0(x["text"])[:110], "u": x["url"], "b": side(x),
        "lk": x.get("likes") or 0, "sc": x.get("scrap") or 0, "vw": x.get("views") or 0,
        "ad": 1 if x.get("ad") else 0, "d": (x.get("date") or "")[:10],
    } for x in liked[:12]]
    lk_tot = sum(int(x.get("likes") or 0) for x in rows)
    sc_tot = sum(int(x.get("scrap") or 0) for x in rows)

    s_tot = sum(1 for x in rows if side(x) == "s")
    l_tot = sum(1 for x in rows if side(x) == "l")
    data = {
        "built": datetime.now().strftime("%Y-%m-%d"),
        "note": "오늘의집 통합검색에서 혼수·가전 검색어로 걸러낸 글만 셉니다(오늘의집 전체가 아닙니다). "
                "집들이·콘텐츠 카드라 매장 단서가 거의 없어 매장 비교는 하지 않습니다 — "
                "모델·색상·공간 트렌드를 보는 창입니다. 게시일은 상세 페이지의 월·일 표기에서 읽었고 연도는 추정입니다.",
        "total": len(rows), "s": s_tot, "l": l_tot,
        "ad": sum(1 for x in rows if x.get("ad")),
        "proj": sum(1 for x in rows if x["kind"] == "projects"),
        "cont": sum(1 for x in rows if x["kind"] == "contents"),
        "items": items, "models": models, "spaces": spaces,
        "months": months,
        "mon": {k: dict(v) for k, v in mon.items()},
        "monModels": {k: dict(v) for k, v in mon_models.items()},
        "topLiked": top_liked,
        "lkTot": lk_tot, "scTot": sc_tot,
        "dated": sum(1 for x in rows if x.get("date")),
        "posts": posts,
    }
    out = os.path.join(ROOT, "web", "assets", "ohou.js")
    io.open(out, "w", encoding="utf-8").write(
        "/* build_ohou_web.py 자동생성 — 수정 금지 */\n"
        "window.OHOU = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(f"글 {len(rows):,}건 · 삼성 {s_tot} / LG {l_tot} · 광고표기 {data['ad']}")
    print(f"품목 {len(items)}종 · 모델 {len(models)}종 · 공간 {len(spaces)}종 · 월 {len(months)}개")
    print(f"날짜 확보 {data['dated']}건 · 좋아요 합 {lk_tot:,} · 스크랩 합 {sc_tot:,}")
    print(f"→ {out} ({os.path.getsize(out)//1024}KB)")


if __name__ == "__main__":
    main()
