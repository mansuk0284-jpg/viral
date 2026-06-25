---
name: channel-access
description: "채널 접속·로그인 문제를 해결한다. 사용자 직접 로그인 세션을 공유 프로필에 저장·점검하고 로그인 후 검색 진입을 연다. 인스타·유튜브·오늘의집·맘카페 등 공개검색 표본이 빈약할 때 channel-access-engineer가 사용."
---

# Channel Access

`channel-access-engineer` 에이전트의 채널 로그인·진입 작업.

## 보안 철칙
- **비밀번호는 코드가 입력·저장하지 않는다.** 사용자가 크롬 창에서 직접 로그인.
- 세션은 로컬 `.browser-profile` 에만 저장. 완만한 속도·개인용. 약관·레이트리밋 존중.
- CAPTCHA·2단계는 사용자가 직접. 우회 금지. 계정경고 의심 시 즉시 중단·보고.

## 도구
- `scripts/channel_session.py` (Playwright, 로컬 Chrome, `.browser-profile` 공유)

## 절차
```
$py = "C:\Users\admin\AppData\Local\Programs\Python\Python312\python.exe"
# 1) 현재 로그인 상태 점검
& $py scripts\channel_session.py status
# 2) 게스트 채널 로그인 (창에서 사용자 직접 로그인, 비번 코드 미입력)
& $py scripts\channel_session.py login --channel ohou --seconds 200
& $py scripts\channel_session.py login --channel all          # 전 채널 순차
# 3) 재점검
& $py scripts\channel_session.py status
# 4) 로그인 세션으로 검색 진입 + 덤프
& $py scripts\channel_session.py open --channel ohou --query "혼수 비스포크 후기" --dump
```

## 채널 ↔ 로그인 매핑
- `naver` 한 번으로 dagyeolun·naver-blog·busan-mom-cafe(네이버 카페분) 공통.
- 다음 카페 맘카페 → `kakao`. `instagram` / `youtube`(google) / `ohou` 는 각자 로그인.

## 동시성 제약 (중요)
- `channel_session.py`와 `naver_cafe_scraper.py`는 **같은 `.browser-profile`을 공유**한다. 한 프로필은 Chrome 한 인스턴스만 열 수 있어, 스크래퍼(board/scrape)가 도는 중 `status`/`login`/`open`을 실행하면 `TargetClosedError`(프로필 잠금 충돌)가 난다.
- 대응: **수집 스크래퍼와 세션 명령을 동시에 실행하지 않는다.** 충돌 시 잠깐 뒤 1회 재시도하면 대개 통과(실측). 백그라운드 수집이 길면 그것이 끝난 뒤 세션 명령을 돌린다.

## 산출물·인계
- `status` 로그인 상태표, `open --dump` → `artifacts/session-open-<ch>-*.json`(진입 URL·노출 링크·텍스트).
- 채널 수집가(`collect-*`)에게 "로그인된 채널 목록 + 진입 URL"을 넘긴다.
  수집가는 **로그인 세션 있으면 우선, 없으면 공개검색 폴백**.
- 로그인 실패/차단 채널은 한계를 명시하고 폴백 표기.

상세 규칙은 `.claude/agents/channel-access-engineer.md` 참조.
