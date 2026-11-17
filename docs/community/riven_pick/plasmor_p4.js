// P4 after v2.17 (unreleased Primed Blunderbuss removed): re-score the Tenet Arca Plasmor comparison rows of the notes doc.
// Rows that had Primed Blunderbuss get the best mod that can legally sit in that slot. Same app path as sens.js (owned riven in state).
const p = require("playwright"); const repo = "/home/claude/wf-build-calc";
const { CFG } = require("./run.js");
const ROWS = {
  "최종: 바이러스+화염+자성": ["리벤", "프라임드 칠링 그래스프", "갈바나이즈드 헬", "갈바나이즈드 새비", "마그네틱 스트레이프", "톡식 배러지", "인센디어리 코트", "샷건 배러지"],
  "부식+자성(커뮤니티식 부식 1칸)": ["리벤", "갈바나이즈드 헬", "갈바나이즈드 새비", "마그네틱 스트레이프", "샷건 배러지", "프라임드 래비지", "?", "프라임드 차지드 쉘"],
  "방사능+바이러스+자성": ["리벤", "갈바나이즈드 새비", "프라임드 칠링 그래스프", "프라임드 차지드 쉘", "블레이즈", "갈바나이즈드 헬", "마그네틱 스트레이프", "샷건 배러지"],
  "바이러스+화염(자성 없이)": ["리벤", "프라임드 칠링 그래스프", "톡식 배러지", "블레이즈", "갈바나이즈드 헬", "갈바나이즈드 새비", "샷건 배러지", "프라임드 래비지"],
  "부식만(모드 1칸)": ["리벤", "프라임드 차지드 쉘", "갈바나이즈드 헬", "갈바나이즈드 새비", "프라임드 래비지", "크리티컬 디셀러레이션", "샷건 배러지", "?"],
  "바이러스만(모드 1칸)": ["리벤", "프라임드 칠링 그래스프", "갈바나이즈드 헬", "갈바나이즈드 새비", "프라임드 래비지", "?", "샷건 배러지", "프라임드 포인트 블랭크"],
};
ROWS["v2.17 앱 1위(폭발)"] = ["리벤", "갈바나이즈드 새비", "프라임드 칠링 그래스프", "갈바나이즈드 헬", "크리티컬 디셀러레이션", "프라임드 포인트 블랭크", "샷건 배러지", "스캐터링 인페르노"];
ROWS["현재 세팅 A(리벤 없음)"] = ["프라임드 포인트 블랭크", "크리티컬 디셀러레이션", "갈바나이즈드 헬", "톡식 배러지", "프라임드 칠링 그래스프", "프라임드 래비지", "샷건 배러지", "스캐터링 인페르노"];
ROWS["v2.17 앱 1위 모드 + 머시리스"] = ROWS["v2.17 앱 1위(폭발)"].slice();
const ARC = { "방사능+바이러스+자성": "primary_debilitate", "v2.17 앱 1위(폭발)": "primary_blight" };
(async () => {
  const b = await p.chromium.launch(); const c = CFG.plasmor; const pg = await b.newPage(); const errs = []; pg.on("pageerror", (e) => errs.push(e.message));
  const S = { w: c.w, f: Object.assign({}, c.f), ab: [], abp: {}, mb: ["tenacious_bond", "reinforced_bond"], s: [] };
  const h = Buffer.from(JSON.stringify(S), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  await pg.goto("file://" + repo + "/index.html#s=" + h); await pg.waitForFunction((w) => window.WF_APP && window.WF_APP.st.weapon && (window.WF_APP.st.base || window.WF_APP.st.weapon).id === w, c.w);
  const r = await pg.evaluate(({ ROWS, ARC }) => {
    const A = window.WF_APP, E = window.WFEngine, st = A.st, atk = st.weapon.attacks[st.atk];
    const cands = A.candidateMods(st.weapon, atk, {}).filter((m) => !m.manual && !m.exilus);
    const byKo = (n) => n === "리벤" ? "__riven" : (cands.find((m) => m.ko === n) || window.WF_MODS.find((m) => m.ko === n) || { id: "!" + n }).id;
    const val = { type: "tox", pct: 0.6 };
    const conds = { base: A.readOpts(), corrupted: Object.assign(A.readOpts(), { factions: ["corrupted"] }) }; for (const k in conds) conds[k].targets = E.targetsFor(conds[k]);
    const rivEff = A.effFromStats([["fr", 0.955], ["ms", 1.436], ["ammoeff", 0.543], ["x_zoom", -0.374]]);      // the user's riven (arsenal 2026-11)
    const sc = (ids, arc, o) => A.evalBuild(ids, val, arc, o, rivEff).score;
    const out = { atk: atk.name, riven: rivEff, rows: [] };
    for (const name in ROWS) {
      const arc = ARC[name] || "primary_merciless"; let ids = ROWS[name].map((n) => n === "?" ? "?" : byKo(n)); let fill = null;
      if (ids.includes("?")) { const rest = ids.filter((x) => x !== "?"); let best = null;
        for (const m of cands) { if (rest.includes(m.id) || rest.some((x) => x !== "__riven" && E.clash(m, A.MOD_BY_ID[x]))) continue; const s = sc(rest.concat([m.id]), arc, conds.base); if (!best || s > best.s) best = { id: m.id, ko: m.ko, s }; }
        fill = best.ko; ids = ids.map((x) => x === "?" ? best.id : x); }
      out.rows.push({ name, fill, bad: ids.filter((x) => x[0] === "!"), base: sc(ids, arc, conds.base), corrupted: sc(ids, arc, conds.corrupted), mods: ids.map((i) => i === "__riven" ? "리벤" : (A.MOD_BY_ID[i] || { ko: i }).ko) });
    }
    return out;
  }, { ROWS, ARC });
  const f = r.rows[0]; console.log(r.atk, JSON.stringify(r.riven).slice(0, 200), errs.join("|"));
  for (const x of r.rows) console.log(x.base.toFixed(3).padStart(7) + " " + (x.base / f.base * 100).toFixed(1).padStart(6) + "% " + (x.corrupted / f.corrupted * 100).toFixed(1).padStart(6) + "%  " + x.name + (x.fill ? "  [빈 칸 → " + x.fill + "]" : "") + (x.bad.length ? " BAD " + x.bad.join(",") : "") + "\n        " + x.mods.join(", "));
  await b.close();
})();
