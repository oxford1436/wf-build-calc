const CYTE = { frame: "cyte_09", helminth: "Nourish", strength: "298", duration: "226", range: "34", efficiency: "45", energy: "655", armor: "150", health: "325", shield: "235", sprint: "1.1",
  aura: "growing_power", fa0: "아케인 라이즈", fa1: "아케인 스컬프터", sh0: "a_cast", tau0: true, sh1: "v_elec", tau1: true, sh2: "v_elec", tau2: true };
const W = {
  tonkor: { w: "kuva_tonkor", f: { rivmode: "none", valtype: "auto", valpct: "60" } },
  tonkor_riv: { w: "kuva_tonkor", f: { rivmode: "plan", valtype: "auto", valpct: "60" } },
  zarr: { w: "kuva_zarr", f: { rivmode: "owned", rk0: "cd", rv0: "143", ri0: true, rk1: "ms", rv1: "102.1", ri1: true, rk2: "cc", rv2: "181.9", ri2: true, rk3: "dur", rv3: "84.5", ri3: true, valtype: "tox", valpct: "37" } },
  ogris: { w: "kuva_ogris", f: { rivmode: "owned", rk0: "dmg", rv0: "200.4", ri0: true, rk1: "ms", rv1: "109.6", ri1: true, rk2: "fac_i", rv2: "1.56", ri2: true, rk3: "reload", rv3: "42.5", ri3: true, valtype: "heat", valpct: "28.7" } },
};
module.exports = { CYTE, W };
