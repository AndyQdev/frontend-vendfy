import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Archive, Image as ImageIcon, MapPin, Pause, Play, RefreshCw, Rocket, Sparkles, Wallet } from "lucide-react";
import { PageHeader } from "@/shared/ui/page-header";
import { Card } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Switch } from "@/shared/ui/switch";
import { Skeleton } from "@/shared/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { useStore } from "@/app/providers/auth";
import { useAcceso } from "@/app/providers/acceso";
import { PERMISO } from "@/shared/acceso/permisos";
import {
  useAccionCampana,
  useArchivarCampana,
  useCampana,
  useEditarCampana,
  useEmbudoLeads,
  usePresupuestoCampana,
} from "@/entities/marketing/api";
import { ESTADO_CAMPANA, bs, type Campana, type Creativo, type Publico } from "@/entities/marketing/model/types";
import { SelectorProductos, type ProductoElegible } from "@/features/promotions/ui/SelectorProductos";
import { DialogImagenIa } from "@/features/promotions/ui/DialogImagenIa";
import { RangoEstimado, EmbudoBarras } from "@/features/marketing/ui/Estimacion";
import { TableroChats } from "@/features/marketing/ui/TableroChats";

/** Durante el piloto, lo más que una campaña gasta por día (el servidor también lo controla). */
const TOPE_PILOTO = 40;

interface Formulario {
  nombre: string;
  productos: ProductoElegible[];
  bolivia: boolean;
  radioKm: number;
  edadMin: number;
  edadMax: number;
  presupuestoDiario: number;
  dias: number;
  titulo: string;
  texto: string;
  imagen: string | null;
  saludo: string;
  preguntas: string[];
}

function formularioDe(c: Campana): Formulario {
  return {
    nombre: c.nombre,
    productos: c.productos.map((p) => ({ productId: p.id, storeProductId: p.id, nombre: p.nombre, imagen: p.imagen, precio: p.precio })),
    bolivia: !c.publico?.ubicacion,
    radioKm: c.publico?.ubicacion?.radioKm ?? 25,
    edadMin: c.publico?.edadMin ?? 18,
    edadMax: c.publico?.edadMax ?? 65,
    presupuestoDiario: c.presupuestoDiario ?? 35,
    dias: c.dias ?? 7,
    titulo: c.creativo?.titulo ?? "",
    texto: c.creativo?.texto ?? "",
    imagen: c.creativo?.imagen ?? null,
    saludo: c.creativo?.saludo ?? "",
    preguntas: c.creativo?.preguntas ?? [],
  };
}

/**
 * Una campaña: el borrador que se ajusta antes de crearlo en Meta, y después
 * su seguimiento (gasto, quién escribió, quién compró y el retorno real).
 */
export default function CampanaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { selectedStore } = useStore();
  const tienda = selectedStore && selectedStore !== "all" ? selectedStore : null;
  const storeId = tienda?.id;
  const puedeGestionar = useAcceso().puede(PERMISO.GESTIONAR_MARKETING);
  const puedeChats = useAcceso().puede(PERMISO.GESTIONAR_WHATSAPP);

  const { data: c, isLoading } = useCampana(storeId, id);
  const editar = useEditarCampana(storeId, id);
  const accion = useAccionCampana(storeId, id);
  const presupuesto = usePresupuestoCampana(storeId, id);
  const archivar = useArchivarCampana(storeId);
  const embudo = useEmbudoLeads(storeId, { anuncios: c?.externo.adIds.length ? c.externo.adIds : ["-"], dias: 365 });

  const [f, setF] = useState<Formulario | null>(null);
  const [imagenIa, setImagenIa] = useState(false);
  const [confirmar, setConfirmar] = useState<null | "activar" | "publicar" | "archivar" | "presupuesto">(null);
  const [nuevoPresupuesto, setNuevoPresupuesto] = useState<number>(0);

  useEffect(() => {
    if (c) setF(formularioDe(c));
  }, [c?.id, c?.estado]);

  const esBorrador = c?.estado === "borrador" || c?.estado === "error";
  const cambiado = useMemo(() => (c && f ? JSON.stringify(formularioDe(c)) !== JSON.stringify(f) : false), [c, f]);

  if (!tienda) return <p className="text-sm text-muted-foreground">Elige una tienda arriba.</p>;
  if (isLoading || !c || !f) return <Skeleton className="h-96 rounded-xl" />;

  const set = <K extends keyof Formulario>(k: K, v: Formulario[K]) => setF((x) => (x ? { ...x, [k]: v } : x));
  const ubicacionTienda = c.publico?.ubicacion ?? null;

  const guardar = async () => {
    const publico: Publico = f.bolivia || !ubicacionTienda
      ? { tipo: "ubicacion", paises: ["BO"], edadMin: f.edadMin, edadMax: f.edadMax, descripcion: `Toda Bolivia · ${f.edadMin} a ${f.edadMax} años` }
      : {
          tipo: "ubicacion",
          ubicacion: { ...ubicacionTienda, radioKm: f.radioKm },
          edadMin: f.edadMin,
          edadMax: f.edadMax,
          descripcion: `${/^(alrededor|la tienda)/i.test(ubicacionTienda.nombre) ? "Alrededor de la tienda" : ubicacionTienda.nombre} (${f.radioKm} km) · ${f.edadMin} a ${f.edadMax} años`,
        };
    const creativo: Partial<Creativo> = { titulo: f.titulo, texto: f.texto, imagen: f.imagen, saludo: f.saludo, preguntas: f.preguntas.filter(Boolean) };
    try {
      const nueva = await editar.mutateAsync({
        nombre: f.nombre,
        productos: f.productos.map((p) => p.storeProductId),
        publico,
        creativo,
        presupuestoDiario: f.presupuestoDiario,
        dias: f.dias,
      });
      // Lo que guardó el servidor (normalizado) pasa a ser el formulario: así
      // «Crear en Meta» se habilita sin esperar a que se recargue la campaña.
      if (nueva) setF(formularioDe(nueva));
      toast.success("Borrador guardado");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar");
    }
  };

  const ejecutar = async (a: "publicar" | "activar" | "pausar" | "sincronizar") => {
    try {
      await accion.mutateAsync(a);
      toast.success(
        { publicar: "Creada en Meta, en pausa. Revísala y actívala cuando quieras.", activar: "Activada: Meta la revisa y empieza a mostrarse", pausar: "Pausada: ya no gasta", sincronizar: "Datos al día" }[a],
      );
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo");
    }
  };

  const estado = ESTADO_CAMPANA[c.estado];
  const m = c.metricas;
  const escribieron = Math.max(m.conversaciones, m.personas);
  const imagenesProducto = f.productos.map((p) => p.imagen).filter((x): x is string => !!x);

  return (
    <div className="space-y-5">
      <Link to="/marketing?tab=campanas" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Campañas
      </Link>
      <PageHeader
        title={c.nombre}
        description={c.idea ? c.idea.porque : c.origen === "importada" ? "Traída de tu cuenta de Meta" : undefined}
        actions={<Badge variant={estado.variant}>{estado.texto}</Badge>}
      />

      {c.ultimoError && (
        <div role="alert" className="rounded-xl border border-destructive-soft bg-destructive-soft px-4 py-3 text-sm text-destructive-soft-foreground">
          {c.ultimoError}
        </div>
      )}

      {esBorrador ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
          <div className="space-y-4">
            <Card className="space-y-4 p-5">
              <div className="space-y-1.5">
                <Label htmlFor="c-nombre">Nombre de la campaña</Label>
                <Input id="c-nombre" value={f.nombre} maxLength={120} disabled={!puedeGestionar} onChange={(e) => set("nombre", e.target.value)} />
              </div>
              {c.canal === "ctwa" && (
                <div className="space-y-1.5">
                  <Label>Qué vendes</Label>
                  <SelectorProductos storeId={tienda.id} value={f.productos} onChange={(p) => set("productos", p)} max={2} />
                </div>
              )}
            </Card>

            {c.canal === "ctwa" && (
              <>
                <Card className="space-y-4 p-5">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <MapPin className="h-4 w-4" /> A quién se le muestra
                  </h3>
                  {ubicacionTienda && (
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="c-bolivia">
                        En toda Bolivia (si no, a {f.radioKm} km de {/^alrededor/i.test(ubicacionTienda.nombre) ? "la tienda" : ubicacionTienda.nombre})
                      </Label>
                      <Switch id="c-bolivia" checked={f.bolivia} onCheckedChange={(v) => set("bolivia", v)} disabled={!puedeGestionar} />
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-3">
                    {!f.bolivia && ubicacionTienda && (
                      <div className="space-y-1.5">
                        <Label htmlFor="c-radio">Radio (km)</Label>
                        <Input id="c-radio" type="number" min={1} max={80} value={f.radioKm} disabled={!puedeGestionar} onChange={(e) => set("radioKm", Number(e.target.value))} />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label htmlFor="c-edadmin">Edad desde</Label>
                      <Input id="c-edadmin" type="number" min={18} max={65} value={f.edadMin} disabled={!puedeGestionar} onChange={(e) => set("edadMin", Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="c-edadmax">Edad hasta</Label>
                      <Input id="c-edadmax" type="number" min={18} max={65} value={f.edadMax} disabled={!puedeGestionar} onChange={(e) => set("edadMax", Number(e.target.value))} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Meta también amplía el público solo si encuentra gente con más chances de escribir (Advantage+).</p>
                </Card>

                <Card className="space-y-4 p-5">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <Wallet className="h-4 w-4" /> Cuánto invertir
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="c-presupuesto">Bs por día</Label>
                      <Input id="c-presupuesto" type="number" min={5} max={TOPE_PILOTO} value={f.presupuestoDiario} disabled={!puedeGestionar} onChange={(e) => set("presupuestoDiario", Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="c-dias">Días</Label>
                      <Input id="c-dias" type="number" min={1} max={30} value={f.dias} disabled={!puedeGestionar} onChange={(e) => set("dias", Number(e.target.value))} />
                    </div>
                    <div className="space-y-1.5">
                      <span className="etiqueta text-muted-foreground">En total</span>
                      <p className="cifra pt-2 text-lg font-bold">{bs(f.presupuestoDiario * f.dias)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Durante el piloto, una campaña gasta como máximo Bs {TOPE_PILOTO} por día.</p>
                </Card>

                <Card className="space-y-4 p-5">
                  <h3 className="font-semibold">El anuncio</h3>
                  <div className="space-y-1.5">
                    <Label htmlFor="c-titulo">Título (corto)</Label>
                    <Input id="c-titulo" value={f.titulo} maxLength={40} disabled={!puedeGestionar} onChange={(e) => set("titulo", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c-texto">Texto</Label>
                    <Textarea id="c-texto" rows={4} value={f.texto} maxLength={600} disabled={!puedeGestionar} onChange={(e) => set("texto", e.target.value)} />
                    <p className="text-xs text-muted-foreground">Sin precios: el precio cambia y el anuncio no se entera. El agente lo dice en el chat.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Imagen</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      {imagenesProducto.map((url) => (
                        <button
                          key={url}
                          type="button"
                          disabled={!puedeGestionar}
                          onClick={() => set("imagen", url)}
                          className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${f.imagen === url ? "border-primary" : "border-border"} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                          aria-label="Usar la foto del producto"
                        >
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                      {f.imagen && !imagenesProducto.includes(f.imagen) && (
                        <img src={f.imagen} alt="Imagen elegida" className="h-16 w-16 rounded-lg border-2 border-primary object-cover" />
                      )}
                      {puedeGestionar && (
                        <Button type="button" variant="outline" size="sm" onClick={() => setImagenIa(true)}>
                          <Sparkles className="mr-1.5 h-4 w-4" /> Crear con IA
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="c-saludo">Lo que la persona ve al abrir el chat</Label>
                    <Input id="c-saludo" value={f.saludo} maxLength={300} disabled={!puedeGestionar} onChange={(e) => set("saludo", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Preguntas rápidas (puede tocarlas en vez de escribir)</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[0, 1, 2, 3].map((i) => (
                        <Input
                          key={i}
                          aria-label={`Pregunta rápida ${i + 1}`}
                          value={f.preguntas[i] ?? ""}
                          maxLength={80}
                          disabled={!puedeGestionar}
                          onChange={(e) => {
                            const p = [...f.preguntas];
                            p[i] = e.target.value;
                            set("preguntas", p);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </Card>
              </>
            )}
          </div>

          <div className="space-y-4">
            <VistaPreviaAnuncio nombreTienda={tienda.name} titulo={f.titulo} texto={f.texto} imagen={f.imagen} saludo={f.saludo} />
            {c.estimacion && (
              <Card className="space-y-3 p-5">
                <h3 className="font-semibold">Lo que podría pasar</h3>
                <RangoEstimado e={c.estimacion} compacto />
                {cambiado && <p className="text-xs text-muted-foreground">Guarda para recalcular con los cambios.</p>}
              </Card>
            )}
            {puedeGestionar && (
              <Card className="space-y-3 p-5">
                {c.faltaParaPublicar.length > 0 && !cambiado && (
                  <ul className="space-y-1 text-xs text-warning-soft-foreground">
                    {c.faltaParaPublicar.map((x) => (
                      <li key={x}>· {x}</li>
                    ))}
                  </ul>
                )}
                <Button className="w-full" variant={cambiado ? "default" : "outline"} onClick={guardar} loading={editar.isPending} disabled={!cambiado}>
                  Guardar borrador
                </Button>
                {c.canal === "ctwa" && (
                  <Button
                    className="w-full"
                    variant={cambiado ? "outline" : "default"}
                    disabled={cambiado || c.faltaParaPublicar.length > 0}
                    loading={accion.isPending}
                    onClick={() => setConfirmar("publicar")}
                  >
                    <Rocket className="mr-1.5 h-4 w-4" /> Crear en Meta (en pausa)
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">Se crea pausada: no gasta nada hasta que la actives.</p>
                <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setConfirmar("archivar")}>
                  <Archive className="mr-1.5 h-4 w-4" /> Archivar
                </Button>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-6">
            {[
              { e: "Gastó", v: bs(m.gasto, c.moneda) },
              { e: "Escribieron", v: String(escribieron) },
              { e: "Costo por chat", v: bs(m.costoConversacion, c.moneda) },
              { e: "Compraron", v: String(m.compraron) },
              { e: "Vendió", v: bs(m.vendido) },
              { e: "ROAS", v: m.roas != null ? `${m.roas}×` : "—" },
            ].map((k) => (
              <Card key={k.e} className="p-4">
                <dt className="etiqueta text-muted-foreground">{k.e}</dt>
                <dd className="cifra mt-1 text-lg font-bold">{k.v}</dd>
              </Card>
            ))}
          </dl>

          {puedeGestionar && (
            <Card className="flex flex-wrap items-center gap-2 p-4">
              {c.estado === "pausada" && (
                <Button onClick={() => setConfirmar("activar")} loading={accion.isPending}>
                  <Play className="mr-1.5 h-4 w-4" /> Activar · gastará hasta {bs(c.presupuestoDiario, c.moneda)} por día
                </Button>
              )}
              {c.estado === "activa" && (
                <Button variant="outline" onClick={() => ejecutar("pausar")} loading={accion.isPending}>
                  <Pause className="mr-1.5 h-4 w-4" /> Pausar
                </Button>
              )}
              {c.origen === "vendfy" && (c.estado === "activa" || c.estado === "pausada") && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setNuevoPresupuesto(c.presupuestoDiario ?? 35);
                    setConfirmar("presupuesto");
                  }}
                >
                  <Wallet className="mr-1.5 h-4 w-4" /> Cambiar presupuesto
                </Button>
              )}
              <Button variant="ghost" onClick={() => ejecutar("sincronizar")} loading={accion.isPending}>
                <RefreshCw className="mr-1.5 h-4 w-4" /> Actualizar datos
              </Button>
              {c.ultimoSync && <span className="text-xs text-muted-foreground">Datos de Meta del {new Date(c.ultimoSync).toLocaleString("es-BO")}</span>}
              {c.estado !== "activa" && (
                <Button variant="ghost" className="ml-auto text-muted-foreground" onClick={() => setConfirmar("archivar")}>
                  <Archive className="mr-1.5 h-4 w-4" /> Archivar
                </Button>
              )}
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="mb-3 font-semibold">Camino a la venta de esta campaña</h3>
              {embudo.data && embudo.data.personas > 0 ? (
                <EmbudoBarras embudo={embudo.data} />
              ) : (
                <p className="text-sm text-muted-foreground">Todavía nadie escribió por sus anuncios.</p>
              )}
            </Card>
            {c.estimacion && (
              <Card className="p-5">
                <h3 className="mb-3 font-semibold">Lo que se estimó al armarla</h3>
                <RangoEstimado e={c.estimacion} compacto />
              </Card>
            )}
          </div>

          {c.porDia.length > 0 && (
            <Card className="overflow-x-auto p-5">
              <h3 className="mb-3 font-semibold">Día por día</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="etiqueta text-left text-muted-foreground">
                    <th className="py-1 pr-3">Día</th>
                    <th className="py-1 pr-3 text-right">Gastó</th>
                    <th className="py-1 pr-3 text-right">Impresiones</th>
                    <th className="py-1 pr-3 text-right">Clics</th>
                    <th className="py-1 text-right">Escribieron</th>
                  </tr>
                </thead>
                <tbody className="cifra">
                  {c.porDia.map((d) => (
                    <tr key={d.fecha} className="border-t border-border">
                      <td className="py-1.5 pr-3">{d.fecha}</td>
                      <td className="py-1.5 pr-3 text-right">{bs(d.gasto, c.moneda)}</td>
                      <td className="py-1.5 pr-3 text-right">{d.impresiones}</td>
                      <td className="py-1.5 pr-3 text-right">{d.clics}</td>
                      <td className="py-1.5 text-right">{d.conversaciones}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {c.externo.adIds.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Quiénes escribieron por esta campaña</h3>
              <TableroChats storeId={tienda.id} puedeGestionar={puedeChats} anunciosDeCampana={c.externo.adIds} tituloCampana={c.nombre} />
            </div>
          )}
        </div>
      )}

      {imagenIa && (
        <DialogImagenIa
          open={imagenIa}
          onOpenChange={setImagenIa}
          storeId={tienda.id}
          inicial={{ modo: f.productos.length > 1 ? "products" : f.productos.length ? "product" : "scratch", productos: f.productos }}
          onUsar={(img) => {
            set("imagen", img.url);
            setImagenIa(false);
          }}
        />
      )}

      <AlertDialog open={!!confirmar} onOpenChange={(o) => !o && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmar === "activar"
                ? "¿Activar la campaña?"
                : confirmar === "publicar"
                  ? "¿Crear la campaña en Meta?"
                  : confirmar === "presupuesto"
                    ? "Cambiar el presupuesto por día"
                    : "¿Archivar la campaña?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                {confirmar === "activar" && (
                  <>
                    Empieza a gastar hoy: hasta <b>{bs(c.presupuestoDiario, c.moneda)} por día</b>
                    {c.dias ? ` durante ${c.dias} días (${bs((c.presupuestoDiario ?? 0) * c.dias, c.moneda)} en total)` : ""}, con la tarjeta de
                    tu cuenta publicitaria. Puedes pausarla cuando quieras.
                  </>
                )}
                {confirmar === "publicar" && "Se crea en tu cuenta de Meta EN PAUSA: no gasta nada. Después la revisas y la activas con un toque."}
                {confirmar === "archivar" && "Sale de la lista. No se borra en Meta."}
                {confirmar === "presupuesto" && (
                  <div className="mt-3 space-y-1.5">
                    <Label htmlFor="c-nuevo-presupuesto">Bs por día (máximo {TOPE_PILOTO})</Label>
                    <Input
                      id="c-nuevo-presupuesto"
                      type="number"
                      min={5}
                      max={TOPE_PILOTO}
                      value={nuevoPresupuesto}
                      onChange={(e) => setNuevoPresupuesto(Number(e.target.value))}
                    />
                    {nuevoPresupuesto > (c.presupuestoDiario ?? 0) && <p className="text-xs">Subirlo hace que gaste más desde hoy.</p>}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const que = confirmar;
                setConfirmar(null);
                if (que === "activar") await ejecutar("activar");
                if (que === "publicar") await ejecutar("publicar");
                if (que === "presupuesto") {
                  try {
                    await presupuesto.mutateAsync(nuevoPresupuesto);
                    toast.success("Presupuesto cambiado");
                  } catch (e: any) {
                    toast.error(e?.message ?? "No se pudo cambiar");
                  }
                }
                if (que === "archivar") {
                  try {
                    await archivar.mutateAsync(c.id);
                    navigate("/marketing?tab=campanas");
                  } catch (e: any) {
                    toast.error(e?.message ?? "No se pudo archivar");
                  }
                }
              }}
            >
              {confirmar === "activar" ? "Sí, activar" : confirmar === "publicar" ? "Crear en pausa" : confirmar === "presupuesto" ? "Cambiar" : "Archivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Cómo se vería el anuncio en el celular y lo que aparece al abrir el chat. */
function VistaPreviaAnuncio({ nombreTienda, titulo, texto, imagen, saludo }: { nombreTienda: string; titulo: string; texto: string; imagen: string | null; saludo: string }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-tinta text-xs font-bold text-tinta-foreground">{nombreTienda.slice(0, 1)}</div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">{nombreTienda}</p>
          <p className="text-[11px] text-muted-foreground">Publicidad</p>
        </div>
      </div>
      <p className="whitespace-pre-line px-4 pb-3 text-sm">{texto || <span className="text-muted-foreground">El texto del anuncio…</span>}</p>
      <div className="flex aspect-square items-center justify-center bg-muted">
        {imagen ? <img src={imagen} alt="Imagen del anuncio" className="h-full w-full object-cover" /> : <ImageIcon className="h-8 w-8 text-muted-foreground" />}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
        <p className="truncate text-sm font-semibold">{titulo || "Título"}</p>
        <span className="shrink-0 rounded-md bg-[#25D366] px-2.5 py-1 text-xs font-semibold text-white">WhatsApp</span>
      </div>
      {saludo && (
        <div className="border-t border-border bg-muted/50 px-4 py-3">
          <p className="etiqueta mb-1 text-muted-foreground">Al abrir el chat</p>
          <p className="inline-block rounded-lg bg-card px-3 py-1.5 text-sm shadow-sm">{saludo}</p>
        </div>
      )}
    </Card>
  );
}
