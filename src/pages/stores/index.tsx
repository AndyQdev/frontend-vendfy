import { StoresGrid } from "@/features/store/ui/StoresGrid";
import { useStores } from "@/entities/store/api";
import { BotonExportar } from "@/shared/ui/boton-exportar";
import { descargarExcel, fechaCelda, nombreArchivoListado } from "@/shared/lib/exportar-excel";

export function StoresPage() {
  const { data, isLoading } = useStores();
  const tiendas = data || [];

  // Excel de las tiendas con su contacto y su estado.
  const exportar = () => {
    descargarExcel(
      [
        {
          nombre: "Tiendas",
          columnas: [
            { titulo: "Nombre", tipo: "texto", ancho: 30 },
            { titulo: "Slug", tipo: "texto", ancho: 24 },
            { titulo: "Estado", tipo: "texto", ancho: 12 },
            { titulo: "Categoría", tipo: "texto", ancho: 18 },
            { titulo: "Ciudad", tipo: "texto", ancho: 18 },
            { titulo: "Teléfono", tipo: "texto", ancho: 18 },
            { titulo: "Email", tipo: "texto", ancho: 28 },
            { titulo: "Web", tipo: "texto", ancho: 36 },
            { titulo: "Creada", tipo: "texto", ancho: 12 },
          ],
          filas: tiendas.map((t) => [
            t.name,
            t.slug,
            t.enabled ? "Activa" : "Inactiva",
            t.config?.category || "",
            t.config?.contact?.city || "",
            t.config?.contact?.phone || "",
            t.config?.contact?.email || "",
            t.config?.storefront?.url || "",
            fechaCelda(t.created_at),
          ]),
        },
      ],
      nombreArchivoListado("tiendas", null),
    );
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="titulo-pagina">Tiendas</h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">Administra todas tus tiendas online</p>
        </div>
        <BotonExportar onExportar={exportar} size="sm" disabled={isLoading} />
      </div>

      <StoresGrid stores={tiendas} isLoading={isLoading} />
    </div>
  );
}
