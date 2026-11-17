"""Lee las claves de los .env de Vendfy sin imprimirlas."""
import re
from pathlib import Path

FRONT = Path(r"C:\Trabajos\Ecommerce\ecommerce-frontend\.env")
BACK = Path(r"C:\Trabajos\Ecommerce\ventas-service\.env")


def _leer(ruta: Path, clave: str) -> str:
    m = re.search(rf"^{clave}=(.*)$", ruta.read_text(encoding="utf-8"), re.M)
    if not m:
        raise SystemExit(f"falta {clave} en {ruta}")
    return m.group(1).strip().strip('"')


def vertex() -> str:
    return _leer(FRONT, "VERTEX_API_KEY")


def cloud_tts() -> str:
    return _leer(BACK, "VOZ_TTS_API_KEY")
