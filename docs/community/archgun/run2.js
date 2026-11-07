const { evalBuild, MODS } = require("./opt.js");
const ids = Object.keys(MODS);
function* combos(arr, k, start = 0, cur = []) { if (cur.length === k) { yield cur.slice(); return; } for (let i = start; i < arr.length; i++) { cur.push(arr[i]); yield* combos(arr, k, i + 1, cur); cur.pop(); } }
function perms(a) { if (a.length <= 1) return [a]; const r = []; a.forEach((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).forEach((p) => r.push([x].concat(p)))); return r; }
// score = phases 1-2 (explosion hits) and 3-4 (explosion immune) with equal work: total time ∝ 1/d12 + 1/d34
function score(b, opt) {
  const r12 = evalBuild(b, Object.assign({}, opt, { explW: 1 })), r34 = evalBuild(b, Object.assign({}, opt, { explW: 0 }));
  return { s: 2 / (1 / r12.dps + 1 / r34.dps), r12, r34 };
}
function bestOrder(set, opt) {
  const elm = set.filter((id) => MODS[id].el), rest = set.filter((id) => !MODS[id].el);
  let best = null;
  for (const p of (elm.length <= 4 ? perms(elm) : [elm])) { const b = rest.concat(p); const r = score(b, opt); if (!r.r12.tH.heat) continue; if (!best || r.s > best.r.s) best = { ids: b, r }; }
  return best;
}
function search(opt, pool = ids, n = 12) {
  let top = [];
  for (const c of combos(pool, 8)) {
    const g = {}; let ok = true; for (const id of c) { const gg = MODS[id].grp; if (gg) { if (g[gg]) { ok = false; break; } g[gg] = 1; } } if (!ok) continue;
    const b = bestOrder(c, opt); if (!b) continue;
    top.push(b); if (top.length > 300) { top.sort((x, y) => y.r.s - x.r.s); top = top.slice(0, 60); }
  }
  top.sort((x, y) => y.r.s - x.r.s); return top.slice(0, n);
}
module.exports = { search, score, bestOrder };
if (require.main === module) {
  const sc = JSON.parse(process.argv[2] || "{}");
  const pool = process.argv[3] ? ids.filter((i) => !process.argv[3].split(",").includes(i)) : ids;
  const r = search(sc, pool);
  const ref = r[0].r.s;
  for (const x of r.slice(0, 6)) console.log((100 * x.r.s / ref).toFixed(1), x.ids.map((i) => MODS[i].ko).join(", "), "| ms", x.r.r12.ms.toFixed(2), "cc12/34", x.r.r12.ccH.toFixed(2) + "/" + x.r.r34.ccH.toFixed(2), "cd", x.r.r12.cd.toFixed(2), "fr", x.r.r12.rate.toFixed(2), "expl share", (x.r.r12.expD / (x.r.r12.expD + x.r.r12.hitD)).toFixed(3));
  const u = ["pdr", "mc", "cb", "pm", "at", "eb", "ps", "prb"]; const us = score(u, sc);
  console.log("user build", (100 * us.s / ref).toFixed(1));
}
