/* 인스타그램 채널 화면 (window.openInstagram)

   인스타는 **넓은 채널**이다. 인스타 전체를 세는 게 아니라
   혼수 해시태그로 걸러 나온 글만 본다(사용자 지시 2026-08-24).

   이 채널의 성격이 유튜브·카페와 결정적으로 다르다:
   **절반 가까이가 판매자 홍보 글이다(실측 44/69).**
   매장·업체 호객 글을 고객 후기와 섞어 세면 '고객 반응'이 아니라
   '판매자 광고량'을 재게 된다. 그래서 협찬(#광고)과 별개로 홍보/개인을 갈라 놓았다.
   지우지는 않는다 — 광고를 표시만 하고 남기는 것과 같은 원칙.

   조회수는 없다. 대신 **좋아요**가 있다 — 처음엔 검색 격자만 긁어 날짜도 반응도
   없었지만, enrich_instagram.py 로 게시물을 하나씩 열어 게시일과 좋아요를 받아왔다
   (69건 중 날짜 69 · 좋아요 59). 그래서 유튜브처럼 기간과 순위를 세울 수 있다.
   좋아요를 감춘 계정이 10건 있는데, 그 글은 순위에서 빼고 **뺐다는 사실을 적는다.** */
(function () {
  "use strict";
  const G = window.INSTAGRAM || null;
  const fmtN = (n) => (n || 0).toLocaleString("ko-KR");
  const pct = (a, b) => (a + b === 0 ? 0 : Math.round((a / (a + b)) * 100));

  /* 받침에 따라 조사를 고른다 — "인덕션는" 같은 표기를 막는다 */
  function josa(w, withB, without) {
    const c = (w || "").charCodeAt((w || "").length - 1);
    if (c < 0xac00 || c > 0xd7a3) return without;
    return (c - 0xac00) % 28 ? withB : without;
  }

  /* 기간 — 다른 분석 화면과 같은 공용 모듈을 쓴다.
     화면마다 기간 고르는 법이 다르면 옮겨 다닐 때마다 다시 익혀야 한다
     (유튜브에서 전용 칩을 만들었다가 지적받고 되돌린 전례). */
  let PER = null;
  function per() {
    if (PER || !window.VPER || !G) return PER;
    PER = VPER.create({
      months: G.months || [],
      onChange: () => paint(document.getElementById("channelPanel")),
    });
    /* 첫 화면은 **최근 3개월** — 유튜브와 같은 문법(2026-08-26).
       지금 도는 이야기를 먼저 보여주고, 칩을 누르면 평소 동작으로 돌아간다. */
    if (PER) {
      const d = new Date();
      let y = d.getFullYear(), m = d.getMonth() + 1 - 2;
      while (m <= 0) { m += 12; y -= 1; }
      PER.setInit(`${y}-${String(m).padStart(2, "0")}-01`,
        d.toISOString().slice(0, 10), "최근 3개월");
    }
    return PER;
  }
  const labOf = () => (per() ? per().label() : "전체");

  function pickCur() {
    const p = per();
    if (!p) return (G.posts || []).slice();
    const r = p.range();
    const a = r[0].slice(0, 7), b = r[1].slice(0, 7);
    return (G.posts || []).filter((x) => x.ym && x.ym >= a && x.ym <= b);
  }

  function bar(s, l) {
    const t = s + l || 1;
    return `<div class="cx-bar"><i class="s" style="width:${(s / t * 100).toFixed(1)}%"></i>` +
      `<i class="l" style="width:${(l / t * 100).toFixed(1)}%"></i></div>`;
  }

  /* 좋아요 순위 — 유튜브 썸네일 카드와 같은 짜임(순위 크게, 한 줄에 하나).
     인스타는 썸네일을 id 로 바로 주지 않아(유튜브와 다르다) 그림 대신
     순위 숫자와 글 첫 줄로 세운다. 없는 이미지를 만들어 넣지 않는다. */
  function podium(list) {
    return list.slice(0, 3).map((x, i) => {
      const cls = x.b === "s" ? "s" : x.b === "l" ? "l" : "even";
      const tag = x.biz ? `<span class="yt-own lg">판매자</span>`
        : x.ad ? `<span class="yt-own spo">협찬</span>`
        : `<span class="yt-own cre">개인</span>`;
      return `<a class="igp ${cls}" href="${x.u}" target="_blank" rel="noopener"` +
        ` title="${x.t} · ${x.d} · 좋아요 ${fmtN(x.lk)}">` +
        `<span class="igp-rank">${i + 1}</span>` +
        `<span class="igp-mid"><b class="yt-t">${x.t}</b>` +
        `<em>${x.acc || "계정 미상"} · ${x.d}</em></span>` +
        `<span class="igp-v">${fmtN(x.lk)}<u>♥</u>${tag}</span></a>`;
    }).join("");
  }

  function render() {
    const cur = pickCur();
    const perList = cur.filter((x) => !x.biz);        // 개인 글
    const bizList = cur.filter((x) => x.biz);         // 판매자 홍보
    const adList = cur.filter((x) => x.ad);           // 협찬 표기
    const cnt = (g, side) => g.filter((x) => x.b === side).length;
    const P = { n: perList.length, s: cnt(perList, "s"), l: cnt(perList, "l") };
    const B = { n: bizList.length };
    const A = { n: adList.length };
    const sh = pct(P.s, P.l);
    const shAll = pct(cnt(cur, "s"), cnt(cur, "l"));
    const bizPct = cur.length ? Math.round(B.n / cur.length * 100) : 0;

    /* 좋아요가 있는 글만 순위에 올린다. 감춘 계정을 0으로 두면
       "반응이 없었다"로 읽히는데 사실은 "볼 수 없다"이다. */
    const liked = cur.filter((x) => x.lk != null).sort((a, b) => b.lk - a.lk);
    const hidden = cur.length - liked.length;
    const topLi = podium(liked);

    /* 품목도 고른 기간 안에서 다시 센다 — 전체 기간 수치를 그대로 두면
       기간을 바꿔도 품목 이야기만 그대로라 앞뒤가 어긋난다. */
    const ITc = {};
    cur.forEach((x) => {
      if (!x.it) return;
      const v = ITc[x.it] || (ITc[x.it] = { n: 0, s: 0, l: 0, biz: 0 });
      v.n++;
      if (x.b === "s") v.s++; else if (x.b === "l") v.l++;
      if (x.biz) v.biz++;
    });
    const itemLi = Object.keys(ITc)
      .sort((a, b) => ITc[b].n - ITc[a].n).slice(0, 4)
      .map((k) => {
        const v = ITc[k], ish = pct(v.s, v.l);
        return `<li class="it-row ${v.s >= v.l ? "s" : "l"}"><span class="it-n">${k}</span>` +
          `<span class="it-bar"><i style="width:${ish}%"></i></span>` +
          `<span class="it-v">${v.biz}<em>홍보</em></span>` +
          `<span class="it-c">${v.n}<em>건</em></span></li>`;
      }).join("");


    /* ── 현장 액션 ─────────────────────────────────────────────────
       사용자 지시(2026-08-24): "분석된 페이지는 인사이트가 있어야해.
       삼성스토어에서 참고할 만한 내용이 있어야 해."

       이 화면에 있던 문장은 전부 한계 고지였다 — "표본이 적습니다",
       "비율을 적지 않습니다". 필요한 말이지만 그것만 있으면
       매니저는 이 화면을 보고 할 일이 없다.

       인스타의 진짜 쓸모는 고객 목소리가 아니라 **경쟁 유통의 활동**이다.
       매장명이 적힌 글은 대개 그 매장이 올린 홍보이므로,
       누가 이 채널에서 움직이고 있는지가 그대로 보인다. */
    const ST = G.stores || {};
    const stk = Object.keys(ST);
    // 홍보 글이 있는 매장 = 인스타로 고객을 부르고 있는 곳.
    // 주체는 **상호**로만 가른다(ours/rival). 브랜드 언급으로 가르면 틀린다 —
    // 롯데 잠실 글은 "LG가전 BIG SALE" 인데 본문에 '삼성'이 스쳐서
    // 우리 쪽으로 잡혔었다(2026-08-24 실측).
    const active = stk.filter((k) => ST[k].biz > 0);
    const ourSide = active.filter((k) => (ST[k].ours || 0) > 0);
    const rivalSide = active.filter((k) => (ST[k].rival || 0) > 0 && !(ST[k].ours > 0));

    // 품목별로 홍보가 몰린 곳 — 경쟁이 광고비를 쓰는 품목(기간 반영)
    const IT = ITc;
    const pushed = Object.keys(IT).filter((k) => IT[k].n >= 5)
      .sort((a, b) => (IT[b].biz / IT[b].n) - (IT[a].biz / IT[a].n)).slice(0, 3);

    /* ── 종합 진단 — 보고서형 문어체(유튜브와 같은 문법, 2026-08-26).
       사실(수치) → 해석 → 시사점 순. 없는 사건을 지어내지 않는다. */
    const secs = [];
    // ① 게시 동향 — 누가 쓰는 채널인가
    secs.push(`<div class="cy-sec"><h5>게시 동향</h5><p class="cy-note">` +
      `선택 기간의 글은 <b>${cur.length}건</b>으로, 개인 글 <b>${P.n}건</b> · 판매자 홍보 <b class="warn">${B.n}건</b>(${bizPct}%)입니다. ` +
      (bizPct >= 50
        ? `절반 이상이 매장·업체가 올린 호객 글이라, 이 채널의 수치는 고객 여론이 아니라 <b>판매자 활동량</b>으로 읽는 것이 정확합니다.`
        : `개인 글이 절반을 넘어, 고객이 스스로 남기는 이야기가 이 기간의 중심입니다.`) + `</p></div>`);
    // ② 브랜드 반응 — 개인 글만, 소표본 가드
    secs.push(`<div class="cy-sec"><h5>브랜드 반응</h5><p class="cy-note">` +
      (P.s + P.l >= 10
        ? `브랜드가 갈리는 개인 글은 삼성 <b>${P.s}건</b> 대 LG <b class="warn">${P.l}건</b>(삼성 ${sh}%)입니다. ` +
          `판매자 홍보까지 합치면 ${shAll}% 로 달라집니다 — 고객이 말한 양과 파는 쪽이 뿌린 양은 다른 이야기입니다.`
        : `브랜드가 갈리는 개인 글이 <b>${P.s + P.l}건</b>뿐이라 비율 대신 건수로만 적습니다(삼성 ${P.s} : LG ${P.l}). ` +
          `여론을 재기엔 작은 표본이므로, 이 채널은 아래 경쟁 유통 활동을 보는 창으로 쓰는 것이 유효합니다.`) + `</p></div>`);
    // ③ 경쟁 유통 활동 — 인스타의 진짜 쓸모
    if (active.length) {
      let line = "";
      if (rivalSide.length) {
        line += `매장명이 적힌 글 가운데 <b class="warn">${rivalSide.length}곳</b>이 하이마트·LG가 올린 오픈·특가 홍보입니다` +
          `(${rivalSide.slice(0, 3).join(" · ")}${rivalSide.length > 3 ? " 외" : ""}) — 같은 상권에서 경쟁이 인스타로 고객을 부르고 있습니다. `;
      }
      line += ourSide.length
        ? `삼성스토어가 보이는 곳은 <b>${ourSide.join(" · ")}</b> ${ourSide.length}곳입니다 — 그 외 상권에는 이 채널에 우리 흔적이 없습니다.`
        : `삼성스토어가 올린 글은 <b class="warn">한 건도 잡히지 않았습니다</b> — 이 채널의 매장 홍보 지면을 경쟁이 단독으로 쓰고 있습니다.`;
      secs.push(`<div class="cy-sec"><h5>경쟁 유통 활동</h5><p class="cy-note">${line}</p></div>`);
    }
    // ④ 반응 상위 글의 성격
    if (liked.length >= 4) {
      const top4 = liked.slice(0, 4);
      const bizTop = top4.filter((x) => x.biz).length;
      secs.push(`<div class="cy-sec"><h5>반응 상위 글</h5><p class="cy-note">` +
        (bizTop >= 3
          ? `좋아요 상위 4건 중 <b class="warn">${bizTop}건이 판매자 글</b>입니다 — 이 기간 이 채널에서 도는 것은 고객 목소리가 아니라 광고입니다.`
          : `좋아요 상위 4건 중 <b>${4 - bizTop}건이 개인 글</b>입니다(1위 좋아요 ${fmtN(top4[0].lk)}). ` +
            `고객이 실제로 반응한 이야기이므로, 어떤 문구·품목이 반응을 얻는지 상담 화법에 참고할 수 있습니다.`) + `</p></div>`);
    }
    // ⑤ 품목 트렌드 — 경쟁이 미는 품목
    if (pushed.length) {
      secs.push(`<div class="cy-sec"><h5>품목 트렌드</h5><p class="cy-note">` +
        `홍보 글 비중이 가장 높은 품목은 <b class="warn">${pushed.join(" · ")}</b>입니다 — 경쟁이 광고 지면을 쓰고 있는 품목이므로, ` +
        `이 품목 상담에서는 가격 비교 질문이 먼저 들어올 가능성이 큽니다.</p></div>`);
    }

    // ⑥ 실행 제안 — 역할별(본사/영업팀/매장). 모든 분석 페이지의 표준 마무리.
    (function () {
      const hq = rivalSide.length
        ? `경쟁 유통이 <b class="warn">${rivalSide.length}곳</b> 상권에서 인스타로 고객을 부르고 있습니다 — <b>매장 계정 운영 가이드·공식 콘텐츠 킷</b> 지원이 필요합니다.`
        : `이 채널의 매장 홍보 지면이 비어 있습니다 — <b>매장 계정 운영 가이드</b>로 우리 지면을 만드는 것부터가 과제입니다.`;
      const team = pushed.length
        ? `<b class="warn">${pushed[0]}</b> 등 경쟁이 미는 품목의 <b>행사 시점을 모니터링</b>해 상권별 대응 <b>판촉</b>을 검토하세요.`
        : `경쟁 매장의 오픈·특가 게시 시점을 모니터링해 상권별 대응 <b>판촉</b>을 검토하세요.`;
      const store = `매장 계정 게시를 정례화하고, 구매 고객에게 <b>매장 태그와 함께 후기 게시</b>를 요청하세요.`;
      secs.push(`<div class="cy-sec"><h5>실행 제안 <i>역할별</i></h5><ul class="role-plan">` +
        `<li class="rp-hq"><em>본사</em><span>${hq}</span></li>` +
        `<li class="rp-team"><em>영업팀</em><span>${team}</span></li>` +
        `<li class="rp-store"><em>매장</em><span>${store}</span></li>` +
        `</ul></div>`);
    })();

    /* ── 좌측 트렌드 요약 — 유튜브와 같은 불릿 문법 */
    const NEW_RE = /신제품|신모델|신형|출시|오픈|그랜드오픈|감사제|페스타|세일|혜택|할인|행사|이벤트/;
    const bullets = [];
    if (liked.length) {
      const t0 = liked[0];
      bullets.push(`${t0.biz ? "판매자" : "개인"} 글 ‘${(t0.t || "").slice(0, 22)}…’${t0.acc ? `(${t0.acc})` : ""}이 좋아요 <b>${fmtN(t0.lk)}</b>로 반응 1위입니다.`);
      const c0 = liked.find((x) => !x.biz);
      if (c0 && liked[0].biz) bullets.push(`개인 글 중에서는 ‘${(c0.t || "").slice(0, 20)}…’(♥${fmtN(c0.lk)})의 반응이 가장 큽니다.`);
    }
    const nv = cur.filter((x) => NEW_RE.test(x.t || "")).length;
    if (nv) bullets.push(`신모델·행사(오픈·특가) 언급 글이 <b>${nv}건</b> 있습니다 — 대부분 판매자 홍보로, 경쟁 유통의 행사 시점을 읽을 수 있습니다.`);
    if (rivalSide.length) bullets.push(`하이마트·LG 매장 홍보가 <b class="warn">${rivalSide.length}곳</b>에서 잡힙니다 — 경쟁이 지금 인스타로 고객을 부르는 상권입니다.`);
    const hot = Object.keys(ITc).sort((a, b) => ITc[b].n - ITc[a].n).slice(0, 3);
    if (hot.length) bullets.push(`언급 상위 품목은 <b>${hot.join(" · ")}</b> 순입니다.`);
    const trendBlock = bullets.length
      ? `<div class="yt-trend"><h4>이 기간 인스타 트렌드</h4>` +
        `<ul>${bullets.slice(0, 4).map((b) => `<li>${b}</li>`).join("")}</ul></div>`
      : "";

    return `<div class="ca2 yt-wrap">` +
      `<div class="cx-top">` +
      `${window.VICON ? VICON.html("instagram", "인스타그램") : ""}` +
      `<div class="cx-title"><h2>인스타그램</h2>` +
      `<span>넓은 채널에서 혼수가전만 골라 봤습니다 · 글 ${fmtN(G.total)}건</span></div>` +
      `${per() ? per().bar() : ""}` +
      `</div>` +

      `<div class="cx-body">` +
      `<div class="cx-left">` +
      `<div class="cx-sum">` +
      `<div class="cx-sum-h"><h3>누가 쓴 글인가</h3><span>${labOf()} · ${cur.length}건</span></div>` +
      `<div class="cx-sum-n"><b>${fmtN(cur.length)}</b><i>건</i></div>` +

      /* 이 채널에서 가장 먼저 알아야 할 사실 — 절반이 파는 쪽 글이다 */
      `<div class="yt-split">` +
      `<div class="ys-k"><b>${P.n}</b><span>개인 글</span></div>` +
      `<div class="ys-k ad"><b>${B.n}</b><span>판매자 홍보</span></div>` +
      `</div>` +
      `<p class="yt-note">글의 <b>${bizPct}%</b>가 매장·업체가 올린 호객 글입니다` +
      (A.n ? ` (그와 별개로 협찬 표기 ${A.n}건)` : "") +
      `. 아래 브랜드 비교는 <b>개인 글만</b> 셌습니다.</p>` +

      /* 표본이 열 건도 안 되면 퍼센트를 말하지 않는다.
         개인 글 중 브랜드가 갈리는 건 단 5건(삼성 3 · LG 2)이다(실측).
         이걸 '60%'로 적으면 한 사람 마음이 바뀌는 것만으로 20%가 움직인다.
         회사 전체가 보는 화면이라, 없는 정밀도를 보이는 편이 더 나쁘다. */
      (P.s + P.l >= 10
        ? bar(P.s, P.l) +
          `<div class="cx-vs"><span class="s">삼성 ${P.s}건 <b>${sh}%</b></span>` +
          `<span class="l">LG ${P.l}건 <b>${100 - sh}%</b></span></div>` +
          `<p class="yt-note">홍보까지 넣으면 <b>${shAll}% : ${100 - shAll}%</b>로 달라집니다 — ` +
          `고객이 말한 양과 파는 쪽이 뿌린 양은 다른 이야기입니다.</p>`
        : `<div class="cx-vs thin"><span class="s">삼성 <b>${P.s}</b>건</span>` +
          `<span class="l">LG <b>${P.l}</b>건</span></div>` +
          `<p class="yt-note"><b>비율을 적지 않습니다.</b> 개인 글 중 브랜드가 갈리는 건 ` +
          `${P.s + P.l}건뿐입니다 — 한 사람 마음이 바뀌면 퍼센트가 크게 흔들리는 표본입니다. ` +
          `판매자 홍보까지 넣어도 삼성 ${cnt(cur, "s")} · LG ${cnt(cur, "l")}건입니다.</p>`) +
      trendBlock +
      `<p class="jw-note">게시일과 좋아요는 게시물을 하나씩 열어 받아온 값입니다` + `${hidden ? ` · 좋아요를 감춘 <b>${hidden}건</b>은 순위에서 뺐습니다` : ""}` + `. ${G.note}</p>` +
      `</div></div>` +

      /* 우측 — 유튜브와 같은 문법: 카테고리별 순위 카드 + 종합 진단.
         반응 순위를 **개인 / 판매자**로 갈라 각각 1~3위(같은 좋아요라도 뜻이 다르다).
         기간 안에 없으면 전체 기간 상위를 보여주되 그 사실을 밝힌다. */
      `<div class="cx-right">` +
      (function () {
        const allLiked = (G.posts || []).filter((x) => x.lk != null).sort((a, b) => b.lk - a.lk);
        const rankCard = (title, list, fullList) => {
          const use = list.length ? list : fullList;
          const note = list.length ? ""
            : `<p class="ca-splx">이 기간에는 해당 글이 없어 <b>전체 기간 상위</b>를 보여줍니다.</p>`;
          return `<div class="ca-ncard">` +
            `<h4 class="ca-ch">${title} <i class="ca-tag">좋아요 순 · 클릭 → 원문</i></h4>` + note +
            (use.length ? `<div class="yt-podium">${podium(use)}</div>`
              : `<p class="fc-plain">좋아요를 볼 수 있는 글이 없습니다.</p>`) +
            `</div>`;
        };
        return rankCard("반응 큰 글 — 개인", liked.filter((x) => !x.biz), allLiked.filter((x) => !x.biz)) +
          rankCard("반응 큰 글 — 판매자·홍보", liked.filter((x) => x.biz), allLiked.filter((x) => x.biz));
      })() +
      `<div class="ca-ncard">` +
      `<h4 class="ca-ch">품목 <i class="ca-tag">건수 순 · 홍보 몇 건인지 함께</i></h4>` +
      (itemLi ? `<ul class="it-list">${itemLi}</ul>`
              : `<p class="fc-plain">품목이 특정된 글이 적습니다.</p>`) +
      `</div>` +
      `<div class="ca-ncard yt-rep">` +
      `<h4 class="ca-ch">종합 진단 <i class="ca-tag">${labOf()}</i></h4>` +
      secs.join("") +
      `</div>` +
      `</div></div></div>`;
  }

  function paint(host) {
    if (!host || !G) return;
    host.innerHTML = render();
    if (window.VNAV) VNAV.sync();
    if (window.VFIT) VFIT.all();
    if (per()) per().bind(host);   // MutationObserver 가 놓치는 첫 그림을 맞춘다
  }

  window.openInstagram = function () {
    const host = document.getElementById("channelPanel");
    const sec = document.getElementById("channel");
    if (!host || !sec || !G) return;
    if (window.VNAV) VNAV.push({ id: "instagram", label: "인스타그램", open: () => window.openInstagram() });
    paint(host);
    sec.hidden = false;
    window.setView ? setView("view-channel", "view-cx")
      : document.body.classList.add("mode-results", "view-channel", "view-cx");
    window.scrollTo({ top: 0, behavior: "auto" });
  };
})();
