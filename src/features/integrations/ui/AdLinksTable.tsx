import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/shared/ui/badge";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Loader2, Megaphone, Sparkles } from "lucide-react";
import {
  useAds,
  useLinkAd,
  useStoreProducts,
} from "@/entities/integration/api";
import type { AdWithLink } from "@/entities/integration/model/types";

interface Props {
  storeId: string;
  moneda: string;
}

/** Marca un anuncio como revisado sin producto puntual (anuncio de marca). */
const SIN_PRODUCTO = "__marca__";

const ESTADOS: Record<string, { label: string; clase: string }> = {
  ACTIVE: {
    label: "Activo",
    clase: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  PAUSED: { label: "Pausado", clase: "bg-muted text-muted-foreground" },
  CAMPAIGN_PAUSED: { label: "Campaña pausada", clase: "bg-muted text-muted-foreground" },
  ADSET_PAUSED: { label: "Conjunto pausado", clase: "bg-muted text-muted-foreground" },
  PENDING_REVIEW: {
    label: "En revisión",
    clase: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  DISAPPROVED: {
    label: "Rechazado",
    clase: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

const num = (n: number) => n.toLocaleString("es-BO");
const money = (n: number, m: string) =>
  `${m} ${n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Rendimiento de cada anuncio y qué producto vende.
 *
 * Las columnas mezclan a propósito dos orígenes: gasto, alcance y clics los
 * reporta Meta; conversaciones, ventas y retorno salen de nuestra base. Esa
 * segunda mitad es la que ninguna plataforma puede calcular, porque la
 * conversación y la compra ocurren dentro de WhatsApp, donde no ve.
 */
export function AdLinksTable({ storeId, moneda }: Props) {
  const { data: anuncios = [], isLoading } = useAds(storeId, true);
  const { data: productos = [] } = useStoreProducts(storeId, true);
  const enlazar = useLinkAd();
  const [guardando, setGuardando] = useState<string | null>(null);

  const guardar = async (a: AdWithLink, valor: string) => {
    setGuardando(a.id);
    try {
      await enlazar.mutateAsync({
        storeId,
        adId: a.id,
        adName: a.nombre,
        storeProductIds: valor === SIN_PRODUCTO ? [] : [valor],
      });
      toast.success("Listo: el asistente ya sabe qué vende este anuncio");
    } catch (e) {
      toast.error("No se pudo guardar", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setGuardando(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }

  if (!anuncios.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
        <Megaphone className="h-8 w-8 text-muted-foreground" />
        <div>
          <p className="font-medium">Todavía no hay anuncios</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuando publiques uno en Meta, aparece acá con su rendimiento.
          </p>
        </div>
      </div>
    );
  }

  const total = anuncios.reduce(
    (a, x) => ({
      gasto: a.gasto + x.gasto,
      conversaciones: a.conversaciones + x.conversaciones,
      ventas: a.ventas + x.ventas,
      monto: a.monto + x.montoVendido,
    }),
    { gasto: 0, conversaciones: 0, ventas: 0, monto: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Resumen titulo="Invertido" valor={money(total.gasto, moneda)} />
        <Resumen titulo="Conversaciones" valor={num(total.conversaciones)} />
        <Resumen titulo="Ventas atribuidas" valor={num(total.ventas)} />
        <Resumen
          titulo="Retorno"
          valor={
            total.gasto > 0
              ? `${(total.monto / total.gasto).toFixed(2)}x`
              : "—"
          }
          tono={
            total.gasto > 0 && total.monto / total.gasto >= 1
              ? "bien"
              : total.gasto > 0
                ? "mal"
                : undefined
          }
        />
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Anuncio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Invertido</TableHead>
              <TableHead className="text-right">Alcance</TableHead>
              <TableHead className="text-right">Clics</TableHead>
              <TableHead className="text-right">Conversaciones</TableHead>
              <TableHead className="text-right">Ventas</TableHead>
              <TableHead className="text-right">Retorno</TableHead>
              <TableHead className="min-w-[260px]">Qué vende</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {anuncios.map((a) => {
              const estado = ESTADOS[a.estado ?? ""] ?? {
                label: a.estado ?? "—",
                clase: "bg-muted text-muted-foreground",
              };
              const actual = a.productos[0] ?? "";
              const sugerido = a.sugeridos[0];
              const valor =
                actual || (!a.revisado && sugerido ? sugerido.id : "");
              const esSugerencia = !actual && Boolean(sugerido) && !a.revisado;

              return (
                <TableRow key={a.id}>
                  <TableCell>
                    <p className="font-medium">{a.nombre}</p>
                    {a.campana && (
                      <p className="text-xs text-muted-foreground">{a.campana}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={estado.clase}>
                      {estado.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(a.gasto, moneda)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {num(a.impresiones)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {num(a.clics)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {num(a.conversaciones)}
                    {/* Cuando los dos contadores discrepan, el dato importa:
                        significa que alguien tocó el botón y nunca envió el
                        mensaje, o que el referral no llegó. */}
                    {a.conversacionesMeta !== a.conversaciones && (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        (Meta: {num(a.conversacionesMeta)})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {a.ventas > 0 ? (
                      <>
                        <span className="font-medium">{num(a.ventas)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {money(a.montoVendido, moneda)}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {a.roas === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={
                          a.roas >= 1
                            ? "font-medium text-emerald-600"
                            : "text-muted-foreground"
                        }
                      >
                        {a.roas.toFixed(2)}x
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Select
                        value={valor || undefined}
                        onValueChange={(v) => guardar(a, v)}
                        disabled={guardando === a.id}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Sin definir" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SIN_PRODUCTO}>
                            No promociona un producto puntual
                          </SelectItem>
                          {productos.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {guardando === a.id && (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {esSugerencia && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                        <Sparkles className="h-3 w-3 shrink-0" />
                        Sugerido — confirmalo para que sea exacto
                      </p>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Lo invertido, el alcance y los clics los reporta Meta. Las
        conversaciones, las ventas y el retorno salen de Vendfy: son las que
        realmente llegaron a tu WhatsApp y terminaron en pedido, algo que la
        plataforma publicitaria no puede ver.
      </p>
    </div>
  );
}

function Resumen({
  titulo,
  valor,
  tono,
}: {
  titulo: string;
  valor: string;
  tono?: "bien" | "mal";
}) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p
        className={`mt-1 font-display text-xl font-bold tabular-nums ${
          tono === "bien"
            ? "text-emerald-600"
            : tono === "mal"
              ? "text-amber-600"
              : ""
        }`}
      >
        {valor}
      </p>
    </div>
  );
}
