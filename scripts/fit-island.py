"""Găsește platoul construibil dintr-o insulă generată cu PixelLab și potrivește grila jocului pe el.

  python3 scripts/fit-island.py <realm> <insula.png> [--cells N] [--seed x,y]

Insula (pixel art, fundal transparent) se copiază în public/realms/worlds/<realm>-island.png.
Se scrie src/realms/islands/<realm>.json cu: dimensiunea artei, unde stă în scenă (×2),
grila izometrică (în pixeli de scenă), celulele construibile și punctele de plimbare ale dinozaurilor.
"""
import json
import shutil
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SCENE_W, SCENE_H, SCALE = 1536, 1024, 2
ERODE = 4
TOL = None


def fit(realm, src, cells=None, seed=None, corners=None):
    im = Image.open(src).convert('RGBA')
    a = np.array(im).astype(float)
    h, w = a.shape[:2]
    alpha = a[..., 3] > 0
    rgb = a[..., :3]
    # sămânța: centrul platoului e mereu în jumătatea de sus a insulei, pe mijloc
    ys, xs = np.nonzero(alpha)
    if seed:
        sx, sy = seed
    else:
        sx, sy = int(np.median(xs)), int(ys.min() + (ys.max() - ys.min()) * 0.36)
    # culoarea platoului: mediana unei ferestre mici în jurul sămânței
    win = rgb[sy - 6 : sy + 7, sx - 6 : sx + 7].reshape(-1, 3)
    ref = np.median(win, 0)
    tol = TOL or max(28.0, float(np.percentile(np.sqrt(((win - ref) ** 2).sum(1)), 90)) * 1.6)
    near = alpha & (np.sqrt(((rgb - ref) ** 2).sum(-1)) < tol)
    near = ndimage.binary_closing(near, np.ones((3, 3)), iterations=2)
    # eroziune înainte de etichetare: rupe punțile subțiri spre stâncile de aceeași culoare
    core = ndimage.binary_erosion(near, np.ones((3, 3)), iterations=ERODE)
    lbl, _ = ndimage.label(core)
    region = lbl == lbl[sy, sx]
    region = ndimage.binary_dilation(region, np.ones((3, 3)), iterations=ERODE) & near
    region = ndimage.binary_fill_holes(region)
    ry, rx = np.nonzero(region)
    # colțurile rombului: extremele în u = x − 2y și v = x + 2y (romb izometric 2:1)
    u, v = rx - 2 * ry, rx + 2 * ry
    left = (rx.min(), int(np.median(ry[rx <= rx.min() + 2])))
    right = (rx.max(), int(np.median(ry[rx >= rx.max() - 2])))
    top = (int(np.median(rx[ry <= ry.min() + 1])), ry.min())
    bottom = (int(np.median(rx[ry >= ry.max() - 1])), ry.max())
    if corners:  # suprascriere manuală: top,right,bottom,left ca x:y
        top, right, bottom, left = [tuple(map(int, c.split(':'))) for c in corners.split(',')]
        region = np.zeros_like(region)
        from PIL import ImageDraw as _D
        m = Image.new('L', (w, h), 0)
        _D.Draw(m).polygon([top, right, bottom, left], fill=255)
        region = np.array(m) > 0
    width = right[0] - left[0]
    height = bottom[1] - top[1]
    n = cells or max(6, round(width / 32))
    hw, hh = width / (2 * n), height / (2 * n)
    # o margine de o celulă de jur împrejur rămâne liberă (decorul de pe buză)
    margin = 1
    # poziția artei în scenă (centrată, ×2)
    ox, oy = (SCENE_W - w * SCALE) // 2, max(0, (SCENE_H - h * SCALE) // 2)
    grid = {
        'x': round(ox + top[0] * SCALE, 2),
        'y': round(oy + top[1] * SCALE, 2),
        'w': round(hw * SCALE, 3),
        'h': round(hh * SCALE, 3),
    }
    build = []
    for cx in range(margin, n - margin):
        for cy in range(margin, n - margin):
            # centrul celulei trebuie să cadă pe platou
            px = top[0] + (cx - cy) * hw
            py = top[1] + (cx + cy + 1) * hh
            if 0 <= int(py) < h and 0 <= int(px) < w and region[int(py), int(px)]:
                build.append([cx, cy])
    # puncte de plimbare: un inel interior al platoului
    spots = []
    for fx, fy in ((0.5, 0.35), (0.3, 0.55), (0.7, 0.55), (0.42, 0.75), (0.62, 0.72), (0.5, 0.55)):
        gx, gy = fx * n, fy * n
        px = top[0] + (gx - gy) * hw
        py = top[1] + (gx + gy) * hh
        spots.append({'x': round(ox + px * SCALE), 'y': round(oy + py * SCALE)})
    dst = ROOT / 'public/realms/worlds' / f'{realm}-island.png'
    shutil.copy(src, dst)
    meta = {
        'realm': realm,
        'art': f'/realms/worlds/{realm}-island.png',
        'size': [w, h],
        'offset': [ox, oy],
        'scale': SCALE,
        'grid': grid,
        'cells': n,
        'buildable': build,
        'spots': spots,
        'plateau': {'top': top, 'right': right, 'bottom': bottom, 'left': left},
    }
    out = ROOT / 'src/realms/islands' / f'{realm}.json'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(meta, separators=(',', ':'), default=int) + '\n', encoding='utf8')
    # previzualizare cu grila peste insulă, pentru verificare vizuală
    prev = im.resize((w * 2, h * 2), Image.NEAREST)
    from PIL import ImageDraw

    d = ImageDraw.Draw(prev)
    for cx, cy in build:
        px = (top[0] + (cx - cy) * hw) * 2
        py = (top[1] + (cx + cy) * hh) * 2
        d.polygon([(px, py), (px + hw * 2, py + hh * 2), (px, py + hh * 4), (px - hw * 2, py + hh * 2)], outline=(255, 255, 255, 160))
    prev.save(f'/tmp/claude-0/fit-{realm}.png')
    print(realm, f'{w}x{h}', 'platou', width, 'x', height, 'px →', n, 'celule/latură,', len(build), 'construibile')


if __name__ == '__main__':
    args = sys.argv[1:]
    cells = int(args[args.index('--cells') + 1]) if '--cells' in args else None
    seed = tuple(map(int, args[args.index('--seed') + 1].split(','))) if '--seed' in args else None
    if '--erode' in args:
        ERODE = int(args[args.index('--erode') + 1])
    if '--tol' in args:
        TOL = float(args[args.index('--tol') + 1])
    corners = args[args.index('--corners') + 1] if '--corners' in args else None
    fit(args[0], args[1], cells, seed, corners)
