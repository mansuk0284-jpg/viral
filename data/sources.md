# 모니터링 소스 카탈로그 (선택 가능)

모니터링할 사이트를 골라서 조사한다. **복수 선택 가능**.
세션 시작 시 사용자가 선택한 소스만 수집·집계하고, 결과를 **소스별로 분리**해 보여준다.

> **수집 채널이 소스마다 다르다 (중요):**
> - `dagyeolun`(다이렉트결혼준비) → **로컬 스크래퍼 `scripts/naver_cafe_scraper.py`** (검증 완료). 가장 정확. **정본 경로 = 「후기(가전)」 게시판(menuId 280) 정주행** `board --menu-id 280`(키워드 `scrape`는 보조). 자세한 건 `naver-cafe-survey` 스킬.
> - `naver-blog`, `busan-mom-cafe` → 네이버 검색 API 수집기 **`scripts/naver_api_collect.py`**(제목+요약 분류·12개점 매장매칭, `--read-body`로 본문 정독). 키 `NAVER_CLIENT_ID/SECRET`는 `data/naver-api.md` 참조(사용자가 직접 setx 등록).
> - `youtube` → **`scripts/youtube_collect.py`**(Data API v3, 영상+댓글). 키 `YOUTUBE_API_KEY` 필요(사용자가 직접 setx 등록).
> - `ohou`, `instagram` → 공개/공식 API 없음·SPA·로그인월 → **세션캡처(`channel_session.py open --dump`) → `channel_analyze.py`**. 표본 빈약 시 그 사실을 명시(ToS·계정경고 우회 금지).
> - 그 외 커뮤니티·블로그 → WebSearch의 `site:` 힌트 보조.

| ID | 소스명 | 유형 | 수집 채널 / 검색힌트 | 비고 |
|----|--------|------|----------|------|
| naver-cafe-all | 네이버 카페 (전체) | 카페 | API: `site:cafe.naver.com 혼수 가전 후기` | 카페 통합 |
| dagyeolun | 다이렉트결혼준비(다결) | 카페 | **로컬 스크래퍼**(naver_cafe_scraper.py, clubid 25228091) · 정본=「후기(가전)」 게시판 menuId 280 `board` | 대형 웨딩카페·자동수집·최정확 |
| gyeoljun | 결혼준비(결다모) | 카페 | 카페 스크래퍼(clubid 확인 후 `board`+`--read-body`) · 폴백 `결혼준비 결다모 혼수 가전 후기` | 대형 웨딩카페·후기 밀도 높음 · **추천 추가** |
| gn-wedding | 경남 결혼준비 | 지역카페 | 카페 스크래퍼(clubid 확인 후 `board`+권역필터) · 폴백 `경남 결혼준비 카페 혼수 가전 후기` | 부울경 지역 웨딩카페·권역 매칭 정확도↑ · **추천 추가** |
| weddingbook | 웨딩북 | 카페/앱 | 앱/세션캡처→`channel_analyze.py`(공개 API 없음) · 폴백 `웨딩북 혼수 가전 후기` | 웨딩 준비 앱·패키지/견적 후기 · **추천 추가** |
| momsholic | 맘스홀릭베이비 | 맘카페 | 네이버 카페 검색 API+로그인 세션→`naver_api_collect.py`(권역필터+`--read-body`) · 폴백 `맘스홀릭 혼수 가전 후기` | 국내 최대급 맘카페·후기 절대량 큼 · **추천 추가** |
| busan-mom-cafe | 부산·울산·경남 맘카페 | 지역카페 | `부산 맘카페 혼수 가전 삼성 LG 후기` | 권역 밀착 |
| danggn | 당근 동네생활 | 지역커뮤니티 | 동네생활 세션/WebSearch(공개 API 없음·로그인월·난도 높음) · 폴백 `당근 동네생활 혼수 가전` | 위치 기반 권역 지역성↑ · **추천 추가** |
| naver-blog | 네이버 블로그 | 블로그 | `site:blog.naver.com 혼수 가전 후기 삼성 LG` | 광고성 주의 |
| tistory | 티스토리 블로그 | 블로그 | `site:tistory.com 혼수 가전 후기` | |
| ohou | 오늘의집 | 인테리어 앱 | `site:ohou.se 혼수 가전 후기` · `오늘의집 비스포크 후기` | 집들이·제품리뷰, 모델·색상 트렌드 |
| instagram | 인스타그램 | SNS | `인스타그램 혼수 가전 후기 #혼수` | 해시태그 중심 |
| youtube | 유튜브 | 영상 | `유튜브 혼수 가전 후기 삼성 LG` | 댓글·영상 설명 |
| dcinside | 디시 결혼/신혼 갤 | 커뮤니티 | `디시인사이드 신혼 가전 후기` | |
| ppomppu | 뽐뿌 | 커뮤니티 | `뽐뿌 혼수 가전 후기 삼성 LG` | 가격·후기 활발 |
| clien | 클리앙 | 커뮤니티 | `클리앙 혼수 가전 후기` | IT/가전 성향 |

## 채널 전담 수집 에이전트 (히어로 6타일 대응)

각 채널은 전담 수집 에이전트 + 수집 스킬을 가진다. 오케스트레이터는 선택된 소스의 전담 에이전트를 호출하고, `review-collector`가 채널별 산출물(`01-raw-{소스ID}.md`)을 `01-raw-reviews.md`로 병합한다.

| 히어로 타일 | 소스ID | 전담 에이전트 | 수집 스킬 | 수집 방식 |
|---|---|---|---|---|
| 다이렉트결혼준비 | dagyeolun | dagyeolun-collector | collect-dagyeolun | 로컬 스크래퍼(정본·실데이터, board 280) |
| 네이버 블로그 | naver-blog | blog-collector | collect-blog | 네이버 검색 API → `naver_api_collect.py`(+`--read-body`) |
| 맘카페 | busan-mom-cafe | momcafe-collector | collect-momcafe | 네이버 카페 검색 API → `naver_api_collect.py`(권역필터+`--read-body`) |
| 유튜브 | youtube | youtube-collector | collect-youtube | YouTube Data API v3 → `youtube_collect.py`(영상+댓글) |
| 오늘의집 | ohou | ohou-collector | collect-ohou | 세션캡처→`channel_analyze.py`(공개 API 없음, SPA) |
| 인스타그램 | instagram | insta-collector | collect-insta | 세션캡처→`channel_analyze.py`(공식 API 없음, 로그인월) |

> 그 외 카탈로그 소스(tistory·dcinside·ppomppu·clien 등)는 전담 에이전트 없이 범용 `review-collector`가 WebSearch로 처리한다.

> **추천 추가 채널(대시보드 타일 노출, 2026-06-18):** `gyeoljun`·`gn-wedding`·`weddingbook`·`momsholic`·`danggn` 5종은 혼수 가전 후기 밀도가 높아 히어로 소스 타일로 함께 노출한다. 단 **아직 수집 전(표본 0건)** 상태로 타일/채널 화면에 "수집 대기"로 정직하게 표기하며, 위 수집 경로로 정주행해야 표본이 채워진다(수치 임의 생성 금지).

## 선택 규칙

- 사용자가 소스를 지정하지 않으면 **기본 세트**로 진행: `naver-cafe-all`, `naver-blog`, `busan-mom-cafe`.
- "전부", "다" → 전체 소스.
- 권역 밀착도가 필요하면 `busan-mom-cafe`를 포함하도록 권장.
- 선택한 소스 ID 목록을 산출물 머리말에 기록한다.
