"""Umple golul transparent din mijlocul unei insule PixelLab (platoul șters de eliminarea fundalului)
cu iarbă pixel din tonurile verzi ale insulei. python3 scripts/fill-plateau.py in.png out.png"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from importlib import import_module
ci = import_module('compose-island')

im = Image.open(sys.argv[1]).convert('RGBA')
a = np.array(im)
alpha = a[..., 3] > 0
hole = ndimage.binary_fill_holes(alpha) & ~alpha
lbl, n = ndimage.label(hole)
sizes = ndimage.sum(hole, lbl, range(1, n + 1))
plateau = lbl == (1 + int(np.argmax(sizes)))
# tonurile de iarbă: pixelii verzi de pe buza platoului
ring = ndimage.binary_dilation(plateau, iterations=6) & alpha
px = a[ring][:, :3].astype(int)
green = px[(px[:, 1] > px[:, 0] * 1.1) & (px[:, 1] > px[:, 2] * 1.2)]
q = Image.fromarray(green.reshape(1, -1, 3).astype('uint8')).quantize(colors=6, method=Image.Quantize.MAXCOVERAGE)
pal = sorted([tuple(q.getpalette()[i * 3 : i * 3 + 3]) for i in range(6)], key=lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2])
h, w = plateau.shape
n1 = 0.55 * ci.value_noise(w, h, 14, 3) + 0.3 * ci.value_noise(w, h, 6, 4) + 0.15 * ci.value_noise(w, h, 3, 5)
gi = np.full(n1.shape, 4)
gi[n1 < 0.38] = 3
gi[n1 > 0.66] = 5
# tonuri intermediare (umbra și lumina la jumătatea drumului) — iarbă calmă
P = np.array(pal, float)
G = np.array([P[0], P[1], (P[2] + P[3]) / 2, (P[3] + P[4]) / 2, P[4], (P[4] + P[5]) / 2], np.uint8)
fill = G[gi]
r = np.random.default_rng(9)
spark = r.random((h, w)) > 0.985
fill[spark] = G[5]
fill[np.roll(spark, 1, axis=0)] = G[3]
# umbra de la buza din spate: primii pixeli de sub marginea de sus a platoului mai închiși
top_edge = plateau & ~np.roll(plateau, 2, axis=0)
fill[top_edge] = G[1]
a[plateau, :3] = fill[plateau]
a[plateau, 3] = 255
Image.fromarray(a, 'RGBA').save(sys.argv[2])
np.save(sys.argv[2] + '.plateau.npy', plateau)
ys, xs = np.nonzero(plateau)
print('platou', xs.min(), xs.max(), ys.min(), ys.max(), 'tonuri', ['#%02x%02x%02x' % c for c in pal])
