/* 이름을 줄이지 않고 전부 보여준다 (window.VFIT)

   사용자 지시(2026-08-21): "신세계센텀...과 같이 줄여표시하는 경우에는 실제 어디인지
   알 수 없는 경우도 있어. 틀이 고정된 경우 가로폭은 고정하고 글씨크기를 작게하는
   방법과 같은 수단으로 전체를 표시하도록 해줘."

   그래서 말줄임(…) 대신 **칸에 맞을 때까지 글자만 줄인다.** 폭은 건드리지 않는다
   — 폭을 늘리면 옆 칸이 밀려 레이아웃이 무너진다.
   하한(9.5px)을 두어 못 읽을 만큼 작아지지는 않게 한다. */
(function () {
  "use strict";
  const MIN = 9.5;          // 이보다 작아지면 읽을 수 없다
  const SEL = ".vfit, [data-fit], .rv-pick b, .rv-nm, .rv-store, .sv-title,"
    + " .cx-name, .nr-store, [data-store], .rv-row > b, .st-name,"
    + " .sc-k span, .sc-k em, .fc-mini span, .rv-kpis > div > span, .nk-s,"
    + " .ca-nkpi .nk-k, .sv-side span, .sv-mid span, .rv-big > span,"
    + " .mr-nm, .mr-top, .rv-name, .ch-nm, .cd-n, .yt-t, .yt-c";

  function fit(el) {
    if (!el || !el.isConnected) return;
    el.style.fontSize = "";                       // 기준 크기부터 다시 잰다
    const base = parseFloat(getComputedStyle(el).fontSize) || 12;
    let fs = base;
    // 한 번에 0.5px 씩 — 이분탐색은 반올림 때문에 오히려 덜 정확했다
    let guard = 40;
    while (el.scrollWidth > el.clientWidth + 0.5 && fs > MIN && guard-- > 0) {
      fs -= 0.5;
      el.style.fontSize = fs + "px";
    }
    // 여전히 넘치면 자간을 아주 조금 좁혀 마지막 한 글자를 넣는다
    el.style.letterSpacing = (el.scrollWidth > el.clientWidth + 0.5) ? "-.02em" : "";
    if (fs < base) el.title = el.title || el.textContent.trim();
  }

  function all(root) {
    (root || document).querySelectorAll(SEL).forEach(fit);
  }

  // 화면이 다시 그려질 때마다 자동 적용 — 화면마다 부르는 걸 잊으면 소용없다
  let timer = null;
  const mo = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => all(), 60);
  });

  function start() {
    const host = document.getElementById("channelPanel") || document.body;
    mo.observe(host, { childList: true, subtree: true });
    all();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
  window.addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(() => all(), 120); });

  window.VFIT = { fit: fit, all: all };
})();
