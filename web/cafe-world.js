/* 제휴카페 타일 — 2번 페이지 우측. 채널 타일과 동일한 트리맵 로직·모양(.src/.is-tree).
   1단계: 카테고리 4개 → 클릭 → 2단계: 해당 카테고리의 카페 타일.
   타일 크기는 (수집 전이므로) 카페 회원수 규모에 비례해 임시 설정한다. */
(function () {
  "use strict";
  const D = window.AFFILIATE_CAFES || null;
  const mosaic = document.getElementById("cafeMosaic");
  if (!D || !mosaic) return;

  const st = { cat: null };
  const fmt = (n) => (n || 0).toLocaleString("ko-KR");
  const man = (n) => (n >= 10000 ? (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "만" : fmt(n));
  const CAFE_IC = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H10l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="#fff"/><circle cx="9" cy="10.5" r="1.3" fill="#03C75A"/><circle cx="12" cy="10.5" r="1.3" fill="#03C75A"/><circle cx="15" cy="10.5" r="1.3" fill="#03C75A"/></svg>';

  /* 타일 1개 마크업 — 채널 타일과 동일 구조 */
  function tile(o) {
    return `<figure class="src ${o.cls}" ${o.attr} data-count="${o.v}" title="${o.title}">` +
      `<span class="src-ping" aria-hidden="true"></span>` +
      `<span class="src-ic">${CAFE_IC}</span>` +
      `<figcaption><b>${o.name}</b><small>${o.sub}</small></figcaption>` +
      `<span class="src-count"><i>${o.disp}</i><em>${o.unit}</em></span></figure>`;
  }

  function build() {
    if (!st.cat) {
      mosaic.innerHTML =
        `<figure class="src src-cwhead" data-count="0"><figcaption><b>제휴카페</b>` +
        `<small>${D.total}곳 · 회원 ${man(D.members)}명</small></figcaption></figure>` +
        D.cats.map((c) => tile({
          cls: "src-cat cat-" + c.key, attr: `data-cat="${c.key}"`, v: c.members,
          name: c.label, sub: c.count + "곳 · " + c.desc, disp: man(c.members), unit: "명",
          title: `${c.label} ${c.count}곳 · 회원 ${fmt(c.members)}명 — 클릭하면 카페별로`,
        })).join("");
    } else {
      const cat = D.cats.find((x) => x.key === st.cat) || {};
      const list = (D.cafes[st.cat] || []);
      mosaic.innerHTML =
        `<figure class="src src-cwhead" data-cwback="1" title="카테고리로 돌아가기">` +
        `<figcaption><b>‹ ${cat.label}</b><small>${list.length}곳 · 클릭해 돌아가기</small></figcaption></figure>` +
        list.map((c, i) => {
          const rg = [c.r2, c.r3].filter(Boolean).filter((v, j, a) => a.indexOf(v) === j).join(" · ");
          return tile({
            cls: "src-cafe2 cat-" + st.cat, attr: `data-cafe="${i}" data-key="${st.cat}"`, v: c.m,
            name: c.n, sub: rg || c.t, disp: man(c.m), unit: "명",
            title: `${c.n} · 회원 ${fmt(c.m)}명 — 클릭하면 삼성·LG 후기 분석`,
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
    });
  }

  mosaic.addEventListener("click", (e) => {
    const back = e.target.closest("[data-cwback]");
    if (back) { st.cat = null; build(); return; }
    const c = e.target.closest("[data-cat]");
    if (c) { st.cat = c.getAttribute("data-cat"); build(); return; }
    const f = e.target.closest("[data-cafe]");
    if (f) {
      const cafe = (D.cafes[f.getAttribute("data-key")] || [])[+f.getAttribute("data-cafe")];
      if (cafe && typeof window.openAffiliateCafe === "function") window.openAffiliateCafe(cafe);
    }
  });
  window.addEventListener("resize", () => { if (!mosaic.hidden) layout(); });

  /* 포털이 열릴 때 호출된다(index.html revealPortal) */
  window.showCafeMosaic = function () {
    mosaic.hidden = false;
    st.cat = null;
    build();
    requestAnimationFrame(build);   // 레이아웃 확정 후 재배치
  };
})();
