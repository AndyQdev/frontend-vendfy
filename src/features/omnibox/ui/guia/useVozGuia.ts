import { useCallback, useMemo } from "react";

import { callarVoz, decirTexto, preferenciasVoz, setPreferenciasVoz, usePreferenciasVoz } from "@/shared/voz";

/**
 * La voz de la Guía (G2b, D-G2): la voz natural del panel (`shared/voz`),
 * la misma que dice los precios del escáner, con la del navegador de
 * respaldo si no llega a tiempo.
 *
 * Las frases se ENCOLAN (el resumen de lo que se agregó y, detrás, la
 * pregunta de la Guía); `callar` corta todo, por ejemplo al volver a dictar:
 * la voz no puede taparle el micrófono a la persona.
 */
export function useVozGuia() {
  const disponible =
    typeof window !== "undefined" && ("AudioContext" in window || "speechSynthesis" in window);
  const { asistente } = usePreferenciasVoz();

  const hablar = useCallback((texto: string | null | undefined) => decirTexto(texto), []);
  const callar = useCallback(() => callarVoz(), []);
  const alternar = useCallback(() => {
    const activa = !preferenciasVoz().asistente;
    setPreferenciasVoz({ asistente: activa });
    if (!activa) callarVoz();
  }, []);

  return useMemo(
    () => ({ disponible, activa: asistente, hablar, callar, alternar }),
    [disponible, asistente, hablar, callar, alternar],
  );
}
