#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""인스타 스냅샷 위생 + union 병합 — 빌드 입력을 안전하게 만든다.

왜 필요한가(2026-09-21 실사고): 인스타 수집은 회차 스냅샷이고
build_instagram_web.py 는 **최신 날짜 파일 하나만** 읽는다. 세션이 만료되면
전 해시태그 0건의 빈 스냅샷이 최신 파일이 되고, 빌드가 화면을 0으로 덮는다
(자동 주간 실행에서 실제 발생 — 20260921 파일 0건, instagram.js total 0).

하는 일:
1) 표본 10건 미만의 빈/미미 스냅샷은 .bad 로 격리(세션 만료 산출)
2) 남은 전 스냅샷을 id 기준 union (나중 파일이 같은 id 를 덮음)
3) union 을 오늘 날짜 파일로 저장 → 빌드가 이 파일을 최신으로 읽는다
"""
import glob
import io
import json
import os
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

MIN_KEEP = 10   # 이 미만이면 정상 수집이 아니라 세션 만료 산출로 본다

def main():
    files = sorted(glob.glob(os.path.join(ROOT, "artifacts", "????????-channel-instagram.json")))
    if not files:
        raise SystemExit("인스타 스냅샷이 없습니다")
    merged = {}
    used = []
    for f in files:
        try:
            rows = json.load(io.open(f, encoding="utf-8"))
        except Exception as e:
            print(f"!! {os.path.basename(f)} 파싱 실패({e}) — 격리")
            os.replace(f, f + ".bad")
            continue
        if not isinstance(rows, list) or len(rows) < MIN_KEEP:
            print(f"!! {os.path.basename(f)} {len(rows) if isinstance(rows, list) else '?'}건 — 세션 만료 산출로 보고 격리(.bad)")
            os.replace(f, f + ".bad")
            continue
        for r in rows:
            rid = r.get("id")
            if rid:
                merged[rid] = r
        used.append((os.path.basename(f), len(rows)))
    if not merged:
        raise SystemExit("!! 병합할 정상 스냅샷이 없습니다 — 빌드하지 마세요")
    out = os.path.join(ROOT, "artifacts", date.today().strftime("%Y%m%d") + "-channel-instagram.json")
    io.open(out, "w", encoding="utf-8").write(
        json.dumps(list(merged.values()), ensure_ascii=False, separators=(",", ":")))
    for name, n in used:
        print(f"  {name}: {n}건")
    print(f"union {len(merged)}건 → {os.path.basename(out)}")

if __name__ == "__main__":
    main()
