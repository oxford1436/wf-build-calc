# Tenet Diplos for Profit-Taker shield: optimise cold + radiation chunk time (Diplos' job in the kit)
import itertools, random, sys
CHUNK=162645; STR=2.98
RB_FR=0.6; TB_CD=1.2
BASE={'impact':11.2,'puncture':9.0,'slash':7.8}; B0=28.0
M={ # max-rank values (game data Mods.json)
 'GD':{'ms':1.1},'BD':{'ms':1.2},'LT':{'ms':.6,'fr':.6},'CB':{'cc':2.0,'fr':-.2},'PG':{'cc':1.2},'PPG':{'cc':1.87},
 'PTC':{'cd':1.1},'HP':{'cd':.6,'dmg':-.15},'PEC':{'fac':.55},'HS':{'dmg':2.2},'AP':{'dmg':.9},
 'AA':{'fr':.9,'dmg':-.15},'GS':{'fr':.72},
 'DF':{'el':('cold',.9)},'PHC':{'el':('heat',1.65)},'CV':{'el':('electricity',.9)},
}
INC=[{'GD','BD'},{'CB','PG'},{'CB','PPG'},{'PG','PPG'}]
RIVB={'cc':1.4999,'cd':.9,'ms':1.197,'dmg':2.196,'fr':.747,'fac':.45,'heat':.9,'cold':.9,'electricity':.9,'toxin':.9}
def rv(k): return RIVB[k]*1.2*0.9375*1.1   # disposition 1.2, 3 pos + neg, top roll
COMB={frozenset(['heat','cold']):'blast',frozenset(['cold','toxin']):'viral',frozenset(['heat','toxin']):'gas',
      frozenset(['electricity','toxin']):'corrosive',frozenset(['heat','electricity']):'radiation',frozenset(['cold','electricity']):'magnetic'}
def combine(els):
    # els: ordered list of (type, value); same type merges into first occurrence; consecutive distinct singles pair (wiki Damage)
    order=[];pool={}
    for t,v in els:
        if t not in pool: order.append(t); pool[t]=0
        pool[t]+=v
    out={};i=0
    while i<len(order):
        if i+1<len(order):
            out[COMB[frozenset(order[i:i+2])]]=pool[order[i]]+pool[order[i+1]]; i+=2
        else: out[order[i]]=pool[order[i]]; i+=1
    return out
def enervate_avg(cc, ms, n=200000, seed=1):
    # Secondary Enervate r5: +10% crit chance per hit, reset after 6 big crits (orange+); projectile multishot = separate hits (wiki)
    r=random.Random(seed); st=0; big=0; acc=0.0
    for _ in range(n):
        c=cc+0.1*st
        tier=int(c)+(1 if r.random()<c-int(c) else 0)
        acc+=c
        st+=1
        if tier>=2:
            big+=1
            if big>=6: st=0; big=0
    return acc/n-cc
def build(mods, riv, val=('radiation',.6), fury=2.75*STR, ener=False, order=None):
    s={'ms':0,'fr':RB_FR,'cc':0,'cd':0,'fac':0,'dmg':0}; els=[]
    seq=order or (list(riv)+list(mods))
    for x in seq:
        if x in M:
            for k,v in M[x].items():
                if k=='el': els.append(v)
                else: s[k]+=v
        else:
            k=x[4:]  # 'riv:cc'
            if k in ('heat','cold','electricity','toxin'): els.append((k,rv(k)))
            else: s[k]+=rv(k)
    eff=1+s['dmg']+fury
    tot=B0*(1+val[1])
    per={t:v*eff for t,v in BASE.items()}
    per[val[0]]=per.get(val[0],0)+B0*val[1]*eff
    for t,v in combine(els).items(): per[t]=per.get(t,0)+tot*v*eff
    ms=1+s['ms']; cc=.36*(1+s['cc']); cd=2.2*(1+s['cd'])+TB_CD; fr=9.67*(1+s['fr']); fac=1+s['fac']
    if ener: cc+=enervate_avg(cc,ms)
    k=ms*(1+cc*(cd-1))*fac*fr
    t={x:CHUNK/(v*k) for x,v in per.items()}
    shots={x:CHUNK/(v*ms*(1+cc*(cd-1))*fac) for x,v in per.items()}
    return t,dict(ms=round(ms,2),cc=round(cc,3),cd=round(cd,2),fr=round(fr,1),fac=round(fac,2)),shots
def ok(ms):
    S=set(ms)
    return all(not p<=S for p in INC)
