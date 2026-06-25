---
name: store-match
description: "분류된 후기를 부산·울산·경남 백화점 지점에 매칭하고 매장별 삼성/LG 건수를 집계한다. 매장 단위 바이럴 비교 집계 단계에서 사용한다."
---

# Store Match

`store-matcher` 에이전트의 매장 매칭·집계 작업을 실행한다.

## 사용 도구
- `data/target-stores.md`: 대상 매장 기준
- `KakaoMap-SearchPlaceByKeywordOpen`: 모호한 매장 실재 확인 (선택)

## 절차
1. `artifacts/YYYYMMDD-02-classified.md` 로드
2. 매장 단서로 백화점 지점 매칭, 권역 외는 제외, 단서 부족은 "매장 미상"
3. 지점 × 브랜드 건수표 + 권역 합계 + **소스별 분리 집계표** 작성
4. 매칭 근거 로그 남김
5. `artifacts/YYYYMMDD-03-store-counts.md` 작성 ("표본 추정치" 표기)

상세 규칙은 `.claude/agents/store-matcher.md` 참조.
