# 에이전트·스킬 임무 정리 (Roster) — 단일 진실원천

이 표가 "누가 무엇을 하는지"의 기준이다. 임무가 겹치면 여기서 경계를 정한다.
파이프라인 단계는 `viral-monitor-orchestrator` 스킬(P0~P6) 기준.

## 1. 수집 계층 — 채널 전담 (산출물: `01-raw-{소스ID}.md`)

| 에이전트 | 스킬 | 담당 채널 | 수집 방식 | 경계(딱 이것만) |
|---|---|---|---|---|
| dagyeolun-collector | collect-dagyeolun | 다이렉트결혼준비 | 카페 스크래퍼(board menuId 280, 정본) | 실데이터 정본. 키워드검색은 보조 |
| blog-collector | collect-blog | 네이버 블로그 | 스크래퍼 `collect_blog.py`(통합검색, 월 윈도×36쿼리, .done 재개) | 장문 후기·매장단서. 체험단 별도 집계 |
| momcafe-collector | collect-momcafe | 부울경 맘카페 | (보류) 표본 4건 — 히어로 타일·매장 카드에서 제외(2026-08-27) | 재개 시 표본 확보가 선결 |
| youtube-collector | collect-youtube | 유튜브 | 스크래퍼 `collect_youtube.py`(검색 26종+성능 20종) | 게시월은 상대표기 환산 추정. 매장단서 약함 |
| ohou-collector | collect-ohou | 오늘의집 | 헤디드 실프로필 `collect_ohou.py`+`enrich_ohou.py`(게시일 추정) | 매장 축 없음(단서 3/182) — 모델·공간 트렌드 전담 |
| insta-collector | collect-insta | 인스타그램 | 세션캡처(로그인월) | 트렌드 신호용(협찬 필터) |

## 1-B. 제휴카페 계층 (혼수 채널과 잣대가 다름 — 합산 금지)

| 에이전트 | 스킬 | 담당 | 해석 축 | 경계(딱 이것만) |
|---|---|---|---|---|
| affiliate-cafe-analyst | affiliate-cafe-insight | 회사 제휴카페 84곳(1,136만명) | ①교체·이사 ②경쟁노출 ③구매상담 ④제휴활동 ⑤중고 ⑥구독·렌탈 ⑦사후서비스 ⑧온라인 | 혼수 후기 건수로 평가 금지. 다이렉트결혼준비와 **합산 금지** |

**왜 분리하나(2026-08-12 실측):** 제휴카페는 지역 생활 커뮤니티라 혼수 표본이 거의 없다.
거사모(46.9만) 83건 중 실구매후기 2건, 올댓창원(7.5만) 5건. 반면 다이렉트결혼준비는 72,413건
(「후기(가전)」 전용 게시판 보유). 같은 자로 재면 제휴카페는 전부 실패로 보이지만,
경쟁 유통의 지역 마케팅 노출·미결정 고객 문의 같은 **다른 신호**가 나온다.

## 1-C. 네이버 리뷰·예약 계층 (세 번째 잣대 — 합산 금지)

| 에이전트 | 담당 | 해석 축 | 경계(딱 이것만) |
|---|---|---|---|
| naver-review-analyst | 네이버 플레이스 매장 리뷰 — 명부 71곳(전국, 수집 67·매장 131) | 리뷰 규모·추이 / 칭찬(네이버 집계) / 아쉬움 원문 / 방문사유 / 매니저 실명 / 예약 경유(추정) | 예약 **건수 단정 금지**(관리자 전용). 혼수 후기와 **합산 금지** — 방문 평가와 구매 후기는 다른 표본 |

**왜 분리하나:** 구매 후기는 '무엇을 샀나', 방문 리뷰는 '어떻게 응대받았나'를 말한다.
전자는 품목·브랜드 경쟁을, 후자는 **매장 운영 품질과 온라인 노출량**을 드러낸다.


## 도구 인벤토리 (2026-08-21 점검)

실행 경로에 있는 스크립트만 남겼다. 진단용·1회용은 제거했다.

| 스크립트 | 쓰임 |
|---|---|
| `naver_cafe_scraper.py` | 카페 수집 정본(board/scrape/audit/timeline). VIRAL_CLUBID 로 대상 교체 |
| `collect_cafe.py` | 카페 **범용** 전구간 수집(clubId/menuId 인자화). 새 카페를 통째로 긁을 때 |
| `collect_history.py` | 다이렉트결혼준비 전용 과거 수집(collect_cafe 의 원형) |
| `build_web_data.py` | census → `web/assets/cafe-data.js` (매칭 규칙 SSOT) |
| `affiliate_insight.py` / `build_affiliate_web.py` | 제휴카페 리포트 / 웹 데이터 |
| `naver_place_collect.py` / `naver_review_insight.py` / `build_naver_review_web.py` | 네이버 리뷰 수집 / 리포트 / 웹 |
| `build_compete.py` / `compete_viral_link.py` | 경쟁력 자료 / 바이럴 교차 |
| **`place_gate.py`** | **네이버 플레이스 수집분을 거르는 공용 SSOT.** 모바일(MX)·백화점 밖 단독점·이름표≠상호 오매칭·중복 플레이스를 걸러내고, 명부(`백화점 리스트.xlsx`) 이름으로 맞춘다. **화면과 리포트가 반드시 이걸 같이 쓴다** — 각자 거르다 119곳/130곳으로 갈라진 적이 있다 |
| `brand_lexicon.py` | 브랜드 분류 공용 SSOT |
| `channel_session.py` / `channel_analyze.py` | 채널 로그인 세션 / 세션캡처 분석 |
| `naver_api_collect.py` / `naver-search.ps1` | ⚠ 네이버 검색 API 경로 — **신규 발급 중단**으로 동작 불가([[naver-search-api-discontinued]]) |
| `youtube_collect.py` | 유튜브 — API 키 미등록 상태 |
| `geojson_to_svg.py` / `build_cafes_data.py` | 지도 SVG / 제휴카페 타일 데이터 |
| `analyze_2026.py` / `analyze_board_full.py` | 카페 분석 보조 |

## 2. 접속 계층

| 에이전트 | 스킬 | 임무 |
|---|---|---|
| channel-access-engineer | channel-access | 채널 로그인 세션을 `.browser-profile`에 저장·점검. **비번·키는 코드가 절대 입력 안 함**(사용자 수동) |

## 3. 분석·집계 계층 (파이프라인 P1~P6)

| 단계 | 에이전트 | 스킬 | 임무 | 경계 |
|---|---|---|---|---|
| P1 병합 | review-collector | review-collect, naver-cafe-survey | 채널 산출물 병합 + 기타 카탈로그 범용 수집 | 수집만. 분류·매칭은 안 함 |
| P2 분류 | brand-classifier | brand-classify | 삼성/LG·품목·톤 분류(별칭 사전+`\bLG\b` 보정) | 브랜드·품목·톤만. 매장매칭 안 함 |
| P3 매칭 | store-matcher | store-match | 권역 12개점 매장 매칭·매장별 건수 | 매칭·집계만. 단서 부족→"매장 미상" |
| P4 검증 | insight-validator | result-verify | 리포트 직전 부풀림·편향·산술 audit | 검증만. 보정 1회 후 통과/등급 |
| P5 트렌드 | trend-analyst | trend-analyze | 품목·가격·사유·시계열 | 정성·시계열. 매장집계 안 함 |
| P5 리포트 | report-builder | report-build | 매장별 삼성vsLG 비교표 + 종합 | 종합만. 새 수집 안 함 |
| P6 액션 | sales-growth-strategist | sales-growth-insight | 리포트→매출성장 실행 액션 | 액션 변환만 |

## 4. 시각화·검수 계층 (UI/대시보드)

| 에이전트 | 스킬/자산 | 임무 | 경계 |
|---|---|---|---|
| geo-viz-designer | geo-status-map · `web/assets/korea-sido.*` | 지도 위 데이터 표현(코로플레스·말풍선·라벨 겹침·글씨 대비·작은지역) | 지도 표기 품질만. 집계 로직 안 건드림 |
| instruction-steward | — | 다항목 지시를 체크리스트로 종합→실제 검증→완료/미완/주의 정직 보고 | 검수·보고만. 누락·과장 방지 |

## 5. 오케스트레이션

| 에이전트/스킬 | 임무 |
|---|---|
| viral-monitor-orchestrator(스킬) | P0~P6 전체 흐름 관리. 소스 선택·매장 실재검증(KakaoMap)·재수집 정책 |

## 임무 경계 원칙 (중복 방지)

- **수집 ≠ 분류 ≠ 매칭 ≠ 검증**: 한 계층은 다음 계층 입력만 만든다. 역류 금지.
- **UI 계층은 데이터 계층을 수정하지 않는다**: geo-viz-designer는 표현만, 집계 수치는 분석 계층 산출물 사용.
- **검수는 별도**: instruction-steward는 만들지 않고 확인·보고만 한다(객관성).
- **정직성 공통**: 표본 추정치 표기, 매장 미상 보존, 없는 데이터 임의 생성 금지, 한 화면 원칙([[ui-one-screen-principle]]).


## 2026-09-08 재정립 — 정기 갱신 파이프라인(정본)

월/주 단위 갱신은 **`scripts/refresh_all_202608.sh` 한 벌**이 정본이다(순차 실행,
프로필 `.browser-profile2` 공유 — 동시 실행 금지):

```
① 다결 board 증분(당월+전월, 본문 포함)
①-b merge_board_into_census.py     ← 이 다리가 없으면 화면에 안 나온다(9월 사고)
② census 키워드 재훑기(당월 .done 제거 후 — board 선행 시 +0이 정상)
③ 블로그 당월 재훑기(.done 에서 `쿼리|YYYYMM01` 제거 후, --out 기존 파일)
④~⑦ 제이웨딩 · 유튜브 · 오늘의집(+enrich) · 인스타(세션 필요 — 만료 시 0건 산출은 격리)
⑧ 플레이스 리뷰 전국(TARGETS 71곳, --max-reviews 150)
⑨ 빌드 7종(build_web_data → blog → jwedding → youtube → instagram → ohou → naver_review)
```

- 인스타 재수집 산출은 회차 스냅샷 — 직전 산출과 **id union 병합 후 빌드**.
- 배포 = 캐시버스터(`?v=2026rNNN`) 증가 → commit → push → 빈 커밋 재트리거 →
  라이브 버전 폴링. 자동 주간 실행은 `scripts/auto_refresh.sh`(작업 스케줄러 등록).
- 기간 칩·월 목록은 전부 **데이터 파생** — 수집이 그 달을 담으면 화면은 자동.

### 검증 계층(빌드 뒤 반드시)

| 역할 | 무엇 |
|---|---|
| insight-validator | 집계 감사(부풀림·편향·산술) — 리포트/배포 직전 |
| instruction-steward | 다항목 지시 체크리스트 검수 — 큰 개편 마무리 |
| (자동 스모크) | auto_refresh 가 주요 화면 pageerror·가로스크롤·핵심 수치 존재를 확인, 실패 시 푸시 중단 |
