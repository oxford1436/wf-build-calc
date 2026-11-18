// 2026-11-18: written by the independent reviewer of the Boar Prime (Cyte-09) recommendation, kept as the discrete cross-check of the wall-spray model (README 후속 6)
// reviewer's detail dump: same path as sens.js (hash -> app state -> evalBuild), but returns per-proc numbers and target stats
const p = require("playwright"); const repo = process.env.WFREPO || "/home/claude/wf-build-calc";
const { CFG, CYTE, init } = require("./run.js");
const jobs = JSON.parse(require("fs").readFileSync(process.argv[2], "utf8"));
(async () => {
  const b = await p.chromium.launch(); const out = [];
  for (const j of jobs) {
    const c = CFG[j.cfg]; const patch = j.patch !== undefined ? j.patch : c.patch;
    const pg = await b.newPage(); const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
    if (patch) await pg.addInitScript(init, patch);
    const f = Object.assign({}, c.cyte ? CYTE : {}, c.f, { rivmode: "none" }, j.f || {});
    const S = { w: c.w, a: j.a != null ? j.a : c.a, f, ab: c.cyte ? ["Resupply"].concat(j.ab || c.ab || ["Nourish"]) : [], abp: c.cyte ? { Resupply: j.cast || "0" } : {}, mb: ["tenacious_bond", "reinforced_bond"], s: [] };
    if (j.evo) S.evo = j.evo;
    const h = Buffer.from(JSON.stringify(S), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    await pg.goto("file://" + (j.html || repo + "/index.html") + "#s=" + h); await pg.waitForFunction((w) => window.WF_APP && window.WF_APP.st.weapon && (window.WF_APP.st.base || window.WF_APP.st.weapon).id === w, c.w);
    const r = await pg.evaluate(({ builds, vars }) => {
      const A = window.WF_APP, E = window.WFEngine, st = A.st;
      const rows = [];
      for (const v of vars) {
        const o = Object.assign(A.readOpts(), v.o || {}); if (v.level || v.steel != null || v.factions) { if (v.level) o.level = v.level; if (v.steel != null) o.steel = v.steel; if (v.factions) o.factions = v.factions; } o.targets = E.targetsFor(o);
        let w = st.weapon;
        if (v.pel || v.fo !== undefined) { w = JSON.parse(JSON.stringify(st.weapon)); const a = w.attacks[st.atk]; if (v.pel) a.pellets *= v.pel; if (v.fo !== undefined) { if (v.fo) a.fo = v.fo; else delete a.fo; } }
        rows.push({ v: v.v, ext: o.ext, lev: o.targets.levels, steel: o.steel, density: o.density, res: builds.map((bd) => {
          if (bd.mods && !bd.ids) bd.ids = bd.mods.map((n) => /^riven/i.test(n) ? "__riven" : (window.WF_MODS.find((m) => m.en === n) || { id: "?" + n }).id);
          if (bd.rivStats && !bd.rivEff) bd.rivEff = A.effFromStats(bd.rivStats);
          const bad = bd.ids.filter((i) => i[0] === "?"); if (bad.length) return { n: bd.n + " UNKNOWN " + bad.join(",") };
          const x = A.evalBuild(bd.ids, bd.val || null, bd.arcane === undefined ? null : bd.arcane, o, bd.rivEff || undefined, null, w);
          const pf = {};
          for (const f in x.perF || {}) { const q = x.perF[f]; const one = (y) => ({ ttk: +y.ttk.toFixed(3), ttkH: +y.ttkHeavy.toFixed(3), ttkEx: y.ttkEx != null ? +y.ttkEx.toFixed(3) : null, clear: +y.clear.toFixed(3), Keff: y.Keff, tg: y.target, tgH: y.targetHeavy });
            pf[f] = { lo: one(q), hi: one(q.hi), top: one(q.top), direct: q.direct / 4.25, dotBy: Object.fromEntries(Object.entries(q.dotBy).map(([k, vv]) => [k, vv / 4.25])), blast: q.blast / 4.25 }; }
          return { n: bd.n, s: x.score, pf, cc: x.cc, cd: x.cd, critf: x.critf, ms: x.ms, rate: x.rate, sc: x.sc, procs: x.procs, K: x.K, N: x.N, ntypes: x.ntypes, gco: x.gco, dmgb: x.dmgb, sd: x.sd, total: x.total, Btot: x.Btot, mbd: x.mbd, Tdur: x.Tdur, dotN: x.dotN, lay: x.layout ? x.layout.coef : null, mp: x.layout ? x.layout.mp : null }; }) });
      }
      return { evo: st.evoSel, atk: st.weapon.attacks[st.atk].name, pellets: st.weapon.attacks[st.atk].pellets, rows, og: [100, 200, 350, 150, 250, 400].map((l) => [l, E.overguardAt ? E.overguardAt(l) : null]) };
    }, { builds: j.builds, vars: j.vars || [{ v: "as is" }] });
    out.push(Object.assign({ name: j.name }, r, { errs: errs.slice(0, 2) }));
    await pg.close();
  }
  await b.close();
  console.log(JSON.stringify(out));
})();
