"""Asamblează o lume Dino Realms din kitul ei PixelLab (tile-uri, blocuri de stâncă, obiecte).

  python3 scripts/compose-island.py <realm>          # citește art/kits/<realm>/kit.json
Ieșiri: public/realms/worlds/<realm>-px.png (rezoluție de artă, afișată ×2)
        src/realms/islands/<realm>.json (celulele construibile, pentru grid.ts)

Totul e determinist (seed din kit), pe aceeași grilă izometrică 32×18 ca toate clădirile:
celula (x, y) are vârful de sus la artă (ORIGIN_X + (x - y)·16, ORIGIN_Y + (x + y)·9).
"""
import json
import math
import random
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ART_W, ART_H = 910, 512  # = scena 1820×1024 / 2
ORIGIN_X, ORIGIN_Y = 471, 116  # vârful celulei (0,0); corespunde GRID {x: 800, y: 232} în scenă
HW, HH = 16, 9  # jumătate de romb


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def load_set(folder):
    fs = sorted(Path(folder).rglob('*.png'), key=lambda f: int(re.search(r'_(\d+)\.png$', f.name).group(1)))
    return [Image.open(f).convert('RGBA') for f in fs]


def top_y(img):
    """Primul rând opac: vârful rombului."""
    a = img.getchannel('A').load()
    for y in range(img.height):
        if any(a[x, y] > 0 for x in range(img.width)):
            return y
    return 0


def clean_prop(img):
    """Păstrează doar silueta principală (taie fragmentele vecinilor din foaia de candidați)."""
    a = img.getchannel('A')
    w, h = img.size
    px = a.load()
    seen = [[False] * w for _ in range(h)]
    comps = []
    for y in range(h):
        for x in range(w):
            if px[x, y] > 0 and not seen[y][x]:
                stack, comp = [(x, y)], []
                seen[y][x] = True
                while stack:
                    cx, cy = stack.pop()
                    comp.append((cx, cy))
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and px[nx, ny] > 0:
                            seen[ny][nx] = True
                            stack.append((nx, ny))
                comps.append(comp)
    if not comps:
        return img
    big = max(len(c) for c in comps)
    keep = {p for c in comps if len(c) >= big * 0.12 for p in c}
    out = Image.new('RGBA', img.size)
    src, dst = img.load(), out.load()
    for x, y in keep:
        dst[x, y] = src[x, y]
    return out.crop(out.getbbox())


def diamond(img, ty):
    """Doar fața de sus a tile-ului (romb 32×18 cu vârful la ty): fără laturi, deci fără grilă vizibilă."""
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).polygon([(HW, ty), (2 * HW, ty + HH), (HW, ty + 2 * HH), (0, ty + HH)], fill=255)
    out = Image.new('RGBA', img.size)
    out.paste(img, (0, 0), m)
    return out


def strip_bottom_outline(img):
    """Blocul de deasupra altui bloc nu-și desenează conturul de jos: peretele de stâncă pare continuu."""
    img = img.copy()
    px = img.load()
    w, h = img.size
    for x in range(w):
        ys = [y for y in range(h) if px[x, y][3] > 0]
        if len(ys) > 2:
            y = ys[-1]
            r, g, b, a = px[x, y]
            if r + g + b < 150:
                px[x, y] = px[x, y - 1]
    return img


def harmonize(tiles, ref_tiles, keep_far=True):
    """Aduce variantele de sol pe culorile setului de tranziție (aceeași iarbă peste tot); florile rămân."""
    import numpy as np
    ref = np.array(sorted({c for t in ref_tiles for c in [p[:3] for p in t.getdata() if p[3] > 0]}), float)
    out = []
    for t in tiles:
        a = np.array(t).astype(float)
        rgb = a[..., :3].reshape(-1, 3)
        d = ((rgb[:, None] - ref[None]) ** 2).sum(-1)
        idx = d.argmin(1)
        near = ref[idx]
        far = d.min(1) > 2200 if keep_far else np.zeros(len(rgb), bool)
        rgb2 = np.where(far[:, None], rgb, near)
        a[..., :3] = rgb2.reshape(a.shape[:2] + (3,))
        out.append(Image.fromarray(a.astype('uint8'), 'RGBA'))
    return out


def flatten(img):
    """Scoate gradientul de lumină din tile (stânga-sus deschis, dreapta-jos închis), ca rombul să se repete fără grilă."""
    import numpy as np
    a = np.array(img).astype(float)
    op = a[..., 3] > 0
    lum = a[..., :3] @ np.array([0.299, 0.587, 0.114])
    ys, xs = np.nonzero(op)
    # planul de lumină care se potrivește tile-ului
    M = np.c_[xs, ys, np.ones(len(xs))]
    coef, *_ = np.linalg.lstsq(M, lum[ys, xs], rcond=None)
    plane = (np.c_[xs, ys, np.ones(len(xs))] @ coef)
    target = lum[ys, xs] - (plane - plane.mean())
    cols = a[ys, xs, :3]
    uniq = np.unique(cols, axis=0)
    ul = uniq @ np.array([0.299, 0.587, 0.114])
    # culoarea din același tile cu luminanța cea mai apropiată, păstrând nuanța apropiată
    best = ((ul[None, :] - target[:, None]) ** 2 + 0.002 * ((uniq[None] - cols[:, None]) ** 2).sum(-1)).argmin(1)
    a[ys, xs, :3] = uniq[best]
    return Image.fromarray(a.astype('uint8'), 'RGBA')


def stamps(variants, grass):
    """Florile și pietricelele din variantele de sol, ca ștampile mici (componente care nu sunt iarbă)."""
    import numpy as np
    from scipy import ndimage
    G = np.array(grass, float)
    out = []
    for v in variants:
        a = np.array(v)
        rgb = a[..., :3].astype(float)
        d = ((rgb[..., None, :] - G[None, None]) ** 2).sum(-1).min(-1)
        far = (d > 2500) & (a[..., 3] > 0)
        lbl, n = ndimage.label(far, structure=np.ones((3, 3)))
        for i in range(1, n + 1):
            ys, xs = np.nonzero(lbl == i)
            if not (2 <= len(ys) <= 24):
                continue
            y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
            st = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
            sel = lbl[y0:y1, x0:x1] == i
            st[sel] = a[y0:y1, x0:x1][sel]
            out.append(Image.fromarray(st, 'RGBA'))
    return out


def tones(img, k=5, hue=None):
    """k tonuri reprezentative (de la închis la deschis) dintr-un tile PixelLab; hue='green' păstrează doar verdele."""
    import numpy as np
    a = np.array(img)
    px = a[a[..., 3] > 0][:, :3].astype(float)
    if hue == 'green':
        px = px[(px[:, 1] > px[:, 0] * 1.08) & (px[:, 1] > px[:, 2] * 1.15)]
    q = Image.fromarray(px.reshape(1, -1, 3).astype('uint8')).quantize(colors=k, method=Image.Quantize.MAXCOVERAGE)
    pal = np.array(q.getpalette()[: k * 3]).reshape(-1, 3)
    return sorted([tuple(int(v) for v in c) for c in pal], key=lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2])


def value_noise(w, h, cell, seed):
    import numpy as np
    r = np.random.default_rng(seed)
    gw, gh = w // cell + 3, h // cell + 3
    g = r.random((gh, gw))
    ys, xs = np.mgrid[0:h, 0:w]
    fx, fy = xs / cell, ys / cell
    x0, y0 = fx.astype(int), fy.astype(int)
    tx, ty = fx - x0, fy - y0
    tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    a, b = g[y0, x0], g[y0, x0 + 1]
    c, d = g[y0 + 1, x0], g[y0 + 1, x0 + 1]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


def ground_layer(cells, dirt_pts, grass, dirt, seed):
    """Sol pixel continuu: zgomot pe tonurile luate din tile-urile PixelLab, poteci cu margine zdrențuită."""
    import numpy as np
    from PIL import ImageFilter
    m = Image.new('L', (ART_W, ART_H), 0)
    d = ImageDraw.Draw(m)
    for x, y in cells:
        sx, sy = cell_top(x, y)
        d.polygon([(sx, sy), (sx + HW, sy + HH), (sx, sy + 2 * HH), (sx - HW, sy + HH)], fill=255)
    mask = np.array(m) > 0
    n = 0.55 * value_noise(ART_W, ART_H, 14, seed) + 0.3 * value_noise(ART_W, ART_H, 6, seed + 1) + 0.15 * value_noise(ART_W, ART_H, 3, seed + 2)
    pm = Image.new('L', (ART_W, ART_H), 0)
    pd = ImageDraw.Draw(pm)
    for path in dirt_pts:
        pts = [(cell_top(px, py)[0], cell_top(px, py)[1] + HH) for px, py in path]
        pd.line(pts, fill=255, width=22, joint='curve')
        for px, py in pts:
            pd.ellipse((px - 11, py - 7, px + 11, py + 7), fill=255)
    pf = np.array(pm.filter(ImageFilter.GaussianBlur(5))) / 255.0
    pathv = pf + (value_noise(ART_W, ART_H, 4, seed + 3) - 0.5) * 0.5
    is_dirt = pathv > 0.5
    rim = (pathv > 0.42) & ~is_dirt
    out = np.zeros((ART_H, ART_W, 4), np.uint8)
    # trei tonuri vecine (umbră moale, bază, lumină) — iarbă calmă, fără „camuflaj”
    k = len(grass)
    base = k // 2
    gi = np.full(n.shape, base)
    gi[n < 0.40] = base - 1
    gi[n > 0.64] = base + 1
    di = 1 + np.clip((value_noise(ART_W, ART_H, 5, seed + 4) * (len(dirt) - 1)).astype(int), 0, len(dirt) - 2)
    G, D = np.array(grass, np.uint8), np.array(dirt, np.uint8)
    out[..., :3] = G[gi]
    out[is_dirt, :3] = D[di[is_dirt]]
    out[rim, :3] = G[0]
    r = np.random.default_rng(seed + 5)
    spark = (r.random((ART_H, ART_W)) > 0.985) & ~is_dirt
    out[spark, :3] = G[-1]
    out[np.roll(spark, 1, axis=0) & ~is_dirt, :3] = G[-2]
    out[..., 3] = np.where(mask, 255, 0)
    return Image.fromarray(out, 'RGBA'), is_dirt


def cell_top(x, y):
    return ORIGIN_X + (x - y) * HW, ORIGIN_Y + (x + y) * HH


def compose(realm):
    kdir = ROOT / 'art/kits' / realm
    kit = json.loads((kdir / 'kit.json').read_text(encoding='utf8'))
    rnd = random.Random(kit.get('seed', 1))
    trans = load_set(kdir / kit['transition'])
    ground = load_set(kdir / kit['ground'])
    cliffs = load_set(kdir / kit['cliff'])
    props = [clean_prop(Image.open(kdir / p['file']).convert('RGBA')) for p in kit['props']]
    pmeta = kit['props']

    # --- forma insulei: elipsă în spațiul ecranului (u = x−y, v = x+y), margine zgomotoasă
    A, B, VC = kit.get('island_a', 21), kit.get('island_b', 13.5), kit.get('island_vc', 11.5)
    BA, BB = kit.get('build_a', 16.5), kit.get('build_b', 10.5)
    phase = [rnd.uniform(0, 6.28) for _ in range(4)]

    def wobble(u, v):
        t = math.atan2((v - VC) / B, u / A)
        return 0.06 * math.sin(3 * t + phase[0]) + 0.05 * math.sin(5 * t + phase[1]) + 0.03 * math.sin(9 * t + phase[2])

    island, build = set(), set()
    for x in range(-24, 40):
        for y in range(-24, 40):
            u, v = x - y + 0.0, x + y + 1.0
            r = (u / A) ** 2 + ((v - VC) / B) ** 2
            if r <= 1 + wobble(u, v):
                island.add((x, y))
                if (u / BA) ** 2 + ((v - VC) / BB) ** 2 <= 1:
                    build.add((x, y))
    # salvările vechi: 12×12 rămâne mereu construibil
    for x in range(12):
        for y in range(12):
            build.add((x, y))
            island.add((x, y))

    # --- teren: iarbă peste tot, cu poteci de pământ (colțuri Wang)
    dirt = set()  # colțuri (vârfuri) cu pământ
    for path in kit.get('paths', []):
        pts = path
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            n = max(abs(x1 - x0), abs(y1 - y0)) * 2 + 1
            for i in range(n + 1):
                cx, cy = round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)
                for dx in (0, 1):
                    for dy in (0, 1):
                        dirt.add((cx + dx, cy + dy))

    def mask(x, y):
        g = lambda vx, vy: 0 if (vx, vy) in dirt else 1
        return (g(x, y) << 3) | (g(x + 1, y) << 2) | (g(x, y + 1) << 1) | g(x + 1, y + 1)

    canvas = Image.new('RGBA', (ART_W, ART_H))
    # cer
    sky = kit['sky']
    top, bottom = rgb(sky[0]), rgb(sky[1])
    d = ImageDraw.Draw(canvas)
    bands = 24
    for i in range(bands):
        t = i / (bands - 1)
        c = tuple(round(top[k] + (bottom[k] - top[k]) * t) for k in range(3))
        d.rectangle((0, i * ART_H // bands, ART_W, (i + 1) * ART_H // bands), fill=c + (255,))
    # nori pixel
    cloud = [rgb(c) for c in kit.get('cloud', ['#ffffff', '#dceaff', '#b3cdf2'])]
    for _ in range(kit.get('clouds', 14)):
        cx, cy = rnd.randrange(0, ART_W), rnd.randrange(10, ART_H - 40)
        if (cy > 60 and abs(cx - ART_W / 2) < 330 and cy < 420):
            continue
        blobs = [(cx + rnd.randint(-40, 40), cy + rnd.randint(-6, 6), rnd.randint(8, 20)) for _ in range(rnd.randint(4, 8))]
        for layer, col, dy in ((2, cloud[2], 3), (1, cloud[1], 1), (0, cloud[0], 0)):
            for bx, by, br in blobs:
                rr = br - layer * 2
                d.ellipse((bx - rr, by - rr // 2 + dy, bx + rr, by + rr // 2 + dy), fill=col + (255,))

    gtop = top_y(ground[0])
    ttop = top_y(trans[0])
    ctop = top_y(cliffs[0])
    ttops = [diamond(flatten(t), ttop) for t in trans]
    ground = harmonize(ground, [trans[15]])
    deco = stamps([diamond(t, gtop) for t in ground], tones(trans[15], 6, 'green'))
    cliffs_inner = [strip_bottom_outline(c) for c in cliffs]
    cliff_h = cliffs[0].height - ctop - 2 * HH  # înălțimea feței laterale a unui bloc
    step = max(6, cliff_h)

    def is_in(x, y):
        return (x, y) in island

    order = sorted(island, key=lambda c: (c[0] + c[1], c[0]))
    front_edge = {c for c in island if not is_in(c[0] + 1, c[1]) or not is_in(c[0], c[1] + 1)}
    plain_cliffs = kit.get('cliff_plain', [0, 1, 2])
    water_cliffs = kit.get('cliff_water', [])
    deco_cliffs = kit.get('cliff_deco', [])
    falls = set(rnd.sample(sorted(front_edge), min(kit.get('waterfalls', 3), len(front_edge)))) if water_cliffs else set()

    # coloanele de stâncă de sub marginea din față (dedesubtul insulei, conic)
    for (x, y) in order:
        if (x, y) not in front_edge:
            continue
        sx, sy = cell_top(x, y)
        u, v = x - y, x + y + 1
        # adâncime netedă: aceeași pentru vecini, mai adâncă spre mijlocul fronturii (dedesubt conic)
        depth = 1 + round(4 * max(0.0, 1 - (abs(u) / (A + 1)) ** 1.6) + 0.6 * math.sin(u * 0.7 + phase[3]))
        for lvl in range(depth, 0, -1):
            src = cliffs if lvl == depth else cliffs_inner
            if (x, y) in falls:
                tile = src[rnd.choice(water_cliffs)]
            else:
                tile = src[rnd.choice(deco_cliffs if lvl == 1 and deco_cliffs and rnd.random() < 0.35 else plain_cliffs)]
            canvas.alpha_composite(tile, (sx - HW, sy + lvl * step - ctop))

    # suprafața: margine de stâncă sub celulele din față, apoi solul continuu peste toată insula
    for (x, y) in order:
        if (x, y) in front_edge:
            sx, sy = cell_top(x, y)
            canvas.alpha_composite(cliffs_inner[rnd.choice(plain_cliffs)], (sx - HW, sy - ctop))
    grass_t = tones(trans[15], kit.get('grass_tones', 6), kit.get('grass_hue', 'green'))
    print('iarbă', ['#%02x%02x%02x' % c for c in grass_t])
    dirt_t = tones(trans[0], 4)
    layer, is_dirt = ground_layer(island, kit.get('paths', []), grass_t, dirt_t, kit.get('seed', 1))
    canvas.alpha_composite(layer)

    # flori și pietricele împrăștiate liber (nu pe grilă), doar pe iarbă
    for _ in range(kit.get('stamps', 260)):
        x, y = rnd.choice(order)
        sx, sy = cell_top(x, y)
        px_, py_ = sx + rnd.randint(-8, 8), sy + HH + rnd.randint(-4, 4)
        if not (0 <= px_ < ART_W and 0 <= py_ < ART_H) or is_dirt[py_, px_]:
            continue
        st = rnd.choice(deco)
        canvas.alpha_composite(st, (px_ - st.width // 2, py_ - st.height // 2))

    # obiecte pe inelul neconstruibil, sortate în adâncime
    ring = [c for c in island if c not in build]
    rnd.shuffle(ring)
    placed = []
    taken = set()
    density = kit.get('prop_density', 0.55)
    for (x, y) in ring:
        if rnd.random() > density or (x, y) in taken:
            continue
        i = rnd.choices(range(len(props)), [p.get('weight', 1) for p in pmeta])[0]
        size = pmeta[i].get('cells', 1)
        cells = {(x + dx, y + dy) for dx in range(size) for dy in range(size)}
        if cells & taken or not cells <= set(ring):
            continue
        taken |= cells
        placed.append((x + size / 2, y + size / 2, i))
    for (x, y, i) in sorted(placed, key=lambda p: p[0] + p[1]):
        img = props[i]
        sx, sy = cell_top(x, y)
        sy += HH  # centrul rombului
        anchor = pmeta[i].get('anchor', 0.92)
        canvas.alpha_composite(img, (round(sx - img.width / 2), round(sy - img.height * anchor)))

    # insulițe plutitoare în fundal
    for k in range(kit.get('islets', 5)):
        ix, iy = rnd.choice([(rnd.randrange(30, 220), rnd.randrange(60, 420)), (rnd.randrange(690, 880), rnd.randrange(60, 420))])
        for lvl in range(rnd.randint(1, 2), -1, -1):
            canvas.alpha_composite(cliffs[rnd.choice(plain_cliffs)], (ix - HW, iy + lvl * step - ctop))
        if rnd.random() < 0.7:
            p = props[rnd.choice([j for j, m in enumerate(pmeta) if m.get('islet', False)] or [0])]
            canvas.alpha_composite(p, (ix - p.width // 2, iy + HH - int(p.height * 0.9)))

    out = ROOT / 'public/realms/worlds' / f'{realm}-px.png'
    canvas.convert('RGB').save(out, optimize=True)
    meta = {
        'realm': realm,
        'art': f'/realms/worlds/{realm}-px.png',
        'size': [ART_W, ART_H],
        'grid': {'x': 800, 'y': 232, 'w': 32, 'h': 18},
        'buildable': sorted([list(c) for c in build]),
    }
    p = ROOT / 'src/realms/islands' / f'{realm}.json'
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(meta, separators=(',', ':')) + '\n', encoding='utf8')
    print(out, len(island), 'celule,', len(build), 'construibile,', len(placed), 'obiecte')


if __name__ == '__main__':
    compose(sys.argv[1])
