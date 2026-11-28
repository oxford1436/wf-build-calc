// Sancti Magistar: how low can the riven's Initial Combo roll be before the combo tier drops? (riven = melee damage + crit chance + initial combo v, Corrupt Charge slot)
const p = require("playwright"); const repo = "/home/claude/wf-build-calc";
const BUILD = ["Galvanized Reflex", "Primed Pressure Point", "Focus Radon", "Corrupt Charge", "Blood Rush", "Galvanized Steel", "Seismic Wave", "Primed Fever Strike"];
const F = { rivmode: "none", frame: "wukong_prime", aura: "ready_steel", fa0: "아케인 퓨리", fa1: "아케인 스트라이크", energy: "556", strength: "190", duration: "209", range: "34", efficiency: "160",
  sh0: "v_mcd", tau0: true, sh1: "v_mcd", tau1: true, sh2: "v_mcd", tau2: true, sh3: "a_cast", sh4: "a_cast" };
(async () => {
  const b = await p.chromium.launch(); const pg = await b.newPage();
  const S = { w: "sancti_magistar", a: 2, evo: { 2: 1, 3: 0, 4: 2 }, f: F, mb: ["nira_hatred", "nira_anguish", "tenacious_bond"], s: [] };
  const h = Buffer.from(JSON.stringify(S), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  await pg.goto("file://" + repo + "/index.html#s=" + h); await pg.waitForFunction(() => window.WF_APP && window.WF_APP.st.weapon && (window.WF_APP.st.base || window.WF_APP.st.weapon).id === "sancti_magistar", null, { timeout: 60000 });
  await pg.waitForTimeout(1500);
  const r = await pg.evaluate(({ BUILD }) => {
    const A = window.WF_APP, E = window.WFEngine, st = A.st, MODS = window.WF_MODS;
    const id = (n) => (MODS.find((m) => m.en === n) || { id: "?" + n }).id, ids = BUILD.map(id);
    const val = (k) => A.rivPlanVal("melee", k, "3+1");
    const out = { atk: st.weapon.attacks[st.atk].en, icEvo: JSON.stringify((st.weapon.attacks[st.atk].sp || st.weapon.sp || {})).slice(0, 200), range: { dmg: val("dmg"), cc: val("cc"), ic: val("ic"), cd: val("cd") } };
    for (const [name, patch] of [["kept", { killRamp: false }], ["kept, no slam combo gain", { killRamp: false, slamNoCombo: true }], ["from 0", {}], ["from 0, no gain", { slamNoCombo: true }]]) {
      const o = Object.assign(A.readOpts(), patch); o.targets = E.targetsFor(o);
      const ev = (ids2, riv) => A.evalBuild(ids2, null, "melee_exposure", o, riv ? A.effFromStats(riv) : undefined, null, st.weapon);
      const met = (x) => { const fs = Object.keys(x.perF); return { hit: x.critf * Math.exp(fs.reduce((s, f) => s + Math.log(x.perF[f].perShot), 0) / fs.length), M: x.M }; };
      const base = met(ev(ids)); const rows = [];
      for (const v of [24.8, 25.5, 26, 27, 28, 29, 30, 30.3]) { const a = ids.slice(); a[3] = "__riven"; const m = met(ev(a, [["dmg", val("dmg")], ["cc", val("cc")], ["ic", v]])); rows.push(v + ": M " + m.M + " ×" + (m.hit / base.hit).toFixed(3)); }
      // low rolls of the two essential stats too (bottom of the wiki range = ×0.9/1.1 of the top)
      const lo = (k) => val(k) * 0.9 / 1.1; const a = ids.slice(); a[3] = "__riven";
      const mLo = met(ev(a, [["dmg", lo("dmg")], ["cc", lo("cc")], ["ic", 30.3]]));
      out[name] = { baseM: base.M, rows, allLow: "dmg/cc at the bottom of the range, ic 30.3: M " + mLo.M + " ×" + (mLo.hit / base.hit).toFixed(3) };
    }
    return out;
  }, { BUILD });
  console.log(JSON.stringify(r, null, 1)); await b.close();
})();
