// Arquebex (Voidrig Guard Mode exalted arch-gun) through the calculator engine (same crowd model as the app).
// Sources: game data Misc.json "Arquebex" (Normal Attack: impact 10, projectile 60 m/s; Radial Attack: heat 3000 + blast 9000,
// 6 m, no falloff; crit 50% x3, status 50%, 3.33/s); wiki Arquebex (read 2026-11-17): "Does not have reload.", "Does not consume
// ammunition for shots.", "No zoom, thus cannot benefit from Critical Focus or Marked Target.", "lacks Arcane Enhancement slots",
// "Initial hit and explosion apply status separately."; Mods.json arch-gun mods (max rank); wiki Ballista Measure ("Damage Falloff
// range on Arch-guns" — Arquebex has no falloff → 0); wiki Sabot Rounds (+60% damage, +3 punch through, no incompatibility listed).
const p = require("playwright");
const repo = "/home/claude/wf-build-calc";
const AM = [
  ["prb", "프라임드 루비도-라인드 배럴", "Primed Rubedo-Lined Barrel", { dmg: 1.87 }, { group: "a_dmg", pol: "madurai", drain: 16 }],
  ["rb", "루비도-라인드 배럴", "Rubedo-Lined Barrel", { dmg: 1.0 }, { group: "a_dmg", pol: "madurai", drain: 11 }],
  ["sabot", "사보트 라운즈", "Sabot Rounds", { dmg: 0.6, pt: 3 }, { pol: "naramon", drain: 15 }],
  ["pdr", "프라임드 듀얼 라운즈", "Primed Dual Rounds", { ms: 1.1 }, { group: "a_ms", pol: "madurai", drain: 16 }],
  ["dr", "듀얼 라운즈", "Dual Rounds", { ms: 0.6 }, { group: "a_ms", pol: "madurai", drain: 11 }],
  ["cb", "컨테인먼트 브리치", "Containment Breach", { radm: 0.6, ms: 0.3 }, { pol: "madurai", drain: 7 }],
  ["mc", "마그네타이즈드 사이클", "Magnetized Cycle", { magm: 0.6, fr: 0.3 }, { pol: "madurai", drain: 7 }],
  ["at", "오토매틱 트리거", "Automatic Trigger", { fr: 0.6 }, { pol: "madurai", drain: 15 }],
  ["ps", "패럴락스 스코프", "Parallax Scope", { cc: 1.0 }, { pol: "naramon", drain: 7 }],
  ["hb", "할로우드 불렛", "Hollowed Bullets", { cd: 0.8 }, { pol: "madurai", drain: 7 }],
  ["pcr", "프라임드 컴버스쳔 라운즈", "Primed Combustion Rounds", { heat: 1.87 }, { group: "a_heat", pol: "madurai", drain: 14 }],
  ["cr", "컴버스쳔 라운즈", "Combustion Rounds", { heat: 1.2 }, { group: "a_heat", pol: "madurai", drain: 9 }],
  ["ppm", "프라임드 폴라 매거진", "Primed Polar Magazine", { cold: 1.87 }, { group: "a_cold", pol: "vazarin", drain: 14 }],
  ["pm", "폴라 매거진", "Polar Magazine", { cold: 1.2 }, { group: "a_cold", pol: "vazarin", drain: 9 }],
  ["pvc", "프라임드 베노머스 클립", "Primed Venomous Clip", { tox: 1.87 }, { group: "a_tox", pol: "vazarin", drain: 14 }],
  ["vc", "베노머스 클립", "Venomous Clip", { tox: 1.2 }, { group: "a_tox", pol: "vazarin", drain: 9 }],
  ["peb", "프라임드 일렉트리파이드 배럴", "Primed Electrified Barrel", { elec: 1.87 }, { group: "a_elec", pol: "naramon", drain: 14 }],
  ["eb", "일렉트리파이드 배럴", "Electrified Barrel", { elec: 1.2 }, { group: "a_elec", pol: "naramon", drain: 9 }],
  ["mgc", "마그마 체임버", "Magma Chamber", { heat: 0.6, sc: 0.6 }, { pol: "madurai", drain: 7 }],
  ["hys", "하이포써믹 쉘", "Hypothermic Shell", { cold: 0.6, sc: 0.6 }, { pol: "madurai", drain: 7 }],
  ["cbul", "차지드 불릿", "Charged Bullets", { elec: 0.6, sc: 0.6 }, { pol: "madurai", drain: 7 }],
  ["ccas", "컨테미네이션 케이싱", "Contamination Casing", { tox: 0.6, sc: 0.6 }, { pol: "madurai", drain: 7 }],
  ["mm", "모디파이드 뮤니션즈", "Modified Munitions", { sc: 0.6 }, { pol: "vazarin", drain: 9 }],
  ["cbl", "코멧 블래스트", "Comet Blast", { impact: 0.9 }, { pol: "naramon", drain: 7 }],
].map(([id, ko, en, eff, x]) => Object.assign({ id: "arq_" + id, ko, en, compat: ["archgun"], eff }, x));
const base = { cc: 0.5, cd: 3, sc: 0.5, fr: 3.3333335, pellets: 1, mag: 10, reload: 0, ammoCost: 0 };
const W = {
  id: "arquebex", ko: "알퀘벡스", en: "Arquebex", slot: "archgun", cls: "archgun", type: "Arch-Gun", valence: false, noRiven: true,
  exalted: { mode: "none", frame: "Voidrig" }, pol: ["madurai"], rank: 30,
  attacks: [Object.assign({ name: "한 발 전체 (직격 + 폭발)", en: "Normal Attack+Radial Attack", kind: "gun", dmg: { impact: 10 }, ptLock: true, spread: [0, 0],
    parts: [Object.assign({ name: "직격", en: "Normal Attack", kind: "gun", dmg: { impact: 10 }, spread: [0, 0], ptLock: true }, base),
      Object.assign({ name: "폭발", en: "Radial Attack", kind: "radial", dmg: { heat: 3000, blast: 9000 }, radius: 6, rfo: 0, hsMult: 1 }, base)] }, base)],
};
module.exports = { AM, W };
if (require.main !== module) return;
const scen = JSON.parse(process.argv[2] || "{}");
(async () => {
  const b = await p.chromium.launch(); const pg = await b.newPage(); const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
  await pg.goto("file://" + repo + "/index.html"); await pg.waitForFunction(() => window.WF_APP && window.WFEngine && window.WF_WEAPONS);
  const r = await pg.evaluate(({ AM, W, scen }) => {
    const E = window.WFEngine, A = window.WF_APP;
    const o = A.readOpts();
    o.val = null; o.arcane = null; o.aim = false; o.hs = 0;
    o.ext = Object.assign({}, o.ext, { frAdd: 0 });             // Reinforced Bond: not on arch-guns (Mausolon arsenal 2026-11-07)
    o.ext.gearExt = Object.assign({}, o.ext.gearExt, { frAdd: 0 });
    if (scen.noBond) { o.ext.cdFinalAdd = 0; o.ext.gearExt.cdFinalAdd = 0; }
    if (scen.factions) o.factions = scen.factions;
    if (scen.level) o.level = scen.level;
    if (scen.steel != null) o.steel = scen.steel;
    if (scen.levelSteps) o.levelSteps = scen.levelSteps;
    o.targets = E.targetsFor(o);
    const atk = W.attacks[0];
    const cands = AM.filter((m) => !(scen.exclude || []).includes(m.id));
    const t0 = Date.now();
    const res = E.optimize(W, atk, cands, o, { slots: 8, beam: scen.beam || 100 });
    const byId = Object.fromEntries(AM.map((m) => [m.id, m]));
    const ev = (ids, oo) => E.evaluate(W, atk, ids.map((i) => byId[i]), Object.assign({}, oo || o, { layoutTTK: true }));
    const top = res[0], ids = top.mods.map((m) => m.id), x = ev(ids);
    const drop = ids.map((id) => { const rest = ids.filter((i) => i !== id); let best = null;
      for (const c of cands) { if (ids.includes(c.id)) continue; const tr = rest.concat([c.id]); if (E.clash && tr.some((a) => tr.some((b2) => a !== b2 && E.clash(byId[a], byId[b2])))) continue;
        const s = ev(tr).score; if (!best || s > best.s) best = { id: c.id, s }; }
      return { id, without: ev(rest).score / x.score, alt: best ? { id: best.id, r: best.s / x.score } : null }; });
    const seen = new Set(), list = [];
    for (const rr of res) { const k = rr.mods.map((m) => m.id).sort().join(","); if (seen.has(k)) continue; seen.add(k); list.push({ r: rr.score / top.score, ids: rr.mods.map((m) => m.id) }); if (list.length >= 12) break; }
    const pf = {}; for (const f in x.perF || {}) pf[f] = { clear: x.perF[f].clear, top: x.perF[f].top ? x.perF[f].top.clear : null, oneLv: x.perF[f].oneLv };
    return { ms: Date.now() - t0, o: { level: o.level, steel: o.steel, factions: o.factions, scenario: o.scenario, levels: o.targets.levels, ext: { cdFinalAdd: o.ext.cdFinalAdd, frAdd: o.ext.frAdd } },
      score: x.score, ids, layout: x.layout || x.elemDesc || null, pf, drop, list, keys: Object.keys(x).slice(0, 40) };
  }, { AM, W, scen });
  console.log(JSON.stringify(Object.assign(r, { errs: errs.slice(0, 3) }), null, 1));
  await b.close();
})();
