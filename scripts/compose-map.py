"""Harta expedițiilor din cele 10 insule PixelLab, pe cerul de noapte (stil foaia „Elemental Realms”).
python3 scripts/compose-map.py → public/realms/gameplay/all-worlds-map-px.png (810×486, afișată ×2)"""
import random
import re
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
W, H = 810, 486
src = (ROOT / 'src/realms/content.ts').read_text(encoding='utf8')
nodes = re.findall(r"mode: 'expedition',.*?x: (\d+),\s*y: (\d+),\s*image: '(\w+)'", src, re.S)
rnd = random.Random(4)
img = Image.new('RGBA', (W, H))
d = ImageDraw.Draw(img)
top, bottom = (14, 18, 48), (30, 44, 96)
for y in range(H):
    k = y / (H - 1)
    d.line([(0, y), (W, y)], fill=tuple(round(top[i] + (bottom[i] - top[i]) * k) for i in range(3)) + (255,))
# nori de nebuloasă, în trei tonuri
for _ in range(16):
    cx, cy = rnd.randrange(W), rnd.randrange(H)
    blobs = [(cx + rnd.randint(-50, 50), cy + rnd.randint(-14, 14), rnd.randint(10, 26)) for _ in range(rnd.randint(5, 9))]
    for t, col in ((0, (24, 32, 70)), (4, (29, 39, 82)), (9, (34, 46, 94))):
        for bx, by, r in blobs:
            rr = r - t
            if rr > 2:
                d.ellipse((bx - rr, by - rr // 2, bx + rr, by + rr // 2), fill=col + (255,))
for _ in range(220):
    x, y = rnd.randrange(W), rnd.randrange(H)
    c = rnd.choice([(255, 255, 255), (190, 210, 255), (255, 236, 170)])
    d.point((x, y), fill=c + (255,))
    if rnd.random() < 0.12:
        d.point([(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)], fill=c + (160,))


def mini(realm, size):
    isl = Image.open(ROOT / f'public/realms/worlds/{realm}-island.png').convert('RGBA')
    isl = isl.crop(isl.getbbox())
    f = 4
    small = isl.resize((isl.width // f, isl.height // f), Image.BOX)
    # înapoi pe paleta proprie a insulei (micșorarea a amestecat culori)
    pal = isl.convert('RGB').quantize(colors=32, method=Image.Quantize.MAXCOVERAGE)
    rgb = small.convert('RGB').quantize(palette=pal, dither=Image.Dither.NONE).convert('RGBA')
    a = small.getchannel('A').point(lambda v: 255 if v > 110 else 0)
    rgb.putalpha(a)
    return rgb


for x, y, realm in sorted(nodes, key=lambda n: int(n[1])):
    m = mini(realm, 128)
    cx, cy = int(x) * W // 100, int(y) * H // 100
    img.alpha_composite(m, (cx - m.width // 2, cy - int(m.height * 0.42)))
out = ROOT / 'public/realms/gameplay/all-worlds-map-px.png'
img.convert('RGB').save(out, optimize=True)
print(out, len(nodes), 'insule')
