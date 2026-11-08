import itertools, robust
from robust import ev, F, M, ok
pool=['GD','LT','CB','PG','PTC','HP','PEC','HS','AP','AA','GS','DF','PHC','CV']
ref=ev(['GD','LT','PTC','PEC','AA','PHC','CV'],['cd','ms','cold'],'cold','proj',F)[0]
for val in ['cold','radiation']:
    res=[]
    for riv in itertools.combinations(['cc','cd','ms','dmg','fr','fac'],3):
        for mods in itertools.combinations(pool,7):
            if not ok(mods): continue
            b=ev(list(mods),list(riv),val,'proj',F)
            if b: res.append((b[0],mods,riv,b))
    res.sort(key=lambda x:x[0])
    for sc,m,r,b in res[:3]:
        print(val, round(ref/sc*100,1), m, r, round(b[1]['cold'],3), round(b[1]['radiation'],3), b[3])
