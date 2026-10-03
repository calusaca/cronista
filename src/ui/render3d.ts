// Brief 021 — el render 3D (Three.js). Este módulo es el ÚNICO que importa three y solo se carga
// con import() perezoso al tocar «3D» (presupuesto del chunk en limites: PRESUPUESTO_CHUNK_3D_KB).
// Geometría procedural, cero modelos descargados: tablero con las líneas de la pizarra 2D (misma
// escala, enMetros), marco del arco, fichas quietas donde la 2D las pone y el balón — lo único que
// se mueve — por los tramos de la escena (escenaDelGol, pura). Cámara: órbita lenta durante el
// vuelo y cámara lenta al llegar. Nada más: sin humanoides, sin coreografía.

import {
  AmbientLight,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  WebGLRenderer,
} from "three";
import { ARCO_3D } from "../sim/limites";
import { enMetros, type Escena3D, type P3, puntoDelTramo } from "../vista/escena3d";
import { MEDIO_CAMPO_M, UNIDADES_POR_M } from "../vista/pizarra";

export type Estado3D = "corriendo" | "terminada";

export interface Colores {
  suelo: string;
  linea: string;
  tinta: string;
  acento: string;
  peligro: string;
  apagado: string;
}

const v = (p: P3) => new Vector3(p.x, p.y, p.z);

/** Una polilínea sobre el césped, en coordenadas de la pizarra 2D (unidades) llevadas a metros. */
function lineaPizarra(puntos: [number, number][], color: string): Line {
  const ps = puntos.map(([x, y]) => {
    const m = enMetros({ x, y });
    return new Vector3(m.x, 0.02, m.z);
  });
  return new Line(new BufferGeometry().setFromPoints(ps), new LineBasicMaterial({ color }));
}

function rotulo(texto: string, color: string): Sprite {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 96;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  g.font = "600 44px system-ui, sans-serif";
  g.fillStyle = color;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(texto, 256, 48);
  const s = new Sprite(new SpriteMaterial({ map: new CanvasTexture(c), transparent: true, depthTest: false }));
  s.scale.set(6, 1.125, 1);
  return s;
}

/** Monta la escena en `contenedor`; devuelve cómo repetirla y cómo desmontarla. */
export function montar(
  contenedor: HTMLElement,
  escena: Escena3D,
  colores: Colores,
  opciones: { sinMovimiento: boolean; onEstado: (e: Estado3D) => void },
): { repetir: () => void; desmontar: () => void } {
  const ancho = contenedor.clientWidth || 600;
  const alto = Math.round(Math.min(420, Math.max(220, ancho * 0.6)));
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(ancho, alto);
  renderer.domElement.setAttribute("data-testid", "pitch-3d-canvas");
  contenedor.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, 1.6));
  const sol = new DirectionalLight(0xffffff, 1.4);
  sol.position.set(-12, 30, 18);
  scene.add(sol);

  // El tablero: de banda a banda de la pizarra 2D, hasta donde llegue la jugada.
  const lado = enMetros({ x: 2, y: 2 }).x;
  const prof = escena.profundidadM;
  const suelo = new Mesh(new PlaneGeometry(-2 * lado, prof + 2), new MeshLambertMaterial({ color: new Color(colores.suelo) }));
  suelo.rotation.x = -Math.PI / 2;
  suelo.position.set(0, 0, prof / 2 - 1);
  scene.add(suelo);
  // Las líneas de la pizarra 2D (los mismos rectángulos y la misma media luna, a la misma escala).
  scene.add(lineaPizarra([[21, 2], [79, 2], [79, 19], [21, 19], [21, 2]], colores.linea));
  scene.add(lineaPizarra([[37, 2], [63, 2], [63, 8], [37, 8], [37, 2]], colores.linea));
  scene.add(lineaPizarra(Array.from({ length: 25 }, (_, k) => [50 + 10 * Math.cos((Math.PI * k) / 24), 19 + 10 * Math.sin((Math.PI * k) / 24)] as [number, number]), colores.linea));
  const punto = enMetros({ x: 50, y: 13 });
  const spot = new Mesh(new CylinderGeometry(0.18, 0.18, 0.02, 16), new MeshLambertMaterial({ color: new Color(colores.linea) }));
  spot.position.set(punto.x, 0.02, punto.z);
  scene.add(spot);
  if (prof > MEDIO_CAMPO_M - 5) scene.add(lineaPizarra([[2, 2 + MEDIO_CAMPO_M * UNIDADES_POR_M], [98, 2 + MEDIO_CAMPO_M * UNIDADES_POR_M]], colores.linea));

  // El arco: dos postes y el travesaño (medidas reglamentarias; la boca, la de la pizarra 2D).
  const palo = enMetros({ x: 55, y: 2 }).x;
  const blanco = new MeshLambertMaterial({ color: new Color(colores.tinta) });
  for (const x of [-palo, palo]) {
    const p = new Mesh(new CylinderGeometry(0.08, 0.08, ARCO_3D.altoM, 12), blanco);
    p.position.set(x, ARCO_3D.altoM / 2, 0);
    scene.add(p);
  }
  const trav = new Mesh(new CylinderGeometry(0.08, 0.08, 2 * palo, 12), blanco);
  trav.rotation.z = Math.PI / 2;
  trav.position.set(0, ARCO_3D.altoM, 0);
  scene.add(trav);
  // El destino registrado (palo + altura): un aro tenue en la boca.
  const meta = new Mesh(new CylinderGeometry(0.32, 0.32, 0.02, 24), new MeshLambertMaterial({ color: new Color(colores.acento), transparent: true, opacity: 0.55 }));
  meta.rotation.x = Math.PI / 2;
  meta.position.copy(v(escena.destino.valor));
  scene.add(meta);

  // Las fichas: piezas de pizarra QUIETAS en sus zonas (no caminan, no patean, no celebran).
  for (const f of escena.fichas) {
    const color = f.rol === "autor" ? colores.peligro : f.rol === "tirador" ? colores.acento : colores.apagado;
    const pieza = new Group();
    const mat = new MeshLambertMaterial({ color: new Color(color) });
    const base = new Mesh(new CylinderGeometry(0.75, 0.9, 0.35, 24), mat);
    base.position.y = 0.175;
    const cuerpo = new Mesh(new CylinderGeometry(0.35, 0.55, 1.3, 20), mat);
    cuerpo.position.y = 1.0;
    const cabeza = new Mesh(new SphereGeometry(0.38, 20, 14), mat);
    cabeza.position.y = 1.95;
    pieza.add(base, cuerpo, cabeza);
    pieza.position.set(f.x, 0, f.z);
    scene.add(pieza);
    const r = rotulo(f.jugador.split(" ").slice(1).join(" ") || f.jugador, colores.tinta);
    r.position.set(f.x, 3.1, f.z);
    scene.add(r);
  }

  // El balón y su estela.
  const balon = new Mesh(new SphereGeometry(0.32, 24, 16), new MeshLambertMaterial({ color: new Color(colores.tinta) }));
  scene.add(balon);
  const estela = new Line(new BufferGeometry(), new LineBasicMaterial({ color: new Color(colores.acento) }));
  scene.add(estela);

  // Encuadre: la caja de TODA la jugada (cada tramo, las fichas y el arco), vista desde detrás del
  // atacante y un poco hacia el lado del remate; la órbita solo gira unos grados durante el vuelo.
  const camara = new PerspectiveCamera(38, ancho / alto, 0.1, 400);
  const puntos = [...escena.tramos.flatMap((t) => [t.desde, t.hasta]), escena.destino.valor, ...escena.fichas.map((f) => ({ x: f.x, y: 0, z: f.z }))];
  const xs = puntos.map((p) => p.x);
  const zs = puntos.map((p) => p.z);
  // El centro de interés es el REMATE (de él al arco); el origen del pase tira un 25 % del encuadre.
  const remate = escena.tramos.find((t) => t.rol === "remate")?.desde ?? { x: 0, y: 0, z: 10 };
  const origen = escena.tramos.find((t) => t.rol === "pase")?.desde;
  const foco = { x: remate.x / 2, z: remate.z / 2 };
  const objetivo = new Vector3(origen ? foco.x * 0.75 + origen.x * 0.25 : foco.x, 1, origen ? foco.z * 0.75 + origen.z * 0.25 : foco.z);
  const extension = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), 12);
  const radio = Math.min(110, Math.max(18, extension * 0.85 + 6));
  // Con un pase previo, la cámara se abre al lado CONTRARIO del origen (el centro viene hacia ella);
  // sin pase, hacia el lado del remate.
  const ladoRemate = origen && origen.x !== 0 ? -Math.sign(origen.x) * 1.4 : remate.x === 0 ? 1 : Math.sign(remate.x);
  const encuadre = (giro: number) => {
    const a = ladoRemate * 0.32 + giro; // detrás del atacante, abierto hacia el lado del remate
    camara.position.set(objetivo.x + Math.sin(a) * radio, Math.max(8, radio * 0.6), objetivo.z + Math.cos(a) * radio);
    camara.lookAt(objetivo);
  };

  const total = escena.duracionTotalS;
  const posicion = (s: number): P3 => {
    let resto = s;
    for (const t of escena.tramos) {
      if (resto <= t.duracionS.valor) return puntoDelTramo(t, resto / t.duracionS.valor);
      resto -= t.duracionS.valor;
    }
    const ultimo = escena.tramos[escena.tramos.length - 1];
    return ultimo ? ultimo.hasta : escena.destino.valor;
  };
  const dibujar = (s: number) => {
    balon.position.copy(v(posicion(s)));
    const n = 48;
    estela.geometry.dispose();
    estela.geometry = new BufferGeometry().setFromPoints(Array.from({ length: n + 1 }, (_, k) => v(posicion((s * k) / n))));
    encuadre((s / Math.max(total, 0.001)) * 0.35);
    renderer.render(scene, camara);
  };

  let raf = 0;
  const correr = () => {
    cancelAnimationFrame(raf);
    opciones.onEstado("corriendo");
    if (opciones.sinMovimiento) {
      dibujar(total);
      opciones.onEstado("terminada");
      return;
    }
    let simulado = 0;
    let previo = performance.now();
    const paso = (ahora: number) => {
      const dt = (ahora - previo) / 1000;
      previo = ahora;
      // Cámara lenta al llegar: el último 15 % del vuelo, a 0,4×.
      simulado = Math.min(total, simulado + dt * (simulado > total * 0.85 ? 0.4 : 1));
      dibujar(simulado);
      if (simulado < total) raf = requestAnimationFrame(paso);
      else opciones.onEstado("terminada");
    };
    raf = requestAnimationFrame(paso);
  };
  correr();

  return {
    repetir: correr,
    desmontar: () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
