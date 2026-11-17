const p = require("playwright"); const repo = "/home/claude/wf-build-calc";
const J = [{ w: "boar_prime", mods: ["Riven", "Galvanized Hell", "Shotgun Barrage", "Critical Deceleration", "Primed Blunderbuss", "Primed Ravage", "Primed Point Blank", "Galvanized Savvy", "Galvanized Acceleration"] },
  { w: "boar_prime", mods: ["Riven", "Galvanized Hell", "Shotgun Barrage", "Critical Deceleration", "Primed Blunderbuss", "Primed Ravage", "Primed Point Blank", "Galvanized Savvy"] },
  { w: "laetum", mods: ["Riven", "Primed Heated Charge", "Frostbite", "Galvanized Diffusion", "Hornet Strike", "Lethal Torrent", "Scorch", "Anemic Agility", "Lethal Momentum"] },
  { w: "laetum", mods: ["Riven", "Primed Heated Charge", "Frostbite", "Galvanized Diffusion", "Hornet Strike", "Lethal Torrent", "Scorch", "Anemic Agility"] }];
(async () => { const b = await p.chromium.launch(); const pg = await b.newPage();
  await pg.goto("file://" + repo + "/index.html"); await pg.waitForFunction(() => window.WF_APP && window.WF_WEAPONS && window.WFEngine);
  const r = await pg.evaluate((J) => J.map((j) => { const A = window.WF_APP, E = window.WFEngine, w = window.WF_WEAPONS.find((x) => x.id === j.w);
    const mods = j.mods.map((n) => n === "Riven" ? { id: "__riven" } : A.MOD_BY_ID[(window.WF_MODS.find((m) => m.en === n) || {}).id]);
    const cp = E.capacityPlan(w, mods, null); const list = mods.map((m) => m.id === "__riven" ? "리벤 18 (아무 극성)" : m.ko + " " + m.drain + " " + (m.pol || "-") + (m.exilus ? " EX" : ""));
    return { w: j.w, pol: w.pol || [], xpol: w.xpol, list, cp: JSON.stringify(cp).slice(0, 700) }; }), J);
  for (const x of r) { console.log(x.w, "slots:", JSON.stringify(x.pol), "exilus:", x.xpol); console.log("  " + x.list.join(" | ")); console.log("  " + x.cp); }
  await b.close(); })();
