import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/shared/api/client";
import type {
  AdAccount,
  IntegrationConnection,
  IntegrationProvider,
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

export function useConfigureIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      storeId,
      provider,
      adAccountId,
      datasetId,
    }: {
      storeId: string;
      provider: IntegrationProvider;
      adAccountId?: string;
      datasetId?: string;
    }) => {
      const res = await apiFetch<IntegrationConnection>(
        `/api/integrations/${provider}`,
        { method: "PATCH", body: { storeId, adAccountId, datasetId } }
      );
      return res.data as IntegrationConnection;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
