import json, sys, itertools
D3 = 0.09180544706470489
def V(c,d3=False,name=None,**o):
    v={"v":name or "c%s%s"%(str(c)[1:],"d3" if d3 else ""),"pel":c/0.05}
    oo=dict(o)
    if d3: oo["density"]=D3
    if oo: v["o"]=oo
    return v
VARS=[V(.01),V(.005),V(.003),V(.003,True),V(.002,True),V(.001,True),V(.003,name="c.003 noDir",xhitNoDirect=True),V(.02)]
BASE={"ms":1.197,"cd":0.9,"fr":0.9,"sd":0.9}
def RIV(keys): return [[k, BASE[k]*1.2*0.9375*1.1] for k in keys]
CORE=["Riven","Galvanized Hell","Critical Deceleration","Shotgun Barrage"]
POOL=["Primed Ravage","Frail Momentum","Galvanized Savvy","Primed Chilling Grasp","Primed Point Blank","Shotgun Elementalist","Primed Charged Shell","Toxic Barrage","Vicious Spread","Frigid Blast","Contagious Spread","Shell Shock","Accelerated Blast","Vigilante Armaments","Scattering Inferno"]
ABB={"Primed Ravage":"Rav","Frail Momentum":"Frail","Galvanized Savvy":"Savvy","Primed Chilling Grasp":"PCG","Primed Point Blank":"PPB","Shotgun Elementalist":"Elem","Primed Charged Shell":"PCS","Vicious Spread":"Vic","Toxic Barrage":"ToxB","Frigid Blast":"Frig","Shell Shock":"ShSh","Scattering Inferno":"ScInf","Accelerated Blast":"AccB","Vigilante Armaments":"Vig","Contagious Spread":"ContS"}
rk=tuple(sys.argv[3].split("+")); arcs=sys.argv[4].split(",")
B=[]
for t in itertools.combinations(POOL,4):
    for a in arcs:
        B.append({"n":a.replace("primary_","")[:4]+" "+"+".join(ABB[x] for x in t),"mods":CORE+list(t),"arcane":a,"rivStats":RIV(rk)})
N=int(sys.argv[1])
for i in range(N):
    part=[b for k,b in enumerate(B) if k%N==i]
    json.dump([{"name":"c4_%d"%i,"cfg":"boar","evo":{"2":0,"3":0,"4":1},"vars":VARS,"builds":part}],open("%s/jobK_%s_%d.json"%(sys.argv[2],"".join(rk),i),"w"),ensure_ascii=False)
print(len(B),[v["v"] for v in VARS])
