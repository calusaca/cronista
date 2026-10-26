import json,sys,math
rows=[json.loads(l) for f in sys.argv[1:] for l in open(f)]
grp={}
for r in rows:
  if r['etiqueta'] not in ('base','ext'): continue
  grp.setdefault((r['dur'],r['reglas']),[]).append(r)
def n(r): a,b=map(int,r['semillas'].split('-')); return b-a+1
print("dur reglas N goles se pct0 tiros aPuerta conv lejanos golLej tirosNoLej llegadas25 %llegConRemate robosDuelo largos alto ancho atrap+desv bloq")
for (d,v),rs in sorted(grp.items()):
  N=sum(n(r) for r in rs)
  w=lambda k: sum(r[k]*n(r) for r in rs)/N
  g=w('golesPP'); var=sum((r['sdGoles']**2+(r['golesPP']-g)**2)*n(r) for r in rs)/N
  dd=lambda k: sum(r['desenlacesPP'].get(k,0)*n(r) for r in rs)/N
  t=w('tirosPP')
  print(d,v[-2:],N,round(g,3),round(math.sqrt(var/N),3),round(w('pct0goles'),3),round(t,2),round((dd('gol')+dd('atrapada')+dd('desvio'))/t,3),round(g/t,3),round(w('lejanosPP'),2),round(w('golesLejanosPP'),3),round(w('tirosNoLejanosPP'),2),round(w('llegadas25PP'),2),round(w('fraccLlegada25ConRemate'),3),round(w('robosDueloPP'),2),round(w('largosPP'),2),round(dd('alto'),2),round(dd('ancho'),2),round(dd('atrapada')+dd('desvio'),2),round(dd('bloqueado'),2))
