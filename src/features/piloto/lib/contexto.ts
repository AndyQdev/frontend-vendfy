import type { LineaContexto } from "@/entities/omnibox/model/types";

import type { BorradorPiloto } from "../model/plan";
import { lineasDeContexto } from "./carrito";
import { pantallaPiloto } from "./estado";

/** Lo que viaja con cada frase para que el servidor sepa de qué se habla. */
export interface ContextoPiloto {
  venta: { lineas: LineaContexto[] };
  /** El producto nuevo que está a la vista, con lo que ya tiene. */
  formulario?: { tipo: "productos"; productos: Record<string, unknown>[] };
}

/**
 * La venta abierta ("que sean 3", "saca la coca") y, si el formulario de
 * producto nuevo está a la vista, lo que ya tiene. Sin el formulario, «termina
 * de llenarlo, ponle 50» no significaba nada para el servidor y el pedido
 * terminaba en el Asistente.
 */
export function contextoPiloto(borrador: BorradorPiloto | null): ContextoPiloto {
  const contexto: ContextoPiloto = { venta: { lineas: lineasDeContexto() } };
  const enPantalla = pantallaPiloto("producto")?.leer();
  const nombre = enPantalla?.nombre.trim() || borrador?.nombre || "";
  if (enPantalla && nombre) {
    contexto.formulario = {
      tipo: "productos",
      productos: [
        {
          nombre,
          precio: enPantalla.precio ?? borrador?.precio ?? null,
          stock: enPantalla.stock ?? borrador?.stock ?? null,
          categoria: borrador?.categoria ?? null,
          codigo: null,
          marca: null,
          compra: null,
        },
      ],
    };
  }
  return contexto;
}
