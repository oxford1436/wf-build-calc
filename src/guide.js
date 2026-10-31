/* Warframe guide tab (#frames, #frames/<id>): ability roles, stat priority, verified breakpoints and dated community builds
 * per region. Data: window.WF_GUIDES (data/guides/*.json), list and roles: window.WF_GUIDE_LIST / WF_GUIDE_ROLES,
 * top stat and summary for the list: window.WF_GUIDE_META. */
(function (root) {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ROLE = { main: ["핵심", "r-main"], sub: ["보조", "r-sub"], survival: ["생존", "r-surv"], utility: ["유틸", "r-util"], helminth_target: ["헬민스 자리", "r-helm"] };
  const STAT = { strength: "위력", duration: "지속시간", range: "거리", efficiency: "효율" };
  const STAT_S = { strength: "위력", duration: "지속", range: "거리", efficiency: "효율" };
  const REGION = { KR: "한국", NA: "북미", CN: "중국", JP: "일본" };
  const DUO = { sirius: "시리우스", orion: "오리온", switching: "교체", celestial_clash: "4번 공유 어빌리티" };
  const MST = { "복수 확인": "ms-ok", "작성자 실험": "ms-test", "작성자": "ms-claim", "반론": "ms-dis" };
  const pctv = (v) => v == null ? "–" : `${+v % 1 ? (+v).toFixed(1) : v}%`;

  // guides load one file at a time (data/guides/<id>.json next to the page); WF_GUIDE_IDS says which exist
  const G = root.WF_GUIDES = root.WF_GUIDES || {};
  const has = (id) => (root.WF_GUIDE_IDS || []).includes(id) || !!G[id];
  // the frame list: grouped by main role, by top stat (guide's stat priority) or by Korean initial; a search box filters
  const GMODES = [["role", "역할"], ["stat", "능력치"], ["abc", "가나다"]];
  let gmode = (() => { try { const v = localStorage.getItem("wfGuideGroup"); return GMODES.some(([k]) => k === v) ? v : "role"; } catch (e) { return "role"; } })();
  const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ", CHO_BASE = { "ㄲ": "ㄱ", "ㄸ": "ㄷ", "ㅃ": "ㅂ", "ㅆ": "ㅅ", "ㅉ": "ㅈ" };
  const initial = (s) => { const c = String(s).charCodeAt(0); if (c >= 0xac00 && c <= 0xd7a3) { const ch = CHO[Math.floor((c - 0xac00) / 588)]; return CHO_BASE[ch] || ch; } return "A–Z"; };
  const META = () => root.WF_GUIDE_META || {};
  function groupsOf(L) {
    const byKo = (a, b) => a.ko.localeCompare(b.ko, "ko");
    if (gmode === "stat") {
      const ST = [["strength", "위력 우선"], ["duration", "지속시간 우선"], ["range", "거리 우선"], ["efficiency", "효율 우선"]];
      // the guide's stat priority #1
      return ST.map(([k, ko]) => ({ ko, desc: "가이드 능력치 우선순위 1위", xs: L.filter((x) => (META()[x.id] || {}).s === k).sort(byKo) })).filter((g) => g.xs.length)
        .concat([{ ko: "기타", desc: "", xs: L.filter((x) => !ST.some(([k]) => (META()[x.id] || {}).s === k)).sort(byKo) }].filter((g) => g.xs.length));
    }
    if (gmode === "abc") {
      const m = new Map();
      for (const x of L.slice().sort(byKo)) { const k = initial(x.ko); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
      return [...m.entries()].sort((a, b) => (a[0] === "A–Z") - (b[0] === "A–Z") || a[0].localeCompare(b[0], "ko")).map(([ko, xs]) => ({ ko, desc: "", xs }));
    }
    return (root.WF_GUIDE_ROLES || []).map((r) => ({ ko: r.ko, desc: r.desc, xs: L.filter((x) => x.role === r.id).sort(byKo) })).filter((g) => g.xs.length);
  }
  function listHtml(cur) {
    const L = root.WF_GUIDE_LIST || [];
    const gs = groupsOf(L);
    const tip = (x) => { const m = META()[x.id]; return m && m.t ? ` title="${esc(m.t)}"` : ""; };
    return `<div class="gprog"><b>${L.filter((x) => has(x.id)).length}</b>종</div>
      <div class="gmode" role="tablist" aria-label="묶는 기준">${GMODES.map(([k, ko]) => `<button type="button" data-m="${k}" class="${k === gmode ? "on" : ""}">${ko}</button>`).join("")}</div>
      <input type="search" class="gfind" placeholder="이름 검색 (한글·영문)" aria-label="워프레임 이름 검색" autocomplete="off">
      <select class="gsel" aria-label="워프레임 고르기">${gs.map((g) => `<optgroup label="${esc(g.ko)}">${g.xs.map((x) => `<option value="${x.id}"${x.id === cur ? " selected" : ""}${has(x.id) ? "" : " disabled"}>${esc(x.ko)}</option>`).join("")}</optgroup>`).join("")}</select>
      <div class="glistin">${gs.map((g) => `<div class="gbatch"><div class="gbl">${esc(g.ko)}${g.desc ? `<small>${esc(g.desc)}</small>` : ""}</div>${g.xs.map((x) => has(x.id)
        ? `<a href="#frames/${x.id}" class="gitem${x.id === cur ? " on" : ""}" data-q="${esc((x.ko + " " + ((META()[x.id] || {}).en || "")).toLowerCase().replace(/\s+/g, ""))}"${tip(x)}>${esc(x.ko)}</a>`
        : `<span class="gitem off">${esc(x.ko)}</span>`).join("")}</div>`).join("")}</div>`;
  }
  function bindList(box, cur) {
    const aside = box.querySelector(".glist"); if (!aside) return;
    aside.querySelectorAll(".gmode button").forEach((b) => b.addEventListener("click", () => {
      gmode = b.dataset.m; try { localStorage.setItem("wfGuideGroup", gmode); } catch (e) {}
      aside.innerHTML = listHtml(cur); bindList(box, cur);
    }));
    const f = aside.querySelector(".gfind");
    f.addEventListener("input", () => {
      const q = f.value.toLowerCase().replace(/\s+/g, "");
      aside.querySelectorAll(".gbatch").forEach((g) => {
        let n = 0;
        g.querySelectorAll(".gitem").forEach((a) => { const ok = !q || (a.dataset.q || a.textContent.toLowerCase()).includes(q); a.hidden = !ok; n += ok ? 1 : 0; });
        g.hidden = !n;
      });
    });
    f.addEventListener("keydown", (e) => { if (e.key !== "Enter") return; const a = aside.querySelector(".gitem:not([hidden]):not(.off)"); if (a) location.hash = a.getAttribute("href"); });
    const sel = aside.querySelector(".gsel");
    if (sel) sel.addEventListener("change", () => { location.hash = "#frames/" + sel.value; });
  }

  function detailHtml(g) {
    const ab = (g.abilities || []).slice().sort((a, b) => a.slot - b.slot);
    const abName = (slot) => { if (!slot) return "공통"; const a = ab.find((x) => x.slot === slot); return a ? `${slot} ${a.name_ko}` : `${slot}번`; };
    const comm = (g.community || []).slice().sort((a, b) => ["KR", "NA", "CN", "JP"].indexOf(a.region) - ["KR", "NA", "CN", "JP"].indexOf(b.region) || (b.date || "").localeCompare(a.date || ""));
    const maxS = Math.max(100, ...comm.flatMap((c) => Object.values(c.stats || {}).filter((v) => v != null).map(Number)));
    const helm = (h) => !h || !h.ability || h.ability === "없음" ? "없음" : `${h.replace_slot ? h.replace_slot + "번 자리 ← " : ""}${h.ability}`;
    const statBars = (s) => ["strength", "duration", "range", "efficiency"].map((k) => {
      const v = s ? s[k] : null;
      return `<div class="gsb"><span>${STAT_S[k]}</span><i><b style="width:${v == null ? 0 : Math.min(100, (v / maxS) * 100).toFixed(0)}%"></b></i><em>${pctv(v)}</em></div>`;
    }).join("");
    return `<section class="card ghead">
        <div class="eyebrow">워프레임 가이드${g.has_prime ? " · 프라임 공통" : ""}</div>
        <h2>${esc(g.name_ko)} <small>${esc(g.name_en)}</small></h2>
        <p class="gsum">${esc(g.summary)}</p>
        <div class="gmeta"><span>마지막 리워크 <b>${esc(g.last_rework || "?")}</b></span><span>정보 확인 <b>${esc(g.checked || "?")}</b></span><span>핵심 어빌리티 <b>${(g.main_slots || []).map(abName).map(esc).join(", ")}</b></span></div>
      </section>

      ${root.WF_FrameCalc ? root.WF_FrameCalc.html(g) : ""}

      ${g.duo && typeof g.duo === "object" ? `<section class="card"><h3>두 캐릭터</h3><dl class="gdl gduo">${Object.entries(g.duo).map(([k, v]) => `<dt>${esc(DUO[k] || k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></section>` : ""}
      ${g.shadow && typeof g.shadow === "object" ? `<section class="card"><h3>섀도우 형태</h3>${g.shadow.summary ? `<p class="gsum" style="font-size:14px">${esc(g.shadow.summary)}</p>` : ""}
        ${(g.shadow.abilities || []).length ? `<div class="gab">${g.shadow.abilities.map((a) => `<div class="gabc"><div class="gabt"><span class="gslot">${a.slot}</span><b>${esc(a.name_ko)}</b></div><small class="gen">${esc(a.name_en || "")}</small><p>${esc(a.note || "")}</p></div>`).join("")}</div>` : ""}
        ${Object.entries(g.shadow).filter(([k]) => k !== "summary" && k !== "abilities").map(([k, v]) => `<p class="hint" style="margin:4px 0 0">${esc(typeof v === "string" ? v : JSON.stringify(v))}</p>`).join("")}</section>` : ""}

      <section class="card"><h3>어빌리티 역할</h3>
        <div class="gab">${ab.map((a) => { const r = ROLE[a.role] || [a.role, ""]; return `<div class="gabc ${r[1]}">
          <div class="gabt"><span class="gslot">${a.slot}</span><b>${esc(a.name_ko)}</b><span class="grole">${r[0]}</span></div>
          <small class="gen">${esc(a.name_en)}</small>
          <p>${esc(a.note)}</p>
          <div class="gsc">${(a.scales || []).map((k) => `<span>${STAT_S[k] || k}</span>`).join("")}</div></div>`; }).join("")}</div>
        <p class="hint" style="margin:0">아래 칩은 그 어빌리티를 바꾸는 능력치입니다.</p>
      </section>

      <section class="card"><h3>능력치 우선순위</h3>
        <ol class="gprio">${(g.stat_priority || []).map((p, i) => `<li><span class="gpn">${i + 1}</span><b>${STAT[p.stat] || p.stat}</b><small>${esc(p.note)}</small></li>`).join("")}</ol>
      </section>

      <section class="card"><h3>브레이크포인트 <small>위키 공식으로 다시 계산해 확인</small></h3>
        <div class="tscroll"><table class="tbl gbp"><thead><tr><th>어빌리티</th><th>능력치</th><th>필요 수치</th><th>효과</th><th>확인</th></tr></thead><tbody>
        ${(g.breakpoints || []).map((b) => `<tr><td>${esc(abName(b.slot))}</td><td>${STAT[b.stat] || esc(b.stat)}</td><td class="num"><b>${esc(b.value)}</b></td><td>${esc(b.effect)}
          ${b.calc ? `<details class="gcalc"><summary>계산</summary><p>${esc(b.calc)}</p>${b.source ? `<a href="${esc(b.source)}" target="_blank" rel="noopener">출처</a>` : ""}</details>` : ""}</td>
          <td>${b.verified ? '<span class="gok">공식 확인</span>' : '<span class="gno">미확인</span>'}</td></tr>`).join("")}
        </tbody></table></div>
      </section>

      ${(g.mechanics || []).length ? `<section class="card"><h3>숨은 메커니즘·버그 <small>커뮤니티 실험 · 확인 정도 표시</small></h3>
        <ul class="gmech">${g.mechanics.map((m) => `<li><span class="gmst ${MST[m.status] || ""}">${esc(m.status || "작성자")}</span>${esc(m.text)}${m.source ? ` <a href="${esc(m.source)}" target="_blank" rel="noopener">출처</a>` : ""}${m.date ? ` <small>${esc(m.date)}</small>` : ""}</li>`).join("")}</ul>
        <p class="hint" style="margin:0">복수 확인: 다른 글·댓글도 같은 결과 · 작성자 실험: 작성자가 시뮬라크럼 등에서 측정 · 작성자: 주장만 있음 · 반론: 댓글에 반대 의견이 있음</p></section>` : ""}

      <section class="card"><h3>커뮤니티 추천 세팅 <small>지역별 최신 글 · 날짜는 글 작성일</small></h3>
        <div class="tscroll"><table class="tbl gcmp"><thead><tr><th>지역 · 날짜</th><th>콘셉트</th><th>위력</th><th>지속</th><th>거리</th><th>효율</th><th>헬민스</th></tr></thead><tbody>
        ${comm.map((c) => `<tr><td><span class="greg g-${esc(c.region)}">${REGION[c.region] || esc(c.region)}</span><br><small>${esc(c.date)}</small></td><td><b>${esc(c.title)}</b></td>
          ${["strength", "duration", "range", "efficiency"].map((k) => `<td class="num">${pctv(c.stats ? c.stats[k] : null)}</td>`).join("")}<td>${esc(helm(c.helminth))}</td></tr>`).join("")}
        </tbody></table></div>
        <div class="gcards">${comm.map((c) => `<article class="gcard">
          <div class="gct"><span class="greg g-${esc(c.region)}">${REGION[c.region] || esc(c.region)}</span><small>${esc(c.date)} · ${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.site)}</a>` : esc(c.site)}</small></div>
          <h4>${esc(c.title)}</h4>
          <p class="gcon">${esc(c.concept)}</p>
          <div class="gstats">${statBars(c.stats)}</div>
          <dl class="gdl">
            <dt>헬민스</dt><dd>${esc(helm(c.helminth))}</dd>
            ${c.aura ? `<dt>오라</dt><dd>${esc(c.aura)}</dd>` : ""}${c.exilus ? `<dt>익실러스</dt><dd>${esc(c.exilus)}</dd>` : ""}
            ${(c.arcanes || []).length ? `<dt>아케인</dt><dd>${c.arcanes.map(esc).join(", ")}</dd>` : ""}
            ${(c.shards || []).length ? `<dt>아콘 샤드</dt><dd>${c.shards.map(esc).join(", ")}</dd>` : ""}
          </dl>
          ${(c.mods || []).length ? `<div class="gmods">${c.mods.map((m) => `<span>${esc(m)}</span>`).join("")}</div>` : ""}
          ${c.notes ? `<p class="hint" style="margin:0">${esc(c.notes)}</p>` : ""}
        </article>`).join("")}</div>
      </section>

      <section class="card"><h3>종합</h3>
        <div class="gsyn"><div><h4>모든 지역 공통</h4><p>${esc((g.consensus || {}).common)}</p></div><div><h4>지역별 차이</h4><p>${esc((g.consensus || {}).differences)}</p></div></div>
      </section>

      ${(g.notes || []).length || (g.gaps || []).length ? `<section class="card notes"><h3>참고</h3>
        ${(g.notes || []).length ? `<h4>최근 변경</h4><ul>${g.notes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        ${(g.gaps || []).length ? `<h4>확인하지 못한 것</h4><ul>${g.gaps.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      </section>` : ""}`;
  }

  root.WF_renderGuide = function (box) {
    const L = root.WF_GUIDE_LIST || [];
    const m = /^#frames\/([a-z0-9_]+)/.exec(location.hash);
    let id = m ? m[1] : null;
    if (!id || !has(id)) { const first = groupsOf(L).flatMap((g) => g.xs).find((x) => has(x.id)); id = first ? first.id : null; }
    const g = id ? G[id] : null;
    if (id && !g) {
      fetch(`data/guides/${id}.json`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then((j) => { G[id] = j; if (!box.hidden) root.WF_renderGuide(box); })
        .catch(() => { const el = box.querySelector(".gmain"); if (el) el.innerHTML = `<div class="placeholder"><h3>가이드 파일을 불러오지 못했습니다</h3><p>인터넷 연결을 확인하고 다시 열어 주세요.</p></div>`; });
    }
    box.innerHTML = `<div class="gwrap"><aside class="glist">${listHtml(id)}</aside><div class="gmain">${g ? detailHtml(g)
      : id ? `<div class="placeholder"><h3>불러오는 중…</h3></div>` : `<div class="placeholder"><h3>정리된 워프레임이 아직 없습니다</h3></div>`}</div></div>`;
    bindList(box, id);
    if (g && root.WF_FrameCalc) root.WF_FrameCalc.bind(box, g);
  };
})(typeof window !== "undefined" ? window : globalThis);
