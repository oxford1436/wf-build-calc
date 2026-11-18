# Boar Prime (Cyte-09 wall spray) — electric build E, sparse-hit conditions (c from the spread geometry) — v2.20
import json, sys, itertools
D3 = 0.09180544706470489
def V(c,d3=False,k=False,f=None,name=None):
    v={"v":name or ("%s c%s%s%s"%((f[0] if f else ""),str(c)[1:],"d3" if d3 else "","k" if k else "")).strip(),"pel":c/0.05}
    o={}
    if d3: o["density"]=D3
    if k: o["killRamp"]=False
    if o: v["o"]=o
    if f: v["factions"]=[f]
    return v
VARS=[V(.01),V(.005),V(.005,True),V(.003),V(.003,True),V(.002),V(.002,True),V(.001,True),V(.003,k=True),V(.003,f="grineer"),V(.003,f="corpus"),V(.003,f="infested")]
ND={"v":"c.003 noDir","pel":0.06,"o":{"xhitNoDirect":True}}
OLD={"v":"c.003 v2.20","pel":0.06,"o":{"xhitOld":True}}
VARS+= [ND,OLD]
E=["Riven","Galvanized Hell","Critical Deceleration","Primed Ravage","Shotgun Barrage","Frail Momentum","Shotgun Elementalist","Primed Charged Shell"]
EP=["Riven","Galvanized Hell","Critical Deceleration","Primed Ravage","Shotgun Barrage","Primed Point Blank","Shotgun Elementalist","Primed Charged Shell"]
Aold=["Riven","Galvanized Hell","Critical Deceleration","Primed Ravage","Shotgun Barrage","Frail Momentum","Galvanized Savvy","Primed Chilling Grasp"]
ARC="primary_merciless"
BASE={"dur":0.9999,"dmg":1.647,"ms":1.197,"cc":0.9,"cd":0.9,"heat":0.9,"cold":0.9,"elec":0.9,"tox":0.9,"impact":1.1997,"punct":1.1997,"slash":1.1997,"sc":0.9,"dur":0.9999,"fr":0.9,
      "reload":0.49995,"mag":0.49995,"fac_g":0.45,"fac_c":0.45,"fac_i":0.45,"x_ammo":0.9,"x_zoom":0.41994,"x_recoil":0.9,"x_speed":0.9,"sd":0.9,"ammoeff":0.45,"corrm":0.9,"magm":0.9,"radm":0.9,"viralm":0.9}
def pos(k,w=1.1,form=0.9375): return [k, BASE[k]*1.2*form*w]
def neg(k,w=1.1): return [k, -BASE[k]*1.2*0.75*w]
def rs(keys,w=1.1,negk=None,ws=None):
    out=[pos(k,(ws or {}).get(k,w)) for k in keys]
    if negk: out.append(neg(negk))
    return out
def sw(a,b,mods):
    m=list(mods); m[m.index(a)]=b; return m
B=[]
def add(n,mods=E,arc=ARC,riv=("ms","fr","cd"),rivStats=None):
    b={"n":n,"mods":list(mods),"arcane":arc}
    if rivStats is not None: b["rivStats"]=rivStats
    elif riv and "Riven" in mods: b["rivStats"]=rs(riv)
    B.append(b)
which=sys.argv[1]; jobs=[]
def job(name,evo={"2":0,"3":0,"4":1},**kw):
    j={"name":name,"cfg":"boar","evo":evo,"vars":VARS,"builds":list(B)}; j.update(kw); jobs.append(j)
if which=="slots":
    add("E FINAL"); add("A (11-17)",Aold)
    add("E (PPB, 1차안)",EP)
    alts={"Riven":["Accelerated Blast","Primed Point Blank","Vigilante Armaments","Vicious Spread"],
      "Galvanized Hell":["Hell's Chamber","Primed Point Blank","Vigilante Armaments"],
      "Critical Deceleration":["Blunderbuss","Primed Point Blank","Accelerated Blast"],
      "Primed Ravage":["Primed Point Blank","Accelerated Blast","Vigilante Armaments","Galvanized Savvy","Primed Cleanse Grineer","Primed Cleanse Corpus","Primed Cleanse Infested","Cleanse Grineer","Cleanse Corpus","Cleanse Infested"],
      "Shotgun Barrage":["Accelerated Blast","Primed Point Blank","Vigilante Armaments"],
      "Frail Momentum":["Primed Point Blank","Vicious Spread","Accelerated Blast","Vigilante Armaments","Galvanized Savvy","Primed Cleanse Grineer","Primed Cleanse Corpus","Primed Cleanse Infested"],
      "Shotgun Elementalist":["Primed Point Blank","Primed Chilling Grasp","Accelerated Blast","Galvanized Savvy","Vicious Spread","Lingering Torment"],
      "Primed Charged Shell":["Primed Point Blank","Primed Chilling Grasp","Charged Shell","Shell Shock","Accelerated Blast","Toxic Barrage","Galvanized Savvy"]}
    for a,l in alts.items():
        for b in l: add(a+">"+b, sw(a,b,E), riv=("ms","fr","cd") if a!="Riven" else None)
    job("E slots")
elif which=="riven":
    add("E max"); add("all mid",rivStats=rs(("ms","fr","cd"),1.0)); add("all min",rivStats=rs(("ms","fr","cd"),0.9))
    for k in ("ms","fr","cd"): add(k+" min, rest max",rivStats=rs(("ms","fr","cd"),ws={k:0.9}))
    keys=("ms","fr","cd","cc","dmg","elec","sd","sc","dur")
    for t in itertools.combinations(keys,3):
        if t==("ms","fr","cd"): continue
        add("+".join(t),rivStats=rs(t))
    for k in ("tox","cold","heat","mag","fac_g","corrm","magm","radm","ammoeff"): add("ms+fr+"+k,rivStats=rs(("ms","fr",k)))
    for t in (("ms","fr","sd"),("ms","sd","cd"),("ms","fr","dur")):
        add("mid "+"+".join(t),rivStats=rs(t,1.0)); add("min "+"+".join(t),rivStats=rs(t,0.9))
    for k in ("x_zoom","reload","punct","slash","impact","heat","cold","tox","sc","dur","cc","cd","mag"): add("ms+fr+sd neg "+k,rivStats=rs(("ms","fr","sd"),negk=k))
    add("3+0 ms+fr+cd",rivStats=[pos(k,1.1,0.75) for k in ("ms","fr","cd")])
    add("2+1 ms+fr",rivStats=[pos(k,1.1,1.2375) for k in ("ms","fr")]); add("2+1 ms+cd",rivStats=[pos(k,1.1,1.2375) for k in ("ms","cd")])
    for k in ("x_zoom","x_recoil","reload","x_ammo","mag","punct","slash","impact","heat","tox","cold","elec","sc","dur","fac_g","fac_c","fac_i","cc","cd","dmg"): add("neg "+k,rivStats=rs(("ms","fr","cd"),negk=k))
    add("no riven: Accelerated Blast",sw("Riven","Accelerated Blast",E),riv=None)
    job("E riven")
elif which=="arc":
    add("E FINAL")
    for a in ("primary_plated_round","primary_overcharge","primary_deadhead","primary_blight","primary_frostbite","primary_debilitate",None): add("arc "+str(a),arc=a)
    add("A merciless",Aold); add("A plated",Aold,arc="primary_plated_round")
    job("E arc")
elif which=="evo":
    add("E"); add("A",Aold); add("E riv ms+fr+sd",riv=("ms","fr","sd")); add("E riv ms+fr+sc",riv=("ms","fr","sc"))
    for e2 in (0,1):
        for e4 in (0,1,2): job("evo II=%d IV=%d"%(e2,e4),{"2":e2,"3":0,"4":e4})
elif which=="elem":
    add("E"); add("A",Aold); add("E PCS>Toxic Barrage",sw("Primed Charged Shell","Toxic Barrage",E)); add("E PCS>Primed Chilling Grasp",sw("Primed Charged Shell","Primed Chilling Grasp",E)); add("A PCG>Toxic Barrage",sw("Primed Chilling Grasp","Toxic Barrage",Aold))
    for el in ("elec","mag","corr","viral","heat","rad","tox","cold","gas","blast"):
        job("resupply "+el,patch={"weapons":{"boar_prime":{"atk":"Normal Attack","pelletsMul":0.05,"fo":None,"noSpread":True}},"defaults":{"hits":{"기본 사격":12},"tAcq":0.01},"resupplyElem":el})
elif which=="cast":
    add("E"); add("A",Aold); add("E Elem>PPB (no magazine mod)",sw("Shotgun Elementalist","Primed Point Blank",E)); add("E Frail>Primed Ammo Stock",sw("Frail Momentum","Primed Ammo Stock",E)); add("E Frail>PPB",EP)
    add("E riv ms+fr+ammoeff",riv=("ms","fr","ammoeff")); add("E riv ms+cd+ammoeff",riv=("ms","cd","ammoeff")); add("E riv ms+fr+mag",riv=("ms","fr","mag")); add("E neg mag",rivStats=rs(("ms","fr","cd"),negk="mag"))
    add("A riv ms+fr+ammoeff",Aold,riv=("ms","fr","ammoeff"))
    job("cast 0"); job("cast 0.15",cast="0.15"); job("cast 0.3",cast="0.3")
json.dump(jobs,open(sys.argv[2],"w"),ensure_ascii=False)
print(which,len(B),"builds",len(jobs),"jobs",[v["v"] for v in VARS])
