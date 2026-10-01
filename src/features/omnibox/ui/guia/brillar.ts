/**
 * Señalar un campo: llevarlo a la vista, hacerlo brillar y darle el foco.
 *
 * Los campos se marcan con `data-campo` ("pago", "cliente", "cantidad:<id>",
 * "costo:<id>", "renglon:<mensajeId>:<i>"…). La Guía no sabe de componentes:
 * solo nombra el campo.
 *
 * Si el elemento todavía no existe —la mesa recién se está abriendo, la hoja
 * del teléfono está subiendo— se reintenta unos cuadros antes de rendirse.
 */

const CLASE = "campo-brilla";
const INTENTOS = 30; // ~0,5 s a 60 fps

function visible(el: Element): boolean {
  const r = (el as HTMLElement).getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/** El primero visible: la cantidad existe dos veces (escritorio y teléfono). */
function buscar(campo: string): HTMLElement | null {
  const todos = document.querySelectorAll<HTMLElement>(`[data-campo="${CSS.escape(campo)}"]`);
  for (const el of todos) if (visible(el)) return el;
  return null;
}

function enfocable(el: HTMLElement): HTMLElement | null {
  if (el.matches("input, button, select, textarea, [tabindex]")) return el;
  return (
    el.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ??
    el.querySelector<HTMLElement>("input:not([disabled]), button:not([disabled]), select, textarea, [tabindex]")
  );
}

export function brillar(campo: string, nivel: "error" | "advertencia" = "error"): Promise<boolean> {
  const reducido = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  return new Promise((resolver) => {
    let intento = 0;
    const probar = () => {
      const el = buscar(campo);
      if (!el) {
        if (++intento >= INTENTOS) return resolver(false);
        requestAnimationFrame(probar);
        return;
      }
      el.scrollIntoView({ behavior: reducido ? "auto" : "smooth", block: "center" });
      el.dataset.brilla = nivel;
      // Reiniciar la animación si ya estaba brillando.
      el.classList.remove(CLASE);
      void el.offsetWidth;
      el.classList.add(CLASE);
      const terminar = () => {
        el.classList.remove(CLASE);
        delete el.dataset.brilla;
      };
      el.addEventListener("animationend", terminar, { once: true });
      // Respaldo: sin animación (movimiento reducido) no hay animationend.
      window.setTimeout(terminar, 2600);
      enfocable(el)?.focus({ preventScroll: true });
      resolver(true);
    };
    probar();
  });
}
