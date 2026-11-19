# 2026-11-19: ranks the unified simulation output (boar_sim.js) — one index per build (README 후속 15).
# usage: python3 boar_sim_rank.py <dir with sim_<faction>.json> [reference codes, default the user's 2026-11-19 build]
import json, sys, math
d = sys.argv[1]; REF = sys.argv[2] if len(sys.argv) > 2 else "CD+CL+Ba+Ra+El+CS"
FACS = ["grineer", "corpus", "infested", "corrupted"]; TAG = {"grineer": "ClG", "corpus": "ClC", "infested": "ClI", "corrupted": "ClO"}
MOD = {"CD": (9, "M", "크리티컬 디셀러레이션"), "CL": (14, "M", "프라임드 클렌즈"), "Ba": (9, "M", "샷건 배러지"), "Fr": (9, "M", "프레일 모멘텀"), "AB": (9, "M", "액셀러레이티드 블래스트"),
       "MS": (7, "M", "마그네틱 스트레이프"), "Ra": (14, "M", "프라임드 래비지"), "PB": (14, "M", "프라임드 포인트 블랭크"), "El": (9, "V", "샷건 엘리멘탈리스트"), "CS": (16, "N", "프라임드 차지드 쉘"),
       "AS": (12, "N", "프라임드 애모 스톡"), "BM": (11, "N", "버든드 매거진"), "VS": (9, "M", "비셔스 스프레드"), "Sv": (12, "V", "갈바나이즈드 새비")}
SLOTS = {"V": 2, "M": 5, "N": 1}; BUDGET = 54   # 60 − exilus 6; the user's Boar Prime: riven slot V, Elementalist slot V, 5 × Madurai, 1 × Naramon
def capacity(codes):
    mods = [(18, "V"), (16, "M")] + [MOD[c][:2] for c in codes]          # riven, Galvanized Hell
    tot = 0; mism = []
    for p in "VMN":
        g = sorted([m for m in mods if m[1] == p], key=lambda m: -m[0])
        for i, (dr, _) in enumerate(g):
            if i < SLOTS[p]: tot += math.ceil(dr / 2)
            else: c = math.floor(dr * 1.25 + 0.5); tot += c; mism.append(c - math.ceil(dr / 2))
    forma = 0
    for s in sorted(mism, reverse=True):
        if tot <= BUDGET: break
        tot -= s; forma += 1
    return tot, forma, tot <= BUDGET
S = {f: json.load(open(f"{d}/sim_{f}.json")) for f in FACS}
rows = {}
for f in FACS:
    for n, o in S[f].items():
        codes = n.split(" ")[1]; ks = []
        for cond, lv in o["T"].items():
            for lk, T in lv.items(): ks.append(math.log(12 / (T + 1 / o["rate"])))
        r = rows.setdefault(codes, {"f": {}, "mag": o["mag"], "rate": o["rate"], "T": {}})
        r["f"][f] = math.exp(sum(ks) / len(ks)); r["T"][f] = o["T"]
out = []
for codes, r in rows.items():
    if len(r["f"]) < 4: continue
    idx = math.exp(sum(math.log(v) for v in r["f"].values()) / 4)
    cap, forma, ok = capacity(codes.split("+"))
    cpm = 60 * r["rate"] / r["mag"]
    out.append({"codes": codes, "idx": idx, "f": r["f"], "mag": r["mag"], "rate": r["rate"], "cap": cap, "forma": forma, "ok": ok, "cpm": cpm, "epm": cpm * 12.5})
ref = next(x for x in out if x["codes"] == REF)
for x in out: x["rel"] = x["idx"] / ref["idx"] * 100; x["relf"] = {f: x["f"][f] / ref["f"][f] * 100 for f in FACS}
out.sort(key=lambda x: -x["idx"])
def show(x, rank=None):
    return (f"{'' if rank is None else str(rank).rjust(4)} {x['codes']:20s} {x['rel']:6.1f} | g/c/i/o " + "/".join(f"{x['relf'][f]:.0f}" for f in FACS) +
            f" | rate {x['rate']:5.2f} mag {x['mag']:2d} casts/min {x['cpm']:4.1f} energy/min {x['epm']:4.0f} | cap {x['cap']+6}/60 forma {x['forma']}{'' if x['ok'] else ' (!)'}")
print("builds", len(out), "| reference", REF, "rank", [i for i, x in enumerate(out) if x['codes'] == REF][0] + 1)
print("== top 20 (any capacity)"); [print(show(x, i + 1)) for i, x in enumerate(out[:20])]
print("== top 20 that fit the current polarities (forma 0)"); [print(show(x, out.index(x) + 1)) for x in [y for y in out if y["forma"] == 0][:20]]
print("== top 12, forma 0, energy/min <= 450"); [print(show(x, out.index(x) + 1)) for x in [y for y in out if y["forma"] == 0 and y["epm"] <= 450][:12]]
print("== named"); 
for c in (REF, "CD+CL+Ba+Fr+El+CS", "CD+Ba+Fr+Ra+El+CS", "CD+Ba+Ra+PB+El+CS", "CD+CL+Ba+PB+El+CS", "CD+CL+Ba+Fr+Ra+El", "CD+CL+Ba+Fr+AB+El", "CL+Ba+Fr+AB+MS+El"):
    x = next((y for y in out if y["codes"] == c), None)
    if x: print(show(x, out.index(x) + 1))
json.dump(out, open(f"{d}/rank.json", "w"), ensure_ascii=False)
