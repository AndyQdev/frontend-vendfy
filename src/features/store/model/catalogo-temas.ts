import { useQuery } from "@tanstack/react-query";

import type { AparienciaGuardada, SeccionGuardada } from "@/entities/store/model/types";

/**
 * El catálogo de temas y opciones de apariencia. No vive en el panel: lo sirve
 * la tienda (`client-frontend/app/api/temas/route.ts`), que es la que los
 * dibuja. Un tema, una paleta o una variante nueva aparece acá con el deploy
 * de la tienda, sin tocar el panel.
 */

export const URL_TIENDA = import.meta.env.VITE_URL_PUBLIC || "https://compras.vendfy.shop";

export interface Opcion {
  id: string;
  nombre: string;
  descripcion?: string;
  /** Solo variantes de portada: cuántas imágenes necesita para poder elegirla. */
  minimoImagenes?: number;
  /** Solo variantes de portada: los ajustes del carrusel que usa. */
  ajustes?: AjustePortada[];
  /** Solo variantes de portada: la cabecera "Sobre la portada" va transparente encima. */
  cabeceraEncima?: boolean;
}

export type AjustePortada = "intervalo" | "transicion" | "flechas" | "puntos" | "altura" | "oscurecer" | "alineacion";

/**
 * Los ajustes que usa una variante de portada. Una tienda sin desplegar
 * todavía no los declara: ahí se muestran como antes (todos, salvo en las que
 * no pasan solas).
 */
export function ajustesDePortada(variante: Opcion | undefined): AjustePortada[] {
  if (variante?.ajustes) return variante.ajustes;
  if (variante && ["mosaico", "cinta"].includes(variante.id)) return [];
  return ["intervalo", "transicion", "flechas", "puntos"];
}

export interface Muestra {
  fondo: string;
  superficie: string;
  texto: string;
  primario: string;
  acento: string;
}

export interface TemaDelCatalogo {
  id: string;
  nombre: string;
  descripcion: string;
  personalizable: boolean;
  muestra: Muestra;
  paletas: Array<{ id: string; nombre: string; muestra: Muestra }>;
  aparienciaInicial: (Omit<AparienciaGuardada, "secciones"> & { secciones?: Array<Partial<SeccionGuardada> & { tipo: string }> }) | null;
  /** Combinaciones completas por rubro ("Estilos listos"). Una tienda sin desplegar no las trae. */
  estilos?: EstiloListo[];
}

export interface EstiloListo {
  id: string;
  nombre: string;
  descripcion: string;
  apariencia: Omit<AparienciaGuardada, "secciones"> & { secciones?: Array<Partial<SeccionGuardada> & { tipo: string }> };
}

export interface SeccionDelCatalogo {
  tipo: string;
  nombre: string;
  descripcion: string;
  fija?: boolean;
  variantes: Opcion[];
}

export interface CatalogoTemas {
  version: number;
  temas: TemaDelCatalogo[];
  /** Cada rubro con sus plantillas, en orden: la primera es la sugerida. */
  rubros: Array<{ id: string; nombre: string; temas: string[] }>;
  opciones: {
    tipografias: Opcion[];
    esquinas: Opcion[];
    cabeceras: Opcion[];
    entradas: Opcion[];
    hovers: Opcion[];
    entrePaginas: Opcion[];
    fondos: Opcion[];
    transiciones: Opcion[];
    intervalos: number[];
    variantesAnuncio: Opcion[];
    // Opcionales: una tienda sin desplegar todavía no las sirve.
    texturas?: Opcion[];
    alturasPortada?: Opcion[];
    oscurecer?: Opcion[];
    alineaciones?: Opcion[];
    secciones: SeccionDelCatalogo[];
    maxDiapositivas: number;
    largos: { titulo: number; texto: number; boton: number; anuncio: number };
  };
}

export function useCatalogoTemas() {
  return useQuery<CatalogoTemas>({
    queryKey: ["catalogo-temas", URL_TIENDA],
    queryFn: async () => {
      const r = await fetch(`${URL_TIENDA}/api/temas`);
      if (!r.ok) throw new Error(`No se pudo leer el catálogo de temas (${r.status})`);
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Lo que se ve hoy: lo guardado, o lo que propone el tema, o la primera
 * opción. La tienda hace lo mismo (y además valida); acá alcanza con mostrar
 * marcada la opción correcta.
 */
export function aparienciaEfectiva(guardada: AparienciaGuardada | undefined, tema: TemaDelCatalogo, catalogo: CatalogoTemas) {
  const g = guardada ?? {};
  const i = tema.aparienciaInicial ?? {};
  const o = catalogo.opciones;
  const valor = (campo: "tipografia" | "esquinas" | "cabecera" | "entrada" | "hover" | "entrePaginas", lista: Opcion[]) => {
    const v = g[campo] ?? i[campo];
    return lista.some((x) => x.id === v) ? (v as string) : lista[0]?.id;
  };

  return {
    paleta: tema.paletas.some((p) => p.id === g.paleta) ? g.paleta! : i.paleta ?? tema.paletas[0]?.id ?? "",
    tipografia: valor("tipografia", o.tipografias),
    esquinas: valor("esquinas", o.esquinas),
    cabecera: valor("cabecera", o.cabeceras),
    entrada: valor("entrada", o.entradas),
    hover: valor("hover", o.hovers),
    // Con una tienda vieja (catálogo sin la lista) no rompe: queda "normal".
    entrePaginas: valor("entrePaginas", o.entrePaginas ?? []) ?? "normal",
    textura: (g.textura ?? i.textura ?? "ninguna") as string,
    anuncio: {
      activo: g.anuncio?.activo ?? false,
      texto: g.anuncio?.texto ?? "",
      variante: g.anuncio?.variante ?? o.variantesAnuncio[0]?.id ?? "fija",
    },
    secciones: seccionesEfectivas(g.secciones, tema, catalogo),
    portada: {
      diapositivas: g.portada?.diapositivas ?? [],
      intervalo: g.portada?.intervalo ?? i.portada?.intervalo ?? 6,
      transicion: g.portada?.transicion ?? i.portada?.transicion ?? "fundido",
      flechas: g.portada?.flechas ?? i.portada?.flechas ?? true,
      puntos: g.portada?.puntos ?? i.portada?.puntos ?? true,
      altura: g.portada?.altura ?? i.portada?.altura ?? "alta",
      oscurecer: g.portada?.oscurecer ?? i.portada?.oscurecer ?? "medio",
      alineacion: g.portada?.alineacion ?? i.portada?.alineacion ?? "izquierda",
    },
  };
}

export type AparienciaEfectiva = ReturnType<typeof aparienciaEfectiva>;

/** Todas las secciones del catálogo, en el orden guardado o en el del tema. */
function seccionesEfectivas(guardadas: SeccionGuardada[] | undefined, tema: TemaDelCatalogo, catalogo: CatalogoTemas): SeccionGuardada[] {
  const porTipo = new Map(catalogo.opciones.secciones.map((s) => [s.tipo, s]));
  const delTema = tema.aparienciaInicial?.secciones ?? [];
  const base = (tipo: string): SeccionGuardada => {
    const def = porTipo.get(tipo)!;
    const t = delTema.find((s) => s.tipo === tipo);
    return {
      tipo,
      activa: t?.activa ?? true,
      variante: def.variantes.some((v) => v.id === t?.variante) ? t!.variante! : def.variantes[0].id,
      fondo: t?.fondo ?? "normal",
    };
  };

  const orden = [...delTema.map((s) => s.tipo), ...catalogo.opciones.secciones.map((s) => s.tipo)];
  const resultado: SeccionGuardada[] = [];
  for (const s of guardadas ?? []) {
    if (!porTipo.has(s.tipo) || resultado.some((r) => r.tipo === s.tipo)) continue;
    resultado.push({ ...base(s.tipo), ...s });
  }
  for (const tipo of orden) {
    if (porTipo.has(tipo) && !resultado.some((r) => r.tipo === tipo)) resultado.push(base(tipo));
  }
  return resultado;
}
