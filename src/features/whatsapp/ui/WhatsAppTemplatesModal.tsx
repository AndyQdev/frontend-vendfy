import { useNavigate } from "react-router-dom"
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  FileText,
  MessageSquare,
  Bot,
} from "lucide-react"
import { Button } from "@/shared/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog"
import { useWhatsAppStatus, useCheckTemplates } from "@/entities/whatsapp/api"
import { WA_REQUIRED_TEMPLATES, WA_TEMPLATE_LABELS } from "@/entities/whatsapp/model/types"

interface WhatsAppTemplatesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  storeId: string | undefined
}

export function WhatsAppTemplatesModal({
  open,
  onOpenChange,
  storeId,
}: WhatsAppTemplatesModalProps) {
  const navigate = useNavigate()
  const { data: whatsappData, isLoading: isLoadingStatus } = useWhatsAppStatus(storeId)

  const isConnected = whatsappData?.status === "connected"

  const {
    data: templatesData,
    isLoading: isLoadingTemplates,
    isFetching: isFetchingTemplates,
    refetch: refetchTemplates,
  } = useCheckTemplates(
    storeId,
    open && isConnected // Solo verificar si el modal está abierto y conectado
  )

  const handleGoToWhatsApp = () => {
    onOpenChange(false)
    navigate("/whatsapp")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            Notificaciones WhatsApp
          </DialogTitle>
        </DialogHeader>

        {isLoadingStatus ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-green-600" />
          </div>
        ) : !whatsappData || !whatsappData.status || whatsappData.status === "disconnected" ? (
          /* Sin conexión WhatsApp */
          <div className="space-y-4 py-4">
            <div className="text-center space-y-3">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Bot className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-lg">Bot no conectado</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Conecta tu número de WhatsApp para enviar notificaciones automáticas a tus
                  clientes cuando cambies el estado de sus pedidos.
                </p>
              </div>
            </div>
            <Button
              onClick={handleGoToWhatsApp}
              className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <MessageSquare className="h-4 w-4" />
              Conectar Bot de WhatsApp
            </Button>
          </div>
        ) : whatsappData.status === "pending" ? (
          /* Conexión pendiente */
          <div className="space-y-4 py-4">
            <div className="text-center space-y-3">
              <div className="mx-auto w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-orange-600 animate-spin" />
              </div>
              <div>
                <p className="font-semibold text-lg">Conexión en proceso</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Tu número de WhatsApp aún no se ha vinculado. Completa la configuración para
                  activar las notificaciones.
                </p>
              </div>
            </div>
            <Button
              onClick={handleGoToWhatsApp}
              className="w-full gap-2"
              variant="outline"
            >
              Ir a configuración de WhatsApp
            </Button>
          </div>
        ) : (
          /* Conectado - Mostrar estado de templates */
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Estas son las plantillas de mensaje que se usan para notificar a tus clientes.
              Meta debe aprobarlas antes de poder enviarlas.
            </p>

            {isLoadingTemplates ? (
              <div className="flex items-center gap-3 text-muted-foreground p-4">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Verificando plantillas...</span>
              </div>
            ) : (
              <div className="space-y-2">
                {WA_REQUIRED_TEMPLATES.map((templateName) => {
                  const template = templatesData?.templates?.find(
                    (t) => t.name === templateName
                  )
                  const status = template?.status || "PENDING"
                  const isApproved = status === "APPROVED"
                  const isRejected = status === "REJECTED"

                  return (
                    <div
                      key={templateName}
                      className={`
                        flex items-center justify-between p-3 rounded-lg border
                        ${isApproved
                          ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30"
                          : isRejected
                            ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30"
                            : "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30"
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <FileText
                          className={`h-4 w-4 ${
                            isApproved
                              ? "text-green-600"
                              : isRejected
                                ? "text-red-600"
                                : "text-orange-600"
                          }`}
                        />
                        <span className="text-sm font-medium">
                          {WA_TEMPLATE_LABELS[templateName] || templateName}
                        </span>
                      </div>
                      <div>
                        {isApproved ? (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-2.5 py-1 rounded-full">
                            <CheckCircle className="h-3.5 w-3.5" />
                            Aprobada
                          </span>
                        ) : isRejected ? (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/50 px-2.5 py-1 rounded-full">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Rechazada
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/50 px-2.5 py-1 rounded-full">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            En revisión
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* All approved message */}
                {templatesData?.allApproved && (
                  <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-3 mt-3">
                    <p className="text-green-700 dark:text-green-400 text-sm text-center font-medium">
                      Todas las plantillas están aprobadas. Las notificaciones se enviarán
                      automáticamente.
                    </p>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchTemplates()}
                  className="gap-2 mt-2 w-full"
                  disabled={isFetchingTemplates}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isFetchingTemplates ? "animate-spin" : ""}`}
                  />
                  Verificar de nuevo
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
