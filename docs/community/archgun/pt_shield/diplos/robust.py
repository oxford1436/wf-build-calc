import itertools, functools, random
import opt
from opt import *
M['HC']={'el':('heat',.9)}
_e=opt.enervate_avg
@functools.lru_cache(maxsize=None)
def e_proj(cc): return _e(cc,0,n=80000)
@functools.lru_cache(maxsize=None)
def e_shot(cc,ms):
    # alt reading: +1 stack per shot (multishot = one hit), big crits counted per projectile
    r=random.Random(2); st=0; big=0; acc=0; n=40000
    for _ in range(n):
        c=cc+0.1*st; acc+=c
        k=int(ms)+(1 if r.random()<ms-int(ms) else 0)
        for _ in range(k):
            tier=int(c)+(1 if r.random()<c-int(c) else 0)
            if tier>=2: big+=1
        st+=1
        if big>=6: st=0; big=0
    return acc/n-cc
def ev(mods,riv,val,mode,fury):
    opt.enervate_avg={'proj':lambda cc,ms,**k:e_proj(round(cc,3)),'shot':lambda cc,ms,**k:e_shot(round(cc,3),round(ms,2))}.get(mode,lambda cc,ms,**k:0)
    riv=['riv:'+r for r in riv]
    elsrc=[x for x in mods if 'el' in M[x]]+[r for r in riv if r[4:] in ('heat','cold','electricity','toxin')]
    rest=[x for x in mods if x not in elsrc]+[r for r in riv if r not in elsrc]
    b=None
    for p in itertools.permutations(elsrc):
        t,st,sh=build(mods,riv,val=(val,.6),order=list(p)+rest,fury=fury,ener=mode!='none')
        if 'cold' not in t or 'radiation' not in t: continue
        sc=t['cold']+t['radiation']
        if b is None or sc<b[0]: b=(sc,t,st,p)
    return b
F=2.75*STR
cands={
 'A prior':('radiation',['GD','LT','CB','PTC','PEC','HS','DF'],['cc','cd','ms']),
 'R1 rad+Ener':('radiation',['LT','PTC','PEC','AA','DF','PHC','CV'],['cd','ms','cold']),
 'R2 rad+Ener GD':('radiation',['GD','LT','PTC','PEC','DF','PHC','CV'],['cd','ms','cold']),
 'R3 rad noarc':('radiation',['LT','CB','PTC','PEC','DF','PHC','CV'],['cc','ms','cold']),
 'C1 cold+Ener':('cold',['GD','LT','PTC','PEC','AA','PHC','CV'],['cd','ms','cold']),
 'C2 cold+Ener':('cold',['LT','PTC','PEC','AA','DF','PHC','CV'],['cd','ms','cold']),
 'C3 cold noarc':('cold',['LT','CB','PTC','PEC','AA','PHC','CV'],['cc','ms','cold']),
 'C4 cold GD CB':('cold',['GD','LT','CB','PTC','PEC','PHC','CV'],['cc','ms','cold']),
 'C5 cold GD CB AA':('cold',['GD','LT','CB','PTC','PEC','AA','PHC'],['cc','ms','electricity']),
 'C6 cold cd riv CB':('cold',['GD','LT','CB','PTC','PEC','AA','PHC'],['cd','ms','electricity']),
 'C7 cold GD AA cdms el':('cold',['GD','LT','PTC','PEC','AA','DF','PHC'],['cd','ms','electricity']),
}
scen=[('Fmax proj','proj',F),('Fmax shot','shot',F),('Fmax none','none',0+F),('Fhalf proj','proj',F/2),('F0 proj','proj',0)]
res={}
for sn,mode,fury in scen:
    vals={n:ev(m,r,v,mode,fury) for n,(v,m,r) in cands.items()}
    best=min(b[0] for b in vals.values())
    for n,b in vals.items(): res.setdefault(n,{})[sn]=(best/b[0]*100,b)
print('candidate'.ljust(24),' '.join(s[0].ljust(11) for s in scen),' min')
for n in cands:
    row=[res[n][s[0]][0] for s in scen]
    print(n.ljust(24),' '.join(f'{x:6.1f}%    ' for x in row), f'{min(row[:4]):.1f}')
print()
for n in ['C1 cold+Ener','C2 cold+Ener','R1 rad+Ener','C4 cold GD CB','A prior']:
    b=res[n]['Fmax proj'][1]; t=b[1]
    print(n, 'cold',round(t['cold'],3),'rad',round(t['radiation'],3),'imp',round(t['impact'],2),'punc',round(t['puncture'],2),'sla',round(t['slash'],2), b[2], b[3])
