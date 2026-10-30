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
  const PROC_WIN = { blast: 1.5, corr: 8, rad: 12, impact: 6 };
  const ARMOR_CAP = 2700;

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
    "ic", "hae", "br", "ww", "co", "gco", "radius", "pt", "cdFlat", "ccFlat", "hsMult", "msLock", "hm", "ib", "welt",
    "ammoMax", "ammoEff", "ammoConv", "throwSpd", "projSpd", "volatile", "blastR", "firstShot"];
  const EXTRA = ["radm", "magm", "gasm", "blastm", "viralm", "corrm", "heatx", "coldx", "elecx", "toxx", "voidx"];
  function newAgg() {
    const a = { elem: { heat: 0, cold: 0, elec: 0, tox: 0 }, phys: { impact: 0, punct: 0, slash: 0 }, extra: {} };
    for (const k of EXTRA) a.extra[k] = 0;
    for (const k of NUM_KEYS) a[k] = 0;
    return a;
  }
  function applyEff(a, eff) {
    for (const k in eff) {
      const v = eff[k];
      if (k === "tenno" || k === "bane") { a[k] = a[k] || {}; for (const t in v) a[k][t] = (a[k][t] || 0) + v[t]; continue; }
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
      default: return false;
    }
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
      if (m.cond) for (const c of m.cond) if (condActive(c.when, o)) applyEff(a, c.eff);
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
  // tail: [[type, value]] shard elements that join a mod of the same element, otherwise come after all mods.
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
      const appended = [];
      for (const [p, x] of tail || []) if (x > 0) appended.push([p, x, "shard"]);
      const inn = [];
      for (const p of PRIM) if (atk.dmg[p]) inn.push([p, atk.dmg[p] / Btot, "innate"]);
      if (val && val.type && val.pct > 0) {
        const vx = (base0 * val.pct) / Btot, same = inn.find((e) => e[0] === val.type);
        if (same) same[1] += vx; else inn.push([val.type, vx, "val"]);
      }
      inn.sort((x, y) => (PRIM.includes(x[0]) ? PRIM.indexOf(x[0]) : 9) - (PRIM.includes(y[0]) ? PRIM.indexOf(y[0]) : 9));
      appended.push(...inn);
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

  function comboMult(ic, hae, K, hitsBetween) {
    const e = Math.min(0.9, hae);
    let cPrev = ic + K + hitsBetween, cDet = 0;
    for (let i = 0; i < 40; i++) { cDet = Math.max(ic, cPrev * e) + 1; cPrev = cDet + K + hitsBetween; }
    return Math.min(12, Math.floor(cDet / 20) + 1);
  }
  const comboTier = (c) => Math.min(12, Math.floor(c / 20) + 1);

  function defaults() {
    return {
      scenario: "crowd", tier: "light", factions: ["grineer", "corpus", "infested"], metric: "geo",
      level: 150, steel: true, crowdN: 12, density: 6 / (Math.PI * 7.9 * 7.9), hits: null,
      kills: true, hs: 0, aim: false, casting: false, energy: false,
      ext: {}, val: null, arcane: null, mercy: false, throwOverhead: 0.5, comboHits: 0, meleeCombo: 220, og: false, frameArcs: [], armor: 0,
      targets: null, dt: 0.2, tmax: 60,
    };
  }
  function targetsAt(o, level) {
    const out = {};
    for (const f of o.factions) {
      if (o.scenario === "boss") out[f] = { main: enemyStats(f, "boss", level, o.steel) };
      else if (o.scenario === "crowd") out[f] = { main: enemyStats(f, "light", level, o.steel), heavy: enemyStats(f, "heavy", level, o.steel) };
      else { out[f] = { main: enemyStats(f, "heavy", level, o.steel) }; if (o.og) out[f].main.og = overguardAt(level); }
    }
    return out;
  }
  // score = geometric mean of kill speed at the chosen level and at +100 levels (fast now, still strong later)
  function targetsFor(o) { return { lo: targetsAt(o, o.level), hi: targetsAt(o, o.level + (o.levelStep == null ? 100 : o.levelStep)) }; }

  /* ---------- time-to-kill simulation ---------- */
  // p: {hp, sh, ar0, strip, r, D, blast, dot:{T:X}, Tdur, pv, ph, pc, pk, cc, cd, corrMax, dt, tmax, firstShot}
  function ttk(p, until) {
    let hp = p.hp, sh = p.sh, og = p.og || 0, t = 0, lastRate = 1, dealt = 0;
    const dt = p.dt, r = p.r, Td = Math.max(0.5, p.Tdur);
    const stepsMax = until ? Math.ceil(until / dt) - 1 : Math.ceil(p.tmax / dt);
    for (let i = 0; i <= stepsMax; i++) {
      const shots = 1 + r * t;
      const nv = Math.min(10, p.pv * shots), nc = Math.min(p.corrMax, p.pc * shots), nk = Math.min(og > 0 ? 4 : 10, p.pk * shots);
      const nm = Math.min(10, (p.pm || 0) * shots);
      const magM = nm <= 0 ? 1 : nm < 1 ? 1 + nm : 2 + 0.25 * (nm - 1);      // Magnetic: shields and overguard take more
      const extraM = (1 + (p.coldVuln || 0) * nk) * (p.frozenM && nk >= 10 ? p.frozenM : 1);
      const vm = nv <= 0 ? 1 : nv < 1 ? 1 + nv : 2 + 0.25 * (nv - 1);
      const hf = 1 - Math.exp(-p.ph * shots);
      const cs = nc <= 0 ? 0 : nc >= 1 ? 0.2 + 0.06 * nc : 0.26 * nc;
      let A = p.ar0 * (1 - 0.5 * hf) * (1 - cs) * (1 - p.strip);
      A = Math.min(A, ARMOR_CAP);
      const ar = A > 0 ? 1 - 0.9 * Math.sqrt(A / ARMOR_CAP) : 1;
      const cdb = nk <= 0 ? 0 : nk < 1 ? 0.1 * nk : Math.min(0.45, 0.1 + 0.05 * (nk - 1));
      const critf = 1 + p.cc * (p.cd + cdb - 1);
      let shieldable = p.D * r * critf + (i === 0 ? p.D * critf / dt : 0) + (t >= 1.5 ? p.blast * r * critf : 0) + (p.F || 0) * r;
      const nAct = r * Math.min(t, Td) + (t < Td ? 1 : 0);
      let toxRate = 0, slashRate = 0;
      for (const T in p.dot) {
        const v = (p.dot[T] / Td) * nAct * critf;
        if (T === "tox") toxRate += v; else if (T === "slash") slashRate += v; else shieldable += v;
      }
      let S = shieldable * dt * extraM, tx = toxRate * dt * extraM, sl = slashRate * dt * extraM;
      if (og > 0) {
        // overguard first: no armor, no Viral; Magnetic and Void boost it
        const raw = (S + tx + sl) * magM * (p.ogM || 1);
        if (raw < og) { og -= raw; lastRate = raw / dt; t += dt; continue; }
        const keep = 1 - og / Math.max(1e-9, raw); og = 0; S *= keep; tx *= keep; sl *= keep;
      }
      if (sh > 0) { const take = Math.min(sh, S * magM); sh -= take; S -= take / magM; }
      const dmgH = S * vm * ar + tx * vm * ar + sl * vm;
      hp -= dmgH; dealt += dmgH;
      lastRate = dmgH / dt;
      if (!until && hp <= 0) return t + dt * (1 - Math.min(1, -hp / Math.max(1e-9, dmgH)));
      t += dt;
    }
    if (until) return dealt;
    return p.tmax + hp / Math.max(1e-6, lastRate);
  }

  /* ---------- evaluation ---------- */
  // Element arrangement: o.elemOrder fixes it (slot order as typed). Otherwise every possible arrangement is a
  // candidate; o.layoutTTK picks the one with the best time-to-kill score (exact), else steady-state damage (fast).
  function evaluate(weapon, atk, mods, o, riven) {
    if (o.layoutTTK && o.layoutIdx === undefined && !(o.elemOrder && o.elemOrder.length)) {
      let best = evaluate1(weapon, atk, mods, Object.assign({}, o, { layoutIdx: 0 }), riven);
      for (let i = 1; i < (best.nLayouts || 1); i++) {
        const r = evaluate1(weapon, atk, mods, Object.assign({}, o, { layoutIdx: i }), riven);
        if (r.score > best.score) best = r;
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
      parts = [atk, Object.assign({}, heavyAtk, { kind: "tennokai", name: atk.name, tenno: tn })];
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
      const acc = { D: 0, blast: 0, F: 0, dot: {}, pv: 0, ph: 0, pc: 0, pk: 0, pm: 0, dotNon: {}, pvN: 0, phN: 0, pcN: 0, pkN: 0 };
      res.forEach((r, ri) => {
        const x = r.perF[f], wgt = weights[ri];
        acc.D += x.D * wgt; acc.blast += x.blast * wgt; acc.F += (x.F || 0) * wgt;
        for (const T in x.dot) acc.dot[T] = (acc.dot[T] || 0) + x.dot[T] * wgt;
        for (const T in x.dotNon) acc.dotNon[T] = (acc.dotNon[T] || 0) + x.dotNon[T] * wgt;
        acc.pv += x.pv * wgt; acc.ph += x.ph * wgt; acc.pc += x.pc * wgt; acc.pk += x.pk * wgt; acc.pm += (x.pm || 0) * wgt;
        acc.pvN += x.pvN * wgt; acc.phN += x.phN * wgt; acc.pcN += x.pcN * wgt; acc.pkN += x.pkN * wgt;
      });
      // explosion parts of a combined shot (direct hit + blast): the enemies around the target only take the blast
      const aoe = { D: 0, blast: 0, F: 0, dot: {}, pv: 0, ph: 0, pc: 0, pk: 0, pm: 0 };
      let Kaoe = 0;
      if (res.length > 1) res.forEach((r, ri) => {
        if (parts[ri].kind !== "radial" || r.K <= 1) return;
        const x = r.perF[f], wgt = weights[ri];
        Kaoe = Math.max(Kaoe, r.K);
        aoe.D += x.D * wgt; aoe.blast += x.blast * wgt; aoe.F += (x.F || 0) * wgt;
        for (const T in x.dot) aoe.dot[T] = (aoe.dot[T] || 0) + x.dot[T] * wgt;
        aoe.pv += x.pv * wgt; aoe.ph += x.ph * wgt; aoe.pc += x.pc * wgt; aoe.pk += x.pk * wgt; aoe.pm += (x.pm || 0) * wgt;
      });
      if (atk.primer) {
        const pr = perShot(weapon, atk.primer, mods, o, riven, atk).perF[f];
        const k = (atk.primerRate || 0.25) / Math.max(0.05, main.rate);
        acc.pv += pr.pv * k; acc.ph += pr.ph * k; acc.pc += pr.pc * k; acc.pk += pr.pk * k;
      }
      const base = { strip: o.ext.armorStrip || 0, r: main.rate, cc: main.cc, cd: main.cd, corrMax: 10 + (o.ext.corrMax || 0), dt: o.dt, tmax: o.tmax, Tdur: main.Tdur,
        ogM: main.ogM || 1, frozenM: main.frozenM || 0, coldVuln: main.coldVuln || 0 };
      const hitP = { D: acc.D, blast: acc.blast, F: acc.F, dot: acc.dot, pv: acc.pv, ph: acc.ph, pc: acc.pc, pk: acc.pk, pm: acc.pm };
      const nonP = { D: 0, blast: 0, dot: acc.dotNon, pv: acc.pvN, ph: acc.phN, pc: acc.pcN, pk: acc.pkN };
      const hasNon = Object.keys(acc.dotNon).some((T) => acc.dotNon[T] > 0);
      const period = 1 / Math.max(0.05, main.rate);
      const solve = (tgs) => {
        const tg = tgs.main;
        const shc = 1 - (o.ext.shieldCut || 0);
        const pMain = Object.assign({}, base, hitP, { hp: tg.hp, sh: tg.sh * shc, ar0: tg.ar, og: tg.og || 0 });
        const tHit = ttk(pMain);
        let tHeavy = tHit, pHeavy = pMain;
        if (tgs.heavy) { pHeavy = Object.assign({}, base, hitP, { hp: tgs.heavy.hp, sh: tgs.heavy.sh * shc, ar0: tgs.heavy.ar }); tHeavy = ttk(pHeavy); }
        let tNon = Infinity;
        if (o.scenario === "crowd" && hasNon && main.N > main.K) tNon = ttk(Object.assign({}, base, nonP, { hp: tg.hp, sh: tg.sh, ar0: tg.ar }));
        let kps, clear, Keff = main.K;
        // overkill margin: when an enemy dies within one attack period, a bigger margin still ranks higher
        const margin = (t, params) => {
          if (t >= period) return 1;
          const ratio = ttk(params, period) / Math.max(1, params.hp);   // overkill within one attack period
          return 1 + 0.3 * Math.log2(Math.max(1, ratio));
        };
        if (o.scenario === "crowd") {
          // bystanders in the blast die together with the target when the blast alone kills them about as fast
          if (Kaoe > 1) {
            const tA = ttk(Object.assign({}, base, aoe, { hp: tg.hp, sh: tg.sh * shc, ar0: tg.ar }));
            Keff = Math.max(Keff, 1 + (Kaoe - 1) * Math.min(1, Math.max(tHit, period) / Math.max(tA, period)));
          }
          const sweep = (main.N / Keff) * period + tHit;
          const spread = isFinite(tNon) && tNon < 40 ? Math.max(tHit, tNon) : Infinity;
          let lights = Math.min(sweep, spread);
          clear = Math.max(lights, tHeavy + period);
          if (kx) {
            // kill explosions (e.g. Acid Shells: 45% max health in 10 m): three kills close together chain through the pack
            const need = Math.max(0, Math.ceil(Math.min(3, main.N) / Math.max(1, Keff)) - 1);
            const casc = tHit + need * period + 0.3;
            lights = Math.min(lights, casc);
            clear = Math.max(lights, Math.min(tHeavy + period, casc + 0.3));
          }
          kps = main.N / Math.max(period, clear) * margin(tHeavy, pHeavy);
        } else { clear = Math.max(period, tHit); kps = margin(tHit, pMain) / clear; }
        return { ttk: tHit, ttkHeavy: tHeavy, ttkNon: tNon, kps, clear, target: tg, targetHeavy: tgs.heavy || null, Keff };
      };
      const lo = solve(targets.lo[f]), hi = solve(targets.hi[f]);
      const disp = res.reduce((s, r) => { const x = r.perF[f]; s.direct += x.dispDirect; s.dot += x.dispDot; s.blast += x.dispBlast; for (const T in x.dispDotBy) s.dotBy[T] = (s.dotBy[T] || 0) + x.dispDotBy[T]; return s; }, { direct: 0, dot: 0, blast: 0, dotBy: {} });
      perF[f] = Object.assign({}, lo, { hi, period, kps: Math.sqrt(lo.kps * hi.kps), kpsLo: lo.kps, direct: disp.direct, dot: disp.dot, blast: disp.blast, dotBy: disp.dotBy, perShot: disp.direct + disp.dot + disp.blast });
    }
    const vals = o.factions.map((f) => perF[f].kps);
    const score = o.metric === "min" ? Math.min(...vals) : Math.exp(vals.reduce((s, x) => s + Math.log(Math.max(x, 1e-9)), 0) / vals.length);
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
    const ext = o.ext || {};
    // ability elements (Electric Shield, Toxic Lash, Xata's Whisper, Nourish) stay separate — they never combine.
    // "*mod" keys (Violet shard electricity) behave like an elemental mod: added to a mod of that element, else after the mods.
    const tail = [];
    if (ext.elem) for (const k in ext.elem) {
      if (k.endsWith("mod")) { const p = k.slice(0, -3); if (a.elem[p] > 0) a.elem[p] += ext.elem[k]; else tail.push([p, ext.elem[k]]); }
      else if (k in a.extra) a.extra[k] += ext.elem[k];
    }
    const arc = o.arcane ? (root.WF_ARCANES || {})[o.arcane] : null;
    if (arc) {
      if (arc.eff) applyEff(a, arc.eff);
      if (arc.cond) for (const c of arc.cond) if (condActive(c.when, oo)) applyEff(a, c.eff);
    }
    if (arc && arc.energyMs) a.ms += Math.min(3.5, arc.energyMs * (o.maxEnergy || 300) / 100);
    if (arc && arc.bulwark) a.dmg += Math.min(5, Math.max(0, ((o.armor || 0) - 1000) * 0.01));
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
    for (const m of mods) {
      if (!m || !atk.mag) continue;
      const magN = Math.max(1, atk.mag * (1 + a.mag));
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
    const Btot = base0 * (1 + vpct);

    const rho = o.density;
    const radius = ((atk.radius || 0) * (kind === "glaive" ? 1 : 1 + a.blastR) + (kind === "glaive" ? a.radius : 0)) * radiusMul;
    let N, K, n3, n5;
    if (o.scenario === "crowd") {
      N = o.crowdN;
      const key = (parentAtk || atk).name;
      if (o.hits && o.hits[key]) K = o.hits[key];
      else if (radius > 0) K = Math.max(1, Math.min(N, rho * Math.PI * radius * radius));
      else if (atk.punch) K = Math.min(N, 4);
      // punch-through: ~0.35 extra bodies per metre in a 12-enemy crowd. Explosive projectiles burst on first contact
      // and can't use it (wiki "Punch Through": the stat is locked for projectile AoE weapons)
      else if (!isMeleeKind(kind) && a.pt > 0 && !atk.ptLock && !(parentAtk && parentAtk.ptLock)) K = Math.min(N, 1 + 0.35 * a.pt);
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
          : def.trig === "reload" ? (atk.mag ? fr0 / Math.max(1, atk.mag * (1 + a.mag)) : 0) * def.p : 0;
        up = uptime(lam, def.t);
      }
      for (const k in def.eff || {}) a[k] = (a[k] || 0) + def.eff[k] * up;
      if (def.cdFinal) cdFinal *= def.cdFinal;
    }

    let rate, M = 1;
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
      M = kind === "tennokai" ? comboTier(o.meleeCombo) : atk.bounceOnly ? 1 : comboMult(a.ic + (ext.icAdd || 0), a.hae, gain, o.comboHits);
    } else if (kind === "melee") {
      rate = (atk.fr || 1) * Math.max(0.2, 1 + a.fr + (ext.asAdd || 0)) * 1.5;
    } else {
      let fr = a.lock > 0 && atk.semi ? atk.fr : atk.fr * Math.max(0.05, 1 + a.fr + a.frneg + (ext.frAdd || 0));
      if (atk.semi) fr = Math.min(fr, 3.5);   // realistic semi-auto click rate
      const mag = Math.max(1, (atk.mag || 30) * (1 + a.mag));
      const reload = (atk.reload || 2) * (atk.byRound ? Math.max(0.1, 1 + a.mag) : 1) / Math.max(0.1, 1 + a.reload);
      rate = atk.mag ? mag / (mag / fr + reload) : fr;
    }
    const dmgb = a.dmg + (isHeavy ? a.heavy : 0) + (ext.dmgAdd || 0) + (a.firstShot && atk.mag ? a.firstShot / Math.max(1, atk.mag * (1 + a.mag)) : 0);
    const msLock = a.msLock > 0;
    const ms0 = (atk.pellets || 1) * (msLock ? 1 : Math.max(0, 1 + a.ms + (ext.msAdd || 0)));
    const tierNow = isHeavy ? M : (isMelee ? comboTier(o.meleeCombo) : 1);
    const ccMod = (isHeavy ? 2 * a.cc : a.cc) + a.ccHeavyNoDouble + (ext.ccAdd || 0);
    let ccBase = (atk.cc || 0) * (1 + ccMod + (a.br + (isMelee ? a.glad : 0)) * Math.max(0, tierNow - 1)) + a.ccFlat + (ext.ccFlat || 0);
    if (o.arcane === "melee_animosity" && isHeavy) ccBase += (atk.cc || 0) * 0.42 * 1.5;
    if (arc && arc.enervate) ccBase = enervateCC(ccBase);
    // Vigilante set: a crit has a chance to go one tier higher = same average as that much more crit chance on crits
    if (a.vigil && weapon.slot === "primary") ccBase += a.vigil * Math.min(1, ccBase);
    const cdBase = ((atk.cd || 1.5) * (1 + a.cd + (ext.cdAdd || 0) + (tenno ? tenno.cd || 0 : 0)) + a.cdFlat) * (ext.cdMult && !isMelee ? ext.cdMult : 1) * cdFinal;
    const sc = (atk.sc || 0) * (1 + a.sc + a.ww * Math.max(0, tierNow - 1) + (ext.scAdd || 0) + (tenno ? tenno.sc || 0 : 0) + (isHeavy ? ext.heavySc || 0 : 0));
    const sd = a.sd + (isHeavy ? ext.heavySd || 0 : 0);
    const influence = o.arcane === "melee_influence" && isMelee;
    const dupD = o.arcane === "melee_duplicate" ? 1 : o.arcane === "melee_duplicate1" ? 0.4 : 0;
    let hsFrac = o.hs || 0, hsM = (atk.hsMult || 2) + a.hsMult;
    if (ext.weakFrac) { hsFrac = Math.max(hsFrac, ext.weakFrac); hsM = Math.max(hsM, ext.weakMult || 1); }
    const hsm = hsFrac > 0 ? (1 - hsFrac) + hsFrac * hsM : 1;
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
    const fin = (ext.final || 1) * (tenno ? 1 + (tenno.dmg || 0) : 1) * exChain * sniperM;
    // falloff: distance (bullets/pellets) and blast edge (enemies around the centre of an explosion)
    let fallM = distFall(atk.fo, o);
    if (atk.rfo && o.scenario === "crowd" && K > 1) fallM *= (1 + (K - 1) * (1 - atk.rfo * 2 / 3)) / K;
    // Primary Plated Round: bonus ≈ 33.5%·√magazine for 10 s after each full reload (wiki examples)
    let platedB = 0;
    if (arc && arc.plated && atk.mag) {
      const magN = atk.mag * (1 + a.mag), cyc = magN / Math.max(0.05, (atk.fr || 1) * (1 + a.fr)) + (atk.reload || 2) / Math.max(0.1, 1 + a.reload);
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
      for (const [p, x] of tail) if (L.mp[p] === p && bonus[p] !== undefined) bonus[p] += x;
      // arcane proc stacks (frostbite/blight/flare/voltage)
      let fArc = 1, ms = ms0, cd = cdBase, dmgArc = 0, procs;
      for (let it = 0; it < 3; it++) {
        ms = ms0; cd = cdBase; dmgArc = 0;
        if (arc && arc.procStack) {
          const ps = arc.procStack;
          if (ps.ms && !msLock) ms += (atk.pellets || 1) * ps.ms * fArc;
          if (ps.cd) cd += (atk.cd || 1.5) * ps.cd * fArc;
          if (ps.dmg) dmgArc = ps.dmg * fArc;
        }
        procs = {};
        for (const k in share) procs[k] = sc * ms * share[k];
        if (a.hm > 0) procs.slash = (procs.slash || 0) + a.hm * Math.min(1, ccBase) * ms;
        if (a.ib > 0 && procs.impact) procs.slash = (procs.slash || 0) + procs.impact * Math.min(1, a.ib * (rate < 2.5 ? 2 : 1));
        if (a.welt > 0 && procs.impact) procs.mag = (procs.mag || 0) + procs.impact * Math.min(1, a.welt * (rate < 2.5 ? 2 : 1));
        if (arc && arc.procStack) {
          const rr = (procs[arc.procStack.type] || 0) * rate * K;
          const nf = Math.min(1, rr * arc.procStack.win / arc.procStack.max);
          if (Math.abs(nf - fArc) < 1e-6) break;
          fArc = nf;
        } else break;
      }
      const cc = ccBase;
      if (arc && arc.doughty) cd += 10 * Math.min(1, sc) * (share.punct || 0);   // +1.0x per 10% Puncture status chance
      const dupf = 1 + dupD * (cc < 1 ? cc : cc < 2 ? 2 - cc : 0);
      if (dupf !== 1) for (const k in procs) procs[k] *= dupf;
      if (atk.forced) for (const f of atk.forced) procs[f] = (procs[f] || 0) + dupf;
      if (arc && arc.encumber) {
        const tot = Object.values(procs).reduce((x, y) => x + y, 0), types = ["impact", "punct", "slash", "heat", "cold", "elec", "tox", "blast", "rad", "gas", "mag", "viral", "corr"];
        for (const t of types) procs[t] = (procs[t] || 0) + arc.encumber * tot / types.length;
      }
      if (arc && arc.punctCold) procs.cold = (procs.cold || 0) + arc.punctCold * (procs.punct || 0);
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
      // Galvanized Shot/Aptitude/Diffusion stacks need kills and boost direct hits only, not explosions (wiki)
      const gco = kind === "radial" ? 0 : kills ? a.gco * ntypes : 0;
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
      const Tdur = 6 * dur, ticks = Math.max(1, Math.floor(6 * dur + 1e-9));
      const gasSt = Math.min(10, (procs.gas || 0) * rate * spreadHit * 6 * dur);
      const rg = Math.min(6, 3 + 0.3 * Math.max(0, gasSt - 1));
      const ng = o.scenario === "crowd" ? Math.min(N, 1 + rho * Math.PI * rg * rg) : 1;
      const perF = {};
      let scoreSS = 0;
      for (const fname of o.factions) {
        const fac_ = FACTIONS[fname];
        const fac = facAll + (a.bane && a.bane[fname] ? a.bane[fname] : 0);   // Roar-type buffs + faction damage mods (additive)
        let vuln = 0; for (const k in share) vuln += share[k] * (fac_.weak.includes(k) ? 1.5 : 1);
        const D = directMult * total * ms * vuln * hsmC * fin * fac * M * dupf * stealthM;
        const dot = {}, dotNon = {};
        for (const T of DOT_TYPES) {
          const p = procs[T] || 0; if (p <= 0) continue;
          let per = ticks * hsDot * (T === "slash" ? 0.35 : 0.5) * mbd * (1 + bonus[T]) * (1 + sd + (T === "tox" ? (ext.sdTox || 0) : 0)) * (fac_.weak.includes(T) ? 1.5 : 1) * fin * fac * fac * M;
          if (T === "elec") per *= n3;
          if (T === "gas") per *= ng;
          dot[T] = p * per * spreadHit;
          if (T !== "slash" && spreadNon > 0) dotNon[T] = p * per * spreadNon;
        }
        const blast = (procs.blast || 0) * 0.3 * mbd * (1 + sd) * fin * fac * M;
        const vm0 = 4.25, dsum = Object.values(dot).reduce((s, x) => s + x, 0);
        const dispDirect = D * vm0, dispDot = dsum * vm0, dispBlast = blast * vm0;
        const dispDotBy = {}; for (const T in dot) dispDotBy[T] = dot[T] * vm0;
        perF[fname] = {
          D, blast, dot, dotNon, F: arc && arc.flatPerProc ? arc.flatPerProc * procSum * fin * fac : 0,
          pv: (procs.viral || 0) * spreadHit, ph: (procs.heat || 0) * spreadHit, pc: (procs.corr || 0) * spreadHit, pk: (procs.cold || 0) * spreadHit, pm: (procs.mag || 0) * spreadHit,
          pvN: (procs.viral || 0) * spreadNon, phN: (procs.heat || 0) * spreadNon, pcN: (procs.corr || 0) * spreadNon, pkN: (procs.cold || 0) * spreadNon,
          dispDirect, dispDot, dispBlast, dispDotBy,
        };
        scoreSS += Math.log(Math.max(1e-9, dispDirect + dispDot + dispBlast));
      }
      if (!best || scoreSS > best.scoreSS) {
        best = { nLayouts: allLayouts.length, scoreSS, exS, exChain, sniperM, vigil: a.vigil, glad: a.glad, perF, layout: L, share, procs, cc, cd, critf: 1 + cc * (cd - 1), sc, ms, rate, M, K, N, u, ntypes, gco, co, dmgb: dmgb + dmgArc + platedB, sd, dur, total, Btot, mbd, Tdur, fArc, hsFrac, hsM,
          fallM, ogM: (arc && arc.ogMult ? arc.ogMult : 1) * (1 + 0.5 * (share.void || 0)), frozenM: arc && arc.frozenMult && isMelee ? arc.frozenMult : 0, coldVuln: arc && arc.coldVuln ? arc.coldVuln : 0 };
      }
    }
    // ammo: seconds of continuous fire from a full load, and ammo packs needed per minute
    if (best && weapon.ammoMax && !isMelee) {
      const magN = (atk.mag || 0) * (1 + a.mag), maxA = weapon.ammoMax * (1 + a.ammoMax);
      const cost = atk.ammoCost != null ? atk.ammoCost : atk.parts && atk.parts[0].ammoCost != null ? atk.parts[0].ammoCost : 1;
      const use = rate * cost * (1 - Math.min(0.95, a.ammoEff));
      best.ammo = { sustain: (magN + maxA) / Math.max(1e-6, use), use, mag: magN, max: maxA, pickup: weapon.ammoPickup || 0,
        packsPerMin: weapon.ammoPickup ? use * 60 / weapon.ammoPickup : null, conv: a.ammoConv };
    }
    return best;
  }

  /* ---------- mod capacity (wiki "Polarity", "Stance") ---------- */
  // Orokin Catalyst assumed: capacity = 2 x max rank (60, or 80 for rank-40 Kuva/Tenet/Coda); melee: matching maxed stance +10.
  // A matching polarity halves a mod's drain (rounded up), a different polarity adds 25% (rounded up); one forma re-polarizes one slot.
  function modDP(m) {
    if (!m) return null;
    if (m.id === "__riven") return { d: 18, p: "*" };          // rank-8 riven; its polarity is assumed to match a slot
    return { d: m.drain != null ? m.drain : 10, p: m.pol && m.pol !== "universal" ? m.pol : "" };
  }
  const halfD = (d) => Math.ceil(d / 2), badD = (d) => Math.ceil(d * 1.25);
  function slotCost(normal, slotPols, k) {
    const free = {}; let neutral = 0;
    for (const p of slotPols) { if (p) free[p] = (free[p] || 0) + 1; else neutral++; }
    let cost = 0; const left = [], wild = [], formaPols = [];
    for (const m of normal.slice().sort((x, y) => y.d - x.d)) {
      if (m.p === "*") { wild.push(m); continue; }
      if (m.p && free[m.p] > 0) { free[m.p]--; cost += halfD(m.d); } else left.push(m);
    }
    for (const m of wild) {
      const pk = Object.keys(free).find((p) => free[p] > 0);
      if (pk) { free[pk]--; cost += halfD(m.d); } else left.push(m);
    }
    left.sort((x, y) => y.d - x.d);
    const badSlots = Object.values(free).reduce((s, x) => s + x, 0);
    // forma the slots under the biggest leftover mods: re-polarize mismatched slots first, then empty ones
    const fm = left.filter((m) => m.p), rest = left.filter((m) => !m.p);
    const kk = Math.min(k, fm.length, badSlots + neutral);
    for (let i = 0; i < kk; i++) { cost += halfD(fm[i].d); formaPols.push(fm[i].p === "*" ? "riven" : fm[i].p); }
    let neutLeft = neutral - Math.max(0, kk - badSlots), badLeft = Math.max(0, badSlots - kk);
    const place = fm.slice(kk).concat(rest).sort((x, y) => y.d - x.d);
    for (const m of place) {
      if (neutLeft > 0) { neutLeft--; cost += m.d; }
      else if (badLeft > 0) { badLeft--; cost += badD(m.d); }
      else return { cost: Infinity, used: kk, formaPols };
    }
    return { cost, used: kk, formaPols };
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
      const m = exi[0];
      xOpts = m.p && (m.p === xp || m.p === "*") ? [{ cost: halfD(m.d), f: 0 }] : [{ cost: xp ? badD(m.d) : m.d, f: 0 }, { cost: halfD(m.d), f: 1, pol: m.p }];
    }
    const fmax = Math.min(9, formaMax == null ? 9 : formaMax);
    let best = null;
    for (let f = 0; f <= fmax; f++) {
      for (const xo of xOpts) {
        if (xo.f > f) continue;
        const r = slotCost(normal, slotPols, f - xo.f);
        const tot = r.cost + xo.cost;
        const plan = { drain: tot, cap, forma: r.used + xo.f, formaPols: r.formaPols.concat(xo.pol ? ["exilus:" + xo.pol] : []) };
        if (tot <= cap) return Object.assign(plan, { fits: true });
        if (!best || tot < best.drain) best = plan;
      }
    }
    return Object.assign(best || { drain: Infinity, cap, forma: 0, formaPols: [] }, { fits: false });
  }

  /* ---------- optimizer (beam + 1-swap) ---------- */
  function conflicts(mod, chosen) {
    for (const m of chosen) {
      if (m.id === mod.id) return true;
      if (mod.group && m.group && mod.group === m.group) return true;
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
    const out = [];
    for (const b of beam.slice(0, nLocal)) {
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
      out.push(b);
    }
    return out;
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
    const uniq = new Map();
    for (const r of results) {
      const key = r.mods.map((m) => m.id).sort().join(",") + "|" + (r.val ? r.val.type + r.val.pct : "") + "|" + r.arcane;
      if (!uniq.has(key) || uniq.get(key).score < r.score) uniq.set(key, r);
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
    return out;
  }

  root.WFEngine = { evaluate, optimize, defaults, targetsFor, enemyStats, FACTIONS, UNITS, PRIM, COMBO, aggregate, comboMult, ttk, capacityPlan };
})(typeof self !== "undefined" ? self : globalThis);
