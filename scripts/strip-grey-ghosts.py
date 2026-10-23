"""Remove PixelLab "ghost" blobs from animation sheets.

Some generated frames carry a flat mid-grey silhouette left over from the generator's background
(see the raptor_wind adult `defend` frames 3-4). The blob is always one flat grey colour in a large
connected patch (one or two flat tones), while the greys that belong to a character are small shaded areas, so a component is
treated as a ghost when it is flat, grey and at least MIN_SIZE pixels. Warm greys also paint the
baked ground shadow under a character's feet, so a warm patch is kept when the same spot is grey in
most other frames of the clip (a shadow persists, a ghost shows up in a few frames). Dark one-pixel
outlines the generator drew around the blob are dropped with it when they are tiny and touch the
removed area.

Usage: python scripts/strip-grey-ghosts.py [--dry-run] [--no-persistence] [--preview out.png] [sheet.png ...]
Without sheets, every clip listed in public/realms/animations/*/manifest.json is processed.
"""
from __future__ import annotations

import argparse
import glob
import json
import sys
from collections import Counter, deque
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
MIN_SIZE = 150          # smallest neutral patch treated as a ghost (legit character greys stay under ~120 px)
WARM_MIN_SIZE = 300     # warm patches must be larger: small warm ones are usually a baked ground shadow
FLATNESS = 0.9          # share of the patch covered by its two most common colours
OUTLINE_MAX = 40        # dark leftovers up to this size, touching the removed patch, go with it
# Sheets whose large flat greys are part of the artwork (stone bases), never ghosts.
SKIP = {'boss_fire_adult/ultimate-se.png'}


NEUTRAL = 12            # channel spread of a neutral grey such as (134,133,131)
WARM = 26               # channel spread of the warm ghost tones such as (141,127,118)
PERSISTENT = 0.4        # share of the other frames that must be grey at the same spot for a warm patch to stay


def is_grey(p, spread=WARM):
    r, g, b, a = p
    if a == 0:
        return False
    mean, chroma = (r + g + b) / 3, max(r, g, b) - min(r, g, b)
    # Warm tones get a narrower band: light beige shadows such as (164,147,139) belong to the artwork.
    return chroma <= NEUTRAL and 95 <= mean <= 150 or chroma <= spread and 110 <= mean <= 145


def components(px, x0, y0, w, h, member):
    seen = set()
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            if (x, y) in seen or not member(px[x, y]):
                continue
            queue, points = deque([(x, y)]), []
            seen.add((x, y))
            while queue:
                cx, cy = queue.popleft()
                points.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if x0 <= nx < x0 + w and y0 <= ny < y0 + h and (nx, ny) not in seen and member(px[nx, ny]):
                        seen.add((nx, ny))
                        queue.append((nx, ny))
            yield points


def grey_mask(px, x0, y0, w, h):
    return {(x - x0, y - y0) for y in range(y0, y0 + h) for x in range(x0, x0 + w) if is_grey(px[x, y])}


def clean_frame(px, x0, y0, w, h, others=(), forced=False):
    """Returns the number of pixels removed from one frame. `others` holds the grey masks of the clip's
    other frames, in frame-local coordinates, for the persistence test. `forced` (a sheet checked by
    eye) drops every flat grey patch from 100 px up, persistent or not."""
    removed = set()
    for points in list(components(px, x0, y0, w, h, is_grey)):
        if len(points) < (100 if forced else MIN_SIZE):
            continue
        # Forced mode also accepts a ghost mixed from three tones, as PixelLab paints some.
        top = sum(n for _, n in Counter(px[p][:3] for p in points).most_common(3 if forced else 2))
        if top / len(points) < (0.85 if forced else FLATNESS):
            continue
        if not forced and not all(is_grey(px[p], NEUTRAL) for p in points):
            if len(points) < WARM_MIN_SIZE:
                continue
            local = {(x - x0, y - y0) for x, y in points}
            shared = sum(1 for mask in others if len(local & mask) >= len(local) / 2)
            if others and shared >= PERSISTENT * len(others):
                continue
        removed.update(points)
    for p in removed:
        px[p] = (0, 0, 0, 0)
    if removed:
        def near_removed(points):
            return any((x + dx, y + dy) in removed for x, y in points for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        for points in list(components(px, x0, y0, w, h, lambda p: p[3] > 0)):
            if len(points) <= OUTLINE_MAX and near_removed(points):
                if sum(sum(px[p][:3]) for p in points) / (3 * len(points)) < 90:
                    for p in points:
                        px[p] = (0, 0, 0, 0)
                    removed.update(points)
    return len(removed)


def clips():
    for manifest in sorted(glob.glob(str(ROOT / 'public/realms/animations/*/manifest.json'))):
        data = json.load(open(manifest, encoding='utf-8'))
        for facing in data['clips'].values():
            for clip in facing.values():
                yield ROOT / 'public' / clip['sheet'].lstrip('/'), clip['frameWidth'], clip['frameHeight'], clip['columns'], len(clip['durationsMs'])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dry-run', action='store_true')
    parser.add_argument('--no-persistence', action='store_true', help='forced mode for named sheets checked by eye: drop every flat grey patch from 100 px up, persistent or not')
    parser.add_argument('--preview', help='write a before/after contact sheet of every changed frame')
    parser.add_argument('sheets', nargs='*')
    args = parser.parse_args()
    jobs = [c for c in clips() if not args.sheets or str(c[0]) in [str(Path(s).resolve()) for s in args.sheets]]
    tiles, changed_sheets = [], 0
    for path, fw, fh, cols, count in jobs:
        if path.relative_to(ROOT / 'public/realms/animations').as_posix() in SKIP:
            continue
        image = Image.open(path).convert('RGBA')
        px = image.load()
        before = image.copy()
        touched = []
        masks = [grey_mask(px, (f % cols) * fw, (f // cols) * fh, fw, fh) for f in range(count)]
        for f in range(count):
            x0, y0 = (f % cols) * fw, (f // cols) * fh
            n = clean_frame(px, x0, y0, fw, fh, masks[:f] + masks[f + 1:], forced=args.no_persistence)
            if n:
                touched.append((f, n))
                tiles.append((f'{path.parent.name}/{path.stem} #{f} -{n}px', before.crop((x0, y0, x0 + fw, y0 + fh)), image.crop((x0, y0, x0 + fw, y0 + fh))))
        if touched:
            changed_sheets += 1
            print(f'{path.relative_to(ROOT)}: ' + ', '.join(f'#{f} -{n}px' for f, n in touched))
            if not args.dry_run:
                image.save(path, optimize=True)
    if args.preview and tiles:
        size, per = 160, 4
        rows = (len(tiles) + per - 1) // per
        sheet = Image.new('RGBA', (per * (2 * size + 12), rows * (size + 18)), (40, 40, 40, 255))
        draw = ImageDraw.Draw(sheet)
        for i, (label, a, b) in enumerate(tiles):
            x, y = (i % per) * (2 * size + 12), (i // per) * (size + 18)
            sheet.paste(a.resize((size, size), Image.NEAREST), (x, y + 14), a.resize((size, size), Image.NEAREST))
            sheet.paste(b.resize((size, size), Image.NEAREST), (x + size + 4, y + 14), b.resize((size, size), Image.NEAREST))
            draw.text((x + 2, y + 1), label[:52], fill=(255, 240, 200, 255))
        sheet.save(args.preview)
    print(f'{len(tiles)} frames in {changed_sheets} sheets' + (' (dry run)' if args.dry_run else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
