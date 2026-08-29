import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/shared/api/client";
import type {
  AdAccount,
  AdWithLink,
  IntegrationConnection,
  IntegrationProvider,
  StoreProductOption,
} from "../model/types";

const KEY = "integrations";

export function useIntegrations(storeId?: string) {
  return useQuery<IntegrationConnection[]>({
    queryKey: [KEY, storeId],
    queryFn: async () => {
      const res = await apiFetch<IntegrationConnection[]>(
        `/api/integrations?storeId=${storeId}`
      );
      return res.data || [];
    },
    enabled: !!storeId,
  });
}

/**
 * Pide la URL de autorización y manda el navegador a Meta.
 * No se invalida caché: la vuelta la maneja el callback del backend, que
 * redirige al panel con el resultado en la query.
 */
export function useAuthorizeIntegration() {
  return useMutation({
    mutationFn: async ({
      storeId,
      provider,
    }: {
      storeId: string;
      provider: IntegrationProvider;
    }) => {
      const res = await apiFetch<{ authorizationUrl: string }>(
        `/api/integrations/${provider}/authorize`,
        { method: "POST", body: { storeId } }
      );
      return res.data?.authorizationUrl as string;
    },
  });
}

export function useDisconnectIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      storeId,
      provider,
    }: {
      storeId: string;
      provider: IntegrationProvider;
    }) => {
      await apiFetch(`/api/integrations/${provider}?storeId=${storeId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useAdAccounts(storeId?: string, enabled = false) {
  return useQuery<AdAccount[]>({
    queryKey: [KEY, "ad-accounts", storeId],
    queryFn: async () => {
      const res = await apiFetch<AdAccount[]>(
        `/api/integrations/meta/ad-accounts?storeId=${storeId}`
      );
      return res.data || [];
    },
    enabled: !!storeId && enabled,
  });
}

/**
 * Anuncios de la tienda con el producto que vende cada uno.
 * Solo tiene sentido con Meta conectado: sin token la llamada falla.
 */
export function useAds(storeId?: string, enabled = false) {
  return useQuery<AdWithLink[]>({
    queryKey: [KEY, "ads", storeId],
    queryFn: async () => {
      const res = await apiFetch<AdWithLink[]>(
        `/api/integrations/meta/ads?storeId=${storeId}`
      );
      return res.data || [];
    },
    enabled: !!storeId && enabled,
  });
}

/**
 * Productos vendibles de la tienda, identificados por su id de `store_product`
 * — que es el que referencia el enlace del anuncio, no el id del producto.
 */
export function useStoreProducts(storeId?: string, enabled = false) {
  return useQuery<StoreProductOption[]>({
    queryKey: ["store-products", storeId],
    queryFn: async () => {
      const res = await apiFetch<any[]>(
        `/api/product/store/${storeId}?limit=500`
      );
      return (res.data || [])
        .filter((i) => i?.storeProductId && i?.product?.name)
        .map((i) => ({ id: i.storeProductId, nombre: i.product.name }));
    },
    enabled: !!storeId && enabled,
  });
}

export function useLinkAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      storeId,
      adId,
      adName,
      storeProductIds,
    }: {
      storeId: string;
      adId: string;
      adName?: string;
      storeProductIds: string[];
    }) => {
      await apiFetch(`/api/integrations/meta/ads/${adId}/link`, {
        method: "PUT",
        body: { storeId, adName, storeProductIds },
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, "ads"] }),
  });
}

export function useConfigureIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      storeId,
      provider,
      adAccountId,
      datasetId,
      pixelId,
    }: {
      storeId: string;
      provider: IntegrationProvider;
      adAccountId?: string;
      datasetId?: string;
      pixelId?: string;
    }) => {
      const res = await apiFetch<IntegrationConnection>(
        `/api/integrations/${provider}`,
        { method: "PATCH", body: { storeId, adAccountId, datasetId, pixelId } }
      );
      return res.data as IntegrationConnection;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
