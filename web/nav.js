/* 화면 이동 공용 모듈 (window.VNAV)
   문제: 화면마다 뒤로가기가 제각각이었다 —
     플로팅 '← 처음으로', 페이저 '⤒ ‹ ›', 헤더 '‹ 처음으로', 헤더 '‹ 카페 목록'.
     제휴카페에서는 플로팅과 헤더 버튼이 실제로 겹쳤고(실측),
     '‹ 카페 목록'은 이름과 달리 카페 목록이 아니라 처음 화면으로 갔다.
   해결: 이동은 이 모듈 하나로만 한다. 각 화면은 진입할 때 push() 하고
     헤더에 bar() 를 그려 넣는다. 위치·모양·동작이 어디서나 같아진다. */
(function () {
  "use strict";
  const stack = [];      // 지나온 화면
  const ahead = [];      // 뒤로 온 뒤 다시 갈 수 있는 화면

  function apply(e) {
    if (e && typeof e.open === "function") e.open();
  }

  const V = {
    /* 화면 진입 시 호출. label 은 뒤로가기 툴팁에 쓴다. */
    push(entry) {
      if (!entry || !entry.id) return;
      const cur = stack[stack.length - 1];
      if (cur && cur.id === entry.id) { stack[stack.length - 1] = entry; return; }
      stack.push(entry);
      ahead.length = 0;                    // 새 경로로 갈라지면 앞으로가기는 버린다
      V.sync();
    },
    back() {
      if (stack.length <= 1) return V.home();
      ahead.push(stack.pop());
      apply(stack[stack.length - 1]);
      V.sync();
    },
    forward() {
      if (!ahead.length) return;
      const e = ahead.pop();
      stack.push(e);
      apply(e);
      V.sync();
    },
    home() {
      stack.length = 0; ahead.length = 0;
      document.body.classList.remove("mode-results", "view-channel", "view-cafe", "view-cx", "view-af");
      window.scrollTo({ top: 0, behavior: "auto" });
      V.sync();
    },
    canBack: () => stack.length > 1,
    canFwd: () => ahead.length > 0,
    prevLabel: () => (stack.length > 1 ? stack[stack.length - 2].label : "처음"),

    /* 헤더에 넣는 표준 내비 — 어느 화면이든 같은 자리·같은 모양 */
    bar() {
      const b = V.canBack(), f = V.canFwd();
      return `<nav class="vnav" aria-label="화면 이동">` +
        `<button type="button" class="vnav-b" data-nav="home" title="처음으로">` +
        `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6 3.4 11h2.1v9h5.1v-5.6h2.8V20h5.1v-9h2.1L12 3.6Z"/></svg>` +
        `<span>처음</span></button>` +
        `<button type="button" class="vnav-b ic" data-nav="back" ${b ? "" : "disabled"}` +
        ` title="${b ? V.prevLabel() + "(으)로 뒤로" : "뒤로 갈 화면 없음"}" aria-label="뒤로">` +
        `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 5.3 8 12l6.7 6.7 1.6-1.7L11.3 12l5-5-1.6-1.7Z"/></svg></button>` +
        `<button type="button" class="vnav-b ic" data-nav="fwd" ${f ? "" : "disabled"}` +
        ` title="${f ? "앞으로" : "앞으로 갈 화면 없음"}" aria-label="앞으로">` +
        `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.3 5.3 7.7 7l5 5-5 5 1.6 1.7L16 12 9.3 5.3Z"/></svg></button>` +
        `</nav>`;
    },

    /* 화면을 다시 그린 뒤 호출 — 버튼 활성/비활성만 맞춘다 */
    sync() {
      document.querySelectorAll(".vnav").forEach((n) => {
        const bb = n.querySelector('[data-nav="back"]'), fb = n.querySelector('[data-nav="fwd"]');
        if (bb) { bb.disabled = !V.canBack(); bb.title = V.canBack() ? V.prevLabel() + "(으)로 뒤로" : "뒤로 갈 화면 없음"; }
        if (fb) { fb.disabled = !V.canFwd(); fb.title = V.canFwd() ? "앞으로" : "앞으로 갈 화면 없음"; }
      });
    },
  };

  /* 클릭은 문서 한 곳에서만 받는다(화면마다 붙이면 중복 등록된다) */
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-nav]");
    if (!b || b.disabled) return;
    const k = b.getAttribute("data-nav");
    if (k === "home") V.home();
    else if (k === "back") V.back();
    else if (k === "fwd") V.forward();
  });
  /* 브라우저 뒤로가기 키(Alt+←)도 같은 동작 */
  document.addEventListener("keydown", (e) => {
    if (!document.body.classList.contains("mode-results")) return;
    if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); V.back(); }
    if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); V.forward(); }
  });

  window.VNAV = V;
})();
