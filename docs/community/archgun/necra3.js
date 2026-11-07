const { bestOrder } = require("./run2.js"); const { MODS } = require("./opt.js");
MODS.cf = { ko: "크리티컬 포커스(조준)", cc: 0.6, cd: 0.6 };
const B = { overMs: 1.575, deFrac: 0 };
const X2 = ["pdr", "mc", "hb", "ppm", "at", "peb", "pcr", "prb"]; const ref = bestOrder(X2, B).r.s;
for (const out of ["pcr", "mc", "at", "pdr"]) { const t = X2.map((x) => x === out ? "cf" : x); const b = bestOrder(t, B); console.log(MODS[out].ko, "→ CF", b ? (100 * b.r.s / ref).toFixed(1) : "heat broken"); }
