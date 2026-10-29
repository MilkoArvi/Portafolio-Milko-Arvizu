"""
Convierte la foto de Milko en una cuadrícula de brillo y bordes.
El sitio dibuja la cara con puntos (inicio) y con caracteres de código
(proyecto "Rostro en código") a partir de estos datos; la foto no se publica.

Uso:  python3 scripts/face-to-points.py [ruta-de-la-foto]
"""
import base64, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter, ImageOps

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).with_name("foto-milko.png"))
OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "face.ts"
N = 128  # columnas y filas de la cuadrícula

im = Image.open(SRC).convert("L")
w, h = im.size
s = min(w, h)
im = im.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2))
im = ImageOps.autocontrast(im, cutoff=1)
# Un poco de desenfoque antes de reducir para que los puntos no tiemblen.
small = im.filter(ImageFilter.GaussianBlur(0.6)).resize((N, N), Image.LANCZOS)
lum = np.asarray(small, dtype=np.float32) / 255.0
# Curva para separar la cara del fondo oscuro.
lum = np.clip((lum - 0.06) / 0.9, 0, 1) ** 1.15

# Bordes (Sobel) para pintar en verde ojos, lentes, cejas y contorno.
gx = np.zeros_like(lum); gy = np.zeros_like(lum)
gx[1:-1, 1:-1] = (lum[:-2, 2:] + 2 * lum[1:-1, 2:] + lum[2:, 2:]) - (lum[:-2, :-2] + 2 * lum[1:-1, :-2] + lum[2:, :-2])
gy[1:-1, 1:-1] = (lum[2:, :-2] + 2 * lum[2:, 1:-1] + lum[2:, 2:]) - (lum[:-2, :-2] + 2 * lum[:-2, 1:-1] + lum[:-2, 2:])
edge = np.sqrt(gx ** 2 + gy ** 2)
edge = np.clip(edge / np.percentile(edge, 98), 0, 1)

def b64(a):
    return base64.b64encode((a * 255).round().astype(np.uint8).tobytes()).decode()

OUT.write_text(
    "// Generado por scripts/face-to-points.py. No editar a mano.\n"
    f"export const FACE_N = {N};\n"
    f'export const FACE_LUM = "{b64(lum)}";\n'
    f'export const FACE_EDGE = "{b64(edge)}";\n'
)
print(f"ok: {OUT} ({N}x{N}), puntos visibles ~{int((lum > 0.12).sum())}")
