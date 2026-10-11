import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowUpRight, Globe2, Minus, PackagePlus, Plus, ScanBarcode, Sparkles } from "lucide-react";

import { mejorarFotoConIa, subirFotoProducto, useBrands, useCategories } from "@/entities/product/api";
import type { FichaIa, ResultadoEscaneo } from "@/entities/product/model/escaneo";
import { NOMBRE_FUENTE_CATALOGO } from "@/entities/product/model/escaneo";
import { ApiError } from "@/shared/api/client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { NativeSelect } from "@/shared/ui/native-select";
import {
  ResponsiveDialogBody,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/shared/ui/responsive-dialog";
import { cn } from "@/shared/lib/cn";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import type { ContextoHoja } from "../model/ScannerProvider";
import { sonar } from "../model/sonido";
import { useEnriquecimientoIa } from "../model/useEnriquecimientoIa";
import { FichaEditor } from "./FichaEditor";
import { FotoHero, type FuenteFoto } from "./FotoHero";
import { aparece, escalonado } from "./piezas";

/** Lo que la hoja manda a crear: ya resuelto si marca y categoría existen o son nuevas. */
export interface DatosAlta {
  name: string;
  price: number;
  initialStock: number;
  storeId: string;
  brandId?: string;
  brandName?: string;
  categoryId?: string;
  categoryName?: string;
  description?: string;
  imageUrl?: string;
  tags: string[];
  specifications: Record<string, string>;
}

interface Props {
  resultado: ResultadoEscaneo;
  contexto: ContextoHoja;
  tiendas: Array<{ id: string; name: string }>;
  tiendaId: string | null;
  guardando: boolean;
  error: string | null;
  onRegistrar: (datos: DatosAlta) => void;
  onCompletar: (datos: Partial<DatosAlta>) => void;
}

const ATAJOS_STOCK = [6, 12, 24];

/** Para comparar nombres: "Dulces y Mermeladas" = "dulces y mermeladas". */
const normal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

function especificacionesIniciales(ficha: FichaIa | null | undefined, cantidad: string | null | undefined) {
  if (ficha && Object.keys(ficha.especificaciones).length) return Object.entries(ficha.especificaciones);
  return cantidad ? ([["Contenido", cantidad]] as Array<[string, string]>) : [];
}

/**
 * Registrar un producto escaneado aprovechando todo lo que se sabe de él.
 *
 * Si el catálogo lo conoce, llega con la foto (mejorada por la IA la primera
 * vez que alguien lo escanea), la marca, la categoría y la ficha completa
 * —descripción, etiquetas, especificaciones— en español. El comercio solo
 * pone el precio. Si nadie lo conoce, nombre y precio; la foto la saca con el
 * celular y la IA la deja profesional.
 */
export function VistaAlta({ resultado, contexto, tiendas, tiendaId, guardando, error, onRegistrar, onCompletar }: Props) {
  const s = resultado.sugerencia;
  const enCaja = contexto === "caja";
  // En una compra la cantidad es lo comprado: entra a la compra, no como stock.
  const enCompra = contexto === "compra";
  const { ia, generando: iaGenerando } = useEnriquecimientoIa(resultado);
  const ficha = ia?.ficha ?? null;

  const { data: marcas = [] } = useBrands();
  const { data: categorias = [] } = useCategories(tiendaId ?? undefined);

  // ─── Campos ──────────────────────────────────────────────────────────
  const [nombre, setNombre] = useState(ficha?.nombre ?? s?.nombre ?? "");
  const [marca, setMarca] = useState(ficha?.marca ?? s?.marca ?? "");
  const [categoria, setCategoria] = useState(ficha?.categoria ?? "");
  const [precio, setPrecio] = useState("");
  const [stock, setStock] = useState(enCaja || enCompra ? 1 : 0);
  const [tienda, setTienda] = useState(tiendaId ?? "");
  const [descripcion, setDescripcion] = useState(ficha?.descripcion ?? "");
  const [etiquetas, setEtiquetas] = useState<string[]>(ficha?.etiquetas ?? []);
  const [especificaciones, setEspecificaciones] = useState(() => especificacionesIniciales(ficha, s?.cantidad));
  const [intentado, setIntentado] = useState(false);
  // Lo que el comercio tocó no lo pisa la ficha cuando llega.
  const tocado = useRef(new Set<string>());
  const tocar = (campo: string) => tocado.current.add(campo);

  // ─── Foto ────────────────────────────────────────────────────────────
  const original = s?.imagenUrl ?? null;
  const [propia, setPropia] = useState<string | null>(null);
  const [mejoradaPropia, setMejoradaPropia] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [mejorandoPropia, setMejorandoPropia] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const mejorada = mejoradaPropia ?? ia?.imagenUrl ?? null;
  const [seleccion, setSeleccion] = useState<FuenteFoto | null>(
    ia?.imagenUrl ? "ia" : original ? "original" : null,
  );
  const eligioFoto = useRef(false);

  // Cuando la IA termina, la foto mejorada pasa al frente (si el comercio no
  // eligió otra) y la ficha completa lo que no se tocó.
  const estadoPrevio = useRef(ia?.estado);
  useEffect(() => {
    if (ia?.estado !== "listo" || estadoPrevio.current === "listo") return;
    estadoPrevio.current = "listo";
    if (ia.imagenUrl && !eligioFoto.current) setSeleccion("ia");
    if (ia.imagenUrl) sonar("sugerido");
    const f = ia.ficha;
    if (!f) return;
    const t = tocado.current;
    if (f.nombre && !t.has("nombre")) setNombre(f.nombre);
    if (f.marca && !t.has("marca")) setMarca(f.marca);
    if (f.categoria && !t.has("categoria")) setCategoria(f.categoria);
    if (f.descripcion && !t.has("descripcion")) setDescripcion(f.descripcion);
    if (f.etiquetas.length && !t.has("etiquetas")) setEtiquetas(f.etiquetas);
    if (Object.keys(f.especificaciones).length && !t.has("especificaciones")) {
      setEspecificaciones(Object.entries(f.especificaciones));
    }
  }, [ia]);

  // La categoría que propone la IA, con el nombre que el comercio ya usa si coincide.
  useEffect(() => {
    if (!categoria || tocado.current.has("categoria")) return;
    const igual = categorias.find((c) => {
      const a = normal(c.name);
      const b = normal(categoria);
      return a === b || a.includes(b) || b.includes(a);
    });
    if (igual && igual.name !== categoria) setCategoria(igual.name);
  }, [categoria, categorias]);

  const marcaExistente = useMemo(() => marcas.find((m) => normal(m.name) === normal(marca)), [marcas, marca]);
  const categoriaExistente = useMemo(
    () => categorias.find((c) => normal(c.name) === normal(categoria)),
    [categorias, categoria],
  );

  // El foco va a lo único que falta: el precio si el nombre ya vino. Solo en
  // escritorio: en el celular abriría el teclado tapando la foto, que es lo
  // primero que hay que ver. Y sin desplazar nada (`preventScroll`): el
  // navegador movía la hoja entera para mostrar el campo.
  const esMovil = useIsMobile();
  const precioRef = useRef<HTMLInputElement>(null);
  const nombreRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (esMovil) return;
    const t = setTimeout(() => (s ? precioRef.current : nombreRef.current)?.focus({ preventScroll: true }), 300);
    return () => clearTimeout(t);
  }, [s, esMovil]);

  const subir = async (archivo: File) => {
    setErrorFoto(null);
    setSubiendo(true);
    try {
      const url = await subirFotoProducto(archivo);
      setPropia(url);
      setMejoradaPropia(null);
      setSeleccion("propia");
      eligioFoto.current = true;
    } catch (e) {
      setErrorFoto(e instanceof ApiError ? e.message : "No se pudo subir la foto.");
    } finally {
      setSubiendo(false);
    }
  };

  const mejorarPropia = async () => {
    if (!propia) return;
    setErrorFoto(null);
    setMejorandoPropia(true);
    try {
      const url = await mejorarFotoConIa({ imagenUrl: propia, codigo: resultado.codigo, nombre: nombre || undefined });
      setMejoradaPropia(url);
      setSeleccion("ia");
      sonar("sugerido");
    } catch (e) {
      setErrorFoto(e instanceof ApiError ? e.message : "No se pudo mejorar la foto. Probá de nuevo.");
    } finally {
      setMejorandoPropia(false);
    }
  };

  const precioNumero = Number(precio.replace(",", "."));
  const faltaNombre = !nombre.trim();
  const faltaPrecio = !(precioNumero > 0);
  const faltaTienda = !tienda;
  const imagenElegida =
    seleccion === "ia" ? mejorada : seleccion === "propia" ? propia : seleccion === "original" ? original : null;

  const datos = (): DatosAlta => ({
    name: nombre.trim(),
    price: precioNumero,
    initialStock: stock,
    storeId: tienda,
    ...(marca.trim() ? (marcaExistente ? { brandId: marcaExistente.id } : { brandName: marca.trim() }) : {}),
    ...(categoria.trim()
      ? categoriaExistente
        ? { categoryId: categoriaExistente.id }
        : { categoryName: categoria.trim() }
      : {}),
    description: descripcion.trim() || undefined,
    imageUrl: imagenElegida ?? undefined,
    tags: etiquetas,
    specifications: Object.fromEntries(especificaciones),
  });

  const enviar = (e?: React.FormEvent) => {
    e?.preventDefault();
    setIntentado(true);
    if (faltaNombre || faltaPrecio || faltaTienda) return;
    onRegistrar(datos());
  };

  return (
    <motion.form
      key={`alta-${resultado.codigo}`}
      onSubmit={enviar}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.22 }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <ResponsiveDialogHeader className="pb-3">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          className={cn(
            "mb-1 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
            s ? "bg-primary-soft text-primary-soft-foreground" : "bg-warning-soft text-warning-soft-foreground",
          )}
        >
          {s ? <Sparkles className="size-3.5" aria-hidden /> : <PackagePlus className="size-3.5" aria-hidden />}
          {s ? "Lo encontramos en el catálogo" : "Producto nuevo"}
        </motion.div>
        <ResponsiveDialogTitle className="pr-16 text-xl">
          {s ? "Ya lo completamos por vos. Solo poné el precio" : "Nadie lo cargó todavía"}
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          {s
            ? "Foto, marca, categoría y ficha salen de lo que sabemos de este código. Revisá lo que quieras y registralo."
            : "Con nombre y precio ya se puede vender. Una foto y la ficha lo hacen lucir en tu tienda online."}
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>

      <ResponsiveDialogBody className="pb-5">
        <div className="grid gap-5 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)] md:gap-6">
          {/* ── Foto ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="mx-auto w-full max-w-[320px] space-y-3 md:sticky md:top-0 md:max-w-none md:self-start"
          >
            <FotoHero
              original={original}
              mejorada={mejorada}
              propia={propia}
              seleccion={seleccion}
              onSeleccion={(f) => {
                eligioFoto.current = true;
                setSeleccion(f);
              }}
              generando={(iaGenerando && !mejoradaPropia && seleccion !== "propia") || mejorandoPropia}
              subiendo={subiendo}
              onSubir={subir}
              onMejorarPropia={mejorarPropia}
              alt={nombre || "Producto"}
            />
            {errorFoto && <p className="text-xs text-destructive">{errorFoto}</p>}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-mono">
                <ScanBarcode className="size-3" aria-hidden />
                {resultado.codigoLegible}
              </span>
              {resultado.pais && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                  <Globe2 className="size-3" aria-hidden />
                  {resultado.pais}
                </span>
              )}
              {s?.fuentes.slice(0, 2).map((f) => (
                <span key={f} className="rounded-full bg-muted px-2 py-0.5">
                  {NOMBRE_FUENTE_CATALOGO[f] ?? f}
                </span>
              ))}
            </div>
          </motion.div>

          {/* ── Datos ── */}
          <motion.div variants={escalonado} initial="oculto" animate="visible" className="min-w-0 space-y-4">
            <motion.div variants={aparece} className="space-y-1.5">
              <Label htmlFor="escaner-nombre">Nombre</Label>
              <Input
                id="escaner-nombre"
                ref={nombreRef}
                value={nombre}
                onChange={(e) => {
                  tocar("nombre");
                  setNombre(e.target.value);
                }}
                placeholder="Ej.: Coca-Cola 2 L"
                maxLength={100}
                aria-invalid={intentado && faltaNombre}
                autoComplete="off"
                className="h-11 text-base font-medium"
              />
              {intentado && faltaNombre && <p className="text-xs text-destructive">Ponele un nombre.</p>}
            </motion.div>

            <motion.div variants={aparece} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="escaner-marca">Marca</Label>
                <Input
                  id="escaner-marca"
                  list="escaner-marcas"
                  value={marca}
                  onChange={(e) => {
                    tocar("marca");
                    setMarca(e.target.value);
                  }}
                  placeholder="Ej.: Arcor"
                  maxLength={100}
                  autoComplete="off"
                />
                <datalist id="escaner-marcas">
                  {marcas.map((m) => (
                    <option key={m.id} value={m.name} />
                  ))}
                </datalist>
                {marca.trim() && !marcaExistente && (
                  <p className="text-[11px] text-muted-foreground">Marca nueva: se crea al registrar.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="escaner-categoria">Categoría</Label>
                <Input
                  id="escaner-categoria"
                  list="escaner-categorias"
                  value={categoria}
                  onChange={(e) => {
                    tocar("categoria");
                    setCategoria(e.target.value);
                  }}
                  placeholder={iaGenerando && !categoria ? "Buscando la mejor…" : "Ej.: Bebidas"}
                  maxLength={100}
                  autoComplete="off"
                />
                <datalist id="escaner-categorias">
                  {categorias.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                </datalist>
                {categoria.trim() && !categoriaExistente && (
                  <p className="text-[11px] text-muted-foreground">Categoría nueva: se crea al registrar.</p>
                )}
              </div>
            </motion.div>

            <motion.div variants={aparece} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="escaner-precio">Precio de venta</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                    Bs
                  </span>
                  <Input
                    id="escaner-precio"
                    ref={precioRef}
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value.replace(/[^\d.,]/g, ""))}
                    inputMode="decimal"
                    placeholder="0,00"
                    className="h-12 pl-10 font-display text-xl font-semibold tabular-nums"
                    aria-invalid={intentado && faltaPrecio}
                    autoComplete="off"
                  />
                </div>
                {intentado && faltaPrecio && <p className="text-xs text-destructive">¿A cuánto lo vendés?</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="escaner-stock">{enCompra ? "¿Cuántos compraste?" : "¿Cuántos tenés?"}</Label>
                <div className="flex h-12 items-center gap-1 rounded-lg border border-input bg-card p-1">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Uno menos" onClick={() => setStock((n) => Math.max(enCompra ? 1 : 0, n - 1))}>
                    <Minus aria-hidden />
                  </Button>
                  <input
                    id="escaner-stock"
                    value={stock}
                    onChange={(e) => setStock(Math.max(0, parseInt(e.target.value.replace(/\D/g, "") || "0", 10)))}
                    inputMode="numeric"
                    className="w-full min-w-0 bg-transparent text-center font-mono text-lg font-semibold tabular-nums outline-none"
                  />
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Uno más" onClick={() => setStock((n) => n + 1)}>
                    <Plus aria-hidden />
                  </Button>
                </div>
                <div className="flex gap-1">
                  {ATAJOS_STOCK.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setStock(n)}
                      className={cn(
                        "flex-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        stock === n ? "border-primary bg-primary-soft text-primary-soft-foreground" : "border-border hover:bg-muted",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Solo si arriba está "Todas las tiendas": con una elegida, va a esa. */}
            {!tiendaId && tiendas.length > 1 && (
              <motion.div variants={aparece} className="space-y-1.5">
                <Label htmlFor="escaner-tienda">Tienda</Label>
                <NativeSelect
                  id="escaner-tienda"
                  value={tienda}
                  onChange={(e) => setTienda(e.target.value)}
                  aria-invalid={intentado && faltaTienda}
                >
                  <option value="">Elegí la tienda</option>
                  {tiendas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </NativeSelect>
                {intentado && faltaTienda && <p className="text-xs text-destructive">¿En qué tienda lo vendés?</p>}
              </motion.div>
            )}

            <motion.div variants={aparece}>
              <FichaEditor
                descripcion={descripcion}
                onDescripcion={(v) => {
                  tocar("descripcion");
                  setDescripcion(v);
                }}
                etiquetas={etiquetas}
                onEtiquetas={(v) => {
                  tocar("etiquetas");
                  setEtiquetas(v);
                }}
                especificaciones={especificaciones}
                onEspecificaciones={(v) => {
                  tocar("especificaciones");
                  setEspecificaciones(v);
                }}
                cargando={iaGenerando && !ficha}
                deIa={!!ficha}
              />
            </motion.div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground"
                role="alert"
              >
                {error}
              </motion.p>
            )}
          </motion.div>
        </div>
      </ResponsiveDialogBody>

      <ResponsiveDialogFooter className="md:items-center">
        <Button type="button" variant="ghost" className="md:mr-auto" onClick={() => onCompletar(datos())}>
          Abrir el formulario completo
          <ArrowUpRight aria-hidden />
        </Button>
        <Button type="submit" size="lg" loading={guardando} className="md:min-w-60">
          {!guardando && <PackagePlus aria-hidden />}
          {enCaja ? "Registrar y agregar a la venta" : enCompra ? "Registrar y agregar a la compra" : "Registrar producto"}
        </Button>
      </ResponsiveDialogFooter>
    </motion.form>
  );
}
