/* 제휴카페(부울경 14곳) 채널 화면 — window.openAffiliateAds

   기존 `affiliate-view.js`(카페 1곳 · 8축)와 보는 각도가 다르다.
   이 화면이 묻는 것은 하나다 — **이 게시판에서 누가 말하고 있는가.**

     ① 당사 광고·홍보     삼성스토어 명의로 올라간 행사·특가 글
     ② 경쟁사 광고·홍보   하이마트·전자랜드·LG베스트샵 명의
     ③ 고객 글(유통 언급) 어디서 샀나·어디가 싼가 — 미결정 고객이 드러나는 순간
     ④ 고객 글(일반)      상호가 등장하지 않는 생활 속 가전 이야기

   양식은 다이렉트웨딩·네이버블로그와 같다(좌 요약 / 중 목록 / 우 진단·실행 제안).
   수치는 월별 사전집계(AFFAD.mon*)를 기간으로 합산해 만든다 —
   기간 탭을 바꾸면 좌·중·우의 모든 수치와 문장이 함께 바뀐다. */
(function () {
  "use strict";
  const A = window.AFFAD || null;
  const fmtN = (n) => (n || 0).toLocaleString("ko-KR");
  const pct = (a, b) => (a + b === 0 ? 0 : Math.round((a / (a + b)) * 100));
  const josa = (w, a, b) => {
    const s = String(w || ""), c = s.charCodeAt(s.length - 1);
    if (!(c >= 0xac00 && c <= 0xd7a3)) return b;
    return (c - 0xac00) % 28 ? a : b;
  };
  /* 표본이 10건 미만이면 퍼센트를 쓰지 않는다(하네스 공통 원칙) */
  const shr = (a, b) => (a + b >= 10 ? `(${pct(a, b)}%)` : "");

  const CLS = ["ad_own", "ad_comp", "cust_own", "cust_ret", "plain"];
  const CLS_T = {
    ad_own: "당사 광고·홍보", ad_comp: "경쟁사 광고·홍보",
    cust_own: "고객 글 · 당사 언급", cust_ret: "고객 글 · 타 유통 언급",
    plain: "고객 글 · 일반",
  };

  let PER = null;
  function per() {
    if (PER || !window.VPER || !A) return PER;
    PER = VPER.create({
      months: A.months || [],
      onChange: () => paint(document.getElementById("channelPanel")),
    });
    return PER;
  }
  const labOf = () => (per() ? per().label() : "전체");

  function monthsInRange() {
    const p = per();
    if (!p) return (A.months || []).slice();
    const r = p.range(), a = r[0].slice(0, 7), b = r[1].slice(0, 7);
    return (A.months || []).filter((m) => m >= a && m <= b);
  }

  /* ── 기간 합산 ─────────────────────────────────────────────── */
  function sums() {
    const o = { n: 0 };
    CLS.forEach((k) => { o[k] = 0; });
    monthsInRange().forEach((m) => {
      const v = (A.mon || {})[m];
      if (!v) return;
      o.n += v.n || 0;
      CLS.forEach((k) => { o[k] += v[k] || 0; });
    });
    o.ad = o.ad_own + o.ad_comp;
    o.cust = o.cust_own + o.cust_ret + o.plain;
    o.custRet = o.cust_own + o.cust_ret;      // 유통을 입에 올린 고객 글
    return o;
  }
  /* 상호별 — {상호: {ad, cust}} */
  function retSums() {
    const out = {};
    monthsInRange().forEach((m) => {
      const v = (A.monRet || {})[m] || {};
      Object.keys(v).forEach((k) => {
        const o = out[k] || (out[k] = { ad: 0, cust: 0 });
        o.ad += v[k].ad || 0; o.cust += v[k].cust || 0;
      });
    });
    return out;
  }
  function mapSums(SRC, keys) {
    const out = {};
    monthsInRange().forEach((m) => {
      const v = (SRC || {})[m] || {};
      Object.keys(v).forEach((k) => {
        const o = out[k] || (out[k] = keys.reduce((a, f) => (a[f] = 0, a), {}));
        keys.forEach((f) => { o[f] += v[k][f] || 0; });
      });
    });
    return out;
  }
  function postsIn() {
    const out = {};
    CLS.forEach((k) => { out[k] = []; });
    monthsInRange().forEach((m) => {
      const v = (A.monPosts || {})[m] || {};
      CLS.forEach((k) => { (v[k] || []).forEach((x) => out[k].push(x)); });
    });
    CLS.forEach((k) => out[k].sort((a, b) => (b.d || "").localeCompare(a.d || "")));
    return out;
  }
  /* 직전 같은 길이 구간 — 비교가 성립하지 않으면 null(±0 원칙대로 삼지선다) */
  function prev(field) {
    const ms = monthsInRange();
    if (!ms.length) return null;
    const all = A.months || [], i0 = all.indexOf(ms[0]);
    if (i0 < ms.length) return null;
    return all.slice(i0 - ms.length, i0)
      .reduce((a, m) => a + (((A.mon || {})[m] || {})[field] || 0), 0);
  }

  const cafeName = (slug) => ((A.cafeMeta || {})[slug] || {}).name || slug;

  /* ── 조각 ─────────────────────────────────────────────────── */
  const rolePlan = (hq, team, store) =>
    `<div class="cy-sec"><h5>실행 제안 <i>역할별</i></h5><ul class="role-plan">` +
    `<li class="rp-hq"><em>본사</em><span>${hq}</span></li>` +
    `<li class="rp-team"><em>영업팀</em><span>${team}</span></li>` +
    `<li class="rp-store"><em>매장</em><span>${store}</span></li>` +
    `</ul></div>`;

  const head = () =>
    `<div class="cx-top">` +
    `<div class="cx-title"><h2>제휴카페 — 부울경</h2>` +
    `<span>지역 생활 커뮤니티 ${A.cafes}곳 · 가전 글 ${fmtN(A.total)}건 · 광고와 고객 글을 갈라 봅니다</span></div>` +
    `${per() ? per().bar() : ""}</div>`;

  function bar2(aVal, bVal, aLab, bLab) {
    const p = pct(aVal, bVal);
    return `<div class="nsc-ends"><span class="s">${aLab}</span><span class="l">${bLab}</span></div>` +
      `<div class="nh-bar"><i class="s" style="width:${p}%"></i><i class="l" style="width:${100 - p}%"></i></div>` +
      `<div class="nsc-nums"><span class="s"><b>${fmtN(aVal)}건</b><i>${shr(aVal, bVal)}</i></span>` +
      `<span class="l"><b>${fmtN(bVal)}건</b><i>${shr(bVal, aVal)}</i></span></div>`;
  }

  /* 제목 옆 숫자는 **전량 집계**를 쓴다. 표본 목록 길이(6)를 그대로 적었더니
     좌측 전량(17)과 어긋나 보였다(2026-08-27 검수 지적). 목록은 표본임을 따로 밝힌다. */
  function postCol(k, list, total) {
    const rows = list.slice(0, 7).map((x) =>
      `<a href="${x.u}" target="_blank" rel="noopener" title="${x.t}">` +
      `<span class="ca-sm-tag ${k === "ad_own" || k === "cust_own" ? "s" : k === "plain" ? "b" : "l"}">${x.s || "일반"}</span>` +
      `<span class="ca-sm-t">${x.t}</span>` +
      `<span class="ca-sm-d">${(x.d || "").slice(2, 7)}</span></a>`).join("");
    return `<div class="afa-col"><h6 class="${k === "ad_own" || k === "cust_own" ? "pos" : k === "plain" ? "" : "neg"}">` +
      `${CLS_T[k]} <b>${fmtN(total == null ? list.length : total)}</b>` +
      (total != null && list.length < total ? `<i class="afa-smp">표본 ${fmtN(list.length)}건</i>` : "") + `</h6>` +
      (rows || `<p class="ca-splx">이 기간에는 없습니다</p>`) + `</div>`;
  }

  /* ── 화면 ─────────────────────────────────────────────────── */
  function render() {
    const S = sums();
    const R = retSums();
    const IT = mapSums(A.monItems, ["n", "ad", "cust"]);
    const CF = mapSums(A.monCafe, CLS.concat(["n"]));
    const P = postsIn();
    const L = labOf();

    const adShare = pct(S.ad, S.cust);
    const comp = (A.rets || []).filter((k) => k !== A.ours)
      .map((k) => ({ k, ad: (R[k] || {}).ad || 0, cust: (R[k] || {}).cust || 0 }))
      .filter((x) => x.ad + x.cust > 0).sort((a, b) => b.ad - a.ad);
    const topAd = comp.filter((x) => x.ad > 0);
    const custRank = comp.slice().sort((a, b) => b.cust - a.cust).filter((x) => x.cust > 0);
    const ourCust = (R[A.ours] || {}).cust || 0;
    const items = Object.keys(IT).sort((a, b) => IT[b].n - IT[a].n);
    const cafeList = Object.keys(CF).sort((a, b) => CF[b].ad_comp - CF[a].ad_comp);
    const zeroCafes = cafeList.filter((s) => CF[s].ad_own === 0 && CF[s].n > 0);
    const hotCafe = cafeList[0];

    /* ── 좌측 요약 ── */
    const pv = prev("ad_own");
    /* 양쪽 모두 0이면 "같은 수준"이라고 말할 것도 없다 — 문장을 만들지 않는다 */
    const momLine = (pv === null || (pv === 0 && S.ad_own === 0)) ? ""
      : (S.ad_own === pv ? `직전 같은 길이 구간과 <b>같은 수준</b>입니다.`
        : S.ad_own > pv ? `직전 구간(${fmtN(pv)}건)보다 <b>${fmtN(S.ad_own - pv)}건 늘었습니다</b>.`
          : `직전 구간(${fmtN(pv)}건)보다 <b class="warn">${fmtN(pv - S.ad_own)}건 줄었습니다</b>.`);

    const bullets = [];
    if (S.n) {
      bullets.push(S.ad
        ? `가게가 올린 글이 <b class="warn">${fmtN(S.ad)}건</b>${shr(S.ad, S.cust)} — 이 게시판에서 눈에 띄는 가전 이야기의 상당수가 판촉물입니다.`
        : `이 기간에는 가게 명의의 판촉 글이 잡히지 않았습니다 — 고객 글만 남았습니다.`);
    }
    if (topAd.length) {
      bullets.push(`광고를 가장 많이 올린 곳은 <b class="warn">${topAd[0].k}</b>(${fmtN(topAd[0].ad)}건)이고, ` +
        (S.ad_own ? `당사는 ${fmtN(S.ad_own)}건입니다.` : `<b class="warn">당사는 0건</b>입니다.`));
    }
    if (S.custRet) {
      bullets.push(`유통 상호를 입에 올린 고객 글이 <b>${fmtN(S.custRet)}건</b> — 그중 당사를 부른 글은 ` +
        (S.cust_own ? `<b>${fmtN(S.cust_own)}건</b>입니다.` : `<b class="warn">없습니다</b>.`));
    }
    if (items.length) {
      bullets.push(`이야기된 품목은 <b>${items.slice(0, 3).join(" · ")}</b> 순입니다.`);
    }

    const left =
      `<div class="cx-sum afa-left">` +
      `<div class="rv-head"><h3>부울경 제휴카페</h3><span>${A.cafes}곳 · ${L}</span></div>` +
      `<div class="nsc-total"><b>${fmtN(S.n)}</b><i>건 분석</i></div>` +

      `<div class="nsc-sec"><h4 class="nsc-st">글의 주체<i>광고 vs 고객</i></h4>` +
      bar2(S.cust, S.ad, "고객 글", "광고·홍보") +
      `<p class="nsc-foot">고객 글 가운데 유통 상호가 나온 글은 <b>${fmtN(S.custRet)}건</b>입니다.</p></div>` +

      `<div class="nsc-sec"><h4 class="nsc-st">광고 노출<i>당사 vs 경쟁사</i></h4>` +
      bar2(S.ad_own, S.ad_comp, "당사", "경쟁사") +
      `<p class="nsc-foot">${S.ad_own === 0
        ? `이 기간 <b class="warn">당사 명의 홍보글은 0건</b>입니다.`
        : `당사 홍보글 <b>${fmtN(S.ad_own)}건</b>.`}${momLine ? " " + momLine : ""}</p></div>` +

      `<div class="nsc-sec"><h4 class="nsc-st">고객이 부른 이름<i>유통 언급 고객 글</i></h4>` +
      bar2(S.cust_own, S.cust_ret, "당사 언급", "타 유통 언급") +
      `<p class="nsc-foot">${S.custRet >= 10
        ? `고객이 유통을 말할 때 당사가 불릴 확률은 <b>${pct(S.cust_own, S.cust_ret)}%</b>입니다.`
        : `표본이 <b>${fmtN(S.custRet)}건</b>이라 비율 대신 건수로만 읽습니다.`}</p></div>` +

      (bullets.length ? `<div class="nsc-sec"><h4 class="nsc-st">요약</h4>` +
        `<ul class="yt-trend afa-bul">${bullets.map((b) => `<li>${b}</li>`).join("")}</ul></div>` : "") +

      `<p class="jw-note">가전 검색어로 걸러낸 글만 셉니다(게시판 전체가 아닙니다). ` +
      `수집 레코드에 작성자·본문이 없어 <b>제목 문면으로 판정한 추정치</b>입니다.</p>` +
      `</div>`;

    /* ── 중앙: 분류별 글 목록 ── */
    const mid = `<div class="afa-mid">` +
      `<div class="rv-rhead"><h4>분류별 글 <em>클릭 → 원문</em></h4></div>` +
      `<div class="afa-cols">` + CLS.map((k) => postCol(k, P[k], S[k])).join("") + `</div>` +
      `<p class="jw-note">목록은 월별 표본입니다 — 좌측·우측 수치는 전량 집계입니다.</p></div>`;

    /* ── 우측: 총론 → 각론 → 실행 제안 ── */
    const secs = [];

    // 총론
    secs.push(`<div class="cy-sec"><h5>총론</h5><p class="cy-note">` +
      `${L} 기준 부울경 제휴카페 ${A.cafes}곳에서 가전 이야기로 걸러진 글은 <b>${fmtN(S.n)}건</b>입니다. ` +
      (S.n === 0 ? `이 기간에는 표본이 없어 아래 진단은 성립하지 않습니다 — 기간을 넓혀 주세요.`
        : `이 가운데 가게가 올린 광고·홍보가 <b class="warn">${fmtN(S.ad)}건</b>${shr(S.ad, S.cust)}, ` +
          `주민이 쓴 글이 <b>${fmtN(S.cust)}건</b>입니다. ` +
          (adShare >= 30
            ? `제휴카페를 "고객 목소리가 모인 곳"으로만 보면 실상을 놓칩니다 — 가전 글 세 건 중 한 건 가까이가 판촉물이고, 그 판촉물의 주인이 누구인지가 이 채널의 진짜 승부처입니다.`
            : `판촉물보다 생활 글이 훨씬 많은 게시판입니다 — 광고로 밀어붙이기보다 고객이 묻는 순간에 답이 붙어 있는지가 중요합니다.`)) +
      `</p>` +
      (S.n ? `<p class="cy-note">` +
        (S.ad_own === 0
          ? `광고 지면만 놓고 보면 <b class="warn">당사 명의 글은 이 기간 한 건도 없습니다</b>. ` +
            (S.ad_comp ? `같은 기간 경쟁 유통은 <b class="warn">${fmtN(S.ad_comp)}건</b>을 올렸습니다 — ` +
              `우리가 비워 둔 지면을 상대가 그대로 쓰고 있다는 뜻입니다.` : `다만 경쟁사도 조용해 지면 자체가 비어 있는 기간입니다.`)
          : S.ad_own >= S.ad_comp
            ? `광고 지면에서는 당사가 <b>${fmtN(S.ad_own)}건</b>으로 경쟁 유통 합계 ${fmtN(S.ad_comp)}건${josa("건", "을", "를")} 앞섭니다. ` +
              `제휴 원고가 실제로 게시판에 도달하고 있다는 신호이므로, 어떤 형식의 글이 살아남았는지 확인해 같은 형식을 다른 카페로 옮길 수 있습니다.`
            : `광고 지면은 당사 <b>${fmtN(S.ad_own)}건</b> 대 경쟁 유통 <b class="warn">${fmtN(S.ad_comp)}건</b>으로, ` +
              `상대가 <b class="warn">${(S.ad_comp / Math.max(1, S.ad_own)).toFixed(1)}배</b> 더 많이 노출됩니다. ` +
              `게시 횟수 자체가 지역 인지도의 원재료라, 이 격차는 상담 전에 이미 벌어지는 차이입니다.`) +
        `</p>` : "") + `</div>`);

    // 각론 ① 광고 지면
    if (topAd.length) {
      secs.push(`<div class="cy-sec"><h5>① 광고 지면을 누가 쓰고 있나</h5><p class="cy-note">` +
        `광고·홍보 글의 주체는 <b class="warn">${topAd.slice(0, 3).map((x) => `${x.k} ${fmtN(x.ad)}건`).join(" · ")}</b> 순입니다. ` +
        `상호를 기준으로 갈랐기 때문에, 하이마트가 올린 "LG 노트북 초특가" 같은 글은 LG가 아니라 하이마트의 활동으로 셉니다. ` +
        (S.ad_own
          ? `당사는 ${fmtN(S.ad_own)}건으로 ${topAd[0].k} 대비 ${(topAd[0].ad / Math.max(1, S.ad_own)).toFixed(1)}배 적습니다. ` +
            `지면 수가 아니라 형식이 관건입니다 — 살아남은 당사 글은 대부분 매장 오픈·입주 박람회처럼 <b>날짜와 장소가 있는 사건</b>이었습니다.`
          : `당사 글이 없는 기간이므로, 이 지면은 사실상 경쟁 유통의 전단지로 쓰이고 있습니다.`) +
        `</p></div>`);
    }

    // 각론 ② 고객이 부르는 이름
    secs.push(`<div class="cy-sec"><h5>② 고객이 먼저 부르는 유통</h5><p class="cy-note">` +
      (S.custRet === 0
        ? `이 기간에는 유통 상호를 언급한 고객 글이 없습니다. 생활 글은 있지만 구매처 이야기로는 이어지지 않은 구간입니다.`
        : `유통을 입에 올린 고객 글 <b>${fmtN(S.custRet)}건</b> 가운데 당사를 부른 글은 <b>${fmtN(S.cust_own)}건</b>, ` +
          `다른 유통을 부른 글은 <b class="warn">${fmtN(S.cust_ret)}건</b>입니다. ` +
          (custRank.length ? `고객이 가장 자주 부른 상대는 <b class="warn">${custRank.slice(0, 3).map((x) => `${x.k} ${fmtN(x.cust)}건`).join(" · ")}</b>입니다. ` : ``) +
          (S.cust_own > S.cust_ret
            ? `당사가 더 자주 불린 구간입니다 — 이 글들에는 매장·담당자 이름이 함께 적혀 있는 경우가 많아, 그대로 다음 고객의 판단 근거가 됩니다.`
            : S.cust_own === S.cust_ret
              ? `당사와 다른 유통이 <b>같은 횟수</b>로 불린 구간입니다 — 어느 쪽으로도 기울지 않은 상태라, 이 시기의 응대가 다음 언급을 가릅니다.`
              : `광고가 아니라 <b>고객의 입</b>에서 상대 이름이 먼저 나온다는 뜻이며, 이는 게시 횟수보다 뒤집기 어려운 격차입니다.`)) +
      `</p>` +
      (ourCust ? `<p class="cy-note">당사를 언급한 고객 글 ${fmtN(ourCust)}건 중에는 담당자를 실명·호칭으로 부른 글이 섞여 있습니다. ` +
        `실명이 적힌 글은 상담 경험이 좋았다는 뜻이므로, 그 매장의 응대 방식을 지역 공유 자료로 쓸 수 있습니다.</p>` : "") +
      `</div>`);

    // 각론 ③ 카페별 편차
    if (hotCafe) {
      secs.push(`<div class="cy-sec"><h5>③ 카페별 편차</h5><p class="cy-note">` +
        `경쟁 유통의 광고가 가장 많이 걸린 곳은 <b class="warn">${cafeName(hotCafe)}</b>(${fmtN(CF[hotCafe].ad_comp)}건)입니다. ` +
        (zeroCafes.length === cafeList.length
          ? `그리고 표본이 있는 <b class="warn">${cafeList.length}곳 전부</b>에 당사 홍보글이 이 기간 한 건도 없습니다 — ` +
            `특정 카페가 막힌 것이 아니라 이 기간 배포 자체가 이뤄지지 않았다는 뜻입니다.`
          : zeroCafes.length
          ? `표본이 있는 ${cafeList.length}곳 가운데 <b class="warn">${zeroCafes.length}곳</b>에는 당사 홍보글이 이 기간 한 건도 없습니다` +
            (zeroCafes.length <= 5 ? `(${zeroCafes.slice(0, 5).map(cafeName).join(" · ")})` : ``) + `. ` +
            `카페마다 게시 조건이 달라 일률 배포가 어려우므로, 경쟁 노출이 몰린 카페부터 우선순위를 매기는 편이 실효가 있습니다.`
          : `표본이 있는 카페 전부에 당사 글이 걸려 있어, 이 기간의 배포는 고르게 이뤄졌습니다.`) +
        `</p></div>`);
    }

    // 각론 ④ 품목 — 광고가 미는 품목과 고객이 말하는 품목이 다른지
    if (items.length) {
      const adTop = items.slice().sort((a, b) => IT[b].ad - IT[a].ad).filter((k) => IT[k].ad > 0);
      const cuTop = items.slice().sort((a, b) => IT[b].cust - IT[a].cust).filter((k) => IT[k].cust > 0);
      const gap = cuTop.filter((k) => IT[k].cust >= 10 && IT[k].cust > IT[k].ad * 3).slice(0, 2);
      secs.push(`<div class="cy-sec"><h5>④ 광고가 미는 품목 vs 고객이 말하는 품목</h5><p class="cy-note">` +
        (adTop.length ? `광고 글이 가장 많이 다룬 품목은 <b class="warn">${adTop.slice(0, 3).join(" · ")}</b>이고, ` : ``) +
        (cuTop.length ? `고객 글이 가장 많이 다룬 품목은 <b>${cuTop.slice(0, 3).join(" · ")}</b>입니다. ` : ``) +
        (gap.length
          ? `특히 <b>${gap.join(" · ")}</b>${josa(gap[gap.length - 1], "은", "는")} 고객이 훨씬 자주 말하는데 광고는 거의 붙지 않은 품목입니다 — 수요가 있는 자리에 우리 이야기가 비어 있습니다.`
          : `광고가 미는 품목과 고객이 말하는 품목이 크게 어긋나지는 않는 구간입니다.`) +
        `</p></div>`);
    }

    // 실행 제안
    const bigComp = topAd.length ? topAd[0].k : "경쟁 유통";
    secs.push(rolePlan(
      S.ad_own === 0
        ? `제휴카페는 계약된 지면인데 이 기간 <b>당사 게시가 0건</b>입니다 — 원고 배포가 아니라 <b>게시 여부 확인 체계</b>부터 필요합니다.`
        : `살아남은 당사 글은 <b>매장 이벤트형</b>(오픈·입주 박람회)입니다 — 일반 홍보 원고 대신 <b>사건이 있는 원고</b>만 배포하도록 가이드를 바꾸세요.`,
      `<b>${cafeName(hotCafe || "")}</b> 등 ${bigComp} 광고가 몰린 카페를 우선 배정하고, ` +
      `고객 구매처 문의 글(${fmtN(S.custRet)}건)에 <b>지역 매장이 답글로 붙는 담당</b>을 정하세요.`,
      S.cust_own
        ? `당사를 언급한 고객 글 ${fmtN(S.cust_own)}건처럼 <b>매장·담당자 이름이 적힌 글</b>이 남도록 구매 고객에게 후기 작성을 요청하세요.`
        : `이 기간 당사를 언급한 고객 글이 없습니다 — 구매 고객에게 <b>거주 카페에 후기 남기기</b>를 안내하는 것부터 시작하세요.`));

    const right = `<div class="afa-right"><div class="ca-ncard yt-rep">` +
      `<h4 class="ca-ch">종합 진단 <i class="ca-tag">${L}</i></h4>` + secs.join("") +
      `</div></div>`;

    return `<div class="ca2 yt-wrap afa-wrap">` + head() +
      `<div class="afa-grid">` + left + mid + right + `</div></div>`;
  }

  function paint(host) {
    if (!host || !A) return;
    host.innerHTML = render();
    if (window.VNAV) VNAV.sync();
    if (window.VFIT) VFIT.all();
    if (per()) per().bind(host);
  }

  window.openAffiliateAds = function () {
    const host = document.getElementById("channelPanel");
    const sec = document.getElementById("channel");
    if (!host || !sec || !A) return;
    if (window.VNAV) VNAV.push({ id: "affiliate-ads", label: "제휴카페 부울경", open: () => window.openAffiliateAds() });
    paint(host);
    sec.hidden = false;
    window.setView ? setView("view-channel", "view-cx")
      : document.body.classList.add("mode-results", "view-channel", "view-cx");
    window.scrollTo({ top: 0, behavior: "auto" });
  };
})();
