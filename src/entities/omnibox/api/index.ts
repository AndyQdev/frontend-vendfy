import { useMutation, useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/shared/api/client";
import type { IntencionDisponible, Propuesta } from "../model/types";

export interface RespuestaVoz {
  transcripcion: { texto: string; motor: string; ms: number };
  /** null si no se entendió nada: no hay nada que proponer sobre silencio. */
  propuesta: Propuesta | null;
}

export function useIntenciones() {
  return useQuery({
    queryKey: ["omnibox", "intenciones"],
    queryFn: async () =>
      (await apiFetch<IntencionDisponible[]>("/api/omnibox/intenciones")).data,
    // El catálogo sale del código del backend: solo cambia con un despliegue.
    staleTime: Infinity,
  });
}

export function useInterpretar() {
  return useMutation({
    mutationFn: async (vars: { texto: string; storeId: string }) =>
      (
        await apiFetch<Propuesta>("/api/omnibox/interpretar", {
          method: "POST",
          body: vars,
        })
      ).data,
  });
}

export function useConfirmar() {
  return useMutation({
    mutationFn: async (vars: {
      intencion: string;
      entidades: Record<string, unknown>;
      storeId: string;
    }) =>
      (
        await apiFetch<{ resumen: string; datos?: any }>("/api/omnibox/confirmar", {
          method: "POST",
          body: vars,
        })
      ).data,
  });
}

/**
 * ¿El servidor puede transcribir?
 *
 * Si no hay motor configurado, el panel no muestra el micrófono. Un botón que
 * no va a funcionar es peor que no tenerlo.
 */
export function useEstadoVoz() {
  return useQuery({
    queryKey: ["omnibox", "voz"],
    queryFn: async () =>
      (
        await apiFetch<{ disponible: boolean; motor: string | null }>(
          "/api/omnibox/voz/estado",
        )
      ).data,
    staleTime: Infinity,
  });
}

/**
 * Dicta y propone en UNA llamada.
 *
 * Transcribir e interpretar por separado haría esperar dos veces por lo que
 * para quien dicta es un solo gesto.
 */
export function useDictar() {
  return useMutation({
    mutationFn: async (vars: { audio: Blob; storeId: string }) => {
      const forma = new FormData();
      // El nombre importa: sin extensión, algunos servidores no infieren el
      // tipo y el backend rechaza el formato.
      const extension = vars.audio.type.includes("mp4") ? "m4a" : "webm";
      forma.append("audio", vars.audio, `dictado.${extension}`);
      forma.append("storeId", vars.storeId);
      return (await apiFetch<RespuestaVoz>("/api/omnibox/voz", {
        method: "POST",
        body: forma,
      })).data;
    },
  });
}
