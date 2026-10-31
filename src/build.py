import os
import sys
d=os.path.dirname(os.path.abspath(__file__))
DATA=sys.argv[1] if len(sys.argv)>1 else d
OUTF=sys.argv[2] if len(sys.argv)>2 else os.path.join(d,"index.html")
rd=lambda f: open(os.path.join(d,f),encoding="utf-8").read()
rdd=lambda f: open(os.path.join(DATA,f),encoding="utf-8").read()
src = rd("changelog.js")+"\n"+rd("engine.js")+"\n"+(rdd("mods_ko.js") if os.path.exists(os.path.join(DATA,"mods_ko.js")) else "")+"\n"+rd("mods.js")+"\n"+rd("buffs.js")+"\n"+(rdd("frames.js") if os.path.exists(os.path.join(DATA,"frames.js")) else "")+"\n"+rd("weapons_builtin.js")+"\n"
if os.path.exists(os.path.join(DATA,"weapons_full.js")): src += rdd("weapons_full.js")+"\n"
assert "</script" not in src
import datetime
import json, glob
# warframe guides: one JSON per frame in data/guides (researched community builds, ability roles, breakpoints)
# the page only lists which guides exist; each guide loads from data/guides/<id>.json when opened
gids = []
for f in sorted(glob.glob(os.path.join(DATA, "guides", "*.json"))):
    g = json.load(open(f, encoding="utf-8")); assert g["id"] == os.path.basename(f)[:-5], f; gids.append(g["id"])
guide_js = "window.WF_GUIDE_IDS = " + json.dumps(gids) + ";\n" + rd("guide_list.js") + "\n" + (rdd("frame_mods.js") if os.path.exists(os.path.join(DATA, "frame_mods.js")) else "") + "\n" + rd("framecalc.js") + "\n" + rd("guide.js") + "\n"
html = rd("shell.html").replace("__BUILD_DATE__", datetime.date.today().isoformat()).replace("/*__SRC__*/", src).replace("/*__SRC_EXEC__*/", src).replace("/*__APP__*/", guide_js + rd("ocr.js") + "\n" + rd("app.js"))
open(OUTF,"w",encoding="utf-8").write(html)
print("ok", len(html))
