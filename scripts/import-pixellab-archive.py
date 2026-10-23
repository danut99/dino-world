"""Import a completed PixelLab group ZIP using the game's existing atlas packer.

Only the selected age-appropriate SE animations are extracted. Rotations, other
directions and unused revisions remain outside public/. No generation API calls.
"""
import argparse
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('variant', help='Species_element, e.g. ankylosaurus_ice')
parser.add_argument('archive', type=Path)
parser.add_argument('--prefer', action='append', default=[], help='clip=name for adult, or stage.clip=name')
parser.add_argument('--state', action='append', default=[], help='stage=folder override for character groups')
parser.add_argument('--stage', action='append', choices=['baby', 'juvenile', 'adult'], help='Import only selected ages')
args = parser.parse_args()
if not re.fullmatch(r'(boss|trex|raptor|triceratops|ankylosaurus|brachiosaurus|ignasaur|thalassaur)_(fire|water|earth|nature|ice|lightning|wind|dark|light|arcane)', args.variant):
    parser.error('Unknown species/element variant')
preferred = dict(value.split('=', 1) for value in args.prefer)
state_names = dict(value.split('=', 1) for value in args.state)
destination = ROOT / 'art/realms/pixellab/archive-imports' / args.variant
with zipfile.ZipFile(args.archive) as archive:
    metadata = json.loads(archive.read('metadata.json'))
    states = {state['folder'].lower(): state for state in metadata['states']}
    plans = []
    missing = []
    for stage in (args.stage or (['adult'] if args.variant.startswith('boss_') else ['baby', 'juvenile', 'adult'])):
        state = states.get(state_names.get(stage, 'idle' if stage == 'adult' else stage).lower())
        required = ['idle', 'walk'] + ([] if stage == 'baby' else ['attack', 'defend', 'hurt', 'death']) + (['ultimate'] if stage == 'adult' else [])
        clips = {}
        for clip in required:
            name = preferred.get(f'{stage}.{clip}', preferred.get(clip, clip) if stage == 'adult' else clip)
            prefix = f"{state['folder']}/animations/{name}/south-east/" if state else ''
            frames = sorted(file for file in archive.namelist() if prefix and file.startswith(prefix) and file.endswith('.png'))
            if not frames:
                missing.append(f'{stage}/{name}')
            clips[clip] = frames
        plans.append((stage, clips))
    if missing:
        raise SystemExit(f'{args.variant}: incomplete family, not imported: {", ".join(missing)}')
    # Validate every path before extracting anything.
    for stage, clips in plans:
        for frames in clips.values():
            for name in frames:
                path = PurePosixPath(name)
                if path.is_absolute() or '..' in path.parts or '\\' in name:
                    raise ValueError('Unsafe archive path')
    for stage, clips in plans:
        receipt = dict(variantId=args.variant, stage=stage, clips={'se': {}})
        for clip, frames in clips.items():
            local = []
            for index, name in enumerate(frames):
                target = destination / stage / f'{clip}-{index:03}.png'
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(archive.read(name))
                local.append(target.as_uri())
            # Legacy managed exports may prepend the input pose (e.g. 13-frame
            # walks for 12 generated frames), matching the text-receipt importer.
            receipt['clips']['se'][clip] = dict(frames=local, skipFirstFrame=len(local) % 4 == 1)
        path = destination / f'{stage}.json'
        path.write_text(json.dumps(receipt, indent=2)+'\n', encoding='utf-8')
        subprocess.run([sys.executable, '-u', str(ROOT / 'scripts/import-realms-animation.py'), stage, str(path), '--variant', args.variant], check=True, cwd=ROOT)
