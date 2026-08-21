# 에이전트·스킬 임무 정리 (Roster) — 단일 진실원천

이 표가 "누가 무엇을 하는지"의 기준이다. 임무가 겹치면 여기서 경계를 정한다.
파이프라인 단계는 `viral-monitor-orchestrator` 스킬(P0~P6) 기준.

## 1. 수집 계층 — 채널 전담 (산출물: `01-raw-{소스ID}.md`)

| 에이전트 | 스킬 | 담당 채널 | 수집 방식 | 경계(딱 이것만) |
|---|---|---|---|---|
| dagyeolun-collector | collect-dagyeolun | 다이렉트결혼준비 | 카페 스크래퍼(board menuId 280, 정본) | 실데이터 정본. 키워드검색은 보조 |
| blog-collector | collect-blog | 네이버 블로그 | 검색 API(`naver_api_collect.py`) | 장문 후기·매장단서. 체험단 필터 |
| momcafe-collector | collect-momcafe | 부울경 맘카페 | 카페 검색 API + 권역필터 | 권역 밀착. 비공개글 한계 명시 |
| youtube-collector | collect-youtube | 유튜브 | Data API v3(영상+댓글) | 신제품 반응. 매장단서 약함 |
| ohou-collector | collect-ohou | 오늘의집 | 세션캡처(공개 API 없음) | 디자인가전 트렌드 신호 |
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
| naver-review-analyst | 네이버 플레이스 매장 리뷰 14곳 | 리뷰 규모·추이 / 칭찬(네이버 집계) / 아쉬움 원문 / 방문사유 / 매니저 실명 / 예약 경유(추정) | 예약 **건수 단정 금지**(관리자 전용). 혼수 후기와 **합산 금지** — 방문 평가와 구매 후기는 다른 표본 |

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
