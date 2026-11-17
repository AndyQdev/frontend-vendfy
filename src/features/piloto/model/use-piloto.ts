import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { useStore } from "@/app/providers/auth";
import type { Propuesta } from "@/entities/omnibox/model/types";
import { ventaEnCurso } from "@/entities/order";
import { useEscucha } from "@/features/scanner/model/escucha";
import { apiFetch } from "@/shared/api/client";
import { traerAlFrente } from "@/shared/nativo";
import { formatMoney } from "@/shared/lib/money";
import { callarVoz, decirFrases, preferenciasVoz, type FraseVoz } from "@/shared/voz";

import { entenderTexto, entenderVoz } from "../lib/api";
import { agregarAlCarrito, cantidadEnCarrito, lineasDeContexto, quitarDelCarrito, vaciarCarrito } from "../lib/carrito";
import {
  cajaPiloto,
  cerrarPiloto,
  estadoPiloto,
  pantallaPiloto,
  setPiloto,
  type CajaPiloto,
  type PantallasPiloto,
} from "../lib/estado";
import { NOMBRE_ESTADO, planDe, resumenAgregado, type AccionCaja, type BorradorPiloto, type PlanPiloto } from "./plan";
import { leerRespuesta, NOMBRE_PAGO, type PagoPiloto, type RespuestaPiloto } from "./respuestas";

/** Cuánto se espera a que conteste una pregunta sin volver a llamarlo. */
const VENTANA_MS = 8_000;
/** Lo primero que se dice después de llamarlo. */
const ESPERA_PRIMERA_MS = 10_000;
/** Entre una cosa y otra en la pantalla: que se vea qué hizo. */
const PAUSA_MS = 350;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

type PlanDe<T extends PlanPiloto["tipo"]> = Extract<PlanPiloto, { tipo: T }>;

/** Lo que el "sí" va a hacer. */
type Pendiente =
  | { tipo: "cobro" }
  | { tipo: "stock"; plan: PlanDe<"stock"> }
  | { tipo: "pedido"; plan: PlanDe<"pedido"> }
  | { tipo: "producto" };

/** Espera a que aparezca en la pantalla lo marcado con ese `data-piloto`. */
async function esperarElemento(marca: string, ms: number): Promise<boolean> {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    if (document.querySelector(`[data-piloto~="${CSS.escape(marca)}"]`)) return true;
    await dormir(150);
  }
  return false;
}

/**
 * El conductor del piloto: escucha, entiende, va a la pantalla, la llena
 * frente a la persona, pregunta lo que falta y hace lo pedido cuando dice "sí".
 *
 * Pantallas: Caja (vender y cobrar), Inventario (corregir el stock de uno o
 * de varios), Pedidos (moverlos de estado) y Productos (crear uno). Las
 * consultas que el servidor ya contesta se dicen; lo demás queda en el asistente.
 */
export function useConductorPiloto() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
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
    /** Lo que hará el próximo "sí". */
    pendiente: null as Pendiente | null,
    /** El producto nuevo que se está llenando. */
    borrador: null as BorradorPiloto | null,
    preguntoStock: false,
    /** Oyó "Oye Vendfy" y espera lo que se dijo después (del oído). */
    esperaComando: false,
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

  /** Terminó: queda el mensaje un rato y la tarjeta se cierra sola. */
  const terminar = async (turno: number, linea: string, frases?: FraseVoz[], ms = 5_000) => {
    ctx.current.pendiente = null;
    setPiloto({ pregunta: null });
    await decir(linea, frases);
    if (!vigente(turno)) return;
    setPiloto({ fase: "listo" });
    programarCierre(ms);
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

  // ─── Llevar a una pantalla ────────────────────────────────────────────────

  /** Va a la ruta (si no está ahí) y espera a que la pantalla se preste al piloto. */
  const irA = async <K extends keyof PantallasPiloto>(ruta: string, clave: K, turno: number): Promise<PantallasPiloto[K] | null> => {
    if (!ctx.current.pathname.startsWith(ruta)) ctx.current.navigate(ruta);
    const fin = Date.now() + 10_000;
    while (Date.now() < fin) {
      const api = pantallaPiloto(clave);
      if (api) return api;
      if (!vigente(turno)) return null;
      await dormir(120);
    }
    return null;
  };

  const irACaja = (turno: number) => irA("/caja", "caja", turno);

  const sinPantalla = async (nombre: string) => {
    setPiloto({ fase: "error", foco: null, pregunta: null, tabla: null });
    ctx.current.pendiente = null;
    await decir(`No pude abrir ${nombre}. Revisa que tu usuario tenga acceso.`);
  };

  // ─── Caja ─────────────────────────────────────────────────────────────────

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
    const total = cajaPiloto()?.total() ?? 0;
    const pago = ctx.current.pago ?? "efectivo";
    ctx.current.pendiente = { tipo: "cobro" };
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
    if (!caja) return sinPantalla("la Caja");
    const pago = ctx.current.pago;
    if (!pago) return preguntarPago(turno);
    setPiloto({ fase: "trabajando", foco: "caja:cobrar", pregunta: null, linea: "Cobrando…" });
    await dormir(500); // que se vea el botón antes de que la venta desaparezca
    const r = await caja.cobrar(pago);
    if (!vigente(turno)) return;
    ctx.current.pago = null;
    ctx.current.quiereCobrar = false;
    ctx.current.pendiente = null;
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
    await terminar(turno, linea, frases);
  };

  /** Lo que sigue después de cargar: cobrar si lo pidió, o preguntar si hay algo más. */
  const despuesDeCargar = async (turno: number, antes: string) => {
    if (!vigente(turno)) return;
    if (!ventaEnCurso().length) {
      setPiloto({ foco: null });
      await terminar(turno, antes || "La venta está vacía.", undefined, 3_000);
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

  const vender = async (turno: number, plan: PlanDe<"caja">) => {
    const caja = await irACaja(turno);
    if (!caja) return sinPantalla("la Caja");
    setPiloto({ fase: "trabajando", pregunta: null, tabla: null });
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

  // ─── Inventario ───────────────────────────────────────────────────────────

  const corregirStock = async (turno: number, plan: PlanDe<"stock">) => {
    const inventario = await irA("/inventory", "inventario", turno);
    if (!inventario) return sinPantalla("el Inventario");
    const uno = plan.filas.length === 1 ? plan.filas[0] : null;
    setPiloto({
      fase: "trabajando",
      pregunta: null,
      tabla: {
        titulo: uno ? "Corregir el stock" : `Corregir el stock de ${plan.filas.length} productos`,
        filas: plan.filas.map((f) => ({ nombre: f.producto, antes: f.antes == null ? "—" : String(f.antes), despues: String(f.despues) })),
      },
    });
    // Con uno solo, se escribe en el buscador y su fila queda marcada.
    if (uno) {
      await inventario.buscar(uno.producto);
      if (await esperarElemento(`inventario:${uno.productId}`, 6_000)) setPiloto({ foco: `inventario:${uno.productId}` });
    }
    if (!vigente(turno)) return;
    ctx.current.pendiente = { tipo: "stock", plan };
    setPiloto({ pregunta: "confirmar" });
    await decir(
      uno
        ? `${uno.producto}: ${uno.antes != null ? `hay ${uno.antes}, ` : ""}quedan ${uno.despues}. ¿Lo ajusto?`
        : `Son ${plan.filas.length} productos. ¿Los ajusto?`,
    );
    escucharRespuesta(turno);
  };

  const confirmarStock = async (turno: number, plan: PlanDe<"stock">) => {
    setPiloto({ fase: "trabajando", pregunta: null, linea: "Ajustando…" });
    try {
      await apiFetch("/api/omnibox/confirmar", {
        method: "POST",
        body: { intencion: "ajustar_stock", entidades: plan.entidades, storeId: ctx.current.storeId },
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["inventory"] }),
        qc.invalidateQueries({ queryKey: ["inventory-infinite"] }),
        qc.invalidateQueries({ queryKey: ["omnibox"] }),
      ]);
      if (!vigente(turno)) return;
      setPiloto({ tabla: null });
      await terminar(turno, plan.filas.length === 1 ? "Listo, stock corregido." : `Listo, corregí el stock de ${plan.filas.length} productos.`);
    } catch (e) {
      await fallo(turno, e);
    }
  };

  // ─── Pedidos ──────────────────────────────────────────────────────────────

  const moverPedido = async (turno: number, plan: PlanDe<"pedido">) => {
    if (!ctx.current.pathname.startsWith("/orders")) ctx.current.navigate("/orders");
    const estado = NOMBRE_ESTADO[plan.estado] ?? plan.estado;
    setPiloto({
      fase: "trabajando",
      pregunta: null,
      tabla: {
        titulo: `Pedido${plan.numero ? ` #${plan.numero}` : ""}`,
        filas: [{ nombre: plan.cliente ?? "Sin cliente", antes: NOMBRE_ESTADO[plan.antes] ?? plan.antes, despues: estado }],
      },
    });
    if (await esperarElemento(`pedido:${plan.orderId}`, 8_000)) setPiloto({ foco: `pedido:${plan.orderId}` });
    if (!vigente(turno)) return;
    ctx.current.pendiente = { tipo: "pedido", plan };
    setPiloto({ pregunta: "confirmar" });
    await decir(`¿Paso el pedido${plan.numero ? ` ${plan.numero}` : ""}${plan.cliente ? ` de ${plan.cliente}` : ""} a ${estado.toLowerCase()}?`);
    escucharRespuesta(turno);
  };

  const confirmarPedido = async (turno: number, plan: PlanDe<"pedido">) => {
    setPiloto({ fase: "trabajando", pregunta: null, linea: "Moviendo el pedido…" });
    try {
      await apiFetch(`/api/omnibox/pedido/${plan.orderId}/estado`, {
        method: "POST",
        body: { storeId: ctx.current.storeId, estado: plan.estado },
      });
      await qc.invalidateQueries({ queryKey: ["orders"] });
      if (!vigente(turno)) return;
      setPiloto({ tabla: null });
      await terminar(turno, `Listo, el pedido pasó a ${(NOMBRE_ESTADO[plan.estado] ?? plan.estado).toLowerCase()}.`);
    } catch (e) {
      await fallo(turno, e);
    }
  };

  // ─── Producto nuevo ───────────────────────────────────────────────────────

  const formularioProducto = (turno: number) => irA("/products/create", "producto", turno);

  const crearProducto = async (turno: number, plan: PlanDe<"producto">) => {
    const form = await formularioProducto(turno);
    if (!form) return sinPantalla("el formulario de productos");
    const b = { ...plan.borrador };
    ctx.current.borrador = b;
    ctx.current.preguntoStock = false;
    setPiloto({ fase: "trabajando", pregunta: null, tabla: null, foco: "producto:nombre" });
    await dormir(PAUSA_MS);
    await form.escribir("nombre", b.nombre);
    if (b.precio != null) {
      setPiloto({ foco: "producto:precio" });
      await dormir(PAUSA_MS);
      await form.escribir("precio", b.precio);
    }
    if (b.stock != null) {
      setPiloto({ foco: "producto:stock" });
      await dormir(PAUSA_MS);
      await form.escribir("stock", b.stock);
    }
    if (b.categoria) {
      setPiloto({ foco: "producto:categoria" });
      await dormir(PAUSA_MS);
      await form.escribir("categoria", b.categoria);
    }
    await dormir(PAUSA_MS);
    if (!vigente(turno)) return;
    return siguienteDelProducto(turno);
  };

  /** Pregunta lo que falta (precio, después cuántas tiene) y al final "¿Lo creo?". */
  const siguienteDelProducto = async (turno: number) => {
    const b = ctx.current.borrador;
    if (!b) return;
    if (b.precio == null) {
      setPiloto({ pregunta: "precio", foco: "producto:precio" });
      await decir(`${b.nombre}. ¿A cuánto lo vendes?`);
      return escucharRespuesta(turno);
    }
    if (b.stock == null && !ctx.current.preguntoStock) {
      ctx.current.preguntoStock = true;
      setPiloto({ pregunta: "cantidad", foco: "producto:stock" });
      await decir("¿Cuántas tienes ahora?");
      return escucharRespuesta(turno);
    }
    ctx.current.pendiente = { tipo: "producto" };
    setPiloto({ pregunta: "confirmar", foco: "producto:guardar" });
    await decir(`${b.nombre} a ${formatMoney(b.precio)}${b.stock ? `, ${b.stock} en stock` : ""}. ¿Lo creo?`);
    escucharRespuesta(turno);
  };

  const anotarEnProducto = async (turno: number, campo: "precio" | "stock", valor: number) => {
    const form = await formularioProducto(turno);
    const b = ctx.current.borrador;
    if (!form || !b) return sinPantalla("el formulario de productos");
    if (campo === "precio") b.precio = valor;
    else b.stock = valor;
    setPiloto({ fase: "trabajando", foco: `producto:${campo}` });
    await dormir(PAUSA_MS);
    await form.escribir(campo, valor);
    await dormir(PAUSA_MS);
    return siguienteDelProducto(turno);
  };

  const guardarProducto = async (turno: number) => {
    const form = await formularioProducto(turno);
    const b = ctx.current.borrador;
    if (!form || !b) return sinPantalla("el formulario de productos");
    setPiloto({ fase: "trabajando", pregunta: null, foco: "producto:guardar", linea: "Guardando…" });
    await dormir(500);
    const r = await form.guardar();
    if (!vigente(turno)) return;
    if (r.ok === false) {
      setPiloto({ fase: "error" });
      ctx.current.pendiente = null;
      await decir(r.error);
      return;
    }
    ctx.current.borrador = null;
    setPiloto({ foco: null });
    await terminar(turno, `Listo, creé ${b.nombre}.`);
  };

  // ─── Lo que se dijo ───────────────────────────────────────────────────────

  /** El "sí" a "¿Lo cobro?", "¿Lo ajusto?", "¿Lo paso?" o "¿Lo creo?". */
  const confirmar = (turno: number) => {
    const p = ctx.current.pendiente;
    if (p?.tipo === "stock") return confirmarStock(turno, p.plan);
    if (p?.tipo === "pedido") return confirmarPedido(turno, p.plan);
    if (p?.tipo === "producto") return guardarProducto(turno);
    return cobrar(turno);
  };

  const responder = async (turno: number, r: RespuestaPiloto) => {
    const pregunta = estadoPiloto().pregunta;
    switch (r.tipo) {
      case "parar":
        callarVoz();
        escucha.detener();
        ctx.current.quiereCobrar = false;
        ctx.current.pendiente = null;
        setPiloto({ fase: "listo", linea: "Listo, me detengo.", pregunta: null, foco: null, tabla: null });
        programarCierre(1_200);
        return;
      case "numero":
        return anotarEnProducto(turno, pregunta === "precio" ? "precio" : "stock", r.valor);
      case "pago": {
        const caja = await irACaja(turno);
        if (!caja) return sinPantalla("la Caja");
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
        if (!(await irACaja(turno))) return sinPantalla("la Caja");
        if (!ventaEnCurso().length) {
          setPiloto({ pregunta: null });
          await decir("La venta está vacía. ¿Qué le vendo?");
          return escucharRespuesta(turno);
        }
        return ctx.current.pago ? cobrar(turno) : preguntarPago(turno);
      case "si":
        if (pregunta === "confirmar") return confirmar(turno);
        if (pregunta === "pago") {
          await decir("¿Efectivo, QR o tarjeta?");
          return escucharRespuesta(turno);
        }
        if (pregunta === "precio" || pregunta === "cantidad") {
          await decir(pregunta === "precio" ? "¿A cuánto? Dime el número." : "¿Cuántas? Dime el número.");
          return escucharRespuesta(turno);
        }
        // "¿Algo más?" → "sí": que lo diga.
        setPiloto({ pregunta: null });
        await decir("Dime.");
        setPiloto({ fase: "escuchando" });
        void escucha.escuchar(VENTANA_MS);
        return;
      case "no": {
        if (pregunta === "seguir") return ctx.current.pago ? preguntarCobro(turno) : preguntarPago(turno);
        const p = ctx.current.pendiente;
        ctx.current.quiereCobrar = false;
        setPiloto({ foco: null, tabla: null });
        const linea =
          pregunta === "confirmar" && (!p || p.tipo === "cobro")
            ? "Bueno, no la cobro. La venta queda abierta."
            : pregunta === "confirmar"
              ? "Bueno, no lo hago."
              : "Bueno. Queda como está.";
        await terminar(turno, linea, undefined, 3_000);
        return;
      }
    }
  };

  const ejecutar = async (turno: number, p: Propuesta) => {
    const plan = planDe(p);
    // Un pedido nuevo cancela lo que esperaba un "sí".
    ctx.current.pendiente = null;
    switch (plan.tipo) {
      case "decir":
        setPiloto({ foco: null, tabla: null });
        return terminar(turno, plan.texto, undefined, 6_000);
      case "asistente":
        setPiloto({ pregunta: null, foco: null, tabla: null, irAlAsistente: true });
        await decir(plan.texto);
        if (vigente(turno)) setPiloto({ fase: "listo" });
        return;
      case "caja":
        return vender(turno, plan);
      case "stock":
        return corregirStock(turno, plan);
      case "pedido":
        return moverPedido(turno, plan);
      case "producto":
        return crearProducto(turno, plan);
    }
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
    ctx.current.pendiente = null;
    setPiloto({ fase: "error", foco: null, pregunta: null });
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

  /** F9, el botón o la palabra: abre el micrófono; si ya está escuchando, entrega lo dicho. */
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

  /**
   * El oído oyó "Oye Vendfy": se abre ya ("Te escucho…") mientras sigue
   * juntando lo que se dice. Si estaba hablando, se calla (como Siri); si
   * estaba cobrando o guardando, no se interrumpe.
   */
  const alOirPalabra = () => {
    const e = estadoPiloto();
    if (e.fase === "pensando" || e.fase === "trabajando") return;
    cancelarCierre();
    callarVoz();
    escucha.detener();
    ctx.current.turno++;
    ctx.current.esperaComando = true;
    ctx.current.pendiente = null;
    // Con Vendfy minimizado o detrás de otro programa (app de Windows/Android): al frente.
    traerAlFrente();
    setPiloto({ abierto: true, fase: "escuchando", dicho: null, linea: "Te escucho…", pregunta: null, foco: null, tabla: null, irAlAsistente: false });
  };

  /** Lo dicho después de la palabra (con la palabra adelante: el servidor la confirma). */
  const oirConPalabra = async (wav: Blob) => {
    if (!ctx.current.esperaComando) return;
    ctx.current.esperaComando = false;
    const turno = ctx.current.turno;
    const tienda = ctx.current.storeId;
    if (!tienda) return decir("Primero elige una tienda.");
    setPiloto({ fase: "pensando", linea: null });
    try {
      const r = await entenderVoz(wav, tienda, lineasDeContexto(), true);
      if (!vigente(turno)) return;
      // Falsa alarma: no era "Oye Vendfy" (la tele, "oye, vendí…"). Se cierra sin decir nada.
      if (r.palabra === false) {
        cerrarPiloto();
        return;
      }
      const texto = r.transcripcion.texto?.trim();
      if (!texto) {
        await decir("¿Sí? Dime.");
        return escucharRespuesta(turno);
      }
      setPiloto({ dicho: texto });
      await atender(turno, texto, async () => r.propuesta);
    } catch (e) {
      await fallo(turno, e);
    }
  };

  const detener = () => {
    ctx.current.esperaComando = false;
    ctx.current.turno++;
    ctx.current.quiereCobrar = false;
    ctx.current.pendiente = null;
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

  return { activar, escribir, detener, alOirPalabra, oirConPalabra, nivel: escucha.nivel, estadoEscucha: escucha.estado };
}
