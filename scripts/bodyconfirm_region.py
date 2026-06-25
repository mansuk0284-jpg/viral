# -*- coding: utf-8 -*-
"""우선지역 본문확인(2단계 정밀화) — 제목으로 해당 지역 후보를 고른 뒤
   본문을 한 건씩 열어 매장명·브랜드를 확정해 점별 집계.
   ★ 재개형(.done 체크포인트) — 죽으면 같은 명령으로 이어서.
   공개 본문 읽기(로그인 세션 우선). 비번·키 입력 없음.

   사용: python bodyconfirm_region.py --region 경기 --out ../artifacts/gyeonggi-bodyconfirm.json
"""
import sys, io, json, re, argparse, os, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from naver_cafe_scraper import (launch, api_article_body, analyze_text, CLUBID, safe_goto, SAMSUNG_PATTERNS, LG_PATTERNS)
from playwright.sync_api import sync_playwright

SIDO = {
 '서울': ['서울','강남','대치','잠실','영등포','목동','노원','천호','미아','여의도','롯데월드몰','월드타워','신촌','왕십리','명동','강서','구로','코엑스','삼성동','용산','홍대','가양','상봉','건대','중계','은평','면목','신도림','관악','강동','송파','서초'],
 '경기': ['수원','분당','판교','일산','평촌','안양','부천','의정부','평택','광교','동탄','하남','김포','고양','용인','성남','안산','시흥','시화','남양주','파주','구리','오산','광명','군포','이천','기흥','죽전','북수원','화성','안성','양주','포천','여주'],
 '인천': ['인천','송도','부평','청라','계양','구월','논현'],
 '부산': ['부산','센텀','서면','해운대','광복','동래','사상','남포','기장','화명'],
 '대구': ['대구','동성로','수성','범어','성서','칠곡','반월당'], '광주': ['광주','첨단','봉선','수완','상무'],
 '대전': ['대전','둔산','유성','관저'], '울산': ['울산','삼산','무거'],
 '경남': ['창원','진주','김해','마산','양산','거제','통영','진해','사천'],
 '경북': ['포항','구미','경산','안동','경주','김천'], '충남': ['천안','아산','당진','서산','논산'],
 '충북': ['청주','충주','제천'], '전북': ['전주','익산','군산','정읍'],
 '전남': ['여수','순천','목포','광양','나주'], '강원': ['춘천','원주','강릉','속초'],
 '제주': ['제주','서귀포'], '세종': ['세종'],
}
GENERIC = set(['백화점','본점','부점','오픈점','지점','매장','면점','할인점'])
BRANCH = re.compile(r'([가-힣]{2,8}점)')


def region_of(txt, pats):
    for k, p in pats.items():
        if p.search(txt):
            return k
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--region", required=True)
    ap.add_argument("--census", default="../artifacts/cafe-census.json")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    pats = {k: re.compile('|'.join(v)) for k, v in SIDO.items()}
    target = a.region
    d = json.load(open(a.census, encoding="utf-8"))
    # 후보: 제목이 해당 지역으로 추정되는 글 (전수 본문확인 대상)
    cand = [r for r in d if (r.get("samsung") or r.get("lg"))
            and region_of((r.get("title") or ""), pats) == target]
    print(f"[{target}] 후보 {len(cand)}건 — 본문확인 시작", flush=True)

    donef = a.out + ".done"
    done = set()
    store = {}
    if os.path.exists(a.out):
        try:
            prev = json.load(open(a.out, encoding="utf-8"))
            store = {x["n"]: x for x in prev.get("stores", [])}
            done = set(prev.get("doneIds", []))
        except Exception:
            pass

    def save():
        json.dump({"region": target, "confirmed": len(done),
                   "stores": sorted(store.values(), key=lambda x: -(x["s"] + x["l"]))[:200],
                   "doneIds": list(done)},
                  open(a.out, "w", encoding="utf-8"), ensure_ascii=False)

    with sync_playwright() as p:
        ctx = launch(p, headless=True)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        safe_goto(page, f"https://cafe.naver.com/f-e/cafes/{CLUBID}")
        page.wait_for_timeout(1500)
        n = 0
        for r in cand:
            aid = r.get("articleId")
            if aid in done:
                continue
            body = ""
            try:
                body = api_article_body(page, aid)
            except Exception:
                pass
            txt = (r.get("title") or "") + " " + (body or "")
            res = analyze_text(r.get("title") or "", body or "")
            s = bool(res.get("samsung")); l = bool(res.get("lg"))
            names = set(m for m in BRANCH.findall(txt) if m not in GENERIC and len(m) >= 3)
            for nm in names:
                if region_of(nm, pats) not in (target, None):
                    continue
                o = store.setdefault(nm, {"n": nm, "s": 0, "l": 0})
                if s and not l: o["s"] += 1
                elif l and not s: o["l"] += 1
            done.add(aid)
            n += 1
            if n % 50 == 0:
                save(); print(f"  ...{n}/{len(cand)} 확인", flush=True)
        save()
        ctx.close()
    print(f"[{target}] 완료 — 확인 {len(done)} · 매장 {len(store)} → {a.out}")


if __name__ == "__main__":
    main()
