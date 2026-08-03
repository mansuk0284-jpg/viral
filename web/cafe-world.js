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
  const zoneOf = (c) => (ZONES.find((z) => z.r2.indexOf(c.r2) >= 0) || ZONES[ZONES.length - 1]).key;

  const st = { cat: null, zone: null };
  const fmt = (n) => (n || 0).toLocaleString("ko-KR");
  const man = (n) => (n >= 10000 ? (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "만" : fmt(n));
  const CAFE_IC = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H10l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="#fff"/><circle cx="9" cy="10.5" r="1.3" fill="#03C75A"/><circle cx="12" cy="10.5" r="1.3" fill="#03C75A"/><circle cx="15" cy="10.5" r="1.3" fill="#03C75A"/></svg>';

  function tile(o) {
    return `<figure class="src ${o.cls}" ${o.attr} data-count="${o.v}" title="${o.title}">` +
      `<span class="src-ping" aria-hidden="true"></span>` +
      (o.badge ? `<span class="src-badge">${o.badge}</span>` : "") +
      `<span class="src-ic">${CAFE_IC}</span>` +
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
      mosaic.innerHTML = head("제휴카페", `${D.total}곳 · 회원 ${man(D.members)}명`, false) +
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
            cls: "src-zone" + (z.mine ? " zone-mine" : ""), attr: `data-zone="${z.key}"`, v: mem,
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
      mosaic.innerHTML = head(`‹ ${cat.label} · ${zone.label}`, `${arr.length}곳 · 클릭해 분석`, true) +
        arr.map((c, i) => tile({
          cls: "src-cafe2" + (zone.mine ? " zone-mine" : "") + (c.m === top ? " src-hot" : ""),
          attr: `data-cafe="${list.indexOf(c)}" data-key="${st.cat}"`, v: c.m,
          name: c.n, sub: [c.r3, c.r2].filter(Boolean).filter((v, j, a) => a.indexOf(v) === j)[0] || c.t,
          disp: man(c.m), unit: "명", badge: c.m === top ? "최대" : "",
          title: `${c.n} · 회원 ${fmt(c.m)}명 — 클릭하면 삼성·LG 후기 분석`,
        })).join("");
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
    });
  }

  mosaic.addEventListener("click", (e) => {
    if (e.target.closest("[data-cwback]")) {
      if (st.zone) st.zone = null; else st.cat = null;
      build(); return;
    }
    const c = e.target.closest("[data-cat]");
    if (c) { st.cat = c.getAttribute("data-cat"); st.zone = null; build(); return; }
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
