/* 네이버 플레이스 리뷰 추출 — naver_place_collect.py 가 page.evaluate 로 주입한다.
   DOM 기반이라 GraphQL 스키마가 바뀌어도 잘 버틴다. */
() => {
  const T = (e) => (e.innerText || "").replace(/\s+/g, " ").trim();
  const body = document.body.innerText;
  const num = (re) => { const m = body.match(re); return m ? +m[1].replace(/,/g, "") : null; };

  // 1) 칭찬 키워드 집계 — 네이버가 이미 세어 둔 정형 데이터
  const keywords = [];
  document.querySelectorAll("li").forEach((li) => {
    const m = T(li).match(/^"?([^"]{2,20})"?\s*이 키워드를 선택한 인원\s*([\d,]+)/);
    if (m) keywords.push({ k: m[1], n: +m[2].replace(/,/g, "") });
  });

  // 2) 리뷰 아이템
  // 방문일 표기가 두 가지다(실측):
  //   올해   "방문일 4.22.수 2026년 4월 22일"
  //   과거   "방문일 24.1.14.일 2024년 1월 14일"
  // 앞 숫자만 읽으면 '24.1' 을 24월 1일로 잘못 읽는다 → **뒤의 'YYYY년 M월 D일' 을 우선**한다.
  const items = [];
  document.querySelectorAll("li.place_apply_pui").forEach((li) => {
    const t = T(li);
    if (t.length < 30 || /이 키워드를 선택한 인원/.test(t)) return;

    const full = t.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    let y = null, mo = null, d = null;
    if (full) { y = +full[1]; mo = +full[2]; d = +full[3]; }
    else {
      const sh = t.match(/방문일\s*(?:(\d{2})\.)?(\d{1,2})\.(\d{1,2})\./);
      if (!sh) return;
      y = sh[1] ? 2000 + +sh[1] : null; mo = +sh[2]; d = +sh[3];
    }
    if (!mo || mo > 12 || !d || d > 31) return;      // 오파싱 방어

    const star = (t.match(/별점\s*(\d)\s*점/) || [])[1];
    const via = /인증 수단\s*예약/.test(t) ? "예약"
              : /인증 수단\s*영수증/.test(t) ? "영수증"
              : (t.match(/인증 수단\s*([^\s|]+)/) || [])[1] || null;
    const nth = (t.match(/(\d+)번째 방문/) || [])[1];

    // 본문 = 별점(또는 팔로우) 뒤 ~ 키워드/더보기 앞
    let txt = t.replace(/^.*?별점\s*\d\s*점\s*/, "");
    if (txt === t) txt = t.replace(/^.*?팔로우\s*/, "");
    txt = txt.replace(/\+?\d+\s*개의 리뷰가 더 있습니다.*$/, "")
             .replace(/(더보기|펼쳐보기|반응 남기기|방문일).*$/, "").trim();

    const tags = keywords.map((x) => x.k).filter((k) => t.includes(k));
    items.push({ star: star ? +star : null, y, mo, d, via,
                 nth: nth ? +nth : null, tags, text: txt.slice(0, 400) });
  });

  return {
    reviewTotal: num(/리뷰\s*([\d,]+)/),
    participants: num(/([\d,]+)명 참여/),
    keywords, items,
    hasMore: [...document.querySelectorAll("a,button")].some((e) => /더보기/.test(e.textContent)),
  };
}
