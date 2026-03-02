"use client"

import * as React from "react"
import { Store } from "@/entities/store/model/types"
import { createWhatsAppInstance } from "@/entities/whatsapp"
import type { WhatsAppInstanceResponse } from "@/entities/whatsapp"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"
import { Button } from "@/shared/ui/button"
import { RefreshCw, CheckCircle2 } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { getStores } from "@/entities/store/api"
import { Skeleton } from "@/shared/ui/skeleton"

interface WhatsAppLinkModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WhatsAppLinkModal({ open, onOpenChange }: WhatsAppLinkModalProps) {
  const [selectedStoreId, setSelectedStoreId] = React.useState<string>("")
  const [whatsappData, setWhatsappData] = React.useState<WhatsAppInstanceResponse | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const { data: stores = [], isLoading: isLoadingStores } = useQuery({
    queryKey: ["stores"],
    queryFn: getStores,
  })

  const handleStoreChange = async (storeId: string) => {
    setSelectedStoreId(storeId)
    await fetchWhatsAppInstance(storeId)
  }

  const fetchWhatsAppInstance = async (storeId: string) => {
    if (!storeId) return

    setIsLoading(true)
    try {
      const response = await createWhatsAppInstance({ userId: storeId })
      setWhatsappData(response)
    } catch (error) {
      console.error("Error al conectar con WhatsApp:", error)
      setWhatsappData(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = async () => {
    if (selectedStoreId) {
      await fetchWhatsAppInstance(selectedStoreId)
    }
  }

  // Resetear cuando se cierra el modal
  React.useEffect(() => {
    if (!open) {
      setSelectedStoreId("")
      setWhatsappData(null)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular WhatsApp</DialogTitle>
          <DialogDescription>
            Selecciona la tienda que deseas vincular con WhatsApp
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Select de tiendas */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tienda</label>
            {isLoadingStores ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={selectedStoreId} onValueChange={handleStoreChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una tienda" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Área de QR o Estado de conexión */}
          {selectedStoreId && (
            <div className="space-y-3">
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
                </div>
              ) : whatsappData?.data.isAuthenticated ? (
                // Mostrar check verde si está autenticado
                <div className="flex flex-col items-center justify-center h-64 space-y-4">
                  <CheckCircle2 className="h-24 w-24 text-green-500" />
                  <p className="text-lg font-medium text-green-700">
                    WhatsApp conectado
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Esta tienda ya está vinculada con WhatsApp
                  </p>
                </div>
              ) : whatsappData?.qrImage ? (
                // Mostrar QR si no está autenticado
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Escanea el código QR con WhatsApp
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRefresh}
                      className="h-8 w-8"
                      title="Refrescar QR"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex justify-center bg-white p-4 rounded-lg border">
                    <img
                      src={whatsappData.qrImage}
                      alt="QR Code"
                      className="w-64 h-64"
                    />
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    El código QR expira después de unos minutos. Si no funciona, presiona el botón de refrescar.
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
