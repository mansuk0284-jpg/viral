/* 제휴카페 분석 화면 — 타일 클릭 시 열린다.
   화면을 두 덩어리로 나눈다(사용자 지시):
     좌 = 가전 전반   이 카페에서 가전이 얼마나·어떻게 이야기되나
     우 = 당사        그중 삼성이 차지한 몫
   울산처럼 "가전 글은 많은데 당사는 없다"가 한눈에 보이게 하는 것이 목적이다. */
(function () {
  "use strict";
  const AI = window.AFFILIATE_INSIGHT || null;
  const fmtN = (n) => (n || 0).toLocaleString("ko-KR");
  const man = (n) => (n >= 10000 ? (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "만" : fmtN(n));

  /* 카페 URL의 slug로 분석 데이터를 찾는다(타일 데이터와 분석 데이터의 연결 고리) */
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
    ["⑦사후서비스", "사후 서비스", "청소·수리·설치 — 다음 구매를 좌우"],
    ["①교체·이사", "교체·이사 수요", "혼수와 다른 생활 수요"],
    ["②경쟁노출", "유통 홍보글", "업체가 올린 행사·세일"],
    ["⑤중고", "중고 거래", "저가 세그먼트 두께"],
    ["⑥구독·렌탈", "구독·렌탈", "AI구독클럽 대응 지점"],
    ["⑧온라인", "온라인 구매", "매장을 거치지 않은 수요"],
  ];

  function bar(v, max, cls) {
    const w = max ? Math.max(2, Math.round(v / max * 100)) : 0;
    return `<span class="afb"><i class="${cls || ""}" style="width:${w}%"></i></span>`;
  }

  /* 좌: 가전 전반 */
  function paneAll(c) {
    const A = c.all;
    const axMax = Math.max(1, ...AX.map(([k]) => A.axis[k] || 0));
    const rets = AI.rets.map((k) => ({ n: k, v: A.promo[k] || 0, m: A.ret[k] || 0 }))
      .sort((a, b) => b.v - a.v || b.m - a.m);
    const rMax = Math.max(1, ...rets.map((x) => x.v));
    const itMax = Math.max(1, ...(A.items.length ? A.items.map((x) => x[1]) : [1]));
    return `<section class="af-pane af-all">` +
      `<header class="af-ph"><span class="af-tag">가전 전반</span>` +
      `<h3>이 카페에서 가전은 이렇게 이야기됩니다</h3>` +
      `<p>수집 ${fmtN(c.n)}건 중 <b>${fmtN(A.talk)}건</b>이 가전 관련 · 이 중 구매로 이어질 수요 <b>${fmtN(A.demand)}건</b></p>` +
      `</header>` +
      `<div class="af-block"><h4>무엇을 이야기하나</h4>` +
      AX.map(([k, lab, desc]) => {
        const v = A.axis[k] || 0;
        return `<div class="af-row"><span class="af-rn">${lab}<em>${desc}</em></span>` +
          bar(v, axMax) + `<b class="af-rv">${fmtN(v)}</b></div>`;
      }).join("") + `</div>` +
      `<div class="af-block"><h4>어느 유통이 홍보하나 <i>(행사·세일 글)</i></h4>` +
      rets.map((x) => `<div class="af-row${x.n === AI.ours ? " is-ours" : ""}">` +
        `<span class="af-rn">${x.n}</span>` + bar(x.v, rMax, x.n === AI.ours ? "s" : "l") +
        `<b class="af-rv">${fmtN(x.v)}</b></div>`).join("") + `</div>` +
      (A.items.length ? `<div class="af-block"><h4>어떤 품목이 오르내리나</h4>` +
        `<div class="af-chips">` + A.items.map(([n, v]) =>
          `<span class="af-chip">${n}<i>${fmtN(v)}</i></span>`).join("") + `</div></div>` : "") +
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
             `삼성스토어 홍보글은 <b>0건</b>입니다. 경쟁 유통은 <b>${fmtN(O.compP)}건</b> 올렸습니다.` }
      : O.compP >= O.promo * 5
        ? { cls: "warn", t: `경쟁 대비 ${ratio}분의 1`,
            d: `삼성스토어 <b>${fmtN(O.promo)}건</b> vs 경쟁 유통 <b>${fmtN(O.compP)}건</b>. ` +
               `가전 수요 <b>${fmtN(A.demand)}건</b>에 비해 우리 노출이 크게 부족합니다.` }
        : { cls: "ok", t: "활동이 이어지고 있습니다",
            d: `삼성스토어 <b>${fmtN(O.promo)}건</b> · 경쟁 <b>${fmtN(O.compP)}건</b>. 이 방식을 다른 카페로 넓힐 만합니다.` };

    return `<section class="af-pane af-ours">` +
      `<header class="af-ph"><span class="af-tag ours">당사</span>` +
      `<h3>그중 삼성은 얼마나 보이나</h3>` +
      `<p>홍보 점유 <b>${O.shareP}%</b> · 전체 언급 점유 <b>${O.shareM}%</b></p>` +
      `</header>` +
      `<div class="af-verdict ${verdict.cls}"><b>${verdict.t}</b><p>${verdict.d}</p></div>` +
      `<div class="af-vs">` +
      `<div class="af-vsrow"><span>삼성스토어</span>` +
      `<span class="af-vsbar"><i class="s" style="width:${O.promo + O.compP ? O.promo / (O.promo + O.compP) * 100 : 0}%"></i></span>` +
      `<b>${fmtN(O.promo)}</b></div>` +
      `<div class="af-vsrow"><span>경쟁 유통 합계</span>` +
      `<span class="af-vsbar"><i class="l" style="width:${O.promo + O.compP ? O.compP / (O.promo + O.compP) * 100 : 0}%"></i></span>` +
      `<b>${fmtN(O.compP)}</b></div>` +
      `<p class="af-vsnote">행사·세일 홍보글 기준</p></div>` +
      (O.acts.length
        ? `<div class="af-block"><h4>우리가 올린 글 <i>${O.acts.length}건</i></h4><ul class="af-list">` +
          O.acts.map(([ym, t, u]) => `<li><span class="af-ym">${ym || "—"}</span>` +
            (u ? `<a href="${u}" target="_blank" rel="noopener">${t}</a>` : `<span>${t}</span>`) + `</li>`).join("") +
          `</ul></div>`
        : `<div class="af-block af-empty"><h4>우리가 올린 글</h4>` +
          `<p>수집 표본에서 확인되지 않았습니다. <b>이 카페는 비어 있습니다.</b></p></div>`) +
      (c.ask.length
        ? `<div class="af-block"><h4>놓치고 있는 상담 <i>${c.ask.length}건</i></h4>` +
          `<p class="af-sub">매장을 못 정한 고객이 공개적으로 묻는 글입니다.</p><ul class="af-list">` +
          c.ask.slice(0, 6).map(([ym, t, u]) => `<li><span class="af-ym">${ym || "—"}</span>` +
            (u ? `<a href="${u}" target="_blank" rel="noopener">${t}</a>` : `<span>${t}</span>`) + `</li>`).join("") +
          `</ul></div>` : "") +
      (c.sub.length
        ? `<div class="af-block"><h4>구독·렌탈 문의 <i>${c.sub.length}건</i></h4>` +
          `<p class="af-sub">AI구독클럽으로 바로 답할 수 있는 글입니다.</p><ul class="af-list">` +
          c.sub.slice(0, 4).map(([ym, t, u]) => `<li><span class="af-ym">${ym || "—"}</span>` +
            (u ? `<a href="${u}" target="_blank" rel="noopener">${t}</a>` : `<span>${t}</span>`) + `</li>`).join("") +
          `</ul></div>` : "") +
      `</section>`;
  }

  function render(c) {
    return `<div class="ca2 af-wrap">` +
      `<div class="af-top">` +
      `<button type="button" class="cx-back" id="afBack">‹ 카페 목록</button>` +
      `<div class="af-title"><h2>${c.name}</h2>` +
      `<span>${c.type} · ${c.rg.replace(/^지역구\s*/, "")} · 회원 ${man(c.mem)}명` +
      (c.url ? ` · <a href="${c.url}" target="_blank" rel="noopener">카페 열기 ›</a>` : "") + `</span></div>` +
      `<div class="af-kpi"><b>${fmtN(c.all.talk)}</b><span>가전 글</span></div>` +
      `<div class="af-kpi ${c.ours.promo ? "" : "zero"}"><b>${fmtN(c.ours.promo)}</b><span>당사 홍보</span></div>` +
      `</div>` +
      `<div class="af-body">` + paneAll(c) + paneOurs(c) + `</div>` +
      `<p class="af-foot">제목·요약 기준 수집 ${fmtN(c.n)}건의 표본 분석입니다(전수 아님). ` +
      `혼수 채널(다이렉트결혼준비)과는 성격이 달라 수치를 합산하지 않습니다.</p>` +
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
