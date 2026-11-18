import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Download, Megaphone } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { EmptyState } from "@/shared/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { useCampanas, useImportarCampanas } from "@/entities/marketing/api";
import { ESTADO_CAMPANA, bs } from "@/entities/marketing/model/types";

/** Las campañas de la tienda con lo que gastaron y lo que volvió por nuestros pedidos. */
export function CampanasLista({
  storeId,
  puedeGestionar,
  onIrAIdeas,
}: {
  storeId: string;
  puedeGestionar: boolean;
  onIrAIdeas: () => void;
}) {
  const { data: campanas = [], isLoading } = useCampanas(storeId);
  const importar = useImportarCampanas(storeId);

  const traer = async () => {
    try {
      const r = await importar.mutateAsync();
      toast.success(r.importadas || r.actualizadas ? `Traje ${r.importadas} campañas nuevas y actualicé ${r.actualizadas}` : "No hay campañas nuevas en tu cuenta de Meta");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo leer Meta");
    }
  };

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Lo vendido sale de tus pedidos: cuenta solo lo que compraron quienes escribieron por cada anuncio.
        </p>
        {puedeGestionar && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={traer} loading={importar.isPending}>
              <Download className="mr-1.5 h-4 w-4" /> Traer de Meta
            </Button>
            <Button size="sm" onClick={onIrAIdeas}>
              Nueva campaña
            </Button>
          </div>
        )}
      </div>

      {!campanas.length ? (
        <EmptyState
          icon={Megaphone}
          title="Todavía no hay campañas"
          description="Arma la primera desde una idea, o trae las que ya hiciste en Meta."
          primaryAction={puedeGestionar ? { label: "Ver ideas", onClick: onIrAIdeas } : undefined}
        />
      ) : (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaña</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Gastó</TableHead>
                <TableHead className="text-right">Escribieron</TableHead>
                <TableHead className="text-right">Costo por chat</TableHead>
                <TableHead className="text-right">Compraron</TableHead>
                <TableHead className="text-right">Vendió</TableHead>
                <TableHead className="text-right">ROAS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campanas.map((c) => {
                const estado = ESTADO_CAMPANA[c.estado];
                const escribieron = Math.max(c.metricas.conversaciones, c.metricas.personas);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="max-w-[18rem]">
                      <Link to={`/marketing/campanas/${c.id}`} className="font-medium text-primary hover:underline">
                        {c.nombre}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.canal === "plantilla_wa"
                          ? "Mensaje de WhatsApp"
                          : c.presupuestoDiario
                            ? `${bs(c.presupuestoDiario, c.moneda)} por día${c.dias ? ` · ${c.dias} días` : ""}`
                            : c.origen === "importada"
                              ? "Traída de Meta"
                              : ""}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={estado.variant}>{estado.texto}</Badge>
                    </TableCell>
                    <TableCell className="cifra text-right">{bs(c.metricas.gasto, c.moneda)}</TableCell>
                    <TableCell className="cifra text-right">{escribieron}</TableCell>
                    <TableCell className="cifra text-right">{bs(c.metricas.costoConversacion, c.moneda)}</TableCell>
                    <TableCell className="cifra text-right">{c.metricas.compraron}</TableCell>
                    <TableCell className="cifra text-right">{bs(c.metricas.vendido)}</TableCell>
                    <TableCell className="cifra text-right">{c.metricas.roas != null ? `${c.metricas.roas}×` : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
