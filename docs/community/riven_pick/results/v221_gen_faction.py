import json, sys, itertools
D3 = 0.09180544706470489
def V(c,d3,f): 
    v={"v":"%s c%s%s"%(f[0],str(c)[1:],"d3" if d3 else ""),"pel":c/0.05,"factions":[f]}
    if d3: v["o"]={"density":D3}
    return v
CONDS=[(.01,False),(.005,False),(.005,True),(.003,False),(.003,True),(.002,True)]
VARS=[V(c,d,f) for f in ("grineer","corpus","infested") for c,d in CONDS]
BASE={"ms":1.197,"cd":0.9,"fr":0.9}
RIV=[[k, BASE[k]*1.2*0.9375*1.1] for k in ("ms","fr","cd")]
CORE=["Riven","Galvanized Hell","Critical Deceleration","Primed Ravage","Shotgun Barrage"]
POOL=["Frail Momentum","Galvanized Savvy","Primed Chilling Grasp","Primed Point Blank","Shotgun Elementalist","Primed Charged Shell","Toxic Barrage","Vicious Spread"]
CL=["Primed Cleanse Grineer","Primed Cleanse Corpus","Primed Cleanse Infested"]
ABB={"Frail Momentum":"Frail","Galvanized Savvy":"Savvy","Primed Chilling Grasp":"PCG","Primed Point Blank":"PPB","Shotgun Elementalist":"Elem","Primed Charged Shell":"PCS","Toxic Barrage":"ToxB","Vicious Spread":"Vic","Primed Cleanse Grineer":"ClG","Primed Cleanse Corpus":"ClC","Primed Cleanse Infested":"ClI"}
B=[]
for t in itertools.combinations(POOL,3): B.append(t)
for c in CL:
    for t in itertools.combinations(POOL,2): B.append(t+(c,))
builds=[{"n":"+".join(ABB[x] for x in t),"mods":CORE+list(t),"arcane":"primary_merciless","rivStats":RIV} for t in B]
els=sys.argv[1].split(",")
jobs=[{"name":"resupply "+el,"cfg":"boar","evo":{"2":0,"3":0,"4":1},"vars":VARS,"builds":builds,
       "patch":{"weapons":{"boar_prime":{"atk":"Normal Attack","pelletsMul":0.05,"fo":None,"noSpread":True}},"defaults":{"hits":{"기본 사격":12},"tAcq":0.01},"resupplyElem":el}} for el in els]
json.dump(jobs,open(sys.argv[2],"w"),ensure_ascii=False); print(len(builds),len(VARS),els)
