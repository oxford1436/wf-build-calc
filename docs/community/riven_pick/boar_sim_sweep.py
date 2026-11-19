# 2026-11-19: fire-rate × gap sweep for one build in the unified Boar Prime simulation (README 후속 15). usage: python3 boar_sim_sweep.py <dir with out_<faction>.json> [build codes]
import json, subprocess, os, math, sys
U = sys.argv.pop(1); FACS = ["grineer", "corpus", "infested", "corrupted"]
CODE = sys.argv[1] if len(sys.argv) > 1 else "CD+CL+Ba+Ra+El+CS"
RATES = [8, 10, 12, 14, 15.845, 18, 20.048, 22, 24.2, 26]; GAPS = [0, 0.13, 0.19, 0.27]
def run(rate, gap, mag=None):
    ks = []; perf = {}
    for f in FACS:
        env = dict(os.environ, ONLY=CODE, TRIALS="1500", GAP=str(gap), RATE=str(rate))
        if mag: env["MAG"] = str(mag)
        o = json.loads(subprocess.check_output(["node", "boar_sim.js", f"{U}/out_{f}.json"], env=env))
        b = list(o.values())[0]; k = [math.log(12 / (T + 1 / rate)) for c in b["T"].values() for T in c.values()]
        perf[f] = math.exp(sum(k) / len(k)); ks += k
    return math.exp(sum(ks) / len(ks)), perf
res = []
for r in RATES:
    row = {"rate": r}
    for g in GAPS: row[g] = run(r, g)[0]
    res.append(row)
    print(f"rate {r:6.2f} | mag time {32/r:4.2f}s casts/min {60*r/32:4.1f} | speed g0 {row[0]:6.2f} | loss " + " / ".join(f"{(1-row[g]/row[0])*100:4.1f}%" for g in GAPS[1:]) + f" | analytic " + " / ".join(f"{0.98*g*r/32*100:4.1f}%" for g in GAPS[1:]), flush=True)
json.dump(res, open(f"{U}/sweep_rate_{CODE}.json", "w"))
base = next(x for x in res if abs(x["rate"] - 15.845) < 0.01)
print("relative clear speed with gap 0.19 (15.85 = 100): " + "  ".join(f"{x['rate']:.2f}:{x[0.19]/base[0.19]*100:.1f}" for x in res))
print("relative clear speed with gap 0    (15.85 = 100): " + "  ".join(f"{x['rate']:.2f}:{x[0]/base[0]*100:.1f}" for x in res))
