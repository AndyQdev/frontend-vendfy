import type { Page } from "@playwright/test";

/**
 * Graba las animaciones del seguimiento visual mientras pasan.
 *
 * Duran medio segundo: esperar a "verlas" con una captura sería frágil. En
 * cambio, un MutationObserver anota cada clase de animación que se agrega
 * (y sobre qué elemento) y cada foto que sale volando. La prueba revisa la
 * grabación cuando le conviene.
 */

export interface Animacion {
  clase: string;
  /** data-linea, data-campo, data-testid o data-pestana del elemento. */
  en: string;
  retraso: string;
}

const CLASES = ["linea-entra", "aterriza", "cantidad-cambia", "campo-completo", "boton-presiona"];

export async function grabarAnimaciones(page: Page) {
  await page.evaluate((clases) => {
    const w = window as any;
    w.__animaciones = [] as Animacion[];
    w.__vuelos = 0;
    const nombre = (el: HTMLElement) =>
      el.dataset.linea
        ? `linea:${el.dataset.linea}`
        : el.dataset.campo
          ? `campo:${el.dataset.campo}`
          : el.dataset.testid
            ? `testid:${el.dataset.testid}`
            : el.dataset.pestana
              ? `pestana:${el.dataset.pestana}`
              : el.hasAttribute("data-linea-foto")
                ? `foto:${(el.closest("[data-linea]") as HTMLElement | null)?.dataset.linea ?? "?"}`
                : el.tagName.toLowerCase();
    new MutationObserver((cambios) => {
      // pulsar() quita la clase y la vuelve a poner: son dos cambios del
      // atributo en la misma tanda, pero UNA animación. Se cuenta una vez por
      // elemento y clase en cada tanda.
      const vistos = new Set<string>();
      for (const c of cambios) {
        if (c.type === "childList") {
          c.addedNodes.forEach((n) => {
            if (n instanceof HTMLElement && n.dataset.testid === "coreografia-vuelo") w.__vuelos++;
          });
        } else if (c.type === "attributes" && c.target instanceof HTMLElement) {
          const el = c.target;
          const antes = (c.oldValue ?? "").split(/\s+/);
          for (const clase of clases) {
            const clave = `${nombre(el)}#${clase}`;
            if (el.classList.contains(clase) && !antes.includes(clase) && !vistos.has(clave)) {
              vistos.add(clave);
              w.__animaciones.push({ clase, en: nombre(el), retraso: el.style.animationDelay });
            }
          }
        }
      }
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"], attributeOldValue: true });
  }, CLASES);
}

export async function animaciones(page: Page): Promise<Animacion[]> {
  return page.evaluate(() => (window as any).__animaciones ?? []);
}

export async function vuelos(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).__vuelos ?? 0);
}
