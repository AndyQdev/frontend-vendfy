import { useCallback, useEffect, useRef, useState } from "react";

/**
 * El comportamiento del carril de rutas: saber si hay algo escondido a cada
 * lado, desplazarse, y dejar a la vista la ruta activa.
 *
 * Todo lo que mide sale de Cell Diagnostic, donde se aprendió a los golpes:
 *
 *  - Una flecha que no lleva a ningún lado invita a apretarla y no pasa nada.
 *    Por eso cada una aparece SOLO si hay algo de su lado.
 *  - No alcanza con medir una vez. El carril cambia de ancho cuando cambia la
 *    ventana (ResizeObserver), cuando llegan las tipografías (cada ruta cambia
 *    de ancho con la fuente real) y cuando llega un contador, que ensancha su
 *    ruta segundos después de pintada la barra (MutationObserver).
 *  - Cuatro píxeles de tolerancia: con desplazamiento suave y pantallas de
 *    densidad fraccionaria el final nunca cae redondo.
 */
const HOLGURA = 4;

export function useRail(activeKey: string | undefined) {
  const railRef = useRef<HTMLElement | null>(null);
  const [canBack, setCanBack] = useState(false);
  const [canForward, setCanForward] = useState(false);

  const measure = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setCanBack(el.scrollLeft > HOLGURA);
    setCanForward(el.scrollLeft + el.clientWidth < el.scrollWidth - HOLGURA);
  }, []);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;

    el.addEventListener("scroll", measure, { passive: true });
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    const mutations = new MutationObserver(measure);
    mutations.observe(el, { childList: true, subtree: true, characterData: true });
    const frame = requestAnimationFrame(measure);

    let alive = true;
    void document.fonts?.ready.then(() => {
      if (alive) measure();
    });

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", measure);
      resize.disconnect();
      mutations.disconnect();
    };
  }, [measure]);

  /**
   * Centra la ruta activa al entrar a una pantalla.
   *
   * Con `scrollTo` sobre el carril y no con `scrollIntoView`: este último
   * también desplaza la PÁGINA para mostrar el elemento, y al navegar la
   * pantalla saltaba unos píxeles hacia arriba.
   */
  useEffect(() => {
    const el = railRef.current;
    if (!el || !activeKey) return;
    const item = el.querySelector<HTMLElement>(`[data-route="${CSS.escape(activeKey)}"]`);
    if (!item) return;

    const start = item.offsetLeft;
    const end = start + item.offsetWidth;
    const visible = start >= el.scrollLeft && end <= el.scrollLeft + el.clientWidth;
    if (visible) return;

    el.scrollTo({ left: start - el.clientWidth / 2 + item.offsetWidth / 2, behavior: "smooth" });
  }, [activeKey]);

  /** Avanza casi un ancho visible: deja una ruta de referencia a la vista. */
  const scrollBy = useCallback((direction: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    const step = Math.max(el.clientWidth * 0.8, 200);
    el.scrollBy({ left: step * direction, behavior: "smooth" });
  }, []);

  return { railRef, canBack, canForward, scrollBy };
}
