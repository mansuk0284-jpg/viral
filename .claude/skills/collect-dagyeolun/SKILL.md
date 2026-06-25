---
name: collect-dagyeolun
description: "다이렉트결혼준비 카페에서 「후기(가전)」 게시판(menuId 280) 로컬 스크래퍼로 혼수 가전 후기를 수집한다. 6채널 중 정본·실데이터 경로. dagyeolun-collector 에이전트가 사용."
---

# Collect Dagyeolun

`dagyeolun-collector` 에이전트의 수집 작업. 소스ID = `dagyeolun`. **정본·실데이터.**

## 사용 도구
- `scripts/naver_cafe_scraper.py`: 로컬 자동 스크래퍼(검증 완료)
- `artifacts/cumulative-cafe-raw.json`: 누적 SSOT(articleId 중복제거)
- 상세 규칙: `.claude/agents/dagyeolun-collector.md`, `naver-cafe-survey` 스킬

## 절차
```
$py = "C:\Users\admin\AppData\Local\Programs\Python\Python312\python.exe"
# (본문 정밀 시) 1회 로그인 — 사용자가 창에서 직접, 비번 코드 미입력
& $py scripts\naver_cafe_scraper.py login --seconds 240
# 정본: 「후기(가전)」 게시판 정주행 (평상시 증분)
& $py scripts\naver_cafe_scraper.py board --menu-id 280 --cumulative --window-months 3 --read-body
```
- 정본 = `board --menu-id 280`. 키워드 `scrape`는 특정 매장 비교 보조.
- 최초/기준표 변경 시 윈도우 없이 전체 백필. 평상시 `--window-months 3`.
- 산출 `cafe-raw.json`(articleId·title·summary·addDate·url·stores·items·samsung·lg) → 표준 변환.

## 표준 양식 (artifacts/YYYYMMDD-01-raw-dagyeolun.md)
```
# 원본 후기 수집 — 다이렉트결혼준비 [기간]
> 소스ID: dagyeolun · 채널: 네이버 카페(게시판 280) · 수집 건수: N (권역내 X / 권역외 Y)

## D-01
- 출처: [url]
- 소스ID: dagyeolun
- 작성일: [addDate 또는 (추정)]
- 지역·매장 단서: [stores]
- 언급 브랜드: [samsung/lg]
- 언급 품목: [items]
- 원문 요약: [title (+summary/body_excerpt)]
- 비고: [body_ok:false → "제목·요약 기준 추정" / 광고추정 / 권역외]
```
스크래퍼가 brand/store 1차 분류 완료 → 이후 단계는 검증·보정 위주.
review-collector가 6채널 산출물을 `01-raw-reviews.md`로 병합.
