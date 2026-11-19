# 2026-11-19: absolute pack clear times per faction / condition / level for a few builds (README 후속 15). usage: python3 boar_sim_detail.py <dir with out_<faction>[_vs].json> <codes,codes,...> [gap] [trials] — the first build is the reference
import json, subprocess, os, math, sys
U = sys.argv.pop(1); FACS = ["grineer", "corpus", "infested", "corrupted"]
CODES = sys.argv[1].split(","); GAP = sys.argv[2] if len(sys.argv) > 2 else "0.19"; TR = sys.argv[3] if len(sys.argv) > 3 else "1500"
res = {}
for f in FACS:
    env = dict(os.environ, ONLY=",".join(CODES), TRIALS=TR, GAP=GAP)
    o = json.loads(subprocess.check_output(["node", "boar_sim.js", f"{U}/out_{f}.json", f"{U}/out_{f}_vs.json"], env=env))
    for n, b in o.items(): res.setdefault(n.split(" ")[1], {})[f] = b
json.dump(res, open(f"{U}/detail_gap{GAP}.json", "w"))
ref = CODES[0]
def idx(b, f, lk=None):
    k = [math.log(12 / (T + 1 / b[f]["rate"])) for c in b[f]["T"].values() for l, T in c.items() if lk in (None, l)]
    return math.exp(sum(k) / len(k))
print(f"GAP {GAP}s, trials {TR}; clear time (s) of a 12-pack: per faction, condition A/B/C × level 65/165/315")
for c in CODES:
    b = res[c]; print(f"-- {c}  rate {b['grineer']['rate']:.2f} mag {b['grineer']['mag']}")
    for f in FACS:
        print(f"   {f:9s} " + " | ".join(" ".join(f"{T:5.2f}" for T in cv.values()) for cv in b[f]["T"].values()) +
              "   rel " + f"{idx(b,f)/idx(res[ref],f)*100:5.1f}" + "  by level " + "/".join(f"{idx(b,f,l)/idx(res[ref],f,l)*100:.0f}" for l in ("lo","hi","top")))
    tot = math.exp(sum(math.log(idx(b,f)/idx(res[ref],f)) for f in FACS)/4)*100
    print(f"   overall {tot:.1f}   by level " + "/".join(f"{math.exp(sum(math.log(idx(b,f,l)/idx(res[ref],f,l)) for f in FACS)/4)*100:.1f}" for l in ("lo","hi","top")))
