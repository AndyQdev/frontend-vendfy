import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/shared/api/client";

export interface Miembro {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  esDueno: boolean;
  activo: boolean;
  debeCambiarClave: boolean;
  rol: { id: string; name: string } | null;
  storeIds: string[];
  createdAt: string;
}

export interface Equipo {
  miembros: Miembro[];
  plan: { codigo: string; nombre: string };
  /** null = sin tope. Cuenta al dueño. */
  limiteUsuarios: number | null;
  usuariosActivos: number;
}

export interface RolEquipo {
  id: string;
  name: string;
  descripcion: string | null;
  /** De Vendfy: se asigna o se duplica, no se edita. */
  base: boolean;
  permisos: string[];
  usuarios: number;
}

export interface CatalogoEquipo {
  modulos: { modulo: string; permisos: { permiso: string; descripcion: string }[] }[];
}

export interface NuevoMiembro {
  name: string;
  email: string;
  phoneNumber?: string;
  roleId: string;
  storeIds: string[];
  password: string;
}

export type CambiosMiembro = Partial<Omit<NuevoMiembro, "email">> & { activo?: boolean };

export interface DatosRol {
  name: string;
  descripcion?: string;
  permisos: string[];
}

const CLAVE = ["equipo"] as const;

export function useEquipo() {
  return useQuery({
    queryKey: [...CLAVE, "miembros"],
    queryFn: async () => (await apiFetch<Equipo>("/api/equipo")).data as Equipo,
  });
}

export function useRolesEquipo() {
  return useQuery({
    queryKey: [...CLAVE, "roles"],
    queryFn: async () => (await apiFetch<RolEquipo[]>("/api/equipo/roles")).data ?? [],
  });
}

export function useCatalogoEquipo() {
  return useQuery({
    queryKey: [...CLAVE, "catalogo"],
    queryFn: async () => (await apiFetch<CatalogoEquipo>("/api/equipo/catalogo")).data as CatalogoEquipo,
    staleTime: Infinity,
  });
}

/** Toda escritura vuelve a leer el equipo y los roles (los contadores cambian juntos). */
function useEscritura<T, R = unknown>(fn: (v: T) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVE }),
  });
}

export const useCrearMiembro = () =>
  useEscritura(async (datos: NuevoMiembro) => (await apiFetch<Miembro>("/api/equipo", { method: "POST", body: datos })).data as Miembro);

export const useEditarMiembro = () =>
  useEscritura(async ({ id, ...datos }: CambiosMiembro & { id: string }) =>
    (await apiFetch<Miembro>(`/api/equipo/${id}`, { method: "PATCH", body: datos })).data as Miembro,
  );

export const useEliminarMiembro = () =>
  useEscritura(async (id: string) => apiFetch(`/api/equipo/${id}`, { method: "DELETE" }));

export const useCrearRol = () =>
  useEscritura(async (datos: DatosRol) => (await apiFetch<RolEquipo>("/api/equipo/roles", { method: "POST", body: datos })).data as RolEquipo);

export const useEditarRol = () =>
  useEscritura(async ({ id, ...datos }: Partial<DatosRol> & { id: string }) =>
    (await apiFetch<RolEquipo>(`/api/equipo/roles/${id}`, { method: "PATCH", body: datos })).data as RolEquipo,
  );

export const useEliminarRol = () =>
  useEscritura(async (id: string) => apiFetch(`/api/equipo/roles/${id}`, { method: "DELETE" }));
