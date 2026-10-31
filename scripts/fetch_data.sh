#!/usr/bin/env bash
# Downloads the data the calculator is built from (WFCD warframe-items + wiki data modules).
# A failed or broken download keeps the previous copy in data/raw, so a bad day never breaks the page.
set -uo pipefail
OUT="${1:-data/raw}"
mkdir -p "$OUT"

fetch() {  # url, destination, kind (json|lua)
  local url="$1" dest="$2" kind="$3" tmp
  tmp="$(mktemp)"
  if curl -fsSL --retry 3 --max-time 300 "$url" -o "$tmp" && python3 - "$tmp" "$kind" <<'PY'
import json, sys
path, kind = sys.argv[1], sys.argv[2]
text = open(path, encoding="utf-8", errors="replace").read()
if kind == "json":
    json.loads(text)
else:
    assert len(text) > 1000 and "return" in text[:5000], "not a Lua data module"
PY
  then mv "$tmp" "$dest"; echo "ok    $dest"
  else rm -f "$tmp"; echo "keep  $dest (download failed or invalid — using the previous copy)"; fi
}

BASE="https://raw.githubusercontent.com/WFCD/warframe-items/master/data/json"
for f in Primary Secondary Melee Mods Arcanes Warframes Misc; do
  fetch "$BASE/$f.json" "$OUT/$f.json" json
done
# Korean names and mod texts (keyed by uniqueName)
fetch "$BASE/i18n/ko.json" "$OUT/ko.json" json
# wiki weapon database (ammo, forced procs, polarities, zoom, exalted weapons) and Zaw/Kitgun parts
for s in primary secondary melee; do
  fetch "https://wiki.warframe.com/w/Module:Weapons/data/${s}?action=raw" "$OUT/wiki_${s}.lua" lua
done
fetch "https://wiki.warframe.com/w/Module:Modular/data?action=raw" "$OUT/wiki_modular.lua" lua
# Incarnon evolution tables (wiki pages); keeps the previous copy if the download or parse fails
python3 "$(dirname "$0")/fetch_incarnon.py" "$OUT/incarnon_evos.json" || echo "keep  $OUT/incarnon_evos.json"

for f in Primary Secondary Melee Mods Arcanes Warframes; do
  [ -s "$OUT/$f.json" ] || { echo "missing $OUT/$f.json — cannot build"; exit 1; }
done
