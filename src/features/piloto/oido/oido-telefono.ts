import { EVENTO_OIDO, oidoNativo, type EventoOidoNativo } from "@/shared/nativo";

import { BASE_MODELOS, UMBRAL_POR_DEFECTO, type ControlOido, type EstadoOido, type EventosOido } from "./oido";

/**
 * Manos libres en la app de Android: escucha el teléfono (un servicio nativo
 * con su notificación, que sigue con la pantalla apagada o la app en segundo
 * plano) con el mismo detector y los mismos modelos que el navegador. Al panel
 * solo le llegan "oyó la palabra" y "esto es lo que dijo", igual que con el
 * oído del navegador; lo demás no cambia.
 */
export class OidoTelefono implements ControlOido {
  estado: EstadoOido = "apagado";
  private quitar: (() => void) | null = null;
  private umbral: number;
  private pidioApagar = false;

  constructor(
    private readonly eventos: EventosOido,
    private readonly opciones: { base?: string; umbral?: number } = {},
  ) {
    this.umbral = opciones.umbral ?? UMBRAL_POR_DEFECTO;
  }

  private cambiar(e: EstadoOido, detalle?: string) {
    this.estado = e;
    this.eventos.estado?.(e, detalle);
  }

  private base() {
    return new URL(this.opciones.base ?? BASE_MODELOS, window.location.href).href;
  }

  private escuchar() {
    if (this.quitar) return;
    const alEvento = (e: Event) => this.recibir((e as CustomEvent<EventoOidoNativo>).detail);
    window.addEventListener(EVENTO_OIDO, alEvento);
    this.quitar = () => window.removeEventListener(EVENTO_OIDO, alEvento);
  }

  private recibir(e: EventoOidoNativo) {
    if (e.tipo === "palabra") {
      this.eventos.palabra?.(e.p);
      return;
    }
    if (e.tipo === "comando") {
      this.eventos.comando?.(aBlob(e.wav), e.hablo);
      return;
    }
    // Avisos de una escucha que el panel ya apagó (prender y apagar seguido): no cuentan.
    if (this.pidioApagar && !e.afuera) return;
    if (e.estado === "escuchando") {
      this.cambiar("escuchando");
      return;
    }
    if (e.estado === "error") {
      this.cambiar(/permis|permission/i.test(e.detalle ?? "") ? "sin-permiso" : "error", e.detalle);
      return;
    }
    // Lo apagaron desde la notificación del teléfono: se apaga también la preferencia.
    if (e.afuera) {
      this.pidioApagar = true;
      this.cambiar("apagado");
      this.eventos.apagadoAfuera?.();
    }
  }

  async encender(): Promise<void> {
    const nativo = oidoNativo();
    if (!nativo) {
      this.cambiar("error", "La app no trae el oído del teléfono");
      return;
    }
    if (this.estado === "escuchando" || this.estado === "cargando") return;
    this.pidioApagar = false;
    this.escuchar();
    this.cambiar("cargando");
    nativo.encender(this.base(), this.umbral);
  }

  pausar(valor: boolean) {
    oidoNativo()?.pausar(valor);
  }

  setUmbral(valor: number) {
    this.umbral = valor;
    // Con otro umbral el servicio reinicia la escucha.
    if (this.estado === "escuchando") oidoNativo()?.encender(this.base(), valor);
  }

  apagar() {
    this.pidioApagar = true;
    oidoNativo()?.apagar();
    this.cambiar("apagado");
  }

  destruir() {
    this.apagar();
    this.quitar?.();
    this.quitar = null;
  }
}

function aBlob(base64: string): Blob {
  const texto = atob(base64);
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i);
  return new Blob([bytes], { type: "audio/wav" });
}
