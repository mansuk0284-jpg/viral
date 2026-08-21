/* 경쟁력 힌트 — 매장 이름에 마우스를 올리면 숨어 있던 경쟁력이 떠오른다.
   (사용자 지시: "너무 노골적으로 나오지 않게, 마우스를 가져가면 숨겨져 있던 데이터가 등장하듯이")

   왜 이렇게 하나:
   - 경쟁력은 **사내 실적**이다. 화면에 상시 노출하면 대시보드가 실적표가 되고,
     옆사람 눈에 그대로 들어간다. 그래서 기본은 감춰 두고 **의도적으로 볼 때만** 보여준다.
   - 금액은 아예 싣지 않는다(build_compete.py 가 배수만 내보낸다).

   붙이는 법: 매장 이름을 가진 요소에 data-store="<매장명>" 만 달면 된다.
   이 파일이 문서 전체에서 위임 처리하므로 화면마다 코드를 넣지 않는다. */
(function () {
  /* 경쟁력 표기 — 배수(1.07배)가 아니라 %로 읽는다.
     사용자 지시(2026-08-21): "1.00 숫자로 표시하지 말고 %로 나타내줘
     (우위는 100% 초과, 열세는 100% 미만)".
     100% = 대등. 107% 면 X사의 1.07배를 판다는 뜻이다. */
  window.CMP_PCT = function (v) {
    if (v == null) return "-";
    return Math.round(v * 100) + "%";
  };

  "use strict";
  const C = window.COMPETE || null;
  if (!C) return;

  const norm = (s) => String(s || "").replace(/\s+/g, "")
    .replace("더현대", "현대").replace("갤러리아", "갤");
  const MAP = {};
  C.stores.forEach((s) => { MAP[s.key] = s; });

  /* 최신순으로 쓸 만한 기간을 고른다. 월 → 누계 → 연간 순으로 대표성을 본다. */
  const PICK = ["8월 (1-17)", "26년 (누계)", "25년 (년간)"];
  function pickPeriod(st) {
    for (const p of PICK) if (st.p[p] != null) return p;
    const ks = C.periods.filter((p) => st.p[p] != null);
    return ks.length ? ks[ks.length - 1] : null;
  }

  const find = (name) => MAP[norm(name)] || null;

  /* 배수 → 표시용 */
  function grade(v) {
    if (v >= 1.3) return { cls: "win2", t: "크게 우세" };
    if (v >= 1.0) return { cls: "win", t: "우세" };
    if (v >= 0.8) return { cls: "even", t: "접전" };
    return { cls: "lose", t: "열세" };
  }

  let tip = null;
  function ensure() {
    if (tip) return tip;
    tip = document.createElement("div");
    tip.className = "cmp-tip";
    tip.setAttribute("role", "tooltip");
    document.body.appendChild(tip);
    return tip;
  }

  function show(el, name) {
    const st = find(name);
    const t = ensure();
    if (!st) {
      t.innerHTML = `<b class="cmp-none">${name}</b>` +
        `<span class="cmp-msg">경쟁력 자료에 없는 매장입니다</span>`;
    } else {
      const p = pickPeriod(st);
      const v = p ? st.p[p] : null;
      if (v == null) {
        t.innerHTML = `<b class="cmp-none">${st.name}</b>` +
          `<span class="cmp-msg">이 기간 자료가 없습니다</span>`;
      } else {
        const g = grade(v);
        // 최근 흐름 — 연간 3개로 추세를 보여준다
        const yrs = ["24년 (년간)", "25년 (년간)", "26년 (누계)"]
          .filter((k) => st.p[k] != null);
        const spark = yrs.length >= 2
          ? `<span class="cmp-tr">` + yrs.map((k) => {
              const gv = grade(st.p[k]);
              return `<i class="${gv.cls}" title="${k}">${CMP_PCT(st.p[k])}</i>`;
            }).join('<em>›</em>') + `</span>`
          : "";
        t.innerHTML =
          `<b>${st.name}</b>` +
          `<span class="cmp-row"><em>경쟁력</em>` +
          `<i class="cmp-v ${g.cls}">${CMP_PCT(v)}</i>` +
          `<i class="cmp-g ${g.cls}">${g.t}</i></span>` +
          (spark ? `<span class="cmp-row"><em>추이</em>${spark}</span>` : "") +
          `<span class="cmp-foot">${p} · 당사 ÷ X사 매출 · <b>100% = 대등</b></span>`;
      }
    }
    const r = el.getBoundingClientRect();
    t.classList.add("on");
    const tw = t.offsetWidth, th = t.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2;
    let y = r.top - th - 10;
    if (y < 8) y = r.bottom + 10;                       // 위가 좁으면 아래로
    x = Math.max(8, Math.min(x, window.innerWidth - tw - 8));
    t.style.left = x + "px";
    t.style.top = y + "px";
  }

  function hide() { if (tip) tip.classList.remove("on"); }

  /* 문서 전체 위임 — 화면이 다시 그려져도 계속 동작한다 */
  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-store]");
    if (!el) return;
    const nm = el.getAttribute("data-store");
    if (nm) show(el, nm);
  });
  document.addEventListener("mouseout", (e) => {
    if (e.target.closest("[data-store]")) hide();
  });
  document.addEventListener("scroll", hide, true);
  // 키보드로도 볼 수 있게
  document.addEventListener("focusin", (e) => {
    const el = e.target.closest && e.target.closest("[data-store]");
    if (el) show(el, el.getAttribute("data-store"));
  });
  document.addEventListener("focusout", hide);

  /* 바이럴 ↔ 경쟁력 상관 — 인사이트 계산용으로 밖에 열어 둔다 */
  window.COMPETE_OF = find;
  window.COMPETE_PERIOD = pickPeriod;
})();
