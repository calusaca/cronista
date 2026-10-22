# Aplica el prototipo v5 (remate) sobre la copia proto/motor.ts. Banderas por entorno: V5=1 activa
# todo; POS=1 activa el posicionamiento del portero en la bisectriz. Constantes por entorno.
import re, sys, pathlib
p = pathlib.Path(__file__).with_name("motor.ts")
src = pathlib.Path(__file__).with_name("motor.orig.ts").read_text()

def sub(old, new, count=1):
    global src
    assert src.count(old) == count, (src.count(old), old[:80])
    src = src.replace(old, new)

# 0. Constantes del prototipo y helpers.
sub('export class MotorArena {', '''const V5 = process.env.V5 === "1", POS = process.env.POS === "1";
const n = (k: string, d: number) => Number(process.env[k] ?? d);
export const C5 = {
  margenPaloM: n("MARGEN_PALO", 0.5), margenNivelM: n("MARGEN_NIVEL", 1.5), margenPersonalidadM: n("MARGEN_PERS", 0.6), indiferenciaM: n("INDIF", 0.5),
  errorBaseM: n("ERR_BASE", 9), referenciaTiroM: n("REF_DIST", 16), factorDistanciaMin: n("FDMIN", 0.5), factorDistanciaMax: n("FDMAX", 1.5), errorPotencia: n("ERR_POT", 0.3),
  colocadoHastaM: n("COLOC_HASTA", 8), potenteDesdeM: n("POT_DESDE", 20), potenciaVelocidad: n("POT_VEL", 0.4),
  altoBase: n("ALTO_BASE", 0.04), altoPotencia: n("ALTO_POT", 0.16), altoNivel: n("ALTO_NIVEL", 0.1),
  alcanceMinM: n("ALC_MIN", 1.2), alcanceMaxM: n("ALC_MAX", 2.2),
  desvioBase: n("DESV_BASE", 0.35), desvioPotencia: n("DESV_POT", 0.2), desvioNivel: n("DESV_NIVEL", 0.15), desvioEstirada: n("DESV_EST", 0.3), desvioMin: n("DESV_MIN", 0.1), desvioMax: n("DESV_MAX", 0.8),
  posicionamientoM: n("POSIC", 3), rechaceCampoProb: n("RECH_PROB", 0), rechaceCampoM: n("RECH_M", 8), triangular: process.env.TRI === "1",
};
const MEDIO_Y = ARENA.anchoM / 2;
/** Objetivo del remate (y orientada): lado contrario al portero respecto de la línea tirador–arco; con el
 * portero centrado, el palo lejano. Margen desde el palo según nivel y personalidad. */
export function objetivoRemate(origen: Punto, portero: Punto | null, nivel: number, remate: number, lado: Lado): { y: number; s: number; margen: number } {
  const o = transformar(origen, lado), arco = { x: ARENA.largoM, y: MEDIO_Y };
  let s = o.y <= MEDIO_Y ? 1 : -1; // palo lejano; rematador exactamente centrado → +y
  const largo = Math.hypot(arco.x - o.x, arco.y - o.y);
  if (portero && largo > 0) {
    const k = transformar(portero, lado);
    const cruz = (k.x - o.x) * (arco.y - o.y) - (k.y - o.y) * (arco.x - o.x); // > 0: portero hacia −y (en el marco orientado)
    const lateral = Math.abs(cruz) / largo; // v1.1 #5: distancia perpendicular a la RECTA, no al segmento
    if (lateral > C5.indiferenciaM) s = cruz > 0 ? 1 : -1;
  }
  const margen = limitar(C5.margenPaloM + C5.margenNivelM * (1 - nivel / 100) + C5.margenPersonalidadM * (0.5 - remate / 100), C5.margenPaloM, ARENA.arcoM / 2);
  return { y: MEDIO_Y + s * (ARENA.arcoM / 2 - margen), s, margen };
}
export const potenciaRemate = (d: number) => limitar((d - C5.colocadoHastaM) / (C5.potenteDesdeM - C5.colocadoHastaM), 0, 1);
export const velocidadRemate = (potencia: number) => ARENA.velocidadTiroMps * (1 + C5.potenciaVelocidad * (potencia - 0.5));
export function alcancePortero(nivel: number, tiempoS: number): number {
  const reaccionS = PO.reaccionM / ARENA.velocidadTiroMps;
  return Math.max(PO.cuerpoM, (C5.alcanceMinM + (C5.alcanceMaxM - C5.alcanceMinM) * nivel / 100) * Math.min(1, tiempoS / reaccionS));
}
export function probabilidadDesvio(nivel: number, potencia: number, estirada: number): number {
  return limitar(C5.desvioBase + C5.desvioPotencia * (potencia - 0.5) - C5.desvioNivel * (nivel - 50) / 50 + C5.desvioEstirada * estirada, C5.desvioMin, C5.desvioMax);
}
export class MotorArena {''')

# 1. sacarBalon: objetivo, error y alto.
sub('''    const error = (1 - nivel / 100) * (tipo === "tiro" ? ARENA.errorTiroM : ARENA.errorPaseM)
      + (entorno ? entorno.errorLluviaM + entorno.errorPresionM + (tipo === "pase" ? entorno.errorNieblaM + entorno.errorCespedM : 0) : lluvia);
    const bruto = { x: destino.x + (this.conReinicios && tipo === "tiro" ? (j.lado === "local" ? ARENA.remateTrasLineaM : -ARENA.remateTrasLineaM) : 0), y: destino.y + (rng.next() * 2 - 1) * error };''',
'''    let error = (1 - nivel / 100) * (tipo === "tiro" ? ARENA.errorTiroM : ARENA.errorPaseM)
      + (entorno ? entorno.errorLluviaM + entorno.errorPresionM + (tipo === "pase" ? entorno.errorNieblaM + entorno.errorCespedM : 0) : lluvia);
    let v5: { potencia: number; alto?: true; objetivoY: number } | null = null;
    if (V5 && tipo === "tiro") {
      const k = this.estado.jugadores.find(p => p.lado !== j.lado && p.puesto === "POR");
      const d = distancia(desde, destino), potencia = potenciaRemate(d);
      const ob = objetivoRemate(desde, k?.posicion ?? null, nivel, j.personalidad?.remate ?? 50, j.lado);
      destino = transformar({ x: ARENA.largoM, y: ob.y }, j.lado);
      error = ((1 - nivel / 100) * C5.errorBaseM) * limitar(d / C5.referenciaTiroM, C5.factorDistanciaMin, C5.factorDistanciaMax) * (1 + C5.errorPotencia * potencia)
        + (entorno ? entorno.errorLluviaM + entorno.errorPresionM : lluvia);
      const rng5 = prngDerivado(this.config.partido.seed, `arena:remate:${this.estado.tick}:${j.id}`);
      const alto = rng5.chance(C5.altoBase + C5.altoPotencia * potencia + C5.altoNivel * (1 - nivel / 100));
      v5 = { potencia, objetivoY: ob.y, ...(alto ? { alto: true as const } : {}) };
    }
    const bruto = { x: destino.x + (this.conReinicios && tipo === "tiro" ? (j.lado === "local" ? ARENA.remateTrasLineaM : -ARENA.remateTrasLineaM) : 0), y: destino.y + (rng.next() * 2 - 1) * error };''')
sub('''...(extra.centro ? { centro: true as const } : {}), ...(extra.aereo ? { aereo: true as const } : {}) } };''',
    '''...(extra.centro ? { centro: true as const } : {}), ...(extra.aereo ? { aereo: true as const } : {}), ...(v5 ? { v5 } : {}) } as any };''')

# 2. moverBalon: velocidad, alcance del portero, alto intocable, desvío.
sub('''      const d = distancia(desde, vuelo.destino), velocidad = (vuelo.tipo !== "pase" ? ARENA.velocidadTiroMps : ARENA.velocidadBalonMps) * (this.estado.entrenadores ? efectosEntorno(this.config, this.estado, vuelo.lado).velocidadBalon : 1);''',
'''      const v5 = (vuelo as any).v5 as { potencia: number; alto?: true } | undefined;
      const d = distancia(desde, vuelo.destino), velocidad = (vuelo.tipo !== "pase" ? (v5 && vuelo.tipo === "tiro" ? velocidadRemate(v5.potencia) : ARENA.velocidadTiroMps) : ARENA.velocidadBalonMps) * (this.estado.entrenadores ? efectosEntorno(this.config, this.estado, vuelo.lado).velocidadBalon : 1);''')
sub('''      const radio = j.puesto === "POR" && area ? (this.v4 && vuelo?.tipo === "tiro" ? radioAtajada(distancia(vuelo.origen, j.posicion)) : ARENA.controlPorteroM) : ARENA.controlM;''',
'''      const v5c = (vuelo as any)?.v5 as { potencia: number; alto?: true } | undefined;
      const nivelK = this.estado.entrenadores ? capacidadEfectiva(j, compatibilidadPuesto(j, j.puesto)) : j.nivel;
      const vEfectiva = v5c ? velocidadRemate(v5c.potencia) * (this.estado.entrenadores ? efectosEntorno(this.config, this.estado, vuelo!.lado).velocidadBalon : 1) : 0; // v1.1 #3: la misma velocidad que mueve el balón
      const radio = j.puesto === "POR" && area ? (v5c && vuelo?.tipo === "tiro" ? alcancePortero(nivelK, distancia(vuelo.origen, j.posicion) / vEfectiva) : this.v4 && vuelo?.tipo === "tiro" ? radioAtajada(distancia(vuelo.origen, j.posicion)) : ARENA.controlPorteroM) : ARENA.controlM;
      if (v5c?.alto) return { j, ...punto, contacto: false, radio };''')
sub('''      return { j, ...punto, contacto: !ignorar && !aereo && punto.distancia <= radio };''',
    '''      return { j, ...punto, contacto: !ignorar && !aereo && punto.distancia <= radio, radio };''')
sub('''      if (this.conReinicios && vuelo?.tipo === "tiro" && j.lado !== vuelo.lado && j.puesto === "POR" && prngDerivado(this.config.partido.seed, `desvio:${this.estado.tick}:${j.id}`).chance(ARENA.desvioProbabilidad)) {''',
'''      const v5d = (vuelo as any)?.v5 as { potencia: number } | undefined;
      const pDesvio = v5d && vuelo?.tipo === "tiro" ? probabilidadDesvio(this.estado.entrenadores ? capacidadEfectiva(j, compatibilidadPuesto(j, j.puesto)) : j.nivel, v5d.potencia, contactos[0].radio > PO.cuerpoM ? limitar((contactos[0].distancia - PO.cuerpoM) / (contactos[0].radio - PO.cuerpoM), 0, 1) : 0) : ARENA.desvioProbabilidad;
      if (this.conReinicios && vuelo?.tipo === "tiro" && j.lado !== vuelo.lado && j.puesto === "POR" && prngDerivado(this.config.partido.seed, `desvio:${this.estado.tick}:${j.id}`).chance(pDesvio)) {''')

# 3. resolverSalida: alto → tiro_fuera con motivo.
sub('''    if (Math.abs(cruce.punto.y - ARENA.anchoM / 2) <= ARENA.arcoM / 2 && vuelo?.reinicio !== "banda" && !(vuelo?.reinicio && ultimo.lado === defiende)) {''',
'''    const alto = !!(vuelo as any)?.v5?.alto && vuelo?.tipo === "tiro";
    if (!alto && Math.abs(cruce.punto.y - ARENA.anchoM / 2) <= ARENA.arcoM / 2 && vuelo?.reinicio !== "banda" && !(vuelo?.reinicio && ultimo.lado === defiende)) {''')
sub('''      if (vuelo?.tipo === "tiro") { const autor = this.estado.jugadores.find(j => j.id === vuelo.autor)!; this.evento("tiro_fuera", autor, vuelo.origen, cruce.punto); }''',
'''      if (vuelo?.tipo === "tiro") { const autor = this.estado.jugadores.find(j => j.id === vuelo.autor)!; this.evento("tiro_fuera", autor, vuelo.origen, cruce.punto, null, alto ? { motivo: "alto" } : {}); }''')

# 4. Posicionamiento en la bisectriz (POS=1): fuera del mano a mano, con balón rival a ≤ manoAManoRadioM.
sub('''      if (salida?.[j.lado] && j.puesto === "POR" && j.id !== balon.poseedor) destino = destinoSalida(balon.posicion, j.lado);''',
'''      if (salida?.[j.lado] && j.puesto === "POR" && j.id !== balon.poseedor) destino = destinoSalida(balon.posicion, j.lado);
      else if (POS && V5 && j.puesto === "POR" && j.id !== balon.poseedor && ladoBalon !== undefined && ladoBalon !== j.lado && !this.estado.saque) {
        const b = transformar(balon.posicion, j.lado), dd = Math.hypot(b.x, b.y - MEDIO_Y);
        if (dd <= PO.manoAManoRadioM && dd > 0) destino = transformar({ x: b.x / dd * C5.posicionamientoM, y: MEDIO_Y + (b.y - MEDIO_Y) / dd * C5.posicionamientoM }, j.lado);
      }''')
# 5. Segunda ronda: error triangular (TRI=1) y rechace al campo (RECH_PROB, RECH_M).
sub("y: destino.y + (rng.next() * 2 - 1) * error };", "y: destino.y + (v5 && C5.triangular ? (rng.next() + rng.next() - 1) : (rng.next() * 2 - 1)) * error };")
sub("      const v5d = (vuelo as any)?.v5 as { potencia: number } | undefined;",
    "      const rngD = prngDerivado(this.config.partido.seed, `desvio:${this.estado.tick}:${j.id}`);\n      const v5d = (vuelo as any)?.v5 as { potencia: number } | undefined;")
sub("prngDerivado(this.config.partido.seed, `desvio:${this.estado.tick}:${j.id}`).chance(pDesvio)", "rngD.chance(pDesvio)")
sub("        const destino = { x, y: ARENA.anchoM / 2 + (punto.y < ARENA.anchoM / 2 ? -ARENA.desvioLateralM : ARENA.desvioLateralM) };",
    "        let destino = { x, y: ARENA.anchoM / 2 + (punto.y < ARENA.anchoM / 2 ? -ARENA.desvioLateralM : ARENA.desvioLateralM) };\n"
    "        if (v5d && rngD.chance(C5.rechaceCampoProb)) { const ko = transformar(punto, j.lado); destino = enCancha(transformar({ x: ko.x + C5.rechaceCampoM, y: ko.y + (punto.y < ARENA.anchoM / 2 ? -ARENA.desvioLateralM : ARENA.desvioLateralM) }, j.lado)); }")
p.write_text(src)
print("ok", len(src))
