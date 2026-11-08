import itertools, functools, sys
import opt
from opt import *
_e=opt.enervate_avg
@functools.lru_cache(maxsize=None)
def ec(cc): return _e(cc,0,n=60000)
opt.enervate_avg=lambda cc,ms,**k: ec(round(cc,3))
M['HC']={'el':('heat',.9)}
def best_order(mods, riv, val, need, **kw):
    elsrc=[x for x in mods if 'el' in M[x]]+[r for r in riv if r[4:] in ('heat','cold','electricity','toxin')]
    rest=[x for x in mods if x not in elsrc]+[r for r in riv if r not in elsrc]
    best=None
    for p in itertools.permutations(elsrc):
        t,st,sh=build(mods,riv,val=val,order=list(p)+rest,**kw)
        if any(n not in t for n in need): continue
        sc=sum(t[n] for n in need)
        if best is None or sc<best[0]: best=(sc,t,st,p)
    return best
pool=['GD','LT','CB','PG','PTC','HP','PEC','HS','AP','AA','GS','DF','PHC','CV']
rivk=['riv:'+k for k in RIVB]
for val in [('radiation',.6),('cold',.6)]:
  for lab,kw in [('Fury max+Enervate',{'ener':True}),('Fury max no arcane',{})]:
    res=[]
    for riv in itertools.combinations(rivk,3):
        for mods in itertools.combinations(pool,7):
            if not ok(mods): continue
            b=best_order(mods,riv,val,('cold','radiation'),**kw)
            if b: res.append((b[0],mods,riv,b[1],b[2],b[3]))
    res.sort(key=lambda x:x[0]); b0=res[0][0]
    print('== valence',val[0],lab)
    for sc,mods,riv,t,st,p in res[:8]:
        print(f"{b0/sc*100:5.1f}% {mods} {[r[4:] for r in riv]} cold {t['cold']:.3f} rad {t['radiation']:.3f} imp {t['impact']:.2f} {st} {p}")
    sys.stdout.flush()
