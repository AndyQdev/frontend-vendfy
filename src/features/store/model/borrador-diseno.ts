import { useEffect, useRef, useState } from "react";

import type { AparienciaGuardada, StoreConfig } from "@/entities/store/model/types";

/**
 * El diseño que se está armando y todavía no se guardó, por tienda, en el
 * navegador.
 *
 * Armar la portada lleva un rato (subir imágenes, escribir textos), y antes
 * todo vivía solo en la memoria del formulario: ir a otra pantalla del panel o
 * recargar lo perdía sin aviso. Ahora cada cambio se copia acá; al volver, el
 * formulario ofrece recuperarlo o descartarlo. Se borra solo cuando lo que hay
 * en pantalla vuelve a ser lo guardado (al guardar o al descartar).
 *
 * El panel usa `BrowserRouter`, que no permite frenar una navegación interna
 * (`useBlocker` pide el router de datos): por eso se conserva en vez de
 * preguntar antes de salir. Cerrar o recargar la pestaña sí pregunta
 * (`beforeunload`, en StoreConfigForm).
 */

export interface DisenoGuardable {
  themeId?: string;
  category?: string;
  apariencia?: AparienciaGuardada;
}

export interface BorradorDiseno {
  diseno: DisenoGuardable;
  /** ISO: cuándo se tocó por última vez. */
  fecha: string;
}

const clave = (storeId: string) => `vendfy:borrador-diseno:${storeId}`;

export function disenoDe(config: StoreConfig | undefined): DisenoGuardable {
  return { themeId: config?.themeId, category: config?.category, apariencia: config?.apariencia };
}

// localStorage puede no estar (modo privado estricto, almacenamiento lleno):
// sin él no hay borrador, y el formulario anda igual.
function leer(storeId: string): BorradorDiseno | null {
  try {
    const crudo = localStorage.getItem(clave(storeId));
    const b = crudo ? (JSON.parse(crudo) as BorradorDiseno) : null;
    return b && typeof b === "object" && b.diseno && typeof b.fecha === "string" ? b : null;
  } catch {
    return null;
  }
}
function escribir(storeId: string, b: BorradorDiseno) {
  try {
    localStorage.setItem(clave(storeId), JSON.stringify(b));
  } catch {
    /* sin almacenamiento */
  }
}
function borrar(storeId: string) {
  try {
    localStorage.removeItem(clave(storeId));
  } catch {
    /* sin almacenamiento */
  }
}

// Con JSON y no comparando campo por campo: el orden de las claves es el
// mismo porque ambos lados salen de `aparienciaEfectiva`.
const iguales = (a: DisenoGuardable, b: DisenoGuardable) => JSON.stringify(a) === JSON.stringify(b);

export function useBorradorDiseno(storeId: string | undefined, guardado: DisenoGuardable, actual: DisenoGuardable) {
  /** Un borrador de otra visita, esperando que el comerciante decida. */
  const [pendiente, setPendiente] = useState<BorradorDiseno | null>(null);
  // Mientras no decide, no se escribe: lo nuevo pisaría el borrador viejo.
  const decidido = useRef(false);
  const guardadoRef = useRef(guardado);
  guardadoRef.current = guardado;

  useEffect(() => {
    decidido.current = false;
    setPendiente(null);
    if (!storeId) return;
    const b = leer(storeId);
    if (b && !iguales(b.diseno, guardadoRef.current)) {
      setPendiente(b);
    } else {
      borrar(storeId);
      decidido.current = true;
    }
  }, [storeId]);

  const jActual = JSON.stringify(actual);
  const jGuardado = JSON.stringify(guardado);
  useEffect(() => {
    if (!storeId || !decidido.current) return;
    // Un respiro: escribir un título no guarda una vez por letra.
    const t = setTimeout(() => {
      if (jActual === jGuardado) borrar(storeId);
      else escribir(storeId, { diseno: JSON.parse(jActual), fecha: new Date().toISOString() });
    }, 500);
    return () => clearTimeout(t);
  }, [storeId, jActual, jGuardado]);

  return {
    pendiente,
    /** Devuelve el diseño para ponerlo en el formulario. */
    recuperar(): DisenoGuardable | null {
      decidido.current = true;
      setPendiente(null);
      return pendiente?.diseno ?? null;
    },
    descartar() {
      if (storeId) borrar(storeId);
      decidido.current = true;
      setPendiente(null);
    },
  };
}
