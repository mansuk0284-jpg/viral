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

   유튜브 목록은 업로드 날짜를 주지 않는다 — "4개월 전" 같은 상대 표기뿐이라
   처음엔 이 화면에만 '최근 1년/3년/전체' 칩을 따로 만들었다. **그게 잘못이었다.**

   사용자 지적(2026-08-24): "다른 페이지에서 기존에 잘 만들어져 있는게 있는데
   왜 채널이 다르다고 해서 새롭게 다시 하는거야. 프로그램 통일감을 위해서
   이런부분은 고려해서 ui 작업하자."

   맞는 말이다. 화면마다 기간 고르는 법이 다르면 옮겨 다닐 때마다 다시 익혀야 한다.
   그래서 **상대 표기를 근사 월로 바꿔** 다른 화면과 같은 공용 모듈(window.VPER)을 쓴다.
   근사값이라는 사실은 화면 방법론 줄에 적는다 — UI 는 통일하되 정밀도는 속이지 않는다. */
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

  /* 기간 — 다른 분석 화면과 같은 공용 모듈을 쓴다 */
  let PER = null;
  function per() {
    if (PER || !window.VPER || !Y) return PER;
    PER = VPER.create({
      months: Y.months || [],
      onChange: () => paint(document.getElementById("channelPanel")),
    });
    /* 이 채널은 54편이 5년에 걸쳐 흩어져 있다. 현재 월로 열면 0~1편이라
       화면이 비어 보인다. 표본이 작은 채널은 **전체 기간**으로 연다
       (제이웨딩에서 같은 이유로 이미 그렇게 하고 있다). */
    if (PER) PER.setAll();
    return PER;
  }
  const labOf = () => (per() ? per().label() : "전체");

  /* 고른 기간에 걸리는 영상만 — 영상은 월 정밀도라 월로 비교한다 */
  function pickCur() {
    const p = per();
    if (!p) return (Y.vids || []).slice();
    const r = p.range();
    const a = r[0].slice(0, 7), b = r[1].slice(0, 7);
    return (Y.vids || []).filter((x) => x.ym && x.ym >= a && x.ym <= b);
  }

  const sum = (g) => g.reduce((a, x) => a + x.v, 0);

  /* 채널 주인으로 셋으로 가른다 (2026-08-24 사용자 지시)
       "삼성공식채널과 lg공식채널의 컨텐츠와 일반 유투브들 채널이 있을텐데
        이것을 구분해서 분석을 해야 하겠어"

     이 구분이 핵심인 이유: 공식 채널 영상은 **우리가 튼 것**이고
     일반 창작자 영상은 **남이 말해 준 것**이다. 같은 재생수라도 뜻이 다르다.
     브랜드(영상이 어느 브랜드를 다루나)와는 다른 축이라 따로 센다. */
  function rollup(list) {
    const samOff = list.filter((x) => x.own === "sam");
    const lgOff = list.filter((x) => x.own === "lg");
    const creator = list.filter((x) => !x.own);
    // 브랜드 비교는 **창작자 영상만** — 공식 채널을 넣으면 자기 홍보를 세게 된다
    const s = creator.filter((x) => x.b === "s"), l = creator.filter((x) => x.b === "l");
    return {
      n: list.length, views: sum(list),
      samOff: samOff, lgOff: lgOff, creator: creator,
      samOffV: sum(samOff), lgOffV: sum(lgOff), creatorV: sum(creator),
      s: s, l: l, sv: sum(s), lv: sum(l),
    };
  }

  function bar(sv, lv) {
    const t = sv + lv || 1;
    return `<div class="cx-bar"><i class="s" style="width:${(sv / t * 100).toFixed(1)}%"></i>` +
      `<i class="l" style="width:${(lv / t * 100).toFixed(1)}%"></i></div>`;
  }

  /* 1·2·3위 — 썸네일 카드 (2026-08-24 사용자 지시)
       "해당 영상의 썸네일 영상을 가져와서 보여주면 더 이해가 빠를거 같아.
        ui를 메인페이지 이미지 활용처럼 카드형태를 사용해서"

     메인 화면 카드와 같은 짜임이다 — 그림 왼쪽, 설명 오른쪽.
     썸네일은 유튜브가 영상 id 로 바로 준다(i.ytimg.com). 따로 긁을 필요가 없다.
     제목만 늘어놓을 때보다 어떤 영상인지 훨씬 빨리 잡힌다. */
  function podium(list) {
    return list.slice(0, 3).map((x, i) => {
      const cls = x.b === "s" ? "s" : x.b === "l" ? "l" : "even";
      const own = x.own === "sam" ? `<span class="yt-own sam">삼성 공식</span>`
        : x.own === "lg" ? `<span class="yt-own lg">LG 공식</span>`
        : x.ad === "sponsored" ? `<span class="yt-own spo">협찬</span>`
        : `<span class="yt-own cre">일반</span>`;
      return `<a class="ytc ${cls}" href="${x.u}" target="_blank" rel="noopener"` +
        ` title="${x.t} · ${x.c} · ${fmtN(x.v)}회 · ${x.w}">` +
        `<span class="ytc-thumb"><img src="https://i.ytimg.com/vi/${x.id}/mqdefault.jpg"` +
        ` alt="" loading="lazy" draggable="false" />` +
        `<i class="ytc-rank">${i + 1}</i></span>` +
        `<span class="ytc-body">` +
        `<b class="yt-t">${x.t}</b>` +
        `<em>${x.c} · ${x.w}</em>` +
        `<span class="ytc-foot"><u>${man(x.v)}회</u>${own}</span>` +
        `</span></a>`;
    }).join("");
  }

  /* 누가 올렸나 — 삼성 공식 · LG 공식 · 일반 창작자 */
  function ownerBlock(R) {
    const t = R.views || 1;
    const cell = (lab, g, v, cls) =>
      `<div class="yo-k ${cls}"><b>${g.length}<u>편</u></b>` +
      `<span>${lab}</span><em>${man(v)}회</em></div>`;
    return `<div class="yo-grid">` +
      cell("삼성 공식", R.samOff, R.samOffV, "sam") +
      cell("LG 공식", R.lgOff, R.lgOffV, "lg") +
      cell("일반 창작자", R.creator, R.creatorV, "cre") +
      `</div>` +
      `<div class="yo-bar">` +
      `<i class="sam" style="width:${(R.samOffV / t * 100).toFixed(1)}%"></i>` +
      `<i class="lg" style="width:${(R.lgOffV / t * 100).toFixed(1)}%"></i>` +
      `<i class="cre" style="width:${(R.creatorV / t * 100).toFixed(1)}%"></i>` +
      `</div>`;
  }

  /* 삼성 vs LG 나란히 — 사용자 지시: "경쟁사의 영상도 어떤지 대조해서" */
  function vsCol(side, list) {
    const lab = side === "s" ? "삼성" : "LG";
    const tot = list.reduce((a, x) => a + x.v, 0);
    const rows = list.slice(0, 2).map((x, i) =>
      `<a class="yv-row" href="${x.u}" target="_blank" rel="noopener" title="${x.t} · ${fmtN(x.v)}회 · ${x.w}">` +
      `<i>${i + 1}</i><b class="yt-t">${x.t}</b><em>${man(x.v)}</em></a>`).join("");
    return `<div class="yv-col ${side}">` +
      `<div class="yv-h"><span>${lab}</span><b>${list.length}<u>편</u></b><b>${man(tot)}<u>회</u></b></div>` +
      (rows || `<p class="yv-none">이 기간에 ${lab} 영상이 없습니다</p>`) +
      `</div>`;
  }

  function render() {
    const cur = pickCur(), R = rollup(cur);
    const all = rollup(Y.vids || []);
    const byViews = cur.slice().sort((a, b) => b.v - a.v);
    const sTop = R.s.slice().sort((a, b) => b.v - a.v);
    const lTop = R.l.slice().sort((a, b) => b.v - a.v);
    const brandN = R.s.length + R.l.length;
    const shN = pct(R.s.length, R.l.length);
    const shV = pct(R.sv, R.lv);
    const offV = R.samOffV + R.lgOffV;              // 공식 채널 재생수
    const offPct = R.views ? Math.round(offV / R.views * 100) : 0;

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
    if (cur.length < (Y.vids || []).length && brandN >= 5 && Math.abs(shN - allShN) >= 12) {
      act.push(shN < allShN
        ? `<li class="warn-li">전체 기간으로는 삼성 ${allShN}% 인데 <b>${labOf()}만 보면 ${shN}%</b>입니다 —` +
          ` <b>최근 올라오는 영상은 LG 쪽이 많습니다</b>. 고객이 요즘 보는 설명이 바뀌고 있습니다.</li>`
        : `<li>전체 ${allShN}% → <b>${labOf()} ${shN}%</b>로 삼성 비중이 올랐습니다 —` +
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
          (R.samOffV ? ` — 삼성은 <b>공식 채널 ${man(R.samOffV)}회</b>로 도달하지만` +
            ` <b>남이 말해 주는 영상</b>은 거의 없습니다.` : ` — 격차가 큽니다.`) +
          ` 고객은 우리를 <b>광고로</b>, 상대를 <b>후기로</b> 만나고 있습니다.</li>`
        : `<li>일반 영상 재생수가 <b>삼성 ${man(R.sv)}회 vs LG ${man(R.lv)}회</b>로 앞섭니다 —` +
          ` <b>남이 말해 주는 영상</b>이 우리 쪽에 많습니다. 상담에서 그 영상을 근거로 쓰세요.</li>`);
    }
    if (byViews.length && (byViews[0].own || byViews[0].ad)) {
      const w = byViews[0].own === "sam" ? "삼성 공식 채널"
        : byViews[0].own === "lg" ? "LG 공식 채널" : "협찬";
      act.push(`<li>이 기간 1위는 <b>${w} 영상</b>입니다 (${man(byViews[0].v)}회).` +
        ` 고객이 가장 많이 본 것은 <b>브랜드가 만든 것</b>이지 사용 후기가 아닙니다 —` +
        ` 상담에서 <b>실제 쓴 사람의 이야기</b>를 채워주는 것이 차별점이 됩니다.</li>`);
    }
    /* 공식 채널이 한쪽만 잡힌다면 그 자체가 신호다 —
       실측: 삼성 공식 3편 383만회 vs LG 공식 0편. */
    if (R.samOff.length && !R.lgOff.length) {
      act.push(`<li>혼수가전 검색에서 <b>삼성 공식 채널은 ${R.samOff.length}편(${man(R.samOffV)}회)</b>이 잡히는데` +
        ` <b>LG 공식은 한 편도 없습니다</b>. 브랜드 노출은 우리가 앞서니,` +
        ` 상담에서 <b>그 영상을 보고 왔는지</b> 물어 대화를 열 수 있습니다.</li>`);
    } else if (R.lgOff.length && !R.samOff.length) {
      act.push(`<li class="warn-li">혼수가전 검색에서 <b>LG 공식 채널만 ${R.lgOff.length}편</b> 잡히고` +
        ` 삼성 공식은 없습니다 — 고객이 브랜드 설명을 <b>상대 쪽에서</b> 먼저 듣습니다.</li>`);
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

    return `<div class="ca2 yt-wrap">` +
      `<div class="cx-top">` +
      `${window.VICON ? VICON.html("youtube", "유튜브") : ""}` +
      `<div class="cx-title"><h2>유튜브</h2>` +
      `<span>넓은 채널에서 혼수가전만 골라 봤습니다 · 영상 ${fmtN(Y.total)}편</span></div>` +
      `${per() ? per().bar() : ""}` +
      `</div>` +

      `<div class="cx-body">` +
      `<div class="cx-left">` +
      `<div class="cx-sum">` +
      `<div class="cx-sum-h"><h3>얼마나 보였나</h3><span>${labOf()} · ${R.n}편</span></div>` +
      `<div class="cx-sum-n"><b>${man(R.views)}</b><i>회 재생</i></div>` +

      ownerBlock(R) +
      (offPct ? `<p class="yt-note">재생수의 <b>${offPct}%</b>가 <b>브랜드 공식 채널</b>에서 나옵니다. ` +
        `아래 브랜드 비교는 <b>일반 창작자 영상만</b> 셌습니다 — ` +
        `공식 채널을 넣으면 자기 홍보를 세게 됩니다.</p>` : "") +

      (brandN ? bar(R.sv, R.lv) +
        `<div class="cx-vs"><span class="s">삼성 ${R.s.length}편</span>` +
        `<span class="l">LG ${R.l.length}편</span></div>` +
        (brandN >= 10
          ? `<p class="yt-note">편수 <b>${shN}:${100 - shN}</b> · 재생수 <b>${shV}:${100 - shV}</b> — ` +
            `한 편당 도달이 갈립니다.</p>`
          : `<p class="yt-note">브랜드가 갈리는 영상 <b>${brandN}편</b> — 비율은 적지 않습니다.</p>`)
        : `<p class="yt-note">이 기간에는 브랜드가 갈리는 영상이 없습니다.</p>`) +
      `<p class="jw-note">유튜브는 업로드 날짜를 주지 않아 “4개월 전” 같은 상대 표기를 <b>월로 환산</b>했습니다 — 월 단위는 <b>근사값</b>입니다. ${Y.note}</p>` +
      `</div></div>` +

      `<div class="cx-right">` +
      `<div class="ca-ncard">` +
      `<h4 class="ca-ch">많이 본 영상 <i class="ca-tag">${labOf()} · 클릭 → 유튜브</i></h4>` +
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
    /* 기간 칩 클릭 위임 — 이 화면이 방금 그린 칩 묶음에만 붙는다.
       공유 컨테이너에 붙이면 다른 화면의 기간 클릭까지 가로챈다(실측 사고). */
    if (per()) per().bind(host);
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
