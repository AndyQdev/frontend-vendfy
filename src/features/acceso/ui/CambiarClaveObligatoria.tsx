import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/app/providers/auth";
import { apiFetch } from "@/shared/api/client";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

/**
 * La primera vez que entra un empleado: la contraseña se la dio el dueño, así
 * que la cambia antes de ver nada. Hasta que no la cambie, el panel no se abre.
 */
export function CambiarClaveObligatoria() {
  const { user, refreshUser, logout } = useAuth();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [enviando, setEnviando] = useState(false);

  const negocio = user?.acceso?.negocio.name;
  const error =
    nueva && nueva.length < 8
      ? "Al menos 8 caracteres"
      : repetida && repetida !== nueva
        ? "Las dos no coinciden"
        : nueva && nueva === actual
          ? "Tiene que ser distinta de la que te dieron"
          : null;
  const listo = actual && nueva.length >= 8 && repetida === nueva && nueva !== actual;

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listo) return;
    setEnviando(true);
    try {
      await apiFetch("/api/auth/cambiar-clave", { method: "POST", body: { actual, nueva } });
      toast.success("Listo: ya tenés tu propia contraseña");
      await refreshUser();
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo cambiar. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-sm p-6 sm:p-8">
        <form onSubmit={guardar} className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <KeyRound className="size-6" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight">Elegí tu contraseña</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Entraste con la contraseña que te dio {negocio ?? "el dueño del negocio"}. Elegí una
                que solo sepas vos para seguir.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="clave-actual">La que te dieron</Label>
            <Input id="clave-actual" type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clave-nueva">Tu contraseña nueva</Label>
            <Input id="clave-nueva" type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clave-repetida">Repetila</Label>
            <Input id="clave-repetida" type="password" autoComplete="new-password" value={repetida} onChange={(e) => setRepetida(e.target.value)} />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>

          <Button type="submit" disabled={!listo || enviando} className="gap-2">
            {enviando && <Loader2 className="size-4 animate-spin" />}
            Guardar y entrar
          </Button>
          <button type="button" onClick={logout} className="text-xs text-muted-foreground underline-offset-4 hover:underline">
            Salir
          </button>
        </form>
      </Card>
    </div>
  );
}
