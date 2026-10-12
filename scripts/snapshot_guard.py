#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""회차 스냅샷 채널의 빈 산출 격리 — 빌드가 0건 파일을 읽지 않게 지킨다.

빌드(build_{youtube,ohou}_web.py)는 최신 날짜 파일 하나만 읽는다. 수집이
네트워크 단절·차단으로 0건을 내면 그 빈 파일이 최신이 되어 화면을 0으로
덮는다(2026-10-12 실사고: 네트워크 미연결 자동 실행에서 유튜브·오늘의집 0건).
인스타는 merge_instagram_snapshots.py 가 같은 역할(+union)을 하고, 이 스크립트는
union 이 필요 없는 채널(전량 재수집 스냅샷)용 — 10건 미만 산출을 .bad 로
격리해 이전 정상본이 다시 최신이 되게 한다.

사용: python scripts/snapshot_guard.py youtube ohou jwedding
"""
import glob
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

MIN_KEEP = 10

def guard(channel):
    files = sorted(glob.glob(os.path.join(ROOT, "artifacts", f"????????-channel-{channel}.json")))
    if not files:
        print(f"[{channel}] 스냅샷 없음")
        return
    newest = files[-1]
    try:
        rows = json.load(io.open(newest, encoding="utf-8"))
        n = len(rows) if isinstance(rows, list) else len(rows.get("items", rows) or [])
    except Exception as e:
        print(f"[{channel}] {os.path.basename(newest)} 파싱 실패({e}) — 격리")
        os.replace(newest, newest + ".bad")
        return
    if n < MIN_KEEP:
        os.replace(newest, newest + ".bad")
        rest = sorted(glob.glob(os.path.join(ROOT, "artifacts", f"????????-channel-{channel}.json")))
        print(f"[{channel}] {os.path.basename(newest)} {n}건 — 빈 산출로 보고 격리. "
              + (f"빌드는 {os.path.basename(rest[-1])} 사용" if rest else "!! 남은 정상본 없음"))
    else:
        print(f"[{channel}] {os.path.basename(newest)} {n}건 — 정상")

if __name__ == "__main__":
    for ch in (sys.argv[1:] or ["youtube", "ohou", "jwedding"]):
        guard(ch)
