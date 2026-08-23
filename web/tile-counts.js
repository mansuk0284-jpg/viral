/* 메인 타일 건수를 데이터에서 채운다 (하드코딩 금지)

   실측 문제(2026-08-21): 화면에 박힌 숫자가 데이터와 크게 어긋나 있었다.
     다이렉트결혼준비   화면 14,804  vs  데이터 72,413   ← 5배 차이
     네이버 리뷰·예약   화면  8,348  vs  데이터 17,974   ← 2배 차이
   수집을 늘릴 때마다 index.html 의 숫자를 손으로 고쳐야 했고, 그래서 안 고쳐졌다.
   회사 전체가 보는 첫 화면이라 숫자가 틀리면 안 된다.

   이제 데이터가 늘면 화면이 알아서 따라온다. 카운트업(data-count-to)이 돌기 전에
   값을 갈아 끼우므로 애니메이션도 새 숫자로 올라간다. */
(function () {
  "use strict";

  function cafeTotal() {
    const D = window.CAFE_DATA;
    return D && typeof D.total === "number" ? D.total : null;
  }

  function reviewRows() {
    const N = window.NAVER_REVIEW;
    if (!N || !N.stores) return null;
    let n = 0;
    Object.keys(N.stores).forEach((k) => { n += (N.stores[k].rows || []).length; });
    return n;
  }

  /* 타일 하나의 숫자를 바꾼다 — 배지·data 속성·툴팁을 함께 맞춘다.
     하나라도 빠뜨리면 눈에 보이는 값과 마우스를 올렸을 때 값이 달라진다. */
  function setTile(fig, n, extra) {
    if (!fig || n == null) return;
    const cur = fig.querySelector(".src-count i[data-count-to]");
    if (cur) { cur.setAttribute("data-count-to", String(n)); cur.textContent = "0"; }
    fig.setAttribute("data-count", String(n));
    // 툴팁도 같이 갈아야 한다. 눈에 보이는 값과 마우스 올렸을 때 값이 다르면 더 나쁘다
    // (실측: 배지는 17,974 인데 툴팁은 '56개 매장 8,348건' 이 그대로 남아 있었다).
    // 타일마다 문구가 달라 '숫자+건' 을 통째로 갈아 끼운다.
    const t = fig.getAttribute("title");
    if (t) {
      const tail = extra || ("센싱 " + n.toLocaleString("ko-KR") + "건");
      fig.setAttribute("title", t.replace(/(?:센싱\s*)?[\d,]+\s*개?\s*매장?\s*[\d,]*\s*건.*$/, tail));
    }
  }

  function apply() {
    const cafe = cafeTotal(), rev = reviewRows();

    setTile(document.querySelector(".src-lead.src-cafe"), cafe);

    /* 네이버 리뷰 타일은 이 줄에서 뺐다(2026-08-24) — 방문자 평가는 혼수 후기가 아니다.
       매장 대시보드에 그대로 있으므로 데이터는 계속 쓴다.
       혹시 타일이 다시 생기면 이 줄이 채워 준다. */
    const N = window.NAVER_REVIEW;
    const stores = N && N.stores ? Object.keys(N.stores).length : null;
    setTile(document.querySelector('[data-channel="naver-review"]'), rev,
      stores ? stores + "개 매장 " + (rev || 0).toLocaleString("ko-KR") + "건" : null);

    // 제이웨딩 — 혼수 채널이므로 이 줄에 든다
    const J = window.JWEDDING;
    if (J) setTile(document.querySelector('[data-channel="jwedding"]'), J.total);

    /* 히어로의 '누적 N건 센싱' — **이 줄에 있는 타일의 합**이다.
       네이버 리뷰를 뺀 뒤로는 혼수 채널만 세므로, 방문자 평가가 섞이지 않는다. */
    const tiles = document.querySelectorAll(".source-mosaic .src[data-count]");
    let sum = 0;
    tiles.forEach((f) => { sum += parseInt(f.getAttribute("data-count"), 10) || 0; });
    const hs = document.querySelector(".hs-num[data-count-to]");
    if (hs && sum > 0) { hs.setAttribute("data-count-to", String(sum)); hs.textContent = "0"; }

    /* 값을 갈아 끼웠으면 카운트업을 다시 돌린다.
       안 돌리면 방금 "0" 으로 만든 자리가 그대로 남는다(실측: 84,419 인데 화면엔 0). */
    if (typeof window.VCOUNTUP === "function") {
      try { window.VCOUNTUP(); } catch (e) { /* 애니메이션 실패해도 값은 아래에서 채운다 */ }
    }
    // 애니메이션이 어떤 이유로든 안 돌면 최종값이라도 보이게 한다
    setTimeout(function () {
      document.querySelectorAll("[data-count-to]").forEach(function (n) {
        const want = parseInt(n.getAttribute("data-count-to"), 10) || 0;
        if (want > 0 && n.textContent.trim() === "0") {
          n.textContent = want.toLocaleString("ko-KR");
        }
      });
    }, 2600);
  }

  // 데이터 스크립트보다 뒤에 실려야 한다. 혹시 앞서 실리더라도 DOM 준비 뒤 한 번 더.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();

  window.VTILES = { apply: apply };
})();
