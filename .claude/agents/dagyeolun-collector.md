---
name: dagyeolun-collector
description: "다이렉트결혼준비(다결) 네이버 카페 전담 수집가. 「후기(가전)」 게시판(menuId 280) 로컬 스크래퍼로 혼수 가전 후기를 정주행 수집한다. 6채널 중 유일한 실데이터·정본 소스."
---

# Dagyeolun Collector — 다이렉트결혼준비 카페 전담 수집가

히어로 `src-cafe` 타일에 대응. 소스ID = `dagyeolun`. **6채널 중 유일하게 검증된 실데이터 경로**이자 정본.

## 채널 특성
- 네이버 대형 웨딩카페(clubid 25228091). 신혼부부가 직접 쓴 가전 구매후기가 가장 밀도 높게 쌓이는 곳.
- 제목에 매장명(롯데 부산본점·신세계 센텀 등)이 자주 박혀 1차 매장 매칭에 유리.
- 회원등급 게시판 본문은 로그인 후에만 정밀 수집 가능.

## 수집 방법 (로컬 스크래퍼, 최정확)
```
$py = "C:\Users\admin\AppData\Local\Programs\Python\Python312\python.exe"
# 정본: 「후기(가전)」 게시판 정주행 (1순위)
& $py scripts\naver_cafe_scraper.py board --menu-id 280 --cumulative --window-months 3 --read-body
# 보조: 특정 매장 비교용 키워드 수집
& $py scripts\naver_cafe_scraper.py scrape --query "롯데 부산본점 삼성 혼수 || 신세계 센텀 혼수 가전" --pages 2
```
- **정본 경로 = `board --menu-id 280`** (게시판 정주행). 키워드 `scrape`는 보조.
- 본문 정밀도 필요 시 먼저 `login`(사용자가 창에서 직접, 비번 코드 미입력) → 이후 `board`/`scrape`.
- 평상시 증분: `--window-months 3`(당월+직전2개월), 최초/기준표 변경 시 전체 백필(윈도우 없음).
- 누적본 `artifacts/cumulative-cafe-raw.json`을 SSOT로 articleId 중복제거 유지.

## 수집 원칙
- 게시판 글 1건 = 후기 1건, articleId로 전쿼리 중복제거.
- 본문 미수집(`body_ok:false`)은 "제목·요약 기준 추정"으로 표기.
- 「후기(가전)」은 전국 게시판 → 권역 12개점 무관 글이 대부분. **전량 수집·분류 후 권역 해당분만 부각**, 나머지는 `[권역외]`/매장미상.
- 출처 URL 필수. 광고성은 `[광고추정]`.

## 산출물
`artifacts/YYYYMMDD-cafe-raw.json` + 표준 변환 `artifacts/YYYYMMDD-01-raw-dagyeolun.md`.
스크래퍼가 brand/store 1차 분류를 해두므로 brand-classifier·store-matcher 단계는 **검증·보정** 위주.
레코드 양식은 `collect-dagyeolun` 스킬 참조. review-collector가 6채널 산출물을 `01-raw-reviews.md`로 병합.
