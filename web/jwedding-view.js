/* 제이웨딩 채널 화면 (window.openJwedding)

   사용자 지시(2026-08-23): "제이웨딩 타일을 만들고 그 안에서 데이터를 정리해야지.
   채널별 현황은 채널별 타일에 데이터를 정리하는 거잖아."

   다이렉트웨딩 화면의 뼈대를 따르되, **표본 크기를 속이지 않는다.**
   다이렉트웨딩 84,419건 vs 제이웨딩 512건 — 165배 차이다.
   같은 크기로 그리면 같은 무게로 읽히므로, 표본이 작다는 사실을 화면에 적는다. */
(function () {
  "use strict";
  const J = window.JWEDDING || null;
  const fmtN = (n) => (n || 0).toLocaleString("ko-KR");
  const pct = (a, b) => (a + b === 0 ? 0 : Math.round((a / (a + b)) * 100));

  const st = { period: null };          // null = 전체

  /* 기간 — 공용 모듈을 쓴다(어느 분석 페이지에서도 같은 조작) */
  let PER = null;
  function per() {
    if (PER || !window.VPER || !J) return PER;
    PER = VPER.create({
      months: J.months.map((m) => m[0]),
      onChange: () => paint(document.getElementById("channelPanel")),
    });
    /* 이 채널은 표본이 작다(전체 512건). 현재 월로 열면 40건만 보여
       "이게 다인가" 로 읽힌다. 규모가 작은 채널은 **전체 기간**으로 연다. */
    if (PER) PER.setAll();
    return PER;
  }

  /* 선택 기간에 걸리는 월만 남긴다 */
  function inRange(ym) {
    const p = per();
    if (!p) return true;
    const r = p.range();
    return ym >= r[0].slice(0, 7) && ym <= r[1].slice(0, 7);
  }

  function agg() {
    let t = 0, s = 0, l = 0;
    J.months.forEach((m) => {
      if (!inRange(m[0])) return;
      t += m[1]; s += m[2]; l += m[3];
    });
    return { t: t, s: s, l: l };
  }

  function storeRows() {
    return Object.keys(J.stores).map((k) => {
      const v = J.stores[k];
      return { n: k, s: v.s, l: v.l, tot: v.s + v.l, last: v.last,
               mgr: (v.mgr || [])[0] || null };
    }).sort((a, b) => b.tot - a.tot);
  }

  function render() {
    const A = agg();
    const sh = pct(A.s, A.l);
    const rows = storeRows();
    const mgrS = J.mgr ? J.mgr.s : 0, mgrL = J.mgr ? J.mgr.l : 0;

    /* ── 현장 액션 ─────────────────────────────────────────────────
       사용자 지시(2026-08-24): "분석된 페이지는 인사이트가 있어야해.
       삼성스토어에서 참고할 만한 내용이 있어야 해."

       이 화면에 있던 문장은 화면 읽는 법이었다 —
       "비율은 참고로 보고 매장·담당자 지목에 무게를 두세요".
       무게를 어디 두라는 말이지, 매니저가 할 일이 아니다.

       이 게시판의 값어치는 **담당자 이름이 남는다**는 점이다.
       그러니 이름이 남은 매장과 안 남은 매장을 갈라 보여주는 것이 쓸모 있다.
       후기는 고객이 쓴다 — 매니저가 할 수 있는 일은 요청뿐이다(CLAUDE.md). */
    const named = rows.filter((x) => x.mgr);
    const unnamed = rows.filter((x) => !x.mgr && x.s > 0);   // 삼성 표본은 있는데 이름이 없는 곳
    const sTop = rows.filter((x) => x.s > x.l).length;
    const lTop = rows.filter((x) => x.l > x.s).length;

    const actLi = [];
    if (mgrS || mgrL) {
      actLi.push(`<li>담당자 이름이 적힌 글이 <b>삼성 ${fmtN(mgrS)}건</b> · ` +
        `<b>LG ${fmtN(mgrL)}건</b>입니다. 이름이 남은 후기는 <b>다음 고객이 찾아오는 단서</b>가 됩니다 —` +
        ` 상담을 마칠 때 <b>담당자 이름을 넣어</b> 후기를 남겨달라고 요청하세요.</li>`);
    }
    if (unnamed.length) {
      actLi.push(`<li class="warn-li">삼성 후기는 있는데 <b>담당자 이름이 한 번도 안 나온 매장</b>이 ` +
        `<b>${unnamed.length}곳</b>입니다` +
        ` (${unnamed.slice(0, 3).map((x) => x.n).join(" · ")}${unnamed.length > 3 ? " 외" : ""}).` +
        ` 후기 요청이 습관으로 자리 잡지 않은 곳입니다.</li>`);
    }
    if (lTop) {
      const lose = rows.filter((x) => x.l > x.s).slice(0, 3).map((x) => x.n);
      actLi.push(`<li class="warn-li">이 채널에서 <b>LG가 앞선 매장</b>이 <b>${lTop}곳</b>입니다` +
        ` (${lose.join(" · ")}). 같은 백화점 안에서 갈린 것이라` +
        ` <b>상담 접점 차이</b>로 보는 것이 맞습니다.</li>`);
    }
    actLi.push(`<li>표본은 <b>${fmtN(J.total)}건</b>으로 작지만, 이 게시판은 <b>칭찬 글</b>이 모이는 곳이라` +
      ` <b>무엇을 잘했을 때 고객이 이름까지 적는지</b>가 그대로 보입니다 —` +
      ` 우위 매장 ${sTop}곳의 후기 원문을 상담 교육 자료로 쓰세요.</li>`);

    const itemRows = Object.keys(J.items || {}).slice(0, 4).map((k) => {
      const v = J.items[k], tot = v.s + v.l, ish = pct(v.s, v.l);
      return `<li class="it-row ${v.s >= v.l ? "s" : "l"}"><span class="it-n">${k}</span>` +
        `<span class="it-bar"><i style="width:${ish}%"></i></span>` +
        `<span class="it-v">${ish}<em>%</em></span>` +
        `<span class="it-c">${fmtN(tot)}</span></li>`;
    }).join("");

    const storeLi = rows.slice(0, 5).map((x, i) => {
      const xsh = pct(x.s, x.l);
      const lead = x.s > x.l ? "s" : x.l > x.s ? "l" : "even";
      return `<button type="button" class="mr-row ${lead}" data-store="${x.n}"` +
        ` title="${x.n} — 삼성 ${x.s} vs LG ${x.l}건${x.mgr ? " · " + x.mgr.n : ""}">` +
        `<span class="mr-nm">${x.n}</span>` +
        `<span class="mr-bar"><i style="width:${xsh}%"></i></span>` +
        `<span class="mr-sh">${xsh}<u>%</u></span>` +
        `<span class="mr-n">${fmtN(x.tot)}<u>건</u></span>` +
        `<span class="mr-top${x.mgr ? "" : " off"}">${x.mgr ? x.mgr.n : "실명 없음"}</span>` +
        `</button>`;
    }).join("");

    return `<div class="ca2 jw-wrap">` +
      `<div class="cx-top">` +
      `${window.VICON ? VICON.html("jwedding", "제이웨딩") : ""}` +
      `<div class="cx-title"><h2>제이웨딩</h2>` +
      `<span>[칭찬] 혼수/선택이유 · 삼성AI가전 · ${per() ? per().label() : "전체"}</span></div>` +
      (per() ? per().bar() : "") +
      `</div>` +

      `<div class="cx-body">` +
      // 좌 — 채널 개관
      `<div class="cx-left">` +
      `<div class="cx-sum">` +
      `<div class="cx-sum-h"><h3>이 채널에서</h3><span>가전 글만 걸러 셈</span></div>` +
      `<div class="cx-sum-n"><b>${fmtN(A.t)}</b><i>건</i></div>` +
      `<div class="cx-bar big"><i class="s" style="width:${A.t ? (A.s / (A.s + A.l || 1) * 100).toFixed(1) : 50}%"></i>` +
      `<i class="l" style="width:${A.t ? (A.l / (A.s + A.l || 1) * 100).toFixed(1) : 50}%"></i></div>` +
      `<div class="cx-vs"><span class="s">삼성 ${fmtN(A.s)} <b>${sh}%</b></span>` +
      `<span class="l">LG ${fmtN(A.l)} <b>${100 - sh}%</b></span></div>` +
      /* 표본 크기를 숨기지 않는다 — 다이렉트웨딩과 나란히 놓이면 같은 무게로 읽힌다 */
      `<p class="jw-scale">다이렉트결혼준비(<b>${fmtN((window.CAFE_DATA || {}).total || 0)}건</b>)에 견주면 ` +
      `<b>표본이 훨씬 작습니다</b>. 비율은 참고로 보고, 이 채널의 강점인 ` +
      `<b>매장·담당자 지목</b>에 무게를 두세요.</p>` +
      `<p class="jw-note">${J.note}</p>` +
      `</div></div>` +

      // 우 — 매장·품목·매니저
      `<div class="cx-right">` +
      `<div class="ca-ncard">` +
      `<h4 class="ca-ch">이 채널이 지목한 매장 <i class="ca-tag">${rows.length}곳</i></h4>` +
      (storeLi ? `<div class="mr-list">${storeLi}</div>` : `<p class="fc-plain">매장이 특정된 글이 없습니다.</p>`) +
      `<p class="fc-plain">매장이 안 적힌 글 <b>${fmtN(J.unknown)}건</b>은 위 목록에서 빠졌습니다.</p>` +
      `</div>` +
      `<div class="ca-ncard">` +
      `<h4 class="ca-ch">품목 <i class="ca-tag">삼성 비중</i></h4>` +
      `<ul class="it-list">${itemRows}</ul>` +
      `</div>` +
      `<div class="ca-ncard">` +
      `<h4 class="ca-ch">현장 액션 <i class="ca-tag">담당자 이름이 남은 후기</i></h4>` +
      `<div class="mgr-vs">` +
      `<div class="mv s"><b>${fmtN(mgrS)}</b><span>삼성</span></div>` +
      `<div class="mv-mid ${mgrS >= mgrL ? "s" : "l"}"><b>${pct(mgrS, mgrL)}%</b><span>삼성 비중</span></div>` +
      `<div class="mv l"><b>${fmtN(mgrL)}</b><span>LG</span></div>` +
      `</div>` +
      `<ul class="yt-act">${actLi.join("")}</ul>` +
      `</div>` +
      `</div></div></div>`;
  }

  function paint(host) {
    if (!host || !J) return;
    host.innerHTML = render();
    if (window.VNAV) VNAV.sync();
    if (per()) per().bind(host);
    host.querySelectorAll("[data-store]").forEach((b) => b.addEventListener("click", () => {
      const nm = b.getAttribute("data-store");
      if (window.openStoreScope) window.openStoreScope(nm);
    }));
  }

  window.openJwedding = function () {
    const host = document.getElementById("channelPanel");
    const sec = document.getElementById("channel");
    if (!host || !sec || !J) return;
    if (window.VNAV) VNAV.push({ id: "jwedding", label: "제이웨딩",
      open: () => window.openJwedding() });
    paint(host);
    sec.hidden = false;
    window.setView ? setView("view-channel", "view-cx") :
      document.body.classList.add("mode-results", "view-channel", "view-cx");
    window.scrollTo({ top: 0, behavior: "auto" });
  };
})();
