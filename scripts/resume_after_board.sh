#!/bin/bash
# 일회성 재개 드라이버(2026-10-26) — 고아 board 수집기(PID 인자)가 끝나길 기다렸다가
# refresh_all 의 나머지 단계(①-b~⑨, 플레이스 제외)를 이어 돌린다.
# 배경: 수동 배치와 스케줄 실행이 겹쳐 수동 배치를 중지했는데 board 자식이
# 살아남아 정상 수집을 계속하고 있었다 — 죽이지 않고 결과를 이어받는다.
export PYTHONUNBUFFERED=1
cd "C:/Users/admin/Desktop/viral"
PID="${1:?대기할 PID}"
CUR=$(date +%Y-%m)
CUR0=$(date +%Y%m01)
STAMP=$(date +%Y%m%d-%H%M)
LOG="artifacts/logs/refresh-$STAMP-resume.log"
exec > >(tee -a "$LOG") 2>&1
step(){ echo; echo "===== [$(date +%H:%M:%S)] $1 ====="; }
echo "당월=$CUR · board PID $PID 종료 대기"

while tasklist //FI "PID eq $PID" 2>/dev/null | grep -q "$PID"; do sleep 60; done
echo "[$(date +%H:%M:%S)] board 수집기 종료 확인 — 나머지 단계 시작"

step "①-b board 누적본 → census 병합"
python scripts/merge_board_into_census.py || echo "!! 병합 실패"

step "② census 당월($CUR) 재훑기(.done 정리 후)"
python - "$CUR" <<'PY'
import io, sys
cur = sys.argv[1]
p = "artifacts/cafe-census.json.done"
t = io.open(p, encoding="utf-8").read().split()
t2 = [x for x in t if x != cur]
io.open(p, "w", encoding="utf-8").write(" ".join(t2))
print(f"done에서 {cur} 제거:", len(t), "→", len(t2))
PY
python scripts/collect_history.py --start "$CUR" --end "$CUR" --out artifacts/cafe-census.json || echo "!! census 실패"

step "③ 블로그 당월 재훑기(done 키 정리 후)"
python - "$CUR0" <<'PY'
import io, os, sys
key = "|" + sys.argv[1]
p = "artifacts/20260825-channel-blog.json.done"
if os.path.exists(p):
    lines = io.open(p, encoding="utf-8").read().split("\n")
    keep = [l for l in lines if key not in l]
    io.open(p, "w", encoding="utf-8").write("\n".join(keep))
    print(f"blog done({key}):", len(lines), "→", len(keep))
PY
python scripts/collect_blog.py --scrolls 8 --out artifacts/20260825-channel-blog.json || echo "!! 블로그 실패"

step "④ 제이웨딩 재수집"
python scripts/collect_channels.py --channel jwedding --pages 25 || echo "!! 제이웨딩 실패"

step "⑤ 유튜브 재수집"
python scripts/collect_youtube.py --pages 2 || echo "!! 유튜브 실패"

step "⑥ 오늘의집 재수집 + 상세 보강"
python scripts/collect_ohou.py || echo "!! 오늘의집 수집 실패"
python scripts/enrich_ohou.py || echo "!! 오늘의집 enrich 실패"

step "⑦ 인스타 재수집(저장된 로그인 세션 사용)"
python scripts/collect_instagram.py || echo "!! 인스타 실패"

step "⑦-b 인스타 union 가드"
python scripts/merge_instagram_snapshots.py || echo "!! 인스타 병합 실패"

step "⑦-c 스냅샷 빈 산출 격리"
python scripts/snapshot_guard.py youtube ohou jwedding || echo "!! 스냅샷 가드 실패"

step "⑨ 웹 데이터 빌드 전부"
python scripts/build_web_data.py         || echo "!! build_web_data 실패"
python scripts/build_blog_web.py         || echo "!! build_blog 실패"
python scripts/build_jwedding_web.py     || echo "!! build_jwedding 실패"
python scripts/build_youtube_web.py      || echo "!! build_youtube 실패"
python scripts/build_instagram_web.py    || echo "!! build_instagram 실패"
python scripts/build_ohou_web.py         || echo "!! build_ohou 실패"
python scripts/build_naver_review_web.py || echo "!! build_naver_review 실패"

step "완료"
echo "ALL DONE $(date)"
