import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/shared/api/client";
import type { DolarDeLaTienda } from "../model/types";

/**
 * El dólar del día que usa la tienda (BCB o Binance, según Configuración).
 * Se actualiza solo cada mañana: con 10 minutos de caché alcanza.
 */
export function useDolar(storeId: string | undefined) {
  return useQuery({
    queryKey: ["dolar", storeId],
    queryFn: async () =>
      (await apiFetch<DolarDeLaTienda>(`/api/exchange-rate?storeId=${storeId}`)).data!,
    enabled: Boolean(storeId),
    staleTime: 10 * 60_000,
  });
}
