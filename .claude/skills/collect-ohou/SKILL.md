---
name: collect-ohou
description: "오늘의집(ohou.se) 집들이·제품리뷰에서 혼수 가전 후기를 수집한다. 모델·색상 트렌드 신호 위주, 매장 단서는 약함. ohou-collector 에이전트가 사용."
---

# Collect Ohou

`ohou-collector` 에이전트의 수집 작업. 소스ID = `ohou`. 비공식 공개검색 기반.

## 접속 우선순위 (세션캡처 + analyzer — 공개 API 없음, ToS 준수)
- 오늘의집은 **공개 API가 없고 SPA(JS 렌더)**라 정적 스크래핑은 0건이었다(실측). 무단 내부 엔드포인트 스크래핑은 ToS 위반 위험 → 하지 않는다.
- 현실적 정본 경로 = **세션캡처 → analyzer**:
  1. `channel-access-engineer`가 `channel_session.py open --channel ohou --query "혼수 가전 후기" --dump`로 로그인 세션에서 진입·렌더된 화면의 링크·텍스트를 `artifacts/session-open-ohou-*.json`으로 캡처.
  2. `python scripts/channel_analyze.py --source-id ohou --login-channel ohou`가 그 덤프를 brand/item/tone 분류 + 매장매칭해 `01-raw-ohou.md` 생성.
- 캡처 표본이 빈약하면(SPA 한계) `WebSearch`/`WebFetch` 폴백 + "표본 빈약(공개검색 폴백)" 명시.

## 사용 도구
- **`scripts/channel_session.py open --channel ohou --dump`** → **`scripts/channel_analyze.py --source-id ohou --login-channel ohou`** (정본)
- `WebSearch`/`WebFetch`: 폴백(모델·색상·구매처 단서).
- 상세 규칙: `.claude/agents/ohou-collector.md`

## 절차 (정본)
```
python scripts/channel_session.py open --channel ohou --query "혼수 가전 후기" --dump
python scripts/channel_analyze.py --source-id ohou --login-channel ohou
```
1. 세션 미로그인/덤프 빈약이면 그 사실을 산출물에 명시(SPA로 정적 신호 적음).
2. 모델·색상(비스포크/오브제) 트렌드 신호 위주. 매장 단서 약하면 `[매장미상]`(버리지 않음).
3. 협찬·체험단·판매글은 analyzer가 `[광고추정]` 자동 태깅.
4. 표본 적으면 무리한 정량화 금지·부족 명시.

## 표준 양식 (artifacts/YYYYMMDD-01-raw-ohou.md)
```
# 원본 후기 수집 — 오늘의집 [기간]
> 소스ID: ohou · 채널: 인테리어 앱/웹(비공식 검색) · 수집 건수: N

## O-01
- 출처: [url]
- 소스ID: ohou
- 작성일: [YYYY-MM-DD 또는 (추정)]
- 지역·매장 단서: [있으면 / 없으면 매장미상]
- 언급 브랜드: [삼성/LG/기타]
- 언급 품목: [냉장고/세탁기/...] · 모델·색상: [비스포크/오브제 등]
- 원문 요약: [1~2줄]
- 비고: [광고추정 등]
```
trend-analyst의 모델·트렌드 분석에 기여. review-collector가 `01-raw-reviews.md`로 병합.
