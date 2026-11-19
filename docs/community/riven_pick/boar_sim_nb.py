# 2026-11-19: neighbourhood check for the unified Boar Prime simulation (README 후속 15) — the base build plus every single-slot swap
# with any mod the app would consider (mc_detail.js j.nb). usage: python3 boar_sim_nb.py <outdir> <label> <code,code,...>  (codes as in boar_sim_gen.py)
import json, sys
from boar_sim_gen import RIV, FAC, CAND, vars_
out, label, codes = sys.argv[1], sys.argv[2], sys.argv[3].split("+")
for f, (tag, cl) in FAC.items():
    base = ["Riven", "Galvanized Hell"] + [cl if k == "CL" else CAND[k] for k in codes]
    keep = [0] + [i for i, n in enumerate(base) if n == cl]
    json.dump([{"name": f + "_nb", "cfg": "boar", "evo": {"2": 0, "3": 2, "4": 1}, "cast": "0", "vars": vars_(f, False),
                "nb": {"base": base, "keep": keep, "tag": tag, "arcane": "primary_merciless", "rivStats": RIV, "mag0": 20}}], open(f"{out}/nbjob_{label}_{f}.json", "w"), ensure_ascii=False)
