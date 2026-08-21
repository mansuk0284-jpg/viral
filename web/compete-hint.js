/* 경쟁력 힌트 — 매장 이름에 마우스를 올리면 숨어 있던 경쟁력이 떠오른다.
   (사용자 지시: "너무 노골적으로 나오지 않게, 마우스를 가져가면 숨겨져 있던 데이터가 등장하듯이")

   왜 이렇게 하나:
   - 경쟁력은 **사내 실적**이다. 화면에 상시 노출하면 대시보드가 실적표가 되고,
     옆사람 눈에 그대로 들어간다. 그래서 기본은 감춰 두고 **의도적으로 볼 때만** 보여준다.
   - 금액과 갭도 함께 띄운다(2026-08-21 사용자 지시 "금액과 갭을 보여줘").
     원래는 싣지 않았는데 방침이 바뀌었다. 다만 **상시 노출은 여전히 안 한다** —
     hover 로만 뜬다. 단위는 백만원(시트 그대로).

   붙이는 법: 매장 이름을 가진 요소에 data-store="<매장명>" 만 달면 된다.
   이 파일이 문서 전체에서 위임 처리하므로 화면마다 코드를 넣지 않는다. */
(function () {
  /* 경쟁력 표기 — 배수(1.07배)가 아니라 %로 읽는다.
     사용자 지시(2026-08-21): "1.00 숫자로 표시하지 말고 %로 나타내줘
     (우위는 100% 초과, 열세는 100% 미만)".
     100% = 대등. 107% 면 X사의 1.07배를 판다는 뜻이다. */
  /* 금액 — 백만원 단위 그대로. 억 단위로 접으면 자릿수 감이 사라져 원 단위로 읽힌다. */
  function fmtM(n) {
    return n == null ? "-" : Math.round(n).toLocaleString("ko-KR");
  }
  /* 갭은 부호를 남긴다 — 어느 쪽이 앞서는지가 숫자 크기보다 먼저 읽혀야 한다. */
  function fmtGap(n) {
    if (n == null) return "-";
    return (n >= 0 ? "+" : "−") + Math.abs(Math.round(n)).toLocaleString("ko-KR");
  }

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

  /* ── 화면에서 고른 기간 ↔ 경쟁력 자료의 기간 잇기 ───────────────────
     사용자 지시(2026-08-21): "각 월별이나 년간 경쟁력도 마우스를 가져다대면
     나타나도록", "년간 기간으로 설정된 경우에는 년간 경쟁력과 분기단위로 추이".

     화면은 "2026-08" / "2026" / "all" 로 기간을 말하고,
     자료는 "8월 (1-31)" / "26년 (년간)" 처럼 적혀 있다. 그 사이를 여기서 잇는다. */

  // 화면이 지금 무슨 기간을 보고 있나 — cafe-analysis 가 알려준다
  function viewPeriod() {
    return (window.VPERIOD && window.VPERIOD()) || null;
  }

  const yyOf = (y) => String(y).slice(2);        // 2026 → 26

  /* 그 해의 월 라벨을 찾는다. 자료는 '8월 (1-17)' 처럼 날짜 범위가 붙는다. */
  function monthLabel(st, ym) {
    const m = +ym.slice(5);
    // 정규식을 문자열로 짜면 역슬래시가 한 번 더 먹혀 깨진다(실측: /^8월(s|(|$)/ 로 망가졌다).
    // 자료 라벨은 '8월 (1-17)' 형태라 '8월' 뒤에 공백이나 여는 괄호가 온다.
    // 정규식을 문자열로 짜면 역슬래시가 한 겹 먹혀 깨진다
    // (실측: /^8월(s|(|$)/ 로 망가져 화면이 죽었다). 문자열 비교로 간다.
    const pre = m + "월";
    return C.periods.find((p) => st.p[p] != null &&
      (p === pre || p.indexOf(pre + " ") === 0 || p.indexOf(pre + "(") === 0)) || null;
  }

  function yearLabel(st, y) {
    const yy = yyOf(y);
    for (const pat of [yy + "년 (년간)", yy + "년 (누계)"]) {
      if (st.p[pat] != null) return pat;
    }
    return null;
  }

  /* 그 해 분기 넷 — 연간을 볼 때 추이로 보여준다 */
  function quarters(st, y) {
    const yy = yyOf(y);
    return [1, 2, 3, 4].map((q) => {
      const k = yy + "년 " + q + "Q";
      return st.p[k] != null ? { k: k, lab: q + "Q", v: st.p[k], amt: (st.v || {})[k] } : null;
    }).filter(Boolean);
  }

  /* 화면 기간 → 자료 기간. 못 찾으면 최신 쪽으로 물러선다. */
  const PICK = ["8월 (1-17)", "26년 (누계)", "25년 (년간)"];
  function pickPeriod(st) {
    const vp = viewPeriod();
    if (vp) {
      if (/^\d{4}-\d\d$/.test(vp)) {
        const k = monthLabel(st, vp) || yearLabel(st, vp.slice(0, 4));
        if (k) return k;
      } else if (/^\d{4}$/.test(vp)) {
        const k = yearLabel(st, vp);
        if (k) return k;
      }
      // 'all' 이거나 못 찾으면 아래 기본값으로
    }
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
        const amt = (st.v || {})[p];              // [당사, X사, 갭] 백만원
        const isYear = /년\s?\((?:년간|누계)\)/.test(p);

        /* 추이 — 연간을 보고 있으면 **그 해 분기**, 아니면 최근 3개 연도.
           사용자 지시: "년간 기간으로 설정된 경우에는 년간 경쟁력과 분기단위로 추이". */
        let spark = "", trLab = "추이";
        if (isYear) {
          const y = "20" + p.slice(0, 2);
          const qs = quarters(st, y);
          if (qs.length >= 2) {
            trLab = "분기";
            spark = `<span class="cmp-tr">` + qs.map((q) => {
              const gv = grade(q.v);
              return `<i class="${gv.cls}" title="${q.lab} · ${CMP_PCT(q.v)}` +
                (q.amt ? ` · 갭 ${fmtGap(q.amt[2])}` : "") + `">` +
                `<u>${q.lab}</u>${CMP_PCT(q.v)}</i>`;
            }).join("") + `</span>`;
          }
        }
        if (!spark) {
          const yrs = ["24년 (년간)", "25년 (년간)", "26년 (누계)"].filter((k) => st.p[k] != null);
          if (yrs.length >= 2) {
            spark = `<span class="cmp-tr">` + yrs.map((k) => {
              const gv = grade(st.p[k]);
              return `<i class="${gv.cls}" title="${k}">${CMP_PCT(st.p[k])}</i>`;
            }).join('<em>›</em>') + `</span>`;
          }
        }

        /* 금액과 갭 — 사내 실적이라 hover 안에서만 보여준다(2026-08-21 지시).
           단위는 백만원. 갭은 부호를 남겨야 어느 쪽이 앞서는지 한눈에 읽힌다. */
        const money = amt
          ? `<span class="cmp-amt">` +
            `<i><em>당사</em><b>${fmtM(amt[0])}</b></i>` +
            `<i><em>X사</em><b>${fmtM(amt[1])}</b></i>` +
            `<i class="${amt[2] >= 0 ? "up" : "dn"}"><em>갭</em><b>${fmtGap(amt[2])}</b></i>` +
            `</span>`
          : "";

        t.innerHTML =
          `<b>${st.name}</b>` +
          `<span class="cmp-row"><em>경쟁력</em>` +
          `<i class="cmp-v ${g.cls}">${CMP_PCT(v)}</i>` +
          `<i class="cmp-g ${g.cls}">${g.t}</i></span>` +
          money +
          (spark ? `<span class="cmp-row"><em>${trLab}</em>${spark}</span>` : "") +
          `<span class="cmp-foot">${p} · 당사 ÷ X사 매출 · <b>100% = 대등</b>` +
          (amt ? ` · 금액 백만원` : "") + `</span>`;
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
