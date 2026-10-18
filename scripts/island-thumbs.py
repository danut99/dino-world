"""Cartonașele lumilor (480×320): insula PixelLab pe cerul ei de noapte. python3 scripts/island-thumbs.py"""
import json
import re
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
skies = dict(re.findall(r"(\w+): \['(#\w+)', '(#\w+)'", (ROOT / 'src/realms/islands/index.ts').read_text()) and
             [(m[0], (m[1], m[2])) for m in re.findall(r"(\w+): \['(#\w+)', '(#\w+)'", (ROOT / 'src/realms/islands/index.ts').read_text())])
rgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
for realm, (top, bottom) in skies.items():
    meta = json.loads((ROOT / f'src/realms/islands/{realm}.json').read_text())
    isl = Image.open(ROOT / 'public' / meta['art'].lstrip('/')).convert('RGBA')
    W, H = 240, 160  # la ×2 → 480×320
    bg = Image.new('RGBA', (W, H))
    d = ImageDraw.Draw(bg)
    t, b = rgb(top), rgb(bottom)
    for y in range(H):
        k = y / (H - 1)
        d.line([(0, y), (W, y)], fill=tuple(round(t[i] + (b[i] - t[i]) * k) for i in range(3)) + (255,))
    bb = isl.getbbox()
    crop = isl.crop(bb)
    s = min((W - 8) / crop.width, (H - 8) / crop.height)
    # micșorare doar cu factori întregi inverși, ca pixelii să rămână curați
    f = max(1, int(1 / s) + (1 if 1 / s % 1 else 0))
    small = crop.resize((crop.width // f, crop.height // f), Image.NEAREST)
    bg.alpha_composite(small, ((W - small.width) // 2, (H - small.height) // 2))
    out = bg.resize((W * 2, H * 2), Image.NEAREST)
    out.save(ROOT / f'public/realms/worlds/{realm}-island-thumb.png', optimize=True)
    print(realm, small.size)
