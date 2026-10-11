/**
 * Detecta lecturas de una pistola de código de barras en CUALQUIER parte del
 * panel, esté o no el foco en un campo.
 *
 * Una pistola USB o Bluetooth en modo teclado "escribe" el código y aprieta
 * Enter, igual que una persona, pero mucho más rápido: entre tecla y tecla
 * pasan 5-30 ms, y nadie escribe así cuatro teclas seguidas. Esa es toda la
 * diferencia, y alcanza.
 *
 * El problema es que las primeras teclas llegan antes de saber que es una
 * pistola, y si el foco está en un campo se escriben ahí. Por eso:
 *
 *   1. Al empezar una ráfaga se saca una foto del campo (valor y cursor).
 *   2. Desde la segunda tecla rápida (`TRAGAR_DESDE`), las teclas se frenan
 *      (`preventDefault`) y no llegan al campo.
 *   3. Con el Enter se devuelve el campo a la foto —se borran las primeras
 *      teclas que sí entraron— y se frena el Enter, que si no mandaría el
 *      formulario.
 *   4. Si la ráfaga se corta sin Enter (era alguien escribiendo rapidísimo),
 *      las teclas frenadas se devuelven al campo: nunca se pierde lo que
 *      escribió una persona.
 *
 * Un campo puede pedir el código para sí con `data-scanner="input"` (el campo
 * "Código de barras" del formulario de producto): ahí las teclas entran
 * normal y solo se frena el Enter.
 *
 * No depende de React: se prueba solo y se monta una vez por ventana.
 */

/** Máxima pausa entre dos teclas de una misma lectura. */
const PAUSA_MAXIMA_MS = 50;
/**
 * Desde qué tecla de una ráfaga se frenan. Desde la segunda: así a un campo
 * solo llega UNA tecla, y la pantalla no se redibuja con cada dígito (un
 * buscador que filtra al escribir, como el de Productos, sí lo haría). Si
 * resulta que era una persona escribiendo rápido, `abandonar` devuelve la
 * tecla frenada en cuanto llega la siguiente o pasan 120 ms.
 */
const TRAGAR_DESDE = 2;
/** Largo mínimo de un código. EAN-8 / UPC-E tienen 8; las etiquetas propias, menos. */
const LARGO_MINIMO = 4;
/** Una lectura sin Enter (pistolas configuradas sin sufijo) se da por terminada tras este silencio. */
const FIN_SIN_ENTER_MS = 120;
/** Sin Enter se exige un código más largo, para no confundir a nadie que escribe rápido. */
const LARGO_MINIMO_SIN_ENTER = 8;

export interface Lectura {
  codigo: string;
  /** El elemento que tenía el foco cuando llegó la lectura. */
  destino: Element | null;
  /** Si el campo con foco pidió el código para sí (`data-scanner="input"`). */
  paraCampo: boolean;
  duracionMs: number;
}

type Editable = HTMLInputElement | HTMLTextAreaElement;

interface Foto {
  el: Editable;
  valor: string;
  inicio: number | null;
  fin: number | null;
}

const esEditable = (el: Element | null): el is Editable =>
  !!el &&
  ((el instanceof HTMLInputElement && !["checkbox", "radio", "button", "submit", "file", "range", "color"].includes(el.type)) ||
    el instanceof HTMLTextAreaElement);

const pideElCodigo = (el: Element | null) => !!el?.closest?.('[data-scanner="input"]');

/**
 * Escribe en un campo controlado por React. Asignar `value` a secas no avisa
 * a React (el `onChange` nunca se dispara y el estado queda viejo): hay que
 * usar el setter nativo del prototipo y emitir un `input` que burbujee.
 */
function escribirEnCampo(el: Editable, valor: string, cursor?: number | null) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, valor);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  if (cursor != null) {
    try {
      el.setSelectionRange(cursor, cursor);
    } catch {
      // type="number" y otros no admiten selección: no importa.
    }
  }
}

/** Inserta texto donde está el cursor, como si se hubiera tecleado. */
function insertarEnCampo(el: Editable, texto: string) {
  let inicio: number | null = null;
  let fin: number | null = null;
  try {
    inicio = el.selectionStart;
    fin = el.selectionEnd;
  } catch {
    // ídem: campos sin selección.
  }
  const a = inicio ?? el.value.length;
  const b = fin ?? el.value.length;
  escribirEnCampo(el, el.value.slice(0, a) + texto + el.value.slice(b), a + texto.length);
}

export function crearDetector(alLeer: (lectura: Lectura) => void) {
  let buffer = "";
  let tiempos: number[] = [];
  let tragadas = "";
  let foto: Foto | null = null;
  let destino: Element | null = null;
  let temporizador: ReturnType<typeof setTimeout> | null = null;

  const ultimoTiempo = () => tiempos[tiempos.length - 1] ?? 0;

  const reiniciar = () => {
    buffer = "";
    tiempos = [];
    tragadas = "";
    foto = null;
    destino = null;
    if (temporizador) clearTimeout(temporizador);
    temporizador = null;
  };

  /** La ráfaga se cortó y no era una pistola: se devuelve lo frenado. */
  const abandonar = () => {
    if (tragadas && esEditable(destino) && document.activeElement === destino) {
      insertarEnCampo(destino, tragadas);
    }
    reiniciar();
  };

  const esRafaga = () => {
    for (let i = 1; i < tiempos.length; i++) {
      if (tiempos[i] - tiempos[i - 1] > PAUSA_MAXIMA_MS) return false;
    }
    return true;
  };

  const terminar = (codigo: string) => {
    const paraCampo = pideElCodigo(destino);
    // Se deshace lo que alcanzó a entrar al campo antes de reconocer la
    // pistola. Si el campo pidió el código, se deja como está.
    if (!paraCampo && foto && foto.el.isConnected) {
      escribirEnCampo(foto.el, foto.valor, foto.inicio);
    } else if (paraCampo && esEditable(destino)) {
      // El campo "Código de barras" queda con el código leído, entero: si
      // tenía otro, se reemplaza (escanear de nuevo es corregir).
      escribirEnCampo(destino, codigo, codigo.length);
    }
    const lectura: Lectura = {
      codigo,
      destino,
      paraCampo,
      duracionMs: Math.round(ultimoTiempo() - (tiempos[0] ?? 0)),
    };
    reiniciar();
    alLeer(lectura);
  };

  const alPresionar = (e: KeyboardEvent) => {
    if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) {
      if (buffer) abandonar();
      return;
    }
    const ahora = e.timeStamp || performance.now();

    if (e.key === "Enter" || e.key === "Tab") {
      const ultimo = ultimoTiempo();
      const rapido = ahora - ultimo <= PAUSA_MAXIMA_MS * 2;
      if (buffer.length >= LARGO_MINIMO && esRafaga() && rapido) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        terminar(buffer);
      } else if (buffer) {
        abandonar();
      }
      return;
    }

    // Solo cuentan los caracteres imprimibles. Shift y compañía no cortan
    // la ráfaga: la pistola los manda para las mayúsculas.
    if (e.key.length !== 1) return;

    if (buffer && ahora - ultimoTiempo() > PAUSA_MAXIMA_MS) {
      // Pausa larga: lo anterior era una persona. Empieza una ráfaga nueva.
      abandonar();
    }

    if (!buffer) {
      destino = document.activeElement;
      if (esEditable(destino)) {
        let inicio: number | null = null;
        let fin: number | null = null;
        try {
          inicio = destino.selectionStart;
          fin = destino.selectionEnd;
        } catch {
          // campos sin selección
        }
        foto = { el: destino, valor: destino.value, inicio, fin };
      }
    }

    buffer += e.key;
    tiempos.push(ahora);

    if (buffer.length >= TRAGAR_DESDE && esRafaga()) {
      e.preventDefault();
      e.stopPropagation();
      tragadas += e.key;
    }

    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      if (buffer.length >= LARGO_MINIMO_SIN_ENTER && esRafaga()) terminar(buffer);
      else abandonar();
    }, FIN_SIN_ENTER_MS);
  };

  // Fase de captura en window: llega antes que cualquier onKeyDown de la
  // pantalla (un buscador que reacciona al Enter, un formulario que se envía).
  window.addEventListener("keydown", alPresionar, true);
  return () => {
    window.removeEventListener("keydown", alPresionar, true);
    reiniciar();
  };
}
