/** Lo que el agente de ventas sabe de la tienda y cómo se prueba (espejo de src/agent/conocimiento en el backend). */

export interface PreguntaFrecuente {
  pregunta: string;
  respuesta: string;
}

export interface FichaTienda {
  envios?: string;
  pagos?: string;
  cambios?: string;
  tiendaFisica?: string;
  regalo?: string;
  otros?: string;
  preguntas?: PreguntaFrecuente[];
}

export type Registro = "tu" | "usted" | "vos";

export interface VozTienda {
  registro?: Registro;
  ejemplos?: string;
}

export interface DerivacionTienda {
  responsable?: string;
  horario?: string;
}

export type OrigenProducto = "original" | "decant_original" | "inspirado" | "marca_propia";

export const ORIGEN_ETIQUETA: Record<OrigenProducto, string> = {
  original: "Original de la marca",
  decant_original: "Decant de un frasco original",
  inspirado: "Inspirado en otra fragancia",
  marca_propia: "Marca propia",
};

export interface FichaProducto {
  estado: "borrador" | "verificado";
  origen?: OrigenProducto;
  marcaOrigen?: string;
  inspiradoEn?: string;
  familia?: string;
  notasSalida?: string[];
  notasCorazon?: string[];
  notasFondo?: string[];
  ocasion?: string;
  temporada?: string;
  perfil?: string;
  genero?: string;
  duracion?: string;
  lineaValor?: string;
  descripcionCotidiana?: string;
  atributos?: Record<string, string>;
  fuentes?: string[];
  confianza?: "alta" | "media" | "baja";
  generadoAt?: string;
  aprobadoAt?: string;
}

export interface ProductoDelConocimiento {
  storeProductId: string;
  productId: string;
  nombre: string;
  categoria: string;
  precio: number;
  anunciado: boolean;
  ficha: FichaProducto | null;
}

export interface ItemPreparacion {
  id: string;
  titulo: string;
  ok: boolean;
  detalle: string;
}

export interface Conocimiento {
  rubro: string | null;
  paquete: { id: string; nombre: string };
  ficha: FichaTienda;
  voz: VozTienda;
  derivacion: DerivacionTienda;
  productos: ProductoDelConocimiento[];
  preguntasPendientes: number;
  preparacion: ItemPreparacion[];
  generando: { total: number; hechos: number; errores: number; empezo: string } | null;
}

export interface PreguntaSinRespuesta {
  id: string;
  pregunta: string;
  respuesta: string | null;
  estado: "pendiente" | "respondida" | "descartada";
  veces: number;
  ultimaAt: string;
}

export interface EscenarioResumen {
  id: string;
  titulo: string;
  tipo: "compra" | "objecion" | "seguridad";
  critico: boolean;
  pasadas: number;
  total: number;
  siempre: boolean;
  fallas: string[];
  comentarios: string[];
}

export interface ResumenPrueba {
  aprobada: boolean;
  puntaje: string;
  criterio: string;
  criticosOk: boolean;
  passK: number;
  repeticiones: number;
  usarBorradores?: boolean;
  proveedor: string | null;
  modelo: string | null;
  latencia: { medianaMs: number; p90Ms: number };
  correcciones: number;
  juez: { natural: number | null; responde: number | null; honesto: number | null; vende: number | null };
  porEscenario: EscenarioResumen[];
  duracionMs: number;
}

export interface CorridaPrueba {
  id: string;
  estado: "corriendo" | "lista" | "error";
  proveedor: string | null;
  modelo: string | null;
  resumen: ResumenPrueba | null;
  error: string | null;
  created_at: string;
  terminado_at: string | null;
}

export interface TurnoPrueba {
  cliente: string;
  agente: { texto: string; botones?: string[]; lista?: string[] }[];
  ms: number;
  derivado: boolean;
}

export interface ConversacionPrueba {
  escenario: string;
  repeticion: number;
  turnos: TurnoPrueba[];
  chequeos: { id: string; ok: boolean; detalle?: string }[];
  juicio: { natural: boolean; responde: boolean; honesto: boolean; vende: boolean | null; comentario: string } | null;
  pasa: boolean;
  error?: string;
}

export interface CorridaDetalle extends CorridaPrueba {
  detalle: { conversaciones: ConversacionPrueba[] } | null;
}
