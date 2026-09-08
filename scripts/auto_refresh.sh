#!/bin/bash
# 주간 자동 갱신 드라이버 — 수집→병합→빌드→스모크 검증→배포까지 무인 실행.
# 등록: Windows 작업 스케줄러(주 1회, 로그온 세션 필요 — 헤디드 브라우저).
# 실패 시 푸시하지 않고 로그만 남긴다(깨진 화면을 배포하지 않는 원칙).
set -u
cd "C:/Users/admin/Desktop/viral"
export PYTHONUNBUFFERED=1
STAMP=$(date +%Y%m%d-%H%M)
LOG="artifacts/logs/auto-$STAMP.log"
exec > >(tee -a "$LOG") 2>&1
echo "===== auto_refresh 시작 $(date) ====="

# ① 수집+빌드 전체(정본 배치 재사용 — merge 다리 포함)
bash scripts/refresh_all_202608.sh
echo "----- 수집·빌드 배치 종료 $(date) -----"

# ② 스모크 검증 — 실패하면 배포 중단
python - <<'PY'
import sys
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright
import subprocess, time, os
# 로컬 서버 보장
try:
    import urllib.request
    urllib.request.urlopen("http://localhost:8765/", timeout=3)
except Exception:
    subprocess.Popen([sys.executable, "-m", "http.server", "8765", "--directory", "web"],
                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(3)
BAD = 0
with sync_playwright() as p:
    br = p.chromium.launch(channel="chrome", headless=True)
    pg = br.new_page(viewport={"width": 1440, "height": 900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
    for name, js in [("메인", None), ("다결", "window.openCafeAnalysis()"),
                     ("블로그", "window.openBlog()"), ("허브", "window.openStoreScope('롯데 부산본점')")]:
        pg.goto("http://localhost:8765/?smoke" + name, wait_until="networkidle")
        pg.wait_for_timeout(2200)
        if js:
            pg.evaluate(js); pg.wait_for_timeout(1300)
        w = pg.evaluate("()=>document.body.scrollWidth")
        big = pg.evaluate("()=>{const e=document.querySelector('.nsc-total b, .cx-sum-n b'); return e? e.innerText : '';}")
        ok = (w <= 1445) and not errs and (name == "메인" or big not in ("", "0"))
        print(("ok " if ok else "!! ") + name, "w=", w, "big=", big, "err=", len(errs))
        if not ok:
            BAD += 1
    br.close()
sys.exit(1 if BAD else 0)
PY
if [ $? -ne 0 ]; then
  echo "!! 스모크 실패 — 배포하지 않음. 로그: $LOG"
  exit 1
fi

# ③ 변경이 있으면 캐시버스터 증가 후 커밋·푸시·재트리거
if git diff --quiet -- web; then
  echo "웹 자산 변경 없음 — 배포 생략"
  exit 0
fi
python - <<'PY'
import io, re
p = "web/index.html"
t = io.open(p, encoding="utf-8").read()
cur = int(re.search(r"\?v=2026r(\d+)", t).group(1))
io.open(p, "w", encoding="utf-8").write(t.replace(f"2026r{cur}", f"2026r{cur+1}"))
print("cache-buster:", cur, "->", cur + 1)
PY
git add -A
git commit -q -m "data: 자동 주간 갱신 $(date +%Y-%m-%d) — auto_refresh

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push -q origin main
sleep 8
git commit -q --allow-empty -m "chore: Pages 빌드 재트리거(auto)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push -q origin main
echo "푸시 완료 — 라이브 반영 확인"
python - <<'PY'
import io, re, time, urllib.request, sys
sys.stdout.reconfigure(encoding='utf-8')
want = re.search(r"\?v=(2026r\d+)", io.open("web/index.html", encoding="utf-8").read()).group(1)
for i in range(20):
    try:
        h = urllib.request.urlopen("https://mansuk0284-jpg.github.io/viral/?a=%d" % i, timeout=20).read().decode("utf-8", "ignore")
        m = re.search(r"\?v=(2026r\d+)", h)
        if m and m.group(1) == want:
            print("LIVE", want); break
    except Exception:
        pass
    time.sleep(30)
else:
    print("!! 라이브 확인 실패(수동 점검 필요)")
PY
echo "===== auto_refresh 종료 $(date) ====="
