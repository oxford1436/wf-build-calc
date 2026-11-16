// one-shot level per faction and clear times at Lv150/250/400 for given builds (Steel Path, crowd)
const p = require("playwright");
const { AM, W } = require("./arq.js");
const repo = "/home/claude/wf-build-calc";
const B = JSON.parse(require("fs").readFileSync(process.argv[2], "utf8"));
(async () => {
  const b = await p.chromium.launch(); const pg = await b.newPage();
  await pg.goto("file://" + repo + "/index.html"); await pg.waitForFunction(() => window.WF_APP && window.WFEngine && window.WF_WEAPONS);
  const r = await pg.evaluate(({ AM, W, B }) => {
    const E = window.WFEngine, A = window.WF_APP, atk = W.attacks[0]; const byId = Object.fromEntries(AM.map((m) => [m.id, m]));
    const out = [];
    for (const bond of [0, 1]) for (const n in B) {
      const o = A.readOpts(); o.val = null; o.arcane = null; o.aim = false; o.hs = 0;
      o.ext = Object.assign({}, o.ext, { frAdd: 0, cdFinalAdd: bond ? 1.2 : 0 }); o.ext.gearExt = Object.assign({}, o.ext.gearExt, { frAdd: 0, cdFinalAdd: bond ? 1.2 : 0 });
      o.targets = E.targetsFor(o); o.layoutTTK = true; o.elemOrder = B[n].order || null;
      const x = E.evaluate(W, atk, B[n].ids.map((i) => byId["arq_" + i]), o);
      const pf = {}; for (const f in x.perF) { const v = x.perF[f]; pf[f] = { one: v.oneLv, c150: +v.clear.toFixed(2), c250: v.hi ? +v.hi.clear.toFixed(2) : null, c400: v.top ? +v.top.clear.toFixed(2) : null }; }
      out.push({ n, bond, score: +x.score.toFixed(3), rate: +(x.rate || 0).toFixed(2), cc: x.cc, cd: x.cd, ms: x.ms, pf });
    }
    return out;
  }, { AM, W, B });
  for (const x of r) console.log(x.n.padEnd(9), "bond" + x.bond, "score", x.score, "rate", x.rate, "cc", x.cc && x.cc.toFixed ? x.cc.toFixed(2) : x.cc, "cd", x.cd && x.cd.toFixed ? x.cd.toFixed(2) : x.cd, "ms", x.ms && x.ms.toFixed ? x.ms.toFixed(2) : x.ms, JSON.stringify(x.pf));
  await b.close();
})();
