import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, ScrollText, ShieldAlert } from "lucide-react";

import { useStore } from "@/app/providers/auth";
import { ApiError } from "@/shared/api/client";
import { cn } from "@/shared/lib/cn";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ListaTarjetas, SoloEscritorio, TarjetaFila, FilaTitulo, FilaDatos } from "@/shared/ui/lista-tarjetas";
import { NativeSelect } from "@/shared/ui/native-select";
import { PageHeader } from "@/shared/ui/page-header";
import { PaginationControls } from "@/shared/ui/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

import { useBitacora, useOpcionesBitacora, type FiltrosBitacora, type RenglonBitacora } from "../api";

const ACCION: Record<RenglonBitacora["accion"], { texto: string; variant: "success" | "info" | "destructive" }> = {
  crear: { texto: "Creación", variant: "success" },
  editar: { texto: "Edición", variant: "info" },
  eliminar: { texto: "Eliminación", variant: "destructive" },
};

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-BO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

const quien = (r: RenglonBitacora) => r.usuario ?? r.email ?? (r.userId ? "Usuario eliminado" : "—");

type FiltrosPantalla = Omit<FiltrosBitacora, "limit" | "offset" | "storeId">;
const SIN_FILTROS: FiltrosPantalla = {};

/**
 * La bitácora del negocio (HU22): cada operación que cambió datos, quién la
 * hizo, cuándo, desde qué dirección y con qué datos. Solo lectura: nadie puede
 * editar ni borrar un renglón desde acá.
 */
export default function BitacoraView() {
  const { selectedStore } = useStore();
  const storeId = selectedStore === "all" ? undefined : selectedStore?.id || undefined;

  const [filtros, setFiltros] = useState<FiltrosPantalla>(SIN_FILTROS);
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(20);
  const [abierto, setAbierto] = useState<string | null>(null);

  // Otra tienda u otro filtro: de vuelta a la primera página.
  useEffect(() => setPagina(1), [storeId, filtros, porPagina]);

  const { data, isLoading, isFetching, error } = useBitacora({
    ...filtros,
    storeId,
    limit: porPagina,
    offset: (pagina - 1) * porPagina,
  });
  const opciones = useOpcionesBitacora(storeId);

  const renglones = data?.renglones ?? [];
  const total = data?.total ?? 0;
  const conFiltros = Object.values(filtros).some(Boolean);
  const cambiar = (clave: keyof FiltrosPantalla, valor: string) => setFiltros((f) => ({ ...f, [clave]: valor || undefined }));
  const alternar = (id: string) => setAbierto((a) => (a === id ? null : id));

  if (error) {
    const sinPermiso = error instanceof ApiError && error.statusCode === 403;
    return (
      <div className="space-y-6">
        <PageHeader title="Bitácora" />
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-12 text-center">
          <ShieldAlert className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">{sinPermiso ? "Tu rol no tiene permiso para ver la bitácora" : "No se pudo cargar la bitácora"}</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {sinPermiso
              ? "La ve el dueño del negocio. Si la necesitas, pídele que te dé el permiso «Gestionar bitácora»."
              : error.message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bitácora"
        description="Cada cambio que se hizo en tu negocio: quién lo hizo, cuándo y con qué datos. Las consultas no se registran; los registros se guardan un año."
        stats={[{ value: total.toLocaleString("es-BO"), label: total === 1 ? "registro" : "registros" }]}
      />

      {/* Filtros */}
      <div className="grid grid-cols-2 gap-3 rounded-xl border bg-card p-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="space-y-1.5">
          <Label htmlFor="bitacora-desde">Desde</Label>
          <Input id="bitacora-desde" type="date" value={filtros.desde ?? ""} max={filtros.hasta} onChange={(e) => cambiar("desde", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bitacora-hasta">Hasta</Label>
          <Input id="bitacora-hasta" type="date" value={filtros.hasta ?? ""} min={filtros.desde} onChange={(e) => cambiar("hasta", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bitacora-usuario">Usuario</Label>
          <NativeSelect id="bitacora-usuario" value={filtros.userId ?? ""} onChange={(e) => cambiar("userId", e.target.value)}>
            <option value="">Todos</option>
            {opciones.data?.usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bitacora-accion">Tipo</Label>
          <NativeSelect id="bitacora-accion" value={filtros.accion ?? ""} onChange={(e) => cambiar("accion", e.target.value)}>
            <option value="">Todos</option>
            <option value="crear">Creaciones</option>
            <option value="editar">Ediciones</option>
            <option value="eliminar">Eliminaciones</option>
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bitacora-modulo">Módulo</Label>
          <NativeSelect id="bitacora-modulo" value={filtros.modulo ?? ""} onChange={(e) => cambiar("modulo", e.target.value)}>
            <option value="">Todos</option>
            {opciones.data?.modulos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bitacora-resultado">Resultado</Label>
          <NativeSelect
            id="bitacora-resultado"
            value={filtros.fallidas ?? ""}
            onChange={(e) => cambiar("fallidas", e.target.value)}
          >
            <option value="">Todos</option>
            <option value="no">Se hizo</option>
            <option value="si">Falló</option>
          </NativeSelect>
        </div>
        {conFiltros && (
          <div className="col-span-full flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setFiltros(SIN_FILTROS)}>
              Quitar filtros
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : renglones.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-12 text-center">
          <ScrollText className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">{conFiltros ? "Nada con estos filtros" : "Todavía no hay operaciones registradas"}</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {conFiltros
              ? "Prueba con otras fechas o quita algún filtro."
              : "Cuando alguien cree, edite o elimine algo en tu negocio, va a aparecer acá."}
          </p>
        </div>
      ) : (
        <div className={cn("rounded-lg md:border", isFetching && "opacity-70 transition-opacity")}>
          <SoloEscritorio>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Fecha y hora</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Operación</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renglones.map((r) => (
                  <Fragment key={r.id}>
                    <TableRow className="cursor-pointer" onClick={() => alternar(r.id)} aria-expanded={abierto === r.id}>
                      <TableCell>
                        {abierto === r.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{fechaHora(r.fecha)}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{quien(r)}</div>
                        {r.rol && <div className="text-xs text-muted-foreground">{r.rol}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{r.descripcion}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.moduloNombre}
                          {r.tienda && !storeId ? ` · ${r.tienda}` : ""}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ACCION[r.accion]?.variant ?? "secondary"}>{ACCION[r.accion]?.texto ?? r.accion}</Badge>
                      </TableCell>
                      <TableCell>
                        <Resultado r={r} />
                      </TableCell>
                    </TableRow>
                    {abierto === r.id && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell />
                        <TableCell colSpan={5}>
                          <Detalle r={r} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </SoloEscritorio>

          <ListaTarjetas className="pb-2">
            {renglones.map((r) => (
              <TarjetaFila key={r.id} onClick={() => alternar(r.id)}>
                <FilaTitulo titulo={r.descripcion} subtitulo={`${quien(r)} · ${fechaHora(r.fecha)}`} derecha={<Resultado r={r} />} />
                <FilaDatos
                  datos={[
                    { etiqueta: "Tipo", valor: ACCION[r.accion]?.texto ?? r.accion },
                    { etiqueta: "Módulo", valor: r.moduloNombre },
                  ]}
                />
                {abierto === r.id && <Detalle r={r} />}
              </TarjetaFila>
            ))}
          </ListaTarjetas>

          <div className="border-t p-4">
            <PaginationControls
              currentPage={pagina}
              totalPages={Math.max(1, Math.ceil(total / porPagina))}
              pageSize={porPagina}
              totalItems={total}
              onPageChange={setPagina}
              onPageSizeChange={setPorPagina}
              pageSizeOptions={[20, 50, 100]}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Resultado({ r }: { r: RenglonBitacora }) {
  return r.exito ? (
    <Badge variant="success">Se hizo</Badge>
  ) : (
    <Badge variant="destructive" title={`Código ${r.estado}`}>
      Falló ({r.estado})
    </Badge>
  );
}

/** Lo que no entra en la fila: dónde, desde qué IP y qué datos viajaron. */
function Detalle({ r }: { r: RenglonBitacora }) {
  const datos = [
    { etiqueta: "Dirección", valor: `${r.metodo} ${r.url}` },
    { etiqueta: "Tienda", valor: r.tienda ?? "—" },
    { etiqueta: "IP", valor: r.ip ?? "—" },
    { etiqueta: "Duración", valor: r.duracionMs != null ? `${r.duracionMs} ms` : "—" },
  ];
  return (
    <div className="mt-2 space-y-3 text-left">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {datos.map((d) => (
          <div key={d.etiqueta} className="flex min-w-0 gap-2">
            <dt className="shrink-0 text-muted-foreground">{d.etiqueta}:</dt>
            <dd className="min-w-0 break-all">{d.valor}</dd>
          </div>
        ))}
      </dl>
      {r.datos != null ? (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Datos enviados (sin contraseñas ni claves)</p>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(r.datos, null, 2)}
          </pre>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No se enviaron datos.</p>
      )}
    </div>
  );
}
