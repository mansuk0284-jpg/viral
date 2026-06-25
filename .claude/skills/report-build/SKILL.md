---
name: report-build
description: "매장 집계와 트렌드를 통합해 매장별 삼성vsLG 비교표 중심의 최종 바이럴 리포트를 작성한다. 종합 리포트 산출 단계에서 사용한다."
---

# Report Build

`report-builder` 에이전트의 최종 리포트 작성을 실행한다.

## 절차
1. `artifacts/YYYYMMDD-03-store-counts.md` + `...-04-trend.md` + **`...-verify.md`(검증 결과)** 로드
   - verify.md가 없거나 검증 미통과면 report 진행 전 `result-verify`부터 실행.
   - 매장별 **신뢰도 등급(높음/보통/낮음)** 과 경고를 표에 반영하고, 권역 합계는 verify.md 검산값과 대조.
2. 매장별 삼성 vs LG 비교표 작성 (롯데 부산본점·신세계 센텀 예시 필수 포함, 신뢰도 등급 열 포함)
3. **소스별 결과 분리표** 작성 (선택한 사이트별 삼성/LG 건수·표본 편차 코멘트)
3b. **시계열 섹션**(`...-timeline.md` 반영): 월별·주차별 건수 추이, 삼성비중 추이, 전월 대비 모멘텀,
   **매장별 최신성**(최근 90일 비중) — 최근 0건 매장은 "과거 누적, 현재 바이럴 아님"으로 명시.
4. 권역 합계·삼성 점유율·주목 매장 코멘트·트렌드 요약·제언 작성
4. 모든 수치에 "표본 기준 추정치" 경고, 0건 매장도 표기
5. 부록에 후기 ID↔URL 매핑
6. `artifacts/YYYYMMDD-05-report.md` 작성 후 경로 안내

상세 규칙은 `.claude/agents/report-builder.md` 참조.
