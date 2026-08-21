/* 제휴카페 분석 화면 — 타일 클릭 시 열린다.
   화면을 두 덩어리로 확실히 가른다(사용자 지시):
     좌 = 가전 전반   이 카페에서 가전이 얼마나·어떻게 이야기되나
     우 = 당사        그중 삼성이 차지한 몫
   울산처럼 "가전 글은 많은데 당사는 없다"가 한눈에 보이는 것이 이 화면의 목적이다.

   기간: 월 단위로 본다. 첫 진입은 현재 월.
   선택 방식은 세 가지를 겹쳐 뒀다 —
     ① ‹ › 스테퍼   한 달씩 정확히 이동(표본 있는 달만 밟는다)
     ② 월 스트립     최근 24개월 막대. 어느 달에 글이 몰렸는지 보고 바로 점프
     ③ 전체 기간     누적으로 되돌리기
   글씨 크기는 다이렉트웨딩 분석 페이지(본문 19.5px)에 맞춘다. */
(function () {
  "use strict";
  const AI = window.AFFILIATE_INSIGHT || null;
  const fmtN = (n) => (n || 0).toLocaleString("ko-KR");
  const man = (n) => (n >= 10000 ? (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "만" : fmtN(n));
  const ymLab = (ym) => ym ? `${+ym.slice(0, 4)}년 ${+ym.slice(5)}월` : "전체 기간";

  /* 행 인덱스 — build_affiliate_web.py 와 순서를 맞춘다 */
  const R_YM = 0, R_AX = 1, R_RET = 2, R_IT = 3, R_FL = 4, R_T = 5, R_ID = 6;
  /* 축 코드(=AI.axis 순서) → 화면 표기 */
  const AX = [
    [2, "구매·추천 상담", "매장을 아직 못 정한 고객"],
    [5, "사후 서비스", "청소·수리·설치"],
    [0, "교체·이사 수요", "혼수와 다른 생활 수요"],
    [1, "유통 홍보글", "업체가 올린 행사·세일"],
    [3, "중고 거래", "저가 세그먼트"],
    [4, "구독·렌탈", "AI구독클럽 지점"],
    [6, "온라인 구매", "매장 미경유"],
  ];
  const AX_TALK = [0, 1, 2, 3, 4, 5, 6];      // 가전 '이야기'로 세는 축(잡담·미분류 제외)
  const AX_DEMAND = [2, 0, 4];                // 구매로 이어질 수요

  const st = { cafe: null, ym: null };        // ym=null 이면 전체 기간

  function findCafe(cafe) {
    if (!AI) return null;
    const u = (cafe.u || cafe.url || "").replace(/\/+$/, "");
    const slug = u.split("/").pop();
    if (slug && AI.cafes[slug]) return AI.cafes[slug];
    const nm = cafe.n || cafe.name || "";
    return Object.values(AI.cafes).find((c) => c.name === nm)
        || Object.values(AI.cafes).find((c) => nm && (c.name.indexOf(nm) === 0 || nm.indexOf(c.name) === 0))
        || null;
  }

  const ourIx = () => AI.rets.indexOf(AI.ours);

  /* 선택 기간의 행만 추려 집계 */
  function agg(c, ym) {
    const rows = ym ? c.rows.filter((r) => r[R_YM] === ym) : c.rows;
    const o = {
      n: rows.length, axis: {}, ret: [], promo: [], items: {},
      acts: [], ask: [], sub: [], months: {},
    };
    AI.rets.forEach((_, i) => { o.ret[i] = 0; o.promo[i] = 0; });
    rows.forEach((r) => {
      const ax = r[R_AX];
      o.axis[ax] = (o.axis[ax] || 0) + 1;
      o.months[r[R_YM]] = (o.months[r[R_YM]] || 0) + 1;
      for (let i = 0; i < AI.rets.length; i++) {
        if ((r[R_RET] >> i) & 1) {
          o.ret[i]++;
          if (ax === 1) o.promo[i]++;
        }
      }
      for (let i = 0; i < AI.items.length; i++) {
        if ((r[R_IT] >> i) & 1) o.items[AI.items[i]] = (o.items[AI.items[i]] || 0) + 1;
      }
      const item = [r[R_YM], r[R_T], r[R_ID] ? `https://cafe.naver.com/f-e/cafes/${c.club}/articles/${r[R_ID]}` : ""];
      if (r[R_FL]) o.acts.push(item);
      else if (ax === 2) o.ask.push(item);
      else if (ax === 4) o.sub.push(item);
    });
    o.talk = AX_TALK.reduce((a, k) => a + (o.axis[k] || 0), 0);
    o.demand = AX_DEMAND.reduce((a, k) => a + (o.axis[k] || 0), 0);
    const oi = ourIx();
    o.oursP = o.promo[oi]; o.oursM = o.ret[oi];
    o.compP = o.promo.reduce((a, v, i) => a + (i === oi ? 0 : v), 0);
    o.compM = o.ret.reduce((a, v, i) => a + (i === oi ? 0 : v), 0);
    o.shareM = (o.oursM + o.compM) ? +(o.oursM / (o.oursM + o.compM) * 100).toFixed(1) : 0;
    o.itemsTop = Object.keys(o.items).map((k) => [k, o.items[k]]).sort((a, b) => b[1] - a[1]).slice(0, 8);
    return o;
  }

  /* ── 기간 선택 바 ── */
  function periodBar(c) {
    const have = {};
    c.rows.forEach((r) => { have[r[R_YM]] = (have[r[R_YM]] || 0) + 1; });
    const list = Object.keys(have).sort();                 // 오름차순
    const recent = list.slice(-24);
    const max = Math.max(1, ...recent.map((m) => have[m]));
    const i = st.ym ? list.indexOf(st.ym) : -1;
    const prev = i > 0 ? list[i - 1] : (st.ym ? null : list[list.length - 1]);
    const next = i >= 0 && i < list.length - 1 ? list[i + 1] : null;
    const cur = st.ym ? have[st.ym] || 0 : c.rows.length;
    return `<div class="af-period">` +
      `<div class="af-step">` +
      `<button type="button" class="af-nav" data-ym="${prev || ""}" ${prev ? "" : "disabled"} title="이전 달">‹</button>` +
      `<span class="af-cur"><b>${ymLab(st.ym)}</b><em>${fmtN(cur)}건</em></span>` +
      `<button type="button" class="af-nav" data-ym="${next || ""}" ${next ? "" : "disabled"} title="다음 달">›</button>` +
      `</div>` +
      `<div class="af-strip" role="group" aria-label="월 선택">` +
      recent.map((m) => {
        const h = Math.max(8, Math.round(have[m] / max * 100));
        return `<button type="button" class="af-sb${m === st.ym ? " on" : ""}" data-ym="${m}"` +
          ` title="${ymLab(m)} · ${fmtN(have[m])}건"><i style="height:${h}%"></i>` +
          `<em>${m.slice(5)}</em></button>`;
      }).join("") +
      `</div>` +
      `<button type="button" class="af-all-btn${st.ym ? "" : " on"}" data-ym="">전체 기간</button>` +
      `</div>`;
  }

  /* ── 도넛 ── */
  function donut(ours, comp) {
    const tot = ours + comp, pct = tot ? ours / tot : 0;
    const R = 52, C = 2 * Math.PI * R;
    const on = Math.max(pct * C, tot && ours ? 2 : 0);
    return `<svg class="af-donut" viewBox="0 0 140 140" role="img" aria-label="당사 점유 ${Math.round(pct * 100)}%">` +
      `<circle cx="70" cy="70" r="${R}" fill="none" stroke="#e6ebf3" stroke-width="18"/>` +
      `<circle cx="70" cy="70" r="${R}" fill="none" stroke="#1f5fd0" stroke-width="18"` +
      ` stroke-dasharray="${on} ${C - on}" stroke-dashoffset="${C / 4}" stroke-linecap="round"` +
      ` transform="rotate(-90 70 70)"/>` +
      `<text x="70" y="66" text-anchor="middle" class="af-dnum">${tot ? (pct * 100).toFixed(1) : 0}<tspan class="af-dpct">%</tspan></text>` +
      `<text x="70" y="90" text-anchor="middle" class="af-dlab">당사 점유</text></svg>`;
  }

  function bar(v, max, cls) {
    const w = max ? Math.max(2, Math.round(v / max * 100)) : 0;
    return `<span class="afb"><i class="${cls || ""}" style="width:${w}%"></i></span>`;
  }

  /* 좌: 가전 전반 */
  function paneAll(c, A) {
    const axMax = Math.max(1, ...AX.map(([k]) => A.axis[k] || 0));
    // 당사를 맨 위에 고정 — 건수순이면 꼴찌라 표 아래로 밀려 안 보인다
    const oi = ourIx();
    const rets = AI.rets.map((k, i) => ({ n: k, i, p: A.promo[i], m: A.ret[i] }))
      .sort((a, b) => (a.i === oi ? -1 : b.i === oi ? 1 : 0) || b.p - a.p || b.m - a.m);
    const pMax = Math.max(1, ...rets.map((x) => x.p));
    const itTop = A.itemsTop.length ? A.itemsTop[0][1] : 1;
    const empty = A.n === 0;
    return `<section class="af-pane af-all">` +
      `<header class="af-ph"><span class="af-tag">① 가전 전반</span>` +
      `<h3>이 카페에서 가전은 이렇게 이야기됩니다</h3></header>` +
      (empty ? `<p class="af-none">이 달에는 수집된 글이 없습니다.</p>` :
      `<div class="af-stats">` +
      `<div class="af-stat"><b>${fmtN(A.talk)}</b><span>가전 글</span><em>수집 ${fmtN(A.n)}건 중</em></div>` +
      `<div class="af-stat hot"><b>${fmtN(A.demand)}</b><span>구매 수요</span><em>상담·교체·구독</em></div>` +
      `<div class="af-stat"><b>${fmtN(A.axis[5] || 0)}</b><span>서비스 문의</span><em>청소·수리·설치</em></div>` +
      `</div>` +
      `<div class="af-block"><h4>어느 유통이 활동하나</h4>` +
      `<table class="af-tbl"><thead><tr><th>유통</th><th>홍보글</th><th>전체 언급</th><th></th></tr></thead><tbody>` +
      rets.map((x) => `<tr class="${x.i === oi ? "is-ours" : ""}">` +
        `<td class="af-tn">${x.n}${x.i === oi ? ' <i class="af-me">당사</i>' : ""}</td>` +
        `<td class="af-tv"><b>${fmtN(x.p)}</b></td>` +
        `<td class="af-tv">${fmtN(x.m)}</td>` +
        `<td class="af-tb">${bar(x.p, pMax, x.i === oi ? "s" : "l")}</td></tr>`).join("") +
      `</tbody></table></div>` +
      `<div class="af-block"><h4>무엇을 이야기하나</h4>` +
      AX.map(([k, lab, desc]) => {
        const v = A.axis[k] || 0;
        return `<div class="af-row"><span class="af-rn">${lab}<em>${desc}</em></span>` +
          bar(v, axMax) + `<b class="af-rv">${fmtN(v)}</b></div>`;
      }).join("") + `</div>` +
      (A.itemsTop.length ? `<div class="af-block"><h4>어떤 품목이 오르내리나</h4>` +
        `<div class="af-items">` + A.itemsTop.map(([n, v]) =>
          `<div class="af-item"><span>${n}</span>` + bar(v, itTop) + `<b>${fmtN(v)}</b></div>`).join("") +
        `</div></div>` : "")) +
      `</section>`;
  }

  /* 우: 당사 */
  function paneOurs(c, A) {
    const zero = A.oursP === 0;
    const ratio = A.oursP ? Math.round(A.compP / A.oursP) : null;
    const per = st.ym ? `${ymLab(st.ym)}에 ` : "";
    // '표본 자체가 없다' / '가전 이야기가 없다' / '가전 이야기는 있는데 당사가 없다'는
    // 전혀 다른 상황이다. 뭉뚱그리면 "당사가 없다"가 과장된다.
    const verdict = A.n === 0
      ? { cls: "warn", t: "이 달은 수집된 글이 없습니다", d: "다른 달을 고르거나 전체 기간으로 보세요." }
      : A.talk === 0
      ? { cls: "warn", t: "이 달은 가전 이야기가 없습니다",
          d: `수집된 <b>${fmtN(A.n)}건</b>이 모두 일상 대화(에어컨 온도·냉장고 정리 등)라 ` +
             `구매와 이어지는 신호가 없습니다. 경쟁 유통 홍보도 <b>${fmtN(A.compP)}건</b>입니다.` }
      : zero
      ? { cls: "bad", t: "이 카페에 당사가 없습니다",
          d: `${per}가전 글이 <b>${fmtN(A.talk)}건</b> 오가고 구매 수요가 <b>${fmtN(A.demand)}건</b>인데, ` +
             `삼성스토어 홍보글은 <b class="hl">0건</b>입니다. 경쟁 유통은 <b>${fmtN(A.compP)}건</b> 올렸습니다.` }
      : A.compP >= A.oursP * 5
        ? { cls: "warn", t: `경쟁 대비 ${ratio}분의 1`,
            d: `${per}삼성스토어 <b class="hl">${fmtN(A.oursP)}건</b> vs 경쟁 유통 <b>${fmtN(A.compP)}건</b>. ` +
               `가전 수요 <b>${fmtN(A.demand)}건</b>에 비해 우리 노출이 크게 부족합니다.` }
        : { cls: "ok", t: "활동이 이어지고 있습니다",
            d: `${per}삼성스토어 <b class="hl">${fmtN(A.oursP)}건</b> · 경쟁 <b>${fmtN(A.compP)}건</b>. 이 방식을 다른 카페로 넓힐 만합니다.` };

    const list = (title, arr, note, cls) => arr.length
      ? `<div class="af-block ${cls || ""}"><h4>${title} <i>${arr.length}건</i></h4>` +
        (note ? `<p class="af-sub">${note}</p>` : "") + `<ul class="af-list">` +
        arr.slice(0, 6).map(([ym, t, u]) => `<li><span class="af-ym">${ym}</span>` +
          (u ? `<a href="${u}" target="_blank" rel="noopener">${t}</a>` : `<span>${t}</span>`) + `</li>`).join("") +
        `</ul></div>` : "";

    return `<section class="af-pane af-ours">` +
      `<header class="af-ph"><span class="af-tag ours">② 당사</span>` +
      `<h3>그중 삼성은 얼마나 보이나</h3></header>` +
      `<div class="af-verdict ${verdict.cls}"><b>${verdict.t}</b><p>${verdict.d}</p></div>` +
      (A.n === 0 ? "" :
      `<div class="af-share">` + donut(A.oursP, A.compP) +
      `<div class="af-slegend">` +
      `<div class="af-lg s"><span>삼성스토어</span><b>${fmtN(A.oursP)}</b></div>` +
      `<div class="af-lg l"><span>경쟁 유통 합계</span><b>${fmtN(A.compP)}</b></div>` +
      `<p class="af-vsnote">행사·세일 홍보글 기준 · 전체 언급 점유는 ${A.shareM}%</p>` +
      `</div></div>` +
      (A.acts.length
        ? list("우리가 올린 글", A.acts, "이 방식이 실제로 노출된 사례입니다.")
        : `<div class="af-block af-empty"><h4>우리가 올린 글</h4>` +
          `<p>${st.ym ? ymLab(st.ym) + "에는 " : "수집 표본에서 "}확인되지 않았습니다. <b>이 카페는 비어 있습니다.</b></p></div>`) +
      list("놓치고 있는 상담", A.ask, "매장을 못 정한 고객이 공개적으로 묻는 글입니다.", "af-miss") +
      list("구독·렌탈 문의", A.sub, "AI구독클럽으로 바로 답할 수 있는 글입니다.")) +
      `</section>`;
  }

  function render() {
    const c = st.cafe, A = agg(c, st.ym);
    return `<div class="ca2 af-wrap">` +
      `<div class="af-top">` +
      `${window.VNAV ? VNAV.bar() : ""}` +
      `<div class="af-title"><h2>${c.name}</h2>` +
      `<span>${c.type} · ${c.rg.replace(/^지역구\s*/, "")} · 회원 ${man(c.mem)}명` +
      (c.url ? ` · <a href="${c.url}" target="_blank" rel="noopener">카페 열기 ›</a>` : "") + `</span></div>` +
      `<div class="af-hero">` +
      `<div class="af-hk"><b>${fmtN(A.talk)}</b><span>가전 글</span></div>` +
      `<div class="af-hvs">vs</div>` +
      `<div class="af-hk ${A.oursP ? "" : "zero"}"><b>${fmtN(A.oursP)}</b><span>당사 홍보</span></div>` +
      `</div></div>` +
      periodBar(c) +
      `<div class="af-body">` + paneAll(c, A) + paneOurs(c, A) + `</div>` +
      `<p class="af-foot">${ymLab(st.ym)} 기준 · 제목·요약 수집 표본 분석(전수 아님) · ` +
      `혼수 채널(다이렉트결혼준비)과 성격이 달라 수치를 합산하지 않습니다.</p>` +
      `</div>`;
  }

  function paint(host) {
    host.innerHTML = render();
    if (window.VNAV) VNAV.sync();
    host.querySelectorAll("[data-ym]").forEach((b) => b.addEventListener("click", () => {
      if (b.disabled) return;
      st.ym = b.getAttribute("data-ym") || null;
      paint(host);
    }));
  }

  window.openAffiliateCafe = function (cafe) {
    const host = document.getElementById("channelPanel");
    const sec = document.getElementById("channel");
    if (!host || !sec) return;
    const c = findCafe(cafe);
    if (!c) {
      host.innerHTML = `<div class="ca2 af-wrap"><div class="af-top">` +
        `${window.VNAV ? VNAV.bar() : ""}` +
        `<div class="af-title"><h2>${cafe.n || cafe.name || "카페"}</h2><span>미수집</span></div></div>` +
        `<div class="af-nodata"><b>아직 수집하지 않은 카페입니다</b>` +
        `<p>현재 부울경 14곳을 수집했습니다. 이 카페는 수집 후 자동으로 채워집니다.</p></div></div>`;
      if (window.VNAV) VNAV.sync();
    } else {
      st.cafe = c;
      if (window.VNAV) VNAV.push({ id: "cafe:" + c.slug, label: c.name,
        open: () => window.openAffiliateCafe(cafe) });
      // 첫 진입은 현재 월. 그 달에 표본이 없으면 표본이 있는 가장 최근 달로 내려간다.
      const have = {};
      c.rows.forEach((r) => { have[r[R_YM]] = 1; });
      st.ym = have[AI.now] ? AI.now
            : (Object.keys(have).sort().reverse()[0] || null);
      paint(host);
    }
    sec.hidden = false;
    window.setView ? setView("view-channel", "view-af") : document.body.classList.add("mode-results", "view-channel", "view-af");
    window.scrollTo({ top: 0, behavior: "auto" });
  };
})();
