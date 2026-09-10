# Viral to Insight — 개발 인수인계 문서

> 작성 2026-09-11 · 현재 배포 버전 `?v=2026r372`
> 혼수가전 온라인 바이럴(구매후기)을 7개 채널에서 수집해, 전국 백화점 입점
> **삼성스토어 vs LG전자** 현황을 전국→지역→매장 단위로 보여주는 대시보드입니다.

- **배포 주소**: https://mansuk0284-jpg.github.io/viral/ (GitHub Pages, 정적 사이트)
- **저장소**: https://github.com/mansuk0284-jpg/viral
- **문서의 위계**: 이 파일(입구) → [.claude/CLAUDE.md](.claude/CLAUDE.md)(원칙·실패담 전체) →
  [data/agent-roster.md](data/agent-roster.md)(역할 분담 SSOT). **셋 다 저장소에 있습니다.**

---

## 1. 5분 빠른 시작

```bash
git clone https://github.com/mansuk0284-jpg/viral.git
cd viral
python -m http.server 8765 --directory web
# 브라우저에서 http://localhost:8765 — 화면은 web/assets/*.js 에 데이터가
# 이미 빌드되어 있어 수집 없이 바로 전부 동작합니다.
```

개발 환경(수집·빌드까지 하려면):
- Windows + **Python 3.12** + `pip install playwright` + 로컬 **Chrome 설치**
  (수집기는 `channel="chrome"` 실브라우저를 씁니다 — Playwright 내장 크로뮴 아님)
- 검증 스크립트도 전부 Playwright headless Chrome 기준입니다.

---

## 2. 저장소 지도

| 경로 | 무엇 |
|---|---|
| `web/` | 화면 전부. `index.html`(메인) + 화면별 `*-view.js` + 공용 모듈(`nav.js`=VNAV, `period.js`=VPER 기간탭, `fact.js`=VFACT 기간집계, `text-fit.*`, `analysis-ui.css`=**활자·여백 최종 권위**) |
| `web/assets/` | 빌드 산출 데이터(`cafe-data.js`, `blog.js`, `naver-review.js` 등 — git에 포함, 화면의 데이터 원천) |
| `scripts/` | 수집기·빌더 전부(§3), 배치 드라이버(`refresh_all_202608.sh`, `auto_refresh.sh`) |
| `artifacts/` | 수집 원본(census 등). **git 비포함 — §6 별도 전달 필요** |
| `data/` | 명부(`백화점 리스트.xlsx`), `agent-roster.md`, `sources.md` |
| `.claude/` | Claude Code 하네스(원칙 문서 CLAUDE.md, 에이전트·스킬 정의) |

---

## 3. 데이터 파이프라인 (수집 → 병합 → 빌드 → 배포)

채널 7개 + 보조 통계. **모든 수집기는 헤디드 Chrome + 공유 프로필
`.browser-profile2` 를 쓰므로 반드시 순차 실행**(동시 실행 금지).

| 채널 | 수집 | 빌드 | 비고 |
|---|---|---|---|
| 다이렉트결혼준비(정본) | `naver_cafe_scraper.py board --menu-id 280 --cumulative --window-months 2 --read-body` | `build_web_data.py` | **수집 후 반드시 `merge_board_into_census.py`** — 이 다리가 없으면 화면에 안 나옴(§7-1) |
| census 키워드(보조) | `collect_history.py --start 2026-MM --end 2026-MM --out artifacts/cafe-census.json` | 〃 | board 선행 시 "+0"이 정상 |
| 네이버 블로그 | `collect_blog.py --scrolls 8 --out artifacts/20260825-channel-blog.json` | `build_blog_web.py` | 재훑기는 `.done`에서 `쿼리\|YYYYMM01` 제거 후 |
| 제이웨딩 | `collect_channels.py --channel jwedding --pages 25` | `build_jwedding_web.py` | |
| 유튜브 | `collect_youtube.py --pages 2` | `build_youtube_web.py` | 게시월은 "N개월 전" 환산 **추정** |
| 인스타그램 | `collect_instagram.py` → `enrich_instagram.py` | `build_instagram_web.py` | **로그인 세션 필요**(§8). 산출은 회차 스냅샷 — 직전 파일과 id **union 병합** 후 빌드 |
| 오늘의집 | `collect_ohou.py` → `enrich_ohou.py` | `build_ohou_web.py` | 매장 축 없음(설계) |
| 플레이스 리뷰 | `naver_place_collect.py --max-reviews 150` (전국 71곳) | `build_naver_review_web.py` | 매장당 최근 150행 캡(§7-3) |
| 혼인 통계(보조) | 수동 — `build_marriage_web.py`의 `OFFICIAL`에 발표치 추가 | 〃 | 출처 URL을 주석에 기록 |

**정기 갱신 한 벌** = `bash scripts/refresh_all_202608.sh`
(① board → ①-b census 병합 → ② census → ③ 블로그 → ④~⑦ 채널 → ⑧ 플레이스 → ⑨ 빌드 7종).
전체 2~3시간, 로그는 `artifacts/refresh-202608.log`. `PYTHONUNBUFFERED=1` 필수.

**주간 자동 실행** = Windows 작업 스케줄러 `ViralMonitor-WeeklyRefresh`
(매주 월 07:30, 로그온 세션 필요) → `scripts/viral_auto.cmd` → `auto_refresh.sh`
(수집→빌드→**스모크 검증 실패 시 배포 중단**→푸시→라이브 확인).
새 PC에서는 스케줄러를 다시 등록해야 합니다:
```
schtasks /Create /F /TN ViralMonitor-WeeklyRefresh /SC WEEKLY /D MON /ST 07:30 /TR "C:\<repo>\scripts\viral_auto.cmd"
```

---

## 4. 배포 방법 (수동)

1. `web/index.html`의 캐시버스터를 올린다: `2026r372` → `2026r373` (전체 치환)
2. `git commit` → `git push origin main`
3. **GitHub Pages가 푸시를 자주 놓친다** — 8초 뒤 빈 커밋을 한 번 더 푸시해 재트리거
4. `https://mansuk0284-jpg.github.io/viral/` 를 폴링해 새 버전 문자열 확인(30초 간격, 수 분)
5. 배포본에서 실제 화면·수치를 검증한 뒤에만 "배포 완료"라고 말한다

---

## 5. 반드시 지켜야 할 원칙 (위반 시 사용자 지적이 반복된 것들)

전체 목록·배경은 `.claude/CLAUDE.md`. 최상위만 요약:

| 원칙 | 요지 |
|---|---|
| **숫자를 지어내지 않는다** | 없는 데이터는 "없음/추정"으로 정직 표기. 표본 10건 미만이면 %를 적지 않는다. ±0에는 판정어 금지(삼지선다) |
| **후기의 주체는 고객** | 매니저는 "후기 작성을 **요청**"할 뿐. 액션 문구의 주체를 틀리지 않는다 |
| **경쟁력 자료(compete.json) 금액 절대 미노출** | 사내 실적. 화면엔 hover 배수만 |
| **비밀번호는 코드가 입력하지 않는다** | 로그인은 사용자가 직접(`insta_login.py` 등) |
| 긍정=파랑(#1f5fd0)·부정=빨강(#d23b54) | 부정 수치엔 `class="warn"` |
| 활자 계단 | 31/20/16.5/15.5/13.5 + 좌측 요약 14px. `analysis-ui.css` 한 곳에만 |
| 기간 UI = `VPER.bar()` 우측 배치 | 기간을 바꾸면 **모든 수치가 연동**돼야 함 — 눈으로 확인 |
| 모든 분석 페이지는 "실행 제안(본사/영업팀/매장)"으로 끝난다 | `.role-plan`, 실데이터 기반 문장 |
| 용어는 문어체 표준 | "갈라 세다→별도 집계" 등 치환표가 CLAUDE.md에 있음 |
| **되돌려 적기** | 배운 것·바꾼 것은 그 자리에서 CLAUDE.md/roster/스킬에 기록 — 코드와 문서가 갈라지면 하네스는 껍데기가 된다 |

---

## 6. 이메일로 못 보내는 것 — 별도 전달 필요 자산

`artifacts/`(약 260MB)는 git에 없습니다. **재수집 없이 이어가려면 아래를
드라이브/USB로 따로 전달**받으세요(없으면 화면은 돌지만 재빌드·증분수집이 막힘):

| 파일 | 크기 | 무엇 |
|---|---|---|
| `cafe-census.json` (+`.done`) | 88MB | 다결 전수 마스터(12.2만 건) — **가장 중요** |
| `cumulative-cafe-raw.json` | 5MB | board 정본 누적본 |
| `20260825-channel-blog.json` (+`.done`) | 27MB | 블로그 3.2만 건 + 재개 키 |
| `naver-place/*.json` | ~9MB | 플레이스 리뷰 131매장 |
| `2026*-channel-*.json` | ~4MB | 제이웨딩·유튜브·인스타·오늘의집 스냅샷 |
| `compete.json` · `affiliate-*.json` | 소량 | **사내 자료 — 취급 주의** |

**절대 전달하지 말 것: `.browser-profile2/`** — 전임자의 네이버·인스타 로그인
쿠키가 들어 있습니다. 새 개발자는 자기 계정으로 새 프로필을 만드세요:
프로필 폴더가 없으면 수집기가 새로 만들며, 인스타는 `python scripts/insta_login.py`
(창이 뜨면 직접 로그인), 네이버 카페 본문은 `naver_cafe_scraper.py login`.

---

## 7. 알려진 함정 Top 7 (전부 실제로 겪은 것 — 상세는 CLAUDE.md)

1. **board→census 다리**: board 수집분은 `merge_board_into_census.py`를 돌려야
   화면에 나온다. 빠뜨리면 최신 달이 영원히 안 보인다(9월분 586건이 잠겼던 사고).
2. **크롬 즉사 "기존 브라우저 세션에서 여는 중입니다"**: 다른 로그온 세션의
   유령 크롬이 프로필을 쥔 것. 프로필을 **다른 경로로 복제**하고 스크립트 경로를
   바꾸면 해결(크롬 인스턴스 탐지는 경로 문자열 기준).
3. **리뷰 150행 캡**: 매장당 최근 150행만 있어, 이른 기간은 `nrCovOk()` 게이트가
   누적 총계로 폴백한다. 근본 해소는 `--max-reviews` 확대 재수집.
4. **인스타 세션 만료 = 전 태그 0건의 2바이트 산출**: 그대로 빌드하면 화면이 0으로
   덮인다. 빈 산출은 격리(확장자 변경)하고 이전 정상본으로 빌드.
5. **기간 연동 누락 패턴**: 화면 코드가 `CD.*`(빌드 시점 고정값)를 직접 읽으면
   기간을 바꿔도 안 변한다. `hasF() ? A() : CD` 패턴 확인.
6. **CSS 여백 "컴팩트"의 역효과**: 기존 computed 값을 재지 않고 덮으면 오히려
   커질 수 있다(실측 사고). 줄일 땐 기존값부터 잰다.
7. **한국어 조사·소표본 문장**: `josa()`/`numRo()` 헬퍼 사용, 비교 템플릿은
   경계(단일 월·동률·표본 1)에서 무슨 문장이 나오는지 반드시 테스트.

---

## 8. 수동 개입이 필요한 정기 예외

| 언제 | 무엇 |
|---|---|
| 인스타 세션 만료 시(수 주 간격) | `insta_login.py`로 재로그인 → 재수집 → **union 병합** → 빌드 |
| 통계청 인구동향 새 발표(매월 말) | `build_marriage_web.py` `OFFICIAL`에 한 줄 추가(출처 URL 주석) → 재빌드 |
| 신규 매장 입점/폐점 | `naver_place_collect.py` `TARGETS` + 명부(`data/백화점 리스트.xlsx`→`compete.json`) 갱신 |
| 매주 월 07:30 자동 실행 후 | `artifacts/logs/auto-*.log` 확인(스모크 실패 시 배포가 중단돼 있음) |

---

## 9. 미완 과제 (다음 개발 후보)

1. **자동 갱신 첫 실주행 검증** — 스케줄러 등록만 된 상태(다음 실행 월요일).
   완주·스모크·배포까지 로그로 확인할 것.
2. **인스타 썸네일** — `fetch_ig_thumbs.py`가 개별 게시물 접근 차단으로 0건.
   화면은 텍스트 폴백으로 정상이나, 접근법 교체 필요(예: 검색 격자 이미지 캡처).
3. **리뷰 표본 캡 확대** — `--max-reviews 300+`로 전 매장 재수집하면 커버리지
   게이트 폴백 구간이 줄어든다(시간 2시간+).
4. **`body.view-cafe` 활자 하드코딩 정리** — cafe-analysis.css의 ~150개 규칙을
   `--an-*` 토큰으로 대체(지금은 analysis-ui.css가 !important로 덮는 이중 구조).
5. **맘카페 채널 재개 여부** — 표본 4건으로 보류 중. 재개하려면 표본 확보가 선결.
6. **접속자 카운터 서버형 전환**(선택) — 현재 keyless 공개 카운터(Abacus)라
   감사 지표는 아님.

---

## 10. 컨벤션

- 커밋 메시지: 한국어, `feat:/fix:/chore:/data:/docs:` 접두 + 본문에 "왜"를 남김.
- 화면 문자열은 문어체 보고서 톤, 코드 주석에는 실패담·근거 날짜를 남기는 문화.
- 검증은 Playwright 스크립트로 **실측**(수치 대조·좌표·pageerror) — "됐을 것"이라고
  적지 않고 잰 값을 적는다.
- 산출물은 `artifacts/YYYYMMDD-*`, 로그는 `artifacts/logs/`, 폐기물은 `artifacts/attic/`.

무엇이든 막히면 `.claude/CLAUDE.md`의 해당 절부터 찾아보세요 — 지금까지의
사고와 해법이 날짜와 함께 전부 기록돼 있습니다.
