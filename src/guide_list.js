/* Every warframe in the warframe tab, grouped by main role (one role each; many frames do several things —
 * the guide summary decides the main one). Primes share the base entry. */
(function (root) {
  const R = [
    ["nuke", "어빌리티 섬멸", "어빌리티로 광역을 직접 쓸어 담음",
      "saryn:새린 garuda:가루다 gauss:가우스 gyre:자이어 hildryn:힐드린 jade:제이드 mag:매그 narin:나린 nezha:나타 nokko:놋코 qorvex:코르벡스 sevagoth:세바고스 sirius_orion:시리우스 & 오리온 styanax:스티아낙스 uriel:우리엘 caliban:칼리반 follie:폴리 dante:단테 koumei:코우메이 khora:코라 gara:가라 xaku:자쿠 dagath:다가스 temple:템플 equinox:이쿼녹스"],
    ["melee", "전용 무기·근접", "익절티드 무기나 근접 공격이 주력",
      "atlas:아틀라스 baruuk:바루크 excalibur:엑스칼리버 excalibur_umbra:엑스칼리버 움브라 valkyr:발키르 titania:티타니아 mesa:메사 kullervo:쿨레르보 voruna:보루나 wukong:오공"],
    ["weapon", "무기 버퍼·거치대", "무기 화력을 키워 줌",
      "banshee:밴쉬 chroma:크로마 cyte09:Cyte-09 harrow:해로우 mirage:미라지 rhino:라이노 volt:볼트 yareli:야렐리 octavia:옥타비아 hydroid:하이드로이드 ember:엠버"],
    ["tank", "탱커", "체력·방어력·무적으로 버팀", "inaros:이나로스 nidus:나이더스 grendel:그렌델 revenant:레버넌트 oraxia:오락시아 lavos:라보스"],
    ["control", "컨트롤·방어", "적을 묶고 거점을 지킴", "limbo:림보 vauban:바우반 zephyr:제피르 frost:프로스트 nova:노바 nyx:닉스 protea:프로티아"],
    ["support", "서포트", "회복·피해 감소·팀 버프", "trinity:트리니티 wisp:위습 oberon:오베론 citrine:시트린"],
    ["stealth", "은신·파밍", "투명·잠입·추가 드롭", "ash:애쉬 loki:로키 ivara:이바라 nekros:네크로스"],
  ];
  root.WF_GUIDE_ROLES = R.map(([id, ko, desc]) => ({ id, ko, desc }));
  root.WF_GUIDE_LIST = R.flatMap(([role, , , xs]) => xs.split(/ (?=[a-z0-9_]+:)/).map((x) => { const [id, ko] = x.split(":"); return { id, ko, role }; }));
})(typeof window !== "undefined" ? window : globalThis);
