const RV = require("./kg_riven.js"); const { MODS } = require("./opt.js"); const R2 = require("./run2.js");
const B = { overMs: 1.575, deFrac: 0 };
const X2m = ["pdr", "mc", "hb", "ppm", "at", "peb", "pcr", "prb"]; delete MODS.riv; const mref = R2.bestOrder(X2m, B).r.s * 2 / 3;
RV.rivMod.W = 1.1; const { m, fac } = RV.rivMod(["dmg", "cd", "fac"], 0.9375); RV.setRiv(m);
const X = ["prb", "pdr", "mc", "at", "hb", "riv", "ppm", "peb"];
const ref = RV._kgBest(X, B); console.log("ref", (100 * ref.s * fac / mref).toFixed(1), ref.ids.join(">"), ref.val, "P12", ref.r.r12.dps.toFixed(0), "P34", ref.r.r34.dps.toFixed(0), "cc", ref.r.r12.ccH.toFixed(2), "cd", ref.r.r12.cd.toFixed(2), "ms", ref.r.r12.ms.toFixed(2), "up", ref.r.r12.up.toFixed(2), JSON.stringify(ref.r.r12.tH));
const pool = ["prb", "sabot", "pdr", "cb", "mc", "at", "ps", "hb", "ppm", "peb", "pcr", "pvc", "hs", "cbul", "mag", "cc_", "qd", "cbl", "pde", "me", "qr"];
for (const id of X) {
  const rest = X.filter((x) => x !== id);
  const g = new Set(rest.map((x) => MODS[x].grp).filter(Boolean));
  let best = null; for (const s of pool) { if (s === id || rest.includes(s) || (MODS[s].grp && g.has(MODS[s].grp))) continue; const b = RV._kgBest(rest.concat([s]), B); if (b && (!best || b.s > best.s)) best = { s: b.s, id: s }; }
  const e = RV._kgBest(rest, B);
  const f = id === "riv" ? 1 : fac;
  console.log((MODS[id].ko || id).padEnd(16), "빼면 -" + (100 * (1 - e.s * f / (ref.s * fac))).toFixed(1) + "%", "| 차선", MODS[best.id].ko, (100 * best.s * f / (ref.s * fac)).toFixed(1) + "%");
}
// shortcut: Mausolon recommended 8 on KG without riven, then with riven replacing pcr
delete MODS.riv; const kgM = RV._kgBest(X2m, B); console.log("머솔론 8모드 그대로(리벤 없음)", (100 * kgM.s / mref).toFixed(1));
RV.setRiv(m); const step = RV._kgBest(["pdr", "mc", "hb", "ppm", "at", "peb", "riv", "prb"], B); console.log("화염→리벤", (100 * step.s * fac / mref).toFixed(1));
