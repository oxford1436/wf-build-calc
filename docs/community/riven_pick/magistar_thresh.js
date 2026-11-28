// Highest Steel Path level at which one heavy slam still kills (light unit / heavy unit / Eximus), current build vs with the riven.
const p = require("playwright"); const repo = process.env.WFREPO || "/home/claude/wf-build-calc";
const BUILD = ["Galvanized Reflex", "Primed Pressure Point", "Focus Radon", "Corrupt Charge", "Blood Rush", "Galvanized Steel", "Seismic Wave", "Primed Fever Strike"];
// Wukong Prime as in the user's Arsenal (2026-11-28): Ready Steel, Arcane Fury + Strike, three Tauforged Violet shards (melee crit damage,
// doubled over 500 max energy — 556) and two casting-speed shards; companion Tenacious Bond (Arsenal crit multiplier 8.4x = 2.2 × 3.25 + 1.2)
const F = { rivmode: "none", frame: "wukong_prime", aura: "ready_steel", fa0: "아케인 퓨리", fa1: "아케인 스트라이크", energy: "556", strength: "190", duration: "209", range: "34", efficiency: "160",
  sh0: "v_mcd", tau0: true, sh1: "v_mcd", tau1: true, sh2: "v_mcd", tau2: true, sh3: "a_cast", sh4: "a_cast" };
const CD = process.env.CDADD === undefined ? 0 : +process.env.CDADD;   // extra melee crit damage on top of the shards (0: the Arsenal is matched without it since v2.23)
(async () => {
  const b = await p.chromium.launch(); const pg = await b.newPage(); const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
  const S = { w: "sancti_magistar", a: 2, evo: { 2: 1, 3: 0, 4: 2 }, f: F, mb: ["nira_hatred", "nira_anguish", "tenacious_bond"], s: [] };
  const h = Buffer.from(JSON.stringify(S), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  await pg.goto("file://" + repo + "/index.html#s=" + h); await pg.waitForFunction(() => window.WF_APP && window.WF_APP.st.weapon && (window.WF_APP.st.base || window.WF_APP.st.weapon).id === "sancti_magistar", null, { timeout: 60000 });
  await pg.waitForTimeout(1500);
  const r = await pg.evaluate(({ BUILD, CD }) => {
    const A = window.WF_APP, E = window.WFEngine, st = A.st, MODS = window.WF_MODS;
    const id = (n) => (MODS.find((m) => m.en === n) || { id: "?" + n }).id, ids = BUILD.map(id);
    const rv = (ks) => ks.map((k) => [k, A.rivPlanVal("melee", k, "3+1")]);
    const sets = { current: [ids, null], "riven dmg+cc+ic in Corrupt Charge slot": [ids.map((x, i) => i === 3 ? "__riven" : x), rv(["dmg", "cc", "ic"])], "riven dmg+cc+cd in Primed Pressure Point slot": [ids.map((x, i) => i === 1 ? "__riven" : x), rv(["dmg", "cc", "cd"])] };
    const at = (bd, L, f) => { const o = Object.assign(A.readOpts(), { killRamp: false, level: L, factions: [f] }); if (CD) o.ext = Object.assign({}, o.ext, { cdAdd: (o.ext.cdAdd || 0) + CD }); o.targets = E.targetsFor(o);
      const x = A.evalBuild(bd[0], null, "melee_exposure", o, bd[1] ? A.effFromStats(bd[1]) : undefined, null, st.weapon); const q = x.perF[f]; return { lev: o.targets.levels[0], t: q.ttk, tH: q.ttkHeavy, tE: q.ttkEx, hit: x.critf * q.perShot, hp: q.target && q.target.hp, hpH: q.targetHeavy && q.targetHeavy.hp }; };
    const out = {}; const facs = ["grineer", "corpus", "infested", "corrupted"];
    for (const name in sets) { out[name] = {};
      for (const f of facs) { let probe; try { probe = at(sets[name], 150, f); } catch (e) { out[name][f] = "err " + e.message; continue; }
        const find = (key) => { if (probe[key] == null) return null; if (at(sets[name], 9999, f)[key] < 1e-6) return ">9999"; let lo = 150, hi = 9999; if (probe[key] > 1e-6) return "<150"; while (hi - lo > 5) { const mid = Math.round((lo + hi) / 2); if (at(sets[name], mid, f)[key] < 1e-6) lo = mid; else hi = mid; } return lo; };
        out[name][f] = { light: find("t"), heavy: find("tH"), eximus: find("tE"), hit150: Math.round(probe.hit), lev: probe.lev, hp150: Math.round(probe.hp), hpH150: Math.round(probe.hpH) }; } }
    const o = A.readOpts(); return { out, levels: E.targetsFor(Object.assign(o, { level: 1000 })).levels };
  }, { BUILD, CD });
  console.log(JSON.stringify(r, null, 1)); if (errs.length) console.log("ERR", errs.slice(0, 3)); await b.close();
})();
