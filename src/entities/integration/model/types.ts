/** Plataformas externas de publicidad y contenido. */
export type IntegrationProvider = "meta" | "tiktok" | "google";

export type IntegrationStatus =
  | "pending"
  | "connected"
  | "expired"
  | "revoked"
  | "error";

/**
 * Conexión de una tienda con una plataforma externa.
 * El backend nunca devuelve tokens: solo el estado y lo que hace falta mostrar.
 */
export interface IntegrationConnection {
  id: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  externalAccountName: string | null;
  adAccountId: string | null;
  datasetId: string | null;
  scopes: string[] | null;
  expiresAt: string | null;
  lastError: string | null;
  lastSyncAt: string | null;
}

export interface AdAccount {
  id: string;
  name: string;
  currency: string;
}

/** Metadatos de presentación de cada plataforma. */
export const PROVIDER_META: Record<
  IntegrationProvider,
  { label: string; description: string; disponible: boolean }
> = {
  meta: {
    label: "Meta",
    description: "Facebook e Instagram · campañas, catálogo y conversiones",
    disponible: true,
  },
  tiktok: {
    label: "TikTok",
    description: "Anuncios, contenido y eventos de conversión",
    disponible: false,
  },
  google: {
    label: "Google Ads",
    description: "Campañas de búsqueda y display",
    disponible: false,
  },
};

export const STATUS_META: Record<
  IntegrationStatus,
  { label: string; tone: "ok" | "warn" | "error" | "muted" }
> = {
  connected: { label: "Conectado", tone: "ok" },
  pending: { label: "Sin completar", tone: "muted" },
  expired: { label: "Sesión vencida", tone: "warn" },
  revoked: { label: "Desconectado", tone: "muted" },
  error: { label: "Con error", tone: "error" },
};
