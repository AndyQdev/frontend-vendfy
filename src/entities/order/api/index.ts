import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/shared/api/client";
import { toast } from "sonner";
import type { Order, OrdersResponse, OrderQueryParams, CreateOrderInput } from "../model/types";

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

  return useQuery<OrdersResponse>({
    queryKey: ["orders", params],
    queryFn: async () => {
      const response = await apiFetch<Order[]>(`/api/order?${queryParams.toString()}`);
      return {
        statusCode: response.statusCode,
        data: response.data || [],
        countData: response.countData || 0
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