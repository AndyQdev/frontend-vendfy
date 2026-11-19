import { apiFetch } from "@/shared/api/client";
import { plataforma } from "@/shared/nativo";

/**
 * La bitácora de cada sesión del piloto: desde que se abre («Oye Vendfy», F9,
 * el botón o el teclado) hasta que se cierra, con cada paso y por qué terminó.
 *
 * Al cerrarse viaja al servidor (POST /api/omnibox/piloto/sesion) y se ve en
 * el super-admin, en el Workflow IA, flujo «Piloto de voz». Los nodos son los
 * de `piloto_voz` en ventas-service/src/agent/workflow/node-registry.ts: si se
 * agrega uno acá, se declara allá.
 *
 * Nunca frena al piloto: si no se puede mandar, se pierde y listo.
 */
export type NodoPiloto =
  | "p_apertura"
  | "p_escucha"
  | "p_sin_voz"
  | "p_transcripcion"
  | "p_palabra_rescatada"
  | "p_interpretacion"
  | "p_respuesta_corta"
  | "p_repregunta"
  | "p_plan"
  | "p_pantalla"
  | "p_llena"
  | "p_pregunta"
  | "p_guarda"
  | "p_asistente"
  | "p_habla"
  | "p_error"
  | "p_cierre";

export type OrigenSesion = "palabra" | "atajo" | "boton" | "teclado";
export type MotivoCierre = "terminado" | "sin_respuesta" | "cerrado" | "error" | "al_asistente" | "falsa_alarma" | "otro";

interface Evento {
  nodo: NodoPiloto;
  ms: number;
  estado: "ok" | "error";
  nota?: string;
  entrada?: unknown;
  salida?: unknown;
}

interface Sesion {
  id: string;
  storeId: string;
  origen: OrigenSesion;
  inicio: number;
  ultimo: number;
  eventos: Evento[];
  primerDicho: string | null;
  ultimaLinea: string | null;
  motivo: MotivoCierre | null;
  error: boolean;
}

const MAX_EVENTOS = 80;
let sesion: Sesion | null = null;

function nuevoId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  }
}

/** Empieza una sesión (si ya había una abierta, sigue esa: es la misma conversación). */
export function abrirSesion(storeId: string | null | undefined, origen: OrigenSesion) {
  if (sesion || !storeId) return;
  const ahora = Date.now();
  sesion = { id: nuevoId(), storeId, origen, inicio: ahora, ultimo: ahora, eventos: [], primerDicho: null, ultimaLinea: null, motivo: null, error: false };
  anotar("p_apertura", NOTA_ORIGEN[origen], { salida: { origen, plataforma: plataforma() } });
}

const NOTA_ORIGEN: Record<OrigenSesion, string> = {
  palabra: "Oyó «Oye Vendfy»",
  atajo: "F9",
  boton: "Tocó la bola",
  teclado: "Lo escribió",
};

/**
 * Un paso. `ms` es lo que pasó desde el paso anterior: para la transcripción
 * o el intérprete es lo que tardó el servidor; para una pregunta, lo que tardó
 * la persona en contestar.
 */
export function anotar(nodo: NodoPiloto, nota?: string, extra: { entrada?: unknown; salida?: unknown; error?: boolean } = {}) {
  if (!sesion) return;
  const ahora = Date.now();
  if (sesion.eventos.length < MAX_EVENTOS) {
    sesion.eventos.push({
      nodo,
      ms: ahora - sesion.ultimo,
      estado: extra.error ? "error" : "ok",
      ...(nota ? { nota: nota.slice(0, 300) } : {}),
      ...(extra.entrada !== undefined ? { entrada: extra.entrada } : {}),
      ...(extra.salida !== undefined ? { salida: extra.salida } : {}),
    });
  }
  sesion.ultimo = ahora;
  if (extra.error) sesion.error = true;
  if (nodo === "p_habla" && nota) sesion.ultimaLinea = nota;
}

/** Lo que dijo la persona (el primero queda como título de la sesión). */
export function anotarDicho(texto: string) {
  if (sesion && !sesion.primerDicho && texto.trim()) sesion.primerDicho = texto.trim().slice(0, 500);
}

/** Por qué va a cerrarse (lo último que se anota gana). */
export function motivoDeCierre(motivo: MotivoCierre) {
  if (sesion) sesion.motivo = motivo;
}

/** Se cerró la tarjeta: la sesión viaja al servidor. */
export function cerrarSesion() {
  const s = sesion;
  sesion = null;
  if (!s) return;
  const motivo = s.motivo ?? (s.error ? "error" : "terminado");
  const ahora = Date.now();
  s.eventos.push({ nodo: "p_cierre", ms: ahora - s.ultimo, estado: motivo === "error" ? "error" : "ok", nota: NOTA_CIERRE[motivo] });
  const version = (window as { __vendfyVersion?: string }).__vendfyVersion ?? null;
  void apiFetch("/api/omnibox/piloto/sesion", {
    method: "POST",
    keepalive: true,
    body: {
      storeId: s.storeId,
      id: s.id,
      origen: s.origen,
      plataforma: plataforma(),
      version,
      duracionMs: ahora - s.inicio,
      primerDicho: s.primerDicho,
      ultimaLinea: s.ultimaLinea,
      motivoCierre: motivo,
      estado: s.error || motivo === "error" ? "error" : "ok",
      eventos: s.eventos.map((e) => recortar(e)),
    },
  }).catch(() => undefined);
}

const NOTA_CIERRE: Record<MotivoCierre, string> = {
  terminado: "Terminó lo pedido",
  sin_respuesta: "No contestó a tiempo",
  cerrado: "La cerró la persona",
  error: "Se cerró por un error",
  al_asistente: "Pasó al Asistente",
  falsa_alarma: "Falsa alarma: no era «Oye Vendfy»",
  otro: "Se cerró",
};

/** `keepalive` admite hasta 64 KB: cada dato se recorta para no pasarse. */
function recortar(e: Evento): Evento {
  const corto = (v: unknown) => {
    if (v === undefined) return undefined;
    const texto = JSON.stringify(v);
    return texto && texto.length > 400 ? `${texto.slice(0, 400)}…` : v;
  };
  return { ...e, entrada: corto(e.entrada), salida: corto(e.salida) };
}
