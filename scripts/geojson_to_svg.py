# -*- coding: utf-8 -*-
"""시도 경계 GeoJSON → 경량 인라인 SVG + 라벨좌표 JSON 변환기.
   geo-status-map 스킬의 핵심 도구. 표준 라이브러리만 사용.

   입력 : 광역시/도 경계 GeoJSON (권장: KOSTAT, 'Free to share or remix')
          properties.name(한글 시도명) 사용. 다른 키면 --name-key로 지정.
   출력 : ① SVG  — 각 시도가 <path data-region="{짧은이름}" data-code="{코드}">
          ② labels.json — {짧은이름: {x, y}}  (지도 위 현황 라벨 배치용)

   사용:
     python geojson_to_svg.py skorea-provinces-2018-geo.json \
            --out ../web/assets/korea-sido.svg \
            --labels ../web/assets/korea-sido-labels.json \
            --width 236 --max-pts 80

   주: 좌표는 등장방형(equirectangular, 위도보정) 투영 — 대시보드 표시용 근사.
       정밀 GIS 분석용이 아니라 '현황 표시 지도'용.
"""
import sys, os, json, math, argparse, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

# 전체 시도명(GeoJSON) → 하네스 표준 짧은 이름(데이터 바인딩 키)
SHORT = {
    "서울특별시": "서울", "부산광역시": "부산", "대구광역시": "대구", "인천광역시": "인천",
    "광주광역시": "광주", "대전광역시": "대전", "울산광역시": "울산", "세종특별자치시": "세종",
    "경기도": "경기", "강원도": "강원", "강원특별자치도": "강원", "충청북도": "충북",
    "충청남도": "충남", "전라북도": "전북", "전북특별자치도": "전북", "전라남도": "전남",
    "경상북도": "경북", "경상남도": "경남", "제주특별자치도": "제주", "제주도": "제주",
}


def rings_of(geom):
    """Polygon/MultiPolygon → 외곽 링 리스트(각 링 = [[lon,lat],...])."""
    t, c = geom.get("type"), geom.get("coordinates", [])
    if t == "Polygon":
        return [c[0]] if c else []
    if t == "MultiPolygon":
        return [poly[0] for poly in c if poly]
    return []


def _ring_area(ring):
    a = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]; x2, y2 = ring[i + 1]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2


def kept_rings(geom, frac, abs_min=0.0):
    """작은 섬 제거 — 면적이 (그 시도 최대폴리곤×frac)과 절대하한(abs_min) 둘 다 넘는 링만 유지.
       단 시도별 최대 폴리곤(본토)은 항상 유지(작은 도(道)가 통째로 사라지지 않게)."""
    rs = rings_of(geom)
    if not rs:
        return []
    areas = [_ring_area(r) for r in rs]
    mx = max(areas) or 1.0
    thr = max(frac * mx, abs_min)
    keep = [r for r, ar in zip(rs, areas) if ar >= thr]
    return keep or [rs[areas.index(mx)]]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("geojson")
    ap.add_argument("--out", required=True, help="출력 SVG 경로")
    ap.add_argument("--labels", required=True, help="출력 라벨좌표 JSON 경로")
    ap.add_argument("--js", default="", help="(선택) window.KOREA_SIDO={svg,labels} JS 파일 경로 — fetch 없이 <script>로 심을 때")
    ap.add_argument("--name-key", default="name")
    ap.add_argument("--code-key", default="code")
    ap.add_argument("--width", type=float, default=236.0)
    ap.add_argument("--max-pts", type=int, default=80, help="링당 최대 점수(경량화)")
    ap.add_argument("--jeju-inset", type=float, default=0.0,
                    help="제주를 본토 남단 아래로 끌어올려 빈 바다 여백 제거(viewBox 단위 간격, 예 6). 0이면 원위치")
    ap.add_argument("--drop-island-frac", type=float, default=0.0,
                    help="작은 섬 제거 임계(각 시도 최대 폴리곤 면적 대비 비율). 예 0.05면 5% 미만 섬 제거 → 좌우 외곽섬 정리")
    ap.add_argument("--drop-island-abs", type=float, default=0.0,
                    help="작은 섬 절대면적 하한(lon·lat²). 예 0.006이면 백령도 등 원거리 도서 제거(본토는 유지)")
    a = ap.parse_args()

    with open(a.geojson, encoding="utf-8") as f:
        gj = json.load(f)
    feats = gj.get("features", [])
    if not feats:
        print("features 없음", file=sys.stderr); sys.exit(1)

    # 1) 전체 좌표 bbox + 평균위도(투영 보정)
    minlon = minlat = 1e9; maxlon = maxlat = -1e9
    for ft in feats:
        for ring in kept_rings(ft.get("geometry", {}), a.drop_island_frac, a.drop_island_abs):
            for lon, lat in ring:
                minlon = min(minlon, lon); maxlon = max(maxlon, lon)
                minlat = min(minlat, lat); maxlat = max(maxlat, lat)
    lat0 = math.radians((minlat + maxlat) / 2)
    k = math.cos(lat0)  # 경도 압축

    def proj(lon, lat):
        return lon * k, -lat  # y 뒤집기(북쪽 위로)

    px0, py0 = proj(minlon, maxlat)   # 좌상단
    px1, py1 = proj(maxlon, minlat)   # 우하단
    sx = a.width / (px1 - px0)
    height = round((py1 - py0) * sx, 1)

    def to_px(lon, lat):
        x, y = proj(lon, lat)
        return ((x - px0) * sx, (y - py0) * sx)

    def decimate(ring):
        n = len(ring)
        if n <= a.max_pts:
            idx = range(n)
        else:
            step = math.ceil(n / a.max_pts)
            idx = list(range(0, n, step))
            if idx[-1] != n - 1:
                idx.append(n - 1)
        return [ring[i] for i in idx]

    # 1차: 픽셀 좌표로 시도별 링·라벨 수집(아직 path 문자열로 굳히지 않음)
    feat_px = []   # [{short, code, rings:[[(x,y)...]], lx, ly}]
    for ft in feats:
        props = ft.get("properties", {})
        full = props.get(a.name_key, "")
        code = props.get(a.code_key, "")
        short = SHORT.get(full, full)
        rs = kept_rings(ft.get("geometry", {}), a.drop_island_frac, a.drop_island_abs)
        if not rs:
            continue
        rings = []
        for ring in rs:
            rings.append([to_px(lon, lat) for lon, lat in decimate(ring)])
        biggest = max(rs, key=len)
        cx = cy = 0.0
        for lon, lat in biggest:
            x, y = to_px(lon, lat); cx += x; cy += y
        feat_px.append({"short": short, "code": code, "rings": rings,
                        "lx": cx / len(biggest), "ly": cy / len(biggest)})

    # 제주 인셋: 본토 남단 바로 아래로 끌어올려 빈 바다 여백 제거
    crop_h = height
    if a.jeju_inset > 0:
        mainland_maxy = max((y for f in feat_px if f["short"] != "제주" for r in f["rings"] for _, y in r), default=height)
        jeju = next((f for f in feat_px if f["short"] == "제주"), None)
        if jeju:
            jminx = min(x for r in jeju["rings"] for x, _ in r)
            jminy = min(y for r in jeju["rings"] for _, y in r)
            jmaxy = max(y for r in jeju["rings"] for _, y in r)
            jmaxx = max(x for r in jeju["rings"] for x, _ in r)
            dy = -(jminy - (mainland_maxy + a.jeju_inset))      # 위로 끌어올림
            # 가로로는 남해안 아래(전남·경남 사이)에 자연스럽게 들어오도록 약간 우측 이동
            target_x = a.width * 0.30
            dx = target_x - jminx
            for r in jeju["rings"]:
                for i, (x, y) in enumerate(r):
                    r[i] = (x + dx, y + dy)
            jeju["lx"] += dx; jeju["ly"] += dy
            crop_h = max(mainland_maxy, jmaxy + dy) + a.jeju_inset

    paths, labels = [], {}
    for f in feat_px:
        d = []
        for r in f["rings"]:
            seg = [("M" if j == 0 else "L") + f"{x:.1f} {y:.1f}" for j, (x, y) in enumerate(r)]
            d.append("".join(seg) + "Z")
        labels[f["short"]] = {"x": round(f["lx"], 1), "y": round(f["ly"], 1)}
        paths.append(f'<path data-region="{f["short"]}" data-code="{f["code"]}" d="{"".join(d)}"/>')
    height = round(crop_h, 1)

    svg = (
        f'<svg viewBox="0 0 {a.width:.0f} {height:.0f}" class="geo-svg" '
        f'xmlns="http://www.w3.org/2000/svg" role="group" aria-label="대한민국 광역시·도 지도">\n  '
        + "\n  ".join(paths) + "\n</svg>\n"
    )
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        f.write(svg)
    with open(a.labels, "w", encoding="utf-8") as f:
        json.dump(labels, f, ensure_ascii=False, indent=0)
    if a.js:
        os.makedirs(os.path.dirname(os.path.abspath(a.js)), exist_ok=True)
        with open(a.js, "w", encoding="utf-8") as f:
            f.write("/* geo-status-map 자동생성 — fetch 없이 <script>로 심는 지도. 수정 금지 */\n")
            f.write("window.KOREA_SIDO = {\n")
            f.write("  svg: " + json.dumps(svg, ensure_ascii=False) + ",\n")
            f.write("  labels: " + json.dumps(labels, ensure_ascii=False) + "\n};\n")

    print(f"OK · {len(paths)}개 시도 · viewBox 0 0 {a.width:.0f} {height:.0f}")
    print(f"  SVG    → {a.out}")
    print(f"  labels → {a.labels}")
    if a.js:
        print(f"  JS     → {a.js}  (window.KOREA_SIDO)")
    print(f"  지역키 : {', '.join(sorted(labels))}")


if __name__ == "__main__":
    main()
