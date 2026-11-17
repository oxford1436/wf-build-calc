// "어느 무기에 리벤을 맞출까" (2026-11-17): each weapon through the app's own run path (share hash -> auto run -> "맞출 예정" riven
// phase). Optional patch (primaries on Cyte-09, shooting packs through walls): see README.md "벽 너머 뿌리기 조건".
const p = require("playwright");
const repo = "/home/claude/wf-build-calc";
const CYTE = { frame: "cyte_09", helminth: "Nourish", strength: "298", duration: "226", range: "34", efficiency: "45", energy: "655", armor: "150", health: "325", shield: "235", sprint: "1.1",
  aura: "growing_power", fa0: "아케인 라이즈", fa1: "아케인 스컬프터", sh0: "a_cast", tau0: true, sh1: "v_elec", tau1: true, sh2: "v_elec", tau2: true, sh3: "v_elec", tau3: true, sh4: "v_elec", tau4: true };
const ARB = { level: "100", steel: false, objective: "geo", scenario: "crowd" };
const spray = (id, atk, c, fo, extra) => ({ weapons: { [id]: { atk, pelletsMul: c, fo, noSpread: true } }, defaults: Object.assign({ hits: { "기본 사격": 12 }, tAcq: 0.01 }, extra || {}), resupplyElem: "elec" });
const CFG = {
  laetum: { w: "laetum", f: { rivmode: "plan" } },
  nukor: { w: "kuva_nukor", f: { rivmode: "plan", valtype: "mag", valpct: "37.8" } },
  toxo: { w: "dual_toxocyst", f: { rivmode: "plan" } },
  toxoinc: { w: "dual_toxocyst", a: 1, f: { rivmode: "plan" } },
  laetum3: { w: "laetum", a: 3, f: { rivmode: "plan" } },      // the whole Incarnon shot (direct hit + 2 m blast), as in builds/laetum.json
  // P4 (v2.17): the Arca Plasmor recommendation in the notes had the unreleased Primed Blunderbuss — re-run with the user's riven
  plasmor: { w: "tenet_arca_plasmor", early: true, f: { rivmode: "owned", rk0: "fr", rv0: "95.5", ri0: true, rk1: "ms", rv1: "143.6", ri1: true, rk2: "ammoeff", rv2: "54.3", ri2: true, rk3: "x_zoom", rv3: "37.4", ri3: true, valtype: "tox", valpct: "60" } },
  laetum0: { w: "laetum", f: { rivmode: "none" } },
  nukor0: { w: "kuva_nukor", f: { rivmode: "none", valtype: "mag", valpct: "37.8" } },
  toxo0: { w: "dual_toxocyst", f: { rivmode: "none" } },
  boar: { w: "boar_prime", a: 0, cyte: true, f: Object.assign({ rivmode: "plan" }, ARB), patch: spray("boar_prime", "Normal Attack", 0.05, null) },
  strun: { w: "strun_prime", a: 1, cyte: true, f: Object.assign({ rivmode: "plan" }, ARB), patch: spray("strun_prime", "Normal Attack", 0.05, null) },
  boar005: { w: "boar_prime", a: 0, cyte: true, f: Object.assign({ rivmode: "plan" }, ARB), patch: spray("boar_prime", "Normal Attack", 0.005, null) },
  strun005: { w: "strun_prime", a: 1, cyte: true, f: Object.assign({ rivmode: "plan" }, ARB), patch: spray("strun_prime", "Normal Attack", 0.005, null) },
  boar0: { w: "boar_prime", a: 0, cyte: true, f: Object.assign({ rivmode: "none" }, ARB), patch: spray("boar_prime", "Normal Attack", 0.05, null) },
  strun0: { w: "strun_prime", a: 1, cyte: true, f: Object.assign({ rivmode: "none" }, ARB), patch: spray("strun_prime", "Normal Attack", 0.05, null) },
};
const init = (P) => {
  const hook = (name, fn) => { let v; Object.defineProperty(window, name, { configurable: true, get() { return v; }, set(x) { v = x; try { fn(x); } catch (e) { console.error("patch " + name + ": " + e.message); } } }); };
  hook("WF_WEAPONS", (W) => { for (const id in (P.weapons || {})) { const w = W.find((x) => x.id === id), pw = P.weapons[id]; for (const a of w.attacks) if (a.en === pw.atk) { if (pw.pelletsMul) a.pellets *= pw.pelletsMul; if ("fo" in pw) { if (pw.fo) a.fo = pw.fo; else delete a.fo; } if (pw.noSpread) delete a.spread; a._patched = true; } } });
  hook("WFEngine", (E) => { const d0 = E.defaults; E.defaults = () => Object.assign(d0(), P.defaults || {}); });
  hook("WF_BUFFS", (B) => { if (P.resupplyElem && B.resupplyElem) B.resupplyElem.v = P.resupplyElem; });
};
module.exports = { CFG, CYTE, ARB, init, spray };
if (require.main !== module) return;
const which = (process.argv[2] || "").split(",").filter(Boolean);
(async () => {
  const b = await p.chromium.launch();
  const out = [];
  for (const k of which) {
    const c = CFG[k]; const t0 = Date.now();
    let pg = await b.newPage(); const errs = []; pg.on("pageerror", (e) => errs.push(e.message)); pg.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
    if (c.patch) await pg.addInitScript(init, c.patch);
    await pg.goto("file://" + repo + "/index.html"); await pg.waitForFunction(() => window.WF_APP && window.WF_WEAPONS);
    const a = c.a;      // undefined = the app's own default attack (restoreState leaves it alone)
    const f = Object.assign({}, c.cyte ? CYTE : {}, c.f);
    const S = { w: c.w, a, f, ab: c.cyte ? ["Resupply"].concat(c.ab || ["Nourish"]) : [], abp: c.cyte ? { Resupply: "0" } : {}, mb: ["tenacious_bond", "reinforced_bond"], s: [] };
    const h = Buffer.from(JSON.stringify(S), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    await pg.close(); pg = await b.newPage(); pg.on("pageerror", (e) => errs.push(e.message));
    if (c.patch) await pg.addInitScript(init, c.patch);
    await pg.goto("file://" + repo + "/index.html#s=" + h); await pg.waitForFunction(() => window.WF_APP);
    const plan = c.f.rivmode === "plan";
    try {
      await pg.waitForFunction((plan) => { const R = window.WF_APP && window.WF_APP.st.results; return R && R.res && R.res.length && (plan.plan ? !!R.rivBest : plan.early ? true : !document.querySelector("#runbtn").disabled); }, { plan, early: !!c.early }, { timeout: 3000000, polling: 3000 });
    } catch (e) { out.push({ k, err: "timeout", errs }); await pg.close(); continue; }
    const r = await pg.evaluate(() => {
      const A = window.WF_APP, st = A.st, Rr = st.results, o = Rr.o;
      const ko = (id) => id === "__riven" ? "리벤" : (A.MOD_BY_ID[id] || { ko: id }).ko;
      const one = (top, rivEff) => { const x = A.evalBuild(top.ids, top.val, top.arcane, null, rivEff); const pf = {};
        for (const f in x.perF) pf[f] = { c: +x.perF[f].clear.toFixed(2), cHi: x.perF[f].hi ? +x.perF[f].hi.clear.toFixed(2) : null, cTop: x.perF[f].top ? +x.perF[f].top.clear.toFixed(2) : null, one: x.perF[f].oneLv };
        return { score: x.score, ids: top.ids, mods: top.ids.map(ko), arcane: top.arcane, val: top.val, pf, rate: x.rate, cc: x.cc, cd: x.cd, ms: x.ms, sc: x.sc, layout: x.layout ? Object.fromEntries(Object.entries(x.layout.coef).filter(([, v]) => v > 0.005).map(([t, v]) => [t, +v.toFixed(2)])) : null }; };
      const base = one(Rr.res[0]);
      const riv = Rr.rivBest ? Object.assign(one(Rr.rivBest.top, Rr.rivBest.riv.eff), { riven: Rr.rivBest.riv.info, eff: Rr.rivBest.riv.eff }) : null;
      const alts = (Rr.rivAlts || []).map((x) => ({ info: x.riv.info.map((i) => i.k + ":" + (+i.v).toFixed(1)).join(" "), score: A.evalBuild(x.top.ids, x.top.val, x.top.arcane, null, x.riv.eff).score, mods: x.top.ids.map(ko), arcane: x.top.arcane }));
      const planTop = Rr.rivPlan ? Rr.rivPlan.out.slice(0, 10).map((x) => x.form + " " + x.stats.join("+") + " " + (x.gain != null ? (+x.gain).toFixed(3) : x.score != null ? (+x.score).toFixed(3) : "") + " slot:" + ko(x.slot)) : null;
      const w = st.weapon, atk = w.attacks[st.atk];
      return { weapon: w.id, attack: atk.name, pellets: atk.pellets, fo: atk.fo || null, evo: st.evoSel, evoNames: (st.base.evos || []).filter((t) => t.tier > 1).map((t) => t.tier + ":" + (t.perks[st.evoSel[t.tier]] || {}).name),
        o: { level: o.level, steel: o.steel, factions: o.factions, scenario: o.scenario, hits: o.hits || null, tAcq: o.tAcq, frame: o.frame && o.frame.id, xhit: o.ext && o.ext.xhit, xhitElem: o.ext && o.ext.xhitElem, abil: [...document.querySelectorAll('#abilities input.abil')].filter((x) => x.checked).map((x) => x.value), spread: atk.spread || null, extKeys: Object.keys(o.ext || {}).join(','), elem: o.ext && o.ext.elem, cdFinalAdd: o.ext && o.ext.cdFinalAdd, frAdd: o.ext && o.ext.frAdd, levels: o.targets.levels },
        base, riv, alts, planTop };
    });
    out.push(Object.assign({ k, sec: Math.round((Date.now() - t0) / 1000) }, r, { errs: errs.slice(0, 4) }));
    console.error(k, Math.round((Date.now() - t0) / 1000) + "s", r.base.score.toFixed(4), r.riv ? r.riv.score.toFixed(4) : "-", (r.riv || r.base).mods.join(", "));
    await pg.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
