import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { construirRelato } from "./relato";
import { claveAudio, prepararVoz, sintetizarVoz } from "./voz";
import type { FragmentoVoz } from "./expresion";
import { reproducirArena } from "./coordinador";
import { GestorSesiones } from "./sesiones";
import { cerrarTelemetria } from "../lib/telemetria";

async function main() {
  const args = process.argv.slice(2);
  if (args.some(a => a !== "--sintetizar")) throw new Error("Usar --sintetizar para Speech; sin opciones solo prepara SSML");
  const sintetizar = args.includes("--sintetizar");
  if (sintetizar) for (const file of [".env", ".cache/azure-servicios.env"]) if (existsSync(file)) process.loadEnvFile(file);
  const archivo = "public/experimentos/arena-duelo-v3.json", datos = readFileSync(archivo);
  const registro = reproducirArena(JSON.parse(datos.toString("utf8")));
  const todos = (idioma: "es" | "en") => Array.from({ length: 6 }, (_, i) => construirRelato(registro, i * 100, (i + 1) * 100, "completo", idioma).fragmentos).flat();
  const es = todos("es"), en = todos("en"), gol = registro.eventos.find(e => e.tipo === "gol")!;
  const muestraGol = (lista: FragmentoVoz[]) => {
    const confirmado = lista.find(f => f.tick === gol.tick && f.emocion === "jubilo" && f.fuentes[0] === gol.id);
    if (!confirmado) throw new Error("Falta el gol primario de la muestra");
    const tiro = lista.filter(f => f.tick <= gol.tick && f.emocion === "emocion").at(-1);
    return [...(tiro ? [tiro] : []), confirmado];
  };
  const esGol = muestraGol(es);
  const muestras: { nombre: string; idioma: "es" | "en"; fragmentos: FragmentoVoz[] }[] = [
    { nombre: "calma-es", idioma: "es", fragmentos: es.filter(f => f.emocion === "serena" && f.fuentes.some(id => registro.eventos.some(e => e.id === id && e.tipo === "pase"))).slice(0, 2) },
    { nombre: "ataque-es", idioma: "es", fragmentos: es.filter(f => f.emocion === "tension" && f.fotogramas.length === 2).slice(0, 1) },
    { nombre: "gol-es", idioma: "es", fragmentos: esGol },
    { nombre: "gol-en", idioma: "en", fragmentos: muestraGol(en) },
    { nombre: "gol-es-sereno", idioma: "es", fragmentos: esGol.map(f => ({ ...f, emocion: "serena", intensidad: 0.18 })) },
  ];
  if (muestras.some(m => !m.fragmentos.length)) throw new Error("La grabación no contiene alguna escena necesaria");
  const preparadas = muestras.map(m => ({ ...m, preparada: prepararVoz(m.fragmentos, m.idioma), tick: m.fragmentos.at(-1)!.tick }));
  const presupuesto = preparadas.reduce((s, m) => s + m.preparada.caracteresPresupuestados, 0);
  if (presupuesto > 12_000) throw new Error("Muestras fuera del presupuesto de 12.000 caracteres con marcas");
  const ruta = "docs/evidencia/voz-expresiva"; mkdirSync(ruta, { recursive: true });
  const informe = { checkedUtc: new Date().toISOString(), phase: sintetizar ? "synthesis_pending" : "prepared_without_synthesis", recording: archivo, recordingSha256: createHash("sha256").update(datos).digest("hex"), teamModelCalls: 0, maximumSpeechCalls: 5, reservedCharactersIncludingMarkup: presupuesto, session: null as string | null, samples: [] as unknown[] };
  writeFileSync(`${ruta}/muestras.json`, JSON.stringify(informe, null, 2) + "\n");
  const gestor = sintetizar ? new GestorSesiones() : null;
  if (gestor) informe.session = (await gestor.registrarGrabacion(registro, "muestras-voz-expresiva-v1")).id;
  try {
    for (const m of preparadas) {
      const ssmlFile = `${ruta}/${m.nombre}.ssml`; writeFileSync(ssmlFile, m.preparada.ssml);
      let resultado: { archivoAudio: string; bytes: number; sha256: string } | undefined;
      if (gestor) {
        const audio = await gestor.extra(informe.session!, "audio", claveAudio(m.preparada, m.tick), () => sintetizarVoz(m.preparada, m.tick), m.preparada.caracteresPresupuestados);
        const bytes = Buffer.from(audio.base64, "base64"), archivoAudio = `${ruta}/${m.nombre}.mp3`;
        writeFileSync(archivoAudio, bytes); resultado = { archivoAudio, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
      }
      informe.samples.push({ nombre: m.nombre, idioma: m.idioma, tick: m.tick, texto: m.preparada.texto, voz: m.preparada.voz, version: m.preparada.version, fragmentos: m.fragmentos, caracteresPresupuestados: m.preparada.caracteresPresupuestados, ssmlFile, ...resultado });
      writeFileSync(`${ruta}/muestras.json`, JSON.stringify(informe, null, 2) + "\n");
    }
    informe.phase = sintetizar ? "real_speech_generated_human_listening_pending" : "prepared_without_synthesis";
    writeFileSync(`${ruta}/muestras.json`, JSON.stringify(informe, null, 2) + "\n");
    console.log(JSON.stringify({ phase: informe.phase, samples: informe.samples.length, maximumSpeechCalls: informe.maximumSpeechCalls, reservedCharactersIncludingMarkup: presupuesto, session: informe.session }));
  } finally { await cerrarTelemetria(); }
}
main().catch(error => { console.error(JSON.stringify({ error: "Muestras de voz no completadas", tipo: error instanceof Error ? error.name : "Error" })); process.exitCode = 1; });
