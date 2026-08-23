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

  /* ── 브라우저 뒤로/앞으로와 잇기 ─────────────────────────────────────
     사용자 지적(2026-08-21): "크롬의 뒤로가기 기능을 쓰면 안 돼? 왜 작동이 안 되지?"

     안 되던 이유: 이 모듈이 **자체 스택만** 굴리고 브라우저 히스토리에는
     아무것도 안 쌓았다. 그래서 크롬 뒤로가기를 누르면 화면이 아니라
     **사이트를 떠나** 이전 페이지로 가버렸다.

     이제 화면을 열 때마다 history.pushState 로 한 칸씩 쌓는다.
     함수(open)는 직렬화할 수 없으므로 state 에는 id 만 넣고 실제 항목은 REG 에 둔다. */
  const REG = new Map();     // id → entry(open 함수 포함)
  let restoring = false;     // 히스토리 복원 중 — 이때의 push 는 다시 쌓지 않는다

  function apply(e) {
    if (!e || typeof e.open !== "function") return;
    restoring = true;
    try { e.open(); } finally { restoring = false; }
  }

  const V = {
    /* 화면 진입 시 호출. label 은 뒤로가기 툴팁에 쓴다. */
    push(entry) {
      if (!entry || !entry.id) return;
      REG.set(entry.id, entry);
      const cur = stack[stack.length - 1];
      if (cur && cur.id === entry.id) { stack[stack.length - 1] = entry; return; }
      stack.push(entry);
      ahead.length = 0;                    // 새 경로로 갈라지면 앞으로가기는 버린다
      // 복원 중이 아닐 때만 브라우저 히스토리에 한 칸 쌓는다.
      // (뒤로가기로 되돌아온 화면을 또 쌓으면 뒤로가기가 제자리를 맴돈다)
      if (!restoring && window.history && history.pushState) {
        try {
          history.pushState({ vid: entry.id }, "", "#" + encodeURIComponent(entry.id));
        } catch (err) { /* 파일 프로토콜 등에서 실패해도 화면은 계속 돈다 */ }
      }
      V.sync();
    },
    back() {
      // 브라우저 히스토리가 있으면 그쪽에 맡긴다 — 그래야 크롬 뒤로가기와 같은 길로 움직인다
      if (window.history && history.state && history.state.vid) { history.back(); return; }
      if (stack.length <= 1) return V.home();
      ahead.push(stack.pop());
      apply(stack[stack.length - 1]);
      V.sync();
    },
    forward() {
      if (window.history && ahead.length && history.length > 1) { history.forward(); return; }
      if (!ahead.length) return;
      const e = ahead.pop();
      stack.push(e);
      apply(e);
      V.sync();
    },
    home() {
      stack.length = 0; ahead.length = 0;
      if (!restoring && window.history && history.pushState) {
        try { history.pushState({ vid: null }, "", location.pathname + location.search); }
        catch (err) { /* 무시 */ }
      }
      // view-* 목록을 여기서 또 들고 있으면 새 화면이 생길 때마다 빠뜨린다
      // (실제로 view-nr 이 빠져 '처음으로' 후에도 남았다). showIntro 한 곳에 맡긴다.
      if (window.showIntro) window.showIntro();
      else {
        document.body.classList.remove("mode-results", "view-channel",
          "view-cafe", "view-cx", "view-af", "view-nr");
        window.scrollTo({ top: 0, behavior: "auto" });
      }
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
  /* 브라우저 뒤로/앞으로(크롬 버튼·Alt+←·마우스 4·5번 버튼) — 여기로 들어온다.
     Alt+← 를 가로채던 예전 코드는 뺐다. 이제 브라우저가 직접 popstate 를 주므로
     가로챌 이유가 없고, 가로채면 오히려 히스토리와 화면이 어긋난다. */
  window.addEventListener("popstate", (e) => {
    const id = e.state && e.state.vid;
    if (!id) {                      // 기점(메인)으로 돌아왔다
      stack.length = 0; ahead.length = 0;
      restoring = true;
      try { if (window.showIntro) window.showIntro(); } finally { restoring = false; }
      V.sync();
      return;
    }
    const entry = REG.get(id);
    if (!entry) {                   // 새로고침 뒤라 항목을 잃었다 — 메인으로 안전하게
      restoring = true;
      try { if (window.showIntro) window.showIntro(); } finally { restoring = false; }
      V.sync();
      return;
    }
    // 자체 스택도 히스토리 위치에 맞춰 되감는다(버튼 활성/비활성 표시가 어긋나지 않게)
    const at = stack.findIndex((x) => x.id === id);
    if (at >= 0) {
      while (stack.length - 1 > at) ahead.push(stack.pop());
    } else {
      const fwdAt = ahead.findIndex((x) => x.id === id);
      if (fwdAt >= 0) { stack.push(ahead.splice(fwdAt, 1)[0]); }
      else { stack.push(entry); }
    }
    apply(entry);
    V.sync();
  });

  /* 첫 진입 시 기점을 놓는다 — 이게 없으면 첫 뒤로가기가 사이트를 떠난다.

     **새로고침도 여기로 온다.** 그때 history.state 에 이전 화면 id 가 남아 있는데
     화면은 메인부터 그려지므로 둘이 어긋난다(실측: 해시 #cafe-analysis · 화면 메인).
     그 상태로 뒤로/앞으로를 누르면 엉뚱한 곳으로 간다.
     함수(open)는 직렬화할 수 없어 새로고침 뒤 화면을 되살릴 수 없으므로,
     **기점으로 되돌리고 해시도 지운다.** 새로고침하면 메인부터 시작한다. */
  if (window.history && history.replaceState) {
    try {
      history.replaceState({ vid: null }, "", location.pathname + location.search);
    } catch (err) { /* 파일 프로토콜 등에서 실패해도 화면은 계속 돈다 */ }
  }

  window.VNAV = V;
})();
