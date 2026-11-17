import { Link } from "react-router-dom";
import { Lock, Sparkles, UserRound } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { NOMBRE_FUNCION, type Motivo, type Requisito } from "@/shared/acceso/permisos";

/**
 * Lo que se ve al entrar por la dirección a una pantalla que no corresponde.
 * El carril ya la esconde; esto es para el enlace guardado o la dirección
 * escrita a mano, y dice POR QUÉ: no es lo mismo pedírselo al dueño que
 * cambiar de plan.
 */
export function SinAcceso({
  motivo,
  requisito,
  pantalla,
  negocio,
  inicio,
}: {
  motivo: Exclude<Motivo, "ok">;
  requisito?: Requisito;
  pantalla?: string;
  /** El nombre del dueño (el negocio no tiene otro nombre que el suyo). */
  negocio?: string;
  /** Adónde volver: la primera pantalla que sí puede usar. */
  inicio: string;
}) {
  const nombre = pantalla ? `«${pantalla}»` : "esta pantalla";
  const texto =
    motivo === "plan"
      ? {
          icono: Sparkles,
          titulo: "Tu plan no lo incluye",
          cuerpo: `${requisito?.funcion ? NOMBRE_FUNCION[requisito.funcion] : "Esto"} no está en el plan de tu negocio. Escribinos si querés sumarlo.`,
        }
      : motivo === "dueno"
        ? {
            icono: UserRound,
            titulo: "Solo para el dueño",
            cuerpo: `${nombre[0].toUpperCase() + nombre.slice(1)} la maneja ${negocio ?? "el dueño del negocio"}.`,
          }
        : {
            icono: Lock,
            titulo: "Tu rol no tiene acceso",
            cuerpo: `Para usar ${nombre}, pedile a ${negocio ?? "el dueño del negocio"} que te dé el permiso desde Equipo.`,
          };
  const Icono = texto.icono;

  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <Card className="flex max-w-md flex-col items-center gap-4 p-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Icono className="size-7" />
        </div>
        <div>
          <h1 className="titulo-pagina">{texto.titulo}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{texto.cuerpo}</p>
        </div>
        <Button asChild variant="outline">
          <Link to={inicio}>Volver</Link>
        </Button>
      </Card>
    </div>
  );
}
