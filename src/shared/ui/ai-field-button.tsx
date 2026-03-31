import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { apiFetch } from "@/shared/api/client";
import { toast } from "sonner";

type EnrichField = "description" | "tags" | "specifications" | "store_description" | "store_aboutUs" | "store_heroTitle";

interface AiFieldButtonProps {
  storeId?: string;
  field: EnrichField;
  currentValues: Record<string, any>;
  onResult: (value: any) => void;
  /** If true, skip the "name required" validation (for store fields) */
  skipNameCheck?: boolean;
}

export function AiFieldButton({ storeId, field, currentValues, onResult, skipNameCheck }: AiFieldButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!skipNameCheck && !storeId) {
      toast.error("Selecciona una tienda primero");
      return;
    }
    if (!skipNameCheck && !currentValues.name?.trim()) {
      toast.error("Escribe el nombre del producto primero");
      return;
    }
    if (skipNameCheck && !currentValues.name?.trim()) {
      toast.error("Escribe el nombre de la tienda primero");
      return;
    }

    setLoading(true);
    try {
      const response = await apiFetch<any>("/api/product/ai/enrich", {
        method: "POST",
        body: { storeId, field, currentValues },
      });
      onResult(response.data);
    } catch (error: any) {
      toast.error("Error al generar con IA");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors disabled:opacity-50"
      title={`Generar ${field === "description" ? "descripción" : field === "tags" ? "etiquetas" : "especificaciones"} con IA`}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Sparkles className="h-3 w-3" />
      )}
      IA
    </button>
  );
}
