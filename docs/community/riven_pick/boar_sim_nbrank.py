# 2026-11-19: ranks a neighbourhood run (boar_sim_nb.py -> mc_detail.js -> boar_sim.js). usage: python3 boar_sim_nbrank.py <dir> <label> [top N]
import json, sys, math
d, label = sys.argv[1], sys.argv[2]; N = int(sys.argv[3]) if len(sys.argv) > 3 else 30
FACS = ["grineer", "corpus", "infested", "corrupted"]
S = {f: json.load(open(f"{d}/nbsim_{label}_{f}.json")) for f in FACS}
rows = {}
for f in FACS:
    for n, o in S[f].items():
        key = n.split(" ", 1)[1]; k = [math.log(12 / (T + 1 / o["rate"])) for c in o["T"].values() for T in c.values()]
        byl = {l: math.exp(sum(math.log(12 / (c[l] + 1 / o["rate"])) for c in o["T"].values()) / len(o["T"])) for l in ("lo", "hi", "top")}
        r = rows.setdefault(key, {"f": {}, "l": {}, "mag": o["mag"], "rate": o["rate"]}); r["f"][f] = math.exp(sum(k) / len(k)); r["l"][f] = byl
rows = {k: r for k, r in rows.items() if len(r["f"]) == 4}
base = rows["base"]; out = []
for k, r in rows.items():
    rel = math.exp(sum(math.log(r["f"][f] / base["f"][f]) for f in FACS) / 4) * 100
    lv = [math.exp(sum(math.log(r["l"][f][l] / base["l"][f][l]) for f in FACS) / 4) * 100 for l in ("lo", "hi", "top")]
    out.append((rel, k, r, lv))
out.sort(key=lambda x: -x[0])
print(f"{label}: {len(out)} builds, base rate {base['rate']:.2f} mag {base['mag']} casts/min {60*base['rate']/base['mag']:.1f}")
for rel, k, r, lv in out[:N]:
    print(f"{rel:6.1f} | g/c/i/o " + "/".join(f"{r['f'][f]/base['f'][f]*100:.0f}" for f in FACS) + " | lv65/165/315 " + "/".join(f"{x:.0f}" for x in lv) + f" | rate {r['rate']:5.2f} mag {r['mag']:2d} casts/min {60*r['rate']/r['mag']:4.1f} | {k}")
json.dump([{"swap": k, "rel": rel, "rate": r["rate"], "mag": r["mag"], "byLevel": lv, "byFaction": {f: r["f"][f] / base["f"][f] * 100 for f in FACS}} for rel, k, r, lv in out], open(f"{d}/nbrank_{label}.json", "w"), ensure_ascii=False)
