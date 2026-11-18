"""
Arma las características (embeddings de openWakeWord, 16 × 96 por ventana de
1,28 s) para entrenar y evaluar "Oye Vendfy". Guarda en datos/caracteristicas/.

    python caracteristicas.py            # todo
    python caracteristicas.py positivos  # solo un conjunto (positivos, tts, ruido, habla, eval)

Cada proceso del pool lee, aumenta y calcula por su cuenta: el principal solo
reparte (si no, el mezclado de fondos en un solo hilo era el cuello de botella).

Conjuntos:
  pos_train   "Oye Vendfy" de las voces de entrenamiento, aumentado ×16
  pos_reserva voces que el modelo nunca escuchó (para medir)
  neg_parcial la palabra cortada ("Oye Ven…"): no tiene que disparar
  neg_tts     frases parecidas y de la tienda, aumentadas ×6 (eval_tts: las de reserva)
  neg_ruido   solo fondo: murmullo, ruido, zumbido, música
  neg_fleurs / neg_mls   horas de habla en español, la mitad con fondo
  eval_fleurs / eval_mls habla que no entra al entrenamiento (para contar falsas alarmas por hora)
"""
import multiprocessing as mp
import random
import sys
import tarfile
import time
from itertools import islice

import numpy as np

from audio import DATOS, SR, Fondos, a_int16, aumentar_en_ventana, con_snr, leer_bytes, leer_tts, musan

SALIDA = DATOS / "caracteristicas"
OWW = DATOS / "oww"
VENTANA = 32000  # 2 s → 16 ventanas de embeddings

_feat = None
_fondos = None
_frases = []


def _iniciar(semilla):
    global _feat, _fondos, _frases
    from openwakeword.utils import AudioFeatures

    _feat = AudioFeatures(
        melspec_model_path=str(OWW / "melspectrogram.onnx"),
        embedding_model_path=str(OWW / "embedding_model.onnx"),
        ncpu=1,
    )
    rng = random.Random(semilla + mp.current_process().pid)
    np.random.seed((semilla + mp.current_process().pid) % 2**31)
    habla = []
    with tarfile.open(DATOS / "fleurs" / "dev.tar.gz") as t:
        for m in t:
            if m.name.endswith(".wav"):
                habla.append(leer_bytes(t.extractfile(m).read()))
    # 30 s de cada ruido y canción alcanzan para fondo: completas, las canciones
    # llenaban ~3 GB por proceso y la PC se quedaba sin memoria.
    ruidos = [r[: 30 * SR].copy() for r in islice(musan("noise"), 300)]
    ruidos += [m[len(m) // 3: len(m) // 3 + 30 * SR].copy() for m in islice(musan("music"), 150)]
    _fondos = Fondos(habla, ruidos, rng)
    # Frases que se dicen antes de la palabra ("bueno, oye Vendfy…").
    _frases = [f for f in leer_tts("negativos") if 0.3 * SR < len(f) < 3 * SR][:800]


def ventanas(emb: np.ndarray, paso: int) -> np.ndarray:
    if len(emb) < 16:
        return np.zeros((0, 16, 96), np.float16)
    idx = np.arange(0, len(emb) - 15, paso)
    return np.stack([emb[i: i + 16] for i in idx]).astype(np.float16)


def _largo(args) -> np.ndarray:
    """Una grabación larga (bytes) → ventanas. Con fondo, si se pide."""
    datos, con_fondo, paso = args
    x = leer_bytes(datos)
    if len(x) < SR:
        return np.zeros((0, 16, 96), np.float16)
    if con_fondo and _fondos.rng.random() < 0.5:
        x = con_snr(x, _fondos.fondo(len(x)), _fondos.rng.uniform(0, 20))
    x = (x / (np.max(np.abs(x)) + 1e-9) * 10 ** (_fondos.rng.uniform(-30, -4) / 20)).astype(np.float32)
    emb = _feat._get_embeddings(a_int16(x)).astype(np.float32)
    return ventanas(emb, paso)


def _largo_ruta(args) -> np.ndarray:
    """Un archivo largo de MUSAN (música, ruido, habla en inglés) → ventanas, a un volumen al azar."""
    ruta, paso = args
    from audio import leer_wav

    x = leer_wav(ruta)
    if len(x) < SR:
        return np.zeros((0, 16, 96), np.float16)
    x = (x / (np.max(np.abs(x)) + 1e-9) * 10 ** (_fondos.rng.uniform(-36, -4) / 20)).astype(np.float32)
    # Las canciones largas: hasta 4 minutos alcanzan (la variedad viene de tener muchas).
    x = x[: 240 * SR]
    emb = _feat._get_embeddings(a_int16(x)).astype(np.float32)
    return ventanas(emb, paso)


def _clips(args) -> np.ndarray:
    """Palabras/frases cortas → aumentadas en ventanas de 2 s → (N, 16, 96)."""
    palabras, veces, opciones = args
    clips = [aumentar_en_ventana(p, _fondos, _fondos.rng, **opciones) for p in palabras for _ in range(veces)]
    emb = _feat.embed_clips(a_int16(np.stack(clips)), batch_size=64, ncpu=1)
    return emb[:, -16:].astype(np.float16)


def _contexto(args) -> np.ndarray:
    """La palabra en medio de una conversación, más rápida o más lenta, con más ruido."""
    palabras, veces = args
    clips = [
        aumentar_en_ventana(p, _fondos, _fondos.rng, snr=(-3.0, 20.0), rapidez=(0.8, 1.25), previa=_fondos.rng.choice(_frases))
        for p in palabras
        for _ in range(veces)
    ]
    emb = _feat.embed_clips(a_int16(np.stack(clips)), batch_size=64, ncpu=1)
    return emb[:, -16:].astype(np.float16)


def _flujo(args) -> list:
    """
    Para medir como el navegador: la palabra (de voces de reserva) dentro de
    3,5 s de audio, y todas las ventanas de a 80 ms. Devuelve una secuencia por
    variante; se cuenta como oída si dispara (2 ventanas seguidas) en alguna.
    """
    palabras, veces = args
    salida = []
    for p in palabras:
        for k in range(veces):
            contexto = k % 2 == 1
            clip = aumentar_en_ventana(
                p, _fondos, _fondos.rng, n=56000, fin=(2.3, 2.7), snr=(0.0, 20.0),
                rapidez=(0.85, 1.2) if contexto else (0.9, 1.1),
                previa=_fondos.rng.choice(_frases) if contexto else None,
            )
            emb = _feat._get_embeddings(a_int16(clip)).astype(np.float32)
            salida.append(ventanas(emb, 1))
    return salida


def _ruido(n: int) -> np.ndarray:
    clips = []
    for _ in range(n):
        c = _fondos.fondo(VENTANA)
        clips.append((c / (np.max(np.abs(c)) + 1e-9) * 10 ** (_fondos.rng.uniform(-40, -6) / 20)).astype(np.float32))
    emb = _feat.embed_clips(a_int16(np.stack(clips)), batch_size=64, ncpu=1)
    return emb[:, -16:].astype(np.float16)


def en_lotes(pool, palabras, veces, opciones, tam=8):
    trabajos = [(palabras[i: i + tam], veces, opciones) for i in range(0, len(palabras), tam)]
    return np.concatenate(list(pool.imap(_clips, trabajos, chunksize=1)))


def guardar(nombre: str, x: np.ndarray):
    SALIDA.mkdir(parents=True, exist_ok=True)
    np.save(SALIDA / f"{nombre}.npy", x)
    print(f"  {nombre}: {x.shape}", flush=True)


def bytes_fleurs(parte: str):
    with tarfile.open(DATOS / "fleurs" / f"{parte}.tar.gz") as t:
        for m in t:
            if m.name.endswith(".wav"):
                yield t.extractfile(m).read()


def bytes_mls(archivos, maximo=None):
    import pyarrow.parquet as pq

    n = 0
    for i in archivos:
        ruta = DATOS / "mls" / f"train-{i:05d}.parquet"
        if not ruta.exists():
            continue
        for lote in pq.ParquetFile(ruta).iter_batches(batch_size=64, columns=["audio"]):
            for a in lote.column("audio").to_pylist():
                yield a["bytes"]
                n += 1
                if maximo and n >= maximo:
                    return


def largo(pool, nombre, fuente, con_fondo, paso, t0):
    partes = []
    for v in pool.imap(_largo, ((b, con_fondo, paso) for b in fuente), chunksize=4):
        partes.append(v)
        if len(partes) % 2000 == 0:
            print(f"  {nombre}: {len(partes)} grabaciones · {time.time() - t0:.0f} s", flush=True)
    guardar(nombre, np.concatenate(partes))


def main():
    que = sys.argv[1] if len(sys.argv) > 1 else "todo"
    rng = random.Random(11)
    t0 = time.time()
    with mp.Pool(6, initializer=_iniciar, initargs=(11,)) as pool:
        if que in ("todo", "positivos"):
            pal = [p for p in leer_tts("positivos") if 0.35 * SR < len(p) < 2.2 * SR]
            print(f"positivos: {len(pal)} clips", flush=True)
            guardar("pos_train", en_lotes(pool, pal, 16, {}))
            res = [p for p in leer_tts("reserva") if 0.35 * SR < len(p) < 2.2 * SR]
            print(f"reserva: {len(res)} clips", flush=True)
            guardar("pos_reserva", en_lotes(pool, res, 10, {"snr": (0.0, 20.0)}))
            # La palabra a medias ("Oye Ven…") no es la palabra.
            parciales = [p[: int(len(p) * rng.uniform(0.4, 0.75))] for p in pal]
            guardar("neg_parcial", en_lotes(pool, parciales, 3, {}))

        if que in ("todo", "contexto"):
            pal = [p for p in leer_tts("positivos") if 0.35 * SR < len(p) < 2.2 * SR]
            trabajos = [(pal[i: i + 8], 6) for i in range(0, len(pal), 8)]
            guardar("pos_contexto", np.concatenate(list(pool.imap(_contexto, trabajos, chunksize=1))))
            res = [p for p in leer_tts("reserva") if 0.35 * SR < len(p) < 2.2 * SR]
            trabajos = [(res[i: i + 8], 6) for i in range(0, len(res), 8)]
            guardar("pos_reserva_contexto", np.concatenate(list(pool.imap(_contexto, trabajos, chunksize=1))))

        if que in ("todo", "flujo"):
            res = [p for p in leer_tts("reserva") if 0.35 * SR < len(p) < 2.2 * SR]
            trabajos = [(res[i: i + 4], 8) for i in range(0, len(res), 4)]
            secuencias = [s for parte in pool.imap(_flujo, trabajos, chunksize=1) for s in parte]
            # Una tira con todas y dónde empieza cada una.
            largos = np.array([len(s) for s in secuencias])
            np.save(SALIDA / "flujo_reserva_largos.npy", largos)
            guardar("flujo_reserva", np.concatenate(secuencias))

        if que in ("todo", "tts"):
            neg = [n[: VENTANA - 800] for n in leer_tts("negativos") if len(n) > 0.2 * SR]
            print(f"negativos TTS: {len(neg)} clips", flush=True)
            guardar("neg_tts", en_lotes(pool, neg, 6, {"fin": (0.9, 1.99)}))
            res = [n[: VENTANA - 800] for n in leer_tts("reserva_neg") if len(n) > 0.2 * SR]
            guardar("eval_tts", en_lotes(pool, res, 4, {"fin": (0.9, 1.99)}))

        if que in ("todo", "ruido"):
            guardar("neg_ruido", np.concatenate(list(pool.imap(_ruido, [64] * 100, chunksize=1))))

        if que in ("todo", "habla"):
            if not (SALIDA / "neg_fleurs.npy").exists():
                largo(pool, "neg_fleurs", bytes_fleurs("train"), True, 3, t0)
            largo(pool, "neg_mls", bytes_mls([0, 1], maximo=9000), True, 4, t0)

        if que in ("todo", "musan"):
            # Lo que suena en una tienda: música, ruidos reales y la tele (habla en inglés).
            base = DATOS / "musan" / "musan"
            for nombre, carpeta, paso in (("neg_musica", "music", 4), ("neg_ruido_real", "noise", 2), ("neg_ingles", "speech", 6)):
                if (SALIDA / f"{nombre}.npy").exists():
                    continue
                rutas = sorted(str(r) for r in (base / carpeta).rglob("*.wav"))
                if not rutas:
                    print(f"  (sin {carpeta})", flush=True)
                    continue
                partes = list(pool.imap(_largo_ruta, ((r, paso) for r in rutas), chunksize=2))
                guardar(nombre, np.concatenate(partes))

        if que in ("todo", "eval"):
            # Para contar falsas alarmas: habla que no se usó, ventana a ventana (paso 1 = cada 80 ms).
            largo(pool, "eval_fleurs", bytes_fleurs("test"), False, 1, t0)
            largo(pool, "eval_mls", bytes_mls([3], maximo=2500), False, 1, t0)

    print(f"listo en {time.time() - t0:.0f} s", flush=True)


if __name__ == "__main__":
    main()
