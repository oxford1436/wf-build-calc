from model import CHUNK, FURY, NOUR
R = 1972.1 / (2.1 * 3.7)      # zaw raw base (arsenal: per hit 1972.1 = R*(1+1.1 Sacrificial Pressure)*(1+0.9 elec+1.8 gas))
def exodia(B, els, cc, cd, fac=1.0, phase1=False, rng=4.0):
    # Vex Armor applies twice to the Exodia projectile: additive to melee damage and once more multiplicatively
    # (wiki Vex Armor: 'once multiplicatively on Exodia Contagion'; wiki Exodia Contagion Interactions)
    eff = (1 + B + FURY) * (1 + FURY)
    crit = 1 + cc * (cd - 1)
    k = R * eff * rng * crit * fac
    per = {'impact': 2/3 * k, 'puncture': 2/3 * k, 'slash': 2/3 * k, 'blast': 4 * k}   # direct 2x split IPS, DoT 1x*4 ticks blast
    els = dict(els); els['viral'] = els.get('viral', 0) + NOUR
    for t, w in els.items():
        per[t] = per.get(t, 0) + (2 + 4) * w * k
    if phase1:
        per['viral'] = per.get('viral', 0) + 5 * k
        for t, w in els.items(): per[t] += 5 * w * k
    return {t: round(CHUNK / v, 2) for t, v in sorted(per.items(), key=lambda x: -x[1])}
if __name__ == '__main__':
    cur = {'electricity': 0.9, 'gas': 1.8, 'corrosive': 2.4}
    print('now', exodia(1.1, cur, 1.08, 6.6))
    print('Fury->Magnetic Rush, Sacrificial Pressure->Focus Radon', exodia(0.0, dict(cur, magnetic=0.6, radiation=0.6), 1.08, 6.6))
