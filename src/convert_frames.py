import json, os, re
import sys
A = (sys.argv[1].rstrip("/") + "/") if len(sys.argv) > 1 else "/mnt/user-data/attachments/42cc711f-2e9b-52c3-b42e-347c041704d5/"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.abspath(__file__))
W = json.load(open(A + "Warframes.json"))
KO = json.load(open(A + "ko.json", encoding="utf-8")) if os.path.exists(A + "ko.json") else {}

frames = []
for w in W:
    if w.get("type") != "Warframe" or w.get("productCategory") != "Suits":
        continue
    base = re.sub(r" (Prime|Umbra)$", "", w["name"])
    k = KO.get(w["uniqueName"]) or {}
    ab = []
    kab = {x.get("abilityUniqueName"): x for x in (k.get("abilities") or [])}
    for a in w.get("abilities") or []:
        ab.append({"id": a["uniqueName"].split("/")[-1], "en": a["name"], "ko": (kab.get(a["uniqueName"]) or {}).get("abilityName") or a["name"]})
    frames.append({"id": re.sub(r"[^a-z0-9]+", "_", w["name"].lower()).strip("_"), "base": base, "en": w["name"], "ko": k.get("name") or w["name"], "power": w.get("power"), "abilities": ab})
frames.sort(key=lambda f: f["ko"])
with open(os.path.join(OUT, "frames.js"), "w", encoding="utf-8") as f:
    f.write("(function(root){root.WF_FRAMES=" + json.dumps(frames, ensure_ascii=False, separators=(",", ":")) + ";})(typeof self!=='undefined'?self:globalThis);\n")
print(len(frames), os.path.getsize(os.path.join(OUT, "frames.js")))
