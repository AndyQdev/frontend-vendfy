import { useSyncExternalStore } from "react";

import { API_URL, apiFetch } from "@/shared/api/client";

import { Acelerador, acelerarMuestras } from "./acelerar";
import { contextoAudio } from "./audio";
import { callarNavegador, decirConNavegador } from "./navegador";
import { preferenciasVoz } from "./preferencias";

/**
 * La voz del panel. Dice el precio de lo que se escanea y le pone voz al
 * asistente, con las voces naturales que genera el servidor (Gemini).
 *
 * Para que el precio suene en el instante en que se escanea:
 *
 *   1. Lo que ya sonó en esta sesión está decodificado en memoria: cero red.
 *   2. Las frases ya generadas (precios, avisos) son MP3 en Storage cuya URL
 *      se recuerda en el navegador: se bajan directo, sin pasar por la API.
 *      El precalentado trae de una vez las de todos los precios del comercio.
 *   3. Lo que nadie dijo nunca se pide a la API, que lo transmite mientras lo
 *      genera: se empieza a escuchar con el primer trozo.
 *   4. Si nada de eso llega a tiempo, NO habla otra voz: la respuesta queda
 *      escrita en pantalla. Se probó con la voz del navegador de respaldo y
 *      se oían dos personas (la elegida y una "de IA"), que es peor que un
 *      silencio. El navegador solo habla si este equipo no tiene audio web.
 *
 * Un escaneo nuevo corta lo que se estaba diciendo: en un mostrador importa
 * el último producto, no el anterior.
 */

export type AvisoVoz = "agotado" | "sin_mas" | "a_pedido" | "quedan" | "van" | "sin_tienda";

/**
 * Una pieza de lo que se dice al escanear. "texto" es una frase corta ya
 * escrita en palabras ("Tienes cuatro.", "Mermelada Arcor."): el servidor la
 * guarda por su texto, así que se genera una vez para todos los comercios.
 */
export type FraseVoz =
  | { tipo: "precio"; monto: number; moneda?: string | null }
  | { tipo: "aviso"; aviso: AvisoVoz; n?: number }
  | { tipo: "texto"; texto: string };

const FRECUENCIA = 24_000;

/** Muestras de audio de -1 a 1 (sobre un ArrayBuffer común: lo exige copyToChannel). */
type Muestras = Float32Array<ArrayBuffer>;
/**
 * Cuánto se espera a la voz natural antes de que hable la del navegador. El
 * precio tiene que salir ya (atrás viene otro escaneo); el asistente puede
 * esperar un poco más; la muestra de una voz, lo que haga falta: es justamente
 * para escucharla.
 */
const ESPERA_MS = { precio: 5000, asistente: 8000, muestra: 10_000 } as const;
/** Si el servidor está sin cupo (429/503), cuánto esperar antes de volver a pedir la misma voz. */
const REINTENTO_MS = 1200;
const PAUSA_ENTRE_FRASES = 0.12;
/** Colchón para que el audio transmitido no se corte con la primera demora de red. */
const COLCHON_FLUJO = 0.06;
const MAX_EN_MEMORIA = 300;
const MAX_URLS = 4000;
const CLAVE_URLS = "vendfy.voz.urls.v1";
const MAX_TEXTOS_PRECALENTAR = 80;

// ─── Cómo se nombra cada frase ─────────────────────────────────────────────

const MONEDAS = new Set(["BOB", "USD", "PEN", "ARS", "CLP", "COP", "MXN", "UYU", "EUR", "PYG", "BRL"]);

function monedaConocida(codigo?: string | null): string {
  const c = (codigo ?? "").replace(/[^a-z]/gi, "").toUpperCase();
  if (c === "BS") return "BOB";
  return MONEDAS.has(c) ? c : "BOB";
}

/** Igual que en el servidor: así las URLs del precalentado se encuentran. */
export function idDeFrase(f: FraseVoz): string {
  if (f.tipo === "texto") return `t:${f.texto}`;
  return f.tipo === "precio"
    ? `precio:${f.monto.toFixed(2)}:${monedaConocida(f.moneda)}`
    : `aviso:${f.aviso}:${f.n ?? ""}`;
}

const NOMBRE_MONEDA: Record<string, [string, string]> = {
  BOB: ["boliviano", "bolivianos"],
  USD: ["dólar", "dólares"],
  PEN: ["sol", "soles"],
  EUR: ["euro", "euros"],
  PYG: ["guaraní", "guaraníes"],
  BRL: ["real", "reales"],
};

/** Lo que dice la voz del navegador si la natural no llega. Con cifras: las lee bien. */
function textoDeRespaldo(f: FraseVoz): string {
  if (f.tipo === "texto") return f.texto;
  if (f.tipo === "precio") {
    const [singular, plural] = NOMBRE_MONEDA[monedaConocida(f.moneda)] ?? ["peso", "pesos"];
    const centavos = Math.round(f.monto * 100);
    const entero = Math.floor(centavos / 100);
    const resto = centavos % 100;
    if (!centavos) return "Sin precio.";
    if (!entero) return `${resto} centavos.`;
    return `${entero} ${entero === 1 ? singular : plural}${resto ? ` con ${resto}` : ""}.`;
  }
  switch (f.aviso) {
    case "agotado":
      return "Agotado.";
    case "sin_mas":
      return "No quedan más.";
    case "a_pedido":
      return "Sin stock, se vende a pedido.";
    case "sin_tienda":
      return "No está en esta tienda.";
    case "quedan":
      return f.n === 1 ? "Queda uno." : `Quedan ${f.n}.`;
    case "van":
      return `Van ${f.n}.`;
  }
}

// ─── Lo que ya se conoce ───────────────────────────────────────────────────

const enMemoria = new Map<string, AudioBuffer>();

function deMemoria(id: string): AudioBuffer | null {
  const b = enMemoria.get(id);
  if (!b) return null;
  enMemoria.delete(id);
  enMemoria.set(id, b);
  return b;
}

function aMemoria(id: string, b: AudioBuffer) {
  enMemoria.set(id, b);
  while (enMemoria.size > MAX_EN_MEMORIA) enMemoria.delete(enMemoria.keys().next().value!);
}

/** id de frase → URL del MP3, guardado en el navegador (sin el prefijo común, que se repite). */
const urls = new Map<string, string>();
let guardado: number | undefined;
/**
 * Con qué motor se generaron esas URLs ("v1" Gemini, "c1" Chirp). Si el
 * servidor cambia de motor, lo guardado suena distinto y se olvida.
 */
let versionUrls = "";

(function cargarUrls() {
  try {
    const crudo = localStorage.getItem(CLAVE_URLS);
    if (!crudo) return;
    const { b, m, v } = JSON.parse(crudo) as { b: string; m: Record<string, string>; v?: string };
    versionUrls = v ?? "v1";
    for (const [id, resto] of Object.entries(m)) urls.set(id, resto.startsWith("http") ? resto : b + resto);
  } catch {
    // arranca vacío
  }
})();

/** El servidor dijo con qué motor genera: si no es el de lo guardado, se empieza de cero. */
function confirmarVersion(version: string | undefined) {
  if (!version || version === versionUrls) return;
  versionUrls = version;
  urls.clear();
  enMemoria.clear();
  guardarUrls();
}

function recordarUrl(id: string, url: string) {
  if (urls.get(id) === url) return;
  urls.delete(id);
  urls.set(id, url);
  while (urls.size > MAX_URLS) urls.delete(urls.keys().next().value!);
  guardarUrls();
}

function guardarUrls() {
  window.clearTimeout(guardado);
  guardado = window.setTimeout(() => {
    try {
      const muestra = urls.values().next().value ?? "";
      const b = muestra.slice(0, muestra.lastIndexOf("/voz/") + 5);
      const m: Record<string, string> = {};
      for (const [k, v] of urls) m[k] = b && v.startsWith(b) ? v.slice(b.length) : v;
      localStorage.setItem(CLAVE_URLS, JSON.stringify({ b, m, v: versionUrls }));
    } catch {
      // sin lugar: vale para esta sesión
    }
  }, 1000);
}

// ─── Velocidad ─────────────────────────────────────────────────────────────

function velocidad(): number {
  const v = Number(preferenciasVoz().velocidad);
  return Number.isFinite(v) && v >= 0.8 && v <= 2 ? v : 1;
}

/** Cada audio acelerado una vez por velocidad: repetir un precio sigue siendo instantáneo. */
const acelerados = new WeakMap<AudioBuffer, { v: number; buffer: AudioBuffer }>();

function acelerado(ctx: AudioContext, original: AudioBuffer): AudioBuffer {
  const v = velocidad();
  if (v === 1) return original;
  const hecho = acelerados.get(original);
  if (hecho?.v === v) return hecho.buffer;
  const muestras = acelerarMuestras(original.getChannelData(0), original.sampleRate, v);
  const buffer = ctx.createBuffer(1, muestras.length, original.sampleRate);
  buffer.copyToChannel(muestras as Muestras, 0);
  acelerados.set(original, { v, buffer });
  return buffer;
}

// ─── Reproducción ──────────────────────────────────────────────────────────

/** Cambia con cada cosa nueva que se dice o con callar(): lo viejo se descarta. */
let turno = 0;
const sonando = new Set<AudioBufferSourceNode>();
/** Hasta cuándo hay audio programado (en el reloj del AudioContext). */
let finProgramado = 0;

/** Si la voz está hablando: la ficha lo muestra con unas barritas que se mueven. */
let hablando = false;
const oyentesHablando = new Set<() => void>();

function setHablando(valor: boolean) {
  if (valor === hablando) return;
  hablando = valor;
  oyentesHablando.forEach((f) => f());
}

export function useHablando(): boolean {
  return useSyncExternalStore(
    (f) => {
      oyentesHablando.add(f);
      return () => oyentesHablando.delete(f);
    },
    () => hablando,
    () => false,
  );
}

/**
 * Espera a que la voz termine lo que está diciendo.
 *
 * Para escuchar DESPUÉS de hablar: si el micrófono se abre mientras suena la
 * pregunta, se graba a sí misma. `arranqueMs` es cuánto esperar a que empiece
 * (la frase se pide al servidor y tarda un poco); si en ese tiempo no sonó
 * nada, se da por terminada. `topeMs` corta una frase que no termina nunca.
 */
export function esperarQueCalle({ arranqueMs = 2500, topeMs = 15_000 } = {}): Promise<void> {
  return new Promise((resolve) => {
    let arranco = hablando;
    const fin = () => {
      clearTimeout(sinArranque);
      clearTimeout(tope);
      oyentesHablando.delete(oir);
      resolve();
    };
    const oir = () => {
      if (hablando) arranco = true;
      else if (arranco) fin();
    };
    const sinArranque = setTimeout(() => !arranco && fin(), arranqueMs);
    const tope = setTimeout(fin, topeMs);
    oyentesHablando.add(oir);
  });
}

export function callarVoz() {
  turno++;
  for (const s of sonando) {
    try {
      s.stop();
    } catch {
      // ya había terminado
    }
  }
  sonando.clear();
  finProgramado = 0;
  callarNavegador();
  setHablando(false);
}

function programar(ctx: AudioContext, buffer: AudioBuffer, cuando: number) {
  const fuente = ctx.createBufferSource();
  fuente.buffer = buffer;
  fuente.connect(ctx.destination);
  fuente.onended = () => {
    sonando.delete(fuente);
    if (!sonando.size) setHablando(false);
  };
  sonando.add(fuente);
  setHablando(true);
  fuente.start(cuando);
}

type Pieza =
  | { tipo: "buffer"; buffer: AudioBuffer }
  | { tipo: "flujo"; primero: Muestras; resto: AsyncGenerator<Muestras>; cancelar: () => void }
  | { tipo: "navegador"; texto: string };

interface QueDecir {
  id: string;
  esperaMs: number;
  cuerpo: Record<string, unknown>;
  respaldo: string;
  /** Si el servidor la guarda: entonces vale la pena recordar su URL. */
  recordar: boolean;
}

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function autorizacion(): Record<string, string> {
  const token = localStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function bajarYDecodificar(ctx: AudioContext, url: string, limite: number, externo?: AbortSignal) {
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), Math.max(0, limite - Date.now()));
  externo?.addEventListener("abort", () => corte.abort());
  try {
    const r = await fetch(url, { signal: corte.signal });
    if (!r.ok) throw new Error(`audio ${r.status}`);
    return await ctx.decodeAudioData(await r.arrayBuffer());
  } finally {
    clearTimeout(reloj);
  }
}

/** PCM de 16 bits little-endian → muestras de -1 a 1, trozo a trozo. */
async function* leerPcm(cuerpo: ReadableStream<Uint8Array>): AsyncGenerator<Muestras> {
  const lector = cuerpo.getReader();
  let sobra: Uint8Array | null = null;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) return;
    let bytes = value;
    if (sobra) {
      const unidos = new Uint8Array(sobra.length + bytes.length);
      unidos.set(sobra);
      unidos.set(bytes, sobra.length);
      bytes = unidos;
      sobra = null;
    }
    const par = bytes.length - (bytes.length % 2);
    if (par < bytes.length) sobra = bytes.slice(par);
    if (!par) continue;
    const vista = new DataView(bytes.buffer, bytes.byteOffset, par);
    const muestras = new Float32Array(par / 2);
    for (let i = 0; i < muestras.length; i++) muestras[i] = vista.getInt16(i * 2, true) / 32768;
    yield muestras;
  }
}

/** Consigue el audio de una frase por el camino más rápido que haya. */
async function obtener(q: QueDecir): Promise<Pieza> {
  const ctx = contextoAudio();
  if (!ctx) return { tipo: "navegador", texto: q.respaldo };
  const yaDecodificado = deMemoria(q.id);
  if (yaDecodificado) return { tipo: "buffer", buffer: yaDecodificado };
  const limite = Date.now() + q.esperaMs;

  const conocida = urls.get(q.id);
  if (conocida) {
    try {
      const buffer = await bajarYDecodificar(ctx, conocida, limite);
      aMemoria(q.id, buffer);
      return { tipo: "buffer", buffer };
    } catch {
      // Se pide a la API, que sabe si sigue existiendo.
    }
  }

  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), Math.max(0, limite - Date.now()));
  try {
    let r: Response;
    for (;;) {
      r = await fetch(`${API_URL}/api/voz/hablar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...autorizacion() },
        body: JSON.stringify(q.cuerpo),
        signal: corte.signal,
      });
      // Sin cupo por un momento: se insiste con la MISMA voz mientras quede tiempo.
      if ([429, 502, 503].includes(r.status) && Date.now() + REINTENTO_MS + 800 < limite) {
        await dormir(REINTENTO_MS);
        continue;
      }
      break;
    }
    if (!r.ok || !r.body) throw new Error(`voz ${r.status}`);
    if ((r.headers.get("content-type") ?? "").includes("application/json")) {
      const url: string | undefined = (await r.json())?.data?.url;
      if (!url) throw new Error("la voz no devolvió el audio");
      if (q.recordar) recordarUrl(q.id, url);
      const buffer = await bajarYDecodificar(ctx, url, limite, corte.signal);
      aMemoria(q.id, buffer);
      return { tipo: "buffer", buffer };
    }
    // Se está generando: se escucha a medida que llega.
    const flujo = leerPcm(r.body);
    const primero = await flujo.next();
    if (primero.done) throw new Error("la voz no devolvió audio");
    clearTimeout(reloj);
    return { tipo: "flujo", primero: primero.value, resto: flujo, cancelar: () => corte.abort() };
  } catch {
    // Cortar acá no pierde la frase: el servidor la termina y la guarda.
    corte.abort();
    return { tipo: "navegador", texto: q.respaldo };
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * Las piezas se piden todas a la vez y suenan en orden, una detrás de otra.
 *
 * Antes de sonar se espera a que todas tengan audio (se piden en paralelo, así
 * que es el tiempo de la más lenta). Si alguna no llegó con la voz elegida,
 * no suena nada: una sola voz siempre, nunca dos. (Sin audio web en el
 * equipo, todo lo dice el navegador: también una sola voz.)
 */
async function reproducir(pedidas: Array<Promise<Pieza>>, ids: string[], respaldos: string[], mio: number) {
  const ctx = contextoAudio();
  const v = velocidad();
  const pausa = PAUSA_ENTRE_FRASES / v;
  const piezas = await Promise.all(pedidas);
  const cancelarFlujos = () => piezas.forEach((p) => p.tipo === "flujo" && p.cancelar());
  if (mio !== turno) {
    cancelarFlujos();
    return;
  }

  if (ctx && piezas.some((p) => p.tipo === "navegador")) {
    cancelarFlujos();
    return;
  }
  if (!ctx) {
    // Que no se pise con lo que ya está programado.
    const espera = ctx ? (finProgramado - ctx.currentTime) * 1000 : 0;
    if (espera > 0) await dormir(espera);
    if (mio !== turno) return;
    setHablando(true);
    await decirConNavegador(respaldos.join(" "), v);
    if (mio === turno) setHablando(sonando.size > 0);
    return;
  }

  let t = Math.max(ctx.currentTime + 0.02, finProgramado);
  for (let i = 0; i < piezas.length; i++) {
    const pieza = piezas[i];
    if (mio !== turno) {
      if (pieza.tipo === "flujo") pieza.cancelar();
      continue;
    }
    if (pieza.tipo === "navegador") continue;

    if (pieza.tipo === "buffer") {
      t = Math.max(t, ctx.currentTime + 0.01);
      const buffer = acelerado(ctx, pieza.buffer);
      programar(ctx, buffer, t);
      t += buffer.duration + pausa;
      finProgramado = t;
      continue;
    }

    // Transmitida: cada trozo se acelera y se programa pegado al anterior. En
    // memoria queda el original, que se acelera a la velocidad del momento.
    const trozos: Muestras[] = [];
    let total = 0;
    const acelerador = v === 1 ? null : new Acelerador(FRECUENCIA, v);
    t = Math.max(t, ctx.currentTime + COLCHON_FLUJO);
    const tocar = (muestras: Float32Array) => {
      if (!muestras.length) return;
      const b = ctx.createBuffer(1, muestras.length, FRECUENCIA);
      b.copyToChannel(muestras as Muestras, 0);
      // Si la red se atrasó, se retoma con un respiro mínimo en vez de amontonar.
      if (t < ctx.currentTime) t = ctx.currentTime + 0.03;
      programar(ctx, b, t);
      t += b.duration;
      finProgramado = t;
    };
    const sumar = (muestras: Muestras) => {
      tocar(acelerador ? acelerador.push(muestras) : muestras);
      trozos.push(muestras);
      total += muestras.length;
    };
    sumar(pieza.primero);
    let completa = true;
    try {
      for await (const muestras of pieza.resto) {
        if (mio !== turno) {
          pieza.cancelar();
          completa = false;
          break;
        }
        sumar(muestras);
      }
    } catch {
      completa = false;
    }
    if (acelerador && mio === turno) tocar(acelerador.flush());
    // Entera, queda en memoria: repetirla es instantáneo.
    if (completa && total) {
      const entera = ctx.createBuffer(1, total, FRECUENCIA);
      let desde = 0;
      for (const m of trozos) {
        entera.copyToChannel(m, 0, desde);
        desde += m.length;
      }
      aMemoria(ids[i], entera);
    }
    t += pausa;
    finProgramado = t;
  }
  // Resuelve cuando termina de sonar (o si otra cosa la cortó).
  while (mio === turno && ctx.currentTime < finProgramado - pausa) {
    await dormir(Math.max(30, (finProgramado - pausa - ctx.currentTime) * 1000));
  }
}

function paraFrase(voz: string, f: FraseVoz, esperaMs: number = ESPERA_MS.precio): QueDecir {
  if (f.tipo === "texto") return paraTexto(voz, f.texto, esperaMs);
  const frase =
    f.tipo === "precio"
      ? { tipo: "precio", monto: Math.round(f.monto * 100) / 100, ...(f.moneda ? { moneda: f.moneda } : {}) }
      : { tipo: "aviso", aviso: f.aviso, ...(f.n !== undefined ? { n: f.n } : {}) };
  return {
    id: `${voz}|${idDeFrase(f)}`,
    esperaMs,
    cuerpo: { voz, frase },
    respaldo: textoDeRespaldo(f),
    recordar: true,
  };
}

function paraTexto(voz: string, texto: string, esperaMs: number): QueDecir {
  // El servidor guarda los textos cortos: esos se repiten.
  return { id: `${voz}|t:${texto}`, esperaMs, cuerpo: { voz, texto }, respaldo: texto, recordar: texto.length <= 160 };
}

// ─── Lo que usan las pantallas ─────────────────────────────────────────────

/**
 * Lo que se dice al escanear (el precio, el stock…). Corta lo que se estuviera diciendo.
 * `esperaMs`: cuánto esperar la voz elegida antes del respaldo (una conversación puede esperar más).
 */
export function decirFrases(
  frases: FraseVoz[],
  { forzar = false, esperaMs }: { forzar?: boolean; esperaMs?: number } = {},
): Promise<void> {
  const { precios, voz } = preferenciasVoz();
  // `forzar`: lo pidió con un botón ("decir el precio otra vez"), aunque esté apagada.
  if ((!precios && !forzar) || !frases.length) return Promise.resolve();
  callarVoz();
  const mio = turno;
  const pedidos = frases.map((f) => paraFrase(voz, f, esperaMs));
  // Resuelve cuando terminó de decirlo (o se decidió no decirlo): quien
  // escucha después, abre el micrófono recién ahí.
  return (ultimaFrase = reproducir(
    pedidos.map(obtener),
    pedidos.map((p) => p.id),
    pedidos.map((p) => p.respaldo),
    mio,
  ).catch(() => undefined));
}

let ultimaFrase: Promise<void> = Promise.resolve();

/** Lo último que se mandó a decir con `decirFrases`, terminado (o descartado). */
export function terminoDeHablar(): Promise<void> {
  return ultimaFrase;
}

/** Lo que contesta el asistente. Se encola: el resumen y después la pregunta. */
let colaTextos: Promise<void> = Promise.resolve();

export function decirTexto(texto: string | null | undefined) {
  const limpio = (texto ?? "").replace(/\s+/g, " ").trim();
  const { asistente, voz } = preferenciasVoz();
  if (!asistente || !limpio) return;
  const mio = turno;
  const pedido = paraTexto(voz, limpio, ESPERA_MS.asistente);
  // Se pide ya, en paralelo con lo que está sonando; suena cuando le toca.
  const pieza = obtener(pedido);
  colaTextos = colaTextos
    .then(() => (mio === turno ? reproducir([pieza], [pedido.id], [pedido.respaldo], mio) : undefined))
    .catch(() => undefined);
}

/** Para elegir voz: suena aunque la voz esté apagada. */
export function probarVoz(voz: string, texto: string) {
  callarVoz();
  const mio = turno;
  const pedido = paraTexto(voz, texto, ESPERA_MS.muestra);
  void reproducir([obtener(pedido)], [pedido.id], [pedido.respaldo], mio);
}

/**
 * Pide al servidor que genere los precios de los productos del comercio y
 * se queda con las URLs de los que ya están. Una vez cada media hora por
 * pestaña: el servidor los va generando de a poco.
 */
export async function precalentarVoz(textos: string[] = []) {
  const { voz, precios } = preferenciasVoz();
  if (!precios || !localStorage.getItem("authToken")) return;
  const clave = `vendfy.voz.precalentado.${voz}`;
  try {
    if (Date.now() - Number(sessionStorage.getItem(clave) ?? 0) < 30 * 60_000) return;
    sessionStorage.setItem(clave, String(Date.now()));
  } catch {
    // sin sessionStorage: se precalienta igual
  }
  // El servidor acepta hasta 80 textos por pedido: van en tandas.
  const tandas: string[][] = [];
  for (let i = 0; i < textos.length; i += MAX_TEXTOS_PRECALENTAR) tandas.push(textos.slice(i, i + MAX_TEXTOS_PRECALENTAR));
  if (!tandas.length) tandas.push([]);
  for (const tanda of tandas) {
    try {
      const r = await apiFetch<{ encolados: number; listas: Array<{ id: string; url: string }>; version?: string }>(
        "/api/voz/precalentar",
        { method: "POST", body: { voz, ...(tanda.length ? { textos: tanda } : {}) } },
      );
      confirmarVersion(r.data?.version);
      for (const { id, url } of r.data?.listas ?? []) recordarUrl(`${voz}|${id}`, url);
    } catch {
      // Sin precalentar, cada frase se genera la primera vez que se dice.
    }
  }
}
