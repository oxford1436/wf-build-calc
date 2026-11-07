const RV = require("./kg_riven.js"); const R2 = require("./run2.js"); const K = require("./kuva_grattler.js"); const { MODS } = require("./opt.js");
const sK = [["prb", "pdr", "mc", "at", "hb", "ppm", "peb", "pcr"], ["prb", "pdr", "mc", "at", "ps", "hb", "ppm", "peb"], ["prb", "pdr", "mc", "at", "hb", "qr", "ppm", "peb"]];
const sM = [["pdr", "mc", "hb", "ppm", "at", "peb", "pcr", "prb"], ["prb", "pdr", "mc", "at", "ps", "hb", "ppm", "peb"]];
const mo = { overMs: 1.575, deFrac: 0, mReload: 5.5 }, ko = { overMs: 1.575, deFrac: 0, reload: 4 };
const m = RV.rivenSearch("maus", sM, mo, 6)[0], k = RV.rivenSearch("kg", sK, ko, 6)[0];
console.log("both riven, both regen: KG/M", (100 * k.s / (m.s * 2 / 3)).toFixed(1) + "%", m.best.ids.join(","), "|", k.best.ids.join(","));
delete MODS.riv; delete MODS.riv2;
const mn = R2.search(mo, ["prb", "sabot", "pdr", "cb", "mc", "at", "ps", "hb", "ppm", "peb", "pcr", "pvc", "hs", "cbul", "mag", "cc_", "qd", "cbl", "pde", "me", "qr"], 1)[0];
console.log("KG+riv / Maus no riv (both regen)", (100 * k.s / (mn.r.s * 2 / 3)).toFixed(1) + "%", "| Maus no-riv build", mn.ids.join(","));
