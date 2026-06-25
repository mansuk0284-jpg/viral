---
name: result-verify
description: "매장 집계·트렌드 결과를 리포트 직전에 자동 감사(QA)한다. 매장 다중카운트 부풀림·쿼리 브랜드 편향·양브랜드 중복·매장 미상 과다·표본 부족·권역 합계 산술오류·articleId 중복을 점검한다. 집계 신뢰도 검증이 필요할 때 사용한다."
---

# Result Verify

`insight-validator` 에이전트의 집계 검증(QA)을 실행한다. **report-build 직전 관문.**

## 절차

1. **결정론적 감사**: 카페 수집분은 audit 도구로 점검한다.
   ```
   $py = "C:\Users\admin\AppData\Local\Programs\Python\Python312\python.exe"
   & $py scripts\naver_cafe_scraper.py audit            # 오늘자 cafe-raw.json
   & $py scripts\naver_cafe_scraper.py audit --raw artifacts\YYYYMMDD-cafe-raw.json
   ```
   → `artifacts/YYYYMMDD-verify.md` 생성(판정·경고·매장별 신뢰도·권역 검산).
2. **판정 해석**:
   - 경고 0건 → "검증 통과" 후 report-build.
   - 경고 존재 → 유형별 조치(아래 표). 데이터 훼손 유형(부풀림·편향)은 보정/재수집 후 재검증(최대 1회).
3. **비카페 소스**(블로그·커뮤니티 등): audit 도구가 못 읽으므로 동일 7항목을 수기 체크.
4. report-builder에 `verify.md`와 매장별 신뢰도 등급을 전달. 리포트는 신뢰도·한계 문구를 강제 표기.

## 점검 7항목 / 조치

| 유형 | 조치 |
|------|------|
| 1 매장 다중카운트 부풀림 | 리스트·비교글 → "매장 미상" 강등 후 재집계 |
| 2 쿼리 브랜드 편향 | 브랜드 중립 쿼리로 재수집 |
| 3 양브랜드 동시언급 | "양쪽 카운트, 중복 아님" 명시 |
| 4 매장 미상 ≥50% | 대표성 주의 + 소스 추가 권고 |
| 5 표본 <5건 매장 | "경향"으로만 서술 |
| 6 권역 합계 산술 | 수치 교정 |
| 7 articleId 중복 | 중복제거 점검 |

## 산출물

`artifacts/YYYYMMDD-verify.md`. 상세 규칙은 `.claude/agents/insight-validator.md` 참조.
