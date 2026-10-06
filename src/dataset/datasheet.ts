// Brief 028 §2 — el data card, formato «Datasheets for Datasets» (Gebru et al.), GENERADO entero
// desde el código y la corrida. Toda cifra pasa por `t`/`cifra` (texto.ts): la prueba de cifras
// huérfanas borra lo marcado y exige que no quede ningún dígito, y la de regeneración exige que el
// archivo commiteado sea byte a byte lo que produce el CLI.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TIPOS_HECHO } from "../analista/tipos";
import { EQUIPOS_POR_LIGA, LIGA_DESTACADA, MUNDO_SEMILLA, N_PAISES, TEMPORADA_ACTUAL } from "../analista/umbrales";
import { mundo } from "../mundo/mundo";
import { jornadasDe } from "../mundo/temporada";
import { CANALES, N_AB, N_ESTADISTICA, ZONAS_ORIGEN } from "../sim/limites";
import { NIVELES } from "../sim/parametros";
import { SEED_MAX, SUPLENTES, TITULARES } from "../sim/tipos";
import { CAMPOS_EVENTO, CAMPOS_HECHO, CAMPOS_LINEA, CAMPOS_MICRO, type Campo } from "./esquema";
import { COLUMNAS_CSV } from "./exportar";
import type { Experimento, TamanoExperimentos } from "./experimentos";
import type { ArchivoGenerado, OpcionesDataset } from "./generar";
import type { Composicion, Estructura, Medicion } from "./medir";
import { aTexto, cifra, dec, miles, pct, t, type Texto } from "./texto";
import { ARCHIVOS, CONFIANZA, CSV_DECIMALES_XG, ESQUEMA, GZIP, MUESTRA_ARCHIVO, MUESTRA_SEMILLAS, VARIANTES_DATASET } from "./umbrales-dataset";

export interface Modelo {
  opciones: OpcionesDataset;
  comando: string;
  archivos: ArchivoGenerado[];
  composicion: Composicion;
  estructura: Estructura;
  mediciones: Medicion[];
  experimentos: Experimento[];
  tamano: TamanoExperimentos;
}

/** Raíz del repo (para leer el archivo de licencia, si existe). */
const RAIZ = process.cwd();

// ---- formatos ----

function valor(m: Pick<Medicion, "formato">, x: number): Texto {
  const f = m.formato;
  return t`${f.tipo === "int" ? miles(x) : f.tipo === "pct" ? pct(x, f.d) : dec(x, f.d)}`;
}

function banda(m: Medicion): Texto {
  const lo = m.min !== undefined ? valor(m, m.min) : undefined;
  const hi = m.max !== undefined ? valor(m, m.max) : undefined;
  if (lo && hi) return m.maxEstricto ? [...t`≥ `, ...lo, ...t` and < `, ...hi] : [...lo, " – ", ...hi];
  if (lo) return ["≥ ", ...lo];
  if (hi) return [m.maxEstricto ? "< " : "≤ ", ...hi];
  return ["—"];
}

const VEREDICTO: Record<Medicion["veredicto"], string> = {
  en_banda: "in band",
  consistente: "consistent at this N",
  fuera: "**OUT OF BAND**",
};

const fila = (celdas: Texto[]): Texto => ["| ", ...celdas.flatMap((c, i) => (i === 0 ? c : [" | ", ...c])), " |"];
const cabecera = (titulos: string[]): Texto[] => [fila(titulos.map((x) => [x])), fila(titulos.map(() => ["---"]))];
const codigo = (s: string): Texto => [`\`${s}\``];
const codigoCifra = (s: string): Texto => ["`", cifra(s), "`"];
/** El nombre de una constante del código (p. ej. `calorPases2T`): su dígito es parte del identificador. */
const constante = (s: string): Texto => (/\d/.test(s) ? codigoCifra(s) : codigo(s));
const n1 = (k: number, total: number): Texto => t`${miles(k)} (${pct(total === 0 ? 0 : k / total, 1)})`;

function diccionario(titulo: string, campos: readonly Campo[]): Texto[] {
  // El diccionario vive en el código (esquema.ts, compartido con /datos): sus ejemplos de formato
  // («e001», «0–100») son contrato documentado, no cifras de la corrida; entran marcados como tales.
  const doc = (s: string): Texto => [/\d/.test(s) ? cifra(s) : s];
  return [[`**${titulo}**`], [], ...cabecera(["Field", "Type", "Meaning"]), ...campos.map((c) => fila([codigo(c.campo), doc(c.tipo), doc(c.en)])), []];
}

function licencia(): Texto[] {
  const ruta = ["LICENSE", "LICENSE.md", "LICENSE.txt"].map((f) => join(RAIZ, f)).find((r) => existsSync(r));
  const datos = [
    "The data is entirely fictitious: teams, players, leagues, countries and stadium conditions are invented; club names combine generic prefixes with invented places and player surnames are assembled from invented syllables. No real match data, footage, club, player, league or trademark is used, and no personal data exists in the dataset.",
  ];
  if (!ruta) {
    return [
      [
        "The dataset is distributed under the license of the CRONISTA repository. **No license file exists in the repository yet**, so no license is granted by this version; this section will name it once the file is added (regenerating the datasheet picks it up).",
      ],
      [],
      datos,
    ];
  }
  const primera = (readFileSync(ruta, "utf8").split(/\r?\n/).find((l) => l.trim().length > 0) ?? "").trim();
  return [[`The dataset is distributed under the license of the CRONISTA repository: `, cifra(primera), ` (see the repository's license file).`], [], datos];
}

// ---- secciones ----

function descripcionCorrida(m: Modelo): Texto {
  const md = m.opciones.modo;
  if (md.tipo === "semillas")
    return t`seed matches for seeds ${miles(1)}–${miles(md.n)}, with every engine variant that exists in a single match switched on`;
  return t`one full league season — ${md.liga}, season ${md.temporada} — exactly the configurations the League page plays`;
}

function motivacion(): Texto[] {
  return [
    ["## Motivation"],
    [],
    [
      "**Purpose.** A dataset of complete, simulated football matches for building and testing *explainable* match intelligence: every macro event, the micro layer of play behind it, and the Analyst's facts with explicit citations to the events that support them. It is the data side of CRONISTA, whose writer may only publish sentences backed by those citations.",
    ],
    [],
    [
      "**Why synthetic.** The hackathon rules forbid real match data, footage or material, and real club and player names are trademarks. Synthetic data also buys total reproducibility: every line carries the input (`fuente`) that regenerates it, and the whole dataset is the output of one deterministic command.",
    ],
    [],
    ["**Who and for what.** Created by the CRONISTA project for the *Inside the Game* hackathon (Microsoft × Premier League). No Premier League data, footage or names are used."],
    [],
  ];
}

function composicion(m: Modelo): Texto[] {
  const c = m.composicion;
  const p = c.partidos;
  const out: Texto[] = [
    ["## Composition"],
    [],
    t`**Instances.** One instance is one simulated match: one line of ${codigoCifra(ARCHIVOS.partidos)}. This run contains ${descripcionCorrida(m)}.`,
    [],
    ...cabecera(["Count (this run)", "Total", "Per match"]),
    fila([["Matches"], t`${miles(p)}`, ["—"]]),
    fila([["Macro events"], t`${miles(c.eventos)}`, t`${dec(c.eventos / p, 1)}`]),
    fila([["Micro-events (passes, carries, dribbles, duels, losses, recoveries)"], t`${miles(c.micro.total)}`, t`${dec(c.micro.media, 1)} (min ${miles(c.micro.min)}, max ${miles(c.micro.max)})`]),
    fila([["Possessions"], t`${miles(c.posesiones)}`, t`${dec(c.posesiones / p, 1)}`]),
    fila([["Analyst facts"], t`${miles(c.hechos)}`, t`${dec(c.hechos / p, 1)}`]),
    fila([["Micro-events cited by facts (included in the line)"], t`${miles(c.microCitados)}`, t`${dec(c.microCitados / p, 1)}`]),
    fila([["Goals"], t`${miles(c.goles)}`, t`${dec(c.goles / p, 2)}`]),
    fila([["Home wins · draws · away wins"], [...n1(c.victoriasLocal, p), " · ", ...n1(c.empates, p), " · ", ...n1(c.victoriasVisita, p)], ["—"]]),
    fila([["Distinct club names · player names"], t`${miles(c.equipos)} · ${miles(c.jugadores)}`, ["—"]]),
    fila([["Matches with recorded conditions · absences · club sanctions"], t`${miles(c.conCondiciones)} · ${miles(c.conBajas)} · ${miles(c.conSancionesClub)}`, ["—"]]),
    [],
    m.opciones.modo.tipo === "semillas"
      ? t`**Team names repeat across seeds.** A seed match draws its two club names from a small vocabulary (this run: ${miles(c.equipos)} distinct names for ${miles(p * 2)} team slots). The same name in two seed matches is two different teams — different squads, ratings and styles; group by \`id\`, never by club name. Players are unique within a match.`
      : t`**Teams persist across the season.** League teams and squads are the same from round to round (absences aside), so grouping by club name is meaningful in league mode.`,
    [],
    ["**Macro events by type**"],
    [],
    ...cabecera(["Type (`tipo`)", "Count", "Per match"]),
    ...c.eventosPorTipo.map(([k, v]) => fila([codigo(k), t`${miles(v)}`, t`${dec(v / p, 2)}`])),
    [],
    t`**Analyst facts by type** (${miles(c.hechosPorTipo.length)} of the ${miles(TIPOS_HECHO.length)} fact types occur in this run)`,
    [],
    ...cabecera(["Type (`hechos[].tipo`)", "Count", "Matches with it"]),
    ...c.hechosPorTipo.map(([k, v, w]) => fila([codigo(k), t`${miles(v)}`, n1(w, p)])),
    [],
    ["**Files**"],
    [],
    [...fila([["File"], ["Lines"], ["Bytes"], [cifra("SHA-256")]])],
    fila([["---"], ["---"], ["---"], ["---"]]),
    ...m.archivos.map((a) => fila([codigoCifra(a.nombre), t`${miles(a.lineas)}`, t`${miles(a.bytes)}`, codigoCifra(a.sha256)])),
    [],
  ];
  if (!m.opciones.micro)
    out.push(t`The full micro layer (${codigoCifra(ARCHIVOS.micro)}, one line per match with every micro-event and possession) is not part of this run; add ${codigo("--micro")} to write it. The micro counts above are computed either way.`, []);
  out.push(
    t`**Format.** ${cifra("UTF-8")} text; LF line endings; JSON keys in the order the code builds them; optional fields are omitted when they do not apply (never ${codigo("null")}). The CSV has a header row and a byte-order mark (so spreadsheet software reads the accents), quotes per ${cifra("RFC 4180")}, and rounds xG to ${miles(CSV_DECIMALES_XG)} decimals (the JSONL keeps exact values). The gzip container is written with MTIME ${miles(GZIP.mtime)} and OS ${miles(GZIP.os)}, so the compressed bytes do not depend on the clock or the machine.`,
    [],
    t`**Field names** are the code's own (Spanish), schema ${codigoCifra(ESQUEMA)}; they are documented here in English and not translated (one source of truth). Every line validates against the zod schema in ${codigo("src/dataset/esquema.ts")}.`,
    [],
    ...diccionario("partidos.jsonl — one line per match", CAMPOS_LINEA),
    ...diccionario("eventos[] — macro events", CAMPOS_EVENTO),
    ...diccionario("hechos[] — Analyst facts", CAMPOS_HECHO),
    ...diccionario("microCitados[] and micro.jsonl.gz — micro-events", CAMPOS_MICRO),
    t`**${ARCHIVOS.resumen}** — one row per match, ${miles(COLUMNAS_CSV.length)} columns: ${COLUMNAS_CSV.map((k) => `\`${k}\``).join(", ")}. Empty cells mean «not recorded» (e.g. conditions in a seed match). ${codigo("racha_pases_max_*")} is the longest run of completed passes by one team inside one possession; ${codigo("oles")} counts the crowd's «olé» streaks as defined by the Analyst.`,
    [],
    ["**Personal or confidential data.** None. Everything is generated."],
    [],
  );
  return out;
}

function generacion(m: Modelo): Texto[] {
  const bits = Math.log2(SEED_MAX + 1);
  const ligas = mundo().ligas;
  const variantes = Object.keys(VARIANTES_DATASET).map((k) => `\`${k}\``).join(", ");
  return [
    ["## Generation process"],
    [],
    ["**A deterministic chain per seed, with no network and no language model:**"],
    [],
    ["- **Teams.** The seed builds two fictitious teams and their squads from a stream of its own, separate from the match."],
    [
      "- **Levels.** Each player gets a level (",
      ...codigo("nivel"),
      ...t`) from a derived stream: Normal(team mean, ${miles(NIVELES.sigma)}), clipped to ±${miles(NIVELES.recorte)} around it and corrected so that the ${miles(TITULARES + SUPLENTES)}-player squad averages EXACTLY the mean of the team's attack and defence.`,
    ],
    t`- **Match.** The engine plays the match minute by minute from the seed's main stream (a ${cifra("mulberry32")} generator).`,
    t`- **Detail.** Spatial detail (shot origin zone, target, height, distance, speed, finish) comes from streams derived per event (an ${cifra("FNV-1a")} hash of seed and event id), so adding detail never moves the main stream.`,
    [
      "- **Micro layer.** A pure function of the macro events: each stretch of play is drawn from a stream keyed by the event that closes it, so the micro layer of a match prefix is exactly the prefix of the full micro layer.",
    ],
    ["- **Facts.** The Analyst — deterministic code with tests, not a model — derives the facts and their citations."],
    [],
    [`**Variants.** Seed matches switch on every engine variant that exists in a single match: ${variantes}. Club sanctions need a season's register and exist only in league mode.`],
    [],
    t`**League mode** (${codigo("--liga")}). A fixed fictitious world (world seed ${String(MUNDO_SEMILLA)}): ${miles(N_PAISES)} countries with climate profiles, ${miles(ligas.length)} leagues of ${miles(EQUIPOS_POR_LIGA)} teams, ${miles(jornadasDe(ligas[0] as (typeof ligas)[number]))} rounds home and away. A season is played round by round with a register: weather drawn from the country's profile, the home pitch, crowd pressure, suspensions, injuries with missed rounds, club sanctions. The app's League page shows ${codigo(LIGA_DESTACADA)}, season ${miles(TEMPORADA_ACTUAL)}.`,
    [],
    t`**Size of the input space** (a size, not a uniqueness claim). A seed match is indexed by an unsigned ${miles(bits)}-bit seed: ${cifra(`2^${bits}`)} possible inputs. A league match is indexed by world seed × season × league × round × fixture; its engine seed is itself a ${miles(bits)}-bit hash of (league, season, round, fixture), so the league adds context (conditions, absences, levels, sanctions) on top of the same ${cifra(`2^${bits}`)} engine seeds. Distinct inputs are not guaranteed to give distinct matches; nothing in this datasheet depends on that.`,
    [],
    t`**Reproduce.** ${codigoCifra(m.comando)} regenerates every file listed above byte for byte, and this datasheet with them. The ${miles(MUESTRA_SEMILLAS.length)}-match sample served by the app (${codigoCifra(`public/${MUESTRA_ARCHIVO}`)}, seeds ${miles(MUESTRA_SEMILLAS[0] as number)}–${miles(MUESTRA_SEMILLAS[MUESTRA_SEMILLAS.length - 1] as number)}) is ${codigo("npm run dataset -- --muestra")}, and equals the first lines of a seed run.`,
    [],
    [
      "**Not the same as the app's single-match page.** ",
      ...codigo("/match/<seed>"),
      " shows the base engine without variants, so the same seed there is a different match (same teams, different events). The dataset is the variant-rich version.",
    ],
    [],
  ];
}

function validacion(m: Modelo): Texto[] {
  const e = m.estructura;
  const ms = m.mediciones;
  const en = ms.filter((x) => x.veredicto === "en_banda").length;
  const co = ms.filter((x) => x.veredicto === "consistente").length;
  const fu = ms.length - en - co;
  const xs = m.experimentos;
  const xen = xs.filter((x) => x.veredicto === "en_banda").length;
  const ref = (x: Medicion): Texto => (x.referencia ? [...valor(x, x.referencia.min), " – ", ...valor(x, x.referencia.max)] : ["—"]);
  const intervalo = (x: Medicion): Texto => (x.intervalo ? [...valor(x, x.intervalo[0]), " – ", ...valor(x, x.intervalo[1])] : ["exact"]);
  const medido = (x: Medicion): Texto => (x.conteo !== undefined ? [...valor(x, x.medido), ...t` (${miles(x.conteo)})`] : valor(x, x.medido));
  return [
    ["## Validation"],
    [],
    t`**Structural checks on every match of this run.** ${miles(e.verificadores)} invariant checkers of the engine (minutes, links between events, players on the pitch, substitutions, spatial coherence, conditions, injuries, levels, rare events, club sanctions, micro layer) × ${miles(e.lineas)} matches = ${miles(e.comprobaciones)} checks: **${miles(e.violaciones)} violations**. ${miles(e.lineas)} lines parsed against the zod schema with every citation resolved inside its own line: **${miles(e.lineasInvalidas)} invalid**.`,
    [],
    t`**Plausibility bands, re-measured on this run.** Each band is imported from ${codigo("src/sim/limites.ts")} (the single home of the simulator's statistical thresholds) and measured again on the matches above, with a ${cifra(CONFIANZA.etiqueta)} interval (Wilson for shares, normal for means). Verdicts: *in band* — the measured value is inside; *consistent at this N* — it is outside but the interval overlaps the band, so this sample cannot tell; **OUT OF BAND** — not even the interval reaches it. Result: ${miles(en)} in band, ${miles(co)} consistent, ${miles(fu)} out, of ${miles(ms.length)}. The same bands are asserted by ${codigo("npm run test:stats")} on ${miles(N_ESTADISTICA)} matches.`,
    [],
    ...cabecera(["Measure", "Band", "Source", "Measured (count)", "Interval", "n", "Top-league reference", "Verdict"]),
    ...ms.map((x) => fila([x.medida, banda(x), constante(x.fuente), medido(x), intervalo(x), t`${miles(x.n)} ${x.unidad}`, ref(x), [VEREDICTO[x.veredicto]]])),
    [],
    [
      "*Top-league reference*: order-of-magnitude figures for recent seasons of top European leagues, kept in ",
      ...codigo("REFERENCIA_LIGAS_TOP"),
      " (approximate; not a test band). Rare-event bands (finishes, rare events) need far more matches than a small run to resolve; the interval says so instead of hiding it.",
    ],
    [],
    t`**Controlled experiments of the generator** (not of this run: the same seeds with and without the factor, re-run by the command). Styles and the stronger side use seeds ${miles(1)}–${miles(m.tamano.estilos)}; each condition A/B uses ${miles(m.tamano.ab)} matches per arm (the test suite uses ${miles(N_ESTADISTICA)} and ${miles(N_AB)}). Verdict on the point value, as in the test suite: ${miles(xen)} of ${miles(xs.length)} in band.`,
    [],
    ...cabecera(["Experiment", "Band", "Source", "Measured", "n", "Verdict"]),
    ...xs.map((x) => fila([x.medida, banda(x), constante(x.fuente), valor(x, x.medido), t`${miles(x.n)} ${x.unidad}`, [VEREDICTO[x.veredicto]]])),
    [],
  ];
}

function usos(): Texto[] {
  return [
    ["## Uses & limitations"],
    [],
    [
      "**Intended uses.** Testing pipelines that turn structured events into text and must justify every claim; benchmarking fact verification (each fact lists its supporting events); teaching football analytics with data that has no licensing strings; load and UI testing with realistic volume (thousands of micro-events per match).",
    ],
    [],
    ["**Not suitable for.** Inferring anything about real football, real teams or real players; betting; scouting. The bands make the matches plausible, not faithful."],
    [],
    ["**Limitations (honest).**"],
    [],
    [
      "- **Correlated by design.** Derived streams are keyed by the seed and the event, so spatial detail, the micro layer and the facts are deterministic functions of the macro events of the same match — not independent samples. The micro layer is generated *after* the macro events, to explain them.",
    ],
    t`- **Zones, not positions.** Locations are closed vocabularies (${miles(ZONAS_ORIGEN.length)} shot-origin zones, ${miles(CANALES.length)} channels, pitch thirds); there are no continuous coordinates and no tracking data.`,
    [
      "- **Consequences need a season.** In seed matches an injury happens and ends the player's match, but missed rounds, suspensions and club sanctions only exist in league mode, where a register carries them to the next round.",
    ],
    ["- **Seed-match teams are not entities.** Club names are drawn from a small vocabulary and repeat across seeds without being the same team; only league mode has persistent teams."],
    ["- **One season.** League mode exports one season of one league per run; there is no multi-season history (sanctions issued in the last round are lost)."],
    ["- **One engine.** Every match comes from the same simulator; its modelling choices (and their blind spots) are in every line. Facts are template statements, not commentary."],
    ["- **Small runs cannot resolve rare events.** See the intervals in Validation."],
    [],
  ];
}

export function renderDatasheet(m: Modelo, instrumentado = false): string {
  const lineas: Texto[] = [
    ["# CRONISTA synthetic match dataset — Datasheet"],
    [],
    t`Schema ${codigoCifra(ESQUEMA)} · generated by ${codigoCifra(m.comando)}. Structured as a *Datasheet for Datasets* (Gebru et al.). Every figure in this file is computed by that command, from the code (bands, vocabularies, constants) and from this run; regenerating it gives this file byte for byte.`,
    [],
    ...motivacion(),
    ...composicion(m),
    ...generacion(m),
    ...validacion(m),
    ...usos(),
    ["## License"],
    [],
    ...licencia(),
  ];
  return `${lineas.map((l) => aTexto(l, instrumentado)).join("\n").replace(/\n+$/, "")}\n`;
}
