# -*- coding: utf-8 -*-
"""전국 월별 혼인 건수 → web/assets/marriage.js (window.MARRIAGE)

다이렉트웨딩 화면 좌측 '수집 건수' 아래에 참조로 붙는다(2026-08-27 사용자 지시:
"기간 설정에 따라 해당 기간 혼인 건수 — 추정치도 좋고 과거는 공공기관 데이터").

■ 공식치(official) — 통계청(국가데이터처) 인구동향 보도자료. 수집 경로:
  - 2026-01 22,640(+12.4%) https://www.korea.kr/briefing/pressReleaseView.do?newsId=156750799
  - 2026-02 18,557(-4.2%)  https://eiec.kdi.re.kr/policy/materialView.do?num=279886
  - 2026-03 21,112(+10.1%) https://mods.go.kr/board.es?act=view&bid=204&list_no=445260
  - 2026-04 20,622(+9.0%)  https://eiec.kdi.re.kr/policy/materialView.do?num=283170
  - 2026-05 20,368(-6.4%)  https://www.ajunews.com/view/20260729091618236
  - 2025-02 19,370(+14.3%) / 2025-03 19,181(+11.5%)
    https://mods.go.kr/board.es?mid=a10301020300&bid=204&act=view&list_no=436139 외
  - 2025-09 18,462(+20.1%) https://mods.go.kr/board.es?mid=a10301010000&bid=204&act=view&list_no=439438
  - 전년동월비로 역산한 달(◇): 2025-01 20,142 / 2025-04 18,920 / 2025-05 21,760 /
    2024-02 16,947 / 2024-03 17,203 / 2024-09 15,372 — 공식 증감률에서 산술 역산.
  - 연간 확정: 2021 192,507 / 2022 191,690 / 2023 193,657 / 2024 222,412 /
    2025 240,326  https://datafact.org/population/marriage-divorce (KOSIS 집계)

■ 추정치(est) — 미발표 월. 방법을 그대로 각주로 화면에 알린다:
  - 2021~2025의 미확보 월 = (그 해 연간 공식치 − 확보 월 합) ÷ 미확보 월 수 (균등 배분)
  - 2026-06 이후 = 전년 동월값 × 2026 확정월 평균 증감률(+4.2%)
"""
import io
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

OFFICIAL = {
    "2026-01": 22640, "2026-02": 18557, "2026-03": 21112,
    "2026-04": 20622, "2026-05": 20368,
    "2025-01": 20142, "2025-02": 19370, "2025-03": 19181,
    "2025-04": 18920, "2025-05": 21760, "2025-09": 18462,
    "2024-02": 16947, "2024-03": 17203, "2024-09": 15372,
}
ANNUAL = {2021: 192507, 2022: 191690, 2023: 193657, 2024: 222412, 2025: 240326}
YOY_2026 = 1.042          # 2026 확정 5개월 평균 증감률(+12.4 −4.2 +10.1 +9.0 −6.4)
LAST_EST = "2026-12"      # 화면 기간 상한까지 추정으로 채운다


def main():
    months = {}
    # 2021~2025: 확보월 = 공식, 나머지 = 연간 잔여 균등 배분
    for y in range(2021, 2026):
        known = {m: OFFICIAL[f"{y}-{m:02d}"] for m in range(1, 13)
                 if f"{y}-{m:02d}" in OFFICIAL}
        rest = [m for m in range(1, 13) if m not in known]
        pool = ANNUAL[y] - sum(known.values())
        base = pool // len(rest) if rest else 0
        for i, m in enumerate(rest):
            v = base + (1 if i < pool - base * len(rest) else 0)
            months[f"{y}-{m:02d}"] = {"n": v, "e": 1}
        for m, v in known.items():
            months[f"{y}-{m:02d}"] = {"n": v, "e": 0}
    # 2026: 발표월 = 공식, 이후 = 전년동월 × 평균 증감률
    for m in range(1, 13):
        ym = f"2026-{m:02d}"
        if ym in OFFICIAL:
            months[ym] = {"n": OFFICIAL[ym], "e": 0}
        elif ym <= LAST_EST:
            prev = months[f"2025-{m:02d}"]["n"]
            months[ym] = {"n": round(prev * YOY_2026), "e": 1}

    data = {
        "months": months,
        "src": "통계청(국가데이터처) 인구동향 월별 보도자료 · 연간 확정치(KOSIS)",
        "estNote": ("미발표 월은 추정 — 2021~2025는 연간 공식치의 잔여를 균등 배분, "
                    "2026년 6월 이후는 전년 동월 × 발표월 평균 증감률(+4.2%)"),
    }
    out = os.path.join(ROOT, "web", "assets", "marriage.js")
    io.open(out, "w", encoding="utf-8").write(
        "window.MARRIAGE = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    off = sum(1 for v in months.values() if not v["e"])
    print(f"혼인 통계 {len(months)}개월(공식 {off} · 추정 {len(months) - off}) → {out}")
    # 검산 — 연간 합이 공식 연간과 일치해야 한다
    for y in range(2021, 2026):
        s = sum(v["n"] for k, v in months.items() if k.startswith(str(y)))
        assert s == ANNUAL[y], (y, s, ANNUAL[y])
    print("연간 검산 OK:", {y: ANNUAL[y] for y in ANNUAL})


if __name__ == "__main__":
    main()
