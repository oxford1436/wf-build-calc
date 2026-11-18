// score given builds under a list of conditions (same app path as run.js: share hash -> app state -> WF_APP.evalBuild)
// usage: node sens.js jobs.json [json|pf] — jobs: [{ name, cfg: "<key in run.js CFG>", patch?, f?, ab?, evo?, a?, cast?, vars: [{ v, pel?, fo?, o?, level?, steel?, factions? }],
//   builds: [{ n, mods | ids, arcane, val, riv: [stat keys at the planned max, 3+1] | rivStats: [[key, value]] | rivEff }] }]
const p = require("playwright"); const repo = "/home/claude/wf-build-calc";
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
    await pg.goto("file://" + repo + "/index.html#s=" + h); await pg.waitForFunction((w) => window.WF_APP && window.WF_APP.st.weapon && (window.WF_APP.st.base || window.WF_APP.st.weapon).id === w, c.w);
    const r = await pg.evaluate(({ builds, vars }) => {
      const A = window.WF_APP, E = window.WFEngine, st = A.st;
      const rows = [];
      for (const v of vars) {
        const o = Object.assign(A.readOpts(), v.o || {}); if (v.level || v.steel != null || v.factions) { if (v.level) o.level = v.level; if (v.steel != null) o.steel = v.steel; if (v.factions) o.factions = v.factions; } o.targets = E.targetsFor(o);
        let w = st.weapon;
        if (v.pel || v.fo !== undefined) { w = JSON.parse(JSON.stringify(st.weapon)); const a = w.attacks[st.atk]; if (v.pel) a.pellets *= v.pel; if (v.fo !== undefined) { if (v.fo) a.fo = v.fo; else delete a.fo; } }
        rows.push({ v: v.v, res: builds.map((bd) => {
          // bd.mods = English names ("Riven" = the riven slot); bd.riv = riven stat keys at the planned (max) value, 3 positives + 1 negative form
          if (bd.mods && !bd.ids) bd.ids = bd.mods.map((n) => /^riven/i.test(n) ? "__riven" : (window.WF_MODS.find((m) => m.en === n) || { id: "?" + n }).id);
          // bd.rivStats = [[stat key, value as a fraction]] — any roll (min/mid/max) and a negative, e.g. [["ms",1.212],["x_zoom",-0.34]]
          if (bd.rivStats && !bd.rivEff) bd.rivEff = A.effFromStats(bd.rivStats);
          if (bd.riv && !bd.rivEff) bd.rivEff = A.effFromStats(bd.riv.map((k) => [k, A.rivPlanVal(st.weapon.cls === "pistol" ? "pistol" : st.weapon.cls, k, "3+1")]));
          const bad = bd.ids.filter((i) => i[0] === "?"); if (bad.length) return { n: bd.n + " UNKNOWN " + bad.join(","), s: 0, pf: {}, cc: 0, cd: 0, ms: 0, rate: 0, sc: 0, lay: "" };
          const x = A.evalBuild(bd.ids, bd.val || null, bd.arcane === undefined ? null : bd.arcane, o, bd.rivEff || undefined, null, w);
          const pf = {}; for (const f in x.perF || {}) pf[f] = [+x.perF[f].clear.toFixed(2), x.perF[f].hi ? +x.perF[f].hi.clear.toFixed(2) : null, x.perF[f].top ? +x.perF[f].top.clear.toFixed(2) : null];
          return { n: bd.n, s: x.score, pf, cc: x.cc, cd: x.cd, ms: x.ms, rate: x.rate, sc: x.sc, lay: x.layout ? Object.entries(x.layout.coef).filter(([, q]) => q > 0.005).map(([t, q]) => t + q.toFixed(2)).join("+") : "" }; }) });
      }
      return { evo: st.evoSel, atk: st.weapon.attacks[st.atk].name, pellets: st.weapon.attacks[st.atk].pellets, rows };
    }, { builds: j.builds, vars: j.vars || [{ v: "as is" }] });
    out.push(Object.assign({ name: j.name }, r, { errs: errs.slice(0, 2) }));
    await pg.close();
  }
  await b.close();
  if (process.argv[3] === "json") { console.log(JSON.stringify(out)); return; }
  for (const o of out) { console.log("## " + o.name + " (" + o.atk + ", evo " + JSON.stringify(o.evo) + ", pellets " + o.pellets + ")" + (o.errs.length ? " ERR " + o.errs.join("|") : ""));
    for (const row of o.rows) { const s0 = row.res[0].s; console.log(" [" + row.v + "]");
      for (const x of row.res) console.log("  " + x.n.padEnd(14) + x.s.toFixed(4).padStart(9) + (x.s / s0 * 100).toFixed(1).padStart(8) + "%  " + (process.argv[3] === "pf" ? JSON.stringify(x.pf) + "  cc" + (+x.cc).toFixed(2) + " cd" + (+x.cd).toFixed(2) + " ms" + (+x.ms).toFixed(2) + " r" + (+x.rate).toFixed(2) + " " + x.lay : "")); } }
})();
