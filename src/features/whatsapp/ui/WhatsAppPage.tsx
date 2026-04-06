import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  MessageSquare, CheckCircle, AlertCircle, ArrowLeft, Loader2, Bot, AlertTriangle,
  Unplug, ExternalLink, Key, Hash, Shield, Check, ShoppingCart, Search, MapPin,
  XCircle, Pencil, UserPlus, Bell, CreditCard, FileText,
} from "lucide-react"
import { toast } from "sonner"
import { useStore } from "@/app/providers/auth"
import {
  useWhatsAppStatus, useConnectManual, useCreateSingleTemplate,
  useCheckTemplates, useDisconnectWhatsApp,
} from "@/entities/whatsapp/api"
import { WA_REQUIRED_TEMPLATES, WA_TEMPLATE_LABELS } from "@/entities/whatsapp/model/types"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"

function GuideStep({ num, title, desc, link, linkText }: {
  num: string; title: string; desc: string; link?: string; linkText?: string
}) {
  return (
    <div className="flex gap-3 py-3">
      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 text-xs font-bold flex items-center justify-center">{num}</span>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        {link && <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"><ExternalLink className="h-3 w-3" />{linkText || "Abrir"}</a>}
      </div>
    </div>
  )
}

const botCapabilities = [
  { icon: Search, title: "Responde consultas de productos", desc: "Precios, disponibilidad, descripciones y recomendaciones basadas en tu catálogo real." },
  { icon: ShoppingCart, title: "Crea pedidos automáticamente", desc: "El cliente elige productos por chat y el bot crea la orden completa en tu sistema." },
  { icon: Pencil, title: "Modifica pedidos existentes", desc: "Agrega o quita productos de un pedido pendiente directamente por chat." },
  { icon: XCircle, title: "Cancela pedidos", desc: "El cliente puede cancelar su pedido pendiente o en proceso desde WhatsApp." },
  { icon: FileText, title: "Consulta estado de pedidos", desc: "El cliente pregunta por su pedido y el bot le dice en qué estado está." },
  { icon: MapPin, title: "Calcula costo de envío", desc: "El cliente envía su ubicación y el bot calcula el delivery según la distancia." },
  { icon: UserPlus, title: "Registra clientes nuevos", desc: "Si es un cliente nuevo, el bot guarda sus datos automáticamente." },
]

export function WhatsAppPage() {
  const { selectedStore } = useStore()
  const navigate = useNavigate()

  const storeId = selectedStore && selectedStore !== "all" ? (selectedStore as any).id : undefined
  const storeName = selectedStore && selectedStore !== "all" ? (selectedStore as any).name : undefined

  const { data: whatsappData, isLoading, refetch } = useWhatsAppStatus(storeId)
  const connectManual = useConnectManual()
  const createTemplate = useCreateSingleTemplate()
  const disconnectWa = useDisconnectWhatsApp()
  const isConnected = whatsappData?.status === "connected"
  const { data: templatesData } = useCheckTemplates(storeId, isConnected)
  const allTemplatesApproved = templatesData?.allApproved ?? whatsappData?.templates_approved ?? false

  const [phoneNumberId, setPhoneNumberId] = useState("")
  const [wabaId, setWabaId] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [showGuide, setShowGuide] = useState(true)
  const [creatingTemplates, setCreatingTemplates] = useState(false)
  const [templateProgress, setTemplateProgress] = useState<Record<string, string>>({})

  const handleConnect = async () => {
    if (!storeId) { toast.error("Selecciona una tienda primero"); return }
    if (!phoneNumberId.trim() || !wabaId.trim() || !accessToken.trim()) { toast.error("Completa los 3 campos"); return }

    await connectManual.mutateAsync({ storeId, phoneNumberId: phoneNumberId.trim(), wabaId: wabaId.trim(), accessToken: accessToken.trim() })
    setPhoneNumberId(""); setWabaId(""); setAccessToken("")

    setCreatingTemplates(true)
    const progress: Record<string, string> = {}
    WA_REQUIRED_TEMPLATES.forEach((t) => { progress[t] = "pending" })
    setTemplateProgress({ ...progress })

    for (const templateName of WA_REQUIRED_TEMPLATES) {
      progress[templateName] = "creating"
      setTemplateProgress({ ...progress })
      try {
        const result = await createTemplate.mutateAsync({ storeId, templateName })
        progress[templateName] = result?.success ? "done" : "error"
      } catch { progress[templateName] = "error" }
      setTemplateProgress({ ...progress })
    }
    setCreatingTemplates(false)
    refetch()
  }

  const handleDisconnect = async () => {
    if (!storeId || !confirm("¿Desconectar WhatsApp? Se dejarán de enviar notificaciones.")) return
    await disconnectWa.mutateAsync(storeId); refetch()
  }

  if (!storeId) {
    return <div className="flex items-center justify-center py-24"><div className="text-center space-y-4"><AlertCircle className="h-12 w-12 text-orange-500 mx-auto" /><p className="text-muted-foreground text-lg">Selecciona una tienda en el menú lateral para continuar.</p></div></div>
  }
  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-12 w-12 animate-spin text-green-600" /></div>
  }

  // ═══════════════════════════════════════════════════════
  // CONNECTED VIEW
  // ═══════════════════════════════════════════════════════
  if (isConnected) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent">WhatsApp Bot</h1>
            <p className="text-muted-foreground">Conectado y funcionando {storeName && `— ${storeName}`}</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleDisconnect} disabled={disconnectWa.isPending}>
            <Unplug className="h-4 w-4" />Desconectar
          </Button>
        </div>

        {/* Row 1: Bot + Connection */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bot capabilities */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="p-2 rounded-xl bg-green-100 dark:bg-green-900/30"><Bot className="h-5 w-5 text-green-600" /></div>
                Bot con IA conectado
              </CardTitle>
              <p className="text-sm text-muted-foreground">Tu bot responde mensajes de WhatsApp automáticamente usando IA y tu catálogo real.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 p-3">
                <p className="text-sm text-green-800 dark:text-green-300 font-medium flex items-center gap-2"><CheckCircle className="h-4 w-4" />Probalo enviando un mensaje desde otro teléfono al número que conectaste</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Qué puede hacer tu bot</p>
                {botCapabilities.map((cap) => (
                  <div key={cap.title} className="flex gap-3 py-2">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0"><cap.icon className="h-4 w-4 text-foreground" /></div>
                    <div><p className="text-sm font-medium">{cap.title}</p><p className="text-xs text-muted-foreground">{cap.desc}</p></div>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-2">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5" />Para que el bot funcione correctamente necesitas:</p>
                <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 ml-5 list-disc">
                  <li>Productos e inventario cargados en tu tienda</li>
                  <li>Tienda configurada (nombre, dirección, etc.)</li>
                  <li>Si quieres cálculo de envío automático, activa el tipo de envío <strong>"Calculado"</strong> en la configuración de tu tienda</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Connection info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3 text-lg">
                <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30"><MessageSquare className="h-5 w-5 text-blue-600" /></div>
                Estado de conexión
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                <div>
                  <p className="text-sm font-semibold text-green-700 dark:text-green-300">WhatsApp conectado</p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    Desde {whatsappData?.connected_at ? new Date(whatsappData.connected_at).toLocaleDateString("es-BO", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Phone Number ID</span><span className="font-mono text-xs">{whatsappData?.phone_number_id}</span></div>
                <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">WABA ID</span><span className="font-mono text-xs">{whatsappData?.waba_id}</span></div>
                <div className="flex justify-between py-2"><span className="text-muted-foreground">Token</span><span className="text-xs text-green-600 font-medium">Activo (no expira)</span></div>
              </div>
              <div className="rounded-lg border p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Ventana de 24 horas</p>
                <p>Solo puedes enviar mensajes libres si el cliente te escribió en las últimas 24 horas. Fuera de esa ventana se usan las plantillas de notificación.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Notifications */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-lg">
              <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/30"><Bell className="h-5 w-5 text-purple-600" /></div>
              Notificaciones automáticas a clientes
            </CardTitle>
            <p className="text-sm text-muted-foreground">Cuando cambies el estado de un pedido (desde el sistema, la web o la app móvil), tu cliente recibirá una notificación automática por WhatsApp.</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cómo funcionan</p>
                <div className="space-y-3">
                  {[
                    { status: "Pedido recibido", desc: "El cliente hizo un pedido desde la web, app móvil o el sistema", color: "bg-amber-500" },
                    { status: "En proceso", desc: "Estás preparando el pedido del cliente", color: "bg-blue-500" },
                    { status: "En camino", desc: "El pedido fue despachado hacia el cliente", color: "bg-purple-500" },
                    { status: "Completado", desc: "El cliente recibió su pedido + opción de calificar", color: "bg-green-500" },
                    { status: "Cancelado", desc: "El pedido fue cancelado + opción de nuevo pedido", color: "bg-red-500" },
                  ].map((n) => (
                    <div key={n.status} className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${n.color} flex-shrink-0`} />
                      <div><p className="text-sm font-medium">{n.status}</p><p className="text-xs text-muted-foreground">{n.desc}</p></div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20 p-3 space-y-2">
                  <p className="text-xs font-semibold text-red-800 dark:text-red-300 flex items-center gap-2"><CreditCard className="h-3.5 w-3.5" />Importante: Método de pago requerido</p>
                  <p className="text-xs text-red-700 dark:text-red-400">Para enviar notificaciones fuera de la ventana de 24 horas, Meta requiere que tengas un <strong>método de pago (tarjeta)</strong> agregado en tu cuenta de WhatsApp Business. Selecciona la cuenta con la que configuraste todo y agrega ahí tu método de pago.</p>
                  <a href="https://business.facebook.com/billing_hub/payment_settings" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline font-medium"><CreditCard className="h-3 w-3" />Agregar método de pago en Meta</a>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado de plantillas</p>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => refetch()}><Check className="h-3 w-3" />Verificar</Button>
                </div>
                {allTemplatesApproved ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800"><CheckCircle className="h-4 w-4 text-green-600" /><p className="text-sm font-medium text-green-700 dark:text-green-300">Notificaciones activas - todas las plantillas aprobadas</p></div>
                ) : (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800"><Loader2 className="h-4 w-4 text-orange-600 animate-spin" /><p className="text-sm font-medium text-orange-700 dark:text-orange-300">Pendientes de aprobación por Meta</p></div>
                )}
                <div className="space-y-2">
                  {(templatesData?.templates || []).map((t) => (
                    <div key={t.name} className="flex items-center justify-between px-3 py-2 rounded-lg border">
                      <span className="text-sm">{t.label}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.status === "APPROVED" ? "bg-green-100 text-green-700" : t.status === "PENDING" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>{t.status}</span>
                    </div>
                  ))}
                  {(!templatesData?.templates || templatesData.templates.length === 0) && <p className="text-xs text-muted-foreground text-center py-4">Cargando estado de plantillas...</p>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════
  // SETUP VIEW (not connected)
  // ═══════════════════════════════════════════════════════
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent">WhatsApp Bot</h1>
          <p className="text-muted-foreground">Conecta tu número de WhatsApp Business para activar el bot con IA</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xl flex items-center gap-3">
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30"><MessageSquare className="h-6 w-6 text-green-600" /></div>
            Conectar WhatsApp {storeName && <span className="text-sm font-normal text-muted-foreground">— {storeName}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
          <div>
            <button onClick={() => setShowGuide(!showGuide)} className="text-sm font-medium text-blue-600 hover:underline">{showGuide ? "Ocultar guía paso a paso" : "Mostrar guía paso a paso"}</button>
            {showGuide && (
              <div className="mt-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-1">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">¿Cómo obtener los datos?</p>
                <GuideStep num="1" title="Accede a Meta Business Suite" desc="Inicia sesión con tu cuenta de Facebook que administra tu negocio." link="https://business.facebook.com" linkText="Abrir Meta Business Suite" />
                <GuideStep num="2" title="Vincula la app de Vendfy a tu negocio" desc='Ve a Configuración del negocio → Apps → Agregar → "Solicitar acceso a un identificador de la app" → escribe: 1325684399467710 → Enviar solicitud. Se enviará una solicitud al equipo de Vendfy que será aprobada en minutos. Si necesitas aprobación inmediata, contacta al +591 71890091 por WhatsApp.' link="https://business.facebook.com/settings/apps/" linkText="Ir a Apps del negocio" />
                <GuideStep num="3" title="Agrega tu número de WhatsApp" desc='Ve a WhatsApp → Números de teléfono → "Agregar número". Meta te pedirá verificarlo con un código SMS.' link="https://business.facebook.com/wa/manage/phone-numbers/" linkText="Ir a Números de teléfono" />
                <GuideStep num="4" title="Crea un System User Token (no expira)" desc="" link="https://business.facebook.com/settings/system-users/" linkText="Ir a Usuarios del sistema" />
                <div className="ml-10 -mt-2 mb-1 space-y-1 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground text-sm mb-2">Usuarios del sistema → Agregar → nombre: "vendfy-token" → rol: Administrador. Luego:</p>
                  <p><span className="font-semibold text-foreground">1.</span> Asignar activos → seleccionar <span className="font-semibold text-blue-600">Vendfy</span> → seleccionar <span className="font-semibold">Administrar app</span> → Asignar activos</p>
                  <p><span className="font-semibold text-foreground">2.</span> Generar token → seleccionar app <span className="font-semibold text-blue-600">Vendfy</span> → Caducidad del token: <span className="font-semibold">Nunca</span></p>
                  <p><span className="font-semibold text-foreground">3.</span> Seleccionar permisos: <code className="bg-muted px-1 py-0.5 rounded text-[11px]">whatsapp_business_messaging</code>, <code className="bg-muted px-1 py-0.5 rounded text-[11px]">whatsapp_business_management</code>, <code className="bg-muted px-1 py-0.5 rounded text-[11px]">whatsapp_business_manage_events</code> → Generar token → <span className="font-semibold text-green-600">Copiar token y pegarlo abajo en el campo "System User Token"</span></p>
                </div>
                <GuideStep num="5" title="Copia tu Identificador de número de teléfono" desc='En WhatsApp Manager → Números de teléfono → haz click en tu número. Busca "Identificador de número de teléfono" y copia el número (ej: 826473837221813). Pegalo abajo en el campo "Phone Number ID".' link="https://business.facebook.com/wa/manage/phone-numbers/" linkText="Ir a Números de teléfono" />
                <GuideStep num="6" title="Copia tu WABA ID (Identificador de cuenta)" desc='Ve a Configuración de WhatsApp → selecciona la cuenta que estás conectando → busca "Identificador" y copia el número (ej: 723050344080837). Pegalo abajo en el campo "WABA ID".' link="https://business.facebook.com/latest/settings/whatsapp_account" linkText="Ir a Configuración de cuenta WhatsApp" />
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-xl border p-5">
            <div className="space-y-2">
              <Label htmlFor="pnid" className="flex items-center gap-2"><Hash className="h-4 w-4 text-muted-foreground" />Phone Number ID</Label>
              <Input id="pnid" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="Ej: 826473837221813" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wid" className="flex items-center gap-2"><Shield className="h-4 w-4 text-muted-foreground" />WABA ID</Label>
              <Input id="wid" value={wabaId} onChange={(e) => setWabaId(e.target.value)} placeholder="Ej: 723050344080837" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tok" className="flex items-center gap-2"><Key className="h-4 w-4 text-muted-foreground" />System User Token</Label>
              <Input id="tok" type="password" value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="EAAxxxxxxx..." />
              <p className="text-xs text-muted-foreground">Usa un System User Token — no expira nunca.</p>
            </div>
            <Button onClick={handleConnect} disabled={connectManual.isPending || creatingTemplates || !phoneNumberId || !wabaId || !accessToken} className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white" size="lg">
              {(connectManual.isPending || creatingTemplates) ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageSquare className="h-5 w-5" />}
              {connectManual.isPending ? "Verificando..." : creatingTemplates ? "Creando templates..." : "Conectar WhatsApp"}
            </Button>
            {Object.keys(templateProgress).length > 0 && (
              <div className="space-y-2 mt-4">
                <p className="text-sm font-medium text-muted-foreground">Creando plantillas de notificación:</p>
                {WA_REQUIRED_TEMPLATES.map((t) => {
                  const st = templateProgress[t]
                  return (
                    <div key={t} className="flex items-center justify-between px-3 py-2 rounded-lg border text-sm">
                      <span>{WA_TEMPLATE_LABELS[t] || t}</span>
                      {st === "pending" && <span className="text-muted-foreground text-xs">Pendiente</span>}
                      {st === "creating" && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                      {st === "done" && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {st === "error" && <span className="text-xs text-red-500 font-medium">Error</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
