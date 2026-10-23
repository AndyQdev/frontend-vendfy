export interface Store {
  id: string;
  name: string;
  slug: string;
  description?: string;
  config?: StoreConfig;
  created_at: string;
  updated_at: string;
  enabled: boolean;
}

export interface StoreConfig {
  branding?: {
    logoUrl?: string;
    bannerUrl?: string;
    faviconUrl?: string;
    colorTheme?: string;
    heroTitle?: string;
  };
  contact?: {
    phone?: string;
    currentCountry?: string;
    email?: string;
    address?: string;
    city?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  socialMedia?: {
    facebookUrl?: string;
    instagramUrl?: string;
  };
  delivery?: {
    type: 'pending' | 'free' | 'fixed' | 'calculated';
    value: number;
  };
  aboutUs?: string;
  features?: object;
  category?: string;
  themeId?: string;
  currency?: string;
  /**
   * La web propia del comerciante, si se la armo con el MCP. Conviven: esta es
   * la que ensena, y la de Vendfy sigue siendo donde viven el Modo Live y el
   * seguimiento de pedidos.
   */
  storefront?: {
    url?: string;
  };
  /** De dónde sale el dólar para comprar y cobrar en dólares. Sin elegir: BCB. */
  exchangeRate?: {
    source?: "bcb" | "binance";
  };
  /**
   * Cómo se ve la tienda con un tema personalizable (Vitrina): paleta,
   * tipografía, animaciones y las secciones de la portada. La tienda la valida
   * entera al leerla (client-frontend/lib/tienda/apariencia.ts), así que acá
   * todo es opcional.
   */
  apariencia?: AparienciaGuardada;
}

export interface DiapositivaGuardada {
  imagen: string;
  imagenMovil?: string;
  /** Hacia dónde se recorta, en % del ancho y del alto. Sin él, el centro. */
  enfoque?: { x: number; y: number };
  /** Entra entera, sin recortar (un flyer con texto en los bordes). */
  completa?: boolean;
  /**
   * Lo mismo en el celular. Sin `imagenMovil`, el celular hereda el encuadre
   * de la principal y estos solo pisan lo que se cambió en la vista Celular.
   */
  enfoqueMovil?: { x: number; y: number };
  completaMovil?: boolean;
  titulo?: string;
  texto?: string;
  boton?: string;
  /** 'catalogo' o 'categoria:<id>'. */
  destino?: string;
}

export interface SeccionGuardada {
  tipo: string;
  activa: boolean;
  variante: string;
  fondo: string;
}

export interface AparienciaGuardada {
  paleta?: string;
  tipografia?: string;
  esquinas?: string;
  cabecera?: string;
  entrada?: string;
  hover?: string;
  /** 'normal' o 'foto': la foto del producto viaja de la tarjeta al detalle. */
  entrePaginas?: string;
  /** 'ninguna', 'grano' o 'puntos': textura sobre el fondo de las secciones. */
  textura?: string;
  anuncio?: { activo?: boolean; texto?: string; variante?: string };
  secciones?: SeccionGuardada[];
  portada?: {
    diapositivas?: DiapositivaGuardada[];
    intervalo?: number;
    transicion?: string;
    flechas?: boolean;
    puntos?: boolean;
    altura?: string;
    oscurecer?: string;
    alineacion?: string;
  };
}
