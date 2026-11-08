# Enervate per wiki notes: projectiles of one shot on one target register as one hit (grace period);
# big crits within one game tick count once for the reset counter; triggers capped at 30/s.
import functools, random, itertools
import robust, opt
from robust import F, M, ok, cands
@functools.lru_cache(maxsize=None)
def e_tick(cc, ms, fr):
    r=random.Random(3); st=0; big=0; acc=0; n=60000
    cap=min(1.0, 30.0/fr)            # fraction of shots that can add a stack (30 triggers/s)
    for _ in range(n):
        c=cc+0.1*st; acc+=c
        k=int(ms)+(1 if r.random()<ms-int(ms) else 0)
        anybig=any(int(c)+(1 if r.random()<c-int(c) else 0)>=2 for _ in range(k))
        if r.random()<cap:
            st+=1
            if anybig: big+=1
        if big>=6: st=0; big=0
    return acc/n-cc
def ev(mods,riv,val,fury=F,mode='tick'):
    # need fire rate before enervate -> compute via build without ener first
    riv2=['riv:'+x for x in riv]
    elsrc=[x for x in mods if 'el' in M[x]]+[q for q in riv2 if q[4:] in ('heat','cold','electricity','toxin')]
    rest=[x for x in mods if x not in elsrc]+[q for q in riv2 if q not in elsrc]
    b=None
    for p in itertools.permutations(elsrc):
        t0,st0,_=opt.build(mods,riv2,val=(val,.6),order=list(p)+rest,fury=fury,ener=False)
        if mode=='tick':
            opt.enervate_avg=lambda cc,ms,**k: e_tick(round(cc,3),round(ms,2),round(st0['fr'],1))
        t,st,sh=opt.build(mods,riv2,val=(val,.6),order=list(p)+rest,fury=fury,ener=(mode=='tick'))
        if 'cold' not in t or 'radiation' not in t: continue
        sc=t['cold']+t['radiation']
        if b is None or sc<b[0]: b=(sc,t,st,p)
    return b
if __name__=='__main__':
    print('e_tick 0.36 ms4.18 fr30', round(e_tick(0.36,4.18,30.0),3), ' fr21.3', round(e_tick(0.36,4.18,21.3),3), ' cc1.748', round(e_tick(1.748,4.18,19.3),3))
    rows={n:ev(m,r,v) for n,(v,m,r) in cands.items()}
    best=min(b[0] for b in rows.values())
    for n,b in sorted(rows.items(), key=lambda x:x[1][0]):
        print(f"{n:24s} {best/b[0]*100:5.1f}% cold {b[1]['cold']:.3f} rad {b[1]['radiation']:.3f} {b[2]}")
