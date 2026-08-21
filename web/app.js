/* ===== Wedding Viral Analyst — 2026 데이터 & 렌더링 ===== */
/* 소스: 다이렉트결혼준비 카페 「후기(가전)」 게시판 자동 수집 (articleId 중복제거) */
/* 범위: 2026년 작성 후기만 · 표본 기준 추정치 (전수 아님) */
/* 부울경 = 권역 11개 백화점 지점이 본문/제목으로 확정된 글. 최근 3개월(04~06) 본문 정밀 수집 반영. */

"use strict";

const CHANNELS = {
  "naver-blog": {
    cls: "ch-blog", name: "네이버 블로그", sub: "구매 후기글 · 소스ID naver-blog",
    ic: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 4h8l4 4v12H6V4Z" fill="#fff"/><path d="M14 4v4h4" fill="#1ec800"/><rect x="8.5" y="11" width="7" height="1.6" rx="0.8" fill="#1ec800"/><rect x="8.5" y="14" width="7" height="1.6" rx="0.8" fill="#1ec800"/></svg>',
    method: "<b>네이버 검색 API</b> → naver_api_collect.py (제목+요약, <b>--read-body</b> 시 본문까지). 현재는 키 없이 게스트 표본.",
    total: 19, ad: 3, s: 4, l: 1, both: 11, etc: 0,
    tone: { pos: 2, neg: 0, neu: 14 },
    items: [{ name: "TV", value: 1 }],
    note: "제목 기반 1차 분석(본문 미열람)으로 <b>표본 빈약·정밀도 낮음</b>. NAVER_CLIENT_ID/SECRET 등록 시 본문까지 깊게 수집해 매장·품목 정확도가 올라갑니다.",
    go: "https://search.naver.com/search.naver?where=blog&query=혼수가전 후기",
    records: [
      { t: "삼성 상위등급 혼수가전 2000만원대 계약 후기 | 갤러리아 백화점 견적 공유 (85인치 TV·시스템에어컨)", u: "https://blog.naver.com/sssyyy0313/224314455194", b: "s", m: "삼성 · TV · 중립" },
      { t: "W. 혼수가전 삼성스토어 광교갤러리아 상담 계약 후기 (선택 이유·견적·혜택)", u: "https://blog.naver.com/luckyminky09/224298323768", b: "s", m: "삼성 · 중립" },
      { t: "신혼혼수 LG전자 발품후기(백화점/대리점/직원가) 10종 최종견적", u: "https://blog.naver.com/dearjaein/224075060307", b: "l", m: "LG · 중립" },
      { t: "혼수가전 체감가 비교｜삼성 vs LG 직접 돌아본 후기", u: "https://blog.naver.com/inourway/224284440022", b: "b", m: "삼성·LG · 중립" },
      { t: "삼성 20% 온누리 환급 vs LG 역대급 캐시백, 가전 바꿀 타이밍 조건 완벽 비교!", u: "https://blog.naver.com/dlsgur234/224307996374", b: "b", m: "삼성·LG · 긍정" },
    ],
  },
  "busan-mom-cafe": {
    cls: "ch-mom", name: "부울경 맘카페", sub: "지역 커뮤니티 · 소스ID busan-mom-cafe",
    ic: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5C7.6 5 4 7.9 4 11.4c0 2.2 1.5 4.2 3.7 5.3-.2.6-.6 2-.7 2.3 0 .2.1.4.4.2.3-.2 2.3-1.6 3.1-2.2.5.1 1 .1 1.5.1 4.4 0 8-2.9 8-6.4S16.4 5 12 5Z" fill="#fff"/><circle cx="9.2" cy="11.3" r="1.15" fill="#03C75A"/><circle cx="12" cy="11.3" r="1.15" fill="#03C75A"/><circle cx="14.8" cy="11.3" r="1.15" fill="#03C75A"/></svg>',
    method: "<b>네이버 카페 검색 API</b> → naver_api_collect.py (권역 필터+<b>--read-body</b>). 현재는 키 없이 게스트 표본.",
    total: 4, ad: 0, s: 2, l: 0, both: 2, etc: 0,
    tone: { pos: 0, neg: 1, neu: 3 },
    items: [],
    note: "권역 맘카페 게스트 검색 표본이 <b>4건으로 매우 적음</b>. 무리한 수치화 금지 — 키 등록·로그인 세션으로 표본을 보강해야 정량 비교가 가능합니다.",
    go: "https://www.google.com/search?q=맘카페 혼수가전 후기",
    records: [
      { t: "갤러리아광교 삼성 신혼가전 후기", u: "https://cafe.naver.com/a9111/171999", b: "s", m: "삼성 · 중립" },
      { t: "삼성이 온누리 페이백 20%되니까 LG와 고민하지도 않고 삼성으로 결정 (경산 성지에서 진행)", u: "https://cafe.naver.com/dgweddingsarang/107662", b: "b", m: "삼성·LG · 부정" },
      { t: "가전 살려고 하는데 삼성 vs 엘지", u: "https://cafe.naver.com/dieselmania/47164747", b: "b", m: "삼성·LG · 중립" },
      { t: "의정부 신세계 백화점 삼성스토어 매니저님께 가전 졸업했어요!", u: "https://cafe.naver.com/makemywedding/657578", b: "s", m: "삼성 · 중립" },
    ],
  },
  youtube: {
    cls: "ch-youtube", name: "유튜브", sub: "혼수 브이로그·리뷰 · 소스ID youtube",
    ic: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="12" rx="3.5" fill="#fff"/><path d="M10.5 9.2 15 12l-4.5 2.8V9.2Z" fill="#FF0000"/></svg>',
    method: "<b>YouTube Data API v3</b> → youtube_collect.py (영상+상위 댓글 합산). 현재는 키 없이 게스트 정적 수집.",
    total: 1, ad: 0, s: 0, l: 1, both: 0, etc: 0,
    tone: { pos: 0, neg: 0, neu: 1 },
    items: [],
    note: "JS 렌더로 게스트 정적 수집은 <b>1건뿐</b>. YOUTUBE_API_KEY 등록 시 영상 제목·설명·댓글을 정량 수집해 <b>신제품 반응·정성 비교</b> 신호를 얻을 수 있습니다.",
    go: "https://www.youtube.com/results?search_query=혼수가전 후기",
    records: [
      { t: "LG전자 공식몰, LGE.COMㅣ인기 제품", u: "https://www.youtube.com/watch?v=E0k9r_Ezb3w", b: "l", m: "LG · 중립" },
    ],
  },
  ohou: {
    cls: "ch-ohou", name: "오늘의집", sub: "인테리어 커머스·콘텐츠 · 소스ID ohou",
    ic: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3.5 4 10v9.5h5.5V14h5v5.5H20V10l-8-6.5Z" fill="#fff"/></svg>',
    method: "<b>세션캡처</b> → channel_analyze.py. 공개 API 없음 + SPA(JS 렌더)라 정적 수집 0건.",
    total: 0, ad: 0, s: 0, l: 0, both: 0, etc: 0,
    tone: { pos: 0, neg: 0, neu: 0 },
    items: [],
    note: "공개 API가 없고 SPA라 <b>게스트 수집 0건</b>. 본인 로그인 세션 캡처 범위 내에서만 수집(무단 자동수집·ToS 위반 금지). 비스포크·오브제 등 <b>디자인가전 트렌드 신호</b>용 채널입니다.",
    go: "https://www.google.com/search?q=오늘의집 혼수가전 후기",
    records: [],
  },
  instagram: {
    cls: "ch-insta", name: "인스타그램", sub: "해시태그 후기 · 소스ID instagram",
    ic: '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="5" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="3.6" stroke="#fff" stroke-width="2"/><circle cx="16.6" cy="7.4" r="1.1" fill="#fff"/></svg>',
    method: "<b>세션캡처</b> → channel_analyze.py. 공식 공개 API 없음 + 강한 로그인월.",
    total: 0, ad: 0, s: 0, l: 0, both: 0, etc: 0,
    tone: { pos: 0, neg: 0, neu: 0 },
    items: [],
    note: "강한 로그인월로 <b>게스트 수집 0건</b>. 본인 로그인 세션 캡처 화면 범위 내에서만 다룸(CAPTCHA·계정경고 의심 시 즉시 중단). 협찬 비중이 높아 <b>신제품·디자인 반응</b> 신호용으로 한정합니다.",
    go: "https://www.instagram.com/explore/tags/혼수가전/",
    records: [],
  },
  gyeoljun: {
    cls: "ch-gyeoljun", name: "결혼준비(결다모)", sub: "대형 웨딩카페 · 소스ID gyeoljun", pending: true, cafe: true,
    ic: '<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="14" rx="3" fill="#fff"/><path d="M7 9.5h10M7 12.5h7" stroke="#03c75a" stroke-width="1.8" stroke-linecap="round"/><circle cx="16.5" cy="13" r="1.4" fill="#03c75a"/></svg>',
    method: "<b>네이버 카페 스크래퍼</b> → naver_cafe_scraper.py (clubid 확인 후 board 정주행 + <b>--read-body</b>). 본인 로그인 세션 우선, 없으면 공개검색 폴백.",
    total: 0, ad: 0, s: 0, l: 0, both: 0, etc: 0,
    tone: { pos: 0, neg: 0, neu: 0 },
    items: [],
    note: "추천 추가 채널 — <b>아직 수집 전(표본 0건)</b>. 전국 최대급 웨딩카페로 혼수가전 후기 밀도가 높습니다. clubid·후기 게시판(menuId) 확정 후 정주행하면 표본이 크게 늘어납니다.",
    go: "https://search.naver.com/search.naver?query=결혼준비 결다모 혼수가전 후기",
    records: [],
  },
  "gn-wedding": {
    cls: "ch-gnwed", name: "경남 결혼준비", sub: "지역 웨딩카페 · 소스ID gn-wedding", pending: true, cafe: true,
    ic: '<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="14" rx="3" fill="#fff"/><path d="M7 9.5h10M7 12.5h7" stroke="#03c75a" stroke-width="1.8" stroke-linecap="round"/><circle cx="16.5" cy="13" r="1.4" fill="#03c75a"/></svg>',
    method: "<b>네이버 카페 스크래퍼</b> → naver_cafe_scraper.py (clubid 확인 후 board + 권역 필터). 본인 로그인 세션 우선.",
    total: 0, ad: 0, s: 0, l: 0, both: 0, etc: 0,
    tone: { pos: 0, neg: 0, neu: 0 },
    items: [],
    note: "추천 추가 채널 — <b>아직 수집 전(표본 0건)</b>. 부울경 지역 웨딩카페라 <b>권역 매장 매칭 정확도</b>가 높은 표본을 얻을 수 있습니다. clubid 확정 후 정주행 필요.",
    go: "https://search.naver.com/search.naver?query=경남 결혼준비 카페 혼수가전 후기",
    records: [],
  },
  weddingbook: {
    cls: "ch-wbook", name: "웨딩북", sub: "웨딩 준비 앱 · 소스ID weddingbook", pending: true,
    ic: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 20s-7-4-7-9.5A4 4 0 0 1 12 7a4 4 0 0 1 7 3.5C19 16 12 20 12 20Z" fill="#fff"/></svg>',
    method: "<b>앱/세션캡처</b> → channel_analyze.py. 공개 API 없음, 본인 로그인 세션 캡처 범위 내에서만 수집(ToS 준수).",
    total: 0, ad: 0, s: 0, l: 0, both: 0, etc: 0,
    tone: { pos: 0, neg: 0, neu: 0 },
    items: [],
    note: "추천 추가 채널 — <b>아직 수집 전(표본 0건)</b>. 웨딩 준비 앱 커뮤니티로 혼수 패키지·견적 후기가 모입니다. 공개 API가 없어 본인 세션 캡처 범위에서만 수집 가능.",
    go: "https://www.google.com/search?q=웨딩북 혼수가전 후기",
    records: [],
  },
  momsholic: {
    cls: "ch-momsh", name: "맘스홀릭베이비", sub: "네이버 최대 맘카페 · 소스ID momsholic", pending: true, cafe: true,
    ic: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5C7.6 5 4 7.9 4 11.4c0 2.2 1.5 4.2 3.7 5.3-.2.6-.6 2-.7 2.3 0 .2.1.4.4.2.3-.2 2.3-1.6 3.1-2.2.5.1 1 .1 1.5.1 4.4 0 8-2.9 8-6.4S16.4 5 12 5Z" fill="#fff"/></svg>',
    method: "<b>네이버 카페 검색 API + 로그인 세션</b> → naver_api_collect.py. 키 등록·세션 확보 시 본문까지 수집.",
    total: 0, ad: 0, s: 0, l: 0, both: 0, etc: 0,
    tone: { pos: 0, neg: 0, neu: 0 },
    items: [],
    note: "추천 추가 채널 — <b>아직 수집 전(표본 0건)</b>. 국내 최대급 맘카페로 혼수·신혼가전 후기 절대량이 큽니다. NAVER 키 + 로그인 세션으로 권역 필터 수집 시 표본 보강 효과가 큽니다.",
    go: "https://search.naver.com/search.naver?query=맘스홀릭 혼수가전 후기",
    records: [],
  },
  danggn: {
    cls: "ch-danggn", name: "당근 동네생활", sub: "지역 커뮤니티 · 소스ID danggn", pending: true,
    ic: '<svg viewBox="0 0 24 24" fill="none"><path d="M14.5 6.2c1.2-1.6 3.4-2 4.3-1.1.9.9.5 3.1-1.1 4.3l1 1c.5.5.5 1.3 0 1.8l-7.8 7.8c-1.4 1.4-3.7 1.4-5.1 0-1.4-1.4-1.4-3.7 0-5.1l7.8-7.8c.5-.5 1.3-.5 1.8 0l-.9-.9Z" fill="#ff7e36"/><path d="M14 4c.8 1.2.7 2.7-.3 3.7" stroke="#16a34a" stroke-width="1.6" stroke-linecap="round"/></svg>',
    method: "<b>동네생활 세션/WebSearch</b> → 공개 API 없음, 위치 기반 로그인 세션 범위 내 수집(난도 높음).",
    total: 0, ad: 0, s: 0, l: 0, both: 0, etc: 0,
    tone: { pos: 0, neg: 0, neu: 0 },
    items: [],
    note: "추천 추가 채널 — <b>아직 수집 전(표본 0건)</b>. 위치 기반이라 <b>권역(부울경) 지역성</b>이 강하지만, 공개 API가 없고 로그인월이 있어 수집 난도가 높습니다. 본인 세션 범위에서만 다룸.",
    go: "https://www.daangn.com/kr/community/?in=혼수가전",
    records: [],
  },
};

const BRAND_LABEL = { s: "삼성", l: "LG", b: "삼성·LG", x: "미상" };

/* 카페형 대기 채널 — analyze_cafe.py가 채울 분석 4섹션 골격 미리보기(정직한 '수집 후 표시') */
function analysisPreview() {
  const sec = (t, d) =>
    `<div class="ap-card"><div class="ap-head"><b>${t}</b><span class="ap-wait">수집 후 표시</span></div>` +
    `<p class="ap-desc">${d}</p><div class="ap-skel"><i></i><i></i><i></i></div></div>`;
  return (
    `<p class="card-sub" style="margin:18px 0 8px"><b>분석 구성 미리보기</b> — 수집 완료 시 아래 4개 화면이 채워집니다 ` +
    `(다이렉트결혼준비 분석과 동일 엔진 <code>analyze_cafe.py</code>).</p>` +
    `<div class="ap-grid">` +
    sec("① 브랜드 집계", "삼성 · LG · 양사 · 미상 건수와 삼성 점유율") +
    sec("② 월별 삼성 vs LG 추이", "월 단위 단일 언급 추이 — 과거 LG 우세→삼성 역전 변곡점 추적") +
    sec("③ 권역 매장별 삼성 vs LG", "부울경 12개점 매칭 · 점별 경쟁력 비교") +
    sec("④ 우호 · 비난 후기 샘플", "매장 특정 긍정/부정 후기 원문 링크") +
    `</div>`
  );
}

/* 채널 패널 HTML */
function renderChannel(id) {
  const c = CHANNELS[id];
  if (!c) return "";
  const sample = c.total - c.ad;
  const share = pct(c.s, c.l);
  let body = "";

  if (c.total <= 0) {
    const emptyMsg = c.pending
      ? `추천 추가 채널 — <b>아직 수집 전</b>입니다.<br>아래 수집 경로로 정주행하면 표본이 채워집니다.`
      : `이 채널은 게스트 정적 수집으로 표본이 잡히지 않았습니다.<br>아래 안내를 참고하세요.`;
    body =
      `<div class="ch-empty"><span class="ce-num">${c.pending ? "수집 대기" : "0건"}</span>` +
      emptyMsg + `</div>` +
      (c.pending && c.cafe ? analysisPreview() : "");
  } else {
    body =
      `<div class="ch-metrics">` +
      metric("수집", c.total, "건", "") +
      metric("삼성 언급", c.s, "건", "s") +
      metric("LG 언급", c.l, "건", "l") +
      metric("삼성·LG 동시", c.both, "건", "") +
      `</div>` +
      (c.s + c.l > 0
        ? `<p class="card-sub" style="margin:0 0 6px">삼성 vs LG (단일 언급 기준)</p>` + comboChart(c.s, c.l, share)
        : `<p class="card-sub">단일 브랜드 언급이 적어 점유율 비교는 생략합니다.</p>`) +
      `<div class="ch-tone">` +
      `<span class="tn-pos">긍정 ${c.tone.pos}</span>` +
      `<span class="tn-neg">부정 ${c.tone.neg}</span>` +
      `<span>중립 ${c.tone.neu}</span></div>` +
      (c.items.length
        ? `<p class="card-sub" style="margin:0 0 6px">언급 품목</p><div class="ch-tone">` +
          c.items.map((it) => `<span>${it.name} ${it.value}</span>`).join("") + `</div>`
        : "");
  }

  const recs = c.records.length
    ? `<h3 class="card-title" style="margin-top:8px">샘플 후기 (${c.records.length}건)</h3>` +
      `<ul class="ch-records">` +
      c.records
        .map(
          (r) =>
            `<li><span class="ch-rec-tag ${r.b}">${BRAND_LABEL[r.b]}</span>` +
            `<span class="ch-rec-body"><a href="${r.u}" target="_blank" rel="noopener">${r.t}</a>` +
            `<span class="rec-meta">${r.m} · 출처 새 탭</span></span></li>`
        )
        .join("") +
      `</ul>`
    : "";

  return (
    `<div class="ch-head ${c.cls}">` +
    `<span class="ch-ic">${c.ic}</span>` +
    `<span class="ch-htext"><h2>${c.name}</h2><span class="ch-sub">${c.sub}</span></span>` +
    `</div>` +
    `<p class="ch-method">수집 방식 — ${c.method}</p>` +
    (c.total > 0
      ? `<p class="card-sub" style="margin:-6px 0 14px">수집 ${c.total}건 · 광고추정 ${c.ad}건 제외 분석표본 ${sample}건 · <strong>표본 기준 추정치(전수 아님)</strong></p>`
      : "") +
    `<div class="card">${body}</div>` +
    `<div class="ch-note">⚠ ${c.note}</div>` +
    (recs ? `<div class="card">${recs}</div>` : "") +
    `<a class="ch-cta" href="${c.go}" target="_blank" rel="noopener">외부에서 원문 더 보기 →</a>`
  );
}

function metric(k, v, unit, cls) {
  return (
    `<div class="ch-metric ${cls}"><span class="ck">${k}</span>` +
    `<span class="cv"><b class="count-up" data-count="${v}">0</b><small>${unit}</small></span></div>`
  );
}

/* 타일 클릭 → 채널 단일 화면 진입 (window 노출) */
function openChannel(id) {
  const host = $("#channelPanel");
  if (!host) return;
  host.innerHTML = renderChannel(id);
  const sec0 = $("#channel");
  if (sec0) sec0.hidden = false;
  document.body.classList.add("mode-results", "view-channel");
  window.scrollTo({ top: 0, behavior: "auto" });
  requestAnimationFrame(() => {
    const sec = $("#channel");
    if (sec) {
      animateFills(sec);
      sec.querySelectorAll(".count-up[data-count]").forEach(animateCount);
    }
  });
}
window.openChannel = openChannel;

/* 제휴카페 타일 클릭 → 채널 분석 화면(동일 양식). 아직 수집 전이므로 정직하게 '수집 대기'. */
function openAffiliateCafe(cafe) {
  const host = $("#channelPanel");
  if (!host || !cafe) return;
  const id = "affiliate:" + cafe.n;
  const rg = [cafe.r2, cafe.r3].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" · ");
  CHANNELS[id] = {
    cls: "ch-cafe", name: cafe.n,
    sub: `제휴카페 · ${cafe.t}${rg ? " · " + rg : ""} · 회원 ${(cafe.m || 0).toLocaleString("ko-KR")}명`,
    ic: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H10l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="#fff"/><circle cx="9" cy="10.5" r="1.3" fill="#03C75A"/><circle cx="12" cy="10.5" r="1.3" fill="#03C75A"/><circle cx="15" cy="10.5" r="1.3" fill="#03C75A"/></svg>',
    method: "<b>네이버 카페 스크래퍼</b> → naver_cafe_scraper.py (clubid 확인 후 board 정주행 + <b>--read-body</b>). 본인 로그인 세션 우선, 없으면 공개검색 폴백.",
    total: 0, ad: 0, s: 0, l: 0, both: 0, etc: 0,
    tone: { pos: 0, neg: 0, neu: 0 }, items: [], pending: true,
    note: `제휴카페 — <b>아직 수집 전(표본 0건)</b>. 회원 ${(cafe.m || 0).toLocaleString("ko-KR")}명 규모로, ` +
      `clubid 확정 후 가전 후기 게시판을 정주행하면 삼성·LG 후기 비교가 이 화면에 채워집니다.`,
    go: cafe.u, records: [],
  };
  openChannel(id);
}
window.openAffiliateCafe = openAffiliateCafe;

/* ===== 유틸 ===== */
const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};
const pct = (a, b) => (a + b === 0 ? 0 : Math.round((a / (a + b)) * 100));
const fmtN = (n) => n.toLocaleString();

function comboChart(s, l, share) {
  const max = Math.max(s, l) || 1;
  return (
    `<div class="combo">` +
    `<div class="combo-cap"><span class="cc-key">건수</span>` +
    `<span class="cc-share">삼성 점유율 <strong>${share}%</strong><i> · LG ${100 - share}%</i></span></div>` +
    `<div class="vchart vchart-mini combo-bars">` +
    vbarOne("삼성", s, "s", max) + vbarOne("LG", l, "l", max) +
    `</div>` +
    `</div>`
  );
}

/* 세로 막대 1개 (건수 라벨) */
function vbarOne(tag, val, cls, max) {
  return (
    `<div class="vgroup"><div class="vbars">` +
    `<div class="vbar ${cls}" data-h="${((val / max) * 100).toFixed(1)}" style="height:0%">` +
    `<span class="vval">${fmtN(val)}건</span></div></div>` +
    `<span class="vlabel">${tag}</span></div>`
  );
}

/* 세로 그룹 막대 차트 — 건수(막대)+점유율(상단)을 한 그래프에 결합.
   groups: [{label, share, sub, bars:[{val,cls}]}] */
// 인트로 복귀(뒤로가기 ← / 채널·카페 화면의 '처음'에서 호출). 결과 진입은 openChannel/openCafeAnalysis가 담당.
function setupStart() {
  const VIEWS = ["view-channel", "view-cafe", "view-af", "view-cx", "view-nr"];

  /* 화면 전환 — 켤 view 만 남기고 나머지는 끈다.
     각 화면이 add 만 하고 지우지 않으면 클래스가 겹겹이 쌓여 CSS 가 서로 간섭한다. */
  function setView() {
    const on = Array.prototype.slice.call(arguments);
    document.body.classList.remove(...VIEWS);
    document.body.classList.add("mode-results", ...on);
  }
  window.setView = setView;

  function showIntro() {
    // view-* 를 한 곳에서 전부 턴다. 화면마다 각자 지우게 두었더니
    // view-af / view-cx / view-nr 이 남아 클래스가 쌓였다(실측: 처음으로 눌러도 view-nr 잔존).
    document.body.classList.remove("mode-results", ...VIEWS);
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  window.showIntro = showIntro;
  const back = $("#backBtn");
  if (back) back.addEventListener("click", showIntro);
}

/* ===== 카운트업 ===== */
function animateCount(node) {
  const target = parseFloat(node.dataset.count);
  if (Number.isNaN(target)) return;
  const suffix = node.dataset.suffix || "";
  const dur = 900;
  const start = performance.now();
  function step(now) {
    const p = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    node.textContent = Math.round(target * eased).toLocaleString() + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ===== 막대 애니메이션 ===== */
function animateFills(root) {
  root.querySelectorAll(".bar-fill[data-w]").forEach((f) => {
    f.style.width = f.dataset.w + "%";
  });
  root.querySelectorAll(".m-bar[data-h]").forEach((b) => {
    b.style.height = b.dataset.h + "%";
  });
  root.querySelectorAll(".vbar[data-h]").forEach((b) => {
    b.style.height = b.dataset.h + "%";
  });
}

/* ===== 스크롤 진입 관찰 ===== */
document.addEventListener("DOMContentLoaded", () => {
  setupStart();   // 뒤로(←) 버튼 + showIntro/showResults 전역 노출
});
