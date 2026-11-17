import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/shared/ui/responsive-dialog";

import { useCatalogoEquipo, useCrearRol, useEditarRol, type RolEquipo } from "../api";

/**
 * Crear o editar un rol del negocio: casillas agrupadas por módulo. Gestionar
 * algo sin poder verlo no tiene sentido, así que marcar "gestionar" marca
 * también "ver" del mismo módulo.
 */
export function RolDialog({
  open,
  onOpenChange,
  rol,
  base,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** El rol propio que se edita. */
  rol?: RolEquipo | null;
  /** Un rol de Vendfy que se duplica para hacerlo a medida. */
  base?: RolEquipo | null;
}) {
  const { data: catalogo } = useCatalogoEquipo();
  const crear = useCrearRol();
  const editar = useEditarRol();

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [permisos, setPermisos] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setNombre(rol?.name ?? (base ? `${base.name} (a medida)` : ""));
    setDescripcion(rol?.descripcion ?? base?.descripcion ?? "");
    setPermisos(rol?.permisos ?? base?.permisos ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rol?.id, base?.id]);

  const alternar = (modulo: { permiso: string }[], permiso: string, si: boolean) => {
    setPermisos((actuales) => {
      const set = new Set(actuales);
      if (si) {
        set.add(permiso);
        // Gestionar sin ver no sirve: suma el "Ver" de su módulo.
        if (permiso.startsWith("Gestionar")) {
          const ver = modulo.find((p) => p.permiso.startsWith("Ver") && p.permiso.slice(4) === permiso.slice(10));
          if (ver) set.add(ver.permiso);
        }
      } else {
        set.delete(permiso);
        if (permiso.startsWith("Ver")) {
          const gestionar = modulo.find((p) => p.permiso.startsWith("Gestionar") && p.permiso.slice(10) === permiso.slice(4));
          if (gestionar) set.delete(gestionar.permiso);
        }
      }
      return [...set];
    });
  };

  const enviando = crear.isPending || editar.isPending;
  const guardar = async () => {
    try {
      const datos = { name: nombre.trim(), descripcion: descripcion.trim() || undefined, permisos };
      if (rol) await editar.mutateAsync({ id: rol.id, ...datos });
      else await crear.mutateAsync(datos);
      toast.success(rol ? "Rol actualizado" : "Rol creado");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar");
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[560px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{rol ? `Editar «${rol.name}»` : "Nuevo rol"}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Marcá lo que puede hacer quien tenga este rol. Lo que no marques, no lo ve en el panel.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rol-nombre">Nombre</Label>
              <Input id="rol-nombre" autoFocus maxLength={70} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Cajero de la tarde" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rol-desc">Para qué es (opcional)</Label>
              <Input id="rol-desc" maxLength={200} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            {catalogo?.modulos.map((m) => (
              <fieldset key={m.modulo} className="rounded-xl border border-border p-3">
                <legend className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">{m.modulo}</legend>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {m.permisos.map((p) => (
                    <label key={p.permiso} className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1.5 py-1 text-sm hover:bg-muted/50">
                      <Checkbox
                        className="mt-0.5"
                        checked={permisos.includes(p.permiso)}
                        onCheckedChange={(v) => alternar(m.permisos, p.permiso, v === true)}
                      />
                      <span>{p.descripcion}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={nombre.trim().length < 3 || enviando} loading={enviando} onClick={guardar}>
            {rol ? "Guardar" : "Crear rol"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
