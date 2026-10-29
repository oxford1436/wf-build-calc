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


FORCED = {"Impact": "impact", "Puncture": "punct", "Slash": "slash", "Heat": "heat", "Cold": "cold", "Electricity": "elec",
          "Toxin": "tox", "Blast": "blast", "Radiation": "rad", "Gas": "gas", "Magnetic": "mag", "Viral": "viral", "Corrosive": "corr", "Void": "void"}


def wiki_traits(at, wa):
    """Hidden per-attack traits from the wiki database: guaranteed status procs and headshot multiplier changes."""
    fp = [FORCED[x] for x in (wa.get("ForcedProcs") or []) if x in FORCED]
    if fp:
        at["forced"] = fp
    if wa.get("ExtraHeadshotDmg"):
        at["hsMult"] = max(1, 2 + float(wa["ExtraHeadshotDmg"]))


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
                if a.get("charge_time"):
                    at["charge"] = a["charge_time"]
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
            for x in base:
                if x["kind"] != "radial":
                    continue
                partners = [y for y in base if y["kind"] == "gun" and core(y["en"]) == core(x["en"]) and abs(y["fr"] - x["fr"]) < 0.05]
                if not partners and core(x["en"]) == "":
                    partners = [y for y in base if y["kind"] == "gun" and abs(y["fr"] - x["fr"]) < 0.05]
                if partners:
                    y = partners[0]
                    # wiki "Punch Through": projectiles with an AoE part explode on first contact — punch through can't apply
                    if y.get("_shot") == "Projectile":
                        y["ptLock"] = True
                    cname = "기본 사격 전체 피해 (직격 + 폭발)" if y["en"] == "Normal Attack" else (y["name"].replace(" 직격", "").replace("직격", "").strip() or y["name"]) + " 한 발 전체 피해 (직격 + 폭발)"
                    combos.append({"name": cname, "en": y["en"] + "+" + x["en"], "kind": "gun", "desc": "한 발의 직격과 폭발 피해를 합쳐서 계산",
                                   "parts": [y, x], "dmg": y["dmg"], "cc": y["cc"], "cd": y["cd"], "sc": y["sc"], "fr": y["fr"],
                                   "pellets": pellets, "mag": y["mag"], "reload": y["reload"], "semi": y.get("semi", False), "ptLock": bool(y.get("ptLock"))})
            for x in base:
                x.pop("_shot", None)
            W["attacks"] = combos + base
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
                atks.append({"name": "일반 공격 (휘두르기, 연속기 빌드)", "en": "Normal Attack", "kind": "melee", "desc": "연속기 12배를 유지하며 휘두르는 운용. 블러드 러시·위핑 운즈·컨디션 오버로드가 여기서 힘을 냅니다", "dmg": nd, "cc": cc, "cd": cd, "sc": sc, "fr": norm.get("speed") or w.get("fireRate") or 1})
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
        W = conv(w, w.get("type"))
        if W:
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
with open(os.path.join(OUT, "mods_ko.js"), "w", encoding="utf-8") as f:
    f.write("(function(root){root.WF_KO=" + json.dumps(mod_ko, ensure_ascii=False, separators=(",", ":"))
            + ";root.WF_EXILUS_EXTRA=" + json.dumps(xextra, ensure_ascii=False, separators=(",", ":"))
            + ";root.WF_MODS_ALL=" + json.dumps(mods_all, ensure_ascii=False, separators=(",", ":"))
            + ";root.WF_FRAME_ARC_ALL=" + json.dumps(frame_arcs, ensure_ascii=False, separators=(",", ":"))
            + ";})(typeof self!=='undefined'?self:globalThis);\n")
print("mods_all", len(mods_all), "frame arcanes", len(frame_arcs))
from collections import Counter
print(len(weapons), Counter(w["cls"] for w in weapons), Counter(a["kind"] for w in weapons for a in w["attacks"]))
print(os.path.getsize(os.path.join(OUT, "weapons_full.js")), os.path.getsize(os.path.join(OUT, "mods_ko.js")))
