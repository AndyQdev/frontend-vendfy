import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { usePiloto } from "../lib/estado";

/**
 * El nombre de lo que señala, encima del marco. Solo donde arriba hay aire: el
 * total y las filas del carrito tienen botones justo encima y la etiqueta los tapaba.
 */
const ETIQUETA: Record<string, string> = {
  "caja:pago": "Método de pago",
  "caja:cobrar": "Cobrar",
  "producto:nombre": "Nombre",
  "producto:precio": "Precio",
  "producto:stock": "Stock inicial",
  "producto:categoria": "Categoría",
  "producto:guardar": "Guardar",
};

interface Caja {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** El primer elemento visible que lleva esa marca (la Caja tiene el pie dos veces: escritorio y celular). */
function buscar(foco: string): HTMLElement | null {
  const selector = foco.startsWith("cart:")
    ? `[data-cart-item="${CSS.escape(foco.slice(5))}"]`
    : `[data-piloto~="${CSS.escape(foco)}"]`;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/**
 * Lo que el piloto está tocando, marcado en la pantalla: un marco que late
 * alrededor y una flecha punteada desde su tarjeta. Sigue al elemento si la
 * página se mueve (rAF), y lo trae a la vista cuando cambia.
 */
export function FocoPiloto() {
  const { foco, fase, abierto } = usePiloto();
  const [marco, setMarco] = useState<Caja | null>(null);
  const [desde, setDesde] = useState<{ x: number; y: number } | null>(null);
  const traido = useRef<string | null>(null);

  useEffect(() => {
    if (!foco || !abierto) {
      setMarco(null);
      traido.current = null;
      return;
    }
    let vivo = true;
    let cuadro = 0;
    const seguir = () => {
      if (!vivo) return;
      const el = buscar(foco);
      if (el) {
        if (traido.current !== foco) {
          traido.current = foco;
          el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
        const r = el.getBoundingClientRect();
        const m = 6;
        setMarco((prev) => {
          const nuevo = { top: r.top - m, left: r.left - m, width: r.width + m * 2, height: r.height + m * 2 };
          return prev && Math.abs(prev.top - nuevo.top) < 0.5 && Math.abs(prev.left - nuevo.left) < 0.5 && Math.abs(prev.width - nuevo.width) < 0.5 && Math.abs(prev.height - nuevo.height) < 0.5
            ? prev
            : nuevo;
        });
      } else {
        setMarco(null);
      }
      const tarjeta = document.getElementById("piloto-tarjeta")?.getBoundingClientRect();
      setDesde((prev) => {
        if (!tarjeta) return null;
        const nuevo = { x: tarjeta.right, y: tarjeta.top + 28 };
        return prev && prev.x === nuevo.x && prev.y === nuevo.y ? prev : nuevo;
      });
      cuadro = requestAnimationFrame(seguir);
    };
    seguir();
    return () => {
      vivo = false;
      cancelAnimationFrame(cuadro);
    };
  }, [foco, abierto]);

  if (!marco || !foco) return null;

  const etiqueta = ETIQUETA[foco] ?? null;
  const hasta = { x: marco.left, y: marco.top + marco.height / 2 };
  // La flecha solo si la tarjeta queda a la izquierda del elemento (escritorio).
  const flecha = desde && hasta.x - desde.x > 40;
  const medio = desde ? (desde.x + hasta.x) / 2 : 0;

  return createPortal(
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60]">
      {flecha && desde && (
        <svg className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <marker id="piloto-punta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--primary))" />
            </marker>
          </defs>
          <path
            className="piloto-flecha"
            d={`M ${desde.x} ${desde.y} C ${medio} ${desde.y}, ${medio} ${hasta.y}, ${hasta.x - 4} ${hasta.y}`}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            markerEnd="url(#piloto-punta)"
          />
        </svg>
      )}
      <div
        className="piloto-foco absolute"
        data-presiona={fase === "trabajando" && foco === "caja:cobrar" ? "true" : "false"}
        style={{ top: marco.top, left: marco.left, width: marco.width, height: marco.height }}
      />
      {etiqueta && (
        <span
          className="absolute -translate-y-full rounded-md bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground shadow-float"
          style={{ top: marco.top - 4, left: marco.left }}
        >
          {etiqueta}
        </span>
      )}
    </div>,
    document.body,
  );
}
