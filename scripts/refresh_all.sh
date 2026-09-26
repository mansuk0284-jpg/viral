#!/bin/bash
# 전 채널 정기 재수집 드라이버(범용) — 실행 시점의 당월을 자동 계산한다.
# 8월 하드코딩 배치(refresh_all_202608.sh)의 후속 정본. 2026-09-22 신설.
# 헤디드 브라우저(.browser-profile2 공유)라 반드시 순차 실행 — 동시 실행 금지.
#
# 사용:  bash scripts/refresh_all.sh [--no-place] [--no-insta]
#   --no-place  플레이스 131매장 재수집 생략(수 시간 소요 — 최근 돌렸으면 생략)
#   --no-insta  인스타 수집 생략(세션 만료 확인 시 — union 병합·빌드는 그대로 수행)
export PYTHONUNBUFFERED=1
cd "C:/Users/admin/Desktop/viral"
CUR=$(date +%Y-%m)        # 당월 (census .done 키)
CUR0=$(date +%Y%m01)      # 당월 윈도 시작일 (블로그 .done 키의 날짜부)
STAMP=$(date +%Y%m%d-%H%M)
LOG="artifacts/logs/refresh-$STAMP.log"
mkdir -p artifacts/logs
exec > >(tee -a "$LOG") 2>&1
step(){ echo; echo "===== [$(date +%H:%M:%S)] $1 ====="; }
DO_PLACE=1; DO_INSTA=1
for a in "$@"; do
  [ "$a" = "--no-place" ] && DO_PLACE=0
  [ "$a" = "--no-insta" ] && DO_INSTA=0
done
echo "당월=$CUR · place=$DO_PLACE · insta=$DO_INSTA"

step "① 다결 board 증분(당월+전월, 본문 포함)"
python scripts/naver_cafe_scraper.py board --menu-id 280 --cumulative --window-months 2 --read-body \
  || echo "!! 다결 board 실패"

step "①-b board 누적본 → census 병합(이게 없으면 화면에 안 나온다)"
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
python scripts/collect_history.py --start "$CUR" --end "$CUR" --out artifacts/cafe-census.json \
  || echo "!! census 실패"

step "③ 블로그 당월 재훑기(done 키 정리 후)"
# .done 키 형식은 「쿼리|YYYYMMDD(윈도 시작일)」 — "|YYYY-MM" 은 0건 매치(2026-09-08 실사고)
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
python scripts/collect_blog.py --scrolls 8 --out artifacts/20260825-channel-blog.json \
  || echo "!! 블로그 실패"

step "④ 제이웨딩 재수집"
python scripts/collect_channels.py --channel jwedding --pages 25 || echo "!! 제이웨딩 실패"

step "⑤ 유튜브 재수집"
python scripts/collect_youtube.py --pages 2 || echo "!! 유튜브 실패"

step "⑥ 오늘의집 재수집 + 상세 보강"
python scripts/collect_ohou.py || echo "!! 오늘의집 수집 실패"
python scripts/enrich_ohou.py || echo "!! 오늘의집 enrich 실패"

if [ "$DO_INSTA" = "1" ]; then
step "⑦ 인스타 재수집(저장된 로그인 세션 사용)"
python scripts/collect_instagram.py || echo "!! 인스타 실패(세션 만료 가능 — insta_login.py 필요)"
fi

step "⑦-b 인스타 스냅샷 위생 + union 병합(0건 산출이 화면을 덮지 않게)"
python scripts/merge_instagram_snapshots.py || echo "!! 인스타 병합 실패"

if [ "$DO_PLACE" = "1" ]; then
step "⑧ 네이버 플레이스 전 매장(전국) 리뷰 재수집"
python scripts/naver_place_collect.py --max-reviews 150 || echo "!! 플레이스 실패"
fi

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
