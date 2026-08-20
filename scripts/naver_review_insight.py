#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""네이버 플레이스 리뷰 → 인사이트 (naver-review-analyst 에이전트용)

혼수 카페(구매 후기)·제휴카페(지역 생활)와 다른 세 번째 잣대:
**매장을 실제 방문한 고객의 평가**. 표본은 작아도 신호가 진하다.

축:
  1 규모     리뷰 수·별점 — 삼성 vs LG 같은 상권 비교
  2 추이     월별 리뷰 수. 튀는 달이 곧 재현 가능한 실행안
  3 칭찬     네이버 키워드 집계 + 본문 분해(상담·친절·설명·가격·설치)
  4 아쉬움   대기·불친절·설치지연·재고없음·가격불만·AS — 건수 적어도 원문 보존
  5 예약     '인증 수단 = 예약' 비율. **예약 건수는 외부에서 못 본다 → 추정 표기**
  6 인물     리뷰에 실명이 오르내리는 매니저(매장의 자산)

사용: python scripts/naver_review_insight.py
"""
import io, json, os, re, sys
from collections import Counter, defaultdict
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "artifacts", "naver-place")
try: sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception: pass

# 칭찬 축 — 본문에서 무엇을 잘했다고 하는지
PRAISE = {
    "상담·설명": ["설명", "상담", "안내", "자세", "친절히 설명", "이해", "추천해주"],
    "친절": ["친절", "감사", "기분좋", "배려", "웃으"],
    "가격·혜택": ["싸게", "저렴", "가격", "할인", "혜택", "사은품", "최저"],
    "전문성": ["전문", "정확", "꼼꼼", "professional", "비교해주"],
    "설치·배송": ["설치", "배송", "빠르", "약속", "일정"],
    "매장환경": ["주차", "깨끗", "넓", "쾌적", "위치", "접근"],
}
# ── 아쉬움 축 ──
# 실측 교훈(2026-08-20): '고장'·'AS' 키워드만 보면 **칭찬 리뷰가 불만으로 잡힌다.**
#   "냉장고 고장나서 갔는데 친절하게 설명해주셔서 구매했어요" → 방문 사유일 뿐 불만이 아니다.
# 네이버 리뷰는 압도적으로 긍정 편향이고 별점도 대부분 비어 있어, 키워드로는 못 가른다.
# → **명시적 부정 서술어**가 있어야 불만으로 센다. 그리고 칭찬 표현이 함께 있으면 뺀다.
# '별로'는 앞에 명사가 붙으면 '~별로(각각)'라는 전혀 다른 뜻이다.
#   실측: "제품별로 설명을 잘해 주셔서" / "종류별로 설명도 잘해주시구요" 가 불만으로 잡혔다.
#   → 부정 부사 '별로'만 인정한다(별로 + 안/못/이지/였/네/에요/입니다 …).
NEGWORD = re.compile(
    r"불친절|무성의|성의\s?없|퉁명|불쾌|기분\s?나[쁘빠]|화가\s?나|짜증|황당|어이없|"
    r"실망|최악|별로\s*(안|못|이지|였|네|에요|예요|입니다|더라|였어|임)|"
    r"다시는|두\s?번\s?다시|후회|비추|엉망|형편없|무시당|"
    r"안\s?알려|설명도\s?안|기다리[다게]\s?지쳐|한참\s?기다|계속\s?기다")
# 강한 부정어 — 위치와 무관하게 불만으로 인정한다.
# 실측: "별로 안 친절하고 설명도 대충" 이 '칭찬→반전' 규칙에 막혀 빠졌다.
STRONG_NEG = re.compile(
    r"불친절|최악|다시는|두\s?번\s?다시|비추|엉망|형편없|무시당|"
    r"별로\s*(안|못)|무성의|불쾌")
POSWORD = re.compile(r"친절|감사|만족|추천|최고|좋았|잘\s?샀|덕분|기분\s?좋|또\s?[방올]|편안|신뢰")

# 부정어를 다시 부정하는 표현 — 오탐의 주범이다(실측).
#   "후회없는 선택" / "짜증한번없이" / "불만 없어요" / "실망하지 않았"
# 이걸 못 거르면 조치 목록이 칭찬글로 채워져 쓸모가 없어진다.
# ('응대가'·'태도가'도 뺐다 — "친절하게 응대가 좋았다"까지 불만으로 잡았다.)
# '짜증내지않고' 처럼 어미가 붙어도 취소로 봐야 한다(실측 오탐).
# '별로'는 여기 넣지 않는다 — "별로 안 친절" 은 취소가 아니라 이중 부정 강조다.
NEG_CANCEL = re.compile(
    r"(후회|짜증|불만|실망|불편|걱정|망설)"
    r"\s?(한\s?번|하나)?\s?(내지|하지|스럽지|나지)?\s?(없|않|안\s)")


def is_negative(text, star=None):
    """진짜 불만인지 판정한다.
    ① 부정어 바로 옆에 취소 표현이 붙어 있으면 불만이 아니다("후회없는")
    ② 별점 3 이하면 부정어 하나로도 불만으로 인정한다
    ③ 별점이 높거나 없으면 '칭찬 → 반전' 구조일 때만 인정한다"""
    hit = NEGWORD.search(text)
    if not hit:
        return False
    while hit:
        cancelled = any(abs(m.start() - hit.start()) <= 12
                        for m in NEG_CANCEL.finditer(text))
        if not cancelled:
            break
        hit = NEGWORD.search(text, hit.end())   # 취소된 것 말고 다른 부정어를 찾는다
    if not hit:
        return False
    if star is not None and star <= 3:
        return True
    # 강한 부정어는 위치와 무관하게 불만으로 인정한다.
    # 실측: "별로 안 친절하고 설명도 대충" 이 '칭찬→반전' 규칙에 막혀 빠졌다
    #       (부정어가 문장 앞에 오고, 뒤의 '친절'이 칭찬으로 잡혀서).
    if STRONG_NEG.search(text):
        return True
    pos = POSWORD.search(text)
    if pos:
        return hit.start() > pos.start()
    return True
# 불만이 확인된 뒤, 무엇에 대한 불만인지 가르는 축
COMPLAIN = {
    "응대·태도": ["불친절", "무시", "퉁명", "성의", "태도", "응대"],
    "대기": ["기다", "대기", "오래 걸", "한참"],
    "설치·배송": ["지연", "늦", "안와", "안오", "연기", "미뤄", "배송", "설치"],
    "가격": ["비싸", "바가지", "속", "더싸", "비교하니"],
    "재고·품절": ["재고", "품절", "없어서", "없다고"],
    "제품·AS": ["하자", "불량", "환불", "교환", "수리 안", "AS가"],
}
# 방문 사유 — 불만이 아니라 '왜 왔나'. 교체 수요 규모를 보는 축이다.
REASON = {
    "고장·교체": ["고장", "안되", "오래된", "수명", "바꾸", "교체", "14년", "10년"],
    "이사·입주": ["이사", "입주", "새집", "신혼", "혼수"],
    "신제품": ["신상", "새로 나온", "신제품", "출시"],
    "구독·렌탈": ["구독", "렌탈", "렌털"],
}

# 광고성 리뷰 — 쿠팡 링크 삽입 등
AD = re.compile(r"쿠팡 링크|링크 자연스럽게|제휴|파트너스|수수료를 제공")
MGR = re.compile(r"([가-힣]{2,4})\s*(매니저|점장|부점장|프로|담당자|사원)")
NOT_NAME = {"삼성", "엘지", "저희", "우리", "담당", "친절", "설명", "매장", "직원", "여기", "정말"}


def load():
    out = []
    if not os.path.isdir(SRC): return out
    for f in sorted(os.listdir(SRC)):
        if f.endswith(".json"):
            out.append(json.load(open(os.path.join(SRC, f), encoding="utf-8")))
    return out


def analyze(rec):
    items = rec.get("items") or []
    o = {"n": len(items), "praise": Counter(), "complain": Counter(), "reason": Counter(),
         "months": Counter(), "via": Counter(), "stars": Counter(),
         "mgr": Counter(), "ads": 0, "neg_samples": [], "pos_samples": []}
    for x in items:
        t = x.get("text") or ""
        if AD.search(t):
            o["ads"] += 1
            continue
        if x.get("y") and x.get("mo"):
            o["months"][f"{x['y']}-{x['mo']:02d}"] += 1
        o["via"][x.get("via") or "미상"] += 1
        if x.get("star"): o["stars"][x["star"]] += 1

        for k, ws in PRAISE.items():
            if any(w in t for w in ws): o["praise"][k] += 1
        for k, ws in REASON.items():
            if any(w in t for w in ws): o["reason"][k] += 1

        # 불만 판정은 is_negative 한 곳에서만 한다(취소표현·별점까지 함께 본다)
        neg = is_negative(t, x.get("star"))
        if neg:
            axes = [k for k, ws in COMPLAIN.items() if any(w in t.lower() for w in ws)] or ["기타"]
            for k in axes: o["complain"][k] += 1
            if len(o["neg_samples"]) < 10:
                o["neg_samples"].append({"ym": f"{x.get('y')}-{x.get('mo')}",
                                         "axes": axes, "star": x.get("star"), "t": t[:180]})
        elif o["praise"] and len(o["pos_samples"]) < 6:
            o["pos_samples"].append({"ym": f"{x.get('y')}-{x.get('mo')}", "t": t[:160]})

        for nm, ttl in MGR.findall(t):
            if nm not in NOT_NAME and len(nm) >= 2:
                o["mgr"][f"{nm} {ttl}"] += 1

    o["nkeywords"] = rec.get("keywords") or []
    tot = sum(o["via"].values())
    o["bookingRate"] = round(o["via"].get("예약", 0) / tot * 100, 1) if tot else 0
    o["negTotal"] = len(o["neg_samples"])
    return o

def main():
    recs = load()
    if not recs:
        raise SystemExit("수집 파일 없음 — artifacts/naver-place/*.json")
    date = datetime.now().strftime("%Y%m%d")
    A = [(r, analyze(r)) for r in recs]

    L = []
    L.append(f"# 네이버 리뷰 인사이트 — {date[:4]}-{date[4:6]}-{date[6:]}")
    L.append("")
    L.append(f"> 대상 **{len(recs)}개 매장** · 수집 리뷰 **{sum(a['n'] for _, a in A):,}건**")
    L.append("> ")
    L.append("> ⚠ **네이버 예약 '건수'는 외부에서 볼 수 없다**(스마트플레이스 관리자 전용).")
    L.append("> 아래 '예약 경유'는 리뷰의 `인증 수단 = 예약` 비율로 낸 **추정치**다.")
    L.append("> 정확한 예약 수는 스마트플레이스에서 직접 내려받아야 한다.")
    L.append("> 리뷰는 최신순 일부 표본이며 **전수가 아니다**. 혼수 카페 후기와 합산하지 않는다.")
    L.append("")

    # 1) 규모 — 삼성 vs LG
    L.append("## 1. 규모 — 삼성 vs LG (같은 상권)")
    L.append("")
    L.append("| 매장 | 브랜드 | 지역 | 네이버 리뷰 총계 | 수집 표본 | 예약 경유(추정) |")
    L.append("|---|---|---|---|---|---|")
    for r, a in sorted(A, key=lambda x: -(x[0].get("reviewTotal") or 0)):
        L.append(f"| {r['place']['name']} | {r['brand']} | {r['region']} | "
                 f"{(r.get('reviewTotal') or 0):,} | {a['n']} | {a['bookingRate']}% |")
    L.append("")

    # 2) 칭찬 — 네이버 정형 키워드
    L.append("## 2. 칭찬 — 고객이 고른 키워드 (네이버 집계)")
    L.append("")
    L.append("고객이 리뷰 작성 시 직접 선택한 항목이라 **본문 해석보다 정확**하다.")
    L.append("")
    for r, a in A:
        if not a["nkeywords"]: continue
        ks = " · ".join(f"{k['k']} **{k['n']}**" for k in a["nkeywords"][:6])
        L.append(f"- **{r['place']['name']}**({r['brand']}) — {ks}")
    L.append("")

    # 3) 방문 사유 + 칭찬/아쉬움
    L.append("## 3. 왜 방문했나 (교체 수요 규모)")
    L.append("")
    L.append("'고장·교체'는 불만이 아니라 **방문 사유**다. 이 숫자가 곧 교체 수요의 크기다.")
    L.append("")
    L.append("| 매장 | 고장·교체 | 이사·입주 | 신제품 | 구독·렌탈 |")
    L.append("|---|---|---|---|---|")
    for r, a in sorted(A, key=lambda x: -x[1]["reason"].get("고장·교체", 0)):
        rs = a["reason"]
        L.append(f"| {r['place']['name']} | {rs.get('고장·교체',0)} | {rs.get('이사·입주',0)} | "
                 f"{rs.get('신제품',0)} | {rs.get('구독·렌탈',0)} |")
    L.append("")

    L.append("## 4. 본문에서 읽은 칭찬 · 아쉬움")
    L.append("")
    L.append("네이버 리뷰는 긍정 편향이 강하다. 그래서 **명시적 부정 서술어**")
    L.append("(불친절·실망·최악·다시는 등)가 있을 때만 불만으로 셌다.")
    L.append("'고장'·'AS' 같은 낱말은 방문 사유일 뿐이라 불만에서 뺐다.")
    L.append("")
    L.append("| 매장 | 칭찬 상위 | 불만 건수 | 불만 축 |")
    L.append("|---|---|---|---|")
    for r, a in A:
        p = " · ".join(f"{k} {v}" for k, v in a["praise"].most_common(3)) or "—"
        c = " · ".join(f"{k} {v}" for k, v in a["complain"].most_common(3)) or "—"
        L.append(f"| {r['place']['name']} | {p} | **{a['negTotal']}** | {c} |")
    L.append("")
    L.append("### 불만 원문 (조치용 — 요약만 하면 손댈 수 없다)")
    L.append("")
    any_neg = False
    for r, a in A:
        for s2 in a["neg_samples"][:3]:
            any_neg = True
            st = f"★{s2['star']} " if s2.get("star") else ""
            L.append(f"- **{r['place']['name']}** {s2['ym']} {st}[{'/'.join(s2['axes'])}] {s2['t']}")
    if not any_neg:
        L.append("_수집 표본에서 명시적 불만이 확인되지 않았습니다(긍정 편향)._")
    L.append("")

    # 4) 추이
    L.append("## 5. 월별 리뷰 추이")
    L.append("")
    allm = sorted({m for _, a in A for m in a["months"]})[-12:]
    if allm:
        L.append("| 매장 | " + " | ".join(m[2:] for m in allm) + " |")
        L.append("|---" * (len(allm) + 1) + "|")
        for r, a in A:
            L.append(f"| {r['place']['name']} | " + " | ".join(str(a["months"].get(m, 0)) for m in allm) + " |")
    L.append("")

    # 5) 인물
    L.append("## 6. 리뷰에 이름이 오르는 사람 (매장 자산)")
    L.append("")
    for r, a in A:
        if not a["mgr"]: continue
        who = " · ".join(f"{k} {v}건" for k, v in a["mgr"].most_common(5))
        L.append(f"- **{r['place']['name']}** — {who}")
    L.append("")

    # 6) 광고성
    ads = sum(a["ads"] for _, a in A)
    if ads:
        L.append(f"> 광고성 리뷰 **{ads}건** 제외하고 분석했다(쿠팡 링크 삽입 등).")
        L.append("")

    out = os.path.join(ROOT, "artifacts", f"{date}-naver-review-insight.md")
    io.open(out, "w", encoding="utf-8").write("\n".join(L) + "\n")
    sys.stdout.write("\n".join(L[:60]) + "\n")
    sys.stdout.write(f"\n→ {out}\n")


if __name__ == "__main__":
    main()
