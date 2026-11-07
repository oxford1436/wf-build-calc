const RV = require("./kg_riven.js"); const { MODS } = require("./opt.js");
const sK = [["prb", "pdr", "mc", "at", "hb", "ppm", "peb", "pcr"], ["prb", "pdr", "mc", "at", "ps", "hb", "ppm", "peb"], ["prb", "pdr", "mc", "at", "hb", "qr", "ppm", "peb"]];
const sM = [["pdr", "mc", "hb", "ppm", "at", "peb", "pcr", "prb"], ["prb", "pdr", "mc", "at", "ps", "hb", "ppm", "peb"]];
const base = { overMs: 1.575, deFrac: 0 };
const sc = { base: [{}, {}], overOff: [{ overMs: 0 }, { overMs: 0 }], enervOff: [{ enervate: false }, { enervate: false }], tenOff: [{ cdFlat: 0 }, { cdFlat: 0 }], kgRegen4: [{}, { reload: 4 }], kgXf065: [{}, { xf: 0.65 }], kgXf34_02: [{}, { xf34: 0.2 }] };
for (const n in sc) {
  const mo = Object.assign({}, base, sc[n][0]), ko = Object.assign({}, base, sc[n][1]);
  const m = RV.rivenSearch("maus", sM, mo, 6)[0], k = RV.rivenSearch("kg", sK, ko, 6)[0];
  const mS = m.s * 2 / 3, kS = k.s;
  console.log(n.padEnd(10), "KG+riv / Maus+riv", (100 * kS / mS).toFixed(1) + "%", "| P12", (k.best.r.r12.dps * k.fac / (m.best.r.r12.dps * m.fac * 2 / 3)).toFixed(2), "P34", (k.best.r.r34.dps * k.fac / (m.best.r.r34.dps * m.fac * 2 / 3)).toFixed(2), "| M riv", m.c.attrs.join("+"), m.best.ids.join(","), "| K riv", k.c.attrs.join("+"), k.best.ids.join(","));
}
