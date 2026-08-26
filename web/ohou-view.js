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

  /* 기간 — 다른 화면과 같은 공용 모듈(VPER). enrich 로 게시일을 확보해
     이제 월 단위로 자를 수 있다(연도는 추정 — 화면에 밝힌다). */
  let PER = null;
  function per() {
    if (PER || !window.VPER || !O || !(O.months || []).length) return PER;
    PER = VPER.create({ months: O.months, onChange: () => paint(document.getElementById("channelPanel")) });
    return PER;
  }
  const labOf = () => (per() ? per().label() : "전체");
  function monthsInRange() {
    const p = per();
    if (!p) return (O.months || []).slice();
    const r = p.range(), a = r[0].slice(0, 7), b = r[1].slice(0, 7);
    return (O.months || []).filter((m) => m >= a && m <= b);
  }
  function inRange(ym) {
    const p = per();
    if (!p) return true;
    if (!ym) return false;
    const r = p.range();
    return ym >= r[0].slice(0, 7) && ym <= r[1].slice(0, 7);
  }
  const sumMon = (f) => monthsInRange().reduce((a, m) => a + (((O.mon || {})[m] || {})[f] || 0), 0);

  function render() {
    const ms = monthsInRange();
    const inPosts = (O.posts || []).filter((x) => inRange(x.ym));
    const total = sumMon("n"), oS = sumMon("s"), oL = sumMon("l"), lkSum = sumMon("lk");
    const sh = pct(oS, oL);
    const IT = O.items || {}, SP = O.spaces || {};

    /* 모델 — 기간 안에서 다시 센다(monModels) */
    const M = {};
    ms.forEach((m) => {
      const v = (O.monModels || {})[m] || {};
      Object.keys(v).forEach((k) => { M[k] = (M[k] || 0) + v[k]; });
    });
    const BR = {};
    Object.keys(O.models || {}).forEach((k) => { BR[k] = O.models[k].b; });
    const mTop = Object.keys(M).sort((a, b) => M[b] - M[a]);
    const samM = mTop.filter((k) => BR[k] === "s").slice(0, 3);
    const lgM = mTop.filter((k) => BR[k] === "l").slice(0, 3);
    const itTop = Object.keys(IT).sort((a, b) => IT[b].n - IT[a].n).slice(0, 3);
    const spTop = Object.keys(SP).sort((a, b) => SP[b].n - SP[a].n);

    /* 공감 축 — 기간 안 글의 좋아요 순위. 스크랩·조회수는 뜻이 달라 함께 보여준다 */
    const liked = inPosts.filter((x) => x.lk).sort((a, b) => b.lk - a.lk);
    const allLiked = (O.topLiked || []);
    const useLiked = liked.length ? liked : allLiked;
    const likedNote = liked.length ? ""
      : `<p class="ca-splx">이 기간에는 반응이 확인된 글이 없어 <b>전체 기간 상위</b>를 보여줍니다.</p>`;
    const avgLk = total ? Math.round(lkSum / total) : 0;
    const scAvg = inPosts.length
      ? Math.round(inPosts.reduce((a, x) => a + (x.sc || 0), 0) / inPosts.length) : 0;

    /* 월 추이 — 가장 많이 올라온 달(트렌드 파악의 기본) */
    const peak = ms.slice().sort((a, b) => ((O.mon[b] || {}).n || 0) - ((O.mon[a] || {}).n || 0))[0];

    /* ═══ 우측: 총론 → 각론 (2026-08-26 사용자 지시) ═══ */
    const lead = [];
    lead.push(`선택 기간에 수집된 글은 <b>${fmtN(total)}건</b>이며, 브랜드가 갈리는 글은 삼성 <b>${fmtN(oS)}건</b> 대 LG <b${sh >= 50 ? "" : ' class="warn"'}>${fmtN(oL)}건</b>입니다. ` +
      (mTop.length ? `공간 사진에 가장 자주 등장한 모델은 <b>${mTop[0]}</b>(${fmtN(M[mTop[0]])}건)이고, ` : "") +
      `글당 평균 공감은 <b>${fmtN(avgLk)}개</b>입니다.`);
    lead.push(`오늘의집은 매장이나 구매처가 거의 적히지 않는 채널입니다. 그래서 이 화면은 “어디서 샀나”가 아니라 ` +
      `<b>“어떤 모델이 신혼집 사진의 주인공이 되는가”</b>를 봅니다 — 공간 사진은 검색과 저장으로 오래 회자되므로, ` +
      `여기서의 노출은 즉각적인 계약이 아니라 <b>다음 시즌의 선호</b>로 돌아옵니다.`);
    if (peak) {
      lead.push(`게시가 가장 많았던 달은 <b>${peak.slice(0, 4)}년 ${+peak.slice(5)}월</b>(${fmtN((O.mon[peak] || {}).n)}건)입니다. ` +
        `혼수 준비가 집중되는 달과 겹치는지 보면, 매장 상담이 늘기 <b>직전에 무엇이 회자되는지</b>를 미리 읽을 수 있습니다.`);
    }

    const secs = [];
    if (useLiked.length) {
      const t0 = useLiked[0];
      secs.push(`<div class="cy-sec"><h5>각론 ① 공감을 얻은 이야기</h5><p class="cy-note">` +
        `가장 많은 공감을 받은 글은 <b>♥${fmtN(t0.lk)}</b>(저장 ${fmtN(t0.sc)}·조회 ${fmtN(t0.vw)})로, ` +
        `“${(t0.t || "").slice(0, 40)}…” 입니다. ` +
        `좋아요는 <b>보고 마음이 움직인 사람</b>, 저장(스크랩)은 <b>나중에 사러 갈 목록에 담은 사람</b>이라 뜻이 다릅니다 — ` +
        `저장이 좋아요에 근접한 글일수록 구매 의향에 가깝습니다(이 기간 평균 저장 ${fmtN(scAvg)}개).</p></div>`);
    }
    if (mTop.length >= 2) {
      secs.push(`<div class="cy-sec"><h5>각론 ② 모델 트렌드</h5><p class="cy-note">` +
        `<b>${mTop[0]}</b>(${fmtN(M[mTop[0]])}건)과 <b>${mTop[1]}</b>(${fmtN(M[mTop[1]])}건)이 가장 많이 등장했습니다. ` +
        (samM.length && lgM.length
          ? `삼성 라인은 <b>${samM.join(" · ")}</b>, LG 라인은 <b class="warn">${lgM.join(" · ")}</b>${josa(lgM[lgM.length - 1], "이", "가")} 눈에 띕니다. `
          : "") +
        `상담에서 고객이 “사진에서 본 그것”을 말할 때 모델명을 바로 짚어 실물로 연결하면 대화가 빨라집니다.</p></div>`);
    }
    if (spTop.length) {
      const s0 = spTop[0];
      secs.push(`<div class="cy-sec"><h5>각론 ③ 공간 맥락</h5><p class="cy-note">` +
        `가전이 함께 언급된 공간은 <b>${spTop.map((k) => `${k}(${SP[k].n})`).join(" · ")}</b> 순입니다. ` +
        `${s0}${josa(s0, "은", "는")} 가전과 가구가 한 화면에 놓이는 자리라 고객은 성능보다 <b>치수·색·라인</b>을 먼저 봅니다 — ` +
        `도면·컬러 매칭을 함께 다루면 이 채널을 보고 온 고객에게 특히 잘 통합니다.</p></div>`);
    }
    if (O.ad) {
      secs.push(`<div class="cy-sec"><h5>각론 ④ 광고 구분</h5><p class="cy-note">` +
        `광고·협찬 표기가 확인된 글은 <b class="warn">${fmtN(O.ad)}건</b>입니다. ` +
        `표기가 없어도 브랜드 협업 콘텐츠가 섞이는 채널이므로, 노출량을 고객 반응으로 그대로 읽지 않는 편이 안전합니다.</p></div>`);
    }
    secs.push(rolePlan(
      lgM.length && sh < 50
        ? `인테리어 이미지에서 <b class="warn">${lgM[0]}</b> 계열 노출이 앞섭니다 — <b>공간 연출 콘텐츠</b>(키친핏·빌트인 매칭 사진) 제작 지원이 필요합니다.`
        : `<b>${mTop[0] || "주요 모델"}</b>${josa(mTop[0] || "주요 모델", "이", "가")} 공간 사진의 중심입니다 — 이 라인의 연출 이미지를 매장 전시·상담 자료로 배포할 만합니다.`,
      spTop.length
        ? `<b>${spTop[0]}</b> 중심의 배치·치수 상담 사례를 교육 자료로 공유하세요 — 이 채널 고객은 성능보다 공간 맞춤을 먼저 묻습니다.`
        : `공간 맥락 표본이 적습니다 — 참고 지표로만 쓰세요.`,
      `“사진에서 본 그 모델”을 고객이 말할 때 <b>모델명·색상까지 바로 짚어</b> 실물 전시로 연결하세요.`));

    /* ═══ 좌측: 요약 정리 ═══ */
    const bullets = [];
    if (mTop.length) bullets.push(`최다 등장 모델 <b>${mTop[0]}</b>(${fmtN(M[mTop[0]])}건)`);
    if (useLiked.length) bullets.push(`최고 공감 <b>♥${fmtN(useLiked[0].lk)}</b> · 글당 평균 ♥${fmtN(avgLk)}`);
    if (itTop.length) bullets.push(`품목 <b>${itTop.join(" · ")}</b> 순`);
    if (spTop.length) bullets.push(`공간 <b>${spTop[0]}</b>(${fmtN(SP[spTop[0]].n)}건) 최다`);

    return `<div class="ca2 yt-wrap oh-wrap">` +
      `<div class="cx-top">` +
      `${window.VICON ? VICON.html("ohou", "오늘의집") : ""}` +
      `<div class="cx-title"><h2>오늘의집</h2>` +
      `<span>넓은 채널에서 혼수가전만 골라 봤습니다 · 글 ${fmtN(O.total)}건</span></div>` +
      `${per() ? per().bar() : ""}` +
      `</div>` +

      `<div class="cx-body">` +
      `<div class="cx-left">` +
      `<div class="cx-sum">` +
      `<div class="rv-head"><h3>오늘의집</h3><span>모델·공감 트렌드 · ${labOf()}</span></div>` +
      `<div class="nsc-total"><b>${fmtN(total)}</b><i>건 분석</i></div>` +

      `<div class="nsc-sec"><h4 class="nsc-st">브랜드 노출<i>글 기준</i></h4>` +
      `<div class="nsc-ends"><span class="s">삼성</span><span class="l">LG</span></div>` +
      `<div class="nh-bar"><i class="s" style="width:${sh}%"></i><i class="l" style="width:${100 - sh}%"></i></div>` +
      `<div class="nsc-nums"><span class="s"><b>${fmtN(oS)}건</b>${oS + oL >= 10 ? `<i>(${sh}%)</i>` : ""}</span>` +
      `<span class="l"><b>${fmtN(oL)}건</b>${oS + oL >= 10 ? `<i>(${100 - sh}%)</i>` : ""}</span></div>` +
      (O.ad ? `<p class="nsc-foot">광고·협찬 표기 <b class="warn">${fmtN(O.ad)}건</b>이 포함돼 있습니다.</p>` : "") +
      `</div>` +

      `<div class="nsc-sec"><h4 class="nsc-st">공감<i>좋아요·저장</i></h4>` +
      `<div class="cy-grid">` +
      `<div class="cy-k"><b>${fmtN(lkSum)}</b><span>좋아요 합</span></div>` +
      `<div class="cy-k"><b>${fmtN(avgLk)}</b><span>글당 평균</span></div>` +
      `</div>` +
      `<p class="nsc-foot">좋아요는 <b>마음이 움직인 사람</b>, 저장은 <b>사러 갈 목록에 담은 사람</b>입니다(이 기간 평균 저장 ${fmtN(scAvg)}개).</p>` +
      `</div>` +

      (bullets.length ? `<div class="yt-trend"><h4>요약</h4>` +
        `<ul>${bullets.slice(0, 4).map((b) => `<li>${b}</li>`).join("")}</ul></div>` : "") +
      `<p class="jw-note">게시일은 상세 페이지의 월·일 표기에서 읽었고 <b>연도는 추정</b>입니다(날짜 확보 ${fmtN(O.dated)}/${fmtN(O.total)}건). ${O.note}</p>` +
      `</div></div>` +

      `<div class="cx-right">` +
      `<div class="ca-ncard yt-rep oh-lead"><h4 class="ca-ch">종합 진단 <i class="ca-tag">${labOf()} · 총론 → 각론</i></h4>` +
      `<div class="cy-sec"><h5>총론</h5>` + lead.map((p2) => `<p class="cy-note">${p2}</p>`).join("") + `</div>` +
      secs.join("") + `</div>` +
      `<div class="ca-ncard"><h4 class="ca-ch">공감 상위 글 <i class="ca-tag">좋아요 순 · 클릭 → 원문</i></h4>` +
      likedNote +
      (useLiked.length ? `<div class="yv-col oh-list">` + useLiked.slice(0, 6).map((x, i) => {
        const cls = x.b === "s" ? "s" : x.b === "l" ? "l" : "even";
        return `<a class="yv-row oh-row ${cls}" href="${x.u}" target="_blank" rel="noopener" title="${x.t}">` +
          `<i>${i + 1}</i><b class="yt-t">${x.t}</b>` +
          `<em class="oh-tags"><span class="oh-lk">♥${fmtN(x.lk)}</span>` +
          `<span class="oh-sc">저장 ${fmtN(x.sc)}</span></em></a>`;
      }).join("") + `</div>` : `<p class="fc-plain">반응이 확인된 글이 없습니다.</p>`) + `</div>` +
      `<div class="ca-ncard"><h4 class="ca-ch">모델 언급 순위 <i class="ca-tag">${labOf()}</i></h4>` +
      (mTop.length ? `<ul class="it-list">` + mTop.slice(0, 6).map((k) => {
        const n = M[k], w = Math.round(n / M[mTop[0]] * 100), b = BR[k];
        return `<li class="it-row ${b === "l" ? "l" : "s"}"><span class="it-n">${k}</span>` +
          `<span class="it-bar"><i style="width:${w}%"></i></span>` +
          `<span class="it-v">${b === "s" ? "삼성" : b === "l" ? "LG" : "공통"}</span>` +
          `<span class="it-c">${fmtN(n)}<em>건</em></span></li>`;
      }).join("") + `</ul>` : `<p class="fc-plain">이 기간에는 모델 언급이 확인되지 않았습니다.</p>`) + `</div>` +
      `</div></div></div>`;
  }

  function paint(host) {
    if (!host || !O) return;
    host.innerHTML = render();
    if (window.VNAV) VNAV.sync();
    if (window.VFIT) VFIT.all();
    if (per()) per().bind(host);
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
