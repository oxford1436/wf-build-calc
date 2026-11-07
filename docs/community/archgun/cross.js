const { score } = require("./run2.js"); const { MODS } = require("./opt.js");
const X = {
  X1_A: ["pdr", "cb", "mc", "at", "hb", "ppm", "peb", "pcr"],
  X2_PRB_PCR: ["prb", "pdr", "mc", "at", "hb", "ppm", "peb", "pcr"],
  X3_PRB_CB: ["prb", "pdr", "cb", "mc", "at", "hb", "ppm", "peb"],
  X5_PRB_PDE: ["prb", "pdr", "mc", "at", "hb", "pde", "ppm", "peb"],
  X6_PS_instead_HB: ["pdr", "cb", "mc", "at", "ps", "ppm", "peb", "pcr"],
  USER: ["pdr", "mc", "cb", "pm", "at", "eb", "ps", "prb"],
};
const S = {
  "A 크로마+불워크": { fury: 8.25, nourish: 1.35, bulwark: 5, deFrac: 0 },
  "A 퓨리 절반": { fury: 4.1, nourish: 1.35, bulwark: 5, deFrac: 0 },
  "A 퓨리 미적용": { nourish: 1.35, bulwark: 5, deFrac: 0 },
  "A 너리시 없음": { fury: 8.25, bulwark: 5, deFrac: 0 },
  "A 에너베이트 없음": { fury: 8.25, nourish: 1.35, bulwark: 5, deFrac: 0, enervate: false },
  "A 터네이셔스 없음": { fury: 8.25, nourish: 1.35, bulwark: 5, deFrac: 0, cdFlat: 0 },
  "A 데들리 0.9": { fury: 8.25, nourish: 1.35, bulwark: 5, deFrac: 0.9 },
  "A' 크로마+오버차지(늘 90%↑)": { fury: 8.25, nourish: 1.35, overMs: 0.0035 * 375, deFrac: 0 },
  "B 네크라메크+오버차지": { overMs: 0.0035 * 450, deFrac: 0 },
};
const rows = [];
for (const [sn, sc] of Object.entries(S)) {
  const v = {}; for (const [xn, b] of Object.entries(X)) v[xn] = score(b, sc).s;
  const best = Math.max(...Object.values(v));
  rows.push([sn, ...Object.keys(X).map((k) => (100 * v[k] / best).toFixed(1))]);
  if (sn === "A 크로마+불워크") console.log("abs A X1", v.X1_A.toExponential(3));
  if (sn.startsWith("A'")) console.log("abs A' (overcharge) best", best.toExponential(3), "X1", v.X1_A.toExponential(3));
}
console.log(["scenario", ...Object.keys(X)].join("\t")); for (const r of rows) console.log(r.join("\t"));
// absolute: Bulwark vs Overcharge(always on) with X1 and X2 builds
for (const b of ["X1_A", "X2_PRB_PCR"]) { const a = score(X[b], S["A 크로마+불워크"]).s, o = score(X[b], S["A' 크로마+오버차지(늘 90%↑)"]).s; console.log(b, "overcharge/bulwark", (o / a).toFixed(3)); }
