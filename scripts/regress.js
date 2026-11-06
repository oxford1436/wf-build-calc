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

    // v1.74 (wiki melee audit 2026-11-05): swings don't get the infinite body punch through of Corufell's gunblade shots etc.;
    // Destreza/Obex Evo II base damage does nothing; Hespar heavy = 3 x 560; open documented gaps are attached for the app to withhold
    {
      const cor = weapon("corufell"), des = weapon("destreza"), hes = weapon("hespar"), fur = weapon("furax");
      check("v1.74 코루펠 근접 휘두르기에 무한 관통 없음 (위키: 건블레이드 사격만)", !cor.attacks.some((a) => a.kind !== "radial" && a.punch), cor.attacks.map((a) => a.en + ":" + !!a.punch).join(" "));
      const dII = des.evos.find((t) => t.tier === 2);
      check("v1.74 데스트레자 진화 II 기본 피해 미적용 (위키)", !dII.perks.some((p) => p.items.some((it) => it.key === "baseDmg")));
      const hH = hes.attacks.find((a) => a.en === "Heavy Attack"), tot = Object.values(hH.dmg).reduce((q, v) => q + v, 0);
      check("v1.74 헤스파 강공 1680 (560×3, 위키)", Math.abs(tot - 1680) < 1, tot);
      check("v1.74 퓨락스: 계산에 없는 위키 메커니즘이 붙어 있음 (앱이 추천 보류)", (fur.gaps || []).length > 0, (fur.gaps || []).length + "개");
      // v1.79: Truth's Flame is opt-in (Tennokai chaining on kills not modeled, self-damage curse) — never an optimizer candidate
      {
        const A = window.WF_APP, di = weapon("dual_ichor");
        const cands = A.candidateMods(di, di.attacks[0], {});
        check("v1.79 트루스 플레임은 자동 추천 후보가 아님 (처치 시 추가 텐노카이 기회 미반영·저주)", !cands.some((m) => m.id === "truths_flame") && cands.some((m) => m.id === "disciplines_merit"), cands.filter((m) => m.exilus).map((m) => m.id).join(","));
      }
      // v1.80 (independent review): Berserker Fury stacks ramp; melee swing+Tennokai model choices are checked at both ends;
      // the first hit on a fresh enemy gets no Condition Overload; 10-stack Blast detonations need a struck enemy that lives
      {
        const A = window.WF_APP, di = A.applyEvos(weapon("dual_ichor"), { 2: 1, 3: 1, 4: 0 });
        check("v1.80 버서커 퓨리 처치 중첩 최대 2 (0부터 쌓임)", (M("berserker_fury").cond || [])[0] && M("berserker_fury").cond[0].stk === 2);
        const alts = typeof A.boundAlts === "function" ? A.boundAlts(di, di.attacks[0], Object.assign(A.readOpts(), { scenario: "crowd" })).map((x) => Object.keys(x.o)[0]) : [];
        check("v1.80 근접 휘두르기 추천은 평균/분리·텐노카이 합연산을 양끝 계산", ["noPool", "tennoAdd"].every((k) => alts.includes(k)), alts.join(","));
        check("v1.82 텐노카이 기회는 휘두른 횟수로 셈(게임 확인: 적 1명·20명에서 기회 간격이 휘두르기 3~5번으로 같음) — 이 가정으로는 보류 안 함", !alts.includes("tennoPerHit"), alts.join(","));
        const o = Object.assign(baseO(), { factions: ["grineer"] });
        const X = ["galvanized_steel", "north_wind", "molten_impact", "weeping_wounds", "berserker_fury", "gladiator_vice", "gladiator_might", "masters_edge"];
        const lvNo = E.evaluate(di, di.attacks[0], X.map(M), o).perF.grineer.oneLv, lvCO = E.evaluate(di, di.attacks[0], X.concat(["condition_overload"]).map(M), o).perF.grineer.oneLv;
        check("v1.80 첫 타(상태이상 없는 적)에는 컨디션 오버로드 없음 — 한 방 처치 레벨이 컨디션 오버로드로 안 오름", lvCO === lvNo, lvNo + " / " + lvCO);
        const T = ["masters_edge", "galvanized_steel", "condition_overload", "gladiator_vice", "berserker_fury", "weeping_wounds", "molten_impact", "gladiator_might", "north_wind"];
        const st = A.st, sv = [st.base, st.weapon, st.atk, st.results];
        st.base = weapon("dual_ichor"); st.weapon = di; st.atk = 0;
        const oc = Object.assign(A.readOpts(), { targets: null, factions: ["corpus"] }); st.results = { o: oc };
        const rT = A.evalBuild(T, null, "melee_duplicate", oc);
        [st.base, st.weapon, st.atk, st.results] = sv;
        check("v1.80 폭발 10중첩 폭발은 살아서 10중첩이 쌓인 적만 — 듀얼 이코르 폭발 세팅 코퍼스 무리가 '휘두르기 2번'(0.54초)에 끝나지 않음", rT.perF.corpus.clear > 0.6, rT.perF.corpus.clear.toFixed(2));
      }
      // v1.76: Dual Ichor heavy = 610 in the in-game arsenal (wiki 488)
      const ich = weapon("dual_ichor"), iH = ich.attacks.find((a) => a.en === "Heavy Attack"), iT = Object.values(iH.dmg).reduce((q, v) => q + v, 0);
      check("v1.76 듀얼 이코르 강공 610 (게임 아스날, 위키 488)", Math.abs(iT - 610) < 1, iT);
      const amp = weapon("amprex").attacks.find((a) => a.en === "Normal Attack");
      check("v1.74 빔 피해 상승 (앰프렉스 30% → 100%, 0.6초, 위키)", amp.beamRamp && amp.beamRamp[0] === 0.3 && amp.beamRamp[1] === 0.6, JSON.stringify(amp.beamRamp));
    }
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
    // v1.64: Nightwatch Napalm ticks "each have a fixed 68% chance to proc Heat status ... only 3 seconds" and
    // "Heat status damage is affected by Heat mods" (wiki Nightwatch Napalm) — even when the heat mod is combined away
    {
      const w = weapon("kuva_ogris"), atk = w.attacks[A.defaultAttack(w)], o = baseO();
      const nh = (names) => (E.evaluate(w, atk, names.map(M), o).perF.grineer.dotBy || {}).napalmHeat || 0;
      const base = nh(["Nightwatch Napalm", "Infected Clip"]), hot = nh(["Nightwatch Napalm", "Infected Clip", "Hellfire"]);
      check("v1.65 나이트워치 네이팜 틱의 화염 상태이상 피해 반영, 화염 모드로 증가 (가스로 섞여도)", base > 0 && hot > base * 1.5, `${Math.round(base)} → ${Math.round(hot)}`);
    }
    // v1.64: those napalm Heat procs also strip armor (wiki "Heat": "reduces their armor by up to 50%") — napalm speeds up
    // Grineer kills more while they still have armor than once the armor is already gone
    {
      const w = weapon("kuva_ogris"), atk = w.attacks[A.defaultAttack(w)];
      const cl = (names, strip) => E.evaluate(w, atk, names.map(M), Object.assign(baseO(), { factions: ["grineer"], level: 150, ext: { armorStrip: strip } })).perF.grineer.clear;
      const g0 = cl(["Serration"], 0) / cl(["Serration", "Nightwatch Napalm"], 0), g1 = cl(["Serration"], 0.999) / cl(["Serration", "Nightwatch Napalm"], 0.999);
      check("v1.65 네이팜 화염 상태이상이 방어구를 깎음 (방어구가 남은 그리니어에서 네이팜 효과가 더 큼)", g0 > g1 * 1.1, `방어구 있음 ×${g0.toFixed(2)} · 없음 ×${g1.toFixed(2)}`);
    }
    // v1.66 (user's arsenal 2026-11-03, Kuva Ogris on Cyte-09): Malignant Force toxin + Heat valence = Gas, the Violet shard's
    // Electricity stays Electricity — shard elements come after the valence, not before it
    {
      const w = weapon("kuva_ogris"), atk = w.attacks[A.defaultAttack(w)];
      const o = Object.assign(baseO(), { val: { type: "heat", pct: 0.287 }, ext: { elem: { elecmod: 1 } } });
      const sh = E.evaluate(w, atk, [M("Malignant Force")], o).share;
      check("v1.66 멀리그난트 포스(독) + 화염 베일런스 + 보라 샤드(전기) = 가스 + 전기 (부식 아님, 아스날)", sh.gas > 0 && sh.elec > 0 && !sh.corr, JSON.stringify(Object.keys(sh)));
    }
    // v1.66: semi-auto weapons fire at their modded rate (Accessibility "Fire Manual Trigger Weapons Continuously") — no 3.5 cap
    {
      const w = weapon("kuva_ogris"), atk = w.attacks[A.defaultAttack(w)];
      const r = E.evaluate(w, atk, ["Vile Acceleration", "Speed Trigger"].map(M), Object.assign(baseO(), { ext: { reloadCast: 0 } })).rate;   // Resupply: no reload pause
      check("v1.66 반자동 연사 상한 없음 (쿠바 오그리스 + 바일 액셀러레이션 + 스피드 트리거 = 3.75발)", Math.abs(r - 3.75) < 0.05, r.toFixed(2));
    }
    // v1.66: napalm Heat stacks refresh each other and keep ramping (wiki "Heat") — Heat damage grows faster than linearly
    {
      const p = { hp: 1e12, sh: 0, og: 0, ar0: 0, strip: 0, r: 2, D: 0, blast: 0, F: 0, dot: {}, napH: 1, pv: 0, ph: 0, pc: 0, pk: 0, pm: 0,
        cc: 0, cd: 1, nc: 0, corrMax: 10, dt: 0.05, tmax: 60, Tdur: 6, dotN: {} };
      const d5 = E.ttk(p, 5), d10 = E.ttk(p, 10);
      check("v1.66 네이팜 화염 중첩은 서로 갱신되어 계속 쌓임 (10초 피해 > 5초 피해 × 3)", d5 > 0 && d10 > d5 * 3, `5초 ${d5.toFixed(0)} · 10초 ${d10.toFixed(0)}`);
    }
    // v1.64: Cyte-09 Resupply = an Extra Hit of 25% x strength per hit in the chosen element with its forced status
    // (wiki Resupply/Extra Hit); napalm ticks don't trigger it ("Extra Hit mechanics which function by buffing your
    // weapon's magazine (e.g. Resupply) do not")
    {
      const w = weapon("kuva_ogris"), atk = w.attacks[A.defaultAttack(w)], ids = ["Serration", "Nightwatch Napalm"].map(M);
      const r0 = E.evaluate(w, atk, ids, Object.assign(baseO(), { ext: { reloadCast: 0 } }));
      const r1 = E.evaluate(w, atk, ids, Object.assign(baseO(), { ext: { reloadCast: 0, xhit: 0.25 * 2.98, xhitElem: "corr" } }));
      const g0 = r0.perF.grineer, g1 = r1.perF.grineer;
      check("v1.65 리서플라이 추가 타격(위력 298% → 74.5%)이 직격·폭발 피해를 올리고 네이팜은 그대로", g1.direct > g0.direct * 1.4 && Math.abs((g1.dotBy.napalm || 0) / (g0.dotBy.napalm || 1) - 1) < 0.01,
        `hit ×${(g1.direct / g0.direct).toFixed(2)} · napalm ×${((g1.dotBy.napalm || 0) / (g0.dotBy.napalm || 1)).toFixed(3)}`);
    }
    // v1.63 (대기열 0): impact + explosion of one shot under different wiki names must be one default attack
    // (wiki AttackParentIndex). Lenz = Charged Shot + Initial Blast + Bubble Collapse; Penta = Grenade Impact + Grenade Detonation.
    {
      const want = { lenz: ["Charged Shot", "Initial Blast", "Bubble Collapse"], penta: ["Grenade Impact", "Grenade Detonation"], aegrit: ["Direct Hit", "Detonation"],
        astilla: ["Slug Impact", "Glass Explosion"], tenet_envoy: ["Grenade Impact", "Rocket Explosion"], stug: ["Blob Embed", "Blob Explosion"] };
      let bad = "";
      for (const id in want) {
        const a = weapon(id).attacks[0], got = (a.parts || [a]).map((x) => x.en);
        if (want[id].some((n) => !got.includes(n))) bad += `${id}: ${got.join("+")} · `;
      }
      // Castanas: mid-flight and embedded detonation are either/or (wiki) — never summed
      const c = weapon("castanas").attacks.find((x) => x.parts && x.parts.some((p) => /Mid-Flight/.test(p.en)) && x.parts.some((p) => /Embedded/.test(p.en)));
      if (c) bad += "castanas 비행 중 + 박힌 뒤 기폭을 합침";
      check("v1.63 직격·폭발 이름이 다른 무기의 기본 공격 = 한 발 전체 (렌즈 3부분·펜타·아에그리트·아스틸라·엔보이·스터그)", !bad, bad);
    }
    // v1.68 (묶음 3 런처): cluster bombs come out of every cannonball / charged arrow — wiki Zarr "splitting into 6 smaller
    // projectiles … each main projectile will always produce 6 cluster bombs", Kuva Bramma "explodes … then splits into 3 small
    // bombs" (wiki attack data Multishot 3 for Kuva Zarr / Kuva Bramma). The default attack must carry them.
    {
      const want = { kuva_zarr: ["Cannon Mode Cluster Bomb Explosion", 3], zarr: ["Cannon Mode Cluster Bomb Explosion", 6], kuva_bramma: ["Cluster Bomb Explosion", 3] };
      let bad = "";
      for (const id in want) {
        const a = weapon(id).attacks[0], n = (a.parts || [a]).filter((x) => x.en === want[id][0]).length;
        if (n !== want[id][1]) bad += `${id}: ${want[id][0]} ×${n} (위키 ${want[id][1]}) · `;
      }
      check("v1.68 쿠바 자르·자르·쿠바 브람마 기본 공격에 집속탄(위키 개수)이 들어감", !bad, bad);
    }
    // v1.69 (묶음 4 저격총): burst weapons — wiki Fire Rate: "Fire Rate: Number of bursts per second if Burst Delay is 0
    // seconds … This is the 'Fire Rate' value listed in the arsenal", Burst Count shots per burst. Shots per second must be
    // BurstCount / (1/FireRate + BurstCount × BurstDelay) (= DE export fireRate: Perigale 6.06, Hind 6.25, Quartakk 6.33,
    // Sicarus 7.39), not the arsenal value (bursts per second: Perigale 2).
    {
      const want = { perigale_prime: 6.06, perigale: 6.06, hind: 6.25, quartakk: 6.33, sicarus: 7.39, burston: 7.83 };
      let bad = "";
      for (const id in want) {
        const a = weapon(id).attacks.find((x) => x.burst) || weapon(id).attacks[0];
        if (!(Math.abs(a.fr - want[id]) < 0.05)) bad += `${id}: 초당 ${(+a.fr).toFixed(2)}발 (게임 ${want[id]}) · `;
      }
      // negative fire rate does not stretch the burst delay (wiki "Burst Delay is not affected by net negative Fire Rate bonuses")
      const w = weapon("perigale_prime"), a = w.attacks[0], o = baseO();
      const r0 = E.evaluate(w, a, ["Galvanized Chamber"].map(M), o).rate, r1 = E.evaluate(w, a, ["Galvanized Chamber", "Critical Delay"].map(M), o).rate;
      check("v1.69 점사 무기 연사 = 점사 발 수 ÷ (1/연사 + 발 수 × 점사 간격) (페리게일·힌드·쿼타크·시카루스·버스턴) · 음수 연사는 점사 간격을 늘리지 않음", !bad && r1 / r0 > 0.905, bad + "크리티컬 딜레이 연사 비 " + (r1 / r0).toFixed(3));
    }
    // v1.77 (묶음 5 활): wiki Fire Rate "Fire Rate and Charge Time": "Charge Time = Base Charge Time / (1 + Mod Bonus)", "charge time
    // cannot go above 10 times the base charge time"; bows: "Effective Fire Rate = 1 / (Modded Charge Time + Modded Reload Time)";
    // Lanka: "1 / Modded Charge Time"; other charge weapons: "1 / (Modded Charge Time + 1 / Modded Fire Rate)". Wiki comment check:
    // Daikyu + Speed Trigger charge time 0.45 s in game.
    {
      const near = (x, y) => Math.abs(x - y) < 0.01 * y;
      const rt = (id, en, mods) => { const w = weapon(id), a = w.attacks.find((x) => x.en === en) || w.attacks[0]; return E.evaluate(w, a, mods.map(M), baseO()).rate; };
      const got = {
        daikyu: rt("daikyu", "Charged Shot", []), daikyuST: rt("daikyu", "Charged Shot", ["Speed Trigger"]),
        lenz: rt("lenz", weapon("lenz").attacks[0].en, []), lanka: rt("lanka", "Charged Shot", []), opticor: rt("opticor", "Charged Shot", []),
        nataruk: rt("nataruk", "Perfect Shot", []),
      };
      const want = { daikyu: 1 / (1 + 0.6), daikyuST: 1 / (1 / 2.2 + 0.6), lenz: 1 / (1.2 + 0.6), lanka: 10 / (10 * 1 + 2), opticor: 5 / (5 * (2 + 1) + 2), nataruk: 1 / (0.7 + 0.05) };
      let bad = "";
      for (const k in want) if (!near(got[k], want[k])) bad += `${k}: 초당 ${got[k].toFixed(3)}발 (위키 공식 ${want[k].toFixed(3)}) · `;
      check("v1.77 충전 무기 발 간격 = 충전 시간 ÷ (1 + 연사 보너스) (+ 활은 재장전, 랑카는 충전만, 나머지는 + 1/연사) — 다이큐·렌즈 기본 공격·나타루크 퍼펙트 샷·랑카·옵티코", !bad, bad);
    }
    // v1.81 (묶음 5 활): bows default to the charged shot. Wiki Fire Rate gives the bow cadence only for charged shots
    // ("Effective Fire Rate = 1 / (Modded Charge Time + Modded Reload Time)"); uncharged/quick shots have no wiki cadence and are
    // not what bow builds are made for. Combined attacks (Lenz, Kuva Bramma, Evensong) already start with the charged shot.
    {
      const A = window.WF_APP;
      const ids = ["paris", "paris_prime", "nataruk", "daikyu_prime", "cernos_prime", "dread", "mk1_paris", "lenz", "evensong", "kuva_bramma"];
      let bad = "";
      for (const id of ids) { const w = W.find((x) => x.id === id); if (!w) { bad += id + " 없음 · "; continue; } const en = w.attacks[A.defaultAttack(w)].en; if (!/Charged/.test(en) || /^Incarnon/.test(en)) bad += `${id}: ${en} · `; }
      check("v1.81 활 기본 공격 = 충전 사격 (패리스·나타루크·다이큐 프라임·서노스 프라임·드레드 — 비충전·퀵 사격 아님, 인카논 형태 아님)", !bad, bad);
    }
    // v1.70 (대기열 4b): Perigale "Gale Force" — wiki: "Landing 4 headshots in a burst or a headshot kill grants the "Gale Force"
    // buff, granting Infinite Ammo. The buff lasts 4 seconds". With headshots (o.hs 0.5, aimed) the magazine lasts longer →
    // fewer reloads → higher average rate and less ammo used; without headshots nothing changes.
    {
      const w = weapon("perigale_prime"), a = w.attacks[0], ids = ["Galvanized Chamber", "Vile Acceleration"].map(M);
      const oH = Object.assign(baseO(), { hs: 0.5, aim: true }), o0 = baseO();
      const wNo = Object.assign({}, w, { galeForce: undefined });
      const rH = E.evaluate(w, a, ids, oH), rHn = E.evaluate(wNo, a, ids, oH), r0 = E.evaluate(w, a, ids, o0), r0n = E.evaluate(wNo, a, ids, o0);
      const ok = !!w.galeForce && rH.rate / rHn.rate > 1.2 && rH.ammo.use < rHn.ammo.use * 0.5 && Math.abs(r0.rate / r0n.rate - 1) < 1e-9;
      check("v1.70 페리게일 갈 포스: 헤드샷 조건에서 탄약 무소모(재장전 줄고 탄약 사용 감소), 헤드샷 없으면 그대로", ok,
        `연사 ${(rHn.rate).toFixed(2)} → ${(rH.rate).toFixed(2)}, 탄약 ${(rHn.ammo.use).toFixed(2)} → ${(rH.ammo.use).toFixed(2)}/초`);
    }
    // v1.69 (묶음 4 저격총): wiki Perigale Prime "Class = Sniper Rifle" (DE export says Rifle) → sniper-only mods, not assault-rifle ones
    check("v1.69 페리게일 프라임 = 저격총 (위키 분류)", weapon("perigale_prime").type === "Sniper", weapon("perigale_prime").type);
    // v1.68 (묶음 3 런처): Torid Incarnon beam — wiki "Punch Through mods have no effect on the behavior of the beam" —
    // Primed Shred must not change its score (same for Kunai / Latron / Vectis Incarnon forms per their wiki notes)
    {
      const w = weapon("torid"), a = w.attacks.find((x) => x.inc), o = baseO();
      const ids = ["Galvanized Chamber", "Vital Sense", "Critical Delay", "Primed Cryo Rounds"];
      const k1 = E.evaluate(w, a, ids.concat(["Primed Shred"]).map(M), o).K;
      const lt = weapon("latron_prime").attacks.find((x) => x.inc || (x.parts && x.parts[0].inc));
      check("v1.68 토리드 인카논 빔은 관통 모드로 맞히는 적이 늘지 않음 (프라임드 슈레드 → 한 번에 1명) · 레이트론 인카논도 관통 잠금", k1 === 1 && !!(lt && lt.ptLock), "K " + (+k1).toFixed(2) + " · latron " + (lt ? !!lt.ptLock : "없음"));
    }
    // v1.64 (커뮤니티 이유 분석): Soma Prime builds always carry Hata-Satya — wiki "+1.2% crit chance per hit", reset on reload
    {
      const w = weapon("soma_prime"), a = w.attacks[0], o = baseO();
      const ids = ["Galvanized Chamber", "Primed Cryo Rounds", "Malignant Force", "Vital Sense"];
      const s0 = E.evaluate(w, a, ids.map(M), o).score, s1 = E.evaluate(w, a, ids.concat(["Hata-Satya"]).map(M), o).score;
      check("v1.64 하타-사트야(맞힐 때마다 치명타 +1.2%)가 소마 프라임 처치 속도를 올림", s1 > s0 * 1.2, (s1 / s0).toFixed(2));
    }
    // v1.64: Gotva Prime — status effects have a 15% chance to set the next shot's crit chance to 300% (wiki)
    {
      const w = weapon("gotva_prime"), a = w.attacks[0], o = baseO();
      const r = E.evaluate(w, a, [M("Primed Cryo Rounds"), M("Malignant Force"), M("Galvanized Aptitude")], o);
      check("v1.64 고트바 프라임: 상태이상 시 다음 발 치명타 300% (기본 23%보다 평균 치명타 확률이 높음)", !!w.procCrit && r.cc > 0.23 * 1.05, "cc " + (r.cc || 0).toFixed(3));
    }
    // v1.64: long-fight ammo — Kuva Zarr (AmmoPickup 1, wiki) can't sustain its fire on kill drops; Soma Prime can at Lv150
    {
      const z = weapon("kuva_zarr"), oz = baseO();
      const ids = ["Primed Cryo Rounds", "Galvanized Chamber", "Critical Delay", "Vital Sense", "Malignant Force", "Hellfire"];
      const r = E.evaluate(z, z.attacks[0], ids.map(M), oz), r2 = E.evaluate(z, z.attacks[0], ids.map(M), Object.assign(baseO(), { ammoLimit: false }));
      const k = r.perF.grineer.top.ammoK;
      check("v1.64 긴 전투 탄약: 쿠바 자르는 처치 드롭으로 탄약을 못 메움 (Lv400 그리니어 ammoK < 1), 끄면 1", k < 0.9 && r2.perF.grineer.top.ammoK === 1, "ammoK " + (k || 0).toFixed(2));
    }
    // v1.67: each arcane got its own beam, and a mod set the Plated Round beam found (Corinth Prime pellets: Blaze +
    // Seeking Force + Magnetic Strafe ...) was 7% stronger with Merciless than anything the Merciless beam reached.
    // The optimizer now re-scores its leading sets with every arcane option.
    {
      const w = weapon("corinth_prime"), atk = w.attacks[1], o = baseO();
      A.st.weapon = w; A.st.atk = 1;
      const cands = A.candidateMods(w, atk, { aim: false, cast: false, boss: true });
      const T = ["galvanized_hell", "primed_chilling_grasp", "toxic_barrage", "galvanized_savvy", "magnetic_strafe", "seeking_force", "blaze", "shotgun_barrage"].map(M);
      const ref = E.evaluate(w, atk, T, Object.assign({}, o, { arcane: "primary_merciless", layoutTTK: true })).score;
      const top = E.optimize(w, atk, cands, o, { slots: 8, beam: 20, arcOptions: ["primary_merciless", "primary_plated_round"] })[0];
      check("v1.67 검색이 캐노네이드 세팅에 갇히지 않음: 코린트 프라임 추천이 '플레이티드 라운드 1위 세팅 + 머시리스'보다 약하지 않음", top.score >= ref * 0.995, (top.score / ref * 100).toFixed(1) + "% (" + top.arcane + ")");
    }
    // v1.67: weapon Heat status — a new proc refreshes every active Heat stack (wiki "Heat"), so with steady procs the
    // tick damage keeps ramping instead of levelling off at 6 s worth of stacks
    {
      const hp = { hp: 1e12, sh: 0, og: 0, ar0: 0, strip: 0, r: 2, D: 0, blast: 0, F: 0, dot: { heat: 600 }, dotN: { heat: 6 }, Tdur: 6,
        pv: 0, ph: 1, pc: 0, pk: 0, pm: 0, pp: 0, cc: 0, cd: 1, corrMax: 10, dt: 0.05, tmax: 60 };
      const d = (t) => E.ttk(hp, t);
      const early = d(10) - d(5), late = d(20) - d(15);
      check("v1.67 무기 화염 중첩 갱신: 화염이 계속 걸리면 15~20초 화염 피해가 5~10초의 1.5배 넘음", late > 1.5 * early, (late / early).toFixed(2) + "배");
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

  // v1.71: the cases the user caught in game (2026-11-04).
  //  - Torid Incarnon Form, setting A (blast + corrosive) vs the old pick (viral + magnetic, Primed Shred): Simulacrum, Grineer Nox
  //    x20, Lv150, from zero stacks. In game A clears all 20 in < 3 s, the old pick takes 6 s for 5. Old engine: old pick faster.
  //    Needs the beam's 5 chains (wiki) and Blast's 10-stack AoE "300% base damage per stack" (wiki Blast Damage).
  //  - Dual Ichor setting A (viral + electricity, Melee Influence): Influence spreads the elemental damage, not just the status
  //    (wiki Melee Influence) — old engine had Influence = no arcane +15%.
  //  - melee Incarnon Form "+100% Melee Damage" (wiki, additive with Pressure Point) must reach the attack.
  {
    const p3 = await ctx.newPage();
    p3.on("pageerror", (e) => errs.push(e.message));
    await p3.goto("file://" + path.resolve(__dirname, "..", "index.html"));
    await p3.waitForFunction(() => window.WFEngine && window.WF_APP);
    const r = await p3.evaluate(() => {
      const A = window.WF_APP, E = window.WFEngine, st = A.st, out = {};
      if (!A.applyEvos) return { err: "applyEvos not exported" };
      const use = (id, en, evo) => { const w0 = window.WF_WEAPONS.find((x) => x.id === id); st.base = w0; st.weapon = A.applyEvos(w0, evo); st.atk = Math.max(0, st.weapon.attacks.findIndex((a) => a.en === en)); };
      // Torid vs Nox (wiki Module:Enemies/data/grineer: Nox Health 350, Armor 500, Overguard 5, BaseLevel 1)
      use("torid", "Incarnon Form", { 2: 0, 3: 0, 4: 1 });
      const keep = E.UNITS.grineer.heavy;
      E.UNITS.grineer.heavy = { ko: "녹스", lv: 1, hp: 350, ar: 500, sh: 0 };
      const t = E.enemyStats("grineer", "heavy", 150, false);
      E.UNITS.grineer.heavy = keep;
      t.og = 5 * (1 + 260 * Math.pow(149, 0.9));
      const T = { main: t, heavy: null, ex: null };
      const o = Object.assign(A.readOpts(), { factions: ["grineer"], crowdN: 20, killRamp: true, targets: { lo: { grineer: T }, hi: { grineer: T }, top: { grineer: T } } });
      st.results = { o };
      const SA = ["thermite_rounds", "vital_sense", "vile_acceleration", "primed_cryo_rounds", "galvanized_chamber", "rifle_elementalist", "high_voltage", "critical_delay", "vigilante_supplies"];
      const OLD = ["primed_cryo_rounds", "galvanized_chamber", "primed_shred", "vital_sense", "critical_delay", "magnetic_capacity", "galvanized_aptitude", "vile_acceleration"];
      out.tA = A.evalBuild(SA, null, "primary_merciless", o).perF.grineer.clear;
      out.tOld = A.evalBuild(OLD, null, "primary_merciless", o).perF.grineer.clear;
      // Torid chains in the default crowd
      const o2 = Object.assign(A.readOpts(), { targets: null }); st.results = { o: o2 };
      out.keff = A.evalBuild(SA, null, "primary_merciless", o2).perF.grineer.Keff;
      // Dual Ichor
      use("dual_ichor", "Normal Attack", { 2: 1, 3: 1, 4: 0 });
      out.form = (st.weapon.attacks[0].evoEff || {}).dmg || 0;
      const o3 = Object.assign(A.readOpts(), { targets: null }); st.results = { o: o3 };
      const DA = ["galvanized_steel", "virulent_scourge", "vicious_frost", "galvanized_elementalist", "primed_fury", "condition_overload", "blood_rush", "shocking_touch", "disciplines_merit"];
      out.infl = A.evalBuild(DA, null, "melee_influence", o3).score / A.evalBuild(DA, null, null, o3).score;
      // Ronin's Rush (evo II-2) in quick melee: +30% attack speed on the normal attack
      out.rateRonin = A.evalBuild(DA, null, "melee_influence", o3).rate;
      use("dual_ichor", "Normal Attack", { 2: 0, 3: 1, 4: 0 }); st.results = { o: o3 };
      out.rateAlch = A.evalBuild(DA, null, "melee_influence", o3).rate;
      // non-Incarnon chain beam (Amprex, wiki: 3 chains at 50/25/12.5%)
      use("amprex", "Normal Attack", {}); const o4 = Object.assign(A.readOpts(), { targets: null }); st.results = { o: o4 };
      out.amprexK = A.evalBuild(["serration", "split_chamber", "vital_sense", "point_strike"], null, null, o4).perF.grineer.Keff;
      out.exposureManual = !!(window.WF_ARCANES.melee_exposure || {}).manual;
      // Dual Ichor on-kill toxin field (tick interval not on the wiki): Lv150 without Steel Path, Influence build — ticking every
      // second must clear faster than one hit of 440
      use("dual_ichor", "Normal Attack", { 2: 1, 3: 1, 4: 0 });
      const o5 = Object.assign(A.readOpts(), { targets: null, level: 150, steel: false, levelSteps: [0, 0, 0] }); st.results = { o: o5 };
      const INF = ["truths_flame", "galvanized_steel", "primed_fever_strike", "vicious_frost", "shocking_touch", "weeping_wounds", "condition_overload", "berserker_fury", "gladiator_vice"];
      out.fieldLo = A.evalBuild(INF, null, "melee_influence", o5).score;
      out.fieldHi = A.evalBuild(INF, null, "melee_influence", Object.assign({}, o5, { fieldHigh: true })).score;
      // v1.75: the combo-on-status assumption is checked at both ends — without it the Duplicate/Blast pick must lose to Influence
      const o6 = Object.assign(A.readOpts(), { targets: null, noComboStatus: true }); st.results = { o: o6 };
      const REC = ["truths_flame", "galvanized_steel", "north_wind", "gladiator_vice", "condition_overload", "berserker_fury", "weeping_wounds", "gladiator_might", "molten_impact"];
      out.ncsRatio = A.evalBuild(INF, null, "melee_influence", o6).score / A.evalBuild(REC, null, "melee_duplicate", o6).score;
      // v1.78: settled in game (Simulacrum 2026-11-06) — the combo multiplier reaches status damage, so the app must not withhold
      // over it any more
      out.comboAlt = typeof A.boundAlts === "function" ? A.boundAlts(st.weapon, st.weapon.attacks[st.atk], Object.assign(A.readOpts(), { scenario: "crowd" })).some((a) => a.o.noComboStatus) : "boundAlts 없음";
      return out;
    });
    const f2 = (x) => (x == null || isNaN(x) ? "-" : (+x).toFixed(2));
    results.push({ name: "v1.71 토리드 인카논 녹스 20명(Lv150 그리니어): 세팅 A(부식+폭발)가 바이러스+자성보다 빠름 — 게임 테스트", ok: !r.err && r.tA < r.tOld, detail: r.err || "A " + f2(r.tA) + "초 / 바이러스+자성 " + f2(r.tOld) + "초" });
    results.push({ name: "v1.71 토리드 인카논 빔 연쇄: 무리에서 한 번에 3명 넘게 처리", ok: !r.err && r.keff > 3, detail: r.err || "한 번에 " + f2(r.keff) + "명" });
    results.push({ name: "v1.71 근접 인카논 형태 근접 피해 +100% 적용 (듀얼 이코르)", ok: !r.err && r.form >= 1, detail: r.err || "+" + Math.round(r.form * 100) + "%" });
    results.push({ name: "v1.71 밀리 인플루언스 전염 피해: 듀얼 이코르 세팅 A 인플루언스가 아케인 없음의 1.5배 넘음", ok: !r.err && r.infl > 1.5, detail: r.err || "×" + f2(r.infl) });
    results.push({ name: "v1.72 퀵밀 Ronin's Rush: 듀얼 이코르 진화 II-2가 II-1보다 초당 타격 1.15배 넘음 (프라임드 퓨리 +55%와 합연산: 1.85/1.55)", ok: !r.err && r.rateRonin > 1.15 * r.rateAlch, detail: r.err || f2(r.rateRonin) + " / " + f2(r.rateAlch) });
    results.push({ name: "v1.72 일반 연쇄 빔: 앰프렉스가 무리에서 한 번에 1.5명 넘게 처리", ok: !r.err && r.amprexK > 1.5, detail: r.err || "한 번에 " + f2(r.amprexK) + "명" });
    results.push({ name: "v1.72 밀리 익스포저는 어빌리티 사용 조건부 (자동 추천 제외)", ok: !r.err && r.exposureManual, detail: r.err || String(r.exposureManual) });
    results.push({ name: "v1.73 듀얼 이코르 처치 시 독 장판 계산됨 (1초마다 가정 > 한 번 가정, Lv150 강철의 길 아님)", ok: !r.err && r.fieldHi > r.fieldLo * 1.05, detail: r.err || "×" + f2(r.fieldHi / r.fieldLo) });
    results.push({ name: "v1.75 (민감도) 강공 연속기 배율을 상태이상에서 빼면 듀얼 이코르 인플루언스 세팅이 듀플리케이트·폭발 세팅보다 빠름 — 그래서 게임 확인이 필요했음", ok: !r.err && r.ncsRatio > 1.2, detail: r.err || "×" + f2(r.ncsRatio) });
    results.push({ name: "v1.78 연속기 배율은 상태이상에도 곱해짐(게임 확인: 12배 강공 출혈 1.3K, 인카논 3배 641) — 앱이 이 가정으로 추천을 보류하지 않음", ok: !r.err && r.comboAlt === false, detail: r.err || String(r.comboAlt) });
    await p3.close();
  }

  let fail = 0;
  for (const r of results) { console.log((r.ok ? "PASS " : "FAIL ") + r.name + (r.detail ? "  (" + r.detail + ")" : "")); if (!r.ok) fail++; }
  if (errs.length) { console.log("PAGE ERRORS", errs); fail++; }
  await b.close();
  console.log(fail ? `\n${fail} 실패` : "\n모두 통과");
  process.exit(fail ? 1 : 0);
})();
