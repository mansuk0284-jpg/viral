/* 매장 × 채널 교차 대시보드
   메인 좌측 "우리 매장 찾아보기"에서 매장을 고르면, 그 매장이 각 채널에서
   어떻게 바이럴되는지를 한 화면에 보여준다.
   - 다이렉트결혼준비: 실데이터(cafe-data.js)
   - 그 외 채널: 미수집 → '수집 대기'로 정직 표기(임의 수치 생성 금지) */
(function () {
  "use strict";
  const CD = window.CAFE_DATA || {};
  const MY = ["부산", "울산", "경남"];          // 우리 권역 — 항상 최상단
  const VF = window.VFACT || null;

  const fmtN = (n) => (n || 0).toLocaleString("ko-KR");
  const pct = (a, b) => (a + b > 0 ? Math.round((a / (a + b)) * 100) : 0);

  /* 화면 상태 — 매장 + 조회 기간(직접 입력). 기본은 전체 수집 구간 */
  const st = { name: null, range: null };
  const isCus = () => !!(st.range && VF);   // 라벨·해제버튼 표시용
  const hasF = () => !!VF;
  /* 집계는 항상 팩트 한 경로로 — 기간을 지정하든 안 하든 같은 코드가 돈다 */
  const A = () => VF.agg(st.range ? st.range.a : VF.d0, st.range ? st.range.b : VF.d1);
  const cus = A;

  /* 채널 정의 — 히어로 타일과 동일한 축. 다이렉트만 실데이터 */
  const CHANNELS = [
    { key: "dagyeolun", name: "다이렉트결혼준비", sub: "네이버 카페 · 메인", cls: "cx-cafe", live: true },
    { key: "naver-blog", name: "네이버 블로그", sub: "구매 후기글", cls: "cx-blog" },
    { key: "busan-mom-cafe", name: "맘카페", sub: "지역 커뮤니티", cls: "cx-mom" },
    { key: "youtube", name: "유튜브", sub: "혼수 브이로그", cls: "cx-youtube" },
    { key: "instagram", name: "인스타그램", sub: "해시태그 후기", cls: "cx-insta" },
    { key: "ohou", name: "오늘의집", sub: "인테리어 앱", cls: "cx-ohou" },
  ];

  /* 지역별 매장 목록 — 우리 권역 먼저 */
  function storeGroups() {
    const S = CD.stores || {};
    const rgs = Object.keys(S);
    const mine = MY.filter((r) => rgs.indexOf(r) >= 0);
    const rest = rgs.filter((r) => MY.indexOf(r) < 0)
      .sort((a, b) => S[b].reduce((x, y) => x + y.s + y.l, 0) - S[a].reduce((x, y) => x + y.s + y.l, 0));
    return { mine, rest, S };
  }

  /* 매장 상세 조회(표기 차 흡수) */
  function pick(src, name) {
    if (!src) return null;
    if (src[name]) return src[name];
    const k = Object.keys(src).find((x) => name.indexOf(x) === 0 || x.indexOf(name) === 0);
    return k ? src[k] : null;
  }
  function storeRow(name) {
    const S = hasF() ? A().stores : (CD.stores || {});
    for (const rg of Object.keys(S)) {
      const hit = S[rg].find((x) => x.n === name);
      if (hit) return { rg, s: hit.s, l: hit.l };
    }
    // 그 기간에 표본이 없으면 지역만이라도 유지해 화면이 무너지지 않게 한다
    const ALL = CD.stores || {};
    for (const rg of Object.keys(ALL)) {
      if (ALL[rg].some((x) => x.n === name)) return { rg, s: 0, l: 0 };
    }
    return null;
  }
  /* 선택 기간의 매장 상세(품목·계약·후기 스타) — 지정 구간이면 팩트에서 계산 */
  function detailOf(name) {
    if (!hasF()) {
      return { items: (pick(CD.storeDetail, name) || {}).items || [],
               ext: pick(CD.extStore, name), mgr: pick(CD.mgrStore, name) };
    }
    const a = A();
    return { items: VF.top(a.storeItems[name], 1, 3),
             ext: a.ext.store[name] || null,
             mgr: a.mgrStore[name] || null };
  }
  /* 지역 내 매장 목록 — 순위·평균 계산용 */
  function siblings(rg) {
    const S = hasF() ? A().stores : (CD.stores || {});
    return (S[rg] || []).slice().sort((a, b) => (b.s + b.l) - (a.s + a.l));
  }

  /* ── 선택바 렌더 ── */
  function buildPicker() {
    const host = document.getElementById("storePick");
    if (!host) return;
    const { mine, rest, S } = storeGroups();
    const opt = (x) => `<option value="${x.n}">${x.n} (${fmtN(x.s + x.l)}건)</option>`;
    host.innerHTML =
      `<label class="sp-label" for="storeSel"><span class="sp-ic" aria-hidden="true">◎</span>우리 매장 찾아보기</label>` +
      `<div class="sp-row">` +
      `<select id="storeSel" class="sp-sel" aria-label="매장 선택">` +
      `<option value="">매장을 선택하세요</option>` +
      (mine.length ? `<optgroup label="⭐ 우리 권역 (부울경)">` +
        mine.map((rg) => S[rg].map(opt).join("")).join("") + `</optgroup>` : "") +
      rest.map((rg) => `<optgroup label="${rg}">${S[rg].map(opt).join("")}</optgroup>`).join("") +
      `</select>` +
      `<button type="button" class="sp-go" id="storeGo">보기</button>` +
      `</div>` +
      `<p class="sp-hint">매장을 고르면 <b>채널별 바이럴 현황</b>을 한 화면에서 봅니다</p>`;

    const go = () => {
      const v = document.getElementById("storeSel").value;
      if (v) openStoreScope(v);
    };
    document.getElementById("storeGo").addEventListener("click", go);
    document.getElementById("storeSel").addEventListener("change", go);
  }

  /* ── 채널 카드 ── */
  function channelCard(ch, name) {
    if (!ch.live) {
      return `<div class="cx-card cx-wait ${ch.cls}">` +
        `<div class="cx-head"><b>${ch.name}</b><span>${ch.sub}</span></div>` +
        `<div class="cx-empty"><em>수집 대기</em><span>이 채널은 아직 수집 전입니다</span></div>` +
        `</div>`;
    }
    const row = storeRow(name);
    if (!row) {
      return `<div class="cx-card ${ch.cls}"><div class="cx-head"><b>${ch.name}</b><span>${ch.sub}</span></div>` +
        `<div class="cx-empty"><em>표본 없음</em><span>이 매장 후기가 확인되지 않았습니다</span></div></div>`;
    }
    if (!(row.s + row.l)) {
      return `<div class="cx-card ${ch.cls}"><div class="cx-head"><b>${ch.name}</b><span>${ch.sub}</span></div>` +
        `<div class="cx-empty"><em>표본 없음</em><span>이 기간에는 후기가 없습니다</span></div></div>`;
    }
    const tot = row.s + row.l, sh = pct(row.s, row.l);
    const lead = row.s > row.l ? "s" : row.l > row.s ? "l" : "even";
    const D = detailOf(name);
    const ext = D.ext, mgr = D.mgr;
    const items = (D.items || []).slice(0, 3);
    const star = mgr && mgr.names && mgr.names.length ? mgr.names[0] : null;
    return `<div class="cx-card cx-live ${ch.cls}">` +
      `<div class="cx-head"><b>${ch.name}</b><span>${ch.sub}</span><i class="cx-live-tag">실데이터</i></div>` +
      `<div class="cx-main">` +
      `<div class="cx-big"><b>${fmtN(tot)}</b><span>건</span></div>` +
      `<div class="cx-vs"><span class="s">삼성 ${fmtN(row.s)}</span><span class="l">LG ${fmtN(row.l)}</span></div>` +
      `<div class="cx-bar"><i class="s" style="width:${tot ? (row.s / tot * 100).toFixed(1) : 50}%"></i>` +
      `<i class="l" style="width:${tot ? (row.l / tot * 100).toFixed(1) : 50}%"></i></div>` +
      `<div class="cx-sh ${lead}">삼성 ${sh}%</div>` +
      `</div>` +
      (items.length ? `<div class="cx-sub"><span class="cx-lb">품목</span>` +
        items.map((x) => `<span class="cx-chip ${x.s > x.l ? "s" : "l"}">${x.n} ${pct(x.s, x.l)}%</span>`).join("") +
        `</div>` : "") +
      (star ? `<div class="cx-sub"><span class="cx-lb">후기 스타</span>` +
        `<span class="cx-chip star">${star.n} ${fmtN(star.c)}건</span></div>` : "") +
      (ext ? `<div class="cx-sub"><span class="cx-lb">계약</span>` +
        `<span class="cx-chip">묶음 ${ext.pkgAvg}개</span>` +
        (ext.priceMid ? `<span class="cx-chip">중앙 ${fmtN(ext.priceMid)}만</span>` : "") +
        `<span class="cx-chip ${ext.negRate > 2 ? "l" : ""}">불만 ${ext.negRate}%</span></div>` : "") +
      `</div>`;
  }

  /* 기간 직접 입력 — 카페 분석 화면과 같은 조작 방식 */
  function rangeBox() {
    if (!VF) return "";
    const a = (st.range && st.range.a) || VF.d0;
    const b = (st.range && st.range.b) || VF.d1;
    return `<span class="ca-range${isCus() ? " on" : ""}">` +
      `<span class="car-lb">기간 직접 입력</span>` +
      `<input type="date" class="car-d" id="sxA" value="${a}" min="${VF.d0}" max="${VF.d1}" aria-label="시작일">` +
      `<i class="car-tilde">~</i>` +
      `<input type="date" class="car-d" id="sxB" value="${b}" min="${VF.d0}" max="${VF.d1}" aria-label="종료일">` +
      `<button type="button" class="car-go" id="sxGo">적용</button>` +
      (isCus() ? `<button type="button" class="car-off" id="sxOff" title="전체 기간으로">해제</button>` : "") +
      `</span>`;
  }

  /* ── 대시보드 렌더 ── */
  function render(name) {
    const row = storeRow(name);
    const rg = row ? row.rg : "";
    const isMine = MY.indexOf(rg) >= 0;
    const live = CHANNELS.filter((c) => c.live).length;
    const tot = row ? row.s + row.l : 0;
    const sh = row ? pct(row.s, row.l) : 0;
    // 지역 내 순위
    const sib = siblings(rg);
    const rank = sib.findIndex((x) => x.n === name) + 1;
    const agg = sib.reduce((o, x) => (o.s += x.s, o.l += x.l, o), { s: 0, l: 0 });
    const rSh = pct(agg.s, agg.l);
    const diff = sh - rSh;
    return `<div class="ca2 cx-wrap">` +
      `<div class="cx-top">` +
      `<button type="button" class="cx-back" id="cxBack">‹ 처음으로</button>` +
      `<div class="cx-title"><h2>${name}</h2>` +
      `<span>${rg}${isMine ? " · <b>우리 권역</b>" : ""} · 채널 ${CHANNELS.length}개 중 <b>${live}개</b> 수집 완료` +
      `${isCus() ? ` · <b>${VF.label(st.range.a, st.range.b)}</b>` : ""}</span></div>` +
      rangeBox() +
      `</div>` +
      `<div class="cx-body">` +
      `<div class="cx-left">` +
      `<div class="cx-sum">` +
      `<div class="cx-sum-h"><h3>전체 바이럴</h3><span>수집된 채널 합산</span></div>` +
      `<div class="cx-sum-n"><b>${fmtN(tot)}</b><i>건</i></div>` +
      `<div class="cx-bar big"><i class="s" style="width:${tot ? (row.s / tot * 100).toFixed(1) : 50}%"></i>` +
      `<i class="l" style="width:${tot ? (row.l / tot * 100).toFixed(1) : 50}%"></i></div>` +
      `<div class="cx-vs big"><span class="s">삼성 ${sh}%</span><span class="l">LG ${100 - sh}%</span></div>` +
      `<div class="cx-kpis">` +
      `<div><b>${rank || "-"}<i>위</i></b><span>${rg} 내</span></div>` +
      `<div class="${diff >= 0 ? "up" : "down"}"><b>${diff >= 0 ? "+" : ""}${diff}<i>p</i></b><span>지역평균 대비</span></div>` +
      `<div><b>${sib.length}<i>곳</i></b><span>${rg} 매장</span></div>` +
      `</div>` +
      `<p class="cx-note">⚠ 현재는 <b>다이렉트결혼준비</b> 채널만 수집 완료 — 나머지 채널은 수집 후 자동 반영됩니다.` +
      `${isCus() ? "<br>표시 수치는 지정하신 기간만 잘라 집계한 값입니다." : ""}</p>` +
      `</div></div>` +
      `<div class="cx-grid">${CHANNELS.map((c) => channelCard(c, name)).join("")}</div>` +
      `</div></div>`;
  }

  function paint(host) {
    host.innerHTML = render(st.name);
    const back = host.querySelector("#cxBack");
    if (back) back.addEventListener("click", () => {
      document.body.classList.remove("view-cx");
      st.range = null;
      if (window.showIntro) window.showIntro();
    });
    const go = host.querySelector("#sxGo");
    if (go) go.addEventListener("click", () => {
      const A = host.querySelector("#sxA"), B = host.querySelector("#sxB");
      const r = VF.clamp(A && A.value, B && B.value);
      st.range = { a: r[0], b: r[1] };
      paint(host);
    });
    const off = host.querySelector("#sxOff");
    if (off) off.addEventListener("click", () => { st.range = null; paint(host); });
    host.querySelectorAll(".car-d").forEach((el) => el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); const g = host.querySelector("#sxGo"); if (g) g.click(); }
    }));
  }

  function openStoreScope(name) {
    const host = document.getElementById("channelPanel");
    const sec = document.getElementById("channel");
    if (!host || !sec) return;
    st.name = name; st.range = null;
    paint(host);
    sec.hidden = false;
    document.body.classList.add("mode-results", "view-channel", "view-cx");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  window.openStoreScope = openStoreScope;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buildPicker);
  else buildPicker();
})();
