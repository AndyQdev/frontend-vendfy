import { StoresGrid } from "@/features/store/ui/StoresGrid";
import { useStores } from "@/entities/store/api";

export function StoresPage() {
  const { data, isLoading } = useStores();

  return (
    <div>
      <div className="mb-6">
        <h1 className="titulo-pagina">Tiendas</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Administra todas tus tiendas online</p>
      </div>
      
      <StoresGrid stores={data || []} isLoading={isLoading} />
    </div>
  );
}
