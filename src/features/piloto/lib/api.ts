import { apiFetch } from "@/shared/api/client";
import type { RespuestaVoz } from "@/entities/omnibox/api";
import type { LineaContexto, Propuesta } from "@/entities/omnibox/model/types";

/**
 * El piloto usa el mismo intérprete que el asistente: lo dicho se transcribe
 * y se entiende en una sola llamada. El audio llega del detector de voz (VAD)
 * como WAV de 16 kHz: solo lo hablado, sin los silencios.
 */
export async function entenderVoz(
  wav: Blob,
  storeId: string,
  lineas: LineaContexto[],
  conPalabra = false,
): Promise<RespuestaVoz & { palabra?: boolean }> {
  const forma = new FormData();
  forma.append("audio", wav, "piloto.wav");
  forma.append("storeId", storeId);
  forma.append("contexto", JSON.stringify({ venta: { lineas } }));
  // Viene del oído: el audio empieza con "Oye Vendfy" y el servidor la verifica.
  if (conPalabra) forma.append("palabra", "1");
  const r = await apiFetch<RespuestaVoz & { palabra?: boolean }>("/api/omnibox/voz", { method: "POST", body: forma });
  return r.data!;
}

/** Lo mismo, escrito: para probar sin micrófono o en una tienda con mucho ruido. */
export async function entenderTexto(texto: string, storeId: string, lineas: LineaContexto[]): Promise<Propuesta> {
  const r = await apiFetch<Propuesta>("/api/omnibox/interpretar", {
    method: "POST",
    body: { texto, storeId, contexto: { venta: { lineas } } },
  });
  return r.data!;
}
