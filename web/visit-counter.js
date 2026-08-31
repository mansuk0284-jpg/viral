/* 접속자 카운터 — 메인 화면 좌측 하단(2026-08-27 사용자 지시).
 *
 * 이 사이트는 정적(GitHub Pages)이라 서버가 없다. 집계는 무료 공개 카운터
 * Abacus(https://abacus.jasoncameron.dev, 계정·키 불필요, CORS 허용)에 둔다.
 * - 세지는 것: **브라우저 세션당 1회**(sessionStorage 가드) — 새로고침·화면
 *   이동은 다시 세지 않는다. 그래서 라벨도 '접속'이지 '조회'가 아니다.
 * - 최신화: 45초마다 읽기 전용(get)으로 갱신 — 다른 사람이 들어오면
 *   보고 있는 화면의 숫자도 따라 올라간다.
 * - 서비스가 죽으면 칩을 숨긴다 — 지어낸 숫자를 띄우지 않는다.
 * - 개인정보는 아무것도 보내지 않는다(네임스페이스/키뿐).
 */
(function () {
  var NS = "mansuk0284viral", KEY = "visits";
  var BASE = "https://abacus.jasoncameron.dev";
  var chip = null, timer = null;

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  function ensureChip() {
    if (chip) return chip;
    chip = document.createElement("div");
    chip.id = "visitChip";
    chip.setAttribute("title", "브라우저 세션 기준 누적 접속 — 새로고침은 다시 세지 않습니다 (45초마다 자동 갱신, 2026-08-27 집계 시작)");
    chip.innerHTML = '<i aria-hidden="true"></i><span>누적 접속</span><b>—</b><em>회</em>' +
      '<u class="vi-since">2026.08.27부터</u>';
    /* 자리 = 메인 좌측 큰 영상(.hero-film) 바로 아래(2026-08-28 사용자 지시).
       그 구조가 없으면(예외적) 좌측 하단 떠 있는 칩으로 폴백한다. */
    var film = document.querySelector(".hero-lead .hero-film");
    if (film) film.insertAdjacentElement("afterend", chip);
    else { chip.classList.add("float"); document.body.appendChild(chip); }
    return chip;
  }

  function render(v) {
    if (v == null) return;
    var el = ensureChip().querySelector("b");
    if (el && el.textContent !== fmt(v)) {
      el.textContent = fmt(v);
      ensureChip().classList.add("tick");
      setTimeout(function () { chip && chip.classList.remove("tick"); }, 600);
    }
    ensureChip().classList.add("on");
  }

  function call(path) {
    return fetch(BASE + path, { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { return j && typeof j.value === "number" ? j.value : null; });
  }

  function refresh() {
    call("/get/" + NS + "/" + KEY).then(render).catch(function () {});
  }

  function start() {
    var seen = false;
    try { seen = !!sessionStorage.getItem("vi-visit"); } catch (e) {}
    var first = seen ? call("/get/" + NS + "/" + KEY)
                     : call("/hit/" + NS + "/" + KEY).then(function (v) {
                         try { sessionStorage.setItem("vi-visit", "1"); } catch (e) {}
                         return v;
                       });
    first.then(render).catch(function () { /* 서비스 불통 — 칩을 만들지 않는다 */ });
    timer = setInterval(refresh, 45000);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) refresh();          // 탭에 돌아오면 즉시 최신화
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
