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
      /* 꼬리를 통째로 갈아 끼운다. '센싱 N건' 뿐 아니라 '· 재생 N회' 같은 형태도
         있어서 마지막 '·' 뒤를 통으로 바꾸는 편이 확실하다(실측: 유튜브 툴팁에
         옛 값 '센싱 1건'이 남았다). */
      const cut = t.lastIndexOf("·");
      fig.setAttribute("title", (cut > 0 ? t.slice(0, cut + 1) + " " : t + " · ") + tail);
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

    /* 유튜브 — '넓은 채널에서 골라낸 편수'다. 유튜브 전체가 아니다.
       그래서 툴팁에 재생수를 함께 적어 규모를 오해하지 않게 한다. */
    const Y = window.YOUTUBE;
    if (Y) setTile(document.querySelector('[data-channel="youtube"]'), Y.total,
      Y.total + "편 · 재생 " + (Y.views || 0).toLocaleString("ko-KR") + "회");

    /* 인스타 — 유튜브와 같이 '넓은 채널에서 골라낸 건수'다.
       다만 절반 가까이가 판매자 홍보 글이라, 툴팁에 그 사실을 적는다.
       건수만 보면 '고객이 이만큼 말했다'로 읽히는데 사실이 아니다. */
    const G = window.INSTAGRAM;
    if (G) setTile(document.querySelector('[data-channel="instagram"]'), G.total,
      G.total + "건 · 개인 " + (G.personal ? G.personal.n : 0) + " / 판매자 홍보 "
      + (G.biz ? G.biz.n : 0));

    /* 네이버 블로그 — 2026-08-25 내부 분석 채널로 승격(collect_blog.py) */
    const NB = window.NBLOG;
    if (NB) setTile(document.querySelector('[data-channel="naver-blog"]'), NB.total,
      NB.total.toLocaleString("ko-KR") + "건 · 체험단 표기 " + (NB.sp || 0).toLocaleString("ko-KR") + "건");

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

  /* ── 채널 카드의 채널별 센싱기간·건수 요약(2026-08-26 사용자 지시) ──
     "각 채널별 센싱기간, 건수를 간단히 명시해줘."
     건수는 타일(data-count)에서, 기간은 각 채널 데이터의 월 목록에서 —
     둘 다 데이터가 원본이라 수집이 늘면 화면이 따라온다. 기간을 모르는
     채널은 기간 없이 건수만 적는다(지어내지 않는다). */
  function chList() {
    const ul = document.getElementById("apChList");
    if (!ul) return;
    const ym = (m) => "’" + m.slice(2, 4) + "." + m.slice(5, 7);
    const span = (arr, pick) => {
      if (!arr || !arr.length) return "";
      const a = pick ? pick(arr[0]) : arr[0], b = pick ? pick(arr[arr.length - 1]) : arr[arr.length - 1];
      return ym(a) + "~" + ym(b);
    };
    const PERIOD = {
      cafe: () => span(window.CAFE_DATA && CAFE_DATA.months, (r) => r[0]),
      jwedding: () => span(window.JWEDDING && JWEDDING.months, (r) => r[0]),
      youtube: () => { const s = span(window.YOUTUBE && YOUTUBE.months); return s ? s + " 근사" : ""; },
      instagram: () => span(window.INSTAGRAM && INSTAGRAM.months),
      "naver-blog": () => span(window.NBLOG && NBLOG.months),
    };
    const rows = [];
    document.querySelectorAll("#sourceMosaic .src").forEach((f) => {
      const name = (f.querySelector("figcaption b") || {}).textContent || "";
      const n = parseInt(f.getAttribute("data-count"), 10) || 0;
      const id = f.classList.contains("src-cafe") ? "cafe" : (f.getAttribute("data-channel") || "");
      const per = PERIOD[id] ? PERIOD[id]() : "";
      const unit = id === "youtube" ? "편" : "건";
      rows.push(`<li><b>${name}</b><i>${n.toLocaleString("ko-KR")}${unit}</i>` +
        (per ? `<em>${per}</em>` : `<em class="off">기간 집계 전</em>`) + `</li>`);
    });
    ul.innerHTML = rows.join("");
  }

  /* ── 매장 카드의 '’26 바이럴 최다 매장' TOP5(2026-08-26 사용자 지시) ──
     periodStores["2026"] (다이렉트웨딩 매장 매칭, 2026 누적)에서 상위 5개점.
     데이터가 원본 — 수집이 늘면 순위·건수가 따라온다. */
  function storeTop() {
    const box = document.getElementById("apStoreTop");
    const D = window.CAFE_DATA;
    if (!box || !D || !D.periodStores || !D.periodStores["2026"]) return;
    const rows = [];
    Object.keys(D.periodStores["2026"]).forEach((rg) => {
      (D.periodStores["2026"][rg] || []).forEach((v) => {
        rows.push({ n: v.n, t: (v.s || 0) + (v.l || 0) });
      });
    });
    rows.sort((a, b) => b.t - a.t);
    if (!rows.length) return;
    box.innerHTML = `<h4>’26 바이럴 최다 매장 <i>후기 건수</i></h4><ol>` +
      rows.slice(0, 5).map((x, i) =>
        `<li><i>${i + 1}</i><b>${x.n}</b><em>${x.t.toLocaleString("ko-KR")}건</em></li>`).join("") +
      `</ol>`;
  }

  const applyAll = function () { apply(); chList(); storeTop(); };

  // 데이터 스크립트보다 뒤에 실려야 한다. 혹시 앞서 실리더라도 DOM 준비 뒤 한 번 더.
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", applyAll);
  else applyAll();

  window.VTILES = { apply: apply };
})();
