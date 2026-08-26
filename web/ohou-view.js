/* 오늘의집 채널 화면 (window.openOhou)

   이 채널은 다른 채널과 **묻는 것이 다르다**(2026-08-26 신설).
   집들이·콘텐츠 카드라 매장 단서가 사실상 없고(집들이 3·콘텐츠 179),
   게시일도 공개되지 않는다. 그래서:
     · 매장 드릴을 만들지 않는다 — 없는 축을 만들면 화면이 거짓말을 한다
     · 기간 탭을 두지 않는다 — 없는 정밀도를 눈금으로 만들지 않는다
   대신 이 채널의 강점인 **모델·색상·공간 트렌드**를 본다:
   "어떤 모델이 신혼집 사진에 실제로 놓이는가."

   양식은 유튜브·인스타와 같은 공통 문법(좌측 요약·트렌드/우측 카드·종합 진단
   ·실행 제안 역할별)을 따른다. */
(function () {
  "use strict";
  const O = window.OHOU || null;
  const fmtN = (n) => (n || 0).toLocaleString("ko-KR");
  const pct = (a, b) => (a + b === 0 ? 0 : Math.round((a / (a + b)) * 100));
  const josa = (w, a, b) => {
    const c = (w || "").charCodeAt((w || "").length - 1);
    if (c < 0xac00 || c > 0xd7a3) return b;
    return (c - 0xac00) % 28 ? a : b;
  };

  const rolePlan = (hq, team, store) =>
    `<div class="cy-sec"><h5>실행 제안 <i>역할별</i></h5><ul class="role-plan">` +
    `<li class="rp-hq"><em>본사</em><span>${hq}</span></li>` +
    `<li class="rp-team"><em>영업팀</em><span>${team}</span></li>` +
    `<li class="rp-store"><em>매장</em><span>${store}</span></li>` +
    `</ul></div>`;

  /* 글 카드 — 오늘의집 검색 카드에는 제목 필드가 없고 썸네일도 지연로딩
     자리표시자(1x1)만 잡힌다(실측). 그래서 **글 첫 문장**을 제목처럼 보여주고,
     없는 그림은 만들지 않는다. 대신 종류(집들이/콘텐츠)와 브랜드를 배지로 가른다. */
  function cards(list) {
    return list.slice(0, 6).map((x, i) => {
      const cls = x.b === "s" ? "s" : x.b === "l" ? "l" : "even";
      const brand = x.b === "s" ? `<span class="yt-own sam">삼성</span>`
        : x.b === "l" ? `<span class="yt-own lg">LG</span>` : "";
      const kind = x.ad ? `<span class="yt-own spo">광고 표기</span>`
        : x.k === "projects" ? `<span class="yt-own cre">집들이</span>`
        : `<span class="yt-own cre">콘텐츠</span>`;
      return `<a class="yv-row oh-row ${cls}" href="${x.u}" target="_blank" rel="noopener" title="${x.t}">` +
        `<i>${i + 1}</i><b class="yt-t">${x.t}</b>` +
        `<em class="oh-tags">${brand}${kind}</em></a>`;
    }).join("");
  }

  function render() {
    const posts = O.posts || [];
    const sh = pct(O.s, O.l);
    const M = O.models || {}, IT = O.items || {}, SP = O.spaces || {};
    const mTop = Object.keys(M).sort((a, b) => M[b].n - M[a].n);
    const itTop = Object.keys(IT).sort((a, b) => IT[b].n - IT[a].n).slice(0, 5);
    const spTop = Object.keys(SP).sort((a, b) => SP[b].n - SP[a].n);
    const samM = mTop.filter((k) => M[k].b === "s").slice(0, 3);
    const lgM = mTop.filter((k) => M[k].b === "l").slice(0, 3);

    /* 좌측 트렌드 불릿 — 전부 실데이터(모델 언급 수)에서만 */
    const bullets = [];
    if (mTop.length) bullets.push(`가장 많이 등장한 모델은 <b>${mTop[0]}</b>(${fmtN(M[mTop[0]].n)}건)입니다.`);
    if (samM.length && lgM.length) {
      bullets.push(`삼성 라인은 <b>${samM.join(" · ")}</b>, LG 라인은 <b class="warn">${lgM.join(" · ")}</b>${josa(lgM[lgM.length - 1], "이", "가")} 눈에 띕니다.`);
    }
    if (itTop.length) bullets.push(`품목은 <b>${itTop.slice(0, 3).join(" · ")}</b> 순으로 다뤄졌습니다.`);
    if (spTop.length) bullets.push(`공간은 <b>${spTop[0]}</b>(${fmtN(SP[spTop[0]].n)}건)이 가장 많이 언급됐습니다.`);

    /* 종합 진단 — 보고서형 문어체(사실 → 해석 → 시사점) */
    const secs = [];
    secs.push(`<div class="cy-sec"><h5>채널 성격</h5><p class="cy-note">` +
      `수집된 <b>${fmtN(O.total)}건</b>은 콘텐츠 ${fmtN(O.cont)}건 · 집들이 ${fmtN(O.proj)}건으로, ` +
      `대부분 시공·인테리어 사진에 가전이 함께 놓인 글입니다. 매장이나 구매처가 적히는 일이 거의 없어 ` +
      `이 채널은 매장 비교가 아니라 <b>어떤 모델이 신혼집 사진에 실제로 놓이는가</b>를 보는 창으로 씁니다.</p></div>`);
    secs.push(`<div class="cy-sec"><h5>브랜드 노출</h5><p class="cy-note">` +
      (O.s + O.l >= 10
        ? `브랜드가 갈리는 글은 삼성 <b>${fmtN(O.s)}건</b> 대 LG <b${sh >= 50 ? "" : ' class="warn"'}>${fmtN(O.l)}건</b>(삼성 ${sh}%)입니다. ` +
          (sh === 50 ? `양쪽이 같은 수준으로, 인테리어 맥락에서는 어느 한쪽이 시각적 우위를 쥐고 있지 않습니다.`
            : sh > 50 ? `인테리어 사진에서 우리 제품이 조금 더 자주 보입니다 — 공간 사진은 오래 회자되므로 이 우위는 누적됩니다.`
            : `<b class="warn">상대 제품이 더 자주 보입니다</b> — 신혼집 이미지를 찾아보는 고객이 먼저 만나는 그림이 상대 쪽이라는 뜻입니다.`)
        : `브랜드가 갈리는 글이 적어 비율 대신 건수로만 적습니다(삼성 ${O.s} : LG ${O.l}).`) + `</p></div>`);
    if (mTop.length >= 2) {
      const t0 = mTop[0], t1 = mTop[1];
      secs.push(`<div class="cy-sec"><h5>모델 트렌드</h5><p class="cy-note">` +
        `<b>${t0}</b>(${fmtN(M[t0].n)}건)과 <b>${t1}</b>(${fmtN(M[t1].n)}건)이 가장 많이 언급됐습니다. ` +
        `오늘의집에서 모델명이 자주 나온다는 것은 그 제품이 <b>공간 사진의 주인공</b>이 되고 있다는 뜻입니다 — ` +
        `상담에서 고객이 “사진에서 본 그것”을 말할 때 바로 알아듣고 실물로 연결하면 대화가 빨라집니다.</p></div>`);
    }
    if (spTop.length) {
      const s0 = spTop[0], v = SP[s0];
      secs.push(`<div class="cy-sec"><h5>공간 맥락</h5><p class="cy-note">` +
        `가전이 함께 언급된 공간은 <b>${spTop.map((k) => `${k}(${SP[k].n})`).join(" · ")}</b> 순입니다. ` +
        `${s0}${josa(s0, "은", "는")} 가전과 가구가 한 화면에 놓이는 자리라, 고객은 성능보다 <b>치수·색·라인</b>을 먼저 봅니다 — ` +
        `상담에서 도면·컬러 매칭을 함께 다루면 이 채널을 보고 온 고객에게 특히 잘 통합니다.</p></div>`);
    }
    if (O.ad) {
      secs.push(`<div class="cy-sec"><h5>광고 표기</h5><p class="cy-note">` +
        `광고·협찬 표기가 확인된 글은 <b class="warn">${fmtN(O.ad)}건</b>입니다. ` +
        `표기가 없어도 브랜드 협업 콘텐츠가 섞일 수 있는 채널이므로, 노출량을 고객 반응으로 그대로 읽지 않는 편이 안전합니다.</p></div>`);
    }
    secs.push(rolePlan(
      lgM.length && sh < 50
        ? `인테리어 이미지에서 <b class="warn">${lgM[0]}</b> 계열 노출이 앞섭니다 — <b>공간 연출 콘텐츠</b>(키친핏·빌트인 매칭 사진) 제작 지원이 필요합니다.`
        : `<b>${mTop[0] || "주요 모델"}</b>${josa(mTop[0] || "주요 모델", "이", "가")} 공간 사진의 중심입니다 — 이 라인의 연출 이미지를 매장 전시·상담 자료로 배포할 만합니다.`,
      spTop.length
        ? `<b>${spTop[0]}</b> 중심의 배치·치수 상담 사례를 교육 자료로 공유하세요 — 이 채널 고객은 성능보다 공간 맞춤을 먼저 묻습니다.`
        : `공간 맥락 표본이 적습니다 — 이 채널은 참고 지표로만 쓰세요.`,
      `“사진에서 본 그 모델”을 고객이 말할 때 <b>모델명·색상까지 바로 짚어</b> 실물 전시로 연결하세요.`));

    return `<div class="ca2 yt-wrap oh-wrap">` +
      `<div class="cx-top">` +
      `${window.VICON ? VICON.html("ohou", "오늘의집") : ""}` +
      `<div class="cx-title"><h2>오늘의집</h2>` +
      `<span>넓은 채널에서 혼수가전만 골라 봤습니다 · 글 ${fmtN(O.total)}건</span></div>` +
      `</div>` +

      `<div class="cx-body">` +
      `<div class="cx-left">` +
      `<div class="cx-sum">` +
      `<div class="rv-head"><h3>오늘의집</h3><span>모델·공간 트렌드 · 전체 기간</span></div>` +
      `<div class="nsc-total"><b>${fmtN(O.total)}</b><i>건 분석</i></div>` +

      `<div class="nsc-sec"><h4 class="nsc-st">브랜드 노출<i>글 기준</i></h4>` +
      `<div class="nsc-ends"><span class="s">삼성</span><span class="l">LG</span></div>` +
      `<div class="nh-bar"><i class="s" style="width:${sh}%"></i><i class="l" style="width:${100 - sh}%"></i></div>` +
      `<div class="nsc-nums"><span class="s"><b>${fmtN(O.s)}건</b>${O.s + O.l >= 10 ? `<i>(${sh}%)</i>` : ""}</span>` +
      `<span class="l"><b>${fmtN(O.l)}건</b>${O.s + O.l >= 10 ? `<i>(${100 - sh}%)</i>` : ""}</span></div>` +
      (O.ad ? `<p class="nsc-foot">광고·협찬 표기 <b class="warn">${fmtN(O.ad)}건</b>이 포함돼 있습니다.</p>` : "") +
      `</div>` +

      `<div class="nsc-sec"><h4 class="nsc-st">기간 구분</h4>` +
      `<p class="nsc-foot">오늘의집은 <b>게시일을 공개하지 않아</b> 기간 탭을 두지 않습니다 — ` +
      `이 화면은 <b>수집 시점까지의 누적</b>입니다. 없는 날짜를 눈금으로 만들지 않기 위한 선택입니다.</p></div>` +

      (bullets.length ? `<div class="yt-trend"><h4>이 채널의 트렌드</h4>` +
        `<ul>${bullets.slice(0, 4).map((b) => `<li>${b}</li>`).join("")}</ul></div>` : "") +
      `<p class="jw-note">${O.note}</p>` +
      `</div></div>` +

      `<div class="cx-right">` +
      `<div class="ca-ncard"><h4 class="ca-ch">모델 언급 순위 <i class="ca-tag">공간 사진의 주인공</i></h4>` +
      (mTop.length ? `<ul class="it-list">` + mTop.slice(0, 6).map((k) => {
        const v = M[k], w = Math.round(v.n / M[mTop[0]].n * 100);
        return `<li class="it-row ${v.b === "l" ? "l" : "s"}"><span class="it-n">${k}</span>` +
          `<span class="it-bar"><i style="width:${w}%"></i></span>` +
          `<span class="it-v">${v.b === "s" ? "삼성" : v.b === "l" ? "LG" : "공통"}</span>` +
          `<span class="it-c">${fmtN(v.n)}<em>건</em></span></li>`;
      }).join("") + `</ul>` : `<p class="fc-plain">모델 언급이 확인되지 않았습니다.</p>`) + `</div>` +
      `<div class="ca-ncard"><h4 class="ca-ch">대표 글 <i class="ca-tag">클릭 → 원문</i></h4>` +
      (posts.length ? `<div class="yv-col oh-list">${cards(posts)}</div>`
        : `<p class="fc-plain">수집된 글이 없습니다.</p>`) + `</div>` +
      `<div class="ca-ncard yt-rep"><h4 class="ca-ch">종합 진단 <i class="ca-tag">전체 기간</i></h4>` +
      secs.join("") + `</div>` +
      `</div></div></div>`;
  }

  function paint(host) {
    if (!host || !O) return;
    host.innerHTML = render();
    if (window.VNAV) VNAV.sync();
    if (window.VFIT) VFIT.all();
  }

  window.openOhou = function () {
    const host = document.getElementById("channelPanel");
    const sec = document.getElementById("channel");
    if (!host || !sec || !O) return;
    if (window.VNAV) VNAV.push({ id: "ohou", label: "오늘의집", open: () => window.openOhou() });
    paint(host);
    sec.hidden = false;
    window.setView ? setView("view-channel", "view-cx")
      : document.body.classList.add("mode-results", "view-channel", "view-cx");
    window.scrollTo({ top: 0, behavior: "auto" });
  };
})();
