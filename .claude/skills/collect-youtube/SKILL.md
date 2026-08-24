---
name: collect-youtube
description: "유튜브 혼수 브이로그·가전 리뷰 영상의 제목·설명·댓글에서 가전 후기 신호를 수집한다. 신제품 반응·정성 비교 위주. youtube-collector 에이전트가 사용."
---

# Collect Youtube

`youtube-collector` 에이전트의 수집 작업. 소스ID = `youtube`. 공개검색 보조(비공식).

## 접속 우선순위 (Data API 1순위 — 정적 덤프는 JS 렌더라 빈약)
- 유튜브는 JS 렌더라 세션 정적 덤프가 링크 8건뿐이었다. → **YouTube Data API v3가 정본 경로.**
- `scripts/youtube_collect.py`가 search.list(영상)+commentThreads.list(상위 댓글)을 호출해 **제목+설명+댓글**을 합산 분석한다(naver_api_collect의 분류·매장매칭 재사용).
- 키 `YOUTUBE_API_KEY`는 **사용자가 직접 setx로 등록**(코드 미입력). 미설정이면 수집기가 안내 후 중단.

## 키 없이 도는 실경로 — `scripts/collect_youtube.py` (Playwright)

`YOUTUBE_API_KEY` 가 없는 현재 환경의 **정본 경로**. 검색 결과 DOM에서
제목·채널·조회수·게시시점을 읽어 `artifacts/YYYYMMDD-channel-youtube.json`
({id,title,channel,views,when,url,samsung,lg,ad,queries})을 만든다.
빌드(`build_youtube_web.py`)가 이 최신 파일을 집는다.

```
python scripts/collect_youtube.py --pages 2            # --out 로 산출 경로 지정 가능
```

검색어는 두 층(2026-08-26 확장, 26 → 46개):
- `QUERIES` 26개 — 혼수×가전. keep 필터 = 가전 낱말 **그리고** 혼수 맥락(WEDDING).
- `PERF_QUERIES` 20개 — 성능·비교·전문리뷰·신모델("삼성 LG TV 비교"·"잇섭 가전" 등,
  사용자 지시: 제품 성능·전문 유튜버 카테고리 추가). 이 검색어로 온 영상은
  **혼수 낱말 면제**(가전 낱말은 여전히 필수 — 무관 영상 차단).
- 재수집분은 기존 산출물과 **id 로 중복 제거하며 병합**해 새 날짜 파일로 저장한다
  (기존 영상의 조회수는 기존값 유지 — 지어내지 않는다, queries 만 union).

## 사용 도구
- **`scripts/youtube_collect.py` (1순위, 정본 경로)**: Data API → 표준 산출물 자동 생성.
- `WebSearch`/`WebFetch`: 키 미발급 시 폴백(영상 설명란·노출 댓글). 표본 빈약 명시.
- 상세 규칙: `.claude/agents/youtube-collector.md`

## 절차 (정본)
```
python scripts/youtube_collect.py
# 쿼터 절약/확대:  --max-videos 20 --max-comments 30
# 쿼리 커스텀:     --query "비스포크 혼수 냉장고 후기" --query "LG 오브제 신혼 후기"
```
1. 키 미설정이면 수집기가 발급·등록 안내 후 중단. 사용자에게 `YOUTUBE_API_KEY` 등록 요청.
2. 영상 제목+설명+상위 댓글을 합쳐 brand/item/tone/ad 분류 + 12개점 매장매칭. 댓글 비공개 영상은 제목·설명만.
3. 협찬/광고 영상은 수집기가 `[광고추정]` 자동 태깅. 유튜브는 전국 콘텐츠라 매장 매칭이 드묾 → 트렌드·신제품 반응 신호 위주로 해석.
4. 쿼터(기본 10,000 units/일, search=100·comment=1) 고려해 쿼리·max-videos 과확대 금지.

## 표준 양식 (artifacts/YYYYMMDD-01-raw-youtube.md)
```
# 원본 후기 수집 — 유튜브 [기간]
> 소스ID: youtube · 채널: 영상·댓글(공개검색) · 수집 건수: N

## Y-01
- 출처: [영상 url]
- 소스ID: youtube
- 작성일: [업로드일 YYYY-MM-DD 또는 (추정)]
- 지역·매장 단서: [있으면 / 없으면 매장미상]
- 언급 브랜드: [삼성/LG/기타]
- 언급 품목: [냉장고/세탁기/...]
- 원문 요약: [영상 요지 1~2줄]
- 비고: [광고추정/댓글 다수 의견 요약 등]
```
trend-analyst의 신제품 반응·정성 비교 분석에 기여. review-collector가 `01-raw-reviews.md`로 병합.
