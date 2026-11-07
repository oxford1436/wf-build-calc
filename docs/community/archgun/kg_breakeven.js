const R2 = require("./run2.js"); const K = require("./kuva_grattler.js");
const B = { overMs: 1.575, deFrac: 0 };
const X = ["prb", "pdr", "mc", "at", "hb", "ppm", "peb", "pcr"];
const m = R2.bestOrder(X, B); const mS = m.r.s * 2 / 3;
const f = (h) => K.bestKG(X, Object.assign({}, B, { xf34: h }), ["mag"]).r.s / mS;
let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (f(mid) < 1) lo = mid; else hi = mid; }
console.log("break-even head factor P3-4", lo.toFixed(3), "-> distance from head", (9 * (1 - lo) / 0.7).toFixed(1), "m if within radius (falloff 100%->30% over 9 m)");
const g = (x) => K.bestKG(X, Object.assign({}, B, { xf: x }), ["mag"]).r.r12.dps / (m.r.r12.dps * 2 / 3);
let a = 0, b = 2; for (let i = 0; i < 30; i++) { const mid = (a + b) / 2; if (g(mid) < 1) a = mid; else b = mid; }
console.log("P1-2 alone break-even explosion factor", a.toFixed(3));
const k = K.bestKG(X, B, ["mag"]); console.log("KG tH", JSON.stringify(k.r.r12.tH), "tX", JSON.stringify(k.r.r12.tX), "order", k.ids.join(">"));
console.log("Maus P12", (m.r.r12.dps*2/3).toFixed(0), "P34", (m.r.r34.dps*2/3).toFixed(0), "KG P12", k.r.r12.dps.toFixed(0), "P34", k.r.r34.dps.toFixed(0));
