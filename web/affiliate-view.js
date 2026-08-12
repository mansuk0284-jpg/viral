/* 제휴카페 분석 화면 — 타일 클릭 시 열린다.
   화면을 두 덩어리로 확실히 가른다(사용자 지시):
     좌 = 가전 전반   이 카페에서 가전이 얼마나·어떻게 이야기되나
     우 = 당사        그중 삼성이 차지한 몫
   울산처럼 "가전 글은 많은데 당사는 없다"가 한눈에 보이는 것이 이 화면의 목적이다.
   글씨 크기는 다이렉트웨딩 분석 페이지(본문 19.5px)에 맞춘다. */
(function () {
  "use strict";
  const AI = window.AFFILIATE_INSIGHT || null;
  const fmtN = (n) => (n || 0).toLocaleString("ko-KR");
  const man = (n) => (n >= 10000 ? (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "만" : fmtN(n));

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

  const AX = [
    ["③구매상담", "구매·추천 상담", "매장을 아직 못 정한 고객"],
    ["⑦사후서비스", "사후 서비스", "청소·수리·설치"],
    ["①교체·이사", "교체·이사 수요", "혼수와 다른 생활 수요"],
    ["②경쟁노출", "유통 홍보글", "업체가 올린 행사·세일"],
    ["⑤중고", "중고 거래", "저가 세그먼트"],
    ["⑥구독·렌탈", "구독·렌탈", "AI구독클럽 지점"],
    ["⑧온라인", "온라인 구매", "매장 미경유"],
  ];

  /* ── 도넛: 당사 vs 경쟁 점유 ── */
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

  /* ── 월별 추이 영역 차트 ── */
  function trend(months) {
    if (!months || months.length < 3) return "";
    const vals = months.map((m) => m[1]);
    const max = Math.max(1, ...vals), W = 520, H = 96, P = 4;
    const pts = vals.map((v, i) => [
      P + (i / Math.max(1, vals.length - 1)) * (W - P * 2),
      H - P - (v / max) * (H - P * 2 - 14),
    ]);
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const peak = vals.indexOf(max);
    return `<div class="af-trend">` +
      `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="af-tsvg" aria-label="월별 가전 글 추이">` +
      `<path d="${d} L${W - P} ${H} L${P} ${H} Z" fill="rgba(31,95,208,0.12)"/>` +
      `<path d="${d}" fill="none" stroke="#1f5fd0" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>` +
      `<circle cx="${pts[peak][0].toFixed(1)}" cy="${pts[peak][1].toFixed(1)}" r="5" fill="#1f5fd0"/>` +
      `</svg>` +
      `<div class="af-tcap"><span>${months[0][0]}</span>` +
      `<b>최다 ${months[peak][0]} · ${fmtN(max)}건</b>` +
      `<span>${months[months.length - 1][0]}</span></div></div>`;
  }

  /* ── 가로 막대 ── */
  function bar(v, max, cls) {
    const w = max ? Math.max(2, Math.round(v / max * 100)) : 0;
    return `<span class="afb"><i class="${cls || ""}" style="width:${w}%"></i></span>`;
  }

  /* 좌: 가전 전반 */
  function paneAll(c) {
    const A = c.all;
    const axMax = Math.max(1, ...AX.map(([k]) => A.axis[k] || 0));
    // 당사를 맨 위에 고정한다 — 건수순으로 두면 우리가 꼴찌라 표 맨 아래로 밀려 안 보인다.
    // 비교가 목적이므로 1위(최다 유통) 바로 위에 놓아 바로 대조되게 한다.
    const rets = AI.rets.map((k) => ({ n: k, p: A.promo[k] || 0, m: A.ret[k] || 0 }))
      .sort((a, b) => (a.n === AI.ours ? -1 : b.n === AI.ours ? 1 : 0) || b.p - a.p || b.m - a.m);
    const pMax = Math.max(1, ...rets.map((x) => x.p));
    const itTop = A.items.length ? A.items[0][1] : 1;
    return `<section class="af-pane af-all">` +
      `<header class="af-ph"><span class="af-tag">① 가전 전반</span>` +
      `<h3>이 카페에서 가전은 이렇게 이야기됩니다</h3></header>` +

      `<div class="af-stats">` +
      `<div class="af-stat"><b>${fmtN(A.talk)}</b><span>가전 글</span><em>수집 ${fmtN(c.n)}건 중</em></div>` +
      `<div class="af-stat hot"><b>${fmtN(A.demand)}</b><span>구매 수요</span><em>상담·교체·구독</em></div>` +
      `<div class="af-stat"><b>${fmtN(A.axis["⑦사후서비스"] || 0)}</b><span>서비스 문의</span><em>청소·수리·설치</em></div>` +
      `</div>` +

      // 유통 표를 먼저 둔다 — 당사가 어디쯤인지가 이 화면의 핵심이라
      // 스크롤 없이 바로 보여야 한다(뒤에 두면 묻힌다).
      `<div class="af-block"><h4>어느 유통이 활동하나</h4>` +
      `<table class="af-tbl"><thead><tr><th>유통</th><th>홍보글</th><th>전체 언급</th><th></th></tr></thead><tbody>` +
      rets.map((x) => `<tr class="${x.n === AI.ours ? "is-ours" : ""}">` +
        `<td class="af-tn">${x.n}${x.n === AI.ours ? ' <i class="af-me">당사</i>' : ""}</td>` +
        `<td class="af-tv"><b>${fmtN(x.p)}</b></td>` +
        `<td class="af-tv">${fmtN(x.m)}</td>` +
        `<td class="af-tb">${bar(x.p, pMax, x.n === AI.ours ? "s" : "l")}</td></tr>`).join("") +
      `</tbody></table></div>` +

      `<div class="af-block"><h4>무엇을 이야기하나</h4>` +
      AX.map(([k, lab, desc]) => {
        const v = A.axis[k] || 0;
        return `<div class="af-row"><span class="af-rn">${lab}<em>${desc}</em></span>` +
          bar(v, axMax) + `<b class="af-rv">${fmtN(v)}</b></div>`;
      }).join("") + `</div>` +

      (A.items.length ? `<div class="af-block"><h4>어떤 품목이 오르내리나</h4>` +
        `<div class="af-items">` + A.items.map(([n, v]) =>
          `<div class="af-item"><span>${n}</span>` + bar(v, itTop) + `<b>${fmtN(v)}</b></div>`).join("") +
        `</div></div>` : "") +

      (A.months.length >= 3 ? `<div class="af-block"><h4>월별 추이</h4>` + trend(A.months) + `</div>` : "") +
      `</section>`;
  }

  /* 우: 당사 */
  function paneOurs(c) {
    const O = c.ours, A = c.all;
    const zero = O.promo === 0;
    const ratio = O.promo ? Math.round(O.compP / O.promo) : null;
    const verdict = zero
      ? { cls: "bad", t: "이 카페에 당사가 없습니다",
          d: `가전 글이 <b>${fmtN(A.talk)}건</b> 오가고 구매 수요가 <b>${fmtN(A.demand)}건</b>인데, ` +
             `삼성스토어 홍보글은 <b class="hl">0건</b>입니다. 경쟁 유통은 <b>${fmtN(O.compP)}건</b> 올렸습니다.` }
      : O.compP >= O.promo * 5
        ? { cls: "warn", t: `경쟁 대비 ${ratio}분의 1`,
            d: `삼성스토어 <b class="hl">${fmtN(O.promo)}건</b> vs 경쟁 유통 <b>${fmtN(O.compP)}건</b>. ` +
               `가전 수요 <b>${fmtN(A.demand)}건</b>에 비해 우리 노출이 크게 부족합니다.` }
        : { cls: "ok", t: "활동이 이어지고 있습니다",
            d: `삼성스토어 <b class="hl">${fmtN(O.promo)}건</b> · 경쟁 <b>${fmtN(O.compP)}건</b>. 이 방식을 다른 카페로 넓힐 만합니다.` };

    const list = (title, arr, note, cls) => arr.length
      ? `<div class="af-block ${cls || ""}"><h4>${title} <i>${arr.length}건</i></h4>` +
        (note ? `<p class="af-sub">${note}</p>` : "") + `<ul class="af-list">` +
        arr.map(([ym, t, u]) => `<li><span class="af-ym">${ym || "—"}</span>` +
          (u ? `<a href="${u}" target="_blank" rel="noopener">${t}</a>` : `<span>${t}</span>`) + `</li>`).join("") +
        `</ul></div>` : "";

    return `<section class="af-pane af-ours">` +
      `<header class="af-ph"><span class="af-tag ours">② 당사</span>` +
      `<h3>그중 삼성은 얼마나 보이나</h3></header>` +

      `<div class="af-verdict ${verdict.cls}"><b>${verdict.t}</b><p>${verdict.d}</p></div>` +

      `<div class="af-share">` + donut(O.promo, O.compP) +
      `<div class="af-slegend">` +
      `<div class="af-lg s"><span>삼성스토어</span><b>${fmtN(O.promo)}</b></div>` +
      `<div class="af-lg l"><span>경쟁 유통 합계</span><b>${fmtN(O.compP)}</b></div>` +
      `<p class="af-vsnote">행사·세일 홍보글 기준 · 전체 언급 점유는 ${O.shareM}%</p>` +
      `</div></div>` +

      (O.acts.length
        ? list("우리가 올린 글", O.acts, "이 방식이 실제로 노출된 사례입니다.")
        : `<div class="af-block af-empty"><h4>우리가 올린 글</h4>` +
          `<p>수집 표본에서 확인되지 않았습니다. <b>이 카페는 비어 있습니다.</b></p></div>`) +

      list("놓치고 있는 상담", c.ask.slice(0, 6), "매장을 못 정한 고객이 공개적으로 묻는 글입니다.", "af-miss") +
      list("구독·렌탈 문의", c.sub.slice(0, 4), "AI구독클럽으로 바로 답할 수 있는 글입니다.") +
      `</section>`;
  }

  function render(c) {
    const O = c.ours, A = c.all;
    return `<div class="ca2 af-wrap">` +
      `<div class="af-top">` +
      `<button type="button" class="cx-back" id="afBack">‹ 카페 목록</button>` +
      `<div class="af-title"><h2>${c.name}</h2>` +
      `<span>${c.type} · ${c.rg.replace(/^지역구\s*/, "")} · 회원 ${man(c.mem)}명` +
      (c.url ? ` · <a href="${c.url}" target="_blank" rel="noopener">카페 열기 ›</a>` : "") + `</span></div>` +
      `<div class="af-hero">` +
      `<div class="af-hk"><b>${fmtN(A.talk)}</b><span>가전 글</span></div>` +
      `<div class="af-hvs">vs</div>` +
      `<div class="af-hk ${O.promo ? "" : "zero"}"><b>${fmtN(O.promo)}</b><span>당사 홍보</span></div>` +
      `</div></div>` +
      `<div class="af-body">` + paneAll(c) + paneOurs(c) + `</div>` +
      `<p class="af-foot">제목·요약 기준 수집 ${fmtN(c.n)}건의 표본 분석(전수 아님) · ` +
      `혼수 채널(다이렉트결혼준비)과 성격이 달라 수치를 합산하지 않습니다.</p>` +
      `</div>`;
  }

  window.openAffiliateCafe = function (cafe) {
    const host = document.getElementById("channelPanel");
    const sec = document.getElementById("channel");
    if (!host || !sec) return;
    const c = findCafe(cafe);
    if (!c) {
      host.innerHTML = `<div class="ca2 af-wrap"><div class="af-top">` +
        `<button type="button" class="cx-back" id="afBack">‹ 카페 목록</button>` +
        `<div class="af-title"><h2>${cafe.n || cafe.name || "카페"}</h2><span>미수집</span></div></div>` +
        `<div class="af-nodata"><b>아직 수집하지 않은 카페입니다</b>` +
        `<p>현재 부울경 14곳을 수집했습니다. 이 카페는 수집 후 자동으로 채워집니다.</p></div></div>`;
    } else {
      host.innerHTML = render(c);
    }
    sec.hidden = false;
    document.body.classList.add("mode-results", "view-channel", "view-af");
    window.scrollTo({ top: 0, behavior: "auto" });
    const back = host.querySelector("#afBack");
    if (back) back.addEventListener("click", () => {
      document.body.classList.remove("view-af");
      if (window.showIntro) window.showIntro();
    });
  };
})();
