import { useEffect, useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { useStores } from "@/entities/store/api";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
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

import { useCrearMiembro, useEditarMiembro, type Miembro, type RolEquipo } from "../api";

/** Sin letras que se confunden al dictarlas (l, 1, O, 0). */
const ALFABETO = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function claveAlAzar(largo = 10) {
  const bytes = crypto.getRandomValues(new Uint32Array(largo));
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
}

export interface Credenciales {
  nombre: string;
  email: string;
  password: string;
}

/**
 * Alta o edición de una persona del equipo. La contraseña la pone el dueño y
 * se la pasa a mano; la persona la cambia la primera vez que entra.
 */
export function MiembroDialog({
  open,
  onOpenChange,
  miembro,
  roles,
  onCreado,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Sin miembro, es un alta. */
  miembro?: Miembro | null;
  roles: RolEquipo[];
  /** Para mostrarle al dueño los datos que tiene que pasarle. */
  onCreado: (c: Credenciales) => void;
}) {
  const { data: tiendas = [] } = useStores();
  const crear = useCrearMiembro();
  const editar = useEditarMiembro();
  const esAlta = !miembro;

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [roleId, setRoleId] = useState("");
  const [sucursales, setSucursales] = useState<string[]>([]);
  const [clave, setClave] = useState("");

  useEffect(() => {
    if (!open) return;
    setNombre(miembro?.name ?? "");
    setEmail(miembro?.email ?? "");
    setTelefono(miembro?.phoneNumber ?? "");
    setRoleId(miembro?.rol?.id ?? roles.find((r) => r.name === "Cajero")?.id ?? roles[0]?.id ?? "");
    // Con una sola tienda no hay nada que elegir: va esa.
    setSucursales(miembro?.storeIds ?? (tiendas.length === 1 ? [tiendas[0].id] : []));
    setClave(esAlta ? claveAlAzar() : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, miembro?.id]);

  const alternar = (id: string, si: boolean) =>
    setSucursales((s) => (si ? [...new Set([...s, id])] : s.filter((x) => x !== id)));

  const valido =
    nombre.trim().length >= 2 &&
    (!esAlta || /\S+@\S+\.\S+/.test(email)) &&
    roleId &&
    sucursales.length > 0 &&
    (esAlta ? clave.length >= 8 : !clave || clave.length >= 8);
  const enviando = crear.isPending || editar.isPending;

  const guardar = async () => {
    try {
      if (esAlta) {
        await crear.mutateAsync({ name: nombre.trim(), email: email.trim(), phoneNumber: telefono.trim() || undefined, roleId, storeIds: sucursales, password: clave });
        onCreado({ nombre: nombre.trim(), email: email.trim().toLowerCase(), password: clave });
      } else {
        await editar.mutateAsync({
          id: miembro!.id,
          name: nombre.trim(),
          phoneNumber: telefono.trim(),
          roleId,
          storeIds: sucursales,
          ...(clave ? { password: clave } : {}),
        });
        if (clave) onCreado({ nombre: nombre.trim(), email: miembro!.email, password: clave });
        else toast.success("Cambios guardados");
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar");
    }
  };

  const rolElegido = roles.find((r) => r.id === roleId);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[520px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{esAlta ? "Agregar a alguien del equipo" : `Editar a ${miembro!.name}`}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {esAlta
              ? "Entra con su correo y una contraseña que le pasás vos. La primera vez elige la suya."
              : "Lo que cambies se aplica la próxima vez que use el panel."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="eq-nombre">Nombre</Label>
              <Input id="eq-nombre" autoFocus value={nombre} maxLength={100} onChange={(e) => setNombre(e.target.value)} placeholder="María Quispe" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-email">Correo</Label>
              <Input
                id="eq-email"
                type="email"
                value={email}
                disabled={!esAlta}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="maria@correo.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-tel">Teléfono (opcional)</Label>
              <Input id="eq-tel" inputMode="tel" value={telefono} maxLength={20} onChange={(e) => setTelefono(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="eq-rol">Rol</Label>
            <NativeSelect id="eq-rol" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </NativeSelect>
            {rolElegido?.descripcion ? <p className="text-xs text-muted-foreground">{rolElegido.descripcion}</p> : null}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Sucursales donde trabaja</legend>
            {tiendas.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted/50">
                <Checkbox checked={sucursales.includes(t.id)} onCheckedChange={(v) => alternar(t.id, v === true)} />
                <span className="font-medium">{t.name}</span>
                <span className="text-xs text-muted-foreground">@{t.slug}</span>
              </label>
            ))}
            {sucursales.length === 0 ? <p className="text-xs text-destructive">Elegí al menos una</p> : null}
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="eq-clave">{esAlta ? "Contraseña inicial" : "Nueva contraseña inicial (opcional)"}</Label>
            <div className="flex gap-2">
              <Input
                id="eq-clave"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder={esAlta ? "" : "Dejala vacía para no cambiarla"}
                className="font-mono"
              />
              <Button type="button" variant="outline" size="icon" title="Generar otra" onClick={() => setClave(claveAlAzar())}>
                <RefreshCw className="size-4" />
              </Button>
              {clave ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Copiar"
                  onClick={() => navigator.clipboard?.writeText(clave).then(() => toast.success("Contraseña copiada"))}
                >
                  <Copy className="size-4" />
                </Button>
              ) : null}
            </div>
            {clave && clave.length < 8 ? <p className="text-xs text-destructive">Al menos 8 caracteres</p> : null}
            {!esAlta && clave ? <p className="text-xs text-muted-foreground">Al entrar con ella tendrá que elegir una propia.</p> : null}
          </div>
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!valido || enviando} loading={enviando} onClick={guardar}>
            {esAlta ? "Agregar" : "Guardar"}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
