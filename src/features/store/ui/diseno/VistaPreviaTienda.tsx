import { useEffect, useRef, useState } from "react";
import { Clock, ExternalLink, Home, Monitor, Smartphone, Tablet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import type { AparienciaGuardada } from "@/entities/store/model/types";
import { URL_TIENDA } from "../../model/catalogo-temas";

/**
 * La tienda en un iframe, con lo que el comerciante va eligiendo aplicado
 * antes de guardar.
 *
 * El protocolo (client-frontend/components/apariencia/ContextoApariencia.tsx):
 * la tienda avisa `vendfy:vista-previa-lista` cuando ya escucha y recién ahí
 * se le manda el borrador; después, en cada cambio. Mandarlo al cargar el
 * iframe no sirve: llegaría antes de que la página escuche y se perdería.
 *
 * La vista previa se navega como la tienda: el borrador y el tema elegido
 * siguen en cada página (client-frontend/lib/tienda/vista-previa.ts), cada
 * página nueva vuelve a avisar "lista" y recibe el borrador, y además avisa
 * `vendfy:ruta` para mostrar acá dónde está.
 *
 * "Mostrame dónde cambia" (client-frontend/components/apariencia/GuiaVistaPrevia.tsx):
 * con cada cambio el panel pide `vendfy:enfocar` y la vista previa baja hasta
 * lo que cambió y lo marca; si no está en la página, contesta `vendfy:no-esta`.
 */

const MENSAJE_LISTA = "vendfy:vista-previa-lista";
const MENSAJE_APARIENCIA = "vendfy:apariencia";
const MENSAJE_RUTA = "vendfy:ruta";
const MENSAJE_ENFOCAR = "vendfy:enfocar";
const MENSAJE_NO_ESTA = "vendfy:no-esta";

/**
 * Lo que la vista previa tiene que mostrar. `destino`: el tipo de una sección,
 * `cabecera`, `tarjetas` o vacío (solo el aviso). `clave`
 * cambia en cada pedido, aunque se repita el destino.
 */
export interface FocoVistaPrevia {
  destino: string;
  /** Cómo se llama para el comerciante, por si no está en la página. */
  nombre?: string;
  aviso?: string;
  clave: number;
}

/** La página de la tienda que se está viendo, o null si es la portada. */
function nombreDePagina(ruta: string, slug: string): string | null {
  const resto = ruta.slice(`/${slug}`.length).replace(/\/$/, "");
  if (!resto) return null;
  if (resto.startsWith("/productos/")) return "Un producto";
  if (resto.startsWith("/checkout")) return "El checkout";
  if (resto.startsWith("/pedido/")) return "El seguimiento de un pedido";
  if (resto.startsWith("/live/")) return "Un Live";
  return "Otra página";
}
const ORIGEN_TIENDA = new URL(URL_TIENDA).origin;

/**
 * Cada dispositivo se dibuja a su ancho real y se achica para entrar en la
 * columna. Con el iframe al ancho de la columna, "Computadora" mostraba la
 * versión de celular: la tienda cambia de diseño según el ancho.
 */
const DISPOSITIVOS = [
  { id: "escritorio", nombre: "Computadora", icono: Monitor, ancho: 1280, alto: 860 },
  { id: "tableta", nombre: "Tablet", icono: Tablet, ancho: 768, alto: 1024 },
  { id: "movil", nombre: "Celular", icono: Smartphone, ancho: 390, alto: 844 },
] as const;

export type Dispositivo = (typeof DISPOSITIVOS)[number]["id"];

export function VistaPreviaTienda({
  slug,
  themeId,
  apariencia,
  foco,
  onMenosMovimiento,
  dispositivo: elegido,
  onDispositivo,
  plantilla,
}: {
  /** El nombre de la plantilla, para el pie. */
  plantilla?: string;
  slug: string;
  themeId: string;
  apariencia: AparienciaGuardada | undefined;
  foco?: FocoVistaPrevia | null;
  /** Si la computadora pide menos movimiento: la tienda no anima nada. */
  onMenosMovimiento?: (menos: boolean) => void;
  /** Lo lleva el editor, que muestra las imágenes de la portada en la misma pantalla. */
  dispositivo?: Dispositivo;
  onDispositivo?: (dispositivo: Dispositivo) => void;
}) {
  const [propio, setPropio] = useState<Dispositivo>("escritorio");
  const dispositivo = elegido ?? propio;
  const setDispositivo = onDispositivo ?? setPropio;
  const [ruta, setRuta] = useState<string | null>(null);
  // Para el listener de mensajes, que se arma una sola vez.
  const rutaActual = useRef<string | null>(null);
  const slugActual = useRef(slug);
  slugActual.current = slug;
  // Sube para volver a cargar la portada ("Volver al inicio").
  const [recarga, setRecarga] = useState(0);
  const iframe = useRef<HTMLIFrameElement>(null);
  const lista = useRef(false);
  const ultima = useRef(apariencia);
  ultima.current = apariencia;
  const ultimoFoco = useRef(foco);
  ultimoFoco.current = foco;
  const avisarMovimiento = useRef(onMenosMovimiento);
  avisarMovimiento.current = onMenosMovimiento;

  const enviada = useRef<string | null>(null);
  const enviar = (a: AparienciaGuardada | undefined, aunqueSeaIgual = false) => {
    if (!lista.current) return;
    // El panel re-renderiza por cualquier cosa; la tienda solo se repinta si
    // la apariencia cambió de verdad.
    const json = JSON.stringify(a ?? {});
    if (!aunqueSeaIgual && json === enviada.current) return;
    enviada.current = json;
    iframe.current?.contentWindow?.postMessage({ tipo: MENSAJE_APARIENCIA, apariencia: a ?? {} }, ORIGEN_TIENDA);
  };

  useEffect(() => {
    const alRecibir = (e: MessageEvent) => {
      if (e.origin !== ORIGEN_TIENDA || e.source !== iframe.current?.contentWindow) return;
      if (e.data?.tipo === MENSAJE_RUTA && typeof e.data.ruta === "string") {
        rutaActual.current = e.data.ruta;
        setRuta(e.data.ruta);
        return;
      }
      if (e.data?.tipo === MENSAJE_NO_ESTA) {
        const nombre = ultimoFoco.current?.nombre ?? "Eso";
        const enOtraPagina = rutaActual.current && nombreDePagina(rutaActual.current, slugActual.current);
        toast.info(
          enOtraPagina
            ? `${nombre} está en el inicio de la tienda: toca "Volver al inicio" para verlo.`
            : `${nombre} no aparece en tu tienda: una sección sin datos no se muestra (por ejemplo, Destacados sin productos destacados).`,
        );
        return;
      }
      if (e.data?.tipo !== MENSAJE_LISTA) return;
      if (typeof e.data.menosMovimiento === "boolean") avisarMovimiento.current?.(e.data.menosMovimiento);
      lista.current = true;
      // Un iframe recién cargado no tiene nada: se manda aunque sea lo mismo.
      enviar(ultima.current, true);
    };
    window.addEventListener("message", alRecibir);
    return () => window.removeEventListener("message", alRecibir);
  }, []);

  // Después del borrador (que sale a los 120 ms): para enfocar, lo nuevo
  // tiene que estar dibujado. Si llegan varios seguidos, vale el último.
  useEffect(() => {
    if (!foco) return;
    const t = setTimeout(() => {
      if (!lista.current) return;
      const mensaje = { tipo: MENSAJE_ENFOCAR, destino: foco.destino, aviso: foco.aviso };
      iframe.current?.contentWindow?.postMessage(mensaje, ORIGEN_TIENDA);
    }, 400);
    return () => clearTimeout(t);
  }, [foco]);

  // Cada cambio, con un respiro: escribir un título no manda un mensaje por letra.
  useEffect(() => {
    const t = setTimeout(() => enviar(apariencia), 120);
    return () => clearTimeout(t);
  }, [apariencia]);

  // Otro tema, otro tamaño o volver al inicio recargan el iframe: hay que
  // esperar el nuevo "lista".
  useEffect(() => {
    lista.current = false;
    rutaActual.current = null;
    setRuta(null);
  }, [themeId, dispositivo, recarga]);

  const pagina = ruta ? nombreDePagina(ruta, slug) : null;

  const { ancho, alto } = DISPOSITIVOS.find((d) => d.id === dispositivo)!;

  // El lugar disponible, para calcular cuánto achicar.
  const marco = useRef<HTMLDivElement>(null);
  const [lugar, setLugar] = useState({ ancho: 0, alto: 0, llena: false });
  useEffect(() => {
    const el = marco.current;
    if (!el) return;
    // En pantallas grandes la columna tiene el alto de la ventana y el marco
    // ocupa lo que queda (`xl:flex-1`): se mide él. Más angosto, el marco toma
    // el alto que se le da acá, con lo que queda de la ventana bajo la barra.
    const medir = () => {
      const llena = window.matchMedia("(min-width: 1280px)").matches;
      setLugar({ ancho: el.clientWidth, alto: llena ? el.clientHeight : Math.max(480, window.innerHeight - 160), llena });
    };
    window.addEventListener("resize", medir);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => {
      obs.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, []);
  // Achica para que entre a lo ancho y a lo alto: con una pantalla "real" de
  // alto, la portada a pantalla completa se ve como en el dispositivo (más
  // alto, la portada medía lo que midiera el iframe).
  const MARGEN = 32;
  const escala = lugar.ancho ? Math.max(0.1, Math.min(1, (lugar.ancho - MARGEN) / ancho, (lugar.alto - MARGEN) / alto)) : 1;
  const altoReal = alto;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold">Vista previa de tu tienda</p>
          <p className="text-xs text-muted-foreground">Así verán tus clientes los cambios. Desde acá no se hacen pedidos.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
            <a href={`${URL_TIENDA}/${slug}`} target="_blank" rel="noopener noreferrer" title="Tu tienda publicada, en otra pestaña (sin lo que todavía no guardaste)">
              <ExternalLink className="h-3.5 w-3.5" /> Ver tienda
            </a>
          </Button>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1">
            {DISPOSITIVOS.map((d) => (
              <Button
                key={d.id}
                type="button"
                variant={dispositivo === d.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setDispositivo(d.id)}
                className="h-7 px-2.5"
                aria-label={d.nombre}
                aria-pressed={dispositivo === d.id}
                title={d.nombre}
              >
                <d.icono className="h-4 w-4" />
              </Button>
            ))}
          </div>
        </div>
      </div>

      {pagina && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs">
          <span className="text-muted-foreground">
            Estás viendo: <span className="font-medium text-foreground">{pagina}</span>
          </span>
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={() => setRecarga((n) => n + 1)}>
            <Home className="h-3.5 w-3.5" /> Volver al inicio
          </Button>
        </div>
      )}

      <div
        ref={marco}
        className="relative overflow-hidden rounded-xl border border-border bg-muted/60 xl:min-h-0 xl:flex-1"
        style={lugar.llena ? undefined : { height: Math.round(alto * escala) + MARGEN }}
      >
        {/* Ancho real del dispositivo, achicado con transform desde arriba al centro. */}
        <div
          className="absolute left-1/2 origin-top"
          style={{ top: MARGEN / 2, width: ancho, height: altoReal, transform: `translateX(-50%) scale(${escala})` }}
        >
          <iframe
            ref={iframe}
            key={`${themeId}-${dispositivo}-${recarga}`}
            src={`${URL_TIENDA}/${slug}?theme=${encodeURIComponent(themeId)}&preview=true`}
            title="Vista previa de la tienda"
            className="h-full w-full rounded-lg bg-white shadow-lg"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Los cambios aparecen acá al instante y se publican al guardar.
        </span>
        {plantilla && (
          <span>
            Plantilla: <span className="font-medium text-primary">{plantilla}</span>
          </span>
        )}
      </div>
    </div>
  );
}
