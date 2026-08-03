/* 제휴카페 '바이럴세상' — 카테고리 → 카페 타일 → 채널 분석 진입
   메인 히어로 좌측(영상 자리)에 표시된다. 데이터: assets/cafes-data.js */
(function () {
  "use strict";
  const D = window.AFFILIATE_CAFES || null;
  const $ = (s, r) => (r || document).querySelector(s);

  const btn = $("#worldBtn"), panel = $("#cafeWorld"), body = $("#cwBody");
  const back = $("#cwBack"), close = $("#cwClose"), sub = $("#cwSub"), title = $("#cwTitle");
  if (!btn || !panel || !body || !D) return;

  const st = { cat: null };
  const fmt = (n) => (n || 0).toLocaleString("ko-KR");
  const man = (n) => (n >= 10000 ? (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "만" : fmt(n));

  /* 카테고리 그리드 — 타일 크기는 카페 수·회원수에 비례 */
  function catView() {
    const max = Math.max(...D.cats.map((c) => c.members), 1);
    return `<div class="cw-cats">` + D.cats.map((c) => {
      const w = Math.round(c.members / max * 100);
      return `<button type="button" class="cw-cat" data-cat="${c.key}" style="--cc:${c.color}">` +
        `<span class="cc-top"><b>${c.label}</b><i>${c.count}곳</i></span>` +
        `<span class="cc-mem">${man(c.members)}<em>명</em></span>` +
        `<span class="cc-bar"><i style="width:${w}%"></i></span>` +
        `<span class="cc-desc">${c.desc}</span></button>`;
    }).join("") + `</div>`;
  }

  /* 카페 타일 — 회원수 비례 크기(log), 클릭 시 채널 분석 화면 */
  function cafeView(key) {
    const list = (D.cafes[key] || []).slice();
    const cat = D.cats.find((c) => c.key === key) || {};
    const raw = list.map((c) => Math.log((c.m || 0) + 1));
    const mx = Math.max(...raw, 1), mn = Math.min(...raw, 0);
    return `<div class="cw-cafes" style="--cc:${cat.color || "#1f5fd0"}">` + list.map((c, i) => {
      const t = (raw[i] - mn) / Math.max(0.001, mx - mn);      // 0~1
      const cls = t > 0.72 ? "big" : t > 0.42 ? "mid" : "sm";
      const rg = [c.r2, c.r3].filter(Boolean).filter((v, j, a) => a.indexOf(v) === j).join(" · ");
      return `<button type="button" class="cw-cafe ${cls}" data-cafe="${i}" data-key="${key}" ` +
        `title="${c.n} · 회원 ${fmt(c.m)}명">` +
        `<span class="cf-n">${c.n}</span>` +
        `<span class="cf-meta"><i class="cf-m">${man(c.m)}</i>${rg ? `<i class="cf-r">${rg}</i>` : ""}</span>` +
        `</button>`;
    }).join("") + `</div>`;
  }

  function render() {
    if (!st.cat) {
      title.textContent = "바이럴세상";
      sub.innerHTML = `제휴카페 <b>${D.total}</b>곳 · 회원 <b>${man(D.members)}</b>명 — 성격별로 묶어 보여줍니다`;
      back.hidden = true;
      body.innerHTML = catView();
    } else {
      const c = D.cats.find((x) => x.key === st.cat) || {};
      title.textContent = c.label || "제휴카페";
      sub.innerHTML = `${c.count}곳 · 회원 <b>${man(c.members)}</b>명 — 타일을 누르면 그 카페의 삼성·LG 후기를 분석합니다`;
      back.hidden = false;
      body.innerHTML = cafeView(st.cat);
    }
  }

  /* 우측 컬럼과 상·하단 라인을 맞춘다(기본 UI 원칙) */
  function syncHeight() {
    if (panel.hidden) return;
    const art = document.querySelector(".hero-art");
    const h = art ? Math.round(art.getBoundingClientRect().height) : 0;
    panel.style.height = h > 240 ? h + "px" : "";
  }
  window.addEventListener("resize", syncHeight);

  function open() {
    panel.hidden = false;
    document.body.classList.add("world-open");
    btn.setAttribute("aria-expanded", "true");
    st.cat = null; render();
    syncHeight();
    requestAnimationFrame(syncHeight);   // 레이아웃 확정 후 한 번 더
  }
  function shut() {
    panel.hidden = true;
    document.body.classList.remove("world-open");
    btn.setAttribute("aria-expanded", "false");
  }

  btn.addEventListener("click", () => (panel.hidden ? open() : shut()));
  close.addEventListener("click", shut);
  back.addEventListener("click", () => { st.cat = null; render(); });

  body.addEventListener("click", (e) => {
    const c = e.target.closest("[data-cat]");
    if (c) { st.cat = c.getAttribute("data-cat"); render(); return; }
    const f = e.target.closest("[data-cafe]");
    if (f) {
      const key = f.getAttribute("data-key");
      const cafe = (D.cafes[key] || [])[+f.getAttribute("data-cafe")];
      if (cafe && typeof window.openAffiliateCafe === "function") window.openAffiliateCafe(cafe);
    }
  });
})();
