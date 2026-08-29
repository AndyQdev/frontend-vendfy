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
  pixelId: string | null;
  /** Moneda de la cuenta publicitaria, en la que se reporta el gasto. */
  currency: string | null;
  scopes: string[] | null;
  expiresAt: string | null;
  lastError: string | null;
  lastSyncAt: string | null;
}

/** Un anuncio de la tienda y el producto que vende. */
export interface AdWithLink {
  id: string;
  nombre: string;
  campana?: string;
  estado?: string;
  /** Productos ya declarados. Vacío + revisado = anuncio de marca. */
  productos: string[];
  /** false = nadie lo definió todavía y el agente tiene que deducir. */
  revisado: boolean;
  /** Deducción automática del texto del anuncio, para preseleccionar. */
  sugeridos: { id: string; nombre: string }[];

  /** Lo que reporta la plataforma. */
  gasto: number;
  impresiones: number;
  clics: number;
  conversacionesMeta: number;

  /** Lo que sabemos nosotros y la plataforma no puede ver. */
  conversaciones: number;
  ventas: number;
  montoVendido: number;
  roas: number | null;
}

/** Producto vendible de una tienda, por su id de `store_product`. */
export interface StoreProductOption {
  id: string;
  nombre: string;
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

/**
 * Capacidades que la conexión habilita, y de qué depende cada una.
 *
 * Sirve para que el panel diga qué falta en vez de mostrar campos sueltos:
 * el comerciante no sabe qué es un dataset, sabe que quiere medir su web.
 */
export interface Capacidad {
  clave: "whatsapp" | "web" | "inversion";
  titulo: string;
  descripcion: string;
  listo: boolean;
  falta: string;
}

export function capacidadesDeMeta(c?: IntegrationConnection): Capacidad[] {
  const permisos = c?.scopes ?? [];
  const puedeLeerAnuncios =
    permisos.includes("ads_read") || permisos.includes("ads_management");

  return [
    {
      clave: "whatsapp",
      titulo: "Ventas por WhatsApp",
      descripcion:
        "Devuelve a Meta las compras cerradas en una conversación que empezó en un anuncio.",
      listo: Boolean(c?.datasetId),
      falta: "Falta elegir el conjunto de datos de mensajería.",
    },
    {
      clave: "web",
      titulo: "Visitas a la tienda web",
      descripcion:
        "Mide quién entra, qué mira y qué compra en tu tienda online, y arma públicos para volver a alcanzarlos.",
      listo: Boolean(c?.pixelId),
      falta: "Falta el pixel de la tienda web.",
    },
    {
      clave: "inversion",
      titulo: "Lectura de la inversión",
      descripcion:
        "Trae el gasto de cada anuncio para calcular el retorno real contra tus ventas.",
      listo: Boolean(c?.adAccountId) && puedeLeerAnuncios,
      falta: c?.adAccountId
        ? "Meta no otorgó permiso para leer anuncios. Reconectá la cuenta."
        : "Falta elegir la cuenta publicitaria.",
    },
  ];
}

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
