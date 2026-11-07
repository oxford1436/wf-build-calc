const { score, bestOrder } = require("./run2.js"); const { MODS } = require("./opt.js");
const A = { fury: 8.25, nourish: 1.35, bulwark: 5, deFrac: 0 };
const X1 = ["pdr", "cb", "mc", "at", "hb", "ppm", "peb", "pcr"];
const ref = bestOrder(X1, A).r.s;
const pool = Object.keys(MODS);
console.log("drop / best substitute (scenario A)");
for (const id of X1) {
  const rest = X1.filter((x) => x !== id);
  const g = new Set(rest.map((x) => MODS[x].grp).filter(Boolean));
  let best = null;
  for (const s of pool) { if (rest.includes(s) || s === id || (MODS[s].grp && g.has(MODS[s].grp))) continue; const b = bestOrder(rest.concat([s]), A); if (b && (!best || b.r.s > best.s)) best = { s, v: b.r.s }; }
  const empty = bestOrder(rest, A);
  console.log(MODS[id].ko.padEnd(20), "빼면", empty ? (100 * (1 - empty.r.s / ref)).toFixed(1) + "%" : "열 단독 깨짐", "| 차선", MODS[best.s].ko, (100 * best.v / ref).toFixed(1));
}
// normal (non-primed) substitutes
for (const [p, n] of [["ppm", "pm"], ["peb", "eb"], ["pcr", "cr"], ["pdr", "dr"]]) {
  if (!MODS[n]) MODS[n] = { ko: "컴버스쳔 라운즈", el: ["heat", 1.2], grp: "com" };
  const b = bestOrder(X1.map((x) => x === p ? n : x), A); console.log("일반판", MODS[n].ko, (100 * b.r.s / ref).toFixed(1));
}
const allN = bestOrder(X1.map((x) => ({ ppm: "pm", peb: "eb", pcr: "cr" })[x] || x), A); console.log("프라임 3종 모두 일반판", (100 * allN.r.s / ref).toFixed(1));
// shortcut from user's build
const U = ["pdr", "mc", "cb", "pm", "at", "eb", "ps", "prb"];
const steps = [["지금 세팅", U], ["패럴락스 → 할로우드", ["pdr", "mc", "cb", "pm", "at", "eb", "hb", "prb"]], ["+ 루비도 → 컴버스쳔(일반)", ["pdr", "mc", "cb", "pm", "at", "eb", "hb", "cr"]], ["+ 원소 3개 프라임", X1]];
for (const [n, b] of steps) console.log(n, (100 * bestOrder(b, A).r.s / ref).toFixed(1));
// arcane: Overcharge (user's, cap +100% as in arsenal) at 0/50/100% uptime vs Bulwark, on X1
for (const up of [0, 0.5, 1]) { const o = Object.assign({}, A, { bulwark: 0, overMs: 1.0 * up }); console.log("오버차지(+100%) 유지율", up, (100 * bestOrder(X1, o).r.s / ref).toFixed(1)); }
const noEn = Object.assign({}, A, { enervate: false }); console.log("에너베이트 대신 비움", (100 * bestOrder(X1, noEn).r.s / ref).toFixed(1));
const r = bestOrder(X1, A); console.log("order", r.ids.map((i) => MODS[i].ko).join(" > "), JSON.stringify(r.r.r12.tH), "cc", r.r.r12.ccH.toFixed(2), r.r.r34.ccH.toFixed(2), "cd", r.r.r12.cd, "ms", r.r.r12.ms, "fr", r.r.r12.rate);
