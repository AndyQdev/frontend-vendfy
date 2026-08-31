import { Star } from "lucide-react";
import { ImportarModal } from "@/shared/ui/importar-modal";
import {
  parsearResenas,
  type ResenaImportada,
} from "@/entities/review/model/importar";

const EJEMPLO = `[
  {
    "name": "Juan Perez",
    "rating": 5,
    "comment": "Me gustó bastante, tiene un aroma elegante."
  }
]

o también:

Juan Perez | 5 | Me gustó bastante`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Crea todas; si falla alguna, tiene que lanzar para no cerrar el modal. */
  onImportar: (resenas: ResenaImportada[]) => Promise<void>;
  /** Solo para el texto: dice si van a quedar pegadas a un producto. */
  deProducto?: boolean;
}

/** Las estrellas de la vista previa, en chico y sin poder tocarlas. */
function Estrellas({ valor }: { valor: number | null }) {
  if (valor === null) {
    return <span className="text-xs text-muted-foreground">sin calificación</span>;
  }
  return (
    <span className="flex items-center gap-0.5" aria-label={`${valor} estrellas`}>
      {[1, 2, 3, 4, 5].map((estrella) => (
        <Star
          key={estrella}
          className={
            estrella <= valor
              ? "h-3.5 w-3.5 fill-yellow-400 text-yellow-400"
              : "h-3.5 w-3.5 text-muted-foreground/30"
          }
        />
      ))}
    </span>
  );
}

export function ImportarResenasModal({
  open,
  onOpenChange,
  onImportar,
  deProducto,
}: Props) {
  return (
    <ImportarModal<ResenaImportada>
      open={open}
      onOpenChange={onOpenChange}
      className="sm:max-w-[620px]"
      titulo="Importar reseñas"
      descripcion={
        deProducto
          ? "Pegá las reseñas y se crean todas de una, ya asociadas a este producto."
          : "Pegá las reseñas y se crean todas de una."
      }
      placeholder={EJEMPLO}
      ayuda={
        <>
          Reconoce <code className="font-mono">name</code>,{" "}
          <code className="font-mono">rating</code> y{" "}
          <code className="font-mono">comment</code>, y también sus nombres en
          español (cliente, estrellas, comentario). Las estrellas se guardan
          enteras, así que un 4.5 entra como 5. Se crean publicadas y sin foto;
          las capturas se suben después una por una.
        </>
      }
      parsear={parsearResenas}
      etiquetaAccion={(resenas) =>
        resenas.length === 1 ? "Crear 1 reseña" : `Crear ${resenas.length} reseñas`
      }
      renderPreview={(resenas) => (
        <ul className="space-y-1">
          {resenas.map((resena, i) => (
            <li
              key={`${resena.customerName}-${i}`}
              className="space-y-1 rounded-lg px-2.5 py-2 text-sm odd:bg-muted/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{resena.customerName}</span>
                <Estrellas valor={resena.rating} />
                {resena.ratingOriginal !== null && (
                  <span className="text-[11px] text-amber-700 dark:text-amber-300">
                    {resena.ratingOriginal} → {resena.rating}
                  </span>
                )}
              </div>
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                {resena.comment}
              </p>
            </li>
          ))}
        </ul>
      )}
      onConfirmar={onImportar}
    />
  );
}
