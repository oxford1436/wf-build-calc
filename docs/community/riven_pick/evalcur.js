// P5: the user's current secondary builds (arsenal screenshots 2026-11-17) through the app's evalBuild — arsenal numbers vs calculator
const p = require("playwright"); const repo = "/home/claude/wf-build-calc";
const CUR = {
  laetum: { w: "laetum", f: { rivmode: "none", arc: "secondary_enervate" }, arcane: "secondary_enervate", mods: ["Galvanized Diffusion", "Accelerated Isotope", "Lethal Torrent", "Primed Target Cracker", "Pistol Pestilence", "Primed Convulsion", "Primed Heated Charge", "Magnetic Might"],
    arsenal: { fr: 7, ms: 2.7, cc: 0.22, cd: 6.7, sc: 0.352 } },
  nukor: { w: "kuva_nukor", f: { rivmode: "none", valtype: "mag", valpct: "37.8" }, val: { type: "mag", pct: 0.378 }, arcane: "secondary_enervate", mods: ["Primed Target Cracker", "Galvanized Diffusion", "Galvanized Shot", "Lethal Torrent", "Pistol Pestilence", "Frostbite", "Merciless Gunfight", "Primed Heated Charge"],
    arsenal: { fr: 22, ms: 2.7, cc: 0.07, cd: 13.9, sc: 1.5 } },
  toxo: { w: "dual_toxocyst", f: { rivmode: "none" }, arcane: "secondary_merciless", mods: ["Galvanized Diffusion", "Pistol Pestilence", "Primed Pistol Gambit", "Galvanized Crosshairs", "Primed Target Cracker", "Primed Convulsion", "Galvanized Shot", "Scorch"],
    arsenal: { fr: 1.6, ms: 2.1, cc: 0.718, cd: 5.4, sc: 1.11 } },
};
module.exports = { CUR };
if (require.main !== module) return;
(async () => {
  const b = await p.chromium.launch();
  for (const k of (process.argv[2] || "laetum,nukor,toxo").split(",")) {
    const c = CUR[k]; const pg = await b.newPage();
    await pg.goto("file://" + repo + "/index.html"); await pg.waitForFunction(() => window.WF_APP && window.WF_WEAPONS && window.WFEngine);
    const r = await pg.evaluate(({ c }) => {
      const A = window.WF_APP, E = window.WFEngine, w0 = window.WF_WEAPONS.find((x) => x.id === c.w);
      const M = window.WF_MODS, ids = c.mods.map((n) => { const m = M.find((x) => x.en === n); return m ? m.id : "?" + n; });
      const mods = ids.map((i) => A.MOD_BY_ID[i]);
      const o = E.defaults(); o.ext = { cdFinalAdd: 1.2, frAdd: 0.6 }; o.val = c.val || null; o.arcane = null; o.targets = E.targetsFor(o);
      const out = { ids: ids.filter((i) => i[0] === "?"), base: { cc: w0.attacks[0].cc, cd: w0.attacks[0].cd, sc: w0.attacks[0].sc, fr: w0.attacks[0].fr, pellets: w0.attacks[0].pellets, dmg: w0.attacks[0].dmg }, evos: (w0.evos || []).filter((t) => t.tier > 1).map((t) => t.tier + ":" + t.perks.map((p, i) => i + "=" + p.name + "[" + p.items.map((it) => (it.key || "") + (it.v != null ? it.v : "") + (it.form ? "/" + it.form : "")).join(",") + "]").join(" ")) };
      const x = E.evaluate(w0, w0.attacks[0], mods, o);
      out.calc = { cc: x.cc, cd: x.cd, ms: x.ms, sc: x.sc, rate: x.rate, keys: Object.keys(x).filter((k) => typeof x[k] === "number").join(",") };
      return out;
    }, { c });
    console.log(k, JSON.stringify(r).slice(0, 1800)); console.log("  arsenal", JSON.stringify(c.arsenal));
    await pg.close();
  }
  await b.close();
})();
