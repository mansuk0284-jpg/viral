/* 네이버 리뷰·예약 분석 화면
   혼수 카페(구매 후기)·제휴카페(지역 생활)와 다른 세 번째 잣대 —
   **매장을 실제 방문한 고객의 평가**.

   화면 구성(사용자 지시):
     좌 = 우리 매장   리뷰·예약 경유·칭찬·방문사유·인물
     우 = LG 비교     같은 상권 짝을 나란히
   기간은 월 단위, 첫 진입은 현재 월. 이동·기간 UI 는 ui-navigation 규칙을 따른다.

   ⚠ 네이버 예약 '건수'는 외부에서 볼 수 없다(스마트플레이스 관리자 전용).
     화면의 '예약 경유'는 리뷰의 인증수단=예약 비율로 낸 **추정치**이며 그렇게 표기한다. */
(function () {
  "use strict";
  const NR = window.NAVER_REVIEW || null;
  const fmtN = (n) => (n || 0).toLocaleString("ko-KR");
  const ymLab = (ym) => ym ? `${+ym.slice(0, 4)}년 ${+ym.slice(5)}월` : "전체 기간";
  const R_YM = 0, R_VIA = 1, R_STAR = 2, R_P = 3, R_C = 4, R_R = 5, R_NEG = 6, R_MGR = 7, R_T = 8;

  const st = { store: null, ym: null };

  function pairOf(name) {
    if (!NR) return null;
    for (const p of NR.pairs) {
      if (p[0] === name) return { me: p[0], vs: p[1], lab: p[2], mine: "삼성" };
      if (p[1] === name) return { me: p[1], vs: p[0], lab: p[2], mine: "LG" };
    }
    return null;
  }

  function agg(store, ym) {
    const S = NR.stores[store];
    if (!S) return null;
    const rows = ym ? S.rows.filter((r) => r[R_YM] === ym) : S.rows;
    const o = { n: rows.length, via: {}, praise: {}, complain: {}, reason: {},
                mgr: {}, neg: [], months: {}, stars: {} };
    rows.forEach((r) => {
      const v = r[R_VIA] || "미상";
      o.via[v] = (o.via[v] || 0) + 1;
      o.months[r[R_YM]] = (o.months[r[R_YM]] || 0) + 1;
      if (r[R_STAR]) o.stars[r[R_STAR]] = (o.stars[r[R_STAR]] || 0) + 1;
      NR.praise.forEach((k, i) => { if ((r[R_P] >> i) & 1) o.praise[k] = (o.praise[k] || 0) + 1; });
      NR.complain.forEach((k, i) => { if ((r[R_C] >> i) & 1) o.complain[k] = (o.complain[k] || 0) + 1; });
      NR.reason.forEach((k, i) => { if ((r[R_R] >> i) & 1) o.reason[k] = (o.reason[k] || 0) + 1; });
      if (r[R_MGR]) o.mgr[r[R_MGR]] = (o.mgr[r[R_MGR]] || 0) + 1;
      if (r[R_NEG]) o.neg.push({ ym: r[R_YM], t: r[R_T] });
    });
    o.book = o.via["예약"] || 0;
    o.bookRate = o.n ? Math.round(o.book / o.n * 1000) / 10 : 0;
    o.total = S.total;
    o.top = (k) => Object.keys(o[k]).map((x) => [x, o[k][x]]).sort((a, b) => b[1] - a[1]);
    return o;
  }

  function bar(v, max, cls) {
    const w = max ? Math.max(2, Math.round(v / max * 100)) : 0;
    return `<span class="nrb"><i class="${cls || ""}" style="width:${w}%"></i></span>`;
  }

  /* 기간 선택 — ui-navigation 규칙: 상시 노출, 현재 월 기본 */
  function periodBar(store) {
    const S = NR.stores[store];
    const have = {};
    S.rows.forEach((r) => { have[r[R_YM]] = (have[r[R_YM]] || 0) + 1; });
    const list = Object.keys(have).sort();
    const recent = list.slice(-24);
    const max = Math.max(1, ...recent.map((m) => have[m]));
    const i = st.ym ? list.indexOf(st.ym) : -1;
    const prev = i > 0 ? list[i - 1] : (st.ym ? null : list[list.length - 1]);
    const next = i >= 0 && i < list.length - 1 ? list[i + 1] : null;
    const cur = st.ym ? (have[st.ym] || 0) : S.rows.length;
    return `<div class="af-period">` +
      `<div class="af-step">` +
      `<button type="button" class="af-nav" data-nrym="${prev || ""}" ${prev ? "" : "disabled"} title="이전 달">‹</button>` +
      `<span class="af-cur"><b>${ymLab(st.ym)}</b><em>${fmtN(cur)}건</em></span>` +
      `<button type="button" class="af-nav" data-nrym="${next || ""}" ${next ? "" : "disabled"} title="다음 달">›</button>` +
      `</div>` +
      `<div class="af-strip" role="group" aria-label="월 선택">` +
      recent.map((m) => `<button type="button" class="af-sb${m === st.ym ? " on" : ""}" data-nrym="${m}"` +
        ` title="${ymLab(m)} · ${fmtN(have[m])}건"><i style="height:${Math.max(8, Math.round(have[m] / max * 100))}%"></i>` +
        `<em>${m.slice(5)}</em></button>`).join("") +
      `</div>` +
      `<button type="button" class="af-all-btn${st.ym ? "" : " on"}" data-nrym="">전체 기간</button>` +
      `</div>`;
  }

  /* 좌 — 우리 매장 */
  function paneMine(name, A) {
    const S = NR.stores[name];
    const pr = A.top("praise"), rs = A.top("reason"), mg = A.top("mgr");
    const pMax = pr.length ? pr[0][1] : 1, rMax = rs.length ? rs[0][1] : 1;
    return `<section class="af-pane nr-mine">` +
      `<header class="af-ph"><span class="af-tag">① 우리 매장</span>` +
      `<h3>${S.name}</h3></header>` +
      `<div class="af-stats">` +
      `<div class="af-stat"><b>${fmtN(S.total)}</b><span>네이버 리뷰</span><em>누적 총계</em></div>` +
      `<div class="af-stat hot"><b>${fmtN(A.book)}</b><span>예약 경유</span><em>표본 ${A.n}건 중 · 추정</em></div>` +
      `<div class="af-stat"><b>${A.bookRate}<i>%</i></b><span>예약 비율</span><em>추정</em></div>` +
      `</div>` +
      (S.keywords.length ? `<div class="af-block"><h4>고객이 고른 칭찬 <i>네이버 집계</i></h4>` +
        `<div class="nr-kw">` + S.keywords.slice(0, 6).map((k) =>
          `<span class="nr-k"><b>${k.k}</b><i>${fmtN(k.n)}</i></span>`).join("") + `</div></div>` : "") +
      (rs.length ? `<div class="af-block"><h4>왜 방문했나 <i>${A.n}건 기준</i></h4>` +
        rs.map((x) => `<div class="af-row"><span class="af-rn">${x[0]}</span>` +
          bar(x[1], rMax) + `<b class="af-rv">${x[1]}</b></div>`).join("") + `</div>` : "") +
      (pr.length ? `<div class="af-block"><h4>본문에서 읽은 칭찬</h4>` +
        pr.slice(0, 5).map((x) => `<div class="af-row"><span class="af-rn">${x[0]}</span>` +
          bar(x[1], pMax, "s") + `<b class="af-rv">${x[1]}</b></div>`).join("") + `</div>` : "") +
      (mg.length ? `<div class="af-block"><h4>리뷰에 이름이 오르는 사람 <i>매장 자산</i></h4>` +
        `<div class="nr-kw">` + mg.slice(0, 6).map((x) =>
          `<span class="nr-k star"><b>${x[0]}</b><i>${x[1]}</i></span>`).join("") + `</div></div>` : "") +
      (A.neg.length
        ? `<div class="af-block af-miss"><h4>아쉬움 <i>${A.neg.length}건</i></h4>` +
          `<p class="af-sub">명시적 불만 표현이 있는 리뷰만 셌습니다(‘고장’은 방문 사유라 제외).</p>` +
          `<ul class="af-list">` + A.neg.slice(0, 4).map((x) =>
            `<li><span class="af-ym">${x.ym}</span><span>${x.t}</span></li>`).join("") + `</ul></div>`
        : `<div class="af-block"><h4>아쉬움</h4><p class="af-sub">이 기간 명시적 불만이 없습니다.</p></div>`) +
      `</section>`;
  }

  /* 우 — 경쟁 비교 */
  function paneVs(name, A) {
    const P = pairOf(name);
    if (!P || !NR.stores[P.vs]) {
      return `<section class="af-pane af-ours"><header class="af-ph">` +
        `<span class="af-tag ours">② 경쟁 비교</span><h3>비교 매장 없음</h3></header>` +
        `<p class="af-none">같은 상권의 경쟁 매장이 수집되지 않았습니다.</p></section>`;
    }
    const B = agg(P.vs, st.ym), S = NR.stores[name], V = NR.stores[P.vs];
    const win = S.total > V.total;
    const ratio = win ? Math.round(S.total / Math.max(1, V.total) * 10) / 10
                      : Math.round(V.total / Math.max(1, S.total) * 10) / 10;
    const verdict = win
      ? { cls: "ok", t: "리뷰에서 앞섭니다",
          d: `${S.name} <b class="hl">${fmtN(S.total)}</b> vs ${V.name} <b>${fmtN(V.total)}</b> — ` +
             `같은 상권에서 <b>${ratio}배</b>입니다.` }
      : { cls: "bad", t: `리뷰에서 ${ratio}배 밀립니다`,
          d: `${S.name} <b class="hl">${fmtN(S.total)}</b> vs ${V.name} <b>${fmtN(V.total)}</b>. ` +
             `리뷰 수는 방문 고객이 남긴 흔적의 양이라, 이 격차가 곧 ` +
             `<b>온라인에서 보이는 매장 활성도의 격차</b>입니다.` };
    const cmpRow = (lab, a, b) => {
      const t = (a || 0) + (b || 0), w = t ? (a / t * 100) : 50;
      return `<div class="nr-cmp"><span class="nr-cl">${lab}</span>` +
        `<span class="nr-cbar"><i class="s" style="width:${w}%"></i><i class="l" style="width:${100 - w}%"></i></span>` +
        `<span class="nr-cv"><b class="${a >= b ? "on" : ""}">${fmtN(a)}</b><em>${fmtN(b)}</em></span></div>`;
    };
    const rz = (o, k) => (o.reason[k] || 0);
    return `<section class="af-pane af-ours">` +
      `<header class="af-ph"><span class="af-tag ours">② ${P.lab} · 삼성 vs LG</span>` +
      `<h3>같은 상권에서 나란히</h3></header>` +
      `<div class="af-verdict ${verdict.cls}"><b>${verdict.t}</b><p>${verdict.d}</p></div>` +
      `<div class="af-block"><h4>맞대결 <i>왼쪽 ${S.name} · 오른쪽 ${V.name}</i></h4>` +
      cmpRow("네이버 리뷰 누적", S.total, V.total) +
      cmpRow("표본 내 예약 경유", A.book, B.book) +
      cmpRow("고장·교체 방문", rz(A, "고장·교체"), rz(B, "고장·교체")) +
      cmpRow("이사·입주 방문", rz(A, "이사·입주"), rz(B, "이사·입주")) +
      cmpRow("구독·렌탈 언급", rz(A, "구독·렌탈"), rz(B, "구독·렌탈")) +
      `</div>` +
      (V.keywords.length ? `<div class="af-block"><h4>상대가 받는 칭찬 <i>${V.name}</i></h4>` +
        `<div class="nr-kw">` + V.keywords.slice(0, 5).map((k) =>
          `<span class="nr-k vs"><b>${k.k}</b><i>${fmtN(k.n)}</i></span>`).join("") + `</div></div>` : "") +
      `<p class="af-sub nr-note">네이버 리뷰 누적은 매장 전체 기간 기준이고, ` +
      `나머지는 <b>선택 기간의 수집 표본</b> 기준입니다.</p>` +
      `</section>`;
  }

  function render() {
    const name = st.store, A = agg(name, st.ym);
    const S = NR.stores[name], P = pairOf(name);
    const V = P && NR.stores[P.vs];
    return `<div class="ca2 af-wrap nr-wrap">` +
      `<div class="af-top">` +
      `${window.VNAV ? VNAV.bar() : ""}` +
      `<div class="af-title"><h2>네이버 리뷰 · 예약</h2>` +
      `<span>${S.name} · ${S.region} · ${S.addr || ""}</span></div>` +
      `<div class="af-hero">` +
      `<div class="af-hk"><b>${fmtN(S.total)}</b><span>${P ? P.mine : "우리"} 리뷰</span></div>` +
      `<div class="af-hvs">vs</div>` +
      `<div class="af-hk ${V && V.total > S.total ? "zero" : ""}"><b>${fmtN(V ? V.total : 0)}</b><span>상대</span></div>` +
      `</div></div>` +
      periodBar(name) +
      `<div class="af-body">` + paneMine(name, A) + paneVs(name, A) + `</div>` +
      `<p class="af-foot">네이버 플레이스 방문자 리뷰 표본 분석(전수 아님) · ` +
      `<b>예약 건수는 외부에서 조회할 수 없어</b> ‘예약 경유’는 리뷰 인증수단 기준 추정치입니다 · ` +
      `혼수 카페 후기와 합산하지 않습니다.</p>` +
      `</div>`;
  }

  function paint(host) {
    host.innerHTML = render();
    if (window.VNAV) VNAV.sync();
    host.querySelectorAll("[data-nrym]").forEach((b) => b.addEventListener("click", () => {
      if (b.disabled) return;
      st.ym = b.getAttribute("data-nrym") || null;
      paint(host);
    }));
  }

  window.openNaverReview = function (storeName) {
    const host = document.getElementById("channelPanel");
    const sec = document.getElementById("channel");
    if (!host || !sec || !NR) return;
    // 대시보드 매장명과 플레이스 상호 표기가 달라 부분 일치로도 찾는다
    const ks = Object.keys(NR.stores);
    const key = NR.stores[storeName] ? storeName
      : ((NR.deptMap && NR.deptMap[storeName])
         || ks.find((k) => NR.stores[k].query === storeName)
         || ks.find((k) => k.indexOf(storeName) >= 0 || storeName.indexOf(k) >= 0)
         || ks[0]);
    st.store = key;
    const have = {};
    NR.stores[key].rows.forEach((r) => { have[r[R_YM]] = 1; });
    st.ym = have[NR.now] ? NR.now : (Object.keys(have).sort().reverse()[0] || null);
    if (window.VNAV) VNAV.push({ id: "nr:" + key, label: "네이버리뷰 " + key,
      open: () => window.openNaverReview(key) });
    paint(host);
    sec.hidden = false;
    window.setView ? setView("view-channel", "view-af", "view-nr") : document.body.classList.add("mode-results", "view-channel", "view-af", "view-nr");
    window.scrollTo({ top: 0, behavior: "auto" });
  };
})();
