import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/shared/api/client";
import type { Customer, CustomersResponse, CustomerQueryParams, CreateCustomerInput } from "../model/types";

export function useCustomers(params: CustomerQueryParams = {}) {
  const queryParams = new URLSearchParams();
  
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.offset) queryParams.append('offset', params.offset.toString());
  if (params.order) queryParams.append('order', params.order);
  if (params.attr && params.value) {
    queryParams.append('attr', params.attr);
    queryParams.append('value', params.value);
  }

  return useQuery<CustomersResponse>({
    queryKey: ["customers", params],
    queryFn: async () => {
      const response = await apiFetch<Customer[]>(`/api/customer?${queryParams.toString()}`);
      return {
        statusCode: response.statusCode,
        data: response.data || [],
        countData: response.countData || 0
      };
    }
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCustomerInput) => {
      const response = await apiFetch<Customer>('/api/customer', {
        method: 'POST',
        body: data,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateCustomerInput> }) => {
      const response = await apiFetch<Customer>(`/api/customer/${id}`, {
        method: 'PATCH',
        body: data,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

export function useAddCustomerAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ customerId, address }: { customerId: string; address: { name: string; latitude: number; longitude: number } }) => {
      const response = await apiFetch<Customer>(`/api/customer/${customerId}/address`, {
        method: 'PATCH',
        body: address,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/customer/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}
