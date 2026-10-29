/* Warframe abilities / Helminth / Archon shards that change weapon damage (wiki, Oct 2026).
 * Ability entry:
 *   fx(st, helminth) -> ext fields, st = {str, dur, rng, eff, energy} as fractions (1.0 = 100%)
 *   area(st) -> radius in metres for enemy-targeted debuffs (crowd coverage = (r/20)^2, capped at 1)
 *   time(st) -> buff/debuff duration in seconds (shown; recasting is assumed so uptime is 100%)
 * ext fields: dmgAdd, faction, final, elem{...}, armorStrip, ccAdd, ccFlat, cdMult, cdAdd, scAdd, durAdd,
 *   frAdd, asAdd, weakFrac/weakMult, sdTox, corrMax, msAdd. */
(function (root) {
  const A = {};
  const add = (key, o) => { A[key] = o; };

  add("Roar", { ko: "로어", helminth: true, note: "팩션 피해형 (도트에는 두 번 적용). 위력 비례. 본체 50%, 헬민스 30%",
    fx: (s, h) => ({ faction: (h ? 0.3 : 0.5) * s.str }), time: (s) => 30 * s.dur });
  add("Eclipse", { ko: "이클립스 (빛)", helminth: true, note: "별도 배율. 위력 비례. 본체 200%, 헬민스 30%",
    fx: (s, h) => ({ final: 1 + (h ? 0.3 : 2.0) * s.str }), time: (s) => 25 * s.dur });
  add("Vex Armor", { ko: "벡스 아머 (퓨리 최대)", note: "기본 피해 모드와 합연산. 위력 비례 (최대 275%)",
    fx: (s) => ({ dmgAdd: 2.75 * s.str }), time: (s) => 20 * s.dur });
  add("Molecular Prime", { ko: "몰레큘러 프라임", note: "감속된 적 피해 2배 (위력 무관). 파동 반경은 지속시간으로 커짐",
    fx: () => ({ final: 2 }), area: (s) => 5 + 30 * s.dur, time: () => 30 });
  add("Sonar", { ko: "소나", note: "약점 5배×위력. 반경 35m×범위. 약점을 절반 정도 맞힌다고 가정",
    fx: (s) => ({ weakFrac: 0.5, weakMult: 5 * s.str }), area: (s) => 35 * s.rng, time: (s) => 30 * s.dur });
  add("Covenant", { ko: "커버넌트 (보복)", note: "치명타 확률 몸통 +50%p · 약점 +200%p (막은 피해로 누적, 상한 도달 가정, 모드 뒤에 더함)",
    fx: () => ({ ccFlat: 0.5, hsCcFlat: 1.5 }), time: (s) => 12 * s.dur });
  add("Penance", { ko: "페넌스", note: "연사·공격 속도 +35%×위력, 재장전 +70%×위력",
    fx: (s) => ({ frAdd: 0.35 * s.str, asAdd: 0.35 * s.str, reloadAdd: 0.7 * s.str }), time: (s) => 30 * s.dur });
  add("Warcry", { ko: "워크라이", helminth: true, note: "근접 공격 속도 +50%×위력 (헬민스 30%), 퓨리와 합연산. 총기 연사는 안 오름",
    fx: (s, h) => ({ asAdd: (h ? 0.3 : 0.5) * s.str }), time: (s) => 20 * s.dur });
  add("Shooting Gallery", { ko: "슈팅 갤러리", note: "무기 피해 +25%×위력 (서레이션류와 합연산, 총기·근접 모두)",
    fx: (s) => ({ dmgAdd: 0.25 * s.str }), time: (s) => 30 * s.dur });
  add("Ballistic Battery", { ko: "발리스틱 배터리", note: "모은 피해를 다음 한 발에만 더하는 기술이라 계속 쏘는 처치 속도에는 거의 영향이 없어 계산에서 뺍니다", fx: null });
  add("Mallet", { ko: "말렛", note: "적이 친 피해를 모아 폭발로 돌려주는 기술 — 무기 버프가 아니라 계산에서 뺍니다", fx: null });
  add("Metronome", { ko: "메트로놈 (박자 버프)", note: "박자에 맞춰 사격하면 멀티샷 +30%×위력(오페라), 근접하면 근접 피해 +30%×위력(포르테). 박자를 계속 맞춘다고 가정",
    fx: (s, h, w) => (w && w.cls === "melee" ? { dmgAdd: 0.3 * s.str } : { msAdd: 0.3 * s.str }), time: (s) => 15 * s.dur });
  add("Metamorphosis", { ko: "메타모포시스 (낮 형태)", note: "무기 피해 +25%×위력에서 지속시간 동안 0까지 줄어듦 → 평균 12.5%×위력. 근접 제외",
    fx: (s, h, w) => (w && w.cls === "melee" ? {} : { dmgAdd: 0.125 * s.str }), time: (s) => 25 * s.dur });
  add("Elemental Ward", { ko: "엘리멘탈 워드 (독)", note: "독 속성 워드: 재장전 속도 +35%×지속시간. 화염·전기·냉기 워드는 체력·실드·방어력이라 무기 피해와 무관",
    fx: (s) => ({ reloadAdd: 0.35 * s.dur }), time: (s) => 25 * s.dur });
  // exalted-weapon abilities: the weapon itself scales with Ability Strength (pick the exalted weapon in the weapon list)
  for (const [k, ko] of [["Exalted Blade", "익절티드 블레이드"], ["Artemis Bow", "아르테미스 보우"], ["Peacemaker", "피스메이커"], ["Razorwing", "레이저윙"], ["Balefire", "베일파이어"],
    ["Primal Fury", "프라이멀 퓨리"], ["Hysteria", "히스테리아"], ["Serene Storm", "세린 스톰"], ["Landslide", "랜드슬라이드"], ["Whipclaw", "윕클로"], ["Shattered Lash", "섀터드 래쉬"],
    ["Exalted Shadow", "익절티드 섀도우"], ["Glory On High", "글로리 온 하이"], ["Noctua", "녹투아"], ["Neutralize", "뉴트럴라이즈"], ["Exalted Solo", "익절티드 솔로"]])
    if (!A[k]) add(k, { ko, note: "전용 무기(익절티드)를 무기 목록에서 고르면 위력이 그 무기의 기본 피해에 반영됩니다", fx: null });

  /* augment mods that change weapon numbers, shown under their ability (wiki, values at max rank) */
  const AUG = {};
  const aug = (ability, key, o) => { (AUG[ability] = AUG[ability] || []).push(key); A[key] = Object.assign({ aug: true }, o); };
  const notExalted = (w) => !(w && w.exalted);
  aug("Fireball", "Fireball Frenzy", { ko: "증강: 파이어볼 프렌지", note: "자신·맞은 아군 무기에 화염 +100%×위력 (다른 원소와 안 합쳐짐, 익절티드 제외)",
    fx: (s, h, w) => (notExalted(w) ? { elem: { heatx: 1.0 * s.str } } : {}), time: (s) => 40 * s.dur });
  aug("Freeze", "Freeze Force", { ko: "증강: 프리즈 포스", note: "무기에 냉기 +100%×위력 (안 합쳐짐, 익절티드 제외)",
    fx: (s, h, w) => (notExalted(w) ? { elem: { coldx: 1.0 * s.str } } : {}), time: (s) => 40 * s.dur });
  aug("Shock", "Shock Trooper", { ko: "증강: 쇼크 트루퍼", note: "무기에 전기 +100%×위력 (안 합쳐짐, 익절티드 제외)",
    fx: (s, h, w) => (notExalted(w) ? { elem: { elecx: 1.0 * s.str } } : {}), time: (s) => 40 * s.dur });
  aug("Smite", "Smite Infusion", { ko: "증강: 스마이트 인퓨전", note: "무기에 방사능 +100%×위력 (안 합쳐짐, 익절티드 제외)",
    fx: (s, h, w) => (notExalted(w) ? { elem: { radm: 1.0 * s.str } } : {}), time: (s) => 40 * s.dur });
  aug("Spores", "Venom Dose", { ko: "증강: 베놈 도즈", note: "무기에 부식 +100%×위력 (안 합쳐짐, 익절티드 제외)",
    fx: (s, h, w) => (notExalted(w) ? { elem: { corrm: 1.0 * s.str } } : {}), time: (s) => 40 * s.dur });
  aug("Quiver", "Empowered Quiver", { ko: "증강: 임파워드 퀴버 (대시와이어 위)", note: "대시와이어 위에 있을 때 치명타 피해 +100%×위력 (모드와 합연산)",
    fx: (s) => ({ cdAdd: 1.0 * s.str }) });
  aug("Razorwing", "Razorwing Blitz", { ko: "증강: 레이저윙 블리츠 (4중첩)", note: "레이저윙 중 어빌리티 4번 = 덱스 픽시아 연사·디와타 공격 속도 +100%×위력",
    fx: (s, h, w) => (w && /^(dex_pixia|diwata)/.test(w.id) ? { frAdd: 1.0 * s.str, asAdd: 1.0 * s.str } : {}), time: (s) => 32 * s.dur });
  aug("Exalted Blade", "Chromatic Blade", { ko: "증강: 크로매틱 블레이드", note: "익절티드 블레이드 상태이상 확률 +300%×위력. 물리 피해를 에너지 색 원소로 바꾸는 효과는 미반영",
    fx: (s, h, w) => (w && /^exalted_/.test(w.id) ? { scAdd: 3.0 * s.str } : {}) });
  aug("Primal Fury", "Primal Rage", { ko: "증강: 프라이멀 레이지 (최대)", note: "처치마다 아이언 스태프 치명타 확률 +15%×위력, 최대 +150% (트루 스틸과 합연산)",
    fx: (s, h, w) => (w && /^iron_staff/.test(w.id) ? { ccAdd: 1.5 } : {}) });

  /* focus schools, arbitrations, stealth: picked in "기타 버프" (fx(weapon) → ext fields) */
  const MISC = [
    { id: "void_strike", ko: "마두라이 보이드 스트라이크", note: "오퍼레이터 에너지를 다 쓰면 8초간 피해 +1000%, 재사용 40초 → 평균 +200%로 계산 (서레이션류와 합연산)", fx: () => ({ dmgAdd: 2.0 }) },
    { id: "phoenix_talons", ko: "마두라이 피닉스 탈론", note: "물리 피해 +30% (기본 피해 기준, 물리 모드 뒤에 더함)", fx: () => ({ phoenix: 0.3 }) },
    { id: "lethal_levitation", ko: "나라몬 리설 레비테이션 (공중 조준 4중첩)", note: "공중에서 조준 활공하며 쏠 때 피해 +200% — 총기 전용", fx: (w) => (w.cls === "melee" ? {} : { dmgAdd: 2.0 }) },
    { id: "killers_rush", ko: "나라몬 킬러스 러시", note: "근접 치명타 확률 +50% (모드와 합연산)", fx: (w) => (w.cls === "melee" ? { ccAdd: 0.5 } : {}) },
    { id: "caustic_strike", ko: "운에어루 코스틱 스트라이크", note: "8m 안 적 방어구 100% 제거 (오퍼레이터 2번)", fx: () => ({ armorStrip: 1 }), area: 8 },
    { id: "tauron_unairu", ko: "운에어루 타우론 스트라이크", note: "모든 공격이 방어구·실드 25% 제거 (30초)", fx: () => ({ armorStrip: 0.25, shieldCut: 0.25 }) },
    { id: "arb_weapon", ko: "중재 — 지정 무기", note: "중재 미션 지정 무기 피해 +300% (서레이션류와 합연산으로 가정 — 위키에 방식 미기재)", fx: () => ({ dmgAdd: 3.0 }) },
    { id: "arb_frame", ko: "중재 — 지정 워프레임", note: "지정 워프레임 위력 +300% (어빌리티·익절티드 무기에 반영)", stat: { str: 3.0 } },
    { id: "vigorous_swap", ko: "비거러스 스왑 (무기 교체 직후 3초)", note: "워프레임 모드: 무기를 바꾼 뒤 3초간 피해 +165% (서레이션류와 합연산). 근접 제외. 켜면 그 3초 기준으로 계산합니다", fx: (w) => (w.cls === "melee" ? {} : { dmgAdd: 1.65 }) },
    { id: "stealth", ko: "은신 기습 (근접)", note: "적이 알아채기 전 근접 공격 피해 +700%(무기 랭크 30). 모든 타격에 적용되므로 은신 운용일 때만 켜세요", fx: (w) => (w.cls === "melee" ? { stealth: 7 } : {}) },
  ];
  add("Electric Shield", { ko: "일렉트릭 실드 (통과 사격)", gunOnly: true, note: "전기 +50%, 치명타 피해 2배. 근접·글레이브 제외",
    fx: () => ({ elem: { elecx: 0.5 }, cdMult: 2 }), time: (s) => 25 * s.dur });
  add("Nourish", { ko: "너리시 (바이러스 피해)", helminth: true, note: "바이러스 피해 추가 (위력 비례, 다른 원소와 안 합쳐짐). 본체 75%×위력, 헬민스 45%×위력",
    fx: (s, h) => ({ elem: { viralm: (h ? 0.45 : 0.75) * s.str } }), time: (s) => 25 * s.dur });
  add("Toxic Lash", { ko: "톡식 래시", note: "독 피해 추가 (위력 비례, 수치 추정)",
    fx: (s) => ({ elem: { toxx: 0.3 * s.str } }), time: (s) => 30 * s.dur });
  add("Xata's Whisper", { ko: "자타의 속삭임", helminth: true, note: "보이드 피해 26%×위력 별도 추가",
    fx: (s) => ({ elem: { voidx: 0.26 * s.str } }), time: (s) => 26 * s.dur });
  add("Reservoirs", { ko: "레저부아 (헤이스트 모트)", note: "연사 +30%, 공격 속도 +20% (설치 시 위력 비례)",
    fx: (s) => ({ frAdd: 0.3 * s.str, asAdd: 0.2 * s.str }) });
  add("Speed", { ko: "스피드", note: "근접 공격 속도 +75%×위력",
    fx: (s) => ({ asAdd: 0.75 * s.str }), time: (s) => 10 * s.dur });
  add("Redline", { ko: "레드라인 (배터리 최대)", note: "연사 +75%, 공격 속도 +40%",
    fx: () => ({ frAdd: 0.75, asAdd: 0.4 }) });
  add("Pillage", { ko: "필라지 (1회 시전)", helminth: true, note: "방어구 25%×위력 제거, 시전마다 누적. 반경 8m에서 퍼지며 지속시간·범위로 넓어짐 (근사)",
    fx: (s) => ({ armorStrip: Math.min(1, 0.25 * s.str) }), area: (s) => 8 * s.rng * Math.max(1, s.dur) });
  add("Terrify", { ko: "테리파이", helminth: true, note: "방어구 60%×위력 제거. 반경 15m×범위, 최대 20명×위력",
    fx: (s) => ({ armorStrip: Math.min(1, 0.6 * s.str) }), area: (s) => 15 * s.rng, time: (s) => 25 * s.dur });
  add("Tharros Strike", { ko: "타로스 스트라이크 (1회)", helminth: true, note: "방어구 50%×위력 제거, 시전마다 누적. 전방 9m×범위 원뿔",
    fx: (s) => ({ armorStrip: Math.min(1, 0.5 * s.str) }), area: (s) => 9 * s.rng });
  add("Fire Blast", { ko: "파이어 블라스트 (열기 최대)", helminth: true, note: "방어구 100%×위력 제거 (헬민스 상한 75%), 반경 25m",
    fx: (s, h) => ({ armorStrip: Math.min(h ? 0.75 : 1, 1.0 * s.str) }), area: () => 25 });
  add("Shuriken", { ko: "슈리켄 (시킹 슈리켄 증강)", note: "증강 장착 시 맞은 적 방어구 70%×위력 제거",
    fx: (s) => ({ armorStrip: Math.min(1, 0.7 * s.str) }), time: (s) => 8 * s.dur });
  add("Prismatic Gem", { ko: "프리즈매틱 젬", note: "상태이상 확률 +100%, 지속시간 +100% (모드와 합연산)",
    fx: () => ({ scAdd: 1.0, durAdd: 1.0 }), time: (s) => 30 * s.dur });
  add("Seek", { ko: "시크", note: "약점 피해 증가 — 위키 수치 미확인, 아직 계산하지 않음", fx: null });
  add("Resupply", { ko: "리서플라이", note: "선택 속성 피해 증가 — 위키 수치 미확인, 아직 계산하지 않음", fx: null });
  add("Amp", { ko: "앰프 (장 안, 시끄러운 전투)", note: "장 안에 있으면 무기·근접 피해 +25%~200%×위력 (주변 소음에 비례). 총소리가 큰 전투 중 최대치 기준, 서레이션류와 합연산",
    fx: (s) => ({ dmgAdd: 2.0 * s.str }), time: () => 30 });

  /* Archon shards: every option. kind: "weapon" (changes weapon numbers), "stat" (changes ability stats),
   * "none" (no effect on weapon damage). */
  const SHARDS = [
    { id: "c_str", color: "crimson", ko: "진홍 — 어빌리티 위력 +10% (타우포지드 15%)", kind: "stat", stat: { str: [0.10, 0.15] } },
    { id: "c_dur", color: "crimson", ko: "진홍 — 어빌리티 지속시간 +10% (타우포지드 15%)", kind: "stat", stat: { dur: [0.10, 0.15] } },
    { id: "c_psc", color: "crimson", ko: "진홍 — 주무기 상태이상 확률 +25% (타우포지드 37.5%)", kind: "weapon", slot: "primary", fx: (t) => ({ scAdd: t ? 0.375 : 0.25 }) },
    { id: "c_scc", color: "crimson", ko: "진홍 — 보조무기 치명타 확률 +25% (타우포지드 37.5%)", kind: "weapon", slot: "secondary", fx: (t) => ({ ccAdd: t ? 0.375 : 0.25 }) },
    { id: "c_mcd", color: "crimson", ko: "진홍 — 근접 치명타 피해 +25% (타우포지드 37.5%)", kind: "weapon", slot: "melee", fx: (t) => ({ cdAdd: t ? 0.375 : 0.25 }) },
    { id: "a_cast", color: "amber", ko: "황색 — 시전 속도 +25% (타우포지드 37.5%)", kind: "none" },
    { id: "a_energy", color: "amber", ko: "황색 — 스폰 시 에너지 30% 충전 (타우포지드 45%)", kind: "none" },
    { id: "a_horb", color: "amber", ko: "황색 — 체력 오브 효과 +100% (타우포지드 150%)", kind: "none" },
    { id: "a_eorb", color: "amber", ko: "황색 — 에너지 오브 효과 +50% (타우포지드 75%)", kind: "none" },
    { id: "a_park", color: "amber", ko: "황색 — 파쿠르 속도 +15% (타우포지드 22.5%)", kind: "none" },
    { id: "z_hp", color: "azure", ko: "청색 — 체력 +150 (타우포지드 225)", kind: "none" },
    { id: "z_sh", color: "azure", ko: "청색 — 실드 +150 (타우포지드 225)", kind: "none" },
    { id: "z_en", color: "azure", ko: "청색 — 최대 에너지 +50 (타우포지드 75)", kind: "stat", stat: { energy: [50, 75] } },
    { id: "z_ar", color: "azure", ko: "청색 — 방어력 +150 (타우포지드 225)", kind: "none" },
    { id: "z_reg", color: "azure", ko: "청색 — 초당 체력 재생 +5 (타우포지드 7.5)", kind: "none" },
    { id: "v_elec", color: "violet", ko: "보라 — 주무기 전기 피해 +30% (타우포지드 45%, 전기 모드처럼 다른 원소와 합쳐짐), 장착한 진홍·청색·보라 샤드 1개당 +10% (타우포지드 15%)", kind: "weapon", slot: "primary", fx: (t, cnt) => ({ elem: { elecmod: (t ? 0.45 : 0.30) + (t ? 0.15 : 0.10) * cnt.cav } }) },
    { id: "v_mcd", color: "violet", ko: "보라 — 근접 치명타 피해 +25% (타우포지드 37.5%), 최대 에너지 500 초과 시 2배", kind: "weapon", slot: "melee", fx: (t, cnt, st) => ({ cdAdd: (t ? 0.375 : 0.25) * (st.energy > 500 ? 2 : 1) }) },
    { id: "v_abil", color: "violet", ko: "보라 — 전기 상태 적에게 어빌리티 피해 +10%", kind: "none" },
    { id: "v_orb", color: "violet", ko: "보라 — 체력·에너지 오브 교차 회복", kind: "none" },
    { id: "e_tox", color: "emerald", ko: "에메랄드 — 독 상태이상 피해 +30% (타우포지드 45%)", kind: "weapon", slot: "any", fx: (t) => ({ sdTox: t ? 0.45 : 0.30 }) },
    { id: "e_corr", color: "emerald", ko: "에메랄드 — 부식 최대 중첩 +2 (타우포지드 +3)", kind: "weapon", slot: "any", fx: (t) => ({ corrMax: t ? 3 : 2 }) },
    { id: "e_heal", color: "emerald", ko: "에메랄드 — 독 상태이상마다 체력 +2 회복", kind: "none" },
    { id: "e_abil", color: "emerald", ko: "에메랄드 — 부식 상태 적에게 어빌리티 피해 +10%", kind: "none" },
    { id: "t_scc", color: "topaz", ko: "토파즈 — 화염 상태 적 처치마다 보조무기 치명타 확률 +1% (최대 50%, 타우포지드 75%)", kind: "weapon", slot: "secondary", fx: (t) => ({ ccFlat: t ? 0.75 : 0.5 }) },
    { id: "t_blast", color: "topaz", ko: "토파즈 — 폭발 처치 시 체력 회복", kind: "none" },
    { id: "t_bsh", color: "topaz", ko: "토파즈 — 폭발 처치 시 실드 회복", kind: "none" },
    { id: "t_abil", color: "topaz", ko: "토파즈 — 방사능 상태 적에게 어빌리티 피해 +10%", kind: "none" },
  ];

  function merge(list) {
    const ext = { elem: {} };
    let final = 1, cdMult = 1;
    for (const e of list) {
      if (!e) continue;
      for (const k in e) {
        if (k === "elem") { for (const t in e.elem) ext.elem[t] = (ext.elem[t] || 0) + e.elem[t]; }
        else if (k === "final") final *= e.final;
        else if (k === "cdMult") cdMult *= e.cdMult;
        else if (k === "armorStrip" || k === "shieldCut") ext[k] = 1 - (1 - (ext[k] || 0)) * (1 - e[k]);
        else if (k === "weakFrac" || k === "weakMult") ext[k] = Math.max(ext[k] || 0, e[k]);
        else ext[k] = (ext[k] || 0) + e[k];
      }
    }
    ext.final = final; ext.cdMult = cdMult;
    return ext;
  }
  // partial coverage in a crowd: blend an ability's effect by the fraction of enemies it reaches
  function scale(e, f) {
    if (f >= 1 || !e) return e;
    const o = {};
    for (const k in e) {
      const v = e[k];
      if (k === "final") o.final = 1 + (v - 1) * f;
      else if (k === "armorStrip" || k === "weakFrac") o[k] = v * f;
      else o[k] = v;
    }
    return o;
  }

  /* Aura slot (one per warframe; squadmates' auras stack the same way). fx: weapon numbers, stat: ability stats. Values: max rank. */
  const AURAS = [
    { id: "steel_charge", en: "Steel Charge", ko: "스틸 차지", cls: ["melee"], fx: { dmgAdd: 0.6 }, note: "근접 피해 +60%" },
    { id: "rifle_amp", en: "Rifle Amp", ko: "라이플 앰프", cls: ["rifle"], notTypes: ["Sniper", "Bow", "Launcher"], fx: { dmgAdd: 0.27 }, note: "라이플 피해 +27%" },
    { id: "dead_eye", en: "Dead Eye", ko: "데드 아이", types: ["Sniper"], fx: { dmgAdd: 0.525 }, note: "저격총 피해 +52.5%" },
    { id: "pistol_amp", en: "Pistol Amp", ko: "피스톨 앰프", cls: ["pistol"], fx: { dmgAdd: 0.27 }, note: "보조무기 피해 +27%" },
    { id: "shotgun_amp", en: "Shotgun Amp", ko: "샷건 앰프", cls: ["shotgun"], fx: { dmgAdd: 0.18 }, note: "샷건 피해 +18%" },
    { id: "corrosive_projection", en: "Corrosive Projection", ko: "코로시브 프로젝션", fx: { armorStrip: 0.18 }, note: "적 방어력 −18%" },
    { id: "shield_disruption", en: "Shield Disruption", ko: "실드 디스럽션", fx: { shieldCut: 0.18 }, note: "적 실드 −18%" },
    { id: "worthy_comradery", en: "Worthy Comradery", ko: "워디 콤래더리", fx: { wpcc: 0.75 }, note: "약점 치명타 확률 +75% (헤드샷 계산을 켰을 때)" },
    { id: "empowered_blades", en: "Empowered Blades", ko: "임파워드 블레이드", cls: ["melee"], fx: { heavySc: 0.6, heavySd: 0.6 }, note: "강공 상태이상 확률·피해 +60%" },
    { id: "swift_momentum", en: "Swift Momentum", ko: "스위프트 모멘텀", cls: ["melee"], fx: { windAdd: 0.3 }, note: "강공 준비 속도 +30%" },
    { id: "ready_steel", en: "Ready Steel", ko: "레디 스틸", cls: ["melee"], fx: { icAdd: 24 }, note: "초기 연속기 +24" },
    { id: "growing_power", en: "Growing Power", ko: "그로잉 파워", stat: { str: 0.25 }, note: "무기 상태이상 시 위력 +25% (계속 유지 가정)" },
    { id: "power_donation", en: "Power Donation", ko: "파워 도네이션", stat: { str: -0.3 }, note: "본인 위력 −30% (아군 +30%)" },
  ];
  root.WF_BUFFS = { abilities: A, augments: AUG, misc: MISC, shards: SHARDS, auras: AURAS, merge, scale };
})(typeof self !== "undefined" ? self : globalThis);
