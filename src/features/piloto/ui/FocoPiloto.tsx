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
export function buscarFoco(foco: string): HTMLElement | null {
  const selector = foco.startsWith("cart:")
    ? `[data-cart-item="${CSS.escape(foco.slice(5))}"]`
    : `[data-piloto~="${CSS.escape(foco)}"]`;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

const pegar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * La flecha del grupo de la bola al elemento: sale del borde del grupo más
 * cercano al elemento y llega al borde del elemento más cercano a la salida,
 * con una curva suave. Sin flecha si están pegados o se tocan.
 */
function curva(grupo: Caja, marco: Caja): string | null {
  const centro = { x: marco.left + marco.width / 2, y: marco.top + marco.height / 2 };
  const sale = {
    x: pegar(centro.x, grupo.left + 12, grupo.left + grupo.width - 12),
    y: pegar(centro.y, grupo.top, grupo.top + grupo.height),
  };
  const llega = {
    x: pegar(sale.x, marco.left, marco.left + marco.width),
    y: pegar(sale.y, marco.top, marco.top + marco.height),
  };
  const dx = llega.x - sale.x;
  const dy = llega.y - sale.y;
  const largo = Math.hypot(dx, dy);
  if (largo < 56) return null;
  // Se dobla hacia un costado, un 18 % del largo, para que se lea como flecha y no como raya.
  const control = { x: (sale.x + llega.x) / 2 - (dy / largo) * largo * 0.18, y: (sale.y + llega.y) / 2 + (dx / largo) * largo * 0.18 };
  const fin = { x: llega.x - (dx / largo) * 4, y: llega.y - (dy / largo) * 4 };
  return `M ${sale.x} ${sale.y} Q ${control.x} ${control.y} ${fin.x} ${fin.y}`;
}

/**
 * Lo que el piloto está tocando, marcado en la pantalla: un marco que late
 * alrededor y una flecha punteada desde la bola y sus subtítulos. Sigue al elemento si la
 * página se mueve (rAF), y lo trae a la vista cuando cambia.
 */
export function FocoPiloto() {
  const { foco, fase, abierto } = usePiloto();
  const [marco, setMarco] = useState<Caja | null>(null);
  const [desde, setDesde] = useState<Caja | null>(null);
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
      const el = buscarFoco(foco);
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
      const grupo = document.getElementById("piloto-tarjeta")?.getBoundingClientRect();
      setDesde((prev) => {
        if (!grupo || !grupo.width) return null;
        const nuevo = { top: grupo.top, left: grupo.left, width: grupo.width, height: grupo.height };
        return prev && prev.top === nuevo.top && prev.left === nuevo.left && prev.width === nuevo.width && prev.height === nuevo.height
          ? prev
          : nuevo;
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
  const trazo = desde ? curva(desde, marco) : null;

  return createPortal(
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[75]">
      {trazo && (
        <svg className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <marker id="piloto-punta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--primary))" />
            </marker>
          </defs>
          <path
            className="piloto-flecha"
            d={trazo}
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
