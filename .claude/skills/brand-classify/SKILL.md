---
name: brand-classify
description: "수집된 가전 후기를 삼성/LG/기타로 분류하고 품목·긍부정 톤을 태깅한다. 원본 후기 분류·정규화 단계에서 사용한다."
---

# Brand Classify

`brand-classifier` 에이전트의 분류 작업을 실행한다.

## 절차
1. `artifacts/YYYYMMDD-01-raw-reviews.md` 로드
2. 각 후기를 삼성/LG/기타로 분류, 비스포크·오브제 등 단서 활용
3. 여러 품목은 품목 단위로 행 분리, 비교글은 브랜드별 각각 카운트
4. 긍·부정·중립 톤과 근거 문장 기록, 광고/체험단은 제외후보 표기
5. `artifacts/YYYYMMDD-02-classified.md` 작성

상세 규칙은 `.claude/agents/brand-classifier.md` 참조.
