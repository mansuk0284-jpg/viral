# -*- coding: utf-8 -*-
"""board 누적본(cumulative-cafe-raw.json) → census(cafe-census.json) 병합.

왜 필요한가(2026-09-08 실측): board --cumulative 는 정본 누적본에만 저장하고,
화면 빌드(build_web_data)는 census 만 읽는다. 이 다리가 없으면 board 가 걷어온
최신 글(8월 하순·9월 586건)이 **화면에 영원히 안 나온다** — 두 갈래 함정.
board 증분 수집 후에는 반드시 이 스크립트를 돌린다(refresh_all 배치에 포함).

병합 규칙:
  - 없는 articleId → census 에 추가(bodyRead=body_ok 매핑).
  - 있는 articleId → census 에 본문이 없는데 누적본에 있으면 본문만 보강.
    기존 census 의 분석·조회수(readCount 등)는 건드리지 않는다.
"""
import io
import json
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUM = os.path.join(ROOT, "artifacts", "cumulative-cafe-raw.json")
CEN = os.path.join(ROOT, "artifacts", "cafe-census.json")


def main():
    cum = json.load(io.open(CUM, encoding="utf-8"))
    cen = json.load(io.open(CEN, encoding="utf-8"))
    by = {r["articleId"]: r for r in cen}
    added = enriched = 0
    for r in cum:
        aid = r.get("articleId")
        if not aid:
            continue
        if aid not in by:
            by[aid] = {
                "articleId": aid,
                "title": r.get("title", ""),
                "summary": r.get("summary", ""),
                "addDate": r.get("addDate", ""),
                "url": r.get("url", ""),
                "menu": r.get("menu", ""),
                "samsung": r.get("samsung", False),
                "lg": r.get("lg", False),
                "body_excerpt": r.get("body_excerpt", ""),
                "bodyRead": bool(r.get("body_ok")),
            }
            added += 1
        else:
            c = by[aid]
            if r.get("body_ok") and not c.get("bodyRead") and not c.get("body_excerpt"):
                c["body_excerpt"] = r.get("body_excerpt", "")
                c["bodyRead"] = True
                enriched += 1
    out = list(by.values())
    tmp = CEN + ".tmp"
    io.open(tmp, "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False))
    os.replace(tmp, CEN)
    print(f"census {len(cen):,} → {len(out):,} (신규 {added:,} · 본문 보강 {enriched:,})")


if __name__ == "__main__":
    main()
