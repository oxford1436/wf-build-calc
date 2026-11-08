import opt
from opt import M, INC
M['PCV']={'el':('electricity',1.65)}
from tick import ev as evt
from robust import ev as evp, F
X={'P1 (DF, no GD)':(['LT','PTC','PEC','AA','DF','PHC','PCV'],['cd','ms','cold']),
   'P2 (GD, no DF)':(['GD','LT','PTC','PEC','AA','PHC','PCV'],['cd','ms','cold'])}
sc={}
for n,(m,r) in X.items():
    s={}
    s['tick']=evt(m,r,'cold')[0]
    for mode in ['proj','shot','none']: s[mode]=evp(m,r,'cold',mode,F)[0]
    s['Fhalf tick']=evt(m,r,'cold',fury=F/2)[0]
    s['F0 tick']=evt(m,r,'cold',fury=0)[0]
    # GD 1 kill stack (+30% ms): emulate by adding 0.3 ms via extra mod
    M['GD1']={'ms':1.4}
    m2=[x if x!='GD' else 'GD1' for x in m]
    s['GD 1 stack']=evt(m2,r,'cold')[0]
    sc[n]=s
for k in sc['P1 (DF, no GD)']:
    a=sc['P1 (DF, no GD)'][k]; b=sc['P2 (GD, no DF)'][k]
    print(f"{k:12s} P1 {a:.3f}  P2 {b:.3f}  P2/P1 speed {a/b*100:.1f}%")
b=evt(*X['P1 (DF, no GD)'],'cold'); print('P1 tick', {k:round(v,3) for k,v in b[1].items()}, b[2])
b=evt(*X['P2 (GD, no DF)'],'cold'); print('P2 tick', {k:round(v,3) for k,v in b[1].items()}, b[2])
