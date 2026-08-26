/* 네이버 리뷰·예약 분석 화면
   혼수 카페(구매 후기)·제휴카페(지역 생활)와 다른 세 번째 잣대 —
   **매장을 실제 방문한 고객의 평가**.

   화면 구성(사용자 지시):
     좌 = 우리 매장   리뷰·예약 경유·칭찬·방문사유·인물
     우 = LG 비교     같은 상권 짝을 나란히
   기간은 월 단위, 첫 진입은 현재 월. 이동·기간 UI 는 ui-navigation 규칙을 따른다.

   ⚠ 네이버 예약 '건수'는 외부에서 볼 수 없다(스마트플레이스 관리자 전용).
     화면의 '예약 경유'는 리뷰의 인증수단=예약 비율로 낸 **추정치**이며 그렇게 표기한다. */
(function () {
  /* 표준 기간 UI(VPER) — 다른 분석 화면과 같은 간단 버튼 + 직접 입력.
     이 화면에는 자체 월 타임라인이 있었지만 칩·직접입력이 없어 요건 미달이었다
     (2026-08-27 검수). 타임라인은 그대로 두고 표준 UI 를 병설한다 —
     둘 다 st.ym / st.range 를 통해 같은 집계를 본다. */
  let NRPER = null;
  function nrPer(months) {
    if (NRPER || !window.VPER || !months || !months.length) return NRPER;
    NRPER = VPER.create({
      months: months,
      onChange: (api) => {
        const r = api.range();
        st.ym = null; st.range = [r[0], r[1]];
        const h = document.getElementById("channelPanel");
        if (h) paint(h);
      },
    });
    return NRPER;
  }

  "use strict";
  const NR = window.NAVER_REVIEW || null;
  const fmtN = (n) => (n || 0).toLocaleString("ko-KR");
  const esc = (t) => String(t || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const ymLab = (ym) => ym ? `${+ym.slice(0, 4)}년 ${+ym.slice(5)}월` : "전체 기간";
  const R_YM = 0, R_VIA = 1, R_STAR = 2, R_P = 3, R_C = 4, R_R = 5, R_NEG = 6, R_MGR = 7, R_T = 8;

  const st = { store: null, ym: null, range: null };

  /* ── 이름은 줄이지 않는다 ────────────────────────────────────────
     데이터의 백화점 라벨은 체인명이 잘려 있다("신세계 센텀"). 어디인지 알아볼 수
     없다는 지적을 받아, 화면에서는 체인명을 원래 이름으로 되돌려 붙인다.
     길어져서 칸을 넘치면 자르는 대신 **글씨 크기를 줄여** 전부 보이게 한다(fitText). */
  const CHAIN = [["롯데", "롯데백화점"], ["신세계", "신세계백화점"], ["현대", "현대백화점"],
    ["갤러리아", "갤러리아백화점"], ["AK", "AK플라자"], ["NC", "NC백화점"]];
  function deptFull(d) {
    if (!d) return d;
    for (const [a, b] of CHAIN) {
      if (d === a) return b;
      if (d.indexOf(a + " ") === 0) return b + " " + d.slice(a.length + 1);
    }
    return d;
  }

  /* 이름 줄이기는 공용 모듈 window.VFIT(web/text-fit.js)에 맡긴다 — 화면마다
     따로 구현하면 하한·측정 방식이 갈린다. VFIT 이 없을 때만 아래로 폴백한다.
     ⚠ Range.getBoundingClientRect() 는 overflow:hidden 에 잘린 폭을 돌려준다(실측).
       그 값을 믿으면 "이미 들어간다"고 판단해 글씨를 전혀 안 줄인다.
       잘리지 않은 실제 글자 폭은 getClientRects() 조각의 최대폭으로 재야 한다. */
  function fitText(root) {
    if (window.VFIT) { window.VFIT.all(root); return; }
    const rg = document.createRange();
    const textW = (el) => {
      rg.selectNodeContents(el);
      const rs = [...rg.getClientRects()].filter((r) => r.height > 1);
      return rs.length ? Math.max(...rs.map((r) => r.width)) : 0;
    };
    root.querySelectorAll("[data-fit]").forEach((el) => {
      const p = el.getAttribute("data-fit").split(",");
      const max = parseFloat(p[0]), min = parseFloat(p[1] || "9.5");
      const avail = el.clientWidth;
      if (!avail) return;             // 폭을 모를 땐(숨김 등) 손대지 않는다
      el.style.fontSize = max + "px";
      let s = max;
      for (let i = 0; i < 8; i++) {
        const w = textW(el);
        if (!w || w <= avail - 0.5 || s <= min) break;
        s = Math.max(min, Math.floor(s * (avail - 0.5) / w * 20) / 20);
        el.style.fontSize = s + "px";
      }
    });
  }

  /* ── 백화점별 묶음 ────────────────────────────────────────────────
     139곳을 긁고 나니 매장 하나만 보여주는 화면으로는 "백화점별로 개별로"
     볼 수가 없었다(고를 방법 자체가 없었다). 목록 층을 앞에 둔다. */
  /* 선택 기간의 리뷰 수 — 기간 미지정이면 매장 누적 총계 */
  function cnt(v) {
    if (!v) return 0;
    if (!st.range) return v.total || 0;
    const a = st.range[0].slice(0, 7), b = st.range[1].slice(0, 7);
    return (v.rows || []).filter((r) => r[R_YM] && r[R_YM] >= a && r[R_YM] <= b).length;
  }

  function byDept() {
    const m = {};
    Object.keys(NR.stores).forEach((k) => {
      const v = NR.stores[k];
      const d = v.dept || v.region || "미상";
      (m[d] = m[d] || { dept: d, region: v.region })[v.brand === "삼성" ? "s" : "l"] = v;
    });
    return Object.keys(m).map((d) => {
      const g = m[d];
      /* 기간을 지정하면 그 구간의 수집 표본으로, 아니면 매장 누적 총계로 센다.
         기간 UI 를 달아 놓고 수치가 안 변하면 '연동'이 아니다(2026-08-27). */
      g.sv = cnt(g.s); g.lv = cnt(g.l);
      g.tot = g.sv + g.lv;
      g.share = g.tot ? Math.round(g.sv / g.tot * 100) : null;
      g.both = !!(g.s && g.l);
      return g;
    }).sort((a, b) => b.tot - a.tot);
  }

  const REGION_ORDER = ["서울", "경기", "인천", "부산", "울산", "경남", "대구", "경북",
    "대전", "충남", "충북", "광주", "전남", "전북", "강원", "제주"];

  /* 명부 대비 얼마나 모았는지 정직하게 밝힌다 — 수집분만 보여주면
     "전국 전부"인 것처럼 읽힌다. 못 모은 곳은 이유까지 적는다. */
  function rosterNote() {
    const R = NR.roster;
    if (!R || !R.total) return "";
    const miss = (R.miss || []).length;
    return `<span>백화점 명부 <b>${R.total}곳 중 ${R.got}곳</b> 수집` +
      (miss ? ` — 미수집 ${miss}곳(${R.miss.join("·")})은 명부상 26년 실적이 없어 폐점으로 봅니다` +
        `(롯데분당만 실적이 있으나 네이버에서 검색되지 않습니다)` : "") + `.</span>`;
  }

  function renderList() {
    const G = byDept();
    const both = G.filter((g) => g.both);
    const one = G.filter((g) => !g.both);
    const S = both.reduce((a, g) => a + g.sv, 0), L = both.reduce((a, g) => a + g.lv, 0);
    const win = both.filter((g) => g.share >= 50).length;

    // 지역별로 묶어 보여준다 — 전국 한 줄로 늘어놓으면 어디가 어딘지 모른다
    const byRg = {};
    both.forEach((g) => { (byRg[g.region] = byRg[g.region] || []).push(g); });
    const rgs = Object.keys(byRg).sort((a, b) => {
      const ia = REGION_ORDER.indexOf(a), ib = REGION_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

    const cell = (g) => {
      const cls = g.share >= 50 ? "win" : g.share >= 35 ? "even" : "lose";
      const full = deptFull(g.dept);
      return `<button type="button" class="nrl-cell ${cls}" data-nrdept="${g.dept}"` +
        ` title="${full} — 삼성 ${fmtN(g.sv)}건 vs LG ${fmtN(g.lv)}건 (삼성 ${g.share}%)">` +
        `<span class="nrl-nm" data-fit="12,9.5">${full}</span>` +
        `<span class="nrl-bar"><i class="s" style="width:${g.share}%"></i></span>` +
        `<span class="nrl-sh">${g.share}<u>%</u></span></button>`;
    };

    return `<div class="ca2 af-wrap nr-wrap nrl">` +
      `<div class="af-top">` +
      `<div class="af-title"><h2>네이버 리뷰 · 백화점별</h2>` +
      `<span>전국 백화점 ${G.length}곳 · 삼성·LG 모두 입점 ${both.length}곳 — 누르면 매장 하나를 자세히</span></div>` +
      `<div class="af-hero">` +
      `<div class="af-hk"><b>${fmtN(S)}</b><span>삼성 리뷰</span></div>` +
      `<div class="af-hvs">vs</div>` +
      `<div class="af-hk zero"><b>${fmtN(L)}</b><span>LG 리뷰</span></div>` +
      `<div class="af-hk"><b>${win}<u>/${both.length}</u></b><span>삼성 우세 백화점</span></div>` +
      `</div></div>` +
      (function () { const P = nrPer(nrMonths()); return P ? `<div class="nr-perrow">${P.bar()}</div>` : ""; })() +
      `<div class="nrl-body">` +
      // 서울·경기처럼 매장이 몰린 지역은 두 칸을 차지하게 해 세로를 반으로 줄인다.
      // (한 지역이 길어지면 그 줄 전체가 그만큼 높아져 한 화면을 깨뜨린다)
      rgs.map((r) => `<section class="nrl-rg${byRg[r].length >= 9 ? " wide" : ""}">` +
        `<h3>${r}<i>${byRg[r].length}</i></h3>` +
        `<div class="nrl-grid">` + byRg[r].map(cell).join("") + `</div></section>`).join("") +
      `</div>` +
      /* 목록 화면의 표준 마무리 — 전국 리뷰 판세를 역할별 행동으로 옮긴다(2026-08-27) */
      (function () {
        const lose = both.filter((g) => g.share < 50);
        const worst = lose.slice().sort((a, b) => (a.lv - a.sv) - (b.lv - b.sv)).pop();
        const hq = lose.length
          ? `양사 입점 ${both.length}곳 가운데 <b class="warn">${lose.length}곳</b>이 리뷰 열세입니다 — ` +
            `방문 고객 대비 리뷰 회수를 매장 평가 항목에 넣고, 접객 교육에 리뷰 요청 절차를 포함해 주십시오.`
          : `양사 입점 ${both.length}곳 전부 리뷰 우위입니다 — 현행 요청 방식을 표준 매뉴얼로 굳혀 주십시오.`;
        const team = worst
          ? `격차가 가장 큰 곳은 <b class="warn">${deptFull(worst.dept)}</b>(삼성 ${fmtN(worst.sv)} vs LG ${fmtN(worst.lv)})입니다 — ` +
            `이 매장부터 리뷰 요청 실행 여부를 현장에서 확인하십시오.`
          : `지역별 편차가 크지 않습니다 — 상위 매장의 요청 문안을 전 매장에 공유해 수준을 유지하십시오.`;
        const store = `방문 고객이 떠나기 전에 <b>매장명과 담당자 이름이 남는 리뷰</b>를 요청하십시오 — ` +
          `플레이스 리뷰는 다음 고객이 매장을 고르는 첫 화면입니다.`;
        return `<ul class="role-plan nrl-role">` +
          `<li class="rp-hq"><em>본사</em><span>${hq}</span></li>` +
          `<li class="rp-team"><em>영업팀</em><span>${team}</span></li>` +
          `<li class="rp-store"><em>매장</em><span>${store}</span></li>` +
          `</ul>`;
      })() +
      `<p class="af-foot nr-foot">` +
      `<span>양사 모두 입점한 <b>${both.length}곳</b>만 비교합니다.</span>` +
      `<span>한쪽만 입점한 ${one.length}곳(${one.map((g) => deptFull(g.dept)).slice(0, 4).join(", ")}${one.length > 4 ? " 외" : ""})은 뺐습니다.</span>` +
      rosterNote() +
      `<span>네이버 플레이스 방문자 리뷰 · ${st.range ? "<b>선택 기간의 수집 표본</b>" : "<b>누적 총계</b>"} 기준 · 표본 기준 추정치(전수 아님).</span>` +
      `<span><b>예약 건수는 외부 조회 불가</b> — 스마트플레이스 관리자 전용.</span>` +
      `</p>` +
      `</div>`;
  }

  function pairOf(name) {
    if (!NR) return null;
    for (const p of NR.pairs) {
      if (p[0] === name) return { me: p[0], vs: p[1], lab: p[2], mine: "삼성" };
      if (p[1] === name) return { me: p[1], vs: p[0], lab: p[2], mine: "LG" };
    }
    return null;
  }

  function agg(store, ym) {
    const S = NR.stores[store];
    if (!S) return null;
    /* 기간 필터 — 자체 월 타임라인(ym)과 표준 기간 UI(st.range) 둘 다 받는다.
       ym 이 지정되면 그 달만, 아니면 st.range 구간(월 단위)으로 자른다(2026-08-27). */
    const rows = ym
      ? S.rows.filter((r) => r[R_YM] === ym)
      : (st.range
          ? S.rows.filter((r) => r[R_YM] && r[R_YM] >= st.range[0].slice(0, 7)
                                          && r[R_YM] <= st.range[1].slice(0, 7))
          : S.rows);
    const o = { n: rows.length, via: {}, praise: {}, complain: {}, reason: {},
                mgr: {}, neg: [], months: {}, stars: {} };
    rows.forEach((r) => {
      const v = r[R_VIA] || "미상";
      o.via[v] = (o.via[v] || 0) + 1;
      o.months[r[R_YM]] = (o.months[r[R_YM]] || 0) + 1;
      if (r[R_STAR]) o.stars[r[R_STAR]] = (o.stars[r[R_STAR]] || 0) + 1;
      NR.praise.forEach((k, i) => { if ((r[R_P] >> i) & 1) o.praise[k] = (o.praise[k] || 0) + 1; });
      NR.complain.forEach((k, i) => { if ((r[R_C] >> i) & 1) o.complain[k] = (o.complain[k] || 0) + 1; });
      NR.reason.forEach((k, i) => { if ((r[R_R] >> i) & 1) o.reason[k] = (o.reason[k] || 0) + 1; });
      if (r[R_MGR]) o.mgr[r[R_MGR]] = (o.mgr[r[R_MGR]] || 0) + 1;
      if (r[R_NEG]) o.neg.push({ ym: r[R_YM], t: r[R_T] });
    });
    o.book = o.via["예약"] || 0;
    o.bookRate = o.n ? Math.round(o.book / o.n * 1000) / 10 : 0;
    o.total = S.total;
    o.top = (k) => Object.keys(o[k]).map((x) => [x, o[k][x]]).sort((a, b) => b[1] - a[1]);
    return o;
  }

  function bar(v, max, cls) {
    const w = max ? Math.max(2, Math.round(v / max * 100)) : 0;
    return `<span class="nrb"><i class="${cls || ""}" style="width:${w}%"></i></span>`;
  }

  /* 기간 선택 — ui-navigation 규칙: 상시 노출, 현재 월 기본 */
  function periodBar(store) {
    const S = NR.stores[store];
    const have = {};
    S.rows.forEach((r) => { have[r[R_YM]] = (have[r[R_YM]] || 0) + 1; });
    const list = Object.keys(have).sort();
    const recent = list.slice(-24);
    const max = Math.max(1, ...recent.map((m) => have[m]));
    const i = st.ym ? list.indexOf(st.ym) : -1;
    const prev = i > 0 ? list[i - 1] : (st.ym ? null : list[list.length - 1]);
    const next = i >= 0 && i < list.length - 1 ? list[i + 1] : null;
    const cur = st.ym ? (have[st.ym] || 0) : S.rows.length;
    return `<div class="af-period">` +
      `<div class="af-step">` +
      `<button type="button" class="af-nav" data-nrym="${prev || ""}" ${prev ? "" : "disabled"} title="이전 달">‹</button>` +
      `<span class="af-cur"><b>${ymLab(st.ym)}</b><em>${fmtN(cur)}건</em></span>` +
      `<button type="button" class="af-nav" data-nrym="${next || ""}" ${next ? "" : "disabled"} title="다음 달">›</button>` +
      `</div>` +
      `<div class="af-strip" role="group" aria-label="월 선택">` +
      recent.map((m) => `<button type="button" class="af-sb${m === st.ym ? " on" : ""}" data-nrym="${m}"` +
        ` title="${ymLab(m)} · ${fmtN(have[m])}건"><i style="height:${Math.max(8, Math.round(have[m] / max * 100))}%"></i>` +
        `<em>${m.slice(5)}</em></button>`).join("") +
      `</div>` +
      `<button type="button" class="af-all-btn${st.ym ? "" : " on"}" data-nrym="">전체 기간</button>` +
      `</div>`;
  }

  /* 지정월 기준 직전 6개월 리뷰 추세 — 우리 vs 상대 나란히(2026-08-27 지시).
     기준월 = 자체 타임라인 선택(st.ym) > 표준 기간의 끝 월 > 데이터 최신 월. */
  function endYmOf(S) {
    if (st.ym) return st.ym;
    if (st.range) return st.range[1].slice(0, 7);
    let mx = "";
    S.rows.forEach((r) => { if (r[R_YM] > mx) mx = r[R_YM]; });
    return mx || (NR.now || "").slice(0, 7);
  }
  function last6(ym) {
    let y = +ym.slice(0, 4), m = +ym.slice(5);
    const out = [];
    for (let i = 5; i >= 0; i--) {
      let yy = y, mm = m - i;
      while (mm <= 0) { mm += 12; yy--; }
      out.push(yy + "-" + (mm < 10 ? "0" : "") + mm);
    }
    return out;
  }
  const moCnt = (S, ym) => S ? S.rows.filter((r) => r[R_YM] === ym).length : 0;

  function trendBlock(name) {
    const S = NR.stores[name], P = pairOf(name);
    const V = P && NR.stores[P.vs];
    const end = endYmOf(S);
    if (!end) return "";
    const ms = last6(end);
    const a = ms.map((m) => moCnt(S, m));
    const b = ms.map((m) => moCnt(V, m));
    const mx = Math.max(1, ...a, ...b);
    const bars = ms.map((m, i) =>
      `<div class="nrt-col" title="${m} — ${P ? P.mine : "우리"} ${a[i]}건${V ? ` vs 상대 ${b[i]}건` : ""}">` +
      `<div class="nrt-bars"><i class="s" style="height:${Math.max(3, Math.round(a[i] / mx * 100))}%"></i>` +
      (V ? `<i class="l" style="height:${Math.max(3, Math.round(b[i] / mx * 100))}%"></i>` : "") + `</div>` +
      `<u>${+m.slice(5)}월</u><em>${a[i]}${V ? `:${b[i]}` : ""}</em></div>`).join("");
    /* 요약 — 앞 3개월 합 vs 뒤 3개월 합, 삼지선다(±0 원칙) */
    const h1 = a[0] + a[1] + a[2], h2 = a[3] + a[4] + a[5];
    const v1 = b[0] + b[1] + b[2], v2 = b[3] + b[4] + b[5];
    let line;
    if (h1 + h2 < 6) line = `표본이 ${h1 + h2}건이라 추세를 단정하기엔 이릅니다 — 흐름은 참고로만 보십시오.`;
    else if (h2 > h1) line = `당사 리뷰는 후반 3개월(${fmtN(h2)}건)이 전반(${fmtN(h1)}건)보다 많아 <b>증가 흐름</b>입니다.`;
    else if (h2 < h1) line = `당사 리뷰는 후반 3개월(${fmtN(h2)}건)이 전반(${fmtN(h1)}건)보다 적어 <b class="warn">감소 흐름</b>입니다.`;
    else line = `당사 리뷰는 전·후반 3개월이 같은 수준(각 ${fmtN(h1)}건)입니다.`;
    if (V && v1 + v2 >= 6) {
      if (v2 > v1 && h2 <= h1) line += ` 같은 기간 상대는 <b class="warn">늘고 있어</b> 흐름이 교차합니다 — 회수 습관의 차이가 벌어지는 구간입니다.`;
      else if (v2 < v1 && h2 >= h1) line += ` 같은 기간 상대는 줄고 있어 <b>흐름은 당사 쪽</b>입니다.`;
      else if (v2 > v1) line += ` 상대도 함께 늘고 있습니다 — 상권 전체의 방문·리뷰가 느는 구간입니다.`;
    }
    return `<div class="af-block nr-trendblk"><h4>리뷰 추세 <i>${end.slice(0, 4)}년 ${+end.slice(5)}월 기준 직전 6개월</i></h4>` +
      `<div class="nr-trend">${bars}</div>` +
      `<p class="nr-legend"><span class="s">■ ${P ? P.mine : "우리"}</span>${V ? `<span class="l">■ ${P.mine === "삼성" ? "LG" : "삼성"}</span>` : ""}</p>` +
      `<p class="cy-note nrt-note">${line}</p></div>`;
  }

  /* 아쉬움 원문에서 품목을 읽는다 — 네이버 리뷰는 전체 원문을 공개 집계하지
     않아, 원문이 수집된 표본(아쉬움)에서만 품목이 보인다. 지어내지 않는다. */
  const NR_ITEMS = [["냉장고", /냉장고|김치냉장고/], ["세탁기", /세탁기|워시타워|그랑데/],
    ["건조기", /건조기/], ["TV", /TV|티비|텔레비전/i], ["에어컨", /에어컨|무풍/],
    ["청소기", /청소기/], ["식기세척기", /식기세척기|식세기/], ["인덕션", /인덕션/],
    ["정수기", /정수기/], ["의류관리기", /스타일러|에어드레서|의류관리기/], ["오븐", /오븐|광파/]];
  function negItems(A) {
    const c = {};
    (A.neg || []).forEach((x) => NR_ITEMS.forEach(([k, re]) => { if (re.test(x.t || "")) c[k] = (c[k] || 0) + 1; }));
    return Object.keys(c).map((k) => [k, c[k]]).sort((x, y) => y[1] - x[1]);
  }

  /* 당사/경쟁사 리뷰 분석문 — 감성(칭찬·아쉬움)·사유·품목을 문장으로 */
  function reviewAnalysis(A, S, who) {
    const pr = A.top("praise"), rs = A.top("reason");
    const prSum = pr.reduce((x, y) => x + y[1], 0);
    const it = negItems(A);
    const ps = [];
    if (!A.n) return `<p class="cy-note">이 기간 ${who} 리뷰 표본이 없습니다.</p>`;
    // 감성 — 칭찬 태그 밀도와 아쉬움
    let p1 = `표본 ${fmtN(A.n)}건에서 칭찬 언급이 <b>${fmtN(prSum)}회</b>` +
      (pr.length ? `, 그중 <b>${pr[0][0]}</b>${pr.length > 1 ? ` · ${pr[1][0]}` : ""}${josaRo(pr.length > 1 ? pr[1][0] : pr[0][0])} 가장 잦습니다` : `입니다`) + `. `;
    p1 += A.neg.length
      ? `명시적 아쉬움은 <b class="warn">${A.neg.length}건</b>으로, 칭찬 대비 소수지만 원문을 읽어 둘 가치가 있습니다.`
      : `명시적 아쉬움은 없습니다 — 감성은 칭찬 일변입니다.`;
    ps.push(p1);
    // 방문 사유 — 무엇 때문에 오는가
    if (rs.length && A.n >= 5) {
      const r0 = rs[0];
      ps.push(`방문 사유는 <b>${r0[0]}</b>(${fmtN(r0[1])}건)${rs.length > 1 ? ` · ${rs[1][0]}(${fmtN(rs[1][1])}건)` : ""} 순입니다 — ` +
        (r0[0] === "고장·교체" ? `쓰던 제품을 바꾸러 오는 발걸음이 많아, 보상판매·대체 모델 제안이 접점입니다.`
          : r0[0] === "이사·입주" ? `이사·입주 수요가 중심이라 일괄 구매 상담(패키지)이 접점입니다.`
          : r0[0] === "신제품" ? `신제품을 보러 오는 발걸음이 많아 시연·비교 상담이 접점입니다.`
          : `구독·렌탈 문의가 중심이라 요금·관리 상담이 접점입니다.`));
    }
    // 품목 — 원문 표본에서만
    ps.push(it.length
      ? `원문이 수집된 표본에서는 <b>${it.slice(0, 3).map((x) => `${x[0]} ${x[1]}건`).join(" · ")}</b>이 언급됩니다(아쉬움 원문 기준 — 전체 리뷰의 품목 분포는 네이버가 공개하지 않습니다).`
      : `품목별 분포는 네이버가 리뷰 원문을 공개 집계하지 않아 말할 수 없습니다 — 방문 사유 축으로 갈음합니다.`);
    return ps.map((x) => `<p class="cy-note">${x}</p>`).join("");
  }

  /* 좌 — 우리 매장 */
  function paneMine(name, A) {
    const S = NR.stores[name];
    const pr = A.top("praise"), rs = A.top("reason"), mg = A.top("mgr");
    const pMax = pr.length ? pr[0][1] : 1, rMax = rs.length ? rs[0][1] : 1;
    return `<section class="af-pane nr-mine">` +
      `<header class="af-ph tight"><span class="af-tag">① 우리 매장</span>` +
      `<h3 data-fit="22,12">${S.name}</h3></header>` +
      `<div class="af-stats">` +
      `<div class="af-stat"><b>${fmtN(S.total)}</b><span>네이버 리뷰</span><em>누적 총계</em></div>` +
      `<div class="af-stat hot"><b>${fmtN(A.book)}</b><span>예약 경유</span><em>표본 ${A.n}건 중 · 추정</em></div>` +
      `<div class="af-stat"><b>${A.bookRate}<i>%</i></b><span>예약 비율</span><em>추정</em></div>` +
      `</div>` +
      trendBlock(name) +
      `<div class="af-block"><h4>당사 리뷰 분석</h4>${reviewAnalysis(A, S, "당사")}</div>` +
      // 칭찬 칩은 전폭 — 네이버 키워드는 문구라서 좁은 칸에는 한 줄에 하나밖에 안 들어간다
      (S.keywords.length ? `<div class="af-block"><h4>고객이 고른 칭찬 <i>네이버 집계</i></h4>` +
        `<div class="nr-kw">` + S.keywords.slice(0, 6).map((k) =>
          `<span class="nr-k"><b>${k.k}</b><i>${fmtN(k.n)}</i></span>`).join("") + `</div></div>` : "") +
      // 막대 목록 둘은 나란히 — 행 높이가 고정이라 좁아져도 안 늘어난다
      `<div class="nr-cols2">` +
      (rs.length ? `<div class="af-block"><h4>왜 방문했나 <i>${A.n}건 기준</i></h4>` +
        rs.map((x) => `<div class="af-row"><span class="af-rn">${x[0]}</span>` +
          bar(x[1], rMax) + `<b class="af-rv">${x[1]}</b></div>`).join("") + `</div>` : "") +
      (pr.length ? `<div class="af-block"><h4>본문에서 읽은 칭찬</h4>` +
        pr.slice(0, 5).map((x) => `<div class="af-row"><span class="af-rn">${x[0]}</span>` +
          bar(x[1], pMax, "s") + `<b class="af-rv">${x[1]}</b></div>`).join("") + `</div>` : "") +
      `</div>` +
      // 매니저 실명과 아쉬움도 나란히 — 세로로 쌓으면 둘 다 첫 화면 밖으로 밀린다
      `<div class="nr-cols2">` +
      (mg.length ? `<div class="af-block"><h4>리뷰에 이름이 오르는 사람 <i>매장 자산</i></h4>` +
        `<div class="nr-kw">` + mg.slice(0, 6).map((x) =>
          `<span class="nr-k star"><b>${x[0]}</b><i>${x[1]}</i></span>`).join("") + `</div></div>` : "") +
      (A.neg.length
        ? `<div class="af-block af-miss"><h4>아쉬움 <i>${A.neg.length}건</i>` +
          `<button type="button" class="nr-more" data-nrmore="1">전문 보기</button></h4>` +
          `<p class="af-sub">명시적 불만만 셌습니다(‘고장’은 방문 사유라 제외).</p>` +
          `<ul class="af-list nr-clamp">` + A.neg.slice(0, 4).map((x) =>
            `<li><span class="af-ym">${x.ym}</span><span title="${esc(x.t)}">${x.t}</span></li>`).join("") + `</ul></div>`
        : `<div class="af-block"><h4>아쉬움</h4><p class="af-sub">이 기간 명시적 불만이 없습니다.</p></div>`) +
      `</div>` +
      `</section>`;
  }

  /* 우 — 경쟁 비교 */
  function paneVs(name, A) {
    const P = pairOf(name);
    if (!P || !NR.stores[P.vs]) {
      return `<section class="af-pane af-ours"><header class="af-ph">` +
        `<span class="af-tag ours">② 경쟁 비교</span><h3>비교 매장 없음</h3></header>` +
        `<p class="af-none">같은 상권의 경쟁 매장이 수집되지 않았습니다.</p></section>`;
    }
    const B = agg(P.vs, st.ym), S = NR.stores[name], V = NR.stores[P.vs];
    const win = S.total > V.total;
    const ratio = win ? Math.round(S.total / Math.max(1, V.total) * 10) / 10
                      : Math.round(V.total / Math.max(1, S.total) * 10) / 10;
    /* 진단문은 한 덩어리로 이어 붙이지 않는다 —
       ①판정 한 줄 ②숫자 맞대결 ③왜 그런지 근거를 불릿으로, 세 단락으로 끊는다. */
    const scoreRow =
      `<div class="nr-vsrow">` +
      `<span class="nr-vsc me"><em data-fit="13,10">${S.name}</em><b>${fmtN(S.total)}</b></span>` +
      `<span class="nr-vsx">vs</span>` +
      `<span class="nr-vsc op"><em data-fit="13,10">${V.name}</em><b>${fmtN(V.total)}</b></span>` +
      `</div>`;
    /* ── 진단 문장 ─────────────────────────────────────────────────
       사용자 지시(2026-08-24): "분석된 페이지는 인사이트가 있어야해.
       사전적 의미로만 참고할 내용 등으로 단락을 만들지는 마."

       여기 있던 문장은 "리뷰 수는 방문 고객이 남긴 흔적의 양입니다" 였다.
       지표의 사전적 정의라서 **이기든 지든 같은 문장**이 나왔다 —
       이 매장 고유의 정보가 0이었다.

       화면이 이미 갖고 있는 값(칭찬 키워드·예약 비율·매니저 실명)을
       상대와 맞대어 "그래서 무엇을 하라"까지 잇는다.
       후기는 고객이 쓴다 — 매니저가 할 수 있는 일은 요청뿐이다(CLAUDE.md). */
    const why = [];
    const gap = Math.abs(S.total - V.total);

    // ① 격차를 '한 달에 몇 건'으로 환산 — 막연한 배수보다 손에 잡힌다
    if (!win && gap > 0) {
      const perMo = Math.ceil(gap / 12);
      /* 격차가 크면 '따라잡기'를 목표로 걸지 않는다.
         월 601건 같은 수는 사실이지만 실행할 수 없는 수라서, 적어두면
         액션이 아니라 포기 사유가 된다. 누적을 못 뒤집을 때는
         **새로 쌓이는 속도**를 목표로 바꾼다. */
      if (perMo > 60) {
        why.push(`<li class="warn-li">누적 격차 <b>${fmtN(gap)}건</b>은 단기간에 뒤집히지 않습니다.` +
          ` 누적 대신 <b>이번 달 새로 쌓인 건수</b>에서 앞서는 것을 목표로 삼으세요 —` +
          ` 구매 고객에게 <b>후기 작성을 요청</b>하는 것이 유일한 방법입니다.</li>`);
      } else {
        why.push(`<li class="warn-li">격차 <b>${fmtN(gap)}건</b> — 1년 안에 따라잡으려면` +
          ` <b>월 ${fmtN(perMo)}건</b>씩 더 쌓여야 합니다.` +
          ` 구매 고객에게 <b>후기 작성을 요청</b>하세요.</li>`);
      }
    } else if (win && gap > 0) {
      why.push(`<li><b>${fmtN(gap)}건</b> 앞섭니다 — 이 격차는` +
        ` <b>검색에서 먼저 보이는 자리</b>로 돌아옵니다. 요청 습관을 놓치면 곧 줄어듭니다.</li>`);
    }

    // ② 상대는 받는데 우리는 없는 칭찬 — 상담에서 메울 지점
    const mine = new Set((S.keywords || []).map((k) => k.k));
    const only = (V.keywords || []).filter((k) => !mine.has(k.k)).slice(0, 2);
    if (only.length) {
      why.push(`<li class="warn-li">상대는 <b>${only.map((k) => k.k).join(" · ")}</b>로` +
        ` 칭찬받는데 우리 매장엔 이 키워드가 없습니다 —` +
        ` <b>상담에서 그 대목이 비어 있다</b>는 뜻입니다.</li>`);
    } else if ((S.keywords || []).length) {
      why.push(`<li>우리 칭찬 키워드는 <b>${S.keywords.slice(0, 2).map((k) => k.k).join(" · ")}</b>입니다 —` +
        ` 이 강점을 <b>상담 첫머리</b>에 쓰세요.</li>`);
    }

    // ③ 매니저 실명 — 다음 고객이 찾아오는 단서
    const mgTop = A.top("mgr");
    if (mgTop.length) {
      why.push(`<li>후기에 <b>${mgTop[0][0]}</b> 등 담당자 이름이 남아 있습니다.` +
        ` 이름이 적힌 후기는 <b>지목 방문</b>을 부릅니다 —` +
        ` 상담을 마칠 때 이름을 넣어 남겨달라고 요청하세요.</li>`);
    } else {
      why.push(`<li class="warn-li">후기에 <b>담당자 이름이 없습니다</b>.` +
        ` 이름이 없으면 후기가 매장 평판에만 쌓이고` +
        ` <b>지목 방문</b>으로 이어지지 않습니다.</li>`);
    }

    const verdict = win
      ? { cls: "ok", t: `리뷰에서 ${ratio}배 앞섭니다`,
          d: scoreRow + `<ul class="nr-why">${why.join("")}</ul>` }
      : { cls: "bad", t: `리뷰에서 ${ratio}배 밀립니다`,
          d: scoreRow + `<ul class="nr-why">${why.join("")}</ul>` };
    const cmpRow = (lab, a, b) => {
      const t = (a || 0) + (b || 0), w = t ? (a / t * 100) : 50;
      return `<div class="nr-cmp"><span class="nr-cl">${lab}</span>` +
        `<span class="nr-cbar"><i class="s" style="width:${w}%"></i><i class="l" style="width:${100 - w}%"></i></span>` +
        `<span class="nr-cv"><b class="${a >= b ? "on" : ""}">${fmtN(a)}</b><em>${fmtN(b)}</em></span></div>`;
    };
    const rz = (o, k) => (o.reason[k] || 0);
    return `<section class="af-pane af-ours">` +
      `<header class="af-ph tight"><span class="af-tag ours">② ${P.lab} · 삼성 vs LG</span>` +
      `<h3 data-fit="22,12">같은 상권에서 나란히</h3></header>` +
      `<div class="af-verdict ${verdict.cls}"><b>${verdict.t}</b><div class="nr-vbody">${verdict.d}</div></div>` +
      `<div class="af-block"><h4>맞대결</h4>` +
      `<p class="nr-lgd"><span class="s" data-fit="12.5,9.5">${S.name}</span>` +
      `<span class="l" data-fit="12.5,9.5">${V.name}</span></p>` +
      cmpRow("네이버 리뷰 누적", S.total, V.total) +
      cmpRow("표본 내 예약 경유", A.book, B.book) +
      cmpRow("고장·교체 방문", rz(A, "고장·교체"), rz(B, "고장·교체")) +
      cmpRow("이사·입주 방문", rz(A, "이사·입주"), rz(B, "이사·입주")) +
      cmpRow("구독·렌탈 언급", rz(A, "구독·렌탈"), rz(B, "구독·렌탈")) +
      `</div>` +
      /* 우세/열세 요인 — 기간 표본으로 판정하고, 이유를 데이터에서 찾는다
         (예약 경유율·칭찬 밀도·방문 사유 구성·실명 언급). 2026-08-27 지시. */
      (function () {
        if (A.n + B.n < 6) return `<div class="af-block"><h4>우세·열세 요인</h4>` +
          `<p class="cy-note">이 기간 양사 표본이 ${A.n + B.n}건뿐이라 요인을 단정하지 않습니다 — 기간을 넓히면 구조가 보입니다.</p></div>`;
        const lead = A.n > B.n ? "win" : B.n > A.n ? "lose" : "even";
        if (Math.min(A.n, B.n) < 10) {
          /* 한쪽 표본이 너무 작으면 비율(예약 경유·칭찬 밀도) 비교가 요동친다 —
             요인을 단정하지 않고, 표본 자체의 비대칭을 요인으로 말한다. */
          const small = A.n < B.n ? "당사" : "상대";
          const line = A.n < B.n
            ? `이 기간 <b class="warn">${fmtN(A.n)} vs ${fmtN(B.n)}</b> — 당사 표본이 ${fmtN(A.n)}건뿐이라 비율 요인을 따지기 전에 <b>리뷰 회수 자체</b>가 과제입니다. 상대는 예약 경유 ${B.bookRate}%로 방문이 기록으로 남는 구조를 갖췄습니다 — 구매·방문 고객에게 후기 요청을 거는 것부터가 요인 대응입니다.`
            : `이 기간 <b>${fmtN(A.n)} vs ${fmtN(B.n)}</b> — 상대 표본이 ${fmtN(B.n)}건뿐이라 구조 비교보다는, 지금의 우위(회수 요청 습관)를 유지하는 것이 요점입니다.`;
          return `<div class="af-block"><h4>우세·열세 요인 <i>기간 표본 기준</i></h4><p class="cy-note">${line}</p></div>`;
        }
        const li = [];
        const prA = A.top("praise").reduce((x, y) => x + y[1], 0);
        const prB = B.top("praise").reduce((x, y) => x + y[1], 0);
        const dens = (s, n) => n ? Math.round(s / n * 100) / 100 : 0;
        // 예약 경유 — 예약 방문은 기록이 남는 구조라 리뷰 회수로 이어진다
        if (Math.abs(A.bookRate - B.bookRate) >= 3) {
          /* 판정 방향과 문장 방향을 맞춘다 — 밀리는데 "이것이 건수를 만드는 힘"이라
             적으면 모순이 된다(2026-08-27 검수). */
          li.push(A.bookRate > B.bookRate
            ? (lead === "lose"
              ? `<li>예약 경유는 <b>${A.bookRate}%</b>로 상대(${B.bookRate}%)보다 오히려 높습니다 — 격차의 원인은 예약 구조가 아니라는 뜻이므로, 아래 다른 요인을 먼저 보십시오.</li>`
              : `<li>예약 경유가 <b>${A.bookRate}%</b>로 상대(${B.bookRate}%)보다 높습니다 — 예약 방문은 방문 기록이 남아 리뷰 요청으로 잇기 쉬운 구조이고, 이것이 건수를 만드는 힘입니다.</li>`)
            : (lead === "win"
              ? `<li>상대의 예약 경유(${B.bookRate}%)가 당사(${A.bookRate}%)보다 높은데도 건수는 당사가 앞섭니다 — 회수 요청 습관이 구조 차이를 이기고 있다는 뜻입니다.</li>`
              : `<li class="warn-li">상대의 예약 경유(<b class="warn">${B.bookRate}%</b>)가 당사(${A.bookRate}%)보다 높습니다 — 예약 문화가 리뷰 회수로 이어지는 구조라, 스마트플레이스 예약 안내부터 챙길 지점입니다.</li>`));
        }
        // 칭찬 밀도 — 표본당 칭찬 언급 수: 경험의 강도가 리뷰를 부른다
        if (prA + prB >= 10) {
          const dA = dens(prA, A.n), dB = dens(prB, B.n);
          if (dA !== dB) li.push(dA > dB
            ? `<li>표본당 칭찬 언급이 <b>${dA}회</b>로 상대(${dB}회)보다 짙습니다 — 상담 경험의 강도가 리뷰를 부르고 있습니다.</li>`
            : `<li class="warn-li">표본당 칭찬 언급이 <b class="warn">${dA}회</b>로 상대(${dB}회)보다 옅습니다 — 남길 말이 생기는 상담이 건수의 출발점입니다.</li>`);
        }
        // 방문 사유 구성 — 어떤 발걸음이 리뷰가 되는가
        const rA = A.top("reason")[0], rB = B.top("reason")[0];
        if (rA && rB && rA[0] !== rB[0] && A.n >= 10 && B.n >= 10) {
          li.push(`<li>방문 사유의 축이 다릅니다 — 당사는 <b>${rA[0]}</b>, 상대는 <b>${rB[0]}</b> 중심입니다. 같은 상권에서 다른 발걸음을 받고 있다는 뜻이라, 상대 축의 고객이 어디로 가는지 볼 지점입니다.</li>`);
        }
        // 실명 언급 — 요청 문화의 유무
        const mgA = A.top("mgr").length, mgB = B.top("mgr").length;
        if (mgA && !mgB) li.push(`<li>당사 리뷰에는 담당자 실명이 남고 상대에는 없습니다 — <b>이름을 넣은 후기 요청 문화</b>가 자리 잡았다는 신호이고, 지목 방문으로 되돌아옵니다.</li>`);
        else if (!mgA && mgB) li.push(`<li class="warn-li">상대 리뷰에는 실명이 남는데 당사에는 없습니다 — 요청 문화의 차이가 회수율 차이로 이어집니다.</li>`);
        const head = lead === "win" ? `이 기간 <b>${fmtN(A.n)} vs ${fmtN(B.n)}</b>${numRo(B.n)} 당사가 앞섭니다 — 요인:`
          : lead === "lose" ? `이 기간 <b class="warn">${fmtN(A.n)} vs ${fmtN(B.n)}</b>${numRo(B.n)} 밀립니다 — 요인:`
          : `이 기간 ${fmtN(A.n)} vs ${fmtN(B.n)} 동률입니다 — 갈리는 지점:`;
        return `<div class="af-block"><h4>우세·열세 요인 <i>기간 표본 기준</i></h4>` +
          `<p class="cy-note">${head}</p>` +
          (li.length ? `<ul class="nr-why">${li.join("")}</ul>`
            : `<p class="cy-note">예약 경유·칭찬 밀도·사유 구성에 뚜렷한 차이가 없습니다 — 건수 차는 회수 요청의 빈도 차로 보는 것이 합리적입니다.</p>`) + `</div>`;
      })() +
      `<div class="af-block"><h4>경쟁사 리뷰 분석 <i data-fit="17,10">${V.name}</i></h4>${reviewAnalysis(B, V, "경쟁사")}</div>` +
      (V.keywords.length ? `<div class="af-block"><h4>상대가 받는 칭찬 <i data-fit="17,10">${V.name}</i></h4>` +
        `<div class="nr-kw">` + V.keywords.slice(0, 5).map((k) =>
          `<span class="nr-k vs"><b>${k.k}</b><i>${fmtN(k.n)}</i></span>`).join("") + `</div></div>` : "") +
      `<p class="af-sub nr-note"><span>네이버 리뷰 누적은 <b>매장 전체 기간</b> 기준입니다.</span>` +
      `<span>나머지 항목은 <b>선택 기간의 수집 표본</b> 기준입니다.</span>` +
      `<span><b>예약 경유는 추정</b>입니다 — 예약 건수는 외부에서 조회할 수 없습니다.</span></p>` +
      nrRolePlan(name, A) +
      `</section>`;
  }

  /* 역할별 실행 제안(본사/영업팀/매장) — 모든 분석 화면의 표준 마무리 블록.
     방문자 리뷰는 혼수 후기와 잣대가 다르므로, 문장도 '상담 품질 → 리뷰'로 간다. */
  /* 받침에 따라 '로/으로' — 회사 전체가 보는 화면이라 조사 오류가 바로 눈에 걸린다 */
  /* 숫자 뒤 '(으)로' — 끝자리 읽는 소리 기준. ㄹ 받침(1·7·8)은 '로'다. */
  function numRo(n) {
    const last = String(n).replace(/,/g, "").slice(-1);
    return { "0": "으로", "3": "으로", "6": "으로" }[last] || "로";
  }
  function josaRo(w) {
    const c = (w || "").charCodeAt((w || "").length - 1);
    if (c < 0xac00 || c > 0xd7a3) return "로";
    const jong = (c - 0xac00) % 28;
    return (jong === 0 || jong === 8) ? "로" : "으로";
  }

  function nrRolePlan(name, A) {
    const S = NR.stores[name], P = pairOf(name), V = P && NR.stores[P.vs];
    const lose = V && V.total > S.total;
    const gapT = V ? Math.abs(V.total - S.total) : 0;
    const praise = A.top("praise"), rival = V ? agg(P.vs, st.ym) : null;
    const rp = rival ? rival.top("praise").map((x) => x[0]) : [];
    const mine = praise.map((x) => x[0]);
    const missing = rp.filter((k) => mine.indexOf(k) < 0).slice(0, 2);
    const mg = A.top("mgr");

    const hq = missing.length
      ? `상대 매장은 <b class="warn">${missing.join(" · ")}</b>${josaRo(missing[missing.length - 1])} 칭찬받는데 우리 매장 리뷰에는 이 키워드가 없습니다 — ` +
        `해당 항목을 상담 표준 절차와 <b>접객 교육 과정</b>에 반영해 주십시오.`
      : `칭찬 키워드가 상대와 겹칩니다 — 차별점이 옅다는 뜻이므로 <b>혼수 전용 상담 프로그램</b>처럼 리뷰에 남을 만한 요소를 만들어 주십시오.`;
    const team = lose
      ? `같은 상권에서 <b class="warn">리뷰 ${fmtN(gapT)}건</b> 뒤집니다 — 방문 고객 대비 리뷰 회수율을 매장별로 점검하고, ` +
        `회수율이 높은 매장의 요청 문안을 지역에 공유하십시오.`
      : `상권 내 리뷰 우위를 지키고 있습니다 — 이 매장의 요청 방식을 지역 표준으로 삼아 열세 매장에 이식하십시오.`;
    const store = mg.length
      ? `리뷰에 <b>${mg[0][0]}</b> 매니저 실명이 ${mg[0][1]}회 등장합니다 — 실명이 남는 후기는 지명 방문으로 이어지므로, ` +
        `구매 고객에게 담당자 이름을 적어 달라고 요청하십시오.`
      : `리뷰에 담당자 실명이 한 번도 남지 않았습니다 — 응대를 마칠 때 <b>이름과 함께 후기를 남겨 달라는 요청</b>을 습관으로 만드십시오.`;
    return `<div class="af-block role-block"><h4>실행 제안 <em>역할별</em></h4><ul class="role-plan">` +
      `<li class="rp-hq"><em>본사</em><span>${hq}</span></li>` +
      `<li class="rp-team"><em>영업팀</em><span>${team}</span></li>` +
      `<li class="rp-store"><em>매장</em><span>${store}</span></li>` +
      `</ul></div>`;
  }

  function render() {
    const name = st.store, A = agg(name, st.ym);
    const S = NR.stores[name], P = pairOf(name);
    const V = P && NR.stores[P.vs];
    return `<div class="ca2 af-wrap nr-wrap">` +
      `<div class="af-top">` +
      `<div class="af-title"><h2>네이버 리뷰 · 예약</h2>` +
      `<span>${S.name} · ${S.region} · ${S.addr || ""}</span></div>` +
      `<div class="af-hero">` +
      `<div class="af-hk"><b>${fmtN(S.total)}</b><span>${P ? P.mine : "우리"} 리뷰</span></div>` +
      `<div class="af-hvs">vs</div>` +
      `<div class="af-hk ${V && V.total > S.total ? "zero" : ""}"><b>${fmtN(V ? V.total : 0)}</b>` +
      `<span>${P ? (P.mine === "삼성" ? "LG" : "삼성") + " 리뷰" : "상대"}</span></div>` +
      `</div></div>` +
      /* 표준 기간 UI(간단 버튼 + 직접 입력) — 다른 분석 화면과 같은 한 벌.
         아래 자체 월 타임라인은 이 화면 고유의 시각이라 함께 둔다(2026-08-27). */
      (function () {
        const P = nrPer(nrMonths());
        return P ? `<div class="nr-perrow">${P.bar()}</div>` : "";
      })() +
      periodBar(name) +
      `<div class="af-body">` + paneMine(name, A) + paneVs(name, A) + `</div>` +
      `<p class="af-foot nr-foot">` +
      `<span>네이버 플레이스 방문자 리뷰 <b>표본 기준 추정치</b>(전수 아님).</span>` +
      `<span><b>예약 건수는 외부에서 조회할 수 없어</b> ‘예약 경유’는 리뷰 인증수단=예약 비율로 낸 추정치입니다.</span>` +
      `<span>혼수 카페 후기와 합산하지 않습니다.</span></p>` +
      `</div>`;
  }

  /* 표준 기간 UI 가 쓸 월 목록 — 수집된 리뷰의 월 전체 */
  function nrMonths() {
    const NR = window.NAVER_REVIEW;
    if (!NR || !NR.stores) return [];
    /* 데이터에 months 필드가 없다(실측) — 리뷰 행의 월 칸에서 직접 모은다 */
    const set = {};
    Object.keys(NR.stores).forEach((k) => {
      (NR.stores[k].rows || []).forEach((r) => { if (r[R_YM]) set[r[R_YM]] = 1; });
    });
    return Object.keys(set).sort();
  }

  function paint(host) {
    host.innerHTML = st.store ? render() : renderList();
    fitText(host);          // 말줄임 대신 글씨를 줄여 이름 전체를 보인다
    { const P = nrPer(nrMonths()); if (P) P.bind(host); }
    if (window.VNAV) VNAV.sync();
    host.querySelectorAll("[data-nrym]").forEach((b) => b.addEventListener("click", () => {
      if (b.disabled) return;
      st.ym = b.getAttribute("data-nrym") || null;
      paint(host);
    }));
    // 아쉬움 원문 펼치기 — 기본은 두 줄로 접어 한 화면을 지키고, 누르면 전문을 보여준다
    host.querySelectorAll("[data-nrmore]").forEach((b) => b.addEventListener("click", () => {
      const ul = b.closest(".af-block").querySelector(".af-list");
      const on = ul.classList.toggle("nr-clamp");
      b.textContent = on ? "전문 보기" : "접기";
    }));
    host.querySelectorAll("[data-nrdept]").forEach((b) => b.addEventListener("click", () => {
      window.openNaverReview(b.getAttribute("data-nrdept"));
    }));
  }

  /* paint 는 #channel 이 아직 숨겨져 있을 때 불린다 — 그때 clientWidth 는 0이라
     "다 들어간다"고 착각해 글씨를 하나도 줄이지 않는다(실측).
     ResizeObserver 는 이 화면에서 초기 통지조차 오지 않아 믿을 수 없었다(실측).
     그래서 패널을 실제로 펼친 뒤 한 번 더 명시적으로 잰다. */
  function refit() {
    const host = document.getElementById("channelPanel");
    if (host && host.clientWidth) fitText(host);
  }
  // 화면이 펼쳐지는 사이 다른 코드가 패널을 다시 그리는 일이 있어(실측 — 인라인
  // 크기가 지워진 채로 남았다) 한 번으로 끝내지 않고 몇 프레임 뒤까지 확인한다.
  function refitSoon() {
    refit();
    window.requestAnimationFrame(refit);
    setTimeout(refit, 120);
    setTimeout(refit, 400);
  }

  /* 창 폭이 바뀌면 칸 폭도 바뀐다 — 맞춰 둔 글씨 크기를 다시 잰다 */
  let rzT = 0;
  window.addEventListener("resize", () => { clearTimeout(rzT); rzT = setTimeout(refit, 120); });

  /* 백화점 목록(전국 개관). 매장 화면에서 '뒤로' 하면 여기로 온다. */
  window.openNaverReviewList = function () {
    const host = document.getElementById("channelPanel");
    const sec = document.getElementById("channel");
    if (!host || !sec || !NR) return;
    st.store = null;
    if (window.VNAV) VNAV.push({ id: "nr:list", label: "네이버리뷰 백화점별",
      open: () => window.openNaverReviewList() });
    paint(host);
    sec.hidden = false;
    window.setView ? setView("view-channel", "view-af", "view-nr")
      : document.body.classList.add("mode-results", "view-channel", "view-af", "view-nr");
    window.scrollTo({ top: 0, behavior: "auto" });
    refitSoon();   // 이제야 패널 폭이 잡힌다 — 이름 글씨 크기를 여기서 확정한다
  };

  window.openNaverReview = function (storeName) {
    // 인자가 없으면 매장 하나가 아니라 백화점 목록을 연다 — 어느 매장인지 고를 수 있어야 한다
    if (!storeName) return window.openNaverReviewList();
    const host = document.getElementById("channelPanel");
    const sec = document.getElementById("channel");
    if (!host || !sec || !NR) return;
    // 대시보드 매장명과 플레이스 상호 표기가 달라 부분 일치로도 찾는다
    const ks = Object.keys(NR.stores);
    const key = NR.stores[storeName] ? storeName
      : ((NR.deptMap && NR.deptMap[storeName])
         || ks.find((k) => NR.stores[k].query === storeName)
         || ks.find((k) => k.indexOf(storeName) >= 0 || storeName.indexOf(k) >= 0)
         || ks[0]);
    st.store = key;
    const have = {};
    NR.stores[key].rows.forEach((r) => { have[r[R_YM]] = 1; });
    st.ym = have[NR.now] ? NR.now : (Object.keys(have).sort().reverse()[0] || null);
    if (window.VNAV) VNAV.push({ id: "nr:" + key, label: "네이버리뷰 " + key,
      open: () => window.openNaverReview(key) });
    paint(host);
    sec.hidden = false;
    window.setView ? setView("view-channel", "view-af", "view-nr") : document.body.classList.add("mode-results", "view-channel", "view-af", "view-nr");
    window.scrollTo({ top: 0, behavior: "auto" });
    refitSoon();   // 이제야 패널 폭이 잡힌다 — 이름 글씨 크기를 여기서 확정한다
  };
})();
