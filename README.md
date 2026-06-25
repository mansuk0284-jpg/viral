# 혼수가전 바이럴 모니터링 — Viral to Insight

전국 백화점 입점 **삼성스토어 vs LG전자** 혼수가전 구매후기 바이럴 현황을 모니터링·분석하는 대시보드입니다. 다이렉트결혼준비 카페 등 온라인 후기를 수집·분류·매장매칭하여, 삼성스토어의 혼수 판매 증대 인사이트를 찾습니다.

## 다른 PC에서 보기 (GitHub Pages)

이 저장소를 GitHub에 올리면 `web/` 폴더가 자동으로 웹에 배포됩니다.

1. GitHub에서 새 저장소 생성 (예: `viral-monitor`)
2. 이 폴더에서 아래 실행 (`<USER>`는 본인 GitHub 아이디):
   ```bash
   git init
   git add .
   git commit -m "init: 혼수가전 바이럴 대시보드"
   git branch -M main
   git remote add origin https://github.com/<USER>/viral-monitor.git
   git push -u origin main
   ```
3. GitHub 저장소 → **Settings → Pages → Build and deployment → Source: GitHub Actions** 선택
4. 잠시 후 배포 완료 → 주소: `https://<USER>.github.io/viral-monitor/`

이 주소를 누구나(다른 PC·모바일 포함) 열어볼 수 있습니다.

## 구성

- `web/` — 정적 대시보드 (HTML/CSS/JS). 배포 대상.
  - `index.html` — 메인(영상·채널 타일·포털)
  - `cafe-analysis.js` / `cafe-analysis.css` — 다이렉트결혼준비 분석(전국 지도·기간·매장 드릴다운)
  - `assets/` — 영상·지도(SVG)·이미지·집계 데이터(`cafe-data.js`)
- `scripts/` — 수집·집계 파이프라인 (Python). 배포에는 불필요.
- `data/`, `.claude/` — 하네스 설정·소스 카탈로그.

## 데이터 주의

- 집계는 **표본 기준 추정치**(전수 아님)입니다.
- 로그인 세션(`.browser-profile/`)과 대용량 원본(`artifacts/`)은 `.gitignore`로 제외되어 업로드되지 않습니다.
