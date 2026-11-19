# 2026-11-19: job generator for the unified Boar Prime (Cyte-09) simulation (README 후속 15).
# usage: python3 boar_sim_gen.py <outdir>  -> job_<faction>.json (+ job_<faction>_vs.json for Vicious Spread builds, pellets scaled for the wider cone)
import json, sys, itertools
RIV = [["ms", 1.48], ["fr", 1.093], ["cd", 1.096], ["x_ammo", -0.855]]          # the user's riven (Sati-acridra)
CORE = ["Riven", "Galvanized Hell"]
FAC = {"grineer": ("ClG", "Primed Cleanse Grineer"), "corpus": ("ClC", "Primed Cleanse Corpus"), "infested": ("ClI", "Primed Cleanse Infested"), "corrupted": ("ClO", "Primed Cleanse Orokin")}
CAND = {"CD": "Critical Deceleration", "CL": None, "Ba": "Shotgun Barrage", "Fr": "Frail Momentum", "AB": "Accelerated Blast", "MS": "Magnetic Strafe", "Ra": "Primed Ravage", "PB": "Primed Point Blank",
        "El": "Shotgun Elementalist", "CS": "Primed Charged Shell", "AS": "Primed Ammo Stock", "BM": "Burdened Magazine", "VS": "Vicious Spread", "Sv": "Galvanized Savvy"}
D3 = 3 * 6 / (3.141592653589793 * 7.9 * 7.9)
# c = share of one shot's pellets that lands on one enemy = 1.08 m² / max(cone area, pack area); Practiced Grip (spread 5–15°): the cone stays inside the pack out to ~30 m
CONDS = [("A pack r7.9", 0.0055, None, 0.75), ("B dense <17m", 0.0165, D3, 0.73), ("C dense 25m", 0.0077, D3, 0.36)]   # last = pellet factor for Vicious Spread (cone ×1.6)
def vars_(f, vs):
    v = []
    for name, c, dens, k in CONDS:
        o = {"killRamp": False}
        if dens: o["density"] = dens
        v.append({"v": name, "pel": c / 0.05 * (k if vs else 1), "o": o, "level": 65, "steel": False, "factions": [f]})
    return v
if __name__ == "__main__":
    out = sys.argv[1]
    for f, (tag, cl) in FAC.items():
        norm, vsb = [], []
        for combo in itertools.combinations(CAND, 6):
            b = {"n": tag + " " + "+".join(combo), "mods": CORE + [cl if k == "CL" else CAND[k] for k in combo], "arcane": "primary_merciless", "rivStats": RIV}
            (vsb if "VS" in combo else norm).append(b)
        for name, builds, vs in (("", norm, False), ("_vs", vsb, True)):
            json.dump([{"name": f + name, "cfg": "boar", "evo": {"2": 0, "3": 2, "4": 1}, "cast": "0", "vars": vars_(f, vs), "builds": builds}], open(f"{out}/job_{f}{name}.json", "w"), ensure_ascii=False)
        print(f, len(norm), len(vsb))
