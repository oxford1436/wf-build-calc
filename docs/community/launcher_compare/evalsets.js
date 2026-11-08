// Evaluate named mod sets under the same state as cmp.js (share hash), without waiting for the auto-run.
const p = require("playwright");
const repo = "/home/claude/wf-build-calc";
const { CYTE, W } = require("./cfg.js");
const jobs = JSON.parse(process.argv[2]);   // [{k, sc, sets:[{n, mods:[en/ko/__riven], arc, val}]}]
(async () => {
  const b = await p.chromium.launch(); const out = [];
  for (const j of jobs) {
    const pg = await b.newPage(); await pg.goto("file://" + repo + "/index.html"); await pg.waitForFunction(() => window.WF_APP && window.WF_WEAPONS);
    const a = await pg.evaluate((id) => window.WF_APP.defaultAttack(window.WF_WEAPONS.find((x) => x.id === id)), W[j.k].w);
    const nn = j.sc.endsWith("nn"), sc0 = nn ? j.sc.slice(0, -2) : j.sc; const cyte = sc0.startsWith("cyte"), res = cyte && !sc0.startsWith("cytenr"), cast = res ? sc0.slice(4) : null;
    const f = Object.assign({}, cyte ? CYTE : {}, W[j.k].f); if (nn) f.helminth = "";
    const S = { w: W[j.k].w, a, evo: {}, f, ab: res ? ["Resupply"] : [], abp: res ? { Resupply: cast } : {}, mb: ["tenacious_bond", "reinforced_bond"], s: [] };
    const h = Buffer.from(JSON.stringify(S), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    await pg.goto("file://" + repo + "/index.html#s=" + h); await pg.reload();
    await pg.waitForFunction(() => window.WF_APP && window.WF_APP.st.weapon);
    await pg.waitForTimeout(1500);
    const r = await pg.evaluate(({ j, f }) => {
      const A = window.WF_APP, E = window.WFEngine;
      const o = Object.assign(A.readOpts(), { targets: null }); o.targets = E.targetsFor(o);
      const rows = []; for (let i = 0; i < 4; i++) if (f["rk" + i]) rows.push({ k: f["rk" + i], v: +f["rv" + i], inc: true });
      const riv = rows.length ? A.parseRiven(rows).eff : null;
      const find = (n) => n === "__riven" ? "__riven" : ((window.WF_MODS.find((m) => m.en === n || m.ko === n) || {}).id || "?" + n);
      return j.sets.map((s) => { const ids = s.mods.map(find); const x = A.evalBuild(ids, s.val, s.arc, Object.assign({}, o, s.o || {}, s.o ? { targets: null } : {}), riv);
        const pf = {}; for (const ff in x.perF) pf[ff] = [+x.perF[ff].clear.toFixed(2), +((x.perF[ff].top || x.perF[ff].hi).clear).toFixed(2), x.perF[ff].oneLv];
        return { n: s.n, score: x.score, ids, pf, rate: +x.rate.toFixed(2), share: Object.fromEntries(Object.entries(x.share || {}).filter(([k, v]) => v > 0.02).map(([k, v]) => [k, +v.toFixed(2)])) }; });
    }, { j, f });
    out.push({ k: j.k, sc: j.sc, r }); await pg.close();
  }
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
