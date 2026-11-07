const { search, score, bestOrder } = require("./run2.js"); const { MODS } = require("./opt.js");
const ko = (b) => b.map((i) => MODS[i].ko).join(", ");
const S = {
  "오버차지 +157.5%(에너지 450, 90% 이상 유지)": { overMs: 1.575, deFrac: 0 },
  "오버차지 꺼짐(에너지 90% 미만)": { overMs: 0, deFrac: 0 },
  "오버차지 +157.5%, 터네이셔스 본드 미적용": { overMs: 1.575, deFrac: 0, cdFlat: 0 },
  "오버차지 꺼짐, 터네이셔스 본드 미적용": { overMs: 0, deFrac: 0, cdFlat: 0 },
};
const which = process.argv[2] ? [Object.keys(S)[+process.argv[2]]] : Object.keys(S);
for (const k of which) { const r = search(S[k]); console.log("==", k); for (const x of r.slice(0, 3)) console.log("  ", (100 * x.r.s / r[0].r.s).toFixed(1), ko(x.ids)); }
