/* Every warframe for the guide tab, in the order they are researched (batch 1 = pilot). Primes share the base entry. */
(function (root) {
  const B = [
    [1, "nova:노바", "hildryn:힐드린", "saryn:새린"],
    [2, "octavia:옥타비아", "wisp:위습", "mesa:메사", "khora:코라", "gyre:자이어", "kullervo:쿨레르보", "protea:프로티아", "volt:볼트", "mirage:미라지", "trinity:트리니티"],
    [3, "narin:나린", "sirius_orion:시리우스 & 오리온", "follie:폴리", "uriel:우리엘", "nokko:노코", "oraxia:오락시아", "temple:템플", "cyte09:사이트-09", "koumei:코우메이", "jade:제이드", "dante:단테"],
    [4, "qorvex:코벡스", "dagath:다가스", "citrine:시트린", "voruna:보루나", "styanax:스티아낙스", "caliban:칼리반", "yareli:야렐리", "sevagoth:세바고스", "lavos:라보스", "xaku:자쿠", "gauss:가우스"],
    [5, "grendel:그렌델", "garuda:가루다", "baruuk:바루크", "revenant:레버넌트", "excalibur_umbra:엑스칼리버 엄브라", "harrow:해로우", "gara:가라", "nidus:니더스", "titania:티타니아", "inaros:이나로스", "nezha:네자"],
    [6, "ivara:이바라", "wukong:우콩", "atlas:아틀라스", "equinox:이퀴녹스", "chroma:크로마", "limbo:림보", "hydroid:하이드로이드", "zephyr:제퍼", "oberon:오베론", "valkyr:발키르", "nekros:네크로스"],
    [7, "vauban:보반", "banshee:밴시", "nyx:닉스", "frost:프로스트", "excalibur:엑스칼리버", "ash:애쉬", "ember:엠버", "loki:로키", "mag:맥", "rhino:라이노"],
  ];
  root.WF_GUIDE_LIST = B.flatMap(([batch, ...xs]) => xs.map((x) => { const [id, ko] = x.split(":"); return { id, ko, batch }; }));
})(typeof window !== "undefined" ? window : globalThis);
