const r = require(process.argv[2])[0]; if (!r) { console.log("no result"); process.exit(); }
if (r.err) { console.log(JSON.stringify(r).slice(0, 600)); process.exit(); }
console.log(r.sec + "s", r.weapon, "|", r.attack, "| pellets", r.pellets, "fo", JSON.stringify(r.fo), "| evo", r.evoNames.join(" "));
console.log("o:", JSON.stringify(r.o).slice(0, 700));
const pr = (t, x) => { if (!x) return; console.log(t, x.score.toFixed(4), "|", x.mods.join(", "), "| arc:", x.arcane, "| val:", JSON.stringify(x.val)); console.log("   cc", (+x.cc).toFixed(2), "cd", (+x.cd).toFixed(2), "ms", (+x.ms).toFixed(2), "rate", (+x.rate).toFixed(2), "sc", (+x.sc).toFixed(2), "layout", JSON.stringify(x.layout)); console.log("   perF", JSON.stringify(x.pf)); };
pr("BASE", r.base); pr("RIV ", r.riv);
if (r.riv) console.log("   riven:", r.riv.riven.map((i) => i.k + ":" + (+i.v).toFixed(3)).join("  "), "| eff", JSON.stringify(r.riv.eff));
console.log("alts:"); for (const a of r.alts || []) console.log("  ", a.score.toFixed(4), a.info, "|", a.mods.join(", "), "|", a.arcane);
console.log("plan:", (r.planTop || []).join(" ; ").slice(0, 900)); console.log("errs", JSON.stringify(r.errs));
