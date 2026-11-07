// Mausolon (Atmosphere, Archgun Deployer) vs Profit-Taker Orb legs/body (Corpus: Puncture x1.5, Magnetic x1.5; status-immune; armor-reduction-immune)
// Sources (wiki, read 2026-11-07): Module:Weapons/data/archwing "Mausolon (Atmosphere)"; Profit-Taker Orb page (Phase 3/4 AoE immunity bug);
// Primary Bulwark / Overcharge / Plated Round / Compression, Secondary Enervate, Vex Armor, Nourish pages; Mods.json arch-gun mods.
const { sim } = require("./enervate.js");
const FM = { punct: 1.5, mag: 1.5 };                      // Damage/Magnetic: x1.5 to Corpus; Corpus vulnerable to Puncture
const COMBO = { "heat+cold": "blast", "heat+elec": "rad", "heat+tox": "gas", "cold+elec": "mag", "cold+tox": "viral", "elec+tox": "corr" };
const comb = (a, b) => COMBO[a + "+" + b] || COMBO[b + "+" + a];
const MODS = {
  prb: { ko: "프라임드 루비도-라인드 배럴", dmg: 1.87, grp: "rub" }, rb: { ko: "루비도-라인드 배럴", dmg: 1.0, grp: "rub" },
  sabot: { ko: "사봇 라운즈", dmg: 0.6 },
  pdr: { ko: "프라임드 듀얼 라운즈", ms: 1.1, grp: "dual" }, dr: { ko: "듀얼 라운즈", ms: 0.6, grp: "dual" },
  cb: { ko: "컨테인먼트 브리치", ms: 0.3, pre: { rad: 0.6 } },
  mc: { ko: "마그네타이즈드 사이클", fr: 0.3, pre: { mag: 0.6 } },
  at: { ko: "오토매틱 트리거", fr: 0.6 },
  ps: { ko: "패럴락스 스코프", cc: 1.0 },
  hb: { ko: "할로우드 불릿", cd: 0.8 },
  ppm: { ko: "프라임드 폴라 매거진", el: ["cold", 1.87], grp: "pol" }, pm: { ko: "폴라 매거진", el: ["cold", 1.2], grp: "pol" },
  peb: { ko: "프라임드 일렉트리파이드 배럴", el: ["elec", 1.87], grp: "ele" }, eb: { ko: "일렉트리파이드 배럴", el: ["elec", 1.2], grp: "ele" },
  pcr: { ko: "프라임드 컴버스천 라운즈", el: ["heat", 1.87], grp: "com" },
  pvc: { ko: "프라임드 베노머스 클립", el: ["tox", 1.87], grp: "ven" },
  hs: { ko: "하이포서믹 셸", el: ["cold", 0.6] }, cbul: { ko: "차지드 불릿", el: ["elec", 0.6] },
  mag: { ko: "마그마 챔버", el: ["heat", 0.6] }, cc_: { ko: "컨태미네이션 케이싱", el: ["tox", 0.6] },
  qd: { ko: "퀘이사 드릴", ips: { punct: 0.9 } }, cbl: { ko: "코멧 블라스트", ips: { impact: 0.9 } },
  pde: { ko: "프라임드 데들리 이피션시", de: 2.2, dur: 17, grp: "de" },
  me: { ko: "매거진 익스텐션", magp: 0.6 }, qr: { ko: "퀵 리로드", rl: 1.0 },
};
function evalBuild(ids, opt) {
  const o = Object.assign({ fury: 0, nourish: 0, bulwark: 0, overMs: 0, plated: false, enervate: true, cdFlat: 1.2, explW: 1, deFrac: 0.9, platedFrac: null, merciless: false }, opt);
  let dmg = 1 + o.fury + o.bulwark, ms = 1 + o.overMs, fr = 1, cc = 1, cdm = 1, magp = 1, rl = 1 + (o.merciless ? 0.3 : 0);
  const pre = { viral: o.nourish }, ips = { impact: 1, punct: 1 }; const els = [];
  let de = null;
  for (const id of ids) {
    const m = MODS[id]; if (!m) throw new Error(id);
    dmg += m.dmg || 0; ms += m.ms || 0; fr += m.fr || 0; cc += m.cc || 0; cdm += m.cd || 0; magp += m.magp || 0; rl += m.rl || 0;
    if (m.pre) for (const k in m.pre) pre[k] = (pre[k] || 0) + m.pre[k];
    if (m.ips) for (const k in m.ips) ips[k] += m.ips[k];
    if (m.el) els.push(m.el);
    if (m.de) de = m;
  }
  // element combination in slot order (best order chosen by caller via permutations of `ids`); innate heat goes last
  const order = []; const amt = {};
  for (const [t, v] of els) { if (!(t in amt)) { order.push(t); amt[t] = 0; } amt[t] += v; }
  const types = {}; // fraction-of-base amounts for modded elements, plus innate heat (separately in absolute units)
  const rate = 8.33 * fr, mag = Math.round(300 * magp), reload = (o.mReload || 2) / rl /* Necramech regenerate (Archwing data): 4 s delay + 300/200 = 5.5 s */;
  const tMag = mag / rate, up = tMag / (tMag + reload);
  // build per-hit type table: hitscan base I35 P70 H75 (base total 180); explosion H72
  function table(base, innateHeat, ipsBase) {
    const am = {}; const ord = order.slice(); const a2 = Object.assign({}, amt);
    for (const t of ord) am[t] = a2[t] * base;
    if (innateHeat > 0) { if ("heat" in am) am.heat += innateHeat; else { ord.push("heat"); am.heat = innateHeat; } }
    const out = {};
    for (let i = 0; i < ord.length; i += 2) {
      if (i + 1 < ord.length) { const c = comb(ord[i], ord[i + 1]); out[c] = (out[c] || 0) + am[ord[i]] + am[ord[i + 1]]; }
      else out[ord[i]] = (out[ord[i]] || 0) + am[ord[i]];
    }
    for (const k in pre) if (pre[k]) out[k] = (out[k] || 0) + pre[k] * base;
    for (const k in ipsBase) out[k] = (out[k] || 0) + ipsBase[k];
    return out;
  }
  const tH = table(180, 75, { impact: 35 * ips.impact, punct: 70 * ips.punct });
  const tX = table(72, 72, {});
  const eff = (t) => { let s = 0; for (const k in t) s += t[k] * (FM[k] || 1); return s; };
  // crit
  const ccBase = 0.3 * cc, cd = 2.2 * cdm + o.cdFlat;
  const hits = o.explW > 0 ? 2 : 1;
  const key = ccBase.toFixed(2) + "|" + ms.toFixed(2) + "|" + hits + "|" + o.enervate;
  if (!evalBuild.cache[key]) evalBuild.cache[key] = o.enervate ? simMaus(ccBase, ms, hits) : { h: ccBase, x: ccBase };
  const ccE = evalBuild.cache[key];
  // conditional base damage: Deadly Efficiency (reload from empty), Plated Round (on reload, 15*sqrt(5*mag)% for 10 s)
  let dmgAvg = dmg;
  if (de) dmgAvg += de.de * o.deFrac * Math.min(1, de.dur / tMag);
  if (o.plated) { const pb = 0.15 * Math.sqrt(5 * mag) * 1; const f = o.platedFrac != null ? o.platedFrac : Math.min(1, 10 / tMag); dmgAvg += pb * f; }
  const hitD = dmgAvg * eff(tH) * ms * (1 + ccE.h * (cd - 1));
  const expD = dmgAvg * eff(tX) * (1 + ccE.x * (cd - 1)) * o.explW;
  const dps = (hitD + expD) * rate * up;
  return { dps, hitD, expD, rate, mag, up, ms, ccBase, ccH: ccE.h, ccX: ccE.x, cd, dmg: dmgAvg, tH, tX };
}
evalBuild.cache = {};
// Enervate with multishot pellets (hitscan, 1 hit per tick for all pellets) + explosion (1 AoE hit), big-crit reset counted once per tick
function simMaus(base, ms, hits, N = 200000) {
  let s = 7; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  let e = 0, cnt = 0, sh = 0, nh = 0, sx = 0, nx = 0;
  const roll = (cc) => Math.floor(cc) + (rnd() < cc - Math.floor(cc) ? 1 : 0);
  for (let t = 0; t < N; t++) {
    let big = false; const cc = base + e;
    const np = Math.floor(ms) + (rnd() < ms - Math.floor(ms) ? 1 : 0);
    for (let p = 0; p < np; p++) { if (roll(cc) >= 2) big = true; sh += cc; nh++; }
    e += 0.1;
    if (hits > 1) { const c2 = base + e; if (roll(c2) >= 2) big = true; sx += c2; nx++; e += 0.1; }
    if (big) { cnt++; if (cnt >= 6) { e = 0; cnt = 0; } }
  }
  return { h: sh / nh, x: nx ? sx / nx : base };
}
module.exports = { evalBuild, MODS };
