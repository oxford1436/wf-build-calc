// Secondary Enervate (rank 5): +10% crit chance per hit; reset after 6 Big Critical Hits (tier >= 2); multiple big crits in one tick = 1.
// mode: hitsPerTick (hitscan multishot counts as 1 hit; AoE counts as 1 hit), pellets per tick = rolls that can crit
function sim(base, opt) {
  const { pellets = 1, hits = 1, order = "after", N = 400000, seed = 1 } = opt;
  let s = seed; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  let e = 0, cnt = 0, sum = 0, rolls = 0;
  for (let t = 0; t < N; t++) {
    if (order === "before") e += 0.1 * hits;
    const cc = base + e; let big = false;
    const np = Math.floor(pellets) + (rnd() < pellets - Math.floor(pellets) ? 1 : 0);
    for (let p = 0; p < np; p++) { const tier = Math.floor(cc) + (rnd() < cc - Math.floor(cc) ? 1 : 0); if (tier >= 2) big = true; sum += cc; rolls++; }
    if (order === "after") e += 0.1 * hits;
    if (big) { cnt++; if (cnt >= 6) { e = 0; cnt = 0; } }
  }
  return sum / rolls;
}
const afcc = (x) => x < 110 ? 102.45 + 0.5 * x : x < 140 ? 128.8 - 0.0075 * x + 0.00244 * x * x : x < 150 ? 77.5 + 0.7 * x : x < 160 ? 70 + 0.75 * x : x < 170 ? 62 + 0.8 * x : x < 180 ? 53.5 + 0.85 * x : x < 190 ? 44.5 + 0.9 * x : x < 200 ? 35 + 0.95 * x : 25 + x;
if (require.main === module) for (const x of [30, 60, 100, 150, 200]) {
  console.log(x, "wiki", afcc(x).toFixed(1), "after", (100 * sim(x / 100, {})).toFixed(1), "before", (100 * sim(x / 100, { order: "before" })).toFixed(1));
}
module.exports = { sim };
