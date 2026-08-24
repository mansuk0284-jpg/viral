/* 채널 아이콘 한 곳에 (window.VICON) — build 아님, 손으로 고쳐도 된다

   사용자 지시(2026-08-24): "다이렉트웨딩을 보면 카페 아이콘을 사용하여 분석페이지
   상단에 표시하고 있어. 다른 채널 페이지도 이와 같이 채널 아이콘을 넣어줘"

   타일(index.html)과 분석 화면 머리글이 **같은 그림**을 써야 한다.
   각자 따로 그리면 한쪽만 바뀌어 같은 채널이 두 얼굴을 갖게 된다.
   여기 한 곳에 두고 양쪽이 가져다 쓴다. */
(function () {
  "use strict";
  const SVG = {
    "jwedding": "<svg viewBox=\"0 0 40 40\" fill=\"none\"><text x=\"20\" y=\"25\" text-anchor=\"middle\" fill=\"#fff\" font-family=\"Georgia,serif\" font-style=\"italic\" font-size=\"19\" font-weight=\"700\">J</text><text x=\"20\" y=\"34\" text-anchor=\"middle\" fill=\"#fff\" font-family=\"Arial,sans-serif\" font-size=\"7.5\" font-weight=\"800\" letter-spacing=\"-0.2\">WEDDING</text></svg>",
    "naver-blog": "<svg viewBox=\"0 0 24 24\" fill=\"none\"><path d=\"M6 4h8l4 4v12H6V4Z\" fill=\"#fff\"/><path d=\"M14 4v4h4\" fill=\"#1ec800\"/><rect x=\"8.5\" y=\"11\" width=\"7\" height=\"1.6\" rx=\"0.8\" fill=\"#1ec800\"/><rect x=\"8.5\" y=\"14\" width=\"7\" height=\"1.6\" rx=\"0.8\" fill=\"#1ec800\"/></svg>",
    "busan-mom-cafe": "<svg viewBox=\"0 0 24 24\" fill=\"none\"><path d=\"M12 5C7.6 5 4 7.9 4 11.4c0 2.2 1.5 4.2 3.7 5.3-.2.6-.6 2-.7 2.3 0 .2.1.4.4.2.3-.2 2.3-1.6 3.1-2.2.5.1 1 .1 1.5.1 4.4 0 8-2.9 8-6.4S16.4 5 12 5Z\" fill=\"#fff\"/><circle cx=\"9.2\" cy=\"11.3\" r=\"1.15\" fill=\"#03C75A\"/><circle cx=\"12\" cy=\"11.3\" r=\"1.15\" fill=\"#03C75A\"/><circle cx=\"14.8\" cy=\"11.3\" r=\"1.15\" fill=\"#03C75A\"/></svg>",
    "youtube": "<svg viewBox=\"0 0 24 24\" fill=\"none\"><rect x=\"3\" y=\"6\" width=\"18\" height=\"12\" rx=\"3.5\" fill=\"#fff\"/><path d=\"M10.5 9.2 15 12l-4.5 2.8V9.2Z\" fill=\"#FF0000\"/></svg>",
    "ohou": "<svg viewBox=\"0 0 24 24\" fill=\"none\"><path d=\"M12 3.5 4 10v9.5h5.5V14h5v5.5H20V10l-8-6.5Z\" fill=\"#fff\"/></svg>",
    "instagram": "<svg viewBox=\"0 0 24 24\" fill=\"none\"><rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"5\" stroke=\"#fff\" stroke-width=\"2\"/><circle cx=\"12\" cy=\"12\" r=\"3.6\" stroke=\"#fff\" stroke-width=\"2\"/><circle cx=\"16.6\" cy=\"7.4\" r=\"1.1\" fill=\"#fff\"/></svg>",
    "dagyeolun": "<svg viewBox=\"0 0 40 40\" fill=\"none\"><text x=\"20\" y=\"18.5\" text-anchor=\"middle\" fill=\"#fff\" font-family=\"Arial Black,Arial,sans-serif\" font-size=\"10.5\" font-weight=\"900\" letter-spacing=\"-0.6\">DIRECT</text><text x=\"21\" y=\"29.5\" text-anchor=\"middle\" fill=\"#fff\" font-family=\"Georgia,serif\" font-style=\"italic\" font-size=\"9.5\">Wedding</text></svg>"
  };
  const CLS = {
    "jwedding": "src-jwed",
    "naver-blog": "src-blog",
    "busan-mom-cafe": "src-mom",
    "youtube": "src-youtube",
    "ohou": "src-ohou",
    "instagram": "src-insta",
    "dagyeolun": "src-cafe"
  };

  /* 분석 화면 머리글에 넣을 아이콘 한 조각.
     다이렉트웨딩이 쓰던 .ca-ic 와 같은 모양·크기로 맞춘다. */
  function html(key, title) {
    const svg = SVG[key];
    if (!svg) return "";
    return `<span class="ca-ic ${CLS[key] || ""}" title="${title || ""}">${svg}</span>`;
  }

  window.VICON = { html: html, svg: (k) => SVG[k] || "", cls: (k) => CLS[k] || "" };
})();
