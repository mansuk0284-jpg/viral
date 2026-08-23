/* 인스타그램 채널 화면 (window.openInstagram)

   인스타는 **넓은 채널**이다. 인스타 전체를 세는 게 아니라
   혼수 해시태그로 걸러 나온 글만 본다(사용자 지시 2026-08-24).

   이 채널의 성격이 유튜브·카페와 결정적으로 다르다:
   **절반 가까이가 판매자 홍보 글이다(실측 44/69).**
   매장·업체 호객 글을 고객 후기와 섞어 세면 '고객 반응'이 아니라
   '판매자 광고량'을 재게 된다. 그래서 협찬(#광고)과 별개로 홍보/개인을 갈라 놓았다.
   지우지는 않는다 — 광고를 표시만 하고 남기는 것과 같은 원칙.

   조회수 칸이 없다. 인스타는 로그인 상태에서도 게시물 조회수를 목록에 주지 않는다.
   유튜브 화면을 그대로 베껴 조회수 칸을 억지로 채우면 없는 숫자를 지어내게 된다. */
(function () {
  "use strict";
  const G = window.INSTAGRAM || null;
  const fmtN = (n) => (n || 0).toLocaleString("ko-KR");
  const pct = (a, b) => (a + b === 0 ? 0 : Math.round((a / (a + b)) * 100));

  function bar(s, l) {
    const t = s + l || 1;
    return `<div class="cx-bar"><i class="s" style="width:${(s / t * 100).toFixed(1)}%"></i>` +
      `<i class="l" style="width:${(l / t * 100).toFixed(1)}%"></i></div>`;
  }

  function render() {
    const P = G.personal, B = G.biz, A = G.ad;
    const sh = pct(P.s, P.l);                    // 개인 글 기준 브랜드 비중
    const shAll = pct(G.all.s, G.all.l);         // 전체(홍보 포함) 기준
    const bizPct = Math.round(B.n / (G.total || 1) * 100);

    const topLi = (G.top || []).slice(0, 6).map((x) => {
      const cls = x.b === "s" ? "s" : x.b === "l" ? "l" : "even";
      const tag = x.biz ? `<span class="yt-ad off">홍보</span>`
        : x.ad ? `<span class="yt-ad spo">협찬</span>` : "";
      return `<a class="ig-row ${cls}" href="${x.u}" target="_blank" rel="noopener"` +
        ` title="${x.t}">` +
        `<span class="ig-k">${x.biz ? "판매자" : "개인"}</span>` +
        `<span class="yt-t">${x.t}</span>${tag}</a>`;
    }).join("");

    const itemLi = Object.keys(G.items || {})
      .sort((a, b) => G.items[b].n - G.items[a].n).slice(0, 5)
      .map((k) => {
        const v = G.items[k], ish = pct(v.s, v.l);
        return `<li class="it-row ${v.s >= v.l ? "s" : "l"}"><span class="it-n">${k}</span>` +
          `<span class="it-bar"><i style="width:${ish}%"></i></span>` +
          `<span class="it-v">${v.biz}<em>홍보</em></span>` +
          `<span class="it-c">${v.n}<em>건</em></span></li>`;
      }).join("");

    const stKeys = Object.keys(G.stores || {})
      .sort((a, b) => G.stores[b].n - G.stores[a].n).slice(0, 4);
    const stLi = stKeys.map((k) => {
      const v = G.stores[k];
      return `<li class="ig-st"><span class="rv-name vfit">${k}</span>` +
        `<span class="ig-sb">${v.biz}<u>/${v.n}</u></span></li>`;
    }).join("");

    return `<div class="ca2 yt-wrap">` +
      `<div class="cx-top">` +
      `${window.VNAV ? VNAV.bar() : ""}` +
      `<div class="cx-title"><h2>인스타그램</h2>` +
      `<span>넓은 채널에서 혼수가전만 골라 봤습니다 · 글 ${fmtN(G.total)}건</span></div>` +
      `</div>` +

      `<div class="cx-body">` +
      `<div class="cx-left">` +
      `<div class="cx-sum">` +
      `<div class="cx-sum-h"><h3>누가 쓴 글인가</h3><span>걸러낸 글 기준</span></div>` +
      `<div class="cx-sum-n"><b>${fmtN(G.total)}</b><i>건</i></div>` +

      /* 이 채널에서 가장 먼저 알아야 할 사실 — 절반이 파는 쪽 글이다 */
      `<div class="yt-split">` +
      `<div class="ys-k"><b>${P.n}</b><span>개인 글</span></div>` +
      `<div class="ys-k ad"><b>${B.n}</b><span>판매자 홍보</span></div>` +
      `</div>` +
      `<p class="yt-note">글의 <b>${bizPct}%</b>가 매장·업체가 올린 호객 글입니다` +
      (A.n ? ` (그와 별개로 협찬 표기 ${A.n}건)` : "") +
      `. 아래 브랜드 비교는 <b>개인 글만</b> 셌습니다.</p>` +

      /* 표본이 열 건도 안 되면 퍼센트를 말하지 않는다.
         개인 글 중 브랜드가 갈리는 건 단 5건(삼성 3 · LG 2)이다(실측).
         이걸 '60%'로 적으면 한 사람 마음이 바뀌는 것만으로 20%가 움직인다.
         회사 전체가 보는 화면이라, 없는 정밀도를 보이는 편이 더 나쁘다. */
      (P.s + P.l >= 10
        ? bar(P.s, P.l) +
          `<div class="cx-vs"><span class="s">삼성 ${P.s}건 <b>${sh}%</b></span>` +
          `<span class="l">LG ${P.l}건 <b>${100 - sh}%</b></span></div>` +
          `<p class="yt-note">홍보까지 넣으면 <b>${shAll}% : ${100 - shAll}%</b>로 달라집니다 — ` +
          `고객이 말한 양과 파는 쪽이 뿌린 양은 다른 이야기입니다.</p>`
        : `<div class="cx-vs thin"><span class="s">삼성 <b>${P.s}</b>건</span>` +
          `<span class="l">LG <b>${P.l}</b>건</span></div>` +
          `<p class="yt-note"><b>비율을 적지 않습니다.</b> 개인 글 중 브랜드가 갈리는 건 ` +
          `${P.s + P.l}건뿐입니다 — 한 사람 마음이 바뀌면 퍼센트가 크게 흔들리는 표본입니다. ` +
          `판매자 홍보까지 넣어도 삼성 ${G.all.s} · LG ${G.all.l}건입니다.</p>`) +
      `<p class="jw-note"><b>표본 ${G.total}건은 적습니다.</b> ${G.note}</p>` +
      `</div></div>` +

      `<div class="cx-right">` +
      `<div class="ca-ncard">` +
      `<h4 class="ca-ch">올라온 글 <i class="ca-tag">클릭 → 인스타</i></h4>` +
      `<div class="yt-list">${topLi}</div>` +
      `</div>` +
      `<div class="ca-ncard">` +
      `<h4 class="ca-ch">품목 <i class="ca-tag">건수 순 · 홍보 몇 건인지 함께</i></h4>` +
      (itemLi ? `<ul class="it-list">${itemLi}</ul>`
              : `<p class="fc-plain">품목이 특정된 글이 적습니다.</p>`) +
      `</div>` +
      `<div class="ca-ncard">` +
      `<h4 class="ca-ch">매장이 적힌 글 <i class="ca-tag">홍보/전체</i></h4>` +
      (stLi ? `<ul class="ig-sts">${stLi}</ul>`
            : `<p class="fc-plain">매장이 적힌 글이 없습니다.</p>`) +
      `<p class="fc-plain">매장명이 적힌 글은 <b>대개 그 매장이 올린 홍보</b>입니다 — 고객 후기가 아니라 <b>매장의 인스타 활동</b>입니다.</p>` +
      `</div>` +
      `</div></div></div>`;
  }

  function paint(host) {
    if (!host || !G) return;
    host.innerHTML = render();
    if (window.VNAV) VNAV.sync();
    if (window.VFIT) VFIT.all();   // MutationObserver 가 놓치는 첫 그림을 맞춘다
  }

  window.openInstagram = function () {
    const host = document.getElementById("channelPanel");
    const sec = document.getElementById("channel");
    if (!host || !sec || !G) return;
    if (window.VNAV) VNAV.push({ id: "instagram", label: "인스타그램", open: () => window.openInstagram() });
    paint(host);
    sec.hidden = false;
    window.setView ? setView("view-channel", "view-cx")
      : document.body.classList.add("mode-results", "view-channel", "view-cx");
    window.scrollTo({ top: 0, behavior: "auto" });
  };
})();
