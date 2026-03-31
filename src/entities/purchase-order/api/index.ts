import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/shared/api/client";
import type {
  PurchaseOrder,
  CreatePurchaseOrderInput,
  PurchaseOrderQueryParams,
} from "../model/types";

export function usePurchaseOrders(params: PurchaseOrderQueryParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.append("limit", params.limit.toString());
  if (params.offset !== undefined) searchParams.append("offset", params.offset.toString());
  if (params.order) searchParams.append("order", params.order);
  if (params.storeId) searchParams.append("storeId", params.storeId);
  if (params.status) searchParams.append("status", params.status);

  return useQuery<{ data: PurchaseOrder[]; countData: number }>({
    queryKey: ["purchase-orders", params],
    queryFn: async () => {
      const response = await apiFetch<PurchaseOrder[]>(
        `/api/purchase-order?${searchParams.toString()}`
      );
      return {
        data: response.data || [],
        countData: response.countData || 0,
      };
    },
  });
}

export function usePurchaseOrder(id?: string) {
  return useQuery<PurchaseOrder>({
    queryKey: ["purchase-order", id],
    queryFn: async () => {
      const response = await apiFetch<PurchaseOrder>(`/api/purchase-order/${id}`);
      return response.data as PurchaseOrder;
    },
    enabled: !!id,
  });
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePurchaseOrderInput) => {
      const response = await apiFetch<PurchaseOrder>("/api/purchase-order", {
        method: "POST",
        body: data,
      });
      return response.data as PurchaseOrder;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });
}

export function useConfirmPurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiFetch<PurchaseOrder>(
        `/api/purchase-order/${id}/confirm`,
        { method: "PATCH" }
      );
      return response.data as PurchaseOrder;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["purchase-order"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["movement-kpis"] });
    },
  });
}

export function useCancelPurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiFetch<PurchaseOrder>(
        `/api/purchase-order/${id}/cancel`,
        { method: "PATCH" }
      );
      return response.data as PurchaseOrder;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["purchase-order"] });
    },
  });
}

export function useDeletePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/purchase-order/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });
}
