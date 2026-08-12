#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""제휴카페 인사이트 분석기 — 혼수 채널과 다른 5축으로 본다.

제휴카페는 지역 생활 커뮤니티다. 혼수 후기 건수로 재면 전부 0에 가깝지만
(거사모 46.9만명에서 실구매후기 2건), 아래 축으로 보면 신호가 나온다.

  ① 교체·이사 수요   생애주기가 혼수와 다른 구매 수요(고장·이사·긴급)
  ② 경쟁 유통 노출   전자랜드·하이마트가 이 지역에서 얼마나 활동하나
  ③ 구매처 문의      아직 매장을 못 정한 고객이 공개적으로 묻는 순간
  ④ 제휴 활동 반응   우리 원고가 올라갔는지·반응은 어땠는지
  ⑤ 중고 거래       저가 세그먼트 두께

사용:
  python scripts/affiliate_insight.py            # artifacts/affiliate/*.json 전부
  python scripts/affiliate_insight.py --only glove
"""
import argparse
import io
import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

# build_web_data 도 stdout 을 TextIOWrapper 로 감싼다. 여기서도 감싸면 앞선 래퍼가
# 회수되면서 버퍼를 닫아 print 가 죽는다("I/O operation on closed file").
# → 임포트한 뒤 reconfigure 로만 인코딩을 맞춘다.
from build_web_data import ITEMS, RET_RE, dept_store_of, region_of   # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

SRC_DIR = os.path.join(ROOT, "artifacts", "affiliate")
CAFES = os.path.join(ROOT, "artifacts", "affiliate-cafes.json")

TAG = re.compile(r"<[^>]+>")
strip = lambda s: TAG.sub("", s or "").strip()

# ── 축 판별 ──────────────────────────────────────────────
# 판별 순서가 중요하다. 앞의 축이 뒤를 가로챈다.
# 실측 교훈: '문의'만 보면 세탁기 분해청소 문의가 구매 문의로 잡히고,
#           '냉장고'만 보면 냉장고 정리·요리글이 수요로 잡힌다. 그래서 잡담을 먼저 뺀다.

# ⓪ 생활 잡담 — 가전이 소재로만 등장(요리·정리·일상). 분석에서 제외.
CHAT = re.compile(r"정리|털이|털어|파먹|반찬|레시피|요리|볶음|김치 ?담|보관|밀폐용기|냄새|채웠|"
                  r"열었다|잠자던|구출|점심|저녁|아침|남편|아이가|다이어트|간식")
# ⑤ 중고 거래
USED = re.compile(r"중고|삽니다|팝니다|판매완료|구매완료|드립니다|나눔|무료드림|업소용|업소 ?냉장고")
# ⑦ 사후 서비스 — 청소·수리·설치·철거. 지역카페 가전글의 큰 축이고 구매 문의와 헷갈린다.
SERVICE = re.compile(r"청소|세척|분해|통세척|수리|철거|설치|타공|원복|이설|이전 ?설치|점검|as|a/s|서비스센터")
# ② 경쟁 유통 홍보글
PROMO = re.compile(r"행사|세일|특별혜택|festival|페스타|전단|초대|사은품|할인전|박람회|오픈|주년|이벤트", re.I)
# ⑥ 구독·렌탈 — 삼성 AI구독클럽 대응 포인트
SUBSCRIBE = re.compile(r"구독|렌탈|렌털|리스")
# ⑧ 온라인 구매·이탈 — 오프라인 매장을 거치지 않은 수요
ONLINE = re.compile(r"쿠팡|11번가|지마켓|옥션|네이버 ?쇼핑|온라인|인터넷 ?구입|직구|라방|라이브 ?방송")
# ③ 구매·추천 상담 — 진짜 구매 의도만(서비스 문의는 위에서 이미 걸러진 뒤)
BUY = re.compile(r"어디서|어디가|어느 ?곳|잘해주|저렴한 ?곳|싼 ?곳|추천|견적|어떤 ?거|어떤게|어떤가요|"
                 r"괜찮은|비교|고민|살까|사려|장만|들이려|바꿀까")
# ① 교체·이사 — 생애주기가 혼수와 다른 수요
REPLACE = re.compile(r"고장|안 ?되|오래|낡|수명|바꾸|교체|이사|입주|새집|이전|20년|10년")
URGENT = re.compile(r"급하|당장|오늘|내일|바로|빨리|시급")
# ④ 우리 제휴 활동(삼성 계열 노출)
OURS = re.compile(r"삼성스토어|삼성전자판매|디지털프라자|디지탈프라자|삼성 ?스토어")

RET_ORDER = ["삼성스토어", "LG베스트샵", "하이마트", "백화점"]
EXTRA_RET = {
    "전자랜드": re.compile(r"전자랜드"),
    "이마트·홈플러스": re.compile(r"이마트|홈플러스|트레이더스"),
}


def load_cafes():
    rows = json.load(open(CAFES, encoding="utf-8"))
    by_slug = {}
    for x in rows:
        slug = x["url"].rstrip("/").rsplit("/", 1)[-1]
        by_slug[slug] = x
    return by_slug


def analyze(rows):
    """글 목록 → 5축 집계."""
    out = {
        "n": len(rows),
        "axis": Counter(),
        "items": Counter(),
        "urgent": 0,
        "ret": Counter(),
        "promo_by_ret": Counter(),
        "ask_list": [],
        "ours_list": [],
        "svc_list": [],
        "sub_list": [],
        "online_list": [],
        "months": Counter(),
        "brand": Counter(),
        "store": Counter(),
    }
    for r in rows:
        t = strip(r.get("title"))
        d = strip(r.get("summary"))
        txt = f"{t} {d}"
        ym = (r.get("addDate") or "")[:7]
        if ym:
            out["months"][ym] += 1

        # 브랜드(단독 언급만)
        s, l = bool(r.get("samsung")), bool(r.get("lg"))
        out["brand"]["삼성" if (s and not l) else "LG" if (l and not s)
                     else "양쪽" if (s and l) else "미상"] += 1

        # 유통 언급
        for k, rx in RET_RE.items():
            if rx.search(txt):
                out["ret"][k] += 1
        for k, rx in EXTRA_RET.items():
            if rx.search(txt):
                out["ret"][k] += 1

        st = dept_store_of(txt)
        if st:
            out["store"][st] += 1

        # 품목
        for nm, kws in ITEMS.items():
            if any(w in txt for w in kws):
                out["items"][nm] += 1

        # ── 축 배정 — 순서가 곧 우선순위 ──
        if PROMO.search(txt):                       # 홍보글은 무조건 ②(우리 활동이면 ④도)
            out["axis"]["②경쟁노출"] += 1
            for k, rx in list(RET_RE.items()) + list(EXTRA_RET.items()):
                if rx.search(txt):
                    out["promo_by_ret"][k] += 1
            if OURS.search(txt):
                out["axis"]["④제휴활동"] += 1
                out["ours_list"].append((ym, t[:70], r.get("url", "")))
            continue
        if USED.search(txt):
            out["axis"]["⑤중고"] += 1
            continue
        if SERVICE.search(txt):                     # 청소·수리·설치 — 구매 문의와 분리
            out["axis"]["⑦사후서비스"] += 1
            out["svc_list"].append((ym, t[:70], r.get("url", "")))
            continue
        if SUBSCRIBE.search(txt):
            out["axis"]["⑥구독·렌탈"] += 1
            out["sub_list"].append((ym, t[:70], r.get("url", "")))
            continue
        if ONLINE.search(txt):
            out["axis"]["⑧온라인"] += 1
            out["online_list"].append((ym, t[:70], r.get("url", "")))
            continue
        if BUY.search(txt):                         # 진짜 구매 의도
            out["axis"]["③구매상담"] += 1
            out["ask_list"].append((ym, t[:70], r.get("url", "")))
            if REPLACE.search(txt):
                out["axis"]["①교체·이사"] += 1
                if URGENT.search(txt):
                    out["urgent"] += 1
            continue
        if REPLACE.search(txt):
            out["axis"]["①교체·이사"] += 1
            if URGENT.search(txt):
                out["urgent"] += 1
            continue
        if CHAT.search(txt):                        # 가전이 소재로만 나온 일상글
            out["axis"]["생활잡담(제외)"] += 1
            continue
        out["axis"]["미분류"] += 1
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="특정 slug만")
    ap.add_argument("--date", default=datetime.now().strftime("%Y%m%d"))
    a = ap.parse_args()

    meta = load_cafes()
    files = sorted(f for f in os.listdir(SRC_DIR) if f.endswith(".json"))
    if a.only:
        files = [f for f in files if f[:-5] == a.only]
    if not files:
        raise SystemExit("수집 파일이 없습니다 — artifacts/affiliate/*.json")

    per = {}
    total_rows = 0
    for f in files:
        slug = f[:-5]
        rows = json.load(open(os.path.join(SRC_DIR, f), encoding="utf-8"))
        if isinstance(rows, dict):
            rows = rows.get("items") or list(rows.values())[0]
        per[slug] = (meta.get(slug, {"name": slug, "mem": 0, "rg": "", "type": ""}), analyze(rows))
        total_rows += len(rows)

    L = []
    L.append(f"# 제휴카페 인사이트 — {a.date[:4]}-{a.date[4:6]}-{a.date[6:]}")
    L.append("")
    L.append(f"> 대상 **{len(per)}곳** · 수집 **{total_rows:,}건** (제목·요약 기준, 본문 미열람)")
    L.append("> ")
    L.append("> ⚠ **혼수 채널(다이렉트결혼준비)과 합산하지 말 것.** 표본 성격이 다르다.")
    L.append("> 제휴카페는 지역 생활 커뮤니티라 혼수 후기가 거의 없고, 대신 교체수요·경쟁노출·문의 신호가 나온다.")
    L.append("> 검색 기반 표본이라 **전수가 아니며**, 검색어에 따라 구성이 달라진다(추정치).")
    L.append("")

    # 대상 요약
    L.append("## 대상 카페")
    L.append("")
    L.append("| 카페 | 유형 | 지역 | 회원수 | 수집 |")
    L.append("|---|---|---|---|---|")
    for slug, (m, o) in sorted(per.items(), key=lambda kv: -kv[1][1]["n"]):
        L.append(f"| {m['name']} | {m.get('type','')} | {m.get('rg','')} | {m.get('mem',0):,} | {o['n']}건 |")
    L.append("")

    # 축 분포
    L.append("## 축별 분포 (건수)")
    L.append("")
    axes = ["①교체·이사", "②경쟁노출", "③구매상담", "④제휴활동", "⑤중고", "⑥구독·렌탈", "⑦사후서비스", "⑧온라인", "생활잡담(제외)", "미분류"]
    L.append("| 카페 | " + " | ".join(axes) + " |")
    L.append("|---" * (len(axes) + 1) + "|")
    tot = Counter()
    for slug, (m, o) in sorted(per.items(), key=lambda kv: -kv[1][1]["n"]):
        L.append(f"| {m['name']} | " + " | ".join(str(o["axis"].get(k, 0)) for k in axes) + " |")
        tot.update(o["axis"])
    L.append("| **합계** | " + " | ".join(f"**{tot.get(k,0)}**" for k in axes) + " |")
    L.append("")

    # ② 경쟁 유통 노출
    L.append("## ② 경쟁 유통 노출 — 이 지역에서 누가 활동하나")
    L.append("")
    L.append("홍보·행사 글에 등장한 유통사. **우리(삼성스토어) 노출이 밀리는 지역이 곧 공백**이다.")
    L.append("")
    rets = RET_ORDER + list(EXTRA_RET)
    L.append("| 카페 | " + " | ".join(rets) + " |")
    L.append("|---" * (len(rets) + 1) + "|")
    for slug, (m, o) in sorted(per.items(), key=lambda kv: -kv[1][1]["n"]):
        L.append(f"| {m['name']} | " + " | ".join(str(o["promo_by_ret"].get(k, 0)) for k in rets) + " |")
    L.append("")

    # 전체 유통 언급(홍보 외 포함)
    L.append("**전체 언급량(홍보 외 포함)**")
    L.append("")
    L.append("| 카페 | " + " | ".join(rets) + " |")
    L.append("|---" * (len(rets) + 1) + "|")
    for slug, (m, o) in sorted(per.items(), key=lambda kv: -kv[1][1]["n"]):
        L.append(f"| {m['name']} | " + " | ".join(str(o["ret"].get(k, 0)) for k in rets) + " |")
    L.append("")

    # ③ 구매처 문의
    L.append("## ③ 구매·추천 상담 — 아직 매장을 못 정한 고객")
    L.append("")
    L.append("제휴카페에서 **가장 값어치 있는 신호**. 이 글에 우리가 붙어 있는지 확인할 것.")
    L.append("")
    for slug, (m, o) in sorted(per.items(), key=lambda kv: -len(kv[1][1]["ask_list"])):
        if not o["ask_list"]:
            continue
        L.append(f"### {m['name']} — {len(o['ask_list'])}건")
        L.append("")
        for ym, t, u in sorted(o["ask_list"], reverse=True)[:12]:
            L.append(f"- {ym or '날짜미상'} · {t}" + (f" — {u}" if u else ""))
        L.append("")

    # ④ 제휴 활동
    L.append("## ④ 우리 제휴 활동 흔적 (삼성스토어 홍보글)")
    L.append("")
    any_ours = False
    for slug, (m, o) in per.items():
        if o["ours_list"]:
            any_ours = True
            L.append(f"### {m['name']} — {len(o['ours_list'])}건")
            for ym, t, u in sorted(o["ours_list"], reverse=True)[:8]:
                L.append(f"- {ym or '날짜미상'} · {t}" + (f" — {u}" if u else ""))
            L.append("")
    if not any_ours:
        L.append("_수집 표본에서 삼성스토어 홍보글이 확인되지 않음._")
        L.append("")

    # 공백 지도 — 수요 대비 우리 노출
    L.append("## 공백 지도 — 수요는 큰데 우리가 없는 곳")
    L.append("")
    L.append("`수요`=구매상담+교체이사+구독렌탈, `우리`=삼성스토어 홍보 노출, `경쟁`=하이마트+전자랜드+베스트샵.")
    L.append("**수요가 큰 순으로 정렬**했다. 우리 노출이 0~1인 상단이 곧 우선 배치 후보다.")
    L.append("")
    L.append("| 카페 | 지역 | 회원수 | 수요 | 우리 | 경쟁 | 진단 |")
    L.append("|---|---|---|---|---|---|---|")
    gap = []
    for slug, (m, o) in per.items():
        demand = o["axis"].get("③구매상담", 0) + o["axis"].get("①교체·이사", 0) + o["axis"].get("⑥구독·렌탈", 0)
        ours = o["promo_by_ret"].get("삼성스토어", 0)
        comp = sum(o["promo_by_ret"].get(k, 0) for k in ("하이마트", "전자랜드", "LG베스트샵"))
        gap.append((demand, ours, comp, m))
    for demand, ours, comp, m in sorted(gap, key=lambda x: -x[0]):
        if ours == 0:
            dx = "🔴 **공백** — 우리 노출 없음"
        elif comp >= ours * 5:
            dx = f"🟠 열세 — 경쟁이 {comp // max(1, ours)}배"
        else:
            dx = "🟢 활동 중"
        L.append(f"| {m['name'][:22]} | {m.get('rg','')[-6:]} | {m.get('mem',0):,} | {demand} | {ours} | {comp} | {dx} |")
    L.append("")

    # ⑥ 구독·렌탈
    L.append("## ⑥ 구독·렌탈 수요 — 삼성 AI구독클럽 대응 지점")
    L.append("")
    L.append("소유가 아니라 **월 이용**을 묻는 고객. 초기 부담이 걸림돌인 층이라 구독 제안이 통한다.")
    L.append("")
    any_sub = False
    for slug, (m, o) in sorted(per.items(), key=lambda kv: -len(kv[1][1]["sub_list"])):
        if not o["sub_list"]:
            continue
        any_sub = True
        L.append(f"### {m['name']} — {len(o['sub_list'])}건")
        for ym, t, u in sorted(o["sub_list"], reverse=True)[:8]:
            L.append(f"- {ym or '날짜미상'} · {t}" + (f" — {u}" if u else ""))
        L.append("")
    if not any_sub:
        L.append("_표본에서 확인되지 않음._")
        L.append("")

    # ⑧ 온라인 구매·이탈
    L.append("## ⑧ 온라인 구매 — 매장을 거치지 않은 수요")
    L.append("")
    L.append("오프라인 상담 없이 산 사례. **불만 글이면 오프라인의 반격 논리**가 된다(설치·AS·환불).")
    L.append("")
    any_on = False
    for slug, (m, o) in sorted(per.items(), key=lambda kv: -len(kv[1][1]["online_list"])):
        if not o["online_list"]:
            continue
        any_on = True
        L.append(f"### {m['name']} — {len(o['online_list'])}건")
        for ym, t, u in sorted(o["online_list"], reverse=True)[:8]:
            L.append(f"- {ym or '날짜미상'} · {t}" + (f" — {u}" if u else ""))
        L.append("")
    if not any_on:
        L.append("_표본에서 확인되지 않음._")
        L.append("")

    # ⑦ 사후 서비스
    L.append("## ⑦ 사후 서비스 수요 — 청소·수리·설치")
    L.append("")
    L.append("지역카페 가전글의 큰 축. 구매 문의가 아니지만 **접점 기회**이고,")
    L.append("여기 쌓인 불만은 다음 구매의 브랜드 선택을 좌우한다.")
    L.append("")
    svc_n = sum(len(o["svc_list"]) for _, o in per.values())
    L.append(f"총 **{svc_n}건**. 상위 사례:")
    L.append("")
    allsvc = []
    for slug, (m, o) in per.items():
        allsvc += [(ym, m["name"], t, u) for ym, t, u in o["svc_list"]]
    for ym, cname, t, u in sorted(allsvc, reverse=True)[:10]:
        L.append(f"- {ym or '날짜미상'} · [{cname}] {t}")
    L.append("")

    # ① 교체 수요 품목
    L.append("## ① 교체·이사 수요 — 품목 구성")
    L.append("")
    L.append("혼수는 패키지·고단가, 교체는 단품·긴급·가격민감. **상담과 진열이 달라야 한다.**")
    L.append("")
    allit = Counter()
    for _, (m, o) in per.items():
        allit.update(o["items"])
    if allit:
        L.append("| 품목 | 언급 |")
        L.append("|---|---|")
        for k, v in allit.most_common(10):
            L.append(f"| {k} | {v} |")
    urg = sum(o["urgent"] for _, o in per.values())
    L.append("")
    L.append(f"긴급 신호(급·당장·바로) 포함 글: **{urg}건**")
    L.append("")

    # 매장 매칭
    L.append("## 백화점 매장 언급")
    L.append("")
    stores = Counter()
    for _, (m, o) in per.items():
        stores.update(o["store"])
    if stores:
        for k, v in stores.most_common(10):
            L.append(f"- {k} {v}건")
    else:
        L.append("_없음 — 이 카페들의 소재 도시에 백화점이 없거나, 지역 생활글에 매장명이 거의 안 나온다._")
    L.append("")
    L.append("> 거제·통영·양산에는 백화점이 없다. **매장 비교 대상이 아니라 전자랜드·하이마트 경쟁 지역**이다.")
    L.append("")

    out = os.path.join(ROOT, "artifacts", f"{a.date}-affiliate-cafe-insight.md")
    with open(out, "w", encoding="utf-8") as f:
        f.write("\n".join(L) + "\n")
    print("\n".join(L))
    print(f"\n→ {out}")


if __name__ == "__main__":
    main()
