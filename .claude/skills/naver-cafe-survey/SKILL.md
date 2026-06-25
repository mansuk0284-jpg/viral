---
name: naver-cafe-survey
description: "네이버 다이렉트결혼준비(다이렉트웨딩) 카페에 접속해 가전제품 구매후기 본문을 읽고, 삼성/LG·매장별 바이럴 건수를 조사한다. review-collector가 네이버 카페 본문 기반 정확 수집이 필요할 때 사용한다."
---

# Naver Cafe Survey — 다이렉트결혼준비 카페 가전 후기 건수 조사

네이버 **다이렉트결혼준비** 카페(통칭 다이렉트웨딩)의 가전 구매후기를 **본문까지 읽어** 삼성/LG·매장별 바이럴 건수를 집계한다. WebSearch·네이버 검색 API가 못 주는 본문 단서를 확보해 매장 매칭 정확도를 높이는 채널.

- 대상 카페: 다이렉트결혼준비 (cafe.naver.com — 정확한 카페 주소는 접속 시 확인)
- 소스ID: `dagyeolun`
- 사용 도구: Claude in Chrome (`select_browser`, `tabs_context_mcp`, `get_page_text`, `find`, `computer`)

## 전제 — 로그인은 사용자가 직접

- **비밀번호 입력 금지.** 네이버 로그인은 사용자가 브라우저에서 직접 완료한다 (보안 원칙).
- 카페 글 다수는 회원/로그인 상태라야 본문이 보인다. 로그인 안 돼 있으면 진행 전에 사용자에게 요청한다.
- 자동 수집은 네이버 운영정책에 저촉될 수 있으므로 **본인 모니터링 목적의 소량·수동 페이스**로만 진행한다.

## 환경 제약 대응 (중요)

⚠ **실측 결과(2026-06-10): 이 환경의 Claude in Chrome은 네이버 도메인을 전면 차단한다.**
`navigate` → "not allowed", `get_page_text`/읽기 → "This site is blocked". 즉 **브라우저 자동화로
네이버 카페를 직접 센싱하는 것은 이 환경에서 불가능**하다. (다른 환경/정책에서는 아래 1번이 동작할 수 있음.)

차단 환경에서의 동작 순서:

0. **로컬 Playwright 스크래퍼 (정식·자동 경로, 2026-06-10 검증 완료)**:
   `scripts/naver_cafe_scraper.py`. 사장님 PC의 로컬 Chrome을 직접 구동하므로
   샌드박스 MCP의 네이버 차단과 무관하게 동작한다. **검색 API로 글 목록을 자동 수집**해
   삼성/LG·매장 건수를 집계한다. 붙여넣기 불필요. 사용법은 아래 "자동 수집" 절 참조.
1. **사용자 주도 탭 읽기** (네이버 미차단 환경에서만): 사용자가 직접 연 카페 탭을
   `get_page_text`로 읽어 집계. — *MCP 환경에서는 차단.*
2. **본문 붙여넣기 (폴백)**: 사용자가 카페 검색결과 목록/글 본문을
   채팅에 붙여넣으면 Claude가 매장·브랜드·품목·건수로 분해해 집계한다.

어느 경로든 **분류·집계 로직은 동일**하다. 기본은 0번(자동 수집)이다.

## 자동 수집 (로컬 스크래퍼) — 검증된 핵심 경로

다이렉트결혼준비는 **신(SPA) 카페**다. 클래식 `ArticleSearchList.nhn`은 빈 껍데기(html 72바이트)라
못 쓴다. 대신 카페 자체 검색 JSON API를 쓴다:

- 검색 API: `https://apis.cafe.naver.com/search/v2/cafes/25228091/search/articles?query=...&perPage=15&page=N&menuId=0&views=MEMBER_LEVEL,COUNT,SALE_INFO,CAFE_MENU`
- **필수 헤더 `X-Cafe-Product: pc`** (없으면 400). 페이지 컨텍스트 `fetch(credentials:'include')`로 호출해 쿠키·오리진을 그대로 싣는다.
- 응답 `result.articleList[].item` = `articleId / subject / summary / addDate / menuName`.
- **글 목록·제목·요약은 로그인 없이도** 수집된다. 제목에 매장명이 자주 박혀 있어(예: "롯데백화점 영등포 삼성스토어") 제목만으로도 상당한 매장 매칭이 된다.
- **본문(article API)은 회원등급 게시판이라 로그인 필요.** 로그인 안 되면 제목+요약만으로 집계(정확도 약간 하락, 매장 미상 비율↑). 본문까지 필요하면 먼저 `login` 실행.

실행:
```
$py = "C:\Users\admin\AppData\Local\Programs\Python\Python312\python.exe"
# (본문까지) 1회 로그인 — 사용자가 창에서 직접 로그인, 비번은 코드가 안 만짐
& $py scripts\naver_cafe_scraper.py login --seconds 240
# 수집·집계 ('||'로 여러 키워드, --no-read-body면 제목·요약만)
& $py scripts\naver_cafe_scraper.py scrape --query "롯데 부산본점 삼성 혼수 || 신세계 센텀 혼수 가전 || 부산 LG 혼수 가전" --pages 2 --max-articles 30
```
산출: `artifacts/YYYYMMDD-cafe-raw.json`(글별 레코드), `artifacts/YYYYMMDD-cafe-counts.md`(매장×삼성/LG 표).
articleId 기준 전 쿼리 통합 중복제거됨. 권역(부산·울산·경남) 매장만 STORE_PATTERNS로 매칭, 그 외는 "매장 미상".

## 정본 경로 — 「후기(가전)」 게시판 정주행 (menuId 280, 2026-06-12 사용자 지시)

키워드 검색(`scrape`)은 검색어 선정에 따라 누락·편향이 생긴다. **정확한 정본 경로는 카페의
「후기」 게시판 그룹 안 「후기(가전)」 게시판(menuId 280) 글을 전부 정주행하는 것**이다.

```
$py = "C:\Users\admin\AppData\Local\Programs\Python\Python312\python.exe"
# 게시판 메뉴 구조 확인(필요 시): 280=후기(가전), 328=후기(신혼혼수), 460=신혼집 프로모션(가전,가구)
& $py scripts\naver_cafe_scraper.py menus
# 전체 백필(최초 1회): 게시판 전 기간 본문까지 수집·누적
& $py scripts\naver_cafe_scraper.py board --menu-id 280 --cumulative --read-body
# 증분 갱신(평상시): 당월+직전 2개월만
& $py scripts\naver_cafe_scraper.py board --menu-id 280 --cumulative --window-months 3 --read-body
```

- 게시판 목록 API(`cafe-boardlist-api`)는 글마다 `subject`(제목)·`writeDateTimestamp`(작성일 epoch-ms)를 주지만 **`summary`는 비어 있다**. 그래서 **매장·브랜드 정확도엔 `--read-body`(본문 열람)가 필수** — 제목만으론 매장이 거의 안 잡힌다(`--no-read-body`는 규모·날짜 파악용 빠른 정찰에만).
- 「후기(가전)」은 **전국 게시판이고 고볼륨**이다(실측: 2026-04~06 두 달에 5천 건 이상). 권역 12개점에 해당하는 글은 소수이므로, **전량 수집·본문 분류 후 권역 해당분만 비교표로 부각**하고 나머지는 매장 미상/권역외로 둔다(버리지 않음).
- TIME 정렬이라 `--window-months`는 윈도우 경계(과거 글)에 닿으면 페이징을 조기 종료해 비용을 줄인다.

## 절차

1. **브라우저 연결**: `list_connected_browsers` → `select_browser` → `tabs_context_mcp`로 탭 확보.
2. **로그인 확인**: 카페 글 본문이 보이는지 확인. 안 보이면 사용자에게 로그인 요청.
3. **검색**: 다이렉트결혼준비 카페 내 검색에서 키워드 조합으로 글 목록을 띄운다.
   - 매장 단서가 본문에 걸리도록: `롯데 부산본점 삼성`, `신세계 센텀 LG`, `울산 롯데 혼수 가전`, `창원 롯데 비스포크/오브제` 등
   - 품목 키워드: 냉장고·세탁기·건조기·TV·에어컨·스타일러
4. **본문 읽기**: 각 글을 열어 `get_page_text`로 본문 추출.
   - 작성일, 매장 단서(백화점·지점·스토어), 언급 브랜드(삼성/LG), 품목, 톤(긍/부/중) 기록.
   - 한 글에 여러 품목·브랜드가 있으면 품목 단위로 분리.
5. **건수 집계**: 매장 × 브랜드 건수로 누적. 매장 단서 없으면 "매장 미상(권역)".
6. **권역 필터**: 부산·울산·경남만 본집계. 그 외는 트렌드 참고로만.
7. **표본 페이스**: 한 번에 과다 수집하지 않는다. 진행 상황을 사용자에게 알리며 단계적으로.

## 산출물

수집분은 `review-collector`의 표준 양식(`artifacts/YYYYMMDD-01-raw-reviews.md`)에 소스ID `dagyeolun`으로 append한다. 각 레코드:

```
## R-xx
- 출처: [카페 글 URL]
- 소스ID: dagyeolun
- 작성일: [YYYY-MM-DD 또는 (추정)]
- 지역·매장 단서: [본문에서 확인한 백화점/지점/스토어]
- 언급 브랜드: [삼성/LG]
- 언급 품목: [냉장고/...]
- 톤: [긍정/부정/중립]
- 원문 요약: [1~2줄, 본문 근거]
```

이어서 `brand-classify` → `store-match` → `report-build`로 흐름이 연결된다.

## 에러 핸들링

| 상황 | 대응 |
|------|------|
| navigate 네이버 차단 | 사용자 주도 탭 읽기 또는 붙여넣기 폴백으로 전환 |
| 로그인 안 됨 | 사용자에게 로그인 요청 후 대기 (비번 직접 입력 금지) |
| 본문 비공개/등급 제한 | 해당 글 스킵, "접근불가"로 로그만 남김 |
| 글 수 과다 | 키워드·기간으로 좁혀 표본 페이스 유지 |
