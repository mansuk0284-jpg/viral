---
name: geo-status-map
description: 지도(광역시/도 단위)에 지역별 현황을 색·라벨로 표시하는 재사용 스킬. 라이선스가 깨끗한 시도 경계 GeoJSON을 받아 경량 SVG로 변환하고, 지역별 데이터(삼성 vs LG 건수·비중 등)를 색(코로플레스)과 라벨로 지도 위에 직접 바인딩한다. 전국/권역 현황을 지도로 보여줘야 할 때 사용.
---

# Geo Status Map — 지도에 현황 표시

광역시/도(17개) **경계만** 있는 지도 위에 지역별 현황을 표시한다. 구·군 등 하위 행정구역은 다루지 않는다.
스키매틱 박스가 아니라 **실제 시도 경계 위에** 색(삼성/LG 우위)과 라벨(건수·비중)을 올린다.

## 언제 쓰나
- "전국 지도로 지역별 현황 보여줘", "광역시/도별 삼성 vs LG", "지도에 건수 표시" 류 요청.
- 분석 결과(지역 집계)를 **지도 코로플레스**로 직관화할 때.

## 데이터 계약 (입력)
지역명(짧은 이름)을 키로 하는 객체. 짧은 이름은 변환 스크립트의 `SHORT` 표를 따른다(서울·부산·…·경남·제주).
```json
{
  "부산": { "s": 221, "l": 102 },
  "울산": { "s": 33,  "l": 15  },
  "경남": { "s": 33,  "l": 16  }
}
```
- `s`=삼성 건수, `l`=LG 건수. 없는 지역은 **키를 빼서** "미집계"로 둔다(0으로 채워 우위 착시 만들지 말 것).
- 합계/비중은 렌더 단계에서 계산: `total=s+l`, `삼성%`=`pct(s,l)`.

## 지도 소스 (라이선스 깨끗한 것만)

| 소스 | 경로 | 라이선스 | 비고 |
|---|---|---|---|
| **KOSTAT(권장)** | `southkorea/southkorea-maps` → `kostat/2018/json/skorea-provinces-2018-geo.json` | **Free to share or remix**(상업 OK) | 통계청 기반. `properties.name`=한글 시도명, `code`=시도코드 |
| simplemaps | simplemaps.com/gis/country/kr | 무료(출처표기) | 대안 |
| GADM | 같은 레포 `gadm/...` | **비상업·재배포 금지** | ⚠ 우리 용도 부적합 — 쓰지 말 것 |

> ⚠ 반드시 **KOSTAT 폴더**를 쓴다. GADM 폴더는 라이선스 위반 소지. 새 소스를 쓸 땐 LICENSE 먼저 확인.

### 받기 (1회)
```
# web/assets 에 원본 geojson 저장 (예: KOSTAT 2018 시도)
curl -L -o scripts/_src-sido.json \
  https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-provinces-2018-geo.json
```
(네트워크가 막히면 사용자에게 위 URL을 받아 저장해 달라고 안내. 코드가 임의 우회 다운로드하지 않는다.)

## 변환 (GeoJSON → SVG + 라벨)
```
python scripts/geojson_to_svg.py scripts/_src-sido.json \
  --out web/assets/korea-sido.svg \
  --labels web/assets/korea-sido-labels.json \
  --width 236 --max-pts 80
```
- 산출: `korea-sido.svg`(각 시도 `<path data-region="짧은이름" data-code="코드">`) + `korea-sido-labels.json`(`{지역:{x,y}}` 라벨 좌표).
- `--max-pts`로 점 수를 줄여 경량화(대시보드 인라인용). 정밀 GIS가 아니라 표시용.
- 등장방형(위도보정) 투영 — 한반도가 자연스럽게 보이는 근사.

## 렌더 규칙 (대시보드 바인딩)
1. SVG를 인라인 주입(`fetch('assets/korea-sido.svg')` → `innerHTML`).
2. 각 `path[data-region]`에 데이터 매칭:
   - 데이터 있음 + 삼성 우위 → **파랑**(`#3f7fe0`), LG 우위 → **빨강**(`#e2607a`), 동률 → 회색.
   - 데이터 없음 → **옅은 회색 #e9edf3 + "미집계"**(클릭 불가).
3. 라벨(현황)을 `labels.json` 좌표에 `<text>`로 올림: `지역명 / N건 / 삼성 NN%`.
4. 데이터 있는 지역은 **클릭 → 매장별 드릴**(`data-region`을 기존 핸들러가 처리).
5. 범례: 삼성 우위 / LG 우위 / 미집계. 외곽 박스·배경 없이 지도만.

## 정직성 (필수)
- 지도 수치의 **기준 기간·범위**를 반드시 캡션에 명시(예: "부울경 매장 매칭 2026 누적").
- 매칭 표본이 없는 시도는 **미집계 회색** — 0이나 추정치로 칠하지 않는다.
- 전수 아님 → "표본 기준 추정치" 문구 유지.

## 통합 지점
- 현재 대시보드: `web/cafe-analysis.js`의 `geoMap()`(전국 현황). 지금은 좌표를 손으로 넣은 스키매틱.
  이 스킬로 만든 `korea-sido.svg`+`labels.json`을 불러오도록 교체하면 **실제 경계 지도**가 된다.
- 짧은 이름 키가 하네스 표준(`부산/울산/경남` 등)과 일치하므로 집계 데이터와 바로 바인딩된다.

## 확장
- 권역 강조(부울경만): 해당 path만 채도 ↑, 나머지 흐리게.
- 시계열: 기간 네비와 연동해 같은 SVG에 기간별 데이터만 갈아끼움(지도는 1회 로드).
- 다른 분류축(채널·품목)도 동일 계약으로 재사용 — `s/l`을 임의 2분류로 일반화 가능.
