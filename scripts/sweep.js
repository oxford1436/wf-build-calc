// All-weapon sweep (no AI, runs free on GitHub Actions): finds the calculator's best build for every weapon's main attack
// and flags anything that looks wrong, so the research runs know where to look.
//   node scripts/sweep.js --shard 0/12 --out docs/sweep/part-0.json      (one slice of the weapon list)
//   node scripts/sweep.js --only lenz,penta --out /tmp/x.json         (spot-check)
//   node scripts/sweep.js --merge docs/sweep                           (part-*.json → docs/sweep/report.md)
// Flags: error, no build / score not finite, two mods the game won't equip together, build over capacity, and a mod that
// adds (almost) nothing while sitting in a slot — the pattern earlier bugs left behind (e.g. a magazine mod on a weapon
// whose reloads were already covered).
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const arg = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };

if (arg("--merge")) {
  const dir = path.resolve(arg("--merge"));
  const rows = fs.readdirSync(dir).filter((f) => /^part-\d+\.json$/.test(f)).flatMap((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  rows.sort((a, b) => (b.flags.length - a.flags.length) || a.name.localeCompare(b.name, "ko"));
  const flagged = rows.filter((r) => r.flags.length);
  let md = `# 전체 무기 점검 (계산기 기본 조건)\n\n무기 ${rows.length}개 · 표시 ${flagged.length}개. scripts/sweep.js 가 만듭니다(무료, GitHub Actions). 표시된 무기는 커뮤니티 조사 실행이 우선 확인합니다.\n\n`;
  md += `## 표시된 무기\n\n| 무기 | 공격 | 표시 |\n| --- | --- | --- |\n` + flagged.map((r) => `| ${r.name} | ${r.atk} | ${r.flags.join(" · ")} |`).join("\n") + "\n\n";
  md += `## 전체 추천 세팅\n\n| 무기 | 공격 | 추천 모드 | 아케인 | Lv150 12명 전멸 (그/코/인) |\n| --- | --- | --- | --- | --- |\n` +
    rows.map((r) => `| ${r.name} | ${r.atk} | ${r.mods || "—"} | ${r.arc || "—"} | ${r.clear || "—"} |`).join("\n") + "\n";
  fs.writeFileSync(path.join(dir, "report.md"), md);
  console.log(`merged ${rows.length} weapons, ${flagged.length} flagged`);
  process.exit(0);
}

const { chromium } = require("playwright");
(async () => {
  const [si, sn] = (arg("--shard") || "0/1").split("/").map(Number);
  const out = path.resolve(arg("--out") || path.join(ROOT, "docs", "sweep", `part-${si}.json`));
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto("file://" + path.join(ROOT, "index.html"));
  await p.waitForFunction(() => window.WFEngine && window.WF_APP);
  const ids = await p.evaluate(() => window.WF_WEAPONS.map((w) => w.id));
  const only = arg("--only");   // e.g. --only lenz,penta  (spot-check a few weapons)
  const mine = only ? ids.filter((id) => only.split(",").includes(id)) : ids.filter((_, i) => i % sn === si);
  const rows = [];
  for (const id of mine) {
    const t0 = Date.now();
    const r = await p.evaluate((id) => {
      const A = window.WF_APP, E = window.WFEngine;
      const w = window.WF_WEAPONS.find((x) => x.id === id);
      const row = { id, name: w.ko, atk: "", flags: [] };
      try {
        A.st.weapon = w; A.st.atk = A.defaultAttack(w); const atk = w.attacks[A.st.atk];
        row.atk = atk.name;
        const val = w.valence ? { type: "tox", pct: 0.6 } : null;
        const o = Object.assign(A.readOpts(), { targets: null, concept: [], conceptOnly: false, val }); o.targets = E.targetsFor(o);
        A.st.results = { o };
        const cands = A.candidateMods(w, atk, { aim: false, cast: false, boss: true });
        const top = E.optimize(w, atk, cands, o, { slots: 8, beam: 20, valOptions: [val], arcOptions: [null] })[0];
        if (!top || !isFinite(top.score) || top.score <= 0) { row.flags.push("추천 세팅 없음/점수 이상"); return row; }
        const ids2 = top.mods.map((m) => m.id);
        const ev = (x) => A.evalBuild(x, val, null, o, null);
        const base = ev(ids2);
        const ko = (m) => (A.MOD_BY_ID[m] || { ko: m }).ko;
        row.mods = ids2.map(ko).join(", ");
        // best arcane for this build (cheap: the mods stay, only the arcane changes)
        let bestArc = null, bestS = base.score;
        for (const a of A.arcAuto(w)) { if (!a) continue; const s = A.evalBuild(ids2, val, a, Object.assign({}, o, { arcane: a }), null).score; if (s > bestS * 1.001) { bestS = s; bestArc = a; } }
        row.arc = bestArc ? (window.WF_ARCANES[bestArc].ko || bestArc) : "";
        const pf = base.perF || {};
        row.clear = ["grineer", "corpus", "infested"].map((f) => pf[f] ? pf[f].clear.toFixed(1) : "?").join(" / ");
        const ms = ids2.map((x) => A.MOD_BY_ID[x]);
        for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) if (E.clash(ms[i], ms[j])) row.flags.push("같이 못 끼는 모드: " + ms[i].ko + "+" + ms[j].ko);
        const plan = E.capacityPlan(w, ms, 99);
        if (!plan.fits) row.flags.push("수용량 초과");
        for (let i = 0; i < ids2.length; i++) {
          const s = ev(ids2.filter((_, k) => k !== i)).score;
          if (s >= base.score * 0.999) row.flags.push("효과 없는 칸: " + ko(ids2[i]));
        }
        if (Object.values(base.share || {}).some((v) => !isFinite(v))) row.flags.push("속성 비중 NaN");
        // impact and explosion of the same shot left as two attacks (wiki names didn't pair up in convert.py) -> the default
        // attack counts only the impact (found 2026-11-03: Lenz 172 s, Stug 370 s, Aegrit 233 s)
        if (!atk.parts && atk.kind === "gun") {
          const near = w.attacks.filter((x) => x !== atk && x.kind === "radial" && !/^(Incarnon|Alt)|Slam|Headshot/i.test(x.en || "") && Math.abs((x.fr || 0) - (atk.fr || 0)) < 0.05);
          // v1.63: noPair = checked on the wiki and deliberately kept apart ("either" = Castanas mid-flight/embedded are
          // alternatives; "cloud" = lingering cloud whose tick rate isn't in the wiki data yet)
          // a radial that already sits in another shot's combo (wiki parent = alt fire, e.g. Mutalist Quanta orb) isn't this shot's blast
          const inCombo = (x) => w.attacks.some((z) => z.parts && z.parts.some((q) => q.en === x.en));
          const ex = near.filter((x) => !x.noPair && !inCombo(x));
          const cl = near.filter((x) => x.noPair === "cloud");
          if (cl.length) row.flags.push("장판 피해 미반영 (틱 간격 확인 필요): " + cl.map((x) => x.name).join(", "));
          if (ex.length) row.flags.push("직격만 계산 — 같은 발의 폭발이 따로 있음: " + ex.map((x) => x.name).join(", "));
        }
        if (pf.grineer && pf.grineer.clear > 60) row.flags.push("전멸 60초 초과 — 공격 데이터 확인");
      } catch (e) { row.flags.push("오류: " + String(e && e.message || e).slice(0, 120)); }
      return row;
    }, id);
    r.ms = Date.now() - t0;
    rows.push(r);
    process.stdout.write(`${rows.length}/${mine.length} ${id} ${r.ms}ms ${r.flags.length ? "FLAG " + r.flags.join(" | ") : ""}\n`);
  }
  await b.close();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(rows));
})();
