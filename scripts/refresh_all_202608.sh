#!/bin/bash
# 8월 마감(8/31) 전 채널 재수집 드라이버 — 2026-09-08 실행
# 헤디드 브라우저(.browser-profile 공유)라 반드시 순차 실행.
export PYTHONUNBUFFERED=1
cd "C:/Users/admin/Desktop/viral"
LOG=artifacts/refresh-202608.log
exec > >(tee -a "$LOG") 2>&1
step(){ echo; echo "===== [$(date +%H:%M:%S)] $1 ====="; }

step "① 다결 board 증분(당월+전월, 본문 포함)"
python scripts/naver_cafe_scraper.py board --menu-id 280 --cumulative --window-months 2 --read-body \
  || echo "!! 다결 board 실패"

step "①-b board 누적본 → census 병합(이게 없으면 화면에 안 나온다)"
python scripts/merge_board_into_census.py || echo "!! 병합 실패"

step "② census 2026-08 재훑기(.done 정리 후)"
python - <<'PY'
import io
p = r"artifacts/cafe-census.json.done"
t = io.open(p, encoding="utf-8").read().split()
t2 = [x for x in t if x != "2026-08"]
io.open(p, "w", encoding="utf-8").write(" ".join(t2))
print("done에서 2026-08 제거:", len(t), "→", len(t2))
PY
python scripts/collect_history.py --start 2026-08 --end 2026-08 --out artifacts/cafe-census.json || echo "!! census 실패"

step "③ 블로그 2026-08 재훑기(done 정리 후)"
python - <<'PY'
import io, os
p = r"artifacts/20260825-channel-blog.json.done"
if os.path.exists(p):
    lines = io.open(p, encoding="utf-8").read().split("\n")
    keep = [l for l in lines if "|2026-08" not in l]
    io.open(p, "w", encoding="utf-8").write("\n".join(keep))
    print("blog done:", len(lines), "→", len(keep))
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
python scripts/collect_instagram.py || echo "!! 인스타 실패(세션 만료 가능 — insta_login.py 필요)"

step "⑧ 네이버 플레이스 전 매장(전국) 리뷰 재수집"
python scripts/naver_place_collect.py --max-reviews 150 || echo "!! 플레이스 실패"

step "⑨ 웹 데이터 빌드 전부"
python scripts/build_web_data.py        || echo "!! build_web_data 실패"
python scripts/build_blog_web.py        || echo "!! build_blog 실패"
python scripts/build_jwedding_web.py    || echo "!! build_jwedding 실패"
python scripts/build_youtube_web.py     || echo "!! build_youtube 실패"
python scripts/build_instagram_web.py   || echo "!! build_instagram 실패"
python scripts/build_ohou_web.py        || echo "!! build_ohou 실패"
python scripts/build_naver_review_web.py || echo "!! build_naver_review 실패"

step "완료"

step "완료"
echo "ALL DONE $(date)"
