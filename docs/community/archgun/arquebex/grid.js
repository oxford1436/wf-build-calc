// Arquebex: optimize under several scenarios, then cross-score every top build in every scenario (robustness, CLAUDE.md 2% rule)
const p = require("playwright");
const { AM, W } = require("./arq.js");
const repo = "/home/claude/wf-build-calc";
const SC = JSON.parse(process.argv[2] || "null") || {
  base: {}, bond: { bond: 1 }, grineer: { factions: ["grineer"] }, corpus: { factions: ["corpus"] }, infested: { factions: ["infested"] },
  lv400: { level: 400 }, lv1000: { level: 1000 }, acq15: { tAcq: 0.15 }, acq30: { tAcq: 0.3 }, heavy: { single: 1 }, heavyG: { single: 1, factions: ["grineer"], level: 400 },
};
const extra = JSON.parse(process.argv[3] || "[]");   // extra builds to score [[ids...], ...]
(async () => {
  const b = await p.chromium.launch(); const pg = await b.newPage(); const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
  await pg.goto("file://" + repo + "/index.html"); await pg.waitForFunction(() => window.WF_APP && window.WFEngine && window.WF_WEAPONS);
  const r = await pg.evaluate(({ AM, W, SC, extra }) => {
    const E = window.WFEngine, A = window.WF_APP, atk = W.attacks[0];
    const byId = Object.fromEntries(AM.map((m) => [m.id, m]));
    const mkO = (s) => {
      const o = A.readOpts();
      o.val = null; o.arcane = null; o.aim = false; o.hs = 0;
      o.ext = Object.assign({}, o.ext, { frAdd: 0, cdFinalAdd: s.bond ? 1.2 : 0 });
      o.ext.gearExt = Object.assign({}, o.ext.gearExt, { frAdd: 0, cdFinalAdd: s.bond ? 1.2 : 0 });
      if (s.factions) o.factions = s.factions;
      if (s.level) o.level = s.level;
      if (s.steel != null) o.steel = s.steel;
      if (s.tAcq) o.tAcq = s.tAcq;
      if (s.single) { o.scenario = "single"; o.tier = "heavy"; }
      o.targets = E.targetsFor(o);
      return o;
    };
    const builds = new Map(); const add = (ids) => { const k = ids.slice().sort().join(","); if (!builds.has(k)) builds.set(k, ids); };
    for (const e of extra) add(e);
    const tops = {};
    for (const k in SC) {
      const o = mkO(SC[k]);
      const res = E.optimize(W, atk, AM, o, { slots: 8, beam: 60 });
      tops[k] = res[0].mods.map((m) => m.id);
      let n = 0; const seen = new Set();
      for (const rr of res) { const ids = rr.mods.map((m) => m.id); const kk = ids.slice().sort().join(","); if (seen.has(kk)) continue; seen.add(kk); add(ids); if (++n >= 10) break; }
    }
    const M = {}; const best = {};
    for (const k in SC) {
      const o = Object.assign(mkO(SC[k]), { layoutTTK: true });
      for (const [bk, ids] of builds) { const x = E.evaluate(W, atk, ids.map((i) => byId[i]), o); (M[bk] = M[bk] || {})[k] = { s: x.score, clear: x.perF ? Object.fromEntries(Object.entries(x.perF).map(([f, v]) => [f, +v.clear.toFixed(3)])) : null };
        if (!best[k] || x.score > best[k]) best[k] = x.score; }
    }
    const rows = [];
    for (const [bk, ids] of builds) { const rel = {}; let mn = 9, gm = 0, n = 0; for (const k in SC) { const v = M[bk][k].s / best[k]; rel[k] = +v.toFixed(4); mn = Math.min(mn, v); gm += Math.log(v); n++; } rows.push({ ids, min: mn, geo: Math.exp(gm / n), rel }); }
    rows.sort((a, b2) => b2.geo - a.geo);
    return { tops, rows: rows.slice(0, 40), nBuilds: builds.size };
  }, { AM, W, SC, extra });
  const ko = Object.fromEntries(AM.map((m) => [m.id, m.ko]));
  console.log(JSON.stringify(r, null, 0));
  await b.close();
})();
