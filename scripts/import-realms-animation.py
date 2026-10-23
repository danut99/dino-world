"""Pack PixelLab get_character receipts into local, offline sprite atlases.

Usage: python scripts/import-realms-animation.py juvenile art/realms/pixellab/juvenile.txt
Receipts contain public asset URLs only; never pass an API credential.
Retains full source canvases, never independently crops animation frames.
"""
import argparse
import io
import json
import math
import re
import time
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
GROUND_Y = 216
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('stage', choices=['baby', 'juvenile', 'adult'])
parser.add_argument('receipt', type=Path)
parser.add_argument('--variant', default='trex_fire', help='Species_element ID, e.g. raptor_earth')
args = parser.parse_args()
if not re.fullmatch(r'(boss|trex|raptor|triceratops|ankylosaurus|brachiosaurus|ignasaur|thalassaur|terrasaur)_(fire|water|earth|nature|ice|lightning|wind|dark|light|arcane)', args.variant):
    parser.error('Unknown species/element variant')
receipt = args.receipt.read_text(encoding='utf-8')
allowed = ['idle', 'walk'] + ([] if args.stage == 'baby' else ['attack', 'defend', 'hurt', 'death']) + (['ultimate'] if args.stage == 'adult' else [])
fps = dict(idle=8, walk=12, attack=12, defend=10, hurt=12, death=10, ultimate=12)
out = ROOT / 'public' / 'realms' / 'animations' / f'{args.variant}_{args.stage}'
source = ROOT / 'art' / 'realms' / 'pixellab' / (args.stage if args.variant == 'trex_fire' else f'{args.variant}/{args.stage}')
out.mkdir(parents=True, exist_ok=True)
source.mkdir(parents=True, exist_ok=True)
manifest = dict(schemaVersion=1, variantId=args.variant, stage=args.stage, status='prototype',
                sourceSize=dict(width=256, height=256), pivot=dict(x=128, y=GROUND_Y), clips={})
entries = []
if receipt.lstrip('\ufeff \n\r').startswith('{'):
    data = json.loads(receipt.lstrip('\ufeff'))
    if data['variantId'] != args.variant or data['stage'] != args.stage:
        raise ValueError('Receipt species/element/stage does not match import destination')
    for facing, clips in data['clips'].items():
        if facing not in ['se', 'ne']:
            raise ValueError('Unknown facing')
        for name, clip in clips.items():
            if name not in allowed:
                raise ValueError(f'{args.stage} cannot use {name}')
            entries.append((name, facing, clip['frames'], clip.get('skipFirstFrame', False)))
else:
    blocks = re.split(r'(?m)^  (?=\S.*\[type=)', receipt)[1:]
    for block in blocks:
        match = re.match(r'([a-z]+)\s+[—-]', block)
        if not match or match.group(1).lower() not in allowed:
            continue
        name = match.group(1).lower()
        for direction, url, last in re.findall(r'(south-east|north-east): (https://\S+) \(i=0\.\.(\d+)\)', block):
            facing = 'se' if direction == 'south-east' else 'ne'
            urls = [url.replace('{i}', str(i)) for i in range(int(last) + 1)]
            entries.append((name, facing, urls, len(urls) % 4 == 1))
loaded_entries = []
for name, facing, urls, skip_first in entries:
        if skip_first:
            urls = urls[1:]
        if not urls:
            raise ValueError(f'{name}/{facing}: no generated frames')
        frames = []
        for i, url in enumerate(urls):
            # Legacy text caches include the reference at index zero.
            cache_i = i + 1 if skip_first and not receipt.lstrip('\ufeff \n\r').startswith('{') else i
            local = source / f'{name}-{facing}-{cache_i:02}.png'
            origin = local.with_suffix('.url')
            parts = urlsplit(url)
            address = urlunsplit((parts.scheme, parts.netloc, parts.path,
                urlencode([(k,v) for k,v in parse_qsl(parts.query) if k != 't']), ''))
            if not local.exists() or (origin.exists() and origin.read_text() != address):
                request = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                for attempt in range(3):
                    try:
                        with urlopen(request, timeout=90) as response:
                            payload = response.read()
                        Image.open(io.BytesIO(payload)).verify()
                        local.write_bytes(payload)
                        break
                    except OSError:
                        if attempt == 2:
                            raise
                        time.sleep(attempt + 1)
            origin.write_text(address)
            frame = Image.open(local).convert('RGBA')
            if frame.width > 256 or frame.height > 256:
                raise ValueError(f'{local}: canvas {frame.size} exceeds 256x256; refusing to crop or scale')
            if frame.size != (256,256):
                padded = Image.new('RGBA', (256,256))
                padded.paste(frame, ((256-frame.width)//2, (256-frame.height)//2))
                frame = padded
            frames.append(frame)
        loaded_entries.append((name, facing, frames))

# Find one ground pivot that preserves every visible pixel in this stage,
# including effects extending above or below the neutral character pose.
minimum_ground, maximum_ground = 0, 255
for name, facing, frames in loaded_entries:
    neutral = frames[0].getbbox()
    if not neutral:
        continue
    baseline = neutral[3] - 1
    for frame in frames:
        bounds = frame.getbbox()
        if bounds:
            minimum_ground = max(minimum_ground, baseline - bounds[1])
            maximum_ground = min(maximum_ground, 256 + baseline - bounds[3])
if minimum_ground > maximum_ground:
    raise ValueError('No shared ground pivot can preserve all visible pixels; review source canvases')
GROUND_Y = max(minimum_ground, min(GROUND_Y, maximum_ground))
manifest['pivot']['y'] = GROUND_Y

for name, facing, frames in loaded_entries:
        # Register the clip once from its neutral first pose. Apply the SAME offset
        # to every frame, retaining motion rather than chasing each frame's bbox.
        first_bounds = frames[0].getbbox()
        offset_y = GROUND_Y - (first_bounds[3] - 1) if first_bounds else 0
        registered = []
        for frame in frames:
            bounds = frame.getbbox()
            if bounds and (bounds[1] + offset_y < 0 or bounds[3] + offset_y > 256):
                raise ValueError(f'{name}/{facing}: registration would clip visible pixels; adjust the family pivot')
            aligned = Image.new('RGBA', (256,256))
            aligned.paste(frame, (0, offset_y))
            registered.append(aligned)
        frames = registered
        cols = min(8, len(frames))
        atlas = Image.new('RGBA', (cols*256, math.ceil(len(frames)/cols)*256))
        for i, frame in enumerate(frames):
            atlas.paste(frame, ((i%cols)*256, (i//cols)*256))
        filename = f'{name}-{facing}.png'
        atlas.save(out / filename, optimize=True)
        clip = dict(sheet=f'/realms/animations/{args.variant}_{args.stage}/{filename}', frameWidth=256, frameHeight=256,
                    columns=cols, durationsMs=[round(1000/fps[name])]*len(frames), loop=name in ['idle','walk'])
        if name in ['attack','ultimate']:
            clip['impactFrame'] = len(frames)//2
        manifest['clips'].setdefault(facing,{})[name] = clip
        print(args.stage, name, facing, len(frames), 'frames')
if not manifest['clips']:
    raise ValueError('No completed named clips in receipt; no manifest written')
(out / 'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
inventory = sorted(p.parent.name for p in out.parent.glob('*/manifest.json') if not p.parent.name.startswith('boss_'))
(ROOT / 'src' / 'realms' / 'animation-inventory.json').write_text(json.dumps(inventory, indent=2)+'\n', encoding='utf-8')
print('Wrote', out / 'manifest.json')
