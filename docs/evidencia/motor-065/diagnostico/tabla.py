import json,sys
rows=[json.loads(l) for l in open(sys.argv[1])]
rows.sort(key=lambda r:(r.get('etiqueta',''),r['dur'],r['reglas']))
cols=['golesPP','seGoles','pct0goles','tirosPP','conversion','aPuerta','lejanosPP','golesLejanosPP','tirosNoLejanosPP','posesionesPP','llegadas33PP','llegadas25PP','fraccLlegada25ConRemate','robosDueloPP','robosDueloUltTercioPP','intercepcionesPP','largosPP','centrosPP','segZona25PP']
print('etq dur reglas '+' '.join(cols))
for r in rows: print(r.get('etiqueta',''),r['dur'],r['reglas'][-2:],' '.join(str(r[c]) for c in cols))
print()
for r in rows: print(r.get('etiqueta',''),r['dur'],r['reglas'][-2:],'des',r['desenlacesPP'],'finSinRemate',r['finLlegada25SinRematePP'])
