"""Generează UI-ul pixel Dino Realms din paleta master: rame 9-slice, butoane și iconițe 16 px.

Rulează: python3 scripts/pixel-ui.py
Ieșiri: public/realms/ui/*.png, src/realms/ui/icons.json, src/realms/ui/palette.css
Totul e desenat pe gridă la 1 px de artă; CSS-ul îl afișează la ×2 cu image-rendering: pixelated.
"""
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
PAL = json.loads((ROOT / 'src/realms/ui/palette.json').read_text(encoding='utf8'))
R = PAL['ramps']
OUT = ROOT / 'public/realms/ui'
OUT.mkdir(parents=True, exist_ok=True)


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4)) + (255,)


OUTLINE = rgb(PAL['outline'])


# ---------------------------------------------------------------- icons
class Icon:
    """Piese desenate pe măști, umbrite automat (lumină din stânga-sus) și conturate."""

    def __init__(self, size=16):
        self.size = size
        self.parts = []  # (mask, ramp, flat)

    def part(self, ramp, draw, flat=False):
        m = Image.new('1', (self.size, self.size), 0)
        draw(ImageDraw.Draw(m))
        self.parts.append((m, R[ramp] if isinstance(ramp, str) else ramp, flat))
        return self

    def render(self):
        s = self.size
        owner = [[-1] * s for _ in range(s)]
        for i, (m, _, _) in enumerate(self.parts):
            px = m.load()
            for y in range(s):
                for x in range(s):
                    if px[x, y]:
                        owner[y][x] = i
        img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
        out = img.load()

        def inside(x, y, i):
            return 0 <= x < s and 0 <= y < s and owner[y][x] == i

        for y in range(s):
            for x in range(s):
                i = owner[y][x]
                if i < 0:
                    continue
                _, ramp, flat = self.parts[i]
                if flat:
                    out[x, y] = rgb(ramp[1])
                    continue
                up, left = not inside(x, y - 1, i), not inside(x - 1, y, i)
                down, right = not inside(x, y + 1, i), not inside(x + 1, y, i)
                if (up or left) and not (down or right):
                    c = ramp[0]
                elif (down and right) or (down and not inside(x, y + 2, i) and right):
                    c = ramp[3]
                elif down or right:
                    c = ramp[2]
                else:
                    c = ramp[1]
                out[x, y] = rgb(c)
        # contur exterior, 4-vecini
        for y in range(s):
            for x in range(s):
                if owner[y][x] >= 0:
                    continue
                if any(0 <= x + dx < s and 0 <= y + dy < s and owner[y + dy][x + dx] >= 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    out[x, y] = OUTLINE
        return img


def line(d, pts, w=1):
    d.line(pts, fill=1, width=w)


ICONS = {}


def icon(name):
    def deco(fn):
        ICONS[name] = fn
        return fn

    return deco


@icon('gold')
def _():
    return (Icon()
            .part('amber', lambda d: d.ellipse((2, 2, 13, 13), fill=1))
            .part(['#bd6b1d'] * 4, lambda d: (d.rectangle((7, 5, 8, 10), fill=1), d.point([(6, 5), (9, 10)], fill=1)), flat=True))


@icon('food')
def _():
    return (Icon()
            .part('moss', lambda d: d.polygon([(2, 13), (3, 8), (6, 4), (10, 2), (13, 2), (13, 6), (11, 10), (7, 13)], fill=1))
            .part(['#24502c'] * 4, lambda d: line(d, [(3, 12), (11, 4)]), flat=True))


@icon('amber')
def _():
    return (Icon()
            .part('amber', lambda d: d.polygon([(8, 1), (13, 5), (13, 10), (8, 14), (3, 10), (3, 5)], fill=1))
            .part(['#7a3d12'] * 4, lambda d: (d.point([(7, 8), (8, 8), (8, 7), (6, 9), (9, 9)], fill=1)), flat=True)
            .part(['#fffaf0'] * 4, lambda d: d.point([(5, 5), (6, 4)], fill=1), flat=True))


@icon('wood')
def _():
    return (Icon()
            .part('wood', lambda d: d.rectangle((1, 5, 11, 11), fill=1))
            .part('bone', lambda d: d.ellipse((10, 4, 14, 12), fill=1))
            .part(['#94603f'] * 4, lambda d: d.point([(12, 8), (12, 7)], fill=1), flat=True))


@icon('stone')
def _():
    return Icon().part('stone', lambda d: d.polygon([(2, 12), (3, 7), (6, 3), (11, 3), (14, 8), (12, 13), (4, 13)], fill=1))


@icon('fiber')
def _():
    def f(d):
        line(d, [(3, 14), (5, 8), (4, 2)], 2)
        line(d, [(8, 14), (8, 7), (10, 2)], 2)
        line(d, [(12, 14), (11, 9), (13, 4)], 2)

    return Icon().part('moss', f)


@icon('crystal')
def _():
    return (Icon()
            .part('sea', lambda d: d.polygon([(8, 1), (12, 6), (10, 14), (6, 14), (4, 6)], fill=1))
            .part(['#c8f2f4'] * 4, lambda d: line(d, [(7, 4), (6, 9)]), flat=True))


@icon('planks')
def _():
    return (Icon()
            .part('wood', lambda d: d.rectangle((1, 3, 14, 6), fill=1))
            .part('leather', lambda d: d.rectangle((1, 9, 14, 12), fill=1)))


@icon('blocks')
def _():
    return (Icon()
            .part('stone', lambda d: d.rectangle((1, 8, 7, 14), fill=1))
            .part('stone', lambda d: d.rectangle((9, 8, 14, 14), fill=1))
            .part('stone', lambda d: d.rectangle((5, 1, 11, 6), fill=1)))


@icon('habitatKit')
def _():
    return (Icon()
            .part('wood', lambda d: d.rectangle((3, 8, 12, 14), fill=1))
            .part('moss', lambda d: d.polygon([(1, 8), (8, 2), (14, 8)], fill=1))
            .part(['#4a2e22'] * 4, lambda d: d.rectangle((7, 11, 8, 14), fill=1), flat=True))


@icon('evolutionCrystal')
def _():
    return (Icon()
            .part('rune', lambda d: d.polygon([(8, 1), (13, 7), (8, 14), (3, 7)], fill=1))
            .part(['#f5d6ff'] * 4, lambda d: line(d, [(7, 4), (5, 7)]), flat=True))


@icon('lamp')
def _():
    return (Icon()
            .part('wood', lambda d: d.rectangle((7, 8, 8, 15), fill=1))
            .part('amber', lambda d: d.rectangle((4, 2, 11, 8), fill=1))
            .part(['#fff1a8'] * 4, lambda d: d.rectangle((6, 4, 9, 6), fill=1), flat=True))


# --- navigare și sistem
@icon('build')
def _():
    return (Icon()
            .part('wood', lambda d: line(d, [(3, 14), (10, 7)], 2))
            .part('stone', lambda d: d.polygon([(7, 2), (12, 2), (14, 4), (14, 7), (11, 7), (8, 4)], fill=1)))


@icon('dino')
def _():
    def head(d):
        d.polygon([(2, 9), (3, 5), (6, 3), (11, 3), (14, 5), (14, 8), (10, 9), (10, 12), (7, 14), (3, 13)], fill=1)

    return (Icon()
            .part('moss', head)
            .part(['#21191a'] * 4, lambda d: d.point([(10, 5)], fill=1), flat=True)
            .part(['#fffaf0'] * 4, lambda d: d.point([(11, 9), (13, 9)], fill=1), flat=True))


@icon('collection')
def _():
    return (Icon()
            .part('leather', lambda d: d.rectangle((2, 2, 12, 14), fill=1))
            .part('bone', lambda d: d.rectangle((12, 3, 14, 13), fill=1))
            .part(['#ffcf5a'] * 4, lambda d: d.rectangle((5, 5, 9, 7), fill=1), flat=True))


@icon('realms')
def _():
    return (Icon()
            .part('stone', lambda d: d.polygon([(2, 8), (14, 8), (11, 12), (8, 15), (5, 12)], fill=1))
            .part('moss', lambda d: d.ellipse((1, 4, 14, 10), fill=1))
            .part('moss', lambda d: d.ellipse((5, 1, 10, 6), fill=1)))


@icon('expedition')
def _():
    return (Icon()
            .part('bone', lambda d: d.polygon([(1, 3), (5, 2), (10, 3), (14, 2), (14, 13), (10, 14), (5, 13), (1, 14)], fill=1))
            .part(['#c9432a'] * 4, lambda d: (d.point([(3, 11), (5, 10), (6, 8), (8, 7)], fill=1), line(d, [(10, 4), (12, 6)]), line(d, [(12, 4), (10, 6)])), flat=True))


@icon('arena')
def _():
    def swords(d):
        line(d, [(2, 2), (12, 12)], 2)
        line(d, [(13, 2), (3, 12)], 2)

    return (Icon()
            .part('frost', swords)
            .part('wood', lambda d: (d.rectangle((1, 12, 4, 14), fill=1), d.rectangle((11, 12, 14, 14), fill=1))))


@icon('workshop')
def _():
    return (Icon()
            .part('stone', lambda d: d.polygon([(1, 4), (14, 4), (14, 6), (11, 8), (11, 11), (13, 14), (3, 14), (5, 11), (5, 8), (1, 6)], fill=1)))


@icon('market')
def _():
    return (Icon()
            .part('leather', lambda d: d.ellipse((2, 5, 13, 15), fill=1))
            .part('leather', lambda d: d.polygon([(5, 2), (10, 2), (9, 6), (6, 6)], fill=1))
            .part(['#ffcf5a'] * 4, lambda d: d.rectangle((5, 6, 10, 6), fill=1), flat=True))


@icon('egg')
def _():
    return (Icon()
            .part('bone', lambda d: d.ellipse((3, 1, 12, 14), fill=1))
            .part(['#6fae45'] * 4, lambda d: d.point([(6, 5), (7, 5), (9, 9), (10, 9), (5, 10)], fill=1), flat=True))


@icon('settings')
def _():
    def gear(d):
        d.ellipse((3, 3, 12, 12), fill=1)
        for a in range(8):
            t = a * math.pi / 4
            x, y = 7.5 + 6 * math.cos(t), 7.5 + 6 * math.sin(t)
            d.rectangle((round(x) - 1, round(y) - 1, round(x), round(y)), fill=1)

    return (Icon()
            .part('stone', gear)
            .part(['#21191a'] * 4, lambda d: d.rectangle((7, 7, 8, 8), fill=1), flat=True))


@icon('wiki')
def _():
    return (Icon()
            .part('bone', lambda d: d.rectangle((3, 2, 12, 13), fill=1))
            .part('wood', lambda d: (d.rectangle((2, 1, 13, 2), fill=1), d.rectangle((2, 13, 13, 14), fill=1)))
            .part(['#9c8763'] * 4, lambda d: (line(d, [(5, 5), (10, 5)]), line(d, [(5, 8), (10, 8)]), line(d, [(5, 10), (8, 10)])), flat=True))


@icon('lock')
def _():
    return (Icon()
            .part('stone', lambda d: (d.rectangle((4, 2, 5, 8), fill=1), d.rectangle((10, 2, 11, 8), fill=1), d.rectangle((4, 1, 11, 2), fill=1)))
            .part('amber', lambda d: d.rectangle((2, 7, 13, 14), fill=1))
            .part(['#7a3d12'] * 4, lambda d: d.rectangle((7, 9, 8, 12), fill=1), flat=True))


@icon('star')
def _():
    pts = []
    for i in range(10):
        t = -math.pi / 2 + i * math.pi / 5
        r = 7 if i % 2 == 0 else 3
        pts.append((7.5 + r * math.cos(t), 8 + r * math.sin(t)))
    return Icon().part('amber', lambda d: d.polygon(pts, fill=1))


@icon('close')
def _():
    return Icon().part('bone', lambda d: (line(d, [(3, 3), (12, 12)], 2), line(d, [(12, 3), (3, 12)], 2)))


@icon('heart')
def _():
    return Icon().part('ember', lambda d: (d.ellipse((1, 2, 8, 9), fill=1), d.ellipse((7, 2, 14, 9), fill=1), d.polygon([(2, 7), (13, 7), (8, 14)], fill=1)))


@icon('energy')
def _():
    return Icon().part('storm', lambda d: d.polygon([(9, 1), (3, 9), (7, 9), (5, 15), (13, 6), (9, 6), (11, 1)], fill=1))


@icon('shield')
def _():
    return (Icon()
            .part('frost', lambda d: d.polygon([(2, 2), (13, 2), (13, 8), (8, 14), (2, 8)], fill=1))
            .part(['#3a5d88'] * 4, lambda d: line(d, [(8, 3), (8, 12)]), flat=True))


@icon('sword')
def _():
    return (Icon()
            .part('frost', lambda d: d.polygon([(13, 1), (14, 2), (6, 10), (5, 9)], fill=1))
            .part('wood', lambda d: (line(d, [(2, 13), (5, 10)], 2), d.rectangle((3, 8, 4, 9), fill=1), d.rectangle((6, 11, 7, 12), fill=1))))


@icon('clock')
def _():
    return (Icon()
            .part('bone', lambda d: d.ellipse((1, 1, 14, 14), fill=1))
            .part(['#21191a'] * 4, lambda d: (line(d, [(7, 4), (7, 8)]), line(d, [(8, 8), (10, 10)])), flat=True))


@icon('chest')
def _():
    return (Icon()
            .part('wood', lambda d: d.rectangle((1, 7, 14, 14), fill=1))
            .part('leather', lambda d: d.rectangle((1, 3, 14, 6), fill=1))
            .part('amber', lambda d: d.rectangle((6, 6, 9, 9), fill=1)))


@icon('arrow')
def _():
    return Icon().part('bone', lambda d: d.polygon([(2, 6), (8, 6), (8, 2), (14, 8), (8, 14), (8, 10), (2, 10)], fill=1))


@icon('back')
def _():
    return Icon().part('bone', lambda d: d.polygon([(14, 6), (8, 6), (8, 2), (2, 8), (8, 14), (8, 10), (14, 10)], fill=1))


@icon('plus')
def _():
    return Icon().part('moss', lambda d: (d.rectangle((6, 2, 9, 13), fill=1), d.rectangle((2, 6, 13, 9), fill=1)))


@icon('minus')
def _():
    return Icon().part('stone', lambda d: d.rectangle((2, 6, 13, 9), fill=1))


@icon('target')
def _():
    return (Icon()
            .part('bone', lambda d: d.ellipse((1, 1, 14, 14), fill=1))
            .part('ember', lambda d: d.ellipse((5, 5, 10, 10), fill=1)))


@icon('trophy')
def _():
    return (Icon()
            .part('amber', lambda d: (d.polygon([(3, 2), (12, 2), (11, 8), (8, 10), (4, 8)], fill=1), d.rectangle((7, 10, 8, 12), fill=1)))
            .part('wood', lambda d: d.rectangle((4, 12, 11, 14), fill=1)))


# --- elemente
def flame(d):
    d.polygon([(8, 1), (12, 6), (13, 10), (11, 14), (5, 14), (3, 10), (4, 6), (6, 8)], fill=1)


@icon('el-fire')
def _():
    return Icon().part('ember', flame).part(['#ffcf5a'] * 4, lambda d: d.polygon([(8, 7), (10, 11), (8, 13), (6, 11)], fill=1), flat=True)


@icon('el-water')
def _():
    return Icon().part('sea', lambda d: (d.polygon([(8, 1), (12, 8), (4, 8)], fill=1), d.ellipse((3, 5, 12, 14), fill=1))).part(['#c8f2f4'] * 4, lambda d: line(d, [(5, 9), (5, 11)]), flat=True)


@icon('el-earth')
def _():
    return Icon().part('wood', lambda d: d.polygon([(8, 1), (14, 7), (11, 14), (5, 14), (2, 7)], fill=1)).part(['#4a2e22'] * 4, lambda d: line(d, [(5, 7), (8, 10), (11, 7)]), flat=True)


@icon('el-nature')
def _():
    return ICONS['food']()


@icon('el-ice')
def _():
    def flake(d):
        line(d, [(7, 1), (7, 14)], 2)
        line(d, [(1, 7), (14, 7)], 2)
        line(d, [(3, 3), (12, 12)])
        line(d, [(12, 3), (3, 12)])

    return Icon().part('frost', flake)


@icon('el-lightning')
def _():
    return ICONS['energy']()


@icon('el-wind')
def _():
    def swirl(d):
        d.arc((3, 2, 13, 9), 180, 40, fill=1, width=2)
        line(d, [(1, 9), (11, 9)], 2)
        line(d, [(3, 12), (9, 12)], 2)

    return Icon().part('gale', swirl)


@icon('el-dark')
def _():
    def moon(d):
        d.ellipse((2, 1, 14, 14), fill=1)
        d.ellipse((6, 0, 16, 11), fill=0)

    return Icon().part('dusk', moon)


@icon('el-light')
def _():
    def sun(d):
        d.ellipse((4, 4, 11, 11), fill=1)
        for x, y in ((7, 0), (7, 14), (0, 7), (14, 7), (2, 2), (12, 2), (2, 12), (12, 12)):
            d.rectangle((x, y, x + 1, y + 1), fill=1)

    return Icon().part('dawn', sun)


@icon('el-arcane')
def _():
    return Icon().part('rune', lambda d: d.polygon([(8, 0), (10, 6), (15, 8), (10, 10), (8, 15), (6, 10), (1, 8), (6, 6)], fill=1))


def build_icons():
    names = list(ICONS)
    cols = 8
    rows = math.ceil(len(names) / cols)
    sheet = Image.new('RGBA', (cols * 16, rows * 16), (0, 0, 0, 0))
    index = {}
    for i, n in enumerate(names):
        img = ICONS[n]().render()
        x, y = (i % cols) * 16, (i // cols) * 16
        sheet.alpha_composite(img, (x, y))
        index[n] = [i % cols, i // cols]
    sheet.save(OUT / 'icons.png')
    (ROOT / 'src/realms/ui/icons.json').write_text(json.dumps({'cols': cols, 'rows': rows, 'cell': 16, 'icons': index}, indent=1) + '\n', encoding='utf8')
    return sheet


# ---------------------------------------------------------------- rame 9-slice
def noise(x, y, seed=7):
    h = (x * 374761393 + y * 668265263 + seed * 2246822519) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return (h ^ (h >> 16)) & 0xFF


def panel():
    """Rama ferestrelor: piatră sculptată cu nituri de os. 26×26, felii de 9."""
    s, b = 26, 9
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    p = img.load()
    st = R['stone']
    for y in range(s):
        for x in range(s):
            edge = min(x, y, s - 1 - x, s - 1 - y)
            if edge == 0:
                c = PAL['outline']
            elif edge == 1:
                c = st[1] if (x == 1 or y == 1) and x < s - 2 and y < s - 2 else st[4]
            elif edge < b - 2:
                n = noise(x, y)
                c = st[3] if n > 60 else st[2] if n > 22 else st[4]
            elif edge == b - 2:
                c = st[4]
            elif edge == b - 1:
                c = PAL['outline']
            else:
                c = R['ui'][4]
            p[x, y] = rgb(c)
    stud = Icon(7).part('bone', lambda d: d.ellipse((1, 1, 5, 5), fill=1)).render()
    for cx, cy in ((0, 0), (s - 7, 0), (0, s - 7), (s - 7, s - 7)):
        img.alpha_composite(stud, (cx, cy))
    img.save(OUT / 'panel.png')


def simple(name, size, layers):
    """Ramă dintr-o listă de inele: [(culoare_sus_stânga, culoare_jos_dreapta)] din exterior spre interior, apoi fundalul."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    p = img.load()
    *rings, fill = layers
    for y in range(size):
        for x in range(size):
            edge = min(x, y, size - 1 - x, size - 1 - y)
            if edge < len(rings):
                tl, br = rings[edge]
                if tl is None:
                    continue
                lit = (x == edge or y == edge) and not (x == size - 1 - edge or y == size - 1 - edge)
                p[x, y] = rgb(tl if lit else br)
            else:
                p[x, y] = rgb(fill)
    # colțuri tăiate (pixel art clasic)
    for x, y in ((0, 0), (size - 1, 0), (0, size - 1), (size - 1, size - 1)):
        p[x, y] = (0, 0, 0, 0)
    img.save(OUT / f'{name}.png')


def button(name, ramp, tones, pressed=False):
    """Buton 12×12, felii de 4: contur, lumină sus, buză întunecată jos (3D). Apăsat = buza dispare.
    tones = indicii din rampă pentru (lumină, corp, umbră laterală, buză), aleși pentru contrastul textului."""
    size = 12
    hi, body, side, lip = (R[ramp][i] for i in tones)
    r = [hi, body, side, lip]
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    p = img.load()
    for y in range(size):
        for x in range(size):
            if x in (0, size - 1) or y in (0, size - 1):
                c = PAL['outline']
            elif pressed:
                c = r[3] if y == 1 else r[2]
            elif y == 1:
                c = r[0]
            elif y >= size - 3:
                c = r[3]
            elif x == 1:
                c = r[0] if y < size - 3 else r[2]
            elif x == size - 2:
                c = r[2]
            else:
                c = r[1]
            p[x, y] = rgb(c)
    for x, y in ((0, 0), (size - 1, 0), (0, size - 1), (size - 1, size - 1)):
        p[x, y] = (0, 0, 0, 0)
    img.save(OUT / f'{name}{"-pressed" if pressed else ""}.png')


def banner():
    """Banderolă de piele cu cusături, pentru titluri. 24×14, felii 6."""
    w, h = 24, 14
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    p = img.load()
    lr = R['leather']
    for y in range(h):
        for x in range(w):
            if y in (0, h - 1) or x in (0, w - 1):
                c = PAL['outline']
            elif y == 1:
                c = lr[0]
            elif y == h - 2:
                c = lr[3]
            elif y in (3, h - 4) and x % 3 != 0 and 2 < x < w - 3:
                c = R['bone'][3]
            else:
                c = lr[1] if y < h // 2 else lr[2]
            p[x, y] = rgb(c)
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        p[x, y] = (0, 0, 0, 0)
    img.save(OUT / 'banner.png')


def palette_css():
    lines = ['/* Generat de scripts/pixel-ui.py din src/realms/ui/palette.json. Nu edita manual. */', ':root {']
    lines.append(f"  --px-outline: {PAL['outline']};")
    for name, ramp in R.items():
        for i, c in enumerate(ramp):
            lines.append(f'  --px-{name}-{i}: {c};')
    for el, ramp in PAL['elements'].items():
        lines.append(f'  --el-{el}: {R[ramp][1]};')
        lines.append(f'  --el-{el}-dark: {R[ramp][3]};')
    lines.append('}')
    (ROOT / 'src/realms/ui/palette.css').write_text('\n'.join(lines) + '\n', encoding='utf8')


if __name__ == '__main__':
    st, ui, bone, wood = R['stone'], R['ui'], R['bone'], R['wood']
    panel()
    simple('card', 10, [(PAL['outline'], PAL['outline']), (st[4], ui[5]), ui[3]])
    simple('card-active', 10, [(PAL['outline'], PAL['outline']), (R['amber'][1], R['amber'][3]), ui[2]])
    simple('slot', 10, [(PAL['outline'], PAL['outline']), (ui[5], st[4]), ui[4]])
    simple('parchment', 10, [(wood[4], wood[4]), (bone[0], bone[3]), bone[1]])
    for name, ramp, tones in (('btn-green', 'moss', (2, 3, 4, 4)), ('btn-amber', 'amber', (0, 1, 2, 3)), ('btn-stone', 'stone', (2, 3, 4, 5)), ('btn-red', 'ember', (1, 2, 3, 4))):
        button(name, ramp, tones)
        button(name, ramp, tones, pressed=True)
    banner()
    sheet = build_icons()
    palette_css()
    sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save('/tmp/claude-0/icons-preview.png') if Path('/tmp/claude-0').exists() else None
    print('icons:', len(ICONS))
