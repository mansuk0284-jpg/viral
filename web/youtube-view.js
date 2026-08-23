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

  function bar(sv, lv) {
    const t = sv + lv || 1;
    return `<div class="cx-bar"><i class="s" style="width:${(sv / t * 100).toFixed(1)}%"></i>` +
      `<i class="l" style="width:${(lv / t * 100).toFixed(1)}%"></i></div>`;
  }

  function render() {
    const O = Y.organic, A = Y.ad, All = Y.all;
    const shN = pct(O.s, O.l);                 // 일반 영상 기준 편수 비중
    const shV = pct(O.sv, O.lv);               // 일반 영상 기준 조회수 비중

    const topLi = (Y.top || []).slice(0, 8).map((x) => {
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
      .sort((a, b) => Y.items[b].views - Y.items[a].views).slice(0, 6)
      .map((k) => {
        const v = Y.items[k], ish = pct(v.s, v.l);
        return `<li class="it-row ${v.s >= v.l ? "s" : "l"}"><span class="it-n">${k}</span>` +
          `<span class="it-bar"><i style="width:${ish}%"></i></span>` +
          `<span class="it-v">${man(v.views)}</span>` +
          `<span class="it-c">${v.n}<em>편</em></span></li>`;
      }).join("");

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
      `<p class="yt-note">편수로는 삼성 ${shN}% · LG ${100 - shN}%, ` +
      `재생수로는 <b>${shV}% : ${100 - shV}%</b> — 몇 편을 올렸나와 몇 번 보였나는 다릅니다.</p>` +
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
      `<h4 class="ca-ch">많이 올리는 채널</h4>` +
      `<div class="yt-chans">` +
      (Y.channels || []).map((c) => `<span class="yt-chip">${c.n}<u>${c.c}편</u></span>`).join("") +
      `</div>` +
      `<p class="fc-plain">매장이 제목에 적히는 일은 드뭅니다 — ` +
      `이 채널은 <b>매장별 비교보다 품목·브랜드 반응</b>을 보는 데 씁니다.</p>` +
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
