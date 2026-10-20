import { efectosEntorno } from "./entorno";
import { ARENA } from "../sim/limites";
import { rival, type ObservacionArena } from "./tipos";

/** Lectura de datos públicos observados, sin atribuir intenciones privadas al rival. */
export function contextoCompetitivo(obs: ObservacionArena) {
  const contrario = rival(obs.lado), propios = obs.estado.marcador[obs.lado], ajenos = obs.estado.marcador[contrario];
  const acciones = obs.recientes.filter(e => e.lado === contrario && e.tick <= obs.estado.tick);
  const pases = acciones.filter(e => e.tipo === "pase");
  const canales = { izquierda: 0, centro: 0, derecha: 0 };
  for (const pase of pases) {
    const y = contrario === "local" ? pase.hasta.y : ARENA.anchoM - pase.hasta.y;
    canales[y < ARENA.anchoM / 3 ? "izquierda" : y > 2 * ARENA.anchoM / 3 ? "derecha" : "centro"]++;
  }
  const config = { partido: { condiciones: obs.condiciones ?? undefined } };
  return {
    objetivo: "Ganar: terminar con más goles que el rival. Crear ocasiones propias y evitar las del contrario.",
    golesPropios: propios, golesRival: ajenos, situacion: propios < ajenos ? "perdiendo" : propios > ajenos ? "ganando" : "empatando",
    segundosRestantes: obs.duracionS === undefined ? null : Math.max(0, obs.duracionS - obs.tiempoS),
    rival: { lado: contrario, nombre: obs.equipos[contrario].nombre, formacionVisible: obs.equipos[contrario].formacion,
      resumenObservado: obs.resumen?.[contrario] ?? null,
      muestraPasesRecientes: { cantidad: pases.length, canales, longitudMediaM: pases.length ? Math.round(pases.reduce((s, e) => s + e.distanciaM, 0) / pases.length) : null, fuentes: pases.map(e => e.id) },
      accionesObservadas: acciones.map(e => ({ id: e.id, tipo: e.tipo, jugador: e.jugador, receptor: e.receptor })),
    },
    efectosActuales: obs.estado.entrenadores ? { paseCortoM: 10, paseLargoM: 40,
      propios: { corto: efectosEntorno(config, obs.estado, obs.lado, 10), largo: efectosEntorno(config, obs.estado, obs.lado, 40) },
      rival: { corto: efectosEntorno(config, obs.estado, contrario, 10), largo: efectosEntorno(config, obs.estado, contrario, 40) },
    } : null,
    criterio: "Estos conteos describen la muestra visible; no prueban un patrón estable ni revelan las próximas órdenes del rival.",
  };
}
