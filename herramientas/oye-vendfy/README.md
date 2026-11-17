# Entrenamiento de «Oye Vendfy»

El detector de la palabra que corre en el panel (`src/features/piloto/oido/`).
Es la receta de openWakeWord: sus dos modelos fijos (espectrograma mel y
embedding de Google, Apache 2.0) y un clasificador chico entrenado por nosotros
(`public/oido/oye_vendfy.onnx`).

Los datos NO van al repo (≈30 GB). Se arman en `C:\Trabajos\Ecommerce\oye-vendfy\datos\`:

| Qué | De dónde | Licencia |
|---|---|---|
| «Oye Vendfy» y frases parecidas | `generar_tts.py`: 97 voces de Cloud TTS en español + 30 de Gemini TTS (Vertex) | propias |
| Habla en español (negativos) | FLEURS es_419 y Multilingual LibriSpeech (español) | CC BY 4.0 |
| Música, ruido y habla en inglés | MUSAN | CC BY 4.0 |

Los negativos que trae openWakeWord (ACAV100M) son de uso **no comercial**: se usan solo para medir, nunca para entrenar.

## Pasos

```bash
pip install openwakeword==0.6.0 onnx pyarrow soundfile librosa torch
python generar_tts.py            # voces (Cloud TTS con VOZ_TTS_API_KEY, Gemini con VERTEX_API_KEY)
python caracteristicas.py        # embeddings de todo (6 procesos, ~40 min)
python entrenar.py 30000         # GPU; exporta modelo/oye_vendfy.onnx y metricas.json
python audios_prueba.py          # audios para las pruebas de punta a punta
python puntajes_stream.py prueba/positiva.wav   # dónde dispara, paso a paso (igual que el navegador)
```

`claves.py` lee las claves de los `.env` locales sin imprimirlas.

## Estado (17/11/2026)

- v1 (`metricas-v1.json`): acierta 93 % con voces que nunca escuchó, pero dispara
  demasiado con música, tele y ruido de casa (≈50 falsas por hora antes de la
  verificación del servidor). El servidor descarta esas falsas alarmas en silencio,
  pero el modelo todavía no está para producción.
- v2 en curso: suma música, ruido real y habla en inglés de MUSAN como negativos
  y como fondo, con más peso a las falsas alarmas y regularización.
- La copia en el navegador da los mismos puntajes que Python (diferencia máxima
  0,0007) y tarda ~11 ms por paso de 80 ms.
