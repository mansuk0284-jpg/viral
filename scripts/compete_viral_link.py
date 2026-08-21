#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""바이럴 ↔ 경쟁력 상관 분석 → artifacts/YYYYMMDD-compete-viral.md
                              + web/assets/compete-link.js

사용자 질문: "바이럴이 잘 되는 매장이 경쟁력도 높다는 그런거? 인사이트를 찾을 수 있으면 좋은데"

실측 답(2026-08-21, 62개 매장):
  바이럴 건수 ↔ 경쟁력   r = +0.14
  삼성 점유율 ↔ 경쟁력   r = +0.19
→ **거의 상관이 없다.** 이걸 "관계 있다"고 포장하면 거짓이 된다.

그런데 상관이 없다는 사실 자체가 쓸모 있다. 두 축을 교차하면 매장이 넷으로 갈리고,
**어긋난 두 칸이 곧 할 일**이기 때문이다:
  - 바이럴 높은데 경쟁력 낮음 → 말은 도는데 안 팔린다(상담·재고·가격 점검)
  - 경쟁력 높은데 바이럴 낮음 → 잘 파는데 안 알려진다(후기 유도가 비어 있다)

사용: python scripts/compete_viral_link.py
"""
import io
import json
import math
import os
import re
import sys
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

PICK = ["8월 (1-17)", "26년 (누계)", "25년 (년간)"]
MIN_N = 10          # 후기 10건 미만은 비율이 요동쳐 비교 대상에서 뺀다


def norm(s):
    s = re.sub(r"\s+", "", str(s))
    return s.replace("더현대", "현대").replace("갤러리아", "갤")


def load_json_var(path):
    t = io.open(path, encoding="utf-8").read()
    return json.loads(t[t.index("{"):t.rindex("}") + 1])


def corr(a, b):
    n = len(a)
    if n < 3:
        return 0.0
    ma, mb = sum(a) / n, sum(b) / n
    num = sum((x - ma) * (y - mb) for x, y in zip(a, b))
    da = math.sqrt(sum((x - ma) ** 2 for x in a))
    db = math.sqrt(sum((y - mb) ** 2 for y in b))
    return num / (da * db) if da and db else 0.0


def main():
    C = json.load(io.open(os.path.join(ROOT, "artifacts", "compete.json"), encoding="utf-8"))
    D = load_json_var(os.path.join(ROOT, "web", "assets", "cafe-data.js"))
    CM = {s["key"]: s for s in C["stores"]}

    rows = []
    for rg, lst in D["stores"].items():
        for x in lst:
            s = CM.get(norm(x["n"]))
            if not s:
                continue
            p = next((k for k in PICK if k in s["p"]), None)
            if not p:
                continue
            n = x["s"] + x["l"]
            if n < MIN_N:
                continue
            rows.append({
                "store": x["n"], "region": rg, "n": n,
                "share": round(x["s"] / n * 100, 1),
                "comp": s["p"][p], "period": p,
            })

    vol = [r["n"] for r in rows]
    shr = [r["share"] for r in rows]
    cmp_ = [r["comp"] for r in rows]
    r_vol, r_shr = corr(vol, cmp_), corr(shr, cmp_)

    # 사분면 — 중앙값을 기준선으로 (평균은 소수 매장에 끌려간다)
    def med(v):
        w = sorted(v)
        m = len(w) // 2
        return w[m] if len(w) % 2 else (w[m - 1] + w[m]) / 2
    ms, mc = med(shr), med(cmp_)
    for r in rows:
        hi_v, hi_c = r["share"] >= ms, r["comp"] >= mc
        r["quad"] = ("둘 다 강함" if hi_v and hi_c else
                     "말은 도는데 안 팔림" if hi_v else
                     "잘 파는데 안 알려짐" if hi_c else "둘 다 약함")

    web = {
        "built": datetime.now().strftime("%Y-%m-%d"),
        "medShare": ms, "medComp": mc,
        "rVol": round(r_vol, 3), "rShare": round(r_shr, 3),
        "rows": rows,
    }
    io.open(os.path.join(ROOT, "web", "assets", "compete-link.js"), "w", encoding="utf-8").write(
        "/* compete_viral_link.py 자동생성 — 수정 금지 */\n"
        "window.COMPETE_LINK = " + json.dumps(web, ensure_ascii=False, separators=(",", ":")) + ";\n")

    L = []
    L.append(f"# 바이럴 ↔ 경쟁력 — {datetime.now():%Y-%m-%d}")
    L.append("")
    L.append(f"> 대조 가능 **{len(rows)}개 매장** (후기 {MIN_N}건 이상, 삼성·LG 모두 입점)")
    L.append("> 경쟁력 = 당사 ÷ X사 매출 배수. 금액은 싣지 않는다.")
    L.append("")
    L.append("## 결론 — 바이럴과 경쟁력은 거의 무관하다")
    L.append("")
    L.append("| 대조 | 상관계수 | 해석 |")
    L.append("|---|---|---|")
    L.append(f"| 바이럴 건수 ↔ 경쟁력 | **{r_vol:+.2f}** | 거의 없음 |")
    L.append(f"| 삼성 점유율 ↔ 경쟁력 | **{r_shr:+.2f}** | 거의 없음 |")
    L.append("")
    L.append("**\"바이럴이 잘 되면 경쟁력도 높다\"는 성립하지 않는다.** 후기가 많다고 잘 파는 것도,")
    L.append("잘 판다고 후기가 쌓이는 것도 아니다. 둘은 **따로 노는 축**이다.")
    L.append("")
    L.append("그래서 두 축을 교차했을 때 **어긋난 두 칸이 곧 할 일**이 된다.")
    L.append("")
    L.append(f"기준선 — 삼성 점유율 중앙값 **{ms}%** · 경쟁력 중앙값 **{mc:.2f}배**")
    L.append("")

    for q, desc in [("말은 도는데 안 팔림", "후기는 도는데 매출이 안 따라온다 — 상담·재고·가격을 점검할 곳"),
                    ("잘 파는데 안 알려짐", "잘 파는데 온라인에 흔적이 없다 — 후기 유도가 비어 있는 곳"),
                    ("둘 다 강함", "유지"), ("둘 다 약함", "우선순위 낮음")]:
        g = [r for r in rows if r["quad"] == q]
        L.append(f"## {q} — {len(g)}곳")
        L.append("")
        L.append(f"_{desc}_")
        L.append("")
        if g:
            L.append("| 매장 | 지역 | 후기 | 삼성 점유 | 경쟁력 |")
            L.append("|---|---|---|---|---|")
            key = (lambda r: -r["share"]) if q == "말은 도는데 안 팔림" else (lambda r: -r["comp"])
            for r in sorted(g, key=key)[:10]:
                L.append(f"| {r['store']} | {r['region']} | {r['n']:,} | {r['share']}% | {r['comp']:.2f} |")
        L.append("")

    out = os.path.join(ROOT, "artifacts", f"{datetime.now():%Y%m%d}-compete-viral.md")
    io.open(out, "w", encoding="utf-8").write("\n".join(L) + "\n")
    print(f"대조 {len(rows)}곳 · 바이럴↔경쟁력 r={r_vol:+.3f} / 점유율↔경쟁력 r={r_shr:+.3f}")
    for q in ["둘 다 강함", "말은 도는데 안 팔림", "잘 파는데 안 알려짐", "둘 다 약함"]:
        print(f"  {q}: {sum(1 for r in rows if r['quad'] == q)}곳")
    print(f"→ {out}")


if __name__ == "__main__":
    main()
