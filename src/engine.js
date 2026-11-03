/* Warframe build optimizer — damage engine v2 (time-to-kill scoring).
 * Sources: wiki.warframe.com (Oct 2026). Key mechanics:
 *  - Elements combine in mod order (top-left → bottom-right); Violet-shard electricity combines like a mod
 *    (joins an electricity mod, else after the mods); innate elements + valence last, in H→C→E→T order.
 *    Ability elements (Electric Shield, Toxic Lash, Xata's Whisper, Nourish) never combine.
 *  - Status DoT tick = 0.5*MBD*(1+matching elemental mod)*(1+status dmg)*crit*faction; Slash 0.35*MBD ignores armor.
 *  - Electricity DoT hits all enemies within 3m; Gas cloud 3m (+0.3m/stack, max 6m).
 *  - Blast: 0.3*MBD per proc on the target after 1.5s.
 *  - Viral x2 then +25%/stack to x4.25 (health only); Corrosive 20%+6%/stack (max 80%); Heat -50% armor.
 *  - Cold: flat +0.1 crit damage first stack, +0.05/stack, max +0.45.
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
  const DOT_DELAY = { heat: 1, tox: 1, slash: 1 };     // seconds before the first tick (wiki "Damage over Time")
  const PROC_WIN = { blast: 1.5, corr: 8, rad: 12, impact: 6 };
  const ARMOR_CAP = 2700;
  // crowd geometry: enemies lined up behind the one you shoot ~ Poisson(2); a humanoid body uses ~0.6 m of punch through
  // (wiki "Punch Through": 0.6 m passes a humanoid, 1.0 m a quadruped). Re-aiming to the next target takes ~0.2 s.
  const LINE_MEAN = 2, BODY_PT = 0.6, T_ACQ = 0.2;
  function lineHits(cap) {           // expected extra enemies hit = E[min(n, cap)], n ~ Poisson(LINE_MEAN)
    let p = Math.exp(-LINE_MEAN), e = 0;
    for (let n = 1; n < 30; n++) { p *= LINE_MEAN / n; e += p * Math.min(n, cap); }
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
    "scFlat", "nc", "cdFew", "evoMult", "cdBase", "ccBase", "baseAdd", "napalm", "hata"];
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
    const stepsMax = until ? Math.ceil(until / dt) - 1 : Math.ceil(p.tmax / dt);
    // stack-based multipliers after `shots` trigger pulls have landed their status procs
    const stacks = (shots) => {
      const nv = Math.min(10, p.pv * shots), nc = Math.min(p.corrMax, p.pc * shots), nk = Math.min(og > 0 ? 4 : 10, p.pk * shots);
      const nm = Math.min(10, (p.pm || 0) * shots);
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
      const ccp = p.aoeOnly ? 0 : Math.min(0.25, 0.05 * Math.min(5, (p.pp || 0) * shots));
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
        if (raw < og) { og -= raw; lastRate = raw / dt; return 0; }
        const keep = 1 - og / Math.max(1e-9, raw); og = 0; S *= keep; tx *= keep; sl *= keep;
      }
      if (sh > 0) {
        const take = Math.min(sh, S * f.magM); sh -= take; S -= take / f.magM;
        if (sh <= 0 && f.nm > 0 && magT < 0) { magT = t; magDps = Math.min(0.3, 0.03 * f.nm) * sh0 / 6; }
      }
      const dmgH = S * f.vm * f.ar + tx * f.vm * f.ar + sl * f.vm;
      hp -= dmgH; dealt += dmgH;
      lastRate = dmgH / dt;
      return dmgH;
    };
    // the first trigger pull lands before its own status procs (wiki "Viral Damage": attacks deal their initial damage
    // before they apply status, and multishot hits of the same shot don't benefit from each other's procs)
    if (p.D > 0) {
      const f0 = stacks(0);
      land(p.D * f0.critf * f0.extraM, 0, 0, f0);
      if (!until && hp <= 0) return 0;
    }
    for (let i = 0; i <= stepsMax; i++) {
      const shots = 1 + r * t;
      const f = stacks(shots);
      let shieldable = p.D * r * f.critf + (t >= 1.5 ? p.blast * r * f.critf : 0) + (p.F || 0) * r;
      let toxRate = 0, slashRate = 0;
      for (const T in p.dot) {
        // procs whose ticks are running now: applied between t − delay − span and t − delay (span = number of 1 s ticks)
        const D = DOT_DELAY[T] || 0, n = p.dotN && p.dotN[T] != null ? p.dotN[T] : Td;
        if (!(n > 0) || !p.dot[T]) continue;
        const te = t - D;
        let act = te < 0 ? 0 : r * Math.min(te, n) + (te < n ? 1 : 0);
        if (p.field && T === "napalm") act = 6 * r;
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
      const dmgH = land(shieldable * dt * f.extraM, toxRate * dt * f.extraM, slashRate * dt * f.extraM, f);
      if (!until && hp <= 0) return t + dt * (1 - Math.min(1, -hp / Math.max(1e-9, dmgH)));
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
    t.f = t.every ? 1 / t.every : 0.15 * (t.freq || 1);
    return t;
  }
  function evaluate1(weapon, atk, mods, o, riven) {
    let parts = atk.parts ? atk.parts : [atk];
    let weights = parts.map(() => 1);
    const tn = atk.kind === "melee" ? tennoOf(mods, Object.assign({}, o, { kills: o.scenario === "boss" ? false : o.kills })) : null;
    if (tn) {
      const heavyAtk = (weapon.attacks || []).find((x) => x.en === "Heavy Attack") || atk;
      parts = [atk, Object.assign({}, heavyAtk, { kind: "tennokai", name: atk.name, tenno: tn, swingFr: atk.fr })];
      weights = [1 / (1 + tn.f), tn.f / (1 + tn.f)];
    }
    // Volatile Quick Return with a detonation build: the first contact also sets off a bounce explosion
    // (50% damage, no combo multiplier, no guaranteed procs) before the heavy-attack detonation in the same throw
    if (atk.kind === "glaive" && /Recall/.test(atk.en) && mods.some((m) => m && m.eff && m.eff.volatile)) {
      const bn = (weapon.attacks || []).find((x) => x.kind === "glaive" && /Bounce/.test(x.en) && /Charged/.test(x.en) === /Charged/.test(atk.en));
      if (bn) { parts = parts.concat([Object.assign({}, bn, { bounceOnly: true, name: atk.name })]); weights = weights.concat([1]); }
    }
    const res = parts.map((p) => perShot(weapon, p, mods, o, riven, atk));
    const main = res[0];
    const kx = mods.find((m) => m && m.killExplode) ? mods.find((m) => m && m.killExplode).killExplode : null;
    const targets = o.targets || targetsFor(o);
    const kills = o.scenario === "boss" ? false : o.kills;
    const perF = {};
    for (const f of o.factions) {
      // sum per-shot params across parts (same trigger)
      const acc = { D: 0, blast: 0, F: 0, dot: {}, napH: 0, pv: 0, ph: 0, pc: 0, pk: 0, pm: 0, pp: 0, dotNon: {}, pvN: 0, phN: 0, pcN: 0, pkN: 0 };
      res.forEach((r, ri) => {
        const x = r.perF[f], wgt = weights[ri];
        acc.D += x.D * wgt; acc.blast += x.blast * wgt; acc.F += (x.F || 0) * wgt; acc.napH += (x.napH || 0) * wgt;
        for (const T in x.dot) acc.dot[T] = (acc.dot[T] || 0) + x.dot[T] * wgt;
        for (const T in x.dotNon) acc.dotNon[T] = (acc.dotNon[T] || 0) + x.dotNon[T] * wgt;
        acc.pv += x.pv * wgt; acc.ph += x.ph * wgt; acc.pc += x.pc * wgt; acc.pk += x.pk * wgt; acc.pm += (x.pm || 0) * wgt; acc.pp += (x.pp || 0) * wgt;
        acc.pvN += x.pvN * wgt; acc.phN += x.phN * wgt; acc.pcN += x.pcN * wgt; acc.pkN += x.pkN * wgt;
      });
      // explosion parts of a combined shot (direct hit + blast): the enemies around the target only take the blast
      const aoe = { D: 0, blast: 0, F: 0, dot: {}, napH: 0, pv: 0, ph: 0, pc: 0, pk: 0, pm: 0 };
      let Kaoe = 0;
      if (res.length > 1) res.forEach((r, ri) => {
        if (parts[ri].kind !== "radial" || r.K <= 1) return;
        const x = r.perF[f], wgt = weights[ri];
        Kaoe = Math.max(Kaoe, r.K);
        aoe.D += x.D * wgt; aoe.blast += x.blast * wgt; aoe.F += (x.F || 0) * wgt; aoe.napH += (x.napH || 0) * wgt;
        for (const T in x.dot) aoe.dot[T] = (aoe.dot[T] || 0) + x.dot[T] * wgt;
        aoe.pv += x.pv * wgt; aoe.ph += x.ph * wgt; aoe.pc += x.pc * wgt; aoe.pk += x.pk * wgt; aoe.pm += (x.pm || 0) * wgt;
      });
      if (atk.primer) {
        const pr = perShot(weapon, atk.primer, mods, o, riven, atk).perF[f];
        const k = (atk.primerRate || 0.25) / Math.max(0.05, main.rate);
        acc.pv += pr.pv * k; acc.ph += pr.ph * k; acc.pc += pr.pc * k; acc.pk += pr.pk * k;
      }
      const base = { field: !!o.napField, strip: o.ext.armorStrip || 0, r: main.rate, cc: main.cc, cd: main.cd, nc: main.nc || 0, corrMax: 10 + (o.ext.corrMax || 0), dt: o.dt, tmax: o.tmax, Tdur: main.Tdur, dotN: main.dotN,
        ogM: main.ogM || 1, frozenM: main.frozenM || 0, coldVuln: main.coldVuln || 0 };
      const hitP = { D: acc.D, blast: acc.blast, F: acc.F, dot: acc.dot, napH: acc.napH, pv: acc.pv, ph: acc.ph, pc: acc.pc, pk: acc.pk, pm: acc.pm, pp: acc.pp, aoeOnly: main && parts.every((q) => q.kind === "radial") };
      const nonP = { D: 0, blast: 0, dot: acc.dotNon, pv: acc.pvN, ph: acc.phN, pc: acc.pcN, pk: acc.pkN };
      const hasNon = Object.keys(acc.dotNon).some((T) => acc.dotNon[T] > 0);
      const period = 1 / Math.max(0.05, main.rate);
      const tAcq = isMeleeKind(atk.kind) ? 0 : T_ACQ;
      const solve = (tgs) => {
        const tg = tgs.main;
        const shc = 1 - (o.ext.shieldCut || 0);
        const pMain = Object.assign({}, base, hitP, { hp: tg.hp, sh: tg.sh * shc, ar0: tg.ar, og: tg.og || 0 });
        const tHit = ttk(pMain);
        let tHeavy = tHit, pHeavy = pMain;
        if (tgs.heavy) { pHeavy = Object.assign({}, base, hitP, { hp: tgs.heavy.hp, sh: tgs.heavy.sh * shc, ar0: tgs.heavy.ar }); tHeavy = ttk(pHeavy); }
        const tEx = tgs.ex ? ttk(Object.assign({}, base, hitP, { hp: tgs.ex.hp, sh: tgs.ex.sh * shc, ar0: tgs.ex.ar, og: tgs.ex.og })) : 0;
        let tNon = Infinity;
        if (o.scenario === "crowd" && hasNon && main.N > main.K) tNon = ttk(Object.assign({}, base, nonP, { hp: tg.hp, sh: tg.sh, ar0: tg.ar }));
        let kps, clear, Keff = main.K, ammoK = 1;
        // combined shot with punch through: enemies behind the first one take the direct hit only — the blast goes off on
        // the first enemy (wiki, Burston Prime Incarnon radial attack)
        if (res.length > 1 && parts[0].kind === "gun" && parts.some((p) => p.kind === "radial") && main.K > 1) {
          const d0 = res[0].perF[f], w0 = weights[0];
          const dirP = Object.assign({}, base, { D: d0.D * w0, blast: d0.blast * w0, F: (d0.F || 0) * w0, dot: Object.fromEntries(Object.entries(d0.dot).map(([T, v]) => [T, v * w0])),
            pv: d0.pv * w0, ph: d0.ph * w0, pc: d0.pc * w0, pk: d0.pk * w0, pm: (d0.pm || 0) * w0, hp: tg.hp, sh: tg.sh * shc, ar0: tg.ar });
          Keff = 1 + (main.K - 1) * Math.min(1, Math.max(tHit, period) / Math.max(ttk(dirP), period));
        }
        // Blast status (wiki "Blast Damage"): an enemy that dies with Blast stacks — or from a killing blow that procs Blast —
        // explodes for up to 300% of the hit's base damage in 5 m. Each kill then takes a share of its neighbours with it.
        const pbl = (main.procs && main.procs.blast) || 0;
        if (o.scenario === "crowd" && pbl > 0 && acc.blast > 0) {
          const unit = acc.blast / pbl;
          const onDeath = 1 - Math.exp(-pbl * Math.max(1, tHit * main.rate));
          const dealt = ttk(Object.assign({}, base, { D: unit * 10, blast: 0, F: 0, dot: {}, pv: 0, ph: 0, pc: 0, pk: 0, pm: 0, r: 0, cc: 0, nc: 0, hp: tg.hp, sh: tg.sh * shc, ar0: tg.ar }), o.dt);
          const n5 = Math.min(main.N - 1, (o.density || 0) * Math.PI * 25);
          Keff = Math.min(main.N, Keff * (1 + onDeath * n5 * Math.min(1, dealt / Math.max(1, tg.hp))));
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
          const eng = (t) => Math.max(period, tAcq + t);
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
    const magShots = (n) => n / (1 - Math.min(0.75, Math.max(0, a.ammoEff || 0)));
    for (const m of mods) {
      if (!m || !atk.mag) continue;
      const magN = Math.max(1, magShots(atk.mag * (1 + a.mag)));
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
    // Primary Compression (aiming): blast radius x0.2, +100% damage per metre lost
    let radiusMul = 1;
    if (arc && arc.compression && atk.radius && o.aim) { const lost = atk.radius * 0.8; a.dmg += lost; a.ammoEff += 0.055 * lost; radiusMul = 0.2; }
    const base0 = Object.values(atk.dmg).reduce((s, x) => s + x, 0);
    const vpct = o.val && o.val.type ? o.val.pct : 0;
    const Btot = (base0 + (a.baseAdd || 0)) * (1 + vpct);

    const rho = o.density;
    const radius = ((atk.radius || 0) * (kind === "glaive" ? 1 : 1 + a.blastR) + (kind === "glaive" ? a.radius : 0)) * radiusMul;
    let N, K, n3, n5;
    if (o.scenario === "crowd") {
      N = o.crowdN;
      const key = (parentAtk || atk).name;
      if (o.hits && o.hits[key]) K = o.hits[key];
      else if (radius > 0) K = Math.max(1, Math.min(N, rho * Math.PI * radius * radius));
      else if (atk.punch) K = Math.min(N, 1 + lineHits(Infinity));
      // punch-through: the enemies lined up behind the target (Poisson, mean 2) that the punch-through distance can pass
      // (0.6 m per body) — 3 m already reaches almost all of them, so more distance adds little. Explosive projectiles burst on first contact
      // and can't use it (wiki "Punch Through": the stat is locked for projectile AoE weapons)
      else if (!isMeleeKind(kind) && a.pt > 0 && !atk.ptLock && !(parentAtk && parentAtk.ptLock)) K = Math.min(N, 1 + lineHits(a.pt / BODY_PT));
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
          : def.trig === "reload" ? (atk.mag ? fr0 / Math.max(1, magShots(atk.mag * (1 + a.mag))) : 0) * def.p : 0;
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
      // glaive: the thrown glaive's own hits build combo (explosion-only hits don't — wiki), a heavy-attack
      // detonation spends it; Volatile bounce explosions get no combo multiplier and spend nothing
      const gain = kind === "glaive" ? (o.scenario === "crowd" ? Math.min(3, K) : 1) : K;
      M = kind === "tennokai" ? swingTier(atk.swingFr) : atk.bounceOnly ? 1 : comboMult(a.ic + (ext.icAdd || 0), a.hae, gain, o.comboHits, 1 / rate, a.ccc);
    } else if (kind === "melee") {
      rate = (atk.fr || 1) * Math.max(0.2, 1 + a.fr + (ext.asAdd || 0)) * 1.5;
    } else {
      let fr = a.lock > 0 && atk.semi ? atk.fr : atk.fr * Math.max(0.05, 1 + a.fr + a.frneg + (ext.frAdd || 0));
      // Semi-auto: the game's Accessibility option "Fire Manual Trigger Weapons Continuously" fires semi-automatic weapons for as
      // long as the trigger is held (overframe news 11, wiki Trigger_Type), so the modded fire rate counts in full. o.semiCap (shots
      // per second) caps it for someone clicking by hand.
      if (atk.semi && o.semiCap > 0) fr = Math.min(fr, o.semiCap);
      // spool-down while the trigger is held (Phenmor Incarnon Form: 100% → 60% over 51 shots, reset on release):
      // short bursts, so the average rate over one 51-shot burst
      if (atk.spoolDown) { const to = atk.spoolDown[1]; fr *= (1 - to) / Math.log(1 / to); }
      const mag = Math.max(1, magShots((atk.mag || 30) * (1 + a.mag)));   // shots between reloads
      let reload = (atk.reload || 2) * (atk.byRound ? Math.max(0.1, 1 + a.mag) : 1) / Math.max(0.1, 1 + a.reload);
      // Cyte-09 Resupply (wiki): casting instantly reloads the held firearm → a reload costs only the cast
      if (ext.reloadCast != null) reload = Math.min(reload, ext.reloadCast);
      // spool-up (Gorgon, Soma, Cestra …: wiki "Spool" shots, starting near 60% fire rate): ~0.28 x shots of extra time per magazine
      const spoolT = atk.spool && atk.mag ? 0.277 * atk.spool / fr : 0;
      rate = atk.mag ? mag / (mag / fr + spoolT + reload) : fr;
    }
    const dmgb = a.dmg + (isHeavy ? a.heavy : 0) + (ext.dmgAdd || 0) + (a.firstShot && atk.mag ? a.firstShot / Math.max(1, magShots(atk.mag * (1 + a.mag))) : 0);
    const msLock = a.msLock > 0;
    // atk.noMs: a radial part the wiki says multishot doesn't multiply (one blast per trigger pull)
    const ms0 = atk.noMs ? 1 : (atk.pellets || 1) * (msLock ? 1 : Math.max(0, 1 + a.ms + (ext.msAdd || 0)));
    const tierNow = isHeavy ? M : (isMelee ? swingTier(atk.fr) : 1);
    // Hata-Satya (wiki): "Each hit increases Critical Chance by 1.2%", "additive with similar mods", capped at +500%,
    // multishot and punch-through hits count, "Bonus ends as soon as the reload animation begins" (switching to the Incarnon
    // Form counts as a reload). Average over one magazine of hits (linear ramp 0 → min(cap, 1.2% × hits)).
    let hataAdd = 0;
    if (a.hata > 0 && !isMelee) {
      const shots = atk.inc ? (atk.incAmmo || 0) : magShots((atk.mag || 0) * (1 + a.mag));
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
    const cdBase = (((atk.cd || 1.5) + a.cdBase + preludeAdd) * (1 + a.cd + (ext.cdAdd || 0) + (tenno ? tenno.cd || 0 : 0)) + a.cdFlat) * (ext.cdMult && !isMelee ? ext.cdMult : 1) * cdFinal;
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
    const fin = (ext.final || 1) * (tenno ? 1 + (tenno.dmg || 0) : 1) * exChain * sniperM * (1 + (a.evoMult || 0));   // evoMult: Incarnon "unique multiplier" perks
    // falloff: distance (bullets/pellets) and blast edge (enemies around the centre of an explosion)
    let fallM = distFall(atk.fo, o);
    if (atk.rfo && o.scenario === "crowd" && K > 1) fallM *= (1 + (K - 1) * (1 - atk.rfo * 2 / 3)) / K;
    // Primary Plated Round: bonus ≈ 33.5%·√magazine for 10 s after each full reload (wiki examples)
    let platedB = 0;
    if (arc && arc.plated && atk.mag) {
      const rl = (atk.reload || 2) / Math.max(0.1, 1 + a.reload);
      const magN = atk.mag * (1 + a.mag), cyc = magShots(magN) / Math.max(0.05, (atk.fr || 1) * (1 + a.fr)) + (ext.reloadCast != null ? Math.min(rl, ext.reloadCast) : rl);
      platedB = 0.335 * Math.sqrt(magN) * Math.min(1, 10 / cyc);
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
        if (a.hm > 0) procs.slash = (procs.slash || 0) + a.hm * Math.min(1, ccBase) * ms;
        if (a.ib > 0 && procs.impact) procs.slash = (procs.slash || 0) + procs.impact * Math.min(1, a.ib * (rate < 2.5 ? 2 : 1));
        if (a.welt > 0 && procs.impact) procs.mag = (procs.mag || 0) + procs.impact * Math.min(1, a.welt * (rate < 2.5 ? 2 : 1));
        if (arc && arc.procStack) {
          // stacks expire all at once after `win` s without a proc (wiki: Cascadia Flare, Primary Frostbite/Blight,
          // Conjunction Voltage), so they keep growing while procs land at least every `win` s. With random gaps a run
          // lasts e^(rr*win) - 1 procs before it resets; nf = time-average stacks over a run (ramp to the cap, then held).
          const ps = arc.procStack;
          const per = (procs[ps.type] || 0) + (atk.forced && atk.forced.includes(ps.type) ? 1 : 0);
          const rr = per * rate * K, run = Math.expm1(Math.min(50, rr * ps.win));
          const nbar = run >= ps.max ? ps.max - ps.max * ps.max / (2 * run) : run / 2;
          const nf = Math.max(0, Math.min(1, nbar / ps.max));
          if (Math.abs(nf - fArc) < 1e-6) break;
          fArc = nf;
        } else break;
      }
      const cc = ccBase;
      if (arc && arc.doughty) cd += 10 * Math.min(1, sc) * (share.punct || 0);   // +1.0x per 10% Puncture status chance
      const dupf = 1 + dupD * (cc < 1 ? cc : cc < 2 ? 2 - cc : 0);
      if (dupf !== 1) for (const k in procs) procs[k] *= dupf;
      if (atk.forced) for (const f of atk.forced) procs[f] = (procs[f] || 0) + dupf;
      // Cyte-09 Resupply (wiki "Resupply", "Extra Hit"): every hit — each multishot instance — also lands an Extra Hit of the
      // chosen element that forces that element's status ("Main and extra hit have their own independent status procs")
      const xhitP = ext.xhit > 0 && ext.xhitElem ? ms : 0;
      if (xhitP) procs[ext.xhitElem] = (procs[ext.xhitElem] || 0) + xhitP;
      if (arc && arc.encumber) {
        const tot = Object.values(procs).reduce((x, y) => x + y, 0), types = ["impact", "punct", "slash", "heat", "cold", "elec", "tox", "blast", "rad", "gas", "mag", "viral", "corr"];
        for (const t of types) procs[t] = (procs[t] || 0) + arc.encumber * tot / types.length;
      }
      if (arc && arc.punctCold) procs.cold = (procs.cold || 0) + arc.punctCold * (procs.punct || 0);
      // Primary Debilitate (wiki): once a combined element sits at 10 stacks, every hit (each pellet is its own damage instance)
      // adds one of its base statuses — as a separate instance, so faction damage multiplies those DoTs once more
      let debil = null;
      if (arc && arc.debilitate) {
        const cmb = Object.keys(COMP).filter((T) => (procs[T] || 0) > 0).sort((x, y) => procs[y] - procs[x])[0];
        if (cmb) {
          const up = Math.min(1, procs[cmb] * rate * K * 6 / 10);     // share of the time the target holds 10 stacks
          debil = { comps: COMP[cmb], n: arc.debilitate * ms * up };
          for (const c of COMP[cmb]) procs[c] = (procs[c] || 0) + debil.n / 2;
        }
      }
      const procSum = Object.values(procs).reduce((x, y) => x + y, 0);
      // head portion (o.hs = real headshots): weak-point multiplier and doubled crit multiplier; ttk later multiplies by the body crit factor
      const hsReal = Math.min(1, o.hs || 0), hsBase = (atk.hsMult || 2) + a.hsMult;
      const ccH = cc + (atk.cc || 0) * (ext.wpcc || 0) + (ext.hsCcFlat || 0);   // Covenant: weak-point crit chance cap is higher
      const critBody = 1 + cc * (cd - 1), critHead = 1 + ccH * (2 * cd - 1);
      // Sonar-type weak spots (ext.weakFrac) are not heads: keep whichever of the two models gives more
      const hsmC = hsReal > 0 ? Math.max(hsm, ((1 - hsReal) * critBody + hsReal * hsBase * critHead) / critBody) : hsm;
      const hsDot = hsReal > 0 ? (1 - hsReal) + hsReal * hsBase : 1;
      // melee sneak attack on an unaware enemy: +700% (rank 30) added beside the crit term — Dmg x (1 + 7 + tier x (CD-1))
      const stealthM = ext.stealth && isMelee ? (critBody + ext.stealth) / critBody : 1;
      let u = 0;
      if (influence) {
        const pe = procs.elec || 0;
        const ph = 1 - Math.pow(0.8, pe);
        const pdet = 1 - Math.pow(1 - ph, K);
        u = 1 - Math.pow(1 - pdet, 18 * rate);
      }
      const spreadHit = 1 + u * (K - 1);
      const spreadNon = u * K;
      // steady-state status-type count for CO/galvanized (uses spread-inclusive rates)
      let ntypes = 0;
      for (const k in procs) {
        const r = procs[k] * rate * spreadHit; if (r <= 0) continue;
        ntypes += 1 - Math.exp(-r * (PROC_WIN[k] || 6) * dur);
      }
      // statuses other sources keep on the target (abilities, teammates) also count for Condition Overload / Galvanized
      if (ext.statusExtra) ntypes = Math.min(14, ntypes + ext.statusExtra);
      // Spiteful Defilement: +100% crit damage (flat) on targets with fewer than 3 status types
      if (a.cdFew) cd += a.cdFew * Math.max(0, Math.min(1, 3 - ntypes));
      // Galvanized Shot/Aptitude/Diffusion stacks need kills and boost direct hits only, not explosions (wiki)
      // Incarnon "+X% Direct Damage per Status Type" (no kill needed) counts the same way
      const gco = kind === "radial" ? 0 : (kills ? a.gco * ntypes : 0) + (a.evoPst || 0) * ntypes;
      const co = isMelee && !atk.noCO ? a.co * ntypes : 0;
      const mbd = Btot * exS * (1 + dmgb + dmgArc + platedB) * fallM;
      let directMult = Btot * exS * (1 + dmgb + dmgArc + platedB + gco + co) * fallM;
      // Secondary Irradiate (wiki): only direct hits spread, and elemental mods are 33% less effective on the spread hits
      if (arc && arc.irradiate && o.scenario === "crowd" && kind !== "radial") {
        const radSt = (procs.rad || 0) * rate * 12 * dur, upR = Math.min(1, radSt / 10);
        const n7 = Math.min(N - 1, rho * Math.PI * 49);
        let modEl = 0; for (const p of PRIM) modEl += Math.max(0, a.elem[p]); for (const t in a.extra) modEl += Math.max(0, a.extra[t]);
        const spreadEff = total > 0 ? Math.max(0, (total - 0.33 * modEl) / total) : 1;
        directMult *= 1 + arc.irradiate * spreadEff * n7 * upR / Math.max(1, K);
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
        // Xata's Whisper (wiki): extra Void hit = 26% x strength of the hit, faction and weak-point multipliers applied again;
        // Void has no faction weakness, so the element vulnerability of the hit is taken back out
        const xata = ext.xata || 0;
        if (xata) D *= 1 + xata * fac * hsmC / Math.max(0.25, vuln);
        // Resupply Extra Hit (wiki "Extra Hit"): "Weapon Hit Damage × Extra Hit Percentage × (1 + Faction Damage Bonuses)" as the
        // chosen element; "Faction elemental weaknesses do not calculate inside the extra instance's base damage" — so the hit's
        // own element vulnerability comes out and the chosen element's weakness (x1.5) goes in. Napalm ticks don't trigger it.
        if (ext.xhit > 0) D *= 1 + ext.xhit * fac * (ext.xhitElem && fac_.weak.includes(ext.xhitElem) ? 1.5 : 1) / Math.max(0.25, vuln);
        const dot = {}, dotNon = {};
        for (const T of DOT_TYPES) {
          const p = procs[T] || 0; if (p <= 0) continue;
          if (!dotN[T]) continue;
          let per = dotN[T] * hsDot * (T === "slash" ? 0.35 : 0.5) * mbd * (1 + bonus[T]) * (1 + sd + (T === "tox" ? (ext.sdTox || 0) : 0)) * (fac_.weak.includes(T) ? 1.5 : 1) * fin * fac * fac * M;
          if (xata) per *= 1 + xata * fac;      // every tick is a damage instance → its own Xata hit
          if (T === "elec") per *= n3;
          if (T === "gas") per *= ng;
          const dShare = debil && debil.comps.includes(T) && p > 0 ? (debil.n / 2) / p : 0;
          // a forced Resupply proc takes the Extra Hit's damage as its base (wiki), not the weapon hit's
          const pEff = xhitP && T === ext.xhitElem ? p - xhitP + xhitP * ext.xhit : p;
          dot[T] = pEff * per * spreadHit * (1 + dShare * (fac - 1));
          if (T !== "slash" && spreadNon > 0) dotNon[T] = p * per * spreadNon;
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
        const blast = (procs.blast || 0) * 0.3 * mbd * (1 + sd) * fin * fac * M * (xata ? 1 + xata * fac : 1);
        const vm0 = 4.25, dsum = Object.values(dot).reduce((s, x) => s + x, 0) + napHdisp;
        const dispDirect = D * vm0, dispDot = dsum * vm0, dispBlast = blast * vm0;
        const dispDotBy = {}; for (const T in dot) dispDotBy[T] = dot[T] * vm0;
        if (napHdisp > 0) dispDotBy.napalmHeat = napHdisp * vm0;
        perF[fname] = {
          D, blast, dot, dotNon, napH, F: arc && arc.flatPerProc ? arc.flatPerProc * procSum * fin * fac : 0,
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
        best = { conceptOk: cD === 0, conceptD: cD, nLayouts: allLayouts.length, scoreSS, exS, exChain, sniperM, vigil: a.vigil, glad: a.glad, perF, layout: L, share, procs, cc, cd, critf: 1 + cc * (cd - 1) + (a.nc ? Math.max(0, 1 - cc) * a.nc : 0), sc, ms, rate, M, tierNow, K, N, u, ntypes, gco, co, nc: a.nc || 0, dmgb: dmgb + dmgArc + platedB, sd, dur, total, Btot, mbd, Tdur, dotN, fArc, hsFrac, hsM,
          fallM, ogM: (arc && arc.ogMult ? arc.ogMult : 1) * (1 + 0.5 * (share.void || 0)), frozenM: arc && arc.frozenMult && isMelee ? arc.frozenMult : 0, coldVuln: arc && arc.coldVuln ? arc.coldVuln : 0 };
      }
    }
    // ammo: seconds of continuous fire from a full load, and ammo packs needed per minute
    // Incarnon Form: its own pool (charges), untouched by mods and ammo efficiency; the form ends when it runs out
    const incOf = atk.inc || (atk.parts && atk.parts[0].inc);
    if (best && incOf) {
      const rounds = atk.incAmmo || (atk.parts && atk.parts[0].incAmmo) || 0;
      const cost = atk.ammoCost != null ? atk.ammoCost : atk.parts && atk.parts[0].ammoCost != null ? atk.parts[0].ammoCost : 1;
      best.inc = { rounds, sec: rounds ? rounds / Math.max(1e-6, rate * cost) : null };
    } else if (best && weapon.ammoMax && !isMelee) {
      const magN = (atk.mag || 0) * (1 + a.mag), maxA = weapon.ammoMax * (1 + a.ammoMax);
      const cost = atk.ammoCost != null ? atk.ammoCost : atk.parts && atk.parts[0].ammoCost != null ? atk.parts[0].ammoCost : 1;
      const use = rate * cost * (1 - Math.min(0.75, a.ammoEff));      // all sources together cap at 75% (Hotfix 44.1.3)
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
