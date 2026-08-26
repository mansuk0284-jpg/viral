/* 매장 × 채널 교차 대시보드
   메인 좌측 "우리 매장 찾아보기"에서 매장을 고르면, 그 매장이 각 채널에서
   어떻게 바이럴되는지를 한 화면에 보여준다.
   - 다이렉트결혼준비: 실데이터(cafe-data.js)
   - 그 외 채널: 미수집 → '수집 대기'로 정직 표기(임의 수치 생성 금지) */
(function () {
  "use strict";
  const CD = window.CAFE_DATA || {};
  const MY = ["부산", "울산", "경남"];          // 우리 권역 — 항상 최상단
  const VF = window.VFACT || null;

  const fmtN = (n) => (n || 0).toLocaleString("ko-KR");
  const pct = (a, b) => (a + b > 0 ? Math.round((a / (a + b)) * 100) : 0);

  /* 화면 상태 — 매장 + 조회 기간(직접 입력). 기본은 전체 수집 구간 */
  const st = { name: null, range: null };
  const isCus = () => !!(st.range && VF);   // 라벨·해제버튼 표시용

  /* 기간 선택 — 채널별 현황과 **같은 모듈**을 쓴다(사용자 지시 2026-08-21:
     "어느 분석 페이지에서도 동일하게 반영되어야 해").
     화면마다 따로 만들면 라벨과 동작이 갈라진다. */
  let PER = null;
  function per() {
    if (PER || !window.VPER || !VF) return PER;
    const D = window.CAFE_DATA;
    const ms = (D && D.months ? D.months.map((m) => (Array.isArray(m) ? m[0] : m)) : []);
    PER = VPER.create({
      months: ms,
      onChange: () => {
        const r = PER.range();
        st.range = { a: r[0], b: r[1] };
        const host = document.getElementById("channelPanel");
        if (host) paint(host);
      },
    });
    if (PER) { const r = PER.range(); st.range = { a: r[0], b: r[1] }; }
    return PER;
  }
  const hasF = () => !!VF;
  /* 집계는 항상 팩트 한 경로로 — 기간을 지정하든 안 하든 같은 코드가 돈다 */
  const A = () => VF.agg(st.range ? st.range.a : VF.d0, st.range ? st.range.b : VF.d1);
  const cus = A;

  /* 채널 정의 — 히어로 타일과 동일한 축. 다이렉트만 실데이터 */
  const CHANNELS = [
    { key: "dagyeolun", name: "다이렉트결혼준비", sub: "네이버 카페 · 메인", cls: "cx-cafe", live: true },
    { key: "naver-review", name: "네이버 리뷰·예약", sub: "플레이스 방문자 평가", cls: "cx-nrev", live: true },
    // 채널별 현황과 **같은 자료**를 매장 축으로 본 것이다(사용자 지시 2026-08-23)
    { key: "jwedding", name: "제이웨딩", sub: "칭찬 · 혼수 선택이유", cls: "cx-jwed", live: true },
    { key: "naver-blog", name: "네이버 블로그", sub: "구매 후기글", cls: "cx-blog", live: true },
    { key: "busan-mom-cafe", name: "맘카페", sub: "지역 커뮤니티", cls: "cx-mom" },
    { key: "youtube", name: "유튜브", sub: "혼수 브이로그", cls: "cx-youtube", live: true },
    { key: "instagram", name: "인스타그램", sub: "매장 인스타 활동", cls: "cx-insta", live: true },
    { key: "ohou", name: "오늘의집", sub: "인테리어 앱", cls: "cx-ohou" },
  ];

  /* 지역별 매장 목록 — 우리 권역 먼저 */
  function storeGroups() {
    const S = CD.stores || {};
    const rgs = Object.keys(S);
    const mine = MY.filter((r) => rgs.indexOf(r) >= 0);
    const rest = rgs.filter((r) => MY.indexOf(r) < 0)
      .sort((a, b) => S[b].reduce((x, y) => x + y.s + y.l, 0) - S[a].reduce((x, y) => x + y.s + y.l, 0));
    return { mine, rest, S };
  }

  /* 매장 상세 조회(표기 차 흡수) */
  function pick(src, name) {
    if (!src) return null;
    if (src[name]) return src[name];
    const k = Object.keys(src).find((x) => name.indexOf(x) === 0 || x.indexOf(name) === 0);
    return k ? src[k] : null;
  }
  function storeRow(name) {
    const S = hasF() ? A().stores : (CD.stores || {});
    for (const rg of Object.keys(S)) {
      const hit = S[rg].find((x) => x.n === name);
      if (hit) return { rg, s: hit.s, l: hit.l };
    }
    // 그 기간에 표본이 없으면 지역만이라도 유지해 화면이 무너지지 않게 한다
    const ALL = CD.stores || {};
    for (const rg of Object.keys(ALL)) {
      if (ALL[rg].some((x) => x.n === name)) return { rg, s: 0, l: 0 };
    }
    return null;
  }
  /* 선택 기간의 매장 상세(품목·계약·후기 스타) — 지정 구간이면 팩트에서 계산 */
  function detailOf(name) {
    if (!hasF()) {
      return { items: (pick(CD.storeDetail, name) || {}).items || [],
               ext: pick(CD.extStore, name), mgr: pick(CD.mgrStore, name) };
    }
    const a = A();
    return { items: VF.top(a.storeItems[name], 1, 3),
             ext: a.ext.store[name] || null,
             mgr: a.mgrStore[name] || null };
  }
  /* 지역 내 매장 목록 — 순위·평균 계산용 */
  function siblings(rg) {
    const S = hasF() ? A().stores : (CD.stores || {});
    return (S[rg] || []).slice().sort((a, b) => (b.s + b.l) - (a.s + a.l));
  }

  /* ── 선택바 렌더 ── */
  function buildPicker() {
    const host = document.getElementById("storePick");
    if (!host) return;
    const { mine, rest, S } = storeGroups();
    const opt = (x) => `<option value="${x.n}">${x.n} (${fmtN(x.s + x.l)}건)</option>`;
    host.innerHTML =
      `<label class="sp-label" for="storeSel"><span class="sp-ic" aria-hidden="true">◎</span>우리 매장 찾아보기</label>` +
      `<div class="sp-row">` +
      `<select id="storeSel" class="sp-sel" aria-label="매장 선택">` +
      `<option value="">매장을 선택하세요</option>` +
      (mine.length ? `<optgroup label="⭐ 우리 권역 (부울경)">` +
        mine.map((rg) => S[rg].map(opt).join("")).join("") + `</optgroup>` : "") +
      rest.map((rg) => `<optgroup label="${rg}">${S[rg].map(opt).join("")}</optgroup>`).join("") +
      `</select>` +
      `<button type="button" class="sp-go" id="storeGo">보기</button>` +
      `</div>` +
      `<p class="sp-hint">매장을 고르면 <b>채널별 바이럴 현황</b>을 한 화면에서 봅니다</p>`;

    const go = () => {
      const v = document.getElementById("storeSel").value;
      if (v) openStoreScope(v);
    };
    document.getElementById("storeGo").addEventListener("click", go);
    document.getElementById("storeSel").addEventListener("change", go);
  }

  /* 네이버 플레이스 리뷰 — 매장명으로 찾아 카드에 요약을 싣는다 */
  function nrFind(name) {
    const NR = window.NAVER_REVIEW;
    if (!NR) return null;
    // 대시보드는 백화점 기준('신세계 센텀시티'), 플레이스는 상호 기준('삼성스토어 센텀')이라
    // 부분 일치로는 못 잇는다. 매핑표(deptMap)를 먼저 본다.
    const ks = Object.keys(NR.stores);
    const k = (NR.deptMap && NR.deptMap[name])
      || ks.find((x) => x === name)
      || ks.find((x) => NR.stores[x].query === name)
      || ks.find((x) => x.indexOf(name) >= 0 || name.indexOf(x) >= 0);
    return (k && NR.stores[k]) ? Object.assign({ key: k }, NR.stores[k]) : null;
  }
  function nrCard(ch, name) {
    const NR = window.NAVER_REVIEW, S = nrFind(name);
    if (!S) {
      return `<div class="cx-card ${ch.cls}"><div class="cx-head"><b>${ch.name}</b><span>${ch.sub}</span></div>` +
        `<div class="cx-empty"><em>미수집</em><span>이 매장은 아직 수집 전입니다</span></div></div>`;
    }
    // 같은 상권 경쟁 매장
    let vs = null;
    (NR.pairs || []).forEach((p) => {
      if (p[0] === S.key && NR.stores[p[1]]) vs = NR.stores[p[1]];
      else if (p[1] === S.key && NR.stores[p[0]]) vs = NR.stores[p[0]];
    });
    const book = S.rows.filter((r) => r[1] === "예약").length;
    const rate = S.rows.length ? Math.round(book / S.rows.length * 100) : 0;
    const tot = S.total + (vs ? vs.total : 0);
    const w = tot ? (S.total / tot * 100).toFixed(1) : 50;
    const win = vs && S.total > vs.total;
    return `<div class="cx-card cx-live ${ch.cls}" data-nrgo="${S.key}" title="눌러서 리뷰·예약 분석 보기">` +
      `<div class="cx-head"><b>${ch.name}</b><span>${ch.sub}</span><i class="cx-live-tag">실데이터</i></div>` +
      `<div class="cx-main">` +
      `<div class="cx-big"><b>${fmtN(S.total)}</b><span>리뷰</span></div>` +
      (vs ? `<div class="cx-vs"><span class="s">삼성 ${fmtN(S.total)}</span><span class="l">LG ${fmtN(vs.total)}</span></div>` +
            `<div class="cx-bar"><i class="s" style="width:${w}%"></i><i class="l" style="width:${100 - w}%"></i></div>` +
            `<div class="cx-sh ${win ? "s" : "l"}">${win ? "삼성 우위" : "LG 우위"}</div>`
          : `<div class="cx-sh">비교 매장 없음</div>`) +
      `</div>` +
      `<div class="cx-sub"><span class="cx-lb">예약경유</span>` +
      `<span class="cx-chip s">${fmtN(book)}건 · ${rate}% <em>추정</em></span></div>` +
      (S.keywords && S.keywords.length
        ? `<div class="cx-sub"><span class="cx-lb">칭찬</span>` +
          S.keywords.slice(0, 2).map((k) => `<span class="cx-chip">${k.k} ${fmtN(k.n)}</span>`).join("") + `</div>`
        : "") +
      `</div>`;
  }

  /* ── 채널 카드 ── */
  /* 제이웨딩 — 채널 화면과 같은 자료를 이 매장 것만 잘라 본다.
     두 화면이 어긋나면 안 되므로 window.JWEDDING 한 곳에서만 읽는다. */
  /* 유튜브 — 매장이 제목에 적히는 일이 드문 채널이다.
     그래서 카드에는 '이 매장 후기 수'가 아니라, 잡혔으면 잡힌 대로 보여주고
     없으면 **왜 없는지**를 적는다. 빈 칸에 0을 적으면 "후기가 없다"로 읽히는데
     사실은 "이 채널이 매장을 안 적는다" 이기 때문이다. */
  function ytCard(ch, name) {
    const Y = window.YOUTUBE;
    const v = Y && Y.stores ? (Y.stores[name] || pick(Y.stores, name)) : null;
    const head = `<div class="cx-head"><b>${ch.name}</b><span>${ch.sub}</span>` +
      `<i class="cx-live-tag">실데이터</i></div>`;
    if (!v || !v.n) {
      return `<div class="cx-card ${ch.cls}">${head}` +
        `<div class="cx-empty"><em>매장 언급 없음</em>` +
        `<span>영상 제목에 매장이 적히는 일은 드뭅니다 — 품목·브랜드 반응을 보는 채널입니다</span>` +
        `</div></div>`;
    }
    const tot = v.s + v.l, sh = pct(v.s, v.l);
    const lead = v.s > v.l ? "s" : v.l > v.s ? "l" : "even";
    return `<div class="cx-card cx-live ${ch.cls}">${head}` +
      `<div class="cx-main">` +
      `<div class="cx-big"><b>${fmtN(v.n)}</b><span>편</span></div>` +
      `<div class="cx-mini ${lead}"><b>${tot ? sh + "%" : "-"}</b><span>삼성 비중</span></div>` +
      `</div>` +
      (tot ? `<div class="cx-bar"><i class="s" style="width:${(v.s / tot * 100).toFixed(1)}%"></i>` +
        `<i class="l" style="width:${(v.l / tot * 100).toFixed(1)}%"></i></div>` : "") +
      `<div class="cx-sub"><span class="cx-lb">재생수</span>` +
      `<span class="cx-chip">${fmtN(v.views)}회</span></div>` +
      (v.top ? `<div class="cx-sub"><span class="cx-lb">대표 영상</span>` +
        `<span class="cx-chip">${v.top.t}</span></div>` : "") +
      `</div>`;
  }

  /* 인스타 — 매장명이 적힌 글은 대개 그 매장이 올린 홍보다(실측).
     그러니 이 카드는 '고객 후기 수'가 아니라 **그 매장의 인스타 활동**이다.
     우리가 올렸는지 경쟁이 올렸는지를 갈라 적어야 뜻이 통한다. */
  function igCard(ch, name) {
    const G = window.INSTAGRAM;
    const v = G && G.stores ? (G.stores[name] || pick(G.stores, name)) : null;
    const head = `<div class="cx-head"><b>${ch.name}</b><span>${ch.sub}</span>` +
      `<i class="cx-live-tag">실데이터</i></div>`;
    if (!v || !v.n) {
      return `<div class="cx-card ${ch.cls}">${head}` +
        `<div class="cx-empty"><em>이 채널에 흔적 없음</em>` +
        `<span>우리도 경쟁도 이 매장 이름으로 올린 글이 없습니다</span></div></div>`;
    }
    const ours = v.ours || 0, rival = v.rival || 0;
    const verdict = ours > rival ? { c: "s", t: "우리가 활동 중" }
      : rival > ours ? { c: "l", t: "경쟁만 활동 중" }
      : { c: "even", t: "주체 불명" };
    return `<div class="cx-card cx-live ${ch.cls}">${head}` +
      `<div class="cx-main">` +
      `<div class="cx-big"><b>${fmtN(v.n)}</b><span>건</span></div>` +
      `<div class="cx-mini ${verdict.c}"><b>${ours}<i>:</i>${rival}</b><span>우리:경쟁</span></div>` +
      `</div>` +
      `<div class="cx-sub"><span class="cx-lb">판정</span>` +
      `<span class="cx-chip ${rival > ours ? "warn" : ""}">${verdict.t}</span></div>` +
      (v.top ? `<div class="cx-sub"><span class="cx-lb">${v.top.biz ? "홍보 글" : "개인 글"}</span>` +
        `<span class="cx-chip">${v.top.t}</span></div>` : "") +
      `</div>`;
  }

  function jwCard(ch, name) {
    const J = window.JWEDDING;
    const v = J && J.stores ? (J.stores[name] || pick(J.stores, name)) : null;
    const head = `<div class="cx-head"><b>${ch.name}</b><span>${ch.sub}</span>` +
      `<i class="cx-live-tag">실데이터</i></div>`;
    if (!v || !(v.s + v.l)) {
      return `<div class="cx-card ${ch.cls}">${head}` +
        `<div class="cx-empty"><em>표본 없음</em><span>이 채널에는 이 매장 글이 없습니다</span></div></div>`;
    }
    const tot = v.s + v.l, sh = pct(v.s, v.l);
    const lead = v.s > v.l ? "s" : v.l > v.s ? "l" : "even";
    const star = (v.mgr || [])[0];
    return `<div class="cx-card cx-live ${ch.cls}">${head}` +
      `<div class="cx-main">` +
      `<div class="cx-big"><b>${fmtN(tot)}</b><span>건</span></div>` +
      `<div class="cx-mini ${lead}"><b>${sh}%</b><span>삼성 비중</span></div>` +
      `</div>` +
      `<div class="cx-bar"><i class="s" style="width:${(v.s / tot * 100).toFixed(1)}%"></i>` +
      `<i class="l" style="width:${(v.l / tot * 100).toFixed(1)}%"></i></div>` +
      (star ? `<div class="cx-sub"><span class="cx-lb">이름이 적힌 담당자</span>` +
        `<span class="cx-chip star">${star.n} ${fmtN(star.c)}건</span></div>` : "") +
      (v.last ? `<div class="cx-sub"><span class="cx-lb">최신 글</span>` +
        `<span class="cx-chip">${v.last}</span></div>` : "") +
      `</div>`;
  }

  /* 좌측 요약의 숫자를 문장으로 잇는다 — 순위·지역평균 편차·채널 공백.
     후기는 고객이 쓴다. 매니저가 할 수 있는 일은 요청·독려뿐이다(CLAUDE.md). */
  function insightLi(name, row, rank, diff, sib, rg) {
    const li = [];
    const tot = row ? row.s + row.l : 0;
    const sh = row ? pct(row.s, row.l) : 0;

    if (rank && sib.length) {
      const half = Math.ceil(sib.length / 2);
      // 편차 0p 는 적지 않는다 — "0p 높습니다" 는 아무 말도 아니다
      const dTxt = diff > 0 ? ` · 지역평균보다 <b>${diff}p 높습니다</b>`
        : diff < 0 ? ` · 지역평균보다 <b>${Math.abs(diff)}p 낮습니다</b>` : "";
      li.push(rank <= half
        ? `<li><b>${rg} ${sib.length}곳 중 ${rank}위</b>${dTxt} —` +
          ` 이 매장 방식이 <b>지역에서 통하고 있습니다</b>.</li>`
        : `<li class="warn-li"><b>${rg} ${sib.length}곳 중 ${rank}위</b>${dTxt} —` +
          ` 같은 지역 다른 매장은 되는데 여기서 안 되는 것이 있습니다.</li>`);
    }

    /* 표본이 열 건도 안 되면 퍼센트를 적지 않는다.
       9건으로 "삼성 100%" 라고 쓰면 한 건만 뒤집혀도 89% 가 된다 —
       회사 전체가 보는 화면에 없는 정밀도를 보이는 편이 더 나쁘다.
       (인스타 화면에 먼저 적용한 것과 같은 원칙) */
    if (tot >= 10 && sh < 50) {
      li.push(`<li class="warn-li">이 매장은 <b>LG가 ${100 - sh}%</b>로 앞섭니다` +
        ` (삼성 ${fmtN(row.s)} vs LG ${fmtN(row.l)}건).` +
        ` 같은 백화점 안에서 갈린 것이라 <b>상담 접점 차이</b>로 봐야 합니다.</li>`);
    } else if (tot >= 10) {
      li.push(`<li>삼성이 <b>${sh}%</b>로 앞섭니다 (${fmtN(row.s)} vs ${fmtN(row.l)}건).` +
        ` 이 우위는 <b>후기 요청이 이어질 때만</b> 유지됩니다.</li>`);
    } else if (tot) {
      li.push(`<li>표본이 <b>${fmtN(tot)}건</b>(삼성 ${fmtN(row.s)} · LG ${fmtN(row.l)})으로 적어` +
        ` <b>비율은 적지 않습니다</b>. 판단을 세우려면 후기 자체가 더 쌓여야 합니다 —` +
        ` 구매 고객에게 <b>후기 작성을 요청</b>하세요.</li>`);
    }

    // 채널 공백 — 어느 채널에 우리 흔적이 없는지
    const gaps = [];
    const J = window.JWEDDING, Y = window.YOUTUBE, G = window.INSTAGRAM;
    if (J && J.stores && !(J.stores[name] || pick(J.stores, name))) gaps.push("제이웨딩");
    if (G && G.stores && !(G.stores[name] || pick(G.stores, name))) gaps.push("인스타그램");
    if (gaps.length) {
      li.push(`<li><b>${gaps.join(" · ")}</b>에 이 매장 이름이 <b>한 번도 안 나옵니다</b> —` +
        ` 그 채널을 보는 고객에게는 이 매장이 <b>없는 것과 같습니다</b>.</li>`);
    }
    return li;
  }

  /* 네이버 블로그 — 채널 화면(blog-view)과 같은 자료(NBLOG.stores)를 매장 축으로.
     체험단 표기를 함께 보여준다(마케팅 물량과 고객 글을 갈라 읽게). */
  function blogCard(ch, name) {
    const NB = window.NBLOG;
    const v = NB && NB.stores ? (NB.stores[name] || pick(NB.stores, name)) : null;
    const head = `<div class="cx-head"><b>${ch.name}</b><span>${ch.sub}</span>` +
      `<i class="cx-live-tag">실데이터</i></div>`;
    if (!v || !v.n) {
      return `<div class="cx-card ${ch.cls}">${head}` +
        `<div class="cx-empty"><em>이 채널에 흔적 없음</em>` +
        `<span>블로그 검색에 이 매장 이름이 적힌 글이 없습니다</span></div></div>`;
    }
    const tot = v.s + v.l;
    const lead = v.s > v.l ? "s" : v.l > v.s ? "l" : "even";
    return `<div class="cx-card cx-live ${ch.cls}">${head}` +
      `<div class="cx-main">` +
      `<div class="cx-big"><b>${fmtN(v.n)}</b><span>건</span></div>` +
      `<div class="cx-mini ${lead}"><b>${fmtN(v.s)}<i>:</i>${fmtN(v.l)}</b><span>삼성:LG</span></div>` +
      `</div>` +
      (tot ? `<div class="cx-bar"><i class="s" style="width:${(v.s / tot * 100).toFixed(1)}%"></i>` +
        `<i class="l" style="width:${(v.l / tot * 100).toFixed(1)}%"></i></div>` : "") +
      (v.sp ? `<div class="cx-sub"><span class="cx-lb">체험단 표기</span>` +
        `<span class="cx-chip warn">${fmtN(v.sp)}건 — 마케팅 물량 포함</span></div>` : "") +
      (v.top ? `<div class="cx-sub"><span class="cx-lb">대표 글</span>` +
        `<span class="cx-chip">${v.top.t}</span></div>` : "") +
      `</div>`;
  }

  function channelCard(ch, name) {
    if (ch.key === "naver-review") return nrCard(ch, name);
    if (ch.key === "jwedding") return jwCard(ch, name);
    if (ch.key === "youtube") return ytCard(ch, name);
    if (ch.key === "instagram") return igCard(ch, name);
    if (ch.key === "naver-blog") return blogCard(ch, name);
    if (!ch.live) {
      return `<div class="cx-card cx-wait ${ch.cls}">` +
        `<div class="cx-head"><b>${ch.name}</b><span>${ch.sub}</span></div>` +
        `<div class="cx-empty"><em>수집 대기</em><span>이 채널은 아직 수집 전입니다</span></div>` +
        `</div>`;
    }
    const row = storeRow(name);
    if (!row) {
      return `<div class="cx-card ${ch.cls}"><div class="cx-head"><b>${ch.name}</b><span>${ch.sub}</span></div>` +
        `<div class="cx-empty"><em>표본 없음</em><span>이 매장 후기가 확인되지 않았습니다</span></div></div>`;
    }
    if (!(row.s + row.l)) {
      return `<div class="cx-card ${ch.cls}"><div class="cx-head"><b>${ch.name}</b><span>${ch.sub}</span></div>` +
        `<div class="cx-empty"><em>표본 없음</em><span>이 기간에는 후기가 없습니다</span></div></div>`;
    }
    const tot = row.s + row.l, sh = pct(row.s, row.l);
    const lead = row.s > row.l ? "s" : row.l > row.s ? "l" : "even";
    const D = detailOf(name);
    const ext = D.ext, mgr = D.mgr;
    const items = (D.items || []).slice(0, 3);
    const star = mgr && mgr.names && mgr.names.length ? mgr.names[0] : null;
    return `<div class="cx-card cx-live ${ch.cls}">` +
      `<div class="cx-head"><b>${ch.name}</b><span>${ch.sub}</span><i class="cx-live-tag">실데이터</i></div>` +
      `<div class="cx-main">` +
      `<div class="cx-big"><b>${fmtN(tot)}</b><span>건</span></div>` +
      `<div class="cx-vs"><span class="s">삼성 ${fmtN(row.s)}</span><span class="l">LG ${fmtN(row.l)}</span></div>` +
      `<div class="cx-bar"><i class="s" style="width:${tot ? (row.s / tot * 100).toFixed(1) : 50}%"></i>` +
      `<i class="l" style="width:${tot ? (row.l / tot * 100).toFixed(1) : 50}%"></i></div>` +
      `<div class="cx-sh ${lead}">삼성 ${sh}%</div>` +
      `</div>` +
      (items.length ? `<div class="cx-sub"><span class="cx-lb">품목</span>` +
        items.map((x) => `<span class="cx-chip ${x.s > x.l ? "s" : "l"}">${x.n} ${pct(x.s, x.l)}%</span>`).join("") +
        `</div>` : "") +
      (star ? `<div class="cx-sub"><span class="cx-lb">후기 스타</span>` +
        `<span class="cx-chip star">${star.n} ${fmtN(star.c)}건</span></div>` : "") +
      (ext ? `<div class="cx-sub"><span class="cx-lb">계약</span>` +
        `<span class="cx-chip">묶음 ${ext.pkgAvg}개</span>` +
        (ext.priceMid ? `<span class="cx-chip">중앙 ${fmtN(ext.priceMid)}만</span>` : "") +
        `<span class="cx-chip ${ext.negRate > 2 ? "l" : ""}">불만 ${ext.negRate}%</span></div>` : "") +
      `</div>`;
  }

  /* 기간 직접 입력 — 카페 분석 화면과 같은 조작 방식 */
  function rangeBox() {
    if (!VF) return "";
    const a = (st.range && st.range.a) || VF.d0;
    const b = (st.range && st.range.b) || VF.d1;
    return `<span class="ca-range${isCus() ? " on" : ""}">` +
      `<span class="car-lb">기간 직접 입력</span>` +
      `<input type="date" class="car-d" id="sxA" value="${a}" min="${VF.d0}" max="${VF.d1}" aria-label="시작일">` +
      `<i class="car-tilde">~</i>` +
      `<input type="date" class="car-d" id="sxB" value="${b}" min="${VF.d0}" max="${VF.d1}" aria-label="종료일">` +
      `<button type="button" class="car-go" id="sxGo">적용</button>` +
      (isCus() ? `<button type="button" class="car-off" id="sxOff" title="전체 기간으로">해제</button>` : "") +
      `</span>`;
  }


  /* 경쟁력 × 바이럴 — 두 축이 어긋나는 지점이 곧 할 일이다.
     상관은 r=+0.19 로 거의 없다(실측). "바이럴 잘 되면 경쟁력도 높다"는 성립하지 않는다.
     그래서 배수만 크게 띄우지 않고 **사분면 진단**으로 보여준다. */
  function compBlock(name) {
    const L = window.COMPETE_LINK, CO = window.COMPETE_OF && window.COMPETE_OF(name);
    if (!CO) return "";
    const p = window.COMPETE_PERIOD ? window.COMPETE_PERIOD(CO) : null;
    const v = p ? CO.p[p] : null;
    if (v == null) return "";
    const row = L && L.rows.find((r) => r.store === name);
    const g = v >= 1.3 ? ["win2", "크게 우세"] : v >= 1.0 ? ["win", "우세"]
            : v >= 0.8 ? ["even", "접전"] : ["lose", "열세"];
    const tip = row ? ({
      "말은 도는데 안 팔림": "후기는 도는데 매출이 안 따라옵니다 — 상담·재고·가격 점검",
      "잘 파는데 안 알려짐": "잘 파는데 온라인에 흔적이 적습니다 — 후기 유도가 비어 있습니다",
      "둘 다 강함": "바이럴·경쟁력이 함께 높습니다 — 이 방식을 다른 매장으로",
      "둘 다 약함": "두 축 모두 낮습니다 — 기본기부터",
    })[row.quad] : "";
    return `<div class="cx-comp ${g[0]}">` +
      `<span class="cxc-lb">경쟁력</span>` +
      `<b class="cxc-v">${window.CMP_PCT ? CMP_PCT(v) : Math.round(v * 100) + "%"}</b>` +
      `<i class="cxc-g">${g[1]}</i>` +
      (row ? `<span class="cxc-q">${row.quad}</span>` : "") +
      (tip ? `<span class="cxc-tip">${tip}</span>` : "") +
      `<span class="cxc-p">${p}</span></div>`;
  }

  /* ── 대시보드 렌더 ── */
  function render(name) {
    const row = storeRow(name);
    const rg = row ? row.rg : "";
    const isMine = MY.indexOf(rg) >= 0;
    const live = CHANNELS.filter((c) => c.live).length;
    const tot = row ? row.s + row.l : 0;
    const sh = row ? pct(row.s, row.l) : 0;
    // 지역 내 순위
    const sib = siblings(rg);
    const rank = sib.findIndex((x) => x.n === name) + 1;
    const agg = sib.reduce((o, x) => (o.s += x.s, o.l += x.l, o), { s: 0, l: 0 });
    const rSh = pct(agg.s, agg.l);
    const diff = sh - rSh;
    return `<div class="ca2 cx-wrap">` +
      `<div class="cx-top">` +
      `<div class="cx-title"><h2 data-store="${name}">${name}</h2>` +
      `<span>${rg}${isMine ? " · <b>우리 권역</b>" : ""} · 채널 ${CHANNELS.length}개 중 <b>${live}개</b> 수집 완료` +
      `${per() ? ` · <b>${per().label()}</b>` : ""}</span></div>` +
      (per() ? per().html() : "") +
      rangeBox() +
      `</div>` +
      `<div class="cx-body">` +
      `<div class="cx-left">` +
      `<div class="cx-sum">` +
      `<div class="cx-sum-h"><h3>전체 바이럴</h3><span>수집된 채널 합산</span></div>` +
      `<div class="cx-sum-n"><b>${fmtN(tot)}</b><i>건</i></div>` +
      `<div class="cx-bar big"><i class="s" style="width:${tot ? (row.s / tot * 100).toFixed(1) : 50}%"></i>` +
      `<i class="l" style="width:${tot ? (row.l / tot * 100).toFixed(1) : 50}%"></i></div>` +
      `<div class="cx-vs big"><span class="s">삼성 ${sh}%</span><span class="l">LG ${100 - sh}%</span></div>` +
      `<div class="cx-kpis">` +
      `<div><b>${rank || "-"}<i>위</i></b><span>${rg} 내</span></div>` +
      `<div class="${diff >= 0 ? "up" : "down"}"><b>${diff >= 0 ? "+" : ""}${diff}<i>p</i></b><span>지역평균 대비</span></div>` +
      `<div><b>${sib.length}<i>곳</i></b><span>${rg} 매장</span></div>` +
      `</div>` +
      compBlock(name) +
      /* 순위·편차를 뽑아만 두고 해석이 없었다(2026-08-24 점검).
         숫자 옆에 "그래서 무엇"이 없으면 매니저는 읽고 지나간다. */
      `<ul class="yt-act cx-act">${insightLi(name, row, rank, diff, sib, rg).join("")}</ul>` +
      `${isCus() ? `<p class="cx-note">표시 수치는 지정하신 기간만 잘라 집계한 값입니다.</p>` : ""}` +
      `</div></div>` +
      `<div class="cx-grid">${CHANNELS.map((c) => channelCard(c, name)).join("")}</div>` +
      `</div></div>`;
  }

  function paint(host) {
    host.innerHTML = render(st.name);
    if (window.VNAV) VNAV.sync();
    // 기간 칩 클릭 위임 — 화면을 다시 그릴 때마다 새 칩 묶음에 붙는다
    // (공유 컨테이너에 붙이면 다른 화면의 기간 클릭까지 가로챈다)
    if (per()) per().bind(host);
    const go = host.querySelector("#sxGo");
    if (go) go.addEventListener("click", () => {
      const A = host.querySelector("#sxA"), B = host.querySelector("#sxB");
      const r = VF.clamp(A && A.value, B && B.value);
      st.range = { a: r[0], b: r[1] };
      if (per()) per().setRange(r[0], r[1]);   // 칩 라벨도 같은 기간을 말하게
      else paint(host);
    });
    const off = host.querySelector("#sxOff");
    if (off) off.addEventListener("click", () => {
      if (per()) { per().setRange(null, null); const r = per().range(); st.range = { a: r[0], b: r[1] }; }
      else st.range = null;
      paint(host);
    });
    host.querySelectorAll("[data-nrgo]").forEach((el) => el.addEventListener("click", () => {
      const k = el.getAttribute("data-nrgo");
      if (k && typeof window.openNaverReview === "function") window.openNaverReview(k);
    }));
    host.querySelectorAll(".car-d").forEach((el) => el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); const g = host.querySelector("#sxGo"); if (g) g.click(); }
    }));
  }

  function openStoreScope(name) {
    const host = document.getElementById("channelPanel");
    const sec = document.getElementById("channel");
    if (!host || !sec) return;
    st.name = name;
    /* 기간을 **그리기 전에** 정한다. render 안에서 per()를 처음 부르면
       그때는 이미 집계가 끝난 뒤라 전체 기간으로 집계된다(실측: 8월인데 1,350건). */
    st.range = null;
    if (per()) { const r0 = per().range(); st.range = { a: r0[0], b: r0[1] }; }
    if (window.VNAV) VNAV.push({ id: "store:" + name, label: name, open: () => openStoreScope(name) });
    paint(host);
    sec.hidden = false;
    window.setView ? setView("view-channel", "view-cx") : document.body.classList.add("mode-results", "view-channel", "view-cx");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  window.openStoreScope = openStoreScope;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buildPicker);
  else buildPicker();
})();
