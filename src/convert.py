import json, re, os
import sys
A = (sys.argv[1].rstrip("/") + "/") if len(sys.argv) > 1 else "/mnt/user-data/attachments/42cc711f-2e9b-52c3-b42e-347c041704d5/"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.abspath(__file__))
P = json.load(open(A + "Primary.json"))
S = json.load(open(A + "Secondary.json"))
ME = json.load(open(A + "Melee.json"))
MODS = [m for m in json.load(open(A + "Mods.json")) if "/PvPMods/" not in m.get("uniqueName", "")]   # Conclave-only mods can't be used in missions
ARCS = json.load(open(A + "Arcanes.json"))
KO = json.load(open(A + "ko.json", encoding="utf-8")) if os.path.exists(A + "ko.json") else {}
# wiki weapon data (ammo / projectile speed) — optional
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
WIKI = {}
try:
    import wiki_lua
    for s_ in ("primary", "secondary", "melee"):
        f_ = A + "wiki_" + s_ + ".lua"
        if os.path.exists(f_) and os.path.getsize(f_) > 1000:
            WIKI.update(wiki_lua.parse(open(f_, encoding="utf-8").read()))
except Exception as e:  # keep building without it
    print("wiki data skipped:", e)


# fire rate falling while the trigger is held (wiki weapon pages): [shots, fire rate reached]. Phenmor Incarnon Form: 100% → 60%
# over 51 shots, reset when the trigger is released.
SPOOL_DOWN = {"Phenmor": {"Incarnon Form": [51, 0.6]}}
# radial attacks that the wiki says get no multishot bonus (one explosion per trigger pull)
NO_MS_RADIAL = {"Burston Prime": ("Incarnon Form Radial Attack",)}
# chaining / ricocheting shots (wiki Incarnon Genesis notes, verbatim in data/raw/incarnon_evos.json): from every enemy the
# shot hits directly, n more hits on nearby enemies, the j-th at f^j of the hit's damage, each with chance p.
#  Torid: "chaining to up to 5 nearby enemies within 7 meters of each other, with each chain doing 75% of the previous chain's
#    damage", "a 2.3 meter damage radius from the point of impact" that "CAN be benefit from Firestorm", and "Punch Through
#    mods have no effect on the behavior of the beam"
#  Boar: "each beam chaining up to 2 nearby enemies within 10 meters … with each chain doing 80% of the previous one's damage"
#    (the 3 auto-aimed beams are left out: how many enemies sit within 10° of the reticle isn't modelled)
#  Dual Toxocyst: "ricochet to 1 nearby enemy per shot within 5 meters"; Lato: "ricochet to 1 nearby enemy within 10 meters
#    (12 meters for the prime)"; Sicarus: "ricochet to 1 nearby enemy within 6 meters"; Bronco: "Individual pellets now ricochet
#    once …", "only has a 50% chance to Ricochet"; Angstrum: "ricochet toward 1 enemy within 20 meters" ("can miss" — no number
#    given, counted as a hit). The ricochet's own damage isn't stated: the full hit is used.
CHAIN = {
    "Torid": {"Incarnon Form": {"n": 5, "f": 0.75, "p": 1, "r": 7, "radius": 2.3, "ptNone": True}},
    "Boar": {"Incarnon Form": {"n": 2, "f": 0.8, "p": 1, "r": 10}}, "Boar Prime": {"Incarnon Form": {"n": 2, "f": 0.8, "p": 1, "r": 10}},
    "Dual Toxocyst": {"Incarnon Form": {"n": 1, "f": 1, "p": 1, "r": 5}},
    "Lato": {"Incarnon Form": {"n": 1, "f": 1, "p": 1, "r": 10}}, "Lato Vandal": {"Incarnon Form": {"n": 1, "f": 1, "p": 1, "r": 10}},
    "Lato Prime": {"Incarnon Form": {"n": 1, "f": 1, "p": 1, "r": 12}},
    "Sicarus": {"Incarnon Form": {"n": 1, "f": 1, "p": 1, "r": 6}}, "Sicarus Prime": {"Incarnon Form": {"n": 1, "f": 1, "p": 1, "r": 6}},
    "Bronco": {"Incarnon Form": {"n": 1, "f": 1, "p": 0.5, "r": 6}}, "Bronco Prime": {"Incarnon Form": {"n": 1, "f": 1, "p": 0.5, "r": 8}},
    "Angstrum": {"Incarnon Form": {"n": 1, "f": 1, "p": 1, "r": 20}}, "Prisma Angstrum": {"Incarnon Form": {"n": 1, "f": 1, "p": 1, "r": 20}},
    # non-Incarnon chain beams (wiki weapon pages, docs/community/chain_beams.md). "flat": every jump at f of the main beam.
    #  Amprex "100% for the main target, 50% for the first in the chain, 25% for the 2nd, and 12.5% for the 3rd"
    "Amprex": {"Normal Attack": {"n": 3, "f": 0.5, "p": 1, "r": 10}},
    #  Atomos "100% … 75% … 56.25% … 42.1875%", "within 7 meters of the initial target"
    "Atomos": {"Normal Attack": {"n": 3, "f": 0.75, "p": 1, "r": 7}},
    #  Kuva Nukor: 2 chains "within 9 meters", "Each chain beam does 50% of the main beam's damage"
    "Kuva Nukor": {"Normal Attack": {"n": 2, "f": 0.5, "p": 1, "r": 9, "flat": True}},
    #  Tenet Cycron: 2 chains within 7 m, "Each chain beam does 60% of the main beam's damage"
    "Tenet Cycron": {"Normal Attack": {"n": 3 - 1, "f": 0.6, "p": 1, "r": 7, "flat": True}},
    #  Tenet Glaxion: 3 chains "within 8 meters from each other", "50% of the previous chain's damage"
    "Tenet Glaxion": {"Normal Attack": {"n": 3, "f": 0.5, "p": 1, "r": 8}},
    #  Basmu alt fire: "Each beam can chain up to 5 nearby enemies within 7 meters", "0.5^n times the main beam's damage"
    "Basmu": {"Held": {"n": 5, "f": 0.5, "p": 1, "r": 7}},
}
# on-kill damage fields (wiki Incarnon notes): Dual Ichor "Kills create a Toxin Damage field", "Fields do 350 Toxin damage
# (increased to 440 by EVO2 — both EVO II perks add +90) and last for 7 seconds", "4m range". Tick interval not stated -> every: None
KILL_FIELD = {"Dual Ichor": {"dmg": 440, "dur": 7, "r": 4, "every": None}}
# wiki Incarnon notes: Kunai "Punch Through is ignored in Incarnon Form"
PT_NONE_ATK = {"Kunai": ("Incarnon Form",), "Mk1-Kunai": ("Incarnon Form",)}
# weapon-wide crit traits (wiki weapon pages): Gotva Prime "Status Effects have a 15% chance to set the next shot's Critical
# Chance to 300%" (15% confirmed by DE on the official forums, wiki footnote), ignoring mods
PROC_CRIT = {"Gotva Prime": {"p": 0.15, "cc": 3.0}}
# Perigale / Perigale Prime "Gale Force" (wiki Perigale, 2026-11-04): "Landing 4 headshots in a burst or a headshot kill grants
# the "Gale Force" buff, granting Infinite Ammo. The buff lasts 4 seconds and can be refreshed on subsequent chained headshots."
# Notes: "Multishot, Xata's Whisper, and Punch Through hitting multiple heads all count as separate headshot hits".
GALE_FORCE = {"Perigale": {"hits": 4, "dur": 4}, "Perigale Prime": {"hits": 4, "dur": 4}}
# radial parts that are NOT added to their wiki parent shot (checked 2026-11-03, queue item 0):
# - Castanas: "Mid-Flight Detonation" and "Embedded Detonation" are alternatives — a dart detonated in flight never also
#   detonates embedded (wiki Castanas: detonating before it sticks uses the mid-flight values)
# - lingering clouds (Pox Poison Cloud EffectDuration 5, Zakti Gas Cloud, Mutalist Cernos Toxin Cloud Duration 10) tick for
#   several seconds; the tick rate is not in the wiki data, so they stay separate until verified (P1: no assumed numbers)
NO_PAIR = {"Castanas": {"Embedded Detonation": "either"}, "Sancti Castanas": {"Embedded Detonation": "either"},
           "Pox": {"Poison Cloud": "cloud"}, "Zakti": {"Gas Cloud": "cloud"}, "Zakti Prime": {"Gas Cloud": "cloud"}, "Mutalist Cernos": {"Toxin Cloud": "cloud"}}
# pairs the wiki data leaves without AttackParentIndex (wiki attack tables, 2026-11-03):
# - Stug: each blob deals "Blob Embed" on sticking and "Blob Explosion" (ExplosionDelay 1.5 s) — both are AoE
# - Evensong: "Charged Radial Attack" is the burst of the charged arrow (same charge time 1.2 s)
# parts that hit more than once per shot (wiki weapon pages, 2026-11-03):
# - Proboscis Cernos: appendages "tick damage twice on all affected enemies before exploding" (9 m), explosion 1.7 s later
# - Stug: "Blobs then deal two ticks of damage in a 2 meter radius before exploding" (embed damage ×2, then Blob Explosion)
PART_REPEAT = {"Proboscis Cernos": {"Appendages": 2}, "Stug": {"Blob Embed": 2}}
PAIR_EXTRA = {"Stug": {"Blob Explosion": "Blob Embed"}, "Evensong": {"Charged Radial Attack": "Charged Shot"}}
# cluster bombs released by every main shot (queue bundle 3, 2026-11-04) — separate root attacks in the wiki data, so the
# parent index doesn't tie them to the shot that makes them:
# - Zarr (wiki page): "splitting into 6 smaller projectiles that spread from point of impact and home in on targets",
#   "Multishot mods will increase the amount of bombs for Cannon shots … each main projectile will always produce 6 cluster bombs"
# - Kuva Zarr: three bomblets per cannonball (wiki attack data Multishot 3; Ackbar review U30.6 "an additional three bomblets")
# - Kuva Bramma: "explodes in an 8.3 m radius, then splits into 3 small bombs that rain on the impact surface and explode in
#   3.5 m" (wiki; Update 28 "Fewer cluster bombs are produced on impact (from 7 to 3)"), wiki attack data Multishot 3
# The count is the wiki attack's Multishot; each bomb = contact hit + its explosion, and weapon multishot scales them with the shell.
CLUSTER = {"Zarr": ("Cannon Mode Projectile", ["Cannon Mode Cluster Bomb Contact", "Cannon Mode Cluster Bomb Explosion"]),
           "Kuva Zarr": ("Cannon Mode Projectile", ["Cannon Mode Cluster Bomb Contact", "Cannon Mode Cluster Bomb Explosion"]),
           "Kuva Bramma": ("Charged Shot", ["Cluster Bomb Contact", "Cluster Bomb Explosion"])}

FORCED = {"Impact": "impact", "Puncture": "punct", "Slash": "slash", "Heat": "heat", "Cold": "cold", "Electricity": "elec",
          "Toxin": "tox", "Blast": "blast", "Radiation": "rad", "Gas": "gas", "Magnetic": "mag", "Viral": "viral", "Corrosive": "corr", "Void": "void"}


def wiki_traits(at, wa):
    """Hidden per-attack traits from the wiki database: guaranteed status procs and headshot multiplier changes."""
    fp = [FORCED[x] for x in (wa.get("ForcedProcs") or []) if x in FORCED]
    if fp:
        at["forced"] = fp
    if wa.get("ExtraHeadshotDmg"):
        at["hsMult"] = max(1, 2 + float(wa["ExtraHeadshotDmg"]))
    if wa.get("PunchThrough"):
        at["pt"] = float(wa["PunchThrough"])          # innate punch through (Incarnon forms, Ignis Wraith, Boltor …)
    # Burst fire (wiki Fire Rate): "Fire Rate: Number of bursts per second if Burst Delay is 0 seconds … This is the 'Fire Rate'
    # value listed in the arsenal"; "Burst Count: Number of shots per burst", "Burst Delay: Delay between shots fired in a single
    # burst". The engine wants shots per second: BurstCount / (1/FireRate + BurstCount × BurstDelay) — this matches DE's export
    # fireRate for every burst weapon (Perigale 6.06, Hind 6.25, Burston 7.83, Sicarus 7.39; the wiki's own formula text uses
    # BurstCount − 1 delays, which the game numbers don't). Charged bursts (Ballistica, Balefire alt) keep their charge timing.
    bc, bd = wa.get("BurstCount") or 0, float(wa.get("BurstDelay") or 0)
    if bc > 1 and not wa.get("ChargeTime") and at.get("fr"):
        fr0 = float(at["fr"])
        at["burst"] = [int(bc), bd, fr0]
        at["fr"] = round(bc / (1 / fr0 + bc * bd), 4)
    trig = str(wa.get("Trigger") or "")
    if re.search(r"auto|held", trig, re.I) and "semi" not in trig.lower() and at.get("semi"):
        at.pop("semi")                                # e.g. Phenmor: semi-auto rifle, full-auto Incarnon Form


def wiki_attack(wk, name):
    atks = (wk or {}).get("Attacks") or []
    return next((x for x in atks if x.get("AttackName") == name), atks[0] if atks else {})

TMAP = {"impact": "impact", "puncture": "punct", "slash": "slash", "heat": "heat", "cold": "cold", "electricity": "elec",
        "toxin": "tox", "blast": "blast", "radiation": "rad", "gas": "gas", "magnetic": "mag", "viral": "viral",
        "corrosive": "corr", "void": "void", "tau": "tau", "true": "true"}
CLS = {"Rifle": "rifle", "Bow": "rifle", "Sniper": "rifle", "Launcher": "rifle", "Shotgun": "shotgun",
       "Pistol": "pistol", "Dual Pistols": "pistol", "Throwing": "pistol", "Melee": "melee"}
WORDS = [("Concentrated Arrow", "집중 화살(증강)"), ("Base ", "기본 "), ("Headshot", "헤드샷"), ("Alternate Fire", "보조 사격 (알트)"), ("Alt Fire", "보조 사격 (알트)"),
         ("Active Attack", "강화 사격 (알트)"), ("Viral Wave", "바이러스 음파"), ("Magnetic Wave", "자성 음파"), ("Cold Wave", "냉기 음파"), ("Corrosive Wave", "부식 음파"),
         ("Cryo Grenade", "냉기 수류탄"), ("Arcing Damage", "연쇄 피해"),
         ("Charged Throw Recall Explosion", "충전 투척 + 강공 기폭 (회수 폭발)"), ("Charged Throw Bounce Explosion", "튕김 폭발만 (강공 기폭을 안 하는 경우, 참고용)"),
         ("Throw Recall Explosion", "투척 회수 폭발"), ("Heavy Slam Attack", "강한 내려찍기"), ("Normal Attack", "기본 공격"),
         ("Alt-Fire", "보조 사격 (알트)"), ("Incarnon Form", "인카논 형태"), ("Charged Shot", "충전 사격 (차지)"), ("Radial Attack", "폭발 (AoE)"),
         ("Explosion", "폭발"), ("Charged", "충전"), ("Uncharged", "비충전"), ("Impact", "직격"), ("Direct Hit", "직격"),
         ("Projectile", "투사체"), ("AoE", "범위"), ("Glaive", "글레이브"), ("Mite", "마이트"), ("Shot", "사격"), ("Contact", "접촉"), ("Beam", "빔"), ("Burst", "점사"), ("Auto", "자동"),
         ("Semi", "반자동"), ("Sniper", "저격"), ("Cluster Bomb", "집속탄"), ("Rocket", "로켓"), ("Grenade", "유탄")]


def ko_attack(n):
    out = n
    for en, k in WORDS:
        out = out.replace(en, k)
    return out


def slug(s):
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


def dmg_of(d):
    out = {}
    for k, v in (d or {}).items():
        t = TMAP.get(k)
        if t and v and float(v) > 0:
            out[t] = round(float(v), 3)
    return out


STRIP = {"Explosion", "AoE", "Radial", "Attack", "Impact", "Contact", "Direct", "Hit", "Projectile", "Normal"}


def core(n):
    return " ".join(w for w in n.replace("-", " ").split() if w not in STRIP)


POL = {"Madurai": "madurai", "Vazarin": "vazarin", "Naramon": "naramon", "Zenurik": "zenurik", "Unairu": "unairu", "Penjaga": "penjaga", "Umbra": "umbra"}


def conv(w, typ):
        cls = CLS.get(typ)
        if not cls or not w.get("attacks"):
            return None
        name = w["name"]
        ko = (KO.get(w["uniqueName"]) or {}).get("name") or name
        slot = "melee" if cls == "melee" else ("secondary" if w.get("productCategory") == "Pistols" or typ in ("Pistol", "Dual Pistols", "Throwing") else "primary")
        W = {"id": slug(name), "ko": ko, "en": name, "slot": slot, "cls": cls, "type": typ,
             "valence": bool(re.match(r"^(Kuva|Tenet|Coda) ", name)), "attacks": []}
        if cls != "melee":
            pellets = w.get("multishot") or 1
            semi = (w.get("trigger") == "Semi")
            base = []
            for a in w["attacks"]:
                d = dmg_of(a.get("damage"))
                if not d or a.get("shot_type") == "DoT":
                    continue
                at = {"name": "기본 사격" if a["name"] == "Normal Attack" else ko_attack(a["name"]), "en": a["name"], "kind": "radial" if a.get("shot_type") == "AoE" else "gun",
                      "dmg": d, "cc": (a.get("crit_chance") or 0) / 100, "cd": a.get("crit_mult") or 1.5,
                      "sc": (a.get("status_chance") or 0) / 100, "fr": a.get("speed") or w.get("fireRate") or 1,
                      "pellets": pellets, "mag": w.get("magazineSize") or 0, "reload": w.get("reloadTime") or 0, "_shot": a.get("shot_type")}
                if semi:
                    at["semi"] = True
                fo = a.get("falloff") or {}
                if a.get("shot_type") == "AoE":
                    at["radius"] = fo.get("end") or 5
                    if fo.get("reduction"):
                        at["rfo"] = round(float(fo["reduction"]), 3)          # damage lost at the edge of the blast
                elif fo.get("end") and fo.get("reduction"):
                    at["fo"] = [fo.get("start") or 0, fo["end"], round(float(fo["reduction"]), 3)]   # distance falloff
                wa = wiki_attack(WIKI.get(name), a["name"])
                if wa.get("AmmoCost") is not None:
                    at["ammoCost"] = wa["AmmoCost"]
                if wa.get("AttackName") == a["name"]:
                    wiki_traits(at, wa)
                # Incarnon Form: its own ammo pool (charges → rounds), no magazine or reload; mods and ammo efficiency don't
                # touch the pool (wiki Incarnon). The radial part of the form shares it.
                if a["name"].startswith("Incarnon Form"):
                    incs = [x for x in ((WIKI.get(name) or {}).get("Attacks") or []) if str(x.get("AttackName", "")).startswith("Incarnon Form")]
                    if not any(x.get("Magazine") for x in incs):
                        ch = next((x["IncarnonCharges"] for x in incs if x.get("IncarnonCharges")), None)
                        at["mag"], at["reload"], at["inc"] = 0, 0, True
                        if ch:
                            at["incAmmo"] = ch
                ch_ = CHAIN.get(name, {}).get(a["name"])
                if ch_:
                    at["chain"] = {k: ch_[k] for k in ("n", "f", "p", "r", "flat") if k in ch_}
                    if ch_.get("radius"): at["radius"] = ch_["radius"]
                    if ch_.get("ptNone"): at["ptLock"] = True
                if a["name"] in PT_NONE_ATK.get(name, ()):
                    at["ptLock"] = True
                if at["kind"] == "radial" and a["name"] in NO_MS_RADIAL.get(name, ()):
                    at["noMs"] = True     # wiki weapon page: the radial attack gets no multishot bonus
                if a.get("charge_time"):
                    at["charge"] = a["charge_time"]
                wk_ = WIKI.get(name) or {}
                if wk_.get("Spool") and "Spool" in str(wk_.get("Trigger") or "") and not at.get("inc"):
                    at["spool"] = int(wk_["Spool"])
                if a["name"] in SPOOL_DOWN.get(name, {}):
                    at["spoolDown"] = SPOOL_DOWN[name][a["name"]]
                if at["kind"] == "radial" and "hsMult" not in at:
                    at["hsMult"] = 1      # Update 32: radial damage gets no headshot bonus
                at["desc"] = {"Normal Attack": "기본 사격만 하는 운용", "Alt-Fire": "보조 사격만 계산", "Incarnon Form": "인카논 형태 (진화 후) 사격",
                              "Charged Shot": "충전 사격"}.get(a["name"], ("폭발 부분만" if at["kind"] == "radial" else "직격 부분만"))
                base.append(at)
            # combined direct + AoE parts
            combos = []
            # primer combos: main gun attack + alt-fire statuses
            mains = [y for y in base if y["kind"] == "gun" and y["en"] in ("Normal Attack", "Incarnon Form")]
            alts = [y for y in base if y["en"].startswith("Alt")]
            if mains and alts:
                y, z = mains[0], alts[0]
                combos.append({"name": f"{y['name']} + 보조 사격으로 상태이상 묻히기 (프라이밍)", "en": y["en"] + "+primer", "kind": "gun",
                               "parts": [y], "primer": z, "primerRate": 0.25, "dmg": y["dmg"], "cc": y["cc"], "cd": y["cd"], "sc": y["sc"], "fr": y["fr"],
                               "pellets": pellets, "mag": y["mag"], "reload": y["reload"], "semi": y.get("semi", False),
                               "desc": "보조 사격을 4초마다 한 번 섞어 상태이상을 묻힌 뒤 기본 사격으로 마무리하는 운용 (세도류)"})
            # which radial part belongs to which shot: wiki AttackParentIndex first (Lenz: Initial Blast and Bubble Collapse
            # are both children of Charged Shot; Penta: Grenade Detonation of Grenade Impact), then explicit pairs, then the
            # old name rule (core() equal after stripping Impact/Explosion words)
            wk_atks = (WIKI.get(name) or {}).get("Attacks") or []
            idx_name = {x.get("AttackIndex"): x.get("AttackName") for x in wk_atks}
            parent_of = {x.get("AttackName"): idx_name.get(x.get("AttackParentIndex")) for x in wk_atks if x.get("AttackParentIndex")}
            parent_of.update(PAIR_EXTRA.get(name, {}))
            groups, order, extra, keep = {}, [], set(), set()
            for x in base:
                if x["en"] in NO_PAIR.get(name, {}):
                    x["noPair"] = NO_PAIR[name][x["en"]]
                if x["kind"] != "radial" or re.search(r"Headshot|Slam", x["en"]) or x.get("noPair"):
                    continue
                partners = [y for y in base if y["kind"] == "gun" and core(y["en"]) == core(x["en"]) and abs(y["fr"] - x["fr"]) < 0.05]
                if not partners and core(x["en"]) == "":
                    partners = [y for y in base if y["kind"] == "gun" and abs(y["fr"] - x["fr"]) < 0.05]
                oldp = partners[0] if partners else None
                pn = parent_of.get(x["en"])
                py = next((y for y in base if y["en"] == pn and y is not x and abs(y["fr"] - x["fr"]) < 0.05), None) if pn else None
                if py is not None and (py["kind"] == "gun" or name in PAIR_EXTRA):
                    if py["en"] not in groups:
                        groups[py["en"]] = [py]
                        order.append(groups[py["en"]])
                    groups[py["en"]].append(x)
                    if x["en"] in PAIR_EXTRA.get(name, {}):
                        extra.add(py["en"])
                    if oldp is py:
                        keep.add(py["en"])     # the name rule already paired these before v1.63: default unchanged
                    continue
                if pn and pn in NO_PAIR.get(name, {}):
                    continue
                if oldp is not None:
                    order.append([oldp, x])
            if name in CLUSTER and CLUSTER[name][0] in groups:
                ms_of = {x.get("AttackName"): int(x.get("Multishot") or 1) for x in wk_atks}
                for cn in CLUSTER[name][1]:
                    cx = next((y for y in base if y["en"] == cn), None)
                    if cx is not None:
                        groups[CLUSTER[name][0]].extend([dict(cx, cluster=True)] * ms_of.get(cn, 1))
            late = []
            first_gun = next((y["en"] for y in base if y["kind"] == "gun"), None)
            for grp in order:
                y, from_wiki = grp[0], any(grp is g for g in groups.values())
                rep = PART_REPEAT.get(name, {})
                if rep:
                    grp = [q for q in grp for _ in range(rep.get(q["en"], 1))]
                # wiki "Punch Through": projectiles with an AoE part explode on first contact — punch through can't apply
                if y.get("_shot") == "Projectile":
                    y["ptLock"] = True
                cname = "기본 사격 전체 피해 (직격 + 폭발)" if y["en"] == "Normal Attack" else (y["name"].replace(" 직격", "").replace("직격", "").strip() or y["name"]) + " 한 발 전체 피해 (직격 + 폭발)"
                cb = {"name": cname, "en": "+".join(dict.fromkeys(q["en"] for q in grp)), "kind": "gun", "desc": "한 발의 직격과 폭발 피해를 합쳐서 계산",
                      "parts": list(grp), "dmg": y["dmg"], "cc": y["cc"], "cd": y["cd"], "sc": y["sc"], "fr": y["fr"],
                      "pellets": pellets, "mag": y["mag"], "reload": y["reload"], "semi": y.get("semi", False), "ptLock": bool(y.get("ptLock"))}
                if len(grp) > 2:
                    cb["desc"] = "한 발의 직격과 폭발 피해 " + str(len(grp)) + "번을 합쳐서 계산 (위키 공격 구성)"
                nc_ = sum(1 for q in grp if q.get("cluster") and q["kind"] == "radial")
                if nc_:
                    cb["name"] = cname.replace("(직격 + 폭발)", "(직격 + 폭발 + 집속탄 " + str(nc_) + "개)")
                    cb["desc"] = "한 발의 직격·폭발과 그 폭발에서 나오는 집속탄 " + str(nc_) + "개(접촉 + 폭발)를 합쳐서 계산 (위키)"
                if y.get("charge"):
                    cb["charge"] = y["charge"]     # the combined shot keeps its trigger part's charge time (wiki Fire Rate)
                if y.get("inc"):
                    cb["inc"] = True
                if y.get("incAmmo"):
                    cb["incAmmo"] = y["incAmmo"]
                # pairs found through the wiki parent index on a shot that isn't the weapon's main trigger (Quanta cube, Cedo glaive,
                # Kulstar cluster bombs, Incarnon forms…) are offered but never become the default attack
                if from_wiki and y["en"] != first_gun and y["en"] not in extra and y["en"] not in keep:
                    cb["alt"] = True
                    late.append(cb)
                else:
                    combos.append(cb)
            for x in base:
                x.pop("_shot", None)
            W["attacks"] = combos + base + late
            if name in PROC_CRIT:
                W["procCrit"] = PROC_CRIT[name]
            if name in GALE_FORCE:
                W["galeForce"] = GALE_FORCE[name]
            wk = WIKI.get(name) or {}
            if wk.get("ReloadStyle") == "ByRound":   # shells loaded one by one: bigger magazine = longer reload
                for at_ in base:
                    at_["byRound"] = True
            if wk.get("AmmoMax"):
                W["ammoMax"] = wk["AmmoMax"]
                W["ammoPickup"] = wk.get("AmmoPickup") or 0
        else:
            norm = next((a for a in w["attacks"] if a["name"] == "Normal Attack"), w["attacks"][0])
            nd = dmg_of(norm.get("damage"))
            cc, cd, sc = (norm.get("crit_chance") or 0) / 100, norm.get("crit_mult") or 1.5, (norm.get("status_chance") or 0) / 100
            atks = []
            if nd:
                atks.append({"name": "일반 공격 (휘두르기, 연속기 빌드)", "en": "Normal Attack", "kind": "melee", "desc": "연속기를 쌓아 가며 휘두르는 운용. 블러드 러시·위핑 운즈·컨디션 오버로드가 여기서 힘을 냅니다", "dmg": nd, "cc": cc, "cd": cd, "sc": sc, "fr": norm.get("speed") or w.get("fireRate") or 1})
                ha = w.get("heavyAttackDamage")
                if ha:
                    tot = sum(nd.values())
                    atks.append({"name": "강공 (헤비 어택)", "en": "Heavy Attack", "kind": "heavy", "desc": "강공만 반복하는 운용. 킬링 블로우·갈바나이즈드 리플렉스가 적용됩니다", "dmg": {k: round(v / tot * ha, 2) for k, v in nd.items()},
                                 "cc": cc, "cd": cd, "sc": sc, "windup": w.get("windUp") or 1.0})
            for a in w["attacks"]:
                n = a["name"]
                d = dmg_of(a.get("damage"))
                if not d:
                    continue
                if n.startswith("Charged Throw") and a.get("shot_type") == "AoE":
                    wt = next((x for x in (WIKI.get(name) or {}).get("Attacks") or [] if x.get("ShotType") == "Thrown" and x.get("ShotSpeed")), {})
                    ga = {"name": ko_attack(n), "en": n, "kind": "glaive", "dmg": d, "cc": (a.get("crit_chance") or 0) / 100,
                          "cd": a.get("crit_mult") or cd, "sc": (a.get("status_chance") or 0) / 100,
                          "windup": a.get("charge_time") or w.get("windUp") or 1.2, "radius": (a.get("falloff") or {}).get("end") or 5, "noCO": True,
                          "throwSpeed": wt.get("ShotSpeed") or 30}
                    if (a.get("falloff") or {}).get("reduction"):
                        ga["rfo"] = round(float(a["falloff"]["reduction"]), 3)
                    wa = next((x for x in (WIKI.get(name) or {}).get("Attacks") or [] if x.get("AttackName") == n), None)
                    if wa:
                        wiki_traits(ga, wa)
                    atks.append(ga)
                elif n == "Heavy Slam Attack":
                    sl = {"name": "강한 내려찍기 (슬램)", "en": n, "kind": "heavy", "desc": "공중에서 강공으로 내려찍는 슬램 운용 (생티 마기스타 등)", "dmg": d, "cc": (a.get("crit_chance") or 0) / 100,
                          "cd": a.get("crit_mult") or cd, "sc": (a.get("status_chance") or 0) / 100,
                          "windup": w.get("windUp") or 1.0, "radius": (a.get("falloff") or {}).get("end") or 6, "noCO": True}
                    if (a.get("falloff") or {}).get("reduction"):
                        sl["rfo"] = round(float(a["falloff"]["reduction"]), 3)
                    wa = next((x for x in (WIKI.get(name) or {}).get("Attacks") or [] if x.get("AttackName") == n), None)
                    if wa:
                        wiki_traits(sl, wa)
                    atks.append(sl)
            # glaives: put recall explosion first
            atks.sort(key=lambda x: 0 if "Recall" in x["en"] else 1 if x["kind"] == "glaive" else 2)
            for a in atks:
                if a["kind"] == "glaive" and "Recall" in a["en"]:
                    a["desc"] = "충전 투척 후 날아가는 중에 강공 키로 터뜨리는 기본 운용 (회수 폭발 = 기폭: 연속기 배율 적용·연속기 소모, 확정 상태이상, 가장자리 감쇠 없음). 볼래틸 퀵 리턴 유무와 상관없이 같은 운용이고, 끼면 벽에 튕겨 엉뚱한 방향으로 가지 않고(튕김 −4) 폭발 범위 +3m, 닿는 순간 작은 폭발이 하나 더 붙습니다"
                elif a["kind"] == "glaive":
                    a["desc"] = "강공 기폭 없이 볼래틸 계열 모드가 닿을 때 내는 작은 폭발만으로 잡는 경우 (피해 절반, 연속기 배율 없음, 확정 상태이상 없음, 가장자리로 갈수록 피해 감소) — 비교용"
            W["attacks"] = atks
            if any(x["kind"] == "glaive" for x in atks):
                W["sub"] = "glaive"
        if not W["attacks"]:
            return None
        wk = WIKI.get(name) or {}
        # mod capacity: slot polarities, exilus polarity, max rank (Kuva/Tenet/Coda: 40)
        pol = [POL.get(p, p.lower()) for p in (wk.get("Polarities") or [])] if wk.get("Polarities") is not None else [p for p in (w.get("polarities") or [])]
        if pol:
            W["pol"] = pol
        xp = wk.get("ExilusPolarity") or w.get("exilusPolarity")
        if xp:
            W["xpol"] = POL.get(xp, str(xp).lower())
        if wk.get("MaxRank") and wk["MaxRank"] != 30:
            W["rank"] = wk["MaxRank"]
        if wk.get("StancePolarity"):
            W["spol"] = POL.get(wk["StancePolarity"], wk["StancePolarity"].lower())
        # sniper scope: zoom-level bonuses and the sniper combo counter (wiki Module:Weapons/data)
        if wk.get("SniperComboMin"):
            W["sniperCombo"] = [wk["SniperComboMin"], wk.get("SniperComboReset") or 2]
        zb = {}
        for zl in wk.get("Zoom") or []:
            if re.search(r"-\d+% Fire Rate", zl):
                continue      # Komorex 3.5x: +100% damage but -75% fire rate (not a free bonus)
            for v, what in re.findall(r"\+(\d+(?:\.\d+)?)% (Critical Chance|Critical Multiplier|Headshot Damage|Damage)", zl):
                k = {"Critical Chance": "ccFlat", "Critical Multiplier": "cd", "Headshot Damage": "hs", "Damage": "dmg"}[what]
                zb[k] = max(zb.get(k, 0), float(v) / 100)
        if zb:
            W["zoom"] = zb
        return W


weapons = []
for src in (P, S, ME):
    for w in src:
        # wiki Class wins for sniper rifles: DE's export lists Perigale Prime as "Rifle", the wiki as "Sniper Rifle"
        # (CompatibilityTags SNIPER_AMMO) — it takes sniper-only mods (Primed Chamber, Sharpshooter …), not assault-rifle ones
        typ = w.get("type")
        if (WIKI.get(w["name"]) or {}).get("Class") == "Sniper Rifle" and typ == "Rifle":
            typ = "Sniper"
        W = conv(w, typ)
        if W:
            if W.get("en") in KILL_FIELD:
                for at_ in W.get("attacks", []): at_["killField"] = KILL_FIELD[W["en"]]
            weapons.append(W)

# exalted weapons (wiki Module:Weapons/data, Class "Exalted Weapon"; Garuda Talons are a passive exalted-like weapon).
# How Ability Strength changes them (wiki ability pages): "base" = base damage x Strength (most of them);
# "bonus" = Regulators: fixed 50 base, +150% x Strength innate damage bonus; "mult" = Neutralizer/Lizzie:
# x1.25 x Strength multiplier additive with Serration-type mods; "none" = Garuda Talons.
MISC = json.load(open(A + "Misc.json")) if os.path.exists(A + "Misc.json") else []
EX_SKIP = {"Shadow Clones", "Shadow Clones Prime", "Arquebex", "Ironbride"}   # Blade Storm finisher clones, Necramech weapons
EX_PSEUDO = {"Whipclaw", "Whipclaw Prime", "Shattered Lash", "Shattered Lash Prime", "Landslide Fists", "Landslide Fists Prime"}   # no heavy attacks


def ex_mode(n):
    if n.startswith("Regulators"):
        return {"mode": "bonus", "k": 1.5}
    if n in ("Lizzie", "Neutralizer"):
        return {"mode": "mult", "k": 1.25}
    if n.startswith("Garuda"):
        return {"mode": "none"}
    return {"mode": "base"}


def wiki_to_wfcd(wk):
    """turn a wiki weapon entry into the WFCD shape conv() reads"""
    atks = []
    for a in wk.get("Attacks") or []:
        fo = a.get("Falloff") or {}
        x = {"name": a.get("AttackName") or "Normal Attack", "damage": {k.lower(): v for k, v in (a.get("Damage") or {}).items()},
             "crit_chance": (a.get("CritChance") or 0) * 100, "crit_mult": a.get("CritMultiplier") or 1.5,
             "status_chance": (a.get("StatusChance") or 0) * 100, "speed": a.get("FireRate") or wk.get("FireRate"), "shot_type": a.get("ShotType")}
        if fo.get("EndRange"):
            x["falloff"] = {"start": fo.get("StartRange") or 0, "end": fo["EndRange"], "reduction": fo.get("Reduction") or 0}
        if a.get("ChargeTime"):
            x["charge_time"] = a["ChargeTime"]
        atks.append(x)
    a0 = (wk.get("Attacks") or [{}])[0]
    return {"name": wk["Name"], "uniqueName": wk.get("InternalName") or wk["Name"], "attacks": atks, "multishot": a0.get("Multishot") or 1,
            "trigger": "Semi" if wk.get("Trigger") == "Semi-Auto" else wk.get("Trigger"), "fireRate": a0.get("FireRate") or 1,
            "magazineSize": wk.get("Magazine") or 0, "reloadTime": wk.get("Reload") or 0,
            "heavyAttackDamage": None if wk["Name"] in EX_PSEUDO else wk.get("HeavyAttack"), "windUp": wk.get("WindUp"),
            "productCategory": "Pistols" if wk.get("Slot") == "Secondary" else None}


ex_names = sorted({k for k, v in WIKI.items() if isinstance(v, dict) and v.get("Class") == "Exalted Weapon"} | {"Garuda Talons", "Garuda Prime Talons"})
have = {w["en"] for w in weapons}
n_ex = 0
for n in ex_names:
    wk = WIKI.get(n)
    if not wk or n in EX_SKIP or n in have:
        continue
    slot_ = wk.get("Slot")
    typ = "Melee" if slot_ == "Melee" else ("Bow" if n.startswith("Artemis") else "Rifle") if slot_ == "Primary" else ("Dual Pistols" if n.startswith("Regulators") else "Pistol")
    W = conv(wiki_to_wfcd(wk), typ)
    if not W:
        continue
    W["exalted"] = dict(ex_mode(n), frame=re.sub(r"'s Shadow( Prime)?$", r"\1", (wk.get("Users") or [""])[0]))
    if n.startswith("Exalted") and "Blade" in n:
        W["exalted"]["passive"] = {"dmg": 0.1, "fr": 0.1}     # Excalibur passive: +10% damage and attack speed with Exalted Blade
    W["noRiven"] = True
    if n in EX_PSEUDO:
        W["pseudo"] = True
    if W.get("en") in KILL_FIELD:
        for at_ in W.get("attacks", []): at_["killField"] = KILL_FIELD[W["en"]]
    weapons.append(W)
    n_ex += 1
print("exalted", n_ex)

# verified overrides
byid = {w["id"]: w for w in weapons}
# fallback when the wiki database was not downloaded: recall explosions of these glaives force their element
if not WIKI:
    for gid, el in (("coda_pathocyst", "viral"), ("xoris", "elec")):
        for a in (byid.get(gid) or {}).get("attacks", []):
            if a["kind"] == "glaive" and "Recall" in a["en"]:
                a["forced"] = ["impact", el]
if "vadarya_prime" in byid and not byid["vadarya_prime"].get("zoom"):
    byid["vadarya_prime"]["zoom"] = {"cd": 0.5}
if "coda_bassocyst" in byid:
    w = byid["coda_bassocyst"]
    w["mercyBuff"] = True
    w["attacks"] = [a for a in w["attacks"] if a["en"] == "Normal Attack"]
    w["attacks"][0]["punch"] = True
    w["attacks"][0]["name"] = "주사격 (음파, 몸통 무한 관통)"
for pid in ("tenet_arca_plasmor", "arca_plasmor"):
    if pid in byid:
        byid[pid]["attacks"][0]["punch"] = True
# weapons whose wiki page says they have innate "Infinite Body Punch Through" (checked over every weapon page, 2026-10-31):
# None = every non-explosion attack, a tuple = only attacks whose name contains one of these words
INF_BODY_PT = {"Alternox": None, "Alternox Prime": None, "Arca Plasmor": None, "Tenet Arca Plasmor": None, "Coda Bassocyst": None,
               "Corufell": None, "Corufell Prime": None, "Cyanex": None, "Exergis": None, "Felarx": None, "Ignis": None, "Ignis Wraith": None,
               "Lanka": None, "Nataruk": ("Charged", "Perfect"), "Nepheri": None, "Noctua": None, "Phantasma": None, "Phantasma Prime": None,
               "Purgator 1": None, "Steflos": None, "Steflos Prime": None, "Stropha": None, "Tenet Agendus": None, "Verdilac": None}
for w in weapons:
    if w.get("en") not in INF_BODY_PT: continue
    # melee entries (Corufell, Nepheri, Stropha, Tenet Agendus, Verdilac): the wiki gives infinite body punch through only to their
    # gunblade shots / fireballs / disk / block-combo waves, not to the swings (melee audit 2026-11-05) — those attacks aren't built
    if w.get("slot") == "melee": continue
    only = INF_BODY_PT[w["en"]]
    for a in w["attacks"]:
        if a.get("kind") == "radial": continue
        if only and not any(x in (a.get("en") or "") for x in only): continue
        a["punch"] = True

# Hespar (wiki notes): "Heavy Attack bug: 1680 × 3 = 5040, is actually 1680 ÷ 3 = 560 per hit" — the module's 5040 is 3× the game
for w in weapons:
    if w.get("en") == "Hespar":
        for a in w["attacks"]:
            if a.get("en") == "Heavy Attack" and a.get("dmg"):
                a["dmg"] = {k: round(v / 3, 3) for k, v in a["dmg"].items()}
# Dual Ichor heavy: wiki module and WFCD say HeavyAttack = 488 (4 x 122), the in-game arsenal (user screenshot 2026-11-06,
# no mods) shows 610 (5 x 122, two blade hits). Slam/slide 244 match the wiki, only the heavy differs. Arsenal wins (P5).
# Simulacrum video the same day: Tennokai heavy hits 782/391 at 2x and 4.7K/2.3K at 12x — x6, the full combo multiplier.
ARSENAL_HEAVY = {"Dual Ichor": 610}
for w in weapons:
    if w.get("en") in ARSENAL_HEAVY:
        for a in w["attacks"]:
            if a.get("en") == "Heavy Attack" and a.get("dmg"):
                tot = sum(a["dmg"].values())
                a["dmg"] = {k: round(v * ARSENAL_HEAVY[w["en"]] / tot, 3) for k, v in a["dmg"].items()}
# documented mechanics still missing from the engine (wiki audit, docs/mechanics/gaps_*.json): the app withholds the
# recommendation for an attack they touch ("cat": all / normal / heavy / slam / throw; "cond" and handled ones don't count)
import glob as _glob
_gaps = {}
for _f in sorted(_glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "mechanics", "gaps_*.json"))):
    for _g in json.load(open(_f, encoding="utf-8")):
        if _g.get("handled") or _g.get("cat") in ("cond", "info"): continue
        _gaps.setdefault(_g["weapon"], []).append({"cat": _g["cat"], "type": _g["type"], "atk": _g["attack"], "q": _g["quote"][:180], "stated": _g["stated"]})
for w in weapons:
    if w.get("en") in _gaps: w["gaps"] = _gaps[w["en"]]
# beam damage ramp (wiki weapon notes, e.g. Amprex "Damage ramps up from 30% to 100% over 0.6 seconds when firing. After firing
# stops for 0.8 seconds, the damage decays back to 30% over 2 seconds"): read from the audited quotes in docs/mechanics
_ramp = {}
for _f in sorted(_glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs", "mechanics", "gaps_*.json"))):
    for _g in json.load(open(_f, encoding="utf-8")):
        _m = re.search(r"[Dd]amage ramps up from (\d+(?:\.\d+)?)% to 100% over (\d+(?:\.\d+)?) seconds", _g.get("quote") or "")
        if _m:
            for _n in [_g["weapon"]] + [v for v in (_g.get("variants") or []) if isinstance(v, str)]:
                _ramp[_n] = ([float(_m.group(1)) / 100, float(_m.group(2))], (_g.get("attack") or "").lower().startswith("alt"))
for w in weapons:
    if w.get("en") not in _ramp: continue
    rv, alt = _ramp[w["en"]]
    for a in w["attacks"]:
        if a.get("kind") != "gun": continue
        if (alt and a.get("en") == "Held") or (not alt and (a.get("en") or "").startswith("Normal Attack")):
            a["beamRamp"] = rv

# dedupe ids
seen = {}
for w in weapons:
    if w["id"] in seen:
        w["id"] += "_" + w["type"].lower().replace(" ", "")
    seen[w["id"]] = 1
weapons.sort(key=lambda w: w["ko"])

# korean names for mods and arcanes
mod_ko = {}
for m in MODS:
    k = (KO.get(m["uniqueName"]) or {}).get("name")
    if k:
        mod_ko.setdefault(m["name"], k)
for a in ARCS:
    k = (KO.get(a["uniqueName"]) or {}).get("name")
    if k:
        mod_ko.setdefault(a["name"], k)

# Zaw and Kitgun parts (wiki Module:Modular/data): assembled in the page
name_ko = {}
for src_ in (P, S, ME, MISC):
    for x in src_:
        k = (KO.get(x.get("uniqueName", "")) or {}).get("name")
        if k:
            name_ko.setdefault(x["name"], k)
LINK_KO = {"Vargeet": "바르기트", "Ekwana": "에크와나", "Ruhang": "루행", "Jai": "자이", "II": "II"}
MODULAR = {}
try:
    MD = wiki_lua.parse(open(A + "wiki_modular.lua", encoding="utf-8").read()) if os.path.exists(A + "wiki_modular.lua") else {}
except Exception as e:
    MD = {}
    print("modular data skipped:", e)
if MD.get("Zaw"):
    Z = MD["Zaw"]
    MODULAR["zaw"] = {
        "strikes": {n: {"ko": name_ko.get(n, n), "dmg": dmg_of({k.lower(): v for k, v in s["Damage"].items()}), "cc": s.get("CritChance", 0), "cd": s.get("CritMultiplier", 2),
                        "sc": s.get("StatusChance", 0), "spd": s.get("Speed", 0), "multi": {h: s["Multi"][h]["Base"] for h in s.get("Multi", {})},
                        "kind": s.get("Type", {}), "plague": n.startswith("Plague")} for n, s in Z["Strike"].items()},
        "grips": {n: {"ko": name_ko.get(n, n), "dmg": g.get("Damage", 0), "spd": g.get("Speed", 1), "hand": g.get("Type")} for n, g in Z["Grip"].items()},
        "links": {n: {"ko": " ".join(LINK_KO.get(t, t) for t in n.split()), "dmg": l.get("Damage", 0), "spd": l.get("Speed", 0), "cc": l.get("CritChance", 0), "sc": l.get("StatusChance", 0)} for n, l in Z["Link"].items()},
    }
for slot_, key in (("secondary", "KitgunSecondary"), ("primary", "KitgunPrimary")):
    K = MD.get(key)
    if not K:
        continue
    ch = {}
    for n, c in K["Chamber"].items():
        fo = c.get("Falloff") or {}
        e = {"ko": name_ko.get(n, n), "dmg": {g: dmg_of({k.lower(): v for k, v in d.items()}) for g, d in c["Damage"].items() if g != "Base"},
             "fr": c.get("FireRate") or {}, "mag": c.get("Magazine") or {}, "cc": c.get("CritChance", 0), "cd": c.get("CritMultiplier", 2), "sc": c.get("StatusChance", 0),
             "ms": c.get("Multishot", 1), "trig": c.get("Trigger"), "shot": c.get("ShotType"), "ammoMax": c.get("AmmoMax"), "ammoPickup": c.get("AmmoPickup"), "ammoCost": c.get("AmmoCost", 1)}
        if fo.get("EndRange"):
            e["fo"] = [fo.get("StartRange") or 0, fo["EndRange"], fo.get("Reduction") or 0]
        if c.get("ForcedProcs"):
            e["forced"] = [FORCED[x] for x in c["ForcedProcs"] if x in FORCED]
        if c.get("ChargeTime"):
            e["charge"] = c["ChargeTime"]
        if c.get("PunchThrough"):
            e["pt"] = c["PunchThrough"]
        ch[n] = e
    MODULAR["kit_" + slot_] = {"chambers": ch, "grips": {n: {"ko": name_ko.get(n, n)} for n in K["Grip"]},
                               "loaders": {n: {"ko": name_ko.get(n, n), "cc": l.get("CritChance", 0), "cd": l.get("CritMultiplier", 0), "sc": l.get("StatusChance", 0),
                                               "mag": l.get("Magazine"), "reload": l.get("Reload", 1.5)} for n, l in K["Loader"].items()}}
# Incarnon evolutions (scripts/fetch_incarnon.py → incarnon_evos.json): each perk line becomes either a base-stat change of
# the attack, a mod-like effect, a known effect with no damage impact, or a conditional effect the calculator leaves out.
EVO_RULES = [
    (r"^Increase (?:Base )?Damage by \+?(\d+(?:\.\d+)?)\.?$", "baseDmg", 1, "기본 피해 +{v}"),
    (r"^Increase Base Critical Chance by \+?(\d+(?:\.\d+)?)%\.?$", "baseCC", 0.01, "기본 치명타 확률 +{v}%"),
    (r"^([+-]?\d+(?:\.\d+)?)% Critical Chance\.?$", "baseCC", 0.01, "치명타 확률 {s}%"),
    (r"^Increase Critical Chance by \+?(\d+(?:\.\d+)?)%\.?$", "baseCC", 0.01, "치명타 확률 +{v}%"),
    (r"^Increase Base Critical (?:Damage )?Multiplier by \+?(\d+(?:\.\d+)?)x?\.?$", "baseCD", 1, "기본 치명타 배율 +{v}"),
    (r"^Increase Base Status(?: Chance)? by \+?(\d+(?:\.\d+)?)%(?: per projectile| for Incarnon Form)?\.?$", "baseSC", 0.01, "기본 상태이상 확률 +{v}%"),
    (r"^([+-]?\d+(?:\.\d+)?)% Status Chance\.?$", "baseSC", 0.01, "상태이상 확률 {s}%"),
    (r"^Increase Status Chance by \+?(\d+(?:\.\d+)?)%\.?$", "baseSC", 0.01, "상태이상 확률 +{v}%"),
    (r"^Increase Base Magazine Capacity by \+?(\d+)\.?$", "baseMag", 1, "탄창 +{v}"),
    (r"^\+?(\d+) Base Multishot\.?$", "basePellets", 1, "기본 멀티샷 +{v}"),
    (r"^([+-]?\d+(?:\.\d+)?)% Reload Speed\.?$", "reload", 0.01, "재장전 속도 {s}%"),
    (r"^([+-]?\d+(?:\.\d+)?)% (?:Fire Rate|Attack Speed)\.?$", "fr", 0.01, "연사·공격 속도 {s}%"),
    (r"^([+-]?\d+(?:\.\d+)?)% Multishot\.?$", "ms", 0.01, "멀티샷 {s}%"),
    (r"^([+-]?\d+(?:\.\d+)?)% Direct Damage per Status Type affecting the target\.?$", "evoPst", 0.01, "상태이상 종류당 직격 피해 {s}%"),
    (r"^([+-]?\d+) Initial Combo\.?$", "ic", 1, "초기 연속기 {s}"),
    (r"^([+-]?\d+(?:\.\d+)?)% Heavy Attack Wind ?Up Speed\.?$", "wind", 0.01, "강공 준비 속도 {s}%"),
    (r"^(?:Base )?Heavy Attack Efficiency set at (\d+(?:\.\d+)?)%\.?$", "hae", 0.01, "강공 효율 {v}%"),
    (r"^([+-]?\d+(?:\.\d+)?)% Headshot [Dd]amage\.?$", "hsMult", 0.01, "헤드샷 피해 {s}% (헤드샷 시)"),
    (r"^On 2 headshots within 2 seconds: ([+-]?\d+(?:\.\d+)?)% Headshot damage for \d+ seconds\.?$", "hsMult", 0.01, "헤드샷 피해 {s}% (헤드샷 연속 시)"),
    (r"^([+-]?\d+(?:\.\d+)?) Punch Through\.?$", "pt", 1, "관통력 {s}m"),
    (r"^([+-]?\d+(?:\.\d+)?)% Magazine Capacity\.?$", "mag", 0.01, "탄창 {s}%"),
    (r"^([+-]?\d+(?:\.\d+)?)% Ammo [Ee]fficiency\.?$", "ammoEff", 0.01, "탄약 효율 {s}%"),
    # emptying the magazine before reloading is the calculator's firing model, so "on reload from empty" is always met
    (r"^On Reload [Ff]rom Empty(?: Magazine)?: \+?(\d+(?:\.\d+)?)% Reload Speed(?: for \d+ seconds)?\.?$", "reload", 0.01, "빈 탄창 재장전 시 재장전 속도 +{v}% (탄창을 비우고 재장전하는 계산 기준이라 항상 적용)"),
    (r"^([+-]?\d+(?:\.\d+)?)% Blast Radius\.?$", "blastR", 0.01, "폭발 반경 {s}%"),
    (r"^Increase Base Status Chance to (\d+(?:\.\d+)?)%\.?$", "setSC", 0.01, "기본 상태이상 확률 {v}%로"),
    # Devouring Attrition: 50% chance of +2000% on non-critical hits → non-critical hits deal 1 + 0.5 x 20 = 11x on average
    (r"^(\d+(?:\.\d+)?)% chance to deal \+(\d+(?:\.\d+)?)% damage on non-critical hits\.?$", "nc", None, "비치명타 공격 시 {g1}% 확률로 피해 +{g2}% (평균 {avg}배)"),
    (r"^Enemies suffering from fewer than 3 Status Effects will receive: \+(\d+(?:\.\d+)?)% Critical Damage\.?$", "cdFew", 0.01, "상태이상 2종 이하인 적에게 치명타 피해 +{v}% (모드 후 고정값)"),
    (r"^On Full Burst Hit: \+(\d+(?:\.\d+)?)% Damage, resets on Reload\.?$", "dmg", 0.01, "점사 전탄 명중 시 피해 +{v}% (서레이션과 합연산)"),
    (r"^\+(\d+(?:\.\d+)?)% Damage\.?$", "dmg", 0.01, "피해 +{v}% (서레이션과 합연산)"),
    # Dual Ichor evo II Ronin's Rush "On striking target with final move of Neutral Combo: +30% Attack Speed for 33s." — quick
    # melee (melee key alone) plays the Neutral Combo over and over, so on the normal-attack build the buff stays up
    (r"^On striking target with final move of Neutral Combo: \+(\d+)% Attack Speed for (\d+)s\.?$", "fr", 0.01, "공격 속도 +{v}% (퀵밀 = 기본 콤보 반복이라 상시, 일반 공격만)", "Normal Attack"),
    # melee Incarnon Form (Skana Incarnon note: "+100% damage is additive with other bonus damage sources like Pressure Point")
    (r"^\+(\d+(?:\.\d+)?)% Melee Damage\.?$", "dmg", 0.01, "근접 피해 +{v}% (프레셔 포인트와 합연산)"),
    (r"^Multishot consumes ammo directly from Capacity and increases Damage by \+(\d+(?:\.\d+)?)%\.?$", "evoMult", 0.01, "멀티샷이 탄약을 직접 소모, 피해 +{v}% (곱연산)"),
    (r"^Multishot consumes ammo directly from Capacity and increases Damage by \+(\d+(?:\.\d+)?)\.?$", "baseDmg", 1, "멀티샷이 탄약을 직접 소모, 기본 피해 +{v}"),
    (r"^Multishot consumes ammo directly from Capacity and does \+(\d+(?:\.\d+)?)% Damage\.?$", "evoMult", 0.01, "멀티샷이 탄약을 직접 소모, 피해 +{v}% (곱연산)"),
    (r"^On Firing: \+(\d+(?:\.\d+)?)% Multishot\. Stacks up to (\d+)x\.?$", "ms", "stack", "사격 중 멀티샷 +{v}%씩 최대 {g2}중첩 (계속 쏠 때 최대)"),
    (r"^On Firing: \+(\d+(?:\.\d+)?) Base Multishot\. Stacks up to (\d+)x\.?$", "basePellets", "stack1", "사격 중 기본 멀티샷 +{v}씩 최대 {g2}중첩 (계속 쏠 때 최대)"),
    (r"^With Critical Chance [Bb]elow (\d+)%: Increase Base Critical Damage Multiplier by \+(\d+(?:\.\d+)?)x?\.?$", "prelude", None, "치명타 확률 {g1}% 미만일 때 기본 치명타 배율 +{g2}"),
    (r"^Increase Base Status Chance by (\d+(?:\.\d+)?)% of current Critical Chance, up to (\d+(?:\.\d+)?)%\.?$", "wise", None, "현재 치명타 확률의 {g1}%만큼 기본 상태이상 확률 증가 (최대 {g2}%)"),
    (r"^Increase Base Critical Chance by (\d+(?:\.\d+)?)% of current Status Chance, up to (\d+(?:\.\d+)?)%\.?$", "highground", None, "현재 상태이상 확률의 {g1}%만큼 기본 치명타 확률 증가 (최대 {g2}%)"),
    (r"^\+(\d+(?:\.\d+)?)% Attack Speed per enemy within \d+m, stacks up to (\d+)x\.?$", "fr", "stackCrowd", "주변 적 1명당 공격 속도 +{v}% (최대 {g2}명, 무리 상대일 때)"),
]
# "With …:" conditions the calculator can check from its own inputs (armor, max energy, channeled ability, kills)
EVO_WHEN = [(r"^With Armor (?:Over|over|above) 450:\s*", "armor450", "방어력 450 초과 시"),
            (r"^With Energy Max (?:Over|over|above) 700:\s*", "energy700", "최대 에너지 700 초과 시"),
            (r"^With Channel+ed Ability [Aa]ctive:\s*", "cast", "채널링 어빌리티 사용 중"),
            (r"^On Kill: (?=.*for \d+s)", "kill", "처치 시"),
            (r"^On Reload [Ff]rom Empty(?: Magazine)?: (?=Increase Base Damage)", "always", "빈 탄창 재장전 후(계산 기준상 항상)"),
            (r"^On Punch Through Hit: (?=.*for \d+s)", "ptHit", "관통 명중 시"),
            (r"^With Sprint Speed 1\.2 or Higher:\s*", "sprint12", "질주 속도 1.2 이상일 때")]
EVO_NONE = [(r"Recoil", "반동"), (r"Accuracy", "정확도"), (r"Projectile Speed", "투사체 속도"), (r"Zoom", "확대율"), (r"Movement Speed", "이동 속도"),
            (r"^[+-]?\d+(?:\.\d+)? Range", "근접 사거리"), (r"Parry Angle", "막기 각도"), (r"Combo Duration", "연속기 지속시간"), (r"Slam Radius", "슬램 반경"),
            (r"Incarnon Transmutation", "인카논 충전"), (r"Magazine Reloaded", "보관 중 재장전")]
def evo_line(line):
    line = re.sub(r"([A-Za-z%.])\d$", r"\1", line.strip())      # footnote digit left over from the wiki markup
    for rx, when, wko in EVO_WHEN:
        m = re.match(rx, line)
        if m and line[m.end():].strip():
            inner = re.sub(r"\s*for \d+s\.?$", "", line[m.end():].strip())
            stk = re.search(r"\.\s*Stacks up to (\d+)x\.?$", inner)
            if stk and when == "always":
                r = evo_line(inner[:stk.start()] + ".")
                if r.get("key"): r = dict(r, v=round(r["v"] * int(stk.group(1)), 4), ko=r["ko"] + f" ({stk.group(1)}중첩)")
                inner = None
            if inner is not None: r = evo_line(inner)
            if r.get("key") and r["key"] in ("pt", "ms", "fr", "blastR", "cd", "cc", "sc", "dmg", "reload", "ammoEff", "baseCD", "baseCC", "baseDmg", "evoPst"):
                # base-stat changes under a condition are applied by the engine (cdBase/ccBase/baseAdd) when the condition holds
                k_ = {"baseCD": "cdBase", "baseCC": "ccBase", "baseDmg": "baseAdd"}.get(r["key"], r["key"])
                return dict(r, key=k_, when=when, ko=wko + ": " + r["ko"])
            return {"key": None, "cond": True, "ko": line}
    dbl = re.search(r"\.?\s*Effect doubles in Incarnon Form\.?$", line)
    if dbl:
        r = evo_line(line[:dbl.start()] + ".")
        if r.get("key"):
            return dict(r, incX2=True, ko=r["ko"] + " (인카논 형태에서 2배)")
    for rule in EVO_RULES:
        rx, key, mul, ko = rule[:4]
        m = re.match(rx, line.strip())
        if m:
            g = m.group(1); v = float(g); sv = g if g[0] in "+-" else "+" + g
            gs = m.groups()
            fmt = dict(v=m.group(1).lstrip("+"), s=sv, g1=gs[0], g2=gs[1] if len(gs) > 1 else "")
            if len(rule) > 4:                       # effect limited to one attack (e.g. Ronin's Rush: normal attacks)
                return {"key": key, "v": round(v * mul, 4), "ko": ko.format(**fmt), "atk": rule[4]}
            if key == "nc":
                p_, b_ = float(gs[0]) / 100, float(gs[1]) / 100
                return {"key": "nc", "v": round(p_ * b_, 4), "ko": ko.format(avg=f"{1 + p_ * b_:g}", **fmt)}
            if key == "prelude":
                return {"key": "prelude", "v": float(gs[1]), "below": float(gs[0]) / 100, "ko": ko.format(**fmt)}
            if key in ("wise", "highground"):
                return {"key": key, "v": float(gs[0]) / 100, "cap": float(gs[1]) / 100, "ko": ko.format(**fmt)}
            if mul == "stack":
                return {"key": key, "v": round(v * int(gs[1]) / 100, 4), "ko": ko.format(**fmt)}
            if mul == "stack1":
                return {"key": key, "v": round(v * int(gs[1]), 4), "ko": ko.format(**fmt)}
            if mul == "stackCrowd":
                return {"key": key, "v": round(v * int(gs[1]) / 100, 4), "when": "crowd", "ko": ko.format(**fmt)}
            return {"key": key, "v": round(v * mul, 4), "ko": ko.format(**fmt)}
    for rx, ko in EVO_NONE:
        if re.search(rx, line):
            return {"key": None, "ko": ko + " (피해 무관)"}
    return {"key": None, "cond": True, "ko": line}
EVOS = {}
try:
    EVOS = json.load(open(A + "incarnon_evos.json", encoding="utf-8"))
except Exception:
    EVOS = {}
def evo_form(line, notes):
    # a note limits a line to one form; when the note names a stat ("Multishot bonus does not affect the Incarnon form"),
    # only lines about that stat follow it
    if "for incarnon form" in line.lower(): return "inc"
    for n in notes:
        t = n.lower()
        kind = "normal" if re.search(r"not (?:affect|apply to) (?:the )?incarnon form", t) else "inc" if re.search(r"only (?:affects|applies to) (?:the )?incarnon form|incarnon form only", t) else None
        if not kind: continue
        subj = re.match(r"^(?:the )?([a-z ]+?) (?:bonus|buff|effect)?\s*(?:does|do|only)", t)
        word = subj.group(1).strip() if subj else ""
        if not word or word in ("the", "bonus", "this", "it", "effect") or word.split()[-1] in line.lower(): return kind
    return "both"
for W in weapons:
    E = EVOS.get(W.get("en"))
    if not E: continue
    tiers = []
    for t in E["tiers"]:
        perks = []
        for pk in t["perks"]:
            notes = pk.get("lines") and pk.get("notes") or []
            lines = []
            for l in pk.get("lines") or []:
                # "Increase Base Damage by +30. +50% Ammo Efficiency" → two lines (only when both halves parse)
                pre = next((m_.group(0) for rx_, _, _ in EVO_WHEN for m_ in [re.match(rx_, l)] if m_), "")
                bits = [pre + b.strip() for b in re.split(r"(?<=[\w%])\.\s+(?=[+\-A-Z])", l[len(pre):]) if b.strip()]
                lines += bits if len(bits) > 1 and all(evo_line(b).get("key") for b in bits) else [l]
            items = []
            flat = any(re.search(r"added after mods as a flat value", n_, re.I) for n_ in notes)
            for l in lines:
                it = dict(evo_line(l), form=evo_form(l, notes))
                if flat and it.get("key") in ("baseCC", "baseSC", "baseCD"):
                    it["key"] = {"baseCC": "ccFlat", "baseSC": "scFlat", "baseCD": "cdFlat"}[it["key"]]
                    it["ko"] += " (모드 적용 후 고정값으로 더함)"
                cap_ = next((int(m_.group(1)) for n_ in notes for m_ in [re.search(r"Caps at (\d+)x", n_)] if m_), None)
                if cap_ and it.get("key") == "dmg" and "resets on Reload" in l:
                    it["v"] = round(it["v"] * cap_, 4); it["ko"] += f" (최대 {cap_}중첩)"
                if it.pop("incX2", False) and it.get("key"):
                    items.append(dict(it, form="normal"))
                    it = dict(it, v=round(it["v"] * 2, 4), form="inc")
                items.append(it)
            # a condition line ("On Equip from Primary:") makes the following lines conditional too
            cond_on = False
            for it, l in zip(items, lines):
                if l.rstrip().endswith(":"): cond_on = True; it["key"] = None; it["cond"] = True; continue
                if cond_on and it.get("key"): it["key"] = None; it["cond"] = True
            for it in items:
                if it.get("form") == "both": del it["form"]
                if not it.get("key"): it.pop("key", None)
            perks.append({"name": pk["name"], "items": items})
        tiers.append({"tier": t["tier"], "perks": perks})
    # wiki Incarnon notes: Destreza "Bonus base damage is not applied to the melee or the spectral rapiers", Obex "Bonus base
    # damage does not function" — the Evo II base-damage line does nothing on these two
    if W.get("en") in ("Destreza", "Obex"):
        for t in tiers:
            if t["tier"] != 2: continue
            for pk in t["perks"]:
                for it in pk["items"]:
                    if it.get("key") == "baseDmg": it.pop("key"); it["ko"] = it["ko"] + " — 게임에서 적용 안 됨(위키)"; it["cond"] = True
    W["evos"] = tiers
    # Incarnon forms whose wiki notes say Punch Through does nothing (Torid "Punch Through mods have no effect on the behavior
    # of the beam", Kunai "Punch Through is ignored in Incarnon Form", Latron "does not affect the incarnon projectile",
    # Vectis "Punch Through is locked to 0 in Incarnon Form") — punch-through mods must not add targets there (v1.68)
    PT_NONE = r"Punch Through mods have no effect|Punch Through is ignored in Incarnon Form|Punch Through does not affect the incarnon|Punch Through is locked to 0 in Incarnon Form|can no longer Punch Through"
    if any(re.search(PT_NONE, n_) for t in E["tiers"] for pk in t["perks"] for n_ in (pk.get("notes") or [])):
        for at_ in W["attacks"]:
            if at_.get("inc") or (at_.get("parts") and at_["parts"][0].get("inc")):
                at_["ptLock"] = True
with open(os.path.join(OUT, "weapons_full.js"), "w", encoding="utf-8") as f:
    f.write("(function(root){root.WF_WEAPONS=" + json.dumps(weapons, ensure_ascii=False, separators=(",", ":"))
            + ";root.WF_MODULAR=" + json.dumps(MODULAR, ensure_ascii=False, separators=(",", ":")) + ";})(typeof self!=='undefined'?self:globalThis);\n")
# every weapon exilus (utility) mod, so the comparison inputs accept any of them (most have no damage effect)
XCOMPAT = {"Rifle": ("rifle", None), "Assault Rifle": ("rifle", ["Sniper", "Bow"]), "PRIMARY": ("rifle", None), "Sniper": ("rifle", "Sniper"), "Bow": ("rifle", "Bow"),
           "Shotgun": ("shotgun", None), "Pistol": ("pistol", None), "Melee": ("melee", None), "Thrown Melee": ("melee", None)}
xextra, seen_x = [], set()
for m in MODS:
    if not (m.get("isUtility") or m.get("isExilus")) or m.get("type") in ("Warframe Mod", "Peculiar Mod"):
        continue
    c = XCOMPAT.get(m.get("compatName"))
    if not c or m["name"] in seen_x:
        continue
    seen_x.add(m["name"])
    e = {"en": m["name"], "ko": (KO.get(m["uniqueName"]) or {}).get("name") or m["name"], "compat": c[0]}
    if isinstance(c[1], str):
        e["types"] = [c[1]]
    elif c[1]:
        e["notTypes"] = c[1]
    xextra.append(e)
# every weapon mod in the game (max-rank text) so nothing is missing; mods.js reads simple stat lines automatically
def clean(t):
    return re.sub(r"<[^>]+>", "", t).replace("\\n", "\n").strip()


def top_stats(x, ko_entry=None):
    ls = (ko_entry or x).get("levelStats") or []
    return [clean(t) for t in (ls[-1].get("stats") if ls else [])]


by_name = {}
for m in MODS:
    if m.get("type") not in ("Primary Mod", "Secondary Mod", "Shotgun Mod", "Melee Mod"):
        continue
    un = m["uniqueName"]
    prev = by_name.get(m["name"])
    # same name listed several times (Beginner/Expert copies): keep the plain one
    if prev and not re.search(r"(Beginner|Expert|Intermediate)$", prev["uniqueName"]) and re.search(r"(Beginner|Expert|Intermediate)$", un):
        continue
    by_name[m["name"]] = m
mods_all = []
for m in by_name.values():
    k = KO.get(m["uniqueName"]) or {}
    e = {"en": m["name"], "ko": k.get("name") or m["name"], "c": m.get("compatName") or "", "t": m["type"], "s": top_stats(m)}
    kd = top_stats(m, k) if k.get("levelStats") else []
    if kd:
        e["kd"] = kd
    if m.get("isAugment"):
        e["a"] = 1
    if m.get("isUtility") or m.get("isExilus"):
        e["u"] = 1
    if m.get("baseDrain") is not None:
        e["d"] = (m.get("baseDrain") or 0) + (m.get("fusionLimit") or 0)     # capacity drain at max rank
        e["p"] = m.get("polarity") or ""
        e["f"] = m.get("fusionLimit") or 0                                   # max rank (rank pips on the card)
        e["r"] = {"Common": "c", "Uncommon": "u", "Rare": "r", "Legendary": "l", "Peculiar": "r", "Amalgam": "r"}.get(m.get("rarity") or "", "")
    mods_all.append(e)
# every arcane a warframe can equip
frame_arcs, seen_a = [], set()
for a_ in ARCS:
    if a_.get("type") not in ("Warframe Arcane", "Arcane") or a_["name"] in seen_a:
        continue
    st_ = top_stats(a_)
    if not st_ or not st_[0]:
        continue
    seen_a.add(a_["name"])
    k = KO.get(a_["uniqueName"]) or {}
    frame_arcs.append({"en": a_["name"], "ko": k.get("name") or a_["name"], "s": st_, "kd": top_stats(a_, k) if k.get("levelStats") else st_})
# mods that can't be equipped together (wiki Module:Mods/data "Incompatible"): the full module when it was downloaded,
# else the weapon-mod pairs saved in data/raw/wiki_mod_incompat.json
excl = {}
def _pair(a, b):
    if a and b and a != b:
        excl.setdefault(a, set()).add(b); excl.setdefault(b, set()).add(a)
_lua = os.path.join(A, "wiki_mods.lua")
if os.path.exists(_lua):
    _t = open(_lua, encoding="utf-8", errors="replace").read()
    for _m in re.finditer(r'\["([^"\]]+)"\] = \{([\s\S]*?)\n\t\t\}', _t):
        _b = re.search(r'\n\t\t\tIncompatible = \{([^}]*)\}', _m.group(2))
        if _b:
            for _x in re.findall(r'"([^"]+)"', _b.group(1)):
                if not re.search(r"Riven Mod$", _m.group(1)):
                    _pair(_m.group(1), _x)
_js = os.path.join(A, "wiki_mod_incompat.json")
if os.path.exists(_js):
    for _p in json.load(open(_js, encoding="utf-8")).get("pairs", []):
        _pair(*_p.split("|", 1))
excl = {k: sorted(v) for k, v in excl.items()}
print("incompatible mod entries", len(excl))
with open(os.path.join(OUT, "mods_ko.js"), "w", encoding="utf-8") as f:
    f.write("(function(root){root.WF_KO=" + json.dumps(mod_ko, ensure_ascii=False, separators=(",", ":"))
            + ";root.WF_EXILUS_EXTRA=" + json.dumps(xextra, ensure_ascii=False, separators=(",", ":"))
            + ";root.WF_MODS_ALL=" + json.dumps(mods_all, ensure_ascii=False, separators=(",", ":"))
            + ";root.WF_FRAME_ARC_ALL=" + json.dumps(frame_arcs, ensure_ascii=False, separators=(",", ":"))
            + ";root.WF_MOD_EXCL=" + json.dumps(excl, ensure_ascii=False, separators=(",", ":"))
            + ";})(typeof self!=='undefined'?self:globalThis);\n")
print("mods_all", len(mods_all), "frame arcanes", len(frame_arcs))
from collections import Counter
print(len(weapons), Counter(w["cls"] for w in weapons), Counter(a["kind"] for w in weapons for a in w["attacks"]))
print(os.path.getsize(os.path.join(OUT, "weapons_full.js")), os.path.getsize(os.path.join(OUT, "mods_ko.js")))
