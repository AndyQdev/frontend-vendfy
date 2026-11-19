"""Pasa las capturas de la guía (public/guia/*.png) a WebP y borra los PNG."""
import glob
import os

from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
for p in glob.glob(os.path.join(AQUI, "..", "..", "public", "guia", "*.png")):
    im = Image.open(p).convert("RGB")
    im.thumbnail((1800, 1800))
    im.save(p[:-4] + ".webp", "WEBP", quality=82, method=6)
    os.remove(p)
    print(os.path.basename(p)[:-4] + ".webp")
