/* Damage-relevant mods (max rank). eff = always on; cond = conditional ({when:'kill'|'aim'|'headshot'|'hs'|'cast'}).
 * compat: rifle | shotgun | pistol | melee ; req: 'semi' (semi-auto only), 'glaive', 'heavy'.
 * group: mutually exclusive variants. */
(function (root) {
  const M = [];
  const add = (id, ko, en, compat, eff, extra) => M.push(Object.assign({ id, ko, en, compat, eff }, extra || {}));

  /* ---------------- RIFLE (also bows / snipers / launchers) ---------------- */
  add("serration", "세레이션", "Serration", ["rifle"], { dmg: 1.65 }, { group: "r_dmg" });
  add("amalgam_serration", "아말감 세레이션", "Amalgam Serration", ["rifle"], { dmg: 1.55 }, { group: "r_dmg" });
  add("heavy_caliber", "헤비 칼리버", "Heavy Caliber", ["rifle"], { dmg: 1.65 });
  add("semi_rifle_cannonade", "세미 라이플 캐노네이드", "Semi-Rifle Cannonade", ["rifle"], { dmg: 2.4, lock: 1 }, { req: "semi" });
  add("split_chamber", "스플릿 챔버", "Split Chamber", ["rifle"], { ms: 0.9 }, { group: "r_ms" });
  add("galvanized_chamber", "갈바나이즈드 챔버", "Galvanized Chamber", ["rifle"], { ms: 0.8 }, { group: "r_ms", cond: [{ when: "kill", eff: { ms: 1.5 } }] });
  add("vigilante_armaments", "비질란테 아마먼트", "Vigilante Armaments", ["rifle"], { ms: 0.6 });
  add("point_strike", "포인트 스트라이크", "Point Strike", ["rifle"], { cc: 1.5 });
  add("critical_delay", "크리티컬 딜레이", "Critical Delay", ["rifle"], { cc: 2.0, frneg: -0.2 });
  add("vital_sense", "바이탈 센스", "Vital Sense", ["rifle"], { cd: 1.2 });
  add("hammer_shot", "해머 샷", "Hammer Shot", ["rifle"], { cd: 0.6, sc: 0.8 });
  add("argon_scope", "아르곤 스코프", "Argon Scope", ["rifle"], {}, { group: "r_scope", cond: [{ when: "headshot", eff: { cc: 1.35 } }], note: "조준+헤드샷" });
  add("galvanized_scope", "갈바나이즈드 스코프", "Galvanized Scope", ["rifle"], {}, { group: "r_scope", cond: [{ when: "headshot", eff: { cc: 3.2 } }], note: "조준+헤드샷 처치" });
  add("bladed_rounds", "블레이디드 라운드", "Bladed Rounds", ["rifle"], {}, { cond: [{ when: "aim", eff: { cd: 1.2 } }], note: "조준 중 처치" });
  add("rifle_aptitude", "라이플 앱티튜드", "Rifle Aptitude", ["rifle"], { sc: 0.9 }, { group: "r_sc" });
  add("galvanized_aptitude", "갈바나이즈드 앱티튜드", "Galvanized Aptitude", ["rifle"], { sc: 0.8 }, { group: "r_sc", cond: [{ when: "kill", eff: { gco: 0.8 } }] });
  add("rifle_elementalist", "라이플 엘리멘탈리스트", "Rifle Elementalist", ["rifle"], { sd: 0.9 });
  add("continuous_misery", "컨티뉴어스 미저리", "Continuous Misery", ["rifle"], { dur: 1.0 });
  add("speed_trigger", "스피드 트리거", "Speed Trigger", ["rifle"], { fr: 0.6 });
  add("vile_acceleration", "바일 액셀러레이션", "Vile Acceleration", ["rifle"], { fr: 0.9, dmg: -0.15 });
  add("shred", "슈레드", "Shred", ["rifle"], { fr: 0.3 }, { group: "r_shred" });
  add("primed_shred", "프라임드 슈레드", "Primed Shred", ["rifle"], { fr: 0.55 }, { group: "r_shred" });
  add("hellfire", "헬파이어", "Hellfire", ["rifle"], { heat: 0.9 });
  add("cryo_rounds", "크라이오 라운드", "Cryo Rounds", ["rifle"], { cold: 0.9 }, { group: "r_cold" });
  add("primed_cryo_rounds", "프라임드 크라이오 라운드", "Primed Cryo Rounds", ["rifle"], { cold: 1.65 }, { group: "r_cold" });
  add("stormbringer", "스톰브링어", "Stormbringer", ["rifle"], { elec: 0.9 });
  add("infected_clip", "인펙티드 클립", "Infected Clip", ["rifle"], { tox: 0.9 });
  add("thermite_rounds", "써마이트 라운드", "Thermite Rounds", ["rifle"], { heat: 0.6, sc: 0.6 });
  add("rime_rounds", "라임 라운드", "Rime Rounds", ["rifle"], { cold: 0.6, sc: 0.6 });
  add("high_voltage", "하이 볼티지", "High Voltage", ["rifle"], { elec: 0.6, sc: 0.6 });
  add("malignant_force", "멀리그넌트 포스", "Malignant Force", ["rifle"], { tox: 0.6, sc: 0.6 });
  add("wildfire", "와일드파이어", "Wildfire", ["rifle"], { heat: 0.6, mag: 0.2 });

  /* ---------------- SHOTGUN ---------------- */
  add("point_blank", "포인트 블랭크", "Point Blank", ["shotgun"], { dmg: 0.9 }, { group: "s_dmg" });
  add("primed_point_blank", "프라임드 포인트 블랭크", "Primed Point Blank", ["shotgun"], { dmg: 1.65 }, { group: "s_dmg" });
  add("semi_shotgun_cannonade", "세미 샷건 캐노네이드", "Semi-Shotgun Cannonade", ["shotgun"], { dmg: 2.4, lock: 1 }, { req: "semi" });
  add("vicious_spread", "비셔스 스프레드", "Vicious Spread", ["shotgun"], { dmg: 0.9 });
  add("blaze", "블레이즈", "Blaze", ["shotgun"], { dmg: 0.6, heat: 0.6 });
  add("frail_momentum", "프레일 모멘텀", "Frail Momentum", ["shotgun"], { fr: 0.9, dmg: -0.15 });
  add("shotgun_barrage", "샷건 배라지", "Shotgun Barrage", ["shotgun"], { fr: 0.9 }, { group: "s_fr" });
  add("amalgam_shotgun_barrage", "아말감 샷건 배라지", "Amalgam Shotgun Barrage", ["shotgun"], { fr: 0.85 }, { group: "s_fr" });
  add("hells_chamber", "헬스 챔버", "Hell's Chamber", ["shotgun"], { ms: 1.2 }, { group: "s_ms" });
  add("galvanized_hell", "갈바나이즈드 헬", "Galvanized Hell", ["shotgun"], { ms: 1.1 }, { group: "s_ms", cond: [{ when: "kill", eff: { ms: 1.2 } }] });
  add("critical_deceleration", "크리티컬 디셀러레이션", "Critical Deceleration", ["shotgun"], { cc: 2.0, frneg: -0.2 });
  add("blunderbuss", "블런더버스", "Blunderbuss", ["shotgun"], { cc: 0.9 }, { group: "s_cc" });
  add("primed_blunderbuss", "프라임드 블런더버스", "Primed Blunderbuss", ["shotgun"], { cc: 1.65 }, { group: "s_cc" });
  add("laser_sight", "레이저 사이트", "Laser Sight", ["shotgun"], {}, { cond: [{ when: "headshot", eff: { cc: 1.2 } }], note: "조준+헤드샷" });
  add("ravage", "래비지", "Ravage", ["shotgun"], { cd: 0.6 }, { group: "s_cd" });
  add("primed_ravage", "프라임드 래비지", "Primed Ravage", ["shotgun"], { cd: 1.1 }, { group: "s_cd" });
  add("shrapnel_shot", "슈라프넬 샷", "Shrapnel Shot", ["shotgun"], {}, { cond: [{ when: "aim", eff: { cd: 0.99 } }], note: "조준 중 처치" });
  add("shotgun_savvy", "샷건 새비", "Shotgun Savvy", ["shotgun"], { sc: 0.9 }, { group: "s_sc" });
  add("galvanized_savvy", "갈바나이즈드 새비", "Galvanized Savvy", ["shotgun"], { sc: 0.8 }, { group: "s_sc", cond: [{ when: "kill", eff: { gco: 0.8 } }] });
  add("shotgun_elementalist", "샷건 엘리멘탈리스트", "Shotgun Elementalist", ["shotgun"], { sd: 0.9, mag: 0.6 });
  add("lingering_torment", "링거링 토먼트", "Lingering Torment", ["shotgun"], { dur: 0.9 });
  add("incendiary_coat", "인센디어리 코트", "Incendiary Coat", ["shotgun"], { heat: 0.9 });
  add("chilling_grasp", "칠링 그래스프", "Chilling Grasp", ["shotgun"], { cold: 0.9 }, { group: "s_cold" });
  add("primed_chilling_grasp", "프라임드 칠링 그래스프", "Primed Chilling Grasp", ["shotgun"], { cold: 1.65 }, { group: "s_cold" });
  add("charged_shell", "차지드 셸", "Charged Shell", ["shotgun"], { elec: 0.9 }, { group: "s_elec" });
  add("primed_charged_shell", "프라임드 차지드 셸", "Primed Charged Shell", ["shotgun"], { elec: 1.65 }, { group: "s_elec" });
  add("contagious_spread", "컨테이저스 스프레드", "Contagious Spread", ["shotgun"], { tox: 0.9 });
  add("scattering_inferno", "스캐터링 인페르노", "Scattering Inferno", ["shotgun"], { heat: 0.6, sc: 0.6 });
  add("frigid_blast", "프리지드 블래스트", "Frigid Blast", ["shotgun"], { cold: 0.6, sc: 0.6 });
  add("shell_shock", "셸 쇼크", "Shell Shock", ["shotgun"], { elec: 0.6, sc: 0.6 });
  add("toxic_barrage", "톡식 배라지", "Toxic Barrage", ["shotgun"], { tox: 0.6, sc: 0.6 });
  add("chilling_reload", "칠링 리로드", "Chilling Reload", ["shotgun"], { cold: 0.6, reload: 0.4 });

  /* ---------------- PISTOL ---------------- */
  add("hornet_strike", "호넷 스트라이크", "Hornet Strike", ["pistol"], { dmg: 2.2 });
  add("magnum_force", "매그넘 포스", "Magnum Force", ["pistol"], { dmg: 0.66 });
  add("augur_pact", "어거 팩트", "Augur Pact", ["pistol"], { dmg: 0.9 });
  add("semi_pistol_cannonade", "세미 피스톨 캐노네이드", "Semi-Pistol Cannonade", ["pistol"], { dmg: 2.4, lock: 1 }, { req: "semi" });
  add("barrel_diffusion", "배럴 디퓨전", "Barrel Diffusion", ["pistol"], { ms: 1.2 }, { group: "p_ms" });
  add("galvanized_diffusion", "갈바나이즈드 디퓨전", "Galvanized Diffusion", ["pistol"], { ms: 1.1 }, { group: "p_ms", cond: [{ when: "kill", eff: { ms: 1.2 } }] });
  add("amalgam_barrel_diffusion", "아말감 배럴 디퓨전", "Amalgam Barrel Diffusion", ["pistol"], { ms: 1.1 }, { group: "p_ms" });
  add("lethal_torrent", "리썰 토렌트", "Lethal Torrent", ["pistol"], { ms: 0.6, fr: 0.6 });
  add("pistol_gambit", "피스톨 갬빗", "Pistol Gambit", ["pistol"], { cc: 1.2 }, { group: "p_cc" });
  add("primed_pistol_gambit", "프라임드 피스톨 갬빗", "Primed Pistol Gambit", ["pistol"], { cc: 1.87 }, { group: "p_cc" });
  add("creeping_bullseye", "크리핑 불스아이", "Creeping Bullseye", ["pistol"], { cc: 2.0, frneg: -0.2 });
  add("target_cracker", "타겟 크래커", "Target Cracker", ["pistol"], { cd: 0.6 }, { group: "p_cd" });
  add("primed_target_cracker", "프라임드 타겟 크래커", "Primed Target Cracker", ["pistol"], { cd: 1.1 }, { group: "p_cd" });
  add("hydraulic_crosshairs", "하이드롤릭 크로스헤어", "Hydraulic Crosshairs", ["pistol"], {}, { group: "p_scope", cond: [{ when: "headshot", eff: { cc: 1.35 } }], note: "조준+헤드샷" });
  add("galvanized_crosshairs", "갈바나이즈드 크로스헤어", "Galvanized Crosshairs", ["pistol"], {}, { group: "p_scope", cond: [{ when: "headshot", eff: { cc: 3.2 } }], note: "조준+헤드샷 처치" });
  add("sharpened_bullets", "샤픈드 불릿", "Sharpened Bullets", ["pistol"], {}, { cond: [{ when: "aim", eff: { cd: 0.75 } }], note: "조준 중 처치" });
  add("sure_shot", "슈어 샷", "Sure Shot", ["pistol"], { sc: 0.9 }, { group: "p_sc" });
  add("galvanized_shot", "갈바나이즈드 샷", "Galvanized Shot", ["pistol"], { sc: 0.8 }, { group: "p_sc", cond: [{ when: "kill", eff: { gco: 1.2 } }] });
  add("pistol_elementalist", "피스톨 엘리멘탈리스트", "Pistol Elementalist", ["pistol"], { sd: 0.9, reload: 0.6 });
  add("gunslinger", "건슬링어", "Gunslinger", ["pistol"], { fr: 0.72 });
  add("anemic_agility", "애너믹 어질리티", "Anemic Agility", ["pistol"], { fr: 0.9, dmg: -0.15 });
  add("heated_charge", "히티드 차지", "Heated Charge", ["pistol"], { heat: 0.9 }, { group: "p_heat" });
  add("primed_heated_charge", "프라임드 히티드 차지", "Primed Heated Charge", ["pistol"], { heat: 1.65 }, { group: "p_heat" });
  add("deep_freeze", "딥 프리즈", "Deep Freeze", ["pistol"], { cold: 0.9 });
  add("convulsion", "컨벌전", "Convulsion", ["pistol"], { elec: 0.9 }, { group: "p_elec" });
  add("primed_convulsion", "프라임드 컨벌전", "Primed Convulsion", ["pistol"], { elec: 1.65 }, { group: "p_elec" });
  add("pathogen_rounds", "패쏘젠 라운드", "Pathogen Rounds", ["pistol"], { tox: 0.9 });
  add("scorch", "스코치", "Scorch", ["pistol"], { heat: 0.6, sc: 0.6 });
  add("frostbite", "프로스트바이트", "Frostbite", ["pistol"], { cold: 0.6, sc: 0.6 });
  add("jolt", "졸트", "Jolt", ["pistol"], { elec: 0.6, sc: 0.6 });
  add("pistol_pestilence", "피스톨 페스틸런스", "Pistol Pestilence", ["pistol"], { tox: 0.6, sc: 0.6 });

  /* ---------------- MELEE ---------------- */
  add("pressure_point", "프레셔 포인트", "Pressure Point", ["melee"], { dmg: 1.2 }, { group: "m_dmg" });
  add("primed_pressure_point", "프라임드 프레셔 포인트", "Primed Pressure Point", ["melee"], { dmg: 1.65 }, { group: "m_dmg" });
  add("spoiled_strike", "스포일드 스트라이크", "Spoiled Strike", ["melee"], { dmg: 1.0, fr: -0.2, wind: -0.2 });
  add("condition_overload", "컨디션 오버로드", "Condition Overload", ["melee"], { co: 0.8 }, { note: "글레이브 폭발·범위 공격에는 미적용" });
  add("blood_rush", "블러드 러시", "Blood Rush", ["melee"], { br: 0.4 });
  add("weeping_wounds", "위핑 운즈", "Weeping Wounds", ["melee"], { ww: 0.4 });
  add("true_steel", "트루 스틸", "True Steel", ["melee"], { cc: 1.2 }, { group: "m_steel" });
  add("sacrificial_steel", "새크리피셜 스틸", "Sacrificial Steel", ["melee"], { cc: 2.2 }, { group: "m_steel", set: "sacrificial", setMul: 1.25 });
  // variant of Pressure Point (can't be equipped together); Sacrificial set (with Steel): each x1.25 → +137.5%
  add("sacrificial_pressure", "새크리피셜 프레셔", "Sacrificial Pressure", ["melee"], { dmg: 1.1 }, { group: "m_dmg", set: "sacrificial", setMul: 1.25, note: "센티언트 상대 x1.33 (미반영)" });
  add("galvanized_steel", "갈바나이즈드 스틸", "Galvanized Steel", ["melee"], { cc: 1.1 }, { group: "m_steel", cond: [{ when: "kill", eff: { cd: 1.2 } }] });
  add("organ_shatter", "오르건 섀터", "Organ Shatter", ["melee"], { cd: 0.9 }, { group: "m_cd" });
  add("amalgam_organ_shatter", "아말감 오르건 섀터", "Amalgam Organ Shatter", ["melee"], { cd: 0.85, wind: 0.6 }, { group: "m_cd" });
  add("gladiator_might", "글래디에이터 마이트", "Gladiator Might", ["melee"], { cd: 0.6 });
  add("fury", "퓨리", "Fury", ["melee"], { fr: 0.3 }, { group: "m_as" });
  add("primed_fury", "프라임드 퓨리", "Primed Fury", ["melee"], { fr: 0.55 }, { group: "m_as" });
  add("berserker_fury", "버서커 퓨리", "Berserker Fury", ["melee"], {}, { cond: [{ when: "kill", eff: { fr: 0.7 } }], note: "치명타 시 중첩" });
  add("melee_prowess", "밀리 프로웨스", "Melee Prowess", ["melee"], { sc: 0.9 });
  add("drifting_contact", "드리프팅 컨택트", "Drifting Contact", ["melee"], { sc: 0.4 });
  add("melee_elementalist", "밀리 엘리멘탈리스트", "Melee Elementalist", ["melee"], { sd: 0.9, wind: 0.6 }, { group: "m_el" });
  add("galvanized_elementalist", "갈바나이즈드 엘리멘탈리스트", "Galvanized Elementalist", ["melee"], { sd: 0.8 }, { group: "m_el", cond: [{ when: "kill", eff: { sc: 1.2 } }] });
  add("lasting_sting", "래스팅 스팅", "Lasting Sting", ["melee"], { dur: 1.1 });
  add("north_wind", "노스 윈드", "North Wind", ["melee"], { cold: 0.9 });
  add("molten_impact", "몰튼 임팩트", "Molten Impact", ["melee"], { heat: 0.9 });
  add("shocking_touch", "쇼킹 터치", "Shocking Touch", ["melee"], { elec: 0.9 });
  add("fever_strike", "피버 스트라이크", "Fever Strike", ["melee"], { tox: 0.9 }, { group: "m_tox" });
  add("primed_fever_strike", "프라임드 피버 스트라이크", "Primed Fever Strike", ["melee"], { tox: 1.65 }, { group: "m_tox" });
  add("volcanic_edge", "볼캐닉 엣지", "Volcanic Edge", ["melee"], { heat: 0.6, sc: 0.6 });
  add("vicious_frost", "바이셔스 프로스트", "Vicious Frost", ["melee"], { cold: 0.6, sc: 0.6 });
  add("voltaic_strike", "볼테익 스트라이크", "Voltaic Strike", ["melee"], { elec: 0.6, sc: 0.6 });
  add("virulent_scourge", "바이럴런트 스커지", "Virulent Scourge", ["melee"], { tox: 0.6, sc: 0.6 });
  add("focus_energy", "포커스 에너지", "Focus Energy", ["melee"], { elec: 0.6, hae: 0.4 });
  add("killing_blow", "킬링 블로우", "Killing Blow", ["melee"], { heavy: 1.2, wind: 0.6 }, { req: "heavy" });
  add("corrupt_charge", "커럽트 차지", "Corrupt Charge", ["melee"], { ic: 30 }, { req: "heavy" });
  add("galvanized_reflex", "갈바나이즈드 리플렉스", "Galvanized Reflex", ["melee"], { hae: 0.5 }, { req: "heavy", group: "m_reflex", cond: [{ when: "kill", eff: { ic: 81.4 } }] });   // 20.35 × 4 stacks (wiki true value; the card rounds to 20)
  // explodes on the first contact (bounce explosion: 50% damage, no combo multiplier, no guaranteed procs) and returns at once;
  // a heavy-attack detonation still works in the same throw (wiki)
  add("volatile_quick_return", "볼래틸 퀵 리턴", "Volatile Quick Return", ["melee"], { radius: 3, volatile: 1 }, { req: "glaive", note: "벽에 튕겨 엉뚱한 방향으로 가지 않음(튕김 −4) · 폭발 범위 +3m · 닿을 때 작은 폭발(피해 50%, 연속기 배율 없음)" });


  /* ---------------- added from full dataset ---------------- */
  // rifle / primary
  add("hunter_track", "헌터 트랙", "Hunter Track", ["rifle", "shotgun"], { dur: 0.9 });
  add("vigilante_fervor", "비질란테 퍼버", "Vigilante Fervor", ["rifle", "shotgun"], { fr: 0.45 });
  add("hunter_munitions", "헌터 뮤니션", "Hunter Munitions", ["rifle", "shotgun"], { hm: 0.3 });
  add("internal_bleeding", "인터널 블리딩", "Internal Bleeding", ["rifle"], { ib: 0.35 });
  add("radiated_reload", "레디에이티드 리로드", "Radiated Reload", ["rifle"], { radm: 0.6, reload: 0.4 });
  add("magnetic_capacity", "마그네틱 커패시티", "Magnetic Capacity", ["rifle"], { magm: 0.6, mag: 0.4 });
  add("crash_course", "크래시 코스", "Crash Course", ["rifle"], { impact: 1.2 });
  add("fanged_fusillade", "팽드 퓨질레이드", "Fanged Fusillade", ["rifle"], { slash: 1.2 });
  add("piercing_caliber", "피어싱 칼리버", "Piercing Caliber", ["rifle"], { punct: 1.2 });
  add("rupture", "럽처", "Rupture", ["rifle"], { impact: 0.9 });
  add("piercing_hit", "피어싱 히트", "Piercing Hit", ["rifle"], { punct: 0.9 });
  add("sawtooth_clip", "소투스 클립", "Sawtooth Clip", ["rifle"], { slash: 0.9 });
  add("primary_acuity", "프라이머리 어큐이티", "Primary Acuity", ["rifle"], { msLock: 1 }, { cond: [{ when: "hs", eff: { cc: 3.5, hsMult: 3.5 } }], note: "약점 사격 전용, 멀티샷 고정" });
  add("catalyzer_link", "카탈라이저 링크", "Catalyzer Link", ["rifle"], {}, { cond: [{ when: "cast", eff: { sc: 0.6 } }], note: "어빌리티 사용 후 조준" });
  // shotgun
  add("accelerated_blast", "액셀러레이티드 블라스트", "Accelerated Blast", ["shotgun"], { fr: 0.6, punct: 0.6 });
  add("atomic_fallout", "아토믹 폴아웃", "Atomic Fallout", ["shotgun"], { radm: 0.6, mag: 0.4 });
  add("magnetic_strafe", "마그네틱 스트레이프", "Magnetic Strafe", ["shotgun"], { magm: 0.6, fr: 0.4 });
  add("magnetic_welt", "마그네틱 웰트", "Magnetic Welt", ["shotgun"], { welt: 0.35 });
  add("full_contact", "풀 컨택트", "Full Contact", ["shotgun"], { impact: 1.2 });
  add("breach_loader", "브리치 로더", "Breach Loader", ["shotgun"], { punct: 1.2 });
  add("sweeping_serration", "스위핑 서레이션", "Sweeping Serration", ["shotgun"], { slash: 1.2 });
  add("disruptor", "디스럽터", "Disruptor", ["shotgun"], { impact: 0.9 });
  add("flechette", "플레셰트", "Flechette", ["shotgun"], { punct: 0.9 });
  add("shredder", "슈레더", "Shredder", ["shotgun"], { slash: 0.9 });
  add("nano_applicator", "나노 어플리케이터", "Nano-Applicator", ["shotgun"], {}, { cond: [{ when: "cast", eff: { sc: 0.9 } }], note: "어빌리티 사용 후 조준" });
  add("repeater_clip", "리피터 클립", "Repeater Clip", ["shotgun"], {}, { reloadBuff: { fr: 1.05, t: 9, aim: true }, cond: [{ when: "aim", eff: {} }], note: "재장전 후 9초간 조준 중 연사 +105% (탄창을 9초 안에 비우면 사격 내내 유지)" });
  // pistol
  add("pistol_acuity", "피스톨 어큐이티", "Pistol Acuity", ["pistol"], { msLock: 1 }, { cond: [{ when: "hs", eff: { cc: 3.5, hsMult: 3.5 } }], note: "약점 사격 전용, 멀티샷 고정" });
  add("hollow_point", "할로우 포인트", "Hollow Point", ["pistol"], { cd: 0.6, dmg: -0.15 });
  add("magnetic_might", "마그네틱 마이트", "Magnetic Might", ["pistol"], { magm: 0.6, cd: 0.4 });
  add("accelerated_isotope", "액셀러레이티드 아이소토프", "Accelerated Isotope", ["pistol"], { radm: 0.6, fr: 0.4 });
  add("ice_storm", "아이스 스톰", "Ice Storm", ["pistol"], { cold: 0.4, mag: 0.4 });
  add("carnis_stinger", "카르니스 스팅어", "Carnis Stinger", ["pistol"], { slash: 0.9, sc: 0.6 });
  add("jugulus_spines", "주굴루스 스파인", "Jugulus Spines", ["pistol"], { punct: 0.9, sc: 0.6 });
  add("saxum_spittle", "삭숨 스피틀", "Saxum Spittle", ["pistol"], { impact: 0.9, sc: 0.6 });
  add("razor_shot", "레이저 샷", "Razor Shot", ["pistol"], { slash: 0.9 });
  add("no_return", "노 리턴", "No Return", ["pistol"], { punct: 0.9 });
  add("concussion_rounds", "컨커션 라운드", "Concussion Rounds", ["pistol"], { impact: 0.9 });
  add("maim", "메임", "Maim", ["pistol"], { slash: 1.2 });
  add("bore", "보어", "Bore", ["pistol"], { punct: 1.2 });
  add("pummel", "퍼멜", "Pummel", ["pistol"], { impact: 1.2 });
  add("augur_seeker", "어거 시커", "Augur Seeker", ["pistol"], { dur: 0.9 }, { group: "p_dur" });
  add("perpetual_agony", "퍼페추얼 애거니", "Perpetual Agony", ["pistol"], { dur: 0.9 }, { group: "p_dur" });
  add("merciless_gunfight", "머시리스 건파이트", "Merciless Gunfight", ["pistol"], { cd: 0.45 });
  add("stunning_speed", "스터닝 스피드", "Stunning Speed", ["pistol"], { sc: 0.3, reload: 0.4 });
  add("hemorrhage", "헤모리지", "Hemorrhage", ["pistol"], { ib: 0.35 });
  add("embedded_catalyzer", "임베디드 카탈라이저", "Embedded Catalyzer", ["pistol"], {}, { cond: [{ when: "cast", eff: { sc: 0.9 } }], note: "어빌리티 사용 후 조준" });
  // melee
  add("buzz_kill", "버즈 킬", "Buzz Kill", ["melee"], { slash: 1.2 });
  add("sundering_strike", "선더링 스트라이크", "Sundering Strike", ["melee"], { punct: 0.9 });
  add("collision_force", "콜리전 포스", "Collision Force", ["melee"], { impact: 1.2 });
  add("heavy_trauma", "헤비 트라우마", "Heavy Trauma", ["melee"], { impact: 0.9 }, { group: "m_imp" });
  add("primed_heavy_trauma", "프라임드 헤비 트라우마", "Primed Heavy Trauma", ["melee"], { impact: 1.65 }, { group: "m_imp" });
  add("jagged_edge", "재기드 엣지", "Jagged Edge", ["melee"], { slash: 0.9 });
  add("auger_strike", "오거 스트라이크", "Auger Strike", ["melee"], { punct: 1.2 });
  add("rending_strike", "렌딩 스트라이크", "Rending Strike", ["melee"], { slash: 0.6, punct: 0.8 });
  add("carnis_mandible", "카르니스 맨디블", "Carnis Mandible", ["melee"], { slash: 0.9, sc: 0.6 });
  add("jugulus_barbs", "주굴루스 바브", "Jugulus Barbs", ["melee"], { punct: 0.9, sc: 0.6 });
  add("saxum_thorax", "삭숨 소락스", "Saxum Thorax", ["melee"], { impact: 0.9, sc: 0.6 });
  add("focus_radon", "포커스 라돈", "Focus Radon", ["melee"], { radm: 0.6, hae: 0.4 });
  add("magnetic_rush", "마그네틱 러시", "Magnetic Rush", ["melee"], { magm: 0.6, fr: 0.2 });
  add("quickening", "퀴크닝", "Quickening", ["melee"], { fr: 0.4 });
  add("gladiator_vice", "글래디에이터 바이스", "Gladiator Vice", ["melee"], { fr: 0.3 });
  add("reflex_coil", "리플렉스 코일", "Reflex Coil", ["melee"], { hae: 1.1 }, { req: "heavy", group: "m_reflex" });

  /* ---------------- magazine / reload (ammo-supplement candidates) ---------------- */
  add("primed_magazine_warp", "프라임드 매거진 워프", "Primed Magazine Warp", ["rifle"], { mag: 0.55 }, { group: "r_mag", ammo: true });
  add("tainted_mag", "테인티드 매그", "Tainted Mag", ["rifle"], { mag: 0.66, reload: -0.33 }, { group: "r_mag", ammo: true });
  add("primed_ammo_stock", "프라임드 애모 스톡", "Primed Ammo Stock", ["shotgun"], { mag: 1.1 }, { group: "s_mag", ammo: true });
  add("burdened_magazine", "버든드 매거진", "Burdened Magazine", ["shotgun"], { mag: 0.6, reload: -0.18 }, { group: "s_mag", ammo: true });
  add("primed_slip_magazine", "프라임드 슬립 매거진", "Primed Slip Magazine", ["pistol"], { mag: 0.55 }, { group: "p_mag", ammo: true });
  add("tainted_clip", "테인티드 클립", "Tainted Clip", ["pistol"], { mag: 0.6, reload: -0.3 }, { group: "p_mag", ammo: true });
  add("primed_fast_hands", "프라임드 패스트 핸즈", "Primed Fast Hands", ["rifle"], { reload: 0.55 });
  add("primed_tactical_pump", "프라임드 택티컬 펌프", "Primed Tactical Pump", ["shotgun"], { reload: 1.0 });
  add("quickdraw", "퀵드로우", "Quickdraw", ["pistol"], { reload: 0.2 });

  /* ---------------- EXILUS slot (utility mods; only these fit the exilus slot) ---------------- */
  // ammoConv: other-ammo pickups converted to this weapon's pickups; ammoMax: +max ammo; throwSpd/projSpd: projectile speed
  const X = (id, ko, en, compat, eff, extra) => add(id, ko, en, compat, eff, Object.assign({ exilus: true }, extra || {}));
  X("primed_rifle_ammo_mutation", "프라임드 라이플 애모 뮤테이션", "Primed Rifle Ammo Mutation", ["rifle"], { ammoConv: 0.92 }, { group: "x_ammo", notTypes: ["Sniper", "Bow"] });
  X("rifle_ammo_mutation", "라이플 애모 뮤테이션", "Rifle Ammo Mutation", ["rifle"], { ammoConv: 0.5 }, { group: "x_ammo", notTypes: ["Sniper", "Bow"] });
  X("primed_sniper_ammo_mutation", "프라임드 스나이퍼 애모 뮤테이션", "Primed Sniper Ammo Mutation", ["rifle"], { ammoConv: 0.92 }, { group: "x_ammo", types: ["Sniper"] });
  X("arrow_mutation", "애로우 뮤테이션", "Arrow Mutation", ["rifle"], { ammoConv: 0.92 }, { group: "x_ammo", types: ["Bow"] });
  X("vigilante_supplies", "비질란티 서플라이즈", "Vigilante Supplies", ["rifle", "shotgun"], { ammoConv: 0.3 }, { group: "x_ammo" });
  X("ammo_drum", "애모 드럼", "Ammo Drum", ["rifle"], { ammoMax: 0.1 });
  X("primed_shotgun_ammo_mutation", "프라임드 샷건 애모 뮤테이션", "Primed Shotgun Ammo Mutation", ["shotgun"], { ammoConv: 0.92 }, { group: "x_ammo" });
  X("shotgun_ammo_mutation", "샷건 애모 뮤테이션", "Shotgun Ammo Mutation", ["shotgun"], { ammoConv: 0.5 }, { group: "x_ammo" });
  X("shell_compression", "쉘 컴프레션", "Shell Compression", ["shotgun"], { ammoMax: 0.12 });
  X("primed_pistol_ammo_mutation", "프라임드 피스톨 애모 뮤테이션", "Primed Pistol Ammo Mutation", ["pistol"], { ammoConv: 0.92 }, { group: "x_ammo" });
  X("pistol_ammo_mutation", "피스톨 애모 뮤테이션", "Pistol Ammo Mutation", ["pistol"], { ammoConv: 0.5 }, { group: "x_ammo" });
  X("trick_mag", "트릭 매거진", "Trick Mag", ["pistol"], { ammoMax: 0.4 });
  X("terminal_velocity", "터미널 벨로시티", "Terminal Velocity", ["rifle"], { projSpd: 0.6 }, { group: "x_proj" });
  X("fatal_acceleration", "페이탈 액셀러레이션", "Fatal Acceleration", ["shotgun"], { projSpd: 0.4 }, { group: "x_proj" });
  X("galvanized_acceleration", "갈바나이즈드 액셀러레이션", "Galvanized Acceleration", ["shotgun"], { projSpd: 0.3 }, { group: "x_proj", cond: [{ when: "kill", eff: { projSpd: 0.6 } }] });
  X("lethal_momentum", "리썰 모멘텀", "Lethal Momentum", ["pistol"], { projSpd: 0.4 }, { group: "x_proj" });
  X("whirlwind", "훨윈드", "Whirlwind", ["melee"], { throwSpd: 1.2 }, { req: "glaive" });
  // Tennokai (melee swing style): a heavy attack that does not consume combo, opened every few hits
  X("mentors_legacy", "멘토즈 레거시", "Mentor's Legacy", ["melee"], { tenno: { on: 1 } }, { req: "swing", group: "x_tenno" });
  X("masters_edge", "마스터즈 엣지", "Master's Edge", ["melee"], { tenno: { on: 1, dmg: 0.6 } }, { req: "swing", group: "x_tenno" });
  X("truths_flame", "트루스 플레임", "Truth's Flame", ["melee"], { tenno: { on: 1 } }, { req: "swing", group: "x_tenno", cond: [{ when: "kill", eff: { tenno: { dmg: 1.2 } } }], note: "저주: 6초간 초당 화염 피해 100" });
  X("dreamers_wrath", "드리머즈 라스", "Dreamer's Wrath", ["melee"], { tenno: { on: 1, cd: 0.32, freq: 1.5 } }, { req: "swing", group: "x_tenno" });
  X("conditions_perfection", "컨디션즈 퍼펙션", "Condition's Perfection", ["melee"], { tenno: { on: 1, sc: 1.0 } }, { req: "swing", group: "x_tenno" });
  X("disciplines_merit", "디시플린즈 메리트", "Discipline's Merit", ["melee"], { tenno: { on: 1, every: 4 } }, { req: "swing", group: "x_tenno" });
  X("opportunitys_reach", "오퍼튜니티즈 리치", "Opportunity's Reach", ["melee"], { tenno: { on: 1 } }, { req: "swing", group: "x_tenno" });

  /* ---------------- ARCANES ---------------- */
  // weapon arcanes. manual: needs a condition the player has to set up — compared only when picked by hand.
  // none: no effect on weapon damage (listed so nothing is silently missing).
  const ARC = {
    primary_merciless: { ko: "프라이머리 머시리스", slot: "primary", cond: [{ when: "kill", eff: { dmg: 3.6, reload: 0.3 } }] },
    primary_deadhead: { ko: "프라이머리 데드헤드", slot: "primary", eff: { hsMult: 0.3 }, cond: [{ when: "hs", eff: { dmg: 3.6 } }] },
    primary_dexterity: { ko: "프라이머리 덱스터리티", slot: "primary", manual: true, cond: [{ when: "kill", eff: { dmg: 3.6 } }], note: "근접 처치 6회로 최대 중첩" },
    primary_frostbite: { ko: "프라이머리 프로스트바이트", slot: "primary", procStack: { type: "cold", cd: 1.2, ms: 0.9, win: 12, max: 40 } },
    primary_blight: { ko: "프라이머리 블라이트", slot: "primary", procStack: { type: "tox", cd: 1.44, ms: 0.72, win: 12, max: 40 } },
    primary_overcharge: { ko: "프라이머리 오버차지", en: "Primary Overcharge", slot: "primary", manual: true, energyMs: 0.35, note: "에너지 90% 이상 유지 시 최대 에너지의 35%만큼 멀티샷 (최대 350%)" },
    shotgun_vendetta: { ko: "샷건 벤데타", en: "Shotgun Vendetta", slot: "primary", shotgunOnly: true, manual: true, cond: [{ when: "kill", eff: { ms: 1.8, reload: 0.75 } }], note: "5m 이내 처치" },
    primary_crux: { ko: "프라이머리 크럭스", slot: "primary", cond: [{ when: "hs", eff: { sc: 3.0, ammoEff: 0.6 } }], note: "약점 명중 10중첩" },
    primary_plated_round: { ko: "프라이머리 플레이티드 라운드", en: "Primary Plated Round", slot: "primary", plated: true, note: "탄창을 비우고 재장전하면 10초간 피해 증가 (탄창이 클수록 큼)" },
    primary_compression: { ko: "프라이머리 컴프레션", en: "Primary Compression", slot: "primary", aoeOnly: true, compression: true, aim: true, note: "조준 시 폭발 반경 20%로 줄이고 줄어든 1m당 피해 +100%" },
    primary_bulwark: { ko: "프라이머리 불워크", en: "Primary Bulwark", slot: "primary", manual: true, bulwark: true, note: "워프레임 방어력 1,000 초과 1당 피해 +1% (최대 +500%) — 방어력 입력값 사용" },
    fractalized_reset: { ko: "프랙탈라이즈드 리셋", en: "Fractalized Reset", slot: "primary", cond: [{ when: "cast", eff: { reload: 1.2 } }], note: "시전 후 5초간 재장전 +240% (가동률 50% 가정)" },
    primary_debilitate: { ko: "프라이머리 디빌리테이트", en: "Primary Debilitate", slot: "primary", none: true, note: "합성 상태이상 10중첩 대상에 구성 상태이상 추가 — 수치화 어려워 제외" },
    primary_exhilarate: { ko: "프라이머리 익질러레이트", en: "Primary Exhilarate", slot: "primary", none: true, note: "에너지 회복" },
    primary_obstruct: { ko: "프라이머리 옵스트럭트", en: "Primary Obstruct", slot: "primary", none: true, note: "적 무기 고장" },
    longbow_sharpshot: { ko: "롱보우 샤프샷", en: "Longbow Sharpshot", slot: "primary", types: ["Bow"], cond: [{ when: "hs", eff: { dmg: 1.5 } }], note: "약점 명중 후 다음 발 +300% (헤드샷 50% 가정)" },
    secondary_merciless: { ko: "세컨더리 머시리스", slot: "secondary", cond: [{ when: "kill", eff: { dmg: 3.6, reload: 0.3 } }] },
    secondary_deadhead: { ko: "세컨더리 데드헤드", slot: "secondary", eff: { hsMult: 0.3 }, cond: [{ when: "hs", eff: { dmg: 3.6 } }] },
    secondary_dexterity: { ko: "세컨더리 덱스터리티", en: "Secondary Dexterity", slot: "secondary", manual: true, cond: [{ when: "kill", eff: { dmg: 3.6 } }], note: "근접 처치 6회로 최대 중첩" },
    secondary_shiver: { ko: "세컨더리 쉬버", en: "Secondary Shiver", slot: "secondary", coldVuln: 0.45 },
    cascadia_flare: { ko: "캐스케디아 플레어", slot: "secondary", procStack: { type: "heat", dmg: 4.8, win: 10, max: 40 } },
    conjunction_voltage: { ko: "컨정션 볼티지", slot: "secondary", procStack: { type: "elec", ms: 1.2, reload: 0.6, win: 12, max: 40 } },
    secondary_enervate: { ko: "세컨더리 에너베이트", en: "Secondary Enervate", slot: "secondary", enervate: true, note: "명중마다 치명타 확률 +10%, 큰 치명타 6회 후 초기화 — 평균값으로 계산" },
    secondary_encumber: { ko: "세컨더리 인컴버", en: "Secondary Encumber", slot: "secondary", encumber: 0.24, note: "상태이상 시 24% 확률로 무작위 상태이상 추가" },
    cascadia_empowered: { ko: "캐스케디아 임파워드", en: "Cascadia Empowered", slot: "secondary", flatPerProc: 750, note: "상태이상마다 고정 피해 750" },
    secondary_cryogenic: { ko: "세컨더리 크라이오제닉", en: "Secondary Cryogenic", slot: "secondary", punctCold: 3, note: "관통 상태이상 시 15m 안 적에게 냉기 3중첩" },
    secondary_irradiate: { ko: "세컨더리 이레디에이트", en: "Secondary Irradiate", slot: "secondary", irradiate: 1.8, note: "방사능 10중첩 대상 명중 시 7m 안 적에게 그 피해의 180%" },
    secondary_fortifier: { ko: "세컨더리 포티파이어", en: "Secondary Fortifier", slot: "secondary", ogMult: 8, note: "오버가드에 8배 피해 (오버가드 계산을 켰을 때만 의미)" },
    cascadia_accuracy: { ko: "캐스케디아 어큐러시", en: "Cascadia Accuracy", slot: "secondary", manual: true, cond: [{ when: "hs", eff: { cc: 3.0 } }], note: "구르기 후 4초간 약점 명중 치명타 +300% — 계속 구른다고 가정" },
    cascadia_overcharge: { ko: "캐스케디아 오버차지", en: "Cascadia Overcharge", slot: "secondary", manual: true, eff: { cc: 3.0 }, note: "오버실드 유지 중 치명타 +300%" },
    secondary_kinship: { ko: "세컨더리 킨쉽", en: "Secondary Kinship", slot: "secondary", manual: true, eff: { cc: 0.8 }, note: "아군 워프레임 버프 1개당 치명타 +20% (4개 가정)" },
    secondary_outburst: { ko: "세컨더리 아웃버스트", en: "Secondary Outburst", slot: "secondary", manual: true, eff: { cc: 2.4, cd: 2.4 }, note: "근접 연속기 12배를 소모해 30초간 치명타 확률·피해 +240% 가정" },
    secondary_surge: { ko: "세컨더리 서지", en: "Secondary Surge", slot: "secondary", none: true, note: "시전 직후 한 발만 강화 — 지속 피해 계산에서 제외" },
    akimbo_slip_shot: { ko: "아킴보 슬립 샷", en: "Akimbo Slip Shot", slot: "secondary", types: ["Dual Pistols"], manual: true, eff: { ammoEff: 0.65 }, note: "슬라이딩 중 탄약 효율 (탄약만 영향)" },
    melee_influence: { ko: "밀리 인플루언스", slot: "melee" },
    melee_duplicate: { ko: "밀리 듀플리케이트", slot: "melee" },
    melee_animosity: { ko: "밀리 애니모시티", slot: "melee" },
    melee_exposure: { ko: "밀리 익스포저", slot: "melee", eff: { corrm: 2.4 } },
    melee_retaliation: { ko: "밀리 리탈리에이션", slot: "melee", manual: true, eff: { dmg: 4.2 }, note: "실드 2,800 이상 유지 가정" },
    melee_doughty: { ko: "밀리 다우티", en: "Melee Doughty", slot: "melee", doughty: true, note: "관통 상태이상 확률 10%마다 치명타 피해 +1.0배" },
    melee_careen: { ko: "밀리 커린", en: "Melee Careen", slot: "melee", frozenMult: 2.5, note: "빙결(냉기 10중첩) 적에게 근접 피해 2.5배" },
    melee_crescendo: { ko: "밀리 크레센도", en: "Melee Crescendo", slot: "melee", manual: true, eff: { ic: 60 }, note: "피니셔 처치마다 초기 연속기 +6 (10회 = +60 가정)" },
    melee_assimilation: { ko: "밀리 어시밀레이션", en: "Melee Assimilation", slot: "melee", manual: true, eff: { heavy: 1.5 }, note: "실드를 깬 뒤 강공 피해 +150% (코퍼스 상대)" },
    melee_afflictions: { ko: "밀리 어플릭션즈", en: "Melee Afflictions", slot: "melee", none: true, note: "넘어뜨린 적에게 상태이상 중첩 추가 — 수치화 어려워 제외" },
    melee_fortification: { ko: "밀리 포티피케이션", en: "Melee Fortification", slot: "melee", none: true, note: "방어력" },
    melee_vortex: { ko: "밀리 볼텍스", en: "Melee Vortex", slot: "melee", none: true, note: "적 끌어당기기" },
  };

  // warframe arcanes (2 slots). kind weapon: buff to a weapon class with trigger/uptime; kind stat: ability stats.
  // trig: what triggers it — crit (on crit hit), hit, reload, hs (weak point hit), kill. manual = condition the calculator can't assume.
  root.WF_FRAME_ARCANES = {
    arcane_acceleration: { ko: "아케인 액셀러레이션", en: "Arcane Acceleration", kind: "weapon", slot: "primary", notTypes: ["Shotgun"], trig: "crit", p: 0.3, t: 9, eff: { fr: 0.9 } },
    arcane_tempo: { ko: "아케인 템포", en: "Arcane Tempo", kind: "weapon", slot: "primary", types: ["Shotgun"], trig: "crit", p: 0.15, t: 12, eff: { fr: 0.9 } },
    arcane_velocity: { ko: "아케인 벨로시티", en: "Arcane Velocity", kind: "weapon", slot: "secondary", trig: "crit", p: 0.9, t: 9, eff: { fr: 1.2 } },
    arcane_momentum: { ko: "아케인 모멘텀", en: "Arcane Momentum", kind: "weapon", slot: "primary", types: ["Sniper"], trig: "crit", p: 0.6, t: 12, eff: { reload: 1.5 } },
    arcane_fury: { ko: "아케인 퓨리", en: "Arcane Fury", kind: "weapon", slot: "melee", trig: "crit", p: 0.6, t: 18, eff: { dmg: 1.8 } },
    arcane_strike: { ko: "아케인 스트라이크", en: "Arcane Strike", kind: "weapon", slot: "melee", trig: "hit", p: 0.15, t: 18, eff: { fr: 0.6, wind: 0.6 } },
    arcane_rage: { ko: "아케인 레이지", en: "Arcane Rage", kind: "weapon", slot: "primary", trig: "hs", p: 0.15, t: 24, eff: { dmg: 1.8 } },
    arcane_precision: { ko: "아케인 프리시젼", en: "Arcane Precision", kind: "weapon", slot: "secondary", trig: "hs", p: 1, t: 18, eff: { dmg: 3.0 } },
    arcane_awakening: { ko: "아케인 어웨이크닝", en: "Arcane Awakening", kind: "weapon", slot: "secondary", trig: "reload", p: 0.6, t: 24, eff: { dmg: 1.5 } },
    arcane_rise: { ko: "아케인 라이즈", en: "Arcane Rise", kind: "weapon", slot: "primary", trig: "reload", p: 0.6, t: 24, eff: { dmg: 1.5 } },
    arcane_avenger: { ko: "아케인 어벤저", en: "Arcane Avenger", kind: "weapon", slot: "any", manual: true, eff: { cc: 0.45 }, note: "피격 시 21% 확률 12초 — 계속 맞는다고 가정" },
    arcane_arachne: { ko: "아케인 아라크네", en: "Arcane Arachne", kind: "weapon", slot: "gun", manual: true, eff: { dmg: 1.5 }, note: "벽 붙기 후 30초간 주·보조무기 피해 +150%" },
    arcane_blade_charger: { ko: "아케인 블레이드 차저", en: "Arcane Blade Charger", kind: "weapon", slot: "melee", manual: true, eff: { dmg: 3.0 }, note: "주무기 처치 시 30% 확률 12초 근접 피해 +300%" },
    arcane_primary_charger: { ko: "아케인 프라이머리 차저", en: "Arcane Primary Charger", kind: "weapon", slot: "primary", manual: true, eff: { dmg: 3.0 }, note: "근접 처치 시 30% 확률 12초 주무기 피해 +300%" },
    arcane_hot_shot: { ko: "아케인 핫 샷", en: "Arcane Hot Shot", kind: "weapon", slot: "any", manual: true, eff: { cc: 3.0 }, note: "어빌리티로 화염 상태이상을 걸 때마다 무기 치명타 +6% (50중첩 가정)" },
    arcane_crepuscular: { ko: "아케인 크리퍼스큘러", en: "Arcane Crepuscular", kind: "weapon", slot: "any", manual: true, stat: { str: 0.3 }, cdFinal: 3, note: "투명 상태에서 최종 치명타 피해 3배·위력 +30% (투명 유지 가정)" },
    theorem_demulcent: { ko: "시오럼 디멀센트", en: "Theorem Demulcent", kind: "weapon", slot: "any", manual: true, eff: { dmg: 1.8 }, note: "레지듀얼 아케인 구역 안에서 무기 피해 +180% (최대 중첩)" },
    arcane_pistoleer: { ko: "아케인 피스톨리어", en: "Arcane Pistoleer", kind: "ammo", slot: "secondary", note: "보조무기 약점 처치 시 60% 확률 12초 탄약 무한 (탄약 보완용)" },
    molt_augmented: { ko: "몰트 어그먼티드", en: "Molt Augmented", kind: "stat", stat: { str: 0.6 }, note: "처치마다 위력 +0.24% (250중첩 = +60%)" },
    arcane_power_ramp: { ko: "아케인 파워 램프", en: "Arcane Power Ramp", kind: "stat", manual: true, stat: { str: 0.36 }, note: "다른 어빌리티를 번갈아 쓰면 위력 +36%" },
    arcane_bellicose: { ko: "아케인 벨리코스", en: "Arcane Bellicose", kind: "stat", bellicose: true, note: "최대 체력 250당 위력 +6% (최대 72%) — 체력 입력값 사용" },
    arcane_impetus: { ko: "아케인 임페터스", en: "Arcane Impetus", kind: "stat", manual: true, stat: { str: 0.24, eff: 0.12 }, note: "어빌리티로 건 상태이상 종류 1개당 위력 +6% (4종 가정)" },
    arcane_ice_storm: { ko: "아케인 아이스 스톰", en: "Arcane Ice Storm", kind: "stat", manual: true, stat: { str: 0.4, dur: 0.4 }, note: "적 빙결 시 위력·지속 +2% (20중첩 가정)" },
    arcane_camisado: { ko: "아케인 카미사도", en: "Arcane Camisado", kind: "stat", manual: true, stat: { str: 0.6 }, note: "소환수 공격으로 다음 시전 위력 최대 +60%" },
    molt_vigor: { ko: "몰트 비거", en: "Molt Vigor", kind: "stat", manual: true, stat: { str: 0.45 }, note: "오퍼레이터 어빌리티 후 다음 시전 위력 +45%" },
    arcane_concentration: { ko: "아케인 컨센트레이션", en: "Arcane Concentration", kind: "stat", stat: { dur: 0.6 }, note: "시전 후 3초간 지속 +60%" },
    molt_efficiency: { ko: "몰트 이피션시", en: "Molt Efficiency", kind: "stat", stat: { dur: 0.36 }, note: "실드 유지 중 지속 최대 +36%" },
    arcane_battery: { ko: "아케인 배터리", en: "Arcane Battery", kind: "stat", battery: true, note: "방어력 1당 최대 에너지 +0.3 (최대 1,000) — 방어력 입력값 사용" },
  };


  // weapon augment with a crowd-wiping effect, modeled specially (engine: chain explosions on kill)
  // Sobek augment (wiki): next magazine +15% status chance and multishot per trigger pull landed, max 15 stacks (+225%)
  add("clip_delegation", "클립 델리게이션", "Clip Delegation", ["shotgun"], {}, { weapons: ["Sobek"], clipDeleg: { per: 0.15, max: 15 }, note: "다음 탄창 상태이상 확률·멀티샷 +15%×(이번 탄창 명중 발수), 최대 15중첩(+225%) — 탄창마다 15발 이상 맞힌다고 가정, 애시드 쉘즈 폭발에는 영향 없음" });
  add("acid_shells", "애시드 쉘즈", "Acid Shells", ["shotgun"], {}, { weapons: ["Sobek"], killExplode: { pct: 0.45, flat: 450, r: 10 }, note: "처치한 적이 폭발해 10m 안에 부식 450 + 최대 체력 45% 피해 (연쇄 폭발)" });

  /* ---------------- every other weapon mod in the game data, read from its max-rank text ---------------- */
  const STAT = { "Damage": "dmg", "Melee Damage": "dmg", "Critical Chance": "cc", "Critical Damage": "cd", "Status Chance": "sc", "Status Duration": "dur",
    "Status Damage": "sd", "Multishot": "ms", "Fire Rate": "fr", "Attack Speed": "fr", "Reload Speed": "reload", "Magazine Capacity": "mag", "Ammo Maximum": "ammoMax",
    "Heat": "heat", "Cold": "cold", "Electricity": "elec", "Toxin": "tox", "Impact": "impact", "Puncture": "punct", "Slash": "slash",
    "Blast": "blastm", "Radiation": "radm", "Gas": "gasm", "Magnetic": "magm", "Viral": "viralm", "Corrosive": "corrm",
    "Heavy Attack Efficiency": "hae", "Heavy Attack Wind Up Speed": "wind", "Heavy Attack Damage": "heavy", "Blast Range": "blastR", "Blast Radius": "blastR",
    "Projectile Speed": "projSpd", "Damage on first shot in Magazine": "firstShot", "to Headshot Multiplier": "hsMult" };
  const FAC = { grineer: "grineer", corpus: "corpus", infested: "infested", corrupted: "corrupted", orokin: "corrupted", murmur: "murmur", "the murmur": "murmur" };
  function parseLine(l) {
    let m;
    if ((m = l.match(/^x(\d+(?:\.\d+)?) Damage to (Grineer|Corpus|Infested|Corrupted|Orokin|Murmur|The Murmur)$/i))) return [["bane", { [FAC[m[2].toLowerCase()]]: +m[1] - 1 }]];
    if ((m = l.match(/^([+-]?\d+(?:\.\d+)?) Punch Through$/i))) return [["pt", +m[1]]];
    if ((m = l.match(/^\+?(\d+) Initial Combo$/i))) return [["ic", +m[1]]];
    if ((m = l.match(/^([+-]?\d+(?:\.\d+)?)% (.+)$/))) {
      const what = m[2].replace(/ \(x2 for Bows\)/i, "").trim();
      if (STAT[what]) return [[STAT[what], +m[1] / 100]];
    }
    return null;
  }
  function parseModText(lines) {
    const eff = {}, cond = [], un = [];
    let cur = null;
    const put = (o, k, v) => { if (typeof v === "object") { o[k] = o[k] || {}; for (const f in v) o[k][f] = (o[k][f] || 0) + v[f]; } else o[k] = (o[k] || 0) + v; };
    for (const raw of lines || []) for (let line of raw.split(/\n| \/ /)) {
      line = line.trim().replace(/\.$/, "");
      if (!line) continue;
      // Syndicate weapon augments: "+1 'Truth'" etc. only feeds the Syndicate proc meter (no weapon stat) — not a blocker
      if (/^\+\d+ '(Truth|Justice|Purity|Entropy|Sequence|Blight)'$/i.test(line)) continue;
      const head = line.match(/^(On (?:Melee )?Kill|On Headshot(?: Kill)?|On Weak Point (?:Hit|Kill)|On Ability Cast|When Aiming|While Aiming)\s*:\s*(.*)$/i);
      if (head) {
        const h = head[1].toLowerCase();
        cur = { when: /head|weak/.test(h) ? "hs" : /kill/.test(h) ? "kill" : /aim/.test(h) ? "aim" : "cast", eff: {} };
        cond.push(cur); line = head[2]; if (!line) continue;
      } else if (/^On |^While |^During |^At |^When /.test(line)) { cur = null; un.push(line); continue; }
      const st = line.match(/^(.*?)\s*Stacks up to (\d+)x$/i) || line.match(/^Stacks up to (\d+)x$/i);
      let mult = 1;
      if (st) { if (st.length === 3) { line = st[1]; mult = +st[2]; } else { if (cur) for (const k in cur.eff) if (typeof cur.eff[k] === "number") cur.eff[k] *= +st[1]; continue; } }
      line = line.replace(/\s+for \d+(\.\d+)?s[.,]?$/i, "").trim();
      const r = parseLine(line);
      if (!r) { un.push(line); continue; }
      for (const [k, v] of r) put(cur ? cur.eff : eff, k, typeof v === "number" ? v * mult : v);
    }
    return { eff, cond: cond.filter((c) => Object.keys(c.eff).length), un };
  }
  const CLASS_OF = { "Primary Mod": "rifle", "Shotgun Mod": "shotgun", "Secondary Mod": "pistol", "Melee Mod": "melee" };
  const COMPAT = { Rifle: {}, PRIMARY: {}, "Assault Rifle": { notTypes: ["Sniper", "Bow", "Launcher"] }, Sniper: { types: ["Sniper"] }, Bow: { types: ["Bow"] },
    Shotgun: {}, Pistol: {}, "Pistol (No Aoe)": {}, Melee: {}, "Thrown Melee": { req: "glaive" } };
  const SKIP_COMPAT = new Set(["Tome", "Unique", "Daggers", "Dual Daggers", "Polearms", "Thrown", "Warframe"]);
  root.WF_PARSE_MOD = parseModText;
  for (const e of root.WF_MODS_ALL || []) {
    const bow2 = (e.s || []).some((t) => /x2 for Bows/i.test(t));
    if (M.some((m) => m.en === e.en)) { const m = M.find((x) => x.en === e.en); if (e.kd) m.kd = e.kd; if (bow2) m.bow2 = true; continue; }
    const cls = CLASS_OF[e.t];
    if (!cls || SKIP_COMPAT.has(e.c)) continue;
    const filt = COMPAT[e.c] || { weapons: [e.c] };
    const p = parseModText(e.s);
    const id = e.en.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    // weapon augments (compat = a weapon name, e.g. Clip Delegation "Primary Mod" for the shotgun Sobek): the weapon filter decides
    M.push(Object.assign({ id, ko: e.ko, en: e.en, compat: filt.weapons ? ["rifle", "shotgun", "pistol", "melee"] : [cls], eff: p.eff, auto: true, unparsed: p.un, kd: e.kd, exilus: e.u ? true : undefined, bow2: bow2 || undefined,
      noCalc: !Object.keys(p.eff).length && !p.cond.length }, p.cond.length ? { cond: p.cond } : {}, filt));
  }
  // variants of the same mod (Primed / Amalgam / Galvanized / Flawed / Spectral / Sacrificial …) can't be equipped together
  const baseOf = (en) => en.replace(/^(Primed|Amalgam|Galvanized|Flawed|Sacrificial)\s+/i, "");
  const byBase = {};
  const NOT_VARIANT = new Set(["Primed Chamber"]);   // name looks like a variant but isn't
  for (const m of M) { if (NOT_VARIANT.has(m.en)) continue; const k = m.compat[0] + ":" + baseOf(m.en).toLowerCase(); (byBase[k] = byBase[k] || []).push(m); }
  for (const k in byBase) {
    const g = byBase[k]; if (g.length < 2) continue;
    const grp = (g.find((m) => m.group) || {}).group || "v_" + k.replace(/[^a-z0-9]+/g, "_");
    for (const m of g) if (!m.group) m.group = grp;
  }

  // remaining exilus mods from the game data (projectile speed, recoil, zoom, holster reload …): no effect on the numbers here
  for (const e of root.WF_EXILUS_EXTRA || []) {
    if (M.some((m) => m.en === e.en)) continue;
    const id = e.en.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    M.push({ id, ko: e.ko, en: e.en, compat: [e.compat], eff: {}, exilus: true, types: e.types, notTypes: e.notTypes, noCalc: true, req: e.en === "Whirlwind" ? "glaive" : undefined });
  }
  // set mods with a weapon set bonus (wiki "Set Mods"): Vigilante (primary, 5% chance per set mod to raise a crit by one tier)
  // and Gladiator (melee, +10% crit chance per combo multiplier per set mod, Blood Rush bucket). Warframe-side pieces are an option.
  const SETS = { "Vigilante Armaments": "vigilante", "Vigilante Fervor": "vigilante", "Vigilante Offense": "vigilante", "Vigilante Supplies": "vigilante",
    "Gladiator Might": "gladiator", "Gladiator Rush": "gladiator", "Gladiator Vice": "gladiator" };
  for (const m of M) if (SETS[m.en]) {
    m.set = SETS[m.en];
    m.note = (m.note ? m.note + " · " : "") + (m.set === "vigilante" ? "비질란테 세트: 1개당 치명타 단계 상승 확률 +5%" : "글래디에이터 세트: 1개당 연속기 배율마다 치명타 확률 +10%");
    if (m.auto && m.noCalc) { m.noCalc = false; m.unparsed = []; }      // worth a slot for the set bonus alone
  }
  // capacity drain at max rank and polarity (game data); riven: 18 at rank 8, polarity treated as matching any slot
  const DR = {}; for (const e of root.WF_MODS_ALL || []) if (e.d != null && !(e.en in DR)) DR[e.en] = [e.d, e.p];
  for (const m of M) if (DR[m.en]) { m.drain = DR[m.en][0]; m.pol = DR[m.en][1]; }
  const KO = root.WF_KO || {};
  for (const x of M) if (KO[x.en]) x.ko = KO[x.en];
  root.WF_MODS = M;
  for (const k in ARC) {
    const en = ARC[k].en || k.replace(/1$/, "").split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
    ARC[k].en = en;
    if (KO[en]) ARC[k].ko = KO[en];
  }
  for (const k in root.WF_FRAME_ARCANES) { const A = root.WF_FRAME_ARCANES[k]; if (KO[A.en]) A.ko = KO[A.en]; }
  // every other arcane a warframe can equip: selectable, shown with its in-game text, no weapon-damage effect
  for (const a of root.WF_FRAME_ARC_ALL || []) {
    const hit = Object.values(root.WF_FRAME_ARCANES).find((A) => A.en === a.en);
    if (hit) { hit.kd = a.kd; continue; }
    const id = a.en.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    root.WF_FRAME_ARCANES[id] = { ko: a.ko, en: a.en, kind: "none", kd: a.kd, note: "무기 피해·어빌리티 수치에 영향 없음" };
  }
  root.WF_ARCANES = ARC;
  /* riven base values before disposition (now 1.2 for every weapon, Hotfix 44.1.3) and the stat-count multiplier.
   * wikiwiki "Riven Mod" stat tables (2026-10). Damage-relevant stats only; the rest live in app.js RIV_OTHER. */
  root.WF_RIVEN = {
    rifle: { dmg: 1.65, ms: 0.9, cc: 1.4999, cd: 1.19997, heat: 0.9, cold: 0.9, elec: 0.9, tox: 0.9, impact: 1.1997, punct: 1.1997, slash: 1.1997, sc: 0.9, sd: 0.9, dur: 0.9999, fr: 0.6003, reload: 0.49995, mag: 0.49995 },
    shotgun: { dmg: 1.647, ms: 1.197, cc: 0.9, cd: 0.9, heat: 0.9, cold: 0.9, elec: 0.9, tox: 0.9, impact: 1.1997, punct: 1.1997, slash: 1.1997, sc: 0.9, sd: 0.9, dur: 0.9999, fr: 0.9, reload: 0.49995, mag: 0.49995 },
    pistol: { dmg: 2.196, ms: 1.197, cc: 1.4999, cd: 0.9, heat: 0.9, cold: 0.9, elec: 0.9, tox: 0.9, impact: 1.1997, punct: 1.1997, slash: 1.1997, sc: 0.9, sd: 0.9, dur: 0.9999, fr: 0.747, reload: 0.49995, mag: 0.49995 },
    melee: { dmg: 1.647, cc: 1.8, cd: 0.9, heat: 0.9, cold: 0.9, elec: 0.9, tox: 0.9, impact: 1.197, punct: 1.197, slash: 1.197, sc: 0.9, sd: 0.9, dur: 0.9999, fr: 0.549, ic: 24.5 },
  };
})(typeof self !== "undefined" ? self : globalThis);
