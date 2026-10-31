#!/usr/bin/env python3
"""Warframe mods for the frame build calculator: data/frame_mods.js = WF_FRAME_MODS (every warframe mod at max rank with
parsed ability/survival stats, Korean name and text, capacity drain, polarity, exilus/aura/augment flags) and WF_FRAME_POL
(each frame's slot polarities). Usage: convert_frame_mods.py <raw dir> <out dir>."""
import json, os, re, sys
A = sys.argv[1].rstrip("/") + "/"; OUT = sys.argv[2]
mods = json.load(open(A + "Mods.json", encoding="utf-8"))
ko = json.load(open(A + "ko.json", encoding="utf-8"))
wf = json.load(open(A + "Warframes.json", encoding="utf-8"))
STAT = [(r"Ability Strength", "str"), (r"Ability Duration", "dur"), (r"Ability Range", "rng"), (r"Ability Efficiency", "eff"),
        (r"Energy Max", "energy"), (r"Health$", "hp"), (r"Shield Capacity$", "sh"), (r"Armor$", "ar"), (r"Casting Speed", "cast")]
out, seen = [], {}
for m in mods:
    if m.get("type") != "Warframe Mod" or not m.get("levelStats"): continue
    name = m["name"]
    if name.startswith(("Flawed ", "Peculiar ")): continue
    lines = m["levelStats"][-1].get("stats") or []
    stats = {}
    for l in lines:
        mm = re.match(r"^([+-]?\d+(?:\.\d+)?)%\s+(.+?)\s*$", l.split("\n")[0])
        if not mm: continue
        for rx, k in STAT:
            if re.search(rx, mm.group(2)) and not re.search(r"Recharge|Resistance|Orb", mm.group(2)):
                stats[k] = stats.get(k, 0) + float(mm.group(1)) / 100
    k_ = ko.get(m["uniqueName"], {})
    kl = (k_.get("levelStats") or [{}])[-1].get("stats") or []
    compat = m.get("compatName") or "WARFRAME"
    e = {"id": re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_"), "en": name, "ko": k_.get("name") or name, "compat": compat,
         "ex": bool(m.get("isExilus")), "drain": (m.get("baseDrain") or 0) + (m.get("fusionLimit") or 0) * (1 if (m.get("baseDrain") or 0) >= 0 else -1),
         "pol": m.get("polarity"), "fam": re.sub(r"^(Primed|Umbral|Archon|Galvanized) ", "", name), "umbral": name.startswith("Umbral "),
         "stats": stats, "text": [re.sub(r"<[^>]+>", "", x).replace("\\n", " ") for x in (kl or lines)]}
    if compat == "AURA": e["drain"] = -abs(m.get("baseDrain") or 0) - (m.get("fusionLimit") or 0)
    # keep one entry per name: the highest rank variant (e.g. Aviator exilus 3 ranks vs 10 ranks)
    if name in seen:
        prev = out[seen[name]]
        if abs(e["drain"]) > abs(prev["drain"]): e["ex"] = e["ex"] or prev["ex"]; out[seen[name]] = e
        else: prev["ex"] = prev["ex"] or e["ex"]
        continue
    seen[name] = len(out); out.append(e)
pol = {}
for f in wf:
    if f.get("productCategory") != "Suits": continue
    pol[f["name"]] = {"slots": f.get("polarities") or [], "aura": f.get("aura"), "power": f.get("power"), "health": f.get("health"), "shield": f.get("shield"), "armor": f.get("armor")}
arcs = []
for a in json.load(open(A + "Arcanes.json", encoding="utf-8")):
    if "Warframe" not in (a.get("type") or ""): continue
    k_ = ko.get(a["uniqueName"], {})
    kl = (k_.get("levelStats") or [{}])[-1].get("stats") or []
    en_l = (a.get("levelStats") or [{}])[-1].get("stats") or []
    arcs.append({"en": a["name"], "ko": k_.get("name") or a["name"], "text": [re.sub(r"<[^>]+>", "", x).replace("\\n", " ").replace("\n", " ") for x in (kl or en_l)]})
with open(os.path.join(OUT, "frame_mods.js"), "w", encoding="utf-8") as fh:
    fh.write("(function(root){root.WF_FRAME_MODS=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";root.WF_FRAME_POL="
             + json.dumps(pol, ensure_ascii=False, separators=(",", ":")) + ";root.WF_FRAME_ARCS=" + json.dumps(arcs, ensure_ascii=False, separators=(",", ":")) + ";})(typeof self!=='undefined'?self:globalThis);\n")
print("frame mods", len(out), "with stats", sum(1 for e in out if e["stats"]))
