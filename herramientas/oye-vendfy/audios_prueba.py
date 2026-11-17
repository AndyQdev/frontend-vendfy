"""
Audios para las pruebas de punta a punta (Chrome los usa como si fueran el
micrófono: --use-file-for-fake-audio-capture). Voces que el modelo NUNCA
escuchó. Salen a datos/prueba/ y se copian a las pruebas del panel.

  positiva.wav  5 s de tienda + "Oye Vendfy, vende dos sprite." + silencio
  pausa.wav     5 s + "Oye Vendfy." + 1,2 s + "¿A cuánto está el dólar?" + silencio
  negativa.wav  5 s + "Oye, vendí dos cocas." + "Dame una Pepsi, por favor." + charla
  tienda.wav    60 s de charla y ruido de tienda, sin la palabra
"""
import base64
import json
import tarfile
import urllib.request
from pathlib import Path

import numpy as np

from audio import DATOS, SR, con_snr, leer_bytes
from claves import cloud_tts
from generar_tts import guardar, pcm16

SALIDA = DATOS / "prueba"
VOZ = ("es-US", "es-US-Chirp3-HD-Charon")  # de reserva: no entró al entrenamiento
VOZ_2 = ("es-US", "es-US-Chirp3-HD-Kore")


def decir(texto: str, voz=VOZ) -> np.ndarray:
    cuerpo = {"input": {"text": texto}, "voice": {"languageCode": voz[0], "name": voz[1]}, "audioConfig": {"audioEncoding": "LINEAR16", "sampleRateHertz": SR}}
    req = urllib.request.Request("https://texttospeech.googleapis.com/v1/text:synthesize", data=json.dumps(cuerpo).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": cloud_tts()})
    return pcm16(base64.b64decode(json.load(urllib.request.urlopen(req))["audioContent"]))


def silencio(seg: float) -> np.ndarray:
    return np.zeros(int(seg * SR), np.float32)


def charla(seg: float) -> np.ndarray:
    """Habla de FLEURS test (no se usó para entrenar), una tras otra."""
    partes, total = [], 0
    with tarfile.open(DATOS / "fleurs" / "test.tar.gz") as t:
        for m in t:
            if m.name.endswith(".wav"):
                x = leer_bytes(t.extractfile(m).read())
                partes.append(x / (np.max(np.abs(x)) + 1e-9) * 0.3)
                total += len(x)
                if total >= seg * SR:
                    break
    return np.concatenate(partes)[: int(seg * SR)]


def con_tienda(x: np.ndarray, snr=18.0) -> np.ndarray:
    """Un poco de ruido de fondo, como una tienda tranquila."""
    rng = np.random.default_rng(3)
    ruido = rng.standard_normal(len(x)).astype(np.float32)
    ruido = np.convolve(ruido, np.ones(8) / 8, mode="same")
    y = con_snr(x, ruido, snr) if np.any(x) else x + ruido * 0.002
    return (y / (np.max(np.abs(y)) + 1e-9) * 0.5).astype(np.float32)


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    pos = np.concatenate([silencio(5), decir("Oye Vendfy, vende dos sprite."), silencio(25)])
    guardar(SALIDA / "positiva.wav", con_tienda(pos))
    pausa = np.concatenate([silencio(5), decir("Oye Vendfy."), silencio(1.2), decir("¿A cuánto está el dólar?"), silencio(25)])
    guardar(SALIDA / "pausa.wav", con_tienda(pausa))
    neg = np.concatenate([silencio(5), decir("Oye, vendí dos cocas.", VOZ_2), silencio(0.8), decir("Dame una Pepsi, por favor.", VOZ_2), charla(20), silencio(5)])
    guardar(SALIDA / "negativa.wav", con_tienda(neg))
    guardar(SALIDA / "tienda.wav", con_tienda(np.concatenate([silencio(3), charla(60)]), snr=12.0))
    for f in sorted(SALIDA.glob("*.wav")):
        print(f.name, f"{f.stat().st_size / SR / 2:.1f} s")


if __name__ == "__main__":
    main()
