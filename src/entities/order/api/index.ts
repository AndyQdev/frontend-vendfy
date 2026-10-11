import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/shared/api/client";
import { toast } from "sonner";
import type { Order, OrdersResponse, OrderQueryParams, CreateOrderInput } from "../model/types";
import { markOnboardingStep, ONBOARDING_STEPS } from "@/entities/user/api/onboarding";

export function useOrders(params: OrderQueryParams = {}) {
  const queryParams = new URLSearchParams();
  
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.offset) queryParams.append('offset', params.offset.toString());
  if (params.order) queryParams.append('order', params.order);
  if (params.storeId) queryParams.append('storeId', params.storeId);
  if (params.dateFilter) queryParams.append('dateFilter', params.dateFilter);
  if (params.attr && params.value) {
    queryParams.append('attr', params.attr);
    queryParams.append('value', params.value);
  }
  if (params.status) queryParams.append('status', params.status);
  if (params.productId) queryParams.append('productId', params.productId);

  return useQuery<OrdersResponse>({
    queryKey: ["orders", params],
    queryFn: async () => {
      const response = await apiFetch<Order[]>(`/api/order?${queryParams.toString()}`);
      return {
        statusCode: response.statusCode,
        data: response.data || [],
        countData: response.countData || 0,
        ...(response.stats ? { stats: response.stats } : {}),
      };
    }
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateOrderInput) => {
      const response = await apiFetch<Order>('/api/order', {
        method: 'POST',
        body: data,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      markOnboardingStep(ONBOARDING_STEPS.FIRST_SALE);
    },
    onError: (error: Error) => {
      // Mostrar el mensaje de error del backend automáticamente
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error("Error al crear la orden");
      }
      console.error('Error creating order:', error);
    },
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateOrderInput> }) => {
      const response = await apiFetch<Order>(`/api/order/${id}`, {
        method: 'PATCH',
        body: data,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error("Error al actualizar la orden");
      }
      console.error('Error updating order:', error);
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/order/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error: Error) => {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error("Error al eliminar la orden");
      }
      console.error('Error deleting order:', error);
    },
  });
}
/**
 * Cuántos pedidos esperan que alguien los atienda: los "por confirmar" (sin
 * stock, a pedido) y los "pendientes" (recién entrados). Es el contador rojo de
 * la ruta Pedidos en el header.
 *
 * Pide una sola fila de cada estado: lo único que importa es `countData`, el
 * total que devuelve el servidor para la paginación. Se refresca cada minuto y
 * al volver a la pestaña, que es cuando uno espera ver lo nuevo.
 */
export function usePendingOrdersCount(storeId: string | undefined) {
  return useQuery<number>({
    queryKey: ["orders", "pending-count", storeId ?? "all"],
    queryFn: async () => {
      const contar = async (status: string) => {
        const params = new URLSearchParams({ limit: "1", status });
        if (storeId) params.append("storeId", storeId);
        const response = await apiFetch<Order[]>(`/api/order?${params.toString()}`);
        return response.countData || 0;
      };
      const [porConfirmar, pendientes] = await Promise.all([
        contar("por-confirmar"),
        contar("pendiente"),
      ]);
      return porConfirmar + pendientes;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}
