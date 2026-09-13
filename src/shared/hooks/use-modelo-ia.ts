import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/shared/api/client";

export type AiProviderId = "gemini" | "claude" | "openai";

export interface AiModelOption {
  id: string;
  label: string;
  hint: string;
}

export interface AiProviderStatus {
  id: AiProviderId;
  /** false cuando falta la API key en el servidor */
  available: boolean;
  defaultModel: string;
  models: AiModelOption[];
}

export interface ModeloIa {
  provider: AiProviderId;
  model: string;
}

const CLAVE = "vendfy:modelo-ia";

const NOMBRES: Record<AiProviderId, string> = {
  gemini: "Gemini (Google)",
  claude: "Claude (Anthropic)",
  openai: "GPT (OpenAI)",
};

export function nombreProveedor(id: AiProviderId) {
  return NOMBRES[id] ?? id;
}

function leerGuardado(): ModeloIa | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const guardado = JSON.parse(crudo);
    return guardado?.provider && guardado?.model ? guardado : null;
  } catch {
    return null;
  }
}

/**
 * Con qué IA genera contenido el panel.
 *
 * La elección es del usuario y vive en su navegador, no en la tienda: es una
 * preferencia de trabajo ("hoy pruebo con Gemini"), no una configuración del
 * negocio como el modelo del agente de WhatsApp, que sí es por tienda.
 *
 * El servidor manda sobre qué se puede elegir: si la clave del proveedor
 * guardado ya no está configurada, se ignora y vale el default del servidor.
 * Sin eso, un usuario que probó OpenAI hace un mes quedaría atrapado en un
 * proveedor muerto sin entender por qué falla.
 */
export function useModeloIa() {
  const { data, isLoading } = useQuery({
    queryKey: ["ai", "providers"],
    queryFn: async () => {
      const res = await apiFetch<{ default: AiProviderId; providers: AiProviderStatus[] }>(
        "/api/product/ai/providers",
      );
      return res.data;
    },
    // La lista cambia sólo si se toca el .env del servidor: no vale repreguntar.
    staleTime: Infinity,
  });

  const [guardado, setGuardado] = useState<ModeloIa | null>(() => leerGuardado());

  // Otra pestaña del panel puede haber cambiado el modelo.
  useEffect(() => {
    const alCambiar = (e: StorageEvent) => {
      if (e.key === CLAVE) setGuardado(leerGuardado());
    };
    window.addEventListener("storage", alCambiar);
    return () => window.removeEventListener("storage", alCambiar);
  }, []);

  const proveedores = data?.providers ?? [];
  const disponibles = proveedores.filter((p) => p.available);

  const elegidoSirve =
    guardado && disponibles.some((p) => p.id === guardado.provider);

  const porDefecto =
    disponibles.find((p) => p.id === data?.default) ?? disponibles[0];

  const modelo: ModeloIa | null = elegidoSirve
    ? guardado
    : porDefecto
      ? { provider: porDefecto.id, model: porDefecto.defaultModel }
      : null;

  const elegir = useCallback((siguiente: ModeloIa) => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(siguiente));
    } catch {
      // Modo incógnito o almacenamiento lleno: la elección vale para esta
      // pantalla igual, sólo no sobrevive a un refresco.
    }
    setGuardado(siguiente);
  }, []);

  return {
    /** Lo que hay que mandarle al backend; null = el servidor no tiene ninguna clave */
    modelo,
    proveedores,
    hayAlguno: disponibles.length > 0,
    cargando: isLoading,
    elegir,
  };
}
