const { MODS } = require("./opt.js"); const R2 = require("./run2.js"); const K = require("./kuva_grattler.js");
const pool = ["prb", "sabot", "pdr", "cb", "mc", "at", "ps", "hb", "ppm", "peb", "pcr", "pvc", "hs", "cbul", "mag", "cc_", "qd", "cbl", "pde", "me", "qr"];
const B = { overMs: 1.575, deFrac: 0 };
const S = {
  base: [B, B],
  overOff: [{ overMs: 0, deFrac: 0 }, { overMs: 0, deFrac: 0 }],
  enervOff: [Object.assign({}, B, { enervate: false }), Object.assign({}, B, { enervate: false })],
  tenOff: [Object.assign({}, B, { cdFlat: 0 }), Object.assign({}, B, { cdFlat: 0 })],
  kgRegen4: [B, Object.assign({}, B, { reload: 4 })],
  xf065: [B, Object.assign({}, B, { xf: 0.65 })],
  xf34_05: [B, Object.assign({}, B, { xf34: 0.5 })],
};
const name = process.argv[2]; const [mo, ko] = S[name];
const mt = R2.search(mo, pool, 3)[0]; const mS = mt.r.s * (120 / 180);
const kt = K.searchKG(ko, pool, 3)[0];
console.log(name, "KG/Maus", (100 * kt.r.s / mS).toFixed(1) + "%", "| P12", (100 * kt.r.r12.dps / (mt.r.r12.dps * 2 / 3)).toFixed(0) + "%", "P34", (100 * kt.r.r34.dps / (mt.r.r34.dps * 2 / 3)).toFixed(0) + "%",
  "| M:", mt.ids.map((i) => i).join(","), "| K:", kt.val, kt.ids.join(","));
