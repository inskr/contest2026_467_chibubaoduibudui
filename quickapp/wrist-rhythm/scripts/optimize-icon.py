import sys
from pathlib import Path

from PIL import Image


source = Path(sys.argv[1])
target = Path(sys.argv[2])
image = Image.open(source).convert("RGBA")
quantized = image.quantize(
    colors=256,
    method=Image.Quantize.FASTOCTREE,
    dither=Image.Dither.FLOYDSTEINBERG,
)
quantized.save(target, format="PNG", optimize=True)
print(target.stat().st_size)
