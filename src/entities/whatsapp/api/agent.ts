import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/shared/api/client";

export type AgentProviderId = "gemini" | "claude" | "openai";

export interface AgentModelOption {
  id: string;
  label: string;
  hint: string;
}

export interface AgentProviderStatus {
  id: AgentProviderId;
  available: boolean;
  defaultModel: string;
  models: AgentModelOption[];
}

export interface AgentConfig {
  enabled: boolean;
  provider: AgentProviderId;
  model: string | null;
  instructions: string;
  providers: AgentProviderStatus[];
}

export function useAgentConfig(storeId: string | undefined) {
  return useQuery<AgentConfig>({
    queryKey: ["agent-config", storeId],
    queryFn: async () => {
      const res = await apiFetch<AgentConfig>(`/api/agent/config/${storeId}`);
      return res.data!;
    },
    enabled: !!storeId,
  });
}

export interface AgentUsage {
  conversaciones: number;
  turnos: number;
  inputTokens: number;
  outputTokens: number;
  pedidos: number;
  ultimoProveedor: string | null;
  ultimoModelo: string | null;
  pruebaTurnos: number;
}

export function useAgentUsage(storeId: string | undefined) {
  return useQuery<AgentUsage>({
    queryKey: ["agent-usage", storeId],
    queryFn: async () => {
      const res = await apiFetch<AgentUsage>(`/api/agent/usage/${storeId}`);
      return res.data!;
    },
    enabled: !!storeId,
  });
}

export function useUpdateAgentConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      storeId: string;
      enabled?: boolean;
      provider?: AgentProviderId;
      model?: string | null;
      instructions?: string;
    }) => {
      const { storeId, ...body } = vars;
      const res = await apiFetch(`/api/agent/config/${storeId}`, {
        method: "PATCH",
        body,
      });
      return res.data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["agent-config", vars.storeId] });
    },
    onError: (error: Error) => {
      toast.error(
        error instanceof ApiError ? error.message : "No se pudo guardar la configuración",
      );
    },
  });
}
