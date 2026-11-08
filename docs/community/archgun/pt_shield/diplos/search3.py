import itertools
import opt
from opt import M, RIVB, ok, INC
M['PCV']={'el':('electricity',1.65)}; M['HC']={'el':('heat',.9)}
INC.append({'CV','PCV'}); INC.append({'HC','PHC'})
from tick import ev
from robust import ev as evp, F
pool=['GD','LT','CB','PTC','PEC','HS','AA','GS','DF','PHC','PCV','CV']
res=[]
for val in ['cold','radiation']:
  for riv in itertools.combinations(['cc','cd','ms','fr','fac','cold','heat','electricity'],3):
    for mods in itertools.combinations(pool,7):
        if not ok(mods): continue
        b=evp(list(mods),list(riv),val,'proj',F)
        if b: res.append((b[0],val,mods,riv))
res.sort(key=lambda x:x[0])
top=res[:25]
rows=[]
for sc,val,mods,riv in top:
    b=ev(list(mods),list(riv),val)
    rows.append((b[0],val,mods,riv,b))
rows.sort(key=lambda x:x[0]); b0=rows[0][0]
for sc,val,mods,riv,b in rows[:10]:
    print(f"{b0/sc*100:5.1f}% {val} {mods} {riv} cold {b[1]['cold']:.3f} rad {b[1]['radiation']:.3f} {b[3]}")
