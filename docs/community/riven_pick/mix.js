// Laetum follow-up (2026-11-17): one build for packs AND bosses. The app searches one scenario at a time, so this script does a
// coordinate search on the product of the two kill speeds (crowd x boss, same options as the app: share hash -> app state ->
// WF_APP.evalBuild) — riven stat triple, arcane and every slot in turn until nothing improves — and reports any build in both.
// usage: node mix.js job.json   job: { w, a, evo, mb?, defaults?, seeds: [{ n, mods: [EN names, "Riven"], arcane, riv: [3 keys], neg }],
//   search: true|false, weights: { crowd: 1, boss: 1 }, rivKeys?, eval?: [{ n, mods, arcane, riv, neg }] }
const p = require("playwright"); const repo = "/home/claude/wf-build-calc";
const job = JSON.parse(require("fs").readFileSync(process.argv[2], "utf8"));
(async () => {
  const b = await p.chromium.launch(); const pg = await b.newPage(); const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
  if (job.defaults) await pg.addInitScript((D) => { let v; Object.defineProperty(window, "WFEngine", { configurable: true, get() { return v; }, set(x) { v = x; const d0 = x.defaults; x.defaults = () => Object.assign(d0(), D); } }); }, job.defaults);
  const S = { w: job.w, a: job.a, f: Object.assign({ rivmode: "none" }, job.f || {}), ab: [], abp: {}, mb: job.mb || ["tenacious_bond", "reinforced_bond"], s: [] };
  if (job.evo) S.evo = job.evo;
  const h = Buffer.from(JSON.stringify(S), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  await pg.goto("file://" + repo + "/index.html#s=" + h); await pg.waitForFunction((w) => window.WF_APP && window.WF_APP.st.weapon && (window.WF_APP.st.base || window.WF_APP.st.weapon).id === w, job.w);
  const r = await pg.evaluate((job) => {
    const A = window.WF_APP, E = window.WFEngine, st = A.st, w = st.weapon, atk = w.attacks[st.atk], cls = w.cls === "pistol" ? "pistol" : w.cls;
    const scen = Object.keys(job.weights || { crowd: 1, boss: 1 }), wt = job.weights || { crowd: 1, boss: 1 };
    const O = {}; for (const s of scen) { const [sc, extra] = s.split("+"); O[s] = Object.assign(A.readOpts(), { scenario: sc }, extra ? JSON.parse(extra) : {}, job.o || {}); O[s].targets = E.targetsFor(O[s]);
      // "single+{"tier":"heavy","hpMult":10}" = the boss target (heavy unit, health and shields x10) fought among a pack, so on-kill
      // stacks (Galvanized mods) are up — the engine's own boss scenario always runs without them
      if (O[s].hpMult) for (const k of ["lo", "hi", "top"]) for (const f of Object.keys(O[s].targets[k])) for (const t of Object.values(O[s].targets[k][f])) { if (t && t.hp) { t.hp *= O[s].hpMult; t.sh *= O[s].hpMult; } } }
    const cands = [...new Map([].concat(A.candidateMods(w, atk, { boss: false }), A.candidateMods(w, atk, { boss: true })).filter((m) => !m.exilus && !m.manual).map((m) => [m.id, m])).values()];
    const idOf = (n) => /^riven/i.test(n) ? "__riven" : (window.WF_MODS.find((m) => m.en === n) || { id: "?" + n }).id;
    const ko = (id) => id === "__riven" ? "리벤" : (A.MOD_BY_ID[id] || { ko: id }).ko;
    // job.rivVals: { key: value } replaces the planned maximum of a stat (e.g. the worst roll, or a different reading of a spliced
    // value); a build with riv of two keys and form "2+1" uses the larger two-positive values
    const pv = (k, form) => (job.rivVals && job.rivVals[k] != null) ? job.rivVals[k] : A.rivPlanVal(cls, k, form || "3+1");
    const rivEff = (riv, neg, form) => riv ? A.effFromStats(riv.map((k) => [k, pv(k, form)]).concat(neg ? [[neg, -A.rivPlanVal(cls, neg, form || "3+1") / (form === "2+1" ? 1.2375 : 0.9375) * (form === "2+1" ? 0.495 : 0.75)]] : [])) : undefined;
    let nEval = 0;
    const memo = new Map();
    const score = (bd) => {
      const key = bd.ids.join(",") + "|" + bd.arcane + "|" + (bd.riv || []).join("+") + "|" + (bd.neg || "") + "|" + (bd.form || "");
      if (memo.has(key)) return memo.get(key);
      // one build has one element order in game, so every scenario is scored with the same arrangement: each arrangement
      // (o.layoutIdx) is evaluated in every scenario and the one with the best weighted product is kept
      const out = { per: {}, obj: -Infinity }; const eff = bd.ids.includes("__riven") ? rivEff(bd.riv, bd.neg, bd.form) : undefined;
      const ev1 = (s, i) => { nEval++; return A.evalBuild(bd.ids, null, bd.arcane || null, Object.assign({}, O[s], { layoutIdx: i }), eff, null, w); };
      const layStr = (x) => x.layout ? Object.entries(x.layout.coef).filter(([, q]) => q > 0.005).map(([t, q]) => t + q.toFixed(2)).join("+") : "";
      const tab = {}; let n = 1;
      for (let i = 0; i < n; i++) for (const s of scen) { const x = ev1(s, i); n = Math.max(n, x.nLayouts || 1); const k = layStr(x); (tab[k] = tab[k] || {})[s] = x;
        out.stat = out.stat || { cc: +x.cc.toFixed(3), cd: +x.cd.toFixed(2), sc: +x.sc.toFixed(3), rate: +x.rate.toFixed(2), ms: +x.ms.toFixed(2) }; }
      out.lays = {};
      for (const k in tab) { if (scen.some((s) => !tab[k][s])) continue; const o_ = scen.reduce((t, s) => t + wt[s] * Math.log(Math.max(1e-12, tab[k][s].score)), 0);
        out.lays[k] = Object.fromEntries(scen.map((s) => [s, +tab[k][s].score.toFixed(4)]));
        if (o_ > out.obj) { out.obj = o_; out.lay = k; for (const s of scen) out.per[s] = tab[k][s].score; } }
      memo.set(key, out); return out;
    };
    const mk = (sd) => ({ n: sd.n, ids: sd.ids || sd.mods.map(idOf), arcane: sd.arcane === undefined ? null : sd.arcane, riv: sd.riv || null, neg: sd.neg || null, form: sd.form || null });
    const show = (bd) => { const s = score(bd); return { n: bd.n, mods: bd.ids.map(ko), ids: bd.ids, arcane: bd.arcane, riv: bd.riv, neg: bd.neg, per: s.per, stat: s.stat, lay: s.lay, lays: s.lays }; };
    const out = { atk: atk.name, evo: st.evoSel, scen, nCands: cands.length, seeds: [], found: [], evals: [] };
    const arcs = job.arcanes || Object.keys(window.WF_ARCANES).filter((k) => { const a = window.WF_ARCANES[k]; return a.slot === "secondary" && !a.manual && !a.none && !(a.types && !a.types.includes(w.type)); });
    // riven: three positives out of the natural stats, at most one of them a Riven Splicer stat (one spliced trait per riven)
    const keys = job.rivKeys || ["dmg", "ms", "cc", "cd", "fr", "sc", "heat", "cold", "tox", "elec"], spl = job.rivSplice || ["viralm", "corrm", "radm", "magm", "gasm", "blastm", "sd"];
    const triples = []; for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) { for (let k = j + 1; k < keys.length; k++) triples.push([keys[i], keys[j], keys[k]]); for (const q of spl) triples.push([keys[i], keys[j], q]); }
    const negs = job.negs || [null];
    // extra random starting builds (seeded) so the coordinate search doesn't depend on where it starts
    const seeds = (job.seeds || []).slice();
    if (job.random) { let z = 12345; const rnd = () => { z = (z * 1103515245 + 12345) & 0x7fffffff; return z / 0x7fffffff; };
      for (let q = 0; q < job.random; q++) { const ids = ["__riven"]; let guard = 0;
        while (ids.length < 8 && guard++ < 500) { const m = cands[Math.floor(rnd() * cands.length)]; if (ids.includes(m.id) || ids.some((x) => x !== "__riven" && E.clash(m, A.MOD_BY_ID[x]))) continue; ids.push(m.id); }
        seeds.push({ n: "random " + (q + 1), ids, arcane: arcs[Math.floor(rnd() * arcs.length)], riv: triples[Math.floor(rnd() * triples.length)], neg: negs[0] }); } }
    for (const sd of seeds) {
      let cur = mk(sd); const bad = cur.ids.filter((i) => i[0] === "?"); if (bad.length) { out.seeds.push({ n: sd.n, bad }); continue; }
      if (!/^random/.test(sd.n)) out.seeds.push(show(cur));
      if (!job.search) continue;
      for (let pass = 0; pass < 8; pass++) {
        const before = score(cur).obj;
        if (cur.ids.includes("__riven") && !job.fixRiv) { let bt = cur; for (const t of triples) for (const ng of negs) { if (ng && t.includes(ng)) continue; const c = Object.assign({}, cur, { riv: t, neg: ng }); if (score(c).obj > score(bt).obj + 1e-9) bt = c; } cur = bt; }
        if (!job.fixArc) { let ba = cur; for (const a of arcs) { const c = Object.assign({}, cur, { arcane: a }); if (score(c).obj > score(ba).obj + 1e-9) ba = c; } cur = ba; }
        for (let i = 0; i < cur.ids.length; i++) {
          if (cur.ids[i] === "__riven") continue;
          const rest = cur.ids.filter((_, j) => j !== i); let bs = cur;
          for (const m of cands) {
            if (rest.includes(m.id) || rest.some((x) => x !== "__riven" && E.clash(m, A.MOD_BY_ID[x]))) continue;
            const ids = cur.ids.slice(); ids[i] = m.id; const c = Object.assign({}, cur, { ids }); if (score(c).obj > score(bs).obj + 1e-9) bs = c;
          }
          cur = bs;
        }
        if (score(cur).obj <= before + 1e-6) break;
      }
      cur.n = "found from " + sd.n; out.found.push(show(cur));
    }
    // keep the distinct results, best first
    { const seen = new Set(); out.found = out.found.map((x) => Object.assign(x, { g: Object.entries(x.per).reduce((t, [k, v]) => t + (wt[k] || 1) * Math.log(v), 0) })).sort((x, y) => y.g - x.g)
        .filter((x) => { const k = x.ids.slice().sort().join(",") + "|" + x.arcane + "|" + (x.riv || []).slice().sort().join("+") + "|" + x.neg; if (seen.has(k)) { return false; } seen.add(k); return true; }); out.nStarts = seeds.length; }
    // exhaustive part: a fixed core, every legal combination of the remaining slots, a short list of riven triples
    if (job.exhaust) { const X = job.exhaust, core = X.core.map(idOf), k = 8 - core.length, pool = cands.filter((m) => !core.includes(m.id) && !core.some((x) => x !== "__riven" && E.clash(m, A.MOD_BY_ID[x])));
      const top = []; let nB = 0; const keep = X.keep || 30;
      const rec = (start, pick) => {
        if (pick.length === k) { for (const riv of X.rivs) for (const a of (X.arcanes || ["secondary_enervate"])) { const bd = { n: "x", ids: core.concat(pick.map((m) => m.id)), arcane: a, riv, neg: X.neg || null }; const sc_ = score(bd); nB++;
            if (top.length < keep || sc_.obj > top[top.length - 1].o) { top.push({ o: sc_.obj, bd }); top.sort((x, y) => y.o - x.o); if (top.length > keep) top.pop(); } memo.clear(); } return; }
        for (let i = start; i < pool.length; i++) { const m = pool[i]; if (pick.some((x) => E.clash(m, x))) continue; rec(i + 1, pick.concat([m])); }
      };
      rec(0, []); out.exhaust = { nBuilds: nB, pool: pool.length, top: top.map((t) => Object.assign(show(t.bd), { g: t.o })) }; }
    for (const e of job.eval || []) { const bd = mk(e); const bad = bd.ids.filter((i) => i[0] === "?"); if (bad.length) { out.evals.push({ n: e.n, bad }); continue; }
      const sh = show(bd);
      // e.slots: for every slot the best legal replacement (same riven and arcane) and what the build keeps of each scenario
      if (e.slots) { const g0 = score(bd); sh.slots = bd.ids.map((id, i) => { const rest = bd.ids.filter((_, j) => j !== i); let bs = null;
          for (const m of cands) { if (bd.ids.includes(m.id) || rest.some((x) => x !== "__riven" && E.clash(m, A.MOD_BY_ID[x]))) continue;
            const ids = bd.ids.slice(); ids[i] = m.id; const c = Object.assign({}, bd, { ids, riv: id === "__riven" ? null : bd.riv, neg: id === "__riven" ? null : bd.neg }); const sc_ = score(c); if (!bs || sc_.obj > bs.o) bs = { o: sc_.obj, ko: m.ko, per: sc_.per }; }
          return { slot: ko(id), alt: bs.ko, rel: Object.fromEntries(scen.map((s) => [s, +(bs.per[s] / g0.per[s]).toFixed(3)])), geo: +Math.exp((bs.o - g0.obj) / scen.reduce((t, s) => t + wt[s], 0)).toFixed(3) }; }); }
      out.evals.push(sh); }
    out.nEval = nEval; return out;
  }, job);
  console.log(JSON.stringify(Object.assign(r, { errs }), null, 1));
  await b.close();
})();
