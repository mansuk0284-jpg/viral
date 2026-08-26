/* 임의 기간 집계기 (window.VFACT)
   기간 탭(전체/연도/월)은 build_web_data.py가 미리 집계해 두지만, 사용자가 날짜를
   직접 지정하는 구간(예: 2025-03-15 ~ 2026-02-20)은 미리 만들 수 없다.
   그래서 후기 1건을 (일자·브랜드·위치·품목비트·혜택비트·플래그)로 압축한
   CAFE_DATA.fact 를 여기서 풀어, 고른 구간만 잘라 그때그때 합산한다.
   결과 모양은 byPeriod / periodStores / periodStoreItems 와 똑같이 맞춰
   화면 코드가 기간 탭과 구분 없이 그대로 쓰게 한다. */
(function () {
  "use strict";
  const CD = window.CAFE_DATA || {};
  const F = CD.fact;
  if (!F) { window.VFACT = null; return; }

  const SH = F.sh, W = F.w;
  // 패킹이 34비트라 JS 비트연산(32비트)으로는 못 푼다 → 2의 거듭제곱 나눗셈으로 뽑는다.
  const P2 = []; for (let i = 0; i <= 53; i++) P2[i] = Math.pow(2, i);
  const get = (v, sh, w) => Math.floor(v / P2[sh]) % P2[w];
  const DAY = 86400000;
  const base = Date.parse(F.d0 + "T00:00:00Z");

  const toIdx = (ymd) => Math.round((Date.parse(ymd + "T00:00:00Z") - base) / DAY);
  const toYmd = (i) => new Date(base + i * DAY).toISOString().slice(0, 10);

  /* 미리 파싱해 두면 구간을 바꿔도 문자열을 다시 쪼개지 않는다 */
  let PARSED = null;
  function parseAll() {
    if (PARSED) return PARSED;
    PARSED = F.rows.map((row) => {
      if (!row) return null;
      const cells = row.split(",");
      const out = new Array(cells.length);
      for (let i = 0; i < cells.length; i++) {
        /* 셀 형식: v[*건수][~조회수]. 건수 1이면 *가 없고, 조회수 0이면 ~가 없다.
           조회수(히트)는 후기 건수만큼 중요하다 — 한 건이 몇 명에게 읽혔는지가
           실제 노출량이라 건수만 세면 영향력을 놓친다(사용자 지시 2026-08-21). */
        const s = cells[i];
        const h = s.indexOf("~");
        const body = h < 0 ? s : s.slice(0, h);
        const hits = h < 0 ? 0 : parseInt(s.slice(h + 1), 16);
        const k = body.indexOf("*");
        out[i] = k < 0 ? [parseInt(body, 16), 1, hits]
                       : [parseInt(body.slice(0, k), 16), parseInt(body.slice(k + 1), 16), hits];
      }
      return out;
    });
    return PARSED;
  }

  const popcount = (n) => { let c = 0; while (n) { n &= n - 1; c++; } return c; };
  const pair = () => ({ s: 0, l: 0 });
  const pairH = () => ({ s: 0, l: 0, hs: 0, hl: 0 });   // 건수 + 조회수
  const bump = (o, k, br, c) => { (o[k] || (o[k] = pair()))[br ? "l" : "s"] += c; };

  const cache = new Map();

  /* a~b(포함) 구간 집계. 반환 모양은 기간 탭 데이터와 동일 */
  function agg(a, b) {
    const key = a + "~" + b;
    if (cache.has(key)) return cache.get(key);

    const rows = parseAll();
    const lo = Math.max(0, toIdx(a));
    const hi = Math.min(rows.length - 1, toIdx(b));
    const R = {
      from: a, to: b, days: Math.max(0, hi - lo + 1),
      total: 0, s: 0, l: 0,
      hits: 0, hitsS: 0, hitsL: 0,        // 조회수(히트) — 전체 / 삼성 / LG
      regionHits: {},                     // 지역 → {s,l} 조회수
      regions: {}, items: {}, benefit: {}, compare: pair(),
      stores: {},            // 지역 → [{n,s,l}]
      storeItems: {}, regionItems: {},
      storeBen: {}, regionBen: {},
      storeMon: {}, regionMon: {},        // 매장·지역별 월 추이
      storeCmp: {}, regionCmp: {},        // 매장·지역별 비교상담 승패
      retailers: {},                      // 유통 채널 언급(백화점·삼성스토어·하이마트·베스트샵)
      mgrNames: {},                       // 매장 → 매니저 실명 TOP(후기 스타)
      mgr: { s_on: 0, l_on: 0, s_off: 0, l_off: 0 },
      mgrStore: {},
      months: [],
      ext: { store: {}, region: {} },
    };
    if (hi < lo) { cache.set(key, R); return R; }

    const stAcc = {};        // "지역|매장" → {s,l}
    const stHits = {};       // "지역|매장" → {s,l} 조회수
    const mon = {};          // YYYY-MM → [tot,s,l]
    const ex = (bag, k) => (bag[k] || (bag[k] = { tot: 0, pkg: 0, pkgN: 0, pkgBig: 0, neg: 0, price: [] }));

    for (let d = lo; d <= hi; d++) {
      const cells = rows[d];
      if (!cells) continue;
      const ym = toYmd(d).slice(0, 7);
      const mv = mon[ym] || (mon[ym] = [0, 0, 0]);
      for (let i = 0; i < cells.length; i++) {
        const v = cells[i][0], c = cells[i][1], hv = cells[i][2] || 0;
        const br = get(v, SH.br, W.br);      // 0=삼성 1=LG 2=삼성·LG 동시언급
        const both = br === 2;
        const loc = get(v, SH.loc, W.loc);
        const im = get(v, SH.it, W.it);
        const bn = get(v, SH.bn, W.bn);
        const fl = get(v, SH.fl, W.fl);
        const rt = get(v, SH.rt, W.rt);

        R.total += c;
        R.hits += hv;
        mv[0] += c;
        // 유통 언급은 양쪽 후기도 포함(원본 retailers와 같은 기준)
        if (rt) {
          for (let k = 0; k < W.rt; k++) {
            if ((rt >>> k) & 1) R.retailers[F.rt[k]] = (R.retailers[F.rt[k]] || 0) + c;
          }
        }
        // 아래 브랜드 승패 축은 단독 언급만 — 양쪽 후기는 총건수·유통에만 반영
        if (both) continue;
        if (br) { R.l += c; R.hitsL += hv; } else { R.s += c; R.hitsS += hv; }
        mv[br ? 2 : 1] += c;

        const L = F.loc[loc];
        const rgN = L[0] >= 0 ? F.rg[L[0]] : null;      // 지역 축(본문 추정)
        const srgN = L[1] >= 0 ? F.rg[L[1]] : null;     // 매장이 속한 지역
        const stN = L[2] >= 0 ? F.st[L[2]] : null;

        if (rgN) {
          bump(R.regions, rgN, br, c);
          const rh = R.regionHits[rgN] || (R.regionHits[rgN] = { s: 0, l: 0 });
          rh[br ? "l" : "s"] += hv;
          const rm = R.regionMon[rgN] || (R.regionMon[rgN] = {});
          rm[ym] = (rm[ym] || 0) + c;
        }
        if (stN) {
          bump(stAcc, srgN + "|" + stN, br, c);
          const sh = stHits[srgN + "|" + stN] || (stHits[srgN + "|" + stN] = { s: 0, l: 0 });
          sh[br ? "l" : "s"] += hv;
          const sm = R.storeMon[stN] || (R.storeMon[stN] = {});
          sm[ym] = (sm[ym] || 0) + c;
        }

        const nItem = im ? popcount(im) : 0;
        if (im) {
          for (let k = 0; k < W.it; k++) {
            if ((im >>> k) & 1) {
              const nm = F.it[k];
              bump(R.items, nm, br, c);
              if (rgN) bump(R.regionItems[rgN] || (R.regionItems[rgN] = {}), nm, br, c);
              if (stN) bump(R.storeItems[stN] || (R.storeItems[stN] = {}), nm, br, c);
            }
          }
        }
        if (bn) {
          for (let k = 0; k < W.bn; k++) {
            if ((bn >>> k) & 1) {
              const nm = F.bn[k];
              bump(R.benefit, nm, br, c);
              if (rgN) bump(R.regionBen[rgN] || (R.regionBen[rgN] = {}), nm, br, c);
              if (stN) bump(R.storeBen[stN] || (R.storeBen[stN] = {}), nm, br, c);
            }
          }
        }
        if (fl & 1) {
          if (br) R.compare.l += c; else R.compare.s += c;
          if (rgN) bump(R.regionCmp, rgN, br, c);
          if (stN) bump(R.storeCmp, stN, br, c);
        }
        const hasMgr = !!(fl & 2), isNeg = !!(fl & 4);
        R.mgr[(br ? "l" : "s") + (hasMgr ? "_on" : "_off")] += c;
        if (hasMgr && stN) {
          const m = R.mgrStore[stN] || (R.mgrStore[stN] = { s: 0, l: 0, names: [] });
          m[br ? "l" : "s"] += c;
        }


        if (rgN) {
          const e = ex(R.ext.region, rgN);
          e.tot += c;
          if (nItem) { e.pkg += nItem * c; e.pkgN += c; if (nItem >= 4) e.pkgBig += c; }
          if (isNeg) e.neg += c;
        }
        if (stN) {
          const e = ex(R.ext.store, stN);
          e.tot += c;
          if (nItem) { e.pkg += nItem * c; e.pkgN += c; if (nItem >= 4) e.pkgBig += c; }
          if (isNeg) e.neg += c;
        }
      }
    }

    // 계약 금액(희소 목록)
    (F.pr || []).forEach((p) => {
      if (p[0] < lo || p[0] > hi) return;
      const L = F.loc[p[1]];
      if (L[0] >= 0) ex(R.ext.region, F.rg[L[0]]).price.push(p[2]);
      if (L[2] >= 0) ex(R.ext.store, F.st[L[2]]).price.push(p[2]);
    });

    // 후기 스타 — 매장 귀속 삼성 후기의 매니저 실명
    if (F.nmr) {
      const wd = F.nmw.day, wl = F.nmw.loc;
      const cnt = {};
      F.nmr.split(",").forEach((s) => {
        if (!s) return;
        const v = parseInt(s, 16);
        const d = get(v, 0, wd);
        if (d < lo || d > hi) return;
        const L = F.loc[get(v, wd, wl)];
        if (L[2] < 0) return;
        const stn = F.st[L[2]], nm = F.nm[Math.floor(v / P2[wd + wl])];
        const bag = cnt[stn] || (cnt[stn] = {});
        bag[nm] = (bag[nm] || 0) + 1;
      });
      Object.keys(cnt).forEach((stn) => {
        const top4 = Object.keys(cnt[stn]).map((n) => ({ n: n, c: cnt[stn][n] }))
          .sort((a, b) => b.c - a.c).slice(0, 4);
        R.mgrNames[stn] = top4;
        if (R.mgrStore[stn]) R.mgrStore[stn].names = top4;   // 매장 카드가 바로 쓰도록
      });
    }

    // 매장 목록을 지역별로 정리(기간 탭의 periodStores와 같은 모양)
    Object.keys(stAcc).forEach((kk) => {
      const p = kk.split("|"), rg = p[0], n = p[1], v = stAcc[kk];
      const _h = stHits[kk] || { s: 0, l: 0 };
      (R.stores[rg] || (R.stores[rg] = [])).push({ n: n, s: v.s, l: v.l, hs: _h.s, hl: _h.l });
    });
    Object.keys(R.stores).forEach((rg) => R.stores[rg].sort((x, y) => (y.s + y.l) - (x.s + x.l)));

    R.months = Object.keys(mon).sort().map((m) => [m, mon[m][0], mon[m][1], mon[m][2]]);

    // ext 마무리 — 기존 extStore/extRegion과 같은 필드로 환산
    [R.ext.store, R.ext.region].forEach((bag) => {
      Object.keys(bag).forEach((k) => {
        const e = bag[k], pr = e.price.sort((x, y) => x - y);
        e.pkgAvg = e.pkgN ? Math.round(e.pkg / e.pkgN * 10) / 10 : 0;
        e.negRate = e.tot ? Math.round(e.neg / e.tot * 1000) / 10 : 0;
        e.priceMid = pr.length ? pr[pr.length >> 1] : 0;
        e.priceN = pr.length;
      });
    });

    cache.set(key, R);
    return R;
  }

  /* 품목/혜택 맵 → 화면이 쓰는 [{n,s,l}] 상위 목록 */
  function top(map, minN, n) {
    if (!map) return [];
    return Object.keys(map).map((k) => ({ n: k, s: map[k].s, l: map[k].l }))
      .filter((x) => x.s + x.l >= (minN || 1))
      .sort((a, b) => (b.s + b.l) - (a.s + a.l)).slice(0, n || 6);
  }

  /* 기간 라벨 표기는 화면마다 같아야 한다 — 여기만 점(2026.03.01)을 쓰고
     나머지 화면은 하이픈이라 같은 기능이 다르게 보였다(2026-08-27 검수). */
  const label = (a, b) => a + " ~ " + b;

  /* storeDetail / regionDetail 과 같은 모양으로 변환 — 화면 코드를 그대로 쓰기 위함 */
  function detail(a, kind, key) {
    const S = kind === "store";
    const items = S ? a.storeItems[key] : a.regionItems[key];
    if (!items && !(S ? a.storeMon : a.regionMon)[key]) return null;
    const ben = (S ? a.storeBen : a.regionBen)[key] || {};
    const mon = (S ? a.storeMon : a.regionMon)[key] || {};
    return {
      items: top(items, S ? 3 : 5, 6),
      ben: Object.keys(ben).map((k) => ({ n: k, c: ben[k].s + ben[k].l }))
        .sort((x, y) => y.c - x.c).slice(0, 4),
      mon: Object.keys(mon).sort().slice(-12).map((m) => [m, mon[m]]),
      cmp: (S ? a.storeCmp : a.regionCmp)[key] || { s: 0, l: 0 },
    };
  }

  window.VFACT = {
    d0: F.d0, d1: F.d1,
    agg: agg, top: top, label: label, detail: detail,
    /* 입력 보정: 빈 값·역순·범위 밖을 데이터 구간 안으로 맞춘다 */
    clamp: function (a, b) {
      a = a || F.d0; b = b || F.d1;
      if (a > b) { const t = a; a = b; b = t; }
      if (a < F.d0) a = F.d0;
      if (b > F.d1) b = F.d1;
      return [a, b];
    },
  };
})();
