import { useCallback, useEffect, useRef, useState } from "react";

/** "no": la persona silenció las respuestas habladas (se recuerda en este navegador). */
const CLAVE = "vendfy.voz.respuestas";

function leer(): boolean {
  try {
    return localStorage.getItem(CLAVE) !== "no";
  } catch {
    return true;
  }
}

/**
 * La voz de la Guía (G2b, D-G2): la síntesis de voz del navegador. Gratis,
 * inmediata y sin red; si el navegador no la tiene, no pasa nada.
 *
 * Las frases se ENCOLAN (el resumen de lo que se agregó y, detrás, la
 * pregunta de la Guía); `callar` corta todo, por ejemplo al volver a dictar:
 * la voz no puede taparle el micrófono a la persona.
 */
export function useVozGuia() {
  const disponible = typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  const [activa, setActiva] = useState(leer);
  const voz = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    if (!disponible) return;
    // Una voz en español, preferentemente latinoamericana. Las voces llegan
    // tarde en algunos navegadores: se vuelve a elegir cuando cambian.
    const elegir = () => {
      const voces = window.speechSynthesis.getVoices();
      voz.current =
        voces.find((v) => /^es[-_](BO|419|US|MX|AR|CO|PE|CL)/i.test(v.lang)) ?? voces.find((v) => /^es/i.test(v.lang)) ?? null;
    };
    elegir();
    window.speechSynthesis.addEventListener?.("voiceschanged", elegir);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", elegir);
  }, [disponible]);

  const hablar = useCallback(
    (texto: string | null | undefined) => {
      if (!disponible || !activa || !texto) return;
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = voz.current?.lang ?? "es-419";
      if (voz.current) u.voice = voz.current;
      u.rate = 1.05;
      window.speechSynthesis.speak(u);
    },
    [disponible, activa],
  );

  const callar = useCallback(() => {
    if (disponible) window.speechSynthesis.cancel();
  }, [disponible]);

  const alternar = useCallback(() => {
    setActiva((v) => {
      try {
        localStorage.setItem(CLAVE, v ? "no" : "si");
      } catch {
        // sin almacenamiento: dura la sesión
      }
      if (v && disponible) window.speechSynthesis.cancel();
      return !v;
    });
  }, [disponible]);

  return { disponible, activa, hablar, callar, alternar };
}
