/**
 * Las animaciones del seguimiento visual (Fase G1), sin librerías: la Web
 * Animations API del navegador y clases de CSS (index.css).
 *
 * Reglas (ASISTENTE-GENERATIVO.md, 3.1): rápidas (250-550 ms), una sola vez,
 * y con `prefers-reduced-motion` nada se mueve: solo cambia de color.
 *
 * Lo puro (`trayectoria`, `interpolar`) se prueba sin navegador en
 * e2e/logic/animaciones.spec.ts.
 */

export interface Caja {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Duración del vuelo de un producto al carrito. */
export const DURACION_VUELO = 520;

// ------------------------------------------------------------ puro

/** Arranca rápido y frena al llegar: lo natural para algo que "cae" en su lugar. */
export function frenar(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - x, 3);
}

/** El valor a mitad de camino, redondeado a centavos (es plata). */
export function interpolar(de: number, a: number, t: number): number {
  return Math.round((de + (a - de) * frenar(t)) * 100) / 100;
}

/**
 * El recorrido del vuelo como keyframes de `transform`, con el clon fijo en la
 * caja de origen y `transform-origin` arriba a la izquierda: se traslada a la
 * caja destino y se escala a su tamaño, pasando por un punto elevado (`arco`)
 * para que se lea como "va hacia allá" y no como un deslizamiento.
 */
export function trayectoria(origen: Caja, destino: Caja, arco = 60): Keyframe[] {
  const dx = destino.left - origen.left;
  const dy = destino.top - origen.top;
  const escala = origen.width > 0 ? destino.width / origen.width : 1;
  const medio = (1 + escala) / 2;
  return [
    { transform: "translate(0px, 0px) scale(1)", opacity: 1, offset: 0 },
    {
      transform: `translate(${dx / 2}px, ${dy / 2 - arco}px) scale(${medio})`,
      opacity: 1,
      offset: 0.5,
    },
    { transform: `translate(${dx}px, ${dy}px) scale(${escala})`, opacity: 0.85, offset: 1 },
  ];
}

// ------------------------------------------------------------ pantalla

export function movimientoReducido(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function visible(el: Element | null): el is HTMLElement {
  if (!el) return false;
  const r = (el as HTMLElement).getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/** El último visible que coincide: el chat crece hacia abajo. */
export function ultimoVisible(selector: string): HTMLElement | null {
  const todos = document.querySelectorAll<HTMLElement>(selector);
  for (let i = todos.length - 1; i >= 0; i--) if (visible(todos[i])) return todos[i];
  return null;
}

/**
 * Agregar una clase de animación de CSS una vez (reiniciándola si ya estaba)
 * y sacarla al terminar. `retraso` escalona varias líneas que entran juntas.
 */
export function pulsar(el: HTMLElement | null, clase: string, retraso = 0) {
  if (!el) return;
  el.classList.remove(clase);
  void el.offsetWidth;
  el.style.animationDelay = retraso ? `${retraso}ms` : "";
  el.classList.add(clase);
  const fin = () => {
    el.classList.remove(clase);
    el.style.animationDelay = "";
  };
  el.addEventListener("animationend", fin, { once: true });
  window.setTimeout(fin, 1600 + retraso);
}

/**
 * Orígenes recordados: la ficha del producto desaparece al agregarlo (el panel
 * pasa a la venta), así que su foto se anota ANTES de despachar.
 */
const origenes = new Map<string, { caja: Caja; src: string; cuando: number }>();

export function recordarOrigen(clave: string, el: Element | null) {
  if (!visible(el)) return;
  const img = el instanceof HTMLImageElement ? el : el.querySelector("img");
  if (!img?.src) return;
  const r = img.getBoundingClientRect();
  origenes.set(clave, { caja: { left: r.left, top: r.top, width: r.width, height: r.height }, src: img.src, cuando: Date.now() });
}

export function tomarOrigen(clave: string): { caja: Caja; src: string } | null {
  const o = origenes.get(clave);
  origenes.delete(clave);
  return o && Date.now() - o.cuando < 1500 ? o : null;
}

/** Los vuelos en el aire: si la mesa se vacía, no tienen dónde aterrizar. */
const enVuelo = new Set<Animation>();

export function cancelarVuelos() {
  for (const a of enVuelo) a.cancel();
  enVuelo.clear();
}

/**
 * Una copia de la foto vuela de `origen` a `destino` y desaparece. Al llegar,
 * el destino hace un pequeño rebote ("aterriza"). Devuelve si voló.
 *
 * `ocultarDestino`: si el destino es la foto de la línea, se esconde mientras
 * la copia vuela; si no, se verían dos fotos iguales y no se leería "llegó".
 */
export function volar(src: string, origen: Caja, destino: HTMLElement, retraso = 0, ocultarDestino = false): boolean {
  if (movimientoReducido()) return false;
  const d = destino.getBoundingClientRect();
  if (d.width === 0 || origen.width === 0) return false;

  const clon = document.createElement("img");
  clon.src = src;
  clon.alt = "";
  clon.setAttribute("aria-hidden", "true");
  clon.dataset.testid = "coreografia-vuelo";
  Object.assign(clon.style, {
    position: "fixed",
    left: `${origen.left}px`,
    top: `${origen.top}px`,
    width: `${origen.width}px`,
    height: `${origen.height}px`,
    objectFit: "cover",
    borderRadius: "10px",
    boxShadow: "0 8px 24px rgb(15 23 42 / 0.18)",
    pointerEvents: "none",
    zIndex: "80",
    transformOrigin: "0 0",
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(clon);

  const animacion = clon.animate(trayectoria(origen, { left: d.left, top: d.top, width: d.width, height: d.height }), {
    duration: DURACION_VUELO,
    delay: retraso,
    easing: "cubic-bezier(0.5, 0, 0.25, 1)",
    fill: "both",
  });
  if (ocultarDestino) destino.style.visibility = "hidden";
  enVuelo.add(animacion);
  const limpiar = () => {
    enVuelo.delete(animacion);
    clon.remove();
    if (ocultarDestino) destino.style.visibility = "";
  };
  animacion.onfinish = () => {
    limpiar();
    pulsar(destino, "aterriza");
  };
  animacion.oncancel = limpiar;
  return true;
}
