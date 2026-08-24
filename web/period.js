/* 기간 선택 공용 모듈 (window.VPER)

   사용자 지시(2026-08-21): "기간 탭은 매장별 현황에도 반영하고 기간 선택별 데이터 화면도
   채널별 현황과 동일한 로직으로 해줘. 이건 어느 분석 페이지에서도 동일하게 반영되어야 해."

   그동안 기간 UI 는 다이렉트웨딩(cafe-analysis) 안에만 있었고, 매장 대시보드는
   '직접 입력'만 있었다. 화면마다 따로 만들면 라벨과 동작이 갈라진다 —
   이 프로젝트에서 내비가 그렇게 갈라져 버튼이 겹쳤던 전례가 있다.

   쓰는 법:
     const P = VPER.create({ months: [...], onChange: fn });   // 화면마다 하나
     host.innerHTML = P.html();                                 // 칩 두 개 + 직접 입력
     P.bind(host);                                              // 클릭 위임
     P.range()  → [시작일, 종료일]  (팩트 집계에 그대로 넣는다)
     P.label()  → "2026년 8월"      (화면 표기)
*/
(function () {
  "use strict";

  const pad = (n) => String(n).padStart(2, "0");
  const lastDay = (y, m) => new Date(y, m, 0).getDate();

  function create(opt) {
    const months = (opt.months || []).slice().sort();   // ["2021-01", …]
    if (!months.length) return null;
    const years = Array.from(new Set(months.map((m) => m.slice(0, 4)))).sort();
    const lastM = months[months.length - 1];

    /* 첫 화면은 **현재 월**. 데이터에 이번 달이 아직 없으면 마지막 달로 물러선다. */
    const d = new Date();
    const nowKey = d.getFullYear() + "-" + pad(d.getMonth() + 1);
    const nowM = months.indexOf(nowKey) >= 0 ? nowKey : lastM;

    const st = { period: nowM, navY: nowM.slice(0, 4), range: null, rangeLab: "" };

    const isAll = () => st.period === "all";
    const curMonth = () => (/^\d{4}-\d\d$/.test(st.period) ? st.period : null);
    const curYear = () => (/^\d{4}$/.test(st.period) ? st.period : null);

    function label() {
      if (st.range) return st.rangeLab || (st.range[0] + " ~ " + st.range[1]);
      if (isAll()) return "전체";
      const m = curMonth();
      if (m) return m.slice(0, 4) + "년 " + (+m.slice(5)) + "월";
      return st.period + "년";
    }

    /* 집계에 넣을 [시작일, 종료일]. 기간 개념을 한 곳에서만 계산해야
       화면마다 다른 구간을 집계하는 사고가 안 난다. */
    function range() {
      if (st.range) return st.range.slice();
      if (isAll()) {
        const a = months[0], b = lastM;
        return [a + "-01", b + "-" + pad(lastDay(+b.slice(0, 4), +b.slice(5)))];
      }
      const m = curMonth();
      if (m) return [m + "-01", m + "-" + pad(lastDay(+m.slice(0, 4), +m.slice(5)))];
      const y = st.period;
      return [y + "-01-01", y + "-12-31"];
    }

    function html() {
      const y = st.navY || years[years.length - 1];
      const ms = months.filter((m) => m.slice(0, 4) === y);
      const yrOn = st.period === y, all = isAll(), cm = curMonth();
      const mLab = cm ? (+cm.slice(5)) + "월" : (all ? "월 선택" : "연간");

      const yrMenu = years.slice().reverse().map((v) =>
          `<button type="button" data-navy="${v}" class="${v === y ? "cur" : ""}">${v}년</button>`).join("")
        + `<button type="button" data-per="all" class="${all ? "cur" : ""}">전체 기간</button>`;
      const mMenu = `<button type="button" data-per="${y}" class="${yrOn ? "cur" : ""}">${y}년 전체</button>`
        + ms.map((m) => `<button type="button" data-per="${m}"` +
            ` class="${st.period === m ? "cur" : ""}">${+m.slice(5)}월</button>`).join("");

      return `<div class="ca-nav vper">` +
        `<span class="ca-yr${yrOn || all ? " on" : ""}" tabindex="0">` +
        `<button type="button" data-per="${y}" class="ca-yrb${yrOn ? " on" : ""}"` +
        ` title="${y}년 전체로 보기">${all ? "전체" : y}<i>▾</i></button>` +
        `<span class="ca-yrm">${yrMenu}</span></span>` +
        `<span class="ca-yr ca-mo${cm ? " on" : ""}" tabindex="0">` +
        `<button type="button" class="ca-yrb${cm ? " on" : ""}" title="월 고르기">${mLab}<i>▾</i></button>` +
        `<span class="ca-yrm ca-mom">${mMenu}</span></span>` +
        `</div>`;
    }

    /* 라벨을 단 기간 UI — 다이렉트웨딩과 같은 무게로 (2026-08-24 사용자 지적)
         "유투브, 인스타의 데이터 분석 페이지의 경우 기간 탭이 없는데
          다이렉트웨딩 페이지를 참고해서 기간 탭을 넣어줘"

       실은 있었다. 다만 html() 만 붙여 놓아 146px 짜리 칩 두 개가
       화면 오른쪽 끝에 붙어 있었고(실측 x=1265), 다이렉트웨딩은 366px 에
       현재 기간 라벨까지 달려 있었다 — 같은 기능인데 눈에 띄는 정도가 달랐다.
       그래서 **없는 것처럼 보였다.** 라벨을 붙여 무게를 맞춘다. */
    function bar() {
      return `<div class="ca-periodnav" tabindex="0">` +
        `<span class="cpn-cur">${label()}<i>기간 ▸</i></span>` +
        html() +
        `</div>`;
    }

    /* 클릭 위임 — **자기 칩 묶음에만** 단다.

       처음엔 host(#channelPanel)에 달았는데, 그 컨테이너는 모든 화면이 공유한다.
       제이웨딩이 리스너를 달아 두면 다이렉트웨딩 화면에서 기간을 눌러도
       제이웨딩의 onChange 가 발동해 **화면이 제이웨딩으로 바뀌어 버렸다**(실측).
       칩 묶음(.vper)은 화면을 다시 그릴 때마다 새로 생기므로 서로 섞이지 않는다. */
    function bind(host) {
      if (!host) return;
      const box = host.querySelector(".vper");
      if (!box || box.dataset.vperBound) return;
      box.dataset.vperBound = "1";
      box.addEventListener("click", (e) => {
        const ny = e.target.closest("button[data-navy]");
        if (ny) {
          const y2 = ny.getAttribute("data-navy");
          st.navY = y2;
          /* 연도를 골랐다는 건 그 해를 보겠다는 뜻이다. 목록만 갈아 끼우면
             칩은 2025 인데 보고 있는 건 2026년 3월이라 어긋나 보인다(실측). */
          const m = curMonth();
          if (m) {
            const want = y2 + "-" + m.slice(5);
            st.period = months.indexOf(want) >= 0 ? want
              : (months.filter((x) => x.slice(0, 4) === y2).slice(-1)[0] || y2);
          } else {
            st.period = y2;
          }
          st.range = null;
          fire(); return;
        }
        const pb = e.target.closest("button[data-per]");
        if (pb) {
          st.period = pb.getAttribute("data-per");
          if (/^\d{4}(-\d\d)?$/.test(st.period)) st.navY = st.period.slice(0, 4);
          st.range = null;
          fire(); return;
        }
      });
    }

    function fire() { if (typeof opt.onChange === "function") opt.onChange(api); }

    const api = {
      html: html, bar: bar, bind: bind, range: range, label: label,
      period: () => (st.range ? null : st.period),
      setRange(a, b) { st.range = (a && b) ? [a, b] : null; st.rangeLab = ""; fire(); },
      /* 표본이 작은 채널은 전체 기간으로 여는 게 맞다 — 현재 월로 열면
         "이게 다인가" 로 읽힌다. 처음 그리기 전에 부르므로 onChange 는 쏘지 않는다. */
      setAll() { st.period = "all"; st.range = null; st.rangeLab = ""; },
      /* 이름 있는 초기 구간(예: "최근 3개월") — 첫 그리기 전에 부르므로 fire 안 함.
         칩을 누르면 range 가 풀리며 평소 동작으로 돌아간다(2026-08-26, 유튜브). */
      setInit(a, b, lab) { st.range = [a, b]; st.rangeLab = lab || ""; },
      state: st,
    };
    return api;
  }

  window.VPER = { create: create };
})();
