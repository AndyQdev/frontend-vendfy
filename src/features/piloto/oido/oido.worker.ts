/// <reference lib="webworker" />
/**
 * El oído de "Oye Vendfy", fuera del hilo de la pantalla: recibe el micrófono
 * de a 80 ms, corre el detector y, cuando oye la palabra, junta lo que sigue
 * hasta que la persona se calla. Nada sale del equipo hasta ese momento.
 */
import { Comando, PisoDeRuido, aWav, rms } from "./comando";
import { DetectorPalabra, Disparador } from "./detector";
import { crearEjecutor } from "./ejecutor-ort";
import type { DelOido, AlOido } from "./mensajes";

const PREVIO = 25; // 2 s antes de la palabra: la palabra misma va en el audio (el servidor la verifica)

let detector: DetectorPalabra | null = null;
let disparador: Disparador | null = null;
const piso = new PisoDeRuido();
let previo: Float32Array[] = [];
let antes: Float32Array[] = [];
let comando: Comando | null = null;
let pausado = false;
let pasos = 0;
let cola: Promise<void> = Promise.resolve();

const enviar = (m: DelOido, transferir: Transferable[] = []) => (self as unknown as Worker).postMessage(m, transferir);

/** De [−1, 1] a la escala int16 con la que se entrenó (valores enteros). */
function aInt16(paso: Float32Array): Float32Array {
  const x = new Float32Array(paso.length);
  for (let i = 0; i < paso.length; i++) x[i] = Math.round(Math.max(-1, Math.min(1, paso[i])) * 32767);
  return x;
}

async function procesar(paso: Float32Array) {
  if (!detector || !disparador) return;
  if (comando) {
    if (comando.empujar(paso)) {
      const audio = [...antes, ...comando.audio()];
      const wav = aWav(audio);
      enviar({ tipo: "comando", wav, hablo: comando.hablo }, [wav]);
      comando = null;
      antes = [];
      previo = [];
      detector.reiniciar();
      disparador.reiniciar();
    }
    return;
  }
  piso.empujar(rms(paso));
  previo.push(paso);
  if (previo.length > PREVIO) previo.shift();
  const p = await detector.procesar(aInt16(paso));
  if (++pasos % 3 === 0 && p != null) enviar({ tipo: "puntaje", p });
  if (pausado || !disparador.empujar(p)) return;
  enviar({ tipo: "palabra", p: p ?? 0 });
  antes = previo.slice();
  comando = new Comando(piso.valor());
}

self.onmessage = (e: MessageEvent<AlOido>) => {
  const m = e.data;
  switch (m.tipo) {
    case "iniciar":
      crearEjecutor(m.base)
        .then((ejecutor) => {
          detector = new DetectorPalabra(ejecutor);
          disparador = new Disparador(m.umbral, m.paciencia);
          enviar({ tipo: "listo" });
        })
        .catch((error) => enviar({ tipo: "error", mensaje: error instanceof Error ? error.message : String(error) }));
      return;
    case "audio": {
      const paso = m.paso;
      cola = cola.then(() => procesar(paso)).catch((error) => enviar({ tipo: "error", mensaje: String(error) }));
      return;
    }
    case "pausa":
      pausado = m.valor;
      if (m.valor) comando = null;
      disparador?.reiniciar();
      return;
    case "umbral":
      if (disparador) disparador.umbral = m.valor;
      return;
  }
};
