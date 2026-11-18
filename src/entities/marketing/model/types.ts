import type { AnuncioDeOrigen } from "@/entities/whatsapp/model/inbox-types";

// ------------------------------------------------------------ CRM de chats

export type Etapa = "nuevo" | "conversando" | "cotizado" | "pidio" | "compro" | "perdido";

export const ETAPAS: Etapa[] = ["nuevo", "conversando", "cotizado", "pidio", "compro", "perdido"];

export const ETAPA_INFO: Record<Etapa, { titulo: string; ayuda: string; punto: string }> = {
  nuevo: { titulo: "Nuevo", ayuda: "Escribió y nadie le respondió todavía", punto: "bg-sky-500" },
  conversando: { titulo: "Conversando", ayuda: "Ya le respondimos", punto: "bg-primary" },
  cotizado: { titulo: "Cotizado", ayuda: "Armó un carrito o tiene un pedido por confirmar", punto: "bg-amber-500" },
  pidio: { titulo: "Pidió", ayuda: "Tiene un pedido en curso", punto: "bg-violet-500" },
  compro: { titulo: "Compró", ayuda: "El pedido se completó", punto: "bg-emerald-600" },
  perdido: { titulo: "Perdido", ayuda: "Dejó de responder, canceló o no le interesó", punto: "bg-slate-400" },
};

export type MotivoPerdido = "inactividad" | "pedido_cancelado" | "otro_anuncio" | "no_interesa" | "precio" | "sin_stock" | "otro";

export const MOTIVO_PERDIDO: Record<MotivoPerdido, string> = {
  inactividad: "Dejó de responder",
  pedido_cancelado: "Canceló el pedido",
  otro_anuncio: "Volvió por otro anuncio",
  no_interesa: "No le interesó",
  precio: "Por el precio",
  sin_stock: "No había stock",
  otro: "Otro motivo",
};

/** Los que se eligen a mano al mover a Perdido. */
export const MOTIVOS_A_MANO: MotivoPerdido[] = ["no_interesa", "precio", "sin_stock", "otro"];

export interface Lead {
  id: string;
  etapa: Etapa;
  etapaManual: boolean;
  origen: "anuncio" | "organico" | "plantilla";
  anuncio: AnuncioDeOrigen | null;
  externalAdId: string | null;
  motivoPerdido: MotivoPerdido | null;
  valor: number | null;
  notas: string | null;
  responsable: { id: string; nombre: string } | null;
  abiertoAt: string;
  etapaAt: string;
  cerradoAt: string | null;
  ultimoEntranteAt: string | null;
  conversacion: {
    id: string;
    contactPhone: string;
    contactName: string | null;
    lastMessageText: string | null;
    lastMessageAt: string | null;
    unreadCount: number;
    aiPaused: boolean;
  };
  pedido: { id: string; numero: number | null; estado: string; total: number } | null;
  cliente: { id: string; nombre: string | null } | null;
}

export interface EventoLead {
  de: Etapa | null;
  a: Etapa;
  causa: string;
  at: string;
  usuario: string | null;
}

export const CAUSA_EVENTO: Record<string, string> = {
  mensaje_entrante: "Escribió",
  respuesta: "Le respondimos",
  carrito: "Armó un carrito",
  pedido_por_confirmar: "Pedido por confirmar",
  pedido_creado: "Hizo el pedido",
  pedido_completado: "Pedido completado",
  pedido_cancelado: "Canceló el pedido",
  inactividad: "Dejó de responder",
  reapertura: "Volvió a escribir",
  otro_anuncio: "Volvió por otro anuncio",
  manual: "Movido a mano",
};

export interface Embudo {
  personas: number;
  etapas: Record<Exclude<Etapa, "perdido">, number>;
  perdidos: number;
  abiertos: number;
  vendido: number;
}

// ------------------------------------------------------------ estimación e ideas

export interface Rango {
  min: number;
  medio: number;
  max: number;
}

export interface Supuesto extends Rango {
  origen: "tienda" | "referencia" | "mezcla";
  nota: string;
}

export interface Estimacion {
  inversion: number;
  conversaciones?: Rango;
  ventas: Rango;
  ingreso: Rango;
  roas: Rango;
  ganancia: Rango | null;
  roasEquilibrio?: number | null;
  costoPorVenta?: Rango | null;
  limitadoPorStock?: boolean;
  supuestos: string[];
}

export type TipoIdea = "estrella" | "stock_parado" | "novedad" | "combo" | "recuperar" | "reactivar" | "similares";

export interface Publico {
  tipo: "ubicacion" | "clientes" | "similares";
  descripcion?: string;
  ubicacion?: { nombre: string; lat: number; lng: number; radioKm: number } | null;
  paises?: string[];
  edadMin?: number;
  edadMax?: number;
  segmento?: "sin_compra" | "dormidos";
  personas?: number;
}

export interface Creativo {
  titulo: string;
  texto: string;
  imagen: string | null;
  saludo?: string;
  preguntas?: string[];
}

export interface ProductoIdea {
  id: string;
  nombre: string;
  precio: number;
  stock: number | null;
  imagen: string | null;
}

export interface Idea {
  tipo: TipoIdea;
  titulo: string;
  porque: string;
  objetivo: "conversaciones" | "ventas";
  canal: "ctwa" | "plantilla_wa";
  productos: ProductoIdea[];
  publico: Publico;
  creativo: Creativo;
  presupuestoDiario: number;
  dias: number;
  estimacion: Estimacion;
  bloqueo: string | null;
  avisos: string[];
  puntaje: number;
}

export interface Calibracion {
  costoConversacion: Supuesto;
  tasaVenta: Supuesto;
  tasaReactivacion: Supuesto;
  costoMensaje: number;
  tipoCambio: number;
  propio: { leadsDeAnuncios: number; compraron: number; gasto: number; conversaciones: number };
}

export interface RespuestaIdeas {
  ideas: Idea[];
  calibracion: Calibracion;
  tope: number;
  senales: {
    productos: number;
    conVentas: number;
    clientes: { conCompra: number; dormidos: number; conTelefono: number };
    sinCompra: number;
    diasFuertes: string[];
    horasFuertes: number[];
  };
}

// ------------------------------------------------------------ campañas

export type EstadoCampana = "borrador" | "publicando" | "pausada" | "activa" | "terminada" | "error" | "archivada";

export const ESTADO_CAMPANA: Record<EstadoCampana, { texto: string; variant: "success" | "info" | "secondary" | "outline" | "warning" | "destructive" }> = {
  borrador: { texto: "Borrador", variant: "outline" },
  publicando: { texto: "Creándose", variant: "info" },
  pausada: { texto: "En pausa", variant: "secondary" },
  activa: { texto: "Activa", variant: "success" },
  terminada: { texto: "Terminada", variant: "secondary" },
  error: { texto: "Con error", variant: "destructive" },
  archivada: { texto: "Archivada", variant: "secondary" },
};

export interface MetricasCampana {
  gasto: number;
  impresiones: number;
  clics: number;
  conversaciones: number;
  costoConversacion: number | null;
  personas: number;
  compraron: number;
  vendido: number;
  roas: number | null;
}

export interface Campana {
  id: string;
  nombre: string;
  estado: EstadoCampana;
  canal: "ctwa" | "plantilla_wa";
  objetivo: string;
  origen: "vendfy" | "importada";
  productos: ProductoIdea[];
  publico: Publico | null;
  creativo: Creativo | null;
  presupuestoDiario: number | null;
  dias: number | null;
  moneda: string;
  inicio: string | null;
  fin: string | null;
  idea: { tipo: TipoIdea; titulo: string; porque: string } | null;
  estimacion: (Estimacion & { calibracion?: Calibracion }) | null;
  externo: { campaignId: string | null; adIds: string[] };
  metricas: MetricasCampana;
  faltaParaPublicar: string[];
  ultimoSync: string | null;
  ultimoError: string | null;
  creadaAt: string;
}

export interface CampanaDetalle extends Campana {
  porDia: Array<{ fecha: string; gasto: number; impresiones: number; clics: number; conversaciones: number }>;
  anuncios: Array<{ id: string; nombre: string | null; gasto: number; conversaciones: number; personas: number; compraron: number }>;
}

export interface ResumenMarketing {
  dias: number;
  embudo: Embudo;
  anuncios: Embudo;
  gasto: number;
  vendidoPorAnuncios: number;
  roas: number | null;
  campanasActivas: number;
  avisos: Array<{ campanaId: string; campana: string; producto: string; stock: number | null }>;
}

export interface EntradaCampana {
  nombre?: string;
  desdeIdea?: { tipo: TipoIdea; productos: string[] };
  productos?: string[];
  publico?: Publico;
  creativo?: Partial<Creativo>;
  presupuestoDiario?: number;
  dias?: number;
}

/** Formato de plata del módulo. */
export function bs(n: number | null | undefined, moneda = "BOB"): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const s = new Intl.NumberFormat("es-BO", { maximumFractionDigits: n >= 100 ? 0 : 2, minimumFractionDigits: 0 }).format(n);
  return moneda === "USD" ? `US$ ${s}` : `Bs ${s}`;
}
