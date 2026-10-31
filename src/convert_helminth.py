#!/usr/bin/env python3
"""Helminth ability list for the weapon calculator's frame box: every ability the Helminth can give (its own 13 and the 66
the wiki's "Subsumable Ability Checklist" lists, data/raw/helminth_wiki.json), with the official Korean name and a rough
kind from the wiki's gameplay role: dmg (damage or strength buff), strip (armor/defense strip), group (pulls enemies
together), util (healing, movement, energy, crowd control without grouping). Usage: convert_helminth.py <raw dir> <out dir>"""
import json, os, sys
RAW, OUT = sys.argv[1], sys.argv[2]
W = json.load(open(os.path.join(RAW, "Warframes.json"), encoding="utf-8"))
KO = json.load(open(os.path.join(RAW, "ko.json"), encoding="utf-8"))
wiki = json.load(open(os.path.join(RAW, "helminth_wiki.json"), encoding="utf-8"))
ab_ko, fr_ko = {}, {}
for w in W:
    k = KO.get(w["uniqueName"]) or {}
    fr_ko[w["name"]] = k.get("name") or w["name"]
    for a in w.get("abilities") or []:
        n = (KO.get(a["uniqueName"]) or {}).get("name")
        if n and a["name"] not in ab_ko: ab_ko[a["name"]] = n
        # ko.json keeps ability names under the frame entry too
    for a in k.get("abilities") or []:
        u = a.get("abilityUniqueName") or a.get("uniqueName")
        if a.get("abilityName") and u:
            en = next((x["name"] for x in w.get("abilities") or [] if x["uniqueName"] == u), None)
            if en and en not in ab_ko: ab_ko[en] = a["abilityName"]
GROUP = {"Larva", "Pull", "Coil Horizon", "Ensnare", "Webbed Embrace", "Vortex"}
def kind(name, role):
    r = role.lower()
    if name in GROUP: return "group"
    if "damage buff" in r or "strength buff" in r: return "dmg"
    if "armor strip" in r or "defense strip" in r: return "strip"
    return "util"
abl = {k.lower(): v for k, v in ab_ko.items()}
ab_ko_get = lambda n: ab_ko.get(n) or abl.get(n.lower(), n)
out = []
helm = next(w for w in W if w["name"] == "Helminth")
NATIVE_KIND = {"Empower": "dmg", "Marked For Death": "dmg", "Energized Munitions": "dmg", "Sickening Pulse": "dmg", "Expedite Suffering": "dmg"}
for a in helm["abilities"]:
    out.append({"en": a["name"], "ko": ab_ko_get(a["name"]), "frame": "헬민스 고유", "kind": NATIVE_KIND.get(a["name"], "util")})
for r in wiki:
    if not r.get("ability"): continue
    out.append({"en": r["ability"], "ko": ab_ko_get(r["ability"]), "frame": fr_ko.get(r["frame"], r["frame"]), "kind": kind(r["ability"], r.get("role") or "")})
with open(os.path.join(OUT, "helminth.js"), "w", encoding="utf-8") as f:
    f.write("(function(root){root.WF_HELMINTH=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";})(typeof self!=='undefined'?self:globalThis);\n")
print("helminth abilities", len(out), "without Korean name:", [x["en"] for x in out if x["ko"] == x["en"]][:10])
