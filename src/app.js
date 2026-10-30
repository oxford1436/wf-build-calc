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
  const RIV_KO = { dmg: "피해", ms: "멀티샷", cc: "치명타 확률", cd: "치명타 피해", heat: "화염", cold: "냉기", elec: "전기", tox: "독", sc: "상태이상 확률", sd: "상태이상 피해 (접합 전용)", dur: "상태이상 지속시간", fr: "연사력/공격 속도", ic: "초기 연속기", impact: "충격", punct: "관통", slash: "베기", reload: "재장전 속도", mag: "탄창 용량" };
  const RIV_FORM = { "3+1": { pos: 0.9375, neg: -0.75, ko: "3긍정 1부정" }, "2+1": { pos: 1.2375, neg: -0.495, ko: "2긍정 1부정" }, "3+0": { pos: 0.75, neg: 0, ko: "3긍정" }, "2+0": { pos: 0.99, neg: 0, ko: "2긍정" } };
  // riven stats outside the damage formula (for negative-option grading); base magnitudes at 1.0 disposition.
  // RIV_HEAVY ones still feed the heavy-attack combo model (combo count chance, heavy attack efficiency)
  const RIV_OTHER = {
    gun: [["zoom", "확대율", 0.6], ["recoil", "반동", 0.9], ["ammo", "최대 탄약", 0.9], ["pt", "관통력", 2.7], ["speed", "투사체 속도", 0.9], ["faction", "특정 팩션 피해", 0.55]],
    melee: [["finisher", "마무리 일격 피해", 1.2], ["slidecc", "슬라이드 공격 치명타 확률", 1.2], ["combodur", "연속기 지속시간", 8.1], ["combochance", "연속기 획득 확률", 1.02], ["range", "사거리", 1.2], ["hae", "강공 효율", 0.73], ["faction", "특정 팩션 피해", 0.55]],
  };
  const RIV_HEAVY = { combochance: "ccc", hae: "hae" };
  const SPLICE = [
    { out: "sd", ko: "상태이상 피해", need: ["피해", "상태이상 확률"], cls: ["rifle", "shotgun", "pistol", "melee"] },
    { out: "wpd", ko: "약점 피해", need: ["피해", "확대율 또는 멀티샷"], cls: ["rifle", "shotgun", "pistol"] },
    { out: "wpcc", ko: "약점 치명타 확률", need: ["치명타 확률", "확대율 또는 멀티샷"], cls: ["rifle", "shotgun", "pistol"] },
    { out: "ammoeff", ko: "탄약 효율 (상한 75%)", need: ["탄창 용량+재장전 속도", "또는 반동+최대 탄약"], cls: ["rifle", "shotgun", "pistol"] },
  ];
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
    const res = E.optimize(d.weapon, d.weapon.attacks[d.atk], cands, opts, { slots: 8, beam: j.beam || d.beam, locked, valOptions: j.valOptions || d.valOptions, arcOptions: j.arcOptions || d.arcOptions },
      p => self.postMessage({ type: "progress", p: (done + p) / jobs.length }));
    out.push({ tag: j.tag, res: res.slice(0, 40).map(r => ({ ids: r.mods.map(m => m.id), score: r.score, val: r.val, arcane: r.arcane })) });
    done++;
  }
  self.postMessage({ type: "done", out });
};`;
  let worker = null;
  const getWorker = () => worker || (worker = new Worker(URL.createObjectURL(new Blob([workerSrc], { type: "text/javascript" }))));

  /* ---------------- state ---------------- */
  const st = { weapon: WEAPONS.find((w) => w.id === "coda_pathocyst") || WEAPONS[0], atk: 0, results: null };
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
  function defaultAttack(w) {
    const a = w.attacks;
    let i = a.findIndex((x) => x.kind === "glaive" && /Recall/.test(x.en));
    if (i < 0) i = a.findIndex((x) => x.parts && !x.primer);
    if (i < 0) i = a.findIndex((x) => x.kind === "gun" && x.en === "Normal Attack");
    if (i < 0) i = a.findIndex((x) => x.kind === "melee");
    return Math.max(0, i);
  }

  /* ---------------- weapon panel ---------------- */
  function renderWeaponList() {
    const q = $("#wsearch").value.trim().toLowerCase();
    const slot = $(".slot-tabs .on")?.dataset.slot || "all";
    $("#wcount").textContent = WEAPONS.length + "종";
    const list = WEAPONS.filter((w) => (slot === "all" || w.slot === slot) && (!q || (w.ko || "").toLowerCase().includes(q) || (w.en || "").toLowerCase().includes(q))).slice(0, 80);
    $("#wlist").innerHTML = list.map((w) => `<button type="button" class="witem${w === st.weapon ? " on" : ""}" data-id="${w.id}"><span class="wko">${esc(w.ko || w.en)}</span><span class="wen">${esc(w.en || "")}</span><span class="wcls">${w.exalted ? "익절티드 · " : ""}${w.sub === "glaive" ? "글레이브" : TYPE_LABEL[w.type] || CLS_KO[w.cls] || w.cls}${w.valence ? " · 베일런스" : ""}</span></button>`).join("") || `<p class="empty">검색 결과가 없습니다.</p>`;
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
    st.weapon = w; st.atk = defaultAttack(w); st.results = null; save();
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
    $("#atkdesc").textContent = (atk.desc || "") + (w.exalted ? ` ${exaltedNote(w)}` : "");
    $("#atkstats").innerHTML = atkStatsHtml(atk);
    $("#valrow").hidden = !w.valence;
    renderElemOrder(w);
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
      if (m.group && x.group === m.group) return { slot: i + 1, mod: x, same: false };
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
  document.addEventListener("paste", (e) => {
    const files = [...((e.clipboardData && e.clipboardData.files) || [])].filter((x) => /^image\//.test(x.type));
    if (!files.length) return;
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
      if (m.group && ids.some((x) => MOD_BY_ID[x] && MOD_BY_ID[x].group === m.group)) continue;
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
    const base = Object.entries(RIV_KO).filter(([k]) => k !== "sd" && !(k === "ic" && cls !== "melee") && !(k === "ms" && cls === "melee")).map(([k, v]) => `<option value="${k}">${v}</option>`).join("") + `<option value="sd">상태이상 피해 (접합)</option>`;
    const other = (cls === "melee" ? RIV_OTHER.melee : RIV_OTHER.gun).map(([k, v]) => `<option value="x_${k}">${v} (${k === "combochance" ? "연속기 쌓는 속도에 반영" : k === "hae" ? "강공 계산에 반영" : "계산 영향 없음"})</option>`).join("");
    return `<option value="">—</option>` + base + other;
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
      const val = (i === 3 ? -1 : 1) * (k === "ic" ? Math.abs(v) : Math.abs(v) / 100);
      info.push({ k, v: val, inc });
      if (inc && !k.startsWith("x_") && k in RIV_KO) r[k] = (r[k] || 0) + val;
      else if (inc && RIV_HEAVY[k.slice(2)]) { const e = RIV_HEAVY[k.slice(2)]; r[e] = (r[e] || 0) + val; }
    });
    return { eff: r, info };
  }
  function setRiven(d) {
    const ks = [...d.querySelectorAll(".crk")], vs = [...d.querySelectorAll(".crv")];
    return parseRiven(ks.map((el, i) => ({ k: el.value, v: +vs[i].value, inc: true })));
  }
  const rivenText = (info) => info.map((x) => `${x.v < 0 ? "부정 " : ""}${RIV_KO[x.k] || (RIV_OTHER.gun.concat(RIV_OTHER.melee).find((o) => "x_" + o[0] === x.k) || [0, x.k])[1]} ${x.v > 0 ? "+" : "−"}${x.k === "ic" ? Math.abs(x.v).toFixed(0) : pct(Math.abs(x.v), Math.abs(Math.round(x.v * 1000) % 10) ? 1 : 0)}`).join(", ");

  /* ---------------- frames ---------------- */
  const pickedMisc = () => $$("#miscbuffs .mb:checked").map((el) => (BUFFS.misc || []).find((x) => x.id === el.value)).filter(Boolean);
  function renderMisc() {
    $("#miscbuffs").innerHTML = (BUFFS.misc || []).map((M) => `<label class="inline"><input type="checkbox" class="mb" value="${M.id}"><span><b>${esc(M.ko)}</b> <small>${esc(M.note)}</small></span></label>`).join("");
    $$("#miscbuffs .mb").forEach((el) => el.addEventListener("change", renderFrameStats));
  }
  const auraOk = (A, w) => (!A.cls || A.cls.includes(w.cls)) && typeOk(A, w);
  const pickedAura = () => (BUFFS.auras || []).find((x) => x.id === $("#aura").value) || null;
  function renderAuras() {
    const cur = $("#aura").value;
    $("#aura").innerHTML = `<option value="">없음</option>` + (BUFFS.auras || []).map((A) => `<option value="${A.id}">${esc(A.ko)} — ${esc(A.note)}${auraOk(A, st.weapon) || A.stat ? "" : " (이 무기엔 효과 없음)"}</option>`).join("");
    $("#aura").value = cur;
  }
  function renderFrameList() {
    $("#frame").innerHTML = `<option value="">선택 안 함 (모든 워프레임 범용)</option>` + FRAMES.map((f) => `<option value="${f.id}">${esc(f.ko)}</option>`).join("");
    const hel = Object.entries(BUFFS.abilities).filter(([k, v]) => v.helminth && v.fx);
    $("#helminth").innerHTML = `<option value="">없음</option>` + hel.map(([k, v]) => `<option value="${k}">${esc(v.ko)}</option>`).join("");
  }
  function renderAbilities() {
    const f = FRAMES.find((x) => x.id === $("#frame").value);
    const box = $("#abilities");
    $("#framestats").hidden = !f && !$("#helminth").value;
    if (f && f.power) $("#energy").value = Math.round(f.power);
    if (!f) { box.innerHTML = ""; renderFrameStats(); return; }
    box.innerHTML = f.abilities.map((a) => {
      const b = BUFFS.abilities[a.en];
      const augs = ((BUFFS.augments || {})[a.en] || []).map((k) => { const x = BUFFS.abilities[k]; return `<label class="inline aug"><input type="checkbox" class="abil" value="${esc(k)}"><span><b>${esc(x.ko)}</b> <small>${esc(x.note || "")}</small><small class="abilcalc" data-ab="${esc(k)}"></small></span></label>`; }).join("");
      if (b && b.fx) return `<label class="inline"><input type="checkbox" class="abil" value="${esc(a.en)}"><span><b>${esc(a.ko)}</b> <small>${esc(b.note || "")}</small><small class="abilcalc" data-ab="${esc(a.en)}"></small></span></label>` + augs;
      return `<div class="abil-off"><b>${esc(a.ko)}</b> <small>${b && b.note ? esc(b.note) : "무기 피해 계산에 영향 없음"}</small></div>` + augs;
    }).join("");
    $$("#abilities .abil").forEach((el) => el.addEventListener("change", renderFrameStats));
    renderFrameStats();
  }
  function shardPicks() {
    const out = [];
    for (let i = 0; i < 5; i++) { const id = $("#sh" + i).value; if (!id) continue; const s = BUFFS.shards.find((x) => x.id === id); if (s) out.push({ s, t: $("#tau" + i).checked }); }
    return out;
  }
  function frameStats(faIds) {
    const st_ = { str: (+$("#strength").value || 100) / 100, dur: (+$("#duration").value || 100) / 100, rng: (+$("#range").value || 100) / 100, eff: (+$("#efficiency").value || 100) / 100, energy: +$("#energy").value || 300 };
    for (const p of shardPicks()) if (p.s.kind === "stat") for (const k in p.s.stat) st_[k] += p.s.stat[k][p.t ? 1 : 0];
    const au = pickedAura();
    if (au && au.stat) for (const k in au.stat) st_[k] += au.stat[k];
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
    $("#framestats").hidden = !$("#frame").value && !$("#helminth").value && !pickedFA().length;
    if (st.weapon && st.weapon.exalted) $("#atkdesc").textContent = (st.weapon.attacks[st.atk].desc || "") + " " + exaltedNote(st.weapon);
    $("#statline").textContent = `샤드·아케인 반영 후: 위력 ${Math.round(s.str * 100)}% · 지속 ${Math.round(s.dur * 100)}% · 범위 ${Math.round(s.rng * 100)}% · 효율 ${Math.round(s.eff * 100)}% · 최대 에너지 ${Math.round(s.energy)}`;
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
    const take = (b, h) => {
      let e = b.fx(s, h, st.weapon);
      if (b.gunOnly && st.weapon.cls === "melee") return;
      if (b.area && scenario === "crowd") e = BUFFS.scale(e, Math.min(1, (b.area(s) / 20) ** 2));
      list.push(e);
    };
    $$("#abilities .abil:checked").forEach((el) => { const b = BUFFS.abilities[el.value]; if (b && b.fx) take(b, false); });
    const hk = $("#helminth").value;
    if (hk && BUFFS.abilities[hk] && BUFFS.abilities[hk].fx) take(BUFFS.abilities[hk], true);
    const picks = shardPicks();
    const cnt = { cav: picks.filter((p) => ["crimson", "azure", "violet"].includes(p.s.color)).length };
    for (const p of picks) if (p.s.kind === "weapon" && (p.s.slot === "any" || p.s.slot === st.weapon.slot)) list.push(p.s.fx(p.t, cnt, s));
    const au = pickedAura();
    if (au && au.fx && auraOk(au, st.weapon)) list.push(au.fx);
    for (const M of pickedMisc()) if (M.fx) { let e = M.fx(st.weapon); if (M.area && scenario === "crowd") e = BUFFS.scale(e, Math.min(1, (M.area / 20) ** 2)); list.push(e); }
    const xs = Math.max(0, Math.min(10, +$("#extstatus").value || 0));
    if (xs) list.push({ statusExtra: xs });
    const ext = BUFFS.merge(list);
    ext.active = list.length > 0;
    if (st.weapon.cls === "melee") ext.cdMult = 1;
    ext.maxEnergy = s.energy;
    return ext;
  }
  function buffSummary() {
    const names = [];
    $$("#abilities .abil:checked").forEach((el) => names.push(BUFFS.abilities[el.value].ko));
    const hk = $("#helminth").value; if (hk) names.push("헬민스 " + BUFFS.abilities[hk].ko);
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

  /* ---------------- run ---------------- */
  function run() {
    const w = st.weapon, atk = w.attacks[st.atk];
    const o = readOpts();
    const flags = { aim: o.aim, cast: o.casting, boss: o.scenario === "boss" };
    const cands = candidateMods(w, atk, flags).map((m) => m.id);
    const owned = ownedRiven();
    const locked = owned ? ["__riven"] : [];
    const jobs = [{ tag: "main" }];
    if (o.ext.active || o.frameArcs.length) jobs.push({ tag: "nobuff", optsPatch: { ext: {}, frameArcs: [], hs: $("#aimmods").checked && w.cls !== "melee" ? 0.5 : 0 } });
    $("#runbtn").disabled = true; $("#progress").hidden = false; $("#progress .bar").style.width = "0%";
    const wk = getWorker();
    wk.onmessage = (ev) => {
      if (ev.data.type === "progress") { $("#progress .bar").style.width = (ev.data.p * 100).toFixed(0) + "%"; return; }
      const out = {}; for (const x of ev.data.out) out[x.tag] = x.res;
      st.results = { res: out.main, nobuff: out.nobuff || null, o, owned, flags };
      if ($("#rivmode").value === "plan" && !w.noRiven && out.main && out.main.length) { planRivenPhase(wk, w, o, cands, jobs.some((j) => j.tag === "nobuff")); return; }
      $("#runbtn").disabled = false; $("#progress").hidden = true;
      renderResults();
      $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
    };
    wk.onerror = (e) => { $("#runbtn").disabled = false; $("#progress").hidden = true; $("#results").innerHTML = `<div class="placeholder"><h3>계산 중 오류</h3><p>${esc(e.message)}</p></div>`; };
    wk.postMessage({ weapon: JSON.parse(JSON.stringify(w)), atk: st.atk, opts: o, cands, locked, beam: 100, valOptions: valOptions(), arcOptions: arcOptions(), riven: owned ? owned.eff : null, jobs });
  }

  // "맞출 예정": after the riven-free search, give the build the best riven worth rolling (3 positives at the middle of
  // their range + a harmless negative) and search the other slots again with it locked — so the recommendation and the
  // comparison table already include the riven
  function planRivenPhase(wk, w, o, cands, hadNobuff) {
    const R = st.results, top0 = R.res[0];
    const ref0 = evalBuild(top0.ids, top0.val, top0.arcane).score;
    const plan = rivenCombos(top0, ref0);
    R.rivPlan = plan; R.rivPlanTop = top0;
    const picks = [];
    for (const x of plan.out) { if (x.form !== "3+1") continue; const key = x.stats.slice().sort().join(); if (picks.some((p) => p.key === key)) continue; picks.push({ key, stats: x.stats }); if (picks.length >= 4) break; }
    if (!picks.length) { $("#runbtn").disabled = false; $("#progress").hidden = true; renderResults(); return; }
    const mult = 1.2 * RIV_FORM["3+1"].pos, negBase = 1.2 * Math.abs(RIV_FORM["3+1"].neg);
    const other = (modClass(w) === "melee" ? RIV_OTHER.melee : RIV_OTHER.gun);
    const neg = modClass(w) === "melee" ? other.find((x) => x[0] === "finisher") : other.find((x) => x[0] === "recoil");
    const rivs = picks.map((p) => {
      const eff = {}, info = [];
      for (const k of p.stats) { eff[k] = plan.table[k] * mult; info.push({ k, v: eff[k], inc: true }); }
      if (neg) info.push({ k: "x_" + neg[0], v: -neg[2] * negBase, inc: true });
      return { eff, info };
    });
    const jobs2 = [];
    rivs.forEach((rv, i) => jobs2.push({ tag: "riv" + i, riven: rv.eff, locked: ["__riven"], valOptions: [top0.val], arcOptions: [top0.arcane], beam: 70 }));
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
    };
    wk.postMessage({ weapon: JSON.parse(JSON.stringify(w)), atk: st.atk, opts: o, cands, locked: [], beam: 70, valOptions: [top0.val], arcOptions: [top0.arcane], riven: null, jobs: jobs2 });
  }

  /* ---------------- evaluation helpers ---------------- */
  function evalBuild(ids, val, arcane, oOverride, rivEff, elemOrder) {
    const w = st.weapon, atk = w.attacks[st.atk];
    // shown speeds are real speeds: the element concept only steers the element layout here, it never scales the score
    const o = Object.assign({}, oOverride || st.results.o, { val, arcane, elemOrder: elemOrder || null, layoutTTK: true, conceptPenalty: false });
    const mods = ids.map((id) => id === "__riven" ? { id: "__riven", eff: rivEff || (st.results.owned ? st.results.owned.eff : {}) } : MOD_BY_ID[id]);
    return E.evaluate(w, atk, mods, o);
  }
  const modName = (id) => id === "__riven" ? "리벤 모드" : (MOD_BY_ID[id] ? MOD_BY_ID[id].ko : id);
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
    return `<table class="tbl"><thead><tr><th>팩션 · 기준 적</th><th>${L[0]}레벨</th><th>${L[1]}레벨</th><th>${L[2]}레벨 (버티기)</th><th>한 방 유지</th></tr></thead><tbody>
      ${o.factions.map((f) => { const x = r.perF[f]; return `<tr><td>${E.FACTIONS[f].label} · ${esc(x.target.ko)}${x.targetHeavy ? " / " + esc(x.targetHeavy.ko) : ""}<br><small>${o.level}레벨 체력 ${fmt(x.target.hp)}${x.target.sh ? " · 실드 " + fmt(x.target.sh) : ""}${x.target.ar ? " · 방어구 " + x.target.ar.toFixed(0) : ""}${x.target.og ? " · 오버가드 " + fmt(x.target.og) : ""}${x.targetHeavy ? " / 체력 " + fmt(x.targetHeavy.hp) : ""}</small></td><td class="num">${cell(x)}</td><td class="num">${cell(x.hi)}</td><td class="num">${cell(x.top)}</td><td class="num">${oneLvTxt(x.oneLv)}</td></tr>`; }).join("")}
    </tbody></table><p class="hint">"한 방"은 첫 공격과 그 공격의 상태이상만으로 죽는다는 뜻입니다 (도트 피해 제외). "한 방 유지"는 ${o.scenario === "boss" ? "보스" : "중장갑"}을 한 방에 잡는 가장 높은 레벨입니다. 잡몹 무리는 "잡몹 / 섞여 있는 중장갑" 순서입니다.</p>`;
  }

  /* ---------------- results ---------------- */
  function renderResults() {
    const R = st.results, res = R.res, o = R.o;
    if (!res || !res.length) { $("#results").innerHTML = `<div class="placeholder"><h3>결과 없음</h3></div>`; return; }
    const top = res[0];
    const r = evalBuild(top.ids, top.val, top.arcane);
    const xid = top.ids.find((id) => MOD_BY_ID[id] && MOD_BY_ID[id].exilus);
    const groups = orderMods(top.ids.filter((id) => id !== xid), r);
    const ref = r.score;
    const atk = st.weapon.attacks[st.atk];
    const buffNames = buffSummary();
    const rm0 = $("#rivmode").value;
    const xa = exilusAdvice(xid, r, atk);
    let html = "";

    html += `<section class="card hero"><div class="eyebrow">추천 세팅 · ${esc(st.weapon.ko)} · ${esc(atk.name)}</div>
      <h2>${finalElements(r)}</h2>
      <div class="meta">${o.concept && o.concept.length ? `속성 콘셉트 <b>${o.concept.map((t) => TYPE_KO[t]).join(" + ")}</b>${o.conceptOnly ? " (이 속성만)" : ""} · ` : ""}${top.val ? `베일런스 <b>${TYPE_KO[top.val.type]} ${pct(top.val.pct)}</b> · ` : ""}아케인 <b>${top.arcane ? esc(ARC[top.arcane].ko) : "없음"}</b>${buffNames.length ? ` · 버프 <b>${esc(buffNames.join(", "))}</b>` : ""}</div>
      ${r.conceptOk === false ? `<p class="warn">고른 속성 콘셉트(${o.concept.map((t) => TYPE_KO[t]).join(" + ")})를 만족하는 세팅을 찾지 못해, 가장 빠른 세팅을 보여 드립니다. 이 무기·공격으로는 그 속성을 충분히 넣을 수 없습니다.</p>` : ""}
      <div class="slots">${groups.map((g) => `<div class="sgroup"><div class="slabel">${g.label}</div><div class="sgrid">${g.ids.map((id) => `<div class="slot${id === "__riven" ? " riv" : ""}">${esc(modName(id))}</div>`).join("")}</div></div>`).join("")}</div>
      <div class="sgroup"><div class="slabel">익실러스 칸</div><div class="sgrid"><div class="slot${xid ? "" : " free"}">${esc(xa.name)}</div></div><p class="hint" style="margin:4px 0 0">${esc(xa.why)}</p></div>
      <p class="capline">${capInfo(top.ids).text}<small> · 오로킨 카탈리스트·모드 최대 랭크 기준${st.weapon.slot === "melee" && !st.weapon.pseudo ? ", 같은 극성 스탠스 +10" : ""}${top.ids.includes("__riven") ? ", 리벤 18 (극성은 맞춘다고 가정)" : ""}</small></p>
      <p class="hint">원소 모드는 위 묶음 순서대로 칸에 넣으세요. 같은 묶음 안의 모드끼리 먼저 합쳐집니다. ${o.aim ? "조준·헤드샷 조건 모드는 헤드샷 50%를 가정했습니다." : ""}</p>
      ${ttkTable(r, o)}
    </section>
    <section class="card" id="cmpout" hidden></section>`;
    if (rm0 === "plan" && R.rivBest) html += rivenPremiseSection(R, top, r);

    // stats + breakdown
    html += `<section class="card"><h3>수치</h3><div class="kv">
      ${kv("치명타 확률", pct(r.cc))}${kv("치명타 피해", r.cd.toFixed(2) + "배")}
      ${kv("상태이상 확률", pct(r.sc) + (atk.kind === "gun" ? " /발" : ""))}${atk.kind === "gun" || atk.kind === "radial" ? kv("멀티샷", r.ms.toFixed(2)) : ""}
      ${r.M > 1 ? kv("연속기 배율 (강공 때)", (Number.isInteger(r.M) ? r.M : "평균 " + r.M.toFixed(1)) + "배") : kv(atk.kind === "melee" ? "초당 타격" : "초당 발사", r.rate.toFixed(2))}${atk.kind === "melee" ? kv(o.comboWindow > 0 ? `연속기 배율 (${o.comboWindow / 60}분 평균)` : "연속기 배율", (r.tierNow >= 11.995 ? "12" : r.tierNow.toFixed(1)) + "배") : ""}${kv("기본 피해 보너스", "+" + pct(r.dmgb))}
      ${kv("상태이상 피해", "+" + pct(r.sd))}${kv("상태이상 지속", pct(r.dur))}
      ${r.u ? kv("인플루언스 가동률", pct(r.u)) : ""}${kv(o.scenario === "crowd" && r.perF[o.factions[0]].Keff > r.K + 0.05 ? "한 발에 같이 잡히는 적 (폭발 포함)" : "한 번에 맞는 적", Math.max(r.K, o.scenario === "crowd" ? r.perF[o.factions[0]].Keff || 0 : 0).toFixed(1) + "명")}
      ${r.fallM && r.fallM < 0.995 ? kv("거리·폭발 가장자리 감쇠", pct(r.fallM)) : ""}${r.tenno ? kv("텐노카이 강공", `${Math.round(r.tenno.f * 100)}% 타격마다 1회`) : ""}
      ${r.ammo ? kv("탄약 (연속 사격)", ammoSec(r.ammo.sustain)) : ""}${r.inc ? kv("인카논 탄 (모드 영향 없음)", r.inc.sec ? `${r.inc.rounds}발 · ${ammoSec(r.inc.sec)}` : "충전식") : ""}
      ${r.exS && r.exS !== 1 ? kv("익절티드 기본 피해 (위력)", "×" + r.exS.toFixed(2)) : ""}${r.exChain > 1 ? kv("피스메이커 연사 보너스", "×" + r.exChain.toFixed(2)) : ""}
      ${r.sniperM > 1 ? kv("저격 콤보 (20초 평균)", "×" + r.sniperM.toFixed(2)) : ""}${r.vigil ? kv("비질란테 세트 (치명 단계 상승)", pct(r.vigil)) : ""}${r.glad && atk.kind !== "gun" ? kv("글래디에이터 세트", `연속기 배율당 +${pct(r.glad)}`) : ""}
    </div>
    <h3>피해 구성 (바이러스 10중첩 기준, 한 발당)</h3>
    <div class="fbars">${o.factions.map((f) => { const x = r.perF[f]; const tot = x.perShot || 1; return `<div class="frow"><span class="fname">${E.FACTIONS[f].label}</span><span class="fval">${fmt(x.perShot)}</span>
      <div class="stack"><i class="c-direct" style="width:${(x.direct / tot) * 100}%"></i>${Object.entries(x.dotBy).map(([t, v]) => `<i class="c-${t}" style="width:${(v / tot) * 100}%"></i>`).join("")}<i class="c-blast" style="width:${(x.blast / tot) * 100}%"></i></div></div>`; }).join("")}</div>
    <div class="legend"><span><i class="c-direct"></i>직격</span><span><i class="c-heat"></i>화염 도트</span><span><i class="c-tox"></i>독 도트</span><span><i class="c-elec"></i>전기 도트(3m 연쇄)</span><span><i class="c-gas"></i>가스 도트</span><span><i class="c-slash"></i>출혈</span><span><i class="c-blast"></i>폭발 상태이상</span></div>
    <p class="hint">방어구 적용 전 수치입니다. 처치 시간 계산에서는 바이러스·화염·부식 중첩이 쌓이는 시간과 방어구를 반영합니다.</p>
    </section>`;

    // contributions
    const contrib = top.ids.map((id, i) => {
      if (id === "__riven") return null;
      const rest = top.ids.filter((_, j) => j !== i);
      const rem = evalBuild(rest, top.val, top.arcane).score / ref;
      let bestAlt = null;
      const isX = MOD_BY_ID[id] && MOD_BY_ID[id].exilus;
      for (const c of candidateMods(st.weapon, atk, R.flags)) {
        if (!!c.exilus !== !!isX) continue;
        if (top.ids.includes(c.id)) continue;
        if (c.group && rest.some((x) => MOD_BY_ID[x] && MOD_BY_ID[x].group === c.group)) continue;
        const s = evalBuild(rest.concat([c.id]), top.val, top.arcane).score / ref;
        if (!bestAlt || s > bestAlt.s) bestAlt = { id: c.id, s };
      }
      return { id, rem, bestAlt };
    }).filter(Boolean).sort((a, b) => a.rem - b.rem);
    html += `<section class="card"><h3>모드별 기여도</h3><p class="hint">"뺐을 때"는 그 칸을 비웠을 때 처치 속도 변화, "대체"는 그 자리에 넣을 수 있는 차선 모드입니다.</p><table class="tbl"><thead><tr><th>모드</th><th>뺐을 때</th><th>가장 나은 대체</th></tr></thead><tbody>
      ${contrib.map((c) => `<tr><td>${esc(modName(c.id))}</td><td class="num neg">${pctDelta(c.rem)}</td><td>${c.bestAlt ? `${esc(modName(c.bestAlt.id))} <span class="num">${pctDelta(c.bestAlt.s)}</span>` : "-"}</td></tr>`).join("")}
    </tbody></table></section>`;

    // alternatives
    const alts = res.slice(1, 8);
    html += `<section class="card"><h3>다른 상위 세팅</h3><table class="tbl"><thead><tr><th>처치 속도</th><th>베일런스 · 아케인</th><th>모드 (다른 부분 강조)</th></tr></thead><tbody>
      ${alts.map((a) => `<tr><td class="num">${pct(a.score / ref, 1)}</td><td>${a.val ? TYPE_KO[a.val.type] : "-"} · ${a.arcane ? esc(ARC[a.arcane].ko) : "없음"}</td><td class="modlist">${diffMods(a.ids, top.ids)}<br><small>${capInfo(a.ids).short}</small></td></tr>`).join("")}
    </tbody></table></section>`;

    // valence
    if (st.weapon.valence) {
      const rows = VAL_TYPES.map((t) => {
        const own = res.filter((x) => x.val && x.val.type === t)[0];
        const same = evalBuild(top.ids, { type: t, pct: top.val.pct }, top.arcane).score / ref;
        return { t, same, own: own ? own.score / ref : null };
      }).sort((a, b) => (b.own || b.same) - (a.own || a.same));
      html += `<section class="card"><h3>베일런스 속성 비교</h3><table class="tbl"><thead><tr><th>속성</th><th>추천 모드 그대로</th><th>그 속성에 맞춰 다시 짰을 때</th></tr></thead><tbody>
        ${rows.map((x) => `<tr><td>${TYPE_KO[x.t]}</td><td class="num">${pct(x.same, 1)}</td><td class="num">${x.own ? pct(x.own, 1) : "-"}</td></tr>`).join("")}</tbody></table>
        <p class="hint">100% = 추천 세팅의 처치 속도. 오른쪽 열은 베일런스를 "자동"으로 두었을 때만 채워집니다.</p></section>`;
    }
    // arcanes
    const arcAll = arcanesFor(st.weapon);
    const arcs = arcAll.filter(([k, v]) => !v.none).map(([k]) => ({ k, s: evalBuild(top.ids, top.val, k).score / ref }));
    arcs.push({ k: null, s: evalBuild(top.ids, top.val, null).score / ref });
    const noneArcs = arcAll.filter(([k, v]) => v.none);
    html += `<section class="card"><h3>무기 아케인 비교 (추천 모드 그대로)</h3><div class="kv">${arcs.sort((a, b) => b.s - a.s).map((a) => kv(a.k ? esc(ARC[a.k].ko) + (ARC[a.k].manual ? ' <span class="tag cond">조건부</span>' : "") : "없음", pct(a.s, 0))).join("")}</div>
      <p class="hint">조건부: ${arcAll.filter(([k, v]) => v.manual).map(([k, v]) => `${esc(v.ko)}(${esc(v.note || "")})`).join(", ") || "없음"} — 자동 추천에서는 빼고, 조건을 채웠다고 가정한 값입니다.${noneArcs.length ? ` 무기 피해와 무관해 제외: ${noneArcs.map(([k, v]) => esc(v.ko)).join(", ")}.` : ""}</p></section>`;
    html += frameArcaneSection(top, r, o);
    html += ammoSection(top, r, o, xid);

    // buffs comparison
    if (R.nobuff && R.nobuff.length) {
      const nb = R.nobuff[0];
      const oNo = Object.assign({}, o, { ext: {}, frameArcs: [], hs: R.flags.aim ? 0.5 : 0 });
      const recNo = evalBuild(top.ids, top.val, top.arcane, oNo);          // recommended build, buff off
      const nbWith = evalBuild(nb.ids, nb.val, nb.arcane);                  // no-buff-best, buff on
      const nbNo = evalBuild(nb.ids, nb.val, nb.arcane, oNo);
      const same = nb.ids.slice().sort().join() === top.ids.slice().sort().join() && (nb.arcane === top.arcane) && JSON.stringify(nb.val) === JSON.stringify(top.val);
      html += `<section class="card"><h3>버프 없이 계산한 세팅과 비교</h3>
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
    if (rm === "plan") html += rivenPlan(top, ref);
    else if (rm === "owned" && R.owned) html += ownedRivenSection(R.owned);

    html += `<section class="card notes"><h3>계산 가정</h3><ul>
      <li>처치 시간은 ${o.steel ? "강철의 길 " : ""}${o.level}레벨 기준 적의 체력·방어구(위키 레벨 공식)로 계산합니다. 바이러스·화염·부식·냉기 중첩은 시간에 따라 쌓입니다.</li>
      <li>잡몹 무리: 반경 20m 안 12명, 한 발이 맞히는 수는 폭발 반경·관통으로 추정. 직격+폭발 무기는 주변 적이 폭발만 맞는다고 보고, 폭발만으로 죽는 속도만큼 같이 잡히는 것으로 계산합니다. 폭발 투사체는 관통이 적용되지 않습니다(위키 "Punch Through"). 갈바나이즈드 계열 피해 보너스와 세컨더리 이레디에이트 전파는 직격에만 적용합니다(위키). 처치 조건 효과(갈바나이즈드, 머시리스 등)는 잡몹·중장갑에서는 최대 중첩, 보스전에서는 0으로 계산합니다.</li>
      <li>코퍼스 실드는 독·출혈 도트만 관통하고 나머지는 실드를 먼저 깎습니다. 자성 중첩은 실드·오버가드 피해를 최대 4.25배로 올립니다.${o.og ? " 엑시무스 오버가드(위키 레벨 공식)는 방어구·바이러스 영향 없이 먼저 깎고, 보이드는 1.5배입니다." : ""}</li>
      <li>무기별 숨은 특성은 위키 무기 데이터에서 가져옵니다: 확정 상태이상(예: 조리스 회수 폭발의 전기·충격), 헤드샷 배율 변경, 거리별 피해 감소(잡몹은 2~20m에 고르게, 중장갑은 15m), 폭발 가장자리 피해 감소, 최대 탄약·탄약 소모.</li>
      <li>근접 휘두르기는 공격 속도 1당 초당 1.5타로 근사합니다. 연속기는 '근접 연속기' 옵션의 시간 동안 0(초기 연속기가 있으면 그 값)부터 쌓는 평균 배율을 씁니다. 한 번에 2명(잡몹) 또는 1명을 맞히고, 타격당 스탠스 배율 평균 1.5점에 연속기 획득 확률을 곱해 쌓이며, 220점(12배)에서 멈춥니다. 텐노카이는 그 배율의 강공이 15%(디시플린즈 메리트는 4타마다) 섞이는 것으로 계산합니다. 글레이브·강공은 초기 연속기로 배율을 정합니다. 강공이 연속기를 쓰고 나면 초기 연속기는 초당 40씩 다시 차므로(위키), 강공 간격이 짧으면 덜 찬 배율로 터지고, 그 사이 맞힌 타수(연속기 획득 확률 반영)가 모자란 만큼을 메웁니다. 글레이브는 던지고 돌아오는 비행 시간(투척 속도 기준)을 주기에 넣습니다.</li>
      <li>치명타는 확률을 그대로 반영한 기대값(평균)으로 계산합니다. 운이 좋고 나쁜 편차, 반동·명중 퍼짐, 투사체 비행 시간(15m 기준 0.1초 안팎)은 넣지 않습니다.</li>
      <li>모드 용량: 오로킨 카탈리스트(용량 = 최대 랭크×2), 모든 모드 최대 랭크 기준입니다. 같은 극성 칸은 소모 절반(올림), 다른 극성 칸은 25% 증가(올림)이고, 포르마 한도 안에서 들어가는 조합만 추천합니다.</li>
      <li>저격총은 조준 옵션을 켜면 최대 배율 줌 보너스와 저격 콤보(20초 연속 교전 평균)를 넣습니다. 익절티드 무기는 워프레임 위력 값을 기본 피해(또는 위키에 적힌 방식)에 반영합니다.</li>
      <li>위키에 수치가 없는 어빌리티(사이트-09 시크·리서플라이)와 킷건·자우 전용 아케인, 자우 강공(위키 데이터 없음)은 아직 반영하지 않습니다.</li>
    </ul></section>`;
    $("#results").innerHTML = html;
    renderCompare();
  }

  /* ---------------- comparison table: 추천 + up to 5 sets, fastest first ---------------- */
  function renderCompare() {
    const box = $("#cmpout");
    if (!box || !st.results || !st.results.res || !st.results.res.length) return;
    const R = st.results, o = R.o, top = R.res[0];
    const sets = $$("#sets .cset").map(setMods).filter((s) => s.ids.length || s.problems.length);
    if (!sets.length) { box.hidden = true; box.innerHTML = ""; return; }
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
      return Object.assign(s, { r, reorder });
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
      ${rows.map((x, i) => `<tr class="main${x.rec ? " rec" : ""}"><td class="rank">${i + 1}</td><td class="sname">${esc(x.name)}<br><small class="els">${finalElements(x.r)}${x.r.ammo ? ` · 탄약 ${Math.round(x.r.ammo.sustain)}초` : ""}</small><br><small class="${capInfo(x.ids, x.rivEff).ok ? "els" : "capbad"}">${capInfo(x.ids, x.rivEff).short}</small></td><td class="num spd">${speedCell(x)}</td><td class="t1" data-label="${L[0]}레벨 ${what}">${timeCell(x.r, null)}</td><td class="t2" data-label="${L[2]}레벨 ${what}">${timeCell(x.r, "top")}</td><td class="t3" data-label="한 방 유지">${oneCell(x.r)}</td><td class="arc" data-label="아케인">${x.arcane ? esc(ARC[x.arcane].ko) : "없음"}</td></tr>
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
  function exilusAdvice(xid, r, atk) {
    if (xid) {
      const m = MOD_BY_ID[xid];
      const why = m.eff.throwSpd ? "투척 속도가 빨라져 던지고 돌아오는 주기가 짧아집니다 (처치 속도에 직접 기여)"
        : m.eff.tenno ? "텐노카이 강공을 열어 줍니다 — 연속기를 소모하지 않는 강공이 섞여 처치 속도에 직접 기여" : "처치 속도에 직접 기여";
      return { name: m.ko, why };
    }
    const xs = exilusMods(st.weapon);
    const conv = st.weapon.exalted ? null : xs.filter((m) => m.eff.ammoConv).sort((a, b) => b.eff.ammoConv - a.eff.ammoConv)[0];   // exalted weapons use energy, not ammo
    if (r.ammo && r.ammo.sustain < 60 && conv) return { name: conv.ko, why: `탄약 보완 — 다른 종류 탄약 픽업을 이 무기 탄약으로 ${pct(conv.eff.ammoConv)} 바꿔 줍니다 (처치 속도 영향 없음, 탄약 ${Math.round(r.ammo.sustain)}초 만에 바닥)` };
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
        if (m.id === id || rest.includes(m.id) || (m.group && rest.some((x) => MOD_BY_ID[x] && MOD_BY_ID[x].group === m.group))) continue;
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
    const cls = modClass(st.weapon), atk = st.weapon.attacks[st.atk];
    const table = RIV[cls] || RIV.rifle;
    const stats = Object.keys(table).filter((k) => !(k === "ic" && atk.kind !== "heavy" && atk.kind !== "glaive"));
    const out = [];
    for (const form of ["3+1", "2+1"]) {
      const n = form === "3+1" ? 3 : 2, mult = 1.2 * RIV_FORM[form].pos;
      const combos = [];
      const rec = (start, acc) => { if (acc.length === n) { combos.push(acc.slice()); return; } for (let i = start; i < stats.length; i++) { acc.push(stats[i]); rec(i + 1, acc); acc.pop(); } };
      rec(0, []);
      for (let i = 0; i < top.ids.length; i++) {
        if (MOD_BY_ID[top.ids[i]] && MOD_BY_ID[top.ids[i]].exilus) continue;     // a riven can't go in the exilus slot
        const rest = top.ids.filter((_, j) => j !== i);
        for (const c of combos) {
          const riv = {}; for (const k of c) riv[k] = table[k] * mult;
          const s = evalBuild(rest.concat(["__riven"]), top.val, top.arcane, null, riv).score / ref;
          out.push({ form, slot: top.ids[i], stats: c, s });
        }
      }
    }
    out.sort((a, b) => b.s - a.s);
    return { out, table, stats };
  }
  function rivenPlan(top, ref) {
    const cls = modClass(st.weapon), atk = st.weapon.attacks[st.atk];
    const cached = st.results && st.results.rivPlan && st.results.rivPlanTop === top ? st.results.rivPlan : null;
    const { out, table } = cached || rivenCombos(top, ref);
    const best3 = out.filter((x) => x.form === "3+1").slice(0, 3), best2 = out.filter((x) => x.form === "2+1").slice(0, 2);
    const rangeTxt = (k, form) => { const b = table[k] * 1.2 * RIV_FORM[form].pos; return k === "ic" ? `${(b * 0.9).toFixed(0)}~${(b * 1.1).toFixed(0)}` : `${pct(b * 0.9, 1)}~${pct(b * 1.1, 1)}`; };
    const row = (x) => `<tr><td>${RIV_FORM[x.form].ko}</td><td>${x.stats.map((k) => `${RIV_KO[k]} <small>(${rangeTxt(k, x.form)})</small>`).join("<br>")}</td><td>${esc(modName(x.slot))}</td><td class="num">×${x.s.toFixed(2)}</td></tr>`;
    // negatives: modeled via evaluation, others by rule
    const base = top.ids.slice(), bestSlot = out[0] ? out[0].slot : top.ids[top.ids.length - 1];
    const restB = base.filter((id) => id !== bestSlot);
    const posRiv = {}; for (const k of out[0].stats) posRiv[k] = table[k] * 1.2 * RIV_FORM["3+1"].pos;
    const withPos = evalBuild(restB.concat(["__riven"]), top.val, top.arcane, null, posRiv).score;
    const negRows = [];
    for (const k of Object.keys(table)) {
      if (out[0].stats.includes(k)) continue;
      if (k === "sd") continue;
      if (k === "ic") continue;   // rivens never roll negative Initial Combo (wiki Melee Combo)
      const riv = Object.assign({}, posRiv, { [k]: table[k] * 1.2 * RIV_FORM["3+1"].neg });
      const s = evalBuild(restB.concat(["__riven"]), top.val, top.arcane, null, riv).score / withPos;
      const isElem = ["heat", "cold", "elec", "tox"].includes(k);
      negRows.push({ ko: RIV_KO[k], s, note: isElem && s >= 0.97 ? "이 원소 모드를 안 쓰는 세팅이라 무해. 그 원소를 쓰면 치명" : "" });
    }
    const other = cls === "melee" ? RIV_OTHER.melee : RIV_OTHER.gun;
    for (const [k, ko, tv] of other) {
      let s = 1, note = "";
      if (k === "range") { s = atk.kind === "melee" ? 0.8 : atk.kind === "heavy" && atk.radius ? 0.85 : 1; note = atk.kind === "melee" ? "휘두르기 사거리 감소" : atk.radius ? "슬램 반경 감소" : "투척·폭발에는 영향 없음"; }
      else if ((RIV_HEAVY[k] && (atk.kind === "heavy" || atk.kind === "glaive")) || (k === "combochance" && atk.kind === "melee" && st.results.o.comboWindow > 0)) {
        // modeled: combo count chance / heavy attack efficiency change how much combo is back by the next heavy attack
        const riv = Object.assign({}, posRiv, { [RIV_HEAVY[k]]: -tv * 1.2 * Math.abs(RIV_FORM["3+1"].neg) });
        s = evalBuild(restB.concat(["__riven"]), top.val, top.arcane, null, riv).score / withPos;
        note = atk.kind === "melee" ? (s >= 0.97 ? "연속기 배율을 쓰는 모드가 없어 거의 무해" : "연속기가 느리게 쌓여 블러드 러시·위핑 운즈 등이 약해짐")
          : s >= 0.97 ? "강공 사이에 초기 연속기가 다 차서 거의 무해" : "강공 간격이 짧아 초기 연속기(초당 40 회복)가 덜 찬 채로 터짐";
      }
      else if (k === "combochance" || k === "combodur") { s = atk.kind === "melee" ? 0.9 : 1; note = atk.kind === "melee" ? "연속기 유지가 느려짐" : "초기 연속기로 유지되어 영향 없음"; }
      else if (k === "hae") { s = 1; note = "강공을 쓰지 않아 무관"; }
      else if (k === "faction") { s = 0.55; note = "그 팩션 상대 −45%. 다른 팩션엔 무해"; }
      else if (k === "speed") { s = 0.97; note = "투사체 무기만 사거리·명중 영향"; }
      else if (k === "ammo") { s = 0.97; note = "장기전 탄약 압박"; }
      else if (k === "pt") { s = atk.punch ? 1 : 0.97; note = "관통 모드 안 쓰면 무해"; }
      negRows.push({ ko, s, note });
    }
    negRows.sort((a, b) => b.s - a.s);
    const grade = (s) => s >= 0.97 ? '<span class="g ok">무해</span>' : s >= 0.85 ? '<span class="g mid">경미</span>' : '<span class="g bad">치명</span>';
    const splice = SPLICE.filter((sp) => sp.cls.includes(cls) && out.some((x) => x.s > 1 && x.stats.includes(sp.out) && (x.form === "3+1" ? best3 : best2).includes(x)));
    return `<section class="card"><h3>리벤 맞추기 가이드</h3>
      <p class="hint">추천 세팅의 한 칸을 리벤으로 바꿨을 때 처치 속도 배율입니다. 수치 범위는 8랭크 기준(현재 성향은 전 무기 1.2 공통), 중간값으로 계산했습니다.</p>
      <table class="tbl"><thead><tr><th>구성</th><th>긍정 옵션 (수치 범위)</th><th>대신 뺄 모드</th><th>배율</th></tr></thead><tbody>${best3.map(row).join("")}${best2.map(row).join("")}</tbody></table>
      <h3>부정 옵션 고르기 (1순위 조합 기준)</h3>
      <table class="tbl"><thead><tr><th>부정 옵션</th><th>영향</th><th>판정</th><th>메모</th></tr></thead><tbody>
      ${negRows.map((x) => `<tr><td>${esc(x.ko)}</td><td class="num">${pctDelta(x.s)}</td><td>${grade(x.s)}</td><td><small>${esc(x.note)}</small></td></tr>`).join("")}</tbody></table>
      ${splice.length ? `<h3>접합이 필요한 옵션</h3><ul class="plain">${splice.map((sp) => `<li><b>${sp.ko}</b>: ${sp.need.join(" + ")} 두 옵션을 접합합니다. 재료 두 옵션 모두 이 세팅에 쓸모가 있으니, 뜨는 대로 접합하면 손해가 없습니다.</li>`).join("")}</ul><p class="hint">접합 결과 수치는 일반 옵션과 같은 범위로 가정했습니다. 접합된 특성은 고정 특성으로 취급되지 않아 재순환 비용이 두 배가 되지 않습니다.</p>` : ""}
      <p class="hint">진행 순서: ① 3긍1부가 뜨면 1순위 옵션을 잠그고 재순환 → ② 부정 옵션은 위 "무해" 중에서 → ③ 수치는 범위 하한만 넘으면 성능 차이 10% 이내입니다.</p>
    </section>`;
  }

  // plan mode: riven-free best vs "swap one mod of it for the riven" vs "build around the riven from the start"
  function rivenPremiseSection(R, top, r0) {
    const o = R.o, ref = r0.score, plan = R.rivPlan, B = R.rivBest;
    const mult = 1.2 * RIV_FORM["3+1"].pos;
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
      { n: "③ 처음부터 리벤을 넣고 다시 짠 세팅", d: "리벤을 고정하고 나머지 칸·익실러스를 전부 다시 고름", ids: B.top.ids, rr: rFull, riv: B.riv.info },
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
      <p>${k3 > 1.005 ? `처음부터 리벤을 전제로 짜면 한 칸만 바꾸는 것보다 <b>×${k3.toFixed(2)}</b> 더 빠릅니다. 리벤이 생기면 ${dropped.filter((id) => id !== g.slot).length ? `<b>${dropped.filter((id) => id !== g.slot).map(modName).map(esc).join(", ")}</b>도 빼고 ` : ""}<b>${changed.map(modName).map(esc).join(", ") || "-"}</b>${changed.length ? "을(를) 넣는" : ""} 쪽이 좋습니다.` : `처음부터 리벤을 전제로 짜도 한 칸만 바꾼 세팅과 거의 같습니다 (×${k3.toFixed(2)}). 리벤이 생기면 ${esc(modName(g.slot))} 자리에만 넣으면 됩니다.`}</p>
      ${altTable}
      <p class="hint">리벤 수치는 3긍정 1부정 리벤의 각 옵션 범위 중간값으로 가정했습니다 (부정은 피해 계산에 영향 없는 옵션). ③은 한 칸 교체 기준 상위 리벤 옵션 조합 네 가지로 각각 다시 짜 본 뒤 가장 빠른 쪽입니다. 베일런스·아케인은 ①과 같게 두었습니다. 실제로 뽑은 리벤이 생기면 리벤 모드를 "보유 리벤 고정"으로 바꿔 그 수치로 계산하세요.</p></section>`;
  }
  function ownedRivenSection(owned) {
    const inc = owned.info.filter((x) => x.inc), exc = owned.info.filter((x) => !x.inc);
    const other = Object.fromEntries(RIV_OTHER.gun.concat(RIV_OTHER.melee).map(([k, v]) => ["x_" + k, v]));
    const txt = (x) => `${RIV_KO[x.k] || other[x.k] || x.k} ${x.k === "ic" ? x.v.toFixed(0) : pct(x.v, 1)}${x.k.startsWith("x_") && !RIV_HEAVY[x.k.slice(2)] ? " (피해 계산 영향 없음)" : ""}`;
    return `<section class="card"><h3>보유 리벤 고정</h3>
      <p>반영한 옵션: <b>${inc.map(txt).join(", ") || "없음"}</b>${exc.length ? ` · 반영하지 않은 옵션(재순환 예정): ${exc.map(txt).join(", ")}` : ""}</p>
      <p class="hint">리벤을 한 칸에 고정하고 나머지 7칸을 다시 최적화한 결과가 위 추천 세팅입니다.</p></section>`;
  }

  const placeholder = () => `<div class="placeholder"><h3>준비됐습니다</h3><p>왼쪽에서 무기와 상황을 고른 뒤 <b>최적 세팅 계산</b>을 누르세요. 장착 가능한 모드 전부를 후보로 넣고(모두 보유 전제) 가장 빨리 죽이는 조합을 찾습니다. 무기 하나에 10~60초 걸립니다.</p></div>`;

  /* ---------------- events ---------------- */
  function bind() {
    $("#wsearch").addEventListener("input", renderWeaponList);
    $$(".slot-tabs button").forEach((b) => b.addEventListener("click", () => { $$(".slot-tabs button").forEach((x) => x.classList.remove("on")); b.classList.add("on"); renderWeaponList(); }));
    $("#wlist").addEventListener("click", (e) => { const b = e.target.closest(".witem"); if (!b) return; const w = WEAPONS.find((x) => x.id === b.dataset.id); if (w) selectWeapon(w); });
    $("#atk").addEventListener("change", (e) => { st.atk = +e.target.value; renderAll(); });
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
    $("#helminth").addEventListener("change", () => { $("#framestats").hidden = !$("#frame").value && !$("#helminth").value; renderFrameStats(); });
    ["#strength", "#duration", "#range", "#efficiency", "#energy", "#armor", "#health"].forEach((s) => $(s).addEventListener("input", renderFrameStats));
    FA_NOTE = $("#fanote").innerHTML;
    $("#falist").innerHTML = Object.values(FRAME_ARC).slice().sort((a, b) => a.ko.localeCompare(b.ko, "ko")).map((v) => `<option value="${esc(v.ko)}"></option>`).join("");
    for (const id of ["#fa0", "#fa1"]) {
      const el = $(id);
      const fix = () => {
        const m = resolveFA(el.value); if (m) el.value = m.ko; el.classList.toggle("fa-ok", !!m); el.classList.toggle("fa-bad", !!el.value.trim() && !m);
        const pk = pickedFA();
        $("#fanote").innerHTML = pk.length ? pk.map((id) => { const A = FRAME_ARC[id]; return `<b>${esc(A.ko)}</b> ${A.kind === "none" ? '<span class="tag">계산 영향 없음</span>' : A.manual ? '<span class="tag cond">조건부</span>' : ""}<br><small>${esc((A.kd || []).join(" ").replace(/\n/g, " "))}</small>`; }).join("<br>") : FA_NOTE;
        renderFrameStats();
      };
      el.addEventListener("change", fix); el.addEventListener("blur", fix);
    }
    renderRivenSelects();
  }

  /* ---------------- version + patch notes tab (#patch) ---------------- */
  function renderVersion() {
    const CL = window.WF_CHANGELOG || [];
    const cur = CL[0], built = $("#ver").dataset.built;
    $("#ver").innerHTML = cur ? `<b>v${esc(cur.v)}</b> · ${esc(cur.date)} 수정${built && /^\d{4}-/.test(built) ? ` · 데이터 ${esc(built)} 갱신` : ""}` : "";
    $("#patchview").innerHTML = `<section class="card"><h3>패치 내역</h3><p class="hint" style="margin:0">계산기를 고칠 때마다 버전을 올리고 여기에 기록합니다. 게임 데이터(무기·모드 수치)는 매주 월요일 자동으로 최신화되며 버전은 그대로입니다.</p></section>`
      + CL.map((x, i) => `<section class="card${i === 0 ? " cur" : ""}"><h3><span class="pv">v${esc(x.v)}</span>${esc(x.title)}<span class="pd">${esc(x.date)}${i === 0 ? " · 현재 버전" : ""}</span></h3><ul>${x.items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></section>`).join("");
  }
  function showView() {
    const patch = location.hash === "#patch";
    $("#patchview").hidden = !patch; $("#calcview").hidden = patch;
    $$(".viewtabs a").forEach((a) => { const on = (a.dataset.view === "patch") === patch; a.classList.toggle("on", on); a.setAttribute("aria-selected", on ? "true" : "false"); });
  }
  $$(".viewtabs a").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    const h = a.dataset.view === "patch" ? "#patch" : "";
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
  if (st.weapon.exalted) selectWeapon(st.weapon); else renderAll();
})();
