import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/shared/api/client";
import type { Review, ReviewInput } from "../model/types";

export function useStoreReviews(storeId?: string, productId?: string) {
  const queryParams = new URLSearchParams();
  if (productId) queryParams.append("productId", productId);

  return useQuery<Review[]>({
    queryKey: ["reviews", storeId, productId ?? null],
    queryFn: async () => {
      const response = await apiFetch<Review[]>(
        `/api/review/admin/store/${storeId}?${queryParams.toString()}`
      );
      return response.data || [];
    },
    enabled: !!storeId,
  });
}

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ReviewInput) => {
      const response = await apiFetch<Review>("/api/review", {
        method: "POST",
        body: data,
      });
      return response.data as Review;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviews"] }),
  });
}

export function useUpdateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ReviewInput> }) => {
      const response = await apiFetch<Review>(`/api/review/${id}`, {
        method: "PATCH",
        body: data,
      });
      return response.data as Review;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviews"] }),
  });
}

export function useDeleteReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/api/review/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviews"] }),
  });
}

export async function uploadReviewImage(file: File): Promise<{ url: string; path: string }> {
  const formData = new FormData();
  formData.append("image", file);

  const response = await apiFetch<{ url: string; path: string }>(
    "/api/review/upload-image",
    { method: "POST", body: formData }
  );

  if (response.data?.url && response.data?.path) {
    return { url: response.data.url, path: response.data.path };
  }

  throw new Error("Error al subir la imagen");
}

export async function deleteReviewImage(path: string): Promise<void> {
  await apiFetch("/api/review/delete-image", {
    method: "POST",
    body: { path },
  });
}
