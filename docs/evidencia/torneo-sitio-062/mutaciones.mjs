// Brief 062 · Mutaciones de la parte de servidor del P1-a. Cada mutación se aplica sobre el archivo real, se ejecuta
// SOLO la prueba que la nombra (vitest -t), se anota el resultado y el md5 del archivo mutado y se revierte en un
// `finally` (se comprueba que el md5 vuelve al original). Una mutación cuenta si la prueba queda en ROJO.
//
//   node docs/evidencia/torneo-sitio-062/mutaciones.mjs [filtro]   →   docs/evidencia/torneo-sitio-062/mutaciones.md
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const md5 = t => createHash("md5").update(t).digest("hex");
const SITIO = "src/arena/torneo-sitio.ts", FORMATOS = "src/arena/torneo-formatos.ts", TORNEO = "src/arena/torneo.ts";
const T_SITIO = "src/arena/__tests__/torneo-sitio.test.ts", T_RUTAS = "src/arena/__tests__/torneo-sitio-rutas.test.ts", T_FORMATOS = "src/arena/__tests__/torneo-formatos.test.ts", T_ENTRADAS = "src/arena/__tests__/torneo-entradas.test.ts";
const RUTA = "src/app/api/arena/torneos/sitio/route.ts";
const T_GRUPOS = "src/arena/__tests__/torneo-grupos.test.ts";
const T_U1 = "src/ui/__tests__/ArenaTorneoLanzar.test.tsx", LANZAR = "src/ui/ArenaTorneoLanzar.tsx", PAGINA_UI = "src/ui/ArenaTorneo.tsx";

/** { id, prueba, descripcion, archivo, cambios: [[buscar, reemplazo]], test, patron } */
const M = [
  { id: "S1b", desc: "comprobar el activo después de crear dia-", archivo: SITIO, test: T_SITIO, patron: "S3 · un torneo activo de AYER", cambios: [
    ['      if (this.activo || this.pendientesCierre().length) throw errorMotivo(this.cierreAgotado && !this.activo ? "cierre" : "activo");\n', ""],
    ["      const mem = { manifiesto, instantanea: this.instantaneaInicial(manifiesto)", '      if (this.activo || this.pendientesCierre().length) throw errorMotivo("activo");\n      const mem = { manifiesto, instantanea: this.instantaneaInicial(manifiesto)']] },
  { id: "S1-nuevo", desc: "crear el manifiesto sin `nuevo: true`", archivo: SITIO, test: T_SITIO, patron: "OTRA operación", cambios: [
    ['await this.escribirP(nombre, JSON.stringify(manifiesto, null, 2) + "\\n", true);', 'await this.escribirP(nombre, JSON.stringify(manifiesto, null, 2) + "\\n", false);']] },
  { id: "S2", desc: "día en America/Guatemala (UTC−6) en vez de UTC", archivo: FORMATOS, test: T_SITIO, patron: "S2 · día UTC", cambios: [
    ["export const diaUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);", "export const diaUtc = (ms: number) => new Date(ms - 6 * 3_600_000).toISOString().slice(0, 10);"]] },
  { id: "S6-reserva", desc: "reserva abierta contada como 0 en el cierre de arranque", archivo: SITIO, test: T_SITIO, patron: "S6 · arranque tras una caída", cambios: [
    ["gasto: { ...base.gasto, conocidoMicroUsd: gastoConocido(libro) } });\n        }", 'gasto: { ...base.gasto, conocidoMicroUsd: gastoConocido(libro.filter(x => x.tipo === "cierre")) } });\n        }']] },
  { id: "S6-latido", desc: "cerrar con el latido ajeno fresco (barrera ignorada)", archivo: SITIO, test: T_SITIO, patron: "S6 · arranque tras una caída", cambios: [
    ["if (!ajenos.some(x => x.edad < S.latidoCaducoMs)) {", "if (true) {"]] },
  { id: "S6b-anexo", desc: "ignorar el error del anexo del libro", archivo: SITIO, test: T_SITIO, patron: "un anexo del libro que lanza", cambios: [
    ['await this.anexarP(`${a.id}.gasto.ndjson`, JSON.stringify(v) + "\\n");', 'await this.anexarP(`${a.id}.gasto.ndjson`, JSON.stringify(v) + "\\n").catch(() => {});']] },
  { id: "S6b-propia", desc: "dar por ajena una creación propia (respuesta perdida)", archivo: SITIO, test: T_SITIO, patron: "persiste pero lanza", cambios: [
    ["if (existente.operacion !== manifiesto.operacion) {", "if (true) {"]] },
  { id: "S6c", desc: "SIGTERM sin `detenido` (el viejo escribe el cierre)", archivo: SITIO, test: T_SITIO, patron: "S6c · SIGTERM", cambios: [
    ["    if (this.detenido) return;\n    this.detenido = true;\n", "    if (this.detenido) return;\n"]] },
  { id: "S7", desc: "quitar el mutex", archivo: SITIO, test: T_SITIO, patron: "S7 · exclusión directa", cambios: [
    ["    const ejecucion = this.cola.then(() => fn());", "    const ejecucion = fn();"]] },
  { id: "S7b-relectura", desc: "liberar la barrera sin releer los libros (leídos al empezar el relevo)", archivo: SITIO, test: T_SITIO, patron: "con un latido ajeno fresco", cambios: [
    ["const a = await this.almacen(), ajenos = await this.latidosAjenos(a);", "const a = await this.almacen(); if (!this.recargado) await this.recargar(); const ajenos = await this.latidosAjenos(a);"],
    ["            await this.recargar();\n            this.barrera = null;", "            this.barrera = null;"]] },
  { id: "S7b-latidos", desc: "ignorar los latidos ajenos", archivo: SITIO, test: T_SITIO, patron: "con un latido ajeno fresco", cambios: [
    ["if (!ajenos.some(x => x.edad < S.latidoCaducoMs)) {", "if (true) {"]] },
  { id: "S19", desc: "quitar la comprobación de vigencia antes de escribir", archivo: SITIO, test: T_SITIO, patron: "se CUELGA", cambios: [
    ['    if (!latidoVigente(this.ultimoLatido, this.ahora())) { this.silenciar("latido vencido"); throw new ErrorSilencio("Latido vencido"); }\n', ""]] },
  { id: "S7c-reintento", desc: "cierre de arranque sin reintento", archivo: SITIO, test: T_SITIO, patron: "se reintenta y cierra", cambios: [
    ["  private programarReintentoCierre(): void {\n", "  private programarReintentoCierre(): void {\n    return;\n"]] },
  { id: "S7c-plazo", desc: "reintentar el cierre sin plazo", archivo: SITIO, test: T_SITIO, patron: "más de cierrePlazoMs", cambios: [
    ["if (this.ahora() - this.primerIntentoCierre >= S.cierrePlazoMs) {", "if (false) {"]] },
  { id: "S7d", desc: "admitir sin el primer latido confirmado", archivo: SITIO, test: T_SITIO, patron: "S7d", cambios: [
    ['    if (this.ultimoLatido === null) return "iniciando";\n', ""], ['      if (this.ultimoLatido === null) throw errorMotivo("iniciando");\n', ""]] },
  { id: "S8", desc: "guarda del tope sin la reserva (con lo conocido)", archivo: SITIO, test: T_SITIO, patron: "S8 · tope", cambios: [
    ["if (conocido + reserva > m.topeMicroUsd)", "if (conocido > m.topeMicroUsd)"]] },
  { id: "S9-tipico", desc: "bolsa con el típico en vez del tope", archivo: SITIO, test: T_SITIO, patron: "conocido acumulado \\+ tope > bolsa", cambios: [
    ['if (conocido + ficha.topeMicroUsd > S.bolsaUsd * 1_000_000) throw errorMotivo("bolsa");', 'if (conocido + ficha.tipicoMicroUsd.max > S.bolsaUsd * 1_000_000) throw errorMotivo("bolsa");']] },
  { id: "S9-ensayos", desc: "contar los ensayos en la bolsa", archivo: SITIO, test: T_SITIO, patron: "los ensayos no cuentan", cambios: [
    ['      if (t.manifiesto.tipo !== "real") continue;\n', ""]] },
  { id: "S9b", desc: "cierre (commit del partido + cierre final) fuera del mutex", archivo: SITIO, test: T_SITIO, patron: "S9b", cambios: [
    ["const paso: Paso = await this.exclusiva(async (): Promise<Paso> => {", "const paso: Paso = await (async (): Promise<Paso> => {"],
    ["        });\n        if (paso.tipo === \"fin\") return;", "        })();\n        if (paso.tipo === \"fin\") return;"]] },
  { id: "S9c", desc: "libro ilegible tratado como 0", archivo: SITIO, test: T_SITIO, patron: "S9c", cambios: [
    ["try { return texto.split(\"\\n\").filter(l => l.trim()).map(l => esquemaMovimiento.parse(JSON.parse(l))); } catch { return null; }", "try { return texto.split(\"\\n\").filter(l => l.trim()).map(l => esquemaMovimiento.parse(JSON.parse(l))); } catch { return []; }"]] },
  { id: "S10", desc: "una espera sin señal (pausa y enfriamientos)", archivo: SITIO, test: T_SITIO, patron: "enfriamiento largo", cambios: [
    ["try { await this.dormir(paso.ms, signal); }", "try { await this.dormir(paso.ms); }"]] },
  { id: "S10b-id", desc: "id de la prueba = id del día", archivo: SITIO, test: T_SITIO, patron: "\\(b\\) prueba cancelada", cambios: [
    ['      if (p.prueba) do { id = `${PREFIJO_PRUEBA}${(this.deps.uuid ?? randomUUID)().replace(/-/g, "").slice(0, 12)}`; } while (this.torneos.has(id));\n', ""]] },
  { id: "S10b-dia", desc: "la prueba consume el cupo del día", archivo: SITIO, test: T_SITIO, patron: "\\(b\\) prueba cancelada", cambios: [
    ["      this.torneos.set(id, mem);\n", "      this.torneos.set(id, mem); if (p.prueba) this.torneos.set(idDelDia(dia), mem);\n"]] },
  { id: "S10b-bolsa", desc: "gasto de la prueba fuera de la bolsa", archivo: SITIO, test: T_SITIO, patron: "\\(b\\) prueba cancelada", cambios: [
    ['      if (t.manifiesto.tipo !== "real") continue;', '      if (t.manifiesto.tipo !== "real" || t.manifiesto.lanzamiento === "prueba") continue;']] },
  { id: "S12", desc: "ignorar ARENA_MAX_REPLICAS con Blob", archivo: SITIO, test: T_SITIO, patron: "S12 · réplica única", cambios: [
    [': tipoAlmacen === "blob" && env.ARENA_MAX_REPLICAS !== "1" ? "replicas" : null;', ": null;"]] },
  { id: "S13-plazo", desc: "sin plazo total", archivo: SITIO, test: T_SITIO, patron: "pasado plazoTotalMs", cambios: [
    ["if (this.ahora() - Date.parse(a.mem.instantanea.inicioUtc) > S.plazoTotalMs)", "if (false)"]] },
  { id: "S13-intentos", desc: "un intento de más por partido", archivo: SITIO, test: T_SITIO, patron: "1 \\+ repeticionesMax veces", cambios: [
    ["const agotado = intentosDe(p.n) >= 1 + T.repeticionesMax;", "const agotado = intentosDe(p.n) >= 2 + T.repeticionesMax;"]] },
  { id: "S14", desc: "sin ritmo de reloj", archivo: SITIO, test: T_SITIO, patron: "S14 · ritmo", cambios: [
    ['else if (publicacion.tipo === "ronda" && cfg.ritmo)', 'else if (publicacion.tipo === "ronda" && false)']] },
  { id: "S15", desc: "el torneo pasa por GestorSesiones", archivo: SITIO, test: T_SITIO, patron: "S15", cambios: [
    ['import { sha256 } from "./torneo-validacion";', 'import { sha256 } from "./torneo-validacion";\nimport { gestorSesiones } from "./sesiones";\nvoid gestorSesiones;']] },
  { id: "R3", desc: "ensayo admitido con Blob", archivo: SITIO, test: T_SITIO, patron: "R3 ·", cambios: [
    ["const ensayoInvalido = ensayo && (!!env.ARENA_BLOB_ENDPOINT || ", "const ensayoInvalido = ensayo && (false || "]] },
  { id: "R4", desc: "torneo-cli acepta el prefijo sitio-", archivo: "src/arena/torneo-cli.ts", test: T_SITIO, patron: "R4 ·", cambios: [
    ["  if (v.id.startsWith(TORNEO_SITIO.prefijoId)) throw", "  if (false) throw"]] },
  { id: "S5", desc: "tocar el almacén antes del interruptor", archivo: RUTA, test: T_RUTAS, patron: "S5 ·", cambios: [
    ["const g = gestorTorneoSitio(), cfg = g.config();", "const g = gestorTorneoSitio(); g.iniciar(); const cfg = g.config();"]] },
  { id: "S4", desc: "clave del limitador = primer salto de XFF", archivo: SITIO, test: T_RUTAS, patron: "S4 ·", cambios: [
    ['return saltos.at(-1) ?? "desconocida";', 'return saltos[0] ?? "desconocida";']] },
  { id: "H1", desc: "`liberar` fuera de `finally`", archivo: RUTA, test: T_RUTAS, patron: "cuerpo lento", cambios: [
    ["    return Response.json({ id }, { status: 202, headers: sinCache });\n  } catch (error) { return respuestaErrorSitio(error); }\n  finally { admitida.liberar(); }", "    admitida.liberar();\n    return Response.json({ id }, { status: 202, headers: sinCache });\n  } catch (error) { return respuestaErrorSitio(error); }"]] },
  { id: "R1", desc: "archivo leído desde la URL (sin el manifiesto)", archivo: SITIO, test: T_RUTAS, patron: "R1 ·", cambios: [
    ["    const e = l.torneo.encuentros.find(x => x.archivo === archivo);\n    if (!e) return null;", "    const e = l.torneo.encuentros.find(x => x.archivo === archivo);\n    if (!e) { try { return await (await this.almacen()).leerBytes(`${id}.${archivo}`); } catch { return null; } }"]] },
  { id: "R5", desc: "bicep con literales distintos en scale", archivo: "infra/arena-preview.bicep", test: T_RUTAS, patron: "R5 ·", cambios: [
    ["scale: { minReplicas: minReplicas, maxReplicas: maxReplicas }", "scale: { minReplicas: minReplicas, maxReplicas: 1 }"]] },
  { id: "R2", desc: "redondeo distinto del típico por decisión", archivo: TORNEO, test: T_ENTRADAS, patron: "estimación archivada", cambios: [
    ["return Math.ceil(entradaMedia * precio.entrada + salidaMedia * precio.salida);", "return Math.round(entradaMedia * precio.entrada + salidaMedia * precio.salida);"]] },
  { id: "G11-liga", desc: "validarTorneo 062 sin validar cada encuentro contra su plan y su .gz", archivo: "src/arena/torneo-validacion.ts", test: T_SITIO, patron: "S17", cambios: [
    ["    for (const e of t.encuentros) validarEncuentro(validarMetadatos062(e, plan[e.n - 1]!), plan[e.n - 1]!, t.participantes, leer(e.archivo), t);\n", ""]] },
  { id: "G8-plan", desc: "omitir la reconstrucción del plan en la coherencia 062", archivo: FORMATOS, test: T_FORMATOS, patron: "G8", cambios: [
    ["  for (const e of t.encuentros) {\n    const p = plan[e.n - 1];", "  for (const e of [] as typeof t.encuentros) {\n    const p = plan[e.n - 1];"]] },
  { id: "G8-059", desc: "aceptar `formato` en un 059", archivo: TORNEO, test: T_FORMATOS, patron: "G8", cambios: [
    ["export const esquemaTorneo059 = z.strictObject({", "export const esquemaTorneo059 = z.object({"]] },
  { id: "G9-desempates", desc: "estimar grupos sin desempates", archivo: FORMATOS, test: T_FORMATOS, patron: "G9", cambios: [
    ["maxConDesempates: grupos + llavesMax * (1 + g.desempatesPorLlave) };", "maxConDesempates: grupos + llavesMax };"]] },
  { id: "G9-tope", desc: "tope de grupos por debajo de la reserva", archivo: "src/sim/limites.ts", test: T_FORMATOS, patron: "G9", cambios: [
    ["grupos: { grupos: 2, porGrupo: 3, pasanPorGrupo: 2, desempatesPorLlave: 1, topeUsd: 7 },", "grupos: { grupos: 2, porGrupo: 3, pasanPorGrupo: 2, desempatesPorLlave: 1, topeUsd: 3 },"]] },
  { id: "G10", desc: "c = n − 1 en grupos", archivo: FORMATOS, test: T_FORMATOS, patron: "G10", cambios: [
    ["const g = S.formatos.grupos, c = (g.porGrupo - 1) + Math.log2(g.grupos * g.pasanPorGrupo), p = pSignosBilateral(c, 0);", "const g = S.formatos.grupos, c = t.participantes.length - 1, p = pSignosBilateral(c, 0);"]] },
  { id: "G12", desc: "aceptar campos extra en el encuentro 059", archivo: TORNEO, test: T_FORMATOS, patron: "G12", cambios: [
    ["export const esquemaEncuentro = z.strictObject({", "export const esquemaEncuentro = z.object({"]] },
  // --- Revisión Codex (iteración 1) ---------------------------------------------------------------------------------
  { id: "C3", desc: "el cierre no relee una instantánea que falló al leerse", archivo: SITIO, test: T_SITIO, patron: "Codex #3", cambios: [
    ["          if (t.error) {\n            Object.assign(t, await this.leerInstantanea(await this.almacen(), id));\n            if (t.error) throw new Error(t.error);", "          if (t.error) {\n            if (t.error) throw new Error(t.error);"]] },
  { id: "C4", desc: "esperar la cancelación del cuerpo al vencer el plazo", archivo: SITIO, test: T_RUTAS, patron: "Codex #4", cambios: [
    ["void Promise.resolve().then(() => lector.cancel()).catch(() => {}); throw error;", "await lector.cancel().catch(() => {}); throw error;"]] },
  { id: "C5", desc: "sin la segunda comprobación del torneo activo antes de ARM", archivo: "scripts/deploy-azure-arena.mjs", test: T_RUTAS, patron: "Codex #5", cambios: [
    ["  await comprobarTorneoActivo();\n  const d = az(", "  const d = az("]] },
  // --- UI del P1-a (U1) ---------------------------------------------------------------------------------------------
  { id: "U1-cifras", desc: "cifras fijas en el panel (no las de la Ficha)", archivo: LANZAR, test: T_U1, patron: "salen de la Ficha", cambios: [
    ['return [`${rango(f.partidos)} ${es ? "partidos" : "matches"}`,', 'return [`30 ${es ? "partidos" : "matches"}`,']] },
  { id: "U1-motivo", desc: "botón deshabilitado sin el motivo visible", archivo: LANZAR, test: T_U1, patron: "motivo «", cambios: [
    ["        {motivo ? textoMotivo(motivo, idioma, estado?.proximoCupoUtc) : \"\"}\n", "        {\"\"}\n"]] },
  { id: "U1-disabled", desc: "el botón nunca se deshabilita", archivo: LANZAR, test: T_U1, patron: "motivo «", cambios: [
    ['className="btn btn-primary" disabled={deshabilitado}', 'className="btn btn-primary" disabled={false}']] },
  { id: "U1-grupos", desc: "grupos habilitado en P1-a", archivo: LANZAR, test: T_U1, patron: "Grupos visible", cambios: [
    ["disabled={!fi.disponible || v.enviando}", "disabled={v.enviando}"]] },
  { id: "U1-rotulo", desc: "quitar el rótulo de origen", archivo: PAGINA_UI, test: T_U1, patron: "rótulos de origen", cambios: [
    ['      <p className="arena-torneo-rotulo" data-testid="arena-torneo-rotulo">{rotuloOrigen(t, idioma)}</p>\n', ""]] },
  { id: "U1-declarado", desc: "leyenda «†» del CLI también en los del sitio", archivo: PAGINA_UI, test: T_U1, patron: "rótulos de origen", cambios: [
    ['const declarado = sitio ? TS.declaradoServidor[idioma] : tx("declarado")', 'const declarado = tx("declarado")']] },
  { id: "U1-aria-live", desc: "aria-live anuncia todos los partidos, no solo los nuevos", archivo: PAGINA_UI, test: T_U1, patron: "aria-live solo anuncia", cambios: [
    ["const nuevos = despues.encuentros.filter(e => !vistos.has(e.n)).map(", "void vistos; const nuevos = despues.encuentros.map("]] },
  { id: "U1-mostrar", desc: "portada sin preferir los reales a los ensayos", archivo: "src/ui/torneo-lista.ts", test: T_U1, patron: "torneoAMostrar", cambios: [
    ['?? orden.find(t => t.tipo === "real") ?? orden[0] ?? null;', "?? orden[0] ?? null;"]] },
  { id: "U1-carga", desc: "repetición del sitio cargada desde /torneos (sin la base del prefijo)", archivo: "src/ui/torneo-carga.ts", test: "src/ui/__tests__/torneo-carga.test.ts", patron: "062", cambios: [
    ["export const baseTorneo = (id: string) => id.startsWith(TORNEO_SITIO.prefijoId) ? `/api/arena/torneos/sitio/${id}` : `/torneos/${id}`;", "export const baseTorneo = (id: string) => `/torneos/${id}`; void TORNEO_SITIO;"]] },
  { id: "U1-bundle", desc: "el cliente vuelve a importar el motor (arrastra la telemetría al navegador)", archivo: PAGINA_UI, test: T_U1, patron: "no arrastran", cambios: [
    ['import { useEffect, useMemo, useRef, useState } from "react";', 'import { useEffect, useMemo, useRef, useState } from "react";\nimport { crearConfigArena } from "../arena/motor";\nvoid crearConfigArena;']] },
  { id: "E2E-4-error", desc: "reconocer el ErrorSitio solo con instanceof (dos copias del módulo ⇒ 500)", archivo: SITIO, test: T_RUTAS, patron: "OTRA copia del módulo", cambios: [
    ["  if (esErrorSitio(error)) {", "  if (error instanceof ErrorSitio) {"]] },
  // --- P1-b, funciones puras de grupos (sin exponer) ---------------------------------------------------------------
  { id: "G1-sin-barajar", desc: "sorteo de grupos sin barajar", archivo: FORMATOS, test: T_GRUPOS, patron: "G1", cambios: [
    ["  for (let i = orden.length - 1; i > 0; i--) { const j = rng.int(0, i); [orden[i], orden[j]] = [orden[j]!, orden[i]!]; }\n  return orden;", "  void rng;\n  return orden;"]] },
  { id: "G1-entrada", desc: "barajar el orden de entrada (sin ordenar antes)", archivo: FORMATOS, test: T_GRUPOS, patron: "G1", cambios: [
    ["const orden = [...xs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), rng", "const orden = [...xs], rng"]] },
  { id: "G2-por-grupo", desc: "semillasCruce por grupo (no sobre los 6)", archivo: FORMATOS, test: T_GRUPOS, patron: "G2", cambios: [
    ["const grupos = sorteoGrupos(ids, semilla), semillas = semillasCruce(ids, semilla),", "const grupos = sorteoGrupos(ids, semilla), semillas = new Map([...semillasCruce(sorteoGrupos(ids, semilla).A, semilla), ...semillasCruce(sorteoGrupos(ids, semilla).B, semilla)]),"]] },
  { id: "G2-vuelta", desc: "vuelta sin invertir los lados", archivo: FORMATOS, test: T_GRUPOS, patron: "G2", cambios: [
    ["vuelta: true, local: p.visita, visita: p.local }))];", "vuelta: true }))];"]] },
  { id: "G3", desc: "clasificarGrupo con todos los partidos (llaves incluidas)", archivo: FORMATOS, test: T_GRUPOS, patron: "G3", cambios: [
    ["encuentros: deFase(t, `grupo-${G}`) as never });", "encuentros: t.encuentros as never });"]] },
  { id: "G4-alfabetico", desc: "orden alfabético en lugar del sorteo para pasar", archivo: FORMATOS, test: T_GRUPOS, patron: "G4", cambios: [
    ["if (k === criterios.length) return sorteoSubconjunto(clase, t.semilla, `grupo-${G}`)", "if (k === criterios.length) return [...clase].sort()"]] },
  { id: "G4-posesion", desc: "posesión como criterio en vez de remates directos", archivo: FORMATOS, test: T_GRUPOS, patron: "G4", cambios: [
    ['const criterios: [CriterioPase, ClaveCifra][] = [["remates_directos", "rematesDirectos"], ["remates", "remates"]];', 'const criterios: [CriterioPase, ClaveCifra][] = [["remates_directos", "posesionPct" as ClaveCifra], ["remates", "remates"]];']] },
  { id: "G4-sorteo-antes", desc: "sorteo antes que remates", archivo: FORMATOS, test: T_GRUPOS, patron: "G4", cambios: [
    ["if (k === criterios.length) return sorteoSubconjunto(", "if (k === 1) return sorteoSubconjunto("]] },
  { id: "G5-1A2A", desc: "semifinal 1 = 1A–2A", archivo: FORMATOS, test: T_GRUPOS, patron: "G5", cambios: [
    ['jugarLlave("semifinal-1", A[0]!, B[1]!, jornadaKo, cruceKo)', 'jugarLlave("semifinal-1", A[0]!, A[1]!, jornadaKo, cruceKo)']] },
  { id: "G5-local", desc: "el 2.º de local en la semifinal", archivo: FORMATOS, test: T_GRUPOS, patron: "G5", cambios: [
    ['jugarLlave("semifinal-1", A[0]!, B[1]!, jornadaKo, cruceKo)', 'jugarLlave("semifinal-1", B[1]!, A[0]!, jornadaKo, cruceKo)']] },
  { id: "G6-semilla", desc: "semilla nueva en el desempate", archivo: FORMATOS, test: T_GRUPOS, patron: "G6", cambios: [
    ["const p2: EncuentroPlan062 = { ...base, n: plan.length + 1, local: visita, visita: local, desempate: true };", "const p2: EncuentroPlan062 = { ...base, seed: base.seed + 1, n: plan.length + 1, local: visita, visita: local, desempate: true };"]] },
  { id: "G6-sin-invertir", desc: "desempate sin invertir los lados", archivo: FORMATOS, test: T_GRUPOS, patron: "G6", cambios: [
    ["const p2: EncuentroPlan062 = { ...base, n: plan.length + 1, local: visita, visita: local, desempate: true };", "const p2: EncuentroPlan062 = { ...base, n: plan.length + 1, local, visita, desempate: true };"]] },
  { id: "G6-solo-desempate", desc: "criterios solo sobre el desempate", archivo: FORMATOS, test: T_GRUPOS, patron: "G6", cambios: [
    ["const a = sumaCifra([m1, m2], local, clave), b = sumaCifra([m1, m2], visita, clave);", "const a = sumaCifra([m2], local, clave), b = sumaCifra([m2], visita, clave);"]] },
  { id: "G6-sin-limite", desc: "desempates sin límite", archivo: FORMATOS, test: T_GRUPOS, patron: "G6", cambios: [
    ["      jugados.push(m2);\n", "      jugados.push(m2);\n      if (m2.local.goles === m2.visita.goles) { plan.push({ ...base, n: plan.length + 1, local, visita, desempate: true }); return false; }\n"]] },
  { id: "G6-sorteo-antes", desc: "sorteo antes que el coeficiente", archivo: FORMATOS, test: T_GRUPOS, patron: "G6", cambios: [
    ['if (i >= 0) return { ganador: ca[i]! > cb[i]! ? local : visita, criterio: "coeficiente"', 'if (false && i >= 0) return { ganador: ca[i]! > cb[i]! ? local : visita, criterio: "coeficiente"']] },
  { id: "G7", desc: "cuadro con un grupo incompleto (pendiente)", archivo: FORMATOS, test: T_GRUPOS, patron: "G7", cambios: [
    ["if (plan.some(p => !porN.has(p.n))) return { plan, llaves };", "if (plan.some(p => !porN.has(p.n) && !pendientes.has(p.n))) return { plan, llaves };"]] },
  { id: "G8-grupos", desc: "omitir la reconstrucción del plan (grupos)", archivo: FORMATOS, test: T_GRUPOS, patron: "G8", cambios: [
    ["  for (const e of t.encuentros) {\n    const p = plan[e.n - 1];", "  for (const e of [] as typeof t.encuentros) {\n    const p = plan[e.n - 1];"]] },
];

const filtro = process.argv[2] ? new RegExp(process.argv[2]) : null;
const filas = [];
for (const m of M.filter(x => !filtro || filtro.test(x.id))) {
  const original = readFileSync(m.archivo, "utf8"), md5Original = md5(original);
  let mutado = original;
  for (const [buscar, reemplazo] of m.cambios) {
    const veces = mutado.split(buscar).length - 1;
    if (veces !== 1) throw new Error(`${m.id}: «${buscar.slice(0, 70)}» aparece ${veces} veces en ${m.archivo}`);
    mutado = mutado.replace(buscar, () => reemplazo);
  }
  let estado = "verde (NO detectada)", salida = "";
  try {
    writeFileSync(m.archivo, mutado);
    try {
      salida = execFileSync("npx", ["vitest", "run", "--config", "vitest.config.ts", m.test, "-t", m.patron], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 300_000 });
    } catch (error) { estado = "ROJO (detectada)"; salida = `${error.stdout ?? ""}${error.stderr ?? ""}`; }
  } finally { writeFileSync(m.archivo, original); }
  if (md5(readFileSync(m.archivo, "utf8")) !== md5Original) throw new Error(`${m.id}: el archivo no volvió al original`);
  const resumen = (salida.match(/Tests\s+[^\n]+/) ?? ["(sin resumen)"])[0].replace(/\s+/g, " ").trim().replace(/\|/g, "·");
  const fila = { id: m.id, desc: m.desc, archivo: m.archivo, md5: md5(mutado), test: m.test.split("/").pop(), patron: m.patron, estado, resumen };
  filas.push(fila);
  console.log(`${fila.estado.padEnd(22)} ${m.id.padEnd(14)} ${resumen}`);
}
if (!filtro) {
  const md = [
    "# Brief 062 · mutaciones de la parte de servidor (P1-a)", "",
    `Generado por \`node docs/evidencia/torneo-sitio-062/mutaciones.mjs\` el ${new Date().toISOString()}. Cada mutación se aplicó al`,
    "archivo real, se ejecutó solo la prueba que la nombra (`vitest -t`) y se revirtió (md5 comprobado). «md5» es el del archivo MUTADO.", "",
    "| # | Mutación | Archivo | md5 mutado | Prueba (`-t`) | Resultado | Resumen de vitest |", "|---|---|---|---|---|---|---|",
    ...filas.map(f => `| ${f.id} | ${f.desc} | \`${f.archivo}\` | \`${f.md5}\` | ${f.test} · \`${f.patron.replace(/\|/g, "\\|")}\` | ${f.estado} | ${f.resumen} |`), "",
    `Detectadas: ${filas.filter(f => f.estado.startsWith("ROJO")).length} de ${filas.length}.`, "",
  ];
  writeFileSync("docs/evidencia/torneo-sitio-062/mutaciones.md", md.join("\n"));
}
if (filas.some(f => !f.estado.startsWith("ROJO"))) process.exitCode = 1;
