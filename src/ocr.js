/* Arsenal screenshot → comparison set.
 * Text recognition runs in the browser with tesseract.js (Korean + English), loaded from jsDelivr on first use.
 * Each screenshot is read several times with different brightness thresholds (white card names, purple riven text),
 * then mod / arcane names are matched with a typo-tolerant search against the names the page already knows. */
(function (root) {
  const TESS_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  const MAX_W = 2400;
  // binarize: text pixels → black. White card names, light text, and the purple riven card text.
  const PASSES = [
    { id: "w170", fn: (r, g, b) => Math.min(r, g, b) > 170 },
    { id: "l160", fn: (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b > 160 },
    { id: "m170", fn: (r, g, b) => Math.max(r, g, b) > 170 },
  ];

  let worker = null, logFn = null;
  function loadScript(src) {
    return new Promise((ok, fail) => {
      if (root.Tesseract) return ok();
      const s = document.createElement("script");
      s.src = src; s.onload = () => ok(); s.onerror = () => fail(new Error("글자 인식 도구를 불러오지 못했습니다 (인터넷 연결 확인)"));
      document.head.appendChild(s);
    });
  }
  async function getWorker() {
    if (!worker) worker = (async () => {
      await loadScript(TESS_URL);
      const w = await root.Tesseract.createWorker(["kor", "eng"], 1, { logger: (m) => logFn && logFn(m) });
      await w.setParameters({ tessedit_pageseg_mode: "11" });
      return w;
    })().catch((e) => { worker = null; throw e; });
    return worker;
  }

  function scaled(bmp, k) {
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return c;
  }
  function binarize(src, fn) {
    const c = document.createElement("canvas");
    c.width = src.width; c.height = src.height;
    const sd = src.getContext("2d").getImageData(0, 0, src.width, src.height), d = sd.data;
    const out = c.getContext("2d").createImageData(src.width, src.height), o = out.data;
    for (let i = 0; i < d.length; i += 4) { const v = fn(d[i], d[i + 1], d[i + 2]) ? 0 : 255; o[i] = o[i + 1] = o[i + 2] = v; o[i + 3] = 255; }
    c.getContext("2d").putImageData(out, 0, 0);
    return c;
  }
  // tesseract TSV → lines with boxes
  function parseTSV(tsv, img, pass) {
    const lines = new Map();
    for (const row of String(tsv || "").split("\n").slice(1)) {
      const r = row.split("\t");
      if (r.length < 12 || r[0] !== "5" || !r[11].trim()) continue;
      const key = r[2] + "." + r[3] + "." + r[4];
      const x = +r[6], y = +r[7], w = +r[8], h = +r[9];
      let L = lines.get(key);
      if (!L) { L = { img, pass, words: [], x0: x, y0: y, x1: x + w, y1: y + h }; lines.set(key, L); }
      L.words.push(r[11]); L.x0 = Math.min(L.x0, x); L.y0 = Math.min(L.y0, y); L.x1 = Math.max(L.x1, x + w); L.y1 = Math.max(L.y1, y + h);
    }
    return [...lines.values()].map((L) => ({ img: L.img, pass: L.pass, text: L.words.join(" "), x0: L.x0, y0: L.y0, x1: L.x1, y1: L.y1 }));
  }
  // a region of the original-size screenshot (fractions of width/height), for small glowing text a shrunk image loses
  function cropped(bmp, c) {
    const x = Math.round(bmp.width * c.x0), y = Math.round(bmp.height * c.y0), w = Math.round(bmp.width * (c.x1 - c.x0)), h = Math.round(bmp.height * (c.y1 - c.y0));
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    cv.getContext("2d").drawImage(bmp, x, y, w, h, 0, 0, w, h);
    return { cv, x, y };
  }
  // read every screenshot with every pass; progress(0..1, label). opts.crops: extra regions of big screenshots read at full size
  async function read(files, progress, opts) {
    const w = await getWorker();
    const out = [];
    const bmps = [];
    for (const f of files) bmps.push(await createImageBitmap(f));
    // big screenshots are shrunk to MAX_W; a small crop (one riven card) is read at 1× and 2× and the lines merged
    const scalesOf = (b) => b.width < 1200 ? [1, 2] : [Math.min(1, MAX_W / b.width)];
    const cropsOf = (b) => b.width < 1200 ? [] : (opts && opts.crops) || [];
    const total = bmps.reduce((n, b) => n + (scalesOf(b).length + cropsOf(b).length) * PASSES.length, 0);
    let done = 0;
    for (let fi = 0; fi < bmps.length; fi++) {
      const ks = scalesOf(bmps[fi]), base = scaled(bmps[fi], ks[0]);
      const lines = [];
      for (const k of ks) {
        const c = k === ks[0] ? base : scaled(bmps[fi], k), f = ks[0] / k;
        for (const p of PASSES) {
          logFn = (m) => { if (m.status === "recognizing text" && progress) progress((done + (m.progress || 0)) / total, `${fi + 1}번째 이미지 읽는 중`); };
          const r = await w.recognize(binarize(c, p.fn), {}, { text: false, blocks: false, tsv: true });
          for (const L of parseTSV(r.data.tsv, fi, ks.length > 1 ? p.id + "@" + k : p.id)) { L.x0 *= f; L.x1 *= f; L.y0 *= f; L.y1 *= f; lines.push(L); }
          done++;
          if (progress) progress(done / total, `${fi + 1}번째 이미지 읽는 중`);
        }
      }
      for (const [ci, c] of cropsOf(bmps[fi]).entries()) {
        const { cv, x, y } = cropped(bmps[fi], c), k = ks[0];
        for (const p of PASSES) {
          logFn = (m) => { if (m.status === "recognizing text" && progress) progress((done + (m.progress || 0)) / total, `${fi + 1}번째 이미지 자세히 읽는 중`); };
          const r = await w.recognize(binarize(cv, p.fn), {}, { text: false, blocks: false, tsv: true });
          for (const L of parseTSV(r.data.tsv, fi, p.id + "@c" + ci)) { L.x0 = (L.x0 + x) * k; L.x1 = (L.x1 + x) * k; L.y0 = (L.y0 + y) * k; L.y1 = (L.y1 + y) * k; lines.push(L); }
          done++;
          if (progress) progress(done / total, `${fi + 1}번째 이미지 자세히 읽는 중`);
        }
      }
      out.push({ img: fi, w: base.width, h: base.height, canvas: base, lines });
    }
    logFn = null;
    return out;
  }

  /* ---------- matching (pure, testable in node) ---------- */
  const norm = (s) => String(s || "").replace(/[^가-힣A-Za-z0-9]/g, "").toLowerCase();
  // edit distance of `pat` against the best-fitting substring of `txt` (free start and end in txt)
  function fitDist(pat, txt) {
    const m = pat.length, n = txt.length;
    let prev = new Array(n + 1).fill(0), cur = new Array(n + 1);
    for (let i = 1; i <= m; i++) {
      cur[0] = i;
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (pat[i - 1] === txt[j - 1] ? 0 : 1));
      [prev, cur] = [cur, prev];
    }
    let best = Infinity; for (let j = 0; j <= n; j++) best = Math.min(best, prev[j]);
    return best;
  }
  // a name wrapped over two lines on a card: join each line with the one right below it
  function segments(lines) {
    const out = [];
    const byKey = new Map();
    for (const L of lines) { const k = L.img + "|" + L.pass; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(L); }
    for (const group of byKey.values()) {
      for (const a of group) {
        const ta = norm(a.text);
        if (ta.length >= 2) out.push({ t: ta, box: a });
        const ha = a.y1 - a.y0, ca = (a.x0 + a.x1) / 2;
        for (const b of group) {
          if (b === a) continue;
          const gap = b.y0 - a.y1, cb = (b.x0 + b.x1) / 2, wmax = Math.max(a.x1 - a.x0, b.x1 - b.x0, ha * 3);
          if (gap < -ha * 0.3 || gap > ha * 1.1 || Math.abs(ca - cb) > wmax * 0.6) continue;
          const t = ta + norm(b.text);
          if (t.length >= 3) out.push({ t, box: { img: a.img, pass: a.pass, x0: Math.min(a.x0, b.x0), y0: a.y0, x1: Math.max(a.x1, b.x1), y1: b.y1 } });
        }
      }
    }
    return out;
  }
  // words that belong to only one candidate name ("트루스" → 길디드 트루스): enough to recognise a half-read card
  function tokenIndex(cands) {
    if (cands._tok) return cands._tok;
    const cnt = new Map();
    for (const c of cands) for (const w of String(c.ko).split(/\s+/).map(norm)) if (w.length >= 3) { if (!cnt.has(w)) cnt.set(w, []); cnt.get(w).push(c); }
    const uniq = [];
    for (const [w, cs] of cnt) if (cs.length === 1 && !cands.some((c) => c !== cs[0] && norm(c.ko).includes(w))) uniq.push({ w, c: cs[0] });
    Object.defineProperty(cands, "_tok", { value: uniq, enumerable: false });
    return uniq;
  }
  function bestName(seg, cands) {
    let top = null;
    const hits = [];
    for (const c of cands) {
      const n = c._n || (c._n = norm(c.ko));
      if (n.length < 3 || seg.t.length < n.length * 0.6) continue;
      const sim = 1 - fitDist(n, seg.t) / n.length;
      // short names (훨윈드): one misread letter is fine when the line holds little else
      if (sim >= (n.length >= 5 ? 0.72 : seg.t.length <= n.length + 1 ? 0.66 : 0.86)) hits.push({ c, sim, len: n.length });
    }
    if (!hits.length) {
      for (const u of tokenIndex(cands)) if (seg.t.includes(u.w) && seg.t.length <= norm(u.c.ko).length + 4) return { c: u.c, sim: 0.74, len: norm(u.c.ko).length, partial: true };
      return null;
    }
    const maxSim = Math.max(...hits.map((h) => h.sim));
    for (const h of hits) if (h.sim >= maxSim - 0.12 && (!top || h.sim * h.len > top.sim * top.len)) top = h;
    // "Bz서레이션": junk in front of a name that also has a longer variant (아말감 서레이션) — can't tell which: ask
    if (top && seg.t.length >= top.len + 2) {
      const longer = cands.filter((c) => c !== top.c && (c._n || (c._n = norm(c.ko))).endsWith(top.c._n) && c._n.length > top.len);
      if (longer.length) {
        // unread letters in front about as long as the variant's prefix ("Bz" ↔ "아말감"): it's most likely that variant
        const extra = seg.t.length - top.len, fit = longer.filter((c) => Math.abs(c._n.length - top.len - extra) <= 1);
        const one = longer.length === 1 ? longer[0] : null;
        const v = one && (fit.length === 1 || 1 - fitDist(one._n, seg.t) / one._n.length >= 0.72) ? one : null;
        top = Object.assign({}, top, v ? { c: v, len: v._n.length } : {}, { sim: Math.min(top.sim, 0.8), variant: true });
      }
    }
    return top;
  }
  const overlap = (a, b) => a.img === b.img && Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0;

  // riven stat labels as the Korean client writes them (longest first so "슬라이드 공격 치명타 확률" wins over "치명타 확률")
  const RIV_LABELS = [
    ["슬라이드 공격 치명타 확률", "x_slidecc"], ["추가 연속기 카운트 확률", "x_combochance"], ["연속기 카운트 확률", "x_combochance"], ["연속기 획득 확률", "x_combochance"],
    ["연속기 카운트 획득 확률", "x_combochance"], ["상태 이상 지속 시간", "dur"], ["상태 이상 확률", "sc"], ["상태 이상 피해", "sd"], ["연속기 지속 시간", "x_combodur"], ["마무리 일격 피해", "x_finisher"], ["강 공격 효율", "x_hae"],
    ["치명타 확률", "cc"], ["치명타 피해", "cd"], ["재장전 속도", "reload"], ["탄창 용량", "mag"], ["탄약 최대량", "x_ammo"], ["두께 꿰뚫기", "x_pt"],
    ["발사체 속도", "x_speed"], ["투사체 속도", "x_speed"], ["확대율", "x_zoom"], ["반동", "x_recoil"], ["기본 연속기", "ic"], ["초기 연속기", "ic"],
    ["공격 속도", "fr"], ["연사력", "fr"], ["멀티샷", "ms"], ["사거리", "x_range"], ["화염", "heat"], ["냉기", "cold"], ["전기", "elec"], ["독성", "tox"],
    ["바이러스", "viralm"], ["부식", "corrm"], ["가스", "gasm"], ["방사능", "radm"], ["폭발", "blastm"], ["자성", "magm"],
    ["충격", "impact"], ["관통", "punct"], ["베기", "slash"], ["그리니어", "fac_g"], ["코퍼스", "fac_c"], ["인페스티드", "fac_i"], ["오로킨", "fac_o"], ["테크롯", "fac_t"], ["스칼드라", "fac_s"],
    ["약점 치명타 확률", "wpcc"], ["약점 피해", "wpd"], ["탄약 효율", "ammoeff"], ["강 공격 피해", "heavyd"], ["강공 피해", "heavyd"], ["강 공격 준비", "windup"], ["와인드업", "windup"],
    ["막기 각도", "block"], ["슬램 피해", "slam"], ["보관", "holster"], ["피해", "dmg"],
  ].map(([ko, k]) => ({ ko, k, n: norm(ko) }));
  function rivenStatOf(rest) {
    const t = norm(rest);
    if (!t) return null;
    let best = null;
    for (const L of RIV_LABELS) {
      if (t.length < L.n.length * 0.5) continue;
      const sim = 1 - fitDist(L.n, t) / L.n.length;
      const need = L.n.length <= 2 ? 1 : L.n.length >= 5 ? 0.65 : 0.7;
      if (sim >= need && (!best || sim * L.n.length > best.sim * best.n.length)) best = Object.assign({ sim }, L);
    }
    return best;
  }
  // element icons in front of a riven line, by colour (toxin green, heat orange, cold light blue, electricity blue-violet)
  function iconElement(canvas, box) {
    if (!canvas || !canvas.getContext) return null;
    const x0 = Math.max(0, Math.floor(box.x0)), y0 = Math.max(0, Math.floor(box.y0)), w = Math.max(1, Math.floor(box.x1 - box.x0)), h = Math.max(1, Math.floor(box.y1 - box.y0));
    const d = canvas.getContext("2d").getImageData(x0, y0, Math.min(w, canvas.width - x0), Math.min(h, canvas.height - y0)).data;
    const cnt = { tox: 0, heat: 0, cold: 0 };
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if (g > 150 && r < 120 && b < 140 && g - Math.max(r, b) > 50) cnt.tox++;
      else if (r > 200 && g > 90 && g < 190 && b < 90) cnt.heat++;
      else if (b > 200 && g > 170 && r < 170) cnt.cold++;
    }
    const best = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    return best[1] >= 12 ? best[0] : null;
  }
  function parseRiven(reads, near) {
    const found = new Map();   // value → {v, sign, stat, guess, y}
    for (const R of reads) {
      const groups = new Map();
      for (const L of R.lines) { const k = L.pass; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(L); }
      for (const lines of groups.values()) for (const L of lines) {
        const m = String(L.text).replace(/[−–—~]/g, "-").match(/([+-])?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*%\s*(.*)$/);
        if (!m) continue;
        const v = parseFloat(m[2].replace(",", "."));
        if (!(v > 0 && v < 700)) continue;
        const h = L.y1 - L.y0;
        // the stat name can be split off on the same row (cursor, icon) or wrap onto the next line
        const sameRow = lines.filter((o) => o !== L && o.x0 >= L.x1 - h && o.x0 - L.x1 < h * 3 && Math.min(o.y1, L.y1) - Math.max(o.y0, L.y0) > Math.min(h, o.y1 - o.y0) * 0.5).sort((a, b) => a.x0 - b.x0);
        let rest = [m[3]].concat(sameRow.map((o) => o.text)).join(" ");
        let st = rivenStatOf(rest);
        if (!st || st.sim < 0.9) {
          const below = lines.find((o) => o !== L && !/%/.test(o.text) && o.y0 >= L.y1 - h * 0.3 && o.y0 - L.y1 < h * 0.8 && Math.min(o.x1, L.x1) - Math.max(o.x0, L.x0) > 0);
          if (below) { const st2 = rivenStatOf(rest + " " + below.text); if (st2 && (!st || st2.sim > st.sim)) st = st2; }
        }
        const key = v.toFixed(1);
        const cur = found.get(key) || { v, sign: null, stat: null, guess: false, y: L.y0, box: L, canvas: R.canvas, seen: 0 };
        cur.seen++;
        if (m[1]) cur.sign = cur.sign || m[1];
        if (st && (!cur.stat || st.sim > cur.stat.sim)) cur.stat = st;
        found.set(key, cur);
      }
    }
    // riven lines carry a sign or a stat word after the % (arsenal panel values are bare numbers)
    let rows = [...found.values()].filter((x) => x.sign || x.stat);
    if (!rows.length) return null;
    rows.sort((a, b) => a.y - b.y);
    const blocks = [];
    for (const r of rows) { const b = blocks.find((B) => Math.abs(B[B.length - 1].y - r.y) < 90 && B[0].box.img === r.box.img); if (b) b.push(r); else blocks.push([r]); }
    const nearRiv = (B) => near && B[0].box.img === near.img && B[0].y >= near.y0 - 5 && B[0].y - near.y1 < (near.y1 - near.y0) * 5;
    const block = blocks.filter((B) => B.some((x) => x.sign)).sort((a, b) => (nearRiv(b) - nearRiv(a)) || b.length - a.length)[0];
    if (!block || block.length < 2) return null;
    const stats = block.slice(0, 4).map((x) => {
      let k = x.stat ? x.stat.k : null, guess = false;
      if (!k) { const el = iconElement(x.canvas, x.box); if (el) { k = el; guess = true; } }
      if (!k || (x.stat && x.stat.n.length >= 4 && x.stat.sim < 0.85)) guess = true;
      return { v: x.v, k, neg: x.sign === "-", guess, y: x.y };
    });
    // the curse is always listed last; "치명타" alone can be 확률 or 피해 — take the one not used yet
    if (stats.length === 4 && !stats.some((s) => s.neg)) stats[3].neg = true;
    for (const s of stats) if (s.k === "x_recoil") s.neg = !s.neg;      // recoil: "+%" is the bad roll
    const used = new Set(stats.filter((s) => s.k && !s.guess).map((s) => s.k));
    for (const s of stats) if (s.guess && (s.k === "cc" || s.k === "cd") && used.has(s.k)) { s.k = s.k === "cc" ? "cd" : "cc"; }
    return stats;
  }

  // weapon name in the arsenal header ("업그레이드/코다 패소시스트 [40]"), if the screenshot shows it
  function findWeapon(reads, weapons) {
    let best = null;
    for (const R of reads) for (const L of R.lines) {
      const raw = String(L.text).replace(/\s+/g, "");
      // "업그레이드/코다 패소시스트 [40]": the header line, or a top-of-screen line ending in the rank bracket
      if (!/그레이드/.test(raw) && !(/\[\d{1,2}\]/.test(raw) && (!R.h || L.y0 < R.h * 0.15))) continue;
      const t = norm(raw.replace(/.*그레이드\/?/, "").replace(/\[.*$/, ""));
      if (t.length < 2) continue;
      for (const w of weapons) {
        const n = w._n || (w._n = norm(w.ko));
        if (n.length < 2 || t.length < n.length * 0.7) continue;
        const sim = 1 - fitDist(n, t) / n.length;
        if (sim >= 0.85 && (!best || sim * n.length > best.sim * best.n.length)) best = { w, sim, n };
      }
    }
    return best ? best.w : null;
  }

  // ctx: { mods: [{id, ko, exilus, group}], arcanes: [{id, ko}], all: every mod and arcane in the game (any weapon class) }
  function match(reads, ctx) {
    const segs = [];
    for (const R of reads) segs.push(...segments(R.lines));
    const det = [], foreign = new Map();
    for (const s of segs) {
      const hm = bestName(s, ctx.mods), ha = bestName(s, ctx.arcanes);
      let h = ha && (!hm || ha.sim * ha.len > hm.sim * hm.len) ? Object.assign({ arc: true }, ha) : hm;
      // a name that fits a mod of another weapon class better is that mod, not a near-miss of ours
      const hg = ctx.all ? bestName(s, ctx.all) : null;
      if (hg && hg.sim >= 0.85 && (!h || (hg.c.id !== h.c.id && hg.sim * hg.len > h.sim * h.len + 0.01))) {
        if (!foreign.has(hg.c.id) || foreign.get(hg.c.id).sim < hg.sim) foreign.set(hg.c.id, { c: hg.c, sim: hg.sim });
        h = null;
      }
      if (h) det.push({ c: h.c, sim: h.sim, len: h.len, arc: !!h.arc, box: s.box });
    }
    // one name per spot on the card grid: overlapping detections (several passes, wrapped lines) keep the best
    det.sort((a, b) => b.sim * b.len - a.sim * a.len || b.len - a.len);
    const spots = [];
    for (const d of det) { if (spots.some((s) => overlap(s.box, d.box))) continue; spots.push(d); }
    // same mod in several screenshots → once; variants (Primed / plain) can't both be equipped
    const byId = new Map();
    for (const s of spots) { const k = s.c.id; if (!byId.has(k) || byId.get(k).sim < s.sim) byId.set(k, s); }
    let picks = [...byId.values()];
    picks = picks.filter((p) => !picks.some((q) => q !== p && !p.arc && !q.arc && p.c.group && q.c.group === p.c.group && (q.sim > p.sim || (q.sim === p.sim && q.len > p.len))));
    const arc = picks.filter((p) => p.arc).sort((a, b) => b.sim - a.sim)[0] || null;
    const ex = picks.filter((p) => !p.arc && p.c.exilus).sort((a, b) => b.sim - a.sim)[0] || null;
    let normal = picks.filter((p) => !p.arc && !p.c.exilus);
    // riven card: hyphenated Latin riven name ("Acri-critatox", "Plaga-vexicron"), per screenshot
    const rivBoxes = {};
    for (const R of reads) for (const L of R.lines) {
      if (!/[A-Za-z]{3,}-/.test(L.text) || /^\s*MR\b/i.test(L.text)) continue;
      const nearMod = normal.some((p) => p.box.img === L.img && Math.abs((p.box.y0 + p.box.y1) / 2 - (L.y0 + L.y1) / 2) < (p.box.y1 - p.box.y0) * 3);
      if (nearMod && (!rivBoxes[L.img] || L.y0 < rivBoxes[L.img].y0)) rivBoxes[L.img] = L;
    }
    const anyRiv = Object.values(rivBoxes)[0] || null;
    const rivStats = parseRiven(reads, anyRiv);
    let hasRiv = !!(anyRiv || (rivStats && rivStats.length >= 2));
    if (normal.length > (hasRiv ? 7 : 8)) normal = normal.sort((a, b) => b.sim - a.sim).slice(0, hasRiv ? 7 : 8);
    // positions from one screenshot (the one showing the most of these mods); same-size screenshots share the layout
    const keep = new Set(normal.map((p) => p.c.id));
    const pos = {};   // id → img → box
    for (const sp of spots) if (keep.has(sp.c.id)) { (pos[sp.c.id] = pos[sp.c.id] || {}); if (!pos[sp.c.id][sp.box.img]) pos[sp.c.id][sp.box.img] = sp.box; }
    const imgs = reads.map((R) => R.img);
    const refImg = imgs.slice().sort((a, b) => Object.values(pos).filter((m) => m[b]).length - Object.values(pos).filter((m) => m[a]).length)[0];
    const sizeOf = (i) => reads.find((R) => R.img === i) || {};
    const sameSize = (i) => Math.abs((sizeOf(i).w || 0) - (sizeOf(refImg).w || 0)) <= (sizeOf(refImg).w || 0) * 0.015 && Math.abs((sizeOf(i).h || 0) - (sizeOf(refImg).h || 0)) <= (sizeOf(refImg).h || 0) * 0.015;
    const boxIn = (m) => (m && (m[refImg] || Object.keys(m).filter((i) => sameSize(+i)).map((i) => m[i])[0])) || null;
    const items = normal.map((p) => ({ id: p.c.id, ko: p.c.ko, sim: p.sim, box: boxIn(pos[p.c.id]) }));
    const rb = rivBoxes[refImg] || Object.keys(rivBoxes).filter((i) => sameSize(+i)).map((i) => rivBoxes[i])[0];
    // the riven goes into the grid cell no name was read from; its own text position (hover card) is only a fallback
    const rivItem = hasRiv ? { id: "__riven", ko: "리벤 모드", sim: 1, box: rb ? { x0: rb.x0, x1: rb.x1, y0: rb.y0, y1: rb.y1 } : null } : null;
    let placed = items.filter((x) => x.box), rest = items.filter((x) => !x.box);
    for (const x of placed) { x.cx = (x.box.x0 + x.box.x1) / 2; x.cy = (x.box.y0 + x.box.y1) / 2; x.h = x.box.y1 - x.box.y0; }
    const lineH = placed.length ? Math.min(...placed.map((x) => x.h)) : 20;
    const cluster = (vals, gap) => { const s = vals.slice().sort((a, b) => a - b), out = []; for (const v of s) { const c = out[out.length - 1]; if (c && v - c[c.length - 1] < gap) c.push(v); else out.push([v]); } return out.map((c) => c.reduce((a, b) => a + b, 0) / c.length); };
    const rowC = cluster(placed.map((x) => x.cy), lineH * 2.5), colC = cluster(placed.map((x) => x.cx), lineH * 4);
    let ordered, grid = null;
    const near = (cs, v) => cs.reduce((bi, c, i) => (Math.abs(c - v) < Math.abs(cs[bi] - v) ? i : bi), 0);
    if (rowC.length <= 2 && colC.length <= 4 && placed.length) {
      // the 2 × 4 mod grid: an empty cell left over with 7 names read is almost always the riven (purple text reads badly)
      const nCols = 4, cells = new Array(rowC.length * nCols).fill(null);
      const colIdx = (cx) => colC.length === nCols ? near(colC, cx) : Math.round(((cx - colC[0]) / Math.max(1, (colC[colC.length - 1] - colC[0]) / Math.max(1, colC.length - 1))));
      for (const x of placed) { const k = near(rowC, x.cy) * nCols + Math.min(nCols - 1, Math.max(0, colIdx(x.cx))); if (!cells[k]) cells[k] = x; else rest.push(x); }
      // an empty cell whose first line reads as a family prefix ("갈바나이즈드" over a second line the OCR can't read, e.g.
      // 앱티튜드) is that family's unused mod — not a riven. The second line's width says how long the rest of the name is.
      if (rowC.length === 2 && colC.length === nCols) {
        const dx = (colC[colC.length - 1] - colC[0]) / Math.max(1, colC.length - 1), dy = Math.max(lineH * 2, rowC[1] - rowC[0]);
        const lines = reads.filter((R) => R.img === refImg).flatMap((R) => R.lines);
        for (let k = 0; k < cells.length; k++) {
          if (cells[k]) continue;
          const cx = colC[k % nCols], cy = rowC[Math.floor(k / nCols)];
          const inCell = lines.filter((L) => Math.abs((L.x0 + L.x1) / 2 - cx) < dx * 0.5 && Math.abs((L.y0 + L.y1) / 2 - cy) < dy * 0.5);
          const usedIds = new Set(cells.filter(Boolean).map((c) => c.id));
          const usedGroups = new Set(cells.filter(Boolean).map((c) => (ctx.mods.find((m) => m.id === c.id) || {}).group).filter(Boolean));
          let best = null;
          for (const L of inCell) {
            const t = norm(L.text);
            if (t.length < 3 || !/[가-힣]{3}/.test(t)) continue;
            const below = inCell.filter((B) => B !== L && B.y0 >= L.y1 - (L.y1 - L.y0) * 0.3 && B.y0 - L.y1 < (L.y1 - L.y0) * 1.2);
            const charW = (L.x1 - L.x0) / t.length;
            const estRest = below.length ? Math.max(...below.map((B) => (B.x1 - B.x0) / charW)) : null;
            for (const m of ctx.mods) {
              if (m.exilus || usedIds.has(m.id) || (m.group && usedGroups.has(m.group))) continue;
              const n = m._n || (m._n = norm(m.ko));
              if (n.length <= t.length) continue;
              const sim = 1 - fitDist(t, n.slice(0, t.length + 1)) / t.length;
              if (sim < 0.8) continue;
              const fit = estRest == null ? 0 : -Math.abs((n.length - t.length) - estRest);
              const score = sim * 10 + fit;
              if (!best || score > best.score) best = { m, score, sim };
            }
          }
          if (best) cells[k] = { id: best.m.id, ko: best.m.ko, sim: Math.min(0.8, best.sim * 0.8) };
        }
      }
      if (!hasRiv && normal.length === 7 && rowC.length === 2 && colC.length === nCols && cells.filter((c) => !c).length === 1) {
        hasRiv = true; cells[cells.indexOf(null)] = { id: "__riven", ko: "리벤 모드", sim: 0.6, guessRiv: true };
      }
      if (rivItem) {
        const empties = cells.map((c, k) => (c ? -1 : k)).filter((k) => k >= 0);
        if (empties.length && rowC.length === 2 && colC.length === nCols) {
          let k = empties[0];
          if (rivItem.box) { const rx = (rivItem.box.x0 + rivItem.box.x1) / 2, ry = (rivItem.box.y0 + rivItem.box.y1) / 2; k = empties.sort((a, b) => Math.hypot(colC[a % nCols] - rx, (rowC[Math.floor(a / nCols)] - ry) * 2) - Math.hypot(colC[b % nCols] - rx, (rowC[Math.floor(b / nCols)] - ry) * 2))[0]; }
          cells[k] = rivItem;
        } else rest.push(rivItem);
      }
      ordered = cells.filter(Boolean).concat(rest);
      if (rowC.length === 2 && colC.length === nCols && !rest.length) grid = cells;
    } else {
      placed.sort((a, b) => a.cy - b.cy);
      const rows = [];
      for (const x of placed) { const r = rows[rows.length - 1]; if (r && x.cy - r[0].cy < lineH * 2.5) r.push(x); else rows.push([x]); }
      ordered = rows.flatMap((r) => r.sort((a, b) => a.cx - b.cx)).concat(rest, rivItem ? [rivItem] : []);
    }
    return {
      slots: (grid || ordered).map((x) => x ? { id: x.id, ko: x.ko, sure: x.sim >= 0.85, guessRiv: !!x.guessRiv } : null),
      orderSure: !!grid,
      exilus: ex ? { id: ex.c.id, ko: ex.c.ko, sure: ex.sim >= 0.85 } : null,
      arcane: arc ? { id: arc.c.id, ko: arc.c.ko, sure: arc.sim >= 0.85 } : null,
      riven: hasRiv ? { stats: rivStats || [] } : null,
      foreign: [...foreign.values()].map((f) => f.c),
    };
  }

  /* ---------- warframe upgrade screen: stat panel, aura, arcanes, frame name ---------- */
  const STAT_LBL = { health: ["체력", "health"], shield: ["실드", "shields"], armor: ["방어력", "armor"], energy: ["에너지", "energy"], sprint: ["질주속도", "sprintspeed"],
    range: ["거리", "range"], str: ["위력", "strength"], dur: ["지속시간", "duration"], eff: ["효율", "efficiency"] };
  const TOP_ORDER = ["health", "shield", "armor", "energy", "sprint"];
  // the ability block is sorted by the client's own names: Korean 거리·위력·지속 시간·효율, English Duration·Efficiency·Range·Strength
  const AB_ORDER = { ko: ["range", "str", "dur", "eff"], en: ["dur", "eff", "range", "str"] };
  function statNum(text) {
    const s = String(text || "").replace(/\s+/g, "");
    if (!s || /\//.test(s) || (s.match(/[가-힣A-Za-z]/g) || []).length > 1) return null;
    const m = s.match(/(\d[\d,.]*)(%?)/);
    if (!m || m[0].length < s.length - 2) return null;
    const t = m[1].replace(/[.,]$/, "");
    const v = /^\d{1,3}([,.]\d{3})+$/.test(t) ? +t.replace(/[,.]/g, "") : parseFloat(t.replace(/,/g, "."));
    return isFinite(v) ? { v, pct: !!m[2] } : null;
  }
  function frameStatsOf(R) {
    const nums = [];
    for (const L of R.lines) {
      if (L.x1 > R.w * 0.45) continue;
      const n = statNum(L.text); if (!n) continue;
      nums.push(Object.assign({ x0: L.x0, x1: L.x1, cy: (L.y0 + L.y1) / 2, h: L.y1 - L.y0, pass: L.pass }, n));
    }
    if (nums.length < 3) return null;
    // the value column is right-aligned: the right edge shared by the most numbers
    const h = nums.map((x) => x.h).sort((a, b) => a - b)[Math.floor(nums.length / 2)];
    let col = null;
    for (const a of nums) { const c = nums.filter((b) => Math.abs(b.x1 - a.x1) < h * 1.2); if (!col || c.length > col.length) col = c; }
    // one row per height; passes that disagree → the reading most passes agree on
    col.sort((a, b) => a.cy - b.cy);
    const rows = [];
    for (const x of col) { const r = rows[rows.length - 1]; if (r && x.cy - r.cy < h * 0.6) r.xs.push(x); else rows.push({ cy: x.cy, xs: [x] }); }
    for (const r of rows) {
      const tally = new Map();
      for (const x of r.xs) { const k = x.v + (x.pct ? "%" : ""); tally.set(k, (tally.get(k) || 0) + 1); }
      const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const pick = r.xs.find((x) => x.v + (x.pct ? "%" : "") === best);
      r.v = pick.v; r.pct = r.xs.some((x) => x.pct); r.x0 = Math.min(...r.xs.map((x) => x.x0));
    }
    // blocks: warframe stats, then (after the 어빌리티 header) ability stats
    const gaps = rows.slice(1).map((r, i) => r.cy - rows[i].cy);
    const step = gaps.length ? gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 3)] : h * 1.5;
    const blocks = [[rows[0]]];
    rows.slice(1).forEach((r, i) => { if (gaps[i] > step * 1.8) blocks.push([r]); else blocks[blocks.length - 1].push(r); });
    const abI = blocks.findIndex((b) => b.filter((r) => r.pct).length >= Math.max(2, b.length / 2));
    const ab = abI >= 0 ? blocks[abI] : null, top = abI > 0 ? blocks[abI - 1] : abI < 0 ? blocks[blocks.length - 1] : null;
    // labels to the left of a row (when readable) settle which stat it is
    const labelSim = (r, key) => {
      let best = 0;
      for (const L of R.lines) {
        if (L.x1 > r.x0 - h || Math.abs((L.y0 + L.y1) / 2 - r.cy) > h * 0.7) continue;
        const t = norm(L.text); if (t.length < 2) continue;
        for (const n of STAT_LBL[key]) best = Math.max(best, 1 - fitDist(n, t) / n.length);
      }
      return best;
    };
    const out = {};
    if (ab && ab.length) {
      const score = (ord) => ab.reduce((s, r, i) => s + (ord[i] ? labelSim(r, ord[i]) : 0), 0);
      const ord = score(AB_ORDER.en) > score(AB_ORDER.ko) + 0.5 ? AB_ORDER.en : AB_ORDER.ko;
      ab.slice(0, 4).forEach((r, i) => { if (ab.length === 4 || labelSim(r, ord[i]) >= 0.5) out[ord[i]] = r.v; });
    }
    if (top && top.length) {
      let keys;
      if (top.length === 5) keys = TOP_ORDER;
      else {
        // a row missing (no shields, e.g. 이나로스): match the readable labels, the decimal last row is sprint speed
        keys = top.map((r) => { const s = TOP_ORDER.map((k) => [k, labelSim(r, k)]).sort((a, b) => b[1] - a[1])[0]; return s[1] >= 0.5 ? s[0] : null; });
        const last = top[top.length - 1];
        if (!keys[top.length - 1] && last.v > 0 && last.v < 5) keys[top.length - 1] = "sprint";
        const free = TOP_ORDER.filter((k) => k !== "sprint" && !keys.includes(k));
        const noShield = free.filter((k) => k !== "shield");
        const fill = keys.filter((k) => !k).length === noShield.length ? noShield : free;
        keys = keys.map((k) => k || fill.shift() || null);
      }
      top.forEach((r, i) => { if (keys[i] && !(keys[i] in out)) out[keys[i]] = r.v; });
    }
    if (out.sprint != null && !(out.sprint > 0 && out.sprint < 5)) delete out.sprint;
    return Object.keys(out).length ? out : null;
  }
  // ctx: { frames: [{id, ko}], auras: [{id, ko}], arcanes: [{id, ko}], mods: other warframe mods [{id, ko}] (optional) }
  function readFrame(reads, ctx) {
    let stats = null;
    for (const R of reads) { const s = frameStatsOf(R); if (s && (!stats || Object.keys(s).length > Object.keys(stats).length)) stats = s; }
    const frame = findWeapon(reads, ctx.frames);
    const segs = [];
    for (const R of reads) segs.push(...segments(R.lines));
    let aura = null;
    const arcs = new Map();
    const W = new Map(reads.map((R) => [R.img, R.w]));
    for (const s of segs) {
      // a card that reads better as an ordinary warframe mod (블라인드 레이지) is that mod, not an aura or an arcane
      const m = ctx.mods ? bestName(s, ctx.mods) : null;
      const beats = (x) => x && (!m || x.sim * x.len >= m.sim * m.len);
      const a = bestName(s, ctx.auras);
      if (beats(a) && (!aura || a.sim * a.len > aura.sim * aura.len)) aura = a;
      // the two arcane slots sit at the right edge of the upgrade screen
      if (s.box.x0 < (W.get(s.box.img) || 0) * 0.55) continue;
      const r = bestName(s, ctx.arcanes);
      if (beats(r) && (!arcs.has(r.c.id) || arcs.get(r.c.id).sim < r.sim)) arcs.set(r.c.id, r);
    }
    const arcanes = [...arcs.values()].sort((a, b) => b.sim * b.len - a.sim * a.len).slice(0, 2).map((r) => ({ id: r.c.id, ko: r.c.ko, sure: r.sim >= 0.85 }));
    return { frame, stats, aura: aura ? { id: aura.c.id, ko: aura.c.ko, sure: aura.sim >= 0.85 } : null, arcanes };
  }

  // the upgrade screen's arcane names glow and are small: read the right-hand column again at full size
  const FRAME_CROPS = [{ x0: 0.74, y0: 0.18, x1: 1, y1: 0.9 }];
  root.WF_OCR = { read, match, findWeapon, readFrame, FRAME_CROPS, parseTSV, segments, fitDist, norm, parseRiven, _passes: PASSES };
})(typeof self !== "undefined" ? self : globalThis);
