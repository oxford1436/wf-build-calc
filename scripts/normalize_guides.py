#!/usr/bin/env python3
"""Puts the game's official Korean ability names (data/raw/ko.json) into guide files. Usage: normalize_guides.py <guide.json>..."""
import json, sys
ko = json.load(open("data/raw/ko.json", encoding="utf-8"))
wf = json.load(open("data/raw/Warframes.json", encoding="utf-8"))
by_en = {f["name"].lower(): f for f in wf if f.get("productCategory") == "Suits" and not f.get("isPrime")}
for path in sys.argv[1:]:
    g = json.load(open(path, encoding="utf-8"))
    f = by_en.get(g.get("name_en", "").lower())
    if not f or g.get("duo"): print("skip", path); continue
    names = [a.get("abilityName") for a in (ko.get(f["uniqueName"], {}).get("abilities") or [])]
    if len(names) != 4: print("skip (abilities)", path, len(names)); continue
    changed = []
    for a in g["abilities"]:
        n = names[a["slot"] - 1] if 1 <= a["slot"] <= 4 else None
        if n and a.get("name_ko") != n: changed.append(f'{a["slot"]}: {a.get("name_ko")} → {n}'); a["name_ko"] = n
    if changed:
        json.dump(g, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1); print(path.split("/")[-1], "; ".join(changed))
