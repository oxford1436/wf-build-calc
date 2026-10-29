/* Built-in weapons verified in this project (used when the full dataset is not loaded). */
(function (root) {
  root.WF_WEAPONS_BUILTIN = [
    {
      id: "coda_pathocyst", ko: "코다 패소시스트", en: "Coda Pathocyst", slot: "melee", cls: "melee", sub: "glaive", valence: true,
      attacks: [
        { name: "충전 투척 회수 폭발", kind: "glaive", dmg: { viral: 1620 }, cc: 0.24, cd: 2.5, sc: 0.38, windup: 1.192, radius: 4.9, forced: ["viral"], noCO: true },
      ],
    },
    {
      id: "coda_bassocyst", ko: "코다 바소시스트", en: "Coda Bassocyst", slot: "primary", cls: "shotgun", valence: true, mercyBuff: true,
      attacks: [
        { name: "주사격 (음파, 몸통 무한 관통)", kind: "gun", dmg: { blast: 789, rad: 19 }, cc: 0.18, cd: 2.2, sc: 0.40, fr: 1.17, mag: 24, reload: 2.5, punch: true, semi: true },
      ],
    },
    {
      id: "xoris", ko: "조리스", en: "Xoris", slot: "melee", cls: "melee", sub: "glaive",
      attacks: [
        { name: "충전 투척 폭발", kind: "glaive", dmg: { elec: 1000 }, cc: 0.22, cd: 2.4, sc: 0.20, windup: 1.0, radius: 9.0, forced: ["elec"], noCO: true },
      ],
    },
  ];
})(typeof self !== "undefined" ? self : globalThis);
