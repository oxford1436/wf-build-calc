import robust
from robust import ev, F, M
base=('cold',['GD','LT','PTC','PEC','AA','PHC','CV'],['cd','ms','cold'])
def sc(v,m,r,mode='proj',fury=F):
    b=ev(m,r,v,mode,fury); return b
b0=sc(*base); s0=b0[0]
print('C1', round(b0[1]['cold'],3), round(b0[1]['radiation'],3), b0[2], b0[3])
alts=['BD','HS','AP','GS','HP','CB','PG','DF','HC']
for i,x in enumerate(base[1]):
    out=[]
    for a in alts+[None]:
        m=[y for y in base[1] if y!=x]+([a] if a else [])
        if a in base[1]: continue
        if a and not robust.ok(m): continue
        b=sc(base[0],m,base[2])
        out.append((round(s0/b[0]*100,1) if b else 0,a or "EMPTY"))
    out.sort(reverse=True)
    print('slot',x,'-> best alt',out[:3],' remove(empty):',[o for o in out if o[1]=='EMPTY'])
for i,x in enumerate(base[2]):
    out=[]
    for a in ['cc','cd','ms','dmg','fr','fac','heat','electricity','toxin','cold']:
        if a in base[2]: continue
        r=[y for y in base[2] if y!=x]+[a]
        b=sc(base[0],base[1],r)
        out.append((round(s0/b[0]*100,1) if b else 0,a or "EMPTY"))
    out.sort(reverse=True); print('riven',x,'->',out[:4])
# range: min roll riven (x0.9/1.1)
import opt
old=opt.rv
opt.rv=lambda k: opt.RIVB[k]*1.2*0.9375*0.9
b=sc(*base); print('riven min roll', round(s0/b[0]*100,1))
opt.rv=old
# valence radiation fallback with same mods + DF? 
for lab,(v,m,r) in {'rad valence same mods':('radiation',base[1],base[2]),'R2 rad':('radiation',['GD','LT','PTC','PEC','DF','PHC','CV'],['cd','ms','cold']),'R1 rad':('radiation',['LT','PTC','PEC','AA','DF','PHC','CV'],['cd','ms','cold'])}.items():
    b=sc(v,m,r); print(lab, round(s0/b[0]*100,1) if b else None, b and (round(b[1]['cold'],3), round(b[1]['radiation'],3), b[3]))
for mode in ['shot','none']:
    b=sc(*base,mode=mode); print('C1',mode, round(b[1]['cold'],3), round(b[1]['radiation'],3))
b=sc(*base,fury=0); print('C1 fury0', round(b[1]['cold'],3), round(b[1]['radiation'],3))
