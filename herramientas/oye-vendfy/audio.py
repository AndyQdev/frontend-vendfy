"""
Cargar audio (TTS, FLEURS, MLS, MUSAN) y aumentarlo para entrenar "Oye Vendfy".

Todo a 16 kHz mono float32 en [-1, 1]. El aumentado imita una tienda real:
distinta velocidad y volumen, sala con eco, micrófono lejano o malo, y de
fondo murmullo de gente (armado con las grabaciones de habla), ruido o música.
"""
import io
import random
import tarfile
import wave
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, fftconvolve, resample_poly, sosfilt

SR = 16000
DATOS = Path(__file__).resolve().parent.parent / "datos"


def leer_wav(ruta) -> np.ndarray:
    x, sr = sf.read(str(ruta), dtype="float32", always_2d=False)
    if x.ndim > 1:
        x = x.mean(axis=1)
    if sr != SR:
        x = resample_poly(x, SR, sr).astype(np.float32)
    return x


def a_int16(x: np.ndarray) -> np.ndarray:
    return (np.clip(x, -1, 1) * 32767).astype(np.int16)


def recortar_silencio(x: np.ndarray, umbral_db=-40.0) -> np.ndarray:
    """La palabra sin los silencios de los bordes (ventanas de 10 ms)."""
    if not len(x):
        return x
    pico = np.max(np.abs(x)) + 1e-9
    ventana = 160
    n = len(x) // ventana
    if n == 0:
        return x
    energia = np.sqrt(np.mean(x[: n * ventana].reshape(n, ventana) ** 2, axis=1)) / pico
    sobre = np.where(20 * np.log10(energia + 1e-9) > umbral_db)[0]
    if not len(sobre):
        return x
    return x[max(0, sobre[0] * ventana - 480): min(len(x), (sobre[-1] + 1) * ventana + 480)]


# ─── Habla larga (negativos y murmullo) ────────────────────────────────────

def fleurs(parte: str):
    """Cada grabación de FLEURS es_419 (CC BY 4.0)."""
    with tarfile.open(DATOS / "fleurs" / f"{parte}.tar.gz") as t:
        for m in t:
            if m.name.endswith(".wav"):
                yield leer_bytes(t.extractfile(m).read())


def mls(n_archivos=4, desde=0):
    """Multilingual LibriSpeech, español (CC BY 4.0)."""
    import pyarrow.parquet as pq

    for i in range(desde, desde + n_archivos):
        ruta = DATOS / "mls" / f"train-{i:05d}.parquet"
        if not ruta.exists():
            continue
        f = pq.ParquetFile(ruta)
        for lote in f.iter_batches(batch_size=64, columns=["audio"]):
            for a in lote.column("audio").to_pylist():
                yield leer_bytes(a["bytes"])


def leer_bytes(b: bytes) -> np.ndarray:
    x, sr = sf.read(io.BytesIO(b), dtype="float32", always_2d=False)
    if x.ndim > 1:
        x = x.mean(axis=1)
    if sr != SR:
        x = resample_poly(x, SR, sr).astype(np.float32)
    return x


def musan(tipo: str):
    """MUSAN (CC BY 4.0): 'noise' o 'music'. Vacío si todavía no se bajó/descomprimió."""
    carpeta = DATOS / "musan" / "musan" / tipo
    for ruta in sorted(carpeta.rglob("*.wav")) if carpeta.exists() else []:
        yield leer_wav(ruta)


# ─── Aumentado ─────────────────────────────────────────────────────────────

class Fondos:
    """Lo que suena detrás: murmullo, ruido sintético o de MUSAN."""

    def __init__(self, habla: list[np.ndarray], ruidos: list[np.ndarray], rng: random.Random):
        self.habla = [h for h in habla if len(h) > SR]
        self.ruidos = [r for r in ruidos if len(r) > SR]
        self.rng = rng

    def trozo(self, fuente: np.ndarray, n: int) -> np.ndarray:
        if len(fuente) <= n:
            veces = n // len(fuente) + 1
            fuente = np.tile(fuente, veces)
        i = self.rng.randrange(0, len(fuente) - n)
        return fuente[i: i + n]

    def murmullo(self, n: int) -> np.ndarray:
        """Varias personas hablando a la vez, lejos (una tienda llena)."""
        k = self.rng.randint(3, 7)
        mezcla = sum(normalizar(self.trozo(self.rng.choice(self.habla), n)) * self.rng.uniform(0.3, 1.0) for _ in range(k))
        return mezcla

    def sintetico(self, n: int) -> np.ndarray:
        tipo = self.rng.choice(["blanco", "rosa", "marron", "zumbido", "ventilador"])
        blanco = np.random.randn(n).astype(np.float32)
        if tipo == "blanco":
            return blanco
        if tipo == "rosa":
            f = np.fft.rfft(blanco)
            f /= np.sqrt(np.arange(1, len(f) + 1))
            return np.fft.irfft(f, n).astype(np.float32)
        if tipo == "marron":
            return np.cumsum(blanco).astype(np.float32) - np.linspace(0, np.cumsum(blanco)[-1], n, dtype=np.float32)
        if tipo == "zumbido":
            t = np.arange(n) / SR
            base = self.rng.choice([50.0, 60.0])
            return (np.sin(2 * np.pi * base * t) + 0.5 * np.sin(2 * np.pi * base * 3 * t) + 0.05 * blanco).astype(np.float32)
        sos = butter(4, self.rng.uniform(200, 1500), "lowpass", fs=SR, output="sos")
        return sosfilt(sos, blanco).astype(np.float32)

    def fondo(self, n: int) -> np.ndarray:
        r = self.rng.random()
        if r < 0.45 and self.habla:
            return self.murmullo(n)
        if r < 0.75 and self.ruidos:
            return self.trozo(self.rng.choice(self.ruidos), n)
        return self.sintetico(n)


def normalizar(x: np.ndarray) -> np.ndarray:
    return x / (np.sqrt(np.mean(x**2)) + 1e-9)


def con_snr(senal: np.ndarray, ruido: np.ndarray, snr_db: float) -> np.ndarray:
    ps = np.mean(senal**2) + 1e-12
    pr = np.mean(ruido**2) + 1e-12
    return senal + ruido * np.sqrt(ps / (pr * 10 ** (snr_db / 10)))


def eco(x: np.ndarray, rng: random.Random) -> np.ndarray:
    """Sala: una respuesta al impulso sintética (ruido que decae), RT60 entre 0,1 y 0,7 s."""
    rt60 = rng.uniform(0.1, 0.7)
    n = int(rt60 * SR)
    t = np.arange(n) / SR
    rir = np.random.randn(n).astype(np.float32) * np.exp(-6.9 * t / rt60).astype(np.float32)
    rir[0] = 1.0
    y = fftconvolve(x, rir)[: len(x)]
    return (y / (np.max(np.abs(y)) + 1e-9) * np.max(np.abs(x))).astype(np.float32)


def velocidad(x: np.ndarray, f: float) -> np.ndarray:
    """Más rápido o más lento (cambia también el tono, como en una voz distinta)."""
    arriba = 100
    abajo = int(round(100 * f))
    return resample_poly(x, arriba, abajo).astype(np.float32)


def microfono(x: np.ndarray, rng: random.Random) -> np.ndarray:
    if rng.random() < 0.3:
        x = sosfilt(butter(4, rng.uniform(2800, 7000), "lowpass", fs=SR, output="sos"), x)
    if rng.random() < 0.3:
        x = sosfilt(butter(2, rng.uniform(80, 300), "highpass", fs=SR, output="sos"), x)
    return x.astype(np.float32)


def aumentar_en_ventana(palabra: np.ndarray, fondos: Fondos, rng: random.Random, n=32000, fin=(1.55, 1.98), snr=(-2.0, 25.0)) -> np.ndarray:
    """
    La palabra dentro de una ventana de `n` muestras, terminando entre fin[0] y
    fin[1] segundos, con su sala, su micrófono y algo de fondo.
    """
    x = velocidad(palabra, rng.uniform(0.88, 1.12))
    if rng.random() < 0.6:
        x = eco(x, rng)
    x = microfono(x, rng)
    x = normalizar(x) * 0.1
    termina = int(rng.uniform(*fin) * SR)
    empieza = termina - len(x)
    ventana = np.zeros(n, dtype=np.float32)
    if empieza < 0:
        x = x[-empieza:]
        empieza = 0
    ventana[empieza: empieza + len(x)] = x[: n - empieza]
    if rng.random() < 0.9:
        ventana = con_snr(ventana, fondos.fondo(n), rng.uniform(*snr))
    else:
        ventana = ventana + np.random.randn(n).astype(np.float32) * 1e-4
    nivel = 10 ** (rng.uniform(-32, -4) / 20)
    return (ventana / (np.max(np.abs(ventana)) + 1e-9) * nivel).astype(np.float32)


def leer_tts(carpeta: str, con_pedido=False) -> list[np.ndarray]:
    base = DATOS / "tts" / carpeta
    rutas = sorted(base.glob("*.wav")) + (sorted((base / "pedido").glob("*.wav")) if con_pedido else [])
    return [recortar_silencio(leer_wav(r)) for r in rutas]
