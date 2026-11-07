const { evalBuild } = require("./opt.js");
// user's arsenal build (screenshot): Primed Dual Rounds, Magnetized Cycle, Containment Breach, Polar Magazine, Automatic Trigger, Electrified Barrel, Parallax Scope, Primed Rubedo
const u = ["pdr", "mc", "cb", "pm", "at", "eb", "ps", "prb"];
const r = evalBuild(u, { enervate: false, cdFlat: 1.2 });
const per = {}; for (const k in r.tH) per[k] = +(r.tH[k] * r.dmg).toFixed(1);
console.log("per pellet", per, "sum", Object.values(per).reduce((a, b) => a + b, 0).toFixed(1), "x ms", r.ms, "=", (Object.values(per).reduce((a, b) => a + b, 0) * r.ms).toFixed(1));
console.log("cc", r.ccBase, "cd", r.cd, "rate", r.rate.toFixed(2), "mag", r.mag);
const ex = {}; for (const k in r.tX) ex[k] = +(r.tX[k] * r.dmg).toFixed(1); console.log("explosion", ex);
