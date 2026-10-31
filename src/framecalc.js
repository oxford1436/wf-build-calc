/* Warframe build calculator (top of each guide page). The person picks which abilities they play around, which way each
 * ability stat should go and which breakpoints must hold; the calculator fills the free mod slots, the exilus and the
 * crimson archon shards so every checked breakpoint is met and the wanted stats go as high (or low) as possible, within
 * mod capacity. Fixed slots (augments, survival mods), aura, arcanes and helminth start from what the guide's community
 * builds use most and can be changed. Data: WF_FRAME_MODS / WF_FRAME_POL / WF_FRAME_ARCS (data/frame_mods.js),
 * WF_FRAME_ARCANES (mods.js, ability-stat effects of arcanes). */
(function (root) {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MODS = root.WF_FRAME_MODS || [], POL = root.WF_FRAME_POL || {};
  const ARCS = []; { const seen = {}; for (const a of root.WF_FRAME_ARCS || []) { if (!seen[a.en] || (a.text || []).join("").length > (seen[a.en].text || []).join("").length) seen[a.en] = a; } for (const k in seen) ARCS.push(seen[k]); }
  const BY_ID = Object.fromEntries(MODS.map((m) => [m.id, m]));
  const norm = (s) => String(s || "").toLowerCase().replace(/\(.*?\)|（.*?）/g, "").replace(/[\s·,'’:\-]/g, "");
  const MOD_BY_NAME = {}; for (const m of MODS) { MOD_BY_NAME[norm(m.ko)] = MOD_BY_NAME[norm(m.ko)] || m; MOD_BY_NAME[norm(m.en)] = MOD_BY_NAME[norm(m.en)] || m; }
  const ARC_BY_NAME = {}; for (const a of ARCS) { ARC_BY_NAME[norm(a.ko)] = a; ARC_BY_NAME[norm(a.en)] = a; }
  const STATS = ["str", "dur", "rng", "eff"];
  const STAT_KO = { str: "위력", dur: "지속시간", rng: "거리", eff: "효율" };
  const GUIDE_STAT = { strength: "str", duration: "dur", range: "rng", efficiency: "eff" };
  const DIRS = [["high", "최대한 높게"], ["mid", "적당히 높게"], ["any", "상관없음"], ["low", "낮을수록 좋음"]];
  const MIN = { str: 0.1, dur: 0.125, rng: 0.34, eff: 0.25 };
  // conditional stats people count in their builds (Growing Power aura: weapon status proc → +25% strength)
  const COND = { growing_power: { str: 0.25 } };
  const SLOT4_ONLY = { precision_intensify: true };   // "+90% ability strength to the 4th ability"
  const lookMod = (s) => MOD_BY_NAME[norm(String(s).split(/[(/]| 또는 /)[0])] || null;
  const lookArc = (s) => ARC_BY_NAME[norm(String(s).split(/[(/]| 또는 /)[0])] || null;
  const isStatMod = (m) => STATS.some((k) => m.stats[k]);
  function arcStats(a) {
    if (!a) return {};
    if (a.en === "Arcane Sculptor") return { effFix: 1.75 };
    const hit = Object.values(root.WF_FRAME_ARCANES || {}).find((x) => x.en === a.en);
    return hit && hit.stat ? hit.stat : {};
  }
  const median = (xs) => { const v = xs.filter((x) => x != null && !isNaN(x)).map(Number).sort((a, b) => a - b); if (!v.length) return null; const h = v.length >> 1; return v.length % 2 ? v[h] : (v[h - 1] + v[h]) / 2; };

  // what the guide's community builds use most
  function communityDefaults(g) {
    const C = g.community || [], n = Math.max(1, C.length);
    const cnt = (list) => { const m = {}; for (const x of list) if (x) m[x] = (m[x] || 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]); };
    const mods = cnt(C.flatMap((c) => [...new Set((c.mods || []).map(lookMod).filter(Boolean).map((m) => m.id))]));
    const auras = cnt(C.map((c) => { const m = c.aura && lookMod(c.aura); return m && m.compat === "AURA" ? m.id : null; }));
    const exs = cnt(C.map((c) => { const m = c.exilus && lookMod(c.exilus); return m && m.ex ? m.id : null; }));
    const arcs = cnt(C.flatMap((c) => [...new Set((c.arcanes || []).map(lookArc).filter(Boolean).map((a) => a.en))]));
    const helm = cnt(C.map((c) => c.helminth && c.helminth.ability && !/없음|미기재|판독|불명/.test(c.helminth.ability) ? `${c.helminth.replace_slot ? c.helminth.replace_slot + "번 ← " : ""}${c.helminth.ability.split(/[(/]/)[0].trim()}` : null));
    // archon shards are written like "타우 빨강(위력) ×2"
    const shardN = (s) => { const m = /[×x]\s*(\d)/.exec(s); return m ? +m[1] : 1; };
    const withShards = C.filter((c) => (c.shards || []).length);
    const crim = median(withShards.map((c) => c.shards.filter((s) => /빨강|진홍/.test(s) && /위력|지속/.test(s)).reduce((x, s) => x + shardN(s), 0)));
    const rest = cnt(withShards.flatMap((c) => c.shards.filter((s) => !(/빨강|진홍/.test(s) && /위력|지속/.test(s))).map((s) => s.replace(/^타우\s*/, "").replace(/\s*[×x].*$/, "").replace(/\s*\+[\d.]+%/, "").replace(/\).*$/, ")").trim())));
    const tau = C.some((c) => (c.shards || []).some((s) => /타우/.test(s)));
    // fixed: augments and survival or utility mods in at least 40% of builds (ability-stat mods are left to the optimizer)
    const fixed = mods.filter(([id, k]) => k / n >= 0.4 && !isStatMod(BY_ID[id]) && BY_ID[id].compat !== "AURA" && !BY_ID[id].ex).slice(0, 4).map(([id]) => id);
    const med = {}; for (const [gk, k] of Object.entries(GUIDE_STAT)) med[k] = median(C.map((c) => c.stats ? c.stats[gk] : null));
    return { fixed, aura: auras[0] ? auras[0][0] : null, exilus: exs[0] ? exs[0][0] : null, arcs: arcs.slice(0, 2).map(([en]) => en),
      helm: helm[0] ? helm[0][0] : "", crimson: crim == null ? 3 : Math.min(5, Math.round(crim)), rest: rest.slice(0, 2).map(([s]) => s).join(", "), tau, n, med };
  }
  function dirDefault(i, note) {
    if (/낮을수록/.test(note)) return "low";
    if (/낮아도 됨|낮게 둠|45%까지|버림|우선순위 낮/.test(note)) return "any";
    return i <= 1 ? "high" : i === 2 ? "mid" : "any";
  }

  // a breakpoint's usable thresholds: every "N%" in its value ("199% / 243%", "200% (코로시브 프로젝션 시 164%)").
  // Values that mix in another stat ("지속 155%면 효율 162%") or another quantity ("배터리 31.25%") are left out.
  // max: the stat must stay at or below it ("111% 이하", or a stat whose guide says lower is better).
  const STAT_WORD = { str: "위력", dur: "지속", rng: "거리", eff: "효율" };
  function bpTiers(b, low) {
    const k = GUIDE_STAT[b.stat], v = String(b.value || "").trim();
    if (!k || !/^(약\s*)?\d+(?:\.\d+)?\s*%/.test(v) || /÷|≤/.test(v)) return null;
    if (Object.entries(STAT_WORD).some(([kk, w]) => kk !== k && v.includes(w))) return null;
    const ms = [...v.matchAll(/(\d+(?:\.\d+)?)\s*%/g)], tiers = [];
    ms.forEach((m, i) => {
      const pre = v.slice(i ? ms[i - 1].index + ms[i - 1][0].length : 0, m.index);
      const stop = v.indexOf("/", m.index), nextAt = i + 1 < ms.length ? ms[i + 1].index : Infinity;
      const post = (stop < 0 || nextAt < stop) && nextAt < Infinity ? "" : v.slice(m.index + m[0].length, stop < 0 ? undefined : stop);
      const cp = /코로시브/.test(pre.split("/").pop()) || /코로시브/.test(post);
      const val = +m[1] / 100;
      if (!tiers.some((t) => Math.abs(t.v - val) < 1e-9)) tiers.push({ v: val, cp });
    });
    return tiers.length ? { k, tiers, max: /이하|미만/.test(v) || low } : null;
  }

  // final ability stats for one ability slot (4 = the 4th ability, which Precision Intensify also boosts)
  function statsOf(mods, extra, slot4) {
    const s = { str: 1, dur: 1, rng: 1, eff: 1, hp: 0, sh: 0, ar: 0, energy: 0, cast: 0 };
    const umb = mods.filter((m) => m && m.umbral).length, um = umb >= 3 ? 1.75 : umb === 2 ? 1.25 : 1;
    for (const m of mods) {
      if (!m || (SLOT4_ONLY[m.id] && !slot4)) continue;
      const mult = m.umbral ? um : 1;
      for (const k in m.stats) if (k in s) s[k] += m.stats[k] * mult;
      const c = COND[m.id]; if (c) for (const k in c) s[k] += c[k];
    }
    for (const k of STATS) s[k] += extra[k] || 0;
    if (extra.effFix) s.eff = Math.max(s.eff, extra.effFix);
    for (const k of STATS) s[k] = Math.max(MIN[k], s[k]);
    s.eff = Math.min(1.75, s.eff);
    return s;
  }
  // how good a stat value is: log for strength/duration/range (doubling is worth the same everywhere), energy-cost
  // multiplier (2 − efficiency) for efficiency
  const util = (k, v) => k === "eff" ? -Math.log(2 - v) : Math.log(v);
  function weights(prio, dirs) {
    const W = {}; let hi = 0;
    for (const k of prio) { const d = dirs[k]; W[k] = d === "high" ? [3, 2, 1.5, 1.5][hi++] : d === "mid" ? 0.8 : d === "low" ? -1.5 : 0.1; }
    return W;
  }
  // score: every target met first (big penalty), then the weighted stat utilities averaged over the main abilities
  function scoreOf(sA, s4, cfg) {
    let sc = 0;
    for (const t of cfg.targets) { const v = (t.slot === 4 ? s4 : sA)[t.k]; if (v < t.v - 1e-9) sc -= 100 + 100 * (t.v - v); }
    for (const t of cfg.maxes) { const v = (t.slot === 4 ? s4 : sA)[t.k]; if (v > t.v + 1e-9) sc -= 100 + 100 * (v - t.v); }
    const n4 = cfg.main.includes(4) ? 1 : 0, nA = cfg.main.length - n4 || (n4 ? 0 : 1);
    for (const k of STATS) { const w = cfg.W[k]; if (w) sc += w * (nA * util(k, sA[k]) + n4 * util(k, s4[k])) / (nA + n4); }
    return sc;
  }

  // mod capacity: 60 with a reactor plus the aura's bonus (doubled on a matching aura slot); mods at max rank, half cost
  // on a matching polarity, +25% on a mismatched one. Forma goes where it saves the most until everything fits.
  function capacity(frameEn, aura, mods) {
    const P = POL[frameEn] || POL[String(frameEn).replace(/ Prime$/, "")] || { slots: [], aura: null };
    const auraMatch = !!(aura && P.aura && P.aura === aura.pol);
    let cap = 60 + (aura ? -aura.drain * (auraMatch ? 2 : 1) : 0);
    const slots = (P.slots || []).slice(0, 8), neutral = 8 - slots.length;
    const items = mods.filter(Boolean).map((m) => ({ m, cost: m.drain }));
    // matching polarities first (most expensive mods first), then neutral slots, then mismatched slots
    items.sort((a, b) => b.cost - a.cost);
    let free = neutral; const left = slots.slice();
    for (const it of items) { const i = left.indexOf(it.m.pol); if (it.m.ex) continue; if (i >= 0) { left.splice(i, 1); it.cost = Math.ceil(it.m.drain / 2); it.ok = true; } }
    for (const it of items) { if (it.ok || it.m.ex) continue; if (free > 0) { free--; } else if (left.length) { left.pop(); it.cost = Math.round(it.m.drain * 1.25); it.mis = true; } }
    let drain = items.reduce((x, y) => x + y.cost, 0), forma = 0;
    const gains = items.filter((it) => !it.ok).map((it) => ({ g: it.cost - Math.ceil(it.m.drain / 2) }));
    if (aura && !auraMatch) gains.push({ g: -aura.drain, aura: true });
    gains.sort((a, b) => b.g - a.g);
    for (const x of gains) { if (drain <= cap || x.g <= 0) break; if (x.aura) cap += x.g; else drain -= x.g; forma++; }
    return { drain, cap, forma, fits: drain <= cap };
  }

  function optimize(cfg, extra) {
    const used = new Set(cfg.fixed.map((m) => m.fam));
    if (cfg.exFixed) used.add(cfg.exFixed.fam);
    const pool = MODS.filter((m) => m.compat === "WARFRAME" && !m.ex && isStatMod(m) && !used.has(m.fam) && !(SLOT4_ONLY[m.id] && !cfg.main.includes(4)));
    const exPool = MODS.filter((m) => m.ex && isStatMod(m) && !used.has(m.fam));
    const free = 8 - cfg.fixed.length;
    const base = cfg.fixed.concat(cfg.aura ? [cfg.aura] : []);
    const ev = (ms) => { const all = base.concat(ms); return scoreOf(statsOf(all, extra, false), statsOf(all, extra, true), cfg); };
    let beam = [{ mods: [], fams: new Set(), last: -1 }];
    for (let step = 0; step < free; step++) {
      const next = [];
      for (const b of beam) for (let i = b.last + 1; i < pool.length; i++) {
        const m = pool[i]; if (b.fams.has(m.fam)) continue;
        const ms = b.mods.concat([m]);
        next.push({ mods: ms, fams: new Set([...b.fams, m.fam]), last: i, sc: ev(ms) });
      }
      if (!next.length) break;
      next.sort((a, b) => b.sc - a.sc);
      beam = next.slice(0, 60);
    }
    let best = null;
    for (const b of beam.slice(0, 25)) {
      const exs = cfg.exFixed ? [cfg.exFixed] : [null].concat(exPool.filter((x) => !b.fams.has(x.fam)));
      for (const ex of exs) {
        const all = base.concat(b.mods, ex ? [ex] : []);
        const cap = capacity(cfg.frameEn, cfg.aura, cfg.fixed.concat(b.mods, ex ? [ex] : []));
        const sc = scoreOf(statsOf(all, extra, false), statsOf(all, extra, true), cfg) - (cap.fits ? 0 : 1000) - cap.forma * 0.002;
        if (!best || sc > best.sc) best = { mods: b.mods, ex, sc, cap };
      }
    }
    return best;
  }

  function run(g, ui) {
    const prio = (g.stat_priority || []).map((p) => GUIDE_STAT[p.stat]).filter(Boolean);
    for (const k of STATS) if (!prio.includes(k)) prio.push(k);
    const targets = [], maxes = [];
    for (const x of ui.bps) (x.max ? maxes : targets).push({ k: x.k, v: x.v, slot: x.slot || 0 });
    for (const k of STATS) {
      if (ui.min[k] > 0) targets.push({ k, v: ui.min[k] / 100, slot: 0 });
      if (ui.max[k] > 0) maxes.push({ k, v: ui.max[k] / 100 });
    }
    const cfg = {
      frameEn: ui.frameEn, main: ui.main.length ? ui.main : [1, 2, 3, 4], targets, maxes, W: weights(prio, ui.dirs),
      fixed: ui.fixed.map((id) => BY_ID[id]).filter(Boolean).slice(0, 8), aura: ui.aura ? BY_ID[ui.aura] : null,
      exFixed: ui.exilus && ui.exilus !== "auto" ? BY_ID[ui.exilus] : null,
    };
    const arcs = ui.arcs.map((en) => ARCS.find((a) => a.en === en)).filter(Boolean);
    const arcX = {}; for (const a of arcs) { const s = arcStats(a); for (const k in s) arcX[k] = k === "effFix" ? s[k] : (arcX[k] || 0) + s[k]; }
    const per = ui.tau ? 0.15 : 0.10;
    let best = null;
    for (let a = 0; a <= ui.crimson; a++) {   // every split of the crimson shards between strength and duration
      const extra = Object.assign({}, arcX, { str: (arcX.str || 0) + a * per, dur: (arcX.dur || 0) + (ui.crimson - a) * per });
      const r = optimize(cfg, extra);
      if (r && (!best || r.sc > best.sc)) best = Object.assign(r, { nStr: a, nDur: ui.crimson - a, extra });
    }
    if (!best) return null;
    const all = cfg.fixed.concat(best.mods, cfg.aura ? [cfg.aura] : [], best.ex ? [best.ex] : []);
    return Object.assign(best, { sA: statsOf(all, best.extra, false), s4: statsOf(all, best.extra, true), cfg, arcs, arcX });
  }

  const pct = (v) => `${+(v * 100).toFixed(1)}%`;
  function resultHtml(g, r, ui, d) {
    const { sA, s4, cfg } = r;
    const has4 = cfg.main.includes(4) && STATS.some((k) => Math.abs(s4[k] - sA[k]) > 1e-9);
    const slot = (m, n, tag) => `<div class="aslot${tag ? " fixed" : ""}"><i class="anum">${n}</i>${tag ? `<span class="atag">${tag}</span>` : ""}<b class="aname">${esc(m ? m.ko : "빈 칸")}</b>${m ? `<small class="aalt">${esc((m.text || []).join(" · ").slice(0, 80))}</small>` : ""}</div>`;
    const mods = cfg.fixed.map((m) => [m, "고정"]).concat(r.mods.map((m) => [m, ""]));
    while (mods.length < 8) mods.push([null, ""]);
    const tgt = (k) => Math.max(0, ...cfg.targets.filter((t) => t.k === k && t.slot !== 4).map((t) => t.v));
    const bar = (k, s, label) => { const v = s[k], t = tgt(k); const max = Math.max(k === "eff" ? 1.75 : 3, v, t); const miss = t && v < t - 1e-9;
      return `<div class="fcs"><span>${label || STAT_KO[k]}</span><i><b style="width:${Math.min(100, (v / max) * 100).toFixed(1)}%"></b>${t ? `<em style="left:${Math.min(100, (t / max) * 100).toFixed(1)}%" title="목표 ${pct(t)}"></em>` : ""}</i><strong class="${miss ? "bad" : ""}">${pct(v)}</strong></div>`; };
    const valOf = (t) => (t.slot === 4 ? s4 : sA)[t.k];
    const okOf = (t) => t.max ? valOf(t) <= t.v + 1e-9 : valOf(t) >= t.v - 1e-9;
    const missing = cfg.targets.concat(cfg.maxes.map((t) => Object.assign({ max: true }, t))).filter((t) => !okOf(t));
    const shardTxt = [r.nStr ? `빨강(위력) ×${r.nStr}` : "", r.nDur ? `빨강(지속) ×${r.nDur}` : "", 5 - ui.crimson > 0 ? (ui.rest ? `${ui.rest} (${5 - ui.crimson}칸)` : `자유 ${5 - ui.crimson}칸`) : ""].filter(Boolean).join(" · ");
    const surv = [["hp", "체력"], ["sh", "실드"], ["ar", "방어력"], ["energy", "최대 에너지"], ["cast", "시전 속도"]].filter(([k]) => sA[k]).map(([k, n]) => `${n} ${sA[k] > 0 ? "+" : ""}${Math.round(sA[k] * 100)}%`).join(" · ");
    const med = STATS.filter((k) => d.med[k] != null).map((k) => `${STAT_KO[k]} ${Math.round(d.med[k])}%`).join(" · ");
    const arcNote = Object.keys(r.arcX).length ? ` (${Object.entries(r.arcX).map(([k, v]) => k === "effFix" ? "효율 175% 고정" : `${STAT_KO[k]} +${Math.round(v * 100)}%`).join(", ")} 반영)` : "";
    return `${missing.length ? `<p class="warn">체크한 조건을 모두 맞출 수 없습니다: ${missing.map((t) => `${t.slot === 4 ? "4번 " : ""}${STAT_KO[t.k]} ${pct(t.v)} ${t.max ? "이하" : "이상"}`).join(", ")}. 고정 모드를 줄이거나 조건을 풀어 보세요.</p>` : ""}
      <h4 class="fch">추천 세팅</h4>
      <div class="ars"><div class="arow top">${slot(cfg.aura, "오라", "")}${slot(r.ex, "익실러스", cfg.exFixed ? "고정" : "")}</div>
      <div class="arow">${mods.map(([m, t], i) => slot(m, i + 1, t)).join("")}</div></div>
      <div class="fcmeta"><span>아케인 <b>${r.arcs.map((a) => esc(a.ko)).join(" · ") || "없음"}</b>${esc(arcNote)}</span><span>아콘 샤드 <b>${esc(shardTxt)}${ui.tau ? " · 타우포지드" : ""}</b></span><span>헬민스 <b>${esc(ui.helm || "없음")}</b></span>
        <span>모드 용량 <b class="${r.cap.fits ? "" : "bad"}">${r.cap.drain} / ${r.cap.cap}</b> · 포르마 <b>${r.cap.forma}개</b></span></div>
      <div class="fcstats">${STATS.map((k) => bar(k, sA)).join("")}${has4 ? bar("str", s4, "4번 위력") : ""}</div>
      ${surv ? `<p class="hint" style="margin:0 0 8px">생존 모드 합계: ${esc(surv)}</p>` : ""}
      ${ui.bps.length ? `<div class="tscroll"><table class="tbl"><thead><tr><th>브레이크포인트</th><th>필요</th><th>이 세팅</th><th>달성</th></tr></thead><tbody>${ui.bps.map((x) => {
        const b = g.breakpoints[x.i], t = { k: x.k, v: x.v, slot: x.slot || 0, max: x.max };
        return `<tr><td>${esc(b.slot ? b.slot + "번 " : "")}${esc(b.effect)}</td><td class="num">${STAT_KO[x.k]} ${pct(x.v)} ${x.max ? "이하" : "이상"}</td><td class="num">${pct(valOf(t))}</td><td>${okOf(t) ? '<span class="gok">달성</span>' : '<span class="gno">미달</span>'}</td></tr>`; }).join("")}</tbody></table></div>` : ""}
      ${med ? `<p class="hint" style="margin:6px 0 0">참고: 커뮤니티 세팅 ${d.n}개의 중앙값은 ${esc(med)}입니다.</p>` : ""}
      <p class="hint" style="margin:6px 0 0">모든 모드 최대 랭크, 오로킨 리액터 장착(용량 60) 기준입니다. 움브랄 세트 보너스, 그로잉 파워(무기 상태이상 시 위력 +25%), 아케인 최대 중첩 효과를 넣었습니다. 프리시젼 인텐시파이는 4번에만 적용합니다.</p>`;
  }

  function readUi(card, g) {
    const q = (s) => card.querySelector(s);
    const dirs = {}, min = {}, max = {};
    for (const k of STATS) { dirs[k] = q(`.fc-dir-${k}`).value; min[k] = +q(`.fc-min-${k}`).value || 0; max[k] = +q(`.fc-max-${k}`).value || 0; }
    const v = q(".fc-var");
    return {
      frameEn: v && v.value === "prime" ? g.name_en + " Prime" : g.name_en,
      main: [...card.querySelectorAll(".fc-main:checked")].map((x) => +x.value),
      bps: [...card.querySelectorAll(".fc-bp:checked")].map((x) => { const i = +x.value, b = g.breakpoints[i], sel = card.querySelector(`.fc-tier[data-i="${i}"]`);
        return { i, slot: b.slot, k: GUIDE_STAT[b.stat], v: +(sel ? sel.value : x.dataset.v), max: x.dataset.max === "1" }; }),
      dirs, min, max,
      fixed: q(".fc-fixed").value.split(/[,，]/).map((x) => x.trim()).filter(Boolean).map(lookMod).filter(Boolean).map((m) => m.id),
      aura: q(".fc-aura").value, exilus: q(".fc-ex").value,
      arcs: [q(".fc-a0").value, q(".fc-a1").value].filter(Boolean),
      crimson: +q(".fc-crim").value, rest: q(".fc-rest").value.trim(), tau: q(".fc-tau").checked, helm: q(".fc-helm").value.trim(),
    };
  }

  root.WF_FrameCalc = {
    html(g) {
      const d = communityDefaults(g);
      const main = new Set(g.main_slots || []);
      const ab = (g.abilities || []).filter((a) => a.slot >= 1 && a.slot <= 4).sort((a, b) => a.slot - b.slot);
      const sp = g.stat_priority || [];
      const prio = sp.map((p) => GUIDE_STAT[p.stat]).filter(Boolean); for (const k of STATS) if (!prio.includes(k)) prio.push(k);
      const note = (k) => { const p = sp.find((x) => GUIDE_STAT[x.stat] === k); return p ? p.note || "" : ""; };
      const auras = MODS.filter((m) => m.compat === "AURA").sort((a, b) => a.ko.localeCompare(b.ko, "ko"));
      const exs = MODS.filter((m) => m.ex).sort((a, b) => a.ko.localeCompare(b.ko, "ko"));
      const base = String(g.name_en || "").replace(/ Prime$/, "");
      const fixable = MODS.filter((m) => (m.compat === "WARFRAME" && !m.ex) || m.compat === base).sort((a, b) => a.ko.localeCompare(b.ko, "ko"));
      const bpRows = (g.breakpoints || []).map((b, i) => {
        const T = bpTiers(b, dirDefault(prio.indexOf(GUIDE_STAT[b.stat]), note(GUIDE_STAT[b.stat])) === "low"); if (!T) return "";
        const plain = T.tiers.filter((t) => !t.cp).sort((x, y) => T.max ? y.v - x.v : x.v - y.v);
        const def = (d.aura === "corrosive_projection" && T.tiers.find((t) => t.cp)) || plain[0] || T.tiers[0];
        const reach = T.max || def.v <= ({ str: 4.5, dur: 4.5, rng: 3.2, eff: 1.75 })[T.k];   // obviously unreachable tiers start unchecked
        const tierSel = T.tiers.length > 1 ? `<select class="fc-tier" data-i="${i}" aria-label="목표 수치">${T.tiers.map((t) => `<option value="${t.v}"${t === def ? " selected" : ""}>${pct(t.v)}${t.cp ? " (코로시브)" : ""} ${T.max ? "이하" : "이상"}</option>`).join("")}</select>` : `<span class="fctier">${pct(def.v)} ${T.max ? "이하" : "이상"}</span>`;
        return `<div class="fcbp"><label class="inline"><input type="checkbox" class="fc-bp" value="${i}" data-v="${def.v}" data-max="${T.max ? 1 : 0}"${(main.has(b.slot) || !b.slot) && b.verified && reach ? " checked" : ""}><span>${b.slot ? b.slot + "번 " : ""}${esc(b.effect)}<small>${STAT_KO[T.k]} ${esc(b.value)}${b.verified ? "" : " · 미확인"}</small></span></label>${tierSel}</div>`;
      }).join("");
      const arcOpts = (sel) => `<option value="">없음</option>` + ARCS.slice().sort((a, b) => a.ko.localeCompare(b.ko, "ko")).map((a) => `<option value="${esc(a.en)}"${a.en === sel ? " selected" : ""}>${esc(a.ko)}</option>`).join("");
      const exDefault = d.exilus && !isStatMod(BY_ID[d.exilus]) ? d.exilus : "auto";
      const hasPrime = g.has_prime && POL[g.name_en + " Prime"];
      return `<section class="card fcalc"><h3>내 콘셉트로 세팅 계산 <small>조건을 바꾸면 바로 다시 계산합니다</small></h3>
        <div class="fcgrid">
          <div class="fccol">
            ${hasPrime ? `<label>워프레임<select class="fc-var"><option value="prime" selected>${esc(g.name_ko)} 프라임</option><option value="base">${esc(g.name_ko)}</option></select></label>` : ""}
            <div class="clabel">주력 어빌리티</div>
            <div class="fcchips">${ab.map((a) => `<label class="inline"><input type="checkbox" class="fc-main" value="${a.slot}"${main.has(a.slot) ? " checked" : ""}><span>${a.slot} ${esc(a.name_ko)}</span></label>`).join("")}</div>
            <div class="clabel">능력치 방향 <small>최소·최대는 비워 두어도 됩니다</small></div>
            <div class="fcdirs">${prio.map((k) => `<div class="fcdir"><b>${STAT_KO[k]}</b><select class="fc-dir-${k}">${DIRS.map(([v, n]) => `<option value="${v}"${v === dirDefault(prio.indexOf(k), note(k)) ? " selected" : ""}>${n}</option>`).join("")}</select>
              <input type="number" class="fc-min-${k}" min="0" max="999" step="1" placeholder="최소 %"><input type="number" class="fc-max-${k}" min="0" max="999" step="1" placeholder="최대 %"></div>`).join("")}</div>
            <div class="clabel">맞출 브레이크포인트</div>
            <div class="fcbps">${bpRows || '<p class="hint" style="margin:0">수치로 맞출 브레이크포인트가 없습니다.</p>'}</div>
          </div>
          <div class="fccol">
            <label>고정 모드 <small>쉼표로 구분, 최대 8개 · 기본값은 커뮤니티 세팅 ${d.n}개 중 40% 이상이 쓰는 모드</small><input type="text" class="fc-fixed" list="fc-modlist" value="${esc(d.fixed.map((id) => BY_ID[id].ko).join(", "))}"></label>
            <datalist id="fc-modlist">${fixable.map((m) => `<option value="${esc(m.ko)}"></option>`).join("")}</datalist>
            <div class="row2"><label>오라<select class="fc-aura"><option value="">없음</option>${auras.map((m) => `<option value="${m.id}"${m.id === d.aura ? " selected" : ""}>${esc(m.ko)}</option>`).join("")}</select></label>
            <label>익실러스<select class="fc-ex"><option value="auto"${exDefault === "auto" ? " selected" : ""}>자동 (능력치 모드 중 최선)</option>${exs.map((m) => `<option value="${m.id}"${m.id === exDefault ? " selected" : ""}>${esc(m.ko)}</option>`).join("")}</select></label></div>
            <div class="row2"><label>아케인 1<select class="fc-a0">${arcOpts(d.arcs[0])}</select></label><label>아케인 2<select class="fc-a1">${arcOpts(d.arcs[1])}</select></label></div>
            <div class="row2"><label>빨강 샤드(위력·지속) 칸 수<select class="fc-crim">${[0, 1, 2, 3, 4, 5].map((n) => `<option${n === d.crimson ? " selected" : ""}>${n}</option>`).join("")}</select></label>
            <label>나머지 샤드<input type="text" class="fc-rest" value="${esc(d.rest)}"></label></div>
            <label class="inline"><input type="checkbox" class="fc-tau"${d.tau ? " checked" : ""}><span>타우포지드 샤드 (빨강 +15%)</span></label>
            <label>헬민스<input type="text" class="fc-helm" value="${esc(d.helm)}"></label>
            <button type="button" class="ghostbtn fc-reset">커뮤니티 기본값으로 되돌리기</button>
          </div>
        </div>
        <div class="fc-out"></div></section>`;
    },
    bind(box, g) {
      const card = box.querySelector(".fcalc"); if (!card) return;
      const out = card.querySelector(".fc-out"), d = communityDefaults(g);
      let tm = 0;
      const go = () => {
        clearTimeout(tm);
        tm = setTimeout(() => {
          const ui = readUi(card, g);
          let r = null; try { r = run(g, ui); } catch (e) { console.error(e); }
          out.innerHTML = r ? resultHtml(g, r, ui, d) : `<p class="warn">계산할 수 있는 모드가 없습니다.</p>`;
        }, 120);
      };
      card.addEventListener("change", go);
      card.addEventListener("input", (e) => { if (e.target.matches("input[type=number],input[type=text]")) go(); });
      card.querySelector(".fc-reset").addEventListener("click", () => {
        const fresh = document.createElement("div"); fresh.innerHTML = root.WF_FrameCalc.html(g);
        card.replaceWith(fresh.firstElementChild); root.WF_FrameCalc.bind(box, g);
      });
      go();
    },
    _run: run, _defaults: communityDefaults, _dir: dirDefault, _tiers: bpTiers,
  };
})(typeof window !== "undefined" ? window : globalThis);
