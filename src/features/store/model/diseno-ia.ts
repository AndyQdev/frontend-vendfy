import { useMutation } from "@tanstack/react-query";

import { apiFetch } from "@/shared/api/client";
import type { CatalogoTemas, EstiloListo, Opcion, TemaDelCatalogo } from "./catalogo-temas";

/**
 * "Armar con IA": el comerciante cuenta cómo es su tienda y un modelo elige
 * entre las opciones del catálogo (`POST /api/store-design/ai`).
 *
 * El backend no conoce el catálogo de la tienda: se lo manda el panel, en una
 * versión compacta, y valida la respuesta contra eso mismo. No guarda nada:
 * lo que vuelve se aplica como borrador, igual que un diseño listo.
 */

/** Hasta cuánto se puede contar. El backend corta en lo mismo. */
export const MAX_DESCRIPCION_IA = 500;

export interface TextosIa {
  tituloPortada?: string;
  subtituloPortada?: string;
  anuncio?: string;
  nosotros?: string;
}

export interface DisenoIa {
  /** Con la forma de un diseño listo: solo ids del catálogo, lo que la IA no eligió no viene. */
  apariencia: EstiloListo["apariencia"];
  textos: TextosIa;
  explicacion: string;
  /** Cuántos armados le quedan hoy a la tienda. */
  restantesHoy?: number;
}

export interface ContextoIa {
  nombre?: string;
  rubro?: string;
  imagenesPortada: number;
  categorias: string[];
  productos: string[];
}

export interface ArmarDisenoInput {
  storeId: string;
  descripcion: string;
  catalogo: ReturnType<typeof catalogoParaIa>;
  contexto?: ContextoIa;
}

const compacta = (lista: Opcion[] | undefined) =>
  (lista ?? []).map((op) => ({
    id: op.id,
    nombre: op.nombre,
    ...(op.descripcion ? { descripcion: op.descripcion } : {}),
    ...(op.minimoImagenes ? { minimoImagenes: op.minimoImagenes } : {}),
  }));

/** Las opciones entre las que la IA puede elegir: ids, nombres y descripciones, sin muestras ni ajustes. */
export function catalogoParaIa(catalogo: CatalogoTemas, tema: TemaDelCatalogo) {
  const o = catalogo.opciones;
  return {
    paletas: tema.paletas.map((p) => ({ id: p.id, nombre: p.nombre })),
    tipografias: compacta(o.tipografias),
    esquinas: compacta(o.esquinas),
    cabeceras: compacta(o.cabeceras),
    tarjetas: compacta(o.tarjetas),
    pies: compacta(o.pies),
    entradas: compacta(o.entradas),
    hovers: compacta(o.hovers),
    texturas: compacta(o.texturas),
    fondos: compacta(o.fondos),
    alturasPortada: compacta(o.alturasPortada),
    oscurecer: compacta(o.oscurecer),
    alineaciones: compacta(o.alineaciones),
    secciones: o.secciones.map((s) => ({
      tipo: s.tipo,
      nombre: s.nombre,
      descripcion: s.descripcion,
      ...(s.fija ? { fija: true } : {}),
      variantes: compacta(s.variantes),
    })),
    largos: { titulo: o.largos.titulo, texto: o.largos.texto, anuncio: o.largos.anuncio },
  };
}

/** Tarda entre 5 y 30 segundos: la pantalla tiene que mostrarlo. */
export function useArmarDisenoConIa() {
  return useMutation({
    mutationFn: async (input: ArmarDisenoInput) => {
      const res = await apiFetch<DisenoIa>("/api/store-design/ai", { method: "POST", body: input });
      if (!res.data) throw new Error("La IA no devolvió un diseño. Prueba de nuevo.");
      return res.data;
    },
  });
}
