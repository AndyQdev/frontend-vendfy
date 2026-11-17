import { useState } from "react";
import { AlertCircle, Check, Loader2, RefreshCw, Sparkles, Wand2 } from "lucide-react";

import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import {
  MAX_DESCRIPCION_IA,
  useArmarDisenoConIa,
  type ArmarDisenoInput,
  type DisenoIa,
  type TextosIa,
} from "../../model/diseno-ia";

/** Dónde va un texto sugerido. Sin destino, ese texto no se ofrece. */
export interface DestinoDeTexto {
  /** Qué es, para el comerciante: "Título de la portada". */
  etiqueta: string;
  /** Dónde queda si lo usa: "En la primera imagen de la portada". */
  donde: string;
  usar: (texto: string) => void;
}

export type DestinosDeTextos = Partial<Record<keyof TextosIa, DestinoDeTexto>>;

/** Lo que el asistente recuerda mientras se recorren los otros paneles. */
export interface EstadoAsistenteIa {
  descripcion: string;
  resultado: DisenoIa | null;
  /** Los textos que ya se usaron, para marcarlos. */
  usados: Array<keyof TextosIa>;
}

export const ESTADO_INICIAL_IA: EstadoAsistenteIa = { descripcion: "", resultado: null, usados: [] };

const ORDEN_DE_TEXTOS: Array<keyof TextosIa> = ["tituloPortada", "subtituloPortada", "anuncio", "nosotros"];
/** Menos que esto no le dice nada al modelo. */
const MINIMO_DESCRIPCION = 10;

function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError) {
    // El del límite diario y el de "no disponible" ya vienen escritos para el comerciante.
    if (error.statusCode === 429 || error.statusCode === 503 || error.statusCode === 502) return error.message;
    if (error.statusCode === 0) return "No pudimos conectarnos. Revisá tu conexión y probá de nuevo.";
    if (error.statusCode === 401 || error.statusCode === 403) return "No tenés permiso para armar el diseño de esta tienda.";
    if (error.statusCode === 404) return "No encontramos la tienda. Recargá la página y probá de nuevo.";
  }
  return "No pudimos armar el diseño esta vez. Probá de nuevo en un momento.";
}

/**
 * Arma el diseño a partir de lo que cuenta el comerciante.
 *
 * El resultado se aplica como un diseño listo: queda de borrador en la vista
 * previa y nada se publica hasta guardar. Los textos que propone NO se aplican
 * solos: cada uno se muestra con su botón "Usar", porque pisan algo que el
 * comerciante pudo haber escrito. Las imágenes con IA se crean en la portada.
 */
export function AsistenteIa({
  storeId,
  estado,
  onEstado,
  armarPedido,
  onAplicar,
  destinos,
}: {
  /** Sin tienda guardada no hay a quién contarle el uso: se avisa y no se ofrece. */
  storeId?: string;
  estado: EstadoAsistenteIa;
  onEstado: (estado: EstadoAsistenteIa) => void;
  /** El catálogo y el contexto se arman al pedir, con lo que hay en pantalla en ese momento. */
  armarPedido: () => Pick<ArmarDisenoInput, "catalogo" | "contexto">;
  onAplicar: (apariencia: DisenoIa["apariencia"]) => void;
  destinos: DestinosDeTextos;
}) {
  const armar = useArmarDisenoConIa();
  const [error, setError] = useState<string | null>(null);
  const { descripcion, resultado, usados } = estado;
  const texto = descripcion.trim();
  const corto = texto.length < MINIMO_DESCRIPCION;

  const pedir = async () => {
    if (!storeId || corto || armar.isPending) return;
    setError(null);
    try {
      const diseno = await armar.mutateAsync({ storeId, descripcion: texto, ...armarPedido() });
      onAplicar(diseno.apariencia);
      onEstado({ descripcion, resultado: diseno, usados: [] });
    } catch (e) {
      setError(mensajeDeError(e));
    }
  };

  const sugerencias = resultado
    ? ORDEN_DE_TEXTOS.flatMap((clave) => {
        const valor = resultado.textos[clave];
        const destino = destinos[clave];
        return valor && destino ? [{ clave, valor, destino }] : [];
      })
    : [];

  return (
    <div className="space-y-3 rounded-xl border border-purple-200 bg-purple-50/50 p-3 dark:border-purple-800 dark:bg-purple-900/10">
      <div className="space-y-1">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" /> Armar con IA
        </p>
        <p className="text-xs text-muted-foreground">
          Contanos cómo es tu tienda y qué estilo buscás. La IA elige los colores, la letra, la portada y las secciones por vos.
        </p>
      </div>

      {!storeId ? (
        <p className="text-xs text-muted-foreground">Guardá la tienda primero y vas a poder armar el diseño con IA.</p>
      ) : (
        <>
          <div className="space-y-1">
            <Textarea
              value={descripcion}
              onChange={(e) => onEstado({ ...estado, descripcion: e.target.value })}
              maxLength={MAX_DESCRIPCION_IA}
              rows={3}
              disabled={armar.isPending}
              aria-label="Contanos cómo es tu tienda y qué estilo buscás"
              placeholder="Ej.: Vendo ropa de bebé hecha a mano. Quiero algo tierno, claro y prolijo, con fotos grandes."
              className="bg-background md:text-xs"
            />
            <p className="text-right text-[11px] text-muted-foreground">
              {descripcion.length}/{MAX_DESCRIPCION_IA}
            </p>
          </div>

          {!resultado && (
            <Button type="button" size="sm" className="w-full" onClick={pedir} disabled={corto || armar.isPending}>
              {armar.isPending ? <Loader2 className="animate-spin" /> : <Wand2 />}
              {armar.isPending ? "Armando tu diseño…" : "Armar mi diseño"}
            </Button>
          )}
          {armar.isPending && <p className="text-center text-[11px] text-muted-foreground">Puede tardar hasta 30 segundos.</p>}

          {error && (
            <p role="alert" className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-none" />
              <span>{error}</span>
            </p>
          )}

          {resultado && (
            <div className="space-y-3 rounded-lg border border-border bg-background p-3">
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-xs font-semibold">
                  <span className="flex h-4 w-4 flex-none items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-2.5 w-2.5" />
                  </span>
                  Diseño aplicado a la vista previa
                </p>
                <p className="text-xs text-foreground">{resultado.explicacion}</p>
                <p className="text-[11px] text-muted-foreground">
                  Tus imágenes y tu anuncio quedan. Nada se publica hasta que guardes; después podés retocar cada parte desde el menú.
                </p>
              </div>

              {sugerencias.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Textos sugeridos</p>
                  {sugerencias.map(({ clave, valor, destino }) => {
                    const usado = usados.includes(clave);
                    return (
                      <div key={clave} className="space-y-1.5 rounded-md border border-border p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold">{destino.etiqueta}</p>
                            <p className="text-[11px] text-muted-foreground">{destino.donde}</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant={usado ? "ghost" : "outline"}
                            className="h-7 flex-none px-2.5 text-xs max-md:h-9"
                            disabled={usado}
                            onClick={() => {
                              destino.usar(valor);
                              onEstado({ ...estado, usados: [...usados, clave] });
                            }}
                          >
                            {usado && <Check />}
                            {usado ? "Usado" : "Usar"}
                          </Button>
                        </div>
                        <p className="whitespace-pre-line text-xs">{valor}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-1">
                <Button type="button" size="sm" variant="outline" className="w-full" onClick={pedir} disabled={corto || armar.isPending}>
                  {armar.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                  {armar.isPending ? "Armando otro diseño…" : "Probar otra"}
                </Button>
                <p className="text-center text-[11px] text-muted-foreground">
                  {corto
                    ? "Contanos un poco más para armar otro."
                    : typeof resultado.restantesHoy === "number"
                      ? resultado.restantesHoy > 0
                        ? `Podés cambiar el texto de arriba antes de probar. Te ${resultado.restantesHoy === 1 ? "queda 1 armado" : `quedan ${resultado.restantesHoy} armados`} hoy.`
                        : "Ya usaste todos los armados de hoy."
                      : "Podés cambiar el texto de arriba antes de probar."}
                </p>
              </div>
            </div>
          )}
          {!resultado && corto && texto.length > 0 && (
            <p className="text-[11px] text-muted-foreground">Contanos un poco más: qué vendés y cómo te gustaría que se vea.</p>
          )}
        </>
      )}
    </div>
  );
}
