// Best-possible archgun riven (max roll W = 1.1, disposition 1.2; wiki Riven Mods: 3+1 bonus 0.9375, 2+1 bonus 1.2375)
// with a harmless negative (−Status Chance: Profit-Taker is status-immune). Archgun base values (wiki table, rank 8).
const { MODS } = require("./opt.js"); const R2 = require("./run2.js"); const K = require("./kuva_grattler.js");
const BASE = { dmg: 0.999, ms: 0.603, fr: 0.6003, cc: 0.999, cd: 0.801, cold: 1.197, elec: 1.197, heat: 1.197, tox: 1.197, fac: 0.45, punct: 0.9, magp: 0.603, rl: 0.999, smag: 0.9 };
const ATTR = Object.keys(BASE);
function rivMod(attrs, L) {
  const m = { ko: "리벤" }; let fac = 1; const els = [];
  for (const a of attrs) {
    const v = BASE[a] * 1.2 * L * (rivMod.W || 1.1);
    if (["cold", "elec", "heat", "tox"].includes(a)) els.push([a, v]);
    else if (a === "fac") fac = 1 + v;
    else if (a === "punct") m.ips = { punct: v };
    else if (a === "smag") m.pre = { mag: v };
    else m[a] = v;
  }
  if (els.length === 1) m.el = els[0];
  m._els = els; return { m, fac };
}
function* combos(arr, k, start = 0, cur = []) { if (cur.length === k) { yield cur.slice(); return; } for (let i = start; i < arr.length; i++) { cur.push(arr[i]); yield* combos(arr, k, i + 1, cur); cur.pop(); } }
function perms(a) { if (a.length <= 1) return [a]; const r = []; a.forEach((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).forEach((p) => r.push([x].concat(p)))); return r; }
// riven with 2 elements: split into two pseudo-mods occupying the same slot position (adjacent in order)
function setRiv(rm) {
  delete MODS.riv; delete MODS.riv2;
  const base = Object.assign({}, rm); delete base._els; delete base.el;
  if (rm._els.length >= 1) base.el = rm._els[0];
  MODS.riv = base;
  if (rm._els.length >= 2) MODS.riv2 = { ko: "리벤(2번째 원소)", el: rm._els[1], _tie: "riv" };
}
function ordersFor(set) {
  const elm = set.filter((id) => MODS[id].el), rest = set.filter((id) => !MODS[id].el);
  let ps = elm.length <= 5 ? perms(elm) : [elm];
  if (MODS.riv2) ps = ps.filter((p) => Math.abs(p.indexOf("riv") - p.indexOf("riv2")) === 1); // same slot: riven's two elements are consecutive
  return ps.map((p) => rest.concat(p));
}
const B = { overMs: 1.575, deFrac: 0 };
function kgBest(set, opt) { let best = null; for (const b of ordersFor(set)) for (const val of ["mag", "cold", "elec"]) { const r = K.scoreKG(b, Object.assign({}, opt, { val })); if (!best || r.s > best.s) best = { ids: b, val, s: r.s, r }; } return best; }
function mBest(set, opt) { let best = null; for (const b of ordersFor(set)) { const r = R2.score(b, opt); if (!r.r12.tH.heat) continue; if (!best || r.s > best.s) best = { ids: b, s: r.s, r }; } return best; }
const pool = ["prb", "sabot", "pdr", "cb", "mc", "at", "ps", "hb", "ppm", "peb", "pcr", "pvc", "hs", "cbul", "mag", "cc_", "qd", "cbl", "pde", "me", "qr"];
const grpOk = (s) => { const g = {}; for (const id of s) { const gg = MODS[id] && MODS[id].grp; if (gg) { if (g[gg]) return false; g[gg] = 1; } } return true; };
function local(start, bestFn, opt) {
  // start: 8-slot set incl. riv (and riv2 riding along)
  let cur = bestFn(start, opt); if (!cur) return null; let improved = true;
  while (improved) {
    improved = false;
    const slots = cur.ids.filter((x) => x !== "riv" && x !== "riv2");
    let cand = null;
    for (const out of slots) for (const inn of pool) {
      if (cur.ids.includes(inn)) continue;
      const s = cur.ids.filter((x) => x !== out).concat([inn]); if (!grpOk(s)) continue;
      const r = bestFn(s, opt); if (r && r.s > (cand ? cand.s : cur.s) * 1.0000001) cand = r;
    }
    if (cand) { cur = cand; improved = true; }
    if (cur.ids.filter((x) => x !== "riv2").length !== 8) throw new Error("slot count " + cur.ids.join(","));
  }
  return cur;
}
function rivenSearch(which, starts, opt, topN) {
  const bestFn = which === "kg" ? kgBest : mBest;
  const cfgs = [];
  for (const L of [0.9375, 1.2375]) for (const attrs of combos(ATTR, L === 0.9375 ? 3 : 2)) {
    if (attrs.filter((a) => a === "smag").length > 1) continue;
    if (attrs.filter((a) => ["cold", "elec", "heat", "tox"].includes(a)).length > 2) continue;
    cfgs.push({ attrs, L });
  }
  // screen: riven replaces each slot of the start builds
  const scr = [];
  for (const c of cfgs) {
    const { m, fac } = rivMod(c.attrs, c.L); setRiv(m);
    let best = 0;
    for (const st of starts) for (const out of st) {
      const s = st.filter((x) => x !== out).concat(MODS.riv2 ? ["riv", "riv2"] : ["riv"]);
      const r = bestFn(s, opt); if (r && r.s * fac > best) best = r.s * fac;
    }
    scr.push({ c, v: best });
  }
  scr.sort((a, b) => b.v - a.v);
  const out = [];
  for (const x of scr.slice(0, topN)) {
    const { m, fac } = rivMod(x.c.attrs, x.c.L); setRiv(m);
    let best = null;
    for (const st of starts) for (const o of st) {
      const s = st.filter((y) => y !== o).concat(MODS.riv2 ? ["riv", "riv2"] : ["riv"]);
      const r = local(s, bestFn, opt); if (r && (!best || r.s > best.s)) best = r;
    }
    out.push({ c: x.c, fac, s: best.s * fac, best, rm: m });
  }
  out.sort((a, b) => b.s - a.s); return out;
}
module.exports = { local, _kgBest: kgBest, rivenSearch, rivMod, setRiv, kgBest, mBest, B, BASE };
if (require.main === module) {
  const which = process.argv[2]; const opt = JSON.parse(process.argv[3] || JSON.stringify(B));
  const starts = which === "kg" ? [["prb", "pdr", "mc", "at", "hb", "ppm", "peb", "pcr"], ["prb", "pdr", "mc", "at", "ps", "hb", "ppm", "peb"], ["prb", "pdr", "mc", "at", "hb", "qr", "ppm", "peb"]]
    : [["pdr", "mc", "hb", "ppm", "at", "peb", "pcr", "prb"], ["prb", "pdr", "mc", "at", "ps", "hb", "ppm", "peb"]];
  const t0 = Date.now(); const res = rivenSearch(which, starts, opt, +(process.argv[4] || 12));
  const X2m = ["pdr", "mc", "hb", "ppm", "at", "peb", "pcr", "prb"]; delete MODS.riv; delete MODS.riv2;
  const mRef = R2.bestOrder(X2m, opt).r.s * 2 / 3; // Mausolon no riven, PT DR
  const dr = which === "kg" ? 1 : 2 / 3;
  for (const x of res.slice(0, 8)) console.log((100 * x.s * dr / mRef).toFixed(1) + "% of Mausolon(no riven)", (x.c.L > 1 ? "2+1" : "3+1"), x.c.attrs.join("+"), "| val", x.best.val || "-", "|", x.best.ids.join(","), "| P12", (x.best.r.r12.dps * x.fac * dr / (R2.bestOrder(X2m, opt).r.r12.dps * 2 / 3)).toFixed(2), "P34", (x.best.r.r34.dps * x.fac * dr / (R2.bestOrder(X2m, opt).r.r34.dps * 2 / 3)).toFixed(2));
  console.log("sec", (Date.now() - t0) / 1000);
}
