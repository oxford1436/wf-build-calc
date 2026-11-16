// score named builds (optional fixed element order) in each scenario, relative to a reference build
const p = require("playwright");
const { AM, W } = require("./arq.js");
const repo = "/home/claude/wf-build-calc";
const B = JSON.parse(require("fs").readFileSync(process.argv[2], "utf8"));   // { name: {ids:[], order:[]|null} }, first = reference
const SC = JSON.parse(process.argv[3] || "null") || {
  base: {}, bond: { bond: 1 }, grineer: { factions: ["grineer"] }, corpus: { factions: ["corpus"] }, infested: { factions: ["infested"] },
  lv400: { level: 400 }, lv1000: { level: 1000 }, acq15: { tAcq: 0.15 }, acq30: { tAcq: 0.3 }, heavy: { single: 1 }, heavyG: { single: 1, factions: ["grineer"], level: 400 },
};
(async () => {
  const b = await p.chromium.launch(); const pg = await b.newPage();
  await pg.goto("file://" + repo + "/index.html"); await pg.waitForFunction(() => window.WF_APP && window.WFEngine && window.WF_WEAPONS);
  const r = await pg.evaluate(({ AM, W, SC, B }) => {
    const E = window.WFEngine, A = window.WF_APP, atk = W.attacks[0];
    const byId = Object.fromEntries(AM.map((m) => [m.id, m]));
    const mkO = (s) => {
      const o = A.readOpts(); o.val = null; o.arcane = null; o.aim = false; o.hs = 0;
      o.ext = Object.assign({}, o.ext, { frAdd: 0, cdFinalAdd: s.bond ? 1.2 : 0 }); o.ext.gearExt = Object.assign({}, o.ext.gearExt, { frAdd: 0, cdFinalAdd: s.bond ? 1.2 : 0 });
      if (s.factions) o.factions = s.factions; if (s.level) o.level = s.level; if (s.steel != null) o.steel = s.steel; if (s.tAcq) o.tAcq = s.tAcq;
      if (s.single) { o.scenario = "single"; o.tier = "heavy"; }
      o.targets = E.targetsFor(o); return o;
    };
    const out = {}; const names = Object.keys(B);
    for (const k in SC) {
      const xs = names.map((n) => { const o = Object.assign(mkO(SC[k]), { layoutTTK: true, elemOrder: B[n].order || null, conceptPenalty: false });
        const x = E.evaluate(W, atk, B[n].ids.map((i) => byId["arq_" + i]), o);
        const lay = x.layout ? Object.entries(x.layout.coef).filter(([t, v]) => v > 0.01).map(([t, v]) => t + v.toFixed(2)).join("+") : "";
        return { n, s: x.score, clear: x.perF ? Object.values(x.perF).map((v) => v.clear.toFixed(2)).join("/") : "", lay }; });
      out[k] = xs.map((x) => ({ n: x.n, r: +(x.s / xs[0].s).toFixed(3), clear: x.clear, lay: x.lay }));
    }
    return out;
  }, { AM, W, SC, B });
  const names = Object.keys(B), ks = Object.keys(r);
  console.log("build".padEnd(10) + ks.map((k) => k.padStart(8)).join(""));
  for (let i = 0; i < names.length; i++) console.log(names[i].padEnd(10) + ks.map((k) => r[k][i].r.toFixed(3).padStart(8)).join(""));
  console.log("\nbase clear (s, per faction) and explosion layout:"); for (const x of r.base) console.log(x.n.padEnd(10), x.clear, x.lay);
  await b.close();
})();
