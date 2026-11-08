// Kuva Tonkor vs Kuva Zarr / Kuva Ogris (user's rivens) through the app's run path (share hash -> auto run)
const p = require("playwright");
const repo = "/home/claude/wf-build-calc";
const CYTE = { frame: "cyte_09", helminth: "Nourish", strength: "298", duration: "226", range: "34", efficiency: "45", energy: "655", armor: "150", health: "325", shield: "235", sprint: "1.1",
  aura: "growing_power", fa0: "아케인 라이즈", fa1: "아케인 스컬프터", sh0: "a_cast", tau0: true, sh1: "v_elec", tau1: true, sh2: "v_elec", tau2: true };
const W = {
  tonkor: { w: "kuva_tonkor", f: { rivmode: "none", valtype: "auto", valpct: "60" } },
  tonkor_riv: { w: "kuva_tonkor", f: { rivmode: "plan", valtype: "auto", valpct: "60" } },
  zarr: { w: "kuva_zarr", f: { rivmode: "owned", rk0: "cd", rv0: "143", ri0: true, rk1: "ms", rv1: "102.1", ri1: true, rk2: "cc", rv2: "181.9", ri2: true, rk3: "dur", rv3: "84.5", ri3: true, valtype: "tox", valpct: "37" } },
  ogris: { w: "kuva_ogris", f: { rivmode: "owned", rk0: "dmg", rv0: "200.4", ri0: true, rk1: "ms", rv1: "109.6", ri1: true, rk2: "fac_i", rv2: "1.56", ri2: true, rk3: "reload", rv3: "42.5", ri3: true, valtype: "heat", valpct: "28.7" } },
};
const which = (process.argv[2] || "tonkor,zarr,ogris").split(",");
const scen = (process.argv[3] || "cyte0").split(",");
(async () => {
  const b = await p.chromium.launch();
  const out = [];
  for (const sc of scen) for (const k of which) {
    const pg = await b.newPage(); const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
    await pg.goto("file://" + repo + "/index.html"); await pg.waitForFunction(() => window.WF_APP && window.WF_WEAPONS);
    const a = await pg.evaluate((id) => window.WF_APP.defaultAttack(window.WF_WEAPONS.find((x) => x.id === id)), W[k].w);
    const cyte = sc.startsWith("cyte");
    const res = cyte && !sc.startsWith("cytenr"); const cast = res ? sc.slice(4) : null;
    const f = Object.assign({}, cyte ? CYTE : {}, W[k].f);
    const S = { w: W[k].w, a, evo: {}, f, ab: res ? ["Resupply"] : [], abp: res ? { Resupply: cast } : {}, mb: ["tenacious_bond", "reinforced_bond"], s: [] };
    const h = Buffer.from(JSON.stringify(S), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    await pg.goto("file://" + repo + "/index.html#s=" + h); await pg.reload();
    try {
      await pg.waitForFunction((plan) => { const R = window.WF_APP && window.WF_APP.st.results; return R && R.res && R.res.length && !document.querySelector("#runbtn").disabled && (!plan || R.rivBest); }, W[k].f.rivmode === "plan", { timeout: 1500000, polling: 2000 });
    } catch (e) { out.push({ k, sc, err: "timeout", errs }); await pg.close(); continue; }
    const r = await pg.evaluate(() => {
      const A = window.WF_APP, Rr = A.st.results, o = Rr.o, top = Rr.rivBest ? Rr.rivBest.top : Rr.res[0], rivEff = Rr.rivBest ? Rr.rivBest.riv.eff : undefined;
      const ko = (id) => id === "__riven" ? "리벤" : (A.MOD_BY_ID[id] || { ko: id }).ko;
      const x = A.evalBuild(top.ids, top.val, top.arcane, null, rivEff);
      const pf = {}; for (const f in x.perF) pf[f] = { clear150: +x.perF[f].clear.toFixed(2), clearTop: +((x.perF[f].top || x.perF[f].hi).clear).toFixed(2), kps: +x.perF[f].kps.toFixed(3), oneLv: x.perF[f].oneLv };
      const riv = Rr.rivBest ? Rr.rivBest.riv.info : null;
      return { score: x.score, mods: top.ids.map(ko), arcane: top.arcane, val: top.val, pf, rate: x.rate, ammo: x.ammo ? { resupply: !!x.ammo.resupply, sustain: x.ammo.sustain } : null,
        frame: o.frame && o.frame.id, steel: o.steel, level: o.level, factions: o.factions, riv: riv ? JSON.stringify(riv).slice(0, 300) : null };
    });
    out.push(Object.assign({ k, sc }, r, { errs: errs.slice(0, 3) }));
    console.error(k, sc, r.score.toFixed(3), r.mods.join(", "));
    await pg.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
