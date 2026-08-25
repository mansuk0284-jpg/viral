/* region-art.js — 지역 대표 명소 · 백화점 체인 미니멀 라인 일러스트 (직접 작도 SVG)
 * 저작권 안전: 인터넷 사진·로고를 쓰지 않고 실루엣을 직접 그렸다. 로고 모방 없음(건물 형태로만 구분).
 * 규격: viewBox 0 0 48 48, stroke=currentColor, fill none, stroke-width 2 안팎, aria-hidden.
 * 사용: window.VART.region["부산"] / window.VART.chain["롯데"] → innerHTML 로 삽입.
 */
(function () {
  function svg(inner) {
    return '<svg viewBox="0 0 48 48" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + "</svg>";
  }

  var region = {
    /* 서울 — N서울타워(남산): 산 능선 위 전망대 타워 */
    "서울": svg(
      '<path d="M4 44 Q24 33 44 44"/>' +
      '<path d="M24 4 V10"/>' +
      '<rect x="17" y="10" width="14" height="7" rx="3.5"/>' +
      '<path d="M21 17 L19 36 M27 17 L29 36"/>' +
      '<path d="M20 23 H28 M19 29 H29"/>'
    ),
    /* 부산 — 광안대교: 현수교 주탑 2·케이블·물결 */
    "부산": svg(
      '<path d="M3 32 H45"/>' +
      '<path d="M13 32 V14 M35 32 V14"/>' +
      '<path d="M13 14 Q24 26 35 14"/>' +
      '<path d="M3 25 Q8 16 13 14 M35 14 Q40 16 45 25"/>' +
      '<path d="M24 23 V32 M18 19 V32 M30 19 V32"/>' +
      '<path d="M8 40 q4 -3 8 0 q4 3 8 0 q4 -3 8 0 q4 3 8 0"/>'
    ),
    /* 대구 — 83타워: 좁아지는 몸체 위 전망층·첨탑 */
    "대구": svg(
      '<path d="M14 44 H34"/>' +
      '<path d="M19 44 L21.5 17 M29 44 L26.5 17"/>' +
      '<rect x="16" y="11" width="16" height="6" rx="2"/>' +
      '<path d="M24 11 V3"/>' +
      '<path d="M20 26 H28 M19 35 H29"/>'
    ),
    /* 인천 — 인천대교: 사장교 주탑에서 케이블이 부챗살로 */
    "인천": svg(
      '<path d="M2 34 H46"/>' +
      '<path d="M24 6 L19 34 M24 6 L29 34"/>' +
      '<path d="M23 12 L8 34 M25 12 L40 34"/>' +
      '<path d="M23 19 L13 34 M25 19 L35 34"/>' +
      '<path d="M10 41 q4 -3 8 0 q4 3 8 0 q4 -3 8 0"/>'
    ),
    /* 경기 — 수원화성 팔달문: 홍예(아치) 석축 위 2층 문루 */
    "경기": svg(
      '<path d="M8 44 V31 H40 V44"/>' +
      '<path d="M19 44 V39 Q24 33 29 39 V44"/>' +
      '<path d="M6 31 Q24 26 42 31 M6 31 L4 27 M42 31 L44 27"/>' +
      '<path d="M11 30 V23 M37 30 V23"/>' +
      '<path d="M9 23 Q24 18 39 23 M9 23 L7 19.5 M39 23 L41 19.5"/>' +
      '<path d="M15 22 V15 M33 22 V15"/>' +
      '<path d="M13 15 Q24 11 35 15"/>'
    ),
    /* 강원 — 설악산: 겹능선과 해 */
    "강원": svg(
      '<path d="M2 41 L13 22 L19 30 L27 12 L34 26 L39 20 L46 41"/>' +
      '<path d="M24.5 18 L27 12 L29.5 17"/>' +
      '<circle cx="40" cy="9" r="3.5"/>'
    ),
    /* 대전 — 엑스포 한빛탑: 위로 모이는 원뿔 몸체와 전망 링 */
    "대전": svg(
      '<path d="M13 43 H35"/>' +
      '<path d="M18 43 Q22 24 24 7 Q26 24 30 43"/>' +
      '<path d="M16 16 H32"/>' +
      '<path d="M20 13 H28"/>' +
      '<path d="M24 7 V3"/>'
    ),
    /* 광주 — 무등산 입석대: 산 능선 위 주상절리 돌기둥 */
    "광주": svg(
      '<path d="M2 42 L16 26 H32 L46 42"/>' +
      '<path d="M18 26 V12 M24 26 V9 M30 26 V12"/>' +
      '<path d="M16 12 H20 M22 9 H26 M28 12 H32"/>'
    ),
    /* 울산 — 고래: 등 곡선·꼬리지느러미·물기둥 */
    "울산": svg(
      '<path d="M5 26 Q13 14 27 15 Q38 16 41 24"/>' +
      '<path d="M41 24 Q45 21 46 15 M41 24 Q46 25 47 30"/>' +
      '<path d="M5 26 Q7 33 16 34 Q30 35 38 29"/>' +
      '<circle cx="12" cy="23" r="1" fill="currentColor" stroke="none"/>' +
      '<path d="M13 12 Q11 8 12 4 M13 12 Q15 8 14 4"/>'
    ),
    /* 경남 — 진주 촉석루: 절벽 바위 위 누각 */
    "경남": svg(
      '<path d="M9 44 L13 33 M39 44 L35 33"/>' +
      '<path d="M11 33 H37"/>' +
      '<path d="M16 33 V25 M24 33 V25 M32 33 V25"/>' +
      '<path d="M7 25 Q24 17 41 25 M7 25 L5 21 M41 25 L43 21"/>' +
      '<path d="M14 19.5 Q24 15 34 19.5"/>'
    ),
    /* 경북 — 첨성대: 병 모양 몸체·정자석·창 */
    "경북": svg(
      '<path d="M14 43 H34"/>' +
      '<path d="M18 43 C15 32 16 22 20 16 M30 43 C33 32 32 22 28 16"/>' +
      '<path d="M17 10 H31 M18 16 H30 M17 10 V16 M31 10 V16"/>' +
      '<rect x="22" y="26" width="4" height="6"/>'
    ),
    /* 전북 — 전주 한옥: 처마 곡선 지붕과 문 */
    "전북": svg(
      '<path d="M6 24 Q24 15 42 24 M6 24 L4 20 M42 24 L44 20"/>' +
      '<path d="M11 24 V40 M37 24 V40"/>' +
      '<path d="M7 40 H41"/>' +
      '<path d="M19 40 V29 H29 V40 M24 29 V40"/>'
    ),
    /* 충남 — 부여 정림사지 오층석탑: 5단 옥개석 */
    "충남": svg(
      '<path d="M11 44 H37"/>' +
      '<path d="M21 44 V8 M27 44 V8"/>' +
      '<path d="M12 39 H36 M13.5 32 H34.5 M15 25 H33 M16.5 18 H31.5 M18 11 H30"/>' +
      '<path d="M24 8 V3"/>'
    ),
    /* 충북 — 보은 정이품송: 우산 모양 소나무 */
    "충북": svg(
      '<path d="M14 42 H34"/>' +
      '<path d="M24 42 V24"/>' +
      '<path d="M8 26 Q24 6 40 26 Q32 21 24 23 Q16 21 8 26"/>' +
      '<path d="M24 30 L17 26 M24 34 L30 30"/>'
    )
  };

  var chain = {
    /* 롯데 — 초고층 곡면 타워(잠실형 실루엣) */
    "롯데": svg(
      '<path d="M12 44 H36"/>' +
      '<path d="M18 44 V16 Q18 7 24 3 Q30 7 30 16 V44"/>' +
      '<path d="M24 6 V44"/>' +
      '<path d="M19 20 H29 M19 28 H29 M19 36 H29"/>'
    ),
    /* 신세계 — 곡면 코너가 붙은 대형 매스(센텀형 실루엣) */
    "신세계": svg(
      '<path d="M6 44 V16 H30"/>' +
      '<path d="M30 16 Q42 16 42 28 V44"/>' +
      '<path d="M4 44 H44"/>' +
      '<path d="M10 22 H27 M10 28 H27 M10 34 H27"/>' +
      '<path d="M34 26 V38"/>' +
      '<path d="M15 44 V38 H22 V44"/>'
    ),
    /* 현대 — 위로 갈수록 물러나는 계단식 매스(더현대형 실루엣) */
    "현대": svg(
      '<path d="M6 44 H42"/>' +
      '<path d="M9 44 V32 H39 V44"/>' +
      '<path d="M13 32 V21 H35 V32"/>' +
      '<path d="M17 21 V12 H31 V21"/>' +
      '<path d="M12 38 H36 M16 26.5 H32 M20 16.5 H28"/>'
    ),
    /* 갤러리아 — 원형 디스크 파사드(압구정형 실루엣, 로고 아님) */
    "갤러리아": svg(
      '<rect x="8" y="12" width="32" height="32"/>' +
      '<circle cx="16" cy="20" r="2"/><circle cx="24" cy="20" r="2"/><circle cx="32" cy="20" r="2"/>' +
      '<circle cx="16" cy="28" r="2"/><circle cx="24" cy="28" r="2"/><circle cx="32" cy="28" r="2"/>' +
      '<path d="M19 44 V37 H29 V44"/>'
    ),
    /* AK — 간판띠와 세로 창이 있는 역사(驛舍)형 매스 */
    "AK": svg(
      '<rect x="9" y="14" width="30" height="30"/>' +
      '<path d="M9 21 H39"/>' +
      '<path d="M15 26 V38 M24 26 V38 M33 26 V38"/>' +
      '<path d="M6 44 H42"/>'
    ),
    /* 대백 — 시계탑이 있는 클래식 백화점 */
    "대백": svg(
      '<path d="M10 44 V17 H38 V44 M7 44 H41"/>' +
      '<path d="M20 17 V7 H28 V17"/>' +
      '<circle cx="24" cy="12" r="2.6"/>' +
      '<path d="M14 23 H34 M14 29 H34"/>' +
      '<path d="M19 44 V36 H29 V44"/>'
    )
  };

  window.VART = { region: region, chain: chain };
})();
