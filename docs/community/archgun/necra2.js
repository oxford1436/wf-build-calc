const { bestOrder } = require("./run2.js"); const { MODS } = require("./opt.js");
MODS.cr = { ko: "컴버스쳔 라운즈", el: ["heat", 1.2], grp: "com" };
const B = { overMs: 1.575, deFrac: 0 };
const X2 = ["pdr", "mc", "hb", "ppm", "at", "peb", "pcr", "prb"];
const ref = bestOrder(X2, B).r.s;
const pct = (b, o) => (100 * bestOrder(b, o || B).r.s / ref).toFixed(1);
const pool = Object.keys(MODS);
for (const id of X2) {
  const rest = X2.filter((x) => x !== id); const g = new Set(rest.map((x) => MODS[x].grp).filter(Boolean));
  let best = null; for (const s of pool) { if (rest.includes(s) || s === id || (MODS[s].grp && g.has(MODS[s].grp))) continue; const b = bestOrder(rest.concat([s]), B); if (b && (!best || b.r.s > best.v)) best = { s, v: b.r.s }; }
  const e = bestOrder(rest, B); console.log(MODS[id].ko.padEnd(18), "빼면", e ? (100 * (1 - e.r.s / ref)).toFixed(1) : "화염단독깨짐", "| 차선", MODS[best.s].ko, (100 * best.v / ref).toFixed(1));
}
for (const [p, n] of [["ppm", "pm"], ["peb", "eb"], ["pcr", "cr"]]) console.log("일반판", MODS[n].ko, pct(X2.map((x) => x === p ? n : x)));
const U = ["pdr", "mc", "cb", "pm", "at", "eb", "ps", "prb"];
console.log("현재(오버차지 켜짐)", pct(U), " 현재(꺼짐)", pct(U, { overMs: 0, deFrac: 0 }));
console.log("1단계 패럴락스→할로우드", pct(["pdr", "mc", "cb", "pm", "at", "eb", "hb", "prb"]));
console.log("2단계 +컨테인먼트→컴버스쳔(일반)", pct(["pdr", "mc", "cr", "pm", "at", "eb", "hb", "prb"]));
console.log("최종 오버차지 꺼짐", pct(X2, { overMs: 0, deFrac: 0 }), " 에너베이트 없음", pct(X2, Object.assign({}, B, { enervate: false })));
const r = bestOrder(X2, B); console.log("order", r.ids.map((i) => MODS[i].ko).join(" > "), JSON.stringify(r.r.r12.tH), "ms", r.r.r12.ms, "cc", r.r.r12.ccH.toFixed(2), "cd", r.r.r12.cd.toFixed(2));
