# GitHub 계정 전환 가이드 — 개인 계정 → 회사/신규 계정

현재 배포는 개인 계정(`mansuk0284-jpg`)의 저장소 + GitHub Pages(Actions 워크플로)로
돌아간다. 회사 계정이나 신규 계정으로 옮기는 절차는 아래 다섯 단계다.
**계정 생성과 로그인은 반드시 본인이 직접 한다** — 코드·AI는 비밀번호를 다루지 않는다.

## 0. 먼저 정할 것 — 저장소 공개 범위

현재 저장소는 **public**이다. 즉 코드와 함께 `artifacts/compete.json`(사내 실적
배수)도 저장소에서 누구나 열람할 수 있는 상태다. 전환할 때 같이 정한다:

| 선택 | Pages | 비고 |
|---|---|---|
| public 유지 | 무료 | 지금과 동일 — 사내 자료 노출 상태도 동일 |
| **private 전환** | 유료 플랜 필요(Pro/Team) | 저장소는 가려지고 Pages 사이트만 공개 |

## 1. 계정 준비 (본인 직접)

- github.com 에서 회사 메일로 신규 계정 생성(또는 회사 조직 계정 사용).
- 2단계 인증 설정 권장.

## 2. 이 PC(또는 새 PC)에서 새 계정 로그인 (본인 직접)

```bash
gh auth login --hostname github.com --git-protocol https --web
```
브라우저가 열리면 **새 계정으로** 로그인·승인한다.

## 3. 새 저장소 생성 + 코드 이전 (명령 그대로)

```bash
cd C:/Users/admin/Desktop/viral
gh repo create <새계정>/viral --public --source=. --remote=neworigin --push
```
private 로 만들려면 `--public` 대신 `--private`(Pages 는 유료 플랜 필요).
기존 원격을 대체하려면:
```bash
git remote remove origin
git remote rename neworigin origin
```

## 4. 새 저장소에서 Pages 활성화

```bash
gh api repos/<새계정>/viral/pages -X POST -f build_type=workflow
```
이후 아무 커밋이나 푸시하면 `.github/workflows/deploy.yml` 이 자동으로
`https://<새계정>.github.io/viral/` 에 배포한다(워크플로는 계정 무관 — 수정 불필요).

## 5. 설정 파일 한 곳만 수정

`scripts/deploy.conf` 의 세 줄을 새 계정으로 바꾼다:
```
GH_USER="<새계정>"
GH_REPO="viral"
PAGES_URL="https://<새계정>.github.io/viral/"
```
자동 갱신(auto_refresh.sh)의 계정 고정·푸시 재시도·라이브 확인이 전부 이
파일을 읽으므로 **다른 스크립트는 손댈 필요 없다.**

## 전환 후 확인 목록

- [ ] `git push` 가 새 저장소로 나가는가 (`git remote -v`)
- [ ] 새 주소에서 사이트가 열리는가
- [ ] `bash scripts/auto_refresh.sh` 드라이런 시 라이브 확인이 새 주소를 보는가
- [ ] 팀에 공유한 주소(카톡·문서)를 새 주소로 갱신했는가
- [ ] 옛 개인 저장소 처리 — 보관(아카이브) 또는 삭제. 옛 Pages 주소는 저장소를
      지우거나 Pages 를 끄기 전까지 계속 열린다는 점에 주의.

## 참고

- 접속자 카운터(Abacus)는 GitHub 계정과 무관해 그대로 동작한다. 주소가 바뀌어도
  같은 네임스페이스를 쓰므로 숫자가 이어진다.
- 과거 커밋의 작성자 이름은 로컬 git 설정(`viral-monitor`)이라 개인 식별 정보가
  아니며, 저장소를 옮겨도 이력은 그대로 따라간다.
