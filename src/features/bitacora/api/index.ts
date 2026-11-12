import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/shared/api/client";

/** Espejo de `RenglonBitacora` en ecomerce-backend/src/bitacora/services/bitacora.service.ts. */
export interface RenglonBitacora {
  id: string;
  fecha: string;
  storeId: string | null;
  tienda: string | null;
  userId: string | null;
  usuario: string | null;
  email: string | null;
  rol: string | null;
  metodo: string;
  modulo: string;
  moduloNombre: string;
  accion: "crear" | "editar" | "eliminar";
  /** La operación contada en palabras ("Eliminó un producto"). */
  descripcion: string;
  ruta: string;
  url: string;
  estado: number;
  exito: boolean;
  duracionMs: number | null;
  ip: string | null;
  datos: unknown;
}

export interface FiltrosBitacora {
  storeId?: string;
  userId?: string;
  accion?: string;
  modulo?: string;
  desde?: string;
  hasta?: string;
  /** "si": solo las que fallaron; "no": solo las que salieron bien. */
  fallidas?: "si" | "no";
  limit: number;
  offset: number;
}

export interface OpcionesBitacora {
  usuarios: { id: string; nombre: string }[];
  modulos: { id: string; nombre: string }[];
}

function consulta(f: Partial<FiltrosBitacora>): string {
  const q = new URLSearchParams();
  for (const [clave, valor] of Object.entries(f)) {
    if (valor === undefined || valor === "") continue;
    if (clave === "fallidas") q.set("fallidas", valor === "si" ? "true" : "false");
    else q.set(clave, String(valor));
  }
  const texto = q.toString();
  return texto ? `?${texto}` : "";
}

export function useBitacora(filtros: FiltrosBitacora) {
  return useQuery({
    queryKey: ["bitacora", filtros],
    queryFn: async () => {
      const r = await apiFetch<RenglonBitacora[]>(`/api/bitacora${consulta(filtros)}`);
      return { renglones: r.data ?? [], total: r.countData ?? 0 };
    },
    // Al cambiar de página o de filtro, la tabla anterior queda hasta que llega la nueva.
    placeholderData: keepPreviousData,
    // Un 403 (el rol no tiene el permiso) no se arregla reintentando.
    retry: false,
  });
}

export function useOpcionesBitacora(storeId: string | undefined) {
  return useQuery({
    queryKey: ["bitacora", "opciones", storeId],
    queryFn: async () =>
      (await apiFetch<OpcionesBitacora>(`/api/bitacora/opciones${consulta({ storeId })}`)).data ?? { usuarios: [], modulos: [] },
    staleTime: 60_000,
    retry: false,
  });
}
