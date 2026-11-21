import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCheck, ExternalLink, Loader2, Megaphone, Pencil, Search, Sparkles, Wand2 } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { NativeSelect } from "@/shared/ui/native-select";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/shared/ui/responsive-dialog";
import { useAprobarFichas, useGenerarFicha, useGenerarTodas, useGuardarFicha } from "@/entities/agente/api";
import {
  ORIGEN_ETIQUETA,
  type Conocimiento,
  type FichaProducto,
  type OrigenProducto,
  type ProductoDelConocimiento,
} from "@/entities/agente/model/types";

type Filtro = "todos" | "sin" | "borrador" | "aprobada" | "anunciados";

const estadoDe = (p: ProductoDelConocimiento) => (!p.ficha ? "sin" : p.ficha.estado === "verificado" ? "aprobada" : "borrador");

/** En una perfumería también hay champú y cremas: los campos de notas son solo para fragancias. */
const esFragancia = (p: ProductoDelConocimiento) =>
  /fragan|perfum|parfum|colonia|col[oô]nia|eau de|body splash|decant/i.test(`${p.categoria} ${p.nombre}`) || !!p.ficha?.familia || !!p.ficha?.notasSalida?.length;

/**
 * Las fichas de los productos: el asistente de catálogo arma un borrador
 * (busca notas, familia, ocasión) y tú lo apruebas. El agente solo usa las
 * aprobadas, así nunca afirma algo que no revisaste.
 */
export function FichasProductos({ storeId, data }: { storeId: string; data: Conocimiento }) {
  const generar = useGenerarFicha(storeId);
  const generarTodas = useGenerarTodas(storeId);
  const aprobar = useAprobarFichas(storeId);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [q, setQ] = useState("");
  const [editando, setEditando] = useState<ProductoDelConocimiento | null>(null);
  const [generandoId, setGenerandoId] = useState<string | null>(null);

  const productos = useMemo(() => {
    const t = q.trim().toLowerCase();
    return data.productos.filter((p) => {
      if (t && !p.nombre.toLowerCase().includes(t)) return false;
      if (filtro === "anunciados") return p.anunciado;
      if (filtro !== "todos") return estadoDe(p) === filtro;
      return true;
    });
  }, [data.productos, filtro, q]);

  const conteo = {
    sin: data.productos.filter((p) => estadoDe(p) === "sin").length,
    borrador: data.productos.filter((p) => estadoDe(p) === "borrador").length,
    aprobada: data.productos.filter((p) => estadoDe(p) === "aprobada").length,
  };
  const g = data.generando;
  const generandoTodo = !!g && g.hechos + g.errores < g.total;
  const esPerfumeria = data.paquete.id === "perfumeria";

  const onGenerar = (p: ProductoDelConocimiento) => {
    setGenerandoId(p.productId);
    generar.mutate(p.productId, {
      onSuccess: () => toast.success(`Borrador listo: ${p.nombre}`),
      onError: (e: any) => toast.error(e?.message ?? "No se pudo generar la ficha"),
      onSettled: () => setGenerandoId(null),
    });
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-xl">
            <h2 className="font-display text-base font-semibold">Fichas de tus productos</h2>
            <p className="text-sm text-muted-foreground">
              {esPerfumeria
                ? "El asistente busca las notas, la familia y la ocasión de cada perfume. Revisa y aprueba: tu vendedor solo dice lo aprobado."
                : "El asistente arma qué es y para qué sirve cada producto. Revisa y aprueba: tu vendedor solo dice lo aprobado."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={generandoTodo || generarTodas.isPending || conteo.sin === 0}
              onClick={() =>
                generarTodas.mutate(true, {
                  onSuccess: () => toast.success("Generando las fichas que faltan…"),
                  onError: (e: any) => toast.error(e?.message ?? "No se pudo empezar"),
                })
              }
            >
              <Wand2 className="mr-1.5 h-4 w-4" /> Generar las que faltan ({conteo.sin})
            </Button>
            <Button
              disabled={aprobar.isPending || conteo.borrador === 0}
              onClick={() =>
                aprobar.mutate(
                  data.productos.filter((p) => estadoDe(p) === "borrador").map((p) => p.productId),
                  { onSuccess: (r) => toast.success(`${r.aprobadas} ficha(s) aprobada(s)`) },
                )
              }
            >
              <CheckCheck className="mr-1.5 h-4 w-4" /> Aprobar borradores ({conteo.borrador})
            </Button>
          </div>
        </div>
        {generandoTodo && g && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Armando fichas con IA…</span>
              <span>
                {g.hechos + g.errores}/{g.total}
                {g.errores ? ` · ${g.errores} con error` : ""}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(((g.hechos + g.errores) / Math.max(g.total, 1)) * 100)}%` }} />
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar producto" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar producto" />
          </div>
          <NativeSelect value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} aria-label="Filtrar fichas" className="sm:w-56">
            <option value="todos">Todos ({data.productos.length})</option>
            <option value="anunciados">En campañas</option>
            <option value="sin">Sin ficha ({conteo.sin})</option>
            <option value="borrador">Por aprobar ({conteo.borrador})</option>
            <option value="aprobada">Aprobadas ({conteo.aprobada})</option>
          </NativeSelect>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {productos.map((p) => {
          const e = estadoDe(p);
          return (
            <Card key={p.storeProductId} className="flex flex-col gap-2 p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.nombre}</p>
                  <p className="text-xs text-muted-foreground">{p.categoria}</p>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  {p.anunciado && (
                    <Badge variant="outline" className="gap-1">
                      <Megaphone className="h-3 w-3" /> Anunciado
                    </Badge>
                  )}
                  <Badge
                    variant={e === "aprobada" ? "default" : "secondary"}
                    className={e === "borrador" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400" : undefined}
                  >
                    {e === "aprobada" ? "Aprobada" : e === "borrador" ? "Por aprobar" : "Sin ficha"}
                  </Badge>
                </div>
              </div>
              {p.ficha?.lineaValor ? (
                <p className="text-sm">«{p.ficha.lineaValor}»</p>
              ) : (
                <p className="text-sm text-muted-foreground">Todavía sin línea de valor.</p>
              )}
              {p.ficha?.origen && <p className="text-xs text-muted-foreground">{ORIGEN_ETIQUETA[p.ficha.origen]}{p.ficha.marcaOrigen ? ` · ${p.ficha.marcaOrigen}` : ""}</p>}
              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline" disabled={generandoId === p.productId || generandoTodo} onClick={() => onGenerar(p)}>
                  {generandoId === p.productId ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                  {p.ficha ? "Regenerar" : "Generar con IA"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditando(p)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> {p.ficha ? "Revisar" : "Escribir"}
                </Button>
              </div>
            </Card>
          );
        })}
        {productos.length === 0 && <p className="text-sm text-muted-foreground">No hay productos con ese filtro.</p>}
      </div>

      {editando && (
        <EditorFicha
          storeId={storeId}
          producto={editando}
          esPerfumeria={esPerfumeria && esFragancia(editando)}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  );
}

const lista = (v?: string[]) => (v ?? []).join(", ");
const aLista = (t: string) =>
  t
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const palabras = (t?: string) => (t ?? "").trim().split(/\s+/).filter(Boolean).length;

function EditorFicha({
  storeId,
  producto,
  esPerfumeria,
  onClose,
}: {
  storeId: string;
  producto: ProductoDelConocimiento;
  esPerfumeria: boolean;
  onClose: () => void;
}) {
  const guardar = useGuardarFicha(storeId);
  const [f, setF] = useState<FichaProducto>(producto.ficha ?? { estado: "borrador" });
  const set = (k: keyof FichaProducto, v: unknown) => setF((x) => ({ ...x, [k]: v }));

  const onGuardar = (aprobar: boolean) =>
    guardar.mutate(
      { productId: producto.productId, ficha: { ...f, estado: aprobar ? "verificado" : "borrador" }, aprobar },
      {
        onSuccess: () => {
          toast.success(aprobar ? "Ficha aprobada: tu vendedor ya la usa" : "Borrador guardado");
          onClose();
        },
        onError: (e: any) => toast.error(e?.message ?? "No se pudo guardar"),
      },
    );

  const largoValor = palabras(f.lineaValor);

  return (
    <ResponsiveDialog open onOpenChange={(o) => !o && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-[620px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{producto.nombre}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {f.confianza === "baja"
              ? "Ojo: el asistente no encontró este producto exacto. Revisa con cuidado."
              : "Revisa lo que armó el asistente y corrige lo que haga falta."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="f-valor">Línea de valor (va antes del precio en el chat)</Label>
            <Textarea id="f-valor" rows={2} value={f.lineaValor ?? ""} onChange={(e) => set("lineaValor", e.target.value)} placeholder="Ej.: Canela y lavanda, elegante para salir de noche." />
            <p className={largoValor > 20 ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{largoValor}/20 palabras</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="f-origen">Origen</Label>
              <NativeSelect id="f-origen" value={f.origen ?? ""} onChange={(e) => set("origen", (e.target.value || undefined) as OrigenProducto | undefined)}>
                <option value="">Sin dato (el agente no afirma nada)</option>
                {(Object.keys(ORIGEN_ETIQUETA) as OrigenProducto[]).map((o) => (
                  <option key={o} value={o}>
                    {ORIGEN_ETIQUETA[o]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="f-marca">{f.origen === "inspirado" ? "Inspirado en" : "Marca que lo fabrica"}</Label>
              {f.origen === "inspirado" ? (
                <Input id="f-marca" value={f.inspiradoEn ?? ""} onChange={(e) => set("inspiradoEn", e.target.value)} />
              ) : (
                <Input id="f-marca" value={f.marcaOrigen ?? ""} onChange={(e) => set("marcaOrigen", e.target.value)} />
              )}
            </div>
          </div>

          {esPerfumeria && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo id="f-familia" titulo="Familia olfativa" valor={f.familia} onChange={(v) => set("familia", v)} />
                <Campo id="f-perfil" titulo="Perfil" valor={f.perfil} onChange={(v) => set("perfil", v)} placeholder="dulce, fresco, intenso…" />
                <Campo id="f-ocasion" titulo="Ocasión" valor={f.ocasion} onChange={(v) => set("ocasion", v)} />
                <Campo id="f-temporada" titulo="Temporada" valor={f.temporada} onChange={(v) => set("temporada", v)} />
                <Campo id="f-genero" titulo="Para quién" valor={f.genero} onChange={(v) => set("genero", v)} />
                <Campo id="f-duracion" titulo="Duración (rango)" valor={f.duracion} onChange={(v) => set("duracion", v)} placeholder="6 a 8 horas en piel" />
              </div>
              <Campo id="f-salida" titulo="Notas de salida" valor={lista(f.notasSalida)} onChange={(v) => set("notasSalida", aLista(v))} placeholder="separadas por coma" />
              <Campo id="f-corazon" titulo="Notas de corazón" valor={lista(f.notasCorazon)} onChange={(v) => set("notasCorazon", aLista(v))} />
              <Campo id="f-fondo" titulo="Notas de fondo" valor={lista(f.notasFondo)} onChange={(v) => set("notasFondo", aLista(v))} />
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="f-simple">En palabras simples</Label>
            <Textarea id="f-simple" rows={2} value={f.descripcionCotidiana ?? ""} onChange={(e) => set("descripcionCotidiana", e.target.value)} />
          </div>

          {!!f.fuentes?.length && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Fuentes que consultó el asistente</p>
              <ul className="space-y-0.5">
                {f.fuentes.map((s, i) => {
                  const url = s.match(/https?:\/\/\S+/)?.[0];
                  return (
                    <li key={i} className="truncate text-xs text-muted-foreground">
                      {url ? (
                        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                          <ExternalLink className="h-3 w-3" /> {s.replace(url, "").replace(/\s—\s*$/, "") || url}
                        </a>
                      ) : (
                        s
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => onGuardar(false)} disabled={guardar.isPending}>
            Guardar borrador
          </Button>
          <Button onClick={() => onGuardar(true)} disabled={guardar.isPending || largoValor > 20}>
            {guardar.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Aprobar
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function Campo({ id, titulo, valor, onChange, placeholder }: { id: string; titulo: string; valor?: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{titulo}</Label>
      <Input id={id} value={valor ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
