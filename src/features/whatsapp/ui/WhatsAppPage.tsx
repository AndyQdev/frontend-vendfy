import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  MessageSquare,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Bot,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import { useStore } from "@/app/providers/auth"
import {
  useWhatsAppStatus,
  useCreateWhatsAppConnection,
  useGenerateSetupLink,
} from "@/entities/whatsapp/api"
import { Button } from "@/shared/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"

function getCurrentStep(
  whatsappData: { status?: string; phone_number_id?: string } | null | undefined
): number {
  if (!whatsappData) return 1
  if (whatsappData.status === "pending") return 2
  if (whatsappData.status === "connected") return 3
  return 1
}

interface TimelineStepProps {
  step: number
  currentStep: number
  title: string
  children: React.ReactNode
  isLast?: boolean
}

function TimelineStep({ step, currentStep, title, children, isLast = false }: TimelineStepProps) {
  const isCompleted = currentStep > step
  const isActive = currentStep === step

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`
            w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 shrink-0
            ${isCompleted
              ? "bg-green-600 border-green-600 text-white"
              : isActive
                ? "bg-background border-green-600 text-green-600"
                : "bg-background border-muted-foreground/30 text-muted-foreground/50"
            }
          `}
        >
          {isCompleted ? <CheckCircle className="h-5 w-5" /> : step}
        </div>
        {!isLast && (
          <div
            className={`w-0.5 flex-1 min-h-[24px] ${isCompleted ? "bg-green-600" : "bg-muted"}`}
          />
        )}
      </div>

      <div className={`pb-8 flex-1 ${isLast ? "pb-0" : ""}`}>
        <h3
          className={`text-lg font-semibold mb-2 ${
            isActive
              ? "text-green-600"
              : isCompleted
                ? "text-green-600"
                : "text-muted-foreground/50"
          }`}
        >
          {title}
        </h3>
        {(isActive || isCompleted) && children}
      </div>
    </div>
  )
}

export function WhatsAppPage() {
  const { selectedStore } = useStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const storeId = selectedStore && selectedStore !== "all" ? (selectedStore as any).id : undefined
  const storeName = selectedStore && selectedStore !== "all" ? (selectedStore as any).name : undefined

  const { data: whatsappData, isLoading, refetch } = useWhatsAppStatus(storeId)
  const createConnection = useCreateWhatsAppConnection()
  const generateSetupLink = useGenerateSetupLink()

  const currentStep = getCurrentStep(whatsappData)

  // Manejar callbacks de Kapso via URL params
  useEffect(() => {
    if (!storeId) return

    const success = searchParams.get("success")
    const error = searchParams.get("error")

    if (success === "true") {
      toast.success("Cuenta de WhatsApp vinculada exitosamente")
      refetch()
      navigate("/whatsapp", { replace: true })
    } else if (error) {
      toast.error("Error al conectar WhatsApp: " + error)
      navigate("/whatsapp", { replace: true })
    }
  }, [searchParams, storeId])

  const handleCreateConnection = async () => {
    if (!storeId) {
      toast.error("Selecciona una tienda primero")
      return
    }

    try {
      const result = await createConnection.mutateAsync({
        storeId,
        businessName: storeName || "Mi Tienda",
      })

      if (result.setupUrl) {
        window.open(result.setupUrl, "_blank")
        toast.success("Se abrió la ventana de configuración de Meta")
      }
    } catch (error) {
      console.error("Error creating connection:", error)
    }
  }

  const handleGenerateLink = async () => {
    if (!storeId) return

    try {
      const result = await generateSetupLink.mutateAsync(storeId)
      if (result.setupUrl) {
        window.open(result.setupUrl, "_blank")
        toast.success("Se abrió la ventana de configuración de Meta")
      }
    } catch (error) {
      console.error("Error generating link:", error)
    }
  }

  if (!storeId) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-orange-500 mx-auto" />
          <p className="text-muted-foreground text-lg">
            Selecciona una tienda en el menú lateral para continuar.
          </p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-green-600 mx-auto" />
          <p className="text-muted-foreground text-lg">Cargando estado de WhatsApp...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent">
            WhatsApp Bot
          </h1>
          <p className="text-muted-foreground">
            Conecta tu número de WhatsApp para notificar a tus clientes automáticamente
          </p>
        </div>
      </div>

      {/* Timeline Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xl flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
              <MessageSquare className="h-6 w-6 text-green-600" />
            </div>
            Configuración de WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {/* STEP 1: Conectar */}
          <TimelineStep step={1} currentStep={currentStep} title="Conecta tu cuenta">
            {currentStep === 1 ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-5">
                  <p className="text-blue-800 dark:text-blue-300 text-sm leading-relaxed">
                    Al hacer clic en <strong>"Conectar WhatsApp"</strong> se abrirá una ventana de
                    Meta donde podrás vincular tu número de WhatsApp Business con tu tienda. Solo
                    necesitas tener acceso a tu cuenta de Meta Business.
                  </p>
                </div>
                <Button
                  onClick={handleCreateConnection}
                  disabled={createConnection.isPending}
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white shadow-md"
                  size="lg"
                >
                  {createConnection.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <MessageSquare className="h-5 w-5" />
                  )}
                  {createConnection.isPending ? "Preparando conexión..." : "Conectar WhatsApp"}
                </Button>
              </div>
            ) : (
              <p className="text-green-600 text-sm">Cuenta preparada correctamente.</p>
            )}
          </TimelineStep>

          {/* STEP 2: Vincular número */}
          <TimelineStep step={2} currentStep={currentStep} title="Vincula tu número de WhatsApp">
            {currentStep === 2 ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-5">
                  <div className="flex items-start gap-3">
                    <Loader2 className="h-5 w-5 text-orange-600 animate-spin mt-0.5 shrink-0" />
                    <div className="space-y-2">
                      <p className="text-orange-900 dark:text-orange-300 font-medium">
                        Esperando que completes la configuración en Meta
                      </p>
                      <p className="text-orange-700 dark:text-orange-400 text-sm leading-relaxed">
                        Sigue los pasos en la ventana de Meta para vincular tu número de WhatsApp.
                        Si cerraste la ventana, puedes generar un nuevo enlace.
                      </p>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleGenerateLink}
                  className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
                  disabled={generateSetupLink.isPending}
                >
                  {generateSetupLink.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                  {generateSetupLink.isPending ? "Generando..." : "Generar nuevo enlace"}
                </Button>
              </div>
            ) : currentStep > 2 ? (
              <p className="text-green-600 text-sm">Número vinculado correctamente.</p>
            ) : null}
          </TimelineStep>

          {/* STEP 3: Todo listo */}
          <TimelineStep
            step={3}
            currentStep={currentStep}
            title="Tu bot está listo"
            isLast
          >
            {currentStep === 3 ? (
              <div className="space-y-4">
                {/* Mensaje de éxito */}
                <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-5">
                  <div className="flex items-start gap-3">
                    <Bot className="h-6 w-6 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-green-900 dark:text-green-300 font-semibold text-lg">
                        Tu bot está listo para responder a tus clientes
                      </p>
                      <p className="text-green-700 dark:text-green-400 text-sm mt-1">
                        WhatsApp se ha conectado exitosamente. Cuando cambies el estado de un
                        pedido, tu cliente recibirá una notificación automática por WhatsApp.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Aviso importante sobre la ventana de 24hrs */}
                <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-amber-900 dark:text-amber-300 font-semibold">
                        Importante: Tu cliente debe escribirte primero
                      </p>
                      <p className="text-amber-800 dark:text-amber-400 text-sm leading-relaxed">
                        WhatsApp Business tiene una regla: solo puedes enviar notificaciones a un
                        cliente si él te ha escrito en las últimas 24 horas. Esto significa que tu
                        cliente debe iniciar la conversación primero (por ejemplo, preguntando por
                        un producto o haciendo un pedido por WhatsApp).
                      </p>
                      <p className="text-amber-800 dark:text-amber-400 text-sm leading-relaxed">
                        Una vez que el cliente te escribe, el bot podrá enviarle actualizaciones
                        sobre sus pedidos durante las próximas 24 horas. Si necesitas notificarle
                        después de ese tiempo, el sistema usará plantillas pre-aprobadas por Meta.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </TimelineStep>
        </CardContent>
      </Card>
    </div>
  )
}
