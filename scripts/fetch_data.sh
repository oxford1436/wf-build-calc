#!/usr/bin/env bash
# Downloads the WFCD warframe-items JSON files the calculator is built from.
set -euo pipefail
OUT="${1:-data/raw}"
mkdir -p "$OUT"
BASE="https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json"
for f in Primary Secondary Melee Mods Arcanes Warframes Misc; do
  curl -sSL "$BASE/$f.json" -o "$OUT/$f.json"
done
curl -sSL "https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json/i18n.json" -o "$OUT/i18n.json" || true
# wiki weapon database (max ammo, ammo pickup, ammo cost, projectile speed) — Module:Weapons/data/*
for s in primary secondary melee; do
  curl -sSL "https://wiki.warframe.com/w/Module:Weapons/data/${s}?action=raw" -o "$OUT/wiki_${s}.lua" || true
done
# Zaw / Kitgun parts
curl -sSL "https://wiki.warframe.com/w/Module:Modular/data?action=raw" -o "$OUT/wiki_modular.lua" || true
# ko.json: Korean names keyed by uniqueName (extracted from i18n.json)
python3 - "$OUT" <<'PY'
import json, sys, os
out = sys.argv[1]
p = os.path.join(out, "i18n.json")
if os.path.exists(p) and os.path.getsize(p) > 100:
    d = json.load(open(p, encoding="utf-8"))
    ko = {}
    for k, v in d.items():
        if isinstance(v, dict) and "ko" in v:
            ko[k] = v["ko"]
    json.dump(ko, open(os.path.join(out, "ko.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print("ko.json", len(ko))
PY
