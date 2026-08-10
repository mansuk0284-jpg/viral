/* 매장 × 채널 교차 대시보드
   메인 좌측 "우리 매장 찾아보기"에서 매장을 고르면, 그 매장이 각 채널에서
   어떻게 바이럴되는지를 한 화면에 보여준다.
   - 다이렉트결혼준비: 실데이터(cafe-data.js)
   - 그 외 채널: 미수집 → '수집 대기'로 정직 표기(임의 수치 생성 금지) */
(function () {
  "use strict";
  const CD = window.CAFE_DATA || {};
  const MY = ["부산", "울산", "경남"];          // 우리 권역 — 항상 최상단

  const fmtN = (n) => (n || 0).toLocaleString("ko-KR");
  const pct = (a, b) => (a + b > 0 ? Math.round((a / (a + b)) * 100) : 0);

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
    const S = CD.stores || {};
    for (const rg of Object.keys(S)) {
      const hit = S[rg].find((x) => x.n === name);
      if (hit) return { rg, s: hit.s, l: hit.l };
    }
    return null;
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
    const tot = row.s + row.l, sh = pct(row.s, row.l);
    const lead = row.s > row.l ? "s" : row.l > row.s ? "l" : "even";
    const det = pick(CD.storeDetail, name);
    const ext = pick(CD.extStore, name);
    const mgr = pick(CD.mgrStore, name);
    const items = (det && det.items) ? det.items.slice(0, 3) : [];
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

  /* ── 대시보드 렌더 ── */
  function render(name) {
    const row = storeRow(name);
    const rg = row ? row.rg : "";
    const isMine = MY.indexOf(rg) >= 0;
    const live = CHANNELS.filter((c) => c.live).length;
    const tot = row ? row.s + row.l : 0;
    const sh = row ? pct(row.s, row.l) : 0;
    // 지역 내 순위
    const S = CD.stores || {};
    const sib = (S[rg] || []).slice().sort((a, b) => (b.s + b.l) - (a.s + a.l));
    const rank = sib.findIndex((x) => x.n === name) + 1;
    const agg = sib.reduce((o, x) => (o.s += x.s, o.l += x.l, o), { s: 0, l: 0 });
    const rSh = pct(agg.s, agg.l);
    const diff = sh - rSh;
    return `<div class="ca2 cx-wrap">` +
      `<div class="cx-top">` +
      `<button type="button" class="cx-back" id="cxBack">‹ 처음으로</button>` +
      `<div class="cx-title"><h2>${name}</h2>` +
      `<span>${rg}${isMine ? " · <b>우리 권역</b>" : ""} · 채널 ${CHANNELS.length}개 중 <b>${live}개</b> 수집 완료</span></div>` +
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
      `<p class="cx-note">⚠ 현재는 <b>다이렉트결혼준비</b> 채널만 수집 완료 — 나머지 채널은 수집 후 자동 반영됩니다.</p>` +
      `</div></div>` +
      `<div class="cx-grid">${CHANNELS.map((c) => channelCard(c, name)).join("")}</div>` +
      `</div></div>`;
  }

  function openStoreScope(name) {
    const host = document.getElementById("channelPanel");
    const sec = document.getElementById("channel");
    if (!host || !sec) return;
    host.innerHTML = render(name);
    sec.hidden = false;
    document.body.classList.add("mode-results", "view-channel", "view-cx");
    window.scrollTo({ top: 0, behavior: "auto" });
    const back = document.getElementById("cxBack");
    if (back) back.addEventListener("click", () => {
      document.body.classList.remove("view-cx");
      if (window.showIntro) window.showIntro();
    });
  }

  window.openStoreScope = openStoreScope;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buildPicker);
  else buildPicker();
})();
