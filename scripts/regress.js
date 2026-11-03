// Regression checks for bugs that were found and fixed (see CLAUDE.md "오류 기록").
// Run after every engine/data change, before committing:  node scripts/regress.js
// Needs Playwright (preinstalled in the work container). Loads the built index.html straight from disk.
const path = require("path");
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("file://" + path.resolve(__dirname, "..", "index.html"));
  await p.waitForFunction(() => window.WFEngine && window.WF_MODS && window.WF_APP);

  const results = await p.evaluate(() => {
    const A = window.WF_APP, E = window.WFEngine, W = window.WF_WEAPONS;
    const M = (id) => { const m = A.MOD_BY_ID[id] || window.WF_MODS.find((x) => x.en === id); if (!m) throw new Error("mod " + id); return m; };
    const out = [];
    const check = (name, ok, detail) => out.push({ name, ok: !!ok, detail: detail == null ? "" : String(detail) });
    const weapon = (id) => { const w = W.find((x) => x.id === id); if (!w) throw new Error("weapon " + id); return w; };
    const baseO = () => Object.assign(E.defaults(), { targets: null });
    const ev = (w, ids, o, riv) => E.evaluate(w, w.attacks[0], ids.map((id) => id === "__riven" ? { id: "__riven", eff: riv || {} } : M(id)), o);

    // v1.53: mods the game won't equip together
    check("v1.53 크리티컬 딜레이 ↔ 포인트 스트라이크는 같이 못 낌", E.clash(M("critical_delay"), M("point_strike")));
    // v1.54: wrong groups removed — these two do go together in game
    check("v1.54 테인티드 매그 + 프라임드 매거진 워프는 같이 낄 수 있음", !E.clash(M("tainted_mag"), M("primed_magazine_warp")));
    // v1.53: the optimizer never returns a clashing pair
    {
      const w = weapon("kuva_zarr"), o = baseO();
      const cands = window.WF_MODS.filter((m) => m.compat && m.compat.includes("rifle") && !m.exilus && !m.noCalc);
      const top = E.optimize(w, w.attacks[0], cands, o, { slots: 8, beam: 20 })[0];
      const ms = top.mods.filter(Boolean); let bad = "";
      for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) if (E.clash(ms[i], ms[j])) bad += ms[i].ko + "+" + ms[j].ko + " ";
      check("v1.53 추천 세팅에 동시 장착 불가 조합 없음 (쿠바 자르)", !bad, bad);
    }
    // v1.55: mismatched polarity drain is rounded like the game (9 -> 11; in-game Kuva Zarr arsenal = 51 for these 8 mods)
    {
      const w = Object.assign({}, weapon("kuva_zarr"), { pol: ["madurai", "madurai", "madurai", "madurai", "madurai", "vazarin", "naramon", "naramon"], xpol: "naramon" });
      const ids = ["split_chamber", "semi_rifle_cannonade", "primed_cryo_rounds", "malignant_force", "primed_fast_hands", "vital_sense", "critical_delay", "thermite_rounds"];
      const pl = E.capacityPlan(w, ids.map(M), 0);
      check("v1.55 극성 불일치 용량 반올림 (게임 화면 51)", pl.drain === 51, "drain " + pl.drain);
    }
    // Galvanized with no kill stacks: base +80% loses to Split Chamber +90%
    {
      const w = weapon("kuva_zarr"), o = Object.assign(baseO(), { kills: false });
      const rest = ["serration", "primed_cryo_rounds", "vital_sense", "critical_delay"];
      const s = ev(w, rest.concat(["split_chamber"]), o).score, g = ev(w, rest.concat(["galvanized_chamber"]), o).score;
      check("처치 중첩 없으면 스플릿 체임버 > 갈바나이즈드 체임버", s > g, (s / g).toFixed(3));
    }
    // v1.57: ammo efficiency stretches the magazine -> fewer reloads -> higher sustained rate
    {
      const w = weapon("tenet_arca_plasmor"), o = baseO();
      const ids = ["__riven", "toxic_barrage", "primed_chilling_grasp", "galvanized_hell", "shotgun_barrage"];
      const r0 = ev(w, ids, o, { ms: 1.3, fr: 1.0 }).rate, r1 = ev(w, ids, o, { ms: 1.3, fr: 1.0, ammoEff: 0.54 }).rate;
      check("v1.57 탄약 효율이 재장전 간격을 늘림 (연사 평균 증가)", r1 > r0 * 1.05, (r1 / r0).toFixed(3));
    }
    // v1.50/1.51: Cyte-09 Resupply = instant reload, infinite ammo
    {
      const w = weapon("kuva_zarr"), o = Object.assign(baseO(), { ext: { reloadCast: 0 } });
      const r = ev(w, ["serration", "split_chamber"], o);
      const fr = w.attacks[0].fr || (w.attacks[0].parts && w.attacks[0].parts[0].fr);
      check("v1.50 리서플라이: 재장전 시간 0, 탄약 무한", r.ammo && r.ammo.resupply && Math.abs(r.rate - fr) / fr < 0.02, "rate " + r.rate.toFixed(2) + " / fr " + fr);
    }
    // v1.56: proc-stack arcanes expire all at once -> with frequent heat procs Cascadia Flare is near its cap
    {
      const w = weapon("kuva_nukor");   // heat-heavy secondary (kitguns are assembled in app.js)
      const ids = ["primed_heated_charge", "pistol_pestilence", "frostbite", "galvanized_diffusion", "lethal_torrent", "primed_target_cracker", "hornet_strike"];
      const o = baseO();
      const none = ev(w, ids, Object.assign({}, o, { arcane: null })).score;
      const flare = ev(w, ids, Object.assign({}, o, { arcane: "cascadia_flare" })).score;
      const merc = ev(w, ids, Object.assign({}, o, { arcane: "secondary_merciless" })).score;
      // Flare at its cap (+480%) beats Merciless at its cap (+360%) on a weapon that procs heat constantly
      check("v1.56 캐스케디아 플레어 중첩: 화염이 자주 걸리면 머시리스(+360%)보다 강함", flare > merc && flare > none * 1.5, "flare/merc " + (flare / merc).toFixed(2));
    }
    // v1.58: kill stacks start from zero every pack -> between "held the whole time" and "never"
    {
      const w = weapon("kuva_zarr"), ids = ["serration", "galvanized_chamber", "primed_cryo_rounds", "vital_sense"];
      const sc = (patch) => ev(w, ids, Object.assign(baseO(), { arcane: "primary_merciless" }, patch)).score;
      const full = sc({ killRamp: false }), ramp = sc({}), none = sc({ kills: false });
      check("v1.58 처치 중첩은 무리마다 0부터 (중첩 0 < 기본 < 처음부터 최대)", none < ramp && ramp < full * 0.99, `${(none / full).toFixed(2)} < ${(ramp / full).toFixed(2)} < 1`);
    }
    // v1.58: Merciless reload +30% is passive (wiki) -> also on bosses
    {
      const w = weapon("kuva_zarr"), o = Object.assign(baseO(), { scenario: "boss" });
      const r0 = ev(w, ["serration"], Object.assign({}, o, { arcane: null })).rate, r1 = ev(w, ["serration"], Object.assign({}, o, { arcane: "primary_merciless" })).rate;
      check("v1.58 머시리스 재장전 +30%는 보스전에도 적용", r1 > r0 * 1.02, (r1 / r0).toFixed(3));
    }
    // v1.58: an Eximus with Overguard in every pack
    {
      const w = weapon("kuva_zarr"), ids = ["serration", "split_chamber", "primed_cryo_rounds", "vital_sense"];
      const c1 = ev(w, ids, baseO()).perF.grineer.clear, c0 = ev(w, ids, Object.assign(baseO(), { eximus: false })).perF.grineer.clear;
      check("v1.58 무리에 오버가드 엑시무스 포함 (전멸 시간 증가)", c1 > c0 * 1.01, `${c0.toFixed(2)} → ${c1.toFixed(2)}초`);
    }
    // v1.61 (META 팩트체크 ①): valence/innate elements combine after the mods (wiki "Elemental Damage") — the trap
    // "Toxin valence + Cold mod + Heat mod" gives Blast + Toxin, not Viral + Heat
    {
      const o = Object.assign(baseO(), { val: { type: "tox", pct: 0.6 } });
      const w = weapon("kuva_zarr"), sh = ev(w, ["serration", "cryo_rounds", "hellfire"], o).share;
      check("v1.61 독 베일런스 + 냉기 + 화염 모드 = 폭발 + 독 (바이러스 아님)", sh.blast > 0 && sh.tox > 0 && !sh.viral && !sh.heat, JSON.stringify(Object.keys(sh)));
      const pl = weapon("tenet_plinx"), semi = pl.attacks.find((x) => x.en === "Semi-Auto");
      const s2 = E.evaluate(pl, semi, [], o).share;
      check("v1.61 테넷 플링크스(고유 화염) + 독 베일런스 = 가스", s2.gas > 0 && !s2.heat && !s2.tox, JSON.stringify(Object.keys(s2)));
      const nk = weapon("kuva_nukor"), s3 = E.evaluate(nk, nk.attacks[0], [M("Pistol Pestilence")], Object.assign(baseO(), { val: { type: "heat", pct: 0.6 } })).share;
      check("v1.61 고유 2차 원소(뉴코어 방사능)는 조합 안 됨: 독 모드 + 화염 베일런스 = 방사능 + 가스", s3.rad > 0 && s3.gas > 0, JSON.stringify(Object.keys(s3)));
    }
    // v1.61 (META 팩트체크 ②): Devouring/Devastating Attrition works on non-critical hits only and "Bosses ignore this perk" (wiki Laetum)
    {
      const w = weapon("laetum"), a0 = w.attacks[0], a1 = Object.assign({}, a0, { evoEff: Object.assign({}, a0.evoEff || {}, { nc: 10 }) });
      const ids = ["Primed Heated Charge", "Pistol Pestilence", "Frostbite"];
      const ob = Object.assign(baseO(), { scenario: "boss" }), oc = baseO();
      const b0 = E.evaluate(w, a0, ids.map(M), ob).score, b1 = E.evaluate(w, a1, ids.map(M), ob).score;
      const c0 = E.evaluate(w, a0, ids.map(M), oc).score, c1 = E.evaluate(w, a1, ids.map(M), oc).score;
      check("v1.61 어트리션 진화: 보스에겐 미적용, 무리에선 적용", Math.abs(b1 / b0 - 1) < 0.005 && c1 > c0 * 1.5, `boss ${(b1 / b0).toFixed(3)} · crowd ${(c1 / c0).toFixed(2)}`);
    }
    // v1.62: community builds read from their source compete with the search (cfg.seeds) — a stronger one becomes #1,
    // one with mods the game won't equip together is never returned
    {
      const w = weapon("kuva_zarr"), o = baseO();
      const cands = ["serration", "split_chamber"].map(M);
      const strong = { name: "seed", mods: ["serration", "split_chamber", "primed_cryo_rounds", "vital_sense"].map(M) };
      const clashing = { name: "clash", mods: ["serration", "split_chamber", "critical_delay", "point_strike", "primed_cryo_rounds", "vital_sense"].map(M) };
      const top = E.optimize(w, w.attacks[0], cands, o, { slots: 8, beam: 5, seeds: [strong, clashing] })[0];
      const ids = top.mods.map((m) => m.id);
      check("v1.62 더 강한 커뮤니티 세팅이 1위가 되고, 같이 못 끼는 세팅은 제외", top.community === "seed" && !ids.includes("point_strike"), ids.join(","));
    }
    return out;
  });

  // v1.56, the case the user caught: kitgun Sporelacer/Haymaker/Splat "setting A" (viral + heat, Cascadia Flare),
  // Corrupted, Steel Path 150, 20 enemies. Old rolling-window stacks: 7.8 s; stacks held while heat keeps landing: ~4.5 s.
  {
    const p2 = await ctx.newPage();
    p2.on("pageerror", (e) => errs.push(e.message));
    await p2.addInitScript(() => { try { localStorage.setItem("wfopt2", JSON.stringify({ mod: ["kit_secondary", "Sporelacer", "Haymaker", "Splat"] })); } catch (e) {} });
    await p2.goto("file://" + path.resolve(__dirname, "..", "index.html"));
    await p2.waitForFunction(() => window.WFEngine && window.WF_APP);
    const r = await p2.evaluate(() => {
      const A = window.WF_APP;
      if (!A.st.weapon.modular) return { err: "kitgun not loaded" };
      const en = (n) => window.WF_MODS.find((x) => x.en === n).id;
      const ids = ["Pathogen Rounds", "Deep Freeze", "Primed Heated Charge", "Galvanized Diffusion", "Pistol Gambit", "Lethal Torrent", "Primed Target Cracker", "Primed Fulmination"].map(en);
      const o = Object.assign(A.readOpts(), { factions: ["corrupted"], level: 150, steel: true, crowdN: 20, levelSteps: [0, 0, 0], targets: null, val: null, arcane: "cascadia_flare" });
      A.st.results = A.st.results || { o };
      return { clear: A.evalBuild(ids, null, "cascadia_flare", o, null).perF.corrupted.clear };
    });
    results.push({ name: "v1.56 킷건 세팅 A (캐스케디아 플레어) 커럽티드 강철의 길 150 20명 < 6초", ok: !r.err && r.clear < 6, detail: r.err || r.clear.toFixed(2) + "초" });
    await p2.close();
  }

  let fail = 0;
  for (const r of results) { console.log((r.ok ? "PASS " : "FAIL ") + r.name + (r.detail ? "  (" + r.detail + ")" : "")); if (!r.ok) fail++; }
  if (errs.length) { console.log("PAGE ERRORS", errs); fail++; }
  await b.close();
  console.log(fail ? `\n${fail} 실패` : "\n모두 통과");
  process.exit(fail ? 1 : 0);
})();
