import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "@/entities/store/api";
import { StoreConfigForm } from "@/features/store/ui/StoreConfigForm";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/ui/button";

export function StoreConfigPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isCreateMode = id === "new";

  const { data: store, isLoading, refetch } = useStore(isCreateMode ? undefined : id);

  if (!isCreateMode && isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!isCreateMode && !store) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Tienda no encontrada</p>
          <Button onClick={() => navigate("/stores")} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Tiendas
          </Button>
        </div>
      </div>
    );
  }

  if (isCreateMode) {
    return (
      <div className="">
        <StoreConfigForm mode="create" />
      </div>
    );
  }

  return (
    <div className="">
      <StoreConfigForm store={store} mode="edit" onUpdate={refetch} />
    </div>
  );
}
