/* Warframe build optimizer — damage engine v2 (time-to-kill scoring).
 * Sources: wiki.warframe.com (Oct 2026). Key mechanics:
 *  - Elements combine in mod order (top-left → bottom-right); Violet-shard electricity combines like a mod
 *    (joins an electricity mod, else after the mods); innate elements + valence last, in H→C→E→T order.
 *    Ability elements (Electric Shield, Toxic Lash, Xata's Whisper, Nourish) never combine.
 *  - Status DoT tick = 0.5*MBD*(1+matching elemental mod)*(1+status dmg)*crit*faction; Slash 0.35*MBD ignores armor.
 *  - Electricity DoT hits all enemies within 3m; Gas cloud 3m (+0.3m/stack, max 6m).
 *  - Blast: 0.3*MBD per proc on the target after 1.5s.
 *  - Viral x2 then +25%/stack to x4.25 (health only); Corrosive 20%+6%/stack (max 80%); Heat -50% armor.
 *  - Cold: flat +0.1 crit damage first stack, +0.05/stack, +0.5 at 9 stacks, +1.0 while frozen at 10 (wiki Cold Damage).
 *  - Armor DR = 0.9*sqrt(A/2700), A capped at 2700; Steel Path: health/shields x2.5, armor unchanged.
 *  - Enemy level scaling (wiki, community-measured): f1 below +70 levels, f2 above +80, smoothstep between.
 *  - Heavy attacks: combo multiplier floor(combo/20)+1; crit-chance mods doubled; melee swings assume 12x combo.
 *  - Galvanized Aptitude/Savvy/Shot & Condition Overload: +X% direct damage per status type on target.
 *  - Toxin and Slash DoT bypass shields.
 */
(function (root) {
  "use strict";
  const PRIM = ["heat", "cold", "elec", "tox"];
  const COMBO = {
    "heat|cold": "blast", "cold|heat": "blast", "heat|tox": "gas", "tox|heat": "gas",
    "heat|elec": "rad", "elec|heat": "rad", "cold|elec": "mag", "elec|cold": "mag",
    "cold|tox": "viral", "tox|cold": "viral", "elec|tox": "corr", "tox|elec": "corr",
  };
  const PHYS = ["impact", "punct", "slash"];
  const FACTIONS = {
    grineer: { weak: ["impact", "corr"], label: "그리니어", hp: "grineer" },
    corpus: { weak: ["punct", "mag"], label: "코퍼스", hp: "corpus" },
    infested: { weak: ["slash", "heat"], label: "인페스티드", hp: "infested" },
    corrupted: { weak: ["punct", "viral"], label: "커럽티드", hp: "corrupted" },
    murmur: { weak: ["elec", "rad"], label: "머머(속삭임)", hp: "murmur" },
  };
  const DOT_TYPES = ["heat", "tox", "elec", "gas", "slash"];
  // elements Melee Influence spreads (wiki: "melee elemental status effects"; physical procs spread nothing)
  const SPREAD_EL = ["heat", "cold", "elec", "tox", "blast", "rad", "gas", "mag", "viral", "corr"];
  const DOT_DELAY = { heat: 1, tox: 1, slash: 1 };     // seconds before the first tick (wiki "Damage over Time")
  const PROC_WIN = { blast: 1.5, corr: 8, rad: 12, impact: 6 };
  const ARMOR_CAP = 2700;
  // crowd geometry: enemies lined up behind the one you shoot ~ Poisson(2); a humanoid body uses ~0.6 m of punch through
  // (wiki "Punch Through": 0.6 m passes a humanoid, 1.0 m a quadruped). Re-aiming to the next target takes ~0.2 s.
  const LINE_MEAN = 2, BODY_PT = 0.6, BODY_W = 0.6, T_ACQ = 0.2;
  // Enemies lined up behind the target (punch-through extra hits). Was a flat LINE_MEAN = 2 with no basis; v1.91 (user 2026-11-07:
  // "how often are enemies lined up in a row in game?") derives it from the crowd model itself: a bullet past the target meets the
  // enemies whose centre lies within half a body width of its line, so the mean is density × body width (BODY_W) × the mean depth
  // of the crowd behind a target (8R / 3π for a uniform disc of radius R holding the crowd) — 12 enemies at 6 per 7.9 m radius
  // → about 0.17. o.lineMean overrides it (corridor fights, sensitivity checks).
  // Spread → share of shots that land on an enemy (v1.92). Wiki Accuracy: spread is "an angle in degrees from the reticle",
  // "Base Accuracy = 100 / Avg Spread" with Avg = (Min + Max) / 2; accuracy-lowering mods add spread (Heavy Caliber "+2.97 spread"
  // at rank 10, flat, added after accuracy mods: "5.0 × (1 − 40%) + 2.97"; Vicious Spread +60% of the cone). Not on the wiki and
  // assumed here: shots spread evenly over the disc of that radius, an enemy is a 0.6 m × 1.8 m body (BODY_W), distances 2–20 m
  // like the rest of the model. Only the CHANGE a mod makes is applied (hit share with the mod / without), so weapons without such
  // mods are unchanged.
  const stripHit = (a, r) => { if (r <= a) return 1; const u = a / r; return (2 / Math.PI) * (Math.asin(u) + u * Math.sqrt(1 - u * u)); };
  function hitShare(deg) {
    const t = Math.tan(Math.max(0, deg) * Math.PI / 180); let s = 0, n = 0;
    for (let d = 2; d <= 20.0001; d += 0.5) { const r = d * t; s += r <= 1e-9 ? 1 : stripHit(BODY_W / 2, r) * stripHit(0.9, r); n++; }
    return s / n;
  }
  function lineHits(cap, mean) {     // expected extra enemies hit = E[min(n, cap)], n ~ Poisson(mean)
    const mu = mean != null ? mean : LINE_MEAN;
    let p = Math.exp(-mu), e = 0;
    for (let n = 1; n < 30; n++) { p *= mu / n; e += p * Math.min(n, cap); }
    return e;
  }

  /* ---------- enemy scaling ---------- */
  // wiki renders the f2 coefficients as "2455", "3055", "3655": these are 24√5/5, 30√5/5, 36√5/5
  // (the pre-Update 36 formula used the same 24√5/5 ≈ 10.73 with exponent 0.5)
  const R5 = Math.sqrt(5) / 5;
  const HP_SCALE = {
    grineer: [0.015, 2.12, 24 * R5, 0.72], corpus: [0.015, 2.12, 30 * R5, 0.55], infested: [0.0225, 2.12, 36 * R5, 0.72],
    corrupted: [0.015, 2.1, 24 * R5, 0.685], murmur: [0.015, 2, 24 * R5, 0.5],
  };
  const SH_SCALE = [0.02, 1.76, 2.0, 0.76];
  const AR_SCALE = [0.005, 1.75, 0.4, 0.75];
  function blend(d, c) {
    const f1 = 1 + c[0] * Math.pow(Math.max(0, d), c[1]);
    const f2 = 1 + c[2] * Math.pow(Math.max(0, d), c[3]);
    if (d <= 70) return f1;
    if (d >= 80) return f2;
    const t = (d - 70) / 10, s = 3 * t * t - 2 * t * t * t;
    return f1 * (1 - s) + f2 * s;
  }
  // archetypes: [base level, health, armor, shields]
  const UNITS = {
    grineer: { light: { ko: "랜서", lv: 1, hp: 100, ar: 100, sh: 0 }, heavy: { ko: "헤비 거너", lv: 8, hp: 300, ar: 500, sh: 0 } },
    corpus: { light: { ko: "크루맨", lv: 1, hp: 60, ar: 0, sh: 150 }, heavy: { ko: "테크", lv: 15, hp: 350, ar: 0, sh: 250 } },
    infested: { light: { ko: "차저", lv: 1, hp: 80, ar: 0, sh: 0 }, heavy: { ko: "에인션트", lv: 1, hp: 400, ar: 0, sh: 0 } },
    corrupted: { light: { ko: "커럽티드 랜서", lv: 1, hp: 60, ar: 200, sh: 0 }, heavy: { ko: "커럽티드 헤비 거너", lv: 8, hp: 300, ar: 500, sh: 0 } },
    murmur: { light: { ko: "머머 경보병(추정)", lv: 1, hp: 150, ar: 0, sh: 0 }, heavy: { ko: "머머 중보병(추정)", lv: 1, hp: 800, ar: 0, sh: 0 } },
  };
  // Eximus overguard (wiki "Enemy Level Scaling", community-measured): base 12 × multiplier, smoothstep 45–50
  function overguardAt(level) {
    const d = Math.max(0, level - 1);
    const f1 = 1 + 0.0015 * Math.pow(d, 4), f2 = 1 + 260 * Math.pow(d, 0.9);
    if (d < 45) return 12 * f1;
    if (d > 50) return 12 * f2;
    const t = (d - 45) / 5, s = 3 * t * t - 2 * t * t * t;
    return 12 * (f1 * (1 - s) + f2 * s);
  }
  function enemyStats(faction, tier, level, steel) {
    const u = UNITS[faction][tier === "boss" ? "heavy" : tier];
    const d = Math.max(0, level - u.lv);
    let hp = u.hp * blend(d, HP_SCALE[FACTIONS[faction].hp]);
    let sh = u.sh * blend(d, SH_SCALE);
    let ar = u.ar > 0 ? Math.min(ARMOR_CAP, Math.max(200, u.ar * blend(d, AR_SCALE))) : 0;
    if (steel) { hp *= 2.5; sh *= 2.5; }
    if (tier === "boss") { hp *= 10; sh *= 10; }
    return { hp, sh, ar, ko: u.ko, level };
  }

  /* ---------- mods aggregation ---------- */
  const NUM_KEYS = ["dmg", "heavy", "ms", "cc", "ccHeavyNoDouble", "cd", "sc", "sd", "dur", "fr", "frneg", "lock", "mag", "reload", "wind",
    "ic", "hae", "ccc", "br", "ww", "co", "gco", "radius", "pt", "cdFlat", "ccFlat", "hsMult", "msLock", "hm", "ib", "welt",
    "ammoMax", "ammoEff", "ammoConv", "throwSpd", "projSpd", "volatile", "blastR", "firstShot", "evoPst", "wpcc",
    "scFlat", "nc", "cdFew", "evoMult", "cdBase", "ccBase", "baseAdd", "napalm", "hata", "burstDmg", "burstCap", "finalBurstMs", "spreadAdd", "spreadPct", "slamDmg"];
  const EXTRA = ["radm", "magm", "gasm", "blastm", "viralm", "corrm", "heatx", "coldx", "elecx", "toxx", "voidx"];
  function newAgg() {
    const a = { elem: { heat: 0, cold: 0, elec: 0, tox: 0 }, phys: { impact: 0, punct: 0, slash: 0 }, extra: {} };
    for (const k of EXTRA) a.extra[k] = 0;
    for (const k of NUM_KEYS) a[k] = 0;
    return a;
  }
  function applyEff(a, eff, f) {
    const sc = f == null ? 1 : f;
    for (const k in eff) {
      const v = typeof eff[k] === "number" ? eff[k] * sc : eff[k];
      if (k === "tenno" || k === "bane") { a[k] = a[k] || {}; for (const t in v) a[k][t] = (a[k][t] || 0) + v[t] * sc; continue; }
      if (k in a.elem) a.elem[k] += v;
      else if (k in a.phys) a.phys[k] += v;
      else if (k in a.extra) a.extra[k] += v;
      else if (k in a) a[k] += v;
    }
  }
  function condActive(when, o) {
    switch (when) {
      case "kill": return o.kills;
      case "aim": return o.aim;
      case "headshot": return o.hs > 0 && o.aim;
      case "hs": return o.hs > 0;
      case "cast": return o.casting;
      case "energy": return o.energy;
      case "always": return true;
      case "crowd": return o.scenario === "crowd";
      case "armor450": return (o.armor || 0) > 450;
      case "energy700": return (o.maxEnergy || 0) > 700;
      case "sprint12": return (o.sprint || 1) >= 1.2;
      default: return false;
    }
  }
  // On-kill stacks (Galvanized mods, Merciless …; wiki: each kill adds one stack up to `stk`) in a crowd fight start at 0
  // for every pack (user's choice 2026-11-02): with N kills in the pack, the k-th kill lands with min(k, stk) stacks, so
  // the effect runs at the average of min(k, stk)/stk over the pack. Bosses: no kill stacks. o.killRamp === false = full.
  function rampFrac(stk, n) {
    const N = Math.max(1, Math.round(n || 12)); let s = 0;
    for (let k = 0; k < N; k++) s += Math.min(k, stk);
    return s / (N * stk);
  }
  function condScale(c, o) {
    if (!condActive(c.when, o)) return 0;
    if (c.when === "kill" && c.stk > 1 && o.scenario === "crowd" && o.killRamp !== false) return rampFrac(c.stk, o.crowdN);
    return 1;
  }
  function aggregate(mods, o, riven) {
    const a = newAgg();
    a.frBow = 0;
    // set bonuses: Sacrificial Steel + Sacrificial Pressure → each x1.25 (wiki)
    const setCount = {};
    for (const m of mods) if (m && m.set) setCount[m.set] = (setCount[m.set] || 0) + 1;
    // Vigilante (primary): 5% per set mod (max 30% at 6) chance to raise a crit by one tier;
    // Gladiator (melee): +10% crit chance per combo multiplier per set mod, in the Blood Rush bucket. Warframe pieces: o.frameSet.
    const fs = o.frameSet || {};
    a.vigil = Math.min(0.3, 0.05 * ((setCount.vigilante || 0) + (fs.vigilante || 0)));
    a.glad = 0.1 * Math.min(6, (setCount.gladiator || 0) + (fs.gladiator || 0));
    for (const m of mods) {
      if (!m) continue;
      const sm = m.set && m.setMul && setCount[m.set] >= 2 ? m.setMul : 1;
      if (m.eff && sm !== 1) { const e = {}; for (const k in m.eff) e[k] = typeof m.eff[k] === "number" ? m.eff[k] * sm : m.eff[k]; applyEff(a, e); }
      else if (m.eff) applyEff(a, m.eff);
      if (m.bow2 && m.eff && m.eff.fr) a.frBow += m.eff.fr;   // "(x2 for Bows)" fire-rate mods
      if (m.id === "__riven" && m.eff && m.eff.fr) a.frBow += m.eff.fr;
      if (m.cond) for (const c of m.cond) { const f = condScale(c, o); if (f > 0) applyEff(a, c.eff, f); }
    }
    if (riven) applyEff(a, riven);
    return a;
  }

  /* ---------- element layouts ---------- */
  function pairings(present) {
    const out = [];
    if (present.length <= 1) out.push({ pairs: [], singles: present.slice() });
    else if (present.length === 2) out.push({ pairs: [[present[0], present[1]]], singles: [] });
    else if (present.length === 3) for (const s of present) out.push({ pairs: [present.filter((p) => p !== s)], singles: [s] });
    else {
      const [a, b, c, d] = present;
      out.push({ pairs: [[a, b], [c, d]], singles: [] }, { pairs: [[a, c], [b, d]], singles: [] }, { pairs: [[a, d], [b, c]], singles: [] });
    }
    return out;
  }
  // Game rule (wiki "Elemental Damage"): elements combine pairwise in order of first appearance,
  // mod slots read top-left → bottom-right. Then come elements granted like a mod from outside the slots
  // (Violet Archon shard electricity — "combines with mods"), then innate elements; when a Kuva/Tenet/Coda
  // valence adds a second innate element, the two go in Heat → Cold → Electricity → Toxin order.
  // order: fixed first-appearance order of the mod elements (comparison sets, as typed); null = try every arrangement.
  // tail: [[type, value]] shard elements that join a mod of the same element, otherwise come after the mods and the valence.
  function elementLayouts(atk, a, val, Btot, base0, order, tail) {
    const present = PRIM.filter((p) => a.elem[p] > 0);
    let structs;
    if (order && order.length) {
      const seq = order.filter((p, i) => present.includes(p) && order.indexOf(p) === i).concat(present.filter((p) => !order.includes(p)));
      const pairs = []; for (let i = 0; i + 1 < seq.length; i += 2) pairs.push([seq[i], seq[i + 1]]);
      structs = [{ pairs, singles: seq.length % 2 ? [seq[seq.length - 1]] : [] }];
    } else structs = pairings(present);
    const res = [];
    for (const pr of structs) {
      const coef = {}, mp = {}, partner = {};
      const singles = pr.singles.slice();
      const physSum = PHYS.reduce((s, t) => s + (atk.dmg[t] || 0), 0);
      for (const t in atk.dmg) {
        const v = atk.dmg[t] / Btot;
        if (!v || PRIM.includes(t)) continue;
        coef[t] = (coef[t] || 0) + v * (PHYS.includes(t) ? Math.max(0, 1 + a.phys[t]) : 1);
        // Madurai Phoenix Talons: +30% of total base damage as physical, split by the weapon's physical weights, after physical mods
        if (a.phoenix && PHYS.includes(t) && physSum > 0) coef[t] += a.phoenix * (base0 / Btot) * (atk.dmg[t] / physSum);
      }
      for (const pair of pr.pairs) {
        const t = COMBO[pair[0] + "|" + pair[1]];
        mp[pair[0]] = t; mp[pair[1]] = t;
        coef[t] = (coef[t] || 0) + a.elem[pair[0]] + a.elem[pair[1]];
      }
      for (const s of pr.singles) { mp[s] = s; coef[s] = (coef[s] || 0) + a.elem[s]; }
      // innate + Valence elements first, Archon shard elements last (in-game arsenal 2026-11-03, Kuva Ogris on Cyte-09: Malignant
      // Force toxin + Heat valence = Gas, the Violet shard's Electricity stays Electricity; with no elemental mod the shard joins the
      // valence: Heat valence + shard Electricity = Radiation, arsenal 2026-10)
      const appended = [];
      const inn = [];
      for (const p of PRIM) if (atk.dmg[p]) inn.push([p, atk.dmg[p] / Btot, "innate"]);
      if (val && val.type && val.pct > 0) {
        const vx = (base0 * val.pct) / Btot, same = inn.find((e) => e[0] === val.type);
        if (same) same[1] += vx; else inn.push([val.type, vx, "val"]);
      }
      inn.sort((x, y) => (PRIM.includes(x[0]) ? PRIM.indexOf(x[0]) : 9) - (PRIM.includes(y[0]) ? PRIM.indexOf(y[0]) : 9));
      appended.push(...inn);
      for (const [p, x] of tail || []) if (x > 0) appended.push([p, x, "shard"]);
      for (const [p, x, src] of appended) {
        if (!PRIM.includes(p)) { coef[p] = (coef[p] || 0) + x; continue; }
        if (mp[p]) { coef[mp[p]] = (coef[mp[p]] || 0) + x; continue; }
        if (singles.length) {
          const s = singles.shift();
          const t = COMBO[s + "|" + p];
          coef[t] = (coef[t] || 0) + (coef[s] || 0) + x;
          delete coef[s];
          mp[s] = t; mp[p] = t;
          partner[s] = { src, type: p };
        } else { mp[p] = p; singles.push(p); coef[p] = (coef[p] || 0) + x; }
      }
      for (const t in a.extra) {
        if (a.extra[t] <= 0) continue;
        const tt = t.slice(0, -1) === "voi" ? "void" : t.slice(0, -1);
        coef[tt] = (coef[tt] || 0) + a.extra[t];
      }
      res.push({ coef, mp, pairs: pr.pairs, singles: pr.singles, partner });
    }
    return res;
  }

  // Combo multiplier of a heavy attack in steady state (wiki Melee Combo). A heavy attack spends (1 − efficiency) of the
  // counter; spent Initial Combo refills at 40 points/s, so heavy attacks closer together than that come back before it
  // is full. Hits between heavy attacks add combo at the combo count chance (a riven negative lowers it).
  // Returns the average multiplier (it can be fractional when the number of counted hits varies throw to throw).
  function comboMult(ic, hae, K, hitsBetween, period, ccc) {
    const e = Math.min(0.9, Math.max(0, hae || 0));
    const p = Math.max(0, 1 + (ccc || 0));
    const refill = period > 0 ? 40 * period : 1e9;
    const n = Math.max(0, K + (hitsBetween || 0)), g = n * p;
    const base = (c) => { const kept = c * e; return kept >= ic ? kept : Math.min(ic, kept + refill); };
    let c = ic + g;
    for (let i = 0; i < 80; i++) c = base(c) + g;
    if (p >= 1 || n <= 0) return comboTier(c);
    const b = base(c), N = Math.max(1, Math.round(n)), q = g / N;
    if (q >= 1) return comboTier(b + g);
    let M = 0, pk = Math.pow(1 - q, N);
    for (let k = 0; k <= N; k++) {
      M += pk * comboTier(b + k);
      pk = q >= 1 ? 0 : pk * ((N - k) / (k + 1)) * (q / (1 - q));
    }
    return Math.round(M * 100) / 100;
  }
  function comboTier(c) { return Math.min(12, Math.floor(c / 20) + 1); }
  // Swing builds: average combo multiplier over a continuous fight of W seconds. The counter starts at Initial Combo and
  // rises g points/s (hits/s × enemies per swing × stance points per hit × combo count chance) until 12x at 220.
  // W = 0 → the old assumption (always 12x, combo already built).
  function comboAvg(c0, g, W) {
    if (!(W > 0)) return 12;
    if (!(g > 0)) return comboTier(c0);
    let t = 0, sum = 0, c = c0;
    while (t < W - 1e-9) {
      const tier = comboTier(c);
      if (tier >= 12) { sum += 12 * (W - t); break; }
      const next = (Math.floor(c / 20) + 1) * 20, dt = Math.min(W - t, (next - c) / g);
      sum += tier * dt; t += dt; c = next;
    }
    return sum / W;
  }

  function defaults() {
    return {
      scenario: "crowd", tier: "light", factions: ["grineer", "corpus", "infested"], metric: "geo",
      level: 150, steel: true, crowdN: 12, density: 6 / (Math.PI * 7.9 * 7.9), hits: null,
      kills: true, hs: 0, aim: false, casting: false, energy: false,
      ext: {}, val: null, arcane: null, mercy: false, throwOverhead: 0.5, comboHits: 0, meleeCombo: 220, comboWindow: 120, comboPts: 1.5, og: false, frameArcs: [], armor: 0,
      targets: null, dt: 0.2, tmax: 60,
    };
  }
  function targetsAt(o, level) {
    const out = {};
    for (const f of o.factions) {
      if (o.scenario === "boss") out[f] = { main: enemyStats(f, "boss", level, o.steel) };
      else if (o.scenario === "crowd") {
        out[f] = { main: enemyStats(f, "light", level, o.steel), heavy: enemyStats(f, "heavy", level, o.steel) };
        // one Eximus in the pack (user's choice 2026-11-02): a light unit carrying Overguard (wiki "Overguard": Magnetic boosts
        // damage to it like shields, Viral does not; crowd control ignored, Cold up to 4 stacks)
        if (o.eximus !== false) out[f].ex = Object.assign(enemyStats(f, "light", level, o.steel), { og: overguardAt(level) });
      }
      else { out[f] = { main: enemyStats(f, "heavy", level, o.steel) }; if (o.og) out[f].main.og = overguardAt(level); }
    }
    return out;
  }
  // score = geometric mean of kill speed at three levels: the chosen one, +100 and +250 (150 → 150 / 250 / 400 "endurance").
  // Overkill is rewarded only through the higher levels (a build that still one-shots at 400 ranks above one that doesn't),
  // and attack speed through kills per second at every level.
  const LEVEL_STEPS = [0, 100, 250];
  function levelsOf(o) { return (o.levelSteps || LEVEL_STEPS).map((d) => o.level + d); }
  function targetsFor(o) { const L = levelsOf(o); return { lo: targetsAt(o, L[0]), hi: targetsAt(o, L[1]), top: targetsAt(o, L[2]), levels: L }; }

  /* ---------- time-to-kill simulation ---------- */
  // p: {hp, sh, ar0, strip, r, D, blast, dot:{T:X}, Tdur, pv, ph, pc, pk, cc, cd, corrMax, dt, tmax, firstShot}
  function ttk(p, until) {
    let hp = p.hp, sh = p.sh, og = p.og || 0, t = 0, lastRate = 1, dealt = 0, magT = -1, magDps = 0;
    const sh0 = p.sh || 0;
    const dt = p.dt, r = p.r, Td = Math.max(0.5, p.Tdur);
    const win = [], winN = Math.max(1, Math.round(1 / dt)); let winSum = 0;
    const stepsMax = until ? Math.ceil(until / dt) - 1 : Math.ceil(p.tmax / dt);
    // stack-based multipliers after `shots` trigger pulls have landed their status procs
    // v1.83 stacks run out (wiki, each status page): Viral "for 6 seconds", Corrosive "for 8 seconds", Magnetic 6 s, Cold
    // "lasts 6 seconds", Puncture "lasts 10 seconds" — "with each stack having its own duration". So only the shots of the
    // last T x status duration still count: about r x T shots (at least the latest one). Before v1.83 the stacks never ran
    // out, so negative status duration (riven) and long fights kept full stacks. p.Tdur = 6 s x status duration.
    const dS = (p.Tdur != null ? p.Tdur : 6) / 6;
    const live = (shots, T) => Math.min(shots, Math.max(1, r * T * dS));
    const stacks = (shots) => {
      const nv = Math.min(10, p.pv * live(shots, 6)), nc = Math.min(p.corrMax, p.pc * live(shots, 8)), nk = Math.min(og > 0 ? 4 : 10, p.pk * live(shots, 6));
      const nm = Math.min(10, (p.pm || 0) * live(shots, 6));
      const magM = nm <= 0 ? 1 : nm < 1 ? 1 + nm : 2 + 0.25 * (nm - 1);      // Magnetic: shields and overguard take more
      const extraM = (1 + (p.coldVuln || 0) * nk) * (p.frozenM && nk >= 10 ? p.frozenM : 1);
      const vm = nv <= 0 ? 1 : nv < 1 ? 1 + nv : 2 + 0.25 * (nv - 1);
      const hf = 1 - Math.exp(-p.ph * shots);
      // wiki "Heat": "Every 0.5 seconds after the initial proc, the enemy will have 15%, 30%, 40%, 50% of its armor stripped"
      const tH = r > 0 ? Math.max(0, (shots - 1) / r) : 0;
      const heatStrip = tH < 0.5 ? 0 : tH < 1 ? 0.15 : tH < 1.5 ? 0.3 : tH < 2 ? 0.4 : 0.5;
      const cs = nc <= 0 ? 0 : nc >= 1 ? 0.2 + 0.06 * nc : 0.26 * nc;
      let A = p.ar0 * (1 - heatStrip * hf) * (1 - cs) * (1 - p.strip);
      A = Math.min(A, ARMOR_CAP);
      const ar = A > 0 ? 1 - 0.9 * Math.sqrt(A / ARMOR_CAP) : 1;
      // Cold (wiki): +0.1 crit multiplier on the first stack, +0.05 per stack to +0.5 at 9, +1.0 while frozen at 10.
      // Puncture (wiki): +5% weapon crit chance per stack, +25% at 5, added after mods. Neither applies to area damage.
      const cdb = p.aoeOnly || nk <= 0 ? 0 : nk < 1 ? 0.1 * nk : nk >= 10 ? 1.0 : Math.min(0.5, 0.1 + 0.05 * (nk - 1));
      const ccp = p.aoeOnly ? 0 : Math.min(0.25, 0.05 * Math.min(5, (p.pp || 0) * live(shots, 10)));
      const ccT = p.cc + ccp;
      // Devouring Attrition (p.nc): non-critical hits get 1 + chance x bonus on average
      const critf = 1 + ccT * (p.cd + cdb - 1) + (p.nc ? Math.max(0, 1 - ccT) * p.nc : 0);
      return { nm, magM, extraM, vm, ar, critf };
    };
    // one chunk of damage through overguard → shields → health (tx: toxin, bypasses shields; sl: slash, bypasses shields and armor)
    const land = (S, tx, sl, f) => {
      if (og > 0) {
        // overguard first: no armor, no Viral; Magnetic and Void boost it
        const raw = (S + tx + sl) * f.magM * (p.ogM || 1);
        if (raw < og) { og -= raw; win.push(raw); winSum += raw; if (win.length > winN) winSum -= win.shift(); lastRate = Math.max(1e-9, winSum / (win.length * dt)); return 0; }
        const keep = 1 - og / Math.max(1e-9, raw); og = 0; S *= keep; tx *= keep; sl *= keep;
      }
      if (sh > 0) {
        const take = Math.min(sh, S * f.magM); sh -= take; S -= take / f.magM;
        if (sh <= 0 && f.nm > 0 && magT < 0) { magT = t; magDps = Math.min(0.3, 0.03 * f.nm) * sh0 / 6; }
      }
      const dmgH = S * f.vm * f.ar + tx * f.vm * f.ar + sl * f.vm;
      hp -= dmgH; dealt += dmgH;
      win.push(dmgH); winSum += dmgH; if (win.length > winN) winSum -= win.shift();
      lastRate = Math.max(1e-9, winSum / (win.length * dt));   // v1.87: rate over the last second (discrete shots leave empty steps)
      return dmgH;
    };
    // the first trigger pull lands before its own status procs (wiki "Viral Damage": attacks deal their initial damage
    // before they apply status, and multishot hits of the same shot don't benefit from each other's procs)
    if (p.D > 0) {
      const f0 = stacks(0);
      land((p.D0 != null ? p.D0 : p.D) * f0.critf * f0.extraM, 0, 0, f0);
      if (!until && hp <= 0) return 0;
    }
    for (let i = 0; i <= stepsMax; i++) {
      const shots = 1 + r * t;
      const f = stacks(shots);
      // v1.87 (Simulacrum 2026-11-07, Kuva Zarr vs 20 Nox): shots land whole, at k/r after the first — the k-th shot's damage in
      // the step it lands, not smeared over the time before it (smearing put a 2-shot kill's second shot at 0.02 s instead of
      // 1/r = 0.2 s, and made the blast alone look like it kills a bystander within one fire interval)
      const kA = Math.floor(t * r + 1e-9), kB = Math.floor((t + dt) * r + 1e-9), nShot = Math.max(0, kB - kA);
      const shotDmg = nShot * (p.D * f.critf + (t >= 1.5 ? p.blast * f.critf : 0) + (p.F || 0));
      let shieldable = 0;
      let toxRate = 0, slashRate = 0;
      for (const T in p.dot) {
        // procs whose ticks are running now: applied between t − delay − span and t − delay (span = number of 1 s ticks)
        const D = DOT_DELAY[T] || 0, n = p.dotN && p.dotN[T] != null ? p.dotN[T] : Td;
        if (!(n > 0) || !p.dot[T]) continue;
        const te = t - D;
        let act = te < 0 ? 0 : r * Math.min(te, n) + (te < n ? 1 : 0);
        if (p.field && T === "napalm") act = 6 * r;
        // v1.67 wiki "Heat": a new proc "refreshes the duration of all currently active heat stacks on the target", ramping
        // "indefinitely (scaling up linearly)" while it stays refreshed. Heat procs land at λ = r x ph per second (napalm
        // procs included — they are heat stacks too); the chain holds through one gap with probability 1 − e^(−λ·n)
        // (Poisson gaps), so every proc since the start stays active with probability (1 − e^(−λn))^(λ·te). A broken chain
        // is counted as the old per-stack expiry (conservative: no restart of the ramp).
        if (T === "heat" && te > n && p.ph > 0) {
          const lam = r * p.ph, all = r * te + 1;
          const hold = Math.pow(1 - Math.exp(-lam * n), lam * te);
          act += (all - act) * hold;
        }
        const v = (p.dot[T] / n) * act * f.critf;
        if (T === "tox") toxRate += v; else if (T === "slash") slashRate += v; else shieldable += v;
      }
      // Nightwatch Napalm Heat stacks (see perShot): each rocket's blazes tick right away and then every second for 6 s; every
      // tick adds stacks that never run out while new ones keep coming, and each stack ticks from 1 s after its proc.
      // U = blaze ticks landed by t − 1 (first rocket at 0, then r rockets per second). o.napField (defense/interception): the
      // rockets keep landing on the same ground, so an enemy walking in meets the blazes of the last 6 s at once — 6r ticks a second.
      if (p.napH > 0 && t >= 1) {
        const te = t - 1;
        const U = p.field ? 6 * r * te : Math.min(6, Math.floor(te) + 1) + r * (te <= 5 ? te + te * te / 2 : 6 * (te - 5) + 17.5);
        shieldable += p.napH * U * f.critf;
      }
      // Magnetic (wiki): stripping the shields triggers an Electricity proc of 3% of max shields per Magnetic stack (max 30%)
      if (magT >= 0 && t < magT + 6) shieldable += magDps;
      const dmgH = land((shieldable * dt + shotDmg) * f.extraM, toxRate * dt * f.extraM, slashRate * dt * f.extraM, f);
      if (!until && hp <= 0) {
        const need = 1 - Math.min(1, -hp / Math.max(1e-9, dmgH));
        // killed by a shot: at the time of the shot that crossed (whole shots); by damage over time: inside the step
        return nShot > 0 && shotDmg >= shieldable * dt ? (kA + Math.max(1, Math.ceil(need * nShot - 1e-9))) / r : t + dt * need;
      }
      t += dt;
    }
    if (until) return dealt;
    return p.tmax + hp / Math.max(1e-6, lastRate);
  }

  // element concept chosen by the player, e.g. ["viral","slash"]. Distance 0 = every listed type is a real part of the
  // damage (elements ≥ 10% of the damage, physical ≥ 5% of the damage or of the status procs); with o.conceptOnly, no
  // other element over 10%. Partial builds get partial credit (one of two components of a combined element = half way),
  // so the beam search can walk towards the concept instead of hitting a wall.
  const PHYS_T = ["impact", "punct", "slash"];
  const COMP = { blast: ["heat", "cold"], gas: ["heat", "tox"], rad: ["heat", "elec"], viral: ["cold", "tox"], corr: ["elec", "tox"], mag: ["cold", "elec"] };
  function conceptDist(share, procs, o) {
    const c = o.concept;
    if (!c || !c.length) return 0;
    let ptot = 0; for (const k in procs) ptot += procs[k];
    const has = (b) => (share[b] || 0) >= 0.05 || Object.keys(COMP).some((x) => (share[x] || 0) >= 0.05 && COMP[x].includes(b));
    let d = 0;
    const purePhys = c.every((T) => PHYS_T.includes(T));
    for (const T of c) {
      if (purePhys) {
        // a physical-only concept: that type has to lead the physical damage
        const mx = Math.max(...PHYS_T.filter((x) => !c.includes(x)).map((x) => share[x] || 0));
        if ((share[T] || 0) < mx) d += Math.min(1, (mx - (share[T] || 0)) / Math.max(0.01, mx));
      } else if (PHYS_T.includes(T)) { if (Math.max(share[T] || 0, ptot > 0 ? (procs[T] || 0) / ptot : 0) < 0.05) d += 1; }
      else if ((share[T] || 0) < 0.1) d += COMP[T] ? 1 - 0.5 * COMP[T].filter(has).length / 2 : 1;
    }
    if (o.conceptOnly) {
      const parts = new Set(c.flatMap((T) => COMP[T] || []));
      // other elements: a leftover component of a wanted combined element counts less (it is on the way there)
      for (const k in share) if (!PHYS_T.includes(k) && !c.includes(k) && k !== "void" && k !== "true" && share[k] >= 0.1) d += parts.has(k) ? 0.3 : 1;
    }
    return d;
  }

  // does the first attack alone (its hit and its own status procs, no damage over time) kill the enemy?
  function oneHit(p) { return ttk(Object.assign({}, p, { r: 0, dot: {}, napH: 0, blast: 0, F: 0 }), p.dt) >= p.hp - 1e-6; }

  /* ---------- evaluation ---------- */
  // Element arrangement: o.elemOrder fixes it (slot order as typed). Otherwise every possible arrangement is a
  // candidate; o.layoutTTK picks the one with the best time-to-kill score (exact), else steady-state damage (fast).
  function evaluate(weapon, atk, mods, o, riven) {
    // v1.96 Plated Round in a crowd with kill stacks from 0: the partial bonus depends on how long the pack takes — fixed point
    // on the pack firing time (mean 12-enemy clear over factions and levels), three passes at most
    const arcP = o.arcane ? (root.WF_ARCANES || {})[o.arcane] : null;
    if (arcP && arcP.plated && o._platedT == null && o.scenario === "crowd" && o.killRamp !== false && (atk.mag || (atk.parts && atk.parts[0].mag))) {
      const packT = (r) => { const xs = []; for (const f of o.factions || []) { const x = r.perF && r.perF[f]; if (!x) continue; for (const y of [x, x.hi, x.top]) if (y && isFinite(y.clear) && y.clear > 0) xs.push(y.clear); } return xs.length ? xs.reduce((q, v) => q + v, 0) / xs.length : null; };
      let r = evaluate(weapon, atk, mods, Object.assign({}, o, { _platedT: 1e6, killRamp: o.killRamp }), riven), T = packT(r);
      for (let i = 0; i < 3 && T != null; i++) {
        const r2 = evaluate(weapon, atk, mods, Object.assign({}, o, { _platedT: T }), riven), T2 = packT(r2);
        r = r2; if (T2 == null || Math.abs(T2 - T) < 0.02 * T) { T = T2; break; } T = T2;
      }
      if (r) r.platedT = T;
      return r;
    }
    if (o.layoutTTK && o.layoutIdx === undefined && !(o.elemOrder && o.elemOrder.length)) {
      let best = evaluate1(weapon, atk, mods, Object.assign({}, o, { layoutIdx: 0 }), riven);
      for (let i = 1; i < (best.nLayouts || 1); i++) {
        const r = evaluate1(weapon, atk, mods, Object.assign({}, o, { layoutIdx: i }), riven);
        const d = r.conceptD || 0, dB = best.conceptD || 0;
        if (d < dB - 1e-9 || (Math.abs(d - dB) < 1e-9 && r.score > best.score)) best = r;
      }
      return best;
    }
    return evaluate1(weapon, atk, mods, o, riven);
  }
  // Tennokai (melee swing): every few hits a heavy attack that keeps the combo — modeled as a time-shared second part
  function tennoOf(mods, o) {
    let t = null;
    for (const m of mods) {
      if (!m) continue;
      const add = (x) => { if (!x) return; t = t || {}; for (const k in x) t[k] = (t[k] || 0) + x[k]; };
      if (m.eff && m.eff.tenno) add(m.eff.tenno);
      if (m.cond) for (const c of m.cond) if (c.eff.tenno && condActive(c.when, o)) add(c.eff.tenno);
    }
    if (!t || !t.on) return null;
    const kH = o.tennoPerHit && o.scenario === "crowd" ? 2 : 1;   // melee swing hits K = 2 in a crowd
    t.f = t.every ? kH / t.every : 1 - Math.pow(1 - Math.min(1, 0.15 * (t.freq || 1)), kH);   // 15%/hit: destructoid.com Tennokai guide
    return t;
  }
  function evaluate1(weapon, atk, mods, o, riven) {
    let parts = atk.parts ? atk.parts : [atk];
    // v1.88 beam-end AoE (Glaxion Vandal, Ignis, Lizzie, Catabolyst, Embolist — convert.py BEAM_AOE): the wiki pages don't say whether
    // the enemy the beam strikes also takes the blotch; default counts it, o.noBeamAoe drops it (the app checks the pick both ways)
    if (o.noBeamAoe && parts.some((p) => p.beamAoe)) parts = parts.filter((p) => !p.beamAoe);
    let weights = parts.map(() => 1);
    const tn = atk.kind === "melee" && !o._noTenno ? tennoOf(mods, Object.assign({}, o, { kills: o.scenario === "boss" ? false : o.kills })) : null;
    // v1.80 o.noPool: swings and Tennokai heavies as two separate kill streams sharing the time (kill rate = time-weighted mix),
    // instead of one averaged hit — averaging lets a 12x Tennokai's damage "one-shot" enemies on every swing. The truth lies
    // between the two; the app withholds the pick when they disagree.
    if (tn && o.noPool && !o._tennoOnly) {
      const rS = evaluate1(weapon, atk, mods, Object.assign({}, o, { _noTenno: true }));
      const rT = evaluate1(weapon, atk, mods, Object.assign({}, o, { _tennoOnly: true }));
      const q = tn.f / (1 + tn.f), mix = (x, y) => (1 - q) * x + q * y, perF = {};
      for (const f of o.factions) {
        const S = rS.perF[f], T = rT.perF[f];
        const lo = mix(S.kpsLo, T.kpsLo), hi = mix(S.hi.kps, T.hi.kps), top = mix(S.top.kps, T.top.kps);
        perF[f] = Object.assign({}, S, { kps: Math.cbrt(lo * hi * top), kpsLo: lo, hi: Object.assign({}, S.hi, { kps: hi }), top: Object.assign({}, S.top, { kps: top }) });
      }
      const vals = o.factions.map((f) => perF[f].kps);
      let score = o.metric === "min" ? Math.min(...vals) : Math.exp(vals.reduce((s, x) => s + Math.log(Math.max(x, 1e-9)), 0) / vals.length);
      if (rS.conceptD > 0 && o.conceptPenalty !== false) score *= Math.pow(0.01, rS.conceptD);
      return Object.assign({}, rS, { score, perF, tenno: tn });
    }
    if (tn) {
      const heavyAtk = (weapon.attacks || []).find((x) => x.en === "Heavy Attack") || atk;
      const tp = Object.assign({}, heavyAtk, { kind: "tennokai", name: atk.name, tenno: tn, swingFr: atk.fr });
      // v2.07: a swing made of parts (Exalted Blade swing + energy wave) keeps them all, Tennokai shares the time with the whole swing
      const sw = atk.parts ? atk.parts : [atk];
      if (o._tennoOnly) { parts = [tp]; weights = [1]; }
      else { parts = sw.concat([tp]); weights = sw.map(() => 1 / (1 + tn.f)).concat([tn.f / (1 + tn.f)]); }
    }
    // Volatile Quick Return with a detonation build: the first contact also sets off a bounce explosion
    // (50% damage, no combo multiplier, no guaranteed procs) before the heavy-attack detonation in the same throw
    if (atk.kind === "glaive" && /Recall/.test(atk.en) && mods.some((m) => m && m.eff && m.eff.volatile)) {
      const bn = (weapon.attacks || []).find((x) => x.kind === "glaive" && /Bounce/.test(x.en) && /Charged/.test(x.en) === /Charged/.test(atk.en));
      if (bn) { parts = parts.concat([Object.assign({}, bn, { bounceOnly: true, name: atk.name })]); weights = weights.concat([1]); }
    }
    // v1.95 primer statuses on the target (Cedo): the alt-fire glaive thrown every 1/primerRate s puts its own status types on the
    // enemy — the direct hit's procs (status chance) and, for each glaive, the explosion's "two separate guaranteed procs" (wiki
    // Cedo: first by normal status weighting of the explosion's elements, second "an even chance" of Heat/Cold/Electricity/Toxin).
    // They count toward per-status-type bonuses of the main fire (Cedo's own +60%, Galvanized Savvy). Bounce explosions (up to 11)
    // are not counted — the wiki doesn't say each bounce explodes on the same target (lower bound).
    // Independent review (2026-11-07): the same procs also feed status-triggered arcanes (Primary Frostbite/Blight: "On Cold/Toxin
    // Status Effect") — the direct hit on one enemy, the explosion on every enemy in its 6 m — and the explosion's procs count in
    // the time-to-kill status effects (heat armor strip, cold, viral, corrosive) like the direct hit's already did.
    let oP = o, primX = null;
    if (atk.primer && atk.primerAoe) {
      const k0 = atk.primerRate || 0.25, add = {}, addD = {}, addX = {};
      const pr = perShot(weapon, atk.primer, mods, o, riven, atk), px = perShot(weapon, atk.primerAoe, mods, o, riven, atk);
      for (const t in (pr && pr.procs) || {}) addD[t] = k0 * pr.procs[t];
      for (const t in (px && px.procs) || {}) addX[t] = k0 * px.procs[t];
      for (const t of new Set(Object.keys(addD).concat(Object.keys(addX)))) add[t] = (addD[t] || 0) + (addX[t] || 0);
      oP = Object.assign({}, o, { _procAdd: add, _procArc: { d: addD, x: addX, r: atk.primerAoe.radius || 0 } });
      primX = addX;
    }
    const res = parts.map((p) => perShot(weapon, p, mods, oP, riven, atk));
    const main = res[0];
    const kx = mods.find((m) => m && m.killExplode) ? mods.find((m) => m && m.killExplode).killExplode : null;
    const targets = o.targets || targetsFor(o);
    const kills = o.scenario === "boss" ? false : o.kills;
    const perF = {};
    for (const f of o.factions) {
      // sum per-shot params across parts (same trigger)
      const acc = { irrX: 0, irrX0: 0, irrF: 0, irrF0: 0, irrLam: 0, kf: 0, D: 0, D0: 0, Dnon: 0, pbN: 0, blast: 0, F: 0, dot: {}, napH: 0, pv: 0, ph: 0, pc: 0, pk: 0, pm: 0, pp: 0, dotNon: {}, pvN: 0, phN: 0, pcN: 0, pkN: 0 };
      res.forEach((r, ri) => {
        const x = r.perF[f];
        // v1.84 (second review 2026-11-06): the time-to-kill applies the main part's crit (the swing's) to everything pooled; a
        // Tennokai heavy has its own (Galvanized Steel x2 on heavies, Dreamer's Wrath …) — its share is rescaled to its own
        // average crit multiplier (Dual Ichor: Tennokai damage was 14.6% low)
        const cr = parts[ri].kind === "tennokai" && r.critf > 0 && main.critf > 0 ? r.critf / main.critf : 1;
        const wgt = weights[ri] * cr, wN = weights[ri];
        // Secondary Irradiate (v1.99): split the spread out of D — irrX = the extra it adds now, irrF = the extra at full uptime
        if (x.irrG > 0) { const dB = x.D / x.irrM, d0 = (x.D0 != null ? x.D0 : x.D) / x.irrM; acc.irrX += (x.D - dB) * wgt; acc.irrX0 += ((x.D0 != null ? x.D0 : x.D) - d0) * wgt; acc.irrF += dB * x.irrG * wgt; acc.irrF0 += d0 * x.irrG * wgt; }
        acc.irrLam += ((r.procs && r.procs.rad) || 0) * wN;
        acc.D += x.D * wgt; acc.D0 += (x.D0 != null ? x.D0 : x.D) * wgt; acc.Dnon += (x.Dnon || 0) * wgt; acc.pbN += (x.pbN || 0) * wN; acc.kf = Math.max(acc.kf, x.kf || 0); acc.blast += x.blast * wgt; acc.F += (x.F || 0) * wN; acc.napH += (x.napH || 0) * wgt;
        for (const T in x.dot) acc.dot[T] = (acc.dot[T] || 0) + x.dot[T] * wgt;
        for (const T in x.dotNon) acc.dotNon[T] = (acc.dotNon[T] || 0) + x.dotNon[T] * wgt;
        acc.pv += x.pv * wN; acc.ph += x.ph * wN; acc.pc += x.pc * wN; acc.pk += x.pk * wN; acc.pm += (x.pm || 0) * wN; acc.pp += (x.pp || 0) * wN;
        acc.pvN += x.pvN * wN; acc.phN += x.phN * wN; acc.pcN += x.pcN * wN; acc.pkN += x.pkN * wN;
      });
      // explosion parts of a combined shot (direct hit + blast): the enemies around the target only take the blast
      const aoe = { D: 0, blast: 0, F: 0, dot: {}, napH: 0, pv: 0, ph: 0, pc: 0, pk: 0, pm: 0 };
      let Kaoe = 0;
      if (res.length > 1) res.forEach((r, ri) => {
        // v2.07 Exalted Blade waves: the enemies in the wave's strip take the wave only, at r.waveAoe of the target's wave hit
        if ((parts[ri].kind !== "radial" && !parts[ri].wave) || r.K <= 1) return;
        const x = r.perF[f], sW = parts[ri].wave ? r.waveAoe || 0 : 1, wgt = weights[ri] * sW;
        Kaoe = Math.max(Kaoe, r.K);
        aoe.D += x.D * wgt; aoe.blast += x.blast * wgt; aoe.F += (x.F || 0) * wgt; aoe.napH += (x.napH || 0) * wgt;
        for (const T in x.dot) aoe.dot[T] = (aoe.dot[T] || 0) + x.dot[T] * wgt;
        aoe.pv += x.pv * wgt; aoe.ph += x.ph * wgt; aoe.pc += x.pc * wgt; aoe.pk += x.pk * wgt; aoe.pm += (x.pm || 0) * wgt;
      });
      if (atk.primer) {
        const pr = perShot(weapon, atk.primer, mods, o, riven, atk).perF[f];
        const k = (atk.primerRate || 0.25) / Math.max(0.05, main.rate);
        acc.pv += pr.pv * k; acc.ph += pr.ph * k; acc.pc += pr.pc * k; acc.pk += pr.pk * k;
        if (primX) { const m = 1 / Math.max(0.05, main.rate); acc.pv += (primX.viral || 0) * m; acc.ph += (primX.heat || 0) * m; acc.pc += (primX.corr || 0) * m; acc.pk += (primX.cold || 0) * m; }
      }
      const base = { field: !!o.napField, strip: o.ext.armorStrip || 0, r: main.rate, cc: main.cc, cd: main.cd, nc: main.nc || 0, corrMax: 10 + (o.ext.corrMax || 0), dt: o.dt, tmax: o.tmax, Tdur: main.Tdur, dotN: main.dotN,
        ogM: main.ogM || 1, frozenM: main.frozenM || 0, coldVuln: main.coldVuln || 0 };
      const hitP = { D: acc.D, D0: acc.D0, blast: acc.blast, F: acc.F, dot: acc.dot, napH: acc.napH, pv: acc.pv, ph: acc.ph, pc: acc.pc, pk: acc.pk, pm: acc.pm, pp: acc.pp, aoeOnly: main && parts.every((q) => q.kind === "radial") };
      const nonP = { D: acc.Dnon, blast: 0, dot: acc.dotNon, pv: acc.pvN, ph: acc.phN, pc: acc.pcN, pk: acc.pkN };
      const hasNon = acc.Dnon > 0 || acc.pbN > 0 || Object.keys(acc.dotNon).some((T) => acc.dotNon[T] > 0);
      const period = 1 / Math.max(0.05, main.rate);
      // o.tAcq (v1.86): the re-aim time has no source (T_ACQ = 0.2 s is a guess) — the app checks the pick at both ends
      const tAcq = isMeleeKind(atk.kind) ? 0 : (o.tAcq != null ? o.tAcq : T_ACQ);
      const solve = (tgs) => {
        const tg = tgs.main;
        const shc = 1 - (o.ext.shieldCut || 0);
        // v1.99 Secondary Irradiate per target (game data: "On hitting enemies afflicted by 10 stacks of Radiation: Deal 180% of
        // the hit damage to enemies within 7m"): the k-th hit on a target carries (k − 1) shots' worth of Radiation procs
        // (Poisson, stacks last 12 s × status duration), and only the hits that find 10 stacks spread. Shots on the target =
        // until it dies without the spread (the spread goes to the others, not to it). Before: every hit spread at the
        // 12-second steady state, so a target that dies in one or two shots (Catchmoon at Lv150–400) still spread every time.
        const irrFit = (p) => {
          if (!(acc.irrF > 0)) return p;
          const pb = Object.assign({}, p, { D: p.D - acc.irrX, D0: p.D0 - acc.irrX0 });
          const t0 = ttk(pb), lam = acc.irrLam, win = 12 * (main.dur || 1) * main.rate;
          const n = isFinite(t0) ? 1 + Math.round(Math.max(0, t0) / period) : 400;
          const tl = (m) => { let pmf = Math.exp(-m), cdf = pmf; for (let k = 1; k < 10; k++) { pmf *= m / k; cdf += pmf; } return Math.max(0, 1 - cdf); };
          let sum = 0; const nn = Math.min(n, 400);
          for (let j = 1; j <= nn; j++) sum += tl(lam * Math.min(j - 1, win));
          if (n > nn) sum += (n - nn) * tl(lam * Math.min(nn, win));
          const u = lam > 0 ? sum / n : 0;
          return Object.assign({}, pb, { D: pb.D + u * acc.irrF, D0: pb.D0 + u * acc.irrF0 });
        };
        const pMain = irrFit(Object.assign({}, base, hitP, { hp: tg.hp, sh: tg.sh * shc, ar0: tg.ar, og: tg.og || 0 }));
        const tHit = ttk(pMain);
        let tHeavy = tHit, pHeavy = pMain;
        if (tgs.heavy) { pHeavy = irrFit(Object.assign({}, base, hitP, { hp: tgs.heavy.hp, sh: tgs.heavy.sh * shc, ar0: tgs.heavy.ar })); tHeavy = ttk(pHeavy); }
        const tEx = tgs.ex ? ttk(irrFit(Object.assign({}, base, hitP, { hp: tgs.ex.hp, sh: tgs.ex.sh * shc, ar0: tgs.ex.ar, og: tgs.ex.og }))) : 0;
        let tNon = Infinity, tNonH = Infinity;
        // what the enemies the shot doesn't strike keep taking while one is being hit (Melee Influence spread, Blast 10-stack
        // detonations); Melee Influence (wiki): "Hits that one-hit-kill enemies cannot trigger nor benefit" — of the hits a target
        // takes, only the ones before the killing blow spread (none when it dies to the first)
        const pblM = (main.procs && main.procs.blast) || 0, unitB = pblM > 0 && acc.blast > 0 ? acc.blast / pblM : 0;
        const tail10 = (m) => { let pmf = Math.exp(-m), cdf = pmf; for (let k = 1; k < 10; k++) { pmf *= m / k; cdf += pmf; } return Math.max(0, 1 - cdf); };
        const n5c = Math.min(main.N - 1, (o.density || 0) * Math.PI * 25);
        // v1.84 (independent review 2026-11-06): which hits kill outright is decided hit by hit, not by the average hit.
        // ① crit tier: at 176% crit chance 24% of hits are tier 1 and 76% tier 2 — the average (1 + cc(cd − 1)) can one-shot
        //    while the tier-1 hits don't, and those keep spreading. The share of hits before the kill is averaged over the two tiers.
        // ② swings pooled with Tennokai heavies: the pooled average hit carries the 12x Tennokai damage (about 10x a swing), so it
        //    one-shot everything and Melee Influence never spread — while the swings themselves (most of the hits) don't kill and
        //    do spread. Each part (swing, Tennokai) now gets its own lethality, weighted by its share of the spread it carries.
        // ③ (second review) a target's hits come whole: a kill after 1.1 hit periods took 2 more hits, 2 of 3 spread — the
        //    continuous t·r/(1 + t·r) gave 0.52 and made a stronger hit look worse (scaling all damage x2 lowered the score)
        const nlOf = (t) => { const n = Math.min(1e6, Math.ceil(Math.max(0, t * main.rate) - 1e-9)); return n / (1 + n); };
        const nlTier = (pT, tAvg) => {
          const cc = pT ? pT.cc || 0 : 0, lo = Math.floor(cc), fr = cc - lo;
          if (!pT || fr < 1e-6 || !(pT.cd > 1)) return nlOf(tAvg);
          return (1 - fr) * nlOf(ttk(Object.assign({}, pT, { cc: lo }))) + fr * nlOf(ttk(Object.assign({}, pT, { cc: lo + 1 })));
        };
        const pooledT = res.length > 1 && parts.some((q) => q.kind === "tennokai");
        const nlParts = (tgx, shcx) => {
          let num = 0, den = 0, numW = 0, denW = 0;
          res.forEach((r, ri) => {
            const x = r.perF[f], wgt = weights[ri];
            const pI = Object.assign({}, base, { cc: r.cc != null ? r.cc : base.cc, cd: r.cd != null ? r.cd : base.cd, nc: r.nc != null ? r.nc : base.nc, D: x.D, D0: x.D0 != null ? x.D0 : x.D, blast: x.blast, F: x.F || 0, dot: x.dot, napH: x.napH || 0, pv: x.pv, ph: x.ph, pc: x.pc, pk: x.pk, pm: x.pm || 0, pp: x.pp || 0,
              hp: tgx.hp, sh: tgx.sh * shcx, ar0: tgx.ar, og: tgx.og || 0 });
            const nlI = nlTier(pI, ttk(pI)), carry = wgt * ((x.Dnon || 0) + (x.pbN || 0) * 1e3);
            num += carry * nlI; den += carry; numW += wgt * nlI; denW += wgt;
          });
          return den > 0 ? num / den : numW / Math.max(1e-12, denW);
        };
        const nonOf = (tKill, extraD, pT, tgx) => {
          const nl = pooledT && tgx ? nlParts(tgx, shc) : nlTier(pT, tKill), sc_ = (x) => x * nl;
          // Blast stacks spread by Melee Influence: fuse damage on each enemy, and the 10-stack detonations of its neighbours
          const lamN = acc.pbN * nl * main.rate;
          const detN = lamN > 0 ? (lamN / 10) * tail10(1.5 * lamN) : 0;
          return { D: (hasNon ? nonP.D * nl : 0) + extraD + (detN > 0 ? detN * n5c * unitB * 100 / Math.max(0.05, main.rate) : 0), blast: unitB * acc.pbN * nl, dot: hasNon ? Object.fromEntries(Object.entries(nonP.dot).map(([T, v]) => [T, sc_(v)])) : {},
            pv: hasNon ? sc_(nonP.pv) : 0, ph: hasNon ? sc_(nonP.ph) : 0, pc: hasNon ? sc_(nonP.pc) : 0, pk: hasNon ? sc_(nonP.pk) : 0 };
        };
        let kps, clear, Keff = main.K, ammoK = 1;
        // combined shot with punch through: enemies behind the first one take the direct hit only — the blast goes off on
        // the first enemy (wiki, Burston Prime Incarnon radial attack)
        if (res.length > 1 && parts[0].kind === "gun" && parts.some((p) => p.kind === "radial") && main.K > 1) {
          const d0 = res[0].perF[f], w0 = weights[0];
          const dirP = Object.assign({}, base, { D: d0.D * w0, blast: d0.blast * w0, F: (d0.F || 0) * w0, dot: Object.fromEntries(Object.entries(d0.dot).map(([T, v]) => [T, v * w0])),
            pv: d0.pv * w0, ph: d0.ph * w0, pc: d0.pc * w0, pk: d0.pk * w0, pm: (d0.pm || 0) * w0, hp: tg.hp, sh: tg.sh * shc, ar0: tg.ar });
          Keff = 1 + (main.K - 1) * Math.min(1, Math.max(tHit, period) / Math.max(ttk(dirP), period));
        }
        // chains / ricochets: from every enemy the shot hits directly, the j-th jump lands on another enemy at f^j of the damage
        // (statuses roll as usual). A bystander counts as killed in the same engagement in the share of the time it needs at
        // that damage (the same rule as blast bystanders below); every jump needs another enemy in the pack.
        if (main.chain && o.scenario === "crowd") {
          const ch = main.chain;
          let add = 0;
          for (let j = 1; j <= ch.n; j++) {
            const fj = ch.flat ? ch.f : Math.pow(ch.f, j);   // "flat": every jump at f of the main beam (Kuva Nukor, Tenet Cycron)
            let tj = tHit;
            if (fj < 0.999) {
              const q = Object.assign({}, pMain, { D: pMain.D * fj, blast: (pMain.blast || 0) * fj, F: (pMain.F || 0) * fj, napH: (pMain.napH || 0) * fj,
                dot: Object.fromEntries(Object.entries(pMain.dot || {}).map(([T, v]) => [T, v * fj])) });
              tj = ttk(q);
            }
            add += (ch.p == null ? 1 : ch.p) * Math.min(1, Math.max(tHit, period) / Math.max(tj, period));
          }
          Keff = Math.min(main.N, Keff * (1 + add));
        }
        // Blast status (wiki "Blast Damage"): an enemy that dies with Blast stacks — or from a killing blow that procs Blast —
        // explodes for up to 300% of the hit's base damage in 5 m. Each kill then takes a share of its neighbours with it.
        // Wiki "Blast Damage": "Upon reaching 10 blast stacks OR when an enemy afflicted with any amount of blast stacks dies, all
        // current stacks instantly detonate in a single 5m AoE explosion. The explosion deals 300% base damage per stack (10x of
        // single target damage) in a single damage instance. The detonating enemy only receives the single target damage";
        // "The 5m AoE damage has no falloff"; crit multipliers apply ("summing up the total damage from each individual blast
        // stack"). Stacks alive at death = procs of the last 1.5 s fuse, at most 10. Faction damage twice: in the per-proc unit.
        const pbl = (main.procs && main.procs.blast) || 0;
        let aoeBl = 0;
        if (o.scenario === "crowd" && pbl > 0 && acc.blast > 0) {
          const unit = acc.blast / pbl;
          const shots = 1 + tHit * main.rate;
          const onDeath = 1 - Math.exp(-pbl * Math.max(1, tHit * main.rate));
          const nSt = Math.max(1, Math.min(10, pbl * Math.min(shots, 1.5 * main.rate)));
          const dealt = ttk(Object.assign({}, base, { D: unit * 10 * nSt, blast: 0, F: 0, dot: {}, pv: 0, ph: 0, pc: 0, pk: 0, pm: 0, r: 0, hp: tg.hp, sh: tg.sh * shc, ar0: tg.ar }), o.dt);
          const n5 = Math.min(main.N - 1, (o.density || 0) * Math.PI * 25);
          Keff = Math.min(main.N, Keff * (1 + onDeath * n5 * Math.min(1, dealt / Math.max(1, tg.hp))));
          // 10-stack detonations: an enemy taking λ Blast procs a second reaches 10 inside one 1.5 s fuse with the Poisson
          // chance P(X ≥ 10 | 1.5λ) and then goes off every 10 procs; each one hits the others within 5 m. Every enemy the
          // shot strikes (direct hits and chain jumps — each rolls its own status) is such a source.
          const lam = pbl * main.rate, m = lam * Math.min(1.5, Math.max(0, tHit));   // v1.80: a struck enemy only builds stacks while it lives (one-shot = none)
          let pmf = Math.exp(-m), cdf = pmf; for (let k = 1; k < 10; k++) { pmf *= m / k; cdf += pmf; }
          const det = (lam / 10) * Math.max(0, 1 - cdf);
          const chainN = main.chain ? main.chain.n * (main.chain.p == null ? 1 : main.chain.p) : 0;
          const sources = Math.min(main.N, main.K * (1 + chainN));
          const near = Math.min(1, n5 / Math.max(1, main.N - 1));
          aoeBl = sources * det * near * unit * 10 * 10 / Math.max(0.05, main.rate);     // 10 stacks x 300% each, per shot, onto each enemy not struck
        }
        if (o.scenario === "crowd" && main.N > main.K && (hasNon || aoeBl > 0)) {
          const q = nonOf(tHit, aoeBl, pMain, tg);
          if (q.D > 0 || q.blast > 0 || Object.keys(q.dot).length) tNon = ttk(Object.assign({}, base, q, { hp: tg.hp, sh: tg.sh, ar0: tg.ar }));
          // engaging the heavy first: its many non-lethal hits keep spreading / detonating onto the pack the whole time
          if (tgs.heavy) { const qh = nonOf(tHeavy, aoeBl, pHeavy, tgs.heavy); if (qh.D > 0 || qh.blast > 0 || Object.keys(qh.dot).length) tNonH = ttk(Object.assign({}, base, qh, { hp: tg.hp, sh: tg.sh, ar0: tg.ar })); }
        }
        if (o.scenario === "crowd") {
          // bystanders in the blast die together with the target when the blast alone kills them about as fast
          if (Kaoe > 1) {
            const tA = ttk(Object.assign({}, base, aoe, { hp: tg.hp, sh: tg.sh * shc, ar0: tg.ar }));
            Keff = Math.max(Keff, 1 + (Kaoe - 1) * Math.min(1, Math.max(tHit, period) / Math.max(tA, period)));
          }
          // one engagement = keep firing until that target (and the ones lined up behind it) will die, then re-aim (guns).
          // The heavy mixed in is one of the engagements. Past one-shot kills more fire rate stops paying off.
          // (the first shot goes off as soon as the crosshair is on it, so a one-shot kill costs only the re-aim time,
          // unless the weapon's own fire interval is longer than that)
          // v1.87: the next target's first shot comes max(fire interval, re-aim) after the shot that killed (t, whole shots since
          // v1.87) — before: max(interval, re-aim + t), which let a 2-shot kill at 5 shots/s with no re-aim count as one interval
          const eng = (t) => t + Math.max(period, tAcq);
          const nL = main.N - (tgs.heavy ? 1 : 0) - (tgs.ex ? 1 : 0);
          const extra = (tgs.heavy ? eng(tHeavy) : 0) + (tgs.ex ? eng(tEx) : 0);   // the heavy and the Eximus are engagements of their own
          const sweep = (nL / Keff) * eng(tHit) + extra;
          const spread = isFinite(tNon) && tNon < 40 ? Math.max(tHit, tNon) + extra : Infinity;
          let lights = Math.min(sweep, spread);
          clear = lights;
          if (kx) {
            // kill explosions (Acid Shells: 450 + 45% max health in 10 m). Hotfix 44.1.3: enemies killed by the explosion don't
            // explode again, so each kill only takes that share of health off the enemies around it (no chain through the pack)
            const n10 = Math.min(main.N - 1, (o.density || 0) * Math.PI * kx.r * kx.r);
            const frac = Math.min(1, kx.pct + kx.flat / Math.max(1, tg.hp));
            const k2 = Math.min(main.N, Keff * (1 + n10 * frac));
            lights = Math.min(lights, (nL / k2) * eng(tHit) + extra);
            // the heavy mixed in also takes the explosions of the enemies killed near it
            let tExp = Infinity;
            if (tgs.heavy) {
              const fh = Math.min(1, kx.pct + kx.flat / Math.max(1, tgs.heavy.hp));
              const nearRate = (k2 / period) * n10 / Math.max(1, main.N - 1);
              tExp = tHit + Math.ceil(1 / fh) / Math.max(1e-6, nearRate);
            }
            clear = tgs.heavy ? Math.min(lights, (nL / k2) * eng(tHit) + eng(Math.min(tHeavy, tExp)) + (tgs.ex ? eng(tEx) : 0)) : lights;
          }
          if (acc.kf > 0 && main.kfR) {
            const nF = Math.min(main.N - 1, (o.density || 0) * Math.PI * main.kfR * main.kfR);
            const dealtF = ttk(Object.assign({}, base, { D: acc.kf, blast: 0, F: 0, dot: {}, pv: 0, ph: 0, pc: 0, pk: 0, pm: 0, r: 0, cc: 0, nc: 0, hp: tg.hp, sh: tg.sh * shc, ar0: tg.ar }), o.dt);
            const fracF = Math.min(1, dealtF / Math.max(1, tg.hp));
            const k3 = Math.min(main.N, Keff * (1 + nF * fracF));
            clear = Math.min(clear, (nL / k3) * eng(tHit) + extra);
          }
          // heavy first: while it is being hit the pack takes the spread; whatever is left of the pack is swept afterwards
          if (tgs.heavy && isFinite(tNonH) && tNonH < 40) {
            const left = tNonH > 1e-9 ? Math.max(0, 1 - tHeavy / tNonH) : 0;
            clear = Math.min(clear, eng(tHeavy) + (tgs.ex ? eng(tEx) : 0) + (lights - extra) * left);
          }
          // v2.06 an attack that strikes Keff enemies at once (blast radius, glaive explosion, swing, punch through) strikes the
          // pack around the heavy / the Eximus too while it is being worked on: those (Keff − 1) enemies take the same hits and
          // die with it when they need no longer than it does (the bystander rule above). Before, the heavy and the Eximus were
          // separate engagements and the lights were swept again afterwards — an explosion that covers the whole pack (Xoris
          // 9 m + Volatile Quick Return 3 m = 12 enemies) counted 0.8 extra throws on top of the heavy's, so the +3 m scored
          // −22% while every read Xoris/Glaive Prime build runs it (batch 15).
          if (tgs.heavy || tgs.ex) {
            const anchor = tgs.heavy ? tHeavy : tEx;
            const others = Math.max(0, Math.min(main.N - 1, Keff - 1)), share = others / Math.max(1, main.N - 1);
            const with_ = (t) => Math.min(1, Math.max(anchor, period) / Math.max(t, period));
            const lightsLeft = nL * (1 - share * with_(tHit));
            const exLeft = tgs.heavy && tgs.ex ? 1 - share * with_(tEx) : 0;
            const clr2 = eng(anchor) + exLeft * eng(tEx) + (lightsLeft / Keff) * eng(tHit);
            if (!o.noAoeAnchor) clear = Math.min(clear, clr2);
          }
          kps = main.N / Math.max(period, clear);
          // ammo in a long fight (players: "탄약이 부족해서 탄창·탄약 효율을 챙긴다"): rounds a wave costs vs rounds its kills drop.
          // Wiki "Ammo": solo, "Chance to drop Primary or Secondary Ammo" 45% per kill (taken as 22.5% each — the page gives
          // one chance for the pair), "Eximus are guaranteed to drop either a Primary or Secondary Ammo, each having the same
          // chance"; a pickup gives the weapon's AmmoPickup (wiki weapon data). Steady state: when a wave costs more than it
          // drops, the kill rate falls to what the drops can pay for (the starting reserve only delays that).
          ammoK = 1;
          if (o.ammoLimit !== false && main.ammo && main.ammo.pickup > 0 && !main.ammo.resupply && !main.inc) {
            const perShotR = main.ammo.use / Math.max(1e-6, main.rate);
            const shotsAt = (t) => 1 + Math.max(0, t) * main.rate;
            const lightShots = Math.min((nL / Keff) * shotsAt(tHit), Math.max(1, lights - extra) * main.rate);
            const shots = lightShots + (tgs.heavy ? shotsAt(tHeavy) : 0) + (tgs.ex ? shotsAt(tEx) : 0);
            const nEx = tgs.ex ? 1 : 0;
            const income = main.ammo.pickup * (1 + (main.ammo.conv || 0)) * ((main.N - nEx) * 0.225 + nEx * 0.5);
            const cost = shots * perShotR;
            if (cost > income) { ammoK = income / cost; kps *= ammoK; }
          }
        } else { clear = Math.max(period, tHit); kps = 1 / clear; }
        return { ttk: tHit, ttkHeavy: tHeavy, ttkEx: tgs.ex ? tEx : null, ttkNon: tNon, kps, clear, ammoK, target: tg, targetHeavy: tgs.heavy || null, Keff,
          one: oneHit(pMain), oneHeavy: tgs.heavy ? oneHit(pHeavy) : oneHit(pMain) };
      };
      // the hardest enemy of the scenario at any level (crowd: the heavy mixed in; single: heavy with overguard if set; boss)
      const hardAt = (lv) => {
        const tier = o.scenario === "boss" ? "boss" : "heavy";
        const tg = enemyStats(f, tier, lv, o.steel);
        const shc = 1 - (o.ext.shieldCut || 0);
        return Object.assign({}, base, hitP, { hp: tg.hp, sh: tg.sh * shc, ar0: tg.ar, og: o.og ? overguardAt(lv) : 0 });
      };
      const lo = solve(targets.lo[f]), hi = solve(targets.hi[f]), top = targets.top ? solve(targets.top[f]) : hi;
      // highest level where the first attack alone still kills that enemy (its own procs land after its damage)
      let oneLv = 0;
      if (oneHit(hardAt(1))) {
        let a = 1, b = 9999;
        if (oneHit(hardAt(b))) oneLv = b;
        else { while (b - a > 1) { const m = (a + b) >> 1; if (oneHit(hardAt(m))) a = m; else b = m; } oneLv = a; }
      }
      const disp = res.reduce((s, r) => { const x = r.perF[f]; s.direct += x.dispDirect; s.dot += x.dispDot; s.blast += x.dispBlast; for (const T in x.dispDotBy) s.dotBy[T] = (s.dotBy[T] || 0) + x.dispDotBy[T]; return s; }, { direct: 0, dot: 0, blast: 0, dotBy: {} });
      perF[f] = Object.assign({}, lo, { hi, top, oneLv, period, kps: Math.cbrt(lo.kps * hi.kps * top.kps), kpsLo: lo.kps, direct: disp.direct, dot: disp.dot, blast: disp.blast, dotBy: disp.dotBy, perShot: disp.direct + disp.dot + disp.blast });
    }
    const vals = o.factions.map((f) => perF[f].kps);
    let score = o.metric === "min" ? Math.min(...vals) : Math.exp(vals.reduce((s, x) => s + Math.log(Math.max(x, 1e-9)), 0) / vals.length);
    if (main.conceptD > 0 && o.conceptPenalty !== false) score *= Math.pow(0.01, main.conceptD);   // outside the element concept: ranks below builds inside it
    return Object.assign({}, main, { score, perF, kills, tenno: tn, parts: res.map((x, i) => ({ kind: parts[i].kind, radius: parts[i].radius || 0, share: x.share, bounce: !!parts[i].bounceOnly })) });
  }

  // distance falloff [start, end, reduction]: crowd = enemies spread 2–20 m (area-weighted), single target at 15 m
  function distFall(fo, o) {
    if (!fo) return 1;
    const [s0, e0, red] = fo;
    const at = (d) => d <= s0 ? 1 : d >= e0 ? 1 - red : 1 - red * (d - s0) / Math.max(1e-6, e0 - s0);
    if (o.scenario !== "crowd") return at(o.dist || 15);
    let num = 0, den = 0;
    for (let d = 2.25; d < 20; d += 0.5) { num += at(d) * d; den += d; }
    return num / den;
  }
  // minimum arming distance (wiki Acceltra "will not explode if they make contact with objects or enemies within that range",
  // Tonkor 7.5 m): share of shots whose target is far enough to explode — crowd = the same 2–20 m area-weighted spread as
  // distFall, single target at o.dist (15 m). The direct hit still lands; only the explosion part is scaled.
  function armFrac(arm, o) {
    if (!arm) return 1;
    if (o.scenario !== "crowd") return (o.dist || 15) >= arm ? 1 : 0;
    let num = 0, den = 0;
    for (let d = 2.25; d < 20; d += 0.5) { num += (d >= arm ? 1 : 0) * d; den += d; }
    return num / den;
  }
  // Secondary Enervate: +10% crit chance per hit, resets after 6 big crits — average crit chance over one cycle
  function enervateCC(cc0) {
    let cc = cc0, big = 0, sum = 0, n = 0;
    while (big < 6 && n < 400) { sum += cc; n++; big += Math.max(0, Math.min(1, cc - 1)); cc += 0.1; }
    return sum / Math.max(1, n);
  }
  const isMeleeKind = (k) => k === "melee" || k === "heavy" || k === "glaive" || k === "tennokai";
  // uptime of an on-trigger buff: chance at least one trigger happened within the last t seconds
  const uptime = (lambda, t) => 1 - Math.exp(-Math.max(0, lambda) * t);
  function typeOk(def, weapon) {
    if (def.types && !def.types.includes(weapon.type)) return false;
    if (def.notTypes && def.notTypes.includes(weapon.type)) return false;
    return true;
  }

  // per-shot parameters for one attack part (before enemy state), using the best element layout by steady-state damage
  function perShot(weapon, atk, mods, o, riven, parentAtk) {
    const kills = o.scenario === "boss" ? false : o.kills;
    const oo = Object.assign({}, o, { kills });
    const a = aggregate(mods, oo, riven);
    // Incarnon evolution perks that act like a mod (fire rate, reload, direct damage per status type…) ride on the attack
    if (atk.evoEff) applyEff(a, atk.evoEff);
    // conditional perks whose condition the calculator can check (armor, max energy, channeled ability, kills, crowd …);
    // "on punch-through hit" needs punch through and more than one enemy in line
    if (atk.evoCond) for (const c of atk.evoCond) {
      const on = c.when === "ptHit" ? o.scenario === "crowd" && (a.pt + (atk.pt || 0)) > 0 : condActive(c.when, oo);
      if (on) applyEff(a, c.eff);
    }
    // Devouring/Devastating Attrition (wiki Laetum/Felarx): "50% chance to deal +2000% damage on non-critical hits" —
    // "Bosses ignore this perk."
    if (o.scenario === "boss") a.nc = 0;
    a.pt += atk.pt || 0;                 // innate punch through of the attack (wiki), e.g. Phenmor Incarnon Form 3 m
    const sp = atk.evoSp || {};          // perks that read the weapon's own final stats (Prelude of Might, Wiseman's Regard …)
    const ext = o.ext || {};
    // ability elements (Electric Shield, Toxic Lash, Xata's Whisper, Nourish) stay separate — they never combine.
    // "*mod" keys (Violet shard electricity) behave like an elemental mod: added to a mod of that element, else after the mods.
    const tail = [], abilEl = {};
    if (ext.elem) for (const k in ext.elem) {
      if (k.endsWith("mod")) { const p = k.slice(0, -3); if (a.elem[p] > 0 && !ext.shardLast) a.elem[p] += ext.elem[k]; else tail.push([p, ext.elem[k]]); }
      else if (k in a.extra) { a.extra[k] += ext.elem[k]; const tt = k.slice(0, -1) === "voi" ? "void" : k.slice(0, -1); abilEl[tt] = (abilEl[tt] || 0) + ext.elem[k]; }
    }
    const arc = o.arcane ? (root.WF_ARCANES || {})[o.arcane] : null;
    if (arc) {
      if (arc.eff) applyEff(a, arc.eff);
      if (arc.cond) for (const c of arc.cond) { const f = condScale(c, oo); if (f > 0) applyEff(a, c.eff, f); }
    }
    if (arc && arc.energyMs) a.ms += Math.min(3.5, arc.energyMs * (o.maxEnergy || 300) / 100);
    if (arc && arc.bulwark) a.dmg += Math.min(5, Math.max(0, ((o.armor || 0) - 1000) * 0.01));
    // Melee Retaliation: +30% melee damage per 200 current shields (max 2,800 → +420%). No shield input → assume full.
    if (arc && arc.retaliation) a.dmg += 0.3 * Math.floor(Math.min(2800, o.shield > 0 ? o.shield : 2800) / 200);
    if (o.mercy && weapon.mercyBuff) { a.dmg += 1; a.ms += 1; }
    if (weapon.type === "Bow" && a.frBow) a.fr += a.frBow;
    // exalted weapons (wiki ability pages): Ability Strength multiplies the base damage ("base"), or adds an innate
    // damage bonus (Regulators: +150% x Strength), or a multiplier additive with Serration (Neutralizer/Lizzie: 1.25x x Strength)
    let exS = 1, exChain = 1;
    const ex = weapon.exalted;
    if (ex) {
      const S = o.exStr || 1;
      if (ex.mode === "base") exS = S;
      else if (ex.mode === "bonus") a.dmg += (ex.k || 1.5) * S;
      else if (ex.mode === "mult") a.dmg += (ex.k || 1.25) * S - 1;
      if (ex.chain) exChain = 1 + ex.chain;                  // Peacemaker: +150% once a 20-shot chain is going (sustained fire)
      if (ex.passive) { a.dmg += ex.passive.dmg || 0; a.fr += ex.passive.fr || 0; }   // Excalibur passive
    }
    // sniper scope while aiming: bonus of the highest zoom level, additive with the matching mods (wiki weapon data)
    if (o.aim && weapon.zoom) {
      const z = weapon.zoom;
      a.cd += z.cd || 0; a.ccFlat += z.ccFlat || 0; a.dmg += z.dmg || 0;
      if (z.hs) a.hsMult += (atk.hsMult || 2) * z.hs;
    }
    if (ext.reloadAdd) a.reload += ext.reloadAdd;
    if (ext.phoenix) a.phoenix = ext.phoenix;
    // magazine-based mods: Clip Delegation (+X per trigger pull landed in the last magazine, capped) and
    // Repeater Clip (fire rate for 9 s after a reload while aiming: full uptime if the magazine empties within it)
    // Ammo Efficiency: that share of shots uses no ammo (cap 75%, Hotfix 44.1.3: "only 1 in 4 shots will consume ammo"),
    // so a magazine lasts 1/(1 - eff) times as many shots and the weapon reloads that much less often
    // Perigale "Gale Force" (wiki Perigale): "Landing 4 headshots in a burst or a headshot kill grants the "Gale Force" buff,
    // granting Infinite Ammo. The buff lasts 4 seconds and can be refreshed on subsequent chained headshots"; "Multishot …
    // and Punch Through hitting multiple heads all count as separate headshot hits". Only with real headshots (o.hs, not
    // Sonar weak points). Triggers = bursts with ≥4 headshot hits (binomial, hits = burst shots × multishot, each a headshot
    // with chance o.hs); headshot kills are left out (lower bound). Share of shots fired under the buff ≈ 1 − e^(−rate × 4 s);
    // those shots use no ammo (no magazine, no reserve), so reloads come 1/(1 − g) times less often.
    let galeG = 0;
    if (weapon.galeForce && !isMeleeKind(atk.kind) && (o.hs || 0) > 0) {
      const gf = weapon.galeForce, p = Math.min(1, o.hs), bn = atk.burst ? atk.burst[0] : 1;
      const hitsB = bn * (atk.pellets || 1) * Math.max(0, 1 + a.ms + (ext.msAdd || 0));
      const atLeast = (n) => { let q = 0, c = 1; for (let k = 0; k <= n; k++) { if (k >= gf.hits) q += c * Math.pow(p, k) * Math.pow(1 - p, n - k); c = c * (n - k) / (k + 1); } return q; };
      const nf = Math.floor(hitsB), w = hitsB - nf, pB = (1 - w) * atLeast(nf) + w * atLeast(nf + 1);
      const bursts = (atk.fr || 1) * Math.max(0.05, 1 + a.fr + a.frneg + (ext.frAdd || 0)) / bn;
      galeG = Math.min(0.99, 1 - Math.exp(-bursts * pB * gf.dur));
    }
    // v1.96: a magazine of n rounds holds n / AmmoCost shots (wiki weapon data AmmoCost; Tenet Glaxion "Consumes 0.5 ammo per tick
    // of damage" → 90 rounds = 180 ticks; Primary Plated Round: "Double the amount shown for most continuous weapons, which consume
    // ammo differently"; Quanta cube 10, Kohm full spool 4 per shot). AmmoCost 0 (Regulators, Cedo glaive …) never empties.
    const ammoCostM = atk.ammoCost != null ? atk.ammoCost : atk.parts && atk.parts[0] && atk.parts[0].ammoCost != null ? atk.parts[0].ammoCost : 1;
    const magShots = (n) => (ammoCostM > 0 ? n / ammoCostM : 1e9) / (1 - Math.min(0.75, Math.max(0, a.ammoEff || 0))) / (1 - galeG);
    // v2.02: modded magazine capacity is a whole number — wiki Primed Magazine Warp: "For any non-integer magazine values the
    // magazine size is simply rounded to the nearest whole number" (Braton 45 x 1.55 = 69.75 -> 70). Matters for 1-round magazines:
    // Kuva Tonkor + Primed Magazine Warp 1.55 -> 2 (arsenal screenshot shows 2), + Magnetic Capacity alone 1.4 -> 1 (no extra round).
    const magCap = (base) => Math.max(1, Math.round(base * (1 + a.mag)));
    for (const m of mods) {
      if (!m || !atk.mag) continue;
      const magN = Math.max(1, magShots(magCap(atk.mag)));
      if (m.clipDeleg) { const stk = Math.min(m.clipDeleg.max, Math.floor(magN)); a.sc += m.clipDeleg.per * stk; a.ms += m.clipDeleg.per * stk; }
      if (m.reloadBuff && (!m.reloadBuff.aim || o.aim)) {
        const frB = (atk.fr || 1) * Math.max(0.05, 1 + a.fr + m.reloadBuff.fr);
        a.fr += m.reloadBuff.fr * Math.min(1, m.reloadBuff.t / (magN / frB));
      }
    }
    const kind = atk.kind;
    const tenno = kind === "tennokai" ? atk.tenno : null;
    const isMelee = kind === "melee" || kind === "heavy" || kind === "glaive" || kind === "tennokai";
    const isHeavy = kind === "heavy" || kind === "glaive" || kind === "tennokai";
    // Primary Compression (aiming): blast radius x0.2, +100% damage per metre lost (wiki "Primary Compression").
    // v2.01: "On projectile weapons, the damage bonus is multiplicative to other damage bonus sources (e.g. Serration)"; the
    // wiki effectiveness table lists Tonkor / Kuva Tonkor, Ogris / Kuva Ogris and Zarr cannon "Multiplies", hitscan ones such as
    // Braton / Burston Incarnon "Adds", and Zarr / Kuva Bramma bomblets "Doesn't work". So: a projectile shot (explosive parts
    // carry ptLock) multiplies every part of that shot (the direct hit too — "the weapon's damage"), otherwise it adds; cluster
    // bomblets keep their radius and get nothing. Before v2.01 it was always added beside Serration (e.g. Kuva Tonkor: 1 + 1.65 +
    // 5.6 instead of 2.65 × 6.6).
    let radiusMul = 1, compM = 1;
    if (arc && arc.compression && o.aim && !atk.cluster) {
      const grp = parentAtk && parentAtk.parts ? parentAtk.parts : [atk];
      const R = atk.radius || (grp.find((p) => p.radius && !p.cluster) || {}).radius || 0;
      if (R > 0) {
        const lost = R * 0.8;
        if (grp.some((p) => p.ptLock) || atk.ptLock) compM = 1 + lost; else a.dmg += lost;
        a.ammoEff += 0.055 * lost;
        if (atk.radius) radiusMul = 0.2;
      }
    }
    const base0 = Object.values(atk.dmg).reduce((s, x) => s + x, 0) * (o.evoHeavyScale && atk.evoScaleAlt ? atk.evoScaleAlt : 1);
    const vpct = o.val && o.val.type ? o.val.pct : 0;
    const Btot = (base0 + (a.baseAdd || 0)) * (1 + vpct) * compM;

    const rho = o.density;
    // atk.fsLock: Firestorm doesn't reach this explosion (wiki Trumna "Explosion range cannot be increased with Firestorm")
    const radius = ((atk.radius || 0) * (kind === "glaive" ? 1 : 1 + (atk.fsLock ? 0 : a.blastR)) + (kind === "glaive" ? a.radius : 0)) * radiusMul;
    let N, K, n3, n5, waveAoe = 0;
    if (o.scenario === "crowd") {
      N = o.crowdN;
      const lineMu = o.lineMean != null ? o.lineMean : (rho > 0 ? rho * BODY_W * 8 * Math.sqrt(N / (Math.PI * rho)) / (3 * Math.PI) : 0);
      const key = (parentAtk || atk).name;
      if (o.hits && o.hits[key]) K = o.hits[key];
      // v2.07 Exalted Blade energy waves (wiki Exalted Blade, docs/mechanics/gaps_melee.json): "Normal, slide, and aerial attacks
      // will emit a 3 meter-wide energy wave in the direction of aim. Energy waves have the same base damage as the attacks that
      // release them"; "The energy waves and Exalted Blade itself are considered separate entities and will both deal damage
      // separately"; "Energy waves will punch through and hit enemies … up to their maximum range"; "Wave damage falls off linearly
      // with distance from 100% to 0% between 0 and 70m"; "Energy waves lose 20% of their damage each time they hit an enemy".
      // The wave strikes the swung-at target (falloff at 2 m, in convert.py) and the enemies whose centre lies in its 3 m strip
      // (+ a body width) behind it — the same crowd geometry as punch through (v1.91), density × width × mean depth 8R/3π.
      // Those extras take 0.8^k of it (k-th enemy past the target) at the falloff of the mean depth (waveAoe, relative to the
      // target's hit). "lose 40% of their damage per second" (30 m/s) is read as the same falloff told in time (40%/s × 70/30 s
      // ≈ 93% at 70 m), not a second loss.
      else if (atk.wave && rho > 0) {
        const R = Math.sqrt(N / (Math.PI * rho)), depth = 8 * R / (3 * Math.PI), mu = rho * (atk.wave.w + BODY_W) * depth;
        let pk = Math.exp(-mu), cdf = pk, sum = 0, en = 0;
        for (let k = 1; k < 30; k++) { const ge = 1 - cdf; sum += Math.pow(1 - atk.wave.loss, k) * ge; en += ge; pk *= mu / k; cdf += pk; }
        const fT = Math.max(0, 1 - atk.wave.d0 / atk.wave.end), fB = Math.max(0, 1 - (atk.wave.d0 + depth) / atk.wave.end);
        K = Math.min(N, 1 + en);
        waveAoe = en > 0 && fT > 0 ? (sum / en) * (fB / fT) : 0;
      }
      else if (radius > 0) K = Math.max(1, Math.min(N, rho * Math.PI * radius * radius));
      else if (atk.punch) K = Math.min(N, 1 + lineHits(Infinity, lineMu));
      // punch-through: the enemies lined up behind the target (Poisson, mean 2) that the punch-through distance can pass
      // (0.6 m per body) — 3 m already reaches almost all of them, so more distance adds little. Explosive projectiles burst on first contact
      // and can't use it (wiki "Punch Through": the stat is locked for projectile AoE weapons)
      else if (!isMeleeKind(kind) && a.pt > 0 && !atk.ptLock && !(parentAtk && parentAtk.ptLock)) K = Math.min(N, 1 + lineHits(a.pt / BODY_PT, lineMu));
      else if (kind === "melee") K = Math.min(N, 2);
      else K = 1;
      n3 = Math.min(N, 1 + rho * Math.PI * 9);
      n5 = Math.min(N - 1, rho * Math.PI * 25);
    } else { N = 1; K = 1; n3 = 1; n5 = 0; }
    const dur = Math.max(0.05, 1 + a.dur + (ext.durAdd || 0));

    // warframe arcanes that buff the weapon (uptime from how often their trigger fires, using pre-buff numbers)
    let cdFinal = 1;
    const FA = root.WF_FRAME_ARCANES || {};
    for (const id of o.frameArcs || []) {
      const def = FA[id]; if (!def || def.kind !== "weapon") continue;
      const slotOk = def.slot === "any" || def.slot === weapon.slot || (def.slot === "gun" && weapon.slot !== "melee");
      if (!slotOk || !typeOk(def, weapon)) continue;
      let up = 1;
      if (def.trig) {
        const fr0 = (atk.fr || 1) * Math.max(0.05, 1 + a.fr), ms0e = (atk.pellets || 1) * Math.max(1, 1 + a.ms);
        const hits = (isMelee ? fr0 * 1.5 : fr0) * (isMelee ? 1 : ms0e);
        const cc0 = Math.min(1, (atk.cc || 0) * (1 + a.cc * (isHeavy ? 2 : 1)) + a.ccFlat);
        const lam = def.trig === "crit" ? hits * cc0 * def.p : def.trig === "hit" ? hits * def.p
          : def.trig === "hs" ? hits * Math.max(o.hs || 0, (ext.weakFrac || 0)) * def.p
          : def.trig === "reload" ? (atk.mag ? fr0 / Math.max(1, magShots(magCap(atk.mag))) : 0) * def.p : 0;
        up = uptime(lam, def.t);
      }
      for (const k in def.eff || {}) a[k] = (a[k] || 0) + def.eff[k] * up;
      if (def.cdFinal) cdFinal *= def.cdFinal;
    }

    let rate, M = 1;
    // combo built by swinging (shared by normal swings and Tennokai heavies)
    const swingTier = (fr) => {
      if (!(o.comboWindow > 0)) return comboTier(o.meleeCombo);
      const hps = (fr || 1) * Math.max(0.2, 1 + a.fr + (ext.asAdd || 0)) * 1.5;
      const Ks = o.scenario === "crowd" ? Math.min(o.crowdN, 2) : 1;
      return comboAvg(a.ic + (ext.icAdd || 0), hps * Ks * (o.comboPts || 1.5) * Math.max(0, 1 + (a.ccc || 0)), o.comboWindow);
    };
    if (isHeavy) {
      // wind-up (and glaive charged throws) only speed up with Heavy Attack Wind Up Speed, not attack speed (wiki "Attack Speed");
      // attack speed only shortens the heavy swing animation after the wind-up
      const tw = (atk.windup || 1) / Math.max(0.2, 1 + a.wind + (ext.windAdd || 0));
      let over = 0.3 / Math.max(0.2, 1 + a.fr + (ext.asAdd || 0));
      if (kind === "glaive") {
        // the glaive has to fly out and come back before the next throw: travel time at its projectile speed
        const d = o.scenario === "crowd" ? 13.4 : (o.dist || 15);
        over = atk.throwSpeed ? 0.15 + (2 * d) / (atk.throwSpeed * (1 + a.throwSpd)) : o.throwOverhead;
      }
      rate = 1 / (tw + over);
      // o._tennoOnly (no-pooling bound): a Tennokai takes one swing period, as in the pooled model
      if (kind === "tennokai" && o._tennoOnly) rate = (atk.swingFr || 1) * Math.max(0.2, 1 + a.fr + (ext.asAdd || 0)) * 1.5;
      // glaive: the thrown glaive's own hits build combo (explosion-only hits don't — wiki), a heavy-attack
      // detonation spends it; Volatile bounce explosions get no combo multiplier and spend nothing
      const gain = kind === "glaive" ? (o.scenario === "crowd" ? Math.min(3, K) : 1) : K;
      M = kind === "tennokai" ? swingTier(atk.swingFr) : atk.bounceOnly ? 1 : comboMult(a.ic + (ext.icAdd || 0), a.hae, gain, o.comboHits, 1 / rate, a.ccc);
    } else if (kind === "melee") {
      rate = (atk.fr || 1) * Math.max(0.2, 1 + a.fr + (ext.asAdd || 0)) * 1.5;
    } else {
      let fr = a.lock > 0 && atk.semi ? atk.fr : atk.fr * Math.max(0.05, 1 + a.fr + a.frneg + (ext.frAdd || 0));
      // burst weapons (atk.burst = [shots, delay, arsenal bursts/s]; atk.fr is already shots/s): positive fire rate scales
      // "both the speed of the burst as well as the time between bursts", but "Burst Delay is not affected by net negative
      // Fire Rate bonuses" (wiki Fire Rate)
      if (atk.burst && !(a.lock > 0 && atk.semi)) {
        const f = Math.max(0.05, 1 + a.fr + a.frneg + (ext.frAdd || 0));
        if (f < 1) { const [bn, bd, b0] = atk.burst; fr = bn / (1 / (b0 * f) + bn * bd); }
      }
      // Semi-auto: the game's Accessibility option "Fire Manual Trigger Weapons Continuously" fires semi-automatic weapons for as
      // long as the trigger is held (overframe news 11, wiki Trigger_Type), so the modded fire rate counts in full. o.semiCap (shots
      // per second) caps it for someone clicking by hand.
      if (atk.semi && o.semiCap > 0) fr = Math.min(fr, o.semiCap);
      // spool-down while the trigger is held (Phenmor Incarnon Form: 100% → 60% over 51 shots, reset on release):
      // short bursts, so the average rate over one 51-shot burst
      if (atk.spoolDown) { const to = atk.spoolDown[1]; fr *= (1 - to) / Math.log(1 / to); }
      const mag = Math.max(1, magShots(magCap(atk.mag || 30)));   // shots between reloads
      let reload = (atk.reload || 2) * (atk.byRound ? Math.max(0.1, magCap(atk.mag || 30) / (atk.mag || 30)) : 1) / Math.max(0.1, 1 + a.reload);
      // Cyte-09 Resupply (wiki): casting instantly reloads the held firearm → a reload costs only the cast
      if (ext.reloadCast != null) reload = Math.min(reload, ext.reloadCast);
      // spool-up (Gorgon, Soma, Cestra …: wiki "Spool" shots, starting near 60% fire rate): ~0.28 x shots of extra time per magazine
      // beam damage ramp (wiki, e.g. Amprex 30% → 100% over 0.6 s, decays after 0.8 s without firing): moving between targets
      // keeps the trigger held, so it ramps once per magazine — the linear ramp costs (1 − start) × T / 2 of full-damage time
      const spoolT = (atk.spool && atk.mag ? 0.277 * atk.spool / fr : 0) + (atk.beamRamp && atk.mag ? (1 - atk.beamRamp[0]) * atk.beamRamp[1] / 2 : 0);
      rate = atk.mag ? mag / (mag / fr + spoolT + reload) : fr;
      // Charged shots — wiki Fire Rate "Fire Rate and Charge Time": "Charge Time = Base Charge Time / (1 + Mod Bonus)" (bows get the
      // "x2 for Bows" bonus already in a.fr), "charge time cannot go above 10 times the base charge time"; time per shot:
      // bows and Epitaph "1 / (Modded Charge Time + Modded Reload Time)", Lanka "1 / Modded Charge Time" (plus its magazine reload),
      // other charge weapons "1 / (Modded Charge Time + 1 / Modded Fire Rate)" (plus the magazine reload).
      if (atk.charge > 0 && !(a.lock > 0 && atk.semi)) {
        const ct = atk.charge / Math.max(0.1, 1 + a.fr + a.frneg + (ext.frAdd || 0));
        if (weapon.type === "Bow" || weapon.en === "Epitaph") rate = 1 / (ct + reload);
        else if (/^Lanka$/.test(weapon.en)) rate = mag / (mag * ct + reload);
        else rate = atk.mag ? mag / (mag * (ct + 1 / fr) + reload) : 1 / (ct + 1 / fr);
      }
    }
    // Burst-per-magazine evolutions (burst attacks only; nb = full bursts in one modded magazine):
    // Reaver's Rapture (wiki Burston Incarnon Genesis): "On Full Burst Hit: +20% Damage, resets on Reload", "Caps at 5x for +100%
    // damage, additive with base damage mods such as Serration", "activates even if the first hit of a burst kills the target",
    // "cannot be stacked in Incarnon form" → burst k (k = 0, 1, …) of a magazine has min(k, cap) stacks; average over the magazine.
    // Forceful Finality: "+5 Base Multishot on final magazine burst", "added before mods, and is thus multiplied by multishot
    // bonuses". The magazine is whole rounds (arsenal: 45 × (1 − 0.432) = 25.56 shows 26) and a magazine that isn't a multiple of
    // the burst ends in a short burst — wiki Burston Prime tips: "you might be reduced to only 1 or 2 rounds in your last shot"
    // (independent review 2026-11-07). Per round: the final burst's rounds get 1 + 5 base multishot, so 1 + 5 × last / magazine;
    // Reaver's stacks are weighted by the rounds of each burst (the short last burst fires with min(full bursts, cap) stacks).
    let burstAdd = 0, finalMs = 0;
    if (atk.burst && atk.mag && (a.burstDmg > 0 || a.finalBurstMs > 0)) {
      const bn = Math.max(1, atk.burst[0]), m = magCap(atk.mag);
      const nb = Math.floor(m / bn + 1e-9), rem = m - nb * bn;
      if (a.burstDmg > 0) { const cap = Math.max(1, a.burstCap || 1); let s = 0; for (let k = 0; k < nb; k++) s += bn * Math.min(k, cap); s += rem * Math.min(nb, cap); burstAdd = a.burstDmg * s / m; }
      if (a.finalBurstMs > 0) finalMs = a.finalBurstMs * (rem || Math.min(bn, m)) / m;
    }
    const dmgb = a.dmg + burstAdd + (isHeavy ? a.heavy : 0) + (ext.dmgAdd || 0) + (tenno && o.tennoAdd ? tenno.dmg || 0 : 0) + (a.firstShot && atk.mag ? a.firstShot / Math.max(1, magShots(magCap(atk.mag))) : 0);
    const msLock = a.msLock > 0;
    // atk.noMs: a radial part the wiki says multishot doesn't multiply (one blast per trigger pull)
    // accuracy-lowering mods: fewer of the shots reach the enemy (see hitShare); the flat spread goes on the max deviation (wiki
    // examples), o.spreadFlatBoth also puts it on the min (not stated on the wiki)
    let accF = 1;
    const spr = atk.spread || (parentAtk && parentAtk.spread);
    if (spr && (a.spreadAdd > 0 || a.spreadPct > 0) && !isMeleeKind(kind)) {
      const lo = spr[0] * (1 + a.spreadPct) + (o.spreadFlatBoth ? a.spreadAdd : 0), hi = spr[1] * (1 + a.spreadPct) + a.spreadAdd;
      accF = hitShare((lo + hi) / 2) / Math.max(1e-9, hitShare((spr[0] + spr[1]) / 2));
    }
    const ms0 = (atk.noMs ? 1 : ((atk.pellets || 1) + finalMs) * (msLock ? 1 : Math.max(0, 1 + a.ms + (ext.msAdd || 0)))) * accF;
    const tierNow = isHeavy ? M : (isMelee ? swingTier(atk.fr) : 1);
    // Hata-Satya (wiki): "Each hit increases Critical Chance by 1.2%", "additive with similar mods", capped at +500%,
    // multishot and punch-through hits count, "Bonus ends as soon as the reload animation begins" (switching to the Incarnon
    // Form counts as a reload). Average over one magazine of hits (linear ramp 0 → min(cap, 1.2% × hits)).
    let hataAdd = 0;
    if (a.hata > 0 && !isMelee) {
      const shots = atk.inc ? (atk.incAmmo || 0) : (atk.mag ? magShots(magCap(atk.mag)) : 0);
      const H = Math.max(0, shots) * ms0, Hc = 5 / a.hata;
      hataAdd = H <= 0 ? 0 : H <= Hc ? a.hata * H / 2 : 5 - 5 * Hc / (2 * H);
    }
    const ccMod = (isHeavy ? 2 * a.cc : a.cc) + a.ccHeavyNoDouble + (ext.ccAdd || 0) + hataAdd;
    const scMul = 1 + a.sc + a.ww * Math.max(0, tierNow - 1) + (ext.scAdd || 0) + (tenno ? tenno.sc || 0 : 0) + (isHeavy ? ext.heavySc || 0 : 0);
    // High Ground / Decisive Stature: base crit chance + a share of the current status chance
    const hgAdd = sp.highground ? Math.min(sp.highground.cap, sp.highground.v * Math.max(0, (atk.sc || 0) * scMul + a.scFlat)) : 0;
    let ccBase = ((atk.cc || 0) + a.ccBase + hgAdd) * (1 + ccMod + (a.br + (isMelee ? a.glad : 0)) * Math.max(0, tierNow - 1)) + a.ccFlat + (ext.ccFlat || 0);
    ccBase = Math.max(0, ccBase);
    if (o.arcane === "melee_animosity" && isHeavy) ccBase += (atk.cc || 0) * 0.42 * 1.5;
    if (arc && arc.enervate) ccBase = enervateCC(ccBase);
    // Vigilante set: a crit has a chance to go one tier higher = same average as that much more crit chance on crits
    if (a.vigil && weapon.slot === "primary") ccBase += a.vigil * Math.min(1, ccBase);
    const preludeAdd = sp.prelude && ccBase < sp.prelude.below ? sp.prelude.v : 0;   // Prelude of Might: low crit chance → higher base crit multiplier
    const cdBase = (((atk.cd || 1.5) + a.cdBase + preludeAdd) * (1 + a.cd + (ext.cdAdd || 0) + (tenno ? tenno.cd || 0 : 0)) + a.cdFlat) * (ext.cdMult && !isMelee ? ext.cdMult : 1) * cdFinal + (!isMelee && ext.cdFinalAdd ? ext.cdFinalAdd : 0);   // Tenacious Bond: flat, after every multiplier
    // Wiseman's Regard: base status chance + a share of the current crit chance; "added after mods" evolution bonuses (scFlat)
    const wiseAdd = sp.wise ? Math.min(sp.wise.cap, sp.wise.v * ccBase) : 0;
    const sc = Math.max(0, ((atk.sc || 0) + wiseAdd) * scMul + a.scFlat);
    const sd = a.sd + (isHeavy ? ext.heavySd || 0 : 0);
    const influence = o.arcane === "melee_influence" && isMelee;
    const dupD = o.arcane === "melee_duplicate" ? 1 : o.arcane === "melee_duplicate1" ? 0.4 : 0;
    let hsFrac = o.hs || 0, hsM = (atk.hsMult || 2) + a.hsMult;
    if (ext.weakFrac) { hsFrac = Math.max(hsFrac, ext.weakFrac); hsM = Math.max(hsM, ext.weakMult || 1); }
    const hsm = hsFrac > 0 ? (1 - hsFrac) + hsFrac * hsM : 1;
    // riven "weak point critical chance" (Update 44.1 splice): extra crit chance on weak point hits only
    if (a.wpcc > 0 && hsFrac > 0) ccBase += (atk.cc || 0) * a.wpcc * Math.min(1, hsFrac);
    // Gotva Prime (wiki): "Status Effects have a 15% chance to set the next shot's Critical Chance to 300%", rolled "separately
    // for each bullet", and the set value "ignores all other modifiers". The wiki doesn't say whether one roll boosts every
    // pellet of the next shot, so the lower bound is used: the boosted share of bullets = 15% × status chance (≤ 100%).
    // Average crit damage is linear in crit chance (1 + cc × (cd − 1)), so blending the chance is exact for the average.
    if (weapon.procCrit && !isMelee) {
      const f = Math.min(1, weapon.procCrit.p * Math.min(1, sc));
      ccBase = (1 - f) * ccBase + f * weapon.procCrit.cc;
    }
    const facAll = 1 + (ext.faction || 0);
    // sniper combo (scoped): x1.5 at SniperComboMin hits, +0.5 each time the count triples; hits = shots x multishot.
    // Averaged over 20 s of continuous fighting (the counter carries over between targets while you keep hitting).
    let sniperM = 1;
    if (o.aim && weapon.sniperCombo) {
      const mn = weapon.sniperCombo[0], hps = rate * ms0, n = 40;
      let s = 0;
      for (let i = 0; i < n; i++) { const c = hps * 20 * (i + 0.5) / n; s += c < mn ? 1 : 1.5 + 0.5 * Math.floor(Math.log(c / mn) / Math.log(3) + 1e-9); }
      sniperM = s / n;
    }
    // v2.08: Incarnon "Multishot consumes ammo … and does +X% Damage" (Braton Munitions Grit, Torid Plentiful Mayhem, Despair
    // Stalker's Vendetta) — wiki notes: "Damage bonus only applies to shots generated by multishot" (Braton, Despair; Torid "only
    // applies to projectiles generated by multishot"), "multiplicative to other damage buffs". Of n projectiles per shot the first
    // is the original, so the average is 1 + X (n − 1) / n (before v2.08 every projectile got 1 + X). Torid Incarnon Form is the
    // exception: "In the Incarnon form, instead of increasing the damage of additional projectiles created by multishot, all
    // multishot bonuses are increased by 60%" — kept as a plain ×(1 + X) there.
    const evoAll = weapon.en && /^Torid/.test(weapon.en) && (atk.inc || (parentAtk && parentAtk.inc));
    const nProj = atk.noMs ? 1 : ((atk.pellets || 1) + finalMs) * (msLock ? 1 : Math.max(0, 1 + a.ms + (ext.msAdd || 0)));
    const evoM = a.evoMult ? 1 + a.evoMult * (evoAll ? 1 : Math.max(0, nProj - 1) / Math.max(1e-9, nProj)) : 1;
    const fin = (ext.final || 1) * (tenno && !o.tennoAdd ? 1 + (tenno.dmg || 0) : 1) * exChain * sniperM * evoM * (atk.slam ? 1 + (a.slamDmg || 0) : 1);   // evoMult: Incarnon "unique multiplier" perks; slamDmg (v2.04): Seismic Wave — its own multiplier on slams (wiki Arca Titron: Slam Capacitor "is multiplicative to Seismic Wave and the Nira's Set bonus, and additive to base damage (e.g. Pressure Point …)"; wiki Jat Kusar: Slam Radial Damage "can only be increased with Seismic Wave")
    // falloff: distance (bullets/pellets) and blast edge (enemies around the centre of an explosion)
    let fallM = distFall(atk.fo, o) * armFrac(atk.arm, o);
    if (atk.rfo && o.scenario === "crowd" && K > 1) fallM *= (1 + (K - 1) * (1 - atk.rfo * 2 / 3)) / K;
    // Primary Plated Round (wiki): "Max Damage Bonus = 15·√(5·Magazine Size)" on a full reload, "Partial Damage Bonus = (Magazine
    // Size − Leftover Ammunition) / Magazine Size · 15·√(5·Magazine Size)", lasts 10 s; "The Ideal Fire Rate … how quickly a weapon
    // must fire for a 10s bonus to last for its entire next magazine". Continuous fire (o.killRamp false, single targets): every
    // reload is from empty and the bonus covers min(1, 10 s / time to fire the magazine) of the shots (the reload itself is no
    // firing time — v1.96 review). Crowd with kill stacks from 0 (user's choice 2026-11-02, Merciless etc. restart each pack): the
    // same assumption for Plated — the pack starts after a reload of what the last pack used (o._platedT = pack firing time from
    // evaluate()), so the bonus is the partial one: rounds used / magazine, for min(1, 10 s / pack time) of the pack
    let platedB = 0;
    if (arc && arc.plated && atk.mag) {
      const magN = magCap(atk.mag), frM = Math.max(0.05, (atk.fr || 1) * Math.max(0.05, 1 + a.fr + a.frneg + (ext.frAdd || 0)));
      const fireT = magShots(magN) / frM, full = 0.335 * Math.sqrt(magN);
      if (o._platedT != null) { const T = Math.max(0.05, o._platedT); platedB = full * Math.min(1, T / fireT) * Math.min(1, 10 / T); }
      else platedB = full * Math.min(1, 10 / fireT);
    }

    const allLayouts = elementLayouts(atk, a, o.val, Btot, base0, o.elemOrder, tail);
    const layouts = o.layoutIdx !== undefined && allLayouts[o.layoutIdx] ? [allLayouts[o.layoutIdx]] : allLayouts;
    let best = null;
    for (const L of layouts) {
      const coef = L.coef;
      let total = 0; for (const k in coef) total += coef[k];
      if (total <= 0) continue;
      const share = {}; for (const k in coef) share[k] = coef[k] / total;
      const bonus = { heat: 0, tox: 0, elec: 0, gas: 0, slash: 0 };
      for (const T of ["heat", "tox", "elec"]) if (L.mp[T] === T && a.elem[T] > 0) bonus[T] = a.elem[T];
      // v2.00 (wiki Sancti Castanas): "Guaranteed Electricity proc scales with Electricity mods regardless if they combine with
      // other elements as Corrosive, Radiation, or Magnetic" — once Electricity combines, every Electricity proc left is the
      // guaranteed one, so the Electricity mod bonus applies to all of them
      if (weapon.forcedScale && atk.forced) for (const T of weapon.forcedScale) if (atk.forced.includes(T) && a.elem[T] > 0) bonus[T] = a.elem[T];
      bonus.gas = Math.max(0, a.extra.gasm || 0);   // gas ticks grow only with standalone Gas mods (wiki), not heat + toxin
      for (const [p, x] of tail) if (L.mp[p] === p && bonus[p] !== undefined) bonus[p] += x;
      // arcane proc stacks (frostbite/blight/flare/voltage)
      let fArc = 1, ms = ms0, cd = cdBase, dmgArc = 0, procs;
      for (let it = 0; it < 3; it++) {
        ms = ms0; cd = cdBase; dmgArc = 0;
        if (arc && arc.procStack) {
          const ps = arc.procStack;
          if (ps.ms && !msLock && !atk.noMs) ms += (atk.pellets || 1) * ps.ms * fArc;
          if (ps.cd) cd += (atk.cd || 1.5) * ps.cd * fArc;
          if (ps.dmg) dmgArc = ps.dmg * fArc;
        }
        procs = {};
        for (const k in share) procs[k] = sc * ms * share[k];
        // Cedo glaive explosion (wiki): "applies two separate guaranteed procs. The number of procs cannot be increased with status
        // chance bonuses" — one by normal status weighting, one "an even chance" of Heat/Cold/Electricity/Toxin, per glaive
        if (atk.explProcs) {
          procs = {};
          for (const k in share) procs[k] = ms * share[k];
          if (atk.explProcs >= 2) for (const t of ["heat", "cold", "elec", "tox"]) procs[t] = (procs[t] || 0) + 0.25 * ms;
        }
        if (a.hm > 0) procs.slash = (procs.slash || 0) + a.hm * Math.min(1, ccBase) * ms;
        if (a.ib > 0 && procs.impact) procs.slash = (procs.slash || 0) + procs.impact * Math.min(1, a.ib * (rate < 2.5 ? 2 : 1));
        if (a.welt > 0 && procs.impact) procs.mag = (procs.mag || 0) + procs.impact * Math.min(1, a.welt * (rate < 2.5 ? 2 : 1));
        if (arc && arc.procStack) {
          // stacks expire all at once after `win` s without a proc (wiki: Cascadia Flare, Primary Frostbite/Blight,
          // Conjunction Voltage), so they keep growing while procs land at least every `win` s. With random gaps a run
          // lasts e^(rr*win) - 1 procs before it resets; nf = time-average stacks over a run (ramp to the cap, then held).
          const ps = arc.procStack;
          const per = (procs[ps.type] || 0) + (atk.forced && atk.forced.includes(ps.type) ? 1 : 0);
          const pq = o._procArc, nX = pq ? (o.scenario === "crowd" && pq.r > 0 ? Math.min(N, 1 + rho * Math.PI * pq.r * pq.r) : 1) : 0;
          const rr = per * rate * K + (pq ? (pq.d[ps.type] || 0) + (pq.x[ps.type] || 0) * nX : 0), run = Math.expm1(Math.min(50, rr * ps.win));
          const nbar = run >= ps.max ? ps.max - ps.max * ps.max / (2 * run) : run / 2;
          const nf = Math.max(0, Math.min(1, nbar / ps.max));
          if (Math.abs(nf - fArc) < 1e-6) break;
          fArc = nf;
        } else break;
      }
      let cc = ccBase;
      if (arc && arc.doughty) cd += 10 * Math.min(1, sc) * (share.punct || 0);   // +1.0x per 10% Puncture status chance
      const dupf = 1 + dupD * (cc < 1 ? cc : cc < 2 ? 2 - cc : 0);
      if (dupf !== 1) for (const k in procs) procs[k] *= dupf;
      if (atk.forced) for (const f of atk.forced) procs[f] = (procs[f] || 0) + dupf;
      // v1.97 Hemorrhage / Welt (game data: "Impact Status Effects have 35% chance to apply a Slash Status Effect (x2 when Fire
      // Rate is below 2.5)") — a forced Impact proc is an Impact status effect too (Lex Incarnon "guarantees Impact procs"); the
      // conversion above ran before the forced procs were added, so they never rolled for Slash/Magnetic
      if (atk.forced && atk.forced.includes("impact")) {
        if (a.ib > 0) procs.slash = (procs.slash || 0) + dupf * Math.min(1, a.ib * (rate < 2.5 ? 2 : 1));
        if (a.welt > 0) procs.mag = (procs.mag || 0) + dupf * Math.min(1, a.welt * (rate < 2.5 ? 2 : 1));
      }
      // Cyte-09 Resupply (wiki "Resupply", "Extra Hit"): every hit — each multishot instance — also lands an Extra Hit of the
      // chosen element that forces that element's status ("Main and extra hit have their own independent status procs")
      const xhitP = ext.xhit > 0 && ext.xhitElem ? ms : 0;
      if (xhitP) procs[ext.xhitElem] = (procs[ext.xhitElem] || 0) + xhitP;
      if (arc && arc.encumber) {
        const tot = Object.values(procs).reduce((x, y) => x + y, 0), types = ["impact", "punct", "slash", "heat", "cold", "elec", "tox", "blast", "rad", "gas", "mag", "viral", "corr"];
        for (const t of types) procs[t] = (procs[t] || 0) + arc.encumber * tot / types.length;
      }
      if (arc && arc.punctCold) procs.cold = (procs.cold || 0) + arc.punctCold * (procs.punct || 0);
      // Primary Debilitate: once a combined element sits at 10 stacks, a new proc of it adds one of its base statuses — as a
      // separate instance, so faction damage multiplies those DoTs once more (ProGameTalk 2025-12: "applies as a separate damage
      // instance, letting Faction Damage Bonuses multiply each DoT component individually")
      let debil = null;
      if (arc && arc.debilitate) {
        const cmb = Object.keys(COMP).filter((T) => (procs[T] || 0) > 0).sort((x, y) => procs[y] - procs[x])[0];
        if (cmb) {
          const up = Math.min(1, procs[cmb] * rate * K * 6 / 10);     // share of the time the target holds 10 stacks
          // v2.09: it fires on a proc of that combined status, not on every hit — game data (Arcanes.json): "inflicting the same
          // Status Effect again has a 100% chance to inflict one of the base Status Effects"; ProGameTalk (2025-12): "only triggers
          // once per damage instance" → min(procs of the combined type, damage instances) per shot (was ms per shot)
          debil = { comps: COMP[cmb], n: arc.debilitate * Math.min(ms, procs[cmb]) * up };
          for (const c of COMP[cmb]) procs[c] = (procs[c] || 0) + debil.n / 2;
        }
      }
      const procSum = Object.values(procs).reduce((x, y) => x + y, 0);
      // Melee Influence (wiki): a melee Electricity proc has a "20% chance to grant a timed buff" (rank 5: 18 s, 20 m) that
      // "cannot have its duration refreshed" — so after it ends it waits for the next trigger: uptime = 18λ / (1 + 18λ)
      // with λ = triggers per second while it is off (renewal average).
      let u = 0;
      if (influence) {
        const pe = procs.elec || 0;
        const ph = 1 - Math.pow(0.8, pe);
        const pdet = 1 - Math.pow(1 - ph, K);
        const lam = rate * pdet;
        u = 18 * lam / (1 + 18 * lam);
      }
      const spreadHit = 1 + u * (K - 1);
      const spreadNon = u * K;
      // steady-state status-type count for CO/galvanized (uses spread-inclusive rates)
      let ntypes = 0, ntPrimer = 0;
      const pAdd = o._procAdd || {};
      for (const k of new Set(Object.keys(procs).concat(Object.keys(pAdd)))) {
        const r = (procs[k] || 0) * rate * spreadHit + (pAdd[k] || 0); if (r <= 0) continue;
        ntypes += 1 - Math.exp(-r * (PROC_WIN[k] || 6) * dur);
        if (pAdd[k] > 0) ntPrimer += 1 - Math.exp(-pAdd[k] * (PROC_WIN[k] || 6) * dur);
      }
      // statuses other sources keep on the target (abilities, teammates) also count for Condition Overload / Galvanized
      if (ext.statusExtra) ntypes = Math.min(14, ntypes + ext.statusExtra);
      // v2.05 Galariak Prime (wiki Galariak Prime, docs/mechanics/gaps_melee.json): "Gains a flat +10% Critical Chance bonus per
      // unique Status Effect type on the target hit. | Valid status effects are Impact, Puncture, Slash, Heat, Cold, Electricity,
      // Toxin, Radiation, Gas, Magnetic, Viral, Corrosive, Void, and Tau." — flat (added after mods, like Puncture's), counted
      // from the same steady-state types as Condition Overload but without Blast (not in the list); the first hit on a fresh
      // enemy only sees nt0 types (first0 below). Duplicate's chance curve (dupf above) still uses the crit chance without it.
      let ccTyF = 1;
      if (atk.ccType > 0) {
        let ntC = 0;
        for (const k of new Set(Object.keys(procs).concat(Object.keys(pAdd)))) {
          if (k === "blast") continue;
          const r = (procs[k] || 0) * rate * spreadHit + (pAdd[k] || 0); if (r <= 0) continue;
          ntC += 1 - Math.exp(-r * (PROC_WIN[k] || 6) * dur);
        }
        if (ext.statusExtra) ntC = Math.min(14, ntC + ext.statusExtra);
        const c0 = cc + atk.ccType * Math.min(14, (ext.statusExtra || 0)), cF = cc + atk.ccType * Math.min(14, ntC);
        ccTyF = (1 + c0 * (cd - 1)) / Math.max(1e-9, 1 + cF * (cd - 1));
        cc = cF;
      }
      // head portion (o.hs = real headshots): weak-point multiplier and doubled crit multiplier; ttk later multiplies by the body crit factor
      const hsReal = Math.min(1, o.hs || 0), hsBase = (atk.hsMult || 2) + a.hsMult;
      const ccH = cc + (atk.cc || 0) * (ext.wpcc || 0) + (ext.hsCcFlat || 0);   // Covenant: weak-point crit chance cap is higher
      const critBody = 1 + cc * (cd - 1), critHead = 1 + ccH * (2 * cd - 1);
      // Sonar-type weak spots (ext.weakFrac) are not heads: keep whichever of the two models gives more
      const hsmC = hsReal > 0 ? Math.max(hsm, ((1 - hsReal) * critBody + hsReal * hsBase * critHead) / critBody) : hsm;
      const hsDot = hsReal > 0 ? (1 - hsReal) + hsReal * hsBase : 1;
      // melee sneak attack on an unaware enemy: +700% (rank 30) added beside the crit term — Dmg x (1 + 7 + tier x (CD-1))
      const stealthM = ext.stealth && isMelee ? (critBody + ext.stealth) / critBody : 1;
      // Spiteful Defilement: +100% crit damage (flat) on targets with fewer than 3 status types
      if (a.cdFew) cd += a.cdFew * Math.max(0, Math.min(1, 3 - ntypes));
      // Galvanized Shot/Aptitude/Diffusion stacks need kills and boost direct hits only, not explosions (wiki)
      // Incarnon "+X% Direct Damage per Status Type" (no kill needed) counts the same way
      const pst = (a.evoPst || 0) + (atk.pst || 0);   // atk.pst: Cedo's innate +60% per status type (primary fire, additive)
      const gco = kind === "radial" ? 0 : (kills ? a.gco * ntypes : 0) + pst * ntypes;
      const co = isMelee && !atk.noCO ? a.co * ntypes : 0;
      // v1.80: the first hit on a fresh enemy finds no statuses of its own yet (only ones other sources keep: ext.statusExtra)
      // first hit on a fresh enemy: the glaive's statuses are already on it at their long-run average (default) — o.noPrimerFirst
      // drops them (the wiki doesn't say; the app checks the pick both ways)
      const nt0 = Math.min(14, (ext.statusExtra || 0) + (o.noPrimerFirst ? 0 : ntPrimer)), gco0 = kind === "radial" ? 0 : (kills ? a.gco * nt0 : 0) + pst * nt0, co0 = isMelee && !atk.noCO ? a.co * nt0 : 0;
      const first0 = ccTyF * (1 + dmgb + dmgArc + platedB + gco0 + co0) / Math.max(1e-9, 1 + dmgb + dmgArc + platedB + gco + co);
      const mbd = Btot * exS * (1 + dmgb + dmgArc + platedB) * fallM;
      // on-kill damage fields of the weapon itself (wiki Incarnon notes; convert.py KILL_FIELD): Dual Ichor "Fields do 350 Toxin
      // damage (increased to 440 by EVO2) and last for 7 seconds", "4m range", "affected by faction damage bonuses", melee damage
      // buffs (Pressure Point, the Incarnon Form's +100%) and "all elemental damage buffs"; "0% Critical Chance", "not affected by
      // Condition Overload". How often it ticks isn't on the wiki: o.fieldHigh = every second for the whole 7 s (as Furax's
      // "50 Heat damage every second for 7 seconds"), otherwise the 440 once — the app checks the pick holds at both ends.
      let kfTot = 0;
      if (atk.killField && o.scenario === "crowd" && isMelee) {
        const kf = atk.killField, elemSum = Object.values(a.elem || {}).reduce((q, v) => q + Math.max(0, v), 0);
        const ticks = kf.every ? kf.dur / kf.every : (o.fieldHigh ? kf.dur : 1);
        kfTot = kf.dmg * (1 + dmgb + dmgArc) * (1 + elemSum) * ticks;
      }
      let directMult = Btot * exS * (1 + dmgb + dmgArc + platedB + gco + co) * fallM;
      // Secondary Irradiate (wiki): only direct hits spread, and elemental mods are 33% less effective on the spread hits.
      // irrM = the multiplier at the steady-state uptime (stacks over the 12 s Radiation lifetime); irrG = the gain at full uptime.
      // v1.99: evaluate() rescales it per target by the hits that land while the target already has 10 stacks
      // (game data: "On hitting enemies afflicted by 10 stacks of Radiation") — a target that dies first never triggers it.
      let irrM = 1, irrG = 0;
      if (arc && arc.irradiate && o.scenario === "crowd" && kind !== "radial") {
        const radSt = (procs.rad || 0) * rate * 12 * dur, upR = Math.min(1, radSt / 10);
        const n7 = Math.min(N - 1, rho * Math.PI * 49);
        let modEl = 0; for (const p of PRIM) modEl += Math.max(0, a.elem[p]); for (const t in a.extra) modEl += Math.max(0, a.extra[t]);
        const spreadEff = total > 0 ? Math.max(0, (total - 0.33 * modEl) / total) : 1;
        irrG = arc.irradiate * spreadEff * n7 / Math.max(1, K);
        irrM = 1 + irrG * upR;
        directMult *= irrM;
      }
      // DoT ticks (wiki "Damage over Time"): heat, toxin and slash tick once a second starting 1 s after the proc
      // (⌊duration − 1⌋ + 1 ticks, none if the status lasts under 1 s); electricity and gas tick right away
      const Tdur = 6 * dur;
      const ticksOf = (T) => DOT_DELAY[T] ? (Tdur >= 1 - 1e-9 ? Math.floor(Tdur - 1 + 1e-9) + 1 : 0) : Math.max(1, Math.ceil(Tdur - 1e-9));
      const dotN = Object.fromEntries(DOT_TYPES.map((T) => [T, ticksOf(T)]));
      if (a.napalm > 0) dotN.napalm = 6;
      const gasSt = Math.min(10, (procs.gas || 0) * rate * spreadHit * 6 * dur);
      const rg = Math.min(6, 3 + 0.3 * Math.max(0, gasSt - 1));
      const ng = o.scenario === "crowd" ? Math.min(N, 1 + rho * Math.PI * rg * rg) : 1;
      const perF = {};
      let scoreSS = 0;
      for (const fname of o.factions) {
        const fac_ = FACTIONS[fname];
        const fac = facAll + (a.bane && a.bane[fname] ? a.bane[fname] : 0);   // Roar-type buffs + faction damage mods (additive)
        let vuln = 0; for (const k in share) vuln += share[k] * (fac_.weak.includes(k) ? 1.5 : 1);
        let D = directMult * total * ms * vuln * hsmC * fin * fac * M * dupf * stealthM;
        // Melee Influence spread damage (wiki): while the buff is up, "affected enemies are also dealt damage equal to that
        // element's damage from the original attack", after quantization "including effects such as Condition Overload and
        // critical multipliers" — one instance per element the hit procs ("Proccing multiple elements at the same time will
        // show the sum of the spread damage"; "A hit that procs Slash will do nothing"), and "Faction Damage Bonuses apply
        // twice to Melee Influence damage and three times to the status procs it causes". Dsp = what one enemy in the 20 m
        // takes from one struck enemy, before the crit factor ttk applies. P(element T procs) from the hit's status chance:
        // ⌊sc⌋ sure procs plus one more at the remainder, each picking T by its share.
        let Dsp = 0;
        if (influence && u > 0) {
          const n0 = Math.floor(sc + 1e-9), f0 = sc - n0;
          for (const T of SPREAD_EL) {
            const w = share[T] || 0; if (w <= 0) continue;
            Dsp += (1 - Math.pow(1 - w, n0) * (1 - f0 * w)) * w * (fac_.weak.includes(T) ? 1.5 : 1);
          }
          Dsp *= D / Math.max(1e-9, vuln) * fac;
        }
        // the Blast statuses a hit procs spread too: each enemy within 20 m gets a Blast stack (same base damage) per swing
        // with the chance that the hit procs Blast — they fuse (30% each) and go off together at 10 stacks like any other
        let pbN = 0;
        if (influence && u > 0 && (share.blast || 0) > 0) {
          const n0 = Math.floor(sc + 1e-9), f0 = sc - n0, w = share.blast;
          pbN = (1 - Math.pow(1 - w, n0) * (1 - f0 * w)) * spreadNon;
        }
        // Xata's Whisper (wiki): extra Void hit = 26% x strength of the hit, faction and weak-point multipliers applied again;
        // Void has no faction weakness, so the element vulnerability of the hit is taken back out
        const xata = ext.xata || 0;
        if (xata) D *= 1 + xata * fac * hsmC / Math.max(0.25, vuln);
        // Resupply Extra Hit (wiki "Extra Hit"): "Weapon Hit Damage × Extra Hit Percentage × (1 + Faction Damage Bonuses)" as the
        // chosen element; "Faction elemental weaknesses do not calculate inside the extra instance's base damage" — so the hit's
        // own element vulnerability comes out and the chosen element's weakness (x1.5) goes in. Napalm ticks don't trigger it.
        if (ext.xhit > 0) D *= 1 + ext.xhit * fac * (ext.xhitElem && fac_.weak.includes(ext.xhitElem) ? 1.5 : 1) / Math.max(0.25, vuln);
        if (Dsp > 0) D += u * (K - 1) * Dsp;      // the other enemies struck by the same swing spread to this one too
        const dot = {}, dotNon = {};
        for (const T of DOT_TYPES) {
          const p = procs[T] || 0; if (p <= 0) continue;
          if (!dotN[T]) continue;
          let per = dotN[T] * hsDot * (T === "slash" ? 0.35 : 0.5) * mbd * (1 + bonus[T]) * (1 + sd + (T === "tox" ? (ext.sdTox || 0) : 0)) * (fac_.weak.includes(T) ? 1.5 : 1) * fin * fac * fac * (o.noComboStatus ? 1 : M);   // o.noComboStatus: app checks the pick without the combo multiplier on status (not on the wiki)
          if (xata) per *= 1 + xata * fac;      // every tick is a damage instance → its own Xata hit
          if (T === "elec") per *= n3;
          if (T === "gas") per *= ng;
          const dShare = debil && debil.comps.includes(T) && p > 0 ? (debil.n / 2) / p : 0;
          // a forced Resupply proc takes the Extra Hit's damage as its base (wiki), not the weapon hit's
          const pEff = xhitP && T === ext.xhitElem ? p - xhitP + xhitP * ext.xhit : p;
          dot[T] = pEff * per * spreadHit * (1 + dShare * (fac - 1));
          if (T !== "slash" && spreadNon > 0) dotNon[T] = p * per * spreadNon * fac;   // spread procs: faction damage x3 (wiki)
        }
        // Nightwatch Napalm (wiki): each rocket instance (multishot included) leaves a blaze of a fixed 150 Heat per tick,
        // 6 ticks with the first right away, raised only by base damage mods/arcanes, faction damage and the Kuva valence
        // bonus; it can't crit (the crit factor ttk applies is taken back out).
        let napPh = 0, napH = 0, napHdisp = 0;
        if (a.napalm > 0 && kind === "radial") {
          const tick = a.napalm * (1 + dmgb + dmgArc + platedB) * (1 + vpct), hw = fac_.weak.includes("heat") ? 1.5 : 1;
          const critF = Math.max(1, 1 + Math.min(1, cc) * (cd - 1));
          dot.napalm = tick * 6 * ms0 * fac * hw / critF;
          // wiki "Nightwatch Napalm": "Napalm ticks each have a fixed 68% chance to proc Heat status, though this Heat status uniquely
          // lasts for only 3 seconds" and "Heat status damage is affected by Heat mods" — the Heat mods count even when heat is
          // combined away (not the Valence bonus); status damage mods and faction damage (twice, as a DoT) apply too. A 3 s Heat
          // ticks at 1, 2 and 3 s (wiki "Damage over Time"); stacks refreshing each other is left out (conservative).
          // Wiki "Heat": a proc "adds a stack and refreshes the duration of all currently active heat stacks" and Heat ramps
          // "indefinitely (scaling up linearly)" while it keeps being refreshed — the blazes keep proccing every second while the
          // rockets keep landing, so every stack since the first stays active (ttk adds them up: napH = one stack's tick x the
          // procs of one tick of a rocket's blazes). The display value keeps the old 3-tick count per proc.
          const hTick = 0.5 * tick * (1 + Math.max(0, a.elem.heat || 0)) * (1 + sd) * hw * fac * fac / critF;
          napH = hTick * 0.68 * ms0;
          napHdisp = 0.68 * 6 * ms0 * 3 * hTick;
          // the same Heat procs strip armor (wiki "Heat": "reduces their armor by up to 50%", 15/30/40/50% over 2 s, regained over 6 s
          // after the proc ends). Only the tick that lands right away is counted per rocket (conservative): 68% per multishot instance.
          napPh = 0.68 * ms0;
        }
        // wiki Blast Damage: "Blast Proc Damage = 0.3 × Modded Base Damage × (1 + Faction Damage Bonuses) × (1 + Status Damage
        // Bonuses)", Modded Base Damage itself × (1 + Faction) — "Faction Damage Bonuses apply twice to Blast procs" (like DoTs)
        const blast = (procs.blast || 0) * 0.3 * mbd * (1 + sd) * fin * fac * fac * (o.noComboStatus ? 1 : M) * (xata ? 1 + xata * fac : 1);
        const vm0 = 4.25, dsum = Object.values(dot).reduce((s, x) => s + x, 0) + napHdisp;
        const dispDirect = D * vm0, dispDot = dsum * vm0, dispBlast = blast * vm0;
        const dispDotBy = {}; for (const T in dot) dispDotBy[T] = dot[T] * vm0;
        if (napHdisp > 0) dispDotBy.napalmHeat = napHdisp * vm0;
        perF[fname] = {
          D, D0: D * first0, irrM, irrG, Dnon: Dsp * spreadNon, pbN, kf: kfTot * fac, blast, dot, dotNon, napH, F: arc && arc.flatPerProc ? arc.flatPerProc * procSum * fin * fac : 0,
          pv: (procs.viral || 0) * spreadHit, ph: ((procs.heat || 0) + napPh) * spreadHit, pc: (procs.corr || 0) * spreadHit, pk: (procs.cold || 0) * spreadHit, pm: (procs.mag || 0) * spreadHit,
          pp: kind === "radial" ? 0 : (procs.punct || 0) * spreadHit,
          pvN: (procs.viral || 0) * spreadNon, phN: (procs.heat || 0) * spreadNon, pcN: (procs.corr || 0) * spreadNon, pkN: (procs.cold || 0) * spreadNon,
          dispDirect, dispDot, dispBlast, dispDotBy,
        };
        scoreSS += Math.log(Math.max(1e-9, dispDirect + dispDot + dispBlast));
      }
      // the element concept is about the mods: elements an ability adds on top (Nourish viral, Electric Shield …) are left out
      let shareC = share;
      if (o.concept && o.concept.length && Object.keys(abilEl).length) {
        const cc2 = {}; let tc = 0;
        for (const k in coef) { const v = Math.max(0, coef[k] - (abilEl[k] || 0)); if (v > 0) { cc2[k] = v; tc += v; } }
        if (tc > 0) { shareC = {}; for (const k in cc2) shareC[k] = cc2[k] / tc; }
      }
      const cD = conceptDist(shareC, procs, o);
      scoreSS -= 50 * cD;      // a layout that breaks the element concept is used only when no layout keeps it
      if (!best || scoreSS > best.scoreSS) {
        best = { conceptOk: cD === 0, conceptD: cD, nLayouts: allLayouts.length, scoreSS, exS, exChain, sniperM, evoM, vigil: a.vigil, glad: a.glad, perF, layout: L, share, procs, waveAoe, cc, cd, critf: 1 + cc * (cd - 1) + (a.nc ? Math.max(0, 1 - cc) * a.nc : 0), sc, ms, rate, accF, M, tierNow, K, N, u, ntypes, gco, co, nc: a.nc || 0, dmgb: dmgb + dmgArc + platedB, sd, dur, total, Btot, mbd, Tdur, dotN, fArc, hsFrac, hsM,
          fallM, ogM: (arc && arc.ogMult ? arc.ogMult : 1) * (1 + 0.5 * (share.void || 0)), frozenM: arc && arc.frozenMult && isMelee ? arc.frozenMult : 0, coldVuln: arc && arc.coldVuln ? arc.coldVuln : 0 };
      }
    }
    // chaining / ricocheting shots (wiki Incarnon notes via convert.py CHAIN): hits that jump on from every enemy struck
    if (best && atk.chain && o.scenario === "crowd" && N > 1) best.chain = atk.chain;
    if (best && atk.killField) best.kfR = atk.killField.r;
    // ammo: seconds of continuous fire from a full load, and ammo packs needed per minute
    // Incarnon Form: its own pool (charges), untouched by mods and ammo efficiency; the form ends when it runs out
    const incOf = atk.inc || (atk.parts && atk.parts[0].inc);
    if (best && incOf) {
      const rounds = atk.incAmmo || (atk.parts && atk.parts[0].incAmmo) || 0;
      const cost = atk.ammoCost != null ? atk.ammoCost : atk.parts && atk.parts[0].ammoCost != null ? atk.parts[0].ammoCost : 1;
      // v2.08: "Multishot consumes ammo directly from Capacity" (the evoMult perks) — wiki Braton note "In the case of Incarnon
      // Form, it pulls directly from its magazine", Torid "it pools directly from its magazine": every projectile spends a round,
      // so the form's pool lasts 1 / n as long (shown only; the kill speed assumes the form stays up)
      const drainN = a.evoMult > 0 ? Math.max(1, best.ms / Math.max(1e-9, best.accF || 1)) : 1;
      best.inc = { rounds, sec: rounds ? rounds / Math.max(1e-6, rate * cost * drainN) : null, drainN };
    } else if (best && weapon.ammoMax && !isMelee) {
      const magN = atk.mag ? magCap(atk.mag) : 0, maxA = weapon.ammoMax * (1 + a.ammoMax);
      const cost = atk.ammoCost != null ? atk.ammoCost : atk.parts && atk.parts[0].ammoCost != null ? atk.parts[0].ammoCost : 1;
      const use = rate * cost * (1 - Math.min(0.75, a.ammoEff)) * (1 - galeG);      // all sources together cap at 75% (Hotfix 44.1.3); Gale Force shots are free
      best.ammo = { sustain: (magN + maxA) / Math.max(1e-6, use), use, mag: magN, max: maxA, pickup: weapon.ammoPickup || 0,
        packsPerMin: weapon.ammoPickup ? use * 60 / weapon.ammoPickup : null, conv: a.ammoConv };
      // Cyte-09 Resupply refills the magazine on every cast, so the reserve never runs dry (players use it as infinite ammo)
      if (ext.reloadCast != null) Object.assign(best.ammo, { sustain: Infinity, packsPerMin: null, resupply: true });
    }
    return best;
  }

  /* ---------- mod capacity (wiki "Polarity", "Stance") ---------- */
  // Orokin Catalyst assumed: capacity = 2 x max rank (60, or 80 for rank-40 Kuva/Tenet/Coda); melee: matching maxed stance +10.
  // A matching polarity halves a mod's drain (rounded up), a different polarity adds 25% (rounded up); one forma re-polarizes one slot.
  function modDP(m) {
    if (!m) return null;
    if (m.id === "__riven") return { d: 18, p: "*", id: m.id };          // rank-8 riven; its polarity is assumed to match a slot
    return { d: m.drain != null ? m.drain : 10, p: m.pol && m.pol !== "universal" ? m.pol : "", id: m.id };
  }
  const halfD = (d) => Math.ceil(d / 2), badD = (d) => Math.round(d * 1.25);   // in game: 9 in a wrong slot → 11 (11.25 rounded), matched 15 → 8
  // asg: where each mod lands — slot polarity and drain there (how: match | forma | neutral | bad), for the arsenal-style cards
  function slotCost(normal, slotPols, k) {
    const free = {}; let neutral = 0;
    for (const p of slotPols) { if (p) free[p] = (free[p] || 0) + 1; else neutral++; }
    let cost = 0; const left = [], wild = [], formaPols = [], asg = [];
    const put = (m, slot, c, how) => { cost += c; asg.push({ id: m.id, pol: m.p, slot, cost: c, how }); };
    for (const m of normal.slice().sort((x, y) => y.d - x.d)) {
      if (m.p === "*") { wild.push(m); continue; }
      if (m.p && free[m.p] > 0) { free[m.p]--; put(m, m.p, halfD(m.d), "match"); } else left.push(m);
    }
    for (const m of wild) {
      const pk = Object.keys(free).find((p) => free[p] > 0);
      if (pk) { free[pk]--; put(m, pk, halfD(m.d), "match"); } else left.push(m);
    }
    left.sort((x, y) => y.d - x.d);
    const badList = []; for (const p in free) for (let i = 0; i < free[p]; i++) badList.push(p);
    const badSlots = badList.length;
    // forma the slots under the biggest leftover mods: re-polarize mismatched slots first, then empty ones
    const fm = left.filter((m) => m.p), rest = left.filter((m) => !m.p);
    const kk = Math.min(k, fm.length, badSlots + neutral);
    for (let i = 0; i < kk; i++) { put(fm[i], fm[i].p, halfD(fm[i].d), "forma"); formaPols.push(fm[i].p === "*" ? "riven" : fm[i].p); }
    let neutLeft = neutral - Math.max(0, kk - badSlots), badLeft = Math.max(0, badSlots - kk);
    const badRemain = badList.slice(Math.min(kk, badSlots));
    const place = fm.slice(kk).concat(rest).sort((x, y) => y.d - x.d);
    for (const m of place) {
      if (neutLeft > 0) { neutLeft--; put(m, "", m.d, "neutral"); }
      else if (badLeft > 0) { badLeft--; put(m, badRemain.shift() || "", badD(m.d), "bad"); }
      else return { cost: Infinity, used: kk, formaPols, asg };
    }
    return { cost, used: kk, formaPols, asg };
  }
  // fewest forma that make the build fit (formaMax = limit; null = up to every slot)
  function capacityPlan(weapon, mods, formaMax) {
    const cap = 2 * (weapon.rank || 30) + (weapon.slot === "melee" && !weapon.pseudo ? 10 : 0);
    const normal = [], exi = [];
    for (const m of mods) { const x = modDP(m); if (x) (m.exilus ? exi : normal).push(x); }
    const slotPols = (weapon.pol || []).slice(0, 8);
    while (slotPols.length < 8) slotPols.push("");
    const xp = weapon.xpol || "";
    let xOpts = [{ cost: 0, f: 0 }];
    if (exi.length) {
      const m = exi[0], a = (slot, cost, how) => ({ id: m.id, pol: m.p, slot, cost, how });
      xOpts = m.p && (m.p === xp || m.p === "*") ? [{ cost: halfD(m.d), f: 0, asg: a(xp, halfD(m.d), "match") }]
        : [{ cost: xp ? badD(m.d) : m.d, f: 0, asg: a(xp, xp ? badD(m.d) : m.d, xp ? "bad" : "neutral") }, { cost: halfD(m.d), f: 1, pol: m.p, asg: a(m.p, halfD(m.d), "forma") }];
    }
    const fmax = Math.min(9, formaMax == null ? 9 : formaMax);
    let best = null;
    for (let f = 0; f <= fmax; f++) {
      for (const xo of xOpts) {
        if (xo.f > f) continue;
        const r = slotCost(normal, slotPols, f - xo.f);
        const tot = r.cost + xo.cost;
        const plan = { drain: tot, cap, forma: r.used + xo.f, formaPols: r.formaPols.concat(xo.pol ? ["exilus:" + xo.pol] : []), asg: r.asg.concat(xo.asg ? [xo.asg] : []) };
        if (tot <= cap) return Object.assign(plan, { fits: true });
        if (!best || tot < best.drain) best = plan;
      }
    }
    return Object.assign(best || { drain: Infinity, cap, forma: 0, formaPols: [], asg: [] }, { fits: false });
  }

  /* ---------- optimizer (beam + 1-swap) ---------- */
  // two mods that can't be equipped together: variants of one mod (group) or the game's "Incompatible Mods" list (wiki
  // Module:Mods/data, e.g. Critical Delay ↔ Point Strike, Comet/Ripper/Serrated Rounds)
  function clash(a, b) {
    if (!a || !b || a === b) return false;
    if (a.group && b.group && a.group === b.group) return true;
    return !!((a.excl && b.en && a.excl.includes(b.en)) || (b.excl && a.en && b.excl.includes(a.en)));
  }
  function conflicts(mod, chosen) {
    for (const m of chosen) {
      if (m.id === mod.id) return true;
      if (clash(mod, m)) return true;
    }
    return false;
  }
  // 8 normal slots + 1 exilus slot (exilus-only utility mods)
  function fits(c, mods, slots) {
    if (conflicts(c, mods)) return false;
    const nx = mods.filter((m) => m && m.exilus).length;
    return c.exilus ? nx < 1 : mods.length - nx < slots;
  }
  function beamSearch(weapon, atk, cands, oo, slots, beamW, locked, nLocal) {
    const ev = (mods) => evaluate(weapon, atk, mods, oo).score;
    const capOk = (mods) => oo.noCapacity || capacityPlan(weapon, mods, oo.formaMax).fits;
    const steps = slots + (cands.some((c) => c.exilus) ? 1 : 0);
    let beam = [{ mods: locked.slice(), score: ev(locked) }];
    for (let step = locked.length; step < steps; step++) {
      const next = [], seen = new Set();
      for (const b of beam) for (const c of cands) {
        if (!fits(c, b.mods, slots)) continue;
        const mods = b.mods.concat([c]);
        const key = mods.map((m) => m.id).sort().join(",");
        if (seen.has(key)) continue;
        seen.add(key);
        if (!capOk(mods)) continue;
        next.push({ mods, score: ev(mods) });
      }
      if (!next.length) break;
      next.sort((x, y) => y.score - x.score);
      beam = next.slice(0, beamW);
    }
    return beam.slice(0, nLocal).map((b) => localImprove(weapon, atk, cands, oo, slots, locked, b));
  }
  // one-swap hill climb: replace any unlocked mod with any candidate while the score improves
  function localImprove(weapon, atk, cands, oo, slots, locked, b) {
    const ev = (mods) => evaluate(weapon, atk, mods, oo).score;
    const capOk = (mods) => oo.noCapacity || capacityPlan(weapon, mods, oo.formaMax).fits;
    let improved = true, guard = 0;
    while (improved && guard++ < 12) {
      improved = false;
      for (let i = 0; i < b.mods.length; i++) {
        if (locked.includes(b.mods[i])) continue;
        const rest = b.mods.slice(0, i).concat(b.mods.slice(i + 1));
        for (const c of cands) {
          if (!fits(c, rest, slots) || !capOk(rest.concat([c]))) continue;
          const s = ev(rest.concat([c]));
          if (s > b.score * 1.0000001) { b.mods = rest.concat([c]); b.score = s; improved = true; }
        }
      }
    }
    return b;
  }

  function optimize(weapon, atk, cands, o, cfg, progress) {
    const slots = cfg.slots || 8, beamW = cfg.beam || 100, locked = cfg.locked || [];
    const valOpts = cfg.valOptions && cfg.valOptions.length ? cfg.valOptions : [o.val];
    const arcOpts = cfg.arcOptions && cfg.arcOptions.length ? cfg.arcOptions : [o.arcane];
    const mk = (val, arcane) => { const oo = Object.assign({}, o, { val, arcane }); oo.targets = o.targets || targetsFor(oo); return oo; };
    const mkX = (val, arcane) => Object.assign(mk(val, arcane), { layoutTTK: true });   // full searches: exact element arrangement
    const results = [];
    const push = (list, val, arcane) => { for (const b of list) results.push({ mods: b.mods, score: b.score, val, arcane }); };
    const total = valOpts.length * arcOpts.length;
    let done = 0;
    const tick = () => { done++; if (progress) progress(Math.min(1, done / total)); };
    if (total <= 3) {
      for (const val of valOpts) for (const arcane of arcOpts) { push(beamSearch(weapon, atk, cands, mkX(val, arcane), slots, beamW, locked, 8), val, arcane); tick(); }
    } else {
      // phase 1: quick screen of every (valence, arcane) pair with a narrow beam
      const screen = [];
      for (const val of valOpts) for (const arcane of arcOpts) {
        const r = beamSearch(weapon, atk, cands, mk(val, arcane), slots, 6, locked, 1);
        screen.push({ val, arcane, score: r[0].score, r: r[0] });
        push(r, val, arcane);
        if (progress) progress(0.6 * (screen.length / total));
      }
      screen.sort((x, y) => y.score - x.score);
      // phase 2: full search for the best pairs (plus the best of each distinct valence/arcane among the top)
      const chosen = [], seenV = new Set(), seenA = new Set();
      for (const sc of screen) {
        const vk = sc.val ? sc.val.type : "-";
        if (chosen.length < 3 || (!seenV.has(vk) && chosen.length < 5)) { chosen.push(sc); seenV.add(vk); seenA.add(sc.arcane); }
        if (chosen.length >= 5) break;
      }
      let i = 0;
      for (const sc of chosen) {
        push(beamSearch(weapon, atk, cands, mkX(sc.val, sc.arcane), slots, beamW, locked, 8), sc.val, sc.arcane);
        i++; if (progress) progress(0.6 + 0.4 * (i / chosen.length));
      }
    }
    // v1.67 dominant-mod restart: one mod that is huge on its own (Semi-Shotgun Cannonade +240%) pulls every partial
    // build of the beam toward itself, and the beam never sees the sets without it. Search once more without the best
    // set's most important mod (the one whose removal costs the most) under the same valence/arcane.
    if (results.length && !cfg.noRestart) {
      const top = results.slice().sort((x, y) => y.score - x.score)[0], oo = mkX(top.val, top.arcane);
      let key = null, drop = 0;
      top.mods.forEach((m, i) => {
        if (!m || locked.includes(m)) return;
        const d = top.score - evaluate(weapon, atk, top.mods.filter((_, j) => j !== i), oo).score;
        if (d > drop) { drop = d; key = m; }
      });
      if (key) push(beamSearch(weapon, atk, cands.filter((c) => c.id !== key.id), oo, slots, beamW, locked, 4), top.val, top.arcane);
    }
    // v1.67 cross-arcane check: each arcane is searched on its own, and a mod set can be the best one under arcane A
    // while A's own beam never reaches it (Corinth Prime: the Blaze/Seeking Force set found under Plated Round scored
    // 2.42 with Merciless, but the Merciless beam stopped at 2.14 — a 7% worse recommendation). Re-score the leading
    // mod sets with every arcane option, then hill-climb the best few under the arcane they now carry.
    if (arcOpts.length > 1 && results.length) {
      const seenK = new Set(), lead = [];
      for (const r of results.slice().sort((x, y) => y.score - x.score)) {
        const k = r.mods.map((m) => m.id).sort().join(",") + "|" + JSON.stringify(r.val);
        if (seenK.has(k)) continue; seenK.add(k); lead.push(r); if (lead.length >= 6) break;
      }
      const xs = [];
      for (const r of lead) for (const arcane of arcOpts) {
        if (arcane === r.arcane) continue;
        xs.push({ mods: r.mods.slice(), score: evaluate(weapon, atk, r.mods, mkX(r.val, arcane)).score, val: r.val, arcane });
      }
      const best0 = Math.max(...results.map((r) => r.score));
      xs.sort((x, y) => y.score - x.score);
      for (const x of xs.slice(0, 3)) {
        if (x.score < best0 * 0.97) break;
        results.push(x);
        const b = localImprove(weapon, atk, cands, mkX(x.val, x.arcane), slots, locked, { mods: x.mods.slice(), score: x.score });
        results.push({ mods: b.mods, score: b.score, val: x.val, arcane: x.arcane });
      }
    }
    // community builds read in full from their source (docs/community/builds, kind "read"): scored under the same
    // conditions and allowed to win, so the one recommendation is the best of the search and of what players run.
    // Only the valences/arcanes the search itself may use (the user's settings); riven only when the user's riven is in.
    if (cfg.seeds && cfg.seeds.length) {
      const hasRiv = locked.some((m) => m && m.id === "__riven");
      const lead = results.slice().sort((x, y) => y.score - x.score).slice(0, 5);
      const vals = [], arcs = [];
      for (const r of lead) { if (!vals.some((v) => JSON.stringify(v) === JSON.stringify(r.val))) vals.push(r.val); if (!arcs.includes(r.arcane)) arcs.push(r.arcane); }
      for (const s of cfg.seeds) {
        const mods = (s.mods || []).filter(Boolean);
        if (mods.some((m) => m.id === "__riven") !== hasRiv) continue;
        if (mods.filter((m) => !m.exilus).length > slots || mods.filter((m) => m.exilus).length > 1) continue;
        let bad = false; for (let i = 0; i < mods.length && !bad; i++) for (let j = i + 1; j < mods.length; j++) if (clash(mods[i], mods[j])) { bad = true; break; }
        if (bad) continue;
        const sArcs = arcs.slice(); if (s.arcane !== undefined && arcOpts.includes(s.arcane) && !sArcs.includes(s.arcane)) sArcs.push(s.arcane);
        for (const val of vals) for (const arcane of sArcs) {
          results.push({ mods, score: evaluate(weapon, atk, mods, mkX(val, arcane)).score, val, arcane, community: s.name || true });
        }
      }
    }
    const uniq = new Map();
    for (const r of results) {
      const key = r.mods.map((m) => m.id).sort().join(",") + "|" + (r.val ? r.val.type + r.val.pct : "") + "|" + r.arcane;
      const prev = uniq.get(key);
      if (!prev || prev.score < r.score) uniq.set(key, prev && prev.community && !r.community ? Object.assign({}, r, { community: prev.community }) : r);
      else if (r.community && !prev.community) prev.community = r.community;   // same build found by the search and run by players
    }
    const out = Array.from(uniq.values()).sort((x, y) => y.score - x.score);
    // screening results were scored with the fast arrangement pick: re-score the leaders exactly;
    // an exilus mod that adds nothing to kill speed is dropped (the page suggests one for convenience/ammo instead)
    for (const r of out.slice(0, 40)) {
      const oo = mkX(r.val, r.arcane);
      r.score = evaluate(weapon, atk, r.mods, oo).score;
      const xi = r.mods.findIndex((m) => m && m.exilus);
      if (xi >= 0) {
        const without = r.mods.filter((_, i) => i !== xi), s0 = evaluate(weapon, atk, without, oo).score;
        if (s0 >= r.score / 1.002) { r.mods = without; r.score = s0; }
      }
    }
    out.sort((x, y) => y.score - x.score);
    // near ties (within 2% of the best, user's choice 2026-11-02): put first the build that holds up best when the fight
    // differs — stacks held the whole time / starting from zero, and each faction on its own
    if (out.length > 1 && o.robustTie !== false) {
      const band = out.filter((r) => r.score >= out[0].score * 0.98).slice(0, 8);
      const alts = [];
      if (o.scenario === "crowd") alts.push({ killRamp: false }, { kills: false });
      if ((o.factions || []).length > 1) for (const f of o.factions) alts.push({ factions: [f] });
      if (band.length > 1 && alts.length) {
        const sc = band.map((r) => alts.map((p) => {
          const oo = Object.assign({}, o, p, { val: r.val, arcane: r.arcane, layoutTTK: true }); oo.targets = targetsFor(oo);
          return evaluate(weapon, atk, r.mods, oo).score;
        }));
        const best = alts.map((_, j) => Math.max(...sc.map((row) => row[j])));
        band.forEach((r, i) => { r.robust = Math.exp(sc[i].reduce((t, v, j) => t + Math.log(Math.max(1e-9, v / best[j])), 0) / alts.length); });
        // a build players actually run wins a near tie (robustness within 1%) over one only the search found (2026-11-03)
        band.sort((x, y) => (!!x.community !== !!y.community && Math.abs(y.robust - x.robust) < 0.01 ? (y.community ? 1 : -1) : 0) || (y.robust - x.robust) || (y.score - x.score));
        out.splice(0, band.length, ...band);
      }
    }
    return out;
  }

  root.WFEngine = { clash, evaluate, optimize, defaults, targetsFor, levelsOf, conceptDist, enemyStats, FACTIONS, UNITS, PRIM, COMBO, aggregate, comboMult, comboAvg, ttk, capacityPlan };
})(typeof self !== "undefined" ? self : globalThis);
