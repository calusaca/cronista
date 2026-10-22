# Genera lotes/tablas.md a partir de los JSON de lotes/ (sin transcripción manual).
# Uso: python3 -I tablas.py <directorio lotes>
import json, pathlib, sys
L = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parent.parent / "lotes")
def g(n):
    p = L / f"{n}.json"
    return json.loads(p.read_text()) if p.exists() else None
def f(v, d=3):
    return "—" if v is None else (f"{v:.{d}f}".replace(".", ",") if isinstance(v, float) else str(v))
def fila(nombre, d):
    if not d: return f"| {nombre} | (falta) |"
    c = d["colocacion"]
    return (f"| {nombre} | {f(d['golesPorPartido'],2)} / {f(d['golesSinRematePorPartido'],2)} | {f(d['tirosPorPartido'],2)} | {f(d.get('aPuerta045Fraccion'))} | {f(d['aPuertaFraccion'])} / {d.get('discrepancia045','—')} | "
            f"{f(d['conversion'])} | {f(d.get('atajadasSobreAPuerta045'))} | {f(d['desvioSobreAtajadas'])} | {f(d['fueraFraccion'])} / {f(d['altoSobreFuera'])} | {f(d['bloqueadoFraccion'])} | {f(c['aLosLadosFraccion'])} / {f(c['desvioMedioM'],2)} |")
out = ["# Tablas generadas desde los JSON (brief 051, v1.1)", "",
       "| Lote | Goles / sin remate | Remates | A puerta (045) | A puerta física / discrepancias | Conversión | Atajadas / a puerta (045) | Desvíos / atajadas | Fuera / altos entre fuera | Bloqueados | Colocación / desvío medio (m) |",
       "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"]
for n, t in [("base-v4-1-30", "v4 1–30"), ("base-v4-1-100", "v4 1–100"), ("base-v4-101-200", "v4 101–200"), ("base-v3-1-100", "v3 1–100"),
             ("candidato-p3-1-30", "v5 1–30"), ("candidato-p3-1-100", "v5 1–100"), ("candidato-p3-101-200", "v5 101–200")]:
    out.append(fila(t, g(n)))
out += ["", "## Experimento controlado (niveles forzados, mismas semillas)", "", "| Lote | Porteros 40 → 90: atajadas / a puerta (045) | Campo 40 → 90: conversión | Campo 40 → 90: a puerta (045) |", "| --- | --- | --- | --- |"]
for pre, t in [("niveles-niv-v4", "v4 1–100"), ("niveles-niv-v5", "v5 1–100"), ("niveles-niv30-v5", "v5 1–30")]:
    a, b = g(f"{pre}-por40"), g(f"{pre}-por90"); c, d = g(f"{pre}-campo40"), g(f"{pre}-campo90")
    k = "atajadasSobreAPuerta045"
    por = f"{f(a[k])} → {f(b[k])} ({f(b[k]-a[k])})" if a and b and a.get(k) is not None else "—"
    conv = f"{f(c['conversion'])} → {f(d['conversion'])} ({f(d['conversion']-c['conversion'])})" if c and d else "—"
    ap = f"{f(c.get('aPuerta045Fraccion'))} → {f(d.get('aPuerta045Fraccion'))}" if c and d else "—"
    out.append(f"| {t} | {por} | {conv} | {ap} |")
out += ["", "## Bandas 044/046 sobre el candidato (helper del repositorio)", "", "| Lote | Incumplimientos | Intercepciones inmediatas: temporal / con radio (m) | Goles | Conversión mano a mano | Mediana de salida (m) | Centros / partido | Proporción desde la banda |", "| --- | --- | --- | --- | --- | --- | --- | --- |"]
for n, t in [("candidato-p3-bandas046-1-30", "v5 1–30"), ("candidato-p3-bandas046-1-100", "v5 1–100"), ("candidato-p3-bandas046-101-200", "v5 101–200")]:
    d = g(n)
    if not d: out.append(f"| {t} | (falta) |"); continue
    m, ii = d["metricas"], d["intercepcionesInmediatas"]
    out.append(f"| {t} | {', '.join(d['incumplimientos']) or 'ninguno'} | {ii['temporal']} / {ii['temporalConRadio']} ({ii['radioM']}) | {f(m['golesPorPartido'],2)} | {f(m['manoAMano']['conversion'])} | {f(m['manoAMano']['desplazamientoMedianaM'],2)} | {f(m['centros']['porPartido'],2)} | {f(m['centros']['proporcion'])} |")
(L / "tablas.md").write_text("\n".join(out) + "\n")
print("\n".join(out))
