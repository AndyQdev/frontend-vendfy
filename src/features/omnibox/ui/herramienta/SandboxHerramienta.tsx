import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { TablaVista } from "@/entities/omnibox/model/types";
import { cn } from "@/shared/lib/cn";

import { huella, leerMensaje, paginaSandbox, PAUSA_PROPUESTAS, URL_LIBRERIAS } from "../../model/sandbox";

/**
 * Las librerías del iframe (React, Recharts, Tailwind: ~1 MB). Se leen una
 * vez por sesión, del dominio de la app, y se le pasan a cada herramienta.
 */
function useLibrerias() {
  return useQuery({
    queryKey: ["omnibox", "sandbox", "librerias"],
    queryFn: async () => {
      const r = await fetch(URL_LIBRERIAS);
      if (!r.ok) throw new Error(`No se pudieron cargar las librerías (${r.status})`);
      return r.text();
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/**
 * Una herramienta a medida corriendo AISLADA (ver model/sandbox.ts): un iframe
 * sin el mismo origen, sin red, sin la sesión. Acá solo se le pasan el código
 * y los datos, se ajusta la altura a lo que dibuja y se escucha lo que dice.
 *
 * Lo que llega por postMessage se acepta solo si viene de ESTE iframe: otra
 * ventana (u otra herramienta) no puede hacerse pasar por ella.
 */
export function SandboxHerramienta({
  codigo,
  datos,
  titulo,
  onLista,
  onError,
  onProponer,
  className,
}: {
  codigo: string;
  datos: Record<string, TablaVista>;
  titulo: string;
  onLista?: () => void;
  /** Falló al dibujarse o al usarla: el primero de cada carga, nada más. */
  onError: (mensaje: string) => void;
  onProponer: (accion: unknown) => void;
  className?: string;
}) {
  const marco = useRef<HTMLIFrameElement>(null);
  const [alto, setAlto] = useState(0);
  const [lista, setLista] = useState(false);
  // El tema de la app (ThemeProvider deja "dark" en <html>): la herramienta se ve igual que el resto.
  const tema = document.documentElement.classList.contains("dark") ? "oscuro" : "claro";
  const srcdoc = useMemo(() => paginaSandbox({ tema }), [tema]);
  const version = useMemo(() => huella(codigo), [codigo]);
  const librerias = useLibrerias();

  // Los callbacks cambian en cada render del padre; el listener no se vuelve a registrar por eso.
  const avisos = useRef({ onLista, onError, onProponer });
  avisos.current = { onLista, onError, onProponer };

  useEffect(() => {
    if (!librerias.data) return;
    setLista(false);
    setAlto(0);
    let fallo = false;
    let ultimaPropuesta = 0;
    function alMensaje(ev: MessageEvent) {
      const ventana = marco.current?.contentWindow;
      if (!ventana || ev.source !== ventana) return;
      const m = leerMensaje(ev.data);
      if (!m) return;
      switch (m.tipo) {
        case "preparada":
          ventana.postMessage({ tipo: "cargar", librerias: librerias.data, codigo, datos }, "*");
          break;
        case "altura":
          setAlto(m.alto);
          break;
        case "lista":
          setLista(true);
          avisos.current.onLista?.();
          break;
        case "error":
          if (!fallo) {
            fallo = true;
            avisos.current.onError(m.mensaje);
          }
          break;
        case "bloqueo":
          // El aislamiento hizo su trabajo; queda anotado para quien depure.
          console.warn(`[herramienta] bloqueado por la política de seguridad: ${m.directiva} ${m.recurso}`);
          break;
        case "proponer":
          // Una herramienta que propone en bucle no llena el chat de tarjetas.
          if (Date.now() - ultimaPropuesta < PAUSA_PROPUESTAS) break;
          ultimaPropuesta = Date.now();
          avisos.current.onProponer(m.accion);
          break;
      }
    }
    window.addEventListener("message", alMensaje);
    return () => window.removeEventListener("message", alMensaje);
  }, [librerias.data, codigo, datos, srcdoc]);

  if (librerias.isError) {
    return (
      <p className="rounded-lg bg-destructive-soft px-3 py-2 text-[13px] text-destructive">
        No se pudo preparar la herramienta: {String((librerias.error as Error)?.message ?? "")}
      </p>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {!lista ? (
        <div data-testid="herramienta-cargando" className="absolute inset-x-0 top-0 space-y-2 p-3" aria-hidden>
          <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
        </div>
      ) : null}
      {librerias.data ? (
        <iframe
          // Otra herramienta, otro tema: un iframe nuevo (el de adentro solo carga una vez).
          key={`${tema}:${version}`}
          ref={marco}
          title={titulo}
          data-testid="herramienta-marco"
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          srcDoc={srcdoc}
          className={cn("block w-full border-0 transition-opacity duration-200", lista ? "opacity-100" : "opacity-0")}
          style={{ height: alto || 320 }}
        />
      ) : null}
    </div>
  );
}
