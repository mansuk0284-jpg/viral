---
name: collect-insta
description: "인스타그램 #혼수가전 해시태그 게시물에서 가전 후기 신호를 수집한다. 신제품·트렌드 위주, 협찬 광고 필터링이 핵심. insta-collector 에이전트가 사용."
---

# Collect Insta

`insta-collector` 에이전트의 수집 작업. 소스ID = `instagram`. 공식 API 없음(공개검색 보조).

## 접속 우선순위 (세션캡처 + analyzer — 공식 API 없음, 로그인월 강함)
- 인스타그램은 **공식 공개 API 없음 + 강한 로그인월**이라 게스트 정적 수집은 0~9건이었다(실측). 무단 자동수집은 ToS·계정경고 위험 → **본인 로그인 세션의 화면 캡처 범위 내에서만** 다룬다.
- 현실적 정본 경로 = **세션캡처 → analyzer**:
  1. `channel-access-engineer`가 `channel_session.py open --channel instagram --query "혼수가전" --dump`로 본인 로그인 상태의 해시태그 화면 링크·캡션을 `artifacts/session-open-instagram-*.json`으로 캡처.
  2. `python scripts/channel_analyze.py --source-id instagram --login-channel instagram`가 분류·매장매칭해 `01-raw-instagram.md` 생성.
- 캡처가 빈약하면(로그인월) `WebSearch` 폴백 + "표본 빈약(접근 제한)" 명시. **CAPTCHA·계정경고 의심 시 즉시 중단·보고**(우회 금지).

## 사용 도구
- **`scripts/channel_session.py open --channel instagram --dump`** → **`scripts/channel_analyze.py --source-id instagram --login-channel instagram`** (정본)
- `WebSearch`/`WebFetch`: 폴백(공개 캡션 스니펫).
- 상세 규칙: `.claude/agents/insta-collector.md`

## 절차 (정본)
```
python scripts/channel_session.py open --channel instagram --query "혼수가전" --dump
python scripts/channel_analyze.py --source-id instagram --login-channel instagram
```
1. 로그인월로 표본이 특히 빈약 → 무리한 정량화 금지, 트렌드·신제품 반응 신호 위주.
2. 위치태그/매장 언급 있으면 살리고, 없으면 `[매장미상]`.
3. **협찬·공구·판매글은 analyzer가 `[광고추정]` 태깅**(이 채널 최우선 필터). 진정성 편향 큼 명시.
4. 접근 제한·표본 부족을 산출물에 정직하게 고지.

## 표준 양식 (artifacts/YYYYMMDD-01-raw-instagram.md)
```
# 원본 후기 수집 — 인스타그램 [기간]
> 소스ID: instagram · 채널: SNS 해시태그(공개검색) · 수집 건수: N · 광고추정 제외 전 기준

## I-01
- 출처: [url]
- 소스ID: instagram
- 작성일: [YYYY-MM-DD 또는 (추정)]
- 지역·매장 단서: [위치태그 / 없으면 매장미상]
- 언급 브랜드: [삼성/LG/기타]
- 언급 품목: [냉장고/세탁기/...]
- 원문 요약: [캡션 1줄]
- 비고: [광고추정/협찬 등]
```
trend-analyst의 신제품 반응 분석에 기여. review-collector가 `01-raw-reviews.md`로 병합.
