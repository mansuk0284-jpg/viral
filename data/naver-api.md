# 네이버 검색 Open API 연동 가이드

viral-monitor 하네스가 네이버 카페·블로그 후기를 수집할 때 사용하는 공식 경로.
WebSearch로는 네이버 색인이 안 되므로([[project-websearch-limit]]) 이 API를 1순위 수집 채널로 쓴다.

## 1. Client ID / Secret 발급 (무료)

심사 없이 즉시 발급된다. 화면에 보이는 순서 그대로:

1. https://developers.naver.com → 오른쪽 위 **로그인** (평소 쓰는 네이버 계정, 별도 가입 없음)
2. 상단 **Application → 애플리케이션 등록** (바로가기: https://developers.naver.com/apps/#/register)
3. 폼 3칸:
   - **애플리케이션 이름**: `viral-monitor` (아무 이름이나 가능)
   - **사용 API**: 드롭다운에서 **검색** 선택. 다른 API는 고르지 않는다.
   - **비로그인 오픈 API 서비스 환경**: `환경 추가` → **WEB 설정** →
     웹 서비스 URL `http://localhost` (실제 사이트 없어도 형식만 맞으면 통과)
4. 맨 아래 **등록하기**
5. **내 애플리케이션 → 개요**에 Client ID가 바로 보이고,
   **Client Secret은 옆 `보기` 버튼을 눌러야** 나타난다.

한도: 검색 API는 비로그인 오픈 API — **일 25,000회** 무료.
(현재 수집 설정은 25개 검색어 x 2채널이라 한도에 한참 못 미친다.)

### 자주 막히는 곳

| 증상 | 원인 |
|---|---|
| `등록하기`가 안 눌림 | 3번의 서비스 환경 미입력. `WEB 설정` + `http://localhost` |
| Client Secret이 안 보임 | 옆의 `보기` 버튼을 눌러야 표시됨 |
| setx 했는데 인식 안 됨 | setx는 **새 터미널**부터 적용됨 |

## 2. 키 등록 (환경변수)

키는 코드·산출물에 절대 적지 않고 환경변수로만 보관한다.

```powershell
# 현재 세션에만 적용
$env:NAVER_CLIENT_ID = "발급받은_ID"
$env:NAVER_CLIENT_SECRET = "발급받은_SECRET"

# 영구 적용 (사용자 환경변수)
setx NAVER_CLIENT_ID "발급받은_ID"
setx NAVER_CLIENT_SECRET "발급받은_SECRET"
```

> setx 적용 후에는 새 터미널/세션에서 반영된다.

## 3. 사용법

이 시스템은 스크립트 실행 정책이 제한되어 있으므로 `-ExecutionPolicy Bypass -File`로 호출한다.

```powershell
# 카페글 검색 (기본)
powershell -ExecutionPolicy Bypass -File ./scripts/naver-search.ps1 -Query "롯데 부산본점 삼성스토어 혼수 냉장고" -Type cafearticle -Display 50

# 블로그 검색
powershell -ExecutionPolicy Bypass -File ./scripts/naver-search.ps1 -Query "신세계 센텀 삼성 LG 혼수 후기" -Type blog -Display 50 -Sort date
```

반환: `total`, `returned`, `items[]`(title, description, link, cafename/bloggername, postdate) JSON.

## 4. 알아둘 한계 (정직한 고지)

- **카페글 검색**: 제목+요약 일부만 반환. 본문 전체는 안 줌. `cafename`은 카페명만 제공(매장명 아님).
- **매장 매칭**: 제목·요약에 "롯데 부산본점", "센텀" 등 매장 단서가 있어야 매칭 가능. 없으면 "매장 미상"으로 집계.
- **블로그**: 요약이 더 풍부해 매장 단서 포착에 유리하나 광고성 글 비중이 높음 → 분류 단계에서 `제외후보` 처리.
- 본문 정밀 확인이 필요하면 `link`를 WebFetch로 추가 조회 (단, 일부 카페글은 로그인 벽으로 실패 가능).

## 5. 수집 흐름 내 위치

블로그·맘카페 채널은 저수준 `naver-search.ps1`을 직접 부르지 않고 **`scripts/naver_api_collect.py`**를 쓴다.
이 수집기가 검색 API를 다회 호출 → 제목+요약 기반 brand/item/tone/ad 분류 + 전국 백화점 매장매칭 → 권역 합계 →
`artifacts/YYYYMMDD-01-raw-<소스ID>.md`(다이렉트결혼준비 양식)까지 한 번에 만든다.

```powershell
python scripts/naver_api_collect.py --source-id naver-blog        # 블로그
python scripts/naver_api_collect.py --source-id busan-mom-cafe    # 맘카페(카페글)
python scripts/naver_api_collect.py --source-id naver-blog --read-body   # 본문 정독(정밀↑)
```

## 6. YouTube Data API 키 (유튜브 채널용)

유튜브 채널(`youtube_collect.py`)은 별도 키가 필요하다.

1. https://console.cloud.google.com → 프로젝트 생성 → **YouTube Data API v3** 사용 설정
2. **사용자 인증 정보 → API 키 만들기** → 발급된 키 복사
3. 환경변수 등록(키는 코드·산출물에 미기재, 사용자가 직접):
   ```powershell
   setx YOUTUBE_API_KEY "발급받은_키"
   ```
4. 새 터미널에서 `python scripts/youtube_collect.py` 실행.
5. 일 쿼터 기본 10,000 units (search.list=100·commentThreads.list=1) → 쿼리·`--max-videos` 과확대 금지.

> ⚠ `ohou`·`instagram`은 공개/공식 API가 없다. 세션캡처(`channel_session.py open --dump`) →
> `channel_analyze.py` 경로를 쓰고, 표본이 빈약하면 그 사실을 산출물에 정직하게 명시한다.
> CAPTCHA·계정경고 우회는 절대 하지 않는다.
