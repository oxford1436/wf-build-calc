// "아직 세팅 안 한 최상위 무기 중 어디에 리벤을 맞출까" (2026-11-28): each candidate through the app's own run path
// (share hash -> auto run -> "맞출 예정" riven phase), generic conditions (no warframe, Steel Path 150/250/400, three factions,
// 12-enemy pack; companion Bond mods on like the user's Arsenal). Same reader as run.js.
//   node cand_run.js '<json list of {k,w,a,evo?,f?}>' > out.json
const p = require("playwright");
const repo = process.env.WFREPO || "/home/claude/wf-build-calc";
const LIST = JSON.parse(process.argv[2]);
const PER = +(process.env.PER_TIMEOUT || 900000);
(async () => {
  const b = await p.chromium.launch();
  const out = [];
  for (const c of LIST) {
    const t0 = Date.now();
    const pg = await b.newPage(); const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
    const f = Object.assign({ rivmode: "plan" }, c.f || {});
    const S = { w: c.w, a: c.a, f, ab: [], abp: {}, mb: c.mb || ["tenacious_bond", "reinforced_bond"], s: [] };
    if (c.evo) S.evo = c.evo;
    const h = Buffer.from(JSON.stringify(S), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    await pg.goto("file://" + repo + "/index.html#s=" + h); await pg.waitForFunction(() => window.WF_APP);
    const plan = f.rivmode === "plan";
    try {
      await pg.waitForFunction((plan) => { const R = window.WF_APP && window.WF_APP.st.results; return R && R.res && R.res.length && (plan ? !!R.rivBest : !document.querySelector("#runbtn").disabled); }, plan, { timeout: PER, polling: 2000 });
    } catch (e) { out.push({ k: c.k, err: "timeout", errs }); console.error(c.k, "timeout"); await pg.close(); continue; }
    const r = await pg.evaluate(() => {
      const A = window.WF_APP, st = A.st, Rr = st.results, o = Rr.o;
      const ko = (id) => id === "__riven" ? "리벤" : (A.MOD_BY_ID[id] || { ko: id }).ko;
      const one = (top, rivEff) => { const x = A.evalBuild(top.ids, top.val, top.arcane, null, rivEff); const pf = {};
        for (const f in x.perF) pf[f] = { c: +x.perF[f].clear.toFixed(2), one: x.perF[f].oneLv };
        // the same build against one heavy unit and against the calculator's boss (10x heavy), kill stacks kept (a heavy among trash)
        const alt = (patch) => { try { const o2 = Object.assign({}, o, patch); o2.targets = window.WFEngine.targetsFor(o2); return +A.evalBuild(top.ids, top.val, top.arcane, o2, rivEff).score.toFixed(4); } catch (e) { return null; } };
        return { score: +x.score.toFixed(4), single: alt({ scenario: "single", killRamp: false }), boss: alt({ scenario: "boss" }), kept: alt({ killRamp: false }), mods: top.ids.map(ko), arcane: top.arcane, val: top.val, pf, rate: +x.rate.toFixed(2), cc: +x.cc.toFixed(2), cd: +x.cd.toFixed(2) }; };
      const base = one(Rr.res[0]);
      const riv = Rr.rivBest ? Object.assign(one(Rr.rivBest.top, Rr.rivBest.riv.eff), { riven: Rr.rivBest.riv.info }) : null;
      const w = st.weapon, atk = w.attacks[st.atk];
      return { weapon: w.id, ko: w.ko, attack: atk.name, evoNames: (st.base.evos || []).filter((t) => t.tier > 1).map((t) => t.tier + ":" + (t.perks[st.evoSel[t.tier]] || {}).name),
        o: { level: o.level, steel: o.steel, factions: o.factions, scenario: o.scenario, levels: o.targets.levels, cdFinalAdd: o.ext && o.ext.cdFinalAdd, frAdd: o.ext && o.ext.frAdd }, gaps: (w.gaps || []).length, base, riv };
    });
    out.push(Object.assign({ k: c.k, sec: Math.round((Date.now() - t0) / 1000) }, r, { errs: errs.slice(0, 3) }));
    console.error(c.k, Math.round((Date.now() - t0) / 1000) + "s", r.attack, r.base.score, r.riv ? r.riv.score : "-", r.riv ? JSON.stringify(r.riv.riven.map((i) => i.k)) : "");
    require("fs").writeFileSync(process.env.OUT || "/tmp/cand_out.json", JSON.stringify(out));
    await pg.close();
  }
  console.log(JSON.stringify(out));
  await b.close();
})();
