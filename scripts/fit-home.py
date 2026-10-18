"""Grila insulei principale pe platoul insulei mari (generată și extinsă cu PixelLab, umplută cu fill-plateau.py).
python3 scripts/fit-home.py insula.png platou.npy"""
import json, shutil, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
im = Image.open(sys.argv[1]); w, h = im.size
plateau = ndimage.binary_erosion(ndimage.binary_fill_holes(ndimage.binary_closing(np.load(sys.argv[2]), iterations=3)), iterations=4)
ys, xs = np.nonzero(plateau)
cx, cy = int((xs.min() + xs.max()) / 2), int((ys.min() + ys.max()) / 2)
HW, HH = 16, 9
top = (cx, cy - 6 * 2 * HH)  # vârful celulei (0,0): blocul vechi 12×12 centrat pe platou
ox, oy = (1536 - w * 2) // 2, (1024 - h * 2) // 2
inside = lambda px, py: 0 <= int(py) < h and 0 <= int(px) < w and plateau[int(py), int(px)]
build = []
for x in range(-16, 28):
    for y in range(-16, 28):
        px, py = top[0] + (x - y) * HW, top[1] + (x + y) * HH
        if all(inside(a, b) for a, b in ((px, py), (px + HW, py + HH), (px, py + 2 * HH), (px - HW, py + HH))):
            build.append([x, y])
assert all([x, y] in build for x in range(12) for y in range(12)), 'blocul 12×12 trebuie să încapă'
shutil.copy(sys.argv[1], ROOT / 'public/realms/worlds/home-island.png')
meta = {'realm': 'home', 'art': '/realms/worlds/home-island.png', 'size': [w, h], 'offset': [ox, oy], 'scale': 2,
        'grid': {'x': ox + top[0] * 2, 'y': oy + top[1] * 2, 'w': HW * 2, 'h': HH * 2}, 'buildable': build}
(ROOT / 'src/realms/islands/home.json').write_text(json.dumps(meta, separators=(',', ':')) + '\n', encoding='utf8')
print(w, h, 'offset', ox, oy, 'grid', meta['grid'], len(build), 'celule construibile')
