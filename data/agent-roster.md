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
