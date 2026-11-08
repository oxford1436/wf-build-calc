# Profit-Taker shield phase: per-element damage per second (only the weak element counts; wiki Profit-Taker Orb)
import itertools, json
CHUNK = 162645        # 1/5 of shield at default level 60 (wiki note)
STR = 2.98            # Chroma Prime strength (earlier session record)
FURY = 2.75 * STR     # Vex Armor Fury max, additive to base damage (wiki Vex Armor)
NOUR = 0.45 * STR     # subsumed Nourish viral, additive like an element mod (wiki Nourish)
RB_FR = 0.6           # Reinforced Bond (arsenal: Detron fire rate 7.33 = 3.33*(1+.6+.6))
TB_CD = 1.2           # Tenacious Bond flat (arsenal: Detron CD 5.4 = 2*(1+1.1)+1.2)
T = ['impact','puncture','slash','heat','cold','electricity','toxin','blast','corrosive','gas','magnetic','radiation','viral']

def sustained(fr, mag, reload, ammo_cost=1):
    shots = mag / ammo_cost
    return shots / (shots / fr + reload)

# ---------- current Tenet Detron (arsenal red column = without the +165% swap buff) ----------
def detron():
    B = 2.2 + 0.9            # Hornet Strike 220% + Augur Pact 90% (arsenal 26*4.1=106.6)
    k = (1 + B + FURY) / (1 + B)
    per = {'cold': 139.8 * k, 'radiation': 106.6 * k, 'magnetic': 48.7 * k}
    per['viral'] = 26 * 1.457 * (1 + B + FURY) * NOUR
    ms, cc, cd, fac = 27, 0.396, 5.4, 1.55
    rate = sustained(7.33, 6, 0.8)
    return {t: v * ms * (1 + cc * (cd - 1)) * fac * rate for t, v in per.items()}, rate

# ---------- Tenet Diplos ----------
PIS = {'impact': 11.2, 'puncture': 9.0, 'slash': 7.8}
MODS = {  # pistol mods at max rank (wiki/game data); el = (type, value)
 'gd':  {'ms': 1.1},                         # Galvanized Diffusion (no kill stacks vs boss)
 'lt':  {'ms': 0.6, 'fr': 0.6},              # Lethal Torrent
 'pg':  {'cc': 1.2},                         # Pistol Gambit (owned)
 'ppg': {'cc': 1.87},                        # Primed Pistol Gambit
 'ptc': {'cd': 1.1},                         # Primed Target Cracker
 'pec': {'fac': 0.55},                       # Primed Expel Corpus
 'hs':  {'dmg': 2.2},                        # Hornet Strike
 'ap':  {'dmg': 0.9},                        # Augur Pact
 'df':  {'el': ('cold', 0.9)},               # Deep Freeze
 'cb':  {'cc': 2.0, 'fr': -0.2},             # Creeping Bullseye
 'aa':  {'fr': 0.9, 'dmg': -0.15},           # Anemic Agility
}
RIV = {'cc': 1.4999, 'cd': 0.9, 'ms': 1.197, 'dmg': 2.196, 'fr': 0.747, 'fac': 0.45, 'el': 0.9}  # pistol riven bases
def rivval(k, form=0.9375):
    return RIV[k] * 1.2 * form * 1.1

def diplos(mods, riv, val=('radiation', 0.6), rivel=None):
    s = {'ms': 0, 'fr': RB_FR, 'cc': 0, 'cd': 0, 'fac': 0, 'dmg': 0}
    els = []
    for m in mods:
        for k, v in MODS[m].items():
            if k == 'el': els.append(v)
            else: s[k] += v
    for k in riv:
        if k == 'el': els.append((rivel, rivval('el')))
        else: s[k] += rivval(k)
    B = s['dmg']
    base = 28.0
    tot = base * (1 + val[1])
    eff = (1 + B + FURY)
    per = {t: v * eff for t, v in PIS.items()}
    per[val[0]] = per.get(val[0], 0) + base * val[1] * eff
    # element mods combine in slot order (wiki Damage): pair consecutive different singles
    singles = []
    comb = {('heat','cold'):'blast',('cold','toxin'):'viral',('heat','toxin'):'gas',('electricity','toxin'):'corrosive',('heat','electricity'):'radiation',('cold','electricity'):'magnetic'}
    pool = {}
    for t, v in els:
        pool[t] = pool.get(t, 0) + v
    order = []
    for t, v in els:
        if t not in order: order.append(t)
    out = {}
    i = 0
    while i < len(order):
        if i + 1 < len(order):
            a, b = order[i], order[i+1]
            key = tuple(sorted([a, b], key=lambda x: ['heat','cold','electricity','toxin'].index(x)))
            out[comb[key]] = pool[a] + pool[b]; i += 2
        else:
            out[order[i]] = pool[order[i]]; i += 1
    for t, v in out.items():
        per[t] = per.get(t, 0) + tot * v * eff
    per['viral'] = per.get('viral', 0) + tot * NOUR * eff
    ms = 1 + s['ms']
    cc = 0.36 * (1 + s['cc'])
    cd = 2.2 * (1 + s['cd']) + TB_CD
    fac = 1 + s['fac']
    fr = 9.67 * (1 + s['fr'])
    rate = sustained(fr, 92, 2.8)
    return {t: v * ms * (1 + cc * (cd - 1)) * fac * rate for t, v in per.items()}, dict(cc=cc, cd=cd, ms=ms, fr=fr, rate=rate, fac=fac)

def ttk(d):
    return {t: round(CHUNK / v, 2) for t, v in sorted(d.items(), key=lambda x: -x[1])}

if __name__ == '__main__':
    d, r = detron()
    print('DETRON sustained shots/s', round(r, 2)); print(' chunk s', ttk(d))
    base_mods = ['gd', 'lt', 'cb', 'ptc', 'pec', 'df', 'hs']   # Creeping Bullseye is incompatible with Pistol Gambit (wiki)
    for riv in [('cc','cd','ms'), ('cc','cd','fac'), ('cd','ms','fac'), ('cc','ms','fac'), ('cc','cd','dmg'), ('cc','cd','fr')]:
        p, st = diplos(base_mods, riv)
        print('DIPLOS riv', riv, {k: round(v, 2) for k, v in st.items()}); print(' chunk s', ttk(p))
