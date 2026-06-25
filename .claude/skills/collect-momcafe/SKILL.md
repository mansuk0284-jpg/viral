---
name: collect-momcafe
description: "부산·울산·경남 지역 맘카페에서 권역 밀착 가전 후기를 수집한다. 지역/매장 단서가 상대적으로 강하나 비공개 글이 많아 표본 제한. momcafe-collector 에이전트가 사용."
---

# Collect Momcafe

`momcafe-collector` 에이전트의 수집 작업. 소스ID = `busan-mom-cafe`. 권역 밀착(공개검색 보조).

## 접속 우선순위 (로그인 세션 우선, 공개검색 폴백)
- 부울경 맘카페 다수는 네이버 카페 → `channel-access-engineer`의 **naver 로그인 세션**이 곧 진입 자격이다(다음 카페는 kakao 로그인). `channel_session.py open --channel naver --query "..." --dump`(또는 kakao) 산출물 `artifacts/session-open-naver-*.json`을 **1순위**로 소비해 등업·로그인 전용 글까지 노출 폭을 넓힌다.
- 로그인 세션이 없으면 **공개 WebSearch로 폴백**하고 산출물에 "공개검색 폴백"으로 표기한다. (비공개·등업 게시판은 여전히 제한될 수 있음을 명시.)

## 사용 도구
- **`scripts/naver_api_collect.py --source-id busan-mom-cafe` (1순위, 정본 경로)**: 카페글 검색 API(cafearticle)→제목+요약 분류 + 12개점 매장매칭 + 권역합계 자동. 부울경 권역 단서 명시 글을 잡아낸다.
- (본문 보강) `channel-access-engineer` 산출 `session-open-naver-*.json` / `session-open-kakao-*.json` 진입 링크 — 등업·로그인 전용 글 노출 확대.
- `WebSearch`/`WebFetch`: API·세션으로도 부족하면 폴백(공개 글 한정).
- 상세 규칙: `.claude/agents/momcafe-collector.md`

## 절차 (정본)
```
python scripts/naver_api_collect.py --source-id busan-mom-cafe
# 본문까지 정밀 분석:  --read-body
# 쿼리 커스텀:        --query "부산 맘카페 혼수 냉장고" --query "창원 맘카페 혼수 가전"
```
1. 키 미설정이면 수집기가 `data/naver-api.md` 안내 후 중단. 사용자에게 키 등록 요청.
2. 카페글 검색은 전국 카페 대상 → 수집기가 **부울경 권역 단서/매장 키워드로 필터**하고 권역 외는 제외.
3. 비공개·등업 게시판은 API로도 제한 → 세션 진입 링크로 보강하되, 표본 적으면 무리한 수치화 금지·부족 명시.
4. 판매·공구글은 수집기가 `[광고추정]` 자동 태깅.

## 표준 양식 (artifacts/YYYYMMDD-01-raw-busan-mom-cafe.md)
```
# 원본 후기 수집 — 부울경 맘카페 [기간]
> 소스ID: busan-mom-cafe · 채널: 지역 맘카페(공개검색) · 수집 건수: N (권역내 X / 권역외 Y)

## M-01
- 출처: [url]
- 소스ID: busan-mom-cafe
- 작성일: [YYYY-MM-DD 또는 (추정)]
- 지역·매장 단서: [부산/울산/경남 지역·매장]
- 언급 브랜드: [삼성/LG/기타]
- 언급 품목: [냉장고/세탁기/...]
- 원문 요약: [1~2줄]
- 비고: [광고추정/표본부족 등]
```
권역내 매장 매칭 신호에 기여. review-collector가 `01-raw-reviews.md`로 병합.
