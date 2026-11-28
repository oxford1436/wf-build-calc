// Sancti Magistar heavy slam: what if the "x2 for Heavy Attacks" crit chance (riven, Galvanized Steel) does NOT apply to Heavy Slams?
// The engine doubles it (isHeavy). Here Galvanized Steel and the riven's crit chance go through `ccHeavyNoDouble` instead of `cc`.
const p = require("playwright"); const repo = process.env.WFREPO || "/home/claude/wf-build-calc";
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
    const byEn = (n) => MODS.find((m) => m.en === n);
    const val = (k) => A.rivPlanVal("melee", k, "3+1");
    const STATS = ["dmg", "cc", "cd", "ic", "slam", "heavyd", "tox"];
    const out = {};
    for (const [mode, dbl] of [["doubled (engine)", true], ["not doubled on heavy slams", false]]) {
      const mods0 = BUILD.map((n) => { const m = byEn(n); if (!dbl && n === "Galvanized Steel") return Object.assign({}, m, { eff: { ccHeavyNoDouble: 1.1 } }); return m; });
      const rivEff = (ks) => { const e = A.effFromStats(ks.map((k) => [k, val(k)])); if (!dbl && e.cc) { e.ccHeavyNoDouble = e.cc; delete e.cc; } return e; };
      for (const [cond, patch] of [["kept", { killRamp: false }], ["kept, no slam combo gain", { killRamp: false, slamNoCombo: true }]]) {
        const o = Object.assign(A.readOpts(), patch, { val: null, arcane: "melee_exposure", elemOrder: null, layoutTTK: true, conceptPenalty: false }); o.targets = E.targetsFor(o);
        const atk = st.weapon.attacks[st.atk];
        const met = (mods) => { const x = E.evaluate(st.weapon, atk, mods, o); const fs = Object.keys(x.perF); return { hit: x.critf * Math.exp(fs.reduce((s, f) => s + Math.log(x.perF[f].perShot), 0) / fs.length), M: x.M, cc: x.cc, cd: x.cd }; };
        const base = met(mods0), rows = [];
        for (let i = 0; i < STATS.length; i++) for (let j = i + 1; j < STATS.length; j++) for (let k = j + 1; k < STATS.length; k++) {
          const c = [STATS[i], STATS[j], STATS[k]]; if (c.filter((x) => x === "slam" || x === "heavyd").length > 1) continue;
          for (const s of [1, 3]) { const mods = mods0.slice(); mods[s] = { id: "__riven", eff: rivEff(c) }; const m = met(mods); rows.push([c.join("+"), s === 1 ? "PPP" : "CorruptCharge", +(m.hit / base.hit).toFixed(3), m.M, +m.cc.toFixed(2), +m.cd.toFixed(2)]); }
        }
        rows.sort((x, y) => y[2] - x[2]);
        out[mode + " / " + cond] = { base: { M: base.M, cc: +base.cc.toFixed(3), cd: +base.cd.toFixed(2), hit: Math.round(base.hit) }, top: rows.slice(0, 7), pick: rows.filter((q) => (q[0] === "dmg+cc+ic" && q[1] === "CorruptCharge") || (q[0] === "dmg+cc+cd" && q[1] === "PPP")) };
      }
    }
    return out;
  }, { BUILD });
  console.log(JSON.stringify(r, null, 1)); await b.close();
})();
