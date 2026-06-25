---
name: collect-blog
description: "네이버 블로그에서 네이버 검색 API로 장문 가전 구매후기를 수집한다. 매장·가격 단서 포착에 유리, 체험단 광고 필터링 중요. blog-collector 에이전트가 사용."
---

# Collect Blog

`blog-collector` 에이전트의 수집 작업. 소스ID = `naver-blog`. 네이버 검색 API 1순위.

## 접속 우선순위 (API 1순위, 로그인 세션은 본문 보강용)
- 네이버 블로그는 **검색 API(`naver-search.ps1`)가 1순위**라 로그인 없이도 표본이 양호하다.
- 다만 일부 글은 본문 진입에 로그인이 필요하므로, `channel-access-engineer`의 **naver 로그인 세션**이 있으면 `WebFetch` 대신/병행해 본문 보강에 활용한다(`artifacts/session-open-naver-*.json` 참고). 세션이 없으면 공개 스니펫·`WebFetch` 폴백.

## 사용 도구
- **`scripts/naver_api_collect.py` (1순위, 정본 경로)**: 검색 API 호출→제목+요약 기반 brand/item/tone/ad 분류 + 12개점 매장매칭 + 권역합계까지 한 번에. 다이렉트결혼준비 게시판 분류에 준하는 표준 산출물을 자동 생성.
- `scripts/naver-search.ps1` (`-Type blog`): 위 수집기가 내부 호출하는 저수준 검색 API. 단건 점검용으로만 직접 호출.
- `data/naver-api.md`: 키 설정 가이드(`NAVER_CLIENT_ID/SECRET`) — **키는 사용자가 직접 setx로 등록**(코드가 키 미입력).
- `WebFetch`: 스니펫에서 매장 단서 약하면 본문 확인(보조).
- 상세 규칙: `.claude/agents/blog-collector.md`

## 절차 (정본)
```
python scripts/naver_api_collect.py --source-id naver-blog
# 본문까지 정밀 분석:  --read-body  (naver 로그인 세션 권장)
# 쿼리 커스텀:        --query "신세계 센텀 LG 세탁기 혼수" --query "울산 롯데 비스포크 혼수"
```
1. 키 미설정이면 수집기가 `data/naver-api.md` 안내 후 중단(WebSearch는 네이버 미색인). 사용자에게 키 등록 요청.
2. 기본 쿼리 세트(권역 12개점+혼수 가전)로 자동 다회 호출·중복제거. 필요 시 `--query`로 추가.
3. 산출물 `artifacts/YYYYMMDD-01-raw-naver-blog.md` = 브랜드·품목·톤 집계 + 매장매칭표 + 레코드(요약 포함).
4. 체험단·협찬·판매글은 수집기가 `[광고추정]` 자동 태깅. 권역 외는 집계 제외(단서 명확 시).

## 표준 양식 (artifacts/YYYYMMDD-01-raw-naver-blog.md)
```
# 원본 후기 수집 — 네이버 블로그 [기간]
> 소스ID: naver-blog · 채널: 블로그(네이버 검색 API) · 수집 건수: N (권역내 X / 권역외 Y)

## B-01
- 출처: [url]
- 소스ID: naver-blog
- 작성일: [YYYY-MM-DD 또는 (추정)]
- 지역·매장 단서: [본문 매장·구매처·가격]
- 언급 브랜드: [삼성/LG/기타]
- 언급 품목: [냉장고/세탁기/...]
- 원문 요약: [1~2줄]
- 비고: [광고추정/권역외 등]
```
매장 매칭 보조에 가장 유용. review-collector가 `01-raw-reviews.md`로 병합.
