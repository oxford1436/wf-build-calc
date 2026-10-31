/* Warframe guide tab (#frames, #frames/<id>): ability roles, stat priority, verified breakpoints and dated community builds
 * per region. Data: window.WF_GUIDES (data/guides/*.json), order and batches: window.WF_GUIDE_LIST. */
(function (root) {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ROLE = { main: ["핵심", "r-main"], sub: ["보조", "r-sub"], survival: ["생존", "r-surv"], utility: ["유틸", "r-util"], helminth_target: ["헬민스 자리", "r-helm"] };
  const STAT = { strength: "위력", duration: "지속시간", range: "거리", efficiency: "효율" };
  const STAT_S = { strength: "위력", duration: "지속", range: "거리", efficiency: "효율" };
  const REGION = { KR: "한국", NA: "북미", CN: "중국", JP: "일본" };
  const DUO = { sirius: "시리우스", orion: "오리온", switching: "교체", celestial_clash: "4번 공유 어빌리티" };
  const pctv = (v) => v == null ? "–" : `${+v % 1 ? (+v).toFixed(1) : v}%`;

  // guides load one file at a time (data/guides/<id>.json next to the page); WF_GUIDE_IDS says which exist
  const G = root.WF_GUIDES = root.WF_GUIDES || {};
  const has = (id) => (root.WF_GUIDE_IDS || []).includes(id) || !!G[id];
  function listHtml(cur) {
    const L = root.WF_GUIDE_LIST || [];
    const done = L.filter((x) => has(x.id)).length;
    const byBatch = {};
    for (const x of L) (byBatch[x.batch] = byBatch[x.batch] || []).push(x);
    return `<div class="gprog"><b>${done}</b> / ${L.length}종 정리됨</div>
      <select class="gsel" aria-label="워프레임 고르기">${L.map((x) => `<option value="${x.id}"${x.id === cur ? " selected" : ""}${has(x.id) ? "" : " disabled"}>${esc(x.ko)}${has(x.id) ? "" : ` (${x.batch}차 예정)`}</option>`).join("")}</select>
      <div class="glistin">${Object.keys(byBatch).map((b) => `<div class="gbatch"><div class="gbl">${b === "1" ? "1차 (시범)" : b + "차"}</div>${byBatch[b].map((x) => has(x.id)
        ? `<a href="#frames/${x.id}" class="gitem${x.id === cur ? " on" : ""}">${esc(x.ko)}</a>`
        : `<span class="gitem off" title="${b}차에 정리 예정">${esc(x.ko)}</span>`).join("")}</div>`).join("")}</div>`;
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
    if (!id || !has(id)) id = (L.find((x) => has(x.id)) || {}).id;
    const g = id ? G[id] : null;
    if (id && !g) {
      fetch(`data/guides/${id}.json`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then((j) => { G[id] = j; if (!box.hidden) root.WF_renderGuide(box); })
        .catch(() => { const el = box.querySelector(".gmain"); if (el) el.innerHTML = `<div class="placeholder"><h3>가이드 파일을 불러오지 못했습니다</h3><p>인터넷 연결을 확인하고 다시 열어 주세요.</p></div>`; });
    }
    box.innerHTML = `<div class="gwrap"><aside class="glist">${listHtml(id)}</aside><div class="gmain">${g ? detailHtml(g)
      : id ? `<div class="placeholder"><h3>불러오는 중…</h3></div>` : `<div class="placeholder"><h3>정리된 워프레임이 아직 없습니다</h3></div>`}</div></div>`;
    const sel = box.querySelector(".gsel");
    if (sel) sel.addEventListener("change", () => { location.hash = "#frames/" + sel.value; });
  };
})(typeof window !== "undefined" ? window : globalThis);
