import { useNavigate } from "react-router-dom";
import { Store as StoreIcon, MapPin, Globe, Calendar } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import type { Store } from "@/entities/store/model/types";
import { format } from "date-fns";

interface StoresGridProps {
  stores: Store[];
  isLoading: boolean;
}

export function StoresGrid({ stores, isLoading }: StoresGridProps) {
  const navigate = useNavigate();

  // Debug: Log stores data
  console.log("Stores data:", stores);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-32 bg-muted rounded-lg mb-4"></div>
            <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-muted rounded w-1/2"></div>
          </Card>
        ))}
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div className="text-center py-16">
        <StoreIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No hay tiendas</h3>
        <p className="text-muted-foreground">Comienza creando tu primera tienda</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {stores.map((store) => {
        // Ensure all values are properly formatted
        const storeName = String(store?.name || 'Sin nombre');
        const storeSlug = String(store?.slug || '');
        const storeDescription = store?.description ? String(store.description) : null;
        const storeCity = store?.config?.contact?.city && typeof store.config.contact.city === 'string' 
          ? store.config.contact.city 
          : null;
        const storeCategory = store?.config?.category && typeof store.config.category === 'string'
          ? store.config.category
          : null;
        const colorTheme = store?.config?.branding?.colorTheme && typeof store.config.branding.colorTheme === 'string'
          ? store.config.branding.colorTheme
          : null;

        return (
          <Card
            key={store.id}
            className="group cursor-pointer overflow-hidden hover:shadow-lg transition-all duration-300"
            onClick={() => navigate(`/stores/${store.id}`)}
          >
          {/* Banner/Header Image */}
          <div className="relative h-32 bg-primary-soft overflow-hidden">
            {store.config?.branding?.bannerUrl ? (
              <img
                src={store.config.branding.bannerUrl}
                alt={storeName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <StoreIcon className="h-16 w-16 text-primary/30" />
              </div>
            )}
            
            {/* Status Badge */}
            <div className="absolute top-3 right-3">
              <Badge variant={store.enabled ? "default" : "secondary"}>
                {store.enabled ? "Activa" : "Inactiva"}
              </Badge>
            </div>
          </div>

          {/* Store Info */}
          <div className="p-6">
            {/* Logo & Name */}
            <div className="flex items-start gap-3 mb-4">
              {store.config?.branding?.logoUrl ? (
                <img
                  src={store.config.branding.logoUrl}
                  alt={storeName}
                  className="w-12 h-12 rounded-lg object-cover border-2 border-background shadow-sm"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <StoreIcon className="h-6 w-6 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate group-hover:text-primary transition-colors">
                  {storeName}
                </h3>
                <p className="text-sm text-muted-foreground truncate">@{storeSlug}</p>
              </div>
            </div>

            {/* Description */}
            {storeDescription && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                {storeDescription}
              </p>
            )}

            {/* Meta Info */}
            <div className="space-y-2 text-xs text-muted-foreground">
              {storeCity && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3" />
                  <span>{storeCity}</span>
                </div>
              )}
              {storeCategory && (
                <div className="flex items-center gap-2">
                  <Globe className="h-3 w-3" />
                  <span className="capitalize">{storeCategory}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3" />
                <span>Creada {format(new Date(store.created_at), "dd/MM/yyyy")}</span>
              </div>
            </div>

            {/* Color Theme Preview */}
            {colorTheme && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Color tema:</span>
                  <div
                    className="w-6 h-6 rounded-full border-2 border-background shadow-sm"
                    style={{ backgroundColor: colorTheme }}
                  />
                </div>
              </div>
            )}
          </div>
        </Card>
        );
      })}
    </div>
  );
}
