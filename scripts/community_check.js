// Runs every community build in docs/community/builds/*.json through the calculator and writes docs/community/report.md.
// Free to run (no AI): GitHub Actions does it every night, so each engine/data change is re-checked against what
// players actually use. A community build that beats the calculator's own best is flagged — that usually means the
// calculator is missing a mechanic (or the build file has a typo) and is what the research runs look at first.
//   node scripts/community_check.js            (all files)
//   node scripts/community_check.js arca       (files whose name contains "arca")
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "docs", "community", "builds");
const OUT = path.join(ROOT, "docs", "community", "report.md");

(async () => {
  const filter = process.argv[2] || "";
  const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith(".json") && f.includes(filter)).sort() : [];
  const b = await chromium.launch();
  const sections = [];
  let flags = 0;
  for (const f of files) {
    const spec = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
    const ctx = await b.newContext();
    if (spec.kit) await ctx.addInitScript((k) => { try { localStorage.setItem("wfopt2", JSON.stringify({ mod: k })); } catch (e) {} }, spec.kit);
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto("file://" + path.join(ROOT, "index.html"));
    await p.waitForFunction(() => window.WFEngine && window.WF_APP);
    const res = await p.evaluate((spec) => {
      const A = window.WF_APP, E = window.WFEngine;
      if (!spec.kit) {
        const w0 = window.WF_WEAPONS.find((x) => x.id === spec.weapon);
        if (!w0) return { err: "무기 없음: " + spec.weapon };
        A.st.weapon = w0;
      }
      A.st.atk = spec.attack || 0;
      const w = A.st.weapon, atk = w.attacks[A.st.atk];
      const o = Object.assign(A.readOpts(), spec.options || {}, { targets: null, concept: [], conceptOnly: false });
      o.targets = E.targetsFor(o);
      A.st.results = { o };
      const val = spec.valence || null;
      const findMod = (n) => window.WF_MODS.find((m) => m.en === n || m.ko === n || m.id === n);
      const findArc = (n) => { if (!n) return null; const A2 = window.WF_ARCANES; if (A2[n]) return n; const k = Object.keys(A2).find((key) => A2[key].ko === n || A2[key].en === n); return k || "?" + n; };
      const riv = spec.riven ? A.parseRiven(spec.riven.map(([k, v]) => ({ k, v, inc: true }))).eff : null;
      const cands = A.candidateMods(w, atk, { aim: false, cast: false, boss: true });
      const top = E.optimize(w, atk, cands, Object.assign({}, o, { val }), { slots: 8, beam: 60, locked: riv ? [{ id: "__riven", eff: riv }] : [], valOptions: [val], arcOptions: A.arcAuto(w) })[0];
      const topIds = top.mods.map((m) => m.id);
      // bd.valence (선택): 세팅마다 베일런스가 다를 때(예: 자성 vs 독) 그 세팅만 다른 값으로 계산
      const ev = (ids, arc, patch, v) => { const vv = v === undefined ? val : v; const oo = Object.assign({}, o, { val: vv, arcane: arc }, patch || {}); if (patch) oo.targets = E.targetsFor(oo); return A.evalBuild(ids, vv, arc, oo, riv); };
      const ref = ev(topIds, top.arcane).score, refSus = ev(topIds, top.arcane, { killRamp: false }).score, refZero = ev(topIds, top.arcane, { kills: false }).score;
      const ko = (id) => id === "__riven" ? "리벤" : (A.MOD_BY_ID[id] || { ko: id }).ko;
      const rows = (spec.builds || []).map((bd) => {
        const unknown = [], ids = [];
        for (const n of bd.mods || []) {
          if (/^(riven|리벤)/i.test(n)) { ids.push("__riven"); continue; }
          const m = findMod(n);
          if (m) ids.push(m.id); else unknown.push(n);
        }
        if (ids.includes("__riven") && !riv) unknown.push("리벤 수치 없음");
        const ms = ids.filter((x) => x !== "__riven").map((x) => A.MOD_BY_ID[x]);
        const clash = []; for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) if (E.clash(ms[i], ms[j])) clash.push(ms[i].ko + "+" + ms[j].ko);
        const arc = findArc(bd.arcane);
        if (arc && arc[0] === "?") unknown.push("아케인 " + arc.slice(1));
        const a = arc && arc[0] !== "?" ? arc : null;
        const bv = bd.valence === undefined ? undefined : bd.valence;
        const r = ev(ids, a, undefined, bv);
        return { name: bd.name, community: bd.community || "", url: bd.url || "", rel: r.score / ref, sus: ev(ids, a, { killRamp: false }, bv).score / refSus,
          zero: ev(ids, a, { kills: false }, bv).score / refZero, unknown, clash, mods: ids.map(ko).join(", "), arc: a };
      });
      return { name: w.ko, top: { mods: topIds.map(ko).join(", "), arc: top.arcane }, rows };
    }, spec);
    await ctx.close();
    if (res.err || errs.length) { sections.push(`## ${f}\n\n오류: ${res.err || errs.join(" / ")}\n`); flags++; continue; }
    const pct = (x) => (x * 100).toFixed(0) + "%";
    let md = `## ${res.name} (${f})\n\n계산기 1위: ${res.top.mods} · ${res.top.arc || "아케인 없음"}\n\n| 세팅 | 커뮤니티 | 기본 | 중첩 유지 | 처치 없음 | 확인 |\n| --- | --- | --- | --- | --- | --- |\n`;
    for (const r of res.rows) {
      const notes = [];
      if (r.rel > 1.005) { notes.push("**계산기 1위보다 강함 — 조사 필요**"); flags++; }
      if (r.clash.length) { notes.push("같이 못 끼는 모드: " + r.clash.join(", ")); flags++; }
      if (r.unknown.length) { notes.push("인식 못 함: " + r.unknown.join(", ")); flags++; }
      md += `| ${r.url ? `[${r.name}](${r.url})` : r.name} | ${r.community} | ${pct(r.rel)} | ${pct(r.sus)} | ${pct(r.zero)} | ${notes.join(" · ") || "—"} |\n`;
    }
    sections.push(md);
  }
  await b.close();
  const head = `# 커뮤니티 세팅 점검 결과\n\n계산기 기본 조건(강철의 길 150·250·400, 3팩션 평균, 12명 무리, 처치 중첩은 무리마다 0부터)에서 계산기 1위 = 100%. '중첩 유지'·'처치 없음'은 같은 조건에서 처치 중첩만 바꾼 비교입니다. 이 파일은 scripts/community_check.js가 만듭니다.\n\n표시 ${flags}건\n\n`;
  fs.writeFileSync(OUT, head + (sections.length ? sections.join("\n") : "아직 조사한 세팅이 없습니다.\n"));
  console.log(`${files.length}개 무기, 표시 ${flags}건 → ${path.relative(ROOT, OUT)}`);
})();
