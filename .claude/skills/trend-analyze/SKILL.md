---
name: trend-analyze
description: "혼수 가전 후기에서 인기 품목·가격대·브랜드 선택 사유·신제품 반응 등 트렌드를 분석한다. 혼수 트렌드 파악 요청 시 독립적으로도 사용한다."
---

# Trend Analyze

`trend-analyst` 에이전트의 트렌드 분석을 실행한다.

## 절차
1. `artifacts/YYYYMMDD-02-classified.md`(또는 01) 로드
2. 인기 품목·가격대·브랜드 선택 사유·신제품 반응·계절성 도출
3. **시계열(월별·주차별) 분석** — 카페 수집분은 도구로 산출:
   ```
   $py = "C:\Users\admin\AppData\Local\Programs\Python\Python312\python.exe"
   & $py scripts\naver_cafe_scraper.py timeline --raw artifacts\YYYYMMDD-cafe-raw.json --weeks 12 --months 6
   ```
   → `artifacts/YYYYMMDD-timeline.md` (월별/주차별 전체·삼성·LG·삼성비중, 최근 30/90일, 전월 대비 모멘텀, 매장별 최신성).
   - **삼성 비중 추이**와 **모멘텀(증감)** 을 트렌드 핵심 지표로 해석.
   - 월중 진행 월은 미완임을 명시(예: 이달 건수는 마감 전).
4. 정량(빈도)+정성(대표 문장) 병기, 표본 작으면 "경향"으로 서술
5. 영업 시사점 한 줄 추가
6. `artifacts/YYYYMMDD-04-trend.md` 작성 (시계열 표·모멘텀 포함)

상세 규칙은 `.claude/agents/trend-analyst.md` 참조.
