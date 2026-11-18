import json, sys, itertools
D3 = 0.09180544706470489
def V(c,d3=False,k=False,f=None):
    v={"v":("%s c%s%s%s"%((f[0] if f else ""),str(c)[1:],"d3" if d3 else "","k" if k else "")).strip(),"pel":c/0.05}
    o={}
    if d3: o["density"]=D3
    if k: o["killRamp"]=False
    if o: v["o"]=o
    if f: v["factions"]=[f]
    return v
VARS=[V(.01),V(.005),V(.005,True),V(.003),V(.003,True),V(.002),V(.002,True),V(.001,True),V(.003,k=True),V(.003,f="grineer"),V(.003,f="corpus"),V(.003,f="infested")]
BASE={"ms":1.197,"cd":0.9,"fr":0.9,"sd":0.9}
def RIV(keys): return [[k, BASE[k]*1.2*0.9375*1.1] for k in keys]
CORE=["Riven","Galvanized Hell","Critical Deceleration","Primed Ravage","Shotgun Barrage"]
POOL=["Frail Momentum","Galvanized Savvy","Primed Chilling Grasp","Primed Point Blank","Shotgun Elementalist","Primed Charged Shell","Vicious Spread","Toxic Barrage","Frigid Blast","Shell Shock","Scattering Inferno","Accelerated Blast","Vigilante Armaments","Contagious Spread"]
ABB={"Frail Momentum":"Frail","Galvanized Savvy":"Savvy","Primed Chilling Grasp":"PCG","Primed Point Blank":"PPB","Shotgun Elementalist":"Elem","Primed Charged Shell":"PCS","Vicious Spread":"Vic","Toxic Barrage":"ToxB","Frigid Blast":"Frig","Shell Shock":"ShSh","Scattering Inferno":"ScInf","Accelerated Blast":"AccB","Vigilante Armaments":"Vig","Contagious Spread":"ContS"}
rk=tuple(sys.argv[3].split("+")) if len(sys.argv)>3 else ("ms","fr","cd")
B=[]
for t in itertools.combinations(POOL,3):
    B.append({"n":"+".join(ABB[x] for x in t),"mods":CORE+list(t),"arcane":"primary_merciless","rivStats":RIV(rk)})
N=int(sys.argv[1])
for i in range(N):
    part=[b for k,b in enumerate(B) if k%N==i]
    json.dump([{"name":"combo%d"%i,"cfg":"boar","evo":{"2":0,"3":0,"4":1},"vars":VARS,"builds":part}],open("%s/jobG_%s_%d.json"%(sys.argv[2],"".join(rk),i),"w"),ensure_ascii=False)
print(len(B),[v["v"] for v in VARS],rk)
