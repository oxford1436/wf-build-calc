// 2026-11-19: the ONE simulation used for the Boar Prime (Cyte-09, wall spray) answers from here on (README 후속 15).
// Pellet by pellet (Poisson pellets per enemy per shot, whole Electricity procs: first tick at once, then every second,
// 6 ticks, 3 m around the carrier while it lives), 10 lights + 1 heavy + 1 Eximus — the reviewer's mc_discrete.js model —
// plus what the user's 2026-11-19 video showed: Resupply is cast once per magazine and its element is off for GAP seconds
// per cast (no Extra Hit, no forced proc during the gap). Per-pellet numbers come from the calculator (mc_detail.js output).
// usage: node boar_sim.js out_<faction>.json [out_<faction>_vs.json ...] > result.json   (env TRIALS, GAP, SEED)
const fs = require("fs");
const TR = +(process.env.TRIALS || 150), GAP = process.env.GAP != null ? +process.env.GAP : 0.19, XH = 0.8075;
// sweeps: RATE / MAG override the build's fire rate / magazine, ONLY = comma-separated build codes (e.g. CD+CL+Ba+Ra+El+CS)
const RATE = process.env.RATE ? +process.env.RATE : 0, MAGO = process.env.MAG ? +process.env.MAG : 0, ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
let seed = +(process.env.SEED || 12345); const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return (seed + 0.5) / 4294967296; };
const pois = (m) => { const L = Math.exp(-m); let k = 0, p = 1; do { k++; p *= rnd(); } while (p > L); return k - 1; };
const ogAt = (lv) => 12 * (1 + 260 * Math.pow(lv - 1, 0.9));
const MAGB = { El: 0.6, AS: 1.1, BM: 0.6 };
const magOf = (n) => Math.round(20 * (1 + n.split(" ")[1].split("+").reduce((s, k) => s + (MAGB[k] || 0), 0)));
function sim(b, f, lvKey, row, mag) {
  const q = b.pf[f], y = q[lvKey], lv = y.tg.level, rho = row.density, n3 = 1 + rho * Math.PI * 9;
  const fac = b.meta ? b.meta.fac : /(^|[ +])CL([+]|$)/.test(b.n) ? 1.55 : 1;   // "CL" in the build name = the mission faction's Primed Cleanse (neighbourhood jobs carry it in meta)
  const dp = q.direct / b.ms;                        // main + extra hit per pellet, pre-crit
  const vEst = dp / (b.Btot * (1 + b.dmgb + b.gco) * b.total * fac) - XH * fac, mainShare = vEst / (vEst + XH * fac);
  const nT = Math.max(1, Math.ceil((b.Tdur || 6) - 1e-9));   // ticks of one Electricity proc (engine: ceil(6 s × status duration)) — duration mods add ticks, not tick damage
  const tick = (q.dotBy.elec || 0) / b.ms / (nT * n3);
  const r = RATE || b.rate, m = b.ms, cc = b.cc, cd = b.cd, R = Math.sqrt(12 / (Math.PI * rho));
  const arF = (ar) => ar > 0 ? 1 - 0.9 * Math.sqrt(Math.min(ar, 2700) / 2700) : 1;
  let sumT = 0;
  for (let tr = 0; tr < TR; tr++) {
    const en = [];
    for (let i = 0; i < 12; i++) { const rr = R * Math.sqrt(rnd()), th = 2 * Math.PI * rnd(); const T = i === 0 ? y.tgH : y.tg;
      en.push({ x: rr * Math.cos(th), y: rr * Math.sin(th), hp: T.hp, sh: T.sh, af: arF(T.ar), og: i === 1 ? ogAt(lv) : 0, alive: true }); }
    const nb = en.map((a) => en.map((c, j) => j).filter((j) => (en[j].x - a.x) ** 2 + (en[j].y - a.y) ** 2 <= 9));
    let aliveN = 12; let ticks = [];   // {t, e, d, left}
    const hit = (e, d) => { if (!e.alive) return; if (e.og > 0) { if (d < e.og) { e.og -= d; return; } d -= e.og; e.og = 0; } if (e.sh > 0) { if (d < e.sh) { e.sh -= d; return; } d -= e.sh; e.sh = 0; } e.hp -= d * e.af; if (e.hp <= 0) { e.alive = false; aliveN--; } };
    let k = Math.floor(rnd() * mag), k0 = k, done = 0;   // the pack arrives at a random point of the magazine cycle
    const phi = rnd();                                 // the cast falls at a random point between two shots (expected shots without the element = GAP × rate)
    while (aliveN > 0 && (k - k0) / r < 60) {
      const tShot = (k - k0) / r;
      if (ticks.length) {
        ticks.sort((a, c) => a.t - c.t);
        let i = 0; const add = [];
        for (; i < ticks.length && ticks[i].t <= tShot && aliveN > 0; i++) { const tk = ticks[i]; if (en[tk.e].alive) { for (const j of nb[tk.e]) hit(en[j], tk.d); if (aliveN === 0) done = tk.t; if (tk.left > 1) add.push({ t: tk.t + 1, e: tk.e, d: tk.d, left: tk.left - 1 }); } }
        ticks = ticks.slice(i).concat(add);
      }
      if (aliveN === 0) break;
      const buff = ((k % mag) + phi) / r >= GAP;       // GAP seconds after every cast (once per magazine): Resupply element off
      for (let i = 0; i < 12; i++) { const e = en[i]; if (!e.alive) continue; const n = pois(m); let td = 0;
        for (let p = 0; p < n && e.alive; p++) {
          const tier = Math.floor(cc) + (rnd() < cc - Math.floor(cc) ? 1 : 0), cm = tier === 0 ? 1 : 1 + tier * (cd - 1);
          hit(e, dp * mainShare * cm); if (!e.alive || !buff) continue;
          hit(e, dp * (1 - mainShare) * cm); if (!e.alive) break;
          for (const j of nb[i]) hit(en[j], tick * cm);
          td += tick * cm;
        }
        if (td > 0 && e.alive) ticks.push({ t: tShot + 1, e: i, d: td, left: nT - 1 }); }
      if (aliveN === 0) { done = tShot; break; }
      k++;
    }
    sumT += aliveN === 0 ? done : 60;
  }
  return sumT / TR;
}
const res = {};   // build -> { cond -> { lvKey -> T } }
for (const file of process.argv.slice(2)) {
  const out = JSON.parse(fs.readFileSync(file, "utf8"))[0]; const f = Object.keys(out.rows[0].res[0].pf)[0];
  for (const row of out.rows) for (const b of row.res) {
    if (!b.pf || (ONLY && !ONLY.includes(b.n.split(" ")[1]))) continue; const mag = MAGO || (b.meta ? b.meta.mag : magOf(b.n)), o = (res[b.n] = res[b.n] || { f, mag, rate: RATE || b.rate, T: {}, meta: b.meta });
    o.T[row.v] = {}; for (const lk of ["lo", "hi", "top"]) o.T[row.v][lk] = +sim(b, f, lk, row, mag).toFixed(3);
  }
}
console.log(JSON.stringify(res));
