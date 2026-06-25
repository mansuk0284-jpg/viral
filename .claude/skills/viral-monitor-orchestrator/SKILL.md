---
name: viral-monitor-orchestrator
description: "웨딩카페·블로그 가전 구매후기 바이럴 모니터링 전체 흐름을 관리한다. 후기 수집부터 삼성/LG 브랜드 분류, 부산·울산·경남 백화점 매장 매칭, 혼수 트렌드 분석, 매장별 삼성vsLG 비교 리포트 작성까지 에이전트 팀을 순서대로 연결한다. 혼수 가전 바이럴·구매후기 모니터링과 관련된 모든 자연어 요청에서 가장 먼저 실행된다."
---

# Viral Monitor Orchestrator

혼수 가전 바이럴 모니터링 파이프라인. **준비 → 수집 → 집계 → 검증 → (트렌드) → 리포트** 6단계.

## 파이프라인 한눈에

| 단계 | 담당(스킬) | 산출물 |
|---|---|---|
| **P0 준비** | (오케스트레이터) | 범위·소스·매장셋 확정 |
| **P1 수집** | channel-access + 채널 `collect-*` → review-collect 병합 | `01-raw-reviews.md` |
| **P2 집계** | brand-classify → store-match | `02-classified.md`, `03-store-counts.md` |
| **P3 검증** | result-verify | `verify.md` (매장별 신뢰도 등급) |
| **P4 트렌드**(P2와 병렬) | trend-analyze | `04-trend.md` (시계열·모멘텀) |
| **P5 리포트** | report-build | `05-report.md` (매장별 삼성vsLG 비교표) |
| **P6 매출액션** | sales-growth-insight | `06-growth-actions.md` (삼성 매출성장 실행 액션) |

모든 산출물은 `artifacts/YYYYMMDD-` 접두사. 누적본 SSOT = `artifacts/cumulative-cafe-raw.json`.

## 빠른 경로 (요청 → 실행)

> **기본 정책: 묻지 말고 항상 재수집해 정확한 데이터를 낸다.** 단 직전 수집이 같은 날·같은 매장셋이면 재집계만 허용.

| 요청 | 경로 |
|---|---|
| 평상시 "최신 바이럴 분석" | P0 → P1(증분 `board --menu-id 280 --cumulative --window-months 3`) → P2 → P3 → (P4) → P5 |
| 최초/기준표 변경 후 전체 | P0 → P1(전체 백필 `board --menu-id 280 --cumulative`) → P2 → P3 → (P4) → P5 |
| 특정 매장 비교만 | P0 → P1(해당 매장 키워드 증분) → P2 → P3 → P5 |
| 트렌드만 | P4 단독 |
| 기존 데이터로 리포트만 | P5 단독 — **누적본·기준표 매장셋 일치 시에만.** 불일치면 재수집 |

---

## P0. 준비

1. **범위·키워드 확인** (이미 알면 확인만): 기간("이번 주"·"5월")·품목·특정 매장 여부.
2. **소스 선택**: `data/sources.md` 카탈로그를 `AskUserQuestion`(multiSelect)로 제시·복수선택.
   미지정 시 기본 세트 `dagyeolun`(정본). 선택한 소스ID를 세션 내내 유지하고 모든 산출물 머리말에 기록.
3. **매장셋 검증 (필수 관문)**: `data/target-stores.md`의 매장을 KakaoMap `SearchPlaceByKeywordOpen`으로
   실재/입점 검증. 폐점·미실재(예: 현대 부산점 폐점·롯데 김해점 미실재)는 **키워드에서 제외**하고 기준표에 이력 보존.
   현재 확정 = **12개점**(부산5·울산3·경남4). 기준표 불변이면 재검증 생략, 변경분만 재검증.

---

## P1. 수집

### 1-a. 접속(로그인) 게이트 — channel-access-engineer
공개검색만으론 인스타·유튜브·오늘의집·맘카페 표본이 빈약하다. 수집 전 **사용자 직접 로그인 세션**을 확보한다.
- `channel_session.py status` 점검 → 게스트 채널은 `login --channel <ch>`(여럿이면 `--channel all`).
  **사용자가 크롬 창에서 직접 로그인**(비번은 코드가 절대 안 만짐). `naver` 1회로 dagyeolun·naver-blog·맘카페(네이버분) 공통.
- 로그인된 채널 목록을 1-b 수집가에 전달. 실패/차단 채널은 **공개검색 폴백**으로 표기.
- 보안: CAPTCHA·2단계는 사용자 직접, 계정경고 의심 시 즉시 중단·보고.

### 1-b. 채널 디스패치 — 선택 소스마다 전담 에이전트(병렬 가능)
각 채널 수집가는 "**로그인 세션 우선, 없으면 공개검색 폴백**" 규칙으로 `01-raw-{소스ID}.md` 산출.

| 소스ID | 에이전트 / 스킬 | 비고 |
|---|---|---|
| dagyeolun | dagyeolun-collector / collect-dagyeolun | **정본·실데이터** (아래 board) |
| ohou | ohou-collector / collect-ohou | 모델·색상 트렌드 신호 |
| instagram | insta-collector / collect-insta | 신제품·광고필터 핵심 |
| naver-blog | blog-collector / collect-blog | 네이버 검색 API, 매장·가격 단서 강 |
| youtube | youtube-collector / collect-youtube | 정성 비교·댓글 |
| busan-mom-cafe | momcafe-collector / collect-momcafe | 권역 밀착, 비공개 多 |

6타일 외 카탈로그 소스(gyeoljun·weddingbook·tistory·dcinside 등)는 범용 `review-collector`가 WebSearch로 수집.

**dagyeolun 정본 경로 (가장 정확):** `scripts/naver_cafe_scraper.py`
- 정본 = 「후기(가전)」 게시판 **menuId 280** 정주행 `board`(키워드 `scrape`는 보조/특정매장 비교용). 글 1건=후기 1건, articleId 중복제거.
  ```
  board --menu-id 280 [--cumulative] [--window-months 3] [--read-body|--no-read-body]
  ```
- **효율 모드**: 과거 후기는 거의 안 변하므로 매번 전량 재수집하지 않는다.
  - 전체 백필(최초·기준표 변경 시): 윈도우 없이 `--cumulative` → 누적본 생성.
  - 증분(평상시): `--window-months 3`(당월+직전2개월)만 갱신. TIME 정렬이라 윈도우 경계(과거 글) 닿으면 페이징 조기 종료, 윈도우 밖은 누적본 보존.
- 본문: 제목만으론 매장이 거의 안 잡힘 → 정밀도 필요 시 `--read-body`. 본문 미수집분은 "추정" 표기.
- 「후기(가전)」은 전국 게시판 → 전량 수집·본문 분류 후 **권역 12개점 해당분만 비교표로 부각**(나머지 매장 미상/권역외).
- 보조 게시판: 328(후기·신혼혼수)·460(신혼집 프로모션). 메뉴 구조는 `menus`.

### 1-c. 병합 — review-collector
채널별 `01-raw-{소스ID}.md`를 `01-raw-reviews.md`로 병합. 각 후기에 출처 URL·소스ID·작성일(추정)·원문요약·지역/매장 단서·언급 브랜드. 소스별 건수 집계. (dagyeolun 스크래퍼는 brand/store 1차 분류 완료 → P2는 검증·보정 위주.)

**집계·audit·timeline·웹 DATA는 증분 수집이어도 항상 누적본 전체 기준으로 산출.**

---

## P2. 집계 (브랜드 분류 → 매장 매칭)

- **brand-classify**: 삼성/LG(/기타) 분류, 품목(냉장고·세탁기·건조기·TV·에어컨·스타일러 등) 태깅, 긍·부정·중립 톤 → `02-classified.md`.
- **store-match**: `data/target-stores.md` 기준 백화점 지점 매칭, 매장별 삼성/LG 건수 집계. 단서 부족은 "매장 미상(권역)"으로(버리지 않음) → `03-store-counts.md`.

---

## P3. 검증 — insight-validator (리포트 직전 관문)

- `naver_cafe_scraper.py audit` → `artifacts/YYYYMMDD-verify.md`.
- 점검 7종: ①매장 다중카운트 부풀림 ②쿼리 브랜드 편향 ③양브랜드 중복 ④매장 미상 과다 ⑤표본 부족 매장 ⑥권역 합계 산술 ⑦articleId 중복.
- **경고 처리**: 데이터 훼손(①②)은 보정/재수집 후 재검증(최대 1회). 나머지는 리포트에 신뢰도 등급·주의문구 강제 표기로 해소.
- 통과/보정 후에만 P5 진행. verify.md와 매장별 신뢰도 등급을 report-builder에 전달.

---

## P4. 트렌드 — trend-analyst (P2와 병렬, 분류 결과만 있으면 됨)

- 인기 품목·가격대·구매 사유·신제품 반응 등 혼수 트렌드 도출.
- **시계열**: `naver_cafe_scraper.py timeline` → 월별·주차별 건수, 삼성비중 추이, 최근 30/90일, 전월 대비 모멘텀, 매장별 최신성.
- 산출물: `04-trend.md`.

---

## P5. 리포트 — report-builder

- **선행 조건**: P3 검증 통과(또는 보정 완료). verify.md의 매장별 신뢰도 등급·경고 반영.
- P2(집계) + P3(검증) + P4(트렌드) 통합.
- **핵심 = 매장별 삼성 vs LG 비교표** (예: 롯데 부산본점 삼성스토어 N건 vs LG M건 / 신세계 센텀 삼성 N vs LG M).
- 권역 합계·삼성스토어 점유율·주목 매장 코멘트 + **소스별 결과 분리표**.
- 산출물: `05-report.md`.

---

## P6. 매출성장 액션 — sales-growth-strategist

- **선행 조건**: P5 리포트 완료. report·trend·verify를 입력으로 소비.
- 바이럴 신호를 **삼성스토어 실행 액션**으로 전환: ①역전·방어(LG 우세 매장 대응) ②부정후기 대응 ③트렌드 기반 진열·상담·패키지 ④표본공백 매장 모니터링 강화.
- 각 액션에 우선순위(상/중/하)·근거(매장·후기 신호)·신뢰도 등급 부착. **실적 예측·투자권유 아님**(영업 보조 제언).
- 산출물: `06-growth-actions.md`.

---

## 에러 핸들링

| 상황 | 대응 |
|------|------|
| 웹검색 결과 빈약 | 키워드 변형 재검색 1회 → 그래도 부족하면 표본 부족 명시 |
| 매장 단서 전무 | "매장 미상"으로 집계하되 권역 유지, 버리지 않음 |
| 권역 외 후기 다수 | 집계 제외, 트렌드 분석엔 참고 표기 |
| 채널 로그인 실패/차단 | 공개검색 폴백 표기, 한계 명시 (우회 금지) |
| 에이전트 1회 실패 | 1회 재시도 → 실패 시 해당 산출물 없이 진행, 사용자 알림 |
| 표본 편향 우려 | 리포트에 "표본 기준 추정치, 전수 아님" 경고 고정 |
| 검증 경고 — 부풀림/편향(①②) | 보정·재수집 후 재검증 1회. 불가 시 한계를 수치로 명시 |
| 검증 경고 — 미상과다/표본부족 | 진행하되 매장 신뢰도 등급·주의문구 강제 |
| 권역 합계 산술 불일치 | audit 검산값으로 리포트 수치 교정 후 진행 |

---

## 테스트 시나리오

- **정상**: "이번 달 부울경 웨딩카페 삼성스토어 바이럴 분석" → 수집→분류→매장별 비교표→트렌드→리포트, 모든 건수에 출처·"추정치".
- **특정 매장**: "신세계 센텀 삼성 vs LG만" → 센텀 키워드 중심 수집, 해당 지점 비교표 단독.
- **표본 부족**: "어제 하루 김해 롯데 후기" → 표본 적음 경고, 무리한 수치화 금지, 원문만 제시.
