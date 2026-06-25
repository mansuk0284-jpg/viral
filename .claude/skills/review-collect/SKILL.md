---
name: review-collect
description: "웨딩카페·블로그에서 혼수 가전 구매후기를 웹검색으로 수집한다. 부산·울산·경남 권역 백화점 삼성스토어·LG 관련 후기 채집 요청 시 사용한다."
---

# Review Collect

`review-collector` 에이전트의 후기 수집 작업을 실행한다.

## 사용 도구
- `scripts/naver_cafe_scraper.py`: **다이렉트결혼준비 카페 로컬 자동 스크래퍼** (dagyeolun 소스 1순위·최정확)
- `scripts/naver-search.ps1`: 네이버 카페/블로그 검색 API (naver-cafe-all/blog 소스)
- `data/naver-api.md`: API 키 설정·한계 가이드
- `data/sources.md`: 선택된 소스 카탈로그 (소스별 수집 채널 명시)
- `WebSearch`: 커뮤니티(클리앙·뽐뿌 등) 보조 검색
- `WebFetch`: 필요 시 본문 확인

## 절차
1. **세션에서 선택된 소스만** 수집. 소스별 채널이 다르다(`data/sources.md`):
   - **`dagyeolun` → 로컬 스크래퍼 자동 수집 (정식 경로).** 아래 "dagyeolun 자동 수집" 절 참조. 상세는 `naver-cafe-survey` 스킬.
   - `naver-cafe-all`/`naver-blog` → `naver-search.ps1` 호출 (`NAVER_CLIENT_ID/SECRET` 미설정이면 `data/naver-api.md` 안내 후 중단).
   - 그 외 커뮤니티·블로그 → `WebSearch` `site:` 힌트.
2. 권역/백화점/브랜드/품목 키워드를 조합해 매장 단서가 제목·요약에 걸리도록 여러 번 검색
3. 각 후기에서 출처 URL·**소스ID**·작성일·지역/매장 단서·언급 브랜드/품목 추출
4. 표준 양식으로 `artifacts/YYYYMMDD-01-raw-reviews.md` 작성 (머리말에 선택 소스·소스별 건수 기록)
5. 출처 URL 없는 정보는 기록하지 않음

## dagyeolun 자동 수집 (로컬 스크래퍼)

```
$py = "C:\Users\admin\AppData\Local\Programs\Python\Python312\python.exe"
# (본문 정밀 수집 원하면) 1회 로그인 — 사용자가 창에서 직접, 비번은 코드가 안 만짐
& $py scripts\naver_cafe_scraper.py login --seconds 240
# 권역·브랜드 키워드를 '||'로 묶어 수집 (로그인 안 하면 --no-read-body로 제목·요약만)
& $py scripts\naver_cafe_scraper.py scrape --query "롯데 부산본점 삼성 혼수 || 신세계 센텀 혼수 가전 || 롯데 센텀 혼수 가전 || 롯데 울산 혼수 가전 || 롯데 창원 혼수 가전 || 부산 삼성스토어 혼수 || 부산 LG 혼수 가전 || 김해 혼수 가전" --pages 2 --max-articles 30
```

산출: `artifacts/YYYYMMDD-cafe-raw.json`(글별: articleId·title·summary·addDate·url·stores·items·samsung·lg), `artifacts/YYYYMMDD-cafe-counts.md`(매장×삼성/LG 표).

**표준 양식으로 변환**: `cafe-raw.json`의 각 레코드를 `01-raw-reviews.md` 레코드로 옮긴다 — 소스ID `dagyeolun`, 출처는 `url`, 작성일 `addDate`, 매장단서 `stores`, 브랜드 `samsung/lg`, 품목 `items`, 원문 요약은 `title`(+ 있으면 `summary`/`body_excerpt`). 스크래퍼가 이미 1차 분류(brand/store)를 해두므로 Step 3·4는 **검증·보정** 위주로 진행한다. 본문 미수집(`body_ok:false`) 레코드는 "제목·요약 기준 추정"으로 표기.

상세 규칙은 `.claude/agents/review-collector.md` 참조.
