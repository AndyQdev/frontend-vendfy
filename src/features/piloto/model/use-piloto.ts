import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useStore } from "@/app/providers/auth";
import type { Propuesta } from "@/entities/omnibox/model/types";
import { ventaEnCurso } from "@/entities/order";
import { useEscucha } from "@/features/scanner/model/escucha";
import { formatMoney } from "@/shared/lib/money";
import { callarVoz, decirFrases, preferenciasVoz, type FraseVoz } from "@/shared/voz";

import { entenderTexto, entenderVoz } from "../lib/api";
import { agregarAlCarrito, cantidadEnCarrito, lineasDeContexto, quitarDelCarrito, vaciarCarrito } from "../lib/carrito";
import { cajaPiloto, cerrarPiloto, estadoPiloto, setPiloto, type CajaPiloto } from "../lib/estado";
import { planDe, resumenAgregado, type AccionCaja } from "./plan";
import { leerRespuesta, NOMBRE_PAGO, type PagoPiloto, type RespuestaPiloto } from "./respuestas";

/** Cuánto se espera a que conteste una pregunta sin volver a llamarlo. */
const VENTANA_MS = 8_000;
/** Lo primero que se dice después de llamarlo. */
const ESPERA_PRIMERA_MS = 10_000;
/** Entre una cosa y otra en la pantalla: que se vea qué hizo. */
const PAUSA_MS = 350;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * El conductor del piloto: escucha, entiende, va a la pantalla, la llena
 * frente a la persona, pregunta lo que falta y cobra cuando dice "sí".
 *
 * Hoy maneja la Caja (vender, sacar, cambiar cantidades, el pago y cobrar) y
 * contesta las consultas que el servidor ya resuelve. Lo demás lo deja
 * abierto en el asistente.
 */
export function useConductorPiloto() {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedStore } = useStore();
  const storeId = selectedStore && selectedStore !== "all" ? selectedStore.id : null;

  const ctx = useRef({
    navigate,
    pathname: location.pathname,
    storeId,
    /** El método que dijo para esta venta. */
    pago: null as PagoPiloto | null,
    /** Ya dijo "cóbrale": apenas sepa el método, cobra. */
    quiereCobrar: false,
    /** Cada vez que lo llaman empieza un turno nuevo; lo que quedó de antes se descarta. */
    turno: 0,
    cierre: null as ReturnType<typeof setTimeout> | null,
  });
  ctx.current.navigate = navigate;
  ctx.current.pathname = location.pathname;
  ctx.current.storeId = storeId;

  const vigente = (turno: number) => ctx.current.turno === turno;

  const cancelarCierre = () => {
    if (ctx.current.cierre) clearTimeout(ctx.current.cierre);
    ctx.current.cierre = null;
  };

  const programarCierre = (ms: number) => {
    cancelarCierre();
    const turno = ctx.current.turno;
    ctx.current.cierre = setTimeout(() => {
      if (vigente(turno) && !["escuchando", "pensando", "trabajando", "hablando"].includes(estadoPiloto().fase)) cerrarPiloto();
    }, ms);
  };

  // ─── Hablar ───────────────────────────────────────────────────────────────

  /** Lo muestra y lo dice. Resuelve cuando terminó de sonar (para abrir el micrófono después). */
  const decir = async (linea: string, frases?: FraseVoz[]) => {
    setPiloto({ linea, fase: "hablando" });
    if (!preferenciasVoz().asistente) return;
    await decirFrases(frases ?? [{ tipo: "texto", texto: linea }], { forzar: true, esperaMs: 8_000 });
  };

  // ─── Escuchar ─────────────────────────────────────────────────────────────

  const escucha = useEscucha(
    (wav) => void oir(wav),
    () => noHablo(),
  );

  const escucharRespuesta = (turno: number) => {
    if (!vigente(turno)) return;
    setPiloto({ fase: "escuchando" });
    void escucha.escuchar(VENTANA_MS);
  };

  const noHablo = () => {
    const e = estadoPiloto();
    if (e.pregunta) {
      // La pregunta sigue en pantalla: contesta con F9 o tocando.
      setPiloto({ fase: "esperando" });
      return;
    }
    setPiloto({ fase: "listo", linea: e.dicho ? e.linea : "No te escuché. Pulsa F9 y habla." });
    programarCierre(2_500);
  };

  // ─── La Caja ──────────────────────────────────────────────────────────────

  const irACaja = async (turno: number): Promise<CajaPiloto | null> => {
    if (!ctx.current.pathname.startsWith("/caja")) ctx.current.navigate("/caja");
    const fin = Date.now() + 10_000;
    while (Date.now() < fin) {
      const caja = cajaPiloto();
      if (caja) return caja;
      if (!vigente(turno)) return null;
      await dormir(120);
    }
    return null;
  };

  const sinCaja = async () => {
    setPiloto({ fase: "error", foco: null, pregunta: null });
    await decir("No pude abrir la Caja. Revisa que tu usuario pueda vender.");
  };

  const aplicar = async (caja: CajaPiloto, a: AccionCaja): Promise<string | null> => {
    switch (a.tipo) {
      case "agregar": {
        const r = agregarAlCarrito(a.producto, a.cantidad, a.precio);
        if (r.ok === false) return r.motivo === "agotado" ? `${r.nombre} está agotado.` : `De ${r.nombre} ya no quedan más.`;
        setPiloto({ foco: `cart:${r.id}` });
        return r.cantidad < a.cantidad ? `De ${a.producto.nombre} solo hay ${r.cantidad}.` : null;
      }
      case "quitar":
        return quitarDelCarrito(a.productId, a.nombre) ? null : `${a.nombre} no estaba en la venta.`;
      case "cantidad": {
        const id = cantidadEnCarrito(a.productId, a.nombre, a.cantidad);
        if (id) setPiloto({ foco: `cart:${id}` });
        return null;
      }
      case "pago":
        setPiloto({ foco: "caja:pago" });
        if (!caja.setPago(a.pago, a.recibidoUsd)) return "En esta venta no se puede cobrar en dólares.";
        ctx.current.pago = a.pago;
        return null;
      case "cliente":
        caja.setCliente(a.clienteId, a.nombre);
        return null;
      case "vaciar":
        vaciarCarrito();
        ctx.current.pago = null;
        ctx.current.quiereCobrar = false;
        return null;
    }
  };

  const preguntarPago = async (turno: number, antes = "") => {
    setPiloto({ pregunta: "pago", foco: "caja:pago" });
    await decir(`${antes}¿Con qué paga? ¿Efectivo, QR o tarjeta?`.trim());
    escucharRespuesta(turno);
  };

  const preguntarCobro = async (turno: number) => {
    const caja = cajaPiloto();
    const total = caja?.total() ?? 0;
    const pago = ctx.current.pago ?? "efectivo";
    setPiloto({ pregunta: "confirmar", foco: "caja:cobrar" });
    await decir(`Total ${formatMoney(total)}. ¿Lo cobro con ${NOMBRE_PAGO[pago]}?`, [
      { tipo: "texto", texto: "Total:" },
      { tipo: "precio", monto: total },
      { tipo: "texto", texto: `¿Lo cobro con ${NOMBRE_PAGO[pago]}?` },
    ]);
    escucharRespuesta(turno);
  };

  const cobrar = async (turno: number) => {
    const caja = await irACaja(turno);
    if (!caja) return sinCaja();
    const pago = ctx.current.pago;
    if (!pago) return preguntarPago(turno);
    setPiloto({ fase: "trabajando", foco: "caja:cobrar", pregunta: null, linea: "Cobrando…" });
    await dormir(500); // que se vea el botón antes de que la venta desaparezca
    const r = await caja.cobrar(pago);
    if (!vigente(turno)) return;
    ctx.current.pago = null;
    ctx.current.quiereCobrar = false;
    if (r.ok === false) {
      setPiloto({ fase: "error", foco: null });
      await decir(r.error);
      return;
    }
    const frases: FraseVoz[] = [{ tipo: "texto", texto: "Venta registrada." }];
    let linea = `Venta #${r.numero} registrada · ${formatMoney(r.total)} con ${NOMBRE_PAGO[r.pago]}`;
    if (r.vuelto) {
      frases.push({ tipo: "texto", texto: "Vuelto:" }, { tipo: "precio", monto: r.vuelto });
      linea += ` · vuelto ${formatMoney(r.vuelto)}`;
    }
    if (r.falta) {
      frases.push({ tipo: "texto", texto: "Falta cobrar:" }, { tipo: "precio", monto: r.falta });
      linea += ` · falta ${formatMoney(r.falta)}`;
    }
    setPiloto({ foco: null });
    await decir(linea, frases);
    if (!vigente(turno)) return;
    setPiloto({ fase: "listo" });
    programarCierre(5_000);
  };

  /** Lo que sigue después de cargar: cobrar si lo pidió, o preguntar si hay algo más. */
  const despuesDeCargar = async (turno: number, antes: string) => {
    if (!vigente(turno)) return;
    if (!ventaEnCurso().length) {
      setPiloto({ pregunta: null, foco: null });
      await decir(antes || "La venta está vacía.");
      setPiloto({ fase: "listo" });
      programarCierre(3_000);
      return;
    }
    if (ctx.current.quiereCobrar) {
      if (ctx.current.pago) {
        if (antes) await decir(antes);
        return cobrar(turno);
      }
      return preguntarPago(turno, antes ? `${antes} ` : "");
    }
    const total = cajaPiloto()?.total() ?? 0;
    setPiloto({ pregunta: "seguir", foco: "caja:total" });
    await decir(`${antes} Total ${formatMoney(total)}. ¿Algo más?`.trim(), [
      ...(antes ? [{ tipo: "texto" as const, texto: antes }] : []),
      { tipo: "texto", texto: "Total:" },
      { tipo: "precio", monto: total },
      { tipo: "texto", texto: "¿Algo más?" },
    ]);
    escucharRespuesta(turno);
  };

  // ─── Lo que se dijo ───────────────────────────────────────────────────────

  const responder = async (turno: number, r: RespuestaPiloto) => {
    const pregunta = estadoPiloto().pregunta;
    switch (r.tipo) {
      case "parar":
        callarVoz();
        escucha.detener();
        ctx.current.quiereCobrar = false;
        setPiloto({ fase: "listo", linea: "Listo, me detengo.", pregunta: null, foco: null });
        programarCierre(1_200);
        return;
      case "pago": {
        const caja = await irACaja(turno);
        if (!caja) return sinCaja();
        setPiloto({ foco: "caja:pago" });
        if (!caja.setPago(r.pago)) {
          await decir("En esta venta no se puede cobrar en dólares. ¿Efectivo, QR o tarjeta?");
          return escucharRespuesta(turno);
        }
        ctx.current.pago = r.pago;
        await dormir(PAUSA_MS);
        if (!ventaEnCurso().length) {
          setPiloto({ pregunta: null });
          await decir(`Listo, con ${NOMBRE_PAGO[r.pago]}. ¿Qué le vendo?`);
          return escucharRespuesta(turno);
        }
        // "¿Con qué paga?" después de "cóbrale" ya es la orden de cobrar.
        if (r.confirma || ctx.current.quiereCobrar) return cobrar(turno);
        return preguntarCobro(turno);
      }
      case "cobrar":
        ctx.current.quiereCobrar = true;
        if (!(await irACaja(turno))) return sinCaja();
        if (!ventaEnCurso().length) {
          setPiloto({ pregunta: null });
          await decir("La venta está vacía. ¿Qué le vendo?");
          return escucharRespuesta(turno);
        }
        return ctx.current.pago ? cobrar(turno) : preguntarPago(turno);
      case "si":
        if (pregunta === "confirmar") return cobrar(turno);
        if (pregunta === "pago") {
          await decir("¿Efectivo, QR o tarjeta?");
          return escucharRespuesta(turno);
        }
        // "¿Algo más?" → "sí": que lo diga.
        setPiloto({ pregunta: null });
        await decir("Dime.");
        setPiloto({ fase: "escuchando" });
        void escucha.escuchar(VENTANA_MS);
        return;
      case "no":
        if (pregunta === "seguir") return ctx.current.pago ? preguntarCobro(turno) : preguntarPago(turno);
        ctx.current.quiereCobrar = false;
        setPiloto({ pregunta: null, foco: null });
        await decir(pregunta === "confirmar" ? "Bueno, no la cobro. La venta queda abierta." : "Bueno. La venta queda abierta.");
        setPiloto({ fase: "listo" });
        programarCierre(3_000);
        return;
    }
  };

  const ejecutar = async (turno: number, p: Propuesta) => {
    const plan = planDe(p);
    if (plan.tipo === "decir") {
      setPiloto({ pregunta: null, foco: null });
      await decir(plan.texto);
      if (!vigente(turno)) return;
      setPiloto({ fase: "listo" });
      programarCierre(6_000);
      return;
    }
    if (plan.tipo === "asistente") {
      setPiloto({ pregunta: null, foco: null, irAlAsistente: true });
      await decir(plan.texto);
      if (vigente(turno)) setPiloto({ fase: "listo" });
      return;
    }

    const caja = await irACaja(turno);
    if (!caja) return sinCaja();
    setPiloto({ fase: "trabajando", pregunta: null });
    if (plan.cobrar) ctx.current.quiereCobrar = true;
    const avisos: string[] = [];
    for (const a of plan.acciones) {
      if (!vigente(turno)) return;
      const aviso = await aplicar(caja, a);
      if (aviso) avisos.push(aviso);
      await dormir(PAUSA_MS);
    }
    const agregado = resumenAgregado(plan.acciones);
    const vacio = plan.acciones.some((a) => a.tipo === "vaciar") && !ventaEnCurso().length;
    const antes = [vacio ? "Empecé la venta de nuevo." : agregado ? `Listo: ${agregado}.` : "", ...avisos].join(" ").trim();
    return despuesDeCargar(turno, antes);
  };

  /** Lo que llegó (hablado o escrito): ¿contesta la pregunta o es un pedido nuevo? */
  const atender = async (turno: number, texto: string, propuesta: () => Promise<Propuesta | null>) => {
    const pregunta = estadoPiloto().pregunta;
    const r = leerRespuesta(texto, pregunta);
    // Sin pregunta, "sí" o "no" no dicen nada; "cóbrale", "con QR" y "para" sí.
    if (r && (pregunta || r.tipo === "parar" || r.tipo === "cobrar" || r.tipo === "pago")) return responder(turno, r);
    setPiloto({ fase: "pensando" });
    const p = await propuesta();
    if (!vigente(turno)) return;
    if (!p) {
      await decir("No te entendí. ¿Me lo repites?");
      return escucharRespuesta(turno);
    }
    return ejecutar(turno, p);
  };

  const fallo = async (turno: number, error: unknown) => {
    if (!vigente(turno)) return;
    setPiloto({ fase: "error", foco: null });
    await decir(error instanceof Error && error.message ? error.message : "Algo falló. Inténtalo otra vez.");
  };

  const oir = async (wav: Blob) => {
    const turno = ctx.current.turno;
    const tienda = ctx.current.storeId;
    if (!tienda) return decir("Primero elige una tienda.");
    setPiloto({ fase: "pensando", linea: null });
    try {
      const r = await entenderVoz(wav, tienda, lineasDeContexto());
      if (!vigente(turno)) return;
      const texto = r.transcripcion.texto?.trim();
      if (!texto) {
        await decir("No te escuché bien. ¿Me lo repites?");
        return escucharRespuesta(turno);
      }
      setPiloto({ dicho: texto });
      await atender(turno, texto, async () => r.propuesta);
    } catch (e) {
      await fallo(turno, e);
    }
  };

  // ─── Lo que usa la pantalla ───────────────────────────────────────────────

  /** F9 o el botón: abre el micrófono; si ya está escuchando, entrega lo dicho. */
  const activar = () => {
    const e = estadoPiloto();
    if (e.fase === "escuchando") {
      escucha.terminar();
      return;
    }
    cancelarCierre();
    callarVoz();
    ctx.current.turno++;
    setPiloto({
      abierto: true,
      fase: "escuchando",
      dicho: null,
      linea: e.pregunta ? e.linea : "Te escucho…",
      irAlAsistente: false,
    });
    void escucha.escuchar(e.pregunta ? VENTANA_MS : ESPERA_PRIMERA_MS);
  };

  const escribir = async (texto: string) => {
    const limpio = texto.trim();
    if (!limpio) return;
    cancelarCierre();
    callarVoz();
    escucha.detener();
    const turno = ++ctx.current.turno;
    const tienda = ctx.current.storeId;
    setPiloto({ abierto: true, dicho: limpio, linea: null, irAlAsistente: false });
    if (!tienda) return decir("Primero elige una tienda.");
    try {
      await atender(turno, limpio, () => entenderTexto(limpio, tienda, lineasDeContexto()));
    } catch (e) {
      await fallo(turno, e);
    }
  };

  const detener = () => {
    ctx.current.turno++;
    ctx.current.quiereCobrar = false;
    cancelarCierre();
    callarVoz();
    escucha.detener();
    cerrarPiloto();
  };

  // Al salir del panel (cerrar sesión), nada queda escuchando. Con ref: el
  // objeto de la escucha cambia en cada dibujo y no debe cortar el micrófono.
  const ultima = useRef(escucha);
  ultima.current = escucha;
  useEffect(() => () => ultima.current.detener(), []);

  return { activar, escribir, detener, nivel: escucha.nivel, estadoEscucha: escucha.estado };
}
