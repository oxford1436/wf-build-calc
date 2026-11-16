// Overframe Arquebex builds (read 2026-11-17 from each build page's data: slots = slot_id:modId; mod ids resolved through
// overframe.gg/items/arsenal/<id>/ titles). Overframe slot_id 8,7,6,5 = top row left→right, 4,3,2,1 = bottom row (checked
// against lotodrandel's guide text "top row: Electrified Barrel, Venomous Clip, Charged Bullets, Hollowed Bullets" = slots 8..5,
// and cheesetastegood's title "Viral/heat" = slots 3,2,1 Toxin, Cold, Heat).
const N = { 275: "Magma Chamber", 277: "Magazine Extension", 278: "Parallax Scope", 279: "Hollowed Bullets", 281: "Dual Rounds", 282: "Automatic Trigger",
  284: "Electrified Barrel", 285: "Combustion Rounds", 286: "Polar Magazine", 287: "Venomous Clip", 1447: "Hypothermic Shell", 1448: "Charged Bullets",
  1449: "Contamination Casing", 1452: "Sabot Rounds", 2381: "Quick Reload", 4632: "Primed Rubedo-Lined Barrel", 6763: "Primed Dual Rounds", 7185: "Magnetized Cycle",
  7661: "Primed Venomous Clip", 8016: "Primed Combustion Rounds" };
const EL = { "Electrified Barrel": "elec", "Charged Bullets": "elec", "Combustion Rounds": "heat", "Primed Combustion Rounds": "heat", "Magma Chamber": "heat",
  "Polar Magazine": "cold", "Hypothermic Shell": "cold", "Venomous Clip": "tox", "Primed Venomous Clip": "tox", "Contamination Casing": "tox" };
const CB = { "heat|cold": "blast", "heat|elec": "rad", "heat|tox": "gas", "cold|elec": "mag", "cold|tox": "viral", "elec|tox": "corr" };
const comb = (a, b) => CB[a + "|" + b] || CB[b + "|" + a];
const R = [
  ["76116", "Arquebex: Deimos Destroyer", "Solcarius", 535, "2020-09-16", 2, "1:284 2:287 3:286 4:285 5:278 6:279 7:281 8:4632"],
  ["76939", "The Last Judgment for Everyday Use | Config A", "THeMooN85", 530, "2020-11-22", 4, "1:4632 2:282 3:285 4:279 5:287 6:286 7:281 8:278"],
  ["435440", "Arquebex: Maximum Possible damage/dps (Viral/heat)", "cheesetastegood", 277, "2026-09-09", 4, "1:8016 2:1447 3:7661 4:6763 5:279 6:282 7:278 8:4632"],
  ["78110", "The Last Judgment for Eidolons Hunt | Config B", "THeMooN85", 276, "2020-11-22", 4, "1:4632 2:282 3:285 4:279 5:278 6:284 7:281 8:1452"],
  ["78116", "The Last Judgment for Isolation Vaults | Config C", "THeMooN85", 169, "2020-11-22", 4, "1:4632 2:282 3:285 4:279 5:287 6:284 7:281 8:278"],
  ["308008", "The Optimal Arquebex- Orphix, Eidolon, Profit Taker, General", "Michael5623", 112, "2022-06-23", 3, "1:286 2:284 3:285 4:282 5:279 6:278 7:281 8:4632"],
  ["113739", "Arquebex: Orphix", "The-Simulacrum-Warriors", 101, "2021-10-08", 3, "1:285 2:284 3:287 4:282 5:279 6:278 7:281 8:4632"],
  ["758750", "Critical Destruction vs Factions", "lotodrandel", 76, "2026-10-24", 3, "1:278 2:282 3:6763 4:4632 5:279 6:1448 7:287 8:284"],
  ["75425", "Arquebex: General Use", "The-Simulacrum-Warriors", 48, "2021-10-08", 3, "1:285 2:1447 3:1449 4:282 5:279 6:278 7:281 8:4632"],
  ["273327", "ARQUEBEX Build (1 million per shot)", "WetArgonCrystal", 28, "2022-09-16", 1, "1:277 2:2381 3:4632 4:281 5:278 6:287 7:286 8:279"],
  ["332694", "Profit Taker Arquebex | Toxin Element", "xHappy-", 14, "2023-12-29", 3, "1:287 2:284 3:285 4:282 5:281 6:279 7:278 8:4632"],
  ["821343", "Wet For Entrati : Viral & Heat / Magnetic", "ImCalledBethy", 11, "2026-09-19", 2, "1:278 2:7185 3:4632 4:6763 5:275 6:279 7:7661 8:1447"],
  ["929924", "RAINOLLON'S ARQUEBEX BUILD", "Rainollon", 8, "2026-01-10", 2, "1:275 2:278 3:282 4:4632 5:1447 6:1449 7:279 8:6763"],
  ["830990", "Arquebex godlike vs any faction", "Didjynn", 4, "2025-06-20", 4, "1:285 2:287 3:4632 4:284 5:278 6:279 7:6763 8:282"],
  ["233688", "Arquebex | Config A – General Usage", "Aekrios", 4, "2021-10-17", 3, "1:285 2:1447 3:1449 4:282 5:278 6:279 7:281 8:4632"],
  ["113737", "General-purpose Arquebex", "Arsonistic", 3, "2021-04-13", 3, "1:285 2:287 3:284 4:282 5:279 6:278 7:281 8:4632"],
  ["445238", "Corrosive-Heat-Sentry", "M1LT1R", 5, "2023-05-03", 3, "1:285 2:287 3:284 4:282 5:281 6:278 7:279 8:4632"],
];
const builds = R.map(([id, t, au, votes, upd, forma, s]) => {
  const bySlot = Object.fromEntries(s.split(" ").map((x) => x.split(":")).map(([a, b]) => [+a, N[+b] || b]));
  const mods = [8, 7, 6, 5, 4, 3, 2, 1].map((k) => bySlot[k]);        // in-game order (top-left → bottom-right)
  const seq = []; for (const m of mods) if (EL[m] && !seq.includes(EL[m])) seq.push(EL[m]);
  const out = []; const used = new Set();
  for (let i = 0; i + 1 < seq.length; i += 2) { out.push(comb(seq[i], seq[i + 1])); used.add(seq[i]); used.add(seq[i + 1]); }
  if (seq.length % 2) out.push(seq[seq.length - 1]);
  if (!seq.includes("heat")) out.push("heat(내장)");
  out.push("blast(내장)");
  return { name: t, community: "Overframe " + au + " (" + votes + " votes)", url: "https://overframe.gg/build/" + id + "/", kind: "read", date: upd, forma, mods, elements: out.join(" + ") };
});
const tally = {}; for (const b of builds) for (const m of b.mods) tally[m] = (tally[m] || 0) + 1;
const el = {}; for (const b of builds) el[b.elements] = (el[b.elements] || 0) + 1;
const doc = { weapon: "arquebex", notes: "2026-11-17 알퀘벡스 질문. Overframe 무기 페이지 1쪽(투표순 25개) 중 17개 빌드의 모드 8칸을 페이지 데이터로 직접 읽음. 아카라이브 검색은 사이트 오류로 못 읽음, 레딧 글은 못 찾음. 알퀘벡스는 계산기 무기 목록에 없어(convert.py EX_SKIP) 이 폴더의 arq.js가 계산기 엔진에 무기·아크건 모드를 직접 넣어 계산.", tally, elements: el, builds };
require("fs").writeFileSync(__dirname + "/builds.json", JSON.stringify(doc, null, 1));
console.log(JSON.stringify(tally)); console.log(JSON.stringify(el, null, 1));
