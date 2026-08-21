/* =====================================================================
   다이렉트결혼준비(네이버 카페) — 후기(가전) 분석 화면 v2
   · 기간 네비게이터(전체·연도·26월별) + 4단계 드릴다운(전사→부울경→지역→매장)
   · 한 화면(스크롤 없이) 구성. 긴 설명은 ⓘ 툴팁으로.
   · 실데이터만: 월별 국가 추이(2024.11~2026.06) + 매장 2026 누적. 없는 구간은 정직 표기.
   · 전역 헬퍼($, fmtN, pct) 재사용 — app.js 로드 후 실행
   ===================================================================== */
(function () {
  // 월별 [라벨, 전체, 삼성단독, LG단독] — census 전구간(2021~2026.05, 87,419건) 우선, 없으면 폴백
  const CD = (typeof window !== "undefined" && window.CAFE_DATA) || null;
  const MONTHS = CD && CD.months && CD.months.length ? CD.months : [
    ["2024-11", 15, 6, 0], ["2024-12", 1988, 692, 539],
    ["2025-12", 2114, 668, 494], ["2026-05", 2073, 1099, 553],
  ];
  // 부울경 백화점 매장별 (2026 본문확정) [이름, 권역, 삼성, LG]
  const STORES = [
    ["신세계 센텀시티", "부산", 87, 66], ["롯데 부산본점", "부산", 60, 24],
    ["롯데 광복점", "부산", 41, 6], ["롯데 동래점", "부산", 30, 4],
    ["롯데 센텀시티", "부산", 3, 2],
    ["롯데 울산점", "울산", 16, 8], ["현대 울산점", "울산", 17, 7], ["현대 울산 동구", "울산", 0, 0],
    ["롯데 창원점", "경남", 20, 9], ["갤러리아 진주", "경남", 12, 2],
    ["신세계 김해", "경남", 0, 4], ["신세계 마산점", "경남", 1, 1],
  ];
  const U = "https://cafe.naver.com/f-e/cafes/25228091/articles/";
  const SAMPLES = {
    "신세계 센텀시티": { pos: [
      ["[가전졸업] 신세계 센텀 삼성스토어 안지원 매니저님 최고예요! (계약후기)", "s", U + "9061230"],
      ["임직원몰보다 저렴하게 신세계 센텀 삼성스토어에서 가전 졸업! 정대일 매니저님 추천", "s", U + "9060203"],
      ["신세계 센텀 삼성스토어 가전 졸업 — 발품 4군데 팔았지만 결국 여기!", "s", U + "9043039"],
    ], neg: [] },
    "롯데 부산본점": { pos: [
      ["부산 롯데백화점 본점 삼성가전 후기 (정영호 매니저님)", "s", U + "9050025"],
      ["롯데백화점 부산본점 삼성스토어에서 비스포크 콤보+정수기 계약 완료!", "s", U + "9021945"],
      ["[롯데 부산본점 · 서희영 명장님] 혼수 가전 졸업 — 발품 5곳 판 후기", "l", U + "8967612"],
    ], neg: [] },
    "롯데 광복점": { pos: [
      ["롯데광복 삼성스토어에서 신혼집 가전 졸업했습니다", "s", U + "9059867"],
      ["혼수가전 구매 후기｜롯데광복 삼성스토어 김세훈 매니저님 추천합니다", "s", U + "9059013"],
    ], neg: [] },
    "롯데 동래점": { pos: [
      ["삼성스토어 롯데 동래점 가전 계약 후기 (한정현 부점장님)", "s", U + "9015291"],
      ["부산 혼수가전 동래 롯데백화점 삼성에서 졸업했습니다 — 완전 추천!", "s", U + "8814022"],
    ], neg: [] },
    "롯데 창원점": { pos: [
      ["창원 롯데백화점 삼성스토어 혼수가전 졸업 (매니저님 친절)", "s", U + "8990012"],
    ], neg: [
      ["창원 롯데 LG 베스트샵에서 오브제 패키지로 결정 — 디자인 차이", "l", U + "8970113"],
    ] },
  };
  const TOTAL = CD
    ? { posts: CD.total, s: CD.samsung, l: CD.lg, retailers: CD.retailers || {} }
    : { posts: 50015, s: 16159, l: 14652, retailers: {} };

  const SS = "#1f5fd0", LG = "#d23b54";

  // ── 기간 네비게이터 ── census 전구간에서 동적 생성: 전체 + 연도(2021~) + 당해연도 월
  const YEARS = Array.from(new Set(MONTHS.map((m) => m[0].slice(0, 4)))).sort();
  const CUR_Y = YEARS[YEARS.length - 1];
  const PERIODS = [{ k: "all", lab: "전체" }]
    .concat(YEARS.map((y) => ({ k: y, lab: y })))
    .concat(MONTHS.filter((m) => m[0].slice(0, 4) === CUR_Y)
      .map((m) => ({ k: m[0], lab: (+m[0].slice(5)) + "월" })));
  const REGIONS = ["부산", "울산", "경남"];

  // 상태: 기간 + 드릴 레벨 — 기본은 데이터의 마지막(당월)
  const LAST_M = MONTHS.length ? MONTHS[MONTHS.length - 1][0] : "2026-05";
  /* 첫 화면은 **현재 월**로 연다(사용자 지시 2026-08-21).
     데이터에 이번 달이 아직 없으면(수집 전) 마지막 달로 물러선다. */
  const NOW_M = (() => {
    const d = new Date();
    const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    return MONTHS.some((m) => m[0] === k) ? k : LAST_M;
  })();
  // range: 사용자가 날짜를 직접 지정한 구간 {a,b}. 지정되면 period는 "custom"이 되고
  //        모든 집계가 팩트 테이블(VFACT)에서 그 구간만 잘라 계산된다.
  const st = { period: NOW_M, range: null, level: "nation", region: null, store: null,
    navY: NOW_M.slice(0, 4) };   // navY = 월 목록을 펼쳐 놓을 연도(선택 기간과 별개)
  const VF = window.VFACT || null;
  const isCus = () => !!(st.range && VF);

  /* 기간 키 → 날짜 구간. 버튼(전체·연도·월)도 직접 입력과 똑같이 구간으로 바꿔
     전부 팩트 테이블 한 경로로 계산한다. 경로가 둘이면 어느 한쪽만 기간에
     연동되는 사고가 난다(실제로 유통·후기스타·성수기가 그랬다). */
  function curRange() {
    if (!VF) return null;
    const p = st.period;
    if (p === "custom" && st.range) return [st.range.a, st.range.b];
    if (/^\d{4}$/.test(p)) return VF.clamp(p + "-01-01", p + "-12-31");
    if (/^\d{4}-\d\d$/.test(p)) {
      const y = +p.slice(0, 4), m = +p.slice(5);
      const last = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 0)).getUTCDate();
      return VF.clamp(p + "-01", p + "-" + String(last).padStart(2, "0"));
    }
    return [VF.d0, VF.d1];                       // 전체
  }
  /* 선택 기간 집계(캐시됨) — 화면 전체가 이 하나를 본다 */
  const hasF = () => !!VF;
  function A() { const r = curRange(); return r ? VF.agg(r[0], r[1]) : null; }
  function cus() { return A(); }

  /* 직전 기간 집계 — 연/월은 한 칸 앞, 직접 입력은 같은 길이의 바로 앞 구간 */
  function prevAgg() {
    if (!VF) return null;
    const r = curRange();
    if (!r) return null;
    const DAY = 86400000;
    const b0 = Date.parse(r[0] + "T00:00:00Z"), b1 = Date.parse(r[1] + "T00:00:00Z");
    const len = Math.round((b1 - b0) / DAY) + 1;
    const pb = new Date(b0 - DAY).toISOString().slice(0, 10);
    const pa = new Date(b0 - len * DAY).toISOString().slice(0, 10);
    if (pb < VF.d0) return null;
    const c = VF.clamp(pa, pb);
    return VF.agg(c[0], c[1]);
  }

  /* 선택 기간의 전국 삼성비중 — 지역·매장 비교의 기준선 */
  function natShare() {
    const rows = monthsFor(st.period);
    const s = rows.reduce((a, r) => a + r[2], 0), l = rows.reduce((a, r) => a + r[3], 0);
    return (s + l) ? pct(s, l) : pct((CD && CD.samsung) || 0, (CD && CD.lg) || 0);
  }

  function monthsFor(k) {
    if (k === "custom" && isCus()) return cus().months;
    if (k === "all") return MONTHS;
    if (/^\d{4}$/.test(k)) return MONTHS.filter((r) => r[0].slice(0, 4) === k);
    if (/^\d{4}-\d\d$/.test(k)) return MONTHS.filter((r) => r[0] === k);
    return [];
  }
  const isPend = () => false;   // census 전구간 확보 — 수집중 구간 없음
  /* 기간 라벨. PERIODS 에는 올해 월만 들어 있어, 다른 해의 월을 고르면
     "2025-03" 같은 날것이 그대로 나왔다. 키에서 직접 만든다. */
  const perLab = (k) => {
    if (k === "custom" && isCus()) return VF.label(st.range.a, st.range.b);
    if (k === "all") return "전체";
    if (/^\d{4}$/.test(k)) return k + "년";
    if (/^\d{4}-\d\d$/.test(k)) return `${k.slice(0, 4)}년 ${+k.slice(5)}월`;
    return (PERIODS.find((p) => p.k === k) || {}).lab || k;
  };

  function regionRoll() {
    const R = {};
    STORES.forEach(([name, reg, s, l]) => {
      (R[reg] = R[reg] || { s: 0, l: 0, stores: [] });
      R[reg].s += s; R[reg].l += l; R[reg].stores.push({ name, s, l });
    });
    return R;
  }

  // 선택 기간 → 시도별 추정 집계(제목기반, 전국 17개 시도). 월 선택 시 해당 연도 기준.
  function geoRegionKey(p) {
    if (/^\d{4}$/.test(p)) return p;
    if (/^\d{4}-\d\d$/.test(p)) return p.slice(0, 4);
    return "all";
  }
  /* 매장 단위 기간 키 — 월(YYYY-MM)은 표본이 희박해 해당 연도로 폴백 */
  function storePeriodKey() {
    const p = st.period;
    if (p === "custom") return "custom";
    if (p === "all") return "all";
    if (/^\d{4}-\d\d$/.test(p)) return p.slice(0, 4);
    return p;
  }
  /* 선택 기간의 매장 목록(지역별). 없으면 전체 */
  function periodStores(rg) {
    if (hasF()) return (A().stores[rg] || []).map((x) => ({ name: x.n, s: x.s, l: x.l }));
    const PS = (CD && CD.periodStores) || {};
    const k = storePeriodKey();
    const m = PS[k] || PS.all || {};
    return (m[rg] || []).map((x) => ({ name: x.n, s: x.s, l: x.l }));
  }
  /* 선택 기간의 품목 상세 */
  function periodItems(kind, key) {
    if (hasF()) {
      const src = kind === "store" ? cus().storeItems : cus().regionItems;
      const m = src[key] || src[Object.keys(src).find((x) => key.indexOf(x) === 0 || x.indexOf(key) === 0)];
      const out = VF.top(m, kind === "store" ? 3 : 5, 6);
      return out.length ? out : null;
    }
    const SRC = (CD && CD[kind === "store" ? "periodStoreItems" : "periodRegionItems"]) || {};
    const k = storePeriodKey();
    const m = SRC[k] || SRC.all || {};
    if (m[key]) return m[key];
    const hit = Object.keys(m).find((x) => key.indexOf(x) === 0 || x.indexOf(key) === 0);
    return hit ? m[hit] : null;
  }

  /* 선택 기간의 분석 묶음(지역·품목·혜택·비교). 없으면 전체로 폴백 */
  function perData() {
    if (hasF()) {
      const a = A();
      // 기간 탭과 같은 소표본 컷을 적용해 노이즈를 막는다(지역 3, 품목 5, 혜택 3)
      const cut = (src, n) => {
        const o = {};
        Object.keys(src).forEach((k) => { if (src[k].s + src[k].l >= n) o[k] = src[k]; });
        return o;
      };
      return { regions: cut(a.regions, 3), items: cut(a.items, 5),
               benefit: cut(a.benefit, 3), compare: a.compare };
    }
    const BP = (CD && CD.byPeriod) || {};
    return BP[st.period] || BP.all || {};
  }

  function geoRegions() {
    const RG = perData().regions || (CD && CD.regions) || {};
    // 신구조: {지역:{s,l}} 평면. (구조: 기간별·배열 [s,l]도 호환)
    const src = (RG.all || RG[geoRegionKey ? geoRegionKey(st.period) : "all"] || RG);
    const out = {};
    Object.keys(src).forEach((k) => {
      const v = src[k];
      if (Array.isArray(v)) out[k] = { s: v[0], l: v[1] };
      else if (v && typeof v === "object" && "s" in v) out[k] = { s: v.s, l: v.l };
    });
    return out;
  }

  // ── 정성 인사이트(근거 기반, 추정은 태그) ──
  const WHY_US = [
    ["매니저 1:1 상담·맞춤 견적", "졸업후기에 '○○매니저님 최고/추천' 언급이 압도적으로 많음 — 사람(상담품질)이 핵심 구매이유"],
    ["온누리상품권 20% 페이백", "2026-05 삼성 쏠림(67%)의 주요 동인으로 추정 — 맘카페 실후기 다수"],
    ["비스포크 AI 신제품·색상 패키지", "냉장고·콤보 등 디자인+신기능 선호"],
    ["체감가·혜택(임직원몰보다 저렴 사례)", "발품 비교 후 최종 삼성 선택 후기"],
  ];
  const WHY_COMP = [
    ["LG 오브제 디자인 선호", "색감·인테리어 매칭을 이유로 LG 선택(추정)"],
    ["디오스/트롬 성능 신뢰", "건조기·의류관리기 등 특정 품목 강세(추정)"],
    ["LG 베스트샵 명장 상담", "오프라인 상담 만족 후기(추정)"],
  ];
  const ITEMS = ["냉장고", "세탁기", "건조기", "TV", "에어컨", "의류관리기"];
  const ITEMS_WHY = "혼수 필수 4종(냉장고·세탁기·건조기·TV) 중심. 비스포크/오브제 색상·패키지 견적 비교가 후기 단골 주제. (품목별 정량 건수는 본문 코딩 확대 시 제공 — 현재 정성 추정)";

  // ── 작은 시각화 ──
  function miniTrend(rows) {
    const W = 460, H = 150, pL = 34, pR = 44, pT = 12, pB = 22, n = rows.length;
    if (n < 2) return "";
    const A = rows.map((r) => r[2]), B = rows.map((r) => r[3]);
    const maxY = Math.max(...A, ...B, 1) * 1.15;
    const X = (i) => pL + (i * (W - pL - pR)) / (n - 1);
    const Y = (v) => pT + (1 - v / maxY) * (H - pT - pB);
    const pts = (a) => a.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
    const line = (a, c) => `<polyline points="${pts(a)}" fill="none" stroke="${c}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
    const ld = (a, c) => `<circle cx="${X(n - 1).toFixed(1)}" cy="${Y(a[n - 1]).toFixed(1)}" r="4.5" fill="${c}" stroke="#fff" stroke-width="2"/>`;
    let xl = "";
    const step = Math.max(1, Math.ceil(n / 6));
    rows.forEach((r, i) => { if (i % step === 0 || i === n - 1) xl += `<text x="${X(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="ca-axt">${r[0].slice(2)}</text>`; });
    const endL = `<text x="${(X(n - 1) + 5).toFixed(1)}" y="${(Y(A[n - 1]) + 4).toFixed(1)}" class="ca-end s">${fmtN(A[n - 1])}</text>` +
      `<text x="${(X(n - 1) + 5).toFixed(1)}" y="${(Y(B[n - 1]) + 4).toFixed(1)}" class="ca-end l">${fmtN(B[n - 1])}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="ca-svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="삼성 vs LG 추이">${line(B, LG)}${line(A, SS)}${ld(B, LG)}${ld(A, SS)}${endL}${xl}</svg>`;
  }
  function vsBars(s, l) {
    const max = Math.max(s, l, 1);
    return `<div class="ca-vs">` +
      `<div class="ca-vsrow"><span class="ca-vsk s">삼성</span><span class="ca-vsbar s" style="width:${(s / max) * 100}%"><em>${fmtN(s)}</em></span></div>` +
      `<div class="ca-vsrow"><span class="ca-vsk l">LG</span><span class="ca-vsbar l" style="width:${(l / max) * 100}%"><em>${fmtN(l)}</em></span></div>` +
      `</div>`;
  }

  // ── 전국 광역시/도 지도(SVG) — geo-status-map 스킬 산출물 사용 ──
  //   web/assets/korea-sido.svg(실제 시도 경계) + korea-sido-labels.json(라벨 좌표)을
  //   비동기 로드 → 지역 데이터로 색·라벨 바인딩. (1회 로드 후 캐시)
  let GEO_SVG = null, GEO_LAB = null;
  function loadGeo(cb) {
    if (GEO_SVG && GEO_LAB) return cb();
    // 1순위: <script>로 심은 window.KOREA_SIDO (fetch·CORS·캐시 문제 없음)
    if (window.KOREA_SIDO && window.KOREA_SIDO.svg) {
      GEO_SVG = window.KOREA_SIDO.svg; GEO_LAB = window.KOREA_SIDO.labels; return cb();
    }
    // 폴백: 파일 fetch (http 서버에서만)
    const v = "?v=2026r11";
    Promise.all([
      fetch("assets/korea-sido.svg" + v).then((r) => { if (!r.ok) throw 0; return r.text(); }),
      fetch("assets/korea-sido-labels.json" + v).then((r) => { if (!r.ok) throw 0; return r.json(); }),
    ]).then(([svg, lab]) => { GEO_SVG = svg; GEO_LAB = lab; cb(); }).catch(() => cb(true));
  }
  function geoMap() {
    return `<div id="caGeoHost" class="ca-geohost">지도 불러오는 중…</div>`;
  }
  function paintGeo(host) {
    const wrap = host.querySelector("#caGeoHost");
    if (!wrap) return;
    loadGeo(function (err) {
      if (err || !GEO_SVG) { wrap.innerHTML = `<p class="ca-note">지도 파일을 불러오지 못했습니다 (assets/korea-sido.svg). geo-status-map 스킬로 생성하세요.</p>`; return; }
      wrap.innerHTML = GEO_SVG;
      const svg = wrap.querySelector("svg");
      if (!svg) return;
      const R = geoRegions();          // 전국 17개 시도(제목기반 추정)
      const RS = regionRoll();         // 부울경 매장 본문매칭 — 이 지역만 매장 드릴 가능
      // 경계 색칠 + 클릭 가능 여부
      svg.querySelectorAll("path[data-region]").forEach((p) => {
        const name = p.getAttribute("data-region"), d = R[name];
        p.insertAdjacentHTML("afterbegin", `<title>${name}</title>`);  // 호버 시 시도명
        // 드릴 가능 여부도 선택 기간 기준 — 그 기간에 매장 표본이 있어야 들어간다
        const hasStores = periodStores(name).length > 0 || !!RS[name];
        if (d && (d.s + d.l) > 0) {
          const lead = d.s > d.l ? "s" : d.l > d.s ? "l" : "even";
          p.setAttribute("class", "on " + lead + (hasStores ? " drill" : ""));
          // 선거지도식: 우세 격차(승자 점유율)에 따라 채움 진하기 차등
          const win = Math.max(pct(d.s, d.l), pct(d.l, d.s));
          const blues = ["#9fc0f0", "#5d92e8", "#1f5fd0"], reds = ["#eda6b6", "#e2607a", "#c81e3c"];
          const scale = lead === "l" ? reds : blues;
          p.style.fill = lead === "even" ? "#9aa7bd" : scale[win >= 65 ? 2 : win >= 55 ? 1 : 0];
          if (hasStores) {
            p.setAttribute("tabindex", "0"); p.setAttribute("role", "button");
            p.setAttribute("aria-label", `${name} 총 ${d.s + d.l}건 삼성 ${pct(d.s, d.l)}% — 클릭하면 매장별`);
          }
        } else { p.setAttribute("class", "off"); }
      });
      // 시도명만 옅게 상시 표기(데이터 지역은 진하게). 현황 박스는 두지 않고 호버 툴팁으로.
      // 인접 라벨 겹침 보정(경기는 아래로, 서울은 위로, 인천은 좌로)
      const NUDGE = { 경기: { dx: 4, dy: 11 }, 서울: { dx: 1, dy: -3 }, 인천: { dx: -6, dy: -1 } };
      let names = "";
      Object.keys(GEO_LAB).forEach((name) => {
        const p = GEO_LAB[name], n = NUDGE[name] || { dx: 0, dy: 0 };
        names += `<text class="pv-name${R[name] ? " on" : ""}" x="${p.x + n.dx}" y="${p.y + 2 + n.dy}">${name}</text>`;
      });
      svg.insertAdjacentHTML("beforeend", names);

      // 호버 툴팁 — 시도명 + 도넛(삼성vsLG) + 건수 + %
      const tip = document.createElement("div");
      tip.className = "ca-geo-tip"; tip.hidden = true;
      wrap.appendChild(tip);
      svg.querySelectorAll("path.on").forEach((p) => {
        const name = p.getAttribute("data-region"), d = R[name]; if (!d) return;
        const sh = pct(d.s, d.l), tot = d.s + d.l;
        p.addEventListener("mouseenter", () => {
          tip.innerHTML =
            `<span class="gt-donut" style="--sh:${sh}"><b>${sh}<i>%</i></b></span>` +
            `<span class="gt-txt"><b class="gt-rg">${name}</b>` +
            `<span class="gt-n">총 <b>${fmtN(tot)}</b>건</span>` +
            `<span class="gt-bd"><i class="s">삼성 ${fmtN(d.s)} (${sh}%)</i><i class="l">LG ${fmtN(d.l)} (${100 - sh}%)</i></span></span>`;
          tip.hidden = false;
        });
        p.addEventListener("mousemove", (e) => {
          const r = wrap.getBoundingClientRect();
          let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
          x = Math.min(x, r.width - tip.offsetWidth - 6);
          y = Math.min(y, r.height - tip.offsetHeight - 6);
          tip.style.left = Math.max(6, x) + "px";
          tip.style.top = Math.max(6, y) + "px";
        });
        p.addEventListener("mouseleave", () => { tip.hidden = true; });
      });
    });
  }

  // ── 데이터 맥락 산출 ──
  function context() {
    // 반환: {title, sub, s, l, trend(html), targets:[{label,go}], geoNote, pend, part}
    const p = st.period;
    if (st.level === "nation") {
      if (isPend(p)) return { title: "전사 현황", sub: perLab(p), pend: true };
      const rows = monthsFor(p);
      const s = rows.reduce((a, r) => a + r[2], 0), l = rows.reduce((a, r) => a + r[3], 0);
      const total = rows.reduce((a, r) => a + r[1], 0);
      const trend = rows.length >= 2 ? miniTrend(rows) : vsBars(s, l);
      return { title: "전국 현황", sub: perLab(p), s, l, total, trend,
        part: p === "2024", geo: true };
    }
    const R = regionRoll();
    // 지정 구간은 팩트 테이블에서 지역·매장까지 그대로 분해되므로 경고가 필요 없다
    const geoNote = hasF() ? ""
      : "지역·매장 분해는 2026 누적 기준만 제공(과거 기간은 백필 통합 후)";
    if (st.level === "region") {
      if (hasF()) {
        const ps = periodStores(st.region);
        const gr0 = geoRegions()[st.region] || { s: 0, l: 0 };
        return { title: st.region, sub: `매장별 · ${perLab(p)}`, s: gr0.s, l: gr0.l,
          trend: vsBars(gr0.s, gr0.l), geoNote: "", stores: ps };
      }
      const rs = R[st.region];   // 부울경 본문매칭(정확)
      if (rs) {
        // 매장 목록은 기간 연동 집계를 우선 사용(없을 때만 본문매칭 고정본)
        const ps = periodStores(st.region);
        const gr0 = geoRegions()[st.region] || { s: rs.s, l: rs.l };
        const useP = ps.length >= 2;
        return { title: st.region, sub: useP ? `매장별 · ${perLab(st.period)}` : "매장 본문매칭 · 2026 누적",
          s: useP ? gr0.s : rs.s, l: useP ? gr0.l : rs.l,
          trend: vsBars(useP ? gr0.s : rs.s, useP ? gr0.l : rs.l),
          geoNote, stores: useP ? ps : rs.stores.slice().sort((a, b) => (b.s + b.l) - (a.s + a.l)) };
      }
      const gr = geoRegions()[st.region] || { s: 0, l: 0 };
      // 본문매칭 완료 지역(예: 경기)은 정밀 디렉터리 사용
      const bs = CD && CD.bodyStores && CD.bodyStores[st.region];
      if (bs) {
        return { title: st.region, sub: "매장 본문매칭 · 전체기간", s: gr.s, l: gr.l, trend: vsBars(gr.s, gr.l),
          geoNote: "", stores: bs.map((x) => ({ name: x.n, s: x.s, l: x.l })) };
      }
      const cd = periodStores(st.region);
      return { title: st.region, sub: `제목기반 점별 추정 · ${perLab(st.period)}`, s: gr.s, l: gr.l, trend: vsBars(gr.s, gr.l),
        geoNote: "이 지역은 제목기반 추정(매장명 추출) — 본문매칭 전", stores: cd };
    }
    // store — 부울경은 본문매칭 STORES, 그 외는 제목기반 CD.stores
    const row = STORES.find((x) => x[0] === st.store);
    if (row) {
      const pr = periodStores(st.region).find((x) => x.name === st.store);
      const sv = pr ? pr.s : row[2], lv = pr ? pr.l : row[3];
      return { title: st.store, sub: `${row[1]} · ${pr ? perLab(st.period) : "매장 본문매칭 2026 누적"}`,
        s: sv, l: lv, trend: vsBars(sv, lv), geoNote, samples: SAMPLES[st.store] };
    }
    const psList = periodStores(st.region);
    const pHit = psList.find((x) => x.name === st.store);
    const bsr = (CD && CD.bodyStores && CD.bodyStores[st.region]) || null;
    const src = bsr || ((CD && CD.stores && CD.stores[st.region]) || []);
    const cdRow = pHit || src.find((x) => x.n === st.store) || { s: 0, l: 0 };
    return { title: st.store, sub: `${st.region} · ${bsr ? "매장 본문매칭" : "제목기반 추정"}`, s: cdRow.s, l: cdRow.l,
      trend: vsBars(cdRow.s, cdRow.l), geoNote: bsr ? "" : "제목기반 점별 추정 — 본문 샘플은 부울경만 제공", samples: null };
  }

  /* 지역 내 매장 목록(정렬됨) — 순위·평균 계산 공용 */
  function storesOfRegion(rg) {
    if (hasF()) return periodStores(rg);
    const R = regionRoll()[rg];
    if (R) return R.stores.slice().sort((a, b) => (b.s + b.l) - (a.s + a.l));
    const bs = (CD && CD.bodyStores && CD.bodyStores[rg]) || (CD && CD.stores && CD.stores[rg]) || [];
    return bs.map((x) => ({ name: x.n || x.name, s: x.s, l: x.l }))
      .sort((a, b) => (b.s + b.l) - (a.s + a.l));
  }

  // ── 렌더 ──
  /* 기간 줄 — 연도와 월을 각각 **칩 하나**로 접는다.
     19개 버튼이 한 줄에 늘어서 겹치던 것을 8개로 줄였는데(2026-08-21 1차),
     그래도 길다는 지적을 받아 월도 창으로 접었다. 이제 두 칸이면 끝난다:

         [2026 ▾] [8월 ▾]

     칩을 누르면 그 단위 전체(연도 전체 / 그 달), 마우스를 올리면 목록이 열린다. */
  function nav() {
    const y = st.navY || CUR_Y;
    const ms = MONTHS.filter((m) => m[0].slice(0, 4) === y);
    const yrOn = st.period === y;
    const isAll = st.period === "all";
    const curM = /^\d{4}-\d\d$/.test(st.period) ? st.period : null;

    // 월 칩에 뭐라고 쓸지 — 고른 것이 달이면 "8월", 연도면 "연간", 전체면 "전체"
    // 전체 기간에는 '월'이라는 개념이 없다. 두 칩이 나란히 '전체'라고 적혀 있으면
    // 같은 말을 두 번 하는 셈이라 어색하다(실측). 고르라는 안내로 바꾼다.
    const mLab = curM ? (+curM.slice(5)) + "월" : (isAll ? "월 선택" : "연간");

    const yrMenu = YEARS.slice().reverse().map((v) =>
        `<button type="button" data-navy="${v}" class="${v === y ? "cur" : ""}">${v}년</button>`).join("")
      + `<button type="button" data-per="all" class="${isAll ? "cur" : ""}">전체 기간</button>`;

    const mMenu = `<button type="button" data-per="${y}" class="${yrOn ? "cur" : ""}">${y}년 전체</button>`
      + ms.map((m) => `<button type="button" data-per="${m[0]}"` +
          ` class="${st.period === m[0] ? "cur" : ""}">${+m[0].slice(5)}월</button>`).join("");

    return `<div class="ca-nav" id="caNav">` +
      `<span class="ca-yr${yrOn || isAll ? " on" : ""}" tabindex="0">` +
      `<button type="button" data-per="${y}" class="ca-yrb${yrOn ? " on" : ""}"` +
      ` title="${y}년 전체로 보기">${isAll ? "전체" : y}<i>▾</i></button>` +
      `<span class="ca-yrm">${yrMenu}</span></span>` +
      `<span class="ca-yr ca-mo${curM ? " on" : ""}" tabindex="0">` +
      `<button type="button" class="ca-yrb${curM ? " on" : ""}"` +
      ` title="월 고르기">${mLab}<i>▾</i></button>` +
      `<span class="ca-yrm ca-mom">${mMenu}</span></span>` +
      `</div>`;
  }

  /* 기간 직접 입력 — 버튼(전체/연도/월)과 나란히. 하루 단위로 잘라 집계한다 */
  function rangeBox() {
    if (!VF) return "";
    const a = (st.range && st.range.a) || VF.d0;
    const b = (st.range && st.range.b) || VF.d1;
    return `<span class="ca-range${isCus() ? " on" : ""}">` +
      `<span class="car-lb">기간 직접 입력</span>` +
      `<input type="date" class="car-d" id="carA" value="${a}" min="${VF.d0}" max="${VF.d1}" aria-label="시작일">` +
      `<i class="car-tilde">~</i>` +
      `<input type="date" class="car-d" id="carB" value="${b}" min="${VF.d0}" max="${VF.d1}" aria-label="종료일">` +
      `<button type="button" class="car-go" id="carGo">적용</button>` +
      (isCus() ? `<button type="button" class="car-off" id="carOff" title="기간 버튼으로 되돌리기">해제</button>` : "") +
      `</span>`;
  }
  /* 긴 글은 문장 단위로 끊어 단락으로 만든다.
     사용자 지시(2026-08-21): "진단 등 글이 길 경우 단락을 나눠주면 가독성이 좋아져 …
     그래야 홈페이지가 정돈된 느낌이 나지".
     소수점(1.07배)은 마침표 뒤에 공백이 없어 걸리지 않는다. */
  function para(s) {
    const parts = String(s).split(/\.\s+/).filter(Boolean);
    if (parts.length < 2) return `<span class="pl">${s}</span>`;
    return parts.map((t, i) =>
      `<span class="pl">${t}${i < parts.length - 1 ? "." : ""}</span>`).join("");
  }

  function crumb() {
    if (st.level === "nation") return "";   // 전사 단일 항목은 숨김(중복)
    const parts = [["전사", "nation"]];
    if (st.level === "region" || st.level === "store") parts.push([st.region, "region"]);
    if (st.level === "store") parts.push([st.store, "store"]);
    return `<div class="ca-crumb">` + parts.map((p, i) =>
      (i ? `<i>›</i>` : "") + `<button type="button" data-lv="${p[1]}"${i === parts.length - 1 ? " class=here" : ""}>${p[0]}</button>`
    ).join("") + `</div>`;
  }
  function whyBlock(c) {
    const lead = c.s > c.l ? `삼성 우위 <b>+${fmtN(c.s - c.l)}</b>` : c.l > c.s ? `<span class="warn">LG 우위 +${fmtN(c.l - c.s)}</span>` : "삼성·LG 백중";
    const li = (arr) => arr.map((x) => `<li title="${x[1]}">${x[0]}<i>ⓘ</i></li>`).join("");
    const reason = c.s >= c.l
      ? "백화점 삼성스토어 졸업후기·매니저 상담 만족이 LG 대비 많음"
      : "이 구간은 LG 후기가 더 많음 — 디자인(오브제)·특정 품목 강세. 역전 타깃";
    return `<div class="ca-why">` +
      `<div class="ca-wcard"><h5>우위</h5><p class="big">${lead}</p><p class="sm">${reason}</p></div>` +
      `<div class="ca-wcard"><h5>삼성 선택 이유 <i class="ca-tag">추정</i></h5><ul class="ca-rs">${li(WHY_US)}</ul></div>` +
      `<div class="ca-wcard"><h5>LG 선택 이유 <i class="ca-tag">추정</i></h5><ul class="ca-rs">${li(WHY_COMP)}</ul></div>` +
      `<div class="ca-wcard"><h5>자주 나온 품목 <i class="ca-tag">추정</i></h5>` +
      `<div class="ca-items">${ITEMS.map((n) => `<span>${n}</span>`).join("")}</div>` +
      `<p class="sm" title="${ITEMS_WHY}">왜 이 품목? ⓘ</p></div>` +
      `</div>`;
  }
  function drillBlock(c) {
    if (c.drill) return `<button type="button" class="ca-drill" data-lv="${c.drill.to}">${c.drill.label} <span>→</span></button>`;
    if (c.regions) return `<div class="ca-drillgrid">` + c.regions.map((r) => {
      const lead = r.s === r.l ? "even" : r.s > r.l ? "s" : "l";
      return `<button type="button" class="ca-dr ${lead}" data-region="${r.rg}"><b>${r.rg}</b>` +
        `<span>삼성 ${r.s} : LG ${r.l}</span><i>→</i></button>`;
    }).join("") + `</div>`;
    if (c.stores) return `<div class="ca-drillgrid st">` + c.stores.map((s) => {
      const lead = s.s === s.l ? "even" : s.s > s.l ? "s" : "l";
      return `<button type="button" class="ca-dr ${lead}" data-store="${s.name}"><b>${s.name}</b>` +
        `<span>삼성 ${s.s} : LG ${s.l}</span><i>→</i></button>`;
    }).join("") + `</div>`;
    if (c.samples) {
      const s = c.samples;
      const card = (r) => `<a href="${r[2]}" target="_blank" rel="noopener"><span class="ca-sm-tag ${r[1]}">${{ s: "삼성", l: "LG", b: "삼성·LG" }[r[1]] || "기타"}</span>${r[0]}</a>`;
      return `<div class="ca-spl"><div class="ca-splcol"><h6 class="pos">우호 후기 ${s.pos.length}</h6>${s.pos.map(card).join("") || '<p class="ca-splx">표본 적음</p>'}</div>` +
        `<div class="ca-splcol"><h6 class="neg">비난·주의 ${s.neg.length}</h6>${s.neg.map(card).join("") || '<p class="ca-splx">검출 안 됨 — 졸업후기 특성상 긍정 편향 유의</p>'}</div></div>`;
    }
    return "";
  }

  function nkpi(k, v, sub, cls) {
    return `<div class="ca-nkpi ${cls}"><span class="nk-k">${k}</span>` +
      `<span class="nk-v">${v}<i>건</i></span><span class="nk-s">${sub}</span></div>`;
  }

  // 부울경 층은 걷어냈다. 전국 대상이 된 뒤로 진입 경로가 없는 막다른 층이 됐고
  // (지도에서 지역을 누르면 바로 region 으로 간다) 브레드크럼에만 남아 혼동을 줬다.
  // 왜 부울경만 있고 수도권은 없느냐는 물음에도 답할 수 없다.
  const LV = ["nation", "region", "store"];
  // 하단 페이저(⤒ ‹ ›)는 걷어냈다. 같은 화면 상단에 이미 VNAV 가 있어 두 벌이었고,
  // 둘은 서로 다른 것을 셌다 — 상단은 '지나온 화면', 하단은 '드릴 단계'.
  // 그래서 같은 '‹' 가 화면마다 다른 곳으로 갔다. 이동은 상단 VNAV 하나로만 한다.

  // 전체현황 3분할 바 (삼성/LG/기타 유통)
  function distBar(s, l, etc) {
    const tot = s + l + etc || 1;
    const sl = s + l || 1;
    const ss = Math.round(s / sl * 100), ls = 100 - ss;
    const seg = (v, cls) => v > 0 ? `<div class="db-seg ${cls}" style="width:${(v / tot * 100).toFixed(1)}%"></div>` : "";
    return `<div class="ca-vs">` +
      `<div class="vs-side s"><b>${ss}<i>%</i></b><span>삼성 ${fmtN(s)}건</span></div>` +
      `<div class="vs-mid">` +
      `<div class="ca-distbar">` + seg(s, "s") + seg(l, "l") + seg(etc, "x") + `</div>` +
      `<div class="vs-etc">기타·미상 ${fmtN(etc)}건 포함</div>` +
      `</div>` +
      `<div class="vs-side l"><b>${ls}<i>%</i></b><span>LG ${fmtN(l)}건</span></div>` +
      `</div>`;
  }
  // 전국 현황 박스 하단 — 우위/열세 지역 요약(제목기반 추정, 표본 충분 시도만)
  function regionSummary() {
    const R = geoRegions();
    const arr = Object.keys(R).map((rg) => {
      const d = R[rg], tot = d.s + d.l;
      return { rg, tot, sh: pct(d.s, d.l) };
    }).filter((x) => x.tot >= 200);   // 소표본(제주 25건 등)이 1위로 오르는 왜곡 방지
    if (arr.length < 2) return "";
    // 우위=삼성 50% 초과, 열세=50% 미만으로 갈라 중복을 원천 차단
    // (상·하위 N개를 따로 뽑으면 지역 수가 적을 때 같은 지역이 양쪽에 나온다)
    const win = arr.filter((x) => x.sh > 50).sort((a, b) => b.sh - a.sh).slice(0, 3);
    const lose = arr.filter((x) => x.sh < 50).sort((a, b) => a.sh - b.sh).slice(0, 3);
    if (!win.length && !lose.length) return "";
    const chips = (list) => list.map((x) => `<span class="rs-chip" title="표본 ${fmtN(x.tot)}건">${x.rg} <i>${x.sh}%</i><em>${fmtN(x.tot)}</em></span>`).join("");
    return `<div class="nsc-rsum">` +
      (win.length ? `<div class="rs-row s"><b>삼성 우위</b>${chips(win)}</div>` : "") +
      (lose.length ? `<div class="rs-row l"><b>열세(LG↑)</b>${chips(lose)}</div>`
                   : `<div class="rs-row l"><b>열세(LG↑)</b><span class="rs-none">표본 기준 없음</span></div>`) +
      `<p class="rs-cap">시도 삼성비중 상·하위 · 제목기반 추정</p></div>`;
  }

  /* ── 지역 페이지 — 매장(또는 하위지역) 랭킹 + 우위/열세 진단 ── */
  function regionView(c) {
    // 부울경 단계에서는 지역 목록을, 지역 단계에서는 매장 목록을 랭킹으로 보여준다
    const isBu = !c.stores && !!c.regions;
    const src = isBu ? c.regions.map((r) => ({ name: r.rg, s: r.s, l: r.l })) : (c.stores || []);
    const attr = isBu ? "data-region" : "data-store";
    const unit = isBu ? "지역" : "매장";
    const list = src.map((x) => ({ n: x.name || x.n || x.rg, s: x.s, l: x.l }))
      .sort((a, b) => (b.s + b.l) - (a.s + a.l));
    // 표본 하한은 지역 규모에 비례(고정 20건이면 지방 소도시 매장이 통째로 사라진다)
    if (!isBu && list.length) {
      const big = list[0].s + list[0].l;
      const floor = Math.max(3, Math.min(20, Math.round(big * 0.06)));
      const kept = list.filter((x) => x.s + x.l >= floor);
      if (kept.length) list.length = 0, kept.forEach((x) => list.push(x));
    }
    const share = pct(c.s, c.l);
    const nat = natShare();          // 기준선도 선택 기간의 전국 비중이어야 한다
    const diff = share - nat;
    const max = Math.max(1, ...list.map((x) => x.s + x.l));
    // ── 진단: 우위/열세/기회 분류 ──
    const win = list.filter((x) => x.s > x.l), lose = list.filter((x) => x.l > x.s);
    const sized = list.filter((x) => x.s + x.l >= 10);
    const top = sized.slice().sort((a, b) => pct(b.s, b.l) - pct(a.s, a.l))[0];
    // 기회 = 표본이 큰데 삼성이 지는 곳(격차가 클수록 우선). 여기를 잡으면 지역 순위가 바뀐다.
    const opps = list.filter((x) => x.l > x.s).sort((a, b) => (b.l - b.s) - (a.l - a.s));
    const oppGap = opps.reduce((a, x) => a + (x.l - x.s), 0);
    const bot = opps[0] || sized.slice().sort((a, b) => pct(a.s, a.l) - pct(b.s, b.l))[0];
    // 집중도: 상위 1곳이 지역 표본에서 차지하는 비중(쏠림이면 그 매장이 지역 성적을 좌우)
    const totAll = list.reduce((a, x) => a + x.s + x.l, 0) || 1;
    const headShare = list[0] ? Math.round((list[0].s + list[0].l) / totAll * 100) : 0;

    const rowOf = (x, i) => {
      const tot = x.s + x.l, sh = pct(x.s, x.l), gap = x.s - x.l;
      const lead = x.s > x.l ? "s" : x.l > x.s ? "l" : "even";
      return `<button type="button" class="rv-row ${lead}" ${attr}="${x.n}" title="${x.n} · 삼성 ${x.s} vs LG ${x.l}">` +
        `<span class="rv-rank">${i}</span>` +
        `<span class="rv-name">${x.n}</span>` +
        `<span class="rv-cnt"><i class="s">${fmtN(x.s)}</i><em>:</em><i class="l">${fmtN(x.l)}</i></span>` +
        `<span class="rv-bar"><i class="s" style="width:${(x.s / max * 100).toFixed(1)}%"></i>` +
        `<i class="l" style="width:${(x.l / max * 100).toFixed(1)}%"></i></span>` +
        `<span class="rv-num">${fmtN(tot)}</span>` +
        `<span class="rv-sh ${lead}">${sh}%</span>` +
        `<span class="rv-gap ${gap >= 0 ? "s" : "l"}">${gap >= 0 ? "+" : ""}${fmtN(gap)}</span></button>`;
    };
    const rows = list.map((x, i) => rowOf(x, i + 1)).join("");

    // ── 자동 진단 문장 (데이터에서 도출) · 한글 조사 자동 처리 ──
    const hasJong = (w) => { const ch = (w || "").replace(/[^가-힣]/g, "").slice(-1); return ch ? (ch.charCodeAt(0) - 0xac00) % 28 !== 0 : false; };
    const josa = (w, a, b) => w + (hasJong(w) ? a : b);   // 예: josa("경기","은","는")
    const diag = [];
    diag.push(`${josa(c.title, "은", "는")} 삼성 비중 <b>${share}%</b>로 전국(${nat}%) 대비 <b class="${diff >= 0 ? "up" : "down"}">${diff >= 0 ? "+" : ""}${diff}p ${diff >= 0 ? "강세" : "약세"}</b>입니다.`);
    if (list.length) diag.push(`${unit} ${list.length}곳 중 <b>${win.length}곳 우위</b>, <b class="down">${lose.length}곳 열세</b>.`);
    if (headShare >= 40 && list[0]) diag.push(`표본이 <b>${list[0].n}</b>에 ${headShare}% 쏠려 있어 이 ${unit}의 성적이 지역 전체를 좌우합니다.`);
    if (opps.length) diag.push(`열세 ${unit}에서 LG가 누적 <b class="down">${fmtN(oppGap)}건</b> 앞서며, 이 격차가 지역 순위의 실질 손실분입니다.`);
    else if (list.length) diag.push(`열세 ${josa(unit, "이", "가")} 없어 <b>방어 국면</b> — 현 우위를 유지하며 후기 확보를 지속하는 것이 과제입니다.`);

    const oppCards = opps.slice(0, 3).map((x) => {
      const gap = x.l - x.s;
      return `<button type="button" class="rv-opp" ${attr}="${x.n}">` +
        `<span class="op-n">${x.n}</span>` +
        `<span class="op-gap">LG <b>+${fmtN(gap)}</b></span>` +
        `<span class="op-sh">삼성 ${pct(x.s, x.l)}%</span></button>`;
    }).join("");

    // 이 지역에서 실제로 지고 있는 품목(있으면 액션에 반영)
    const rIt = (typeof periodItems === "function" && !isBu) ? (periodItems("region", c.title) || []) : [];
    const rLose = rIt.filter((x) => x.l > x.s).sort((a, b) => (b.l - b.s) - (a.l - a.s)).slice(0, 2);
    const itemLine = rLose.length
      ? ` 이 지역은 <b class="warn">${rLose.map((x) => x.n).join("·")}</b>에서 특히 밀립니다(LG +${fmtN(rLose.reduce((a, x) => a + x.l - x.s, 0))}건) — 상담 시 이 품목의 <b>삼성 대안 모델</b>을 먼저 제시하세요.`
      : "";
    const action = opps.length
      ? `<b>${opps[0].n}</b>부터 공략하세요 — LG가 <b class="warn">${fmtN(opps[0].l - opps[0].s)}건</b> 앞서 지역 격차의 ` +
        `<b>${Math.round((opps[0].l - opps[0].s) / (oppGap || 1) * 100)}%</b>를 차지합니다. ` +
        `이 ${unit} 한 곳만 동률로 만들어도 지역 삼성비중이 <b>${share}% → 약 ${pct(c.s + (opps[0].l - opps[0].s), c.l)}%</b>로 올라갑니다.` + itemLine
      : `열세 ${josa(unit, "이", "가")} 없습니다. <b>${top ? top.n : "선두"}</b>(삼성 ${top ? pct(top.s, top.l) : "-"}%)의 상담 방식을 표본이 적은 ${unit}으로 확산해 <b>후기 절대량</b>을 키우세요.` + itemLine;

    return `<div class="ca-rv">` +
      `<div class="rv-left">` +
      `<div class="rv-head"><h3>${c.title}</h3><span>${c.sub}</span></div>` +
      `<div class="rv-big"><b>${share}<i>%</i></b><span>삼성 비중</span></div>` +
      `<p class="rv-vs ${diff >= 0 ? "up" : "down"}">전국 ${nat}% 대비 <b>${diff >= 0 ? "+" : ""}${diff}p</b> ${diff >= 0 ? "강세" : "약세"}</p>` +
      `<div class="rv-kpis">` +
      `<div><b>${fmtN(c.s + c.l)}</b><span>후기</span></div>` +
      `<div class="s"><b>${fmtN(c.s)}</b><span>삼성</span></div>` +
      `<div class="l"><b>${fmtN(c.l)}</b><span>LG</span></div>` +
      `</div>` +
      `<div class="rv-split"><span class="s">우위 ${win.length}곳</span><span class="l">열세 ${lose.length}곳</span></div>` +
      (top ? `<div class="rv-pick s"><em>최강</em><b>${top.n}</b><span>삼성 ${pct(top.s, top.l)}%</span></div>` : "") +
      (bot && bot !== top ? `<div class="rv-pick l"><em>공략</em><b>${bot.n}</b><span>삼성 ${pct(bot.s, bot.l)}%</span></div>` : "") +
      (c.geoNote ? `<p class="ca-note">⚠ ${c.geoNote}</p>` : "") +
      `</div>` +
      `<div class="rv-right">` +
      // 진단 + 기회 + 액션
      `<div class="rv-diag">` +
      `<div class="rv-dhead"><h4>진단</h4>` +
      (opps.length ? `<span class="rv-oppsum">기회 ${opps.length}곳 · 회복 여지 <b>${fmtN(oppGap)}건</b></span>` : `<span class="rv-oppsum ok">열세 없음 · 방어 국면</span>`) +
      `</div>` +
      `<div class="rv-dtext">${diag.map((d) => `<span class="pl">${d}</span>`).join("")}</div>` +
      (oppCards ? `<div class="rv-opps">${oppCards}</div>` : "") +
      `<div class="rv-act"><em>액션</em>${para(action)}</div>` +
      `</div>` +
      `<div class="rv-rhead"><h4>${unit}별 경쟁력 <em>${list.length}곳</em></h4>` +
      `<span class="rv-leg"><i class="s"></i>삼성<i class="l"></i>LG · 클릭 시 ${unit} 상세</span></div>` +
      (list.length ? `<div class="rv-list">${rows}</div>`
        : `<p class="ca-splx">이 구간은 백화점 ${unit} 표본이 부족합니다.</p>`) +
      `</div>` +
      // 3열: 지역 진단(품목·혜택·추이)
      `<div class="rv-third">` +
      profileCard(isBu ? null : regionDetailOf(c.title), { title: `${c.title} 후기 진단`, items: periodItems("region", c.title) }) +
      (isBu ? "" : scaleCard("region", c.title)) +
      `</div></div>`;
  }

  /* ── 지역/매장 공용 진단 카드 — 추이·비교승률·품목·혜택 ── */
  function profileCard(d, opt) {
    if (!d) return `<div class="ca-ncard"><h4 class="ca-ch">${opt.title}</h4>` +
      `<p class="ca-splx">표본이 부족해 상세 분석을 제공하지 않습니다.</p></div>`;
    const its = (opt && opt.items) || d.items || [];
    const win = its.filter((x) => x.s > x.l), lose = its.filter((x) => x.l > x.s);
    const bars = its.map((x) => {
      const t = x.s + x.l, sh = pct(x.s, x.l), cls = x.s > x.l ? "s" : x.l > x.s ? "l" : "even";
      return `<li class="it-row ${cls}"><span class="it-n">${x.n}</span>` +
        `<span class="it-bar"><i style="width:${sh}%"></i></span>` +
        `<span class="it-v">${sh}<em>%</em></span><span class="it-c">${fmtN(t)}</span></li>`;
    }).join("");
    const mon = d.mon || [];
    const half = Math.floor(mon.length / 2);
    const prev = mon.slice(0, half).reduce((a, x) => a + x[1], 0);
    const recent = mon.slice(half).reduce((a, x) => a + x[1], 0);
    const mom = prev ? Math.round((recent - prev) / prev * 100) : 0;
    const cp = d.cmp || { s: 0, l: 0 }, cShare = pct(cp.s, cp.l);
    const bens = (d.ben || []).slice(0, 3).map((b) => `<span class="pf-ben">${b.n}<i>${b.c}</i></span>`).join("");
    return `<div class="ca-ncard sv-profile">` +
      `<h4 class="ca-ch">${opt.title} <i class="ca-tag">품목·혜택·추이</i></h4>` +
      `<div class="pf-top">` +
      `<div class="pf-kpi ${mom >= 0 ? "up" : "down"}"><b>${mom >= 0 ? "+" : ""}${mom}<i>%</i></b><span>최근 6개월</span></div>` +
      `<div class="pf-spark">${mon.length ? sparkline(mon) : ""}</div>` +
      `<div class="pf-kpi ${cShare >= 50 ? "up" : "down"}"><b>${cShare}<i>%</i></b><span>비교 승률</span></div>` +
      `</div>` +
      (its.length ? `<p class="pf-lb">품목별 승패 <em>삼성 비중</em></p><ul class="it-list pf-items">${bars}</ul>` : "") +
      (bens ? `<div class="pf-bens">${bens}</div>` : "") +
      `<p class="pf-sum">` +
      (win.length ? `<b>${win.map((x) => x.n).slice(0, 2).join("·")}</b> 강세` : "뚜렷한 강세 품목 없음") +
      (lose.length ? `, <b class="warn">${lose.map((x) => x.n).slice(0, 2).join("·")}</b>는 LG 우위 — 대안 제시 필요`
        : `, 열세 품목 없음 — <b>패키지 방어 양호</b>`) +
      `</p></div>`;
  }

  function regionDetailOf(rg) {
    if (hasF()) return VF.detail(A(), "region", rg);
    const RD = (CD && CD.regionDetail) || {};
    return RD[rg] || null;
  }

  /* ── 매장 상세 데이터 조회(표기 차 흡수) ── */
  function storeDetailOf(name) {
    if (hasF()) return VF.detail(A(), "store", name);
    const SD = (CD && CD.storeDetail) || {};
    if (SD[name]) return SD[name];
    const k = Object.keys(SD).find((x) => name.indexOf(x) === 0 || x.indexOf(name) === 0);
    return k ? SD[k] : null;
  }

  /* ── 매장 전반 후기 진단 — 품목·혜택·추이를 한 카드에 ── */
  function storeProfile(name) {
    return profileCard(storeDetailOf(name), { title: "매장 후기 진단", items: periodItems("store", name) });
  }

  /* 미니 추이 스파크라인 */
  function sparkline(mon) {
    const vals = mon.map((x) => x[1]);
    const max = Math.max(1, ...vals), W = 132, H = 34;
    const pts = vals.map((v, i) => [(i / Math.max(1, vals.length - 1)) * W, H - (v / max) * (H - 4) - 2]);
    const dpath = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const area = dpath + ` L${W} ${H} L0 ${H} Z`;
    return `<svg class="pf-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="최근 추이">` +
      `<path d="${area}" fill="rgba(31,95,208,0.12)"/>` +
      `<path d="${dpath}" fill="none" stroke="#1f5fd0" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` +
      `</svg><span class="pf-cap">${mon[0][0].slice(2)} → ${mon[mon.length - 1][0].slice(2)}</span>`;
  }

  /* ── 계약 규모·리스크 카드 — 객단가 프록시(패키지 규모)와 불만 신호 ── */
  function scaleCard(kind, key, regionKey) {
    const FA = hasF() ? A() : null;
    const SRC = FA ? FA.ext[kind === "store" ? "store" : "region"]
                  : ((CD && CD[kind === "store" ? "extStore" : "extRegion"]) || {});
    let d = SRC[key];
    if (!d) {
      const hit = Object.keys(SRC).find((x) => key.indexOf(x) === 0 || x.indexOf(key) === 0);
      d = hit ? SRC[hit] : null;
    }
    if (!d) return "";
    // 비교 기준: 매장이면 소속 지역, 지역이면 전국 평균
    const BASE = FA ? FA.ext.region : ((CD && CD.extRegion) || {});
    let base = null;
    if (kind === "store" && regionKey && BASE[regionKey]) base = BASE[regionKey];
    else {
      const vals = Object.values(BASE);
      if (vals.length) base = {
        pkgAvg: +(vals.reduce((a, x) => a + x.pkgAvg, 0) / vals.length).toFixed(1),
        negRate: +(vals.reduce((a, x) => a + x.negRate, 0) / vals.length).toFixed(1),
      };
    }
    const dPkg = base ? +(d.pkgAvg - base.pkgAvg).toFixed(1) : 0;
    const dNeg = base ? +(d.negRate - base.negRate).toFixed(1) : 0;
    const baseLab = kind === "store" ? (regionKey || "지역") + " 평균" : "전국 평균";
    const bigRate = d.tot ? Math.round(d.pkgBig / d.tot * 100) : 0;
    const tip = dPkg >= 0.3
      ? `묶음 규모가 ${baseLab}보다 큽니다 — <b>패키지 상담이 강점</b>. 단품 문의도 세트 견적으로 확장해 보세요.`
      : dPkg <= -0.3
        ? `묶음 규모가 ${baseLab}보다 <b class="warn">작습니다</b> — 단품 계약 비중이 높습니다. <b>세트 할인·묶음 견적</b>을 먼저 제시해 객단가를 올리세요.`
        : `묶음 규모는 ${baseLab} 수준입니다. <b>4개 이상 대형 패키지</b>(현재 ${bigRate}%) 비중을 늘리는 것이 객단가 개선 포인트입니다.`;
    const negTip = dNeg > 0.5
      ? ` 불만 언급이 ${baseLab} 대비 <b class="warn">+${dNeg}p</b> 높습니다 — 설치·배송 일정 안내를 강화하세요.`
      : ` 불만 언급은 ${baseLab} 대비 ${dNeg >= 0 ? "+" : ""}${dNeg}p로 관리되고 있습니다.`;
    return `<div class="ca-ncard sc-card">` +
      `<h4 class="ca-ch">계약 규모 · 리스크 <i class="ca-tag">객단가 프록시</i></h4>` +
      `<div class="sc-kpis">` +
      `<div class="sc-k"><b>${d.pkgAvg}<i>개</i></b><span>평균 묶음 품목</span>` +
      `<em class="${dPkg >= 0 ? "up" : "down"}">${dPkg >= 0 ? "+" : ""}${dPkg}</em></div>` +
      `<div class="sc-k"><b>${bigRate}<i>%</i></b><span>4개↑ 대형 패키지</span><em>${fmtN(d.pkgBig)}건</em></div>` +
      `<div class="sc-k ${dNeg > 0.5 ? "warn" : ""}"><b>${d.negRate}<i>%</i></b><span>불만 언급</span>` +
      `<em class="${dNeg <= 0 ? "up" : "down"}">${dNeg >= 0 ? "+" : ""}${dNeg}p</em></div>` +
      (d.priceMid ? `<div class="sc-k"><b>${fmtN(d.priceMid)}<i>만</i></b><span>계약 중앙값</span><em>${d.priceN}건</em></div>` : "") +
      `</div>` +
      `<p class="sc-tip">${tip}${negTip}</p></div>`;
  }

  /* ── 매장 페이지: 매니저(프로·명장) 실명 후기 경쟁력 ── */
  function mgrBlock(storeName, c) {
    // 지정 구간이면 그 구간의 매니저 언급 집계를 쓴다(실명 TOP은 팩트에 없어 생략)
    const MS = hasF() ? A().mgrStore : ((CD && CD.mgrStore) || {});
    const G = hasF() ? A().mgr : ((CD && CD.mgr) || null);
    // 매장 키 정규화(‘신세계 센텀시티’ ↔ 데이터의 ‘신세계 센텀’ 같은 표기 차 흡수)
    let key = null;
    if (MS[storeName]) key = storeName;
    else {
      const k = Object.keys(MS).find((x) => storeName.indexOf(x) === 0 || x.indexOf(storeName) === 0);
      if (k) key = k;
    }
    const d = key ? MS[key] : null;
    // 전국 벤치마크: 매니저 실명 후기에서 삼성이 차지하는 비중
    const natMgr = G ? pct(G.s_on, G.l_on) : null;
    const natNon = G ? pct(G.s_off, G.l_off) : null;

    if (!d) {
      return `<div class="ca-ncard mgr-card"><h4 class="ca-ch">매니저 실명 후기 <i class="ca-tag">경쟁력 지표</i></h4>` +
        `<p class="mgr-empty">이 매장은 매니저 언급 후기 표본이 3건 미만입니다.` +
        (natMgr !== null ? ` 전국 기준 <b>매니저가 언급된 후기</b>에서 삼성 비중은 <b class="warn">${natMgr}%</b>로, 미언급 후기(<b>${natNon}%</b>)보다 <b class="warn">${natNon - natMgr}p 낮습니다</b> — <b>실명 후기 확보가 최대 약점</b>입니다.` : "") +
        `</p></div>`;
    }
    const mTot = d.s + d.l, mShare = pct(d.s, d.l);
    const lead = d.s > d.l ? "s" : d.l > d.s ? "l" : "even";
    const vsNat = natMgr !== null ? mShare - natMgr : null;
    const names = d.names || [];
    // 후기 스타 — 실명 언급이 가장 많은 담당자를 1위부터 부각(등급: 스타/에이스/루키)
    const RANK = [
      { t: "⭐ 후기 스타", cls: "s1" },
      { t: "🥈 에이스", cls: "s2" },
      { t: "🥉 라이징", cls: "s3" },
    ];
    const topC = names.length ? names[0].c : 0;
    const nameChips = names.length
      ? `<div class="mgr-stars">` + names.map((x, i) => {
          const r = RANK[i];
          const w = topC ? Math.max(12, Math.round(x.c / topC * 100)) : 0;
          return `<div class="mgr-star ${r ? r.cls : "sx"}">` +
            `<span class="ms-rank">${r ? r.t : i + 1 + "위"}</span>` +
            `<span class="ms-name">${x.n}</span>` +
            `<span class="ms-bar"><i style="width:${w}%"></i></span>` +
            `<span class="ms-cnt">${fmtN(x.c)}<em>건</em></span></div>`;
        }).join("") + `</div>`
      : `<span class="mgr-none">실명이 특정되지 않음</span>`;
    // 개선 제안 — 이 매장 수치에 맞춘 구체 지침
    const tip = lead === "l"
      ? `이 매장은 <b class="warn">LG 매니저 실명 후기가 ${fmtN(d.l - d.s)}건 더 많습니다</b>. LG는 <b>‘명장’ 호칭</b>으로 담당자를 브랜딩해 후기에 이름이 남습니다. ` +
        `계약 시 <b>담당 매니저 성함을 안내</b>하고, 후기 요청 문구에 <b>“○○매니저”를 넣어달라</b>고 구체적으로 요청하면 실명 후기가 늘어납니다.`
      : `이 매장은 삼성 실명 후기가 우위입니다(<b>${mShare}%</b>). <b>${names[0] ? names[0].n : "상위 매니저"}</b>의 응대 방식(상담 기록·견적 설명·사후 연락)을 매장 표준으로 삼고, ` +
        `신규 매니저도 <b>후기에 이름이 남도록</b> 상담 마무리에 후기 요청을 습관화하세요.`;

    return `<div class="ca-ncard mgr-card">` +
      `<h4 class="ca-ch">매니저 실명 후기 <i class="ca-tag">경쟁력 지표</i></h4>` +
      `<div class="mgr-vs">` +
      `<div class="mv s"><b>${fmtN(d.s)}</b><span>삼성 매니저 언급</span></div>` +
      `<div class="mv-mid ${lead}"><b>${mShare}%</b><span>실명 후기 점유</span></div>` +
      `<div class="mv l"><b>${fmtN(d.l)}</b><span>LG 매니저 언급</span></div>` +
      `</div>` +
      `<div class="mgr-bar"><i class="s" style="width:${mTot ? (d.s / mTot * 100).toFixed(1) : 50}%"></i>` +
      `<i class="l" style="width:${mTot ? (d.l / mTot * 100).toFixed(1) : 50}%"></i></div>` +
      (vsNat !== null ? `<p class="mgr-nat">전국 실명 후기 삼성 비중 <b>${natMgr}%</b> 대비 ` +
        `<b class="${vsNat >= 0 ? "up" : "warn"}">${vsNat >= 0 ? "+" : ""}${vsNat}p</b></p>` : "") +
      `<div class="mgr-names"><span class="mgr-lb">후기 스타 <em>고객이 이름까지 남긴 담당자</em></span><div class="mgr-chips">${nameChips}</div></div>` +
      `<p class="mgr-tip"><em>좋은 후기 만들기</em>${tip}</p>` +
      `</div>`;
  }

  /* ── 매장 페이지 — 경쟁력 진단 + 실제 후기 + 액션 ── */
  function storeView(c) {
    const share = pct(c.s, c.l), tot = c.s + c.l;
    const sib = storesOfRegion(st.region);
    const rank = sib.findIndex((x) => x.name === st.store) + 1;
    const agg = sib.reduce((o, x) => (o.s += x.s, o.l += x.l, o), { s: 0, l: 0 });
    const rShare = pct(agg.s, agg.l);
    const diff = share - rShare;
    const lead = c.s > c.l ? "s" : c.l > c.s ? "l" : "even";
    const verdict = lead === "s" ? "삼성 우위 매장" : lead === "l" ? "LG 우위 · 공략 대상" : "삼성·LG 백중";
    const gap = Math.abs(c.s - c.l);
    const smp = c.samples;
    const card = (r) => `<a href="${r[2]}" target="_blank" rel="noopener">` +
      `<span class="ca-sm-tag ${r[1]}">${({ s: "삼성", l: "LG", b: "삼성·LG" })[r[1]] || "기타"}</span>` +
      `<span class="ca-sm-t">${r[0]}</span></a>`;
    // 이 매장이 지는 품목 — 액션에 직접 반영
    const sIt = (typeof periodItems === "function") ? (periodItems("store", st.store) || []) : [];
    const sLose = sIt.filter((x) => x.l > x.s).sort((a, b) => (b.l - b.s) - (a.l - a.s)).slice(0, 2);
    const sLoseTop = sLose.slice(0, 1);
    const sWin = sIt.filter((x) => x.s > x.l).sort((a, b) => (b.s - b.l) - (a.s - a.l)).slice(0, 2);
    const loseLine = sLose.length
      ? ` 취약: <b class="warn">${sLose.map((x) => x.n + " " + pct(x.s, x.l) + "%").join("·")}</b>.`
      : "";
    const winLine = sWin.length ? ` 강점: <b>${sWin.map((x) => x.n + " " + pct(x.s, x.l) + "%").join("·")}</b>.` : "";
    const action = lead === "s"
      ? `삼성 <b>${share}%</b> 우위(지역평균 ${rShare}% 대비 ${diff >= 0 ? "+" : ""}${diff}p).${winLine}` +
        (sLose.length ? loseLine + ` 취약 품목은 <b>패키지 묶음</b>으로 방어.` : ` 이 방식을 열세 매장에 전파.`)
      : lead === "l"
        ? `LG가 <b class="warn">${fmtN(gap)}건</b> 앞섭니다 — 동률까지 <b>${fmtN(gap)}건</b> 필요.${loseLine}` +
          ` <b>담당자 이름을 넣은 후기</b>를 요청하세요.`
        : `백중(${share}%) — <b>후기 ${fmtN(Math.max(1, Math.ceil(tot * 0.02)))}건</b>이면 우위 전환.${loseLine}`;
    return `<div class="ca-sv">` +
      `<div class="sv-left">` +
      `<div class="rv-head"><h3>${c.title}</h3><span>${c.sub}</span></div>` +
      `<div class="sv-verdict ${lead}">${verdict}</div>` +
      `<div class="sv-vs">` +
      `<div class="sv-side s"><b>${fmtN(c.s)}</b><span>삼성</span></div>` +
      `<div class="sv-mid"><b>${share}%</b><span>삼성 비중</span></div>` +
      `<div class="sv-side l"><b>${fmtN(c.l)}</b><span>LG</span></div>` +
      `</div>` +
      `<div class="sv-bar"><i class="s" style="width:${tot ? (c.s / tot * 100).toFixed(1) : 50}%"></i>` +
      `<i class="l" style="width:${tot ? (c.l / tot * 100).toFixed(1) : 50}%"></i></div>` +
      `<div class="rv-kpis">` +
      `<div><b>${fmtN(tot)}</b><span>후기</span></div>` +
      `<div><b>${rank || "-"}<i>위</i></b><span>${st.region || ""} 내</span></div>` +
      `<div class="${diff >= 0 ? "s" : "l"}"><b>${diff >= 0 ? "+" : ""}${diff}<i>p</i></b><span>지역평균 대비</span></div>` +
      `</div>` +
      (c.geoNote ? `<p class="ca-note">⚠ ${c.geoNote}</p>` : "") +
      `</div>` +
      `<div class="sv-right">` +
      storeProfile(st.store, c) +
      scaleCard("store", st.store, st.region) +
      mgrBlock(st.store, c) +
      `<div class="ca-ncard sv-actcard"><h4 class="ca-ch">현장 액션</h4><div class="sv-action">${para(action)}</div></div>` +
      (sib.length > 1 ? `<div class="ca-ncard sv-peercard"><h4 class="ca-ch">${st.region} 내 비교 <i class="ca-tag">삼성 비중順</i></h4>` +
        `<div class="sv-peers">` + sib.slice().sort((a, b) => pct(b.s, b.l) - pct(a.s, a.l)).map((x) => {
          const sh = pct(x.s, x.l), me = x.name === st.store;
          const cl = x.s > x.l ? "s" : x.l > x.s ? "l" : "even";
          return `<button type="button" class="sv-peer ${cl}${me ? " me" : ""}" data-store="${x.name}">` +
            `<span class="pe-n">${x.name}${me ? " <em>현재</em>" : ""}</span>` +
            `<span class="pe-bar"><i style="width:${sh}%"></i></span>` +
            `<span class="pe-v">${sh}%</span></button>`;
        }).join("") + `</div></div>` : "") +
      `<div class="ca-ncard sv-rev"><h4 class="ca-ch">이 매장 후기 <i class="ca-tag">클릭 → 원문</i></h4>` +
      (smp && (smp.pos.length || smp.neg.length)
        ? `<div class="sv-revcols">` +
          `<div><h6 class="pos">우호 ${smp.pos.length}</h6>${smp.pos.map(card).join("") || '<p class="ca-splx">없음</p>'}</div>` +
          `<div><h6 class="neg">주의 ${smp.neg.length}</h6>${smp.neg.map(card).join("") || '<p class="ca-splx">검출 안 됨 · 졸업후기 긍정편향</p>'}</div>` +
          `</div>`
        : `<p class="ca-splx">이 매장은 본문 샘플이 아직 없습니다 — 본문매칭 완료 지역(부울경)부터 제공됩니다.</p>`) +
      `</div></div></div>`;
  }

  /* ── 품목 공략 카드 — 어떤 품목으로 이기고 어디서 새는가 ── */
  function itemCard() {
    const IT = perData().items || (CD && CD.items) || {};
    const rows = Object.keys(IT).map((k) => {
      const v = IT[k], tot = v.s + v.l;
      return { n: k, s: v.s, l: v.l, tot, sh: pct(v.s, v.l) };
    }).filter((x) => x.tot >= 5);
    if (!rows.length) return "";
    const win = rows.slice().sort((a, b) => b.sh - a.sh).slice(0, 3);
    const lose = rows.slice().sort((a, b) => a.sh - b.sh).slice(0, 3);
    const leak = lose.reduce((a, x) => a + (x.l - x.s), 0);   // 약점 품목에서 LG에 내준 격차
    const bar = (x, cls) => `<li class="it-row ${cls}"><span class="it-n">${x.n}</span>` +
      `<span class="it-bar"><i style="width:${x.sh}%"></i></span>` +
      `<span class="it-v">${x.sh}<em>%</em></span>` +
      `<span class="it-c">${fmtN(x.tot)}건</span></li>`;
    return fcard("items", "품목 전략", "카테고리별 경쟁 지형", win[0] ? win[0].sh + "%" : "—",
      win[0] ? win[0].n + " 최강" : "",
      `<div class="fc-sec"><h5>우리가 이기는 품목 <i class="it-tag s">방어</i></h5>` +
      `<ul class="it-list">${win.map((x) => bar(x, "s")).join("")}</ul></div>` +
      `<div class="fc-sec"><h5>LG에 내주는 품목 <i class="it-tag l">회복 대상</i></h5>` +
      `<ul class="it-list">${lose.map((x) => bar(x, "l")).join("")}</ul></div>` +
      `<div class="fc-sec tip"><h5>상담 전략</h5><p>강점 품목(<b>${win.map((x) => x.n).join("·")}</b>)으로 상담을 <b>열어 신뢰를 만들고</b>, ` +
      `약점 품목(<b class="warn">${lose.map((x) => x.n).join("·")}</b>)에서 패키지가 깨집니다 — 이 세 품목에서만 LG가 <b class="warn">${fmtN(leak)}건</b> 앞섭니다. ` +
      `해당 품목은 <b>비스포크 대안·묶음 할인</b>을 먼저 제시해 이탈을 막으세요.</p></div>`,
      [win[0] ? win[0].n + " " + win[0].sh + "%" : "", lose[0] ? lose[0].n + " " + lose[0].sh + "%" : ""].filter(Boolean));
  }

  /* ── 승부처 카드 — 비교 상담·혜택·성수기 ── */
  const hasJong = (w) => { const ch = (w || '').replace(/[^가-힣]/g, '').slice(-1); return ch ? (ch.charCodeAt(0) - 0xac00) % 28 !== 0 : false; };
  function winCard() {
    const PD = perData();
    const CP = PD.compare || { s: 0, l: 0 };
    const cShare = pct(CP.s, CP.l);
    const rows = monthsFor(st.period);
    const pS = rows.reduce((a, r) => a + r[2], 0), pL = rows.reduce((a, r) => a + r[3], 0);
    const base = pct(pS, pL);                       // 같은 기간 전체 비중(비교 기준)
    const gap = cShare - base;
    const winsCompare = gap > 0;
    const BN = PD.benefit || {};
    const bl = Object.keys(BN).map((k) => ({ n: k, sh: pct(BN[k].s, BN[k].l), tot: BN[k].s + BN[k].l }))
      .filter((x) => x.tot >= 5).sort((a, b) => b.tot - a.tot).slice(0, 4);
    // 성수기 — 선택 기간의 월분포(구간이 짧으면 그 구간 안에서만 본다)
    const mrows = monthsFor(st.period);
    const byM = {};
    mrows.forEach((m) => { const k = m[0].slice(5); byM[k] = (byM[k] || 0) + m[1]; });
    const mk = Object.keys(byM);
    const peak = mk.length ? mk.reduce((a, b) => (byM[a] > byM[b] ? a : b)) : null;
    const low = mk.length ? mk.reduce((a, b) => (byM[a] < byM[b] ? a : b)) : null;
    const ratio = peak && low && byM[low] ? (byM[peak] / byM[low]).toFixed(1) : null;

    return fcard("win", "결정 요인",
      winsCompare ? "선택이 갈리는 순간" : "밀리는 접점",
      cShare + "%", "비교 후 삼성 선택",
      `<div class="fc-sec"><h5>① 비교 상담의 결과</h5>` +
      `<p class="fc-plain">‘발품·비교·고민’ 언급 <b>${fmtN(CP.s + CP.l)}건</b> 중 삼성 <b${winsCompare ? "" : ' class="warn"'}>${cShare}%</b> : LG ${100 - cShare}% — ` +
      `같은 기간 전체(${base}%) 대비 <b${winsCompare ? "" : ' class="warn"'}>${gap >= 0 ? "+" : ""}${gap}p</b>. ` +
      (winsCompare ? `<b>비교될수록 유리</b>하므로 매장 방문·비교 견적을 적극 유도하세요.`
                   : `<b class="warn">비교 상담에서 밀립니다</b> — 상담 스크립트·경쟁 대응 논리부터 점검이 필요합니다.`) +
      `</p></div>` +
      (bl.length ? `<div class="fc-sec"><h5>② 이 기간 작동한 혜택</h5><ul class="fc-pts">` +
        bl.map((x) => `<li><b>${x.n}</b> ${fmtN(x.tot)}건 · 삼성 <b${x.sh >= 50 ? "" : ' class="warn"'}>${x.sh}%</b></li>`).join("") +
        `</ul></div>` : "") +
      (peak ? `<div class="fc-sec"><h5>③ 성수기 (${perLab(st.period)})</h5>` +
        `<p class="fc-plain">후기는 <b>${+peak}월</b> 최다, ${+low}월 최저 — 최대 <b>${ratio}배</b> 차이.</p></div>` : "") +
      `<div class="fc-sec tip"><h5>실행</h5><p>` +
      (winsCompare ? `① <b>비교 견적</b>을 먼저 제안(승률 ${cShare}%) ` : `① 비교 상담 <b class="warn">패턴 분석</b> 후 대응 논리 보강 `) +
      (bl.length ? `② <b>${bl[0].n}</b>${hasJong(bl[0].n) ? "을" : "를"} 상담 마무리에 수치로 제시 ` : "") +
      (peak ? `③ <b>${+peak}월</b> 성수기 전 후기 요청 캠페인` : "") +
      `</p></div>`,
      [(winsCompare ? "비교 우위 " : "비교 열세 ") + cShare + "%", peak ? +peak + "월 성수기" : ""].filter(Boolean));
  }

  // 애플식 분석 카드 — 앞면(라벨·제목·미니수치·＋) + 상세(영역 전체 덮음)
  function fcard(key, label, title, mini, miniLab, detail, keys) {
    const chips = (keys || []).length
      ? `<div class="fc-keys">` + keys.map((k) => `<span class="fc-key">${k}</span>`).join("") + `</div>`
      : "";
    return `<div class="ca-fcard" data-card="${key}">` +
      `<div class="fc-front">` +
      `<span class="fc-label">${label}</span>` +
      `<h4 class="fc-title">${title}</h4>` +
      chips +
      `<div class="fc-mini"><b>${mini}</b><span>${miniLab}</span></div>` +
      `</div>` +
      `<button type="button" class="fc-open" aria-label="${title} 자세히 보기">+</button>` +
      `<div class="fc-detail">` +
      `<div class="fc-dhead"><h4>${title}</h4><button type="button" class="fc-close" aria-label="닫기">×</button></div>` +
      `<div class="fc-dbody">${detail}</div>` +
      `</div></div>`;
  }
  function splCol(title, cls, arr) {
    const scard = (r) => `<a href="${r[2]}" target="_blank" rel="noopener">` +
      `<span class="ca-sm-tag ${r[1]}">${({ s: "삼성", l: "LG", b: "삼성·LG" })[r[1]] || "기타"}</span>` +
      `<span class="ca-sm-t">${r[0]}</span></a>`;
    return `<div class="ca-splcol"><h6 class="${cls}">${title} <em>${arr.length}</em></h6>` +
      (arr.length ? arr.map(scard).join("") : `<p class="ca-splx">검출 안 됨 · 졸업후기 긍정편향</p>`) + `</div>`;
  }

  function render() {
    const c = context();
    const share = c.pend ? "—" : pct(c.s || 0, c.l || 0);
    let mid;
    if (c.pend) {
      mid = `<div class="ca-pend"><span class="ca-pend-n">수집 중</span>` +
        `<p><b>${perLab(st.period)}</b> 후기는 현재 백필로 수집 중입니다.<br>네이버 목록 API 한계를 우회해 과거 구간을 채우는 중 — 완료되면 이 기간도 분석됩니다.</p></div>`;
    } else if (c.geo) {
      const etc = Math.max(0, c.total - c.s - c.l);   // 삼성·LG 동시언급(승패 미귀속)
      // ── 기간에서 실제로 도출하는 진단(하드코딩 금지) ──
      const PD0 = perData();
      const share0 = pct(c.s, c.l);
      const lead0 = share0 > 52 ? "win" : share0 < 48 ? "lose" : "even";
      // 직전 기간 대비 변화 — 직접 입력 구간은 '같은 길이의 바로 앞 구간'과 견준다
      const prevSh = (function () {
        const pv = prevAgg();
        if (!pv) return null;
        return (pv.s + pv.l) ? pct(pv.s, pv.l) : null;
      })();
      const dSh = prevSh !== null ? share0 - prevSh : null;
      // 품목 승패
      const itAll = Object.keys(PD0.items || {}).map((k) => {
        const v = PD0.items[k]; return { n: k, s: v.s, l: v.l, tot: v.s + v.l, sh: pct(v.s, v.l) };
      }).filter((x) => x.tot >= 5);
      const itWin = itAll.filter((x) => x.sh > 50).sort((a, b) => b.sh - a.sh).slice(0, 3);
      const itLose = itAll.filter((x) => x.sh < 50).sort((a, b) => a.sh - b.sh).slice(0, 3);
      const loseGap = itLose.reduce((a, x) => a + (x.l - x.s), 0);
      // 혜택·비교
      const cpP = PD0.compare || { s: 0, l: 0 };
      const cpSh = pct(cpP.s, cpP.l);
      const benTop = Object.keys(PD0.benefit || {}).map((k) => ({ n: k, ...PD0.benefit[k] }))
        .map((x) => ({ n: x.n, tot: x.s + x.l, sh: pct(x.s, x.l) }))
        .sort((a, b) => b.tot - a.tot).slice(0, 3);
      // 지역 편차
      const rgArr = Object.keys(PD0.regions || {}).map((k) => {
        const v = PD0.regions[k]; return { rg: k, tot: v.s + v.l, sh: pct(v.s, v.l) };
      }).filter((x) => x.tot >= 200);
      const rgWin = rgArr.filter((x) => x.sh > 50).sort((a, b) => b.sh - a.sh)[0];
      const rgLose = rgArr.filter((x) => x.sh < 50).sort((a, b) => a.sh - b.sh)[0];

      // 상황별 진단 문장 — 우위/열세/백중이 각각 다르게
      const REASONS_M = [];
      REASONS_M.push([
        lead0 === "win" ? "우위 구간" : lead0 === "lose" ? "열세 구간" : "백중 구간",
        `${perLab(st.period)} 삼성 <b${lead0 === "lose" ? ' class="warn"' : ""}>${share0}%</b> : LG ${100 - share0}%` +
        (dSh !== null ? ` — 직전 기간 대비 <b${dSh >= 0 ? "" : ' class="warn"'}>${dSh >= 0 ? "+" : ""}${dSh}p</b>` : "") +
        ` (분석 ${fmtN(c.total)}건)`, "ev"]);
      if (itWin.length) REASONS_M.push(["이기는 품목",
        itWin.map((x) => `<b>${x.n} ${x.sh}%</b>`).join(" · ") + ` — 이 품목이 이 기간 우위를 떠받칩니다`, "ev"]);
      if (itLose.length) REASONS_M.push(["새는 품목",
        itLose.map((x) => `<b class="warn">${x.n} ${x.sh}%</b>`).join(" · ") +
        ` — 합산 LG <b class="warn">+${fmtN(loseGap)}건</b>, 이 구간 손실의 핵심`, "ev"]);
      if (cpP.s + cpP.l >= 20) REASONS_M.push(["비교 상담 결과",
        `발품·비교 언급 ${fmtN(cpP.s + cpP.l)}건 중 삼성 <b>${cpSh}%</b>` +
        (cpSh > share0 ? ` — 전체(${share0}%)보다 <b>${cpSh - share0}p 높아</b> 비교될수록 유리`
                       : ` — 전체(${share0}%)보다 <b class="warn">${share0 - cpSh}p 낮아</b> 비교 상담에서 밀림`), "ev"]);
      if (benTop.length) REASONS_M.push(["작동한 혜택",
        benTop.map((x) => `<b>${x.n}</b> ${fmtN(x.tot)}건(삼성 ${x.sh}%)`).join(" · "), "ev"]);
      if (rgWin || rgLose) REASONS_M.push(["지역 편차",
        (rgWin ? `최고 <b>${rgWin.rg} ${rgWin.sh}%</b>` : "") +
        (rgWin && rgLose ? " ↔ " : "") +
        (rgLose ? `최저 <b class="warn">${rgLose.rg} ${rgLose.sh}%</b>` : "") +
        (rgWin && rgLose ? ` — 격차 <b>${rgWin.sh - rgLose.sh}p</b>` : ""), "ev"]);
      const reasonLi = REASONS_M.map((r) =>
        `<li class="rs-${r[2]}"><b>${r[0]}</b><span>${r[1]}</span></li>`).join("");
      const slTot = c.s + c.l || 1, ss = Math.round(c.s / slTot * 100), ls = 100 - ss;
      const segV = (v, cls) => v > 0 ? `<div class="db-seg ${cls}" style="width:${(v / (c.total || 1) * 100).toFixed(1)}%"></div>` : "";
      // 좌측 — 심플한 전국 요약(큰 숫자 + 삼성vsLG 한 줄 + 우위/열세 칩)
      const sumCol = `<div class="ca-nsumcol">` +
        `<div class="nsc-h"><h3>전국 요약</h3><span>${perLab(st.period)}</span></div>` +
        `<div class="nsc-total"><b>${fmtN(c.total)}</b><i>건 분석</i></div>` +
        `<div class="nsc-vs"><span class="nv s">삼성 <b>${ss}%</b></span><span class="nv l">LG <b>${ls}%</b></span></div>` +
        `<div class="ca-distbar">${segV(c.s, "s")}${segV(c.l, "l")}${segV(etc, "x")}</div>` +
        regionSummary() +
        `</div>`;
      mid = `<div class="ca-nation">` +
        // 좌: 전국 요약 + 지도를 하나의 패널로
        `<div class="ca-npanel">` +
        sumCol +
        `<div class="ca-nleft">` + geoMap() +
        `<div class="ca-geo-legend"><span class="gl s">삼성 우위</span><span class="gl l">LG 우위</span><span class="gl off">미집계</span></div>` +
        `<p class="ca-geonote">지도는 <b>모든 유통 채널</b> 기준(삼성스토어·백화점·하이마트 등) — ` +
        `백화점이 없는 지역도 단독매장 후기가 집계됩니다. <b>매장별 비교</b>는 백화점 입점 매장만 다룹니다.</p>` +
        `</div>` +
        `</div>` +
        // 우: 분석 카드 2×2 (＋클릭 → 상세가 영역 전체를 덮음)
        `<div class="ca-nright">` +
        fcard("reasons",
          lead0 === "win" ? "우위 진단" : lead0 === "lose" ? "열세 진단" : "접전 진단",
          lead0 === "win" ? "우위를 만든 구조" : lead0 === "lose" ? "열세를 만든 구조" : "접전의 구조",
          share0 + "%", "삼성 비중",
          `<ul class="ca-reasons">${reasonLi}</ul>` +
          `<div class="fc-sec tip"><h5>${lead0 === "lose" ? "회복 과제" : "유지 과제"}</h5><p>` +
          (lead0 === "lose"
            ? `이 기간은 <b class="warn">LG 우위</b>입니다. ` +
              (itLose.length ? `<b class="warn">${itLose.map((x) => x.n).join("·")}</b>에서 합산 ${fmtN(loseGap)}건을 내주고 있어, 이 품목의 대안 제시가 회복의 출발점입니다. ` : "") +
              (cpSh > share0 ? `다만 비교 상담에서는 ${cpSh}%로 이기고 있어 <b>매장 방문·비교 견적 유도</b>가 유효합니다.` : `비교 상담에서도 밀리므로 <b>상담 스크립트·혜택 안내</b>부터 점검이 필요합니다.`)
            : `${itWin.length ? `<b>${itWin.map((x) => x.n).join("·")}</b>의 우위를 유지하고, ` : ""}` +
              (itLose.length ? `<b class="warn">${itLose.map((x) => x.n).join("·")}</b>는 패키지 묶음으로 방어하세요.` : `약점 품목이 없어 후기 절대량을 늘리는 것이 다음 과제입니다.`)) +
          `</p></div>`,
          [lead0 === "lose" ? "열세 " + share0 + "%" : "우위 " + share0 + "%",
           dSh !== null ? "직전 대비 " + (dSh >= 0 ? "+" : "") + dSh + "p" : ""].filter(Boolean)) +
        itemCard() +
        winCard() +
        (function () {
          const PD = perData();
          const its = Object.keys(PD.items || {}).map((k) => {
            const v = PD.items[k]; return { n: k, s: v.s, l: v.l, tot: v.s + v.l, sh: pct(v.s, v.l), gap: v.l - v.s };
          }).filter((x) => x.tot >= 5 && x.l > x.s).sort((a, b) => b.gap - a.gap).slice(0, 4);
          const totGap = its.reduce((a, x) => a + x.gap, 0);
          // 이 기간 LG 우위 지역
          const rg = Object.keys(PD.regions || {}).map((k) => {
            const v = PD.regions[k]; return { rg: k, tot: v.s + v.l, sh: pct(v.s, v.l), gap: v.l - v.s };
          }).filter((x) => x.tot >= 200 && x.sh < 50).sort((a, b) => b.gap - a.gap).slice(0, 3);
          const mg = (CD && CD.mgr) || null;
          const mgSh = mg ? pct(mg.s_on, mg.l_on) : null;
          return fcard("lg", "경쟁 방어",
            its.length ? "이탈이 일어나는 지점" : "방어가 유지되는 구간",
            its.length ? fmtN(totGap) : "0", "LG 우위 격차(건)",
            (its.length
              ? `<div class="fc-sec"><h5>품목별 이탈</h5><ul class="fc-pts">` +
                its.map((x) => `<li><b class="warn">${x.n}</b> 삼성 ${x.sh}% — LG <b class="warn">+${fmtN(x.gap)}건</b>` +
                  ` <span style="color:#9aa7bd">(표본 ${fmtN(x.tot)})</span></li>`).join("") +
                `</ul></div>`
              : `<div class="fc-sec"><p class="fc-plain">이 기간에는 <b>LG가 앞선 품목이 없습니다</b>.</p></div>`) +
            (rg.length ? `<div class="fc-sec"><h5>LG 우위 지역</h5><ul class="fc-pts">` +
              rg.map((x) => `<li><b class="warn">${x.rg}</b> 삼성 ${x.sh}% · LG +${fmtN(x.gap)}건 (표본 ${fmtN(x.tot)})</li>`).join("") +
              `</ul></div>` : "") +
            (mgSh !== null ? `<div class="fc-sec"><h5>실명 후기(구조적 열세)</h5>` +
              `<p class="fc-plain">담당자 이름이 남은 후기에서 삼성은 <b class="warn">${mgSh}%</b> — LG는 ‘명장’ 호칭으로 담당자를 브랜딩합니다.</p></div>` : "") +
            `<div class="fc-sec tip"><h5>방어 실행</h5><p>` +
            (its.length ? `<b class="warn">${its[0].n}</b>부터 대응 — 이 품목만 동률로 만들어도 격차의 <b>${Math.round(its[0].gap / (totGap || 1) * 100)}%</b>가 해소됩니다. 삼성 대안 모델·묶음 견적을 먼저 제시하세요. `
                        : `현재 방어가 유지되고 있습니다. `) +
            `계약 시 <b>담당자 이름을 넣은 후기</b>를 요청해 실명 후기 열세를 좁히세요.</p></div>`,
            [its.length ? its[0].n + " " + its[0].sh + "%" : "이탈 없음",
             rg.length ? rg[0].rg + " " + rg[0].sh + "%" : ""].filter(Boolean));
        })() +

        `</div>`;
    } else if (st.level === "region") {
      mid = regionView(c);
    } else if (st.level === "store") {
      mid = storeView(c);
    } else {
      mid = `<div class="ca-stage">` +
        `<div class="ca-stat">` +
        `<div class="ca-stat-h"><h3>${c.title}</h3><span>${c.sub}</span></div>` +
        `<div class="ca-share"><b>${share}%</b><i>삼성 비중</i></div>` +
        `<div class="ca-trend">${c.trend || ""}</div>` +
        (c.part ? `<p class="ca-note">⚠ 2024년은 수집 시작(11·12월)분만 — 부분 표본</p>` : "") +
        (c.geoNote ? `<p class="ca-note">⚠ ${c.geoNote}</p>` : "") +
        `</div>` +
        `<div class="ca-right">${whyBlock(c)}</div>` +
        `</div>` +
        `<div class="ca-drillwrap">` +
        (c.drill ? `<p class="ca-drilltit">더 보기</p>` :
          c.regions ? `<p class="ca-drilltit">지역 클릭</p>` :
          c.stores ? `<p class="ca-drilltit">매장 클릭</p>` :
          `<p class="ca-drilltit">손님 후기</p>`) +
        drillBlock(c) + `</div>`;
    }
    return `<div class="ca2">` +
      `<div class="ca-head ca-head-row">` +
      `${window.VNAV ? VNAV.bar() : ""}` +
      `<div class="ca-periodnav" tabindex="0">` +
      `<span class="ca-ic" title="다이렉트결혼준비 — 마우스를 올리면 기간 선택"><svg viewBox="0 0 40 40" fill="none"><text x="20" y="18.5" text-anchor="middle" fill="#fff" font-family="Arial Black,Arial,sans-serif" font-size="10.5" font-weight="900" letter-spacing="-0.6">DIRECT</text><text x="21" y="29.5" text-anchor="middle" fill="#fff" font-family="Georgia,serif" font-style="italic" font-size="9.5">Wedding</text></svg></span>` +
      `<span class="cpn-cur">${perLab(st.period)}<i>기간 ▸</i></span>` +
      nav() +
      `</div>` +
      rangeBox() +          // 직접 입력은 접히지 않고 항상 보이는 자리에
      `</div>` +
      crumb() + mid +
      `</div>`;
  }

  function rerender(host) { host.innerHTML = render(); if (st.level === "nation") paintGeo(host);
    if (window.VNAV) VNAV.sync(); }

  function bind(host) {
    // 날짜 칸에서 Enter → 적용 (버튼까지 옮겨가지 않아도 되도록)
    host.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.classList.contains("car-d")) {
        e.preventDefault();
        const go = host.querySelector("#carGo");
        if (go) go.click();
      }
    });
    host.addEventListener("click", (e) => {
      // 분석 카드 열기/닫기 (상세가 영역 전체를 덮음)
      if (e.target.closest(".fc-open")) {
        const card = e.target.closest(".ca-fcard");
        host.querySelectorAll(".ca-fcard.is-open").forEach((c) => { if (c !== card) c.classList.remove("is-open"); });
        if (card) card.classList.add("is-open");
        return;
      }
      if (e.target.closest(".fc-close")) {
        const card = e.target.closest(".ca-fcard");
        if (card) card.classList.remove("is-open");
        return;
      }
      if (e.target.closest("#carGo")) {
        const A = host.querySelector("#carA"), B = host.querySelector("#carB");
        const r = VF.clamp(A && A.value, B && B.value);
        st.range = { a: r[0], b: r[1] };
        st.period = "custom";
        rerender(host); return;
      }
      if (e.target.closest("#carOff")) {
        st.range = null; st.period = NOW_M; st.navY = NOW_M.slice(0, 4);
        rerender(host); return;
      }
      /* 연도 창에서 해를 바꾸면 **같은 달의 그 해**로 함께 옮긴다.
         목록만 갈아 끼우면 칩은 '2025'인데 보고 있는 건 '2026년 3월'이라 어긋나 보인다(실측). */
      const ny = e.target.closest("button[data-navy]");
      if (ny) {
        const y2 = ny.getAttribute("data-navy");
        st.navY = y2;
        if (/^\d{4}-\d\d$/.test(st.period)) {
          const want = y2 + "-" + st.period.slice(5);
          const has = MONTHS.some((m) => m[0] === want);
          if (has) st.period = want;
          else {          // 그 해에 그 달이 없으면 그 해 마지막 달로
            const last = MONTHS.filter((m) => m[0].slice(0, 4) === y2).slice(-1)[0];
            if (last) st.period = last[0];
          }
          st.range = null;
        } else {
          // 연간을 보고 있었거나 '전체'였어도, 연도를 골랐다는 건 그 해를 보겠다는 뜻이다.
          // (전체 상태에서 연도를 눌러도 전체 그대로였다 — 눌러도 아무 일이 없어 고장처럼 보였다)
          st.period = y2; st.range = null;
        }
        rerender(host); return;
      }
      const per = e.target.closest("button[data-per]");
      if (per) {
        st.range = null;                       // 기간 버튼을 누르면 직접 입력은 해제
        st.period = per.getAttribute("data-per");
        // 고른 기간이 다른 해면 줄도 따라 옮긴다 — 안 그러면 선택한 달이 줄에 없다
        if (/^\d{4}(-\d\d)?$/.test(st.period)) st.navY = st.period.slice(0, 4);
        rerender(host); return;
      }
      const lv = e.target.closest("button[data-lv]");
      if (lv) {
        const to = lv.getAttribute("data-lv");
        st.level = to;
        if (to === "nation") { st.region = null; st.store = null; }
        if (to === "region") { st.store = null; }
        rerender(host); return;
      }
      const dr = e.target.closest(".ca-drill");
      if (dr) { st.level = dr.getAttribute("data-lv"); rerender(host); return; }
      // 지도 path는 .drill(부울경)만 드릴, 드릴버튼(.ca-dr 등)은 항상 드릴
      const rg = e.target.closest("[data-region]");
      if (rg && (rg.tagName.toLowerCase() !== "path" || rg.classList.contains("drill"))) {
        st.region = rg.getAttribute("data-region"); st.level = "region"; rerender(host); return;
      }
      const stb = e.target.closest("[data-store]");
      if (stb) { st.store = stb.getAttribute("data-store"); st.level = "store"; rerender(host); return; }
    });
  }

  function openCafeAnalysis() {
    const host = document.getElementById("channelPanel");
    if (!host) return;
    st.period = NOW_M; st.navY = NOW_M.slice(0, 4); st.range = null; st.level = "nation"; st.region = null; st.store = null;
    host.innerHTML = render();
    if (st.level === "nation") paintGeo(host);
    const sec = document.getElementById("channel");
    if (sec) sec.hidden = false;
    window.setView ? setView("view-channel", "view-cafe") : document.body.classList.add("mode-results", "view-channel", "view-cafe");
    window.scrollTo({ top: 0, behavior: "auto" });
    // 리스너는 1회만 등록 — 재진입 시 중복 등록되면 클릭 1회에 핸들러가 여러 번 실행된다
    if (!host.dataset.caBound) { bind(host); host.dataset.caBound = "1"; }
    if (window.VNAV) VNAV.push({ id: "cafe-analysis", label: "다이렉트웨딩 분석",
      open: () => window.openCafeAnalysis() });
  }
  window.openCafeAnalysis = openCafeAnalysis;
})();
