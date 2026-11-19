import { ApiError, apiFetch } from "@/shared/api/client";
import type { RespuestaVoz } from "@/entities/omnibox/api";
import type { Propuesta } from "@/entities/omnibox/model/types";

import type { ContextoPiloto } from "./contexto";

/**
 * Lo más que se espera al servidor. Sin tope, una respuesta que se perdía en el
 * camino (internet que se cae, el servidor ocupado) dejaba la bola en
 * «Entendiendo…» para siempre; ahora avisa y se cierra.
 */
export const TOPE_VOZ_MS = 45_000;
export const TOPE_TEXTO_MS = 35_000;

async function conTope<T>(ms: number, pedir: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ms);
  try {
    return await pedir(control.signal);
  } catch (e) {
    // Lo que se dice en voz alta va en español: el error del navegador viene en inglés.
    if (control.signal.aborted) throw new Error("El servidor se está demorando demasiado. Dímelo otra vez en un momento.");
    if (e instanceof ApiError && e.statusCode === 0) throw new Error("No me pude conectar con Vendfy. Revisa el internet y vuelve a intentarlo.");
    throw e;
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * El piloto usa el mismo intérprete que el asistente: lo dicho se transcribe
 * y se entiende en una sola llamada. El audio llega del detector de voz (VAD)
 * como WAV de 16 kHz: solo lo hablado, sin los silencios.
 */
export async function entenderVoz(
  wav: Blob,
  storeId: string,
  contexto: ContextoPiloto,
  conPalabra = false,
): Promise<RespuestaVoz & { palabra?: boolean }> {
  const forma = new FormData();
  forma.append("audio", wav, "piloto.wav");
  forma.append("storeId", storeId);
  forma.append("contexto", JSON.stringify(contexto));
  // Viene del oído: el audio empieza con "Oye Vendfy" y el servidor la verifica.
  if (conPalabra) forma.append("palabra", "1");
  const r = await conTope(TOPE_VOZ_MS, (signal) =>
    apiFetch<RespuestaVoz & { palabra?: boolean }>("/api/omnibox/voz", { method: "POST", body: forma, signal }),
  );
  return r.data!;
}

/** Lo mismo, escrito: para probar sin micrófono o en una tienda con mucho ruido. */
export async function entenderTexto(texto: string, storeId: string, contexto: ContextoPiloto): Promise<Propuesta> {
  const r = await conTope(TOPE_TEXTO_MS, (signal) =>
    apiFetch<Propuesta>("/api/omnibox/interpretar", {
      method: "POST",
      body: { texto, storeId, contexto },
      signal,
    }),
  );
  return r.data!;
}
