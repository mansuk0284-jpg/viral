#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""제휴카페 재수집 드라이버(2026-10-27) — artifacts/affiliate/*.json 의 각 카페를
지정 윈도로 다시 긁어 articleId 합집합으로 병합한 뒤 빌드까지 돌린다.

- collect_cafe.py 는 --out 을 덮어쓰므로(병합 없음) 임시 파일로 받아 합친다.
- clubId 는 기존 산출 행의 url(`cafes/<id>/articles/…`)에서, menuId 는 `menu`
  필드에서 복원한다(8/12 산출엔 clubid 키가 없다 — 실측).
사용: python scripts/refresh_affiliate.py 2026-08 2026-10
"""
import glob
import io
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

def main():
    start, end = sys.argv[1], sys.argv[2]
    print(f"제휴카페 재수집 {start} ~ {end}")
    for f in sorted(glob.glob(os.path.join(ROOT, "artifacts", "affiliate", "*.json"))):
        slug = os.path.splitext(os.path.basename(f))[0]
        if slug.startswith(".tmp-"):
            continue
        rows = json.load(io.open(f, encoding="utf-8"))
        if not rows:
            print(f"!! {slug}: 기존 행 없음 — 건너뜀"); continue
        m = re.search(r"cafes/(\d+)/", rows[0].get("url", ""))
        menu = str(rows[0].get("menu", "") or "")
        if not m or not menu:
            print(f"!! {slug}: clubId/menu 복원 실패 — 건너뜀"); continue
        cid = m.group(1)
        print(f"\n===== {slug} (club {cid} · menu {menu}) =====", flush=True)
        tmp = os.path.join(ROOT, "artifacts", "affiliate", f".tmp-{slug}.json")
        r = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "collect_cafe.py"),
                            "--clubid", cid, "--menu", menu,
                            "--start", start, "--end", end, "--out", tmp])
        if r.returncode != 0 or not os.path.exists(tmp):
            print(f"!! {slug} 수집 실패"); continue
        base = {x["articleId"]: x for x in rows}
        new = 0
        for x in json.load(io.open(tmp, encoding="utf-8")):
            if x["articleId"] not in base:
                new += 1
            else:  # 기존 행의 본문 분석 필드(body_*)를 보존하고 최신 요약만 갱신
                old = base[x["articleId"]]
                x = {**old, **{k: v for k, v in x.items() if k in ("title", "summary", "addDate")}}
            base[x["articleId"]] = x
        io.open(f, "w", encoding="utf-8").write(json.dumps(list(base.values()), ensure_ascii=False))
        os.remove(tmp)
        print(f"병합: 총 {len(base)}건 (신규 {new})")

    print("\n===== 빌드 =====")
    for b in ("build_affiliate_ads.py", "build_affiliate_web.py"):
        rc = subprocess.run([sys.executable, os.path.join(ROOT, "scripts", b)]).returncode
        print(("ok " if rc == 0 else "!! ") + b)
    print("ALL DONE")

if __name__ == "__main__":
    main()
