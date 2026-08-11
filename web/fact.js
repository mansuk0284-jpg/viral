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

  const M = (w) => (1 << w) - 1;
  const SH = F.sh, W = F.w;
  const MASK = { loc: M(W.loc), it: M(W.it), bn: M(W.bn), fl: M(W.fl) };
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
        const s = cells[i], k = s.indexOf("*");
        out[i] = k < 0 ? [parseInt(s, 16), 1]
                       : [parseInt(s.slice(0, k), 16), parseInt(s.slice(k + 1), 16)];
      }
      return out;
    });
    return PARSED;
  }

  const popcount = (n) => { let c = 0; while (n) { n &= n - 1; c++; } return c; };
  const pair = () => ({ s: 0, l: 0 });
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
      regions: {}, items: {}, benefit: {}, compare: pair(),
      stores: {},            // 지역 → [{n,s,l}]
      storeItems: {}, regionItems: {},
      storeBen: {}, regionBen: {},
      storeMon: {}, regionMon: {},        // 매장·지역별 월 추이
      storeCmp: {}, regionCmp: {},        // 매장·지역별 비교상담 승패
      mgr: { s_on: 0, l_on: 0, s_off: 0, l_off: 0 },
      mgrStore: {},
      months: [],
      ext: { store: {}, region: {} },
    };
    if (hi < lo) { cache.set(key, R); return R; }

    const stAcc = {};        // "지역|매장" → {s,l}
    const mon = {};          // YYYY-MM → [tot,s,l]
    const ex = (bag, k) => (bag[k] || (bag[k] = { tot: 0, pkg: 0, pkgN: 0, pkgBig: 0, neg: 0, price: [] }));

    for (let d = lo; d <= hi; d++) {
      const cells = rows[d];
      if (!cells) continue;
      const ym = toYmd(d).slice(0, 7);
      const mv = mon[ym] || (mon[ym] = [0, 0, 0]);
      for (let i = 0; i < cells.length; i++) {
        const v = cells[i][0], c = cells[i][1];
        const br = v & 1;
        const loc = (v >>> SH.loc) & MASK.loc;
        const im = (v >>> SH.it) & MASK.it;
        const bn = (v >>> SH.bn) & MASK.bn;
        const fl = (v >>> SH.fl) & MASK.fl;

        R.total += c;
        if (br) R.l += c; else R.s += c;
        mv[0] += c; mv[br ? 2 : 1] += c;

        const L = F.loc[loc];
        const rgN = L[0] >= 0 ? F.rg[L[0]] : null;      // 지역 축(본문 추정)
        const srgN = L[1] >= 0 ? F.rg[L[1]] : null;     // 매장이 속한 지역
        const stN = L[2] >= 0 ? F.st[L[2]] : null;

        if (rgN) {
          bump(R.regions, rgN, br, c);
          const rm = R.regionMon[rgN] || (R.regionMon[rgN] = {});
          rm[ym] = (rm[ym] || 0) + c;
        }
        if (stN) {
          bump(stAcc, srgN + "|" + stN, br, c);
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

    // 매장 목록을 지역별로 정리(기간 탭의 periodStores와 같은 모양)
    Object.keys(stAcc).forEach((kk) => {
      const p = kk.split("|"), rg = p[0], n = p[1], v = stAcc[kk];
      (R.stores[rg] || (R.stores[rg] = [])).push({ n: n, s: v.s, l: v.l });
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

  const label = (a, b) => a.replace(/-/g, ".") + " ~ " + b.replace(/-/g, ".");

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
