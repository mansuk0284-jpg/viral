---
name: sales-growth-insight
description: "바이럴 모니터링 결과를 삼성스토어 매출성장 실행 액션으로 전환한다. LG 우세 역전책·부정후기 대응·트렌드 기반 진열/상담·표본공백 강화를 우선순위로 도출. sales-growth-strategist 에이전트가 리포트(P5) 직후 사용."
---

# Sales Growth Insight

`sales-growth-strategist` 에이전트의 작업. 모니터링 결과 → 매출성장 액션 변환(P6).

## 입력
- `artifacts/YYYYMMDD-05-report.md` (매장별 삼성vsLG·점유율)
- `artifacts/YYYYMMDD-04-trend.md` (품목·선택사유·신제품 반응)
- `artifacts/YYYYMMDD-03-store-counts.md` (0건/표본공백 포함)
- `artifacts/YYYYMMDD-verify.md` (매장별 신뢰도 등급)

## 절차
1. 리포트·트렌드·검증을 읽어 매장별 우세/열세·격차 사유 가설을 정리.
2. 4개 액션 축으로 분해: ①역전·방어 ②부정후기 대응 ③트렌드 기반 제안 ④모니터링 강화.
3. 각 액션에 **우선순위(상/중/하)** + **근거(매장·후기 신호)** + **신뢰도 등급** 부착.
4. 신뢰도 낮은 근거는 "표본 기준 가설"로 표기하고 검증 액션을 함께 제시.
5. 표준 양식으로 `06-growth-actions.md` 작성.

## 원칙
- 액션은 구체·실행가능(품목·색상·시연·진열 위치까지). 추상적 슬로건 금지.
- 실적·매출을 약속·예측하지 않는다(영업 보조 제언, 투자권유 아님).
- LG 우세는 사유 인정 위에서 삼성 차별점으로 대응. 깎아내리기 금지.

## 산출물
`artifacts/YYYYMMDD-06-growth-actions.md` (양식은 `.claude/agents/sales-growth-strategist.md` 참조).
오케스트레이터 P5(리포트) 직후 호출되며, 최종 사용자 안내에 액션 경로를 포함한다.
