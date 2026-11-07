const RV = require("./kg_riven.js"); const { MODS } = require("./opt.js"); const R2 = require("./run2.js"); const K = require("./kuva_grattler.js");
const sc = JSON.parse(process.argv[2]);
const B = Object.assign({ overMs: 1.575, deFrac: 0 }, sc.opt || {});
const startsK = [["prb", "pdr", "mc", "at", "hb", "ppm", "peb", "pcr"], ["prb", "pdr", "mc", "at", "ps", "hb", "ppm", "peb"], ["prb", "pdr", "mc", "at", "hb", "qr", "ppm", "peb"]];
const X2m = ["pdr", "mc", "hb", "ppm", "at", "peb", "pcr", "prb"];
delete MODS.riv; delete MODS.riv2; const mref = R2.bestOrder(X2m, B).r.s * 2 / 3;
for (const [attrs, L, W] of sc.cfgs) {
  RV.rivMod.W = W; const { m, fac } = RV.rivMod(attrs, L); RV.setRiv(m);
  let best = null;
  for (const st of startsK) for (const o of st) { const s = st.filter((y) => y !== o).concat(MODS.riv2 ? ["riv", "riv2"] : ["riv"]); const r = RV.local(s, kgBestF, B); if (r && (!best || r.s > best.s)) best = r; }
  console.log(attrs.join("+"), L > 1 ? "2+1" : "3+1", "W" + W, (100 * best.s * fac / mref).toFixed(1) + "%", best.ids.join(","), best.val);
}
function kgBestF(set, opt) { return RV._kgBest(set, opt); }
