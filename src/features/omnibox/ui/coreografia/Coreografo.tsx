import { useEffect } from "react";

import type { Coreografia, Efecto } from "../../model/coreografia";
import { cancelarVuelos, pulsar, tomarOrigen, ultimoVisible, volar, type Caja } from "./animaciones";

/** Entre dos líneas que entran juntas ("compré 3 cocas y 2 arroz", una factura). */
const ESCALON = 90;

function caja(el: Element): Caja {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** La foto de ese producto en el chat (la tarjeta de la frase que lo agregó). */
function fotoEnElChat(src: string): HTMLElement | null {
  const fotos = document.querySelectorAll<HTMLImageElement>('[data-zona="chat"] img');
  for (let i = fotos.length - 1; i >= 0; i--) {
    const f = fotos[i];
    const r = f.getBoundingClientRect();
    if (f.getAttribute("src") === src && r.width > 0 && r.height > 0) return f;
  }
  return null;
}

/**
 * Hacia dónde va lo que entra: la foto de su línea si la mesa está a la
 * vista; si no (teléfono con el panel cerrado, otra pestaña), el chip de la
 * mesa en curso o su pestaña. Lo que se agrega tiene que verse llegar a algún
 * lado: es la prueba de que la frase hizo algo.
 */
function destinoDe(mesa: string, productId: string): { el: HTMLElement; esLinea: boolean } | null {
  const foto = ultimoVisible(`[data-linea="${mesa}:${productId}"] [data-linea-foto]`);
  if (foto) return { el: foto, esLinea: true };
  const otro =
    ultimoVisible(`[data-testid="omnibox-chip-mesa"][data-mesa="${mesa}"]`) ??
    ultimoVisible(`[data-pestana="${mesa}"]`);
  return otro ? { el: otro, esLinea: false } : null;
}

function dibujar(efectos: Efecto[]) {
  let n = 0;
  for (const e of efectos) {
    switch (e.tipo) {
      case "lineaEntra": {
        const retraso = n++ * ESCALON;
        const destino = destinoDe(e.mesa, e.productId);
        const linea = ultimoVisible(`[data-linea="${e.mesa}:${e.productId}"]`);
        pulsar(linea, "linea-entra", retraso);
        if (!destino) break;
        const recordado = tomarOrigen(e.productId);
        const enChat = e.imagen ? fotoEnElChat(e.imagen) : null;
        const src = recordado?.src ?? (enChat ? e.imagen : null);
        const origen = recordado?.caja ?? (enChat ? caja(enChat) : null);
        const voló = src && origen ? volar(src, origen, destino.el, retraso, destino.esLinea) : false;
        // Sin vuelo (sin foto, o movimiento reducido), el destino igual avisa.
        if (!voló && !destino.esLinea) pulsar(destino.el, "aterriza", retraso);
        break;
      }
      case "cantidad": {
        const campo = ultimoVisible(`[data-campo="cantidad:${e.productId}"]`);
        if (campo) pulsar(campo, "cantidad-cambia");
        else pulsar(destinoDe(e.mesa, e.productId)?.el ?? null, "aterriza");
        break;
      }
      case "campo":
        pulsar(ultimoVisible(`[data-campo="${e.campo}"]`), "campo-completo");
        break;
      case "cobrando":
        // Dicho por chat o voz: el botón se presiona solo, para que se vea
        // que la frase hizo lo mismo que el dedo.
        if (e.origen === "chat") pulsar(ultimoVisible('[data-testid="omnibox-cobrar"]'), "boton-presiona");
        break;
      case "vaciada":
        // Se cobró, se registró o se limpió: lo que estaba volando ya no
        // tiene adónde llegar.
        cancelarVuelos();
        break;
      default:
        break;
    }
  }
}

/**
 * El coreógrafo: escucha el bus de la mesa y dibuja cada efecto. No renderiza
 * nada; todas las animaciones viven acá y en index.css, y los componentes de
 * la mesa solo llevan marcas `data-*`.
 */
export function Coreografo({ coreografia }: { coreografia: Coreografia }) {
  useEffect(() => coreografia.suscribir(dibujar), [coreografia]);
  return null;
}
