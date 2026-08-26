/* 제휴카페 타일 — 2번 페이지 우측. 채널 타일과 동일한 트리맵 로직·모양(.src/.is-tree).
   3단계 드릴: 카테고리 → 권역 → 카페.
   한 화면에 타일이 과밀해지지 않도록 권역 단계를 두었고, 부울경(우리 권역)은 항상 최상단·강조.
   타일 크기는 (수집 전이므로) 카페 회원수 규모에 비례해 임시 설정한다. */
(function () {
  "use strict";
  const D = window.AFFILIATE_CAFES || null;
  const mosaic = document.getElementById("cafeMosaic");
  if (!D || !mosaic) return;

  /* 권역 묶음 — 우리 영업권역(부울경)을 최우선으로 */
  const ZONES = [
    { key: "buk", label: "부울경", desc: "우리 권역", r2: ["부산", "울산", "경남"], mine: true },
    { key: "cap", label: "수도권", desc: "서울·경기·인천", r2: ["강남", "강북", "경기남부", "경기북부", "경기서부", "인천"] },
    { key: "chu", label: "충청", desc: "대전·세종 포함", r2: ["충남", "충북", "대전", "세종"] },
    { key: "hon", label: "호남", desc: "광주 포함", r2: ["전남", "전북", "광주"] },
    { key: "yng", label: "대구·경북", desc: "부울경 외 영남", r2: ["대구", "경북"] },
    { key: "etc", label: "강원·제주", desc: "", r2: ["강원", "제주"] },
    { key: "nat", label: "전국", desc: "권역 무관", r2: ["전국"] },
  ];
  /* 권역별 특색 아이콘 — 지역 성격이 한눈에 */
  const ZONE_IC = {
    buk: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3.2l2.5 5.4 5.9.7-4.4 4 1.2 5.8L12 16.2 6.8 19.1 8 13.3 3.6 9.3l5.9-.7L12 3.2Z" fill="#fff"/></svg>',
    cap: '<svg viewBox="0 0 24 24" fill="none"><path d="M3 20V9l5-3v3l5-3v4l6-3v13H3Z" fill="#fff"/><rect x="6" y="12" width="2" height="2" fill="#1f5fd0"/><rect x="11" y="12" width="2" height="2" fill="#1f5fd0"/><rect x="16" y="12" width="2" height="2" fill="#1f5fd0"/></svg>',
    chu: '<svg viewBox="0 0 24 24" fill="none"><path d="M2 19l6.5-11 4 6.5 2.5-4L22 19H2Z" fill="#fff"/></svg>',
    hon: '<svg viewBox="0 0 24 24" fill="none"><path d="M20 4c0 8-4.5 13-11 13H5c0-8 4.6-13 11-13h4Z" fill="#fff"/><path d="M4 21c3-6 7-9 12-11" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>',
    yng: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 7c3.5-2.5 8 .5 8 5.5 0 4-3 8-5 8-1.2 0-2-.6-3-.6s-1.8.6-3 .6c-2 0-5-4-5-8C4 7.5 8.5 4.5 12 7Z" fill="#fff"/><path d="M12 7V4.2c1.6-.5 3-.2 3.6.6" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>',
    etc: '<svg viewBox="0 0 24 24" fill="none"><path d="M2 15l5-7 3.5 5 3-4L21 15H2Z" fill="#fff"/><path d="M2 19c2-1.4 3.6-1.4 5.5 0 1.9 1.4 3.6 1.4 5.5 0 1.9-1.4 3.6-1.4 5.5 0" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>',
    nat: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.6" stroke="#fff" stroke-width="1.8"/><path d="M12 3.4c3 3.4 3 13.8 0 17.2M12 3.4c-3 3.4-3 13.8 0 17.2M3.6 12h16.8" stroke="#fff" stroke-width="1.5"/></svg>',
  };
  const zoneOf = (c) => (ZONES.find((z) => z.r2.indexOf(c.r2) >= 0) || ZONES[ZONES.length - 1]).key;

  const st = { cat: null, zone: null };
  const fmt = (n) => (n || 0).toLocaleString("ko-KR");
  const man = (n) => (n >= 10000 ? (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "만" : fmt(n));
  const CAFE_IC = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H10l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="#fff"/><circle cx="9" cy="10.5" r="1.3" fill="#03C75A"/><circle cx="12" cy="10.5" r="1.3" fill="#03C75A"/><circle cx="15" cy="10.5" r="1.3" fill="#03C75A"/></svg>';

  function tile(o) {
    return `<figure class="src ${o.cls}" ${o.attr} data-count="${o.v}" title="${o.title}">` +
      `<span class="src-ping" aria-hidden="true"></span>` +
      (o.badge ? `<span class="src-badge">${o.badge}</span>` : "") +
      `<span class="src-ic">${o.ic || CAFE_IC}</span>` +
      `<figcaption><b>${o.name}</b><small>${o.sub}</small></figcaption>` +
      `<span class="src-count"><i>${o.disp}</i><em>${o.unit}</em></span></figure>`;
  }
  const head = (title, sub, back) =>
    `<figure class="src src-cwhead"${back ? ' data-cwback="1" title="뒤로"' : ""}>` +
    `<figcaption><b>${title}</b><small>${sub}</small></figcaption></figure>`;

  function build() {
    const list = st.cat ? (D.cafes[st.cat] || []) : [];
    if (!st.cat) {
      // 1단계: 카테고리
      /* 부울경 14곳은 수집이 끝났다 — 카테고리를 헤매지 않고 바로 들어가는
         입구를 1단계에 둔다(2026-08-26 사용자 지시: "부울경 카페는 수집 완료"). */
      const AD = window.AFFAD;
      mosaic.innerHTML = head("제휴카페", `${D.total}곳 · 회원 ${man(D.members)}명`, false) +
        (AD ? tile({
          cls: "src-cat src-hot zone-mine", attr: 'data-affads="1"',
          v: Math.max(2000000, AD.total * 400),
          name: "부울경 종합 분석", sub: `수집 ${AD.cafes}곳 · 광고 vs 고객 글`,
          disp: fmt(AD.total), unit: "건", badge: "분석",
          title: `부울경 제휴카페 ${AD.cafes}곳 · 가전 글 ${fmt(AD.total)}건 — 당사/경쟁사 광고와 고객 글을 갈라 봅니다`,
        }) : "") +
        D.cats.map((c) => {
          const mine = (D.cafes[c.key] || []).filter((x) => zoneOf(x) === "buk").length;
          return tile({
            cls: "src-cat cat-" + c.key, attr: `data-cat="${c.key}"`, v: c.members,
            name: c.label, sub: `${c.count}곳` + (mine ? ` · 부울경 ${mine}` : ""),
            disp: man(c.members), unit: "명", badge: mine ? "부울경 " + mine : "",
            title: `${c.label} ${c.count}곳 · 회원 ${fmt(c.members)}명 — 클릭하면 권역별로`,
          });
        }).join("");
    } else if (!st.zone) {
      // 2단계: 권역 (타일 과밀 방지)
      const cat = D.cats.find((x) => x.key === st.cat) || {};
      const byZone = {};
      list.forEach((c) => { const z = zoneOf(c); (byZone[z] = byZone[z] || []).push(c); });
      const zones = ZONES.filter((z) => byZone[z.key] && byZone[z.key].length);
      mosaic.innerHTML = head("‹ " + cat.label, `권역 ${zones.length} · 카페 ${list.length}곳`, true) +
        zones.map((z) => {
          const arr = byZone[z.key], mem = arr.reduce((a, x) => a + x.m, 0);
          return tile({
            cls: "src-zone zone-" + z.key + (z.mine ? " zone-mine" : ""), attr: `data-zone="${z.key}"`, v: mem,
            ic: ZONE_IC[z.key],
            name: z.label, sub: `${arr.length}곳` + (z.desc ? ` · ${z.desc}` : ""),
            disp: man(mem), unit: "명", badge: z.mine ? "우리 권역" : "",
            title: `${z.label} ${arr.length}곳 · 회원 ${fmt(mem)}명`,
          });
        }).join("");
    } else {
      // 3단계: 카페
      const cat = D.cats.find((x) => x.key === st.cat) || {};
      const zone = ZONES.find((z) => z.key === st.zone) || {};
      const arr = list.filter((c) => zoneOf(c) === st.zone).sort((a, b) => b.m - a.m);
      const top = arr.length ? arr[0].m : 0;
      // 분석 데이터가 있는 카페는 '분석완료'로 구분 — 클릭해봐야 아는 상황을 없앤다
      const AI = window.AFFILIATE_INSIGHT;
      const slugOf = (c) => (c.u || c.url || "").replace(/\/+$/, "").split("/").pop();
      const has = (c) => !!(AI && (AI.cafes[slugOf(c)]
        || Object.values(AI.cafes).some((x) => x.name === c.n)));
      const done = arr.filter(has).length;
      mosaic.innerHTML = head(`‹ ${cat.label} · ${zone.label}`,
        `${arr.length}곳` + (done ? ` · 분석 ${done}곳` : " · 수집 대기"), true) +
        arr.map((c) => {
          const ok = has(c);
          return tile({
            cls: "src-cafe2" + (zone.mine ? " zone-mine" : "") + (ok ? " src-hot" : " src-quiet"),
            attr: `data-cafe="${list.indexOf(c)}" data-key="${st.cat}"`, v: c.m,
            name: c.n, sub: [c.r3, c.r2].filter(Boolean).filter((v, j, a) => a.indexOf(v) === j)[0] || c.t,
            disp: man(c.m), unit: "명", badge: ok ? "분석" : "",
            title: ok ? `${c.n} · 회원 ${fmt(c.m)}명 — 클릭하면 가전 전반 vs 당사 분석`
                      : `${c.n} · 회원 ${fmt(c.m)}명 — 아직 수집 전`,
          });
        }).join("");
    }
    layout();
  }

  /* 채널 타일과 동일한 스퀘어파이드 트리맵 배치 */
  function layout() {
    const sq = window.squarify;
    const box = mosaic.clientWidth, boxH = mosaic.clientHeight;
    if (!sq || box < 80 || boxH < 80) return;
    const tiles = [].slice.call(mosaic.querySelectorAll(".src"));
    if (!tiles.length) return;
    mosaic.classList.add("is-radial", "is-tree");
    const nodes = tiles.map((t) => ({ ref: t, v: Math.log((+t.getAttribute("data-count") || 0) + 1) + 2.4 }));
    const GAP = 5;
    sq(nodes, 0, 0, box, boxH).forEach((r) => {
      const t = r.ref;
      const w = Math.max(28, r.w - GAP), h = Math.max(28, r.h - GAP);
      t.style.left = Math.round(r.x + GAP / 2) + "px";
      t.style.top = Math.round(r.y + GAP / 2) + "px";
      t.style.width = Math.round(w) + "px";
      t.style.height = Math.round(h) + "px";
      t.style.zIndex = Math.round(w);
      t.style.setProperty("--size", Math.round(Math.min(w, h)) + "px");
      t.classList.toggle("tile-xs", Math.min(w, h) < 86);
      t._cx = r.x + r.w / 2; t._cy = r.y + r.h / 2;     // 중심(등장 애니메이션 기준점)
    });
    fly();
  }

  /* 좌측 채널 타일과 동일한 등장 효과 — 중앙에서 튀어나와 제자리로 */
  function fly() {
    const tiles = [].slice.call(mosaic.querySelectorAll(".src"));
    if (!tiles.length) return;
    const hub = mosaic.clientWidth / 2, hubY = mosaic.clientHeight / 2;
    tiles.forEach((t) => {                              // 1) 중심에 모아 숨김
      t.style.setProperty("--dx", Math.round(hub - (t._cx || hub)) + "px");
      t.style.setProperty("--dy", Math.round(hubY - (t._cy || hubY)) + "px");
      t.classList.add("closed");
      t.classList.remove("flew");
    });
    // 2) 중심에서 가까운 순 → 각도 순으로 줄지어 등장(좌측과 동일한 리듬)
    const order = tiles.slice().sort((a, b) => {
      const k = (t) => {
        const d = Math.hypot((t._cx || 0) - hub, (t._cy || 0) - hubY);
        return d < 3 ? -9 : Math.atan2((t._cy || 0) - hubY, (t._cx || 0) - hub);
      };
      return k(a) - k(b);
    });
    order.forEach((t, i) => {
      setTimeout(() => {
        t.classList.remove("closed");
        t.classList.add("flew");
        const clear = () => t.classList.remove("flew");
        t.addEventListener("animationend", clear, { once: true });
        setTimeout(clear, 720);
      }, 60 + i * 45);
    });
  }

  mosaic.addEventListener("click", (e) => {
    if (e.target.closest("[data-cwback]")) {
      if (st.zone) {
        const zs = {};
        (D.cafes[st.cat] || []).forEach((x) => { zs[zoneOf(x)] = 1; });
        if (Object.keys(zs).length === 1) { st.cat = null; st.zone = null; }   // 단일권역이면 카테고리로
        else st.zone = null;
      } else st.cat = null;
      build(); return;
    }
    if (e.target.closest("[data-affads]")) {
      if (typeof window.openAffiliateAds === "function") window.openAffiliateAds();
      return;
    }
    const c = e.target.closest("[data-cat]");
    if (c) {
      st.cat = c.getAttribute("data-cat"); st.zone = null;
      // 권역이 하나뿐이면(예: 기타=전국) 중간 단계를 건너뛰고 카페 목록으로
      const zs = {};
      (D.cafes[st.cat] || []).forEach((x) => { zs[zoneOf(x)] = 1; });
      const ks = Object.keys(zs);
      if (ks.length === 1) st.zone = ks[0];
      build(); return;
    }
    const z = e.target.closest("[data-zone]");
    if (z) { st.zone = z.getAttribute("data-zone"); build(); return; }
    const f = e.target.closest("[data-cafe]");
    if (f) {
      const cafe = (D.cafes[f.getAttribute("data-key")] || [])[+f.getAttribute("data-cafe")];
      if (cafe && typeof window.openAffiliateCafe === "function") window.openAffiliateCafe(cafe);
    }
  });
  window.addEventListener("resize", () => { if (!mosaic.hidden) layout(); });

  window.showCafeMosaic = function () {
    mosaic.hidden = false;
    st.cat = null; st.zone = null;
    build();
    requestAnimationFrame(build);
  };
})();
