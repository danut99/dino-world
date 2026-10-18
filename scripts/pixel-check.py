"""Forțează un asset pe paleta master și verifică dacă e pixel art „curat”.

  python3 scripts/pixel-check.py snap  in.png out.png [--extra N]   # mapează pe paletă (Lab, fără dithering)
  python3 scripts/pixel-check.py check in.png [...]                   # raport: culori, câte din paletă, grilă

--extra N păstrează N culori proprii în plus (k-means pe ce nu se potrivește bine), pentru peisaje.
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PAL = json.loads((ROOT / 'src/realms/ui/palette.json').read_text(encoding='utf8'))
HEX = sorted({PAL['outline'], *[c for r in PAL['ramps'].values() for c in r]})
P = np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in HEX], float)


def lab(rgb):
    c = rgb / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def snap(src, dst, extra=0):
    im = Image.open(src).convert('RGBA')
    a = np.array(im)
    rgb, alpha = a[..., :3].astype(float), a[..., 3]
    pal = P.copy()
    flat = rgb.reshape(-1, 3)
    uniq, inv = np.unique(flat, axis=0, return_inverse=True)
    if extra:
        d = ((lab(uniq)[:, None] - lab(pal)[None]) ** 2).sum(-1).min(1)
        far = uniq[d > 60]
        if len(far):
            from random import Random
            k = min(extra, len(far))
            cent = far[Random(1).sample(range(len(far)), k)]
            for _ in range(12):
                lbl = ((far[:, None] - cent[None]) ** 2).sum(-1).argmin(1)
                cent = np.array([far[lbl == i].mean(0) if (lbl == i).any() else cent[i] for i in range(k)])
            pal = np.vstack([pal, cent.round()])
    idx = ((lab(uniq)[:, None] - lab(pal)[None]) ** 2).sum(-1).argmin(1)
    out = pal[idx][inv.ravel()].reshape(rgb.shape)
    res = np.dstack([out, np.where(alpha > 127, 255, 0)]).astype(np.uint8)
    Image.fromarray(res, 'RGBA').save(dst)
    return len(np.unique(out.reshape(-1, 3), axis=0))


def check(path):
    a = np.array(Image.open(path).convert('RGBA'))
    vis = a[a[..., 3] > 0][:, :3]
    cols = np.unique(vis, axis=0)
    inpal = sum(1 for c in cols if (np.abs(P - c).sum(1) == 0).any())
    semi = int(((a[..., 3] > 0) & (a[..., 3] < 255)).sum())
    print(f'{path}: {a.shape[1]}x{a.shape[0]} · {len(cols)} culori · {inpal} din paleta master · {semi} px semitransparenți')
    return len(cols), inpal, semi


if __name__ == '__main__':
    if sys.argv[1] == 'snap':
        extra = int(sys.argv[sys.argv.index('--extra') + 1]) if '--extra' in sys.argv else 0
        print('culori:', snap(sys.argv[2], sys.argv[3], extra))
    else:
        for p in sys.argv[2:]:
            check(p)
