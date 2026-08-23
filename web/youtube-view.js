/* 유튜브 채널 화면 (window.openYoutube)

   유튜브는 **넓은 채널**이다. 유튜브 전체를 세는 게 아니라
   혼수가전 검색어로 걸러 나온 영상만 본다(사용자 지시 2026-08-24).

   광고는 지우지 않고 갈라서 보여준다("광고는 표시만 하고 남겨줘").
   조회수 1위가 삼성전자 공식 채널의 Bespoke 광고(374만)라,
   섞어서 세면 고객 반응이 아니라 광고 노출을 재는 셈이 된다. */
(function () {
  "use strict";
  const Y = window.YOUTUBE || null;
  const fmtN = (n) => (n || 0).toLocaleString("ko-KR");
  const man = (n) => (n >= 10000 ? (n / 10000).toFixed(n >= 100000 ? 0 : 1) + "만" : fmtN(n));
  const pct = (a, b) => (a + b === 0 ? 0 : Math.round((a / (a + b)) * 100));

  /* 받침에 따라 조사를 고른다. "인덕션는"·"냉장고은" 처럼 적히면
     회사 전체가 보는 화면에서 눈에 바로 걸린다. */
  function josa(word, withBatchim, without) {
    const c = (word || "").charCodeAt((word || "").length - 1);
    if (c < 0xac00 || c > 0xd7a3) return without;      // 한글이 아니면 무난한 쪽
    return (c - 0xac00) % 28 ? withBatchim : without;
  }
  const eun = (w) => w + josa(w, "은", "는");

  function bar(sv, lv) {
    const t = sv + lv || 1;
    return `<div class="cx-bar"><i class="s" style="width:${(sv / t * 100).toFixed(1)}%"></i>` +
      `<i class="l" style="width:${(lv / t * 100).toFixed(1)}%"></i></div>`;
  }

  function render() {
    const O = Y.organic, A = Y.ad, All = Y.all;
    const shN = pct(O.s, O.l);                 // 일반 영상 기준 편수 비중
    const shV = pct(O.sv, O.lv);               // 일반 영상 기준 조회수 비중

    const topLi = (Y.top || []).slice(0, 6).map((x) => {
      const cls = x.b === "s" ? "s" : x.b === "l" ? "l" : "even";
      const tag = x.ad === "official" ? `<span class="yt-ad off">공식</span>`
        : x.ad === "sponsored" ? `<span class="yt-ad spo">협찬</span>` : "";
      return `<a class="yt-row ${cls}" href="${x.u}" target="_blank" rel="noopener"` +
        ` title="${x.t} · ${x.c} · ${fmtN(x.v)}회">` +
        `<span class="yt-v">${man(x.v)}<u>회</u></span>` +
        `<span class="yt-t">${x.t}</span>` +
        `<span class="yt-c">${x.c}</span>${tag}</a>`;
    }).join("");

    const itemLi = Object.keys(Y.items || {})
      .sort((a, b) => Y.items[b].views - Y.items[a].views).slice(0, 5)
      .map((k) => {
        const v = Y.items[k], ish = pct(v.s, v.l);
        return `<li class="it-row ${v.s >= v.l ? "s" : "l"}"><span class="it-n">${k}</span>` +
          `<span class="it-bar"><i style="width:${ish}%"></i></span>` +
          `<span class="it-v">${man(v.views)}</span>` +
          `<span class="it-c">${v.n}<em>편</em></span></li>`;
      }).join("");

    /* ── 현장 액션 ─────────────────────────────────────────────────
       사용자 지시(2026-08-24): "분석된 페이지는 인사이트가 있어야해.
       삼성스토어에서 참고할 만한 내용이 있어야 해. 사전적 의미로만
       참고할 내용 등으로 단락을 만들지는 마."

       이 화면에 있던 문장들은 '지표를 이렇게 읽어라'였다 —
       "몇 편을 올렸나와 몇 번 보였나는 다릅니다" 같은 것. 틀린 말은 아니지만
       매니저가 내일 무엇을 다르게 할지는 안 나온다.

       유튜브는 매장이 안 적히는 채널이다. 그래서 매장 비교가 아니라
       **고객이 매장에 오기 전에 무엇을 보고 오는가**로 읽는 것이 쓸모 있다. */
    const IT = Y.items || {};
    const keys = Object.keys(IT);
    // 재생수 상위 — 고객이 오기 전 가장 많이 예습한 품목
    const hot = keys.slice().sort((a, b) => IT[b].views - IT[a].views).slice(0, 3);
    // LG 영상이 더 많은 품목 — 고객이 LG 이야기를 먼저 듣고 온다
    const lgAhead = keys.filter((k) => IT[k].l > IT[k].s)
      .sort((a, b) => IT[b].views - IT[a].views).slice(0, 4);
    // 삼성 영상만 있는 품목 — 우리 쪽 정보가 앞선 자리
    const sOnly = keys.filter((k) => IT[k].s > 0 && IT[k].l === 0)
      .sort((a, b) => IT[b].views - IT[a].views).slice(0, 3);

    const actLi = [];
    if (hot.length) {
      actLi.push(`<li><b>${hot.join(" · ")}</b>${josa(hot[hot.length - 1], "은", "는")} 재생수 상위입니다` +
        ` (${hot.map((k) => man(IT[k].views)).join(" · ")}회).` +
        ` 고객은 이 품목을 <b>영상으로 예습하고</b> 옵니다 —` +
        ` 스펙 나열보다 <b>영상에 안 나오는 것</b>(설치 조건·AS·실사용 소음)을 준비하세요.</li>`);
    }
    if (lgAhead.length) {
      actLi.push(`<li class="warn-li"><b>${lgAhead.join(" · ")}</b>${josa(lgAhead[lgAhead.length - 1], "은", "는")} <b>LG 영상이 더 많습니다</b>.` +
        ` 이 품목은 고객이 LG 설명을 먼저 듣고 오므로,` +
        ` <b>비교 질문에 답할 준비</b>를 미리 해두세요.</li>`);
    }
    if (sOnly.length) {
      actLi.push(`<li><b>${sOnly.join(" · ")}</b>${josa(sOnly[sOnly.length - 1], "은", "는")} <b>삼성 영상만</b> 잡혔습니다 —` +
        ` 고객이 LG 정보를 못 보고 온 품목입니다. <b>먼저 제안</b>하기 좋습니다.</li>`);
    }
    const adPct = Math.round(A.views / (Y.views || 1) * 100);
    if (adPct >= 30) {
      actLi.push(`<li>재생수의 <b>${adPct}%</b>가 브랜드 공식·협찬 영상입니다.` +
        ` 고객이 본 것은 대체로 <b>광고</b>이지 사용 후기가 아닙니다 —` +
        ` 상담에서 <b>실제 쓴 사람의 이야기</b>를 채워주는 것이 차별점이 됩니다.</li>`);
    }

    return `<div class="ca2 yt-wrap">` +
      `<div class="cx-top">` +
      `${window.VNAV ? VNAV.bar() : ""}` +
      `<div class="cx-title"><h2>유튜브</h2>` +
      `<span>넓은 채널에서 혼수가전만 골라 봤습니다 · 영상 ${fmtN(Y.total)}편</span></div>` +
      `</div>` +

      `<div class="cx-body">` +
      `<div class="cx-left">` +
      `<div class="cx-sum">` +
      `<div class="cx-sum-h"><h3>얼마나 보였나</h3><span>걸러낸 영상 기준</span></div>` +
      `<div class="cx-sum-n"><b>${man(Y.views)}</b><i>회 재생</i></div>` +

      /* 광고를 갈라 놓는다 — 고객 반응과 광고 노출은 다른 이야기다 */
      `<div class="yt-split">` +
      `<div class="ys-k"><b>${man(O.views)}</b><span>일반 영상 ${O.n}편</span></div>` +
      `<div class="ys-k ad"><b>${man(A.views)}</b><span>광고·공식 ${A.n}편</span></div>` +
      `</div>` +
      `<p class="yt-note">조회수의 <b>${Math.round(A.views / (Y.views || 1) * 100)}%</b>가 ` +
      `브랜드 공식·협찬 영상에서 나옵니다. 아래 브랜드 비교는 <b>일반 영상만</b> 셌습니다.</p>` +

      bar(O.sv, O.lv) +
      `<div class="cx-vs"><span class="s">삼성 ${O.s}편 <b>${shV}%</b></span>` +
      `<span class="l">LG ${O.l}편 <b>${100 - shV}%</b></span></div>` +
      `<p class="yt-note">삼성은 <b>${O.s}편</b>으로 <b>${man(O.sv)}회</b>, LG는 <b>${O.l}편</b>으로 <b>${man(O.lv)}회</b> — ` +
      `편수는 비슷한데 <b>한 편당 도달</b>이 갈립니다. 고객이 더 많이 본 쪽의 설명을 듣고 매장에 옵니다.</p>` +
      `<p class="jw-note">${Y.note}</p>` +
      `</div></div>` +

      `<div class="cx-right">` +
      `<div class="ca-ncard">` +
      `<h4 class="ca-ch">많이 본 영상 <i class="ca-tag">클릭 → 유튜브</i></h4>` +
      `<div class="yt-list">${topLi}</div>` +
      `</div>` +
      `<div class="ca-ncard">` +
      `<h4 class="ca-ch">품목 <i class="ca-tag">재생수 순</i></h4>` +
      (itemLi ? `<ul class="it-list">${itemLi}</ul>`
              : `<p class="fc-plain">품목이 특정된 영상이 적습니다.</p>`) +
      `</div>` +
      `<div class="ca-ncard">` +
      `<h4 class="ca-ch">현장 액션 <i class="ca-tag">이 채널이 말해주는 것</i></h4>` +
      `<ul class="yt-act">${actLi.join("")}</ul>` +
      `</div>` +
      `</div></div></div>`;
  }

  function paint(host) {
    if (!host || !Y) return;
    host.innerHTML = render();
    if (window.VNAV) VNAV.sync();
  }

  window.openYoutube = function () {
    const host = document.getElementById("channelPanel");
    const sec = document.getElementById("channel");
    if (!host || !sec || !Y) return;
    if (window.VNAV) VNAV.push({ id: "youtube", label: "유튜브", open: () => window.openYoutube() });
    paint(host);
    sec.hidden = false;
    window.setView ? setView("view-channel", "view-cx")
      : document.body.classList.add("mode-results", "view-channel", "view-cx");
    window.scrollTo({ top: 0, behavior: "auto" });
  };
})();
