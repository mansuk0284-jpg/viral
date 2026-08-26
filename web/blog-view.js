/* 네이버 블로그 채널 화면 (window.openBlog)

   블로그는 **넓은 채널**이다 — 블로그 전체가 아니라 혼수·가전 검색어로
   걸러낸 글만 본다(유튜브·인스타와 같은 잣대, 2026-08-25 신설).

   이 채널의 성격: **체험단·협찬 글이 많다.** 지우지 않고 갈라 본다 —
   내돈내산 글은 고객 목소리, 체험단 글은 마케팅 물량이다.
   조회수·좋아요가 없으므로 순위 대신 **최신순**으로 보여준다(지어내지 않는다).

   양식은 다이렉트웨딩·유튜브에서 자리 잡은 공통 문법을 그대로 쓴다:
   좌측 섹션 박스 + 트렌드 불릿, 우측 카드 + 종합 진단 + 실행 제안(역할별). */
(function () {
  "use strict";
  const B = window.NBLOG || null;
  const fmtN = (n) => (n || 0).toLocaleString("ko-KR");
  const pct = (a, b) => (a + b === 0 ? 0 : Math.round((a / (a + b)) * 100));
  const josa = (w, a, b) => {
    const c = (w || "").charCodeAt((w || "").length - 1);
    if (c < 0xac00 || c > 0xd7a3) return b;
    return (c - 0xac00) % 28 ? a : b;
  };

  let PER = null;
  function per() {
    if (PER || !window.VPER || !B) return PER;
    PER = VPER.create({
      months: B.months || [],
      onChange: () => paint(document.getElementById("channelPanel")),
    });
    return PER;   // 날짜가 정확한 채널이라 다결과 같이 **현재 월**로 연다
  }
  const labOf = () => (per() ? per().label() : "전체");

  function pickCur() {
    const p = per();
    if (!p) return (B.posts || []).slice();
    const r = p.range();
    const a = r[0].slice(0, 7), b = r[1].slice(0, 7);
    return (B.posts || []).filter((x) => x.ym && x.ym >= a && x.ym <= b);
  }

  function bar(s, l) {
    const t = s + l || 1;
    return `<div class="cx-bar"><i class="s" style="width:${(s / t * 100).toFixed(1)}%"></i>` +
      `<i class="l" style="width:${(l / t * 100).toFixed(1)}%"></i></div>`;
  }

  /* 글 목록 — 조회수가 없어 최신순. 유튜브 vs 카드의 행(.yv-row) 문법 재사용 */
  function listRows(g, n) {
    return g.slice(0, n).map((x, i) =>
      `<a class="yv-row" href="${x.u}" target="_blank" rel="noopener"` +
      ` title="${x.t} · ${x.bg || "블로거"} · ${x.d}">` +
      `<i>${i + 1}</i><b class="yt-t">${x.t}</b>` +
      `<em>${(x.d || "").slice(2, 7) || "-"}</em></a>`).join("");
  }

  /* 수치는 **월별 사전집계 전량**에서, 목록만 월별 최신 표본에서.
     전량 posts 를 실으면 4.4MB 가 돼(실측) 첫 화면마다 과하다. */
  function monthsInRange() {
    const p = per();
    if (!p) return (B.months || []).slice();
    const r = p.range();
    const a = r[0].slice(0, 7), b = r[1].slice(0, 7);
    return (B.months || []).filter((m) => m >= a && m <= b);
  }

  function render() {
    const cur = pickCur();                          // 목록용(월별 최신 표본)
    const ms = monthsInRange();
    const M = B.mon || {};
    const sum = (f) => ms.reduce((a, m) => a + ((M[m] || {})[f] || 0), 0);
    const total = sum("n"), spCnt = sum("sp");
    const ownCnt = total - spCnt;
    const oS = sum("os"), oL = sum("ol");
    const aS = sum("s"), aL = sum("l");
    const sh = pct(oS, oL);
    const spPct = total ? Math.round(spCnt / total * 100) : 0;
    const own = cur.filter((x) => !x.sp);          // 목록: 내돈내산 표본
    const spn = cur.filter((x) => x.sp);           // 목록: 체험단 표본
    const byNew = cur.slice().sort((a, b) => (b.d || "").localeCompare(a.d || ""));

    // 품목·매장 — 월별 사전집계를 기간으로 합산(전량 기준 정확 수치)
    const agg = (SRC) => {
      const out = {};
      ms.forEach((m) => {
        const v = (SRC || {})[m] || {};
        Object.keys(v).forEach((k) => {
          const o = out[k] || (out[k] = { n: 0, s: 0, l: 0, sp: 0 });
          o.n += v[k].n; o.s += v[k].s; o.l += v[k].l; o.sp += v[k].sp;
        });
      });
      return out;
    };
    const IT = agg(B.monItems);
    const ST = agg(B.monStores);
    const hot = Object.keys(IT).sort((a, b) => IT[b].n - IT[a].n).slice(0, 3);
    const stTop = Object.keys(ST).sort((a, b) => ST[b].n - ST[a].n).slice(0, 6);

    /* ── 종합 진단 — 보고서형 문어체(사실→해석→시사점) ── */
    const secs = [];
    secs.push(`<div class="cy-sec"><h5>게시 동향</h5><p class="cy-note">` +
      `선택 기간의 블로그 글은 <b>${fmtN(total)}건</b>으로, 내돈내산 <b>${fmtN(ownCnt)}건</b> · ` +
      `체험단·협찬 표기 <b class="warn">${fmtN(spCnt)}건</b>${total >= 10 ? `(${spPct}%)` : ""}입니다. ` +
      (spPct >= 40
        ? `열 건 중 네 건 이상이 마케팅성 글이므로, 이 채널의 브랜드 수치는 내돈내산만 갈라 읽어야 고객 목소리가 됩니다.`
        : `내돈내산 글이 중심이라 고객이 스스로 남긴 후기로 읽을 수 있는 구간입니다.`) + `</p></div>`);
    secs.push(`<div class="cy-sec"><h5>브랜드 반응</h5><p class="cy-note">` +
      (oS + oL >= 10
        ? `내돈내산 글에서 브랜드가 갈리는 것은 삼성 <b>${fmtN(oS)}건</b> 대 LG <b class="warn">${fmtN(oL)}건</b>(삼성 ${sh}%)입니다. ` +
          `체험단까지 합치면 삼성 ${fmtN(aS)} : LG ${fmtN(aL)}로 달라집니다 — 고객이 말한 양과 마케팅이 뿌린 양은 다른 이야기입니다.`
        : `브랜드가 갈리는 내돈내산 글이 <b>${oS + oL}건</b>뿐이라 비율 대신 건수로만 적습니다(삼성 ${oS} : LG ${oL}). 기간을 넓히면 비교가 가능해집니다.`) + `</p></div>`);
    if (stTop.length) {
      const t0 = ST[stTop[0]];
      secs.push(`<div class="cy-sec"><h5>매장 언급</h5><p class="cy-note">` +
        `매장이 적힌 글은 <b>${stTop.map((k) => `${k}(${ST[k].n})`).slice(0, 3).join(" · ")}</b> 순입니다. ` +
        `블로그는 장문이라 매장·담당자·혜택이 함께 적히는 채널입니다 — 상위 매장의 글을 열어 ` +
        `고객이 계약을 결심한 대목(혜택·상담)을 상담 화법에 참고할 수 있습니다.` +
        (t0.sp ? ` 다만 상위 매장 글 중 <b class="warn">${t0.sp}건</b>은 체험단 표기입니다.` : "") + `</p></div>`);
    }
    if (hot.length) {
      secs.push(`<div class="cy-sec"><h5>품목 트렌드</h5><p class="cy-note">` +
        `다뤄진 품목은 <b>${hot.join(" · ")}</b> 순입니다. ` +
        `블로그 글은 검색으로 오래 읽히므로, 이 품목들의 검색 결과에 우리 매장 이야기가 있는지가 ` +
        `장기 노출을 가릅니다 — 구매 고객에게 블로그 후기 작성을 요청할 품목이기도 합니다.</p></div>`);
    }
    // 실행 제안 — 역할별(모든 분석 페이지 표준 마무리)
    (function () {
      const hq = spPct >= 40
        ? `체험단 물량(${spPct}%)이 고객 글을 덮고 있습니다 — <b>구매 고객 대상 블로그 후기 캠페인</b>(사은 이벤트 등)으로 내돈내산 글의 비중을 키우는 설계가 필요합니다.`
        : `블로그는 검색 장기 노출 채널입니다 — 상위 품목(${hot[0] || "주요 품목"}) 중심의 <b>후기 콘텐츠 가이드</b>를 매장에 배포할 만합니다.`;
      const team = stTop.length
        ? `<b>${stTop[0]}</b> 등 언급 상위 매장의 글을 지역 <b>교육 자료</b>로 공유하세요 — 고객이 계약을 결심한 문장이 그대로 적혀 있습니다.`
        : `매장이 적힌 글이 적습니다 — 매장 방문 시 <b>블로그 후기 요청</b> 실행 여부를 점검하세요.`;
      const store = `계약 고객 중 블로그 운영 고객에게 <b>매장명·담당자 실명이 든 후기</b>를 요청하세요 — 검색에 오래 남는 후기가 다음 고객을 부릅니다.`;
      secs.push(`<div class="cy-sec"><h5>실행 제안 <i>역할별</i></h5><ul class="role-plan">` +
        `<li class="rp-hq"><em>본사</em><span>${hq}</span></li>` +
        `<li class="rp-team"><em>영업팀</em><span>${team}</span></li>` +
        `<li class="rp-store"><em>매장</em><span>${store}</span></li>` +
        `</ul></div>`);
    })();

    /* ── 좌측 트렌드 불릿 ── */
    const bullets = [];
    if (byNew.length) bullets.push(`최신 글은 ‘${(byNew[0].t || "").slice(0, 22)}…’(${byNew[0].d})입니다.`);
    if (spCnt) bullets.push(`체험단·협찬 표기 글이 <b class="warn">${fmtN(spCnt)}건${total >= 10 ? `(${spPct}%)` : ""}</b> — 마케팅 물량을 갈라 세고 있습니다.`);
    if (stTop.length) bullets.push(`매장이 적힌 글은 <b>${stTop[0]}</b>${josa(stTop[0], "이", "가")} ${ST[stTop[0]].n}건으로 가장 많습니다.`);
    if (hot.length) bullets.push(`다뤄진 품목은 <b>${hot.join(" · ")}</b> 순입니다.`);
    const trendBlock = bullets.length
      ? `<div class="yt-trend"><h4>이 기간 블로그 트렌드</h4>` +
        `<ul>${bullets.slice(0, 4).map((b2) => `<li>${b2}</li>`).join("")}</ul></div>` : "";

    const cmpBlock = `<div class="yt-cmp"><h4>삼성 vs LG 게시 대비</h4>` +
      `<div class="yc-row"><em>내돈내산</em>` +
      `<span class="yc-s">삼성 <b>${fmtN(oS)}건</b></span>` +
      `<span class="yc-bar"><i class="s" style="width:${(oS / ((oS + oL) || 1) * 100).toFixed(1)}%"></i>` +
      `<i class="l" style="width:${(oL / ((oS + oL) || 1) * 100).toFixed(1)}%"></i></span>` +
      `<span class="yc-l">LG <b>${fmtN(oL)}건</b></span></div>` +
      `<div class="yc-row"><em>협찬 포함</em>` +
      `<span class="yc-s">삼성 <b>${fmtN(aS)}건</b></span>` +
      `<span class="yc-bar"><i class="s" style="width:${(aS / ((aS + aL) || 1) * 100).toFixed(1)}%"></i>` +
      `<i class="l" style="width:${(aL / ((aS + aL) || 1) * 100).toFixed(1)}%"></i></span>` +
      `<span class="yc-l">LG <b>${fmtN(aL)}건</b></span></div>` +
      `<p class="yt-note">막대는 건수 비중입니다. 두 줄이 크게 다르면 어느 한쪽의 체험단 물량이 많다는 뜻입니다.</p></div>`;

    const stCard = stTop.length
      ? `<div class="ca-ncard"><h4 class="ca-ch">매장 언급 <i class="ca-tag">건수 순</i></h4>` +
        `<ul class="it-list">` + stTop.map((k) => {
          const v = ST[k], ish = pct(v.s, v.l);
          /* 협찬 0건이면 그 칸을 비운다 — "0협찬" 은 잡음이다 */
          return `<li class="it-row ${v.s >= v.l ? "s" : "l"}" title="${k} · ${v.n}건${v.sp ? " · 협찬 " + v.sp : ""}">` +
            `<span class="it-n">${k}</span>` +
            `<span class="it-bar"><i style="width:${ish}%"></i></span>` +
            (v.sp ? `<span class="it-v">${v.sp}<em>협찬</em></span>` : `<span class="it-v"></span>`) +
            `<span class="it-c">${v.n}<em>건</em></span></li>`;
        }).join("") + `</ul></div>`
      : `<div class="ca-ncard"><h4 class="ca-ch">매장 언급</h4>` +
        `<p class="fc-plain">이 기간에는 매장이 적힌 글이 없습니다.</p></div>`;

    return `<div class="ca2 yt-wrap">` +
      `<div class="cx-top">` +
      `${window.VICON ? VICON.html("naver-blog", "네이버 블로그") : ""}` +
      `<div class="cx-title"><h2>네이버 블로그</h2>` +
      `<span>넓은 채널에서 혼수가전만 골라 봤습니다 · 글 ${fmtN(B.total)}건</span></div>` +
      `${per() ? per().bar() : ""}` +
      `</div>` +

      `<div class="cx-body">` +
      `<div class="cx-left">` +
      `<div class="cx-sum">` +
      `<div class="cx-sum-h"><h3>게시 현황</h3><span>${labOf()} · ${fmtN(total)}건</span></div>` +
      `<div class="cx-sum-n"><b>${fmtN(total)}</b><i>건 게시</i></div>` +
      `<p class="yt-note">내돈내산 <b>${fmtN(ownCnt)}건</b> · 체험단·협찬 <b class="warn">${fmtN(spCnt)}건</b>${total >= 10 ? `(${spPct}%)` : ""}입니다. ` +
      `아래 브랜드 비교는 <b>내돈내산 글만</b> 셌습니다.</p>` +
      trendBlock +
      cmpBlock +
      `<p class="jw-note">블로그는 조회수를 주지 않아 목록은 <b>최신순</b>이며, 목록 칸은 월별 최신 표본입니다(수치는 전량 집계). ${B.note}</p>` +
      `</div></div>` +

      `<div class="cx-right">` +
      `<div class="ca-ncard"><h4 class="ca-ch">최근 글 — 내돈내산 <i class="ca-tag">클릭 → 원문</i></h4>` +
      (own.length ? `<div class="yv-col">${listRows(own.slice().sort((a, b) => (b.d || "").localeCompare(a.d || "")), 5)}</div>`
        : `<p class="fc-plain">이 기간 내돈내산 글이 없습니다.</p>`) + `</div>` +
      `<div class="ca-ncard"><h4 class="ca-ch">최근 글 — 체험단·협찬 <i class="ca-tag">클릭 → 원문</i></h4>` +
      (spn.length ? `<div class="yv-col">${listRows(spn.slice().sort((a, b) => (b.d || "").localeCompare(a.d || "")), 5)}</div>`
        : `<p class="fc-plain">이 기간 체험단 표기 글이 없습니다.</p>`) + `</div>` +
      stCard +
      `<div class="ca-ncard yt-rep">` +
      `<h4 class="ca-ch">종합 진단 <i class="ca-tag">${labOf()}</i></h4>` +
      secs.join("") +
      `</div>` +
      `</div></div></div>`;
  }

  function paint(host) {
    if (!host || !B) return;
    host.innerHTML = render();
    if (window.VNAV) VNAV.sync();
    if (window.VFIT) VFIT.all();
    if (per()) per().bind(host);
  }

  window.openBlog = function () {
    const host = document.getElementById("channelPanel");
    const sec = document.getElementById("channel");
    if (!host || !sec || !B) return;
    if (window.VNAV) VNAV.push({ id: "blog", label: "네이버 블로그", open: () => window.openBlog() });
    paint(host);
    sec.hidden = false;
    window.setView ? setView("view-channel", "view-cx")
      : document.body.classList.add("mode-results", "view-channel", "view-cx");
    window.scrollTo({ top: 0, behavior: "auto" });
  };
})();
