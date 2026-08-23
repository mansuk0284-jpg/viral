#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""채널별 수집 — 성격이 다른 카페를 각자 잣대로 모은다

사용자 지시(2026-08-23): "각 채널별 데이터를 수집하자 … 전체 채널에 대해 데이터 수집을
제대로 하자". 다만 실제로 긁어 보니 **네 카페 모두 '혼수가전 구매후기' 전용 판이 없었다.**

  결다모(30897728)        가전 후기 희박 — 3페이지에 1건
  맘스홀릭(10094499)      육아용품 후기 — 부스터·분유포트·힙시트
  경남결혼준비(13781188)  가전판이 있으나 **견적 문의** — "세탁기 견적 부탁드립니다"
  웨딩북(28531050)        사용후기판이 1페이지도 안 참

그래서 다이렉트웨딩(구매후기)과 **합산하지 않는다.** 제휴카페를 '생활 커뮤니티'로
따로 본 것과 같은 이유다. 각 채널의 성격을 kind 로 못 박고 화면에서도 갈라 보여준다.

  kind=review   구매 후기      — 산 사람이 남긴 평가 (다이렉트웨딩)
  kind=demand   구매 전 수요    — 아직 안 산 사람의 문의·견적 (경남결혼준비 가전판)
  kind=life     생활 커뮤니티   — 교체·이사 등 생활 맥락 (맘스홀릭)

사용:
  python scripts/collect_channels.py --channel gn-wedding --pages 20
  python scripts/collect_channels.py --all
"""
import argparse
import io
import json
import os
import re
import subprocess
import sys
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# 가전 신호 — 통합 게시판에서 가전 글만 골라내는 체
APPLIANCE = re.compile(
    r"가전|냉장고|세탁기|건조기|에어컨|김치냉장고|스타일러|식기세척기|식세기|"
    r"청소기|TV|티비|공기청정기|정수기|인덕션|전자레인지|워시타워|비스포크|오브제|"
    r"디오스|그랑데|무풍|트롬|삼성|엘지|LG", re.I)

CHANNELS = {
    # 2026-08-23 사용자 지시로 채널을 다시 정했다.
    # 앞서 붙였던 결다모·맘스홀릭·경남결혼준비·웨딩북은 걷어냈다 —
    # 긁어 보니 2007~2010년 글이거나(경남결혼준비), 육아용품이거나(맘스홀릭),
    # 가전 글이 0건이었다(결다모). 표본이 없으면 채널이 아니다.
    #
    # 새 네 곳 중 실제로 쓸 수 있는 건 제이웨딩이다(실측):
    #   제이웨딩 303   2026-03~08 · 매장·매니저 실명까지 들어 있다  ← 정본급
    #   맥마웨 282     빈 게시판
    #   웨딩공부       메뉴 목록이 비어 있다(비공개 추정)
    #   마이셀프웨딩   같음
    "jwedding": {
        "name": "제이웨딩", "clubid": "24453752", "menu": "303",
        "kind": "review",
        "note": "[칭찬] 혼수/선택이유 게시판 — 어느 매장 누구에게 샀고 왜 골랐는지가 적힌다. "
                "매니저 실명이 함께 나와 다이렉트웨딩과 같은 잣대로 볼 수 있다. "
                "다만 주얼리·웨딩밴드가 섞인 혼수 전반 판이라 가전만 걸러 쓴다"
                "(실측: 1,646건 중 백화점 언급 6%).",
        "filter": True,
    },
    "jwedding-ai": {
        "name": "제이웨딩 · 삼성AI가전", "clubid": "24453752", "menu": "664",
        "kind": "review",
        "note": "삼성 AI 가전 이벤트 게시판 — 제휴 이벤트라 삼성 편향이 있다. "
                "브랜드 비교에 쓰지 말고 반응 관찰용으로만.",
        "filter": False,
    },
    # 맥마웨(28757979) 는 상담 신청 위주 카페다. '실시간 가전 상담'(282)은 빈 게시판이고
    # 커머스 후기(285)에서도 가전은 4건(2024-10~11)뿐이라 표본이 안 된다.
    # 게시판 25개를 다 훑어봤지만 가전 후기가 쌓이는 판이 없다.
    # 웨딩공부(10094645) · 마이셀프웨딩(24333771) 은 게시판 목록을 다시 받아 확인한 결과
    # 공지사항·자유게시판·포토앨범 같은 **네이버 기본 게시판만** 있었다.
    # 가전은커녕 웨딩 주제 게시판도 없는 사실상 빈 카페라 채널로 넣지 않는다.
    # (clubId 는 확인해 뒀으니 나중에 활성화되면 menu 만 채우면 된다)
}


def run_board(ch, pages):
    """카페 스크래퍼를 채널의 clubId 로 돌린다. 결과는 오늘자 raw 파일."""
    env = dict(os.environ, VIRAL_CLUBID=ch["clubid"])
    cmd = [sys.executable, os.path.join(ROOT, "scripts", "naver_cafe_scraper.py"),
           "board", "--menu-id", ch["menu"], "--pages", str(pages),
           "--no-read-body", "--headless"]
    p = subprocess.run(cmd, env=env, cwd=ROOT, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    return p.returncode, (p.stdout or "") + (p.stderr or "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--channel", choices=list(CHANNELS))
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--pages", type=int, default=20)
    a = ap.parse_args()

    todo = list(CHANNELS) if a.all else ([a.channel] if a.channel else [])
    if not todo:
        raise SystemExit("--channel 또는 --all 을 지정하세요")

    stamp = datetime.now().strftime("%Y%m%d")
    raw_path = os.path.join(ROOT, "artifacts", f"{stamp}-cafe-raw.json")
    # 채널을 하나씩 돌려도 요약이 쌓이게 한다 — 매번 새로 쓰면 직전 채널이 사라진다
    idx_path = os.path.join(ROOT, "artifacts", f"{stamp}-channels.json")
    out = {}
    if os.path.isfile(idx_path):
        try:
            out = json.load(io.open(idx_path, encoding="utf-8"))
        except Exception:
            out = {}

    for key in todo:
        ch = CHANNELS[key]
        print(f"\n=== {ch['name']} ({key}) · clubId {ch['clubid']} · menuId {ch['menu']} ===",
              flush=True)
        rc, log = run_board(ch, a.pages)
        got = 0
        for line in log.splitlines():
            m = re.search(r"누적 (\d+)", line)
            if m:
                got = int(m.group(1))
        if not os.path.isfile(raw_path):
            print(f"  수집 실패(파일 없음) rc={rc}")
            continue
        recs = json.load(io.open(raw_path, encoding="utf-8"))
        if ch["filter"]:
            keep = [r for r in recs
                    if APPLIANCE.search((r.get("title") or "") + " " + (r.get("summary") or ""))]
        else:
            keep = recs
        for r in keep:
            r["channel"] = key
            r["channelName"] = ch["name"]
            r["kind"] = ch["kind"]
        # ── 신선도 검사 ─────────────────────────────────────────────
        # "긁혔다" 와 "쓸 수 있다" 는 다르다. 실측(2026-08-23): 경남결혼준비 가전판은
        # 313건이 전부 **2007~2010년** 글이었다. 15년 지난 죽은 게시판이다.
        # 이걸 모르고 화면에 올리면 현재 현황인 것처럼 읽힌다.
        ymd = sorted((r.get("addDate") or "")[:7] for r in keep if r.get("addDate"))
        span = (ymd[0], ymd[-1]) if ymd else (None, None)
        recent = sum(1 for r in keep if (r.get("addDate") or "") >= "2024-01")
        fresh = round(recent / max(1, len(keep)) * 100)
        brand = sum(1 for r in keep if r.get("samsung") or r.get("lg"))
        verdict = ("사용 가능" if fresh >= 30 and brand >= 20
                   else "표본 부족" if brand < 20
                   else "오래된 글 — 현재 현황으로 쓸 수 없음")

        dst = os.path.join(ROOT, "artifacts", f"{stamp}-channel-{key}.json")
        io.open(dst, "w", encoding="utf-8").write(
            json.dumps(keep, ensure_ascii=False, separators=(",", ":")))
        out[key] = {"name": ch["name"], "kind": ch["kind"], "note": ch["note"],
                    "raw": len(recs), "kept": len(keep), "file": os.path.basename(dst),
                    "span": list(span), "fresh": fresh, "brand": brand, "verdict": verdict}
        print(f"  긁은 글 {len(recs):,} → 가전 신호 {len(keep):,}건 "
              f"· 기간 {span[0]}~{span[1]} · 2024년 이후 {fresh}% · 브랜드 언급 {brand}건")
        print(f"  판정: {verdict}  → {os.path.basename(dst)}")

    idx = os.path.join(ROOT, "artifacts", f"{stamp}-channels.json")
    io.open(idx, "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=1))
    print(f"\n요약 → {os.path.basename(idx)}")
    for k, v in out.items():
        print(f"  {v['name']:<16} [{v['kind']:<6}] {v['kept']:>5,}건 · {v['span'][0]}~{v['span'][1]}"
              f" · {v['verdict']}")


if __name__ == "__main__":
    main()
