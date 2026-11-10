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
      // v1.83 (wiki status pages): Viral/Corrosive/Cold/Magnetic/Puncture stacks run out after their duration (each stack its
      // own timer; Corrosive 8 s, the rest 6 s, Puncture 10 s) x status duration — a −84.5% status duration riven keeps few stacks
      {
        const P = (Tdur, pv, pc) => ({ hp: 1e12, sh: 0, ar0: 1000, strip: 0, r: 2, D: 100, blast: 0, F: 0, dot: {}, Tdur, pv, ph: 0, pc, pk: 0, pm: 0, pp: 0, cc: 0, cd: 1, corrMax: 10, dt: 0.01, tmax: 30 });
        const steady = (q) => (E.ttk(q, 10) - E.ttk(q, 5)) / (5 * q.D * q.r);
        // corrosive only, status duration 25% (Tdur 1.5): 2 shots/s x 8 s x 0.25 = 4 stacks → armor 1000 x (1 − 0.44) → 1 − 0.9√(560/2700)
        const c4 = 1 - 0.9 * Math.sqrt(560 / 2700), got = steady(P(1.5, 0, 1));
        check("v1.83 부식 중첩은 8초 × 상태이상 지속 뒤 사라짐 (위키: 중첩마다 따로) — 지속 25%면 초당 2발에 4중첩", Math.abs(got - c4) < 0.01, got.toFixed(3) + " / 기대 " + c4.toFixed(3));
        const vFull = steady(P(6, 1, 0)), vShort = steady(P(0.93, 1, 0));
        check("v1.83 바이러스 중첩은 6초 × 상태이상 지속 뒤 사라짐 — 지속 −84.5%(0.93초)면 2발/초에 약 1.9중첩", vShort < vFull * 0.6 && Math.abs(vShort - (2 + 0.25 * 0.86) * (1 - 0.9 * Math.sqrt(1000 / 2700))) < 0.03, vShort.toFixed(3) + " / 지속 100% " + vFull.toFixed(3));
      }
      // v1.87 (Simulacrum 2026-11-07, Kuva Zarr vs 20 Nox): shots land whole (a 2-shot kill at 5 shots/s takes 0.2 s, the smeared
      // continuous model said 0.02 s), and the next target's first shot comes max(interval, re-aim) after the killing shot
      {
        const q = { hp: 1000, sh: 0, ar0: 0, strip: 0, r: 5, D: 600, blast: 0, F: 0, dot: {}, Tdur: 6, pv: 0, ph: 0, pc: 0, pk: 0, pm: 0, pp: 0, cc: 0, cd: 1, corrMax: 10, dt: 0.2, tmax: 30 };
        const t2 = E.ttk(q);
        check("v1.87 두 발에 죽는 적은 두 번째 발이 들어가는 1/연사(0.2초)에 죽음 (이전: 0.02초)", Math.abs(t2 - 0.2) < 0.011, t2.toFixed(3));
        const sp = weapon("rubico_prime"), K2 = ["serration", "split_chamber", "vital_sense", "point_strike"];
        const oc = Object.assign(baseO(), { factions: ["corpus"], level: 60, steel: false, levelSteps: [0, 0, 0] });
        const r0 = ev(sp, K2, Object.assign({}, oc, { tAcq: 0 })), per = 1 / Math.max(0.05, r0.rate);
        const rP = ev(sp, K2, Object.assign({}, oc, { tAcq: per }));
        const c0 = r0.perF.corpus.clear, cP = rP.perF.corpus.clear;
        check("v1.87 다음 적 첫 발은 처치한 발 뒤 max(발 간격, 다시 조준) — 다시 조준 0초와 발 간격만큼일 때 전멸 시간이 같음", Math.abs(c0 / cP - 1) < 0.01, c0.toFixed(3) + " / " + cP.toFixed(3) + " (처치 " + r0.perF.corpus.ttk.toFixed(2) + "초)");
      }
      // v1.86 (independent review 2026-11-06, Kuva Zarr): the re-aim time between one-shot kills (T_ACQ 0.2 s, no source) decides
      // what fire rate is worth — guns are checked at 0.15 s and 0.3 s, and the engine takes o.tAcq
      {
        const A = window.WF_APP, kz = weapon("kuva_zarr");
        const alts = typeof A.boundAlts === "function" ? A.boundAlts(kz, kz.attacks[0], Object.assign(A.readOpts(), { scenario: "crowd" })).map((x) => x.o.tAcq).filter((x) => x != null) : [];
        check("v1.86 총기 추천은 다시 조준 시간 0.15초·0.3초 양끝에서 확인", alts.includes(0.15) && alts.includes(0.3), alts.join(","));
        const sp = weapon("soma_prime"), oz = Object.assign(baseO(), { factions: ["corpus"], level: 30, steel: false, levelSteps: [0, 0, 0] }), K = ["serration", "split_chamber", "vital_sense", "point_strike"];
        const a = ev(sp, K, Object.assign({}, oz, { tAcq: 0.1 })).score, c = ev(sp, K, Object.assign({}, oz, { tAcq: 0.4 })).score;
        check("v1.86 엔진이 다시 조준 시간 옵션(o.tAcq)을 씀 — 한 방 무기에서 0.1초가 0.4초보다 빠름", a > c * 1.05, (a / c).toFixed(2));
      }
      // v1.88 (queue bundle 6, wiki weapon notes): beam-end AoE (Ignis Wraith 3 m, Glaxion Vandal 2 m, "Not affected by multishot")
      // is part of the default attack; Phantasma's default is its beam (not the charged Plasma Bomb alt-fire) with the 15% → 100%
      // ramp; Quanta's "Beam" gets its 30% → 100% ramp (v1.74 only matched attacks named "Normal Attack")
      {
        const A = window.WF_APP, iw = weapon("ignis_wraith"), gv = weapon("glaxion_vandal"), pp = weapon("phantasma_prime"), qu = weapon("quanta");
        const aI = iw.attacks[A.defaultAttack(iw)], aoeI = (aI.parts || []).find((q) => q.beamAoe);
        check("v1.88 이그니스 레이스 기본 공격 = 빔 + 끝점 3m 범위(멀티샷 미적용, 위키)", aoeI && aoeI.radius === 3 && aoeI.noMs && aI.punch, aI.en);
        const aG = gv.attacks[A.defaultAttack(gv)], oG = Object.assign(baseO(), { factions: ["grineer"] }), K = ["serration", "split_chamber"];
        const sA = E.evaluate(gv, aG, K.map(M), oG).score, sN = E.evaluate(gv, aG, K.map(M), Object.assign({}, oG, { noBeamAoe: true })).score;
        check("v1.88 글랙시온 반달 끝점 2m 범위가 계산에 들어감 (o.noBeamAoe로 빼면 느려짐)", (aG.parts || []).some((q) => q.beamAoe && q.radius === 2) && sA > sN * 1.05, (sA / sN).toFixed(2));
        const alts = A.boundAlts(gv, aG, Object.assign(A.readOpts(), { scenario: "crowd" })).some((x) => x.o.noBeamAoe);
        check("v1.88 빔 끝점 범위를 맞은 적이 받는지 양끝에서 확인 (앱 보류 검사)", alts, String(alts));
        const aP = pp.attacks[A.defaultAttack(pp)];
        check("v1.88 판타즈마 프라임 기본 공격 = 빔(주 사격), 피해 상승 15% → 100%", aP.en === "Beam" && aP.beamRamp && aP.beamRamp[0] === 0.15, aP.en + " " + JSON.stringify(aP.beamRamp));
        const aQ = qu.attacks[A.defaultAttack(qu)];
        check("v1.88 퀀타 빔 피해 상승 30% → 100% (위키)", aQ.beamRamp && aQ.beamRamp[0] === 0.3, aQ.en + " " + JSON.stringify(aQ.beamRamp));
      }
      // v1.94 (queue bundle 7, wiki weapon notes): Trumna / Trumna Prime primary explosion "is unaffected by multishot" and its
      // range "cannot be increased with Firestorm"; Acceltra / Tonkor explosions don't happen inside the minimum arming distance
      {
        const tp = weapon("trumna_prime"), aT = tp.attacks[0], aoeT = (aT.parts || []).find((q) => q.kind === "radial");
        check("v1.94 트럼나 프라임 기본 사격 폭발: 멀티샷·파이어스톰 미적용 (위키)", aoeT && aoeT.noMs && aoeT.fsLock, JSON.stringify({ noMs: aoeT && aoeT.noMs, fs: aoeT && aoeT.fsLock }));
        const KT = ["serration", "split_chamber", "vital_sense", "point_strike"];
        const ac = weapon("acceltra_prime"), aA = ac.attacks[0], ex = (aA.parts || []).find((q) => q.kind === "radial");
        const oN = Object.assign(baseO(), { factions: ["grineer"], scenario: "single", dist: 5 }), oF = Object.assign({}, oN, { dist: 15 });
        const n5 = E.evaluate(ac, aA, KT.map(M), oN).score, n15 = E.evaluate(ac, aA, KT.map(M), oF).score;
        check("v1.94 액셀트라 프라임 최소 폭발 거리 7m: 5m 단일 대상은 폭발 없음(15m보다 느림)", ex && ex.arm === 7 && n5 < n15 * 0.9, (n5 / n15).toFixed(2));
      }
      // v1.84 (independent review 2026-11-06): ① swings pooled with Tennokai heavies decide Melee Influence's "no spread on a
      // one-hit kill" hit by hit — the pooled average (≈10x a swing) one-shot Corpus and Influence did almost nothing there;
      // ② the withhold check climbs single swaps from the #1 under each unverified assumption instead of only re-scoring its list
      {
        const A = window.WF_APP, st = A.st, sv = [st.base, st.weapon, st.atk, st.results];
        const di0 = weapon("dual_ichor"); st.base = di0; st.weapon = A.applyEvos(di0, { 2: 1, 3: 1, 4: 0 }); st.atk = 0;
        const o = Object.assign(A.readOpts(), { targets: null }); st.results = { o };
        const TOPI = ["masters_edge", "galvanized_steel", "blood_rush", "primed_fever_strike", "north_wind", "shocking_touch", "weeping_wounds", "berserker_fury", "condition_overload"];
        const oc = Object.assign({}, o, { factions: ["corpus"] });
        const inf = A.evalBuild(TOPI, null, "melee_influence", oc).score / A.evalBuild(TOPI, null, null, oc).score;
        check("v1.84 텐노카이 섞인 휘두르기: 밀리 인플루언스 전염을 타격마다 판정(코퍼스에서 인플루언스 효과 ×1.25 이상, 이전 ×1.10)", inf > 1.25, inf.toFixed(3));
        let bad = -1;
        try { const bc = typeof A.boundCheck === "function" ? A.boundCheck({ res: [{ ids: TOPI, val: null, arcane: "melee_influence", score: 1 }], o, flags: {} }) : null; bad = bc ? bc.bad.length : -1; } catch (e) { bad = -2; }
        check("v1.84 보류 검사가 1위에서 한 칸 바꾼 세팅도 찾음 (목록이 1개뿐이어도 다른 가정에서 2% 넘게 빠른 이웃이 있으면 보류)", bad > 0, bad);
        // second review: hits before the kill are whole hits (continuous t·r/(1+t·r) made x2 damage score lower), and a pooled
        // Tennokai keeps its own crit (it was scored with the swing's)
        const BRI = ["disciplines_merit", "galvanized_steel", "primed_fever_strike", "vicious_frost", "shocking_touch", "weeping_wounds", "condition_overload", "berserker_fury", "blood_rush"].map(M);
        const oI = Object.assign({}, o, { arcane: "melee_influence", layoutTTK: true });
        const evI = (extra) => E.evaluate(st.weapon, st.weapon.attacks[0], BRI.concat(extra), oI).score;
        const x2 = evI([{ id: "t_dmg", ko: "t", en: "t", slots: ["melee"], eff: { dmg: 1 } }]) / evI([]);
        check("v1.84 피해가 2배면 3팩션 점수가 줄지 않음 (적을 죽이기 전 타격 수는 정수, 이전 ×0.955)", x2 >= 1, x2.toFixed(3));
        const t0 = BRI.slice(1), tA = E.evaluate(st.weapon, st.weapon.attacks[0], t0.concat([{ id: "t_a", ko: "a", en: "a", slots: ["melee"], exilus: true, eff: { tenno: { on: 1, freq: 1.5 } } }]), oI).score;
        const tB = E.evaluate(st.weapon, st.weapon.attacks[0], t0.concat([{ id: "t_b", ko: "b", en: "b", slots: ["melee"], exilus: true, eff: { tenno: { on: 1, freq: 1.5, cd: 0.32 } } }]), oI).score;
        check("v1.84 휘두르기와 섞은 텐노카이도 자기 치명타로 계산 (텐노카이 치명타 피해 +32%가 점수를 올림, 이전 ×1.000)", tB / tA > 1.03, (tB / tA).toFixed(3));
        [st.base, st.weapon, st.atk, st.results] = sv;
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
    // v2.01: Primary Compression on projectile weapons is multiplicative with Serration (wiki note "On projectile weapons, the
    // damage bonus is multiplicative to other damage bonus sources (e.g. Serration)"; effectiveness table: Tonkor (Kuva Tonkor)
    // "Multiplies") — adding Serration must scale the shot by 2.65, not (1 + 1.65 + 5.6) / (1 + 5.6) = 1.25
    {
      const w = weapon("kuva_tonkor"), o = Object.assign(baseO(), { aim: true, arcane: "primary_compression", factions: ["grineer"] });
      const d = (ids) => E.evaluate(w, w.attacks[0], ids.map(M), o).perF.grineer.direct;
      const k = d(["Serration"]) / d([]);
      check("v2.01 프라이머리 컴프레션: 투사체 무기(쿠바 톤코어)는 곱연산 — 서레이션을 넣으면 직격 ×2.65 (합연산이면 ×1.25)", Math.abs(k - 2.65) < 0.06, k.toFixed(3));
    }
    // v2.02: modded magazine capacity rounds to the nearest whole number (wiki Primed Magazine Warp: "For any non-integer magazine
    // values the magazine size is simply rounded to the nearest whole number"). Kuva Tonkor (1 round): Primed Magazine Warp
    // 1.55 -> 2 (arsenal screenshot 2026-11-08 shows 2), Magnetic Capacity 1.4 -> 1
    {
      const w = weapon("kuva_tonkor"), o = baseO();
      const mag = (ids) => { const r = E.evaluate(w, w.attacks[0], ids.map(M), o); return r.ammo ? r.ammo.mag : null; };
      const a = mag(["Primed Magazine Warp"]), b = mag(["Magnetic Capacity"]);
      check("v2.02 탄창 반올림: 쿠바 톤코어 + 프라임드 매거진 워프 = 2발, + 마그네틱 캐퍼시티 = 1발 (위키: 가장 가까운 정수)", a === 2 && b === 1, `PMW ${a} · MC ${b}`);
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
    // v1.85 (묶음 5, 2026-11-06 22시): Nataruk reload — wiki data Reload 0.6 vs game data 0.05; bow cadence 1/(charge + reload)
    // flips the #1 (both-ends run) → every Nataruk attack (Perfect Shot too) is withheld until the Arsenal value is known. The old
    // punch-through gap is handled (INF_BODY_PT), so it no longer withholds by itself.
    {
      const g = weapon("nataruk").gaps || [];
      check("v1.85 나타루크 재장전 0.6/0.05 미확정 → 모든 공격 추천 보류 (관통 항목은 처리됨)", g.some((x) => x.cat === "all") && !g.some((x) => x.type === "punch-through-rule"), JSON.stringify(g.map((x) => x.cat + ":" + x.type)));
    }
    // v1.90 (버스튼 프라임 질문 2026-11-07): Reaver's Rapture "On Full Burst Hit: +20% Damage, resets on Reload", "Caps at 5x",
    // "cannot be stacked in Incarnon form" was a flat +100% on both forms; Forceful Finality "+5 Base Multishot on final magazine
    // burst" ("added before mods") was left out; auto evolutions were picked with no mods (Reaver's Rapture over Absolute Valor)
    {
      const A = window.WF_APP, st = A.st, w0 = weapon("burston_prime"), o = baseO();
      const ev = (sel, ai, mods) => { const w = A.applyEvos(w0, sel); return E.evaluate(w, w.attacks[ai], mods || [], o); };
      const riv = { id: "__riven", eff: { cd: 1.466, cc: 1.701, tox: 0.957, mag: -0.432 } };
      const rA = ev({ 2: 1, 3: 2, 4: 0 }, 1), rB = ev({ 2: 1, 3: 2, 4: 0 }, 1, [riv]), rI = ev({ 2: 1, 3: 2, 4: 0 }, 0);
      check("v1.90 버스튼 리버즈 랩처: 탄창 45발 = 점사 15번 → 평균 4중첩(+80%), 탄창 −43.2% = 26발(점사 8번 + 2발) → 발마다 평균 (3×25 + 2×5)/26중첩, 인카논 형태 미적용", Math.abs(rA.dmgb - 0.8) < 1e-6 && Math.abs(rB.dmgb - 0.2 * 85 / 26) < 1e-6 && rI.dmgb === 0, [rA.dmgb, rB.dmgb, rI.dmgb].join(" / "));
      // v1.90 독립 검토: 3의 배수가 아닌 탄창은 마지막 점사가 1~2발 — 마지막 점사 멀티샷 +5는 그 발에만 (위키 Burston Prime 팁)
      const mR = ev({ 2: 0, 3: 2, 4: 1 }, 1, [riv]).ms;
      check("v1.90 포스풀 피날리티 + 탄창 26발: 마지막 점사는 2발 → 발마다 평균 멀티샷 1 + 5×2/26", Math.abs(mR - (1 + 10 / 26)) < 1e-6, mR);
      const mF = ev({ 2: 0, 3: 2, 4: 1 }, 1).ms, mS = ev({ 2: 1, 3: 2, 4: 1 }, 1).ms, mI = ev({ 2: 0, 3: 2, 4: 1 }, 0).ms;
      check("v1.90 버스튼 포스풀 피날리티: 마지막 점사 기본 멀티샷 +5 → 점사 15번 평균 ×1.333 (포트리스 샐보·인카논 형태는 1)", Math.abs(mF - 4 / 3) < 1e-6 && mS === 1 && mI === 1, [mF, mS, mI].join(" / "));
      const ids = ["amalgam_serration", "critical_delay", "primed_cryo_rounds", "vile_acceleration", "galvanized_chamber", "gilded_truth", "vital_sense", "__riven"];
      const keep = { base: st.base, weapon: st.weapon, atk: st.atk, evoSel: st.evoSel, evoManual: st.evoManual, results: st.results };
      st.base = w0; st.evoSel = { 2: 1, 3: 1, 4: 0 }; st.evoManual = {}; st.weapon = A.applyEvos(w0, st.evoSel); st.atk = 1;
      st.results = { o: Object.assign(A.readOpts(), { targets: null }), owned: { eff: riv.eff } };
      const ns = typeof A.betterEvo === "function" ? A.betterEvo({ ids, val: null, arcane: "primary_merciless" }) : null;
      Object.assign(st, keep);
      check("v1.90 자동 진화를 추천 세팅으로 다시 고름: 치명타 세팅이면 진화 IV = 앱솔루트 밸러 (모드 없이 고른 리버즈 랩처 아님)", ns && ns[4] === 1, JSON.stringify(ns));
    }
    // v1.91 (사용자 2026-11-07 "적이 일자로 정렬되어 있을 확률이 얼마나 된다고"): punch-through extra hits came from a flat
    // "2 enemies lined up behind the target" — now from the crowd model (density × body width × mean depth ≈ 0.17)
    {
      const w = weapon("burston_prime"), a = w.attacks.find((q) => q.en === "Normal Attack");
      const rS = E.evaluate(w, a, [M("Primed Shred")], baseO()), rN = E.evaluate(w, a, [], baseO());
      check("v1.91 관통 무리: 프라임드 슈레드(2.2m)로 한 발이 맞히는 적 1.1~1.25명 (줄 선 적 = 밀도 × 몸 폭 × 무리 깊이), 관통 없으면 1명", rS.K > 1.1 && rS.K < 1.25 && rN.K === 1, rS.K.toFixed(3) + " / " + rN.K);
    }
    // v1.92 (사용자 2026-11-07 "헤비 칼리버의 정확도 패널티 … 정확히 얼마나"): Heavy Caliber "+2.97 spread" (wiki rank table, flat
    // degrees on the max deviation) was free in the calculator — now the share of shots that still land on a 0.6 × 1.8 m enemy at
    // 2–20 m falls with the wider cone (Burston Prime 0–8° → 0–10.97°: avg 4° → 5.49°)
    {
      const w = weapon("burston_prime"), a = w.attacks.find((q) => q.en === "Normal Attack");
      const r = E.evaluate(w, a, [M("Heavy Caliber")], baseO()), r0 = E.evaluate(w, a, [M("Serration")], baseO());
      const sg = W.find((x) => x.id === "hek") || W.find((x) => x.cls === "shotgun" && x.attacks[0].spread);
      const rv = E.evaluate(sg, sg.attacks[0], [M("Vicious Spread")], baseO());
      check("v1.92 헤비 칼리버 탄 퍼짐 +2.97°: 버스튼 프라임 맞는 비율 ×0.76 (평균 퍼짐 4° → 5.49°), 서레이션은 1, 비셔스 스프레드도 1 미만", r.accF > 0.70 && r.accF < 0.82 && r0.accF === 1 && rv.accF < 1, [r.accF, r0.accF, sg.id + " " + rv.accF].join(" / "));
    }
    // v1.93 (머솔론 질문 2026-11-07): the "+60% fire rate / crit damage" seen on every Arsenal screenshot (open issue since
    // Kuva Ogris) is the companion's Bond mods — Tenacious Bond "+1.2x" flat final crit multiplier (formula 1 + tier × (crit multi
    // − 1 + final)) and Reinforced Bond "+60% Fire Rate". Burston Prime build A + riven: crit 6.6 → 7.8 (Arsenal 7.8); on by default.
    {
      const mb = (id) => document.querySelector(`#miscbuffs input.mb[value="${id}"]`);
      const G = (window.WF_BUFFS.misc || []).filter((x) => x.gear);
      const w = A.applyEvos(weapon("burston_prime"), { 2: 1, 3: 2, 4: 1 }), a = w.attacks.find((q) => q.en === "Normal Attack");
      const ids = ["Amalgam Serration", "Critical Delay", "Primed Cryo Rounds", "Vile Acceleration", "Galvanized Chamber", "Gilded Truth", "Vital Sense"].map(M)
        .concat([{ id: "__riven", eff: { cd: 1.466, cc: 1.701, tox: 0.957, mag: -0.432 } }]);
      const ext = window.WF_BUFFS.merge(G.map((x) => x.fx(w)));
      const r0 = E.evaluate(w, a, ids, baseO()), r1 = E.evaluate(w, a, ids, Object.assign(baseO(), { ext }));
      const wm = weapon("dual_ichor"), rm0 = E.evaluate(wm, wm.attacks[0], [], baseO()), rm1 = E.evaluate(wm, wm.attacks[0], [], Object.assign(baseO(), { ext: window.WF_BUFFS.merge(G.map((x) => x.fx(wm))) }));
      const ok = G.length === 2 && mb("tenacious_bond") && mb("tenacious_bond").checked && mb("reinforced_bond") && mb("reinforced_bond").checked
        && Math.abs(r0.cd - 6.6) < 0.05 && Math.abs(r1.cd - 7.8) < 0.05 && r1.rate > r0.rate * 1.05 && rm1.cd === rm0.cd && rm1.rate === rm0.rate;
      check("v1.93 동반자 본드 모드(기본 켬): 터네이셔스 본드 치명타 배율 +1.2 (버스튼 빌드 A 6.6 → 7.8 = 아스날), 리인포스드 본드 연사 +60%, 근접은 그대로", ok,
        [G.length, r0.cd.toFixed(2), r1.cd.toFixed(2), (r1.rate / r0.rate).toFixed(3), rm0.cd + "=" + rm1.cd].join(" / "));
    }
    // v2.08 (묶음 18 인카논): Braton Munitions Grit "Multishot consumes ammo … and does +54% Damage" — wiki Braton Prime Incarnon
    // notes: "Damage bonus only applies to shots generated by multishot", "multiplicative to other damage buffs". With n projectiles
    // per shot only (n − 1) get it → average 1 + 0.54 (n − 1) / n (no mods: Munitions Grit's own +20% → n = 1.2 → ×1.09, not ×1.54).
    {
      const w = A.applyEvos(weapon("braton_prime"), { 2: 1, 3: 0, 4: 0 }), a = w.attacks.find((q) => q.en === "Incarnon Form");
      const mods = ["Split Chamber", "Vigilante Armaments"].map(M);
      const r1 = E.evaluate(w, a, mods, baseO()), k0 = E.evaluate(w, a, [], baseO()).evoM, k1 = r1.evoM, dn = r1.inc && r1.inc.drainN;
      const n1 = 1 + 0.2 + 0.9 + 0.6, want1 = 1 + 0.54 * (n1 - 1) / n1;
      check("v2.08 브래튼 무니션즈 그릿 피해 +54%는 멀티샷으로 생긴 탄에만 (모드 없음 ×1.09, 멀티샷 2.7배 ×" + want1.toFixed(2) + "), 인카논 탄은 탄마다 소모(×2.7 빨리 닳음)", k0 != null && Math.abs(k0 - (1 + 0.54 * 0.2 / 1.2)) < 0.01 && Math.abs(k1 - want1) < 0.01 && Math.abs((dn || 0) - n1) < 0.05, [k0, k1, dn].map((x) => x == null ? "없음" : x.toFixed(3)).join(" / "));
    }
    // v1.96 (테넷 글랙시온 질문 2026-11-07): shots per magazine = magazine / AmmoCost — beams use 0.5 ammo per tick (wiki Tenet
    // Glaxion "Consumes 0.5 ammo per tick of damage"), so a 90-round magazine lasts 180 ticks; Primary Plated Round's 10 s covers
    // 10 / (180/12 + 2 s reload) of the cycle (wiki Plated Round: "Double the amount shown for most continuous weapons")
    {
      const tg = weapon("tenet_glaxion"), a0 = tg.attacks[0], o = Object.assign(baseO(), { killRamp: false });
      const r0 = E.evaluate(tg, a0, [], o), rP = E.evaluate(tg, a0, [], Object.assign({}, o, { arcane: "primary_plated_round" }));
      const wantRate = 180 / (180 / 12 + (1 - 0.2) * 0.6 / 2 + 2), wantPl = 15 * Math.sqrt(5 * 90) / 100 * 10 / (180 / 12);
      check("v1.96 빔 탄약 0.5/틱: 테넷 글랙시온 탄창 90 = 180틱 (발 간격·재장전 주기), 연속 사격 플레이티드 라운드 지속 비율 10/15초", Math.abs(r0.rate - wantRate) < 0.05 && Math.abs((rP.dmgb - r0.dmgb) - wantPl) < 0.02,
        "rate " + r0.rate.toFixed(2) + " (기대 " + wantRate.toFixed(2) + "), plated " + (rP.dmgb - r0.dmgb).toFixed(3) + " (기대 " + wantPl.toFixed(3) + ")");
    }
    // v1.96 independent review: game-data magazines counted in shots (wiki counts rounds) must not be divided by AmmoCost again —
    // Twin Grakatas 60 shots (wiki 120 rounds, 2 per shot), Ballistica Prime 8 (32 at 4), Fulmin full auto 60 (wiki magazine 60)
    {
      const shots = (id, en) => { const w = weapon(id), a = w.attacks.find((x) => x.en === en); const c = a.ammoCost != null ? a.ammoCost : a.parts && a.parts[0].ammoCost != null ? a.parts[0].ammoCost : 1; return a.mag / c; };
      const tg = shots("twin_grakatas", "Normal Attack"), bp = shots("ballistica_prime", "Normal Shot"), fu = shots("fulmin", "Full Auto Mode");
      check("v1.98 탄창 단위: 트윈 그라카타 60발·발리스티카 프라임 8발·풀민 자동 60발 (위키 탄창 ÷ 발당 소모)", Math.abs(tg - 60) < 0.5 && Math.abs(bp - 8) < 0.5 && Math.abs(fu - 60) < 0.5, tg + " / " + bp + " / " + fu);
    }
    // v1.96 independent review: Primary Plated Round must follow the same pack assumption as kill stacks — packs start from 0
    // stacks, so Plated gets the partial reload bonus of one pack (wiki "Partial Damage Bonus"); with stacks kept (continuous fire)
    // the bonus covers the whole magazine when it is fired within 10 s (Tenet Glaxion riven build: 252 ticks at ~36/s)
    {
      const tg = weapon("tenet_glaxion"), a0 = tg.attacks[0];
      const riv = A.effFromStats([["cd", 1.485], ["cc", 1.856], ["corrm", 1.114]]);
      const ids = ["__riven", "galvanized_chamber", "primed_cryo_rounds", "malignant_force", "galvanized_aptitude", "magnetic_capacity", "vile_acceleration", "primed_shred"];
      const o0 = Object.assign(baseO(), { val: { type: "heat", pct: 0.6 } });
      const mods = ids.map((id) => id === "__riven" ? { id: "__riven", eff: riv } : M(id));
      const sc = (arc, kr) => E.evaluate(tg, a0, mods, Object.assign({}, o0, { arcane: arc, killRamp: kr })).score;
      const none = E.evaluate(tg, a0, mods, Object.assign({}, o0, { arcane: null, killRamp: false })), pl = E.evaluate(tg, a0, mods, Object.assign({}, o0, { arcane: "primary_plated_round", killRamp: false }));
      const full = 15 * Math.sqrt(5 * 126) / 100;
      check("v1.98 플레이티드 라운드: 무리마다 중첩 0이면 머시리스보다 약함(부분 재장전), 연속 사격이면 탄창 내내 +" + Math.round(full * 100) + "%", sc("primary_merciless") > sc("primary_plated_round") && Math.abs((pl.dmgb - none.dmgb) - full) < 0.03,
        "머시리스/플레이티드 " + (sc("primary_merciless") / sc("primary_plated_round")).toFixed(3) + ", 연속 " + (pl.dmgb - none.dmgb).toFixed(3));
    }
    // v1.96 (사용자 설문 2026-11-02 "리벤 '맞출 예정' 수치는 최대값", 테넷 글랙시온 질문 2026-11-07): plan-mode riven values are the
    // top of the roll range — wiki Riven Mods, Rifle Attribute Ranges, 3 positives + 1 negative: Critical Damage 121.5% — 148.5%
    {
      const v = A.rivPlanVal ? A.rivPlanVal("rifle", "cd", "3+1") : null;
      check("v1.96 리벤 '맞출 예정' = 최대치: 소총 치명타 피해 3긍1부 148.5% (위키 범위 상한)", v != null && Math.abs(v - 1.485) < 0.002, v);
    }
    // v1.97 (묶음 8 레이텀): Secondary/Primary Dexterity — game data "On Melee Kill: +60% Damage for 20s. Stacks up to 6x." The
    // arcane had no stack count, so the pack got the full +360% from the first kill (no ramp like Merciless)
    {
      const w = weapon("laetum"), a = w.attacks[0];
      const o1 = Object.assign(baseO(), { arcane: "secondary_dexterity" }), o2 = Object.assign(baseO(), { arcane: "secondary_dexterity", killRamp: false });
      const ids = ["Hornet Strike", "Lethal Torrent", "Frostbite", "Pistol Pestilence"].map(M);   // no other on-kill stacks
      const s1 = E.evaluate(w, a, ids, o1).score, s2 = E.evaluate(w, a, ids, o2).score;
      check("v1.97 덱스터리티는 6중첩(무리에서 0부터 쌓임) — 처음부터 최대인 것보다 느림", s1 < s2 * 0.97, (s1 / s2).toFixed(3));
    }
    // v1.97 (묶음 8 렉스 프라임): Hemorrhage turns Impact status effects into Slash ones — the Lex Incarnon form's forced Impact
    // proc (wiki "guarantees Impact procs") must roll too: at fire rate 0.67 (< 2.5, x2) that is 0.7 Slash procs per shot
    {
      const w = weapon("lex_prime"), a = w.attacks.find((x) => x.inc), o = baseO();
      const r0 = E.evaluate(w, a, [M("Hornet Strike")], o), r1 = E.evaluate(w, a, [M("Hornet Strike"), M("Hemorrhage")], o);
      const d = ((r1.procs || {}).slash || 0) - ((r0.procs || {}).slash || 0);
      check("v1.97 헤모리지: 렉스 인카논 확정 충격 상태이상도 출혈로 (연사 2.5 미만 x2 → 한 발에 출혈 +0.7 이상)", d >= 0.69, "출혈 +" + d.toFixed(2));
    }
    // v1.95 (세도 프라임 질문 2026-11-07): Cedo's own "+60% bonus damage per unique status effect on target … additive to all base
    // damage bonuses" (wiki) was not in the engine (gaps: handled null), the alt-fire glaive used the buckshot's 7 pellets (wiki
    // attack data Multishot 1), and its explosion's "two separate guaranteed procs" never counted as status types on the target.
    {
      const w = weapon("cedo_prime"), a1 = w.attacks.find((q) => q.en === "Normal Attack"), a0 = w.attacks.find((q) => q.en === "Normal Attack+primer");
      const ms = ["Primed Chilling Grasp", "Toxic Barrage", "Critical Deceleration", "Primed Ravage"].map(M), o = Object.assign(baseO(), { kills: false });
      const r1 = E.evaluate(w, a1, ms, o), r0 = E.evaluate(w, a0, ms, o);
      const glaive = w.attacks.find((q) => q.en === "Alt-Fire Glaive");
      const ok = a1.pst === 0.6 && Math.abs(r1.gco - 0.6 * r1.ntypes) < 1e-6 && r1.ntypes > 0.5 && glaive.pellets === 1 && a0 && a0.primer.pellets === 1 && a0.primerAoe && r0.ntypes > r1.ntypes + 1 && r0.score > r1.score * 1.3;
      check("v1.95 세도: 기본 사격 상태이상 종류당 +60%(기본 피해 합연산), 글레이브 1개(멀티샷 1), 글레이브 폭발 확정 상태이상 2개가 종류 수에 들어감", ok,
        [a1.pst, r1.gco && r1.gco.toFixed(2), r1.ntypes.toFixed(2), r0.ntypes.toFixed(2), glaive.pellets, (r0.score / r1.score).toFixed(2)].join(" / "));
    }
    // v1.95 independent review (2026-11-07): the glaive's procs must also feed status-triggered arcanes (Primary Frostbite "On Cold
    // Status Effect") — the viral layout (no cold on the main fire) had 0 stacks — and the explosion's procs are the 2 guaranteed
    // ones, not its 50% status chance
    {
      const w = weapon("cedo_prime"), a0 = w.attacks.find((q) => q.en === "Normal Attack+primer"), gx = w.attacks.find((q) => q.en === "Glaive Radial Attack");
      const ms = ["Primed Chilling Grasp", "Toxic Barrage", "Critical Deceleration", "Primed Ravage"].map(M);
      const o = Object.assign(baseO(), { arcane: "primary_frostbite", elemOrder: ["cold", "tox"] });
      const r = E.evaluate(w, a0, ms, o), rx = E.evaluate(w, gx, [], baseO());
      const pt = Object.values(rx.procs || {}).reduce((q, v) => q + v, 0);
      check("v1.95 세도 글레이브 상태이상이 프라이머리 프로스트바이트 중첩에도 들어감(바이러스 배치에서 0 → 쌓임), 글레이브 폭발 상태이상 = 확정 2개", gx.explProcs === 2 && r.fArc > 0.5 && Math.abs(pt - 2) < 1e-6,
        [gx.explProcs, r.fArc && r.fArc.toFixed(2), pt.toFixed(2)].join(" / "));
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
    results.push({ name: "v1.56 킷건 세팅 A (캐스케디아 플레어) 커럽티드 강철의 길 150 20명 < 12초 (v1.87 정수 발·처치 후 간격: 4.5초 → 9.8초, 옛 롤링 창 버그는 같은 계산에서 약 1.7배)", ok: !r.err && r.clear < 12, detail: r.err || r.clear.toFixed(2) + "초" });
    await p2.close();
  }

  // v1.99: Secondary Irradiate spread only on hits that find 10 Radiation stacks already on the target. Kitgun Catchmoon
  // (innate heat + Primed Convulsion = Radiation, 0.4 procs a shot) one-shots Corpus up to Lv358, so a target never reaches
  // 10 stacks — before, the 12-second steady state made every hit spread (Irradiate x8.3 over no arcane, x4.8 over Merciless).
  {
    const p3 = await ctx.newPage();
    p3.on("pageerror", (e) => errs.push(e.message));
    await p3.addInitScript(() => { try { localStorage.setItem("wfopt2", JSON.stringify({ mod: ["kit_secondary", "Catchmoon", "Haymaker", "Splat"] })); } catch (e) {} });
    await p3.goto("file://" + path.resolve(__dirname, "..", "index.html"));
    await p3.waitForFunction(() => window.WFEngine && window.WF_APP);
    const r = await p3.evaluate(() => {
      const A = window.WF_APP, E = window.WFEngine;
      if (!A.st.weapon.modular) return { err: "kitgun not loaded" };
      const en = (n) => window.WF_MODS.find((x) => x.en === n).id;
      const ids = ["Galvanized Diffusion", "Primed Convulsion", "Hornet Strike", "Lethal Torrent", "Primed Pistol Gambit", "Primed Target Cracker", "Magnum Force", "Anemic Agility"].map(en);
      const o = Object.assign(A.readOpts(), { factions: ["corpus"], targets: null, val: null });
      o.targets = E.targetsFor(o); A.st.results = { o };
      const sc = (arc) => A.evalBuild(ids, null, arc, Object.assign({}, o, { arcane: arc }), null).score;
      return { k: sc("secondary_irradiate") / sc(null) };
    });
    results.push({ name: "v1.99 이레디에이트: 한두 발에 죽는 표적(캐치문 코퍼스)은 방사능 10중첩 전에 죽어 퍼짐이 거의 없음 — 아케인 없음의 1.5배 미만", ok: !r.err && r.k < 1.5, detail: r.err || "×" + r.k.toFixed(2) });
    await p3.close();
  }

  // v2.00: wiki Sancti Castanas "Guaranteed Electricity proc scales with Electricity mods regardless if they combine with other
  // elements as Corrosive, Radiation, or Magnetic" — with Pathogen Rounds (innate Electricity + Toxin = Corrosive) the forced
  // Electricity procs of the embedded detonation still take Convulsion's +90%
  {
    const p3 = await ctx.newPage();
    p3.on("pageerror", (e) => errs.push(e.message));
    await p3.goto("file://" + path.resolve(__dirname, "..", "index.html"));
    await p3.waitForFunction(() => window.WFEngine && window.WF_APP);
    const r = await p3.evaluate(() => {
      const A = window.WF_APP, E = window.WFEngine, w = window.WF_WEAPONS.find((x) => x.id === "sancti_castanas");
      if (!w) return { err: "no Sancti Castanas" };
      const ai = w.attacks.findIndex((a) => a.en === "Embedded Detonation");
      A.st.base = w; A.st.weapon = w; A.st.atk = ai;
      const o = Object.assign(A.readOpts(), { targets: null, val: null }); o.targets = E.targetsFor(o); A.st.results = { o };
      const en = (n) => window.WF_MODS.find((x) => x.en === n).id;
      const ids = ["Pathogen Rounds", "Convulsion", "Primed Heated Charge", "Hornet Strike", "Galvanized Diffusion", "Primed Pistol Gambit", "Primed Target Cracker", "Lethal Torrent"].map(en);
      const sc = () => A.evalBuild(ids, null, null, Object.assign({}, o, { arcane: null }), null).score;
      const s1 = sc(), fs = w.forcedScale; delete w.forcedScale; const s0 = sc(); if (fs) w.forcedScale = fs;
      return { k: s1 / s0, fs: !!fs };
    });
    results.push({ name: "v2.00 생티 캐스타나스 확정 전기 상태이상: 전기가 부식으로 합쳐져도 전기 모드 보너스 적용 (부착 폭발 점수가 미적용보다 5% 넘게 높음)", ok: !r.err && r.fs && r.k > 1.05, detail: r.err || "×" + r.k.toFixed(3) });
    await p3.close();
  }

  // v2.03: wiki Tatsu Prime "Heavy attacks with this weapon have a guaranteed Slash proc." — the heavy attack (built from the
  // normal attack's split) must carry the forced Slash, and with the combo-scaled bleed it must raise the heavy-attack score
  {
    const p3 = await ctx.newPage();
    p3.on("pageerror", (e) => errs.push(e.message));
    await p3.goto("file://" + path.resolve(__dirname, "..", "index.html"));
    await p3.waitForFunction(() => window.WFEngine && window.WF_APP);
    const r = await p3.evaluate(() => {
      const A = window.WF_APP, E = window.WFEngine, w = window.WF_WEAPONS.find((x) => x.id === "tatsu_prime");
      if (!w) return { err: "no Tatsu Prime" };
      const ai = w.attacks.findIndex((a) => a.en === "Heavy Attack"), atk = w.attacks[ai];
      A.st.base = w; A.st.weapon = w; A.st.atk = ai;
      const o = Object.assign(A.readOpts(), { targets: null, val: null }); o.targets = E.targetsFor(o); A.st.results = { o };
      const en = (n) => window.WF_MODS.find((x) => x.en === n).id;
      const ids = ["Condition Overload", "Blood Rush", "Weeping Wounds", "Amalgam Organ Shatter", "Sacrificial Steel", "Gladiator Might", "Reflex Coil", "Primed Pressure Point"].map(en);
      const sc = () => A.evalBuild(ids, null, null, Object.assign({}, o, { arcane: null }), null).score;
      const forced = (atk.forced || []).slice(), s1 = sc(); atk.forced = forced.filter((x) => x !== "slash"); const s0 = sc(); atk.forced = forced.length ? forced : undefined;
      return { has: forced.includes("slash"), k: s1 / s0 };
    });
    results.push({ name: "v2.03 타츠 프라임 강공 확정 베기 상태이상(위키) — 강공 데이터에 있고 점수를 올림", ok: !r.err && r.has && r.k > 1.02, detail: r.err || JSON.stringify(r) });
    await p3.close();
  }

  // v2.04: (1) Galariak Prime's wiki "Heavy Slam Attack" holds the direct value (1170 = game heavySlamAttack) where the other
  // 219 melee weapons hold the radial one (game heavySlamRadialDamage, 702 here) — the AoE attack must use the radial value.
  // (2) Seismic Wave "+200% Slam Attack Damage" (Mods.json) is its own multiplier — wiki Arca Titron: Slam Capacitor "is
  // multiplicative to Seismic Wave and the Nira's Set bonus, and additive to base damage (e.g. Pressure Point …)"; wiki Jat
  // Kusar: the heavy explosion "is treated as Slam Radial Damage and its damage can only be increased with Seismic Wave".
  {
    const p3 = await ctx.newPage();
    p3.on("pageerror", (e) => errs.push(e.message));
    await p3.goto("file://" + path.resolve(__dirname, "..", "index.html"));
    await p3.waitForFunction(() => window.WFEngine && window.WF_APP);
    const r = await p3.evaluate(() => {
      const A = window.WF_APP, E = window.WFEngine, W = window.WF_WEAPONS;
      const slamOf = (id) => { const w = W.find((x) => x.id === id); return w && w.attacks.find((a) => a.en === "Heavy Slam Attack"); };
      const tot = (a) => a ? Object.values(a.dmg).reduce((s, v) => s + v, 0) : NaN;
      const out = { gal: tot(slamOf("galariak_prime")), mag: tot(slamOf("sancti_magistar")) };
      const sw = window.WF_MODS.find((x) => x.en === "Seismic Wave");
      out.sw = !!sw && !sw.noCalc && sw.eff && sw.eff.slamDmg;
      const w = W.find((x) => x.id === "sancti_magistar"), ai = w.attacks.findIndex((a) => a.en === "Heavy Slam Attack");
      A.st.base = w; A.st.weapon = w; A.st.atk = ai;
      const o = Object.assign(A.readOpts(), { targets: null, val: null }); o.targets = E.targetsFor(o); A.st.results = { o };
      const en = (n) => (window.WF_MODS.find((x) => x.en === n) || {}).id;
      const base = ["Primed Pressure Point", "Primed Fever Strike", "Sacrificial Steel", "Blood Rush", "Organ Shatter", "Corrupt Charge", "Galvanized Reflex"].map(en);
      const sc = (ids) => A.evalBuild(ids, null, null, Object.assign({}, o, { arcane: null }), null).score;
      out.k = sw ? sc(base.concat([sw.id])) / sc(base.concat([en("Gladiator Might")])) : 0;
      return out;
    }).catch((e) => ({ err: e.message }));
    results.push({ name: "v2.04 갈라리아크 프라임 강한 내려찍기 범위 피해 = 게임 데이터 702 (위키 데이터의 1170은 직격 값), 생티 마기스타 720", ok: !r.err && Math.abs(r.gal - 702) < 1 && Math.abs(r.mag - 720) < 1, detail: r.err || JSON.stringify({ gal: r.gal, mag: r.mag }) });
    results.push({ name: "v2.04 세이스믹 웨이브 슬램 피해 +200%(별도 배율) — 생티 마기스타 강한 내려찍기에서 글래디에이터 마이트 자리보다 1.3배 넘게 빠름", ok: !r.err && r.sw === 2 && r.k > 1.3, detail: r.err || JSON.stringify({ sw: r.sw, k: r.k }) });
    await p3.close();
  }

  // v2.05: Galariak Prime (wiki): "Gains a flat +10% Critical Chance bonus per unique Status Effect type on the target hit"
  // (Blast is not in the wiki's list of valid types) — every attack carries ccType 0.1 and it must raise a crit build's score
  {
    const p3 = await ctx.newPage();
    p3.on("pageerror", (e) => errs.push(e.message));
    await p3.goto("file://" + path.resolve(__dirname, "..", "index.html"));
    await p3.waitForFunction(() => window.WFEngine && window.WF_APP);
    const r = await p3.evaluate(() => {
      const A = window.WF_APP, E = window.WFEngine, W = window.WF_WEAPONS;
      const w = W.find((x) => x.id === "galariak_prime"); if (!w) return { err: "galariak_prime 없음" };
      const all = w.attacks.every((a) => a.ccType === 0.1);
      // single target (boss scenario): a crowd heavy slam kills on its first hit, which sees no statuses yet (first0)
      const ai = w.attacks.findIndex((a) => a.en === "Normal Attack");
      A.st.base = w; A.st.weapon = w; A.st.atk = ai;
      const o = Object.assign(A.readOpts(), { targets: null, val: null, scenario: "boss" }); o.targets = E.targetsFor(o); A.st.results = { o };
      const en = (n) => (window.WF_MODS.find((x) => x.en === n) || {}).id;
      const ids = ["Primed Pressure Point", "Primed Fever Strike", "Sacrificial Steel", "Blood Rush", "Organ Shatter", "North Wind", "Gladiator Might", "Shocking Touch"].map(en);
      const sc = () => A.evalBuild(ids, null, null, Object.assign({}, o, { arcane: null }), null).score;
      const on = sc(); const keep = w.attacks.map((a) => a.ccType); w.attacks.forEach((a) => delete a.ccType); const off = sc(); w.attacks.forEach((a, i) => { a.ccType = keep[i]; });
      return { all, k: on / off };
    }).catch((e) => ({ err: e.message }));
    results.push({ name: "v2.05 갈라리아크 프라임 고유 효과(상태이상 종류당 치명타 +10%) — 모든 공격에 있고 단일 대상(보스) 치명타 세팅 점수를 1.05배 넘게 올림", ok: !r.err && r.all && r.k > 1.05, detail: r.err || JSON.stringify(r) });
    await p3.close();
  }

  // v2.06: an attack striking Keff enemies also strikes the pack around the heavy/Eximus while they are worked on. Xoris charged
  // throw (9 m) + Volatile Quick Return (+3 m, game Mods.json) covers the whole 12-enemy pack — before, the heavy and the Eximus
  // were separate engagements plus a fresh sweep of the lights, and VQR in place of Voltaic Strike scored 0.77 (every read
  // Xoris build runs VQR, batch 15). Without Melee Influence too (no spread path involved).
  {
    const p3 = await ctx.newPage();
    p3.on("pageerror", (e) => errs.push(e.message));
    await p3.goto("file://" + path.resolve(__dirname, "..", "index.html"));
    await p3.waitForFunction(() => window.WFEngine && window.WF_APP);
    const r = await p3.evaluate(() => {
      const A = window.WF_APP, E = window.WFEngine, w = window.WF_WEAPONS.find((x) => x.id === "xoris"); if (!w) return { err: "xoris 없음" };
      A.st.base = w; A.st.weapon = w; A.st.atk = 0;
      const o = Object.assign(A.readOpts(), { targets: null, val: null }); o.targets = E.targetsFor(o); A.st.results = { o };
      const en = (n) => (window.WF_MODS.find((x) => x.en === n) || {}).id;
      const base = ["Galvanized Reflex", "Killing Blow", "Galvanized Steel", "Melee Elementalist", "Whirlwind", "Shocking Touch", "Amalgam Organ Shatter", "Primed Pressure Point"].map(en);
      const sc = (last, arc) => A.evalBuild(base.concat([en(last)]), null, arc, Object.assign({}, o, { arcane: arc }), null).score;
      return { infl: sc("Volatile Quick Return", "melee_influence") / sc("Voltaic Strike", "melee_influence"), none: sc("Volatile Quick Return", null) / sc("Voltaic Strike", null) };
    }).catch((e) => ({ err: e.message }));
    results.push({ name: "v2.06 무리 전체를 덮는 폭발은 중장갑·엑시무스를 칠 때 주변 적도 같이 처치 — 조리스 볼래틸 퀵 리턴(+3m)이 볼택 스트라이크보다 셈(인플루언스·아케인 없음 둘 다)", ok: !r.err && r.infl > 1.05 && r.none > 1.05, detail: r.err || JSON.stringify(r) });
    await p3.close();
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
      // (v1.84: with Melee Influence the swings' spread now clears this pack before the field matters — checked with Duplicate)
      out.fieldLo = A.evalBuild(INF, null, "melee_duplicate", o5).score;
      out.fieldHi = A.evalBuild(INF, null, "melee_duplicate", Object.assign({}, o5, { fieldHigh: true })).score;
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
    results.push({ name: "v1.73 듀얼 이코르 처치 시 독 장판 계산됨 (1초마다 가정 > 한 번 가정, Lv150 강철의 길 아님, 밀리 듀플리케이트)", ok: !r.err && r.fieldHi > r.fieldLo * 1.05, detail: r.err || "×" + f2(r.fieldHi / r.fieldLo) });
    results.push({ name: "v1.75 (민감도) 강공 연속기 배율을 상태이상에서 빼면 듀얼 이코르 인플루언스 세팅이 듀플리케이트·폭발 세팅보다 빠름 — 그래서 게임 확인이 필요했음", ok: !r.err && r.ncsRatio > 1.2, detail: r.err || "×" + f2(r.ncsRatio) });
    results.push({ name: "v1.78 연속기 배율은 상태이상에도 곱해짐(게임 확인: 12배 강공 출혈 1.3K, 인카논 3배 641) — 앱이 이 가정으로 추천을 보류하지 않음", ok: !r.err && r.comboAlt === false, detail: r.err || String(r.comboAlt) });
    // v1.89 (사용자 결정 2026-11-07 "보류같은거 하지마"): open wiki gaps / unconfirmed assumptions no longer replace the
    // recommendation — the #1 still renders, with the gaps as a note above it
    {
      const ui = await p3.evaluate(() => {
        const A = window.WF_APP, st = A.st, w0 = window.WF_WEAPONS.find((x) => x.id === "nataruk");
        st.base = w0; st.weapon = w0; st.atk = A.defaultAttack(w0);
        const o = Object.assign(A.readOpts(), { targets: null });
        st.results = { res: [{ ids: ["serration", "split_chamber", "vital_sense", "point_strike"], val: null, arcane: null, score: 1 }], o, flags: {} };
        A.renderResults();
        const h = document.querySelector("#results").innerHTML;
        return { gaps: (w0.gaps || []).length, withheld: /추천 보류 —/.test(h), table: /서레이션|세레이션/.test(h) && /참고 — 계산에 아직 없는 메커니즘/.test(h) };
      }).catch((e) => ({ err: e.message }));
      results.push({ name: "v1.89 위키 메커니즘이 남은 무기(나타루크)도 추천을 보류하지 않고 1위 + 참고 메모를 보여 줌", ok: !ui.err && ui.gaps > 0 && !ui.withheld && ui.table, detail: ui.err || JSON.stringify(ui) });
    }
    await p3.close();
  }

  // v2.07: Exalted Blade energy waves (wiki Exalted Blade: "same base damage as the attacks that release them", "will both deal
  // damage separately", 3 m wide, punch through, −20% per enemy hit, falloff 0–70 m). The normal swing must carry a wave part, the
  // wave must strike more than the target in a crowd, and a read community build (HighGround Umbra) must score over 1.5x without it.
  {
    const p3 = await ctx.newPage();
    p3.on("pageerror", (e) => errs.push(e.message));
    await p3.goto("file://" + path.resolve(__dirname, "..", "index.html"));
    await p3.waitForFunction(() => window.WFEngine && window.WF_APP);
    const r = await p3.evaluate(() => {
      const A = window.WF_APP, E = window.WFEngine, W = window.WF_WEAPONS;
      const w = W.find((x) => x.id === "exalted_umbra_blade"); if (!w) return { err: "exalted_umbra_blade 없음" };
      const atk = w.attacks[0], wv = (atk.parts || []).find((x) => x.wave);
      if (!wv) return { err: "검기 부분 없음" };
      A.st.base = w; A.st.weapon = w; A.st.atk = 0;
      const o = Object.assign(A.readOpts(), { targets: null, val: null, arcane: null }); o.targets = E.targetsFor(o); A.st.results = { o };
      const en = (n) => (window.WF_MODS.find((x) => x.en === n) || {}).id;
      const ids = ["Sacrificial Steel", "Sacrificial Pressure", "Shocking Touch", "Fever Strike", "Condition Overload", "Organ Shatter", "Gladiator Might", "Gladiator Vice"].map(en);
      const on = A.evalBuild(ids, null, null, o, null).score;
      const keep = atk.parts; delete atk.parts; const off = A.evalBuild(ids, null, null, o, null).score; atk.parts = keep;
      return { k: on / off, wave: wv.wave };
    }).catch((e) => ({ err: e.message }));
    results.push({ name: "v2.07 익절티드 블레이드 검기(에너지 웨이브)가 휘두르기와 따로 피해 — 엄브라 HighGround 세팅이 검기 없을 때의 1.5배 넘음", ok: !r.err && r.k > 1.5, detail: r.err || JSON.stringify(r) });
    await p3.close();
  }

  // v1.96: every plan-mode riven multiplier in app.js goes through RIV_PLAN_W (only the displayed 0.9–1.1 range may skip it)
  {
    const src = require("fs").readFileSync(path.resolve(__dirname, "..", "src", "app.js"), "utf8");
    const bare = src.split("\n").filter((l) => /1\.2 \* (Math\.abs\()?RIV_FORM/.test(l) && !/rangeTxt/.test(l));
    results.push({ name: "v1.96 앱의 '맞출 예정' 리벤 배율이 모두 RIV_PLAN_W(최대치)를 거침", ok: bare.length === 0, detail: bare.map((l) => l.trim().slice(0, 60)).join(" | ") });
    const plan = src.slice(src.indexOf("function planRivenPhase"), src.indexOf("/* ---------------- evaluation helpers"));
    results.push({ name: "v1.98 '처음부터 리벤 전제' 세팅은 베일런스·아케인도 다시 고름 (테넷 글랙시온: 리벤 없으면 플레이티드+화염, 리벤 넣으면 머시리스+자성)", ok: /valOptions: valOptions\(\), arcOptions: arcOptions\(\)/.test(plan) && !/valOptions: \[top0\.val\]/.test(plan) });
  }
  let fail = 0;
  for (const r of results) { console.log((r.ok ? "PASS " : "FAIL ") + r.name + (r.detail ? "  (" + r.detail + ")" : "")); if (!r.ok) fail++; }
  if (errs.length) { console.log("PAGE ERRORS", errs); fail++; }
  await b.close();
  console.log(fail ? `\n${fail} 실패` : "\n모두 통과");
  process.exit(fail ? 1 : 0);
})();
