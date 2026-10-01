import { totalCompra, totalVenta, type Mesa, type TipoMesa } from "./mesa";

/**
 * La coreografía: qué se tiene que VER cuando cambia la mesa.
 *
 * No mira qué acción se despachó sino qué cambió entre la mesa de antes y la
 * de después. Así el botón "+", la frase "sumá 2", la voz y una factura leída
 * producen exactamente los mismos efectos, sin una lista paralela de casos
 * que se pueda desincronizar del reductor.
 *
 * Los efectos son datos; quien los dibuja (Fase G1) se suscribe al bus.
 * Ver ASISTENTE-GENERATIVO.md, sección 3.1.
 */

export type Efecto =
  /** `imagen`: la foto que vuela al carrito (null = no hay foto, no vuela). */
  | { tipo: "lineaEntra"; mesa: TipoMesa; productId: string; imagen: string | null }
  | { tipo: "lineaSale"; mesa: TipoMesa; productId: string }
  | { tipo: "cantidad"; mesa: TipoMesa; productId: string; de: number; a: number }
  | { tipo: "total"; mesa: TipoMesa; de: number; a: number }
  /** Un dato que se completó o cambió: cliente, pago, proveedor, costo:<id>… */
  | { tipo: "campo"; mesa: TipoMesa; campo: string }
  | { tipo: "vaciada"; mesa: TipoMesa }
  // Lo que no es un cambio de la mesa sino algo que pasa con ella: los emite
  // la pantalla, no `efectosDeCambio`.
  /** Empezó el cobro. Si vino del chat o la voz, el botón "se presiona solo". */
  | { tipo: "cobrando"; origen: "chat" | "boton" }
  | { tipo: "cobrada" };

interface LineaComun {
  productId: string;
  cantidad: number;
  imagen: string | null;
}

function diffLineas<L extends LineaComun>(
  mesa: TipoMesa,
  antes: L[],
  despues: L[],
  campoCambiado: (a: L, d: L) => string | null,
): Efecto[] {
  if (antes.length > 0 && despues.length === 0) return [{ tipo: "vaciada", mesa }];
  const out: Efecto[] = [];
  const previas = new Map(antes.map((l) => [l.productId, l]));
  const nuevas = new Map(despues.map((l) => [l.productId, l]));
  for (const l of despues) {
    const p = previas.get(l.productId);
    if (!p) {
      out.push({ tipo: "lineaEntra", mesa, productId: l.productId, imagen: l.imagen });
      continue;
    }
    if (p.cantidad !== l.cantidad) {
      out.push({ tipo: "cantidad", mesa, productId: l.productId, de: p.cantidad, a: l.cantidad });
    }
    const campo = campoCambiado(p, l);
    if (campo) out.push({ tipo: "campo", mesa, campo });
  }
  for (const p of antes) {
    if (!nuevas.has(p.productId)) out.push({ tipo: "lineaSale", mesa, productId: p.productId });
  }
  return out;
}

export function efectosDeCambio(antes: Mesa, despues: Mesa): Efecto[] {
  const out: Efecto[] = [];

  // ---- venta
  if (antes.venta !== despues.venta) {
    const a = antes.venta;
    const d = despues.venta;
    out.push(
      ...diffLineas("venta", a.lineas, d.lineas, (p, l) => (p.precio !== l.precio ? `precio:${l.productId}` : null)),
    );
    if (a.clienteId !== d.clienteId || a.clienteNombre !== d.clienteNombre) {
      out.push({ tipo: "campo", mesa: "venta", campo: "cliente" });
    }
    if (a.pago !== d.pago && d.pago) out.push({ tipo: "campo", mesa: "venta", campo: "pago" });
    const de = totalVenta(a);
    const al = totalVenta(d);
    if (de !== al) out.push({ tipo: "total", mesa: "venta", de, a: al });
  }

  // ---- compra
  if (antes.compra !== despues.compra) {
    const a = antes.compra;
    const d = despues.compra;
    out.push(
      ...diffLineas("compra", a.lineas, d.lineas, (p, l) => (p.costo !== l.costo ? `costo:${l.productId}` : null)),
    );
    if (a.proveedor !== d.proveedor && d.proveedor) out.push({ tipo: "campo", mesa: "compra", campo: "proveedor" });
    if (a.referencia !== d.referencia && d.referencia) out.push({ tipo: "campo", mesa: "compra", campo: "referencia" });
    const de = totalCompra(a);
    const al = totalCompra(d);
    if (de !== al) out.push({ tipo: "total", mesa: "compra", de, a: al });
  }

  return out;
}

// ------------------------------------------------------------ el bus

export type OyenteEfectos = (efectos: Efecto[]) => void;

export interface Coreografia {
  emitir: (efectos: Efecto[]) => void;
  /** Devuelve la función para desuscribirse. */
  suscribir: (oyente: OyenteEfectos) => () => void;
}

export function crearCoreografia(): Coreografia {
  const oyentes = new Set<OyenteEfectos>();
  return {
    emitir(efectos) {
      if (efectos.length === 0) return;
      for (const o of oyentes) o(efectos);
    },
    suscribir(oyente) {
      oyentes.add(oyente);
      return () => {
        oyentes.delete(oyente);
      };
    },
  };
}
