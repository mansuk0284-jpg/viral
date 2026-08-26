/* 네이버 블로그 채널 화면 (window.openBlog)

   다이렉트웨딩과 같은 **전국(지도) → 지역 → 매장** 3단 드릴 구조
   (2026-08-26 사용자 지시: "네이버블로그도 다이렉트웨딩처럼").

   블로그는 넓은 채널이다 — 혼수·가전 검색어로 걸러낸 글만 본다.
   체험단·협찬은 지우지 않고 갈라 세고, 브랜드 비교는 내돈내산만.
   조회수가 없으므로 목록은 최신순(순위를 지어내지 않는다).
   지역은 제목+요약 기반 추정, 매장은 지점 토큰 기준이다(각주 명시).

   수치는 월별 사전집계(mon/monRegions/monStores) 전량 기준으로 정확하고,
   글 목록만 표본(월별 최신·매장별 최신 12)이다. */
(function () {
  "use strict";
  const B = window.NBLOG || null;
  const fmtN = (n) => (n || 0).toLocaleString("ko-KR");
  const pct = (a, b) => (a + b === 0 ? 0 : Math.round((a / (a + b)) * 100));
  const josa = (w, a, b) => {
    const c = (w || "").charCodeAt((w || "").length - 1);
    if (c < 0xac00 || c > 0xd7a3) return b;
    return (c - 0xac00) % 28 ? a : b;
  };

  /* 드릴 상태 — 기간과 독립. 기간을 바꿔도 보고 있던 단계는 유지한다 */
  const stv = { level: "nation", region: null, store: null };

  let PER = null;
  function per() {
    if (PER || !window.VPER || !B) return PER;
    PER = VPER.create({
      months: B.months || [],
      onChange: () => paint(document.getElementById("channelPanel")),
    });
    return PER;   // 날짜가 정확한 채널이라 다결과 같이 현재 월로 연다
  }
  const labOf = () => (per() ? per().label() : "전체");

  function monthsInRange() {
    const p = per();
    if (!p) return (B.months || []).slice();
    const r = p.range();
    const a = r[0].slice(0, 7), b = r[1].slice(0, 7);
    return (B.months || []).filter((m) => m >= a && m <= b);
  }
  function inRangeYm(ym) {
    const p = per();
    if (!p) return true;
    const r = p.range();
    return ym && ym >= r[0].slice(0, 7) && ym <= r[1].slice(0, 7);
  }

  /* 월별 사전집계를 기간으로 합산 */
  const aggMon = (f) => monthsInRange().reduce((a, m) => a + (((B.mon || {})[m] || {})[f] || 0), 0);
  /* 직전 같은 길이 구간 합산 — "직전 대비" 문장용(다결 노하우).
     비교가 성립 안 하면(직전 구간 없음) null — ±0 원칙대로 삼지선다로 쓴다. */
  function prevSum(f) {
    const ms = monthsInRange();
    if (!ms.length) return null;
    const all = B.months || [];
    const i0 = all.indexOf(ms[0]);
    if (i0 < ms.length) return null;              // 직전 구간이 데이터 밖
    const prev = all.slice(i0 - ms.length, i0);
    return prev.reduce((a, m) => a + (((B.mon || {})[m] || {})[f] || 0), 0);
  }
  function aggMap(SRC) {
    const out = {};
    monthsInRange().forEach((m) => {
      const v = (SRC || {})[m] || {};
      Object.keys(v).forEach((k) => {
        const o = out[k] || (out[k] = { n: 0, s: 0, l: 0, sp: 0 });
        o.n += v[k].n; o.s += v[k].s; o.l += v[k].l; o.sp += v[k].sp;
      });
    });
    return out;
  }

  function pickCur() {
    return (B.posts || []).filter((x) => inRangeYm(x.ym));
  }

  function listRows(g, n) {
    return g.slice(0, n).map((x, i) =>
      `<a class="yv-row" href="${x.u}" target="_blank" rel="noopener"` +
      ` title="${x.t} · ${x.bg || "블로거"} · ${x.d}">` +
      `<i>${i + 1}</i><b class="yt-t">${x.t}</b>` +
      `<em>${(x.d || "").slice(2, 7) || "-"}</em></a>`).join("");
  }

  /* 실행 제안(역할별) 표준 블록 */
  const rolePlan = (hq, team, store) =>
    `<div class="cy-sec"><h5>실행 제안 <i>역할별</i></h5><ul class="role-plan">` +
    `<li class="rp-hq"><em>본사</em><span>${hq}</span></li>` +
    `<li class="rp-team"><em>영업팀</em><span>${team}</span></li>` +
    `<li class="rp-store"><em>매장</em><span>${store}</span></li>` +
    `</ul></div>`;

  /* 이동 경로 — 다결과 같은 문법 */
  function crumb() {
    let h = `<div class="ca-crumb"><button type="button" data-nbgo="nation">네이버 블로그</button>`;
    if (stv.region) h += `<span>›</span><button type="button" data-nbgo="region">${stv.region}</button>`;
    if (stv.store) h += `<span>›</span><b>${stv.store}</b>`;
    return h + `</div>`;
  }

  const head = () =>
    `<div class="cx-top">` +
    `${window.VICON ? VICON.html("naver-blog", "네이버 블로그") : ""}` +
    `<div class="cx-title"><h2>네이버 블로그</h2>` +
    `<span>넓은 채널에서 혼수가전만 골라 봤습니다 · 글 ${fmtN(B.total)}건</span></div>` +
    `${per() ? per().bar() : ""}` +
    `</div>` + crumb();

  /* ── 전국 ─────────────────────────────────────────────────────────── */
  function renderNation() {
    const cur = pickCur();
    const total = aggMon("n"), spCnt = aggMon("sp");
    const ownCnt = total - spCnt;
    const oS = aggMon("os"), oL = aggMon("ol");
    const aS = aggMon("s"), aL = aggMon("l");
    const spPct = total ? Math.round(spCnt / total * 100) : 0;
    const sh = pct(oS, oL);
    const RG = aggMap(B.monRegions);
    const ST = aggMap(B.monStores);
    const IT = aggMap(B.monItems);
    const hot = Object.keys(IT).sort((a, b) => IT[b].n - IT[a].n).slice(0, 3);
    const stTop = Object.keys(ST).sort((a, b) => ST[b].n - ST[a].n).slice(0, 3);
    const byNew = cur.slice().sort((a, b) => (b.d || "").localeCompare(a.d || ""));

    /* 매장 우위·열세 + 직전 대비 — 진단과 좌측 칼럼이 함께 쓴다 */
    const stNames = Object.keys(ST);
    const stWin = stNames.filter((k) => ST[k].s > ST[k].l).length;
    const stLose = stNames.filter((k) => ST[k].l > ST[k].s).length;
    const pv = prevSum("n");
    const momLine = pv === null ? ""
      : pv < 10 ? ""
      : (function () {
          const d = Math.round((total - pv) / pv * 100);
          return d === 0 ? `직전 같은 길이 구간과 <b>같은 수준</b>입니다.`
            : d > 0 ? `직전 같은 길이 구간보다 <b>${d}% 늘었습니다</b>.`
            : `직전 같은 길이 구간보다 <b class="warn">${-d}% 줄었습니다</b>.`;
        })();

    /* 우측 진단 — 전체 진단 / 당사 특이사항 / 경쟁사 특이사항 / 실행 제안
       네 박스 세로 배치(2026-08-27 사용자 지시). 중복 서술은 이 재편에서
       걷어냈다 — 같은 수치는 한 박스에서만 말한다. */
    const secs = [];

    // ① 전체 진단 — 총론. 규모→브랜드 구도→분포를 단락으로 가른다.
    (function () {
      const ps = [];
      ps.push(`선택 기간의 네이버 블로그 게시물은 <b>${fmtN(total)}건</b>입니다 — ` +
        (spCnt
          ? `내돈내산 <b>${fmtN(ownCnt)}건</b>, 체험단·협찬 <b class="warn">${fmtN(spCnt)}건</b>${total >= 10 ? `(${spPct}%)` : ""}은 별도 집계했습니다.`
          : `전량 내돈내산 글이며 체험단·협찬 표기 글은 없습니다.`) +
        (momLine ? ` 게시량은 ${momLine}` : ``));
      ps.push(oS + oL >= 10
        ? `브랜드 구도는 내돈내산 기준 삼성 <b>${fmtN(oS)}건</b> 대 LG <b class="warn">${fmtN(oL)}건</b>(삼성 ${sh}%)입니다. ` +
          (sh >= 50 ? `고객이 자발적으로 남긴 글에서 당사가 우위라는 뜻입니다.`
            : `고객이 자발적으로 남긴 글에서 경쟁사 비중이 더 높습니다 — 이 격차가 이 채널의 핵심 과제입니다.`)
        : `브랜드가 갈리는 내돈내산 글이 <b>${oS + oL}건</b>뿐이라 건수로만 적습니다(삼성 ${oS} : LG ${oL}). 기간을 넓히면 흐름으로 읽을 수 있습니다.`);
      const rgTop = Object.keys(RG).sort((a, b) => RG[b].n - RG[a].n).slice(0, 3);
      let p3 = "";
      if (rgTop.length) {
        const rTot = Object.keys(RG).reduce((a, k) => a + RG[k].n, 0) || 1;
        p3 += `게시가 가장 많은 지역은 <b>${rgTop[0]}</b>(${fmtN(RG[rgTop[0]].n)}건, 지역 특정 글의 ${Math.round(RG[rgTop[0]].n / rTot * 100)}%)` +
          (rgTop.length > 1
            ? `이고, ${rgTop.slice(1).map((k) => `${k}(${fmtN(RG[k].n)})`).join(" · ")}${josa(rgTop[rgTop.length - 1], "이", "가")} 뒤를 잇습니다. `
            : `입니다. `);
      }
      if (hot.length) p3 += `품목은 <b>${hot.join(" · ")}</b> 순으로 다뤄졌습니다. `;
      p3 += `조회수가 비공개인 채널이라 수치는 게시 건수 기준이며, 검색 노출이 오래 지속되는 채널 특성상 건수가 곧 노출 점유의 근사치입니다.`;
      ps.push(p3);
      secs.push(`<div class="cy-sec"><h5>전체 진단</h5>` +
        ps.map((x) => `<p class="cy-note">${x}</p>`).join("") + `</div>`);
    })();

    // ② 당사 특이사항 — 삼성 시각: 어디가 강하고, 어느 매장이 대표하는가.
    (function () {
      const ps = [];
      const sTop = stNames.filter((k) => ST[k].s > 0).sort((a, b) => ST[b].s - ST[a].s)[0];
      if (sTop) {
        const v = ST[sTop];
        ps.push(`당사 언급이 가장 많은 매장은 <b>${sTop}</b>(삼성 ${fmtN(v.s)}건 vs LG ${fmtN(v.l)}건)입니다 — ` +
          (v.s > v.l ? `이 매장 이름을 검색하는 예비 고객은 당사 후기부터 접합니다.`
            : `다만 이 매장에서도 경쟁사 글이 많아 검색 상위 노출 경쟁이 진행 중입니다.`));
      }
      if (stNames.length) {
        ps.push(`매장이 특정된 ${stNames.length}곳 중 당사 우위는 <b>${stWin}곳</b>, 열세는 <b class="warn">${stLose}곳</b>입니다.` +
          (stNames.length - stWin - stLose ? ` 나머지 ${stNames.length - stWin - stLose}곳은 동률이거나 브랜드가 특정되지 않았습니다.` : ``));
      }
      const natAll = aS + aL >= 10 ? pct(aS, aL) : null;
      if (natAll !== null) {
        const up = Object.keys(RG).filter((k) => RG[k].s + RG[k].l >= 20)
          .map((k) => ({ n: k, s: RG[k].s, l: RG[k].l, sh: pct(RG[k].s, RG[k].l) }))
          .filter((x) => x.sh > natAll).sort((a, b) => b.sh - a.sh)[0];
        if (up) ps.push(`지역으로는 <b>${up.n}</b>${josa(up.n, "이", "가")} 삼성 ${fmtN(up.s)}건 vs LG ${fmtN(up.l)}건(삼성 ${up.sh}%)으로 전국(${natAll}%)보다 <b>${up.sh - natAll}p 높은</b> 강세 지역입니다 — 이 지역의 성과 요인을 정리하면 타 지역에 적용할 모범 사례가 됩니다.`);
      }
      if (!ps.length) ps.push(`이 기간 당사 매장이 특정된 글이 없습니다 — 매장명이 남는 후기 요청부터가 과제입니다.`);
      secs.push(`<div class="cy-sec"><h5>당사 특이사항</h5>` +
        ps.map((x) => `<p class="cy-note">${x}</p>`).join("") + `</div>`);
    })();

    // ③ 경쟁사 특이사항 — LG 시각: 집중 지역·매장, 강세 품목, 협찬 집행.
    (function () {
      const ps = [];
      const totLg = stNames.reduce((a, k) => a + ST[k].l, 0);
      const rgL = Object.keys(RG).filter((k) => RG[k].l > 0).sort((a, b) => RG[b].l - RG[a].l)[0];
      if (!totLg && !rgL) {
        ps.push(`이 기간 매장이 특정된 LG 글이 없습니다 — 경쟁사 노출이 적은 구간이라는 점 자체가 기회입니다. 이 시기에 당사 후기가 쌓이면 매장명 검색 결과를 선점할 수 있습니다.`);
      } else {
        const stL = stNames.slice().sort((a, b) => ST[b].l - ST[a].l)[0];
        const loseSt = stNames.filter((k) => ST[k].l > ST[k].s)
          .sort((a, b) => (ST[b].l - ST[b].s) - (ST[a].l - ST[a].s));
        let p1 = "";
        if (rgL) p1 += `LG 게시물이 가장 집중된 지역은 <b class="warn">${rgL}</b>(${fmtN(RG[rgL].l)}건)`;
        if (stL && ST[stL].l) p1 += (rgL ? `, 매장으로는 ` : `LG 게시물이 가장 집중된 매장은 `) + `<b class="warn">${stL}</b>(${fmtN(ST[stL].l)}건)입니다.`;
        else p1 += `입니다.`;
        p1 += loseSt.length
          ? ` 경쟁사가 앞선 매장은 <b class="warn">${loseSt.length}곳</b>이며, 격차가 가장 큰 곳은 ${loseSt[0]}(<b class="warn">${fmtN(ST[loseSt[0]].l - ST[loseSt[0]].s)}건</b> 차)입니다.`
          : ` 건수 기준으로 경쟁사가 앞선 매장은 없습니다.`;
        ps.push(p1);
        const lgItem = Object.keys(IT).filter((k) => IT[k].l > IT[k].s && IT[k].s + IT[k].l >= 10)
          .sort((a, b) => (IT[b].l - IT[b].s) - (IT[a].l - IT[a].s))[0];
        if (lgItem) ps.push(`품목으로는 <b class="warn">${lgItem}</b>에서 LG ${fmtN(IT[lgItem].l)}건 vs 삼성 ${fmtN(IT[lgItem].s)}건으로 격차가 가장 큽니다 — 이 품목을 검색한 고객은 경쟁사 글부터 접하게 되므로, 비교 질문 대응 준비가 필요합니다.`);
        const spS = aS - oS, spL = aL - oL;
        if (spS + spL >= 5) {
          ps.push(spS === spL
            ? `체험단·협찬 게시물은 양사 <b>같은 수준</b>(각 ${fmtN(spS)}건)입니다.`
            : spL > spS
            ? `체험단·협찬 게시물은 <b class="warn">LG ${fmtN(spL)}건</b> vs 삼성 ${fmtN(spS)}건 — 경쟁사의 협찬 마케팅 집행이 더 활발합니다. 내돈내산 후기가 많은 쪽이 신뢰도에서 유리합니다.`
            : `체험단·협찬 게시물은 삼성 <b>${fmtN(spS)}건</b> vs LG ${fmtN(spL)}건으로 당사가 많습니다 — 내돈내산 후기가 함께 늘어야 협찬 일변으로 비치지 않습니다.`);
        }
      }
      secs.push(`<div class="cy-sec"><h5>경쟁사 특이사항</h5>` +
        ps.map((x) => `<p class="cy-note">${x}</p>`).join("") + `</div>`);
    })();

    // ④ 실행 제안 — 역할별 표준 블록
    secs.push(rolePlan(
      spPct >= 40
        ? `체험단·협찬 게시물 비중이 ${spPct}%로 높아 고객 후기의 노출이 가려집니다 — <b>구매 고객 블로그 후기 캠페인</b>으로 내돈내산 비중을 키우는 설계가 필요합니다.`
        : `블로그는 검색 장기 노출 채널입니다 — 상위 품목(${hot[0] || "주요 품목"}) 중심의 <b>후기 콘텐츠 가이드</b> 배포가 유효합니다.`,
      stTop.length
        ? `<b>${stTop[0]}</b> 등 언급 상위 매장의 글을 지역 <b>교육 자료</b>로 공유하세요 — 고객이 계약을 결심한 문장이 그대로 적혀 있습니다.`
        : `매장이 적힌 글이 적습니다 — 매장 방문 시 <b>블로그 후기 요청</b> 실행 여부를 점검하세요.`,
      `계약 고객 중 블로그 운영 고객에게 <b>매장명·담당자 실명이 든 후기</b>를 요청하세요 — 검색에 오래 남는 후기가 다음 고객을 부릅니다.`));

    return `<div class="ca2 yt-wrap nb-wrap">` + head() +
      `<div class="nb-nation">` +
      // 좌측 — 다결 전국과 같은 타이틀·섹션 박스 문법
      `<div class="cx-sum nb-left">` +
      `<div class="rv-head"><h3>전국</h3><span>네이버 블로그 · ${labOf()}</span></div>` +
      `<div class="nsc-total"><b>${fmtN(total)}</b><i>건 분석</i></div>` +
      `<div class="nsc-sec"><h4 class="nsc-st">게시 건수<i>내돈내산 기준</i></h4>` +
      `<div class="nsc-ends"><span class="s">삼성</span><span class="l">LG</span></div>` +
      `<div class="nh-bar"><i class="s" style="width:${sh}%"></i><i class="l" style="width:${100 - sh}%"></i></div>` +
      `<div class="nsc-nums"><span class="s"><b>${fmtN(oS)}건</b>${oS + oL >= 10 ? `<i>(${sh}%)</i>` : ""}</span>` +
      `<span class="l"><b>${fmtN(oL)}건</b>${oS + oL >= 10 ? `<i>(${100 - sh}%)</i>` : ""}</span></div>` +
      `<p class="nsc-foot">체험단·협찬 <b class="warn">${fmtN(spCnt)}건</b>${total >= 10 ? `(${spPct}%)` : ""}은 별도 집계했습니다.${momLine ? " " + momLine : ""}</p>` +
      `</div>` +

      `<div class="nsc-sec"><h4 class="nsc-st">매장 우위·열세<i>매장 특정 글 ${stNames.length}곳</i></h4>` +
      `<div class="nw-pair split">` +
      `<span class="nw-p1"><b>${stWin}</b><i>곳 우위</i></span>` +
      `<span class="nw-p2"><i>곳 열세</i><b class="warn">${stLose}</b></span>` +
      `</div>` +
      (stNames.length - stWin - stLose ? `<span class="nw-sub">그 외 ${stNames.length - stWin - stLose}곳은 동률이거나 브랜드가 특정되지 않았습니다.</span>` : "") +
      `</div>` +

      /* 조회수 — 네이버가 공개하지 않는다. 지어내지 않고 그 사실을 명시한다
         (2026-08-26 사용자: "조회수에 대한 언급도 빠져있고"). */
      `<div class="nsc-sec"><h4 class="nsc-st">조회수</h4>` +
      `<p class="nsc-foot">네이버 블로그는 <b>조회수를 외부에 공개하지 않아</b> 싣지 않습니다 — ` +
      `이 화면의 모든 수치는 <b>게시 건수</b> 기준입니다. 검색 노출이 오래가는 채널 특성상 ` +
      `건수가 곧 검색 점유의 근사치입니다.</p></div>` +
      /* 트렌드 불릿은 좌측이 아니라 우측 진단 첫 섹션으로 — 좌측에 두면
         칼럼이 화면(900px)을 넘겨 하단이 잘렸다(실측). 대비 블록은 게시 건수
         박스와 정보가 겹쳐 걷었다(협찬 포함 수치는 브랜드 반응 단락에 있다). */
      `<p class="jw-note">지역은 제목·요약 기반 <b>추정</b> · 매장은 지점명 기준 · 목록은 최신순 표본(수치는 전량 집계)입니다.</p>` +
      `</div>` +
      // 중앙 — 지도
      `<div class="nb-mapcol"><div id="nbGeoHost" class="nb-geo"></div>` +
      `<div class="ca-geo-legend"><span class="gl s">삼성 우위</span><span class="gl l">LG 우위</span><span class="gl off">미집계</span></div>` +
      `<p class="ca-geonote">지도는 글의 지역 언급 기준(제목·요약 추정)입니다. ` +
      `<b>지역을 누르면</b> 그 지역 백화점 매장별 블로그 현황으로 들어갑니다.</p></div>` +
      // 우측 — 진단
      `<div class="nb-right"><div class="ca-ncard yt-rep nb-rep">` +
      `<h4 class="ca-ch">종합 진단 <i class="ca-tag">${labOf()}</i></h4>` + secs.join("") +
      `</div></div>` +
      `</div></div>`;
  }

  /* 지도 색칠 + 클릭 — cafe(paintGeo)와 같은 코로플레스 문법 */
  function paintMap(host) {
    const wrap = host.querySelector("#nbGeoHost");
    if (!wrap || !window.KOREA_SIDO || !KOREA_SIDO.svg) return;
    wrap.innerHTML = KOREA_SIDO.svg;
    const svg = wrap.querySelector("svg");
    if (!svg) return;
    const RG = aggMap(B.monRegions);
    const ST = aggMap(B.monStores);
    const SR = B.storeRegion || {};
    const hasStores = {};
    Object.keys(ST).forEach((st2) => { const r = SR[st2]; if (r) hasStores[r] = true; });
    svg.querySelectorAll("path[data-region]").forEach((p) => {
      const name = p.getAttribute("data-region"), d = RG[name];
      p.insertAdjacentHTML("afterbegin", `<title>${name}</title>`);
      if (d && d.n > 0) {
        const lead = d.s > d.l ? "s" : d.l > d.s ? "l" : "even";
        p.setAttribute("class", "on " + lead + (hasStores[name] ? " drill" : ""));
        const win = Math.max(pct(d.s, d.l), pct(d.l, d.s));
        const blues = ["#9fc0f0", "#5d92e8", "#1f5fd0"], reds = ["#eda6b6", "#e2607a", "#c81e3c"];
        const scale = lead === "l" ? reds : blues;
        p.style.fill = lead === "even" ? "#9aa7bd" : scale[win >= 65 ? 2 : win >= 55 ? 1 : 0];
      } else {
        p.setAttribute("class", "off");
      }
    });
    // 시도명 라벨
    if (KOREA_SIDO.labels) {
      let names = "";
      Object.keys(KOREA_SIDO.labels).forEach((name) => {
        const q = KOREA_SIDO.labels[name];
        names += `<text class="pv-name${RG[name] ? " on" : ""}" x="${q.x}" y="${q.y + 2}">${name}</text>`;
      });
      svg.insertAdjacentHTML("beforeend", names);
    }
    svg.querySelectorAll("path.drill").forEach((p) => {
      p.addEventListener("click", () => {
        stv.level = "region"; stv.region = p.getAttribute("data-region"); stv.store = null;
        if (window.VNAV) VNAV.push({ id: "blog-rg", label: "블로그 " + stv.region, open: () => { paint(document.getElementById("channelPanel")); } });
        paint(document.getElementById("channelPanel"));
      });
    });
  }

  /* ── 지역 — 매장 목록이 주인공(다결 지역과 같은 원칙) ─────────────── */
  function renderRegion() {
    const rg = stv.region;
    const ST = aggMap(B.monStores);
    const SR = B.storeRegion || {};
    const RG = aggMap(B.monRegions)[rg] || { n: 0, s: 0, l: 0, sp: 0 };
    const list = Object.keys(ST).filter((k) => SR[k] === rg)
      .map((k) => ({ name: k, cnt: ST[k].n, s: ST[k].s, l: ST[k].l, sp: ST[k].sp }))
      .sort((a, b) => b.cnt - a.cnt);
    const max = Math.max(1, ...list.map((x) => x.cnt));
    const rows = list.map((x, i) => {
      const sh = pct(x.s, x.l);
      const lead = x.s > x.l ? "s" : x.l > x.s ? "l" : "even";
      return `<button type="button" class="rv-row ${lead}" data-nbstore="${x.name}"` +
        ` title="${x.name} · ${fmtN(x.cnt)}건 · 삼성 ${x.s} vs LG ${x.l}${x.sp ? " · 협찬 " + x.sp : ""}">` +
        `<span class="rv-rank">${i + 1}</span>` +
        `<span class="rv-name">${x.name}</span>` +
        `<span class="rv-cnt"><i class="s">${fmtN(x.s)}</i><em>:</em><i class="l">${fmtN(x.l)}</i></span>` +
        `<span class="rv-bar"><i class="s" style="width:${(x.s / max * 100).toFixed(1)}%"></i>` +
        `<i class="l" style="width:${(x.l / max * 100).toFixed(1)}%"></i></span>` +
        `<span class="rv-num">${fmtN(x.cnt)}</span>` +
        `<span class="rv-sh ${lead}">${x.s + x.l ? sh + "%" : "-"}</span></button>`;
    }).join("");
    const art = (window.VART && VART.region && VART.region[rg])
      ? `<span class="rv-art" aria-hidden="true">${VART.region[rg]}</span>` : "";
    const spPct = RG.n >= 10 ? Math.round((RG.sp || 0) / RG.n * 100) : null;
    const top = list[0];
    const secs = [];
    secs.push(`<div class="cy-sec"><h5>게시 동향</h5><p class="cy-note">` +
      `<b>${rg}</b>${josa(rg, "은", "는")} 이 기간 지역 언급 글이 <b>${fmtN(RG.n)}건</b>입니다` +
      (RG.n >= 10 ? `(삼성 ${fmtN(RG.s)} : LG ${fmtN(RG.l)})` : RG.n ? ` — 표본이 작아 건수로만 적습니다(삼성 ${RG.s} : LG ${RG.l})` : "") + `. ` +
      (top ? `매장이 특정된 글은 <b>${top.name}</b>${josa(top.name, "이", "가")} ${fmtN(top.cnt)}건으로 가장 많습니다.` :
        `이 기간 매장이 특정된 글이 없습니다 — 구매 고객 블로그 후기 요청부터가 과제입니다.`) + `</p></div>`);
    /* 매장 간 격차·표본 집중도 — 다결 지역 카드에서 자리 잡은 시각.
       분기마다 문장이 달라야 한다(승패가 바뀌어도 같으면 인사이트가 아니다). */
    (function () {
      const sized = list.filter((x) => x.s + x.l >= 5)
        .map((x) => ({ name: x.name, sh2: pct(x.s, x.l), tot: x.s + x.l }))
        .sort((a, b) => b.sh2 - a.sh2);
      if (sized.length >= 2) {
        const hi = sized[0], lo = sized[sized.length - 1];
        const spread = hi.sh2 - lo.sh2;
        secs.push(`<div class="cy-sec"><h5>매장 간 격차</h5><p class="cy-note">` +
          (spread < 25
            ? `브랜드 표본 5건 이상 ${sized.length}곳이 <b>${spread}p</b> 안에 모여 있습니다 — 특정 매장이 아니라 도시 공통의 흐름이 블로그 지형을 만들고 있습니다.`
            : lo.sh2 >= 50
            ? `가장 낮은 <b>${lo.name}</b>(삼성 ${lo.sh2}%)도 우위여서 ${spread}p 는 우위 안의 편차입니다 — 격차를 굳히려면 표본이 얇은 매장의 후기 요청부터입니다.`
            : `표본 5건 이상 매장 기준으로 <b>${hi.name}</b>(${hi.sh2}%)${josa(hi.name, "과", "와")} <b class="warn">${lo.name}</b>(${lo.sh2}%) 사이가 <b>${spread}p</b> 벌어져 있습니다 — 같은 도시에서 검색 첫 화면의 주인이 매장마다 다릅니다.`) +
          `</p></div>`);
      }
      const totAll = list.reduce((a, x) => a + x.cnt, 0) || 1;
      if (list[0]) {
        const headShare = Math.round(list[0].cnt / totAll * 100);
        secs.push(`<div class="cy-sec"><h5>표본 집중도</h5><p class="cy-note">` +
          (headShare >= 50
            ? `매장 특정 글의 <b>${headShare}%</b>가 <b>${list[0].name}</b> 한 곳에서 나옵니다 — 이 매장의 글이 곧 ${rg} 블로그 검색의 첫인상입니다. 나머지 매장은 글 자체가 적어 검색에 보이지 않습니다.`
            : headShare >= 30
            ? `<b>${list[0].name}</b>${josa(list[0].name, "이", "가")} ${headShare}%를 차지합니다 — 이 매장의 게시 흐름이 도시 지표를 좌우합니다.`
            : `여러 매장에 고르게 퍼져 있습니다(1위 비중 ${headShare}%) — 도시 수치를 매장 전체의 흐름으로 읽어도 되는 상태입니다.`) +
          `</p></div>`);
      }
    })();
    secs.push(rolePlan(
      `지역 언급 대비 매장 특정 글이 ${list.length ? "적은 편" : "없는 수준"}입니다 — <b>매장명이 들어간 후기 캠페인</b>이 검색 노출을 만듭니다.`,
      top ? `<b>${top.name}</b>의 글을 지역 교육 사례로 공유하고, 목록 하위 매장에는 <b>후기 요청 실행 여부</b>를 점검하세요.`
        : `매장 방문 시 <b>블로그 후기 요청</b> 실행 여부를 점검하세요.`,
      `계약 고객에게 <b>매장명·담당자 실명이 든 블로그 후기</b>를 요청하세요.`));

    return `<div class="ca2 yt-wrap nb-wrap">` + head() +
      `<div class="ca-rv nb-rv">` +
      `<div class="rv-left">` +
      `<div class="rv-head">${art}<h3>${rg}</h3><span>블로그 매장별 · ${labOf()}</span></div>` +
      `<div class="nsc-total"><b>${fmtN(RG.n)}</b><i>건 지역 언급</i></div>` +
      `<div class="nsc-sec"><h4 class="nsc-st">게시 건수<i>지역 언급 기준</i></h4>` +
      `<div class="nsc-ends"><span class="s">삼성</span><span class="l">LG</span></div>` +
      `<div class="nh-bar"><i class="s" style="width:${pct(RG.s, RG.l)}%"></i><i class="l" style="width:${100 - pct(RG.s, RG.l)}%"></i></div>` +
      `<div class="nsc-nums"><span class="s"><b>${fmtN(RG.s)}건</b></span><span class="l"><b>${fmtN(RG.l)}건</b></span></div></div>` +
      (spPct !== null ? `<p class="nsc-foot">체험단·협찬 표기 ${fmtN(RG.sp)}건(${spPct}%)입니다.</p>` : "") +
      `<p class="jw-note">지역 언급은 제목·요약 기반 추정입니다. 매장 목록은 지점명이 적힌 글 기준입니다.</p>` +
      `</div>` +
      `<div class="rv-right">` +
      `<div class="rv-rhead"><h4>매장별 블로그 언급 <em>${list.length}곳</em></h4>` +
      `<span class="rv-leg"><i class="s"></i>삼성<i class="l"></i>LG · 클릭 시 매장 글</span></div>` +
      (list.length ? `<div class="rv-list${list.length > 12 ? " two" : ""}">${rows}</div>`
        : `<p class="ca-splx">이 기간 ${rg}에서 매장이 특정된 블로그 글이 없습니다.</p>`) +
      `</div>` +
      `<div class="rv-third"><div class="ca-ncard yt-rep nb-rep">` +
      `<h4 class="ca-ch">${rg} 블로그 진단 <i class="ca-tag">${labOf()}</i></h4>` + secs.join("") +
      `</div></div>` +
      `</div></div>`;
  }

  /* ── 매장 — 그 매장의 블로그 글 상세 ─────────────────────────────── */
  function renderStore() {
    const st2 = stv.store;
    const V = aggMap(B.monStores)[st2] || { n: 0, s: 0, l: 0, sp: 0 };
    const all = (B.storePosts || {})[st2] || [];
    const inP = all.filter((x) => inRangeYm((x.d || "").slice(0, 7)));
    const use = inP.length ? inP : all;
    const note = inP.length ? ""
      : `<p class="ca-splx">이 기간에 수집된 글 표본이 없어 <b>가장 최근 글</b>을 보여줍니다(작성일 표기).</p>`;
    const own = use.filter((x) => !x.sp), spn = use.filter((x) => x.sp);
    const ck = /^갤/.test(st2) ? "갤러리아" : /^AK/i.test(st2) ? "AK" : /^대백/.test(st2) ? "대백"
      : /^신세계/.test(st2) ? "신세계" : /^(현대|더현대)/.test(st2) ? "현대" : /^롯데/.test(st2) ? "롯데" : null;
    const art = (ck && window.VART && VART.chain && VART.chain[ck])
      ? `<span class="rv-art" aria-hidden="true">${VART.chain[ck]}</span>` : "";
    const lead = V.s > V.l ? "s" : V.l > V.s ? "l" : "even";
    const secs = [];
    secs.push(`<div class="cy-sec"><h5>게시 동향</h5><p class="cy-note">` +
      `이 기간 <b>${st2}</b>${josa(st2, "이", "가")} 적힌 글은 <b>${fmtN(V.n)}건</b>` +
      (V.s + V.l ? `(삼성 ${fmtN(V.s)} : LG ${fmtN(V.l)})` : "") +
      (V.sp ? ` · 체험단 표기 <b class="warn">${fmtN(V.sp)}건</b>` : "") + `입니다. ` +
      `블로그 글은 검색 노출이 오래 지속되므로, 이 매장 이름의 검색 결과가 곧 상시 홍보 지면입니다.</p></div>`);
    /* 실명 언급 — 블로그 글에 적힌 담당자 이름(다결 후기 스타와 같은 잣대).
       블로그는 검색에 오래 남으므로 실명 글은 그 담당자의 상시 간판이 된다. */
    (function () {
      const M2 = (B.storeMgr || {})[st2];
      if (!M2 || !(M2.s + M2.l)) {
        secs.push(`<div class="cy-sec"><h5>실명 언급</h5><p class="cy-note">` +
          `이 매장 글에는 담당자 실명이 적힌 것이 없습니다. 블로그 후기는 검색에 오래 남아 ` +
          `실명이 곧 지명 방문을 만듭니다 — 후기 요청 때 담당자 이름이 함께 적히도록 부탁하는 것부터가 과제입니다.</p></div>`);
        return;
      }
      const lead2 = M2.s > M2.l ? "s" : M2.l > M2.s ? "l" : "even";
      const star = (M2.names || [])[0];
      secs.push(`<div class="cy-sec"><h5>실명 언급</h5><p class="cy-note">` +
        `담당자 실명이 적힌 글은 삼성 <b>${fmtN(M2.s)}건</b> 대 LG <b class="warn">${fmtN(M2.l)}건</b>입니다. ` +
        (lead2 === "l"
          ? `검색에서 이 매장을 찾은 고객은 <b class="warn">상대 담당자의 이름</b>을 먼저 만나는 구조입니다 — 우리 계약 고객의 실명 후기가 시급합니다.`
          : lead2 === "s"
          ? `검색 첫 화면에 우리 담당자의 이름이 남아 있습니다 — 이 우위는 실명 후기 요청이 이어질 때만 유지됩니다.`
          : `양쪽이 같은 수준입니다 — 실명 후기 한 건이 균형을 가릅니다.`) +
        (star ? ` 삼성 쪽 최다 실명은 <b>${star.n}</b>(${fmtN(star.c)}건)입니다.` : "") + `</p></div>`);
    })();
    /* 우호·주의 — 긍부정 신호(다결 NEG 잣대 재사용). 주의 글은 원문 목록에 빨간 배지 */
    (function () {
      const NG = (B.storeNeg || {})[st2];
      if (!NG || !NG.n) return;
      secs.push(`<div class="cy-sec"><h5>우호·주의 신호</h5><p class="cy-note">` +
        (NG.neg
          ? `이 매장 글 ${fmtN(NG.n)}건 중 <b class="warn">${fmtN(NG.neg)}건</b>에서 불만·아쉬움 표현이 잡혔습니다` +
            (use.some((x) => x.ng) ? `(목록의 <b class="warn">주의</b> 배지)` : `(전량 집계 기준 — 최신 표본 목록에는 없습니다)`) + `. ` +
            `블로그의 부정 글은 검색에 오래 남아 상담 전 인상을 만듭니다 — 원문을 열어 어떤 대목(배송·상담·혜택)인지 확인하고, 같은 불만이 반복되지 않게 현장에서 짚어 두세요.`
          : `이 매장 글 ${fmtN(NG.n)}건에서는 불만·아쉬움 표현이 검출되지 않았습니다. 졸업 후기 특성상 긍정 편향이 있으므로 '문제 없음'의 증명은 아니지만, 검색 첫인상은 우호적으로 유지되고 있습니다.`) +
        `</p></div>`);
    })();
    /* 검색 신선도 — 블로그 채널 고유의 축. 최근 글이 끊기면 검색 첫 화면이 낡는다. */
    (function () {
      const all2 = (B.months || []).slice(-3);      // 데이터 기준 최근 3개월
      const rec = all2.reduce((a, m) => a + ((((B.monStores || {})[m] || {})[st2] || {}).n || 0), 0);
      const last = (B.storePosts && B.storePosts[st2] && B.storePosts[st2][0]) ? B.storePosts[st2][0].d : "";
      secs.push(`<div class="cy-sec"><h5>검색 신선도</h5><p class="cy-note">` +
        (rec >= 3
          ? `최근 3개월에 <b>${fmtN(rec)}건</b>이 새로 올라왔습니다 — 검색 결과가 살아 있는 매장입니다. 이 흐름이 끊기지 않도록 후기 요청을 이어가세요.`
          : rec > 0
          ? `최근 3개월 새 글이 <b>${fmtN(rec)}건</b>뿐입니다 — 검색 첫 화면이 낡아가기 시작하는 신호입니다. 이번 달 계약 고객에게 후기 요청을 걸어 두세요.`
          : `최근 3개월 <b class="warn">새 글이 없습니다</b>${last ? `(마지막 글 ${last})` : ""} — 이 매장 이름을 검색한 고객은 낡은 정보만 봅니다. 후기 요청 재가동이 급합니다.`) +
        `</p></div>`);
    })();
    secs.push(rolePlan(
      V.sp > (V.n - V.sp)
        ? `이 매장 글은 <b class="warn">체험단·협찬 게시물이 절반을 넘습니다</b> — 내돈내산 후기가 쌓이도록 캠페인 설계가 필요합니다.`
        : `이 매장의 글 흐름을 유지하려면 <b>후기 콘텐츠 가이드</b>(사진·혜택 정리 팁) 지원이 유효합니다.`,
      `이 매장 상위 글을 열어 고객이 계약을 결심한 문장(혜택·상담)을 <b>교육 자료</b>로 공유하세요.`,
      `계약 고객 중 블로그 운영 고객에게 <b>매장명·담당자 실명이 든 후기</b>를 요청하세요.`));

    return `<div class="ca2 yt-wrap nb-wrap">` + head() +
      `<div class="ca-rv nb-rv nb-store">` +
      `<div class="rv-left">` +
      `<div class="rv-head">${art}<h3>${st2}</h3><span>${stv.region || ""} · 블로그 · ${labOf()}</span></div>` +
      `<div class="nsc-total"><b>${fmtN(V.n)}</b><i>건 언급</i></div>` +
      `<div class="nsc-sec"><h4 class="nsc-st">게시 건수</h4>` +
      `<div class="nsc-ends"><span class="s">삼성</span><span class="l">LG</span></div>` +
      `<div class="nh-bar"><i class="s" style="width:${V.s + V.l ? pct(V.s, V.l) : 50}%"></i>` +
      `<i class="l" style="width:${V.s + V.l ? 100 - pct(V.s, V.l) : 50}%"></i></div>` +
      `<div class="nsc-nums"><span class="s"><b>${fmtN(V.s)}건</b></span><span class="l"><b>${fmtN(V.l)}건</b></span></div></div>` +
      (V.sp ? `<p class="nsc-foot">체험단·협찬 표기 <b class="warn">${fmtN(V.sp)}건</b>이 포함돼 있습니다.</p>` : "") +
      `<p class="jw-note">글 목록은 매장별 최신 12건 표본입니다(수치는 전량 집계).</p>` +
      `</div>` +
      `<div class="rv-right nb-posts">` +
      `<div class="rv-rhead"><h4>이 매장 블로그 글 <em>클릭 → 원문</em></h4></div>` + note +
      `<div class="sv-revcols">` +
      `<div><h6 class="pos">내돈내산 ${own.length}</h6>${own.map((x, i) =>
        `<a href="${x.u}" target="_blank" rel="noopener"><span class="ca-sm-tag ${x.b || "b"}">${x.b === "s" ? "삼성" : x.b === "l" ? "LG" : "기타"}</span>` +
        `<span class="ca-sm-t">${x.t}</span>` +
        (x.ng ? `<span class="ca-sm-d ng">주의</span>` : "") +
        `<span class="ca-sm-d">${(x.d || "").slice(2, 7)}</span></a>`).join("") || '<p class="ca-splx">없음</p>'}</div>` +
      `<div><h6 class="neg">체험단·협찬 ${spn.length}</h6>${spn.map((x) =>
        `<a href="${x.u}" target="_blank" rel="noopener"><span class="ca-sm-tag ${x.b || "b"}">${x.b === "s" ? "삼성" : x.b === "l" ? "LG" : "기타"}</span>` +
        `<span class="ca-sm-t">${x.t}</span>` +
        (x.ng ? `<span class="ca-sm-d ng">주의</span>` : "") +
        `<span class="ca-sm-d">${(x.d || "").slice(2, 7)}</span></a>`).join("") || '<p class="ca-splx">표기 글 없음</p>'}</div>` +
      `</div></div>` +
      `<div class="rv-third"><div class="ca-ncard yt-rep nb-rep">` +
      `<h4 class="ca-ch">매장 블로그 진단 <i class="ca-tag">${labOf()}</i></h4>` + secs.join("") +
      `</div></div>` +
      `</div></div>`;
  }

  function render() {
    if (stv.level === "store" && stv.store) return renderStore();
    if (stv.level === "region" && stv.region) return renderRegion();
    return renderNation();
  }

  function paint(host) {
    if (!host || !B) return;
    host.innerHTML = render();
    if (stv.level === "nation") paintMap(host);
    if (window.VNAV) VNAV.sync();
    if (window.VFIT) VFIT.all();
    if (per()) per().bind(host);
    /* 드릴 클릭 — 이 화면 안에서만 위임(공유 컨테이너 가드 원칙: 자기 래퍼에 단다) */
    const wrap = host.querySelector(".nb-wrap");
    if (wrap && !wrap.dataset.nbBound) {
      wrap.dataset.nbBound = "1";
      wrap.addEventListener("click", (e) => {
        const go = e.target.closest("[data-nbgo]");
        if (go) {
          const to = go.getAttribute("data-nbgo");
          if (to === "nation") { stv.level = "nation"; stv.region = null; stv.store = null; }
          else if (to === "region") { stv.level = "region"; stv.store = null; }
          paint(host); return;
        }
        const sb = e.target.closest("[data-nbstore]");
        if (sb) {
          stv.level = "store"; stv.store = sb.getAttribute("data-nbstore");
          if (window.VNAV) VNAV.push({ id: "blog-st", label: "블로그 " + stv.store, open: () => paint(host) });
          paint(host);
        }
      });
    }
  }

  window.openBlog = function () {
    const host = document.getElementById("channelPanel");
    const sec = document.getElementById("channel");
    if (!host || !sec || !B) return;
    stv.level = "nation"; stv.region = null; stv.store = null;
    if (window.VNAV) VNAV.push({ id: "blog", label: "네이버 블로그", open: () => window.openBlog() });
    paint(host);
    sec.hidden = false;
    window.setView ? setView("view-channel", "view-cx")
      : document.body.classList.add("mode-results", "view-channel", "view-cx");
    window.scrollTo({ top: 0, behavior: "auto" });
  };
})();
