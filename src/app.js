(function () {
  "use strict";
  const E = window.WFEngine, MODS = window.WF_MODS, ARC = window.WF_ARCANES, RIV = window.WF_RIVEN;
  const BUFFS = window.WF_BUFFS, FRAMES = window.WF_FRAMES || [];
  const WEAPONS = (window.WF_WEAPONS && window.WF_WEAPONS.length ? window.WF_WEAPONS : window.WF_WEAPONS_BUILTIN).slice();
  let pendingOcr = null;   // screenshot read while the wrong weapon was selected: fills set A once a weapon is picked
  const MOD_BY_ID = Object.fromEntries(MODS.map((m) => [m.id, m]));
  const MODS_SORTED = MODS.slice().sort((a, b) => a.ko.localeCompare(b.ko, "ko"));
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const fmt = (x) => { if (!isFinite(x)) return "-"; const a = Math.abs(x); if (a >= 1e8) return (x / 1e8).toFixed(2) + "억"; if (a >= 1e4) return (x / 1e4).toFixed(1) + "만"; return x.toFixed(0); };
  const pct = (x, d) => (x * 100).toFixed(d == null ? 0 : d) + "%";
  const josa = (w, withF, noF) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return w + (c >= 0 && c < 11172 && c % 28 ? withF : noF); };
  const ammoSec = (t) => !isFinite(t) ? "무한" : t >= 600 ? "10분 이상" : Math.round(t) + "초";
  const sec = (t) => !isFinite(t) ? "못 잡음" : t >= 60 ? "60초 이상" : t.toFixed(t < 10 ? 2 : 1) + "초";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const TYPE_KO = { impact: "충격", punct: "관통", slash: "베기", heat: "화염", cold: "냉기", elec: "전기", tox: "독", blast: "폭발", rad: "방사능", gas: "가스", mag: "자성", viral: "바이러스", corr: "부식", void: "보이드", tau: "타우", true: "고정" };
  const VAL_TYPES = ["heat", "cold", "elec", "tox", "impact", "mag", "rad"];
  const CLS_KO = { rifle: "소총·활·저격·런처", shotgun: "샷건", pistol: "보조무기", melee: "근접" };
  const TYPE_LABEL = { Rifle: "소총", Bow: "활", Sniper: "저격총", Launcher: "런처", Shotgun: "샷건", Pistol: "권총", "Dual Pistols": "쌍권총", Throwing: "투척", Melee: "근접" };
  const KIND_KO = { gun: "사격", radial: "폭발", melee: "휘두르기", heavy: "강공", glaive: "투척" };
  // "맞출 예정" riven values = the top of the random roll range (0.9–1.1 of the listed value; wiki Riven Mods attribute tables),
  // not the middle — user survey 2026-11-02 "리벤 '맞출 예정' 수치는 최대값" (CLAUDE.md 결정 사항). Ranges shown to the user stay 0.9–1.1.
  const RIV_PLAN_W = 1.1;
  const RIV_FORM = { "3+1": { pos: 0.9375, neg: -0.75, ko: "3긍정 1부정" }, "2+1": { pos: 1.2375, neg: -0.495, ko: "2긍정 1부정" }, "3+0": { pos: 0.75, neg: 0, ko: "3긍정" }, "2+0": { pos: 0.99, neg: 0, ko: "2긍정" } };
  // Every riven stat (wikiwiki "Riven Mod" stat tables, 2026-10): base value before disposition (1.2 for every weapon since
  // Hotfix 44.1.3) and the stat-count multiplier. grp: dmg = changes kill speed, heavy = heavy attack / combo model,
  // none = no effect on kill speed, splice = Riven Splicer result (Update 44.1, one per riven, made from `need`).
  // eff: engine key (defaults to the stat key), {bane: faction}, a function value → effect, or null (no effect).
  const RB = (r, s, p, m) => ({ rifle: r, shotgun: s, pistol: p, melee: m });
  const RIV_DEF = [
    { k: "dmg", ko: "피해", cls: "all", grp: "dmg", base: RB(1.65, 1.647, 2.196, 1.647) },
    { k: "ms", ko: "멀티샷", cls: "gun", grp: "dmg", base: RB(0.9, 1.197, 1.197, 0) },
    { k: "cc", ko: "치명타 확률", cls: "all", grp: "dmg", base: RB(1.4999, 0.9, 1.4999, 1.8) },
    { k: "cd", ko: "치명타 피해", cls: "all", grp: "dmg", base: RB(1.19997, 0.9, 0.9, 0.9) },
    { k: "heat", ko: "화염", cls: "all", grp: "dmg", base: 0.9 }, { k: "cold", ko: "냉기", cls: "all", grp: "dmg", base: 0.9 },
    { k: "elec", ko: "전기", cls: "all", grp: "dmg", base: 0.9 }, { k: "tox", ko: "독", cls: "all", grp: "dmg", base: 0.9 },
    { k: "impact", ko: "충격", cls: "all", grp: "dmg", base: RB(1.1997, 1.1997, 1.1997, 1.197) },
    { k: "punct", ko: "관통", cls: "all", grp: "dmg", base: RB(1.1997, 1.1997, 1.1997, 1.197) },
    { k: "slash", ko: "베기", cls: "all", grp: "dmg", base: RB(1.1997, 1.1997, 1.1997, 1.197) },
    { k: "sc", ko: "상태이상 확률", cls: "all", grp: "dmg", base: 0.9 },
    { k: "dur", ko: "상태이상 지속시간", cls: "all", grp: "dmg", base: 0.9999 },
    { k: "fr", ko: "연사력/공격 속도", cls: "all", grp: "dmg", base: RB(0.6003, 0.9, 0.747, 0.549) },
    { k: "reload", ko: "재장전 속도", cls: "gun", grp: "dmg", base: 0.49995 },
    { k: "mag", ko: "탄창 용량", cls: "gun", grp: "dmg", base: 0.49995 },
    { k: "fac_g", ko: "대 그리니어 피해", cls: "all", grp: "dmg", base: 0.45, eff: { bane: "grineer" } },
    { k: "fac_c", ko: "대 코퍼스 피해", cls: "all", grp: "dmg", base: 0.45, eff: { bane: "corpus" } },
    { k: "fac_i", ko: "대 인페스티드 피해", cls: "all", grp: "dmg", base: 0.45, eff: { bane: "infested" } },
    { k: "x_pt", ko: "관통력", cls: "gun", grp: "dmg", base: 2.7, unit: "m", eff: "pt" },
    { k: "ic", ko: "초기 연속기", cls: "melee", grp: "dmg", base: 24.5, unit: "n" },
    { k: "x_hae", ko: "강공 효율", cls: "melee", grp: "heavy", base: 0.7344, eff: "hae" },
    { k: "x_combochance", ko: "추가 연속기 카운트 확률", cls: "melee", grp: "heavy", base: 0.5877, negBase: 1.0485, eff: "ccc" },
    { k: "x_ammo", ko: "최대 탄약", cls: "gun", grp: "none", base: RB(0.4995, 0.9, 0.9, 0), eff: "ammoMax", note: "탄약 계산에만 반영" },
    { k: "x_zoom", ko: "확대율", cls: "gun", grp: "none", base: RB(0.5999, 0.41994, 0.801, 0), eff: null },
    { k: "x_recoil", ko: "반동", cls: "gun", grp: "none", base: 0.9, eff: null },
    { k: "x_speed", ko: "투사체 속도", cls: "gun", grp: "none", base: 0.9, eff: null },
    { k: "x_finisher", ko: "마무리 일격 피해", cls: "melee", grp: "none", base: 1.197, eff: null },
    { k: "x_slidecc", ko: "슬라이드 공격 치명타 확률", cls: "melee", grp: "none", base: 1.2, eff: null },
    { k: "x_combodur", ko: "연속기 지속시간", cls: "melee", grp: "none", base: 8.1, unit: "s", eff: null },
    { k: "x_range", ko: "근접 사거리", cls: "melee", grp: "none", base: 1.94, unit: "m", eff: null },
    { k: "viralm", ko: "바이러스", cls: "all", grp: "splice", base: 0.9, need: ["냉기", "독"] },
    { k: "corrm", ko: "부식", cls: "all", grp: "splice", base: 0.9, need: ["전기", "독"] },
    { k: "gasm", ko: "가스", cls: "all", grp: "splice", base: 0.9, need: ["화염", "독"] },
    { k: "radm", ko: "방사능", cls: "all", grp: "splice", base: 0.9, need: ["화염", "전기"] },
    { k: "blastm", ko: "폭발", cls: "all", grp: "splice", base: 0.9, need: ["화염", "냉기"] },
    { k: "magm", ko: "자성", cls: "all", grp: "splice", base: 0.9, need: ["냉기", "전기"] },
    { k: "sd", ko: "상태이상 피해", cls: "all", grp: "splice", base: 0.9, need: ["피해", "상태이상 확률"] },
    { k: "fac_o", ko: "대 오로킨 피해", cls: "all", grp: "splice", base: 0.45, eff: { bane: "corrupted" }, need: ["대 코퍼스 피해", "대 그리니어 피해"] },
    { k: "fac_t", ko: "대 테크롯 피해", cls: "all", grp: "splice", base: 0.45, eff: { bane: "techrot" }, need: ["대 코퍼스 피해", "대 인페스티드 피해"] },
    { k: "fac_s", ko: "대 스칼드라 피해", cls: "all", grp: "splice", base: 0.45, eff: { bane: "scaldra" }, need: ["대 인페스티드 피해", "대 그리니어 피해"] },
    { k: "wpd", ko: "약점 피해", cls: "gun", grp: "splice", base: 2.25, eff: (v) => ({ hsMult: 2 * v }), need: ["피해", "확대율 또는 멀티샷"], note: "헤드샷 때만" },
    { k: "wpcc", ko: "약점 치명타 확률", cls: "gun", grp: "splice", base: 2.475, eff: "wpcc", need: ["치명타 확률", "확대율 또는 멀티샷"], note: "헤드샷 때만" },
    { k: "ammoeff", ko: "탄약 효율", cls: "gun", grp: "splice", base: 0.45, eff: "ammoEff", need: ["탄창 용량 + 재장전 속도", "또는 반동 + 최대 탄약"], note: "그만큼 탄약을 안 써서 재장전 간격도 늘어남, 상한 75%" },
    { k: "holster", ko: "보관 중 탄창 재장전", cls: "gun", grp: "splice", base: 0.9, eff: null, need: ["최대 탄약", "재장전 속도 또는 탄창 용량"] },
    { k: "heavyd", ko: "강공 피해", cls: "melee", grp: "splice", base: 1.197, eff: "heavy", need: ["강공 효율", "추가 연속기 카운트 확률"] },
    { k: "windup", ko: "강공 준비 속도", cls: "melee", grp: "splice", base: 1.197, eff: "wind", need: ["강공 효율", "연속기 지속시간"] },
    { k: "block", ko: "막기 각도", cls: "melee", grp: "splice", base: 0.81, eff: null, need: ["공격 속도", "근접 사거리"] },
    { k: "slam", ko: "슬램 피해", cls: "melee", grp: "splice", base: 1.197, eff: null, need: ["피해", "공격 속도"] },
  ];
  const RIV_D = Object.fromEntries(RIV_DEF.map((d) => [d.k, d]));
  const RIV_KO = Object.fromEntries(RIV_DEF.map((d) => [d.k, d.ko + (d.grp === "splice" ? " (접합)" : "")]));
  const SPLICED = new Set(RIV_DEF.filter((d) => d.grp === "splice").map((d) => d.k));
  const SPLICE_ELEM = Object.fromEntries(RIV_DEF.filter((d) => /^(viral|corr|gas|rad|blast|mag)m$/.test(d.k)).map((d) => [d.k, d.need]));
  const SPLICE = RIV_DEF.filter((d) => d.grp === "splice").map((d) => ({ out: d.k, ko: d.ko, need: d.need, cls: d.cls === "all" ? ["rifle", "shotgun", "pistol", "melee"] : d.cls === "gun" ? ["rifle", "shotgun", "pistol"] : ["melee"] }));
  const RIV_HEAVY = { combochance: "ccc", hae: "hae" };
  // Riven Splicer recipes as stat keys (wiki "Riven Splicer"): either pair makes the spliced trait
  const SPLICE_REC = { viralm: [["cold", "tox"]], corrm: [["elec", "tox"]], gasm: [["heat", "tox"]], radm: [["heat", "elec"]], blastm: [["heat", "cold"]], magm: [["cold", "elec"]],
    sd: [["dmg", "sc"]], wpcc: [["cc", "x_zoom"], ["cc", "ms"]], wpd: [["dmg", "x_zoom"], ["dmg", "ms"]], ammoeff: [["mag", "reload"], ["x_recoil", "x_ammo"]], holster: [["x_ammo", "reload"], ["x_ammo", "mag"]],
    heavyd: [["x_hae", "x_combochance"]], windup: [["x_hae", "x_combodur"]], block: [["fr", "x_range"]], slam: [["dmg", "fr"]],
    fac_o: [["fac_c", "fac_g"]], fac_t: [["fac_c", "fac_i"]], fac_s: [["fac_i", "fac_g"]] };
  const rivBaseOf = (cls, k) => { const d = RIV_D[k]; if (!d) return 0; return typeof d.base === "number" ? d.base : (d.base[cls] || 0); };
  const rivFits = (d, cls) => d.cls === "all" || (d.cls === "melee") === (cls === "melee");
  // add one riven stat (value as a fraction, metres, seconds or a count) to an engine effect object
  function addRivEff(eff, k, v) {
    const d = RIV_D[k];
    if (!d || d.eff === null) return eff;
    const e = d.eff === undefined ? k : d.eff;
    if (typeof e === "string") eff[e] = (eff[e] || 0) + v;
    else if (typeof e === "function") { const x = e(v); for (const q in x) eff[q] = (eff[q] || 0) + x[q]; }
    else if (e.bane) { eff.bane = Object.assign({}, eff.bane || {}); eff.bane[e.bane] = (eff.bane[e.bane] || 0) + v; }
    return eff;
  }
  const effFromStats = (pairs) => pairs.reduce((eff, [k, v]) => addRivEff(eff, k, v), {});
  const rivVal = (k, v) => { const u = (RIV_D[k] || {}).unit; return u === "n" ? Math.abs(v).toFixed(0) : u === "m" ? Math.abs(v).toFixed(1) + "m" : u === "s" ? Math.abs(v).toFixed(1) + "초" : pct(Math.abs(v), 1); };
  function RIV_KO_ELEM(k) { return (RIV_D[k] || {}).ko || k; }
  /* ---------------- worker ---------------- */
  const src = $("#wf-src").textContent;
  const workerSrc = src + "\n" + `
self.onmessage = function (ev) {
  const d = ev.data, E = self.WFEngine;
  const byId = Object.fromEntries(self.WF_MODS.map(m => [m.id, m]));
  if (d.riven) byId["__riven"] = { id: "__riven", eff: d.riven };
  const cands = d.cands.map(id => byId[id]);
  const jobs = d.jobs;
  const out = [];
  let done = 0;
  for (const j of jobs) {
    if (j.riven) byId["__riven"] = { id: "__riven", eff: j.riven };
    const locked = (j.locked || d.locked).map(id => byId[id]);
    const opts = Object.assign({}, d.opts, j.optsPatch || {});
    const seeds = (d.seeds || []).map(s => ({ name: s.name, arcane: s.arcane, mods: s.ids.map(id => byId[id]) })).filter(s => s.mods.every(Boolean));
    const res = E.optimize(d.weapon, d.weapon.attacks[d.atk], cands, opts, { slots: 8, beam: j.beam || d.beam, locked, valOptions: j.valOptions || d.valOptions, arcOptions: j.arcOptions || d.arcOptions, seeds: j.noSeeds ? [] : seeds },
      p => self.postMessage({ type: "progress", p: (done + p) / jobs.length }));
    out.push({ tag: j.tag, res: res.slice(0, 40).map(r => ({ ids: r.mods.map(m => m.id), score: r.score, val: r.val, arcane: r.arcane, community: r.community || null })) });
    done++;
  }
  self.postMessage({ type: "done", out });
};`;
  let worker = null, bgBusy = false;
  const getWorker = () => worker || (worker = new Worker(URL.createObjectURL(new Blob([workerSrc], { type: "text/javascript" }))));
  // a new calculation while a background phase (④ element combinations) still runs: drop that worker so its late answer
  // can't land in the new run
  const freshWorker = () => { if (bgBusy && worker) { worker.terminate(); worker = null; } bgBusy = false; return getWorker(); };

  /* ---------------- state ---------------- */
  const st = { weapon: WEAPONS.find((w) => w.id === "coda_pathocyst") || WEAPONS[0], atk: 0, results: null, base: null, evoSel: {} };
  try { const s = JSON.parse(localStorage.getItem("wfopt2") || "null"); if (s && s.wid) { const w = WEAPONS.find((x) => x.id === s.wid); if (w) st.weapon = w; } } catch (e) {}
  const save = () => { try { localStorage.setItem("wfopt2", JSON.stringify(st.weapon.modular ? { mod: [st.weapon.modular.kind].concat(st.weapon.modular.parts) } : { wid: st.weapon.id })); } catch (e) {} };

  const modClass = (w) => w.cls;
  // strictly dominated by a primed/better version in the same group (never equipped together)
  const DOMINATED = new Set(["point_blank", "ravage", "blunderbuss", "chilling_grasp", "charged_shell", "pistol_gambit", "target_cracker", "heated_charge", "convulsion", "true_steel", "fury", "cryo_rounds", "shred", "pressure_point", "fever_strike", "heavy_trauma", "shotgun_savvy", "sure_shot", "rifle_aptitude", "split_chamber", "hells_chamber", "barrel_diffusion", "amalgam_barrel_diffusion", "amalgam_serration", "amalgam_shotgun_barrage"]);
  const o_factions = () => { const v = $("#objective").value; return v === "geo" || v === "min" ? ["grineer", "corpus", "infested"] : [v]; };
  function candidateMods(w, atk, flags) {
    const cls = modClass(w);
    const boss = flags.boss;
    const dmgTypes = Object.keys(atk.parts ? atk.parts.reduce((a, p) => Object.assign(a, p.dmg), {}) : atk.dmg);
    return MODS.filter((m) => {
      if (!m.compat.includes(cls)) return false;
      if (DOMINATED.has(m.id) && !(boss && ["split_chamber", "hells_chamber", "barrel_diffusion", "shotgun_savvy", "sure_shot", "rifle_aptitude"].includes(m.id))) return false;
      if (m.eff) { const ph = ["impact", "punct", "slash"].filter((t) => m.eff[t] > 0); if (ph.length && !ph.some((t) => dmgTypes.includes(t))) return false; }
      if (m.exilus && !((m.eff && m.eff.throwSpd && atk.kind === "glaive") || (m.eff && m.eff.tenno && atk.kind === "melee"))) return false;
      if (m.noCalc || (m.auto && m.unparsed && m.unparsed.length)) return false;
      if (m.manual) return false;   // opt-in only (a documented effect the engine can't weigh), see the mod's note
      if (m.auto && Object.keys(m.eff).every((k) => k === "projSpd" || (typeof m.eff[k] === "number" && m.eff[k] < 0))) return false;
      if (m.eff && m.eff.bane && (o_factions().length > 1 || !o_factions().some((f) => m.eff.bane[f]))) return false;   // faction mods only for a single-faction target
      if (m.req === "swing" && atk.kind !== "melee") return false;
      if (!typeOk(m, w)) return false;
      if (m.req === "semi" && !atk.semi) return false;
      if (m.req === "glaive" && atk.kind !== "glaive") return false;
      if (m.req === "heavy" && !(atk.kind === "heavy" || atk.kind === "glaive")) return false;
      if (atk.kind === "glaive" && m.id === "condition_overload") return false;
      if (m.cond) {
        const needsAim = m.cond.some((c) => c.when === "aim" || c.when === "headshot" || c.when === "hs");
        const needsCast = m.cond.some((c) => c.when === "cast");
        const onlyCond = !m.eff || Object.keys(m.eff).every((k) => k === "msLock");
        if (needsAim && !flags.aim && onlyCond) return false;
        if (needsAim && !flags.aim && m.eff && m.eff.msLock) return false;
        if (needsCast && !flags.cast && onlyCond) return false;
      }
      return true;
    });
  }
  // Incarnon guns: index of the Incarnon Form attack (-1 if the weapon has no separate normal gun attack)
  const isGunAtk = (a) => a.kind === "gun" || (a.parts || []).some((p) => p.kind === "gun");
  const incAtk = (a) => /^Incarnon/i.test(a.en || "") || (a.parts || []).some((p) => /^Incarnon/i.test(p.en || ""));
  function incGunIdx(w) {
    const i = w.attacks.findIndex((a) => incAtk(a) && isGunAtk(a));
    return i >= 0 && w.attacks.some((a) => !incAtk(a) && isGunAtk(a)) ? i : -1;
  }
  function defaultAttack(w) {
    const a = w.attacks;
    let i = a.findIndex((x) => x.kind === "glaive" && /Recall/.test(x.en));
    if (i < 0) i = a.findIndex((x) => x.parts && !x.primer && !x.alt);
    // Bows: the charged shot (wiki Fire Rate gives bow cadence only for it: "1 / (Modded Charge Time + Modded Reload Time)";
    // uncharged/quick shots have no wiki cadence). Not the Incarnon Form shot — that is chosen through the Incarnon toggle.
    if (i < 0 && w.type === "Bow") i = a.findIndex((x) => x.kind === "gun" && /Charged/.test(x.en || "") && !/^Incarnon/.test(x.en || "") && !/Uncharged/.test(x.en || ""));
    if (i < 0) i = a.findIndex((x) => x.kind === "gun" && x.en === "Normal Attack");
    // v1.88: main trigger named otherwise (Phantasma "Beam") — the first plain, uncharged gun attack, not one marked alt
    if (i < 0) i = a.findIndex((x) => x.kind === "gun" && !x.alt && !x.parts && !x.charge && !/^Alt/.test(x.en || ""));
    if (i < 0) i = a.findIndex((x) => x.kind === "melee");
    return Math.max(0, i);
  }

  /* ---------------- weapon panel ---------------- */
  function renderWeaponList() {
    const q = $("#wsearch").value.trim().toLowerCase();
    const slot = $(".slot-tabs .on")?.dataset.slot || "all";
    $("#wcount").textContent = WEAPONS.length + "종";
    const list = WEAPONS.filter((w) => (slot === "all" || w.slot === slot) && (!q || (w.ko || "").toLowerCase().includes(q) || (w.en || "").toLowerCase().includes(q))).slice(0, 80);
    $("#wlist").innerHTML = list.map((w) => `<button type="button" class="witem${w.id === st.weapon.id ? " on" : ""}" data-id="${w.id}"><span class="wko">${esc(w.ko || w.en)}</span><span class="wen">${esc(w.en || "")}</span><span class="wcls">${w.exalted ? "익절티드 · " : ""}${w.sub === "glaive" ? "글레이브" : TYPE_LABEL[w.type] || CLS_KO[w.cls] || w.cls}${w.valence ? " · 베일런스" : ""}</span></button>`).join("") || `<p class="empty">검색 결과가 없습니다.</p>`;
  }
  /* ---------------- Zaw / Kitgun assembly (wiki Module:Modular/data formulas) ---------------- */
  const MODU = window.WF_MODULAR || {};
  const ZTYPE_KO = { Dagger: "단검", Staff: "지팡이", Machete: "마체테", Polearm: "폴암", Rapier: "레이피어", Scythe: "낫", "Heavy Blade": "대검", Sword: "검", Hammer: "해머", Nikana: "니카나", Glaive: "글레이브", Sparring: "격투", Fist: "주먹", Claws: "클로", "Two-Handed Nikana": "양손 니카나", Gunblade: "건블레이드", Nunchaku: "쌍절곤", Whip: "채찍", Tonfa: "톤파", Warfan: "부채", "Heavy Scythe": "대형 낫" };
  const slugId = (x) => x.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  function buildModular(kind, a, b, c) {
    const D = MODU[kind]; if (!D) return null;
    if (kind === "zaw") {
      const s = D.strikes[a], g = D.grips[b], l = D.links[c]; if (!s || !g || !l) return null;
      // total = (strike base + grip + link) x strike multiplier for the grip type; split by the strike's ratios
      // (Plague strikes: each type gets an equal share of the change)
      const base = Object.values(s.dmg).reduce((x, y) => x + y, 0);
      const total = (base + g.dmg + l.dmg) * ((s.multi || {})[g.hand] || 1);
      const dmg = {}; for (const t in s.dmg) dmg[t] = +(s.plague ? s.dmg[t] + (total - base) / Object.keys(s.dmg).length : s.dmg[t] * total / base).toFixed(2);
      const tk = (s.kind || {})[g.hand] || "";
      return { id: "zaw_" + slugId(a + "_" + b + "_" + c), ko: `${s.ko} · ${g.ko} · ${l.ko}`, en: `Zaw ${a} / ${b} / ${c}`, slot: "melee", cls: "melee", type: "Melee", valence: false, modular: { kind, parts: [a, b, c] },
        attacks: [{ name: "일반 공격 (휘두르기, 연속기 빌드)", en: "Normal Attack", kind: "melee", desc: `자우 ${ZTYPE_KO[tk] || tk} (${g.hand === "TwoHanded" ? "양손" : "한손"} 손잡이). 연속기를 쌓아 가며 휘두르는 운용 — 자우 강공 수치는 위키 데이터가 없어 휘두르기만 계산합니다`,
          dmg, cc: +(s.cc + l.cc).toFixed(3), cd: s.cd, sc: +(s.sc + l.sc).toFixed(3), fr: +(g.spd + l.spd + s.spd).toFixed(3) }] };
    }
    const ch = D.chambers[a], g = D.grips[b], l = D.loaders[c]; if (!ch || !g || !l || !ch.dmg[b]) return null;
    const slot = kind === "kit_primary" ? "primary" : "secondary";
    const type = slot === "secondary" ? "Pistol" : a === "Catchmoon" || a === "Sporelacer" ? "Shotgun" : a === "Tombfinger" ? "Launcher" : "Rifle";
    const atk = { name: "기본 사격", en: "Normal Attack", kind: "gun", dmg: ch.dmg[b], cc: +(ch.cc + l.cc).toFixed(3), cd: +(ch.cd + l.cd).toFixed(2), sc: +(ch.sc + l.sc).toFixed(3), fr: ch.fr[b] || 1,
      pellets: ch.ms || 1, mag: ch.mag[l.mag] || 10, reload: l.reload, ammoCost: ch.ammoCost || 1,
      desc: `킷건 (${type === "Shotgun" ? "샷건" : type === "Pistol" ? "보조무기" : type === "Launcher" ? "런처" : "소총"}). 그립이 피해·연사를, 장전부가 치명타·상태이상·탄창·재장전을 정합니다${a === "Tombfinger" || a === "Sporelacer" ? " — 폭발 부분은 위키에 따로 나뉜 수치가 없어 한 발 피해로 합산" : ""}` };
    if (ch.trig === "Semi-Auto") atk.semi = true;
    if (ch.fo) atk.fo = ch.fo;
    if (ch.forced) atk.forced = ch.forced;
    let attacks = [atk];
    // explosive chambers (wiki chamber pages): the shot is a direct hit plus an explosion. Explosions get no headshot bonus,
    // lose damage toward the edge, and the projectile can't punch through (it bursts on first contact).
    const boom = (direct, aoe, r, rfo, extra) => {
      const parts = [];
      if (Object.keys(direct).length) parts.push(Object.assign({}, atk, { dmg: direct, ptLock: true, kind: "gun" }));
      parts.push(Object.assign({}, atk, { name: "폭발", en: "Explosion", kind: "radial", dmg: aoe, radius: r, rfo, hsMult: 1, ptLock: true, forced: undefined, fo: undefined }));
      return Object.assign({}, atk, { name: "한 발 전체 피해 (직격 + 폭발)", en: "Normal Attack+Explosion", parts, ptLock: true }, extra || {});
    };
    const pick = (d, keys) => { const o = {}; for (const k of keys) if (d[k]) o[k] = d[k]; return o; };
    const dd = ch.dmg[b];
    if (a === "Sporelacer") {
      // Impact = the spore's hit; Toxin = the burst (secondary 4.7 m, -50% at the edge, then 3 bomblets on the same spot;
      // primary 2.1 m, -20%, bounces up to twice). Bomblets and bounce bursts are folded into the one burst (no split in the data).
      const sec = slot === "secondary";
      attacks = [boom(pick(dd, ["impact"]), pick(dd, ["tox"]), sec ? 4.7 : 2.1, sec ? 0.5 : 0.2,
        { desc: atk.desc.replace(/ — 폭발 부분은.*$/, "") + ` — 포자가 맞은 자리에서 ${sec ? "4.7m 폭발 후 작은 폭탄 3개가 같은 자리에 떨어집니다(폭탄은 본 폭발에 합산)" : "2.1m 폭발하고 최대 2번 튕깁니다(튕긴 폭발은 미반영)"}. 충격은 직격, 독은 폭발 피해입니다.` })];
    } else if (a === "Tombfinger" && slot === "secondary") {
      // wiki: impact, puncture and ~19.5% of the radiation are the direct hit; ~80.5% radiation is a 1.9 m burst (-30% at the edge)
      const dir = pick(dd, ["impact", "punct"]); if (dd.rad) dir.rad = +(dd.rad * 0.195).toFixed(2);
      attacks = [boom(dir, { rad: +((dd.rad || 0) * 0.805).toFixed(2) }, 1.9, 0.3, { desc: "킷건 (보조무기). 직격(충격·관통·방사능 19.5%) + 1.9m 방사능 폭발(80.5%) — 위키 툼핑거 문서 비율" })];
    } else if (a === "Tombfinger") {
      // wiki: quick-shot / charged-shot burst damage per grip; the table damage is the projectile hit
      const Q = { Brash: 30, Palmaris: 35, Shrewd: 40, Steadyslam: 79, Tremor: 108 }, C = { Brash: 412, Palmaris: 417, Shrewd: 422, Steadyslam: 461, Tremor: 490 };
      const chg = (ch.charge || {})[b] || 0.5;
      attacks = [boom(Object.assign({}, dd), { rad: Q[b] || 30 }, 1.7, 0.25, { name: "빠른 사격 (직격 + 1.7m 폭발)", desc: "충전 없이 빠르게 쏘는 운용 — 폭발 수치는 위키 툼핑거 문서의 그립별 값" }),
        boom(Object.assign({}, dd), { rad: C[b] || 412 }, 6.2, 0.7, { name: `충전 사격 (직격 + 6.2m 폭발, 충전 ${chg}s)`, en: "Charged+Explosion", fr: +(1 / (chg + 1 / (ch.fr[b] || 1))).toFixed(3), desc: "끝까지 충전해서 쏘는 운용 — 충전 시간을 발사 간격에 넣었습니다" })];
      for (const x of attacks) x.parts.forEach((p) => { p.fr = x.fr; });
    }
    return { id: "kit_" + slugId(slot + "_" + a + "_" + b + "_" + c), ko: `${ch.ko} · ${g.ko} · ${l.ko}`, en: `Kitgun ${a} / ${b} / ${c}`, slot, type, cls: type === "Shotgun" ? "shotgun" : type === "Pistol" ? "pistol" : "rifle",
      valence: false, modular: { kind, parts: [a, b, c] }, xpol: "madurai", ammoMax: ch.ammoMax || 0, ammoPickup: ch.ammoPickup || 0, attacks };
  }
  function renderModular() {
    if (!MODU.zaw && !MODU.kit_primary) { $("#modbox").hidden = true; return; }
    const LAB = { zaw: ["타격부 (스트라이크)", "손잡이 (그립)", "연결부 (링크)"], kit: ["약실 (체임버)", "손잡이 (그립)", "장전부 (로더)"] };
    const preview = () => {
      const w = buildModular($("#mkind").value, $("#mp1").value, $("#mp2").value, $("#mp3").value);
      if (!w) { $("#mstat").textContent = "이 조합은 만들 수 없습니다."; return; }
      const a = w.attacks[0], tot = Object.values(a.dmg).reduce((x, y) => x + y, 0);
      const partTxt = a.parts ? a.parts.map((p) => `${p.kind === "radial" ? `폭발 ${p.radius}m` : "직격"}: ${Object.entries(p.dmg).map(([t, v]) => `${TYPE_KO[t] || t} ${v.toFixed(1)}`).join(" · ")}`).join(" / ")
        : `${Object.entries(a.dmg).map(([t, v]) => `${TYPE_KO[t] || t} ${v.toFixed(1)}`).join(" · ")} (합 ${tot.toFixed(1)})`;
      $("#mstat").innerHTML = `${partTxt}<br>치명타 ${pct(a.cc)} · ${a.cd.toFixed(1)}배 · 상태이상 ${pct(a.sc)} · ${a.kind === "melee" ? "공속" : "연사"} ${a.fr.toFixed(2)}${a.mag ? ` · 탄창 ${a.mag} · 재장전 ${a.reload}s` : ""}`;
    };
    const fill = () => {
      const k = $("#mkind").value, D = MODU[k]; if (!D) return;
      const lists = k === "zaw" ? [D.strikes, D.grips, D.links] : [D.chambers, D.grips, D.loaders];
      lists.forEach((list, i) => {
        $("#ml" + (i + 1)).textContent = (k === "zaw" ? LAB.zaw : LAB.kit)[i];
        $("#mp" + (i + 1)).innerHTML = Object.entries(list).sort((x, y) => x[1].ko.localeCompare(y[1].ko, "ko")).map(([en, v]) => `<option value="${esc(en)}">${esc(v.ko)}${v.hand ? (v.hand === "TwoHanded" ? " (양손)" : " (한손)") : ""}</option>`).join("");
      });
      preview();
    };
    $("#mkind").addEventListener("change", fill);
    ["#mp1", "#mp2", "#mp3"].forEach((id) => $(id).addEventListener("change", preview));
    $("#mbuild").addEventListener("click", () => { const w = buildModular($("#mkind").value, $("#mp1").value, $("#mp2").value, $("#mp3").value); if (w) selectWeapon(w); });
    fill();
  }
  function selectWeapon(w) {
    st.base = w; st.evoSel = {}; st.evoManual = {}; st.weapon = w; st.atk = defaultAttack(w); st.results = null; save();
    evolve();
    // Incarnon guns: start from the Incarnon Form (where the weapon does its work); the normal shot stays one click away
    const ii = incGunIdx(st.weapon);
    if (ii >= 0 && ii !== st.atk) { st.atk = ii; st.evoSel = {}; evolve(); }
    if (w.exalted && w.exalted.frame) {
      const f = FRAMES.find((x) => x.en === w.exalted.frame) || FRAMES.find((x) => x.en === w.exalted.frame.replace(/ (Prime|Umbra)$/, ""));
      if (f && $("#frame").value !== f.id) { $("#frame").value = f.id; renderAbilities(); }
    }
    renderAll();
    if (pendingOcr) { const reads = pendingOcr, d = $$("#sets .cset")[0]; if (d) ocrApply(d, reads, `${w.ko}(으)로 다시 맞춰 봤습니다. `); }
  }

  /* ---------------- element concept, enemy, element order ---------------- */
  const CONCEPT_TYPES = ["viral", "corr", "heat", "cold", "elec", "tox", "blast", "gas", "mag", "rad", "slash", "punct", "impact"];
  function addConcept(v) {
    const box = $("#concepts"), n = box.querySelectorAll("select").length;
    if (n >= 4) return;
    const sel = document.createElement("select");
    sel.setAttribute("aria-label", `속성 ${n + 1}`);
    sel.innerHTML = `<option value="">자동</option>` + CONCEPT_TYPES.map((t) => `<option value="${t}">${TYPE_KO[t]}</option>`).join("");
    sel.value = v || "";
    sel.addEventListener("change", conceptChanged);
    box.insertBefore(sel, box.querySelector(".cadd"));
    box.querySelector(".cadd").hidden = n + 1 >= 4;
  }
  function initConcepts() {
    const box = $("#concepts");
    box.innerHTML = `<button type="button" class="cadd">+ 속성 추가</button>`;
    box.querySelector(".cadd").addEventListener("click", () => { addConcept(""); const l = $$("#concepts select"); l[l.length - 1].focus(); });
    addConcept(""); addConcept("");
  }
  function conceptChanged() { if (typeof onUrlState === "function") onUrlState(); }
  function setEnemy(v) {
    const sc = $("#scenario");
    if (v === "boss") sc.value = "boss"; else if (sc.value === "boss") sc.value = "crowd";
    syncEnemySeg();
    sc.dispatchEvent(new Event("change"));
  }
  function syncEnemySeg() {
    const boss = $("#scenario").value === "boss";
    $$("#enemyseg button").forEach((b) => { const on = (b.dataset.v === "boss") === boss; b.classList.toggle("on", on); b.setAttribute("aria-checked", on ? "true" : "false"); });
  }
  function renderElemOrder(w) {
    const innate = Object.keys((w.attacks[st.atk] || {}).dmg || {}).filter((t) => ["heat", "cold", "elec", "tox"].includes(t));
    const last = w.valence ? "무기 고유 원소·베일런스" : innate.length ? `무기 고유 원소 (${innate.map((t) => TYPE_KO[t]).join("·")})` : null;
    const chips = [`<span class="ochip">① 모드 1→8번 칸 <small>(리벤은 그 칸 자리)</small></span>`, `<span class="ochip">② 보라 아콘 샤드 전기 <small>(전기 모드 자리, 없으면 모드 뒤)</small></span>`];
    if (last) chips.push(`<span class="ochip">③ ${last} <small>(화염→냉기→전기→독)</small></span>`);
    $("#eorder").innerHTML = `<b>원소가 합쳐지는 순서</b>${chips.join('<span class="oarr">→</span>')}<span>어빌리티(일렉트릭 실드 등)와 아케인이 주는 원소는 합쳐지지 않습니다.</span>`;
  }

  /* ---------------- Incarnon evolutions ---------------- */
  // st.evoSel[tier] = chosen perk index; tiers left out are "auto" (picked by a quick no-mod calculation). The weapon every
  // calculation uses is the base weapon with the chosen perks applied: base-stat lines change the attack (damage, crit,
  // status, magazine, multishot), mod-like lines (fire rate, reload, damage per status type…) ride on it as evoEff.
  const isIncAtk = (a) => /^Incarnon/i.test(a.en || "") || (a.parts || []).some((p) => /^Incarnon/i.test(p.en || ""));
  function evoItems(w, sel) {
    const items = [];
    // tier I: a gun's Incarnon Form is its own attack; a melee weapon's form is a buff on every attack (calculated as on —
    // e.g. Dual Ichor 180 s once 6x combo + heavy attack), so its stat lines ("+100% Melee Damage") apply
    for (const t of w.evos || []) { if (t.tier === 1 && w.slot !== "melee") continue; const p = t.perks[sel[t.tier] != null ? sel[t.tier] : 0]; if (p) for (const it of p.items) if (it.key) items.push(it); }
    return items;
  }
  function applyEvos(w, sel) {
    if (!w.evos) return w;
    const items = evoItems(w, sel);
    const nA = w.slot === "melee" ? w.attacks.find((q) => q.en === "Normal Attack") : null, totN = nA ? Object.values(nA.dmg || {}).reduce((q, v) => q + v, 0) : 0;
    const mod = (a, inc, dmgF) => {
      const x = JSON.parse(JSON.stringify(a)), eff = {};
      for (const it of items) {
        if ((it.form === "inc" && !inc) || (it.form === "normal" && inc)) continue;   // no form = both forms
        if (it.atk && a.en !== it.atk) continue;                                       // e.g. Ronin's Rush: normal attacks only
        if (it.key === "baseDmg") {
          const f = dmgF != null ? dmgF : (() => { const tot = Object.values(x.dmg || {}).reduce((q, v) => q + v, 0); return tot > 0 ? (tot + it.v) / tot : 1; })(); for (const k in x.dmg) x.dmg[k] *= f;
          // v1.80: whether "+X Base Damage" raises a melee heavy/slam by the same X or by the swing's ratio (heavy = 5 x base in the
          // arsenal) isn't on the wiki — the engine's o.evoHeavyScale switches to the swing's ratio, the app checks both
          if (nA && a !== nA && totN > 0 && f > 0) x.evoScaleAlt = (x.evoScaleAlt || 1) * ((totN + it.v) / totN) / f;
        }
        else if (it.key === "baseCC") x.cc = (x.cc || 0) + it.v;
        else if (it.key === "baseCD") x.cd = (x.cd || 0) + it.v;
        else if (it.key === "baseSC") x.sc = (x.sc || 0) + it.v;
        else if (it.key === "baseMag") { if (x.mag) x.mag += it.v; }
        else if (it.key === "basePellets") x.pellets = (x.pellets || 1) + it.v;
        else if (it.key === "setSC") x.sc = it.v;
        else if (it.key === "prelude" || it.key === "wise" || it.key === "highground") { x.evoSp = Object.assign({}, x.evoSp || {}, { [it.key]: { v: it.v, below: it.below, cap: it.cap } }); }
        else if (it.when) { x.evoCond = (x.evoCond || []).concat([{ when: it.when, eff: { [it.key]: it.v } }]); }
        else { eff[it.key] = (eff[it.key] || 0) + it.v; if (it.key === "burstDmg" && it.cap) eff.burstCap = Math.max(eff.burstCap || 0, it.cap); }
      }
      if (Object.keys(eff).length) x.evoEff = Object.assign({}, x.evoEff || {}, eff);
      return x;
    };
    const attacks = w.attacks.map((a) => {
      const inc = isIncAtk(a);
      if (!a.parts) return mod(a, inc);
      // a shot with a direct hit and a blast: "+X base damage" scales both parts by the direct hit's factor
      const d0 = Object.values(a.parts[0].dmg || {}).reduce((q, v) => q + v, 0);
      const add = items.filter((it) => it.key === "baseDmg" && !((it.form === "inc" && !inc) || (it.form === "normal" && inc))).reduce((q, it) => q + it.v, 0);
      const f = d0 > 0 ? (d0 + add) / d0 : 1;
      const y = mod(Object.assign({}, a, { parts: undefined }), inc, f); y.parts = a.parts.map((p) => mod(p, inc, f)); return y;
    });
    return Object.assign({}, w, { attacks });
  }
  // auto choices: per tier, the perk that makes the chosen attack fastest with no mods (others at their current choice)
  function autoEvo(w, sel) {
    const out = Object.assign({}, sel);
    if (!w.evos) return out;
    const o = Object.assign(readOpts(), { layoutTTK: false });
    for (const t of w.evos) {
      if (t.tier === 1 || st.evoManual && st.evoManual[t.tier]) continue;
      let best = 0, bs = -1;
      t.perks.forEach((p, i) => { const ww = applyEvos(w, Object.assign({}, out, { [t.tier]: i })); const sc = E.evaluate(ww, ww.attacks[st.atk] || ww.attacks[0], [], o).score; if (sc > bs * 1.0001) { bs = sc; best = i; } });
      out[t.tier] = best;
    }
    return out;
  }
  function evolve() {
    const w = st.base || st.weapon;
    if (!w.evos) { st.weapon = w; return; }
    st.evoManual = st.evoManual || {};
    st.evoSel = autoEvo(w, st.evoSel);
    st.weapon = applyEvos(w, st.evoSel);
  }
  function renderEvoBox() {
    const box = $("#evobox"), w = st.base || st.weapon;
    if (!w.evos) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    const roman = ["", "I", "II", "III", "IV", "V"];
    const desc = (p) => p.items.map((it) => it.key ? it.ko + (it.form === "inc" ? " (인카논 형태만)" : it.form === "normal" ? " (기본 형태만)" : "") : it.cond ? "조건부: " + it.ko : it.ko).join(" · ");
    box.innerHTML = `<div class="clabel">인카논 진화 <small>게임에서 고른 진화를 고르세요 · 번호는 게임 진화 화면의 왼쪽부터 · 처음엔 계산으로 고른 값</small></div>
      ${w.evos.map((t) => t.tier === 1 ? `<div class="evorow"><b>${roman[t.tier]}</b><span class="evofix">${w.slot === "melee" && t.perks[0] && t.perks[0].items.some((it) => it.key)
          ? "인카논 형태 (켠 상태로 계산) — " + esc(t.perks[0].items.filter((it) => it.key || it.cond).map((it) => it.key ? it.ko : "조건부(계산 제외): " + it.ko).join(" · "))
          : "인카논 형태 해금"}</span></div>`
        : `<label class="evorow"><b>${roman[t.tier] || t.tier}</b><select data-tier="${t.tier}">${t.perks.map((p, i) => `<option value="${i}"${st.evoSel[t.tier] === i ? " selected" : ""}>${i + 1}. ${esc(p.name)} — ${esc(desc(p))}${st.evoManual && st.evoManual[t.tier] ? "" : st.evoSel[t.tier] === i ? " [자동]" : ""}</option>`).join("")}</select></label>`).join("")}
      <p class="hint" style="margin:0">위키 진화 표 기준입니다. 기본 피해·치명타·상태이상·탄창·멀티샷·연사·재장전·관통력, "모드 적용 후 고정값" 보너스, 비치명타 피해 보너스, 곱연산 피해 보너스, 자기 능력치를 읽는 효과(치명타 확률 50% 미만일 때 등)는 계산에 넣습니다. 방어력 450 초과·최대 에너지 700 초과·채널링 어빌리티·처치 시·무리 상대 같은 조건은 왼쪽 설정이 그 조건을 채울 때만 넣습니다. "조건부"로 표시된 효과(오버실드일 때, 빈 탄창 재장전 시, 체력 절반 이하 적 등)와 반동·정확도는 넣지 않습니다.</p>`;
    box.querySelectorAll("select").forEach((sel) => sel.addEventListener("change", () => {
      st.evoManual = st.evoManual || {}; st.evoManual[sel.dataset.tier] = true; st.evoSel[sel.dataset.tier] = +sel.value;
      st.weapon = applyEvos(st.base, st.evoSel); st.results = null; renderAll();
    }));
  }

  function renderAll() {
    renderWeaponList();
    const w = st.weapon, atk = w.attacks[st.atk];
    $("#wname").textContent = w.ko || w.en;
    $("#wsub").textContent = `${w.en || ""} · ${w.exalted ? "익절티드 · " : w.modular ? "조립 무기 · " : ""}${w.sub === "glaive" ? "글레이브" : TYPE_LABEL[w.type] || CLS_KO[w.cls] || w.cls}`;
    $("#rivmode").disabled = !!w.noRiven;
    if (w.noRiven) { $("#rivmode").value = "none"; $("#rivowned").hidden = true; }
    $("#rivnote").hidden = !w.noRiven;
    $("#atk").innerHTML = w.attacks.map((a, i) => `<option value="${i}">${esc(a.name)}</option>`).join("");
    $("#atk").value = st.atk;
    $("#atkdesc").textContent = (atk.desc || "") + (w.exalted ? ` ${exaltedNote(w)}` : "")
      + (incGunIdx(w) >= 0 && isGunAtk(atk) ? ` · 기본 형태와 인카논 형태는 같은 모드를 쓰지만 추천 세팅은 형태마다 다릅니다. 지금은 '${atk.name}' 기준이니, 다른 형태로 주로 싸우면 그 공격을 고르세요.` : "");
    $("#atkstats").innerHTML = atkStatsHtml(atk);
    $("#valrow").hidden = !w.valence;
    renderElemOrder(w);
    renderEvoBox();
    $("#mercyrow").hidden = !w.mercyBuff;
    $("#comborow").hidden = w.cls !== "melee";
    $("#aimrow").hidden = w.cls === "melee";
    renderArcanes();
    renderShards();
    renderAuras();
    renderCompareSets();
    renderRivenSelects();
    renderTargets();
    $("#results").innerHTML = placeholder();
  }
  function atkStatsHtml(a) {
    const dmg = Object.entries(a.dmg).map(([t, v]) => `<span class="dt">${TYPE_KO[t] || t} ${(+v).toFixed(0)}</span>`).join("");
    const bits = [`치명타 ${pct(a.cc || 0)} · ${(a.cd || 0).toFixed(1)}배`, `상태이상 ${pct(a.sc || 0)}`];
    if (a.fr) bits.push(`${a.kind === "gun" || a.kind === "radial" ? "연사" : "공속"} ${(+a.fr).toFixed(2)}`);
    if (a.pellets > 1) bits.push(`산탄 ${a.pellets}`);
    if (a.mag) bits.push(`탄창 ${a.mag} · 재장전 ${(+a.reload).toFixed(1)}s`);
    if (a.radius) bits.push(`폭발 반경 ${a.radius}m`);
    if (a.windup) bits.push(`충전 ${a.windup}s`);
    if (a.punch) bits.push("몸통 무한 관통");
    if (a.forced) bits.push("확정 " + a.forced.map((t) => TYPE_KO[t]).join("·"));
    if (a.parts) bits.push(a.primer ? "보조 사격 4초마다 1회 가정" : "직격+폭발 합산");
    const w = st.weapon, more = [];
    if (w.zoom) more.push("최대 배율 조준 시 " + [w.zoom.cd ? `치명타 피해 +${pct(w.zoom.cd)}` : "", w.zoom.ccFlat ? `치명타 확률 +${pct(w.zoom.ccFlat)}p` : "", w.zoom.hs ? `헤드샷 피해 +${pct(w.zoom.hs)}` : "", w.zoom.dmg ? `피해 +${pct(w.zoom.dmg)}` : ""].filter(Boolean).join(", "));
    if (w.sniperCombo) more.push(`저격 콤보: ${w.sniperCombo[0]}타마다 시작해 ×1.5, 3배 타수마다 +0.5 (${w.sniperCombo[1]}초 안에 못 맞히면 감소)`);
    more.push(`모드 용량 ${2 * (w.rank || 30) + (w.slot === "melee" && !w.pseudo ? 10 : 0)}${w.pol && w.pol.length ? ` · 기본 극성 ${w.pol.map(polKo).join(", ")}` : " · 기본 극성 없음"}${w.xpol ? ` · 익실러스 ${polKo(w.xpol)}` : ""}`);
    return `<div class="dmgline">${dmg}</div><div class="statline">${bits.join(" · ")}</div><div class="statline">${more.map(esc).join("<br>")}</div>`;
  }
  const POL_KO = { madurai: "마두라이", vazarin: "바자린", naramon: "나라몬", zenurik: "제누릭", unairu: "운에어루", penjaga: "펜자가", umbra: "움브라", riven: "리벤 극성", any: "아무 극성" };
  const polKo = (p) => POL_KO[p] || p;
  function exaltedNote(w) {
    const ex = w.exalted, S = frameStats().str, sp = `위력 ${Math.round(S * 100)}%`;
    if (ex.mode === "base") return `익절티드 무기: 기본 피해 × 어빌리티 위력 (지금 ${sp} → ×${S.toFixed(2)}). 워프레임 칸의 위력 값을 바꾸면 반영됩니다.`;
    if (ex.mode === "bonus") return `익절티드 무기: 기본 피해 50 고정 + 위력 비례 고유 피해 보너스 +150%×위력 (${sp} → +${pct(1.5 * S)}), 20발 연사 유지 시 +150% (위키 피스메이커).`;
    if (ex.mode === "mult") return `익절티드 무기: 위력 비례 ×1.25 배율이 서레이션류와 합연산 (${sp} → +${pct(1.25 * S - 1)}).`;
    return "패시브 무기라 어빌리티 위력과 무관합니다.";
  }
  const FRAME_ARC = self.WF_FRAME_ARCANES || {};
  let FA_NOTE = "";
  const hasRadial = (w) => w.attacks.some((a) => a.kind === "radial" || a.radius || (a.parts && a.parts.some((p) => p.kind === "radial")));
  const typeOk = (d, w) => (!d.types || d.types.includes(w.type)) && (!d.notTypes || !d.notTypes.includes(w.type))
    && (!d.weapons || d.weapons.some((n) => new RegExp("(^|[\\s-])" + n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "($|[\\s-])", "i").test(w.en || "")));   // whole word: "Bolto" ≠ Boltor
  function arcanesFor(w) { return Object.entries(ARC).filter(([k, v]) => v.slot === w.slot && (!v.shotgunOnly || w.cls === "shotgun") && typeOk(v, w) && (!v.aoeOnly || hasRadial(w))); }
  const arcLabel = (v) => v.ko + (v.none ? " (무기 피해 영향 없음)" : v.manual ? " (조건부)" : "");
  function renderArcanes() {
    $("#arc").innerHTML = `<option value="auto">자동 (전부 비교해서 추천)</option><option value="none">없음</option>` + arcanesFor(st.weapon).map(([k, v]) => `<option value="${k}">${esc(arcLabel(v))}</option>`).join("");
    $("#arclist").innerHTML = `<option value="없음"></option>` + arcanesFor(st.weapon).map(([k, v]) => `<option value="${esc(v.ko)}"></option>`).join("");
    $("#exlist").innerHTML = exilusMods(st.weapon).map((m) => `<option value="${esc(m.ko)}"></option>`).join("");
    $$("#sets .carc").forEach((el) => syncArc(el));
    $$("#sets .cx").forEach((el) => syncEx(el));
  }
  // exilus-slot mods the weapon can take (utility mods), and name lookups for the comparison inputs
  const exilusMods = (w) => MODS.filter((m) => m.exilus && m.compat.includes(modClass(w)) && typeOk(m, w) && !(m.req === "glaive" && w.sub !== "glaive"));
  function fuzzyPick(text, pool, keyKo) {
    const t = (text || "").trim().replace(/\s+/g, " ");
    if (!t) return null;
    const norm = (x) => x.replace(/\s+/g, "");
    const ko = (x) => keyKo(x);
    let m = pool.find((x) => ko(x) === t) || pool.find((x) => norm(ko(x)) === norm(t));
    if (m) return m;
    const pre = pool.filter((x) => norm(t).startsWith(norm(ko(x)))).sort((p, q) => ko(q).length - ko(p).length);
    if (pre.length && norm(t).length - norm(ko(pre[0])).length <= 2) return pre[0];
    const inc = pool.filter((x) => norm(ko(x)).includes(norm(t)));
    if (inc.length === 1) return inc[0];
    const en = pool.find((x) => (x.en || "").toLowerCase() === t.toLowerCase());
    if (en) return en;
    const q = norm(t); if (q.length < 3) return null;
    const lim = q.length >= 5 ? 2 : 1; let best = null, bd = 99, tie = false;
    for (const x of pool) { const d = editDist(q, norm(ko(x))); if (d < bd) { bd = d; best = x; tie = false; } else if (d === bd) tie = true; }
    return bd <= lim && !tie ? best : null;
  }
  const resolveArc = (text) => { const p = arcanesFor(st.weapon).map(([k, v]) => Object.assign({ id: k }, v)); return fuzzyPick(text, p, (x) => x.ko); };
  const resolveEx = (text) => fuzzyPick(text, exilusMods(st.weapon), (x) => x.ko);
  const resolveFA = (text) => fuzzyPick(text, Object.entries(FRAME_ARC).map(([k, v]) => Object.assign({ id: k }, v)), (x) => x.ko);
  function pickedFA() {
    const out = [];
    for (const id of ["#fa0", "#fa1"]) { const m = resolveFA($(id).value); if (m && !out.includes(m.id)) out.push(m.id); }
    return out;
  }
  const COLOR_KO = { crimson: "진홍", amber: "황색", azure: "청색", violet: "보라", emerald: "에메랄드", topaz: "토파즈" };
  function renderShards() {
    if ($("#shards").dataset.ready) return;
    const groups = Object.keys(COLOR_KO).map((c) => `<optgroup label="${COLOR_KO[c]}">${BUFFS.shards.filter((s) => s.color === c).map((s) => `<option value="${s.id}">${esc(s.ko.split(" — ")[1])}${s.kind === "none" ? " (무기 영향 없음)" : ""}</option>`).join("")}</optgroup>`).join("");
    $("#shards").innerHTML = Array.from({ length: 5 }, (_, i) => `<div class="shardrow"><select class="shard" id="sh${i}" aria-label="샤드 ${i + 1}"><option value="">샤드 ${i + 1} — 없음</option>${groups}</select><label class="inline"><input type="checkbox" class="tau" id="tau${i}">타우포지드</label></div>`).join("");
    $("#shards").dataset.ready = "1";
    $$("#shards select, #shards input").forEach((el) => el.addEventListener("change", renderFrameStats));
  }
  /* ---------------- comparison sets (up to 5) ---------------- */
  const SET_LETTERS = ["A", "B", "C", "D", "E"];
  let setsClass = null;
  let modCands = [];
  // slot cards show the name wrapped like an in-game mod card; the input sits on top and shows only while editing
  function syncSlot(el, m) {
    const slot = el.parentElement, v = el.value.trim();
    slot.querySelector(".mname").textContent = v;
    slot.classList.toggle("filled", !!m);
    slot.classList.toggle("bad", !!v && !m);
    slot.classList.toggle("riv", !!m && m.id === "__riven");
  }
  function syncArc(el) {
    const v = el.value.trim(), m = v && v !== "없음" ? resolveArc(v) : null;
    if (m) el.value = m.ko;
    el.dataset.id = m ? m.id : "";
    const slot = el.parentElement;
    slot.querySelector(".mname").textContent = m ? m.ko : v && v !== "없음" ? v : "없음";
    slot.classList.toggle("filled", !!m);
    slot.classList.toggle("bad", !!v && v !== "없음" && !m);
  }
  function syncEx(el) {
    const v = el.value.trim(), m = v ? resolveEx(v) : null;
    if (m) el.value = m.ko;
    el.dataset.id = m ? m.id : "";
    const slot = el.parentElement;
    slot.querySelector(".mname").textContent = m ? m.ko : v;
    slot.classList.toggle("filled", !!m);
    slot.classList.toggle("bad", !!v && !m);
  }
  function renderCompareSets() {
    const cls = modClass(st.weapon);
    modCands = MODS.filter((m) => m.compat.includes(cls) && !m.exilus && typeOk(m, st.weapon)).slice().sort((a, b) => a.ko.localeCompare(b.ko, "ko"));
    if (setsClass === cls && $("#sets").children.length) return;   // same mod class (e.g. attack change): keep what was typed
    setsClass = cls;
    $("#sets").innerHTML = "";
    addSet();
  }
  const RIVEN_ENTRY = { id: "__riven", ko: "리벤 모드" };
  // what blocks mod m in this set: same mod or a variant (Primed/Amalgam/Galvanized …) already in another slot
  function conflictIn(d, m, self) {
    const ins = [...d.querySelectorAll(".cm")];
    for (let i = 0; i < ins.length; i++) {
      if (ins[i] === self || !ins[i].value.trim()) continue;
      const x = resolveMod(ins[i].value);
      if (!x) continue;
      if (x.id === m.id) return { slot: i + 1, mod: x, same: true };
      if (E.clash(m, x)) return { slot: i + 1, mod: x, same: false };
    }
    return null;
  }
  function fillSetList(d, self) {
    const opts = [RIVEN_ENTRY].concat(modCands).filter((m) => !conflictIn(d, m, self));
    d.querySelector("datalist").innerHTML = opts.map((m) => `<option value="${esc(m.ko)}"></option>`).join("");
  }
  function addSet() {
    const box = $("#sets");
    if (box.children.length >= 5) return;
    const used = new Set($$("#sets .cset").map((e) => e.dataset.letter));
    const L = SET_LETTERS.find((l) => !used.has(l));
    $$("#sets .cset").forEach((e) => { if (setMods(e).ids.length) e.open = false; });
    const d = document.createElement("details");
    const melee = modClass(st.weapon) === "melee";
    d.className = "cset"; d.open = true; d.dataset.letter = L;
    d.innerHTML = `<summary><span class="cname">세팅 ${L}</span><span class="ccount">비어 있음</span><button type="button" class="cdel">삭제</button></summary>
      <div class="cbody">
        <label>이름<input type="text" class="cnamein" value="세팅 ${L}" maxlength="20"></label>
        <div class="cocr"><button type="button" class="cocrbtn">스크린샷으로 채우기</button><input type="file" class="cocrfile" accept="image/*" multiple hidden>
          <small>아스날 모드 화면 캡처를 올리면 모드·익실러스·아케인을 읽어서 칸을 채웁니다. 여러 장 가능, 이 칸에 끌어 놓거나 Ctrl+V로 붙여 넣어도 됩니다. 리벤 수치는 리벤 카드에 마우스를 올린 화면을 같이 올리면 읽습니다.</small>
          <div class="cocrbar" hidden><i></i></div><p class="cocrmsg" hidden></p></div>
        <datalist id="ml-${L}"></datalist>
        <div class="mgrid">
          ${melee ? `<div class="mslot fixed top c2" title="스탠스는 계산에 영향이 없습니다"><span>스탠스</span><small>계산 제외</small></div>` : ""}
          <label class="mslot exslot top ${melee ? "c3" : "c23"}"><i class="mnum">익실러스</i><span class="mname"></span><input type="text" list="exlist" class="cx" placeholder="이름 검색" autocomplete="off" aria-label="세팅 ${L} 익실러스"></label>
          <label class="mslot arcslot top c4"><i class="mnum">아케인</i><span class="mname"></span><input type="text" list="arclist" class="carc" placeholder="이름 검색" autocomplete="off" aria-label="세팅 ${L} 아케인"></label>
          ${Array.from({ length: 8 }, (_, i) => `<label class="mslot modslot"><i class="mnum">${i + 1}</i><span class="mname"></span><input type="text" list="ml-${L}" class="cm" placeholder="이름 검색" autocomplete="off" aria-label="세팅 ${L} ${i + 1}번 칸"></label>`).join("")}
        </div>
        <div class="crivbox" hidden>
          <div class="crivhead"><b>리벤 옵션</b><small>이 세팅 전용 · 리벤 카드 수치 그대로</small><button type="button" class="crivcopy">리벤 칸에서 가져오기</button></div>
          ${[0, 1, 2, 3].map((i) => `<div class="crivrow"><span class="crivlab">${i < 3 ? "긍정 " + (i + 1) : "부정"}</span><select class="crk" aria-label="세팅 ${L} 리벤 ${i < 3 ? "긍정 " + (i + 1) : "부정"} 옵션">${rivenOptionsHtml()}</select><input type="number" class="crv" step="0.1" placeholder="${i < 3 ? "수치 %" : "− 수치 %"}" aria-label="세팅 ${L} 리벤 수치 ${i + 1}"></div>`).join("")}
        </div>
        <p class="cmsg warn" hidden></p>
      </div>`;
    box.appendChild(d);
    const msg = d.querySelector(".cmsg");
    const showRiv = () => { d.querySelector(".crivbox").hidden = ![...d.querySelectorAll(".cm")].some((x) => x.value.trim() && resolveMod(x.value) === RIVEN_ENTRY); };
    d.querySelectorAll(".crk, .crv").forEach((el) => el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => upd()));
    d.querySelector(".crivcopy").addEventListener("click", () => {
      const ks = d.querySelectorAll(".crk"), vs = d.querySelectorAll(".crv");
      for (let i = 0; i < 4; i++) { ks[i].value = $("#rk" + i).value; vs[i].value = $("#rv" + i).value; }
      upd();
    });
    const upd = () => { const s = setMods(d); d.querySelector(".ccount").textContent = s.ids.length ? `모드 ${s.ids.filter((x) => !(MOD_BY_ID[x] && MOD_BY_ID[x].exilus)).length}개${s.arcane ? " · " + ARC[s.arcane].ko : ""}` : "비어 있음"; d.querySelector(".cname").textContent = s.name; queueCompare(); };
    d.querySelectorAll(".cm").forEach((el) => {
      const fix = () => {
        const m = resolveMod(el.value);
        const c = m && conflictIn(d, m, el);
        if (c) {
          msg.textContent = c.same ? `${josa(m.ko, "은", "는")} 이미 ${c.slot}번 칸에 있어서 넣지 않았습니다.` : `${josa(m.ko, "은", "는")} ${c.slot}번 칸의 ${josa(c.mod.ko, "과", "와")} 같이 넣을 수 없는 모드라 넣지 않았습니다.`;
          msg.hidden = false; el.value = "";
        } else if (m) { el.value = m.ko; msg.hidden = true; }
        syncSlot(el, m);
        showRiv();
        upd();
      };
      el.addEventListener("focus", () => fillSetList(d, el));
      el.addEventListener("change", fix);
      el.addEventListener("blur", fix);
    });
    for (const [sel, fn] of [[".carc", syncArc], [".cx", syncEx]]) {
      const el = d.querySelector(sel);
      el.addEventListener("change", () => { fn(el); upd(); });
      el.addEventListener("blur", () => { fn(el); upd(); });
      fn(el);
    }
    d.querySelector(".cnamein").addEventListener("input", upd);
    // screenshot → slots
    const ocrBox = d.querySelector(".cocr"), ocrBtn = d.querySelector(".cocrbtn"), ocrFile = d.querySelector(".cocrfile");
    d._ocr = (files) => ocrFill(d, files);
    d.addEventListener("ocrfilled", upd);
    ocrBtn.addEventListener("click", () => ocrFile.click());
    ocrFile.addEventListener("change", () => { if (ocrFile.files.length) d._ocr([...ocrFile.files]); ocrFile.value = ""; });
    ocrBox.addEventListener("dragover", (e) => { e.preventDefault(); ocrBox.classList.add("drag"); });
    ocrBox.addEventListener("dragleave", () => ocrBox.classList.remove("drag"));
    ocrBox.addEventListener("drop", (e) => { e.preventDefault(); ocrBox.classList.remove("drag"); const f = [...(e.dataTransfer.files || [])].filter((x) => /^image\//.test(x.type)); if (f.length) d._ocr(f); });
    d.querySelector(".cdel").addEventListener("click", (e) => {
      e.preventDefault();
      if ($("#sets").children.length === 1) { $("#sets").innerHTML = ""; addSet(); } else d.remove();
      $("#addset").hidden = $("#sets").children.length >= 5; queueCompare();
    });
    $("#addset").hidden = box.children.length >= 5;
  }
  // Ctrl+V anywhere: screenshots go to the open comparison set (the last one if several are open)
  // the element under the mouse pointer (where a Ctrl+V should go)
  let lastOver = null;
  document.addEventListener("mouseover", (e) => { lastOver = e.target; });
  document.addEventListener("mouseout", (e) => { if (!e.relatedTarget) lastOver = null; });
  document.addEventListener("paste", (e) => {
    const files = [...((e.clipboardData && e.clipboardData.files) || [])].filter((x) => /^image\//.test(x.type));
    if (!files.length || $("#calcview").hidden) return;
    // mouse over (or a field focused in) the warframe box of the advanced settings → warframe upgrade screen
    const fb = $("#frameocr") && $("#frameocr").closest(".box");
    if (fb && (fb.contains(lastOver) || fb.matches(":hover") || fb.contains(document.activeElement))) { e.preventDefault(); frameOcrFill(files); return; }
    const open = $$("#sets .cset").filter((x) => x.open);
    const d = open[open.length - 1];
    if (!d || !d._ocr) return;
    e.preventDefault(); d._ocr(files);
  });
  const CLS_NAME = { rifle: "주무기", shotgun: "샷건", pistol: "보조무기", melee: "근접 무기" };
  let ocrAll = null;
  const ocrAllNames = () => ocrAll || (ocrAll = MODS.map((m) => ({ id: m.id, ko: m.ko, compat: m.compat, weapons: m.weapons })).concat(Object.entries(ARC).map(([k, v]) => ({ id: "arc:" + k, ko: v.ko, slot: v.slot }))));
  async function ocrFill(d, files) {
    const btn = d.querySelector(".cocrbtn"), bar = d.querySelector(".cocrbar"), msg = d.querySelector(".cocrmsg");
    if (btn.disabled) return;
    btn.disabled = true; bar.hidden = false; msg.hidden = false;
    msg.textContent = "글자 인식 준비 중… (처음 한 번은 인식 도구와 한국어 데이터 약 6MB를 받습니다)";
    try {
      const reads = await window.WF_OCR.read(files, (p, label) => { bar.firstElementChild.style.width = Math.round(p * 100) + "%"; msg.textContent = `${label}… ${Math.round(p * 100)}%`; });
      // the screenshot's own weapon (arsenal header): switch to it first
      const hw = window.WF_OCR.findWeapon(reads, WEAPONS);
      // a warframe upgrade screen pasted into a weapon set: fill the warframe box instead
      const hf = hw ? null : window.WF_OCR.findWeapon(reads, FRAMES);
      if (hf) {
        msg.textContent = `${hf.ko}의 워프레임 화면이라 고급 설정의 워프레임 칸에 채웁니다.`;
        $("#adv").open = true;
        setTimeout(() => { frameOcrFill(files); $("#frameocr").scrollIntoView({ behavior: "smooth", block: "center" }); }, 0);
        return;
      }
      if (hw && hw.id !== st.weapon.id) {
        selectWeapon(hw);
        const d2 = $$("#sets .cset")[0] || d;
        ocrApply(d2, reads, `스크린샷의 무기 ${hw.ko}(으)로 바꿨습니다. `);
      } else ocrApply(d, reads, "");
    } catch (e) {
      msg.textContent = "읽지 못했습니다: " + (e && e.message ? e.message : e);
    } finally { btn.disabled = false; bar.hidden = true; }
  }
  function ocrApply(d, reads, lead) {
    const msg = d.querySelector(".cocrmsg"), w = st.weapon, cls = modClass(w);
    msg.hidden = false;
    const ctx = { mods: modCands.concat(exilusMods(w)), arcanes: arcanesFor(w).map(([k, v]) => ({ id: k, ko: v.ko })), all: ocrAllNames() };
    const r = window.WF_OCR.match(reads, ctx);
    const got = r.slots.filter(Boolean).length + (r.exilus ? 1 : 0) + (r.arcane ? 1 : 0);
    // mods of another weapon class: the wrong weapon is selected — keep the reading and fill once the right one is picked
    const other = r.foreign.filter((m) => m.compat ? !m.compat.includes(cls) && !m.weapons : m.slot && m.slot !== w.slot);
    if (other.length >= 3 && other.length > got) {
      const tally = {};
      for (const m of other) { const c = m.compat ? m.compat[0] : m.slot === "melee" ? "melee" : m.slot === "secondary" ? "pistol" : "rifle"; tally[c] = (tally[c] || 0) + 1; }
      const guess = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
      pendingOcr = reads;
      msg.innerHTML = `${esc(lead)}이 스크린샷은 <b>${CLS_NAME[guess] || guess}</b> 모드 화면으로 보입니다 (${esc(other.slice(0, 4).map((m) => m.ko).join(", "))} 등). 지금 고른 무기는 ${esc(w.ko)}(${CLS_NAME[cls] || cls})라 맞지 않습니다. <b>왼쪽에서 무기를 고르면 이 스크린샷으로 바로 채웁니다.</b>`;
      return;
    }
    pendingOcr = null;
    const ins = [...d.querySelectorAll(".cm")];
    const unsure = [], empty = [];
    ins.forEach((el, i) => {
      const s = r.slots[i];
      el.value = s ? (s.id === "__riven" ? RIVEN_ENTRY.ko : s.ko) : "";
      syncSlot(el, el.value ? resolveMod(el.value) : null);
      const q = !!s && (!s.sure || s.guessRiv);
      el.parentElement.classList.toggle("ocrq", q);
      if (q) unsure.push(`${i + 1}번 ${s.ko}`);
      if (!s) empty.push(i + 1);
    });
    const xin = d.querySelector(".cx"), ain = d.querySelector(".carc");
    xin.parentElement.classList.remove("ocrq"); ain.parentElement.classList.remove("ocrq");
    if (r.exilus) { xin.value = r.exilus.ko; syncEx(xin); xin.parentElement.classList.toggle("ocrq", !r.exilus.sure); if (!r.exilus.sure) unsure.push("익실러스 " + r.exilus.ko); }
    if (r.arcane) { ain.value = r.arcane.ko; syncArc(ain); ain.parentElement.classList.toggle("ocrq", !r.arcane.sure); if (!r.arcane.sure) unsure.push("아케인 " + r.arcane.ko); }
    let rivNote = "";
    if (r.riven) {
      const ks = [...d.querySelectorAll(".crk")], vs = [...d.querySelectorAll(".crv")];
      const pos = r.riven.stats.filter((x) => !x.neg).slice(0, 3), neg = r.riven.stats.find((x) => x.neg);
      [pos[0], pos[1], pos[2], neg].forEach((x, i) => {
        const has = (k) => k && [...ks[i].options].some((o) => o.value === k);
        ks[i].value = x && has(x.k) ? x.k : ""; vs[i].value = x ? x.v : "";
        ks[i].parentElement.classList.toggle("ocrq", !!x && (x.guess || !has(x.k)));
      });
      const n = r.riven.stats.length;
      rivNote = n ? ` 리벤 옵션 ${n}개를 읽었습니다${r.riven.stats.some((x) => x.guess || !x.k) ? " (점선 표시된 옵션은 이름을 확인해 주세요)" : ""}.` : " 리벤 수치는 리벤 카드에 마우스를 올린 화면을 같이 올리면 읽습니다.";
    }
    d.querySelector(".crivbox").hidden = !ins.some((x) => x.value.trim() && resolveMod(x.value) === RIVEN_ENTRY);
    d.dispatchEvent(new Event("ocrfilled"));
    msg.innerHTML = `${esc(lead)}${got}칸을 채웠습니다.${unsure.length ? ` <b>점선 칸은 확인해 주세요</b>: ${esc(unsure.join(", "))}.` : ""}${empty.length ? ` 읽지 못한 칸: ${empty.join(", ")}번.` : ""}${r.orderSure || !got ? "" : " 칸 순서는 화면 위치로 추정했습니다 (원소 순서에 영향)."}${esc(rivNote)}`;
  }
  // read one set in slot order (empty slots skipped); conflicts are already blocked at input, this is a safety net
  function setMods(d) {
    const name = (d.querySelector(".cnamein").value || "").trim() || "세팅 " + d.dataset.letter;
    const typed = [...d.querySelectorAll(".cm")].map((i) => i.value.trim()).filter(Boolean);
    const ids = [], problems = [], notes = [];
    for (const t of typed) {
      const m = resolveMod(t);
      if (!m) { problems.push(`인식 못 한 이름 "${t}"`); continue; }
      if (ids.includes(m.id)) continue;
      if (ids.some((x) => E.clash(m, MOD_BY_ID[x]))) continue;
      if (m.id === "__riven" && st.weapon.noRiven) { problems.push("익절티드 무기에는 리벤이 없습니다"); continue; }
      if (m.id === "__riven" && !Object.keys(setRiven(d).eff).length) { problems.push("리벤 모드: 아래 리벤 옵션 칸에 옵션과 수치를 넣어야 계산됩니다"); continue; }
      ids.push(m.id);
      if (m.noCalc || (m.unparsed && m.unparsed.length)) notes.push(`${m.ko}: ${m.noCalc ? "피해 계산에 들어가는 효과가 없거나 아직 반영하지 않은 효과" : "일부 효과 미반영"} — ${(m.kd || m.unparsed || []).join(" / ").replace(/\n/g, " ")}`);
    }
    const xin = d.querySelector(".cx"), xm = xin.value.trim() ? resolveEx(xin.value) : null;
    if (xin.value.trim() && !xm) problems.push(`익실러스 칸 "${xin.value.trim()}" 인식 못 함`);
    if (xm) ids.push(xm.id);
    const ain = d.querySelector(".carc"), am = ain.value.trim() && ain.value.trim() !== "없음" ? resolveArc(ain.value) : null;
    if (ain.value.trim() && ain.value.trim() !== "없음" && !am) problems.push(`아케인 "${ain.value.trim()}" 인식 못 함`);
    const rv = ids.includes("__riven") ? setRiven(d) : null;
    return { name, ids, arcane: am ? am.id : null, problems, notes, rivEff: rv ? rv.eff : null, rivInfo: rv ? rv.info : null };
  }
  let cmpTimer = null;
  const queueCompare = () => { clearTimeout(cmpTimer); cmpTimer = setTimeout(renderCompare, 150); };

  // tolerant name matching: Korean IME + datalist can append the last syllable again ("쇼킹 터치킹")
  function resolveMod(text) {
    const t = (text || "").trim().replace(/\s+/g, " ");
    if (!t) return null;
    if (/^리벤/.test(t) || /^riven/i.test(t)) return RIVEN_ENTRY;
    const pool = MODS.filter((m) => m.compat.includes(modClass(st.weapon)) && !m.exilus && typeOk(m, st.weapon));
    const norm = (s) => s.replace(/\s+/g, "");
    let m = pool.find((x) => x.ko === t) || pool.find((x) => norm(x.ko) === norm(t));
    if (m) return m;
    const pre = pool.filter((x) => norm(t).startsWith(norm(x.ko))).sort((p, q) => q.ko.length - p.ko.length);
    if (pre.length && norm(t).length - norm(pre[0].ko).length <= 2) return pre[0];
    const inc = pool.filter((x) => norm(x.ko).includes(norm(t)));
    if (inc.length === 1) return inc[0];
    const en = pool.find((x) => x.en.toLowerCase() === t.toLowerCase());
    if (en) return en;
    // small typos ("세레이션" → 서레이션, "스플릿 챔버" → 스플릿 체임버): closest name if clearly unique
    const q = norm(t);
    if (q.length < 3) return null;
    const lim = q.length >= 5 ? 2 : 1;
    let best = null, bd = 99, tie = false;
    for (const x of pool) {
      const d = editDist(q, norm(x.ko));
      if (d < bd) { bd = d; best = x; tie = false; } else if (d === bd) tie = true;
    }
    return bd <= lim && !tie ? best : null;
  }
  function editDist(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 99;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }

  function rivenOptionsHtml() {
    const cls = modClass(st.weapon);
    const opt = (d) => `<option value="${d.k}">${d.ko}${d.note ? ` (${d.note})` : ""}</option>`;
    const grp = (label, g) => { const l = RIV_DEF.filter((d) => d.grp === g && rivFits(d, cls)); return l.length ? `<optgroup label="${label}">${l.map(opt).join("")}</optgroup>` : ""; };
    return `<option value="">—</option>` + grp("처치 속도에 반영", "dmg") + grp("강공·연속기 계산에 반영", "heavy") + grp("접합 (Update 44.1)", "splice") + grp("계산 영향 없음", "none");
  }
  function renderRivenSelects() {
    const html = rivenOptionsHtml();
    for (let i = 0; i < 4; i++) { const el = $("#rk" + i); const cur = el.value; el.innerHTML = html; el.value = cur; }
  }
  // riven rows → effect object (row 4 is the negative; values typed as on the riven card, % except initial combo)
  function parseRiven(rows) {
    const r = {}, info = [];
    rows.forEach(({ k, v, inc }, i) => {
      if (!k || !v) return;
      if (k === "x_faction") k = "fac_g";      // older links: one "faction" stat
      const u = (RIV_D[k] || {}).unit;
      // faction damage shows in game as a multiplier ("x1.56" = +56%, negative "x0.85" = −15%): small numbers are read that way
      const fx = /^fac_/.test(k) && Math.abs(v) < 5;
      const val = (i === 3 ? -1 : 1) * (fx ? Math.abs(Math.abs(v) - 1) : u === "n" || u === "m" || u === "s" ? Math.abs(v) : Math.abs(v) / 100);
      info.push({ k, v: val, inc });
      if (inc) addRivEff(r, k, val);
    });
    return { eff: r, info };
  }
  function setRiven(d) {
    const ks = [...d.querySelectorAll(".crk")], vs = [...d.querySelectorAll(".crv")];
    return parseRiven(ks.map((el, i) => ({ k: el.value, v: +vs[i].value, inc: true })));
  }
  const rivenText = (info) => info.map((x) => `${x.v < 0 ? "부정 " : ""}${RIV_KO[x.k] || x.k} ${x.v > 0 ? "+" : "−"}${rivVal(x.k, x.v)}`).join(", ");

  /* ---------------- frames ---------------- */
  const pickedMisc = () => $$("#miscbuffs .mb:checked").map((el) => (BUFFS.misc || []).find((x) => x.id === el.value)).filter(Boolean);
  function renderMisc() {
    $("#miscbuffs").innerHTML = (BUFFS.misc || []).map((M) => `<label class="inline"><input type="checkbox" class="mb" value="${M.id}"${M.def ? " checked" : ""}><span><b>${esc(M.ko)}</b> <small>${esc(M.note)}</small></span></label>`).join("");
    $$("#miscbuffs .mb").forEach((el) => el.addEventListener("change", renderFrameStats));
  }
  const auraOk = (A, w) => (!A.cls || A.cls.includes(w.cls)) && typeOk(A, w);
  const pickedAura = () => (BUFFS.auras || []).find((x) => x.id === $("#aura").value) || null;
  function renderAuras() {
    const cur = $("#aura").value;
    const tag = (A) => A.none ? " (무기 처치 속도와 무관)" : A.cond ? " (조건부 — 계산 안 함)" : A.ind ? "" : auraOk(A, st.weapon) || A.stat ? "" : " (이 무기엔 효과 없음)";
    const one = (A) => `<option value="${A.id}">${esc(A.ko)} — ${esc(A.note)}${tag(A)}</option>`;
    const L = BUFFS.auras || [];
    $("#aura").innerHTML = `<option value="">없음</option><optgroup label="무기·어빌리티 계산에 반영">${L.filter((A) => !A.none && !A.cond && !A.ind).map(one).join("")}</optgroup>` +
      `<optgroup label="입력값(체력·방어력·질주 속도·실드)으로 간접 반영">${L.filter((A) => A.ind).map(one).join("")}</optgroup>` +
      `<optgroup label="계산하지 않음">${L.filter((A) => A.none || A.cond).map(one).join("")}</optgroup>`;
    $("#aura").value = cur;
  }
  function renderFrameList() {
    $("#frame").innerHTML = `<option value="">선택 안 함 (모든 워프레임 범용)</option>` + FRAMES.map((f) => `<option value="${f.id}">${esc(f.ko)}</option>`).join("");
    // every Helminth ability in the game: those that change weapon numbers are calculated, the rest are listed with why not
    const hel = Object.entries(BUFFS.abilities).filter(([k, v]) => v.helminth && v.fx);
    const rest = (window.WF_HELMINTH || []).filter((h) => !hel.some(([k]) => k === h.en)).sort((a, b) => a.ko.localeCompare(b.ko, "ko"));
    const HK = { dmg: "피해·약화형 — 무기 처치 속도 계산에는 아직 없음", strip: "방어구 제거 — 계산에 아직 없음", group: "적을 한데 모음 — 여러 명 명중에 유리하지만 계산에 없음", util: "생존·이동·에너지 등 — 무기 처치 속도와 직접 관계없음" };
    $("#helminth").innerHTML = `<option value="">없음</option><optgroup label="무기 계산에 반영">${hel.map(([k, v]) => `<option value="${esc(k)}">${esc(v.ko)}</option>`).join("")}</optgroup>` +
      ["dmg", "strip", "group", "util"].map((kd) => { const xs = rest.filter((h) => h.kind === kd); return xs.length ? `<optgroup label="${HK[kd]}">${xs.map((h) => `<option value="x:${esc(h.en)}">${esc(h.ko)} (${esc(h.frame)})</option>`).join("")}</optgroup>` : ""; }).join("");
  }
  function renderAbilities() {
    const f = FRAMES.find((x) => x.id === $("#frame").value);
    const box = $("#abilities");
    if (f && f.power) $("#energy").value = Math.round(f.power);
    if (!f) { box.innerHTML = ""; renderFrameStats(); return; }
    box.innerHTML = f.abilities.map((a) => {
      const b = BUFFS.abilities[a.en];
      const augs = ((BUFFS.augments || {})[a.en] || []).map((k) => { const x = BUFFS.abilities[k]; return `<label class="inline aug"><input type="checkbox" class="abil" value="${esc(k)}"><span><b>${esc(x.ko)}</b> <small>${esc(x.note || "")}</small><small class="abilcalc" data-ab="${esc(k)}"></small></span></label>`; }).join("");
      const prm = b && b.param ? `<label class="abparam">${esc(b.param.ko)} <input type="number" class="abp" data-ab="${esc(a.en)}" value="${b.param.def}" min="${b.param.min}" max="${b.param.max}" step="${b.param.step}"> ${esc(b.param.unit || "")}</label>` : "";
      if (b && b.fx) return `<label class="inline"><input type="checkbox" class="abil" value="${esc(a.en)}"><span><b>${esc(a.ko)}</b> <small>${esc(b.note || "")}</small><small class="abilcalc" data-ab="${esc(a.en)}"></small></span></label>` + prm + augs;
      return `<div class="abil-off"><b>${esc(a.ko)}</b> <small>${b && b.note ? esc(b.note) : "무기 피해 계산에 영향 없음"}</small></div>` + augs;
    }).join("");
    $$("#abilities .abil, #abilities .abp").forEach((el) => el.addEventListener("change", renderFrameStats));
    renderFrameStats();
  }
  // warframe upgrade screen → frame, stat panel, aura, arcanes
  function initFrameOcr() {
    const box = $("#frameocr"), btn = $("#frameocrbtn"), file = $("#frameocrfile");
    btn.addEventListener("click", () => file.click());
    file.addEventListener("change", () => { if (file.files.length) frameOcrFill([...file.files]); file.value = ""; });
    box.addEventListener("dragover", (e) => { e.preventDefault(); box.classList.add("drag"); });
    box.addEventListener("dragleave", () => box.classList.remove("drag"));
    box.addEventListener("drop", (e) => { e.preventDefault(); box.classList.remove("drag"); const f = [...(e.dataTransfer.files || [])].filter((x) => /^image\//.test(x.type)); if (f.length) frameOcrFill(f); });
  }
  const STAT_IN = [["health", "#health", "체력"], ["shield", "#shield", "실드"], ["armor", "#armor", "방어력"], ["energy", "#energy", "에너지"], ["sprint", "#sprint", "질주 속도"],
    ["range", "#range", "거리"], ["str", "#strength", "위력"], ["dur", "#duration", "지속시간"], ["eff", "#efficiency", "효율"]];
  async function frameOcrFill(files) {
    const btn = $("#frameocrbtn"), bar = $("#frameocr .cocrbar"), msg = $("#frameocrmsg");
    if (btn.disabled) return;
    btn.disabled = true; bar.hidden = false; msg.hidden = false;
    msg.textContent = "글자 인식 준비 중… (처음 한 번은 인식 도구와 한국어 데이터 약 6MB를 받습니다)";
    try {
      const reads = await window.WF_OCR.read(files, (p, label) => { bar.firstElementChild.style.width = Math.round(p * 100) + "%"; msg.textContent = `${label}… ${Math.round(p * 100)}%`; }, { crops: window.WF_OCR.FRAME_CROPS });
      const FM = window.WF_FRAME_MODS ? Object.values(window.WF_FRAME_MODS) : [];
      const r = window.WF_OCR.readFrame(reads, {
        frames: FRAMES, auras: BUFFS.auras || [],
        arcanes: Object.entries(FRAME_ARC).map(([k, v]) => ({ id: k, ko: v.ko })),
        mods: FM.filter((m) => !/AURA/i.test(JSON.stringify(m.compat || ""))).map((m) => ({ id: m.id, ko: m.ko })),
      });
      const done = [], miss = [], unsure = [];
      if (r.frame) { $("#frame").value = r.frame.id; renderAbilities(); done.push(r.frame.ko); } else miss.push("워프레임 이름");
      // after the frame: picking a frame resets max energy to its base value
      const S = r.stats || {};
      for (const [k, sel, ko] of STAT_IN) { if (S[k] != null) { $(sel).value = S[k]; done.push(`${ko} ${k === "sprint" ? S[k] : fmt(S[k])}${["range", "str", "dur", "eff"].includes(k) ? "%" : ""}`); } else miss.push(ko); }
      if (r.stats) $("#statincl").checked = true;
      $("#aura").parentElement.classList.remove("ocrq");
      if (r.aura) { $("#aura").value = r.aura.id; done.push("오라 " + r.aura.ko); if (!r.aura.sure) { unsure.push("오라"); $("#aura").parentElement.classList.add("ocrq"); } } else miss.push("오라");
      ["#fa0", "#fa1"].forEach((id, i) => {
        const el = $(id), a = r.arcanes[i];
        el.parentElement.classList.toggle("ocrq", !!a && !a.sure);
        el.value = a ? a.ko : ""; el.dispatchEvent(new Event("change"));
        if (a) { done.push(a.ko); if (!a.sure) unsure.push(a.ko); }
      });
      if (r.arcanes.length < 2) miss.push(`아케인 ${2 - r.arcanes.length}개`);
      renderFrameStats();
      if (st.weapon) renderTargets();
      $("#frame").dispatchEvent(new Event("input", { bubbles: true }));
      msg.innerHTML = done.length
        ? `읽은 값: ${esc(done.join(" · "))}.${unsure.length ? ` <b>점선 칸은 확인해 주세요</b>: ${esc(unsure.join(", "))}.` : ""}${miss.length ? ` 읽지 못함: ${esc(miss.join(", "))}.` : ""} 헬민스 어빌리티·켜 둘 어빌리티는 화면에 이름이 없어 직접 골라 주세요. 아콘 샤드의 위력·지속·에너지는 위 능력치에 이미 들어 있고, 보라 주무기 전기 같은 무기 피해 샤드는 아래 '아콘 샤드' 칸에서 골라 주세요.`
        : "워프레임 업그레이드 화면의 글자를 찾지 못했습니다. 왼쪽 능력치 칸이 다 보이는 화면으로 다시 올려 주세요.";
    } catch (e) {
      msg.textContent = "읽지 못했습니다: " + (e && e.message ? e.message : e);
    } finally { btn.disabled = false; bar.hidden = true; }
  }
  function shardPicks() {
    const out = [];
    for (let i = 0; i < 5; i++) { const sel = $("#sh" + i); if (!sel) continue; const id = sel.value; if (!id) continue; const s = BUFFS.shards.find((x) => x.id === id); if (s) out.push({ s, t: $("#tau" + i).checked }); }
    return out;
  }
  function frameStats(faIds) {
    const st_ = { str: (+$("#strength").value || 100) / 100, dur: (+$("#duration").value || 100) / 100, rng: (+$("#range").value || 100) / 100, eff: (+$("#efficiency").value || 100) / 100, energy: +$("#energy").value || 300 };
    // arsenal values already include archon shards and always-on aura penalties (Power Donation); conditional ones are added
    const incl = $("#statincl").checked;
    if (!incl) for (const p of shardPicks()) if (p.s.kind === "stat") for (const k in p.s.stat) st_[k] += p.s.stat[k][p.t ? 1 : 0];
    const au = pickedAura();
    if (au && au.stat && !(incl && au.perm)) for (const k in au.stat) st_[k] += au.stat[k];
    for (const id of faIds || pickedFA()) {
      const A = FRAME_ARC[id]; if (!A) continue;
      if (A.stat) for (const k in A.stat) st_[k] += A.stat[k];
      if (A.bellicose) st_.str += Math.min(0.72, 0.06 * Math.floor((+$("#health").value || 0) / 250));
      if (A.battery) st_.energy += Math.min(1000, 0.3 * (+$("#armor").value || 0));
    }
    for (const M of pickedMisc()) if (M.stat) for (const k in M.stat) st_[k] += M.stat[k];
    st_.eff = Math.min(1.75, st_.eff);
    return st_;
  }
  function renderFrameStats() {
    const s = frameStats();
    if (st.weapon && st.weapon.exalted) $("#atkdesc").textContent = (st.weapon.attacks[st.atk].desc || "") + " " + exaltedNote(st.weapon);
    $("#statline").textContent = `${$("#statincl").checked ? "아케인·조건부 버프" : "샤드·아케인"} 반영 후: 위력 ${Math.round(s.str * 100)}% · 지속 ${Math.round(s.dur * 100)}% · 범위 ${Math.round(s.rng * 100)}% · 효율 ${Math.round(s.eff * 100)}% · 최대 에너지 ${Math.round(s.energy)}`;
    $$("#abilities .abilcalc").forEach((el) => {
      const b = BUFFS.abilities[el.dataset.ab]; if (!b) return;
      const bits = [];
      if (b.area) { const r = b.area(s); bits.push(`반경 ${r.toFixed(0)}m → 무리의 ${Math.round(Math.min(1, (r / 20) ** 2) * 100)}% 적용`); }
      if (b.time) bits.push(`유지 ${b.time(s).toFixed(0)}초`);
      el.textContent = bits.length ? " · " + bits.join(" · ") : "";
    });
  }
  function buffExt(scenario, faIds) {
    const s = frameStats(faIds);
    const list = [];
    const take = (b, h, key) => {
      const pin = key && b.param ? $(`#abilities .abp[data-ab="${key}"]`) : null;
      let e = b.fx(s, h, st.weapon, pin && pin.value !== "" ? +pin.value : undefined);
      if (b.gunOnly && st.weapon.cls === "melee") return;
      if (b.area && scenario === "crowd") e = BUFFS.scale(e, Math.min(1, (b.area(s) / 20) ** 2));
      list.push(e);
    };
    $$("#abilities .abil:checked").forEach((el) => { const b = BUFFS.abilities[el.value]; if (b && b.fx) take(b, false, el.value); });
    const hk = $("#helminth").value;
    if (hk && BUFFS.abilities[hk] && BUFFS.abilities[hk].fx) take(BUFFS.abilities[hk], true);
    const picks = shardPicks();
    const cnt = { cav: picks.filter((p) => ["crimson", "azure", "violet"].includes(p.s.color)).length };
    for (const p of picks) if (p.s.kind === "weapon" && (p.s.slot === "any" || p.s.slot === st.weapon.slot)) list.push(p.s.fx(p.t, cnt, s));
    const au = pickedAura();
    if (au && au.fx && auraOk(au, st.weapon)) list.push(au.fx);
    const gear = [];   // companion Bond mods: always-on gear, kept in the "without buffs" comparison too
    for (const M of pickedMisc()) if (M.fx) { let e = M.fx(st.weapon); if (M.area && scenario === "crowd") e = BUFFS.scale(e, Math.min(1, (M.area / 20) ** 2)); (M.gear ? gear : list).push(e); }
    const xs = Math.max(0, Math.min(10, +$("#extstatus").value || 0));
    if (xs) list.push({ statusExtra: xs });
    const ext = BUFFS.merge(list.concat(gear));
    ext.active = list.length > 0;
    ext.gearExt = gear.length ? BUFFS.merge(gear) : {};
    if (st.weapon.cls === "melee") ext.cdMult = 1;
    ext.maxEnergy = s.energy;
    return ext;
  }
  function buffSummary() {
    const names = [];
    $$("#abilities .abil:checked").forEach((el) => names.push(BUFFS.abilities[el.value].ko));
    const hk = $("#helminth").value;
    if (hk && BUFFS.abilities[hk]) names.push("헬민스 " + BUFFS.abilities[hk].ko);
    else if (hk) { const h = (window.WF_HELMINTH || []).find((x) => "x:" + x.en === hk); names.push("헬민스 " + (h ? h.ko : hk.slice(2)) + " (계산 영향 없음)"); }
    const picks = shardPicks().filter((p) => p.s.kind !== "none");
    if (picks.length) names.push(`아콘 샤드 ${picks.length}개`);
    for (const id of pickedFA()) names.push(FRAME_ARC[id].ko);
    if (pickedAura()) names.push("오라 " + pickedAura().ko);
    for (const M of pickedMisc()) names.push(M.ko);
    if (+$("#extstatus").value > 0) names.push(`외부 상태이상 ${+$("#extstatus").value}종`);
    return names;
  }

  /* ---------------- options ---------------- */
  function readOpts() {
    const o = E.defaults();
    const sc = $("#scenario").value;           // crowd | heavy | boss
    o.scenario = sc === "crowd" ? "crowd" : sc === "heavy" ? "single" : "boss";
    o.tier = sc === "crowd" ? "light" : "heavy";
    o.level = Math.max(1, +$("#level").value || 150);
    o.steel = $("#steel").checked;
    const obj = $("#objective").value;
    if (obj === "geo") { o.factions = ["grineer", "corpus", "infested"]; o.metric = "geo"; }
    else if (obj === "min") { o.factions = ["grineer", "corpus", "infested"]; o.metric = "min"; }
    else { o.factions = [obj]; o.metric = "geo"; }
    o.kills = sc !== "boss";
    const aim = $("#aimmods").checked && st.weapon.cls !== "melee";
    o.aim = aim; o.hs = aim ? 0.5 : 0;
    o.casting = $("#castmods").checked;
    o.energy = true;
    o.mercy = $("#mercy").checked && !!st.weapon.mercyBuff;
    o.og = sc === "heavy" && $("#og").checked;
    o.armor = +$("#armor").value || 0;
    o.shield = +$("#shield").value || 0;
    o.sprint = +$("#sprint").value || 1;
    o.frameArcs = pickedFA().filter((id) => FRAME_ARC[id].kind === "weapon");
    o.exStr = frameStats().str;
    o.formaMax = $("#forma").value === "" ? null : +$("#forma").value;
    o.comboWindow = +$("#combowin").value;
    o.frameSet = { gladiator: Math.max(0, Math.min(3, +$("#setglad").value || 0)), vigilante: Math.max(0, Math.min(2, +$("#setvig").value || 0)) };
    o.ext = buffExt(o.scenario);
    o.maxEnergy = o.ext.maxEnergy;
    if (o.ext.weakFrac) { o.hs = Math.max(o.hs, o.ext.weakFrac); }
    const cs = $$("#concepts select").map((x) => x.value);
    o.concept = [...new Set(cs.filter(Boolean))];
    o.conceptOnly = o.concept.length > 0 && cs.every(Boolean);
    o.targets = E.targetsFor(o);
    return o;
  }
  function renderTargets() {
    const o = readOpts();
    const one = (t) => `${esc(t.ko)} 체력 ${fmt(t.hp)}${t.sh ? " · 실드 " + fmt(t.sh) : ""}${t.ar ? " · 방어구 " + t.ar.toFixed(0) : ""}${t.og ? " · 오버가드 " + fmt(t.og) : ""}`;
    $("#ogrow").hidden = $("#scenario").value !== "heavy";
    const rows = o.factions.map((f) => { const t = o.targets.lo[f]; return `<span><b>${E.FACTIONS[f].label}</b> ${one(t.main)}${t.heavy ? " / 섞여 있는 " + one(t.heavy) : ""}</span>`; });
    $("#targets").innerHTML = `기준 적 (${o.steel ? "강철의 길 " : ""}${o.level}레벨): ` + rows.join("") + `<span>순위는 ${E.levelsOf(o).join("·")}레벨 세 조건의 처치 속도를 함께 봅니다 (${E.levelsOf(o)[2]} = 버티기 기준). 한 방에 죽고도 남는 화력은 높은 레벨에서도 한 방이 유지되는 것으로, 빠른 공격 속도는 같은 시간에 더 많이 잡는 것으로 점수에 들어갑니다.</span>`;
  }
  function valOptions() {
    if (!st.weapon.valence) return [null];
    const t = $("#valtype").value, p = +$("#valpct").value / 100;
    return t === "auto" ? VAL_TYPES.map((x) => ({ type: x, pct: p })) : [{ type: t, pct: p }];
  }
  function arcOptions() {
    const v = $("#arc").value;
    if (v === "none") return [null];
    if (v === "auto") { const l = arcanesFor(st.weapon).filter(([k, x]) => !x.manual && !x.none && (!x.aim || $("#aimmods").checked)).map(([k]) => k); return l.length ? l.concat([null]) : [null]; }
    return [v];
  }
  function ownedRiven() {
    if ($("#rivmode").value !== "owned" || st.weapon.noRiven) return null;
    return parseRiven([0, 1, 2, 3].map((i) => ({ k: $("#rk" + i).value, v: +$("#rv" + i).value, inc: $("#ri" + i).checked })));
  }

  // community builds read in full from their source (docs/community/builds/*.json, kind "read") for this weapon and
  // attack: handed to the search as extra candidates (engine optimize cfg.seeds)
  function communitySeeds(w) {
    const C = window.WF_COMMUNITY || {};
    const spec = w.modular ? C["kit:" + w.modular.parts.join("/")] : C[(st.base || w).id];
    if (!spec) return [];
    const atkIdx = spec.attack != null ? spec.attack : defaultAttack(w);
    if (atkIdx !== st.atk) return [];
    const AR = window.WF_ARCANES || {};
    const findMod = (n) => window.WF_MODS.find((m) => m.en === n || m.ko === n || m.id === n);
    const findArc = (n) => !n ? null : AR[n] ? n : Object.keys(AR).find((k) => AR[k].ko === n || AR[k].en === n);
    const out = [];
    for (const bd of spec.builds || []) {
      if (bd.kind !== "read") continue;
      const ids = []; let ok = true;
      for (const n of bd.mods || []) { if (/^(riven|리벤)/i.test(n)) { ids.push("__riven"); continue; } const m = findMod(n); if (m) ids.push(m.id); else { ok = false; break; } }
      const arc = findArc(bd.arcane);
      if (ok && ids.length) out.push({ name: bd.name, ids, arcane: arc === undefined ? undefined : arc });
    }
    return out;
  }

  /* ---------------- run ---------------- */
  function run() {
    const w = st.weapon, atk = w.attacks[st.atk];
    const o = readOpts();
    const flags = { aim: o.aim, cast: o.casting, boss: o.scenario === "boss" };
    const cands = candidateMods(w, atk, flags).map((m) => m.id);
    const owned = ownedRiven();
    const locked = owned ? ["__riven"] : [];
    const jobs = [{ tag: "main" }];
    if (owned) jobs.push({ tag: "free", locked: [] });      // riven-free best build, to grade the owned riven against
    if (o.ext.active || o.frameArcs.length) jobs.push({ tag: "nobuff", optsPatch: { ext: o.ext.gearExt || {}, frameArcs: [], hs: $("#aimmods").checked && w.cls !== "melee" ? 0.5 : 0 } });
    $("#runbtn").disabled = true; $("#progress").hidden = false; $("#progress .bar").style.width = "0%";
    const wk = freshWorker();
    wk.onmessage = (ev) => {
      if (ev.data.type === "progress") { $("#progress .bar").style.width = (ev.data.p * 100).toFixed(0) + "%"; return; }
      const out = {}; for (const x of ev.data.out) out[x.tag] = x.res;
      st.results = { res: out.main, nobuff: out.nobuff || null, free: out.free || null, o, owned, flags };
      // v1.90: auto evolutions are first picked with no mods (autoEvo) — Burston Prime got Reaver's Rapture (+100% damage with no
      // mods) where its crit build wants Absolute Valor. With the result in hand, climb the auto tiers keeping the #1 build and,
      // if that is faster, search once more with those evolutions (recommendations are the final form)
      if (!st.evoRetry) { const ns = betterEvo(out.main && out.main[0]); if (ns) { st.evoRetry = true; st.evoSel = ns; st.weapon = applyEvos(st.base, ns); renderEvoBox(); run(); return; } }
      st.evoRetry = false;
      if ($("#rivmode").value === "plan" && !w.noRiven && out.main && out.main.length) { planRivenPhase(wk, w, o, cands, jobs.some((j) => j.tag === "nobuff")); return; }
      $("#runbtn").disabled = false; $("#progress").hidden = true;
      renderResults();
      $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
      conceptPhase(wk, w, o, cands);
    };
    wk.onerror = (e) => { $("#runbtn").disabled = false; $("#progress").hidden = true; $("#results").innerHTML = `<div class="placeholder"><h3>계산 중 오류</h3><p>${esc(e.message)}</p></div>`; };
    wk.postMessage({ weapon: JSON.parse(JSON.stringify(w)), atk: st.atk, opts: o, cands, locked, beam: 100, valOptions: valOptions(), arcOptions: arcOptions(), riven: owned ? owned.eff : null, jobs, seeds: communitySeeds(w) });
  }

  // ④ element combinations: keep every other mod of the recommendation and re-pick only the element and physical-damage
  // mods for each concept (single, combined, combined + single, physical). Quick searches that run after the results show.
  const CONCEPT_SET = (() => {
    const singles = ["viral", "corr", "gas", "rad", "blast", "mag", "heat", "cold", "elec", "tox"].map((t) => [t]);
    const plus = { viral: ["heat", "elec"], corr: ["heat", "cold"], gas: ["cold", "elec"], rad: ["cold", "tox"], blast: ["elec", "tox"], mag: ["heat", "tox"] };
    return singles.concat(Object.entries(plus).flatMap(([c, xs]) => xs.map((x) => [c, x])), [["slash"], ["punct"], ["impact"]]);
  })();
  const ELEM_KEYS = new Set(["heat", "cold", "elec", "tox", "impact", "punct", "slash", "viralm", "corrm", "gasm", "radm", "blastm", "magm"]);
  const isElemMod = (id) => { const m = MOD_BY_ID[id]; if (!m) return false; return [m.eff || {}].concat((m.cond || []).map((c) => c.eff || {})).some((e) => Object.keys(e).some((k) => ELEM_KEYS.has(k))); };
  function conceptPhase(wk, w, o, cands) {
    const R = st.results; if (!R || !R.res || !R.res.length) return;
    const top = R.res[0];
    const locked = top.ids.filter((id) => !isElemMod(id));
    if (locked.length === top.ids.length) { R.concepts = []; updateConceptCard(); return; }
    const jobs = CONCEPT_SET.map((c, i) => ({ tag: "c" + i, locked, optsPatch: { concept: c, conceptOnly: true }, valOptions: [top.val], arcOptions: [top.arcane], beam: 30 }));
    R.concepts = null; R.conceptProg = 0; bgBusy = true; updateConceptCard();
    wk.onmessage = (ev) => {
      if (st.results !== R) return;
      if (ev.data.type === "progress") { R.conceptProg = ev.data.p; updateConceptCard(); return; }
      bgBusy = false;
      const out = {}; for (const x of ev.data.out) out[x.tag] = x.res;
      const ref = evalBuild(top.ids, top.val, top.arcane).score;
      R.concepts = CONCEPT_SET.map((c, i) => {
        const b = out["c" + i] && out["c" + i][0]; if (!b) return null;
        const oc = Object.assign({}, R.o, { concept: c, conceptOnly: true });
        const r = evalBuild(b.ids, b.val, b.arcane, oc);
        return { c, ids: b.ids, r, k: r.score / ref, ok: r.conceptOk !== false };
      }).filter(Boolean).sort((a, b) => (b.ok - a.ok) || (b.k - a.k));
      updateConceptCard();
    };
    wk.postMessage({ weapon: JSON.parse(JSON.stringify(w)), atk: st.atk, opts: o, cands, locked, beam: 30, valOptions: [top.val], arcOptions: [top.arcane], riven: R.owned ? R.owned.eff : null, jobs });
  }
  function conceptCardHtml() {
    const R = st.results, top = R.res[0];
    const head = `<h3>속성 조합별 최고 세팅 <small>원소·물리 모드만 바꾸고 나머지는 추천 그대로</small></h3>`;
    if (!R.concepts) return head + `<p class="hint" style="margin:0">계산 중… ${Math.round((R.conceptProg || 0) * 100)}% — 단일 원소 10종, 복합+단일 12종, 물리 3종을 하나씩 다시 짜고 있습니다.</p>`;
    if (!R.concepts.length) return head + `<p class="hint" style="margin:0">추천 세팅에 원소·물리 모드가 없어 비교할 조합이 없습니다.</p>`;
    const name = (c) => c.map((t) => TYPE_KO[t]).join(" + ");
    const maxK = Math.max(1, ...R.concepts.map((x) => x.k));
    return head + `<div class="tscroll"><table class="tbl ccmp"><thead><tr><th>속성 조합</th><th>처치 속도 <small>추천 = 100%</small></th><th>최종 속성</th><th>바뀐 모드</th></tr></thead><tbody>
      ${R.concepts.map((x) => `<tr${x.ok ? "" : ' class="no"'}><td><b>${name(x.c)}</b></td>
        <td class="num"><span class="cbar"><i style="width:${Math.min(100, (x.k / maxK) * 100).toFixed(0)}%"></i></span>${x.ok ? pct(x.k, 0) : "만들 수 없음"}</td>
        <td><small>${finalElements(x.r)}</small></td><td class="modlist">${x.ids.filter((id) => !top.ids.includes(id)).map((id) => `<span class="diff">${esc(modName(id))}</span>`).join("") || "<small>추천과 같음</small>"}</td></tr>`).join("")}
      </tbody></table></div>
      <p class="hint">"만들 수 없음"은 추천 세팅에서 원소·물리 모드가 차지한 칸 수 안에서는 그 속성을 충분히 넣지 못하는 조합입니다 (원소는 10% 이상이고 다른 원소 없이, 물리 하나만 고른 줄은 그 물리 속성이 가장 커야 함). 칸이 더 필요한 조합(예: 원소 모드가 1칸뿐인 세팅에서 바이러스 + 화염)도 여기서는 만들 수 없음으로 나옵니다. 칸 순서까지 반영한 계산이며, 원하는 조합으로 처음부터 다시 짜려면 왼쪽 "속성 콘셉트"에서 고르세요.</p>`;
  }
  // the auto (not hand-picked) evolution tiers re-chosen for a given build: coordinate climb, two passes, 0.5% to move
  function betterEvo(top) {
    const w = st.base; if (!w || !w.evos || !top || !st.results) return null;
    const sc = (sel) => evalBuild(top.ids, top.val, top.arcane, null, null, null, applyEvos(w, sel)).score;
    let sel = Object.assign({}, st.evoSel), best = sc(sel), changed = false;
    for (let pass = 0; pass < 2; pass++) for (const t of w.evos) {
      if (t.tier === 1 || t.perks.length < 2 || (st.evoManual && st.evoManual[t.tier])) continue;
      t.perks.forEach((p, i) => { if (i === sel[t.tier]) return; const s2 = Object.assign({}, sel, { [t.tier]: i }), v = sc(s2); if (v > best * 1.005) { best = v; sel = s2; changed = true; } });
    }
    return changed ? sel : null;
  }
  // Incarnon evolutions with the recommended build kept: each other perk of a tier, swapped in alone
  function evoCompareHtml(top, ref) {
    const w = st.base; if (!w || !w.evos) return "";
    const roman = ["", "I", "II", "III", "IV", "V"];
    const rows = [];
    for (const t of w.evos) {
      if (t.tier === 1 || t.perks.length < 2) continue;
      t.perks.forEach((p, i) => {
        const cur = st.evoSel[t.tier] === i;
        const k = cur ? 1 : evalBuild(top.ids, top.val, top.arcane, null, null, null, applyEvos(w, Object.assign({}, st.evoSel, { [t.tier]: i }))).score / ref;
        rows.push({ t: t.tier, i, p, k, cur, calc: p.items.some((it) => it.key) });
      });
    }
    const better = rows.filter((x) => !x.cur && x.k > 1.02).sort((a, b) => b.k - a.k)[0];
    return `<section class="card"><h3>인카논 진화 비교 <small>추천 모드 그대로 진화 하나만 바꿨을 때 (지금 선택 = 100%)</small></h3>
      ${better ? `<p class="warn">진화 ${roman[better.t]}를 <b>${better.i + 1}번 ${esc(better.p.name)}</b>(으)로 바꾸면 ×${better.k.toFixed(2)} 빨라집니다. <button type="button" class="ghostbtn" data-evo="${better.t}:${better.i}">이 진화로 다시 계산</button></p>` : ""}
      <div class="tscroll"><table class="tbl"><thead><tr><th>진화</th><th>효과</th><th>처치 속도</th></tr></thead><tbody>
      ${rows.map((x) => `<tr${x.cur ? ' class="rec"' : ""}><td><b>${roman[x.t]}-${x.i + 1}</b> ${esc(x.p.name)}${x.cur ? " <small>(선택)</small>" : ""}</td><td><small>${esc(x.p.items.map((it) => it.key ? it.ko : it.cond ? "조건부(계산 제외): " + it.ko : it.ko).join(" · "))}</small></td><td class="num">${x.calc || x.cur ? pct(x.k, 0) : "<small>계산 영향 없음</small>"}</td></tr>`).join("")}
      </tbody></table></div></section>`;
  }
  function updateConceptCard() { const el = document.getElementById("conceptcard"); if (el && st.results) el.innerHTML = conceptCardHtml(); }

  // "맞출 예정": after the riven-free search, give the build the best riven worth rolling (3 positives at the top of
  // their range (RIV_PLAN_W) + a harmless negative) and search the other slots again with it locked — so the recommendation and the
  // comparison table already include the riven
  function planRivenPhase(wk, w, o, cands, hadNobuff) {
    const R = st.results, top0 = R.res[0];
    const ref0 = evalBuild(top0.ids, top0.val, top0.arcane).score;
    const plan = rivenCombos(top0, ref0);
    R.rivPlan = plan; R.rivPlanTop = top0;
    const picks = [];
    for (const x of plan.out) { if (x.form !== "3+1") continue; const key = x.stats.slice().sort().join(); if (picks.some((p) => p.key === key)) continue; picks.push({ key, stats: x.stats }); if (picks.length >= 4) break; }
    if (!picks.length) { $("#runbtn").disabled = false; $("#progress").hidden = true; renderResults(); return; }
    const mult = 1.2 * RIV_PLAN_W * RIV_FORM["3+1"].pos, negBase = 1.2 * RIV_PLAN_W * Math.abs(RIV_FORM["3+1"].neg);
    const cls = modClass(w), neg = cls === "melee" ? "x_finisher" : "x_recoil";
    // the negative: whichever helps this build most (e.g. lower crit chance with a non-crit damage bonus), else a harmless one
    const negCands = RIV_DEF.filter((d) => rivFits(d, cls) && d.grp !== "splice" && d.k !== "ic" && d.eff !== null && d.k !== "x_ammo" && rivBaseOf(cls, d.k) > 0).map((d) => d.k);
    const negVal = (k) => -(RIV_D[k].negBase || rivBaseOf(cls, k)) * negBase;
    const rivs = picks.map((p) => {
      const info = p.stats.map((k) => ({ k, v: rivBaseOf(cls, k) * mult, inc: true }));
      const slot = (plan.out.find((x) => x.form === "3+1" && x.stats.slice().sort().join() === p.key) || {}).slot;
      const rest = top0.ids.filter((id) => id !== slot).concat(["__riven"]);
      const posPairs = info.map((x) => [x.k, x.v]);
      let nk = neg, best = evalBuild(rest, top0.val, top0.arcane, null, effFromStats(posPairs)).score * 1.0005;
      for (const k of negCands) {
        if (p.stats.includes(k)) continue;
        const sc = evalBuild(rest, top0.val, top0.arcane, null, effFromStats(posPairs.concat([[k, negVal(k)]]))).score;
        if (sc > best) { best = sc; nk = k; }
      }
      info.push({ k: nk, v: nk === neg ? -rivBaseOf(cls, neg) * negBase : negVal(nk), inc: true });
      return { eff: effFromStats(info.map((x) => [x.k, x.v])), info };
    });
    const jobs2 = [];
    // v1.96 (테넷 글랙시온): with the riven in, valence and arcane are picked again too — the riven-free #1 had Plated Round + Heat,
    // the riven build is faster with Merciless + Magnetic (the riven covers crit, so the other slots change)
    rivs.forEach((rv, i) => jobs2.push({ tag: "riv" + i, riven: rv.eff, locked: ["__riven"], valOptions: valOptions(), arcOptions: arcOptions(), beam: 70 }));
    $("#runbtn").textContent = "리벤을 넣은 전제로 다시 계산 중…"; $("#progress .bar").style.width = "0%";
    wk.onmessage = (ev) => {
      if (ev.data.type === "progress") { $("#progress .bar").style.width = (ev.data.p * 100).toFixed(0) + "%"; return; }
      $("#runbtn").disabled = false; $("#progress").hidden = true; $("#runbtn").textContent = "최적 세팅 계산";
      const out = {}; for (const x of ev.data.out) out[x.tag] = x.res;
      let bi = 0; rivs.forEach((_, i) => { if (out["riv" + i] && out["riv" + i][0] && (!out["riv" + bi] || out["riv" + i][0].score > out["riv" + bi][0].score)) bi = i; });
      if (out["riv" + bi] && out["riv" + bi].length) R.rivBest = { top: out["riv" + bi][0], riv: rivs[bi] };
      R.rivAlts = rivs.map((rv, i) => out["riv" + i] && out["riv" + i][0] ? { riv: rv, top: out["riv" + i][0] } : null).filter(Boolean);
      renderResults();
      $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
      conceptPhase(wk, w, o, cands);
    };
    wk.postMessage({ weapon: JSON.parse(JSON.stringify(w)), atk: st.atk, opts: o, cands, locked: [], beam: 70, valOptions: valOptions(), arcOptions: arcOptions(), riven: null, jobs: jobs2 });
  }

  /* ---------------- evaluation helpers ---------------- */
  function evalBuild(ids, val, arcane, oOverride, rivEff, elemOrder, wOverride) {
    const w = wOverride || st.weapon, atk = w.attacks[st.atk];
    // shown speeds are real speeds: the element concept only steers the element layout here, it never scales the score
    const o = Object.assign({}, oOverride || st.results.o, { val, arcane, elemOrder: elemOrder || null, layoutTTK: true, conceptPenalty: false });
    const mods = ids.map((id) => id === "__riven" ? { id: "__riven", eff: rivEff || (st.results.owned ? st.results.owned.eff : {}) } : MOD_BY_ID[id]);
    return E.evaluate(w, atk, mods, o);
  }
  const modName = (id) => id === "__riven" ? "리벤 모드" : (MOD_BY_ID[id] ? MOD_BY_ID[id].ko : id);

  /* ---------- arsenal-style mod cards (in-game look: rarity frame, drain + polarity tab, rank pips) ---------- */
  // polarity glyphs traced from the in-game arsenal filter icons (24×24, filled)
  const POL_D = {
    madurai: "M5 2.5h4.6v13.2L17.4 4l3.4 2.3L9.4 21.5H5z",
    vazarin: "M2.5 4h17.6c1.2 0 1.8.9 1.5 2C20.2 11.7 17.7 17 14.6 21.5L2.5 4zm6 3.2 5.6 8.4c1.2-2.4 2.3-5.2 3-8.4z",
    naramon: "M2.5 7.5h4.4v3.6h14.6v4.6H2.5z",
    zenurik: "M3 3.5h18v3.6L10.4 16.9H21v3.6H3v-3.6L13.6 7.1H3z",
    unairu: "M2.5 3.5h4.2l5.3 6.6 5.3-6.6h4.2L14.2 13v8h-4.4v-8z",
    penjaga: "M12 2.5 21 6.5v5.2c0 4.8-3.8 8.4-9 9.8-5.2-1.4-9-5-9-9.8V6.5zm0 4.2-5 2.2v2.8c0 2.8 2 5 5 6.1 3-1.1 5-3.3 5-6.1V8.9z",
    umbra: "M12 2.5 22 20H2zm0 6.4L7.6 17h8.8z",
    any: "M12 2.5 21.5 12 12 21.5 2.5 12zm0 5L7.5 12l4.5 4.5 4.5-4.5z",
  };
  const polSvg = (p, cls) => `<svg class="pol${cls ? " " + cls : ""}" viewBox="0 0 24 24" aria-hidden="true"><path d="${POL_D[p === "*" || p === "riven" ? "any" : p] || POL_D.any}"/></svg>`;
  const EXI_SVG = `<svg class="pol exi" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5 3.5 12 8 19h3l-4.5-7L11 5zm5 0 4.5 7-4.5 7h3l4.5-7L16 5zm-1 4.2 3 3.6h-2v2.4h-2v-2.4H9z"/></svg>`;
  // rarity frame: c bronze · u silver · r gold · l primed · gal galvanized · riv riven
  function modFrame(id) {
    if (id === "__riven") return "riv";
    const m = MOD_BY_ID[id];
    if (!m) return "u";
    if (/^Galvanized /.test(m.en || "")) return "gal";
    if (/^(Primed |Archon |Umbral |Sacrificial )/.test(m.en || "")) return "l";
    return m.rarity || "u";
  }
  const ORN = { c: "◆", u: "◆◇◆", r: "◆◆◆", l: "◇◆◇◆◇", gal: "◆", riv: "◆◆" };
  // one card: { id, n, plan entry, exilus, suggested }
  function modCardHtml(id, n, a, opt) {
    const m = MOD_BY_ID[id], fr = modFrame(id);
    const ranks = id === "__riven" ? 8 : m && m.maxRank != null ? m.maxRank : 5;
    const dcls = !a ? "neu" : a.how === "bad" ? "bad" : a.how === "neutral" ? "neu" : "ok";
    const dPol = a ? (a.pol === "*" ? a.slot || "any" : a.pol) : (m && m.pol) || "";
    const polT = !a ? "" : a.how === "match" ? `${polKo(a.slot)} 칸 — 극성이 같아 용량 절반` : a.how === "forma" ? `${polKo(a.pol === "*" ? "riven" : a.pol)} 포르마 필요 — 극성을 맞춰 용량 절반`
      : a.how === "bad" ? `${polKo(a.slot)} 칸 — 극성이 달라 용량 25% 증가` : "극성 없는 칸 — 용량 그대로";
    return `<div class="mc f-${fr}${opt && opt.exilus ? " xc" : ""}${opt && opt.sugg ? " sugg" : ""}" title="${esc(modName(id) + (polT ? " · " + polT : ""))}">
      ${n != null ? `<i class="mc-n">${n}</i>` : ""}
      <span class="mc-orn">${opt && opt.exilus ? EXI_SVG : ORN[fr] || "◆"}</span>
      ${a || (m && m.drain != null) ? `<span class="mc-dr ${dcls}">${a ? a.cost : m.drain}${dPol ? polSvg(dPol) : ""}</span>` : ""}
      ${a && a.how === "bad" && a.slot ? `<span class="mc-flag" title="이 칸의 극성: ${polKo(a.slot)}">${polSvg(a.slot)}</span>` : ""}
      <b class="mc-name">${esc(modName(id))}</b>
      <span class="mc-rk">${"★".repeat(Math.min(10, ranks))}</span>
    </div>`;
  }
  // the whole arsenal block for a build: capacity bar, 8 cards, arcane + exilus column. info(id) → html under each card
  function arsenalHtml(o2) {
    const { ids, order, xid, xSugg, arcane, plan, info, melee } = o2;
    const asg = {}; for (const a of (plan && plan.asg) || []) asg[a.id] = a;
    const remain = plan ? plan.cap - plan.drain : 0;
    const cnt = {}; for (const x of (plan && plan.formaPols) || []) { const k = x.replace(/^exilus:/, ""); cnt[k] = (cnt[k] || 0) + 1; }
    const fTxt = plan && plan.forma ? `포르마 ${plan.forma}개 — ${Object.entries(cnt).map(([k, c]) => `${polKo(k)} ${c}`).join(", ")}` : "포르마 없이 기본 극성 그대로";
    const cell = (id, n, opt) => `<div class="acell">${modCardHtml(id, n, asg[id], opt)}<div class="ainfo">${info(id) || ""}</div></div>`;
    const arcCell = `<div class="acell"><div class="arcc${arcane ? "" : " none"}"><span class="arc-em" aria-hidden="true"></span><b>${arcane ? esc(ARC[arcane].ko) : "아케인 없음"}</b>${arcane ? `<span class="arc-rk">◆◆◆◆◆</span>` : ""}</div><div class="ainfo">${info("__arcane") || ""}</div></div>`;
    const exId = xid || xSugg;
    const exCell = exId ? cell(exId, null, { exilus: true, sugg: !xid }) : `<div class="acell"><div class="mc xc empty"><span class="mc-orn">${EXI_SVG}</span><b class="mc-name">익실러스 자유</b></div><div class="ainfo">${info("__exilus") || ""}</div></div>`;
    const stance = melee ? `<div class="acell"><div class="mc empty"><b class="mc-name">스탠스</b><span class="mc-rk">계산 제외</span></div><div class="ainfo"><small class="aalt">아무거나 · 같은 극성이면 용량 +10</small></div></div>` : "";
    return `<div class="ars arsenal">
      <div class="acap${plan && !plan.fits ? " over" : ""}"><span class="acap-l">수용량</span><b>${plan ? remain : "-"}/${plan ? plan.cap : "-"}</b><i class="acap-bar"><i style="width:${plan ? Math.max(0, Math.min(100, (remain / plan.cap) * 100)).toFixed(1) : 0}%"></i></i><small>${fTxt}</small></div>
      <div class="agrid"><div class="amods">${order.map((x, i) => cell(x.id, i + 1)).join("")}</div>
      <div class="aside">${arcCell}${exCell}${stance}</div></div>
    </div>`;
  }
  function finalElements(r) {
    const one = (share) => Object.entries(share).filter(([, v]) => v > 0.02).sort((a, b) => b[1] - a[1]).map(([t, v]) => `${TYPE_KO[t] || t} ${pct(v)}`).join(" · ");
    // a shot with a direct hit and a blast: each part combines elements on its own (the blast gets the weapon's innate element)
    const ps = (r.parts || []).filter((p) => !p.bounce);
    if (ps.length > 1 && ps.some((p) => p.kind === "radial")) return ps.map((p) => `${p.kind === "radial" ? "폭발" : "직격"} ${one(p.share)}`).join(" / ");
    return one(r.share);
  }
  // elements a mod brings, in the order the game reads them (riven: last listed stat first — wiki "Elemental Damage")
  function elemOf(id, rivInfo) {
    if (id === "__riven") {
      const info = rivInfo || (st.results && st.results.owned ? st.results.owned.info : []);
      return info.filter((x) => x.inc && E.PRIM.includes(x.k) && x.v > 0).map((x) => x.k).reverse();
    }
    const m = MOD_BY_ID[id]; if (!m) return [];
    return E.PRIM.filter((p) => (m.eff || {})[p] > 0);
  }
  // first-appearance element order of a build typed slot by slot (slot 1 = top-left in the arsenal)
  function elemOrderOf(ids, rivInfo) {
    const out = [];
    for (const id of ids) for (const p of elemOf(id, rivInfo)) if (!out.includes(p)) out.push(p);
    return out;
  }
  function orderMods(ids, r, rivInfo) {
    const L = r.layout || {};
    const elemOf_ = (id) => elemOf(id, rivInfo);
    const used = new Set(), groups = [];
    for (const pair of L.pairs || []) {
      const t = E.COMBO[pair[0] + "|" + pair[1]];
      const g = ids.filter((id) => !used.has(id) && elemOf_(id).some((p) => pair.includes(p)));
      g.forEach((id) => used.add(id));
      if (g.length) groups.push({ label: `${TYPE_KO[pair[0]]} + ${TYPE_KO[pair[1]]} → ${TYPE_KO[t]}`, ids: g });
    }
    for (const s of L.singles || []) {
      const g = ids.filter((id) => !used.has(id) && elemOf_(id).includes(s));
      g.forEach((id) => used.add(id));
      const mp = L.mp || {};
      const pt = (L.partner || {})[s];
      const withWhat = !pt ? "" : pt.src === "shard" ? `보라 샤드 ${josa(TYPE_KO[pt.type], "과", "와")} 합쳐져` : pt.src === "val" ? `베일런스 ${josa(TYPE_KO[pt.type], "과", "와")} 합쳐져` : `무기 고유 ${TYPE_KO[pt.type]} 속성과 합쳐져`;
      if (g.length) groups.push({ label: `${TYPE_KO[s]} 단독${mp[s] && mp[s] !== s ? ` → ${withWhat} ${TYPE_KO[mp[s]]}` : ""}`, ids: g });
    }
    const rest = ids.filter((id) => !used.has(id));
    if (rest.length) groups.push({ label: "그 외 (순서 무관)", ids: rest });
    return groups;
  }
  const kv = (k, v) => `<div class="kvi"><span>${k}</span><b>${v}</b></div>`;
  // mod capacity of a build: drain / capacity and the forma it needs (engine.capacityPlan)
  // the slot plan the cards show: within the forma limit when it fits, otherwise the fewest forma that would
  function capPlan(ids) {
    const mods = ids.map((id) => id === "__riven" ? { id: "__riven", eff: {} } : MOD_BY_ID[id]).filter(Boolean);
    const lim = $("#forma").value === "" ? null : +$("#forma").value;
    const p = E.capacityPlan(st.weapon, mods, lim);
    return p.fits || lim == null ? p : E.capacityPlan(st.weapon, mods, null);
  }
  function capInfo(ids, rivEff) {
    const mods = ids.map((id) => id === "__riven" ? { id: "__riven", eff: rivEff || {} } : MOD_BY_ID[id]).filter(Boolean);
    const lim = $("#forma").value === "" ? null : +$("#forma").value;
    const p = E.capacityPlan(st.weapon, mods, lim), pAny = lim == null ? p : E.capacityPlan(st.weapon, mods, null);
    const cnt = {}; for (const x of (p.fits ? p : pAny).formaPols) { const k = x.replace(/^exilus:/, ""); cnt[k] = (cnt[k] || 0) + 1; }
    const pols = Object.entries(cnt).map(([k, n]) => `${polKo(k)} ${n}`).join(", ");
    if (p.fits) return { ok: true, short: `용량 ${p.drain}/${p.cap} · 포르마 ${p.forma}개`, text: `모드 용량 <b>${p.drain}/${p.cap}</b> · 포르마 <b>${p.forma}개</b>${p.forma ? ` (${pols} 극성으로)` : " (기본 극성 그대로)"}` };
    if (pAny.fits) return { ok: false, short: `포르마 ${pAny.forma}개 필요`, text: `포르마 한도(${lim}개)로는 용량 초과 — <b>포르마 ${pAny.forma}개</b>(${pols}) 필요` };
    return { ok: false, short: "용량 초과", text: `모든 칸에 포르마를 해도 용량 초과 (${pAny.drain}/${pAny.cap}) — 실제로는 장착 불가` };
  }
  const pctDelta = (x) => { const d = (x - 1) * 100; return (d >= 0 ? "+" : "") + d.toFixed(1) + "%"; };
  const diffMods = (ids, base) => ids.map((id) => `<span class="${base.includes(id) ? "same" : "diff"}">${esc(modName(id))}</span>`).join("");

  const oneLvTxt = (lv) => lv >= 9999 ? "9999+" : lv > 0 ? `${lv}레벨까지` : "안 됨";
  function ttkTable(r, o) {
    const cell = (x) => `${x.one ? "한 방" : sec(x.ttk)}${x.targetHeavy ? ` / ${x.oneHeavy ? "한 방" : sec(x.ttkHeavy)}` : ""}${o.scenario === "crowd" ? `<br><small>12명 전멸 ${sec(x.clear)}</small>` : ""}`;
    const L = E.levelsOf(o);
    return `<div class="tscroll"><table class="tbl ttk"><thead><tr><th>팩션 · 기준 적</th><th>${L[0]}레벨</th><th>${L[1]}레벨</th><th>${L[2]}레벨 (버티기)</th><th>한 방 유지</th></tr></thead><tbody>
      ${o.factions.map((f) => { const x = r.perF[f]; return `<tr><td>${E.FACTIONS[f].label} · ${esc(x.target.ko)}${x.targetHeavy ? " / " + esc(x.targetHeavy.ko) : ""}<br><small>${o.level}레벨 체력 ${fmt(x.target.hp)}${x.target.sh ? " · 실드 " + fmt(x.target.sh) : ""}${x.target.ar ? " · 방어구 " + x.target.ar.toFixed(0) : ""}${x.target.og ? " · 오버가드 " + fmt(x.target.og) : ""}${x.targetHeavy ? " / 체력 " + fmt(x.targetHeavy.hp) : ""}</small></td><td class="num">${cell(x)}</td><td class="num">${cell(x.hi)}</td><td class="num">${cell(x.top)}</td><td class="num">${oneLvTxt(x.oneLv)}</td></tr>`; }).join("")}
    </tbody></table></div><p class="hint">"한 방"은 첫 공격의 피해만으로 죽는다는 뜻입니다 — 그 공격이 건 바이러스·부식 같은 상태이상은 피해가 들어간 뒤에 걸려서 다음 공격부터 적용되고(위키), 도트도 넣지 않습니다. "한 방 유지"는 ${o.scenario === "boss" ? "보스" : "중장갑"}을 한 방에 잡는 가장 높은 레벨입니다. 잡몹 무리는 "잡몹 / 섞여 있는 중장갑" 순서입니다.</p>`;
  }

  /* ---------------- results ---------------- */
  // A mechanic the wiki documents but leaves a number out of (Dual Ichor's on-kill field: no tick interval) is computed at both
  // ends of its range. The pick is shown only if it stays first at both; otherwise the recommendation is withheld (user rule
  // 2026-11-04: "결함이 있는 세팅을 추천한다고 보이지 말라").
  // Unverified assumptions, each computed at its other end too:
  //  - fieldHigh: on-kill field ticks every second (wiki gives no interval)
  // Settled by an in-game test, no longer checked here (v1.78): the heavy / Tennokai combo multiplier DOES reach status damage.
  //   Simulacrum 2026-11-06, Dual Ichor without damage mods: a 12x heavy's main hit (4.7K = 305 x 12 x 1.282) left Slash ticks of
  //   1.3K = 0.35 x 305 x 12; a 3x heavy in Incarnon Form (7.0K crit = 305 x 3 x 2 x 1.282 x 3) left 641 = 0.35 x 305 x 3 x 2.
  //   Without the combo multiplier those ticks would be 107 and 214. (o.noComboStatus stays in the engine for regress only.)
  function boundAlts(w, atk, o) {
    const alts = [];
    // v1.80 (independent review 2026-11-06): melee swing + Tennokai model choices nobody has measured yet
    if (atk && atk.kind === "melee") {
      alts.push({ o: { noPool: true }, why: "휘두르기와 텐노카이 강공을 한 방 평균으로 계산(기본) / 따로 계산 — 평균을 내면 12배 텐노카이 피해가 휘두르기마다 들어가 한 방 처치가 늘어남" });
      alts.push({ o: { tennoAdd: true }, why: "텐노카이 피해 보너스(마스터즈 엣지 등)가 별도 배율(기본) / 근접 피해(프레셔 포인트)와 합연산 — 위키 확인 안 됨" });
      // settled in game (v1.82, Simulacrum 2026-11-06): Tennokai opportunities count swings, not enemies hit — with 1 enemy the next
      // opportunity came 0.8-1.0 s (counter +2) after a Tennokai, with 20 enemies 1.0-1.6 s (counter +6/+7); per enemy hit it
      // would have come after one or two swings in the crowd (o.tennoPerHit stays in the engine for regress only)
      if (w.attacks.some((q) => q.evoScaleAlt)) alts.push({ o: { evoHeavyScale: true }, why: "진화 '기본 피해 +X'가 강공에 그대로 X만 더해짐(기본) / 휘두르기와 같은 비율로 커짐(강공 = 기본 피해 × 5) — 위키 확인 안 됨" });
    }
    // v1.88: beam-end AoE on the struck enemy too (default) / only the AoE part removed — wiki weapon pages don't say
    if (atk && (atk.parts || []).some((q) => q.beamAoe)) alts.push({ o: { noBeamAoe: true }, why: "빔 끝점 범위 피해를 빔에 맞은 적도 받는지 위키에 없음 — 받음(기본) / 안 받음" });
    // v1.95 (independent review 2026-11-07): Cedo priming — whether the glaive's statuses are already on an enemy before the primary
    // fire's first hit isn't on the wiki
    if (atk && atk.primerAoe) alts.push({ o: { noPrimerFirst: true }, why: "글레이브로 묻힌 상태이상이 기본 사격 첫 발 전에 이미 걸려 있는지 위키에 없음 — 걸려 있음(기본) / 없음" });
    if (atk && atk.killField && !atk.killField.every && o.scenario === "crowd") alts.push({ o: { fieldHigh: true }, why: `처치 시 장판(${atk.killField.dmg} 피해, ${atk.killField.dur}초)이 몇 초마다 들어가는지 위키에 없음 — 한 번 / 1초마다` });
    // v1.86 (independent review 2026-11-06, Kuva Zarr): between one-shot kills a gunner needs time to put the crosshair on the next
    // enemy. No source gives it (engine T_ACQ = 0.2 s); when most enemies die to one shot it decides how much fire rate is worth,
    // so the pick has to hold from 0.15 s to 0.3 s
    if (atk && w.slot !== "melee" && o.scenario === "crowd") {
      alts.push({ o: { tAcq: 0.15 }, key: "tAcq", why: "한 방에 죽인 뒤 다음 적에게 조준을 옮기는 시간이 근거 없는 가정(0.2초) — 0.15초로 짧을 때" });
      alts.push({ o: { tAcq: 0.3 }, key: "tAcq", why: "한 방에 죽인 뒤 다음 적에게 조준을 옮기는 시간이 근거 없는 가정(0.2초) — 0.3초로 길 때" });
    }
    return alts;
  }
  function boundCheck(R) {
    const w = st.weapon, atk = w.attacks[st.atk];
    if (!atk) return null;
    const alts = boundAlts(w, atk, R.o);
    if (!alts.length) return null;
    // v1.84 (independent review 2026-11-06): re-scoring only the search's own list missed builds one swap away — Dual Ichor with
    // Discipline's Merit instead of Master's Edge was 12% ahead when swings and Tennokai are counted apart, and it wasn't in the
    // list. Under each assumption (and all of them flipped together) the check now also climbs from the #1 by single swaps of a
    // mod (same slot kind, no clashes) or of the arcane, two rounds, and compares the best it finds.
    const flips = alts.filter((a) => !a.key);   // two-sided ranges (re-aim time) stay out of the all-flipped combination
    if (flips.length > 1) alts.push({ o: Object.assign({}, ...flips.map((a) => a.o)), why: "위 가정을 모두 반대쪽으로 놓았을 때" });
    const K = Math.min(30, R.res.length), outs = [];
    const cands = candidateMods(w, atk, R.flags || {}).filter((m) => !m.manual);
    const arcs = [...new Set(R.res.slice(0, K).map((x) => x.arcane))];
    const okIds = (ids) => { const ms = ids.filter((x) => x !== "__riven").map((x) => MOD_BY_ID[x]); for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) if (E.clash(ms[i], ms[j])) return false; return true; };
    const same = (x, y) => x.arcane === y.arcane && x.ids.length === y.ids.length && x.ids.every((id) => y.ids.includes(id));
    for (const a of alts) {
      const oX = Object.assign({}, R.o, a.o);
      const S = (x) => evalBuild(x.ids, x.val, x.arcane, oX).score;
      const sc = R.res.slice(0, K).map(S);
      let bi = 0; for (let i = 1; i < K; i++) if (sc[i] > sc[bi]) bi = i;
      let best = { ids: R.res[bi].ids, val: R.res[bi].val, arcane: R.res[bi].arcane, s: sc[bi] };
      let cur = { ids: R.res[0].ids, val: R.res[0].val, arcane: R.res[0].arcane, s: sc[0] };
      for (let round = 0; round < 2; round++) {
        let nb = null;
        cur.ids.forEach((id, i) => {
          if (id === "__riven" || !MOD_BY_ID[id]) return;
          const ex = !!MOD_BY_ID[id].exilus;
          for (const c of cands) {
            if (!!c.exilus !== ex || cur.ids.includes(c.id)) continue;
            const t = cur.ids.slice(); t[i] = c.id;
            if (!okIds(t)) continue;
            const s = S({ ids: t, val: cur.val, arcane: cur.arcane });
            if (!nb || s > nb.s) nb = { ids: t, val: cur.val, arcane: cur.arcane, s };
          }
        });
        for (const ar of arcs) if (ar !== cur.arcane) { const s = S({ ids: cur.ids, val: cur.val, arcane: ar }); if (!nb || s > nb.s) nb = { ids: cur.ids, val: cur.val, arcane: ar, s }; }
        if (!nb || nb.s <= cur.s * 1.001) break;
        cur = nb;
      }
      if (cur.s > best.s) best = cur;
      outs.push({ bi: same(best, R.res[0]) ? 0 : 1, gain: best.s / Math.max(1e-12, sc[0]), alt: best, why: a.why });
    }
    const bad = outs.filter((x) => x.bi !== 0 && x.gain > 1.02);
    return { bad, all: outs };
  }

  // Documented mechanics the engine doesn't have yet (wiki audit 2026-11-05, docs/mechanics/gaps_*.json, attached by convert.py):
  // if one touches the chosen attack, the recommendation is withheld instead of shown with a hole in it (user rule 2026-11-04).
  const GAP_TYPE = { chain: "연쇄·튕김", ricochet: "도탄", field: "장판·구름", "on-kill": "처치 시 효과", "stacking-buff": "중첩 버프", "special-multiplier": "특수 배율",
    "secondary-projectile": "추가 투사체", "punch-through-rule": "관통 규칙", "beam-radius": "빔 피해 반경", combo: "연속기 규칙", other: "기타" };
  function openGaps(R) {
    const w = st.weapon, atk = w.attacks[st.atk], g = w.gaps || (st.base && st.base.gaps) || [];
    if (!g.length || !atk) return [];
    const melee = w.slot === "melee";
    const cat = melee ? (atk.kind === "glaive" ? "throw" : /Slam/.test(atk.en || "") ? "slam" : atk.kind === "heavy" ? "heavy" : "normal")
      : (/Incarnon/.test(atk.en || "") ? "incarnon" : /Alt|Held|Secondary/.test(atk.en || "") ? "alt" : /Charged/.test(atk.en || "") ? "charged" : "normal");
    const top = R.res && R.res[0], tenno = melee && top && top.ids.some((id) => MOD_BY_ID[id] && MOD_BY_ID[id].eff && MOD_BY_ID[id].eff.tenno);
    return g.filter((x) => x.cat === "all" || x.cat === cat || (cat === "normal" && tenno && x.cat === "heavy"));
  }

  function renderResults() {
    const R = st.results, res = R.res, o = R.o;
    if (!res || !res.length) { $("#results").innerHTML = `<div class="placeholder"><h3>결과 없음</h3></div>`; return; }
    // 2026-11-07 사용자 결정: 보류하지 않고 지금 계산대로 1위를 보여 줌 — 계산에 없는 메커니즘·양쪽 가정은 참고 메모로만
    const gaps = openGaps(R);
    let noteHtml = "";
    if (gaps.length) {
      noteHtml += `<section class="card note"><h3>참고 — 계산에 아직 없는 메커니즘 ${gaps.length}개</h3>
        <p class="muted">${esc(st.weapon.ko)}의 이 공격에는 위키에 적힌 고유 메커니즘 중 계산기에 아직 들어가지 않은 것이 있습니다. 아래 추천은 이것을 빼고 지금 계산대로 낸 1위입니다.</p>
        <ul>${gaps.map((x) => `<li><b>${esc(GAP_TYPE[x.type] || x.type)}</b> · ${esc(x.atk || "")}${x.stated ? "" : " (위키에 수치 일부 없음)"}<br><span class="muted">${esc(x.q)}</span></li>`).join("")}</ul></section>`;
    }
    const bc = boundCheck(R);
    if (bc && bc.bad.length) {
      const lst = (x) => x.ids.map((id) => esc(id === "__riven" ? "리벤" : (MOD_BY_ID[id] || { ko: id }).ko)).join(" · ") + (x.arcane ? " · 아케인 " + esc(((window.WF_ARCANES || {})[x.arcane] || { ko: x.arcane }).ko) : "");
      noteHtml += `<section class="card note"><h3>참고 — 위키로 확인 안 된 가정</h3>
        <p class="muted">아래 가정은 위키에 답이 없어 양쪽으로 계산했습니다. 추천은 계산기 기본 가정의 1위이고, 반대쪽 가정이면 1위가 다음처럼 바뀝니다.</p>
        <ul>${bc.bad.map((x) => `<li><b>${esc(x.why)}</b><br>반대쪽 가정의 1위(${((x.gain - 1) * 100).toFixed(0)}% 빠름): ${lst(x.alt)}</li>`).join("")}</ul></section>`;
    }
    const top = res[0];
    const r = evalBuild(top.ids, top.val, top.arcane);
    const xid = top.ids.find((id) => MOD_BY_ID[id] && MOD_BY_ID[id].exilus);
    const groups = orderMods(top.ids.filter((id) => id !== xid), r);
    const ref = r.score;
    const atk = st.weapon.attacks[st.atk];
    const buffNames = buffSummary();
    const rm0 = $("#rivmode").value;
    const xa = exilusAdvice(xid, r, atk, top);
    let html = shareBarHtml() + noteHtml;
    try { if (/github\.io$/.test(location.hostname)) history.replaceState(null, "", "#s=" + b64e(JSON.stringify(captureState()))); } catch (e) {}

    // per-slot importance: how much slower the build gets without that mod, and the best mod to put there instead
    const imp = {};
    top.ids.forEach((id, i) => {
      const rest = top.ids.filter((_, j) => j !== i);
      const rem = evalBuild(rest, top.val, top.arcane).score / ref;
      let alt = null;
      const isX = MOD_BY_ID[id] && MOD_BY_ID[id].exilus;
      if (id !== "__riven") for (const c of candidateMods(st.weapon, atk, R.flags)) {
        if (!!c.exilus !== !!isX || top.ids.includes(c.id)) continue;
        if (rest.some((x) => E.clash(c, MOD_BY_ID[x]))) continue;
        const sc = evalBuild(rest.concat([c.id]), top.val, top.arcane).score / ref;
        if (!alt || sc > alt.s) alt = { id: c.id, s: sc };
      }
      imp[id] = { d: rem - 1, alt };
    });
    const arcD = top.arcane ? evalBuild(top.ids, top.val, null).score / ref - 1 : 0;
    const maxD = Math.max(0.01, ...Object.values(imp).map((x) => -x.d), -arcD);
    const bar = (d) => `<span class="aimp"><i style="width:${Math.max(2, Math.min(100, (-d / maxD) * 100)).toFixed(0)}%"></i></span><small class="ad">빼면 <b>${pctDelta(1 + d)}</b></small>`;
    const order = groups.flatMap((g) => g.ids.map((id) => ({ id, g })));
    const legend = groups.filter((g) => g.label !== "그 외 (순서 무관)").map((g) => {
      const nums = g.ids.map((id) => order.findIndex((x) => x.id === id) + 1);
      return `<span class="lg"><b>${nums.join("·")}번</b> ${g.label}</span>`;
    }).join("");
    const melee = st.weapon.slot === "melee" && !st.weapon.pseudo;
    // suggested (no-effect) exilus mod counts toward capacity when it still fits
    let planIds = top.ids, plan = capPlan(top.ids);
    if (!xid && xa.id) { const p2 = capPlan(top.ids.concat([xa.id])); if (p2.fits || !plan.fits) { planIds = top.ids.concat([xa.id]); plan = p2; } }
    const elOf = {}; for (const x of order) elOf[x.id] = x.g.label === "그 외 (순서 무관)" ? "" : x.g.label;
    const asgOf = {}; for (const a of plan.asg || []) asgOf[a.id] = a;
    const info = (id) => {
      if (id === "__arcane") return top.arcane ? bar(arcD) : `<small class="aalt">무기 아케인 없음</small>`;
      if (id === "__exilus") return `<small class="aalt">처치 속도 영향 없음</small>`;
      if (!xid && id === xa.id) return `<small class="aalt">처치 속도 영향 없음 · ${esc(xa.short || "추천")}</small>`;
      const v = imp[id], a = asgOf[id];
      return `${elOf[id] ? `<span class="atag2">${esc(elOf[id])}</span>` : ""}${v ? bar(v.d) : ""}${v && v.alt ? `<small class="aalt">대신 ${esc(modName(v.alt.id))} ${pctDelta(v.alt.s)}</small>` : ""}${a && a.how === "forma" ? `<small class="aforma">${polSvg(a.pol)} ${a.pol === "*" ? "리벤 극성" : polKo(a.pol)} 포르마</small>` : ""}`;
    };
    // one-line concept: damage style, elements, key mods, enemies per attack, one-hit level
    const keyMods = Object.entries(imp).filter(([id]) => !(MOD_BY_ID[id] && MOD_BY_ID[id].exilus)).sort((a, b) => a[1].d - b[1].d).slice(0, 2).map(([id]) => modName(id));
    const statPer = r.sc * (atk.kind === "gun" || atk.kind === "radial" ? r.ms || 1 : 1);
    const style = r.cc >= 0.5 && statPer >= 0.8 ? "치명타 + 상태이상" : r.cc >= 0.5 ? "치명타 중심" : statPer >= 0.8 ? "상태이상 중심" : "기본 피해 중심";
    const keff = o.scenario === "crowd" ? Math.max(r.K, r.perF[o.factions[0]].Keff || 0) : 0;
    const oneMin = Math.min(...o.factions.map((f) => r.perF[f].oneLv));
    const chips = [style, `핵심 모드 ${keyMods.join(" · ")}`, keff >= 1.5 ? `한 번에 ${keff.toFixed(1)}명` : null,
      `${o.scenario === "boss" ? "보스" : "중장갑"} 한 방 ${oneMin >= 9999 ? "9999레벨+" : oneMin > 0 ? `~${oneMin}레벨` : "안 됨"}`].filter(Boolean);
    const sec = (n, title, sub, body, id) => `<div class="sec" id="${id}"><h2 class="sech"><span class="secn">${n}</span>${title}${sub ? `<small>${sub}</small>` : ""}</h2>${body}</div>`;

    let h1 = `<section class="card hero"><div class="eyebrow">${esc(st.weapon.ko)} · ${esc(atk.name)}</div>
      <h2>${finalElements(r)}</h2>
      <div class="cchips">${chips.map((c) => `<span>${esc(c)}</span>`).join("")}</div>
      <div class="meta">${o.concept && o.concept.length ? `속성 콘셉트 <b>${o.concept.map((t) => TYPE_KO[t]).join(" + ")}</b>${o.conceptOnly ? " (이 속성만)" : ""} · ` : ""}${top.val ? `베일런스 <b>${TYPE_KO[top.val.type]} ${pct(top.val.pct)}</b> · ` : ""}${buffNames.length ? `버프 <b>${esc(buffNames.join(", "))}</b>` : "워프레임 버프 없음 (범용)"}</div>
      ${r.conceptOk === false ? `<p class="warn">고른 속성 콘셉트(${o.concept.map((t) => TYPE_KO[t]).join(" + ")})를 만족하는 세팅을 찾지 못해, 가장 빠른 세팅을 보여 드립니다. 이 무기·공격으로는 그 속성을 충분히 넣을 수 없습니다.</p>` : ""}
      ${arsenalHtml({ ids: top.ids, order, xid, xSugg: xid ? null : xa.id, arcane: top.arcane, plan, info, melee })}
      ${legend ? `<div class="alegend">원소 순서 ${legend}</div>` : ""}
      <p class="capline">${capInfo(planIds).text}<small> · 오로킨 카탈리스트·모드 최대 랭크 기준${!xid && xa.id && planIds.includes(xa.id) ? ", 추천 익실러스 포함" : ""}${melee ? ", 같은 극성 스탠스 +10" : ""}${top.ids.includes("__riven") ? ", 리벤 18 (극성은 맞춘다고 가정)" : ""}</small></p>
      <p class="hint">칸 번호는 게임 모드 화면 순서(윗줄 왼쪽→오른쪽, 그다음 아랫줄)입니다. 카드 오른쪽 위 숫자는 극성을 적용한 용량입니다 — <b class="dr-ok">초록</b>은 칸 극성과 같아 절반, <b class="dr-bad">빨강</b>은 극성이 달라 25% 증가(옆 깃발이 그 칸의 극성), 흰색은 극성 없는 칸. 수용량은 게임처럼 남은 용량/전체 용량입니다. 막대는 그 칸을 비웠을 때 느려지는 정도, "대신"은 그 칸에 넣을 수 있는 차선 모드와 그때의 처치 속도입니다. ${xa.why ? esc(xa.why) + " " : ""}${o.aim ? "조준·헤드샷 조건 모드는 헤드샷 50%를 가정했습니다." : ""}</p>
      ${ttkTable(r, o)}
    </section>`;
    let h3 = "", h4 = `<section class="card" id="conceptcard">${conceptCardHtml()}</section>`, h5 = "";
    h4 += evoCompareHtml(top, ref);
    if (rm0 === "plan" && R.rivBest) h3 += rivenPremiseSection(R, top, r);

    // stats + breakdown
    h5 += `<section class="card"><h3>수치</h3><div class="kv">
      ${kv("치명타 확률", pct(r.cc))}${kv("치명타 피해", r.cd.toFixed(2) + "배")}
      ${kv("상태이상 확률", pct(r.sc) + (atk.kind === "gun" ? " /발" : ""))}${atk.kind === "gun" || atk.kind === "radial" ? kv("멀티샷", r.ms.toFixed(2)) : ""}
      ${r.M > 1 ? kv("연속기 배율 (강공 때)", (Number.isInteger(r.M) ? r.M : "평균 " + r.M.toFixed(1)) + "배") : kv(atk.kind === "melee" ? "초당 타격" : "초당 발사", r.rate.toFixed(2))}${atk.kind === "melee" ? kv(o.comboWindow > 0 ? `연속기 배율 (${o.comboWindow / 60}분 평균)` : "연속기 배율", (r.tierNow >= 11.995 ? "12" : r.tierNow.toFixed(1)) + "배") : ""}${kv("기본 피해 보너스", "+" + pct(r.dmgb))}
      ${kv("상태이상 피해", "+" + pct(r.sd))}${kv("상태이상 지속", pct(r.dur))}
      ${r.u ? kv("인플루언스 가동률", pct(r.u)) : ""}${kv(o.scenario === "crowd" && r.perF[o.factions[0]].Keff > r.K + 0.05 ? "한 발에 같이 잡히는 적 (폭발 포함)" : "한 번에 맞는 적", Math.max(r.K, o.scenario === "crowd" ? r.perF[o.factions[0]].Keff || 0 : 0).toFixed(1) + "명")}
      ${r.fallM && r.fallM < 0.995 ? kv("거리·폭발 가장자리 감쇠", pct(r.fallM)) : ""}${r.tenno ? kv("텐노카이 강공", `${Math.round(r.tenno.f * 100)}% 타격마다 1회`) : ""}
      ${r.ammo ? kv("탄약 (연속 사격)", r.ammo.resupply ? "무한 (리서플라이)" : ammoSec(r.ammo.sustain)) : ""}${r.inc ? kv("인카논 탄 (모드 영향 없음)", r.inc.sec ? `${r.inc.rounds}발 · ${ammoSec(r.inc.sec)}` : "충전식") : ""}
      ${r.exS && r.exS !== 1 ? kv("익절티드 기본 피해 (위력)", "×" + r.exS.toFixed(2)) : ""}${r.exChain > 1 ? kv("피스메이커 연사 보너스", "×" + r.exChain.toFixed(2)) : ""}
      ${r.sniperM > 1 ? kv("저격 콤보 (20초 평균)", "×" + r.sniperM.toFixed(2)) : ""}${r.vigil ? kv("비질란테 세트 (치명 단계 상승)", pct(r.vigil)) : ""}${r.glad && atk.kind !== "gun" ? kv("글래디에이터 세트", `연속기 배율당 +${pct(r.glad)}`) : ""}
    </div>
    <h3>피해 구성 (바이러스 10중첩 기준, 한 발당)</h3>
    <div class="fbars">${o.factions.map((f) => { const x = r.perF[f]; const tot = x.perShot || 1; return `<div class="frow"><span class="fname">${E.FACTIONS[f].label}</span><span class="fval">${fmt(x.perShot)}</span>
      <div class="stack"><i class="c-direct" style="width:${(x.direct / tot) * 100}%"></i>${Object.entries(x.dotBy).map(([t, v]) => `<i class="c-${t}" style="width:${(v / tot) * 100}%"></i>`).join("")}<i class="c-blast" style="width:${(x.blast / tot) * 100}%"></i></div></div>`; }).join("")}</div>
    <div class="legend"><span><i class="c-direct"></i>직격</span><span><i class="c-heat"></i>화염 도트</span><span><i class="c-tox"></i>독 도트</span><span><i class="c-elec"></i>전기 도트(3m 연쇄)</span><span><i class="c-gas"></i>가스 도트</span><span><i class="c-slash"></i>출혈</span><span><i class="c-blast"></i>폭발 상태이상</span>${o.factions.some((f) => r.perF[f].dotBy && r.perF[f].dotBy.napalm) ? '<span><i class="c-napalm"></i>네이팜 장판</span>' : ""}</div>
    <p class="hint">방어구 적용 전 수치입니다. 처치 시간 계산에서는 바이러스·화염·부식 중첩이 쌓이는 시간과 방어구를 반영합니다.</p>
    </section>`;

    // alternatives
    const alts = res.slice(1, 8);
    h5 += `<section class="card"><h3>다른 상위 세팅</h3><table class="tbl"><thead><tr><th>처치 속도</th><th>베일런스 · 아케인</th><th>모드 (다른 부분 강조)</th></tr></thead><tbody>
      ${alts.map((a) => `<tr><td class="num">${pct(a.score / ref, 1)}</td><td>${a.val ? TYPE_KO[a.val.type] : "-"} · ${a.arcane ? esc(ARC[a.arcane].ko) : "없음"}</td><td class="modlist">${diffMods(a.ids, top.ids)}<br><small>${capInfo(a.ids).short}</small></td></tr>`).join("")}
    </tbody></table></section>`;

    // valence
    if (st.weapon.valence) {
      const rows = VAL_TYPES.map((t) => {
        const own = res.filter((x) => x.val && x.val.type === t)[0];
        const same = evalBuild(top.ids, { type: t, pct: top.val.pct }, top.arcane).score / ref;
        return { t, same, own: own ? own.score / ref : null };
      }).sort((a, b) => (b.own || b.same) - (a.own || a.same));
      h4 += `<section class="card"><h3>베일런스 속성 비교</h3><table class="tbl"><thead><tr><th>속성</th><th>추천 모드 그대로</th><th>그 속성에 맞춰 다시 짰을 때</th></tr></thead><tbody>
        ${rows.map((x) => `<tr><td>${TYPE_KO[x.t]}</td><td class="num">${pct(x.same, 1)}</td><td class="num">${x.own ? pct(x.own, 1) : "-"}</td></tr>`).join("")}</tbody></table>
        <p class="hint">100% = 추천 세팅의 처치 속도. 오른쪽 열은 베일런스를 "자동"으로 두었을 때만 채워집니다.</p></section>`;
    }
    // arcanes
    const arcAll = arcanesFor(st.weapon);
    const arcs = arcAll.filter(([k, v]) => !v.none).map(([k]) => ({ k, s: evalBuild(top.ids, top.val, k).score / ref }));
    arcs.push({ k: null, s: evalBuild(top.ids, top.val, null).score / ref });
    const noneArcs = arcAll.filter(([k, v]) => v.none);
    h4 += `<section class="card"><h3>무기 아케인 비교 (추천 모드 그대로)</h3><div class="kv">${arcs.sort((a, b) => b.s - a.s).map((a) => kv(a.k ? esc(ARC[a.k].ko) + (ARC[a.k].manual ? ' <span class="tag cond">조건부</span>' : "") : "없음", pct(a.s, 0))).join("")}</div>
      <p class="hint">조건부: ${arcAll.filter(([k, v]) => v.manual).map(([k, v]) => `${esc(v.ko)}(${esc(v.note || "")})`).join(", ") || "없음"} — 자동 추천에서는 빼고, 조건을 채웠다고 가정한 값입니다.${noneArcs.length ? ` 무기 피해와 무관해 제외: ${noneArcs.map(([k, v]) => esc(v.ko)).join(", ")}.` : ""}</p></section>`;
    h4 += frameArcaneSection(top, r, o);
    h5 += ammoSection(top, r, o, xid);

    // buffs comparison
    if (R.nobuff && R.nobuff.length) {
      const nb = R.nobuff[0];
      const oNo = Object.assign({}, o, { ext: o.ext.gearExt || {}, frameArcs: [], hs: R.flags.aim ? 0.5 : 0 });
      const recNo = evalBuild(top.ids, top.val, top.arcane, oNo);          // recommended build, buff off
      const nbWith = evalBuild(nb.ids, nb.val, nb.arcane);                  // no-buff-best, buff on
      const nbNo = evalBuild(nb.ids, nb.val, nb.arcane, oNo);
      const same = nb.ids.slice().sort().join() === top.ids.slice().sort().join() && (nb.arcane === top.arcane) && JSON.stringify(nb.val) === JSON.stringify(top.val);
      h5 += `<section class="card"><h3>버프 없이 계산한 세팅과 비교</h3>
        ${same ? `<p>버프를 빼고 계산해도 <b>같은 세팅</b>이 나옵니다. 범용 세팅 그대로 버프를 얹어 쓰시면 됩니다.</p>` :
          `<p>버프를 빼고 계산하면 아래 세팅이 1위입니다. 두 세팅을 버프 있을 때/없을 때로 비교했습니다.</p>
          <div class="modlist" style="margin-bottom:8px">${diffMods(nb.ids, top.ids)}</div>
          <table class="tbl"><thead><tr><th></th><th>버프 있음</th><th>버프 없음</th></tr></thead><tbody>
          <tr><td>추천 세팅 (버프 전제)</td><td class="num">100%</td><td class="num">${pct(recNo.score / nbNo.score, 0)} (버프 없는 1위 대비)</td></tr>
          <tr><td>버프 없이 짠 세팅</td><td class="num">${pct(nbWith.score / ref, 0)}</td><td class="num">100%</td></tr></tbody></table>
          <p class="hint">버프 없이 짠 세팅이 버프가 있어도 95% 이상이면 그쪽을 쓰는 편이 안전합니다.</p>`}
      </section>`;
    }

    // riven
    const rm = $("#rivmode").value;
    if (rm === "plan") h3 += rivenPlan(top, ref);
    else if (rm === "owned" && R.owned) h3 += ownedRivenSection(R.owned, R, top);
    if (!h3) h3 = st.weapon.noRiven ? `<section class="card"><p class="hint" style="margin:0">익절티드 무기에는 리벤이 없습니다.</p></section>`
      : `<section class="card"><p style="margin:0">왼쪽 <b>리벤</b>에서 "맞출 예정"을 고르고 계산하면 어떤 리벤 옵션을 노릴지(옵션 조합별 처치 속도, 한 칸 교체 효과, 괜찮은 부정 옵션)가 여기에 나옵니다. 가진 리벤이 있으면 "보유 리벤 고정"으로 넣어 보세요.</p></section>`;

    h5 += `<section class="card notes"><h3>계산 가정</h3><ul>
      <li>처치 시간은 ${o.steel ? "강철의 길 " : ""}${o.level}레벨 기준 적의 체력·방어구(위키 레벨 공식)로 계산합니다. 바이러스·화염·부식·냉기 중첩은 시간에 따라 쌓입니다.</li>
      <li>잡몹 무리: 12명(중장갑 1명·오버가드가 있는 엑시무스 1명 포함)이 반경 약 11m 안에 모여 있다고 봅니다(반경 7.9m에 6명 밀도 — 폭발 반경에 들어오는 수를 정함). 적 하나(와 그 뒤에 줄지은 적)를 죽을 때까지 쏜 뒤 다음 적으로 조준을 옮기는 데 0.2초가 든다고 봅니다. 한 발이 맞히는 수는 폭발 반경과 관통력(쏜 적 뒤에 평균 2명이 줄지어 있고, 몸통 하나에 관통력 약 0.6m)으로 추정. 직격+폭발 무기는 주변 적이 폭발만 맞는다고 보고, 폭발만으로 죽는 속도만큼 같이 잡히는 것으로 계산합니다. 폭발 투사체는 관통이 적용되지 않습니다(위키 "Punch Through"). 갈바나이즈드 계열 피해 보너스와 세컨더리 이레디에이트 전파는 직격에만 적용합니다(위키). 처치 조건 효과(갈바나이즈드, 머시리스 등)는 무리마다 0부터 쌓입니다 — n번째 처치 때 min(n, 최대 중첩)이라 무리 전체 평균으로 넣습니다(머시리스 12중첩이면 12명 무리에서 약 46%, 갈바나이즈드 헬 4중첩이면 약 79%). 보스전에서는 0으로 계산합니다. 점수가 2% 안으로 붙은 세팅끼리는 중첩 유지·중첩 0·팩션별 결과가 고른 쪽을 위에 둡니다.</li>
      <li>상태이상(위키 "Status Effect"): 바이러스 체력 피해 최대 +325%, 부식 방어구 최대 80%, 화염 방어구 50%·도트, 자성 실드 피해 최대 +325%와 실드 파괴 시 전기, 냉기 치명타 배율 +0.5(빙결 +1.0), 관통 치명타 확률 최대 +25%, 베기 출혈 도트(기본 피해 35%×6틱, 방어구·실드 무시), 전기 3m 연쇄 도트, 가스 3~6m 구름, 독·출혈의 실드 관통을 넣었습니다. 상태이상은 그 공격의 피해가 들어간 뒤에 걸려서 다음 공격부터 적용되고, 같은 발의 멀티샷끼리도 서로의 바이러스를 받지 않습니다(위키 "Viral Damage"). 도트 한 틱 = 모드 적용 기본 피해(서레이션류·아케인 포함) × 0.5(베기 0.35) × (1 + 그 원소 모드 %, 화염·독·전기만) × (1 + 상태이상 피해) × 팩션 피해 두 번 × 그 공격의 치명타 배율이고, 화염·독·베기는 1초 뒤부터 1초마다 들어갑니다(위키 "Damage/Calculation"). 방사능의 "적끼리 공격"과 충격의 자비의 일격 문턱, 관통의 적 공격력 감소처럼 처치 속도와 직접 관계없는 효과는 넣지 않습니다.</li>
      <li>폭발 상태이상이 걸린 적이 죽으면 5m 안에 그 공격 기본 피해의 최대 300%로 터져(위키 "Blast Damage") 주변 적이 함께 깎이는 것으로 봅니다. 관통력은 모드와 무기 고유값(인카논 형태 등, 위키)을 더하고, 스풀 무기는 탄창마다 처음 몇 발이 느린 것, 펜모어 인카논 형태는 51발 점사 평균 연사(약 78%)로 계산합니다.</li>
      <li>코퍼스 실드는 독·출혈 도트만 관통하고 나머지는 실드를 먼저 깎습니다. 자성 중첩은 실드·오버가드 피해를 최대 4.25배로 올립니다.${o.og ? " 엑시무스 오버가드(위키 레벨 공식)는 방어구·바이러스 영향 없이 먼저 깎고, 보이드는 1.5배입니다." : ""}</li>
      <li>무기별 숨은 특성은 위키 무기 데이터에서 가져옵니다: 확정 상태이상(예: 조리스 회수 폭발의 전기·충격), 헤드샷 배율 변경, 거리별 피해 감소(잡몹은 2~20m에 고르게, 중장갑은 15m), 폭발 가장자리 피해 감소, 최대 탄약·탄약 소모.</li>
      <li>근접 휘두르기는 공격 속도 1당 초당 1.5타로 근사합니다. 연속기는 '근접 연속기' 옵션의 시간 동안 0(초기 연속기가 있으면 그 값)부터 쌓는 평균 배율을 씁니다. 한 번에 2명(잡몹) 또는 1명을 맞히고, 타격당 스탠스 배율 평균 1.5점에 연속기 획득 확률을 곱해 쌓이며, 220점(12배)에서 멈춥니다. 텐노카이는 그 배율의 강공이 15%(디시플린즈 메리트는 4타마다) 섞이는 것으로 계산합니다. 글레이브·강공은 초기 연속기로 배율을 정합니다. 강공이 연속기를 쓰고 나면 초기 연속기는 초당 40씩 다시 차므로(위키), 강공 간격이 짧으면 덜 찬 배율로 터지고, 그 사이 맞힌 타수(연속기 획득 확률 반영)가 모자란 만큼을 메웁니다. 글레이브는 던지고 돌아오는 비행 시간(투척 속도 기준)을 주기에 넣습니다.</li>
      <li>치명타는 확률을 그대로 반영한 기대값(평균)으로 계산합니다. 운이 좋고 나쁜 편차, 반동·명중 퍼짐, 투사체 비행 시간(15m 기준 0.1초 안팎)은 넣지 않습니다.</li>
      <li>세팅 찾기: 장착 가능한 모든 모드를 후보로, 한 칸씩 더해 가며 단계마다 가장 빠른 조합 100개만 남기고(빔 탐색), 마지막에 상위 8개를 한 칸씩 바꿔 보며 더 빨라지지 않을 때까지 다듬습니다. 원소 칸 순서는 조합마다 가능한 배치를 모두 계산합니다. 가능한 조합 전부(수십억 가지)를 하나하나 계산하는 방식은 아니라서, 이론상 놓치는 조합이 있을 수 있습니다. 리벤은 옵션 하나씩 효과를 잰 뒤 상위 옵션들로 3개 조합을 모두 만들어 한 칸 교체로 비교하고, 상위 4개 조합은 나머지 칸을 처음부터 다시 짭니다.</li>
      <li>모드 용량: 오로킨 카탈리스트(용량 = 최대 랭크×2), 모든 모드 최대 랭크 기준입니다. 같은 극성 칸은 소모 절반(올림), 다른 극성 칸은 25% 증가(올림)이고, 포르마 한도 안에서 들어가는 조합만 추천합니다.</li>
      <li>저격총은 조준 옵션을 켜면 최대 배율 줌 보너스와 저격 콤보(20초 연속 교전 평균)를 넣습니다. 익절티드 무기는 워프레임 위력 값을 기본 피해(또는 위키에 적힌 방식)에 반영합니다.</li>
      <li>Cyte-09 리서플라이를 켜면 탄창을 비울 때마다 시전해 즉시 재장전한다고 보고, 재장전과 탄약 부족이 없어지는 것으로 계산합니다(탄약 무한). 시전은 조준을 옮기는 사이처럼 원래 쏘지 않는 순간에 한다고 보고 기본 0초로 두며, '시전으로 사격이 끊기는 시간'을 늘리면 그만큼 탄창마다 쉬는 시간이 생깁니다(위키에 시전 시간 없음). 에너지와 탄약 팩의 속성 추가 피해는 계산하지 않습니다.</li>
      <li>탄약은 긴 전투 기준입니다: 무리 하나를 잡는 데 쓴 탄약이 그 처치들이 떨어뜨리는 탄약(위키 Ammo: 솔로 처치당 45% 확률로 주무기 또는 보조무기 탄약 — 종류별 22.5%로 계산, 엑시무스는 확정)보다 많으면 처치 속도를 드롭이 감당하는 만큼으로 낮춥니다. 탄약 효율·탄약 변환 모드가 여기서 힘을 냅니다.</li>
      <li>위키에 수치가 없는 어빌리티(Cyte-09 시크)와 킷건·자우 전용 아케인, 자우 강공(위키 데이터 없음)은 아직 반영하지 않습니다.</li>
    </ul></section>`;
    const toc = [["sec1", "① 추천 세팅"], ["sec2", "② 내 세팅과 비교"], ["sec3", "③ 리벤"], ["sec4", "④ 속성·아케인"], ["sec5", "⑤ 상세"]];
    html += `<nav class="rtoc" aria-label="결과 목차">${toc.map(([id, t]) => `<button type="button" data-go="${id}">${t}</button>`).join("")}</nav>`
      + sec("①", "추천 세팅", "리벤 없이 · 모든 모드 보유 전제" + (() => { if (!bc || !bc.all.length) return ""; const badW = new Set(bc.bad.map((x) => x.why)), same = [...new Set(bc.all.filter((x) => !badW.has(x.why)).map((x) => x.why.split(" — ")[0]))].filter((w) => !bc.bad.some((b) => b.why.split(" — ")[0] === w)); return (same.length ? " · 위키에 없는 가정(" + same.join(", ") + ")은 양쪽 모두에서 이 세팅이 1위" : "") + (bc.bad.length ? " · 확인 안 된 가정 " + bc.bad.length + "개는 반대쪽이면 1위가 바뀜(위 참고)" : ""); })(), h1, "sec1")
      + sec("②", "내 세팅과 비교", "왼쪽 '비교할 세팅'에 넣은 세팅", `<section class="card" id="cmpout"></section>`, "sec2")
      + sec("③", "리벤", "어떤 리벤을 노릴까", h3, "sec3")
      + sec("④", "속성·아케인", "추천 모드 그대로 바꿨을 때", h4, "sec4")
      + sec("⑤", "상세", "수치 · 다른 세팅 · 계산 가정", h5, "sec5");
    $("#results").innerHTML = html;
    renderCompare();
  }

  // "change only these": from a typed set toward the recommendation, one swap at a time (biggest gain first), up to 3 steps
  function swapPath(s, top) {
    const isX = (id) => MOD_BY_ID[id] && MOD_BY_ID[id].exilus;
    const score = (ids, arc) => evalBuild(ids, top.val, arc, null, s.rivEff).score;
    let cur = s.ids.slice(), arc = s.arcane, sc = score(cur, arc);
    const steps = [];
    for (let k = 0; k < 3; k++) {
      let best = null;
      for (const m of top.ids) {
        if (cur.includes(m) || m === "__riven") continue;
        const M = MOD_BY_ID[m];
        const outs = cur.filter((c) => !top.ids.includes(c) && !!isX(c) === !!isX(m) && c !== "__riven");
        if (cur.filter((c) => !!isX(c) === !!isX(m)).length < (isX(m) ? 1 : 8)) outs.push(null);    // free slot
        for (const c of outs) {
          const nx = cur.filter((x) => x !== c);
          if (M && nx.some((x) => E.clash(M, MOD_BY_ID[x]))) continue;
          nx.push(m);
          const v = score(nx, arc);
          if (!best || v > best.v) best = { v, ids: nx, out: c, inn: m };
        }
      }
      if (top.arcane !== arc) { const v = score(cur, top.arcane); if (!best || v > best.v) best = { v, ids: cur, arc: top.arcane, out: arc ? "arc:" + arc : null, inn: "arc:" + top.arcane }; }
      if (!best || best.v < sc * 1.01) break;
      steps.push(best); cur = best.ids; if (best.arc !== undefined) arc = best.arc; sc = best.v;
    }
    return steps;
  }
  const swapName = (id) => id && id.startsWith("arc:") ? (ARC[id.slice(4)] ? "아케인 " + ARC[id.slice(4)].ko : "아케인") : modName(id);

  /* ---------------- comparison table: 추천 + up to 5 sets, fastest first ---------------- */
  function renderCompare() {
    const box = $("#cmpout");
    if (!box || !st.results || !st.results.res || !st.results.res.length) return;
    const R = st.results, o = R.o, top = R.res[0];
    const sets = $$("#sets .cset").map(setMods).filter((s) => s.ids.length || s.problems.length);
    if (!sets.length) { box.hidden = false; box.innerHTML = `<p style="margin:0">왼쪽 <b>비교할 세팅</b>에 지금 쓰는 세팅을 넣으면(스크린샷으로 채우기 가능) 추천 세팅과의 처치 속도 차이와 <b>바꿀 모드만</b> 여기에 나옵니다.</p>`; return; }
    const rec = { name: "추천 세팅", rec: true, ids: top.ids, arcane: top.arcane, problems: [] };
    rec.r = evalBuild(rec.ids, top.val, rec.arcane);
    const ref = rec.r.score;
    // comparison sets: elements combine in the slot order typed (game rule); also check whether reordering alone would help
    const rivRow = R.rivBest && $("#rivmode").value === "plan" ? { name: "추천 + 리벤 (처음부터 리벤 전제)", rec: false, auto: true, ids: R.rivBest.top.ids, arcane: R.rivBest.top.arcane, rivEff: R.rivBest.riv.eff, rivInfo: R.rivBest.riv.info, problems: [],
      r: evalBuild(R.rivBest.top.ids, R.rivBest.top.val, R.rivBest.top.arcane, null, R.rivBest.riv.eff) } : null;
    const rows = [rec].concat(rivRow ? [rivRow] : []).concat(sets.filter((s) => s.ids.length).map((s) => {
      const r = evalBuild(s.ids, top.val, s.arcane, null, s.rivEff, elemOrderOf(s.ids, s.rivInfo));
      const auto = evalBuild(s.ids, top.val, s.arcane, null, s.rivEff);
      const reorder = auto.score > r.score * 1.01 ? { k: auto.score / r.score, el: finalElements(auto), groups: orderMods(s.ids, auto, s.rivInfo).filter((g) => g.label !== "그 외 (순서 무관)") } : null;
      return Object.assign(s, { r, reorder, swaps: swapPath(s, top) });
    }));
    rows.sort((a, b) => b.r.score - a.r.score || (a.rec ? -1 : 1));
    const crowd = o.scenario === "crowd";
    const per = (r, f, k) => {
      const x = k ? r.perF[f][k] : r.perF[f];
      if (crowd) return sec(x.clear);
      return x.one ? "한 방" : sec(x.ttk);
    };
    const oneCell = (r) => o.factions.map((f) => multi ? `<div class="fl"><span>${E.FACTIONS[f].label}</span>${oneLvTxt(r.perF[f].oneLv)}</div>` : `<span class="big">${oneLvTxt(r.perF[f].oneLv)}</span>`).join("");
    const L = E.levelsOf(o);
    const multi = o.factions.length > 1;
    const timeCell = (r, hi) => o.factions.map((f) => multi ? `<div class="fl"><span>${E.FACTIONS[f].label}</span>${per(r, f, hi)}</div>` : `<span class="big">${per(r, f, hi)}</span>`).join("");
    const speedCell = (x) => {
      if (x.rec) return `<span class="big">100%</span>`;
      const k = x.r.score / ref;
      return `<span class="big">${pct(k, 0)}</span><br><small>${k < 0.995 ? `추천이 ×${(1 / k).toFixed(2)} 빠름` : k > 1.005 ? `추천보다 ×${k.toFixed(2)} 빠름` : "추천과 같음"}</small>`;
    };
    const modsCell = (x) => {
      if (x.rec) return x.ids.map((id) => `<span class="plain">${esc(modName(id))}</span>`).join("");
      const missing = top.ids.filter((id) => !x.ids.includes(id));
      return diffMods(x.ids, top.ids) + (x.rivInfo && x.rivInfo.length ? `<br><small>리벤: ${esc(rivenText(x.rivInfo))}</small>` : "") + (missing.length && missing.length < 8 ? `<br><small>추천에서 빠진 것: </small>${missing.map((id) => `<span class="miss">${esc(modName(id))}</span>`).join("")}` : "")
        + (x.swaps && x.swaps.length ? `<div class="swaps"><b>이것만 바꾸세요</b>${x.swaps.map((w) => `<span class="sw">${w.out ? `<s>${esc(swapName(w.out))}</s>` : `<i>${w.inn.startsWith("arc:") ? "아케인 없음" : MOD_BY_ID[w.inn] && MOD_BY_ID[w.inn].exilus ? "익실러스 빈 칸" : "빈 칸"}</i>`} → <b>${esc(swapName(w.inn))}</b> <em>${pct(w.v / ref, 0)}</em></span>`).join("")}<small>오른쪽 %는 그 단계까지 바꿨을 때의 처치 속도 (추천 = 100%)</small></div>` : "")
        + (x.reorder ? `<div class="reorder">칸 순서만 바꿔도 <b>×${x.reorder.k.toFixed(2)}</b> 빨라집니다 (→ ${x.reorder.el}). 앞 칸부터 ${x.reorder.groups.map((g) => `<b>${g.label}</b>: ${g.ids.map((id) => esc(modName(id))).join(", ")}`).join(" → ")} 순서로 넣으세요.</div>` : "");
    };
    const what = crowd ? "12명 전멸" : "처치";
    const firstTyped = rows.findIndex((x) => !x.rec && !x.auto), recIdx = rows.findIndex((x) => x.rec);
    const beaten = firstTyped >= 0 && firstTyped < recIdx ? rows[firstTyped] : null;
    // the recommendation is searched without a riven unless "보유 리벤 고정" is on: say so, and offer a re-run with that riven
    const recHasRiv = top.ids.includes("__riven");
    const rivSet = !recHasRiv && !st.weapon.noRiven ? sets.find((x) => x.ids.includes("__riven") && x.rivInfo && x.rivInfo.length) : null;
    const rivNote = rivSet && !(beaten && beaten === rivSet) ? `<p class="hint">추천 세팅은 리벤 없이 찾은 세팅입니다. <b>${esc(rivSet.name)}</b>의 리벤까지 넣고 나머지 칸을 다시 고르려면 <button type="button" class="ghostbtn rivrerun" data-set="${esc(rivSet.name)}">이 리벤으로 추천 다시 계산</button></p>` : "";
    const probs = sets.filter((s) => s.problems.length);
    box.hidden = false;
    box.innerHTML = `<h3>세팅 비교 — 빠른 순서</h3>
      ${beaten ? `<p class="warn">입력하신 <b>${esc(beaten.name)}</b>가 추천보다 빠릅니다. ${beatWhy(beaten, top)}</p>` : ""}
      ${rivNote}
      <table class="tbl cmp"><thead><tr><th>순위</th><th>세팅</th><th>처치 속도<br><small>추천 = 100%</small></th><th>${L[0]}레벨 ${what}</th><th>${L[2]}레벨 ${what}<br><small>버티기</small></th><th>한 방 유지<br><small>${o.scenario === "boss" ? "보스" : "중장갑"}</small></th><th>아케인</th></tr></thead><tbody>
      ${rows.map((x, i) => `<tr class="main${x.rec ? " rec" : ""}"><td class="rank">${i + 1}</td><td class="sname">${esc(x.name)}<br><small class="els">${finalElements(x.r)}${x.r.ammo ? ` · 탄약 ${ammoSec(x.r.ammo.sustain)}` : ""}</small><br><small class="${capInfo(x.ids, x.rivEff).ok ? "els" : "capbad"}">${capInfo(x.ids, x.rivEff).short}</small></td><td class="num spd">${speedCell(x)}</td><td class="t1" data-label="${L[0]}레벨 ${what}">${timeCell(x.r, null)}</td><td class="t2" data-label="${L[2]}레벨 ${what}">${timeCell(x.r, "top")}</td><td class="t3" data-label="한 방 유지">${oneCell(x.r)}</td><td class="arc" data-label="아케인">${x.arcane ? esc(ARC[x.arcane].ko) : "없음"}</td></tr>
        <tr class="sub${x.rec ? " rec" : ""}"><td></td><td colspan="6" class="modlist">${modsCell(x)}</td></tr>`).join("")}
      </tbody></table>
      ${probs.map((s) => `<p class="warn"><b>${esc(s.name)}</b>: ${s.problems.map(esc).join(" · ")} — 이 모드는 빼고 계산했습니다.</p>`).join("")}
      ${sets.filter((s) => s.notes && s.notes.length).map((s) => `<p class="hint"><b>${esc(s.name)}</b> — ${s.notes.map(esc).join("<br>")}</p>`).join("")}
      <p class="hint">강조된 모드는 추천 세팅에 없는 모드, 줄 그은 모드는 추천에는 있는데 그 세팅에 없는 모드입니다. ${multi ? "처치 속도는 세 팩션 평균입니다. " : ""}${crowd ? "시간은 섞여 있는 중장갑까지 12명을 모두 잡는 시간입니다. " : ""}${top.val ? `베일런스는 모든 세팅을 추천 값(${TYPE_KO[top.val.type]} ${pct(top.val.pct)})으로 맞췄습니다. ` : ""}워프레임·어빌리티·샤드 버프는 모든 세팅에 똑같이 적용했습니다.</p>
      <p class="hint">원소 합성 순서: 비교 세팅은 입력한 칸 순서(1번 칸 = 왼쪽 위)대로, 추천 세팅은 가장 빠른 순서로 합칩니다. 리벤은 그 칸 자리에서 합쳐지고(리벤 안에서는 마지막 줄 원소가 먼저), 보라 샤드 전기는 전기 모드가 있으면 그 자리에, 없으면 모든 모드 뒤에 붙습니다. 무기 고유 원소와 베일런스는 맨 마지막(화염→냉기→전기→독 순)이고, 어빌리티가 주는 원소(일렉트릭 실드·톡식 래시·자타의 속삭임·너리시)는 다른 원소와 합쳐지지 않습니다.</p>`;
  }

  // why a typed set beats the recommendation
  function beatWhy(x, top) {
    const why = [];
    if (x.ids.includes("__riven") && !top.ids.includes("__riven")) why.push(`이 세팅에는 리벤(${esc(rivenText(x.rivInfo || []))})이 들어 있는데, 추천 세팅은 <b>리벤 없이</b> 찾은 세팅입니다${$("#rivmode").value === "plan" && st.results.rivBest ? ' (리벤을 넣은 기준은 표의 "추천 + 리벤" 줄)' : ""}. 리벤 한 장이 좋은 모드 두 장 몫을 하기 때문에 이런 차이가 납니다 — 이 버튼은 입력하신 리벤 수치를 그대로 고정하고 나머지 칸을 다시 고릅니다. <button type="button" class="ghostbtn rivrerun" data-set="${esc(x.name)}">이 리벤으로 추천 다시 계산</button>`);
    if (x.arcane && ARC[x.arcane] && ARC[x.arcane].manual) why.push(`${esc(ARC[x.arcane].ko)}는 조건부 아케인이라 자동 추천 후보에서 빠집니다 (조건을 계속 채운다는 가정으로 계산한 값).`);
    // an element concept was chosen: the recommendation was searched inside it, a set outside it can be faster
    const oc = st.results && st.results.o && st.results.o.concept;
    if (oc && oc.length && x.r && x.r.conceptD > 0) why.push(`추천 세팅은 고른 속성 콘셉트(${oc.map((t) => TYPE_KO[t]).join(" + ")}${st.results.o.conceptOnly ? ", 이 속성만" : ""}) 안에서 찾은 세팅이고, 이 세팅은 그 콘셉트 밖이라 더 빠를 수 있습니다. 콘셉트를 비우면 둘을 같은 조건으로 비교합니다.`);
    if (!why.length) why.push("자동 탐색이 놓친 조합입니다. 그 세팅을 그대로 쓰셔도 되고, 알려 주시면 탐색을 보강하겠습니다.");
    return why.join(" ");
  }
  // copy a comparison set's riven into "보유 리벤 고정" and run again
  function rerunWithRiven(name) {
    const d = $$("#sets .cset").find((e) => setMods(e).name === name); if (!d) return;
    const ks = d.querySelectorAll(".crk"), vs = d.querySelectorAll(".crv");
    for (let i = 0; i < 4; i++) { $("#rk" + i).value = ks[i].value; $("#rv" + i).value = vs[i].value; $("#ri" + i).checked = true; }
    $("#rivmode").value = "owned"; $("#rivowned").hidden = false;
    run();
  }
  document.addEventListener("click", (e) => { const b = e.target.closest(".rivrerun"); if (b) rerunWithRiven(b.dataset.set); });

  /* ---------------- exilus / warframe arcanes / ammo ---------------- */
  function exilusAdvice(xid, r, atk, top) {
    if (xid) {
      const m = MOD_BY_ID[xid];
      const why = m.eff.throwSpd ? "투척 속도가 빨라져 던지고 돌아오는 주기가 짧아집니다 (처치 속도에 직접 기여)"
        : m.eff.tenno ? "텐노카이 강공을 열어 줍니다 — 연속기를 소모하지 않는 강공이 섞여 처치 속도에 직접 기여" : "처치 속도에 직접 기여";
      return { name: m.ko, why };
    }
    const xs = exilusMods(st.weapon);
    // exalted weapons use energy, not ammo; Resupply refills the magazine, so no ammo mod is needed
    const conv = st.weapon.exalted || (r.ammo && r.ammo.resupply) ? null : xs.filter((m) => m.eff.ammoConv).sort((a, b) => b.eff.ammoConv - a.eff.ammoConv)[0];
    // long-fight ammo (engine ammoK): kill drops can't pay for the rounds a wave costs → the conversion mod is real kill speed
    const ammoLow = Object.values(r.perF || {}).some((x) => [x.ammoK, x.hi && x.hi.ammoK, x.top && x.top.ammoK].some((k) => k != null && k < 0.999));
    if (ammoLow && conv && top) {
      const k = evalBuild(top.ids.concat([conv.id]), top.val, top.arcane).score / r.score;
      return { name: conv.ko, id: conv.id, short: "탄약 보완", why: `탄약 보완 — 긴 전투에서 처치로 떨어지는 탄약보다 쓰는 탄약이 많아 처치 속도가 탄약에 묶입니다. 다른 종류 탄약 픽업을 이 무기 탄약으로 ${pct(conv.eff.ammoConv)} 바꿔 주면 처치 속도 ×${k.toFixed(2)} (탄약 드롭: 위키 Ammo, 솔로 기준)` };
    }
    if (r.ammo && r.ammo.sustain < 60 && conv) return { name: conv.ko, id: conv.id, short: "탄약 보완", why:`탄약 보완 — 다른 종류 탄약 픽업을 이 무기 탄약으로 ${pct(conv.eff.ammoConv)} 바꿔 줍니다 (처치 속도 영향 없음, 탄약 ${Math.round(r.ammo.sustain)}초 만에 바닥)` };
    if (r.inc) return { name: "자유", why: `피해 계산에 영향 없는 칸입니다. 인카논 형태는 모드와 무관한 별도 탄(${r.inc.rounds || "충전식"}${r.inc.rounds ? "발" : ""})을 쓰고 재장전이 없어서 탄약·탄창 모드도 효과가 없습니다. 기본 형태로 돌아갔을 때를 위해 탄약 변환 모드를 끼워도 됩니다.` };
    const proj = xs.find((m) => m.eff.projSpd);
    if (atk.kind === "melee" && xs.some((m) => m.eff.tenno)) return { name: "자유", why: "휘두르기 운용이 아니면 텐노카이가 의미 없어 피해 계산에 영향 없는 칸입니다" };
    return { name: "자유", why: `피해 계산에 영향 없는 칸입니다.${conv ? ` 탄약이 아쉬우면 ${conv.ko}` : ""}${proj ? `, 투사체 무기라 맞히기 힘들면 ${proj.ko}` : ""}` + (conv || proj ? "를 추천합니다." : "") };
  }
  function frameArcaneSection(top, r, o) {
    const s0 = frameStats([]);
    const oBase = Object.assign({}, o, { frameArcs: [], ext: buffExt(o.scenario, []), maxEnergy: s0.energy });
    const base = evalBuild(top.ids, top.val, top.arcane, oBase).score;
    const w = st.weapon, rows = [], idle = [];
    for (const [id, A] of Object.entries(FRAME_ARC)) {
      if (A.kind === "ammo" || A.kind === "none") continue;
      if (A.kind === "weapon") {
        const slotOk = A.slot === "any" || A.slot === w.slot || (A.slot === "gun" && w.slot !== "melee");
        if (!slotOk || !typeOk(A, w)) continue;
      }
      const ext = buffExt(o.scenario, [id]);
      const oA = Object.assign({}, oBase, { frameArcs: A.kind === "weapon" ? [id] : [], ext, maxEnergy: ext.maxEnergy });
      const k = evalBuild(top.ids, top.val, top.arcane, oA).score / base;
      if (k > 1.004) rows.push({ id, A, k }); else idle.push(A.ko);
    }
    rows.sort((a, b) => b.k - a.k);
    const picked = pickedFA();
    return `<section class="card"><h3>워프레임 아케인 효과 (추천 세팅 그대로, 하나씩 넣었을 때)</h3>
      ${rows.length ? `<table class="tbl"><thead><tr><th>아케인</th><th>처치 속도</th><th>근거</th></tr></thead><tbody>${rows.slice(0, 14).map((x) => `<tr><td>${esc(x.A.ko)}${x.A.manual ? '<span class="tag cond">조건부</span>' : ""}${picked.includes(x.id) ? '<span class="tag">장착 중</span>' : ""}</td><td class="num">×${x.k.toFixed(2)}</td><td><small>${esc(x.A.note || (x.A.trig ? `${{ crit: "치명타", hit: "명중", hs: "약점 명중", reload: "재장전", kill: "처치" }[x.A.trig]} 시 발동 — 이 세팅의 발동 빈도로 유지율 계산` : ""))}</small></td></tr>`).join("")}</tbody></table>` : `<p>이 무기·버프 조합에서는 처치 속도를 올리는 워프레임 아케인이 없습니다.</p>`}
      <p class="hint">위력·지속을 올리는 아케인은 선택한 어빌리티·헬민스(로어 등)·에너지 연동 효과가 있을 때만 숫자가 나옵니다. 조건부는 조건을 계속 채운다고 가정한 값입니다. 이 세팅에서 효과 없음: ${idle.slice(0, 30).map(esc).join(", ")}${idle.length > 30 ? " 외" : ""}. 그 밖의 워프레임 아케인 ${Object.values(FRAME_ARC).filter((A) => A.kind === "none").length}종은 무기 피해·어빌리티 수치와 무관해 순위에서 뺐습니다 (생존·이동·자원용).</p></section>`;
  }
  function ammoSection(top, r, o, xid) {
    if (!r.ammo) return "";
    const A = r.ammo, short = A.sustain < 30;
    if (!short && !$("#ammoalways").checked) return "";
    const w = st.weapon, atk = w.attacks[st.atk], cls = modClass(w);
    const level = (S) => S < 30 ? '<span class="g bad">부족</span>' : S < 60 ? '<span class="g mid">보통</span>' : '<span class="g ok">넉넉</span>';
    const rows = [{ name: "추천 세팅 (피해 최우선)", k: 1, S: A.sustain, note: "" }];
    const xs = exilusMods(w);
    const conv = xs.filter((m) => m.eff.ammoConv).sort((a, b) => b.eff.ammoConv - a.eff.ammoConv)[0];
    const maxm = xs.filter((m) => m.eff.ammoMax).sort((a, b) => b.eff.ammoMax - a.eff.ammoMax)[0];
    if (!xid && conv) rows.push({ name: `+ 익실러스 ${conv.ko}`, k: 1, S: A.sustain, note: `다른 종류 탄약 픽업도 이 무기 탄약으로 (${pct(conv.eff.ammoConv)}) — 탄약 수급량 약 ×${(1 + conv.eff.ammoConv).toFixed(2)}, 피해 손실 없음` });
    if (!xid && maxm) { const rr = evalBuild(top.ids.concat([maxm.id]), top.val, top.arcane); rows.push({ name: `+ 익실러스 ${maxm.ko}`, k: rr.score / r.score, S: rr.ammo.sustain, note: `최대 탄약 +${pct(maxm.eff.ammoMax)}, 피해 손실 없음` }); }
    // best single swap to a magazine mod
    let bestSwap = null;
    const magMods = MODS.filter((m) => m.ammo && m.compat.includes(cls) && typeOk(m, w));
    top.ids.forEach((id, i) => {
      if (id === "__riven" || id === xid) return;
      const rest = top.ids.filter((_, j) => j !== i);
      for (const m of magMods) {
        if (m.id === id || rest.includes(m.id) || rest.some((x) => E.clash(m, MOD_BY_ID[x]))) continue;
        const rr = evalBuild(rest.concat([m.id]), top.val, top.arcane);
        if (!rr.ammo) continue;
        const cand = { out: id, m, k: rr.score / r.score, S: rr.ammo.sustain };
        if (!bestSwap || cand.k * Math.min(1, cand.S / 45) > bestSwap.k * Math.min(1, bestSwap.S / 45)) bestSwap = cand;
      }
    });
    if (bestSwap && bestSwap.S > A.sustain * 1.05) rows.push({ name: `${modName(bestSwap.out)} → ${bestSwap.m.ko}`, k: bestSwap.k, S: bestSwap.S, note: "탄창을 늘려 재장전 사이 사격 시간과 총 탄약을 늘림" });
    if (w.slot === "secondary") rows.push({ name: "+ 워프레임 아케인 아케인 피스톨리어", k: 1, S: A.sustain, note: "보조무기 약점 처치 시 60% 확률로 12초 탄약 무한 — 헤드샷 처치가 잦으면 사실상 해결" });
    if (w.slot === "primary" && ARC.primary_crux && arcanesFor(w).some(([k]) => k === "primary_crux")) {
      const rr = evalBuild(top.ids, top.val, "primary_crux", Object.assign({}, o, { hs: 0.5 }));
      rows.push({ name: "아케인을 프라이머리 크럭스로", k: rr.score / r.score, S: rr.ammo ? rr.ammo.sustain : A.sustain, note: "약점 명중 10중첩 시 탄약 효율 +60%·상태이상 +300% (헤드샷 50% 가정)" });
    }
    return `<section class="card"><h3>탄약 ${short ? "— 부족할 수 있습니다" : ""}</h3>
      <p>추천 세팅은 탄창 ${Math.round(A.mag)}발 + 최대 탄약 ${Math.round(A.max)}발을 초당 ${A.use.toFixed(1)}발씩 써서, 줍지 않고 쏘면 <b>${ammoSec(A.sustain)}</b> 만에 바닥납니다${A.packsPerMin ? ` (탄약 팩 하나 ${A.pickup}발 → 계속 쏘려면 분당 약 ${Math.round(A.packsPerMin)}개 필요)` : ""}.</p>
      <table class="tbl"><thead><tr><th>세팅</th><th>처치 속도</th><th>연속 사격</th><th>판정</th><th>메모</th></tr></thead><tbody>
      ${rows.map((x) => `<tr><td>${esc(x.name)}</td><td class="num">${pct(x.k, 0)}</td><td class="num">${ammoSec(x.S)}</td><td>${level(x.S)}</td><td><small>${esc(x.note)}</small></td></tr>`).join("")}</tbody></table>
      <p class="hint">"연속 사격"은 탄창+최대 탄약을 쉬지 않고 쏠 때 바닥나는 시간입니다(재장전 포함, 픽업 제외). 30초 미만이면 부족으로 봅니다. 최대 탄약·픽업량은 위키 무기 데이터 값입니다.</p></section>`;
  }

  /* ---------------- riven advisor ---------------- */
  // every riven stat combo in every slot of a riven-free build (score relative to that build)
  function rivenCombos(top, ref) {
    const cls = modClass(st.weapon), atk = st.weapon.attacks[st.atk], o = st.results.o;
    const table = Object.fromEntries(RIV_DEF.map((d) => [d.k, rivBaseOf(cls, d.k)]));
    const heavyAtk = atk.kind === "heavy" || atk.kind === "glaive";
    const fac1 = o.factions.length === 1 ? o.factions[0] : null;
    // candidates: every stat that can change kill speed here (faction damage only against a single chosen faction,
    // weak-point stats only with headshots on, heavy-attack stats only for heavy attacks)
    let cand = RIV_DEF.filter((d) => rivFits(d, cls) && (d.grp === "dmg" || d.grp === "splice" || (d.grp === "heavy" && heavyAtk)) && d.eff !== null && rivBaseOf(cls, d.k) > 0)
      .filter((d) => !(d.k === "ic" && !heavyAtk) && !((d.k === "reload" || d.k === "mag") && !atk.mag) && !(d.k === "x_pt" && o.scenario !== "crowd"))
      .filter((d) => !(d.eff && d.eff.bane) || d.eff.bane === fac1)
      .filter((d) => !["wpd", "wpcc"].includes(d.k) || o.hs > 0)
      .filter((d) => !["heavyd", "windup"].includes(d.k) || heavyAtk)
      .filter((d) => !["ammoeff", "x_ammo"].includes(d.k))
      .map((d) => d.k);
    // screen: each stat alone as an extra mod; the combo search keeps the 11 best plain stats and the 3 best spliced ones
    const m31 = 1.2 * RIV_PLAN_W * RIV_FORM["3+1"].pos;
    const gain = Object.fromEntries(cand.map((k) => [k, evalBuild(top.ids.concat(["__riven"]), top.val, top.arcane, null, addRivEff({}, k, rivBaseOf(cls, k) * m31)).score / ref]));
    const pick = (l, n) => l.sort((a, b) => gain[b] - gain[a]).slice(0, n);
    const stats = pick(cand.filter((k) => !SPLICED.has(k)), 11).concat(pick(cand.filter((k) => SPLICED.has(k)), 3));
    const out = [];
    for (const form of ["3+1", "2+1"]) {
      const n = form === "3+1" ? 3 : 2, mult = 1.2 * RIV_PLAN_W * RIV_FORM[form].pos;
      const combos = [];
      const rec = (start, acc) => { if (acc.length === n) { if (acc.filter((k) => SPLICED.has(k)).length <= 1) combos.push(acc.slice()); return; } for (let i = start; i < stats.length; i++) { acc.push(stats[i]); rec(i + 1, acc); acc.pop(); } };
      rec(0, []);
      for (let i = 0; i < top.ids.length; i++) {
        if (MOD_BY_ID[top.ids[i]] && MOD_BY_ID[top.ids[i]].exilus) continue;     // a riven can't go in the exilus slot
        const rest = top.ids.filter((_, j) => j !== i);
        for (const c of combos) {
          const riv = effFromStats(c.map((k) => [k, rivBaseOf(cls, k) * mult]));
          const s = evalBuild(rest.concat(["__riven"]), top.val, top.arcane, null, riv).score / ref;
          out.push({ form, slot: top.ids[i], stats: c, s });
        }
      }
    }
    out.sort((a, b) => b.s - a.s);
    return { out, table, stats, cls };
  }
  const heavyAtkOf = (atk) => atk.kind === "heavy" || atk.kind === "glaive";
  const ncOf = (atk) => [atk].concat(atk.parts || []).some((p) => p.evoEff && p.evoEff.nc > 0);
  // what an ingredient must roll for a spliced trait value: the spliced trait keeps the higher random value (0.9–1.1) of the
  // two consumed traits (wiki "Riven Splicer"); a negative ingredient counts with its real random value — the bigger the
  // negative, the higher (riven price tools flip negatives and call that end the bad one)
  function spliceNeedHtml(sp, cls) {
    const rec = SPLICE_REC[sp.out]; if (!rec) return "";
    const keys = [...new Set(rec.flat())].filter((k) => RIV_D[k] && rivFits(RIV_D[k], cls) && rivBaseOf(cls, k) > 0);
    if (!keys.length) return "";
    const bo = rivBaseOf(cls, sp.out);
    const rows = ["3+1", "2+1"].map((f) => {
      const F = RIV_FORM[f];
      const out = (r) => rivVal(sp.out, bo * 1.2 * F.pos * r);
      const pos = (k, r) => `+${RIV_KO[k]} ${rivVal(k, rivBaseOf(cls, k) * 1.2 * F.pos * r)}`;
      const neg = (k, r) => `−${RIV_KO[k]} ${rivVal(k, (RIV_D[k].negBase || rivBaseOf(cls, k)) * 1.2 * Math.abs(F.neg) * r)}`;
      const need = (r, end) => `긍정이면 ${keys.map((k) => pos(k, r)).join(" 또는 ")}${end}<br>부정이면 ${keys.map((k) => neg(k, r)).join(" 또는 ")}${end}`;
      return `<tr><td>${F.ko}</td><td class="num">${out(0.9)}~${out(1.1)}</td><td><small>${need(1.1, " (최대치)")}</small></td><td><small>${need(1.0, " 이상")}</small></td></tr>`;
    }).join("");
    return `<p style="margin:10px 0 4px"><b>${esc(sp.ko)}</b> = ${rec.map((pr) => pr.map((k) => RIV_D[k] ? RIV_D[k].ko : k).join(" + ")).join(" 또는 ")}${SPLICE_ELEM[sp.out] ? " · 복합 원소는 모드의 단일 원소와 합쳐지지 않고 그대로 들어갑니다" : ""}</p>
      <table class="tbl"><thead><tr><th>구성</th><th>접합 결과 범위</th><th>최대치를 받으려면 — 재료 둘 중 하나가</th><th>중간값 이상을 받으려면 — 재료 둘 중 하나가</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function rivenPlan(top, ref) {
    const cls = modClass(st.weapon), atk = st.weapon.attacks[st.atk];
    const cached = st.results && st.results.rivPlan && st.results.rivPlanTop === top ? st.results.rivPlan : null;
    const { out, table } = cached || rivenCombos(top, ref);
    const best3 = out.filter((x) => x.form === "3+1").slice(0, 3), best2 = out.filter((x) => x.form === "2+1").slice(0, 2);
    const rangeTxt = (k, form) => { const b = rivBaseOf(cls, k) * 1.2 * RIV_FORM[form].pos; return `${rivVal(k, b * 0.9)}~${rivVal(k, b * 1.1)}`; };
    const row = (x) => `<tr><td>${RIV_FORM[x.form].ko}</td><td>${x.stats.map((k) => `${RIV_KO[k]} <small>(${rangeTxt(k, x.form)})</small>`).join("<br>")}</td><td>${esc(modName(x.slot))}</td><td class="num">×${x.s.toFixed(2)}</td></tr>`;
    // negatives: modeled via evaluation, others by rule
    const base = top.ids.slice(), bestSlot = out[0] ? out[0].slot : top.ids[top.ids.length - 1];
    const restB = base.filter((id) => id !== bestSlot);
    const posPairs = out[0].stats.map((k) => [k, rivBaseOf(cls, k) * 1.2 * RIV_PLAN_W * RIV_FORM["3+1"].pos]);
    const posRiv = effFromStats(posPairs);
    const withPos = evalBuild(restB.concat(["__riven"]), top.val, top.arcane, null, posRiv).score;
    const negRows = [];
    // every stat a riven can roll as a negative (splice results and Initial Combo can't be negative)
    for (const d of RIV_DEF) {
      if (!rivFits(d, cls) || d.grp === "splice" || d.k === "ic" || out[0].stats.includes(d.k) || !rivBaseOf(cls, d.k)) continue;
      const nv = -(d.negBase || rivBaseOf(cls, d.k)) * 1.2 * RIV_PLAN_W * Math.abs(RIV_FORM["3+1"].neg);
      let s = 1, note = d.note || "";
      if (d.eff !== null && d.k !== "x_ammo") {
        s = evalBuild(restB.concat(["__riven"]), top.val, top.arcane, null, effFromStats(posPairs.concat([[d.k, nv]]))).score / withPos;
        if (["heat", "cold", "elec", "tox"].includes(d.k) && s >= 0.97) note = "이 원소 모드를 안 쓰는 세팅이라 무해. 그 원소를 쓰면 치명";
        else if (d.eff && d.eff.bane) note = s >= 0.97 ? "그 팩션 상대만 약해짐 (다른 팩션엔 무해)" : "그 팩션 상대만 약해짐";
        else if (d.k === "x_combochance") note = atk.kind === "melee" ? (s >= 0.97 ? "연속기 배율을 쓰는 모드가 없어 거의 무해" : "연속기가 느리게 쌓여 블러드 러시·위핑 운즈 등이 약해짐") : heavyAtkOf(atk) ? (s >= 0.97 ? "강공 사이에 초기 연속기가 다 차서 거의 무해" : "강공 간격이 짧아 초기 연속기가 덜 찬 채로 터짐") : "";
        else if (d.k === "x_hae") note = heavyAtkOf(atk) ? "" : "강공을 쓰지 않아 무관";
      } else if (d.k === "x_range") note = atk.kind === "melee" ? "휘두르기 사거리만 줄어듦 (계산 미반영, 체감상 불리)" : "투척·폭발에는 영향 없음";
      else if (d.k === "x_ammo") { note = "장기전 탄약 압박 (처치 속도 영향 없음)"; }
      else if (d.k === "x_combodur") note = "연속기 유지 시간만 줄어듦 (계산 미반영)";
      else note = "처치 속도 영향 없음";
      negRows.push({ k: d.k, ko: d.ko, s, note });
    }
    negRows.sort((a, b) => b.s - a.s);
    const grade = (s) => s >= 0.97 ? '<span class="g ok">무해</span>' : s >= 0.85 ? '<span class="g mid">경미</span>' : '<span class="g bad">치명</span>';
    const splice = SPLICE.filter((sp) => sp.cls.includes(cls) && out.some((x) => x.s > 1 && x.stats.includes(sp.out) && (x.form === "3+1" ? best3 : best2).includes(x)));
    return `<section class="card"><h3>리벤 맞추기 가이드</h3>
      <p class="hint">추천 세팅의 한 칸을 리벤으로 바꿨을 때 처치 속도 배율입니다. 수치 범위는 8랭크 기준(현재 성향은 전 무기 1.2 공통)이고, 배율은 각 옵션의 최대치(범위 상한)로 계산했습니다.</p>
      <table class="tbl"><thead><tr><th>구성</th><th>긍정 옵션 (수치 범위)</th><th>대신 뺄 모드</th><th>배율</th></tr></thead><tbody>${best3.map(row).join("")}${best2.map(row).join("")}</tbody></table>
      <h3>부정 옵션 고르기 (1순위 조합 기준)</h3>
      <table class="tbl"><thead><tr><th>부정 옵션</th><th>영향</th><th>판정</th><th>메모</th></tr></thead><tbody>
      ${negRows.map((x) => `<tr><td>${esc(x.ko)}</td><td class="num">${pctDelta(x.s)}</td><td>${grade(x.s)}</td><td><small>${esc(x.note)}</small></td></tr>`).join("")}</tbody></table>
      ${negRows[0] && negRows[0].s > 1.0005 ? `<p class="hint">부정으로 붙으면 오히려 빨라지는 옵션: <b>${esc(negRows[0].ko)}</b> (${pctDelta(negRows[0].s)})${negRows[0].k === "cc" && ncOf(atk) ? " — 비치명타 공격에 붙는 피해 보너스(인카논 진화 등)가 있어서, 치명타가 덜 터질수록 그 보너스가 더 자주 붙습니다" : ["impact", "punct", "slash"].includes(negRows[0].k) ? " — 물리 피해가 줄어든 만큼 상태이상이 원소 쪽(이 세팅의 핵심 상태이상)에 더 자주 걸립니다 (물리 피해 희석 감소)" : ""}. '처음부터 리벤 전제' 세팅도 이 부정 옵션으로 계산합니다.</p>` : ""}
      ${splice.length ? `<h3>접합이 필요한 옵션</h3>${splice.map((sp) => spliceNeedHtml(sp, cls)).join("")}
        <p class="hint">접합(Update 44.1, 위키 "Riven Splicer"): 재료 두 옵션이 사라지고 접합 옵션과 무작위 옵션 하나가 생깁니다. 접합 옵션은 항상 긍정이고, 재료 중 하나가 부정이었으면 새로 생기는 무작위 옵션이 부정이 됩니다 (긍정·부정 개수 유지). <b>접합 옵션의 수치는 두 재료 중 무작위 값(범위 안에서의 위치)이 더 높은 쪽을 그대로 이어받습니다.</b> 부정 재료는 실제 값이 쓰여서 <b>절댓값이 클수록 높은 값</b>입니다 — 리벤 시세 도구들은 부정을 뒤집어 "작을수록 좋음"으로 보여 주니 주의하세요. 리벤 하나에 접합은 하나만, 접합 옵션은 잠긴 상태로 남지만 특성 잠금처럼 재순환 쿠바가 두 배가 되지 않아 다른 옵션 하나를 따로 잠글 수 있습니다. 리벤 스플라이서는 "빙하의 속박" 미션 보상(주 3개)입니다.</p>` : ""}
      <p class="hint">진행 순서: ① 3긍1부가 뜨면 1순위 옵션을 잠그고 재순환 → ② 부정 옵션은 위 "무해" 중에서 → ③ 수치는 범위 하한만 넘으면 성능 차이 10% 이내입니다.</p>
    </section>`;
  }

  // plan mode: riven-free best vs "swap one mod of it for the riven" vs "build around the riven from the start"
  function rivenPremiseSection(R, top, r0) {
    const o = R.o, ref = r0.score, plan = R.rivPlan, B = R.rivBest;
    const mult = 1.2 * RIV_PLAN_W * RIV_FORM["3+1"].pos;
    const g = plan.out.find((x) => x.form === "3+1");
    if (!g) return "";
    const gEff = {}; for (const k of g.stats) gEff[k] = plan.table[k] * mult;
    const gInfo = g.stats.map((k) => ({ k, v: gEff[k], inc: true }));
    const swapIds = top.ids.map((id) => id === g.slot ? "__riven" : id);
    const rSwap = evalBuild(swapIds, top.val, top.arcane, null, gEff, null);
    const rFull = evalBuild(B.top.ids, B.top.val, B.top.arcane, null, B.riv.eff);
    const crowd = o.scenario === "crowd";
    const tcell = (rr) => o.factions.map((f) => `<div class="fl"><span>${E.FACTIONS[f].label}</span>${crowd ? sec(rr.perF[f].clear) : rr.perF[f].one ? "한 방" : sec(rr.perF[f].ttk)}</div>`).join("");
    const rows = [
      { n: "① 리벤 없이 짠 추천 세팅", d: "위 추천 세팅 그대로", ids: top.ids, rr: r0, riv: null },
      { n: "② ①에서 한 칸만 리벤으로 교체", d: `${modName(g.slot)} 대신 리벤 (아래 가이드 1순위)`, ids: swapIds, rr: rSwap, riv: gInfo },
      { n: "③ 처음부터 리벤을 넣고 다시 짠 세팅", d: "리벤을 고정하고 나머지 칸·익실러스·베일런스·아케인을 전부 다시 고름" + (B.top.val && (!top.val || B.top.val.type !== top.val.type) ? ` · 베일런스 ${TYPE_KO[B.top.val.type]}` : "") + (B.top.arcane !== top.arcane ? ` · 아케인 ${B.top.arcane ? ARC[B.top.arcane].ko : "없음"}` : ""), ids: B.top.ids, rr: rFull, riv: B.riv.info },
    ];
    const changed = B.top.ids.filter((id) => id !== "__riven" && !top.ids.includes(id));
    const dropped = top.ids.filter((id) => !B.top.ids.includes(id));
    const k3 = rFull.score / Math.max(1e-9, rSwap.score);
    // every riven combo that was searched again from scratch: which one to roll for
    const alts = (R.rivAlts || []).map((a) => ({ a, rr: evalBuild(a.top.ids, a.top.val, a.top.arcane, null, a.riv.eff) })).sort((x, y) => y.rr.score - x.rr.score);
    const altTable = alts.length > 1 ? `<h4>어떤 리벤을 노릴까 — 옵션 조합별 최고 세팅</h4>
      <p class="hint">조합마다 리벤을 고정하고 나머지 칸을 처음부터 다시 짠 결과입니다. 3% 안쪽 차이는 사실상 같은 등급이라, 그중 뽑기 쉬운 쪽을 노리면 됩니다.</p>
      <table class="tbl cmp"><thead><tr><th>리벤 긍정 옵션</th><th>처치 속도<br><small>① = 100%</small></th><th>모드</th></tr></thead><tbody>
      ${alts.map((x) => `<tr><td class="sname">${esc(x.a.riv.info.filter((y) => !y.k.startsWith("x_")).map((y) => RIV_KO[y.k] || y.k).join(" + "))}<br><small class="els">${finalElements(x.rr)}</small></td><td class="num"><span class="big">${pct(x.rr.score / ref, 0)}</span></td><td class="modlist">${diffMods(x.a.top.ids, top.ids)}</td></tr>`).join("")}
      </tbody></table>` : "";
    return `<section class="card"><h3>리벤을 맞춘다면 — 전제별 최고 세팅 비교</h3>
      <table class="tbl cmp"><thead><tr><th>세팅</th><th>처치 속도<br><small>① = 100%</small></th><th>${o.level}레벨 ${crowd ? "12명 전멸" : "처치"}</th><th>모드</th></tr></thead><tbody>
      ${rows.map((x) => `<tr><td class="sname"><b>${esc(x.n)}</b><br><small>${esc(x.d)}</small>${x.riv ? `<br><small>리벤: ${esc(rivenText(x.riv))}</small>` : ""}<br><small class="els">${finalElements(x.rr)} · ${capInfo(x.ids, x.riv ? (x === rows[1] ? gEff : B.riv.eff) : null).short}</small></td>
        <td class="num"><span class="big">${pct(x.rr.score / ref, 0)}</span></td><td>${tcell(x.rr)}</td><td class="modlist">${diffMods(x.ids, top.ids)}</td></tr>`).join("")}
      </tbody></table>
      <p>${k3 > 1.005 && !changed.length ? `처음부터 리벤을 전제로 짜도 모드는 한 칸만 바꾼 세팅과 같고, 리벤 옵션 차이(${esc(B.riv.info.filter((x) => x.v > 0).map((x) => x.k).sort().join() === g.stats.slice().sort().join() ? B.riv.info.filter((x) => x.v < 0).map((x) => "부정 " + RIV_KO[x.k]).join(", ") : "옵션 조합")}) 때문에 <b>×${k3.toFixed(2)}</b> 빠릅니다. 리벤이 생기면 ${esc(modName(g.slot))} 자리에 넣으면 됩니다.` : k3 > 1.005 ? `처음부터 리벤을 전제로 짜면 한 칸만 바꾸는 것보다 <b>×${k3.toFixed(2)}</b> 더 빠릅니다. 리벤이 생기면 ${dropped.filter((id) => id !== g.slot).length ? `<b>${dropped.filter((id) => id !== g.slot).map(modName).map(esc).join(", ")}</b>도 빼고 ` : ""}<b>${changed.map(modName).map(esc).join(", ") || "-"}</b>${changed.length ? "을(를) 넣는" : ""} 쪽이 좋습니다.` : `처음부터 리벤을 전제로 짜도 한 칸만 바꾼 세팅과 거의 같습니다 (×${k3.toFixed(2)}). 리벤이 생기면 ${esc(modName(g.slot))} 자리에만 넣으면 됩니다.`}</p>
      ${altTable}
      <p class="hint">리벤 수치는 3긍정 1부정 리벤의 각 옵션 최대치(범위 상한)로 가정했습니다 (부정은 이 세팅을 가장 빠르게 만드는 옵션 — 없으면 피해 계산에 영향 없는 옵션). ③은 한 칸 교체 기준 상위 리벤 옵션 조합 네 가지로 각각 나머지 칸·베일런스·아케인까지 다시 짜 본 뒤 가장 빠른 쪽입니다. 실제로 뽑은 리벤이 생기면 리벤 모드를 "보유 리벤 고정"으로 바꿔 그 수치로 계산하세요.</p></section>`;
  }
  function ownedRivenSection(owned, R, top) {
    const inc = owned.info.filter((x) => x.inc), exc = owned.info.filter((x) => !x.inc);
    const txt = (x) => { const d = RIV_D[x.k] || {}; return `${RIV_KO[x.k] || x.k} ${x.v < 0 ? "−" : ""}${rivVal(x.k, x.v)}${d.eff === null ? " (처치 속도 영향 없음)" : d.note ? ` (${d.note})` : ""}`; };
    let grade = "";
    if (R && R.free && R.free.length) {
      // grade: the owned riven against the best riven worth rolling, both swapped into the same riven-free build
      const F = R.free[0], refF = evalBuild(F.ids, F.val, F.arcane).score;
      const slots = F.ids.filter((id) => !(MOD_BY_ID[id] && MOD_BY_ID[id].exilus));
      let bestSlot = null, sOwn = 0;
      for (const id of slots) { const v = evalBuild(F.ids.filter((x) => x !== id).concat(["__riven"]), F.val, F.arcane, null, owned.eff).score / refF; if (v > sOwn) { sOwn = v; bestSlot = id; } }
      const plan = (R.rivPlanFree && R.rivPlanFreeTop === F) ? R.rivPlanFree : rivenCombos(F, refF);
      R.rivPlanFree = plan; R.rivPlanFreeTop = F;
      const best = plan.out.find((x) => x.form === "3+1");
      const full = top.score && R.free[0].score ? evalBuild(top.ids, top.val, top.arcane).score / refF : null;
      // what each positive stat of the owned riven is worth (taken out one at a time)
      const rest = F.ids.filter((x) => x !== bestSlot).concat(["__riven"]);
      const per = inc.filter((x) => x.v > 0 && RIV_D[x.k] && RIV_D[x.k].eff !== null).map((x) => {
        const e = effFromStats(inc.filter((y) => y !== x).map((y) => [y.k, y.v]));
        const v = evalBuild(rest, F.val, F.arcane, null, e).score / refF;
        return { x, loss: sOwn / v };
      }).sort((a, b) => b.loss - a.loss);
      const ratio = best ? sOwn / best.s : null;
      const verdict = ratio == null ? "" : ratio >= 0.95 ? "종결급 — 수치만 다듬으면 됩니다" : ratio >= 0.85 ? "좋음 — 그대로 써도 충분합니다" : ratio >= 0.7 ? "쓸 만함 — 아래 잠금 옵션을 고정하고 재순환을 노려 볼 만합니다" : "약함 — 재순환을 권합니다";
      grade = `<div class="kv">${kv("리벤 한 칸 효과", "×" + sOwn.toFixed(2))}${best ? kv("최고 리벤(3긍1부 최대치)", "×" + best.s.toFixed(2)) : ""}${ratio != null ? kv("최고 대비", pct(ratio, 0)) : ""}${full ? kv("리벤 넣고 다시 짠 세팅", "×" + full.toFixed(2)) : ""}</div>
        ${verdict ? `<p><b>${verdict}</b>${best ? ` · 최고 조합: ${best.stats.map((k) => RIV_KO[k]).join(" + ")}` : ""}</p>` : ""}
        ${per.length ? `<table class="tbl"><thead><tr><th>옵션</th><th>빼면</th><th>판단</th></tr></thead><tbody>${per.map((p, i) => `<tr><td>${esc(txt(p.x))}</td><td class="num">${pctDelta(1 / p.loss)}</td><td>${i === 0 && per.length > 1 ? '<span class="g ok">잠금 추천</span>' : p.loss < 1.03 ? '<span class="g bad">재순환 대상</span>' : '<span class="g mid">유지</span>'}</td></tr>`).join("")}</tbody></table>
        <p class="hint">"빼면"은 그 옵션만 없을 때 리벤 칸 효과의 변화입니다. 재순환할 때는 가장 큰 옵션을 특성 잠금(Update 44.0, 쿠바 두 배)하고 돌리세요. 접합(Update 44.1)으로 쓸모없는 옵션 두 개를 복합 원소 하나로 바꾸는 방법도 있습니다.</p>` : ""}`;
    }
    return `<section class="card"><h3>보유 리벤 평가</h3>
      <p>반영한 옵션: <b>${inc.map(txt).join(", ") || "없음"}</b>${exc.length ? ` · 반영하지 않은 옵션(재순환 예정): ${exc.map(txt).join(", ")}` : ""}</p>
      ${grade}
      <p class="hint">위 추천 세팅은 리벤을 한 칸에 고정하고 나머지 7칸을 다시 최적화한 결과입니다. 평가는 리벤 없이 짠 최고 세팅의 한 칸을 이 리벤으로 바꿨을 때와, 계산기가 추천하는 최고 리벤으로 바꿨을 때를 비교합니다.</p></section>`;
  }

  const placeholder = () => `<div class="placeholder"><h3>준비됐습니다</h3><p>왼쪽에서 무기와 상황을 고른 뒤 <b>최적 세팅 계산</b>을 누르세요. 장착 가능한 모드 전부를 후보로 넣고(모두 보유 전제) 가장 빨리 죽이는 조합을 찾습니다. 무기 하나에 10~60초 걸립니다.</p></div>`;

  /* ---------------- events ---------------- */
  function bind() {
    $("#wsearch").addEventListener("input", renderWeaponList);
    $$(".slot-tabs button").forEach((b) => b.addEventListener("click", () => { $$(".slot-tabs button").forEach((x) => x.classList.remove("on")); b.classList.add("on"); renderWeaponList(); }));
    $("#wlist").addEventListener("click", (e) => { const b = e.target.closest(".witem"); if (!b) return; const w = WEAPONS.find((x) => x.id === b.dataset.id); if (w) selectWeapon(w); });
    $("#atk").addEventListener("change", (e) => { st.atk = +e.target.value; evolve(); renderAll(); });
    $("#runbtn").addEventListener("click", run);
    $("#addset").addEventListener("click", () => { addSet(); const l = $("#sets").lastElementChild; if (l) l.querySelector(".cm").focus(); });
    $("#valpct").addEventListener("input", (e) => { $("#valpctv").textContent = e.target.value + "%"; });
    ["#scenario", "#objective", "#level", "#steel"].forEach((s) => $(s).addEventListener("change", renderTargets));
    $("#scenario").addEventListener("change", syncEnemySeg);
    $$("#enemyseg button").forEach((b) => b.addEventListener("click", () => setEnemy(b.dataset.v)));
    initConcepts();
    $("#rivmode").addEventListener("change", (e) => { $("#rivowned").hidden = e.target.value !== "owned"; });
    $("#frame").addEventListener("change", renderAbilities);
    $("#aura").addEventListener("change", renderFrameStats);
    $("#helminth").addEventListener("change", renderFrameStats);
    ["#strength", "#duration", "#range", "#efficiency", "#energy", "#armor", "#health", "#shield", "#sprint"].forEach((s) => $(s).addEventListener("input", renderFrameStats));
    $("#statincl").addEventListener("change", renderFrameStats);
    initFrameOcr();
    FA_NOTE = $("#fanote").innerHTML;
    $("#falist").innerHTML = Object.values(FRAME_ARC).slice().sort((a, b) => a.ko.localeCompare(b.ko, "ko")).map((v) => `<option value="${esc(v.ko)}"></option>`).join("");
    for (const id of ["#fa0", "#fa1"]) {
      const el = $(id);
      const fix = () => {
        const m = resolveFA(el.value); if (m) el.value = m.ko; el.classList.toggle("fa-ok", !!m); el.classList.toggle("fa-bad", !!el.value.trim() && !m);
        const pk = pickedFA();
        $("#fanote").innerHTML = pk.length ? pk.map((id) => { const A = FRAME_ARC[id]; return `<b>${esc(A.ko)}</b> ${A.ind ? `<span class="tag">입력값으로 간접 반영</span> <small>${esc(A.note)}</small>` : A.kind === "none" ? '<span class="tag">계산 영향 없음</span>' : A.manual ? '<span class="tag cond">조건부</span>' : ""}<br><small>${esc((A.kd || []).join(" ").replace(/\n/g, " "))}</small>`; }).join("<br>") : FA_NOTE;
        renderFrameStats();
      };
      el.addEventListener("change", fix); el.addEventListener("blur", fix);
    }
    renderRivenSelects();
  }

  /* ---------------- share link + error report ---------------- */
  // The link carries every input (weapon, attack, all settings, element concept, comparison sets) in the address after "#s=".
  // Opening it restores the inputs and runs the calculation, so the same results come back.
  const SHARE_BASE = /github\.io$/.test(location.hostname) ? location.origin + location.pathname : "https://oxford1436.github.io/wf-build-calc/";
  const b64e = (str) => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const b64d = (x) => decodeURIComponent(escape(atob(x.replace(/-/g, "+").replace(/_/g, "/"))));
  const NOSAVE = new Set(["wsearch", "atk", "mkind", "mp1", "mp2", "mp3"]);
  function captureFields() {
    const f = {};
    $$(".rail [id]").forEach((el) => {
      if (NOSAVE.has(el.id) || el.closest("#sets") || el.closest("#concepts")) return;
      if (el.tagName === "SELECT") f[el.id] = el.value;
      else if (el.tagName === "INPUT" && el.type !== "file") f[el.id] = el.type === "checkbox" ? el.checked : el.value;
    });
    return f;
  }
  let F0 = {};      // untouched page defaults: the link only carries what differs
  function captureState() {
    const all = captureFields(), f = {};
    for (const k in all) if (all[k] !== F0[k]) f[k] = all[k];
    const w = st.weapon;
    return {
      v: 1, evo: st.evoManual && Object.keys(st.evoManual).length ? Object.fromEntries(Object.keys(st.evoManual).map((t) => [t, st.evoSel[t]])) : null, w: w.modular ? null : w.id, mod: w.modular ? [w.modular.kind].concat(w.modular.parts) : null, a: st.atk, f,
      ab: $$("#abilities input.abil:checked").map((x) => x.value), mb: $$("#miscbuffs input.mb:checked").map((x) => x.value),
      abp: Object.fromEntries($$("#abilities input.abp").map((x) => [x.dataset.ab, x.value])),
      c: $$("#concepts select").map((x) => x.value),
      s: $$("#sets .cset").map((d) => ({ n: d.querySelector(".cnamein").value, m: $$(".cm", d).map((x) => x.value), x: d.querySelector(".cx").value, ar: d.querySelector(".carc").value,
        rk: $$(".crk", d).map((x) => x.value), rv: $$(".crv", d).map((x) => x.value) })).filter((x) => x.m.some(Boolean) || x.x || x.ar),
    };
  }
  const shareUrl = () => SHARE_BASE + "#s=" + b64e(JSON.stringify(captureState()));
  const fire = (el) => { el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };
  function restoreState(S) {
    let w = null;
    if (S.mod) w = buildModular(...S.mod); else if (S.w) w = WEAPONS.find((x) => x.id === S.w);
    if (!w) return false;
    selectWeapon(w);
    if (S.a != null && w.attacks[S.a]) { st.atk = S.a; evolve(); renderAll(); }
    if (S.evo && st.base && st.base.evos) { st.evoManual = {}; for (const t in S.evo) { st.evoManual[t] = true; st.evoSel[t] = +S.evo[t]; } st.weapon = applyEvos(st.base, st.evoSel); renderAll(); }
    const f = S.f || {};
    const setOne = (id) => {
      const el = document.getElementById(id); if (!el || !(id in f)) return;
      if (el.type === "checkbox") el.checked = !!f[id]; else el.value = f[id];
      fire(el);
    };
    // the frame decides which ability boxes exist, so it goes first; the weapon and the attack were set above
    ["frame", "helminth"].forEach(setOne);
    for (const id in f) if (!["frame", "helminth"].includes(id) && !NOSAVE.has(id)) setOne(id);
    $$("#abilities input.abil").forEach((x) => { x.checked = (S.ab || []).includes(x.value); fire(x); });
    $$("#abilities input.abp").forEach((x) => { if (S.abp && S.abp[x.dataset.ab] != null) { x.value = S.abp[x.dataset.ab]; fire(x); } });
    $$("#miscbuffs input.mb").forEach((x) => { x.checked = (S.mb || []).includes(x.value); fire(x); });
    syncEnemySeg(); renderTargets();
    if (Array.isArray(S.c)) {
      const box = $("#concepts"); box.querySelectorAll("select").forEach((x) => x.remove());
      box.querySelector(".cadd").hidden = false;
      (S.c.length ? S.c : ["", ""]).slice(0, 4).forEach((v) => addConcept(v));
    }
    if (Array.isArray(S.s) && S.s.length) {
      $("#sets").innerHTML = "";
      S.s.slice(0, 5).forEach((x) => {
        addSet();
        const d = $("#sets").lastElementChild;
        const nm = d.querySelector(".cnamein"); nm.value = x.n || nm.value; fire(nm);
        $$(".crk", d).forEach((el, i) => { if (x.rk && x.rk[i] != null) { el.value = x.rk[i]; fire(el); } });
        $$(".crv", d).forEach((el, i) => { if (x.rv && x.rv[i] != null) { el.value = x.rv[i]; fire(el); } });
        $$(".cm", d).forEach((el, i) => { el.value = (x.m || [])[i] || ""; fire(el); });
        for (const [sel, v] of [[".cx", x.x], [".carc", x.ar]]) { const el = d.querySelector(sel); el.value = v || ""; fire(el); }
        d.open = false;
      });
    }
    return true;
  }
  function restoreFromHash() {
    const m = /^#s=([A-Za-z0-9_-]+)/.exec(location.hash);
    if (!m) return;
    let S = null;
    try { S = JSON.parse(b64d(m[1])); } catch (e) { S = null; }
    if (!S || !restoreState(S)) { $("#results").innerHTML = `<div class="placeholder"><h3>공유 링크를 읽지 못했습니다</h3><p>링크가 잘렸거나 지금 데이터에 없는 무기입니다. 무기를 직접 골라 주세요.</p></div>`; return; }
    $("#results").innerHTML = `<div class="placeholder"><h3>공유된 설정으로 계산합니다</h3><p>받은 링크의 무기와 설정을 그대로 불러왔습니다. 계산이 끝나면 결과가 여기에 나옵니다.</p></div>`;
    run();
  }
  async function copyText(text, btn, okMsg) {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
      try { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); ok = document.execCommand("copy"); ta.remove(); } catch (e2) { ok = false; }
    }
    const box = btn.closest(".sharebar").querySelector(".sharemsg");
    if (ok) { box.textContent = okMsg; box.hidden = false; box.classList.remove("manual"); }
    else { box.hidden = false; box.classList.add("manual"); box.innerHTML = `복사가 막혀 있어요. 아래 내용을 직접 복사해 주세요.<textarea readonly rows="6">${esc(text)}</textarea>`; box.querySelector("textarea").select(); }
  }
  function reportText() {
    const CL = window.WF_CHANGELOG || [], R = st.results, o = R ? R.o : readOpts(), w = st.weapon, atk = w.attacks[st.atk];
    const lines = ["[워프레임 세팅 계산기 오류 신고]", `버전: v${CL[0] ? CL[0].v : "?"} · 데이터 ${$("#ver").dataset.built || "?"}`, `링크: ${shareUrl()}`,
      `무기: ${w.ko || w.en} · ${atk.name}`,
      `조건: ${o.scenario === "boss" ? "보스" : o.scenario === "single" ? "중장갑 한 명" : "일반"} · ${o.steel ? "강철의 길 " : ""}${o.level}레벨 · ${$("#objective").selectedOptions[0].textContent.split(" — ")[0]}${o.concept && o.concept.length ? " · 속성 콘셉트 " + o.concept.map((t) => TYPE_KO[t]).join("+") : ""} · 리벤 ${$("#rivmode").selectedOptions[0].textContent.split(" — ")[0]}`];
    if (R && R.res && R.res.length) {
      const top = R.res[0], r = evalBuild(top.ids, top.val, top.arcane);
      lines.push(`추천: ${finalElements(r)} · 아케인 ${top.arcane ? ARC[top.arcane].ko : "없음"}${top.val ? ` · 베일런스 ${TYPE_KO[top.val.type]} ${pct(top.val.pct)}` : ""}`);
      lines.push(`추천 모드: ${top.ids.map(modName).join(", ")}`);
    }
    const sets = $$("#sets .cset").map(setMods).filter((x) => x.ids.length);
    for (const x of sets) lines.push(`비교 ${x.name}: ${x.ids.map(modName).join(", ")}${x.arcane ? " · " + ARC[x.arcane].ko : ""}`);
    lines.push("", "무엇이 이상한가요: (여기에 적어 주세요)");
    return lines.join("\n");
  }
  function shareBarHtml() {
    return `<div class="sharebar"><button type="button" class="ghostbtn" data-share="link">링크 복사</button><button type="button" class="ghostbtn" data-share="report">오류 신고 복사</button>
      <small>링크를 열면 같은 설정으로 다시 계산합니다. 오류 신고는 디스코드에 붙여 넣으면 됩니다.</small><p class="sharemsg" hidden></p></div>`;
  }
  document.addEventListener("click", (e) => {
    const ev = e.target.closest("[data-evo]");
    if (ev) { const [t, i] = ev.dataset.evo.split(":").map(Number); st.evoManual = st.evoManual || {}; st.evoManual[t] = true; st.evoSel[t] = i; st.weapon = applyEvos(st.base, st.evoSel); renderAll(); run(); return; }
    const g = e.target.closest("[data-go]");
    if (g) { const t = document.getElementById(g.dataset.go); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    const b = e.target.closest("[data-share]"); if (!b) return;
    if (b.dataset.share === "link") copyText(shareUrl(), b, "링크를 복사했습니다.");
    else copyText(reportText(), b, "오류 신고 내용을 복사했습니다. 디스코드에 붙여 넣고 '무엇이 이상한가요'를 채워 주세요.");
  });

  /* ---------------- version + patch notes tab (#patch) ---------------- */
  function renderVersion() {
    const CL = window.WF_CHANGELOG || [];
    const cur = CL[0], built = $("#ver").dataset.built;
    $("#ver").innerHTML = cur ? `<b>v${esc(cur.v)}</b> · ${esc(cur.date)} 수정${built && /^\d{4}-/.test(built) ? ` · 데이터 ${esc(built)} 갱신` : ""}` : "";
    $("#patchview").innerHTML = `<section class="card"><h3>패치 내역</h3><p class="hint" style="margin:0">계산기를 고칠 때마다 버전을 올리고 여기에 기록합니다. 게임 데이터(무기·모드 수치)는 매주 월요일 자동으로 최신화되며 버전은 그대로입니다.</p></section>`
      + CL.map((x, i) => `<section class="card${i === 0 ? " cur" : ""}"><h3><span class="pv">v${esc(x.v)}</span>${esc(x.title)}<span class="pd">${esc(x.date)}${i === 0 ? " · 현재 버전" : ""}</span></h3><ul>${x.items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></section>`).join("");
  }
  function showView() {
    const view = location.hash === "#patch" ? "patch" : /^#frames/.test(location.hash) ? "frames" : "calc";
    $("#patchview").hidden = view !== "patch"; $("#calcview").hidden = view !== "calc"; $("#guideview").hidden = view !== "frames";
    if (view === "frames" && window.WF_renderGuide) window.WF_renderGuide($("#guideview"));
    $$(".viewtabs a").forEach((a) => { const on = a.dataset.view === view; a.classList.toggle("on", on); a.setAttribute("aria-selected", on ? "true" : "false"); });
  }
  $$(".viewtabs a").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    const h = a.dataset.view === "patch" ? "#patch" : a.dataset.view === "frames" ? "#frames" : "";
    if (location.hash !== h) history.pushState(null, "", h || location.pathname + location.search);
    showView(); window.scrollTo(0, 0);
  }));
  window.addEventListener("popstate", showView);
  window.addEventListener("hashchange", showView);
  renderVersion();
  showView();

  renderFrameList();
  renderMisc();
  renderModular();
  try { const sv = JSON.parse(localStorage.getItem("wfopt2") || "null"); if (sv && sv.mod) { const w = buildModular(...sv.mod); if (w) { st.weapon = w; st.atk = 0; } } } catch (e) {}
  bind();
  st.base = st.weapon;
  // the evolution auto-pick reads the shard/aura inputs, so they must exist before an Incarnon weapon is restored
  renderShards(); renderAuras();
  if (st.weapon.exalted || st.weapon.evos) selectWeapon(st.weapon); else renderAll();
  renderFrameStats();
  F0 = captureFields();
  // read-only handle for checking results from the browser console / test scripts
  // test/automation handle (scripts/regress.js, scripts/community_check.js): arcAuto = the arcanes the 'auto' option compares
  window.WF_APP = { effFromStats, RIV_PLAN_W, rivPlanVal: (cls, k, form) => rivBaseOf(cls, k) * 1.2 * RIV_PLAN_W * RIV_FORM[form].pos, st, evalBuild, candidateMods, MOD_BY_ID, readOpts, parseRiven, buildModular, defaultAttack, applyEvos, boundAlts, boundCheck, renderResults, betterEvo, autoEvo,
    arcAuto: (w) => arcanesFor(w).filter(([, x]) => !x.manual && !x.none && !x.aim).map(([k]) => k).concat([null]) };
  restoreFromHash();
})();
