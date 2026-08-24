/* 유튜브 채널 화면 (window.openYoutube)

   유튜브는 **넓은 채널**이다. 유튜브 전체를 세는 게 아니라
   혼수가전 검색어로 걸러 나온 영상만 본다(사용자 지시 2026-08-24).

   광고는 지우지 않고 갈라서 보여준다("광고는 표시만 하고 남겨줘").
   조회수 1위가 삼성전자 공식 채널의 Bespoke 광고(374만)라,
   섞어서 세면 고객 반응이 아니라 광고 노출을 재는 셈이 된다.

   ── 기간에 대하여 (2026-08-24 사용자 지시) ──
   "어떤 영상이 많이 보았다고 할 경우 기간이 설정되어야 하고"

   맞는 지적이다. 5년 된 영상의 92만 회와 4개월 된 영상의 374만 회를
   같은 줄에 놓으면 무엇이 지금 도는 이야기인지 알 수 없다.

   다만 유튜브 목록은 업로드 **날짜를 주지 않는다** — "4개월 전" 같은
   상대 표기뿐이다. 그래서 다른 화면처럼 달력 월로 자를 수 없다.
   월 단위 탭을 붙이면 없는 정밀도를 있는 것처럼 보이게 되므로,
   **영상 나이 구간**(최근 1년·3년·전체)으로만 고른다. */
(function () {
  "use strict";
  const Y = window.YOUTUBE || null;
  const fmtN = (n) => (n || 0).toLocaleString("ko-KR");
  const man = (n) => (n >= 10000 ? (n / 10000).toFixed(n >= 100000 ? 0 : 1) + "만" : fmtN(n));
  const pct = (a, b) => (a + b === 0 ? 0 : Math.round((a / (a + b)) * 100));
  function josa(w, withB, without) {
    const c = (w || "").charCodeAt((w || "").length - 1);
    if (c < 0xac00 || c > 0xd7a3) return without;
    return (c - 0xac00) % 28 ? withB : without;
  }

  /* 나이 구간 — 6개월은 브랜드가 갈리는 영상이 2편뿐이라(실측) 넣지 않는다.
     고를 수는 있는데 고르면 아무 말도 못 하는 구간은 두지 않는 편이 낫다. */
  const SPANS = [
    { k: 12, lab: "최근 1년" },
    { k: 36, lab: "최근 3년" },
    { k: 9999, lab: "전체" },
  ];
  let span = 12;                      // 첫 진입은 최근 1년
  const labOf = (k) => (SPANS.find((x) => x.k === k) || SPANS[0]).lab;

  const pick = (k) => (Y.vids || []).filter((x) => x.ago != null && x.ago <= k);

  function rollup(list) {
    const org = list.filter((x) => !x.ad);
    const ads = list.filter((x) => x.ad);
    const s = org.filter((x) => x.b === "s"), l = org.filter((x) => x.b === "l");
    return {
      n: list.length, views: list.reduce((a, x) => a + x.v, 0),
      org: org, ads: ads,
      adViews: ads.reduce((a, x) => a + x.v, 0),
      s: s, l: l,
      sv: s.reduce((a, x) => a + x.v, 0), lv: l.reduce((a, x) => a + x.v, 0),
    };
  }

  function bar(sv, lv) {
    const t = sv + lv || 1;
    return `<div class="cx-bar"><i class="s" style="width:${(sv / t * 100).toFixed(1)}%"></i>` +
      `<i class="l" style="width:${(lv / t * 100).toFixed(1)}%"></i></div>`;
  }

  /* 1·2·3위 — 순위를 크게 세운다.
     사용자 지시: "1위, 2위, 3위가 좀 더 직관적으로 빠르게 알 수 있도록".
     전에는 조회수만 왼쪽에 적혀 있어 몇 위인지 세어 봐야 알 수 있었다. */
  function podium(list) {
    return list.slice(0, 3).map((x, i) => {
      const cls = x.b === "s" ? "s" : x.b === "l" ? "l" : "even";
      const tag = x.ad === "official" ? `<span class="yt-ad off">공식</span>`
        : x.ad === "sponsored" ? `<span class="yt-ad spo">협찬</span>` : "";
      return `<a class="yt-pod ${cls}" href="${x.u}" target="_blank" rel="noopener"` +
        ` title="${x.t} · ${x.c} · ${fmtN(x.v)}회 · ${x.w}">` +
        `<span class="yp-rank">${i + 1}</span>` +
        `<span class="yp-mid"><b class="yt-t">${x.t}</b><em>${x.c} · ${x.w}</em></span>` +
        `<span class="yp-v">${man(x.v)}<u>회</u>${tag}</span></a>`;
    }).join("");
  }

  /* 삼성 vs LG 나란히 — 사용자 지시: "경쟁사의 영상도 어떤지 대조해서" */
  function vsCol(side, list) {
    const lab = side === "s" ? "삼성" : "LG";
    const tot = list.reduce((a, x) => a + x.v, 0);
    const rows = list.slice(0, 3).map((x, i) =>
      `<a class="yv-row" href="${x.u}" target="_blank" rel="noopener" title="${x.t} · ${fmtN(x.v)}회 · ${x.w}">` +
      `<i>${i + 1}</i><b class="yt-t">${x.t}</b><em>${man(x.v)}</em></a>`).join("");
    return `<div class="yv-col ${side}">` +
      `<div class="yv-h"><span>${lab}</span><b>${list.length}<u>편</u></b><b>${man(tot)}<u>회</u></b></div>` +
      (rows || `<p class="yv-none">이 기간에 ${lab} 영상이 없습니다</p>`) +
      `</div>`;
  }

  function render() {
    const cur = pick(span), R = rollup(cur);
    const all = rollup(pick(9999));
    const byViews = cur.slice().sort((a, b) => b.v - a.v);
    const sTop = R.s.slice().sort((a, b) => b.v - a.v);
    const lTop = R.l.slice().sort((a, b) => b.v - a.v);
    const brandN = R.s.length + R.l.length;
    const shN = pct(R.s.length, R.l.length);
    const shV = pct(R.sv, R.lv);
    const adPct = R.views ? Math.round(R.adViews / R.views * 100) : 0;

    /* 품목은 고른 기간 안에서 다시 센다 — 전체 기간 수치를 그대로 두면
       기간을 바꿔도 품목 이야기만 그대로라 앞뒤가 어긋난다. */
    const IT = {};
    cur.forEach((x) => {
      if (!x.it) return;
      const v = IT[x.it] || (IT[x.it] = { n: 0, views: 0, s: 0, l: 0 });
      v.n++; v.views += x.v;
      if (x.b === "s") v.s++; else if (x.b === "l") v.l++;
    });
    const hot = Object.keys(IT).sort((a, b) => IT[b].views - IT[a].views).slice(0, 3);
    const lgAhead = Object.keys(IT).filter((k) => IT[k].l > IT[k].s)
      .sort((a, b) => IT[b].views - IT[a].views).slice(0, 4);

    /* ── 현장 액션 ── 지표 읽는 법이 아니라 내일 무엇을 다르게 할지를 적는다. */
    const act = [];
    const allShN = pct(all.s.length, all.l.length);
    if (span !== 9999 && brandN >= 5 && Math.abs(shN - allShN) >= 12) {
      act.push(shN < allShN
        ? `<li class="warn-li">전체 기간으로는 삼성 ${allShN}% 인데 <b>${labOf(span)}만 보면 ${shN}%</b>입니다 —` +
          ` <b>최근 올라오는 영상은 LG 쪽이 많습니다</b>. 고객이 요즘 보는 설명이 바뀌고 있습니다.</li>`
        : `<li>전체 ${allShN}% → <b>${labOf(span)} ${shN}%</b>로 삼성 비중이 올랐습니다 —` +
          ` 최근 영상이 우리 쪽으로 기울고 있습니다.</li>`);
    }
    /* 이 채널에서 가장 중요한 대비 —
       삼성은 공식 광고로 도달하는데 일반 창작자 영상은 거의 없다(실측:
       최근 1년 삼성 일반 2편 3,200회 vs LG 6편 34만회, 100배).
       광고는 우리가 튼 것이고 일반 영상은 남이 말해 준 것이라,
       고객이 '남의 이야기'로 만나는 브랜드가 누구인지가 여기서 갈린다. */
    if (R.sv && R.lv && Math.max(R.sv, R.lv) >= Math.min(R.sv, R.lv) * 4) {
      const weLose = R.sv < R.lv;
      act.push(weLose
        ? `<li class="warn-li">일반 영상 재생수가 <b>삼성 ${man(R.sv)}회 vs LG ${man(R.lv)}회</b>입니다` +
          (R.adViews ? ` — 삼성은 <b>공식 광고 ${man(R.adViews)}회</b>로 도달하지만` +
            ` <b>남이 말해 주는 영상</b>은 거의 없습니다.` : ` — 격차가 큽니다.`) +
          ` 고객은 우리를 <b>광고로</b>, 상대를 <b>후기로</b> 만나고 있습니다.</li>`
        : `<li>일반 영상 재생수가 <b>삼성 ${man(R.sv)}회 vs LG ${man(R.lv)}회</b>로 앞섭니다 —` +
          ` <b>남이 말해 주는 영상</b>이 우리 쪽에 많습니다. 상담에서 그 영상을 근거로 쓰세요.</li>`);
    }
    if (byViews.length && byViews[0].ad) {
      act.push(`<li>이 기간 1위는 <b>${byViews[0].ad === "official" ? "브랜드 공식" : "협찬"} 영상</b>입니다` +
        ` (${man(byViews[0].v)}회). 고객이 가장 많이 본 것은 <b>광고</b>이지 사용 후기가 아닙니다 —` +
        ` 상담에서 <b>실제 쓴 사람의 이야기</b>를 채워주는 것이 차별점이 됩니다.</li>`);
    }
    if (hot.length) {
      act.push(`<li><b>${hot.join(" · ")}</b>${josa(hot[hot.length - 1], "은", "는")} 재생수 상위입니다.` +
        ` 고객은 이 품목을 <b>영상으로 예습하고</b> 옵니다 —` +
        ` 스펙 나열보다 <b>영상에 안 나오는 것</b>(설치 조건·AS·실사용 소음)을 준비하세요.</li>`);
    }
    if (lgAhead.length) {
      act.push(`<li class="warn-li"><b>${lgAhead.join(" · ")}</b>${josa(lgAhead[lgAhead.length - 1], "은", "는")}` +
        ` <b>LG 영상이 더 많습니다</b>. 비교 질문에 답할 준비를 미리 해두세요.</li>`);
    }
    if (brandN && brandN < 10) {
      act.push(`<li>이 기간 브랜드가 갈리는 영상은 <b>${brandN}편</b>뿐이라 비율은 참고만 하세요 —` +
        ` <b>어떤 영상이 도는지</b>를 보는 편이 정확합니다.</li>`);
    }

    const chips = SPANS.map((s) =>
      `<button type="button" class="yt-sp${s.k === span ? " on" : ""}" data-ytspan="${s.k}">${s.lab}</button>`).join("");

    return `<div class="ca2 yt-wrap">` +
      `<div class="cx-top">` +
      `${window.VNAV ? VNAV.bar() : ""}` +
      `<div class="cx-title"><h2>유튜브</h2>` +
      `<span>넓은 채널에서 혼수가전만 골라 봤습니다 · 영상 ${fmtN(Y.total)}편</span></div>` +
      `<div class="yt-spans" role="group" aria-label="영상 나이">${chips}</div>` +
      `</div>` +

      `<div class="cx-body">` +
      `<div class="cx-left">` +
      `<div class="cx-sum">` +
      `<div class="cx-sum-h"><h3>얼마나 보였나</h3><span>${labOf(span)} · ${R.n}편</span></div>` +
      `<div class="cx-sum-n"><b>${man(R.views)}</b><i>회 재생</i></div>` +

      `<div class="yt-split">` +
      `<div class="ys-k"><b>${man(R.views - R.adViews)}</b><span>일반 ${R.org.length}편</span></div>` +
      `<div class="ys-k ad"><b>${man(R.adViews)}</b><span>광고·공식 ${R.ads.length}편</span></div>` +
      `</div>` +
      (adPct ? `<p class="yt-note">재생수의 <b>${adPct}%</b>가 브랜드 공식·협찬입니다. ` +
        `아래 브랜드 비교는 <b>일반 영상만</b> 셌습니다.</p>` : "") +

      (brandN ? bar(R.sv, R.lv) +
        `<div class="cx-vs"><span class="s">삼성 ${R.s.length}편</span>` +
        `<span class="l">LG ${R.l.length}편</span></div>` +
        (brandN >= 10
          ? `<p class="yt-note">편수 <b>${shN}:${100 - shN}</b> · 재생수 <b>${shV}:${100 - shV}</b> — ` +
            `한 편당 도달이 갈립니다.</p>`
          : `<p class="yt-note">브랜드가 갈리는 영상 <b>${brandN}편</b> — 비율은 적지 않습니다.</p>`)
        : `<p class="yt-note">이 기간에는 브랜드가 갈리는 영상이 없습니다.</p>`) +
      `<p class="jw-note">업로드 날짜가 상대 표기라 <b>영상 나이</b>로 자릅니다. ${Y.note}</p>` +
      `</div></div>` +

      `<div class="cx-right">` +
      `<div class="ca-ncard">` +
      `<h4 class="ca-ch">많이 본 영상 <i class="ca-tag">${labOf(span)} · 클릭 → 유튜브</i></h4>` +
      (byViews.length ? `<div class="yt-podium">${podium(byViews)}</div>`
        : `<p class="fc-plain">이 기간 영상이 없습니다.</p>`) +
      `</div>` +
      `<div class="ca-ncard">` +
      `<h4 class="ca-ch">삼성 vs LG <i class="ca-tag">각 상위 3편</i></h4>` +
      `<div class="yv-grid">${vsCol("s", sTop)}${vsCol("l", lTop)}</div>` +
      `</div>` +
      `<div class="ca-ncard">` +
      `<h4 class="ca-ch">현장 액션 <i class="ca-tag">이 채널이 말해주는 것</i></h4>` +
      `<ul class="yt-act">${act.join("")}</ul>` +
      `</div>` +
      `</div></div></div>`;
  }

  function paint(host) {
    if (!host || !Y) return;
    host.innerHTML = render();
    if (window.VNAV) VNAV.sync();
    if (window.VFIT) VFIT.all();
    /* 기간 칩은 이 화면이 그린 묶음에만 붙인다 —
       공유 컨테이너(#channelPanel)에 붙이면 다른 화면의 클릭까지 가로챈다(실측 사고). */
    const box = host.querySelector(".yt-spans");
    if (box && !box.dataset.bound) {
      box.dataset.bound = "1";
      box.addEventListener("click", (e) => {
        const b = e.target.closest("[data-ytspan]");
        if (!b) return;
        span = parseInt(b.getAttribute("data-ytspan"), 10);
        paint(host);
      });
    }
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
