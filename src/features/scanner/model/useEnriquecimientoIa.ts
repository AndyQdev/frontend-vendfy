import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { claveEscaneo, claveEscaneoIa, estadoIa } from "@/entities/product/api";
import type { EnriquecimientoIa, ResultadoEscaneo } from "@/entities/product/model/escaneo";

/** La IA tarda 10-30 s; pasado esto se deja de esperar y queda la foto del catálogo. */
const ESPERA_MAXIMA_MS = 120_000;

/**
 * Sigue la foto y la ficha que la IA arma para un código.
 *
 * El escaneo responde al instante con lo que hay ("generando" la primera
 * vez); acá se consulta cada 2 s hasta que esté listo. Al terminar se copia
 * al resultado del escaneo en caché: si se vuelve a escanear el mismo código,
 * la hoja abre directo con la foto mejorada.
 */
export function useEnriquecimientoIa(resultado: ResultadoEscaneo) {
  const queryClient = useQueryClient();
  const inicial = resultado.sugerencia?.ia;
  const desde = useRef(Date.now());

  const consulta = useQuery({
    queryKey: claveEscaneoIa(resultado.codigo),
    queryFn: ({ signal }) => estadoIa(resultado.codigo, signal),
    enabled: !!inicial,
    initialData: inicial,
    // Lo inicial vino del escaneo de recién: no hace falta pedirlo de nuevo
    // salvo que siga generándose.
    staleTime: inicial?.estado === "generando" ? 0 : Infinity,
    refetchInterval: (q) =>
      q.state.data?.estado === "generando" && Date.now() - desde.current < ESPERA_MAXIMA_MS ? 2_000 : false,
  });

  const ia: EnriquecimientoIa | undefined = consulta.data;

  useEffect(() => {
    if (ia?.estado !== "listo") return;
    queryClient.setQueryData<ResultadoEscaneo>(claveEscaneo(resultado.codigo), (previo) =>
      previo?.sugerencia ? { ...previo, sugerencia: { ...previo.sugerencia, ia } } : previo,
    );
  }, [ia, queryClient, resultado.codigo]);

  const vencido = ia?.estado === "generando" && Date.now() - desde.current >= ESPERA_MAXIMA_MS;
  return { ia, generando: ia?.estado === "generando" && !vencido };
}
