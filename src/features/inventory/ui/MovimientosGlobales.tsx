import { useEffect, useState } from "react";
import { History, Package as PackageIcon, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import {
  ListaTarjetas,
  SoloEscritorio,
  TarjetaFila,
  FilaTitulo,
  FilaDatos,
} from "@/shared/ui/lista-tarjetas";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { PaginationControls } from "@/shared/ui/pagination";
import { cn } from "@/shared/lib/cn";
import { useMovements } from "@/entities/inventory/api";
import { formatearCantidad } from "@/entities/inventory/model/envases";
import {
  esSalida,
  MOVEMENT_TYPE_CONFIG,
} from "@/entities/inventory/model/movimientos";
import type { MovementType } from "@/entities/inventory/model/types";

/** Los tipos que tiene sentido ofrecer como filtro, agrupados por origen. */
const FILTROS_MANUALES: MovementType[] = [
  "purchase",
  "adjustment_in",
  "adjustment_out",
  "waste",
  "sample",
];
const FILTROS_AUTOMATICOS: MovementType[] = [
  "consumption",
  "sale",
  "return",
  "fraction",
  "assembly",
];

function fechaLegible(iso: string): string {
  return new Date(iso).toLocaleString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * El libro de movimientos de toda la tienda.
 *
 * Es la contracara de la pestaña de Stock: allá se ve el saldo, acá se ve de
 * dónde salió. Como `inventory_movements` es append-only, esta lista es el
 * relato completo y definitivo de cada cambio -incluidos los que nadie
 * registró a mano, como el consumo que genera un pedido al confirmarse.
 */
export function MovimientosGlobales({ storeId }: { storeId: string }) {
  const [tipo, setTipo] = useState<MovementType | "all">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    setCurrentPage(1);
  }, [tipo, storeId]);

  const { data, isLoading } = useMovements({
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
    order: "DESC",
    storeId,
    ...(tipo !== "all" && { type: tipo }),
  });

  const movimientos = data?.data ?? [];
  const total = data?.countData ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-4">
        <div className="w-full sm:w-64">
          <Select
            value={tipo}
            onValueChange={(v) => setTipo(v as MovementType | "all")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tipo de movimiento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los movimientos</SelectItem>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Registrados a mano
              </div>
              {FILTROS_MANUALES.map((t) => (
                <SelectItem key={t} value={t}>
                  <span className="flex items-center gap-2">
                    {MOVEMENT_TYPE_CONFIG[t].icon}
                    {MOVEMENT_TYPE_CONFIG[t].label}
                  </span>
                </SelectItem>
              ))}
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Generados por el sistema
              </div>
              {FILTROS_AUTOMATICOS.map((t) => (
                <SelectItem key={t} value={t}>
                  <span className="flex items-center gap-2">
                    {MOVEMENT_TYPE_CONFIG[t].icon}
                    {MOVEMENT_TYPE_CONFIG[t].label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {tipo !== "all" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTipo("all")}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="mr-1.5 h-3.5 w-3.5" />
            Quitar filtro
          </Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">
          {total} {total === 1 ? "movimiento" : "movimientos"}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2 rounded-lg border p-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : movimientos.length === 0 ? (
        <EmptyState
          icon={tipo === "all" ? PackageIcon : History}
          title={
            tipo === "all"
              ? "Todavía no hay movimientos"
              : "No hay movimientos de ese tipo"
          }
          description={
            tipo === "all"
              ? "Cada compra, ajuste, merma o venta va a quedar registrada acá con su fecha y su motivo."
              : "Probá con otro tipo o quitá el filtro para ver todo el historial."
          }
          {...(tipo !== "all" && {
            primaryAction: {
              label: "Ver todos",
              variant: "outline" as const,
              onClick: () => setTipo("all"),
            },
          })}
        />
      ) : (
        <div className="rounded-lg md:border">
          <SoloEscritorio>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Registró</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movimientos.map((m) => {
                const config = MOVEMENT_TYPE_CONFIG[m.type];
                const salida = esSalida(m.type, m.direction);
                const unidad = m.inventory?.product?.baseUnit;

                return (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {fechaLegible(m.created_at)}
                    </TableCell>

                    <TableCell>
                      <p className="text-sm font-medium">
                        {m.inventory?.product?.name ?? "—"}
                      </p>
                      {m.inventory?.store?.name && (
                        <p className="text-xs text-muted-foreground">
                          {m.inventory.store.name}
                        </p>
                      )}
                    </TableCell>

                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                          config?.chip ??
                            "bg-muted text-muted-foreground",
                        )}
                      >
                        {config?.icon}
                        {config?.label ?? m.type}
                      </span>
                    </TableCell>

                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          m.direction === 0
                            ? "text-muted-foreground"
                            : salida
                              ? "text-orange-600 dark:text-orange-400"
                              : "text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {m.direction === 0 ? "" : salida ? "−" : "+"}
                        {formatearCantidad(m.quantity, unidad)}
                      </span>
                    </TableCell>

                    <TableCell className="text-right text-sm tabular-nums">
                      {m.totalCost ? (
                        `Bs ${Number(m.totalCost).toFixed(2)}`
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="max-w-[16rem]">
                      <span className="text-xs text-muted-foreground">
                        {m.notes || "—"}
                      </span>
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">
                      {m.createdBy?.name || m.createdBy?.email || "Sistema"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </SoloEscritorio>

          {/* El libro de movimientos se lee de arriba hacia abajo: que entró o
              salió, de qué producto y cuánto. Eso es la tarjeta. */}
          <ListaTarjetas className="pb-2">
            {movimientos.map((m) => {
              const config = MOVEMENT_TYPE_CONFIG[m.type];
              const salida = esSalida(m.type, m.direction);
              const unidad = m.inventory?.product?.baseUnit;

              return (
                <TarjetaFila key={m.id}>
                  <FilaTitulo
                    titulo={m.inventory?.product?.name ?? "—"}
                    subtitulo={m.inventory?.store?.name || undefined}
                    derecha={
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          m.direction === 0
                            ? "text-muted-foreground"
                            : salida
                              ? "text-orange-600 dark:text-orange-400"
                              : "text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {m.direction === 0 ? "" : salida ? "−" : "+"}
                        {formatearCantidad(m.quantity, unidad)}
                      </span>
                    }
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                        config?.chip ?? "bg-muted text-muted-foreground",
                      )}
                    >
                      {config?.icon}
                      {config?.label ?? m.type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {fechaLegible(m.created_at)}
                    </span>
                  </div>

                  <FilaDatos
                    datos={[
                      {
                        etiqueta: "Costo",
                        valor: m.totalCost
                          ? `Bs ${Number(m.totalCost).toFixed(2)}`
                          : "—",
                      },
                      {
                        etiqueta: "Registró",
                        valor:
                          m.createdBy?.name || m.createdBy?.email || "Sistema",
                      },
                    ]}
                  />

                  {m.notes && (
                    <p className="text-xs text-muted-foreground">{m.notes}</p>
                  )}
                </TarjetaFila>
              );
            })}
          </ListaTarjetas>

          <div className="border-t p-4">
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={total}
              onPageChange={setCurrentPage}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setCurrentPage(1);
              }}
              pageSizeOptions={[10, 20, 50, 100]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
