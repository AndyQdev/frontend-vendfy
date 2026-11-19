import { useMemo, useState } from "react";
import { Copy, KeyRound, Pencil, Plus, ShieldCheck, Trash2, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";

import { useAcceso } from "@/app/providers/acceso";
import { useStores } from "@/entities/store/api";
import { BotonExportar } from "@/shared/ui/boton-exportar";
import { descargarExcel, fechaCelda, nombreArchivoListado } from "@/shared/lib/exportar-excel";
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
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { PageHeader } from "@/shared/ui/page-header";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/shared/ui/responsive-dialog";
import { Skeleton } from "@/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { cn } from "@/shared/lib/cn";

import {
  useCatalogoEquipo,
  useEditarMiembro,
  useEliminarMiembro,
  useEliminarRol,
  useEquipo,
  useRolesEquipo,
  type Miembro,
  type RolEquipo,
} from "../api";
import { MiembroDialog, type Credenciales } from "./MiembroDialog";
import { RolDialog } from "./RolDialog";

const iniciales = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

/**
 * EQUIPO (HU21): quién entra al panel del negocio, con qué rol y en qué
 * sucursales. Solo la ve el dueño.
 */
export function EquipoView() {
  const { data: equipo, isLoading } = useEquipo();
  const { data: roles = [] } = useRolesEquipo();
  useCatalogoEquipo(); // se pide ya: el diálogo de roles lo usa al abrir

  const [miembroAbierto, setMiembroAbierto] = useState<{ miembro: Miembro | null } | null>(null);
  const [credenciales, setCredenciales] = useState<Credenciales | null>(null);

  const lleno = equipo?.limiteUsuarios != null && equipo.usuariosActivos >= equipo.limiteUsuarios;

  // Excel del equipo: personas y roles, con lo que se ve en cada pestaña.
  const exportar = () => {
    const miembros = equipo?.miembros ?? [];
    descargarExcel(
      [
        {
          nombre: "Personas",
          columnas: [
            { titulo: "Nombre", tipo: "texto", ancho: 28 },
            { titulo: "Email", tipo: "texto", ancho: 30 },
            { titulo: "Teléfono", tipo: "texto", ancho: 18 },
            { titulo: "Rol", tipo: "texto", ancho: 20 },
            { titulo: "Dueño", tipo: "texto", ancho: 10 },
            { titulo: "Estado", tipo: "texto", ancho: 12 },
            { titulo: "Sucursales", tipo: "numero", ancho: 12 },
            { titulo: "Alta", tipo: "texto", ancho: 12 },
          ],
          filas: miembros.map((m) => [
            m.name,
            m.email,
            m.phoneNumber || "",
            m.rol?.name || "Sin rol",
            m.esDueno ? "Sí" : "No",
            m.activo ? "Activo" : "Inactivo",
            m.storeIds.length,
            fechaCelda(m.createdAt),
          ]),
        },
        {
          nombre: "Roles",
          columnas: [
            { titulo: "Rol", tipo: "texto", ancho: 24 },
            { titulo: "Descripción", tipo: "texto", ancho: 40 },
            { titulo: "Usuarios", tipo: "numero", ancho: 12 },
            { titulo: "Permisos", tipo: "numero", ancho: 12 },
            { titulo: "Origen", tipo: "texto", ancho: 14 },
          ],
          filas: roles.map((r) => [r.name, r.descripcion || "", r.usuarios, r.permisos.length, r.base ? "Vendfy" : "Propio"]),
        },
      ],
      nombreArchivoListado("equipo", null),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Equipo"
        description="Quién entra al panel de tu negocio, con qué rol y en qué sucursales."
        stats={
          equipo
            ? [
                {
                  value: equipo.limiteUsuarios != null ? `${equipo.usuariosActivos} de ${equipo.limiteUsuarios}` : equipo.usuariosActivos,
                  label: "usuarios",
                },
              ]
            : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BotonExportar onExportar={exportar} size="sm" disabled={isLoading} />
            <Button onClick={() => setMiembroAbierto({ miembro: null })} disabled={lleno || !roles.length} className="gap-1.5">
              <Plus className="size-4" /> Agregar persona
            </Button>
          </div>
        }
      />
      {lleno ? (
        <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
          Tu plan ({equipo?.plan.nombre}) permite {equipo?.limiteUsuarios} usuarios, contándote a ti. Para sumar a alguien,
          desactiva a otra persona o cambia de plan.
        </p>
      ) : null}

      <Tabs defaultValue="personas">
        <TabsList>
          <TabsTrigger value="personas">Personas</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="personas" className="mt-3">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            <Personas
              miembros={equipo?.miembros ?? []}
              lleno={lleno}
              onEditar={(m) => setMiembroAbierto({ miembro: m })}
            />
          )}
        </TabsContent>

        <TabsContent value="roles" className="mt-3">
          <Roles roles={roles} />
        </TabsContent>
      </Tabs>

      <MiembroDialog
        open={!!miembroAbierto}
        onOpenChange={(v) => !v && setMiembroAbierto(null)}
        miembro={miembroAbierto?.miembro}
        roles={roles}
        onCreado={setCredenciales}
      />
      <DatosDeIngreso credenciales={credenciales} onClose={() => setCredenciales(null)} />
    </div>
  );
}

// ---------------------------------------------------------------- personas

function Personas({ miembros, lleno, onEditar }: { miembros: Miembro[]; lleno: boolean; onEditar: (m: Miembro) => void }) {
  const { data: tiendas = [] } = useStores();
  const nombreTienda = useMemo(() => new Map(tiendas.map((t) => [t.id, t.name])), [tiendas]);
  const editar = useEditarMiembro();
  const eliminar = useEliminarMiembro();
  const [aEliminar, setAEliminar] = useState<Miembro | null>(null);
  const soloDueno = miembros.length === 1;

  const activar = async (m: Miembro, activo: boolean) => {
    try {
      await editar.mutateAsync({ id: m.id, activo });
      toast.success(activo ? `${m.name} puede volver a entrar` : `${m.name} ya no puede entrar`);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo cambiar");
    }
  };

  return (
    <>
      <ul className="space-y-2">
        {miembros.map((m) => (
          <li key={m.id}>
            <Card className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-center", !m.activo && "opacity-60")}>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex size-10 flex-none items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-soft-foreground">
                  {iniciales(m.name)}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-semibold">{m.name}</span>
                    {m.esDueno ? (
                      <Badge variant="navy">Dueño</Badge>
                    ) : (
                      <Badge variant="secondary">{m.rol?.name ?? "Sin rol"}</Badge>
                    )}
                    {!m.activo ? <Badge variant="destructive">Desactivado</Badge> : null}
                    {m.activo && m.debeCambiarClave ? (
                      <Badge variant="warning" title="Todavía no entró a elegir su contraseña">
                        <KeyRound /> Falta su primer ingreso
                      </Badge>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {m.esDueno ? "Todas las sucursales" : m.storeIds.map((id) => nombreTienda.get(id) ?? "—").join(" · ") || "Sin sucursal"}
                  </p>
                </div>
              </div>

              {!m.esDueno ? (
                <div className="flex flex-none items-center justify-end gap-1">
                  <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => onEditar(m)}>
                    <Pencil className="size-4" /> Editar
                  </Button>
                  {m.activo ? (
                    <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => activar(m, false)} disabled={editar.isPending}>
                      <UserX className="size-4" /> Desactivar
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => activar(m, true)}
                      disabled={editar.isPending || lleno}
                      title={lleno ? "Tu plan no tiene lugar para otro usuario activo" : undefined}
                    >
                      <UserCheck className="size-4" /> Activar
                    </Button>
                  )}
                  <Button variant="ghost" size="icon-sm" title="Eliminar" onClick={() => setAEliminar(m)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>

      {soloDueno ? (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Por ahora solo estás tú. Suma a tu cajera o a quien te ayuda con el inventario: cada uno entra con su usuario y ve
          solo lo que le corresponde.
        </p>
      ) : null}

      <AlertDialog open={!!aEliminar} onOpenChange={(v) => !v && setAEliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar a {aEliminar?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ya no va a poder entrar y desaparece del equipo. Si solo quieres que deje de entrar por un tiempo, desactívalo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!aEliminar) return;
                try {
                  await eliminar.mutateAsync(aEliminar.id);
                  toast.success(`${aEliminar.name} ya no es parte del equipo`);
                } catch (e: any) {
                  toast.error(e?.message ?? "No se pudo eliminar");
                }
                setAEliminar(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Después de dar de alta (o de cambiarle la contraseña): lo que el dueño le tiene que pasar. */
function DatosDeIngreso({ credenciales, onClose }: { credenciales: Credenciales | null; onClose: () => void }) {
  const texto = credenciales
    ? `Hola ${credenciales.nombre.split(" ")[0]}, ya puedes entrar a Vendfy en ${window.location.origin}\nCorreo: ${credenciales.email}\nContraseña: ${credenciales.password}\nLa primera vez te va a pedir que elijas una propia.`
    : "";
  return (
    <ResponsiveDialog open={!!credenciales} onOpenChange={(v) => !v && onClose()}>
      <ResponsiveDialogContent className="sm:max-w-[440px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Pásale estos datos a {credenciales?.nombre.split(" ")[0]}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            La contraseña no se vuelve a mostrar. Si se pierde, le pones una nueva desde Editar.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>
          <pre className="whitespace-pre-wrap rounded-xl bg-muted p-3 font-mono text-[13px] leading-relaxed">{texto}</pre>
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => navigator.clipboard?.writeText(texto).then(() => toast.success("Copiado: pégalo en WhatsApp"))}
          >
            <Copy className="size-4" /> Copiar
          </Button>
          <Button onClick={onClose}>Listo</Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

// ---------------------------------------------------------------- roles

function Roles({ roles }: { roles: RolEquipo[] }) {
  const { tiene } = useAcceso();
  const { data: catalogo } = useCatalogoEquipo();
  const eliminar = useEliminarRol();
  const [dialogo, setDialogo] = useState<{ rol?: RolEquipo; base?: RolEquipo } | null>(null);
  const aMedida = tiene("roles_propios");

  /** "Caja y pedidos: ve y gestiona · Productos: ve". */
  const resumen = (permisos: string[]) =>
    (catalogo?.modulos ?? [])
      .map((m) => {
        const marcados = m.permisos.filter((p) => permisos.includes(p.permiso));
        if (!marcados.length) return null;
        const gestiona = marcados.some((p) => p.permiso.startsWith("Gestionar"));
        return { modulo: m.modulo, nivel: gestiona ? "gestiona" : "ve" };
      })
      .filter(Boolean) as { modulo: string; nivel: string }[];

  const borrar = async (r: RolEquipo) => {
    try {
      await eliminar.mutateAsync(r.id);
      toast.success(`Rol «${r.name}» eliminado`);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo eliminar");
    }
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Los roles de Vendfy sirven para empezar. Si necesitas otra combinación, duplica uno o crea el tuyo.
        </p>
        <Button
          variant="outline"
          className="gap-1.5"
          disabled={!aMedida}
          title={aMedida ? undefined : "Tu plan no incluye roles a medida"}
          onClick={() => setDialogo({})}
        >
          <Plus className="size-4" /> Nuevo rol
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {roles.map((r) => (
          <Card key={r.id} className="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-5 flex-none text-primary" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold">{r.name}</span>
                  {r.base ? <Badge variant="outline">De Vendfy</Badge> : <Badge variant="info">Tuyo</Badge>}
                </div>
                {r.descripcion ? <p className="text-xs text-muted-foreground">{r.descripcion}</p> : null}
              </div>
              <span className="flex-none text-xs text-muted-foreground">
                {r.usuarios} {r.usuarios === 1 ? "persona" : "personas"}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {resumen(r.permisos).map((m) => (
                <Badge key={m.modulo} variant={m.nivel === "gestiona" ? "default" : "secondary"}>
                  {m.modulo}: {m.nivel}
                </Badge>
              ))}
              {!r.permisos.length ? <span className="text-xs text-muted-foreground">Sin permisos: solo el asistente</span> : null}
            </div>

            <div className="mt-auto flex justify-end gap-1 border-t border-border/60 pt-2">
              {r.base ? (
                <Button variant="ghost" size="sm" className="gap-1.5" disabled={!aMedida} onClick={() => setDialogo({ base: r })}>
                  <Copy className="size-4" /> Duplicar
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" className="gap-1.5" disabled={!aMedida} onClick={() => setDialogo({ rol: r })}>
                    <Pencil className="size-4" /> Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-destructive"
                    disabled={r.usuarios > 0 || eliminar.isPending}
                    title={r.usuarios > 0 ? "Cámbiales el rol a quienes lo tienen antes de eliminarlo" : undefined}
                    onClick={() => borrar(r)}
                  >
                    <Trash2 className="size-4" /> Eliminar
                  </Button>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>

      <RolDialog open={!!dialogo} onOpenChange={(v) => !v && setDialogo(null)} rol={dialogo?.rol} base={dialogo?.base} />
    </>
  );
}
