"""Aduce culorile din CSS-ul Dino Realms pe paleta master (src/realms/ui/palette.json).

Albastrul-petrol / mov al vechiului UI devine piatră caldă, apoi fiecare culoare se lipește de cea mai
apropiată culoare din paletă (distanță în Lab). Transparența se păstrează.
Rulează: python3 scripts/css-palette-snap.py src/realms/realms.css src/realms/gameplay.css ...
"""
import colorsys
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAL = json.loads((ROOT / 'src/realms/ui/palette.json').read_text(encoding='utf8'))
# Toate rampele paletei; doar albastrul/movul desaturat al vechiului UI e încălzit înainte.
NEUTRAL = list(PAL['ramps'])
COLORS = sorted({PAL['outline'], *[c for r in NEUTRAL for c in PAL['ramps'][r]]})


def to_rgb(h):
    h = h.lstrip('#')
    if len(h) in (3, 4):
        h = ''.join(c * 2 for c in h)
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4)), (h[6:8] if len(h) == 8 else '')


def lab(rgb):
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = map(lin, rgb)
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883

    def f(t):
        return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116

    fx, fy, fz = f(x), f(y), f(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


PLAB = [(c, lab(to_rgb(c)[0])) for c in COLORS]


def warm(rgb):
    h, l, s = colorsys.rgb_to_hls(*(c / 255 for c in rgb))
    deg = h * 360
    if 150 <= deg <= 300 and s < 0.75:  # petrol, bleumarin, mov → piatră/piele caldă
        h, s = 22 / 360, s * 0.45
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return round(r * 255), round(g * 255), round(b * 255)


def snap(m):
    rgb, alpha = to_rgb(m.group(0))
    w = lab(warm(rgb))
    best = min(PLAB, key=lambda p: sum((a - b) ** 2 for a, b in zip(p[1], w)))[0]
    return best + alpha


HEX = re.compile(r'#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b')

for path in sys.argv[1:]:
    p = Path(path)
    src = p.read_text(encoding='utf8')
    out = HEX.sub(snap, src)
    p.write_text(out, encoding='utf8')
    print(p, len(HEX.findall(src)), 'culori ->', len(set(HEX.findall(out))), 'distincte')
