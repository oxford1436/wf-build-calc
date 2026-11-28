// Sancti Magistar heavy slam (Wukong Prime: Ready Steel, Nira x2, Arcane Fury + Strike, Melee Exposure) — the user's build, every riven in every slot.
// Conditions (VARS): kill stacks from 0 (app default) / kept, slam combo gain on / off, extra melee crit damage (arsenal 8.4x on 2026-10-22 vs the engine's 4.84x).
// measure: average damage of one heavy slam = pre-crit per-hit damage × average crit multiplier (geometric mean over the three factions) × slams per second
const p = require("playwright"); const fs = require("fs"); const repo = process.env.WFREPO || "/home/claude/wf-build-calc";
const BUILD = ["Galvanized Reflex", "Primed Pressure Point", "Focus Radon", "Corrupt Charge", "Blood Rush", "Galvanized Steel", "Seismic Wave", "Primed Fever Strike"];
// Wukong Prime as in the user's Arsenal (2026-11-28): Ready Steel, Arcane Fury + Strike, three Tauforged Violet shards (melee crit damage,
// doubled over 500 max energy — 556) and two casting-speed shards; companion Tenacious Bond (Arsenal crit multiplier 8.4x = 2.2 × 3.25 + 1.2)
const F = { rivmode: "none", frame: "wukong_prime", aura: "ready_steel", fa0: "아케인 퓨리", fa1: "아케인 스트라이크", energy: "556", strength: "190", duration: "209", range: "34", efficiency: "160",
  sh0: "v_mcd", tau0: true, sh1: "v_mcd", tau1: true, sh2: "v_mcd", tau2: true, sh3: "a_cast", sh4: "a_cast" };
const VARS = JSON.parse(process.env.VARS || '[{"v":"default"}]');
(async () => {
  const b = await p.chromium.launch(); const pg = await b.newPage(); const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
  const S = { w: "sancti_magistar", a: 2, evo: { 2: 1, 3: 0, 4: 2 }, f: F, mb: ["nira_hatred", "nira_anguish", "tenacious_bond"], s: [] };
  const h = Buffer.from(JSON.stringify(S), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  await pg.goto("file://" + repo + "/index.html#s=" + h); await pg.waitForFunction(() => window.WF_APP && window.WF_APP.st.weapon && (window.WF_APP.st.base || window.WF_APP.st.weapon).id === "sancti_magistar", null, { timeout: 60000 });
  await pg.waitForTimeout(1500);
  const r = await pg.evaluate(({ BUILD, VARS }) => {
    const A = window.WF_APP, E = window.WFEngine, st = A.st, MODS = window.WF_MODS;
    const id = (n) => (MODS.find((m) => m.en === n) || { id: "?" + n }).id, ids = BUILD.map(id);
    const STATS = ["dmg", "cc", "cd", "heat", "cold", "elec", "tox", "sc", "fr", "ic", "x_hae", "x_combochance", "viralm", "corrm", "gasm", "radm", "blastm", "magm", "sd", "heavyd", "slam"];
    const SPL = new Set(["viralm", "corrm", "gasm", "radm", "blastm", "magm", "sd", "heavyd", "slam"]);
    const val = Object.fromEntries(STATS.map((k) => [k, A.rivPlanVal("melee", k, "3+1")]));
    const out = {};
    for (const V of VARS) {
      const o = Object.assign(A.readOpts(), V.o || {}); if (V.ext) o.ext = Object.assign({}, o.ext, V.ext); o.targets = E.targetsFor(o);
      const ev = (ids2, riv) => A.evalBuild(ids2, null, V.arc === undefined ? "melee_exposure" : V.arc, o, riv ? A.effFromStats(riv) : undefined, null, st.weapon);
      const met = (x) => { const fs = Object.keys(x.perF); const g = x.critf * Math.exp(fs.reduce((s, f) => s + Math.log(x.perF[f].perShot), 0) / fs.length); return { hit: g, dps: g * x.rate, s: x.score, M: x.M, cc: x.cc, cd: x.cd, rate: x.rate, dmgb: x.dmgb }; };
      const base = met(ev(ids)), rows = [];
      for (let i = 0; i < STATS.length; i++) for (let j = i + 1; j < STATS.length; j++) for (let k = j + 1; k < STATS.length; k++) {
        const c = [STATS[i], STATS[j], STATS[k]]; if (c.filter((x) => SPL.has(x)).length > 1) continue;
        const riv = c.map((x) => [x, val[x]]);
        for (let s = 0; s < ids.length; s++) { const a = ids.slice(); a[s] = "__riven"; const m = met(ev(a, riv)); rows.push([c.join("+"), s, +(m.hit / base.hit).toFixed(3), m.M, +m.cc.toFixed(2), +m.cd.toFixed(2)]); }
      }
      rows.sort((x, y) => y[2] - x[2]);
      out[V.v] = { base: { hit: Math.round(base.hit), M: base.M, cc: +base.cc.toFixed(2), cd: +base.cd.toFixed(2), rate: +base.rate.toFixed(3), dmgb: base.dmgb, s: +base.s.toFixed(3) }, top: rows.slice(0, 14), all: rows };
    }
    return out;
  }, { BUILD, VARS });
  fs.writeFileSync(process.argv[2] || "scan2_out.json", JSON.stringify(r));
  for (const v in r) { console.log("==", v, JSON.stringify(r[v].base)); for (const t of r[v].top) console.log("  ", JSON.stringify(t)); }
  if (errs.length) console.log("ERR", errs.slice(0, 3)); await b.close();
})();
