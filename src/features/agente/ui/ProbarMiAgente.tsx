import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, CircleAlert, FlaskConical, Loader2, ShieldCheck, Timer, XCircle } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { NativeSelect } from "@/shared/ui/native-select";
import { Checkbox } from "@/shared/ui/checkbox";
import { Label } from "@/shared/ui/label";
import { Skeleton } from "@/shared/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/collapsible";
import { cn } from "@/shared/lib/cn";
import { useCorrida, useIniciarPrueba, usePruebas } from "@/entities/agente/api";
import { useAgentConfig } from "@/entities/whatsapp/api/agent";
import type { ConversacionPrueba, CorridaPrueba } from "@/entities/agente/model/types";

const segundos = (ms: number) => `${(ms / 1000).toFixed(1).replace(".", ",")} s`;

/**
 * «Probar mi agente»: clientes simulados (el que solo escribe «precio?», el
 * indeciso, el que pide descuento, el que reclama, el que intenta engañarlo…)
 * conversan con tu vendedor con tus productos reales, sin mandar nada a
 * WhatsApp. Cada caso corre 3 veces: lo que importa es que salga bien siempre.
 */
export function ProbarMiAgente({ storeId }: { storeId: string }) {
  const { data: corridas = [], isLoading } = usePruebas(storeId);
  const config = useAgentConfig(storeId).data;
  const iniciar = useIniciarPrueba(storeId);
  const [modelo, setModelo] = useState("");
  const [borradores, setBorradores] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);
  const corriendo = corridas.some((c) => c.estado === "corriendo");

  const opciones = (config?.providers ?? []).filter((p) => p.available).flatMap((p) => p.models.map((m) => ({ valor: `${p.id}:${m.id}`, etiqueta: m.label })));

  const onProbar = () => {
    const [provider, model] = modelo ? modelo.split(":") : [];
    iniciar.mutate(
      { ...(provider ? { provider, model } : {}), repeticiones: 3, usarBorradores: borradores },
      {
        onSuccess: () => toast.success("Prueba en marcha: tarda unos minutos"),
        onError: (e: any) => toast.error(e?.message ?? "No se pudo empezar la prueba"),
      },
    );
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
            <FlaskConical className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold">Probar mi agente</h2>
            <p className="text-sm text-muted-foreground">
              Clientes simulados conversan con tu vendedor usando tus productos: el que solo escribe «precio?», el indeciso, el que pide descuento, el que reclama,
              el que intenta engañarlo. No se manda nada a WhatsApp ni se crean pedidos. Cada caso corre 3 veces.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <NativeSelect value={modelo} onChange={(e) => setModelo(e.target.value)} aria-label="Modelo a probar" className="sm:w-64">
            <option value="">El modelo configurado{config?.model ? ` (${config.model})` : ""}</option>
            {opciones.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </NativeSelect>
          <div className="flex items-center gap-2">
            <Checkbox id="probar-borradores" checked={borradores} onCheckedChange={(v) => setBorradores(v === true)} />
            <Label htmlFor="probar-borradores" className="text-sm font-normal">
              Con las fichas sin aprobar
            </Label>
          </div>
          <Button onClick={onProbar} disabled={corriendo || iniciar.isPending}>
            {corriendo || iniciar.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-1.5 h-4 w-4" />}
            {corriendo ? "Probando…" : "Probar mi agente"}
          </Button>
        </div>
      </Card>

      {isLoading && <Skeleton className="h-32 rounded-2xl" />}
      {corridas.map((c) => (
        <TarjetaCorrida key={c.id} storeId={storeId} c={c} abierta={abierta === c.id} onToggle={() => setAbierta(abierta === c.id ? null : c.id)} />
      ))}
    </div>
  );
}

function TarjetaCorrida({ storeId, c, abierta, onToggle }: { storeId: string; c: CorridaPrueba; abierta: boolean; onToggle: () => void }) {
  const r = c.resumen;
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{new Date(c.created_at).toLocaleString("es-BO", { dateStyle: "medium", timeStyle: "short" })}</p>
          <p className="text-xs text-muted-foreground">
            {c.modelo ?? "modelo configurado"}
            {c.resumen?.usarBorradores ? " · con fichas sin aprobar" : ""}
          </p>
        </div>
        {c.estado === "corriendo" ? (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Probando…
          </Badge>
        ) : c.estado === "error" ? (
          <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
            Error
          </Badge>
        ) : (
          <Badge
            className={
              r?.aprobada
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"
                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
            }
          >
            {r?.aprobada ? "Aprobada" : "No aprobada"}
          </Badge>
        )}
      </div>
      {c.estado === "error" && <p className="mt-2 text-sm text-muted-foreground">{c.error}</p>}
      {r && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Dato icon={ShieldCheck} titulo="Casos críticos" valor={r.criticosOk ? "Todos bien" : "Con fallas"} ok={r.criticosOk} />
            <Dato icon={CheckCircle2} titulo="Venta, siempre bien" valor={`${r.passK} %`} ok={r.passK >= 80} />
            <Dato icon={Timer} titulo="Respuesta (mediana)" valor={segundos(r.latencia.medianaMs)} ok={r.latencia.medianaMs <= 8000} />
            <Dato icon={CheckCircle2} titulo="Suena natural" valor={r.juez.natural == null ? "—" : `${r.juez.natural} %`} ok={(r.juez.natural ?? 0) >= 80} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{r.puntaje}. {r.criterio}</p>
          <ul className="mt-3 divide-y divide-border">
            {r.porEscenario.map((e) => (
              <li key={e.id} className="py-2">
                <div className="flex items-start gap-2">
                  {e.siempre ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Bien" />
                  ) : e.critico ? (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-label="Falla crítica" />
                  ) : (
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" aria-label="A mejorar" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      {e.titulo} <span className="text-xs text-muted-foreground">· {e.pasadas}/{e.total}</span>
                    </p>
                    {!e.siempre && !!e.fallas.length && <p className="text-xs text-muted-foreground">{e.fallas.slice(0, 2).join(" · ")}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Collapsible open={abierta} onOpenChange={onToggle}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="mt-2">
                <ChevronDown className={cn("mr-1 h-4 w-4 transition-transform", abierta && "rotate-180")} /> Ver las conversaciones
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>{abierta && <Conversaciones storeId={storeId} id={c.id} />}</CollapsibleContent>
          </Collapsible>
        </>
      )}
    </Card>
  );
}

function Dato({ icon: Icon, titulo, valor, ok }: { icon: typeof Timer; titulo: string; valor: string; ok: boolean }) {
  return (
    <div className="rounded-xl bg-muted/50 p-2.5">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {titulo}
      </p>
      <p className={cn("text-sm font-semibold", ok ? "text-foreground" : "text-yellow-700 dark:text-yellow-400")}>{valor}</p>
    </div>
  );
}

function Conversaciones({ storeId, id }: { storeId: string; id: string }) {
  const { data, isLoading } = useCorrida(storeId, id);
  if (isLoading) return <Skeleton className="h-40 rounded-xl" />;
  const conversaciones = data?.detalle?.conversaciones ?? [];
  return (
    <div className="mt-2 space-y-3">
      {conversaciones.map((cv, i) => (
        <Conversacion key={i} cv={cv} />
      ))}
    </div>
  );
}

function Conversacion({ cv }: { cv: ConversacionPrueba }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium">
          {cv.escenario.replace(/_/g, " ")} · vez {cv.repeticion}
        </p>
        <span className={cn("text-xs font-medium", cv.pasa ? "text-emerald-700 dark:text-emerald-400" : "text-yellow-700 dark:text-yellow-400")}>
          {cv.pasa ? "Bien" : "A mejorar"}
        </span>
      </div>
      <div className="space-y-1.5">
        {cv.turnos.map((t, i) => (
          <div key={i} className="space-y-1">
            <p className="ml-auto w-fit max-w-[85%] rounded-lg bg-primary-soft px-2.5 py-1.5 text-xs text-primary-soft-foreground">{t.cliente}</p>
            {t.agente.map((m, j) => (
              <div key={j} className="w-fit max-w-[85%] rounded-lg bg-muted px-2.5 py-1.5 text-xs">
                <p className="whitespace-pre-line">{m.texto}</p>
                {!!m.botones?.length && <p className="mt-1 text-[11px] text-muted-foreground">Botones: {m.botones.join(" · ")}</p>}
                {!!m.lista?.length && <p className="mt-1 text-[11px] text-muted-foreground">Lista: {m.lista.join(" · ")}</p>}
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              {segundos(t.ms)}
              {t.derivado ? " · pasó a una persona" : ""}
            </p>
          </div>
        ))}
      </div>
      {(cv.chequeos.some((c) => !c.ok) || cv.juicio?.comentario || cv.error) && (
        <div className="mt-2 space-y-0.5 border-t border-border pt-2 text-[11px] text-muted-foreground">
          {cv.chequeos
            .filter((c) => !c.ok)
            .map((c) => (
              <p key={c.id}>✗ {c.detalle ?? c.id}</p>
            ))}
          {cv.juicio?.comentario && <p>Juez: {cv.juicio.comentario}</p>}
          {cv.error && <p>Error: {cv.error}</p>}
        </div>
      )}
    </div>
  );
}
