import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/shared/api/client";
import type {
  Inventory,
  InventoryResponse,
  InventoryQueryParams,
  InventoryMovement,
  MovementResponse,
  CreateMovementParams,
  MovementQueryParams,
  MovementKpis,
} from "../model/types";

export function useInventory(params: InventoryQueryParams) {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.append("limit", params.limit.toString());
  if (params.offset !== undefined) searchParams.append("offset", params.offset.toString());
  if (params.order) searchParams.append("order", params.order);
  if (params.attr) searchParams.append("attr", params.attr);
  if (params.value) searchParams.append("value", params.value);
  if (params.storeId) searchParams.append("storeId", params.storeId);

  return useQuery<InventoryResponse>({
    queryKey: ["inventory", params],
    queryFn: async () => {
      const response = await apiFetch<Inventory[]>(`/api/inventory?${searchParams.toString()}`);
      return {
        statusCode: response.statusCode,
        data: response.data || [],
        countData: response.countData || 0,
        stats: response.stats || {},
      };
    },
  });
}

// Hook para scroll infinito en POS
export function useInfiniteInventory(params: Omit<InventoryQueryParams, 'offset' | 'limit'> & { pageSize?: number }) {
  const pageSize = params.pageSize || 8;
  
  return useInfiniteQuery<InventoryResponse, Error, InventoryResponse, readonly unknown[], number>({
    queryKey: ["inventory-infinite", params],
    queryFn: async ({ pageParam }) => {
      const searchParams = new URLSearchParams();
      searchParams.append("limit", pageSize.toString());
      searchParams.append("offset", (pageParam * pageSize).toString());
      if (params.order) searchParams.append("order", params.order);
      if (params.attr) searchParams.append("attr", params.attr);
      if (params.value) searchParams.append("value", params.value);
      if (params.storeId) searchParams.append("storeId", params.storeId);
      if (params.categoryId) searchParams.append("categoryId", params.categoryId);

      const response = await apiFetch<Inventory[]>(`/api/inventory?${searchParams.toString()}`);
      return {
        statusCode: response.statusCode,
        data: response.data || [],
        countData: response.countData || 0,
        stats: response.stats || {},
      };
    },
    getNextPageParam: (lastPage, allPages) => {
      const totalFetched = allPages.reduce((acc, page) => acc + page.data.length, 0);
      return totalFetched < lastPage.countData ? allPages.length : undefined;
    },
    initialPageParam: 0,
  });
}

// Hook para crear un movimiento de inventario
export function useCreateMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateMovementParams) => {
      const response = await apiFetch<InventoryMovement>("/api/inventory-movements", {
        method: "POST",
        body: params,
      });
      return response;
    },
    onSuccess: () => {
      // Invalidar queries de inventario para refrescar stock
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-infinite"] });
      queryClient.invalidateQueries({ queryKey: ["movements"] });
    },
  });
}

// Hook para obtener KPIs financieros (ventas, compras, ganancias)
export function useMovementKpis(storeId?: string) {
  const searchParams = new URLSearchParams();
  if (storeId) searchParams.append("storeId", storeId);

  return useQuery<{ statusCode: number; data: MovementKpis }>({
    queryKey: ["movement-kpis", storeId],
    queryFn: async () => {
      const response = await apiFetch<MovementKpis>(
        `/api/inventory-movements/kpis?${searchParams.toString()}`
      );
      return {
        statusCode: response.statusCode,
        data: response.data!,
      };
    },
  });
}

// Hook para obtener movimientos con filtros generales (storeId, type, etc.)
export function useMovements(params: MovementQueryParams) {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.append("limit", params.limit.toString());
  if (params.offset !== undefined) searchParams.append("offset", params.offset.toString());
  if (params.order) searchParams.append("order", params.order);
  if (params.inventoryId) searchParams.append("inventoryId", params.inventoryId);
  if (params.type) searchParams.append("type", params.type);
  if (params.storeId) searchParams.append("storeId", params.storeId);

  return useQuery<MovementResponse>({
    queryKey: ["movements", params],
    queryFn: async () => {
      const response = await apiFetch<InventoryMovement[]>(
        `/api/inventory-movements?${searchParams.toString()}`
      );
      return {
        statusCode: response.statusCode,
        data: response.data || [],
        countData: response.countData || 0,
      };
    },
  });
}

// Hook para obtener movimientos de un inventario específico
export function useMovementsByInventory(inventoryId: string | null) {
  return useQuery<MovementResponse>({
    queryKey: ["movements", inventoryId],
    queryFn: async () => {
      const response = await apiFetch<InventoryMovement[]>(
        `/api/inventory-movements/inventory/${inventoryId}`
      );
      return {
        statusCode: response.statusCode,
        data: response.data || [],
        countData: response.countData || 0,
      };
    },
    enabled: !!inventoryId,
  });
}
