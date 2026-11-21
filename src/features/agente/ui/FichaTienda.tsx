import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { NativeSelect } from "@/shared/ui/native-select";
import { useGuardarTienda } from "@/entities/agente/api";
import type { Conocimiento, DerivacionTienda, FichaTienda as Ficha, VozTienda } from "@/entities/agente/model/types";

const CAMPOS: { id: keyof Ficha; titulo: string; ayuda: string }[] = [
  { id: "envios", titulo: "Envíos", ayuda: "Zonas, costos y tiempos. Ej.: «En Santa Cruz, por moto, llega el mismo día si pides antes de las 15:00.»" },
  { id: "pagos", titulo: "Pagos", ayuda: "Ej.: «QR o transferencia; efectivo al recibir solo en Santa Cruz.»" },
  { id: "cambios", titulo: "Cambios y devoluciones", ayuda: "Ej.: «Cambios en 3 días si el producto está cerrado.»" },
  { id: "tiendaFisica", titulo: "Tienda física", ayuda: "Si se puede recoger o probar: dónde y cuándo." },
  { id: "regalo", titulo: "Regalos", ayuda: "Empaque, tarjeta, envío a otra persona." },
  { id: "otros", titulo: "Otras cosas que un vendedor tuyo sabría", ayuda: "Lo que te preguntan siempre." },
];

/**
 * La ficha de la tienda: lo que el agente responde sin inventar. Lo que no
 * esté aquí, el agente dice que lo confirma y te lo deja en «Preguntas».
 */
export function FichaTienda({ storeId, data }: { storeId: string; data: Conocimiento }) {
  const guardar = useGuardarTienda(storeId);
  const [ficha, setFicha] = useState<Ficha>(data.ficha);
  const [voz, setVoz] = useState<VozTienda>(data.voz);
  const [derivacion, setDerivacion] = useState<DerivacionTienda>(data.derivacion);

  useEffect(() => {
    setFicha(data.ficha);
    setVoz(data.voz);
    setDerivacion(data.derivacion);
  }, [data.ficha, data.voz, data.derivacion]);

  const onGuardar = () =>
    guardar.mutate(
      { ficha: { ...ficha, preguntas: undefined }, voz, derivacion },
      {
        onSuccess: () => toast.success("Listo: tu vendedor ya lo sabe"),
        onError: (e: any) => toast.error(e?.message ?? "No se pudo guardar"),
      },
    );

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4 sm:p-5">
        <div>
          <h2 className="font-display text-base font-semibold">Lo que tu vendedor tiene que saber</h2>
          <p className="text-sm text-muted-foreground">Escríbelo como se lo dirías a un vendedor nuevo. Lo que no pongas, el agente dice que lo confirma.</p>
        </div>
        {CAMPOS.map((c) => (
          <div key={c.id} className="space-y-1.5">
            <Label htmlFor={`ficha-${c.id}`}>{c.titulo}</Label>
            <Textarea
              id={`ficha-${c.id}`}
              rows={2}
              value={String(ficha[c.id] ?? "")}
              placeholder={c.ayuda}
              onChange={(e) => setFicha((f) => ({ ...f, [c.id]: e.target.value }))}
            />
          </div>
        ))}
      </Card>

      <Card className="space-y-4 p-4 sm:p-5">
        <div>
          <h2 className="font-display text-base font-semibold">Cuando tu vendedor pasa el chat a una persona</h2>
          <p className="text-sm text-muted-foreground">Pasa el chat si el cliente pide una persona, reclama o está molesto. Así le dice cuándo le responden.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="deriv-quien">Quién atiende</Label>
            <Input id="deriv-quien" value={derivacion.responsable ?? ""} placeholder="Ej.: Andrés" onChange={(e) => setDerivacion((d) => ({ ...d, responsable: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deriv-horario">Horario de atención</Label>
            <Input id="deriv-horario" value={derivacion.horario ?? ""} placeholder="Ej.: de lunes a sábado, de 9:00 a 19:00" onChange={(e) => setDerivacion((d) => ({ ...d, horario: e.target.value }))} />
          </div>
        </div>
      </Card>

      <Card className="space-y-4 p-4 sm:p-5">
        <div>
          <h2 className="font-display text-base font-semibold">Cómo habla tu tienda</h2>
          <p className="text-sm text-muted-foreground">El agente imita tu tono.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="voz-registro">Trato con los clientes</Label>
          <NativeSelect id="voz-registro" value={voz.registro ?? "tu"} onChange={(e) => setVoz((v) => ({ ...v, registro: e.target.value as VozTienda["registro"] }))}>
            <option value="tu">De tú (tienes, quieres)</option>
            <option value="usted">De usted (tiene, quiere)</option>
            <option value="vos">De vos (tenés, querés)</option>
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="voz-ejemplos">Mensajes reales tuyos (opcional)</Label>
          <Textarea
            id="voz-ejemplos"
            rows={4}
            value={voz.ejemplos ?? ""}
            placeholder={"Pega 3 a 5 mensajes que hayas mandado a clientes.\nEj.: «Hola! Sí, lo tenemos 😊 te lo mando hoy mismo»"}
            onChange={(e) => setVoz((v) => ({ ...v, ejemplos: e.target.value }))}
          />
        </div>
      </Card>

      {!!data.ficha.preguntas?.length && (
        <Card className="space-y-2 p-4 sm:p-5">
          <h2 className="font-display text-base font-semibold">Preguntas que ya respondiste</h2>
          <ul className="space-y-2">
            {data.ficha.preguntas.map((p, i) => (
              <li key={i} className="rounded-lg bg-muted/50 p-2.5 text-sm">
                <p className="font-medium">{p.pregunta}</p>
                <p className="text-muted-foreground">{p.respuesta}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="sticky bottom-3 flex justify-end">
        <Button onClick={onGuardar} disabled={guardar.isPending} className="shadow-lg">
          {guardar.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          Guardar
        </Button>
      </div>
    </div>
  );
}
