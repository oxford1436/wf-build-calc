// 2026-11-18: written by the independent reviewer of the Boar Prime (Cyte-09) recommendation, kept as the discrete cross-check of the wall-spray model (README 후속 6)
// reviewer's discrete check of the wall-spray model: whole pellets (Poisson per enemy per shot), whole Electricity procs
// (first tick at once, then every second, 6 ticks, 3 m around the carrier while the carrier lives), 10 lights + 1 heavy + 1 Eximus.
// Per-pellet numbers are taken from the engine's own output (detail.js): direct damage, forced-proc tick, crit, fire rate, pellets.
const fs = require("fs");
const out = JSON.parse(fs.readFileSync(process.argv[2], "utf8"))[0];
const TR = +(process.argv[3] || 800);
const persist = process.argv[4] === "persist";   // variant: ticks keep going after the carrier dies
let seed = +(process.env.SEED || 12345); const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed + 0.5) / 4294967296; };
const pois = (m) => { const L = Math.exp(-m); let k = 0, p = 1; do { k++; p *= rnd(); } while (p > L); return k - 1; };
const ogAt = (lv) => 12 * (1 + 260 * Math.pow(lv - 1, 0.9));
const XH = 0.8075;
function sim(b, f, lvKey, row) {
  const q = b.pf[f], y = q[lvKey], lv = y.tg.level, rho = row.density, n3 = 1 + rho * Math.PI * 9;
  const steel = row.steel ? 2.5 : 1;   // engine: overguard is not scaled by Steel Path in targetsAt
  const fac = /Cl(G|C|I|O)/.test(b.n) && ((/ClG/.test(b.n) && f === "grineer") || (/ClC/.test(b.n) && f === "corpus") || (/ClI/.test(b.n) && f === "infested") || (/ClO/.test(b.n) && f === "corrupted")) ? 1.55 : 1;
  const dp = q.direct / b.ms;                       // main + extra hit, pre-crit
  const vEst = dp / (b.Btot * (1 + b.dmgb + b.gco) * b.total * fac) - XH * fac;   // vuln (≈1.0–1.2)
  const mainShare = vEst / (vEst + XH * fac);
  const tick = (q.dotBy.elec || 0) / b.ms / (6 * n3);   // one forced proc, one tick, one enemy, pre-crit
  const r = b.rate, m = b.ms, cc = b.cc, cd = b.cd, R = Math.sqrt(12 / (Math.PI * rho));
  const arF = (ar) => ar > 0 ? 1 - 0.9 * Math.sqrt(Math.min(ar, 2700) / 2700) : 1;
  let sumT = 0, sumFirstHalf = 0;
  for (let tr = 0; tr < TR; tr++) {
    const en = [];
    for (let i = 0; i < 12; i++) { const rr = R * Math.sqrt(rnd()), th = 2 * Math.PI * rnd(); const T = i === 0 ? y.tgH : y.tg;
      en.push({ x: rr * Math.cos(th), y: rr * Math.sin(th), hp: T.hp, sh: T.sh, af: arF(T.ar), og: i === 1 ? ogAt(lv) : 0, alive: true }); }
    const nb = en.map((a, i) => en.map((c, j) => j).filter((j) => (en[j].x - a.x) ** 2 + (en[j].y - a.y) ** 2 <= 9));
    let aliveN = 12; const ticks = [];   // {t, e, d, left}
    const hit = (e, d) => { if (!e.alive) return; if (e.og > 0) { if (d < e.og) { e.og -= d; return; } d -= e.og; e.og = 0; } if (e.sh > 0) { if (d < e.sh) { e.sh -= d; return; } d -= e.sh; e.sh = 0; } e.hp -= d * e.af; if (e.hp <= 0) { e.alive = false; aliveN--; } };
    let t = 0, k = 0, done = 0;
    while (aliveN > 0 && t < 60) {
      // ticks due before this shot
      const tShot = k / r;
      ticks.sort((a, c) => a.t - c.t);
      while (ticks.length && ticks[0].t <= tShot && aliveN > 0) { const tk = ticks.shift(); if (en[tk.e].alive || persist) { for (const j of nb[tk.e]) hit(en[j], tk.d); if (aliveN === 0) done = tk.t; if (tk.left > 1) { ticks.push({ t: tk.t + 1, e: tk.e, d: tk.d, left: tk.left - 1 }); ticks.sort((a, c) => a.t - c.t); } } }
      if (aliveN === 0) break;
      t = tShot;
      for (let i = 0; i < 12; i++) { const e = en[i]; if (!e.alive) continue; const n = pois(m);
        for (let p = 0; p < n && e.alive; p++) {
          const tier = Math.floor(cc) + (rnd() < cc - Math.floor(cc) ? 1 : 0), cm = tier === 0 ? 1 : 1 + tier * (cd - 1);
          hit(e, dp * mainShare * cm); if (!e.alive) break;
          hit(e, dp * (1 - mainShare) * cm); if (!e.alive) break;
          for (const j of nb[i]) hit(en[j], tick * cm);
          ticks.push({ t: t + 1, e: i, d: tick * cm, left: 5 });
        } }
      if (aliveN === 0) { done = t; break; }
      k++;
    }
    sumT += aliveN === 0 ? done : 60;
  }
  return sumT / TR;
}
const res = {};
// 2026-11-19: the factions come from the engine output (a job with factions: ["corrupted"] works); "ClO" in a build name = Primed Cleanse Orokin
const FACS = Object.keys(out.rows[0].res[0].pf);
for (const row of out.rows) {
  console.log("== " + row.v + " (levels " + row.lev.join("/") + ")" + (persist ? " [ticks persist after death]" : ""));
  const sc = {};
  for (const b of row.res) {
    const ts = []; let lg = 0, lgE = 0, n = 0; const pfm = {}, pfe = {};
    for (const f of FACS) { let a = 0, e = 0; for (const lk of ["lo", "hi", "top"]) { const T = sim(b, f, lk, row); ts.push(T.toFixed(2)); const x = Math.log(12 / (T + 1 / b.rate)), y = Math.log(12 / Math.max(1 / b.rate, b.pf[f][lk].clear)); lg += x; lgE += y; a += x; e += y; n++; } pfm[f] = Math.exp(a / 3); pfe[f] = Math.exp(e / 3); }
    sc[b.n] = [Math.exp(lg / n), Math.exp(lgE / n), pfm, pfe];
    console.log("  " + b.n.padEnd(14) + " MC clear g/c/i x lo/hi/top: " + ts.join(" "));
  }
  const ref = sc[row.res[0].n];
  for (const k in sc) console.log("   " + k.padEnd(14) + " MC " + (sc[k][0] / ref[0] * 100).toFixed(1).padStart(6) + "   engine " + (sc[k][1] / ref[1] * 100).toFixed(1).padStart(6) + "   | per faction MC g/c/i " + FACS.map((f) => (sc[k][2][f] / ref[2][f] * 100).toFixed(0)).join("/") + "  engine " + FACS.map((f) => (sc[k][3][f] / ref[3][f] * 100).toFixed(0)).join("/") + "  (MC abs " + sc[k][0].toFixed(2) + ", eng " + sc[k][1].toFixed(2) + ")");
}
