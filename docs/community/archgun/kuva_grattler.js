// Kuva Grattler (Heavy Weapon/Mech stats) vs Profit-Taker Orb, same mod pool / scenario as opt.js (Mausolon).
// Wiki (read 2026-11-07): Module:Weapons/data/archwing "Kuva Grattler (Atmosphere)": Projectile Impact I14 P112 S14, CC .27, CD 2.0,
// FR 5.55, mag 60, reload 2.5; Explosion Blast 235, 9 m, falloff 100%→30%, multishot 1 per projectile. Kuva Grattler page Bugs:
// "in Heavy Weapon/Mech mode it has the same 2.0x critical multiplier". Valence 25–60% of base (max 60%, Elemental Vice swaps type).
// Profit-Taker: Kuva Grattler / Mausolon have unique archgun DR "adjusted to keep their damage output the same" as before U35
// → effective = pre-U35 values: Kuva Grattler 94/140 (projectile), 155/235 (blast); Mausolon 120/180, 48/72.
const { MODS } = require("./opt.js");
const { evalBuild } = require("./opt.js");
const FM = { punct: 1.5, mag: 1.5 };
const COMBO = { "heat+cold": "blast", "heat+elec": "rad", "heat+tox": "gas", "cold+elec": "mag", "cold+tox": "viral", "elec+tox": "corr" };
const comb = (a, b) => COMBO[a + "+" + b] || COMBO[b + "+" + a];
const PRIM = ["heat", "cold", "elec", "tox"];
function simE(base, ms, hits, N = 200000) {
  let s = 7; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  let e = 0, cnt = 0, sh = 0, nh = 0, sx = 0, nx = 0;
  const roll = (cc) => Math.floor(cc) + (rnd() < cc - Math.floor(cc) ? 1 : 0);
  for (let t = 0; t < N; t++) {
    let big = false; const cc = base + e;
    const np = Math.floor(ms) + (rnd() < ms - Math.floor(ms) ? 1 : 0);
    for (let p = 0; p < np; p++) { if (roll(cc) >= 2) big = true; sh += cc; nh++; }
    e += 0.1;
    if (hits > 1) { const c2 = base + e; for (let p = 0; p < np; p++) { if (roll(c2) >= 2) big = true; sx += c2; nx++; } e += 0.1; }
    if (big) { cnt++; if (cnt >= 6) { e = 0; cnt = 0; } }
  }
  return { h: sh / nh, x: nx ? sx / nx : base };
}
const cache = {};
function evalKG(ids, opt) {
  const o = Object.assign({ overMs: 0, enervate: true, cdFlat: 1.2, xf: 1, deFrac: 0, val: "mag", valPct: 0.6, reload: 2.5, dr: true }, opt);
  let dmg = 1, ms = 1 + o.overMs, fr = 1, cc = 1, cdm = 1, magp = 1, rl = 1;
  const pre = {}, ips = { impact: 1, punct: 1 }; const els = []; let de = null;
  for (const id of ids) {
    const m = MODS[id]; if (!m) throw new Error(id);
    dmg += m.dmg || 0; ms += m.ms || 0; fr += m.fr || 0; cc += m.cc || 0; cdm += m.cd || 0; magp += m.magp || 0; rl += m.rl || 0;
    if (m.pre) for (const k in m.pre) pre[k] = (pre[k] || 0) + m.pre[k];
    if (m.ips) for (const k in m.ips) ips[k] += m.ips[k];
    if (m.el) els.push(m.el); if (m.de) de = m;
  }
  const order = [], amt = {};
  for (const [t, v] of els) { if (!(t in amt)) { order.push(t); amt[t] = 0; } amt[t] += v; }
  function table(base0, fixed) {
    const Btot = base0 * (1 + o.valPct);
    const out = {}, mp = {}; const singles = [];
    for (let i = 0; i < order.length; i += 2) {
      if (i + 1 < order.length) { const c = comb(order[i], order[i + 1]); out[c] = (out[c] || 0) + (amt[order[i]] + amt[order[i + 1]]) * Btot; mp[order[i]] = c; mp[order[i + 1]] = c; }
      else { singles.push(order[i]); out[order[i]] = (out[order[i]] || 0) + amt[order[i]] * Btot; }
    }
    const v = base0 * o.valPct;
    if (v > 0) {
      if (!PRIM.includes(o.val)) out[o.val] = (out[o.val] || 0) + v;
      else if (mp[o.val]) out[mp[o.val]] += v;
      else if (singles.length) { const s = singles.shift(); const c = comb(s, o.val); if (c) { out[c] = (out[c] || 0) + out[s] + v; delete out[s]; } else out[s] += v; }
      else out[o.val] = (out[o.val] || 0) + v;
    }
    for (const k in pre) if (pre[k]) out[k] = (out[k] || 0) + pre[k] * Btot;
    for (const k in fixed) out[k] = (out[k] || 0) + fixed[k];
    return out;
  }
  const tH = table(140, { impact: 14 * ips.impact, punct: 112 * ips.punct, slash: 14 });
  const tX = table(235, { blast: 235 });
  const eff = (t) => { let s = 0; for (const k in t) s += t[k] * (FM[k] || 1); return s; };
  const rate = 5.55 * fr, mag = Math.round(60 * magp), reload = o.reload / rl;
  const tMag = mag / rate, up = tMag / (tMag + reload);
  const ccBase = 0.27 * cc, cd = 2.0 * cdm + o.cdFlat;
  const hits = o.xf > 0 ? 2 : 1;
  const key = ccBase.toFixed(2) + "|" + ms.toFixed(2) + "|" + hits + "|" + o.enervate;
  if (!cache[key]) cache[key] = o.enervate ? simE(ccBase, ms, hits) : { h: ccBase, x: ccBase };
  const ccE = cache[key];
  let dmgAvg = dmg; if (de) dmgAvg += de.de * o.deFrac * Math.min(1, de.dur / tMag);
  const drH = o.dr ? 94 / 140 : 1, drX = o.dr ? 155 / 235 : 1;
  const hitD = dmgAvg * eff(tH) * ms * (1 + ccE.h * (cd - 1)) * drH;
  const expD = dmgAvg * eff(tX) * ms * (1 + ccE.x * (cd - 1)) * o.xf * drX;
  return { dps: (hitD + expD) * rate * up, hitD, expD, rate, mag, up, ms, ccBase, ccH: ccE.h, ccX: ccE.x, cd, tH, tX };
}
function* combos(arr, k, start = 0, cur = []) { if (cur.length === k) { yield cur.slice(); return; } for (let i = start; i < arr.length; i++) { cur.push(arr[i]); yield* combos(arr, k, i + 1, cur); cur.pop(); } }
function perms(a) { if (a.length <= 1) return [a]; const r = []; a.forEach((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).forEach((p) => r.push([x].concat(p)))); return r; }
// phases 1-2 (explosion factor xf) and 3-4 (explosion immune unless head within 9 m: factor xf34) — equal work, harmonic mean
function scoreKG(b, opt) {
  const r12 = evalKG(b, Object.assign({}, opt, { xf: opt.xf == null ? 1 : opt.xf })), r34 = evalKG(b, Object.assign({}, opt, { xf: opt.xf34 || 0 }));
  return { s: 2 / (1 / r12.dps + 1 / r34.dps), r12, r34 };
}
function bestKG(set, opt, vals = ["mag", "cold", "elec"]) {
  const elm = set.filter((id) => MODS[id].el), rest = set.filter((id) => !MODS[id].el);
  let best = null;
  for (const val of vals) for (const p of (elm.length <= 4 ? perms(elm) : [elm])) {
    const b = rest.concat(p); const r = scoreKG(b, Object.assign({}, opt, { val }));
    if (!best || r.s > best.r.s) best = { ids: b, val, r };
  }
  return best;
}
function searchKG(opt, pool, n = 10) {
  let top = [];
  for (const c of combos(pool, 8)) {
    const g = {}; let ok = true; for (const id of c) { const gg = MODS[id].grp; if (gg) { if (g[gg]) { ok = false; break; } g[gg] = 1; } } if (!ok) continue;
    const b = bestKG(c, opt); top.push(b);
    if (top.length > 400) { top.sort((x, y) => y.r.s - x.r.s); top = top.slice(0, 80); }
  }
  top.sort((x, y) => y.r.s - x.r.s); return top.slice(0, n);
}
module.exports = { evalKG, scoreKG, bestKG, searchKG };
