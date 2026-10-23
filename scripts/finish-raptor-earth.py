"""Download only the requested raptor's queued SE jobs and import completed clips.

No credentials or generation API calls. Run in foreground; Ctrl-C stops polling.
Failed jobs are reported for explicit regeneration through PixelLab MCP.
"""
import io
import json
import subprocess
import sys
import time
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TRACKER = ROOT / 'docs' / 'raptor-earth-production.json'
SOURCE = ROOT / 'art' / 'realms' / 'pixellab' / 'raptor_earth'
COUNTS = dict(idle=8, walk=12, attack=8, defend=6, hurt=4, death=8, ultimate=20)

def load(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def import_stage(stage):
    subprocess.run([sys.executable, '-u', str(ROOT / 'scripts/import-realms-animation.py'),
        stage, str(SOURCE / f'{stage}.json'), '--variant', 'raptor_earth'], check=True, cwd=ROOT)

while True:
    tracker = load(TRACKER)
    if tracker['variantId'] != 'raptor_earth' or tracker['requestedDirections'] != ['south-east']:
        raise ValueError('This helper only imports the requested earth raptor SE jobs')
    pending, failed, imported = [], [], []
    for stage, jobs in tracker['animationJobs'].items():
        if stage not in ['baby', 'juvenile', 'adult']:
            raise ValueError('Unknown stage')
        receipt = SOURCE / f'{stage}.json'
        data = load(receipt) if receipt.exists() else dict(variantId='raptor_earth', stage=stage, clips={'se': {}})
        changed = False
        for clip, job in jobs.items():
            if clip not in tracker['requiredClips'][stage]:
                raise ValueError('Unexpected clip for stage')
            uuid.UUID(job)
            urls = [f'https://api.pixellab.ai/mcp/images/{job}/download?index={i}' for i in range(COUNTS[clip]+1)]
            target = dict(frames=urls, skipFirstFrame=True)
            if data['clips']['se'].get(clip) == target:
                imported.append(f'{stage}/se/{clip}')
                continue
            url = urls[1]
            try:
                request = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urlopen(request, timeout=30) as response:
                    payload = response.read()
                Image.open(io.BytesIO(payload)).verify()
            except HTTPError as error:
                detail = error.read().decode('utf-8', errors='replace')
                if 'generation failed' in detail.lower() or 'job failed' in detail.lower():
                    failed.append(dict(stage=stage, clip=clip, jobId=job, error=detail[:300]))
                else:
                    pending.append(dict(stage=stage, clip=clip, jobId=job))
                continue
            except (OSError, URLError):
                pending.append(dict(stage=stage, clip=clip, jobId=job))
                continue
            # Cache the first GENERATED frame; input reference is skipped explicitly.
            cache = SOURCE / stage
            cache.mkdir(parents=True, exist_ok=True)
            first = cache / f'{clip}-se-00.png'
            first.write_bytes(payload)
            first.with_suffix('.url').write_text(url)
            data['clips']['se'][clip] = target
            changed = True
        if changed:
            receipt.write_text(json.dumps(data, indent=2)+'\n', encoding='utf-8')
            import_stage(stage)
        # A receipt may predate a completed import, so verify the public manifest.
        manifest = ROOT / 'public/realms/animations' / f'raptor_earth_{stage}' / 'manifest.json'
        if data['clips']['se'] and (not manifest.exists() or set(load(manifest)['clips'].get('se', {})) != set(data['clips']['se'])):
            import_stage(stage)
    tracker['pendingJobs'] = pending
    tracker['failedCurrentJobs'] = failed
    tracker['imported'] = [f'{m.parent.name.removeprefix("raptor_earth_")}/se/{clip}'
        for m in (ROOT / 'public/realms/animations').glob('raptor_earth_*/manifest.json')
        for clip in load(m)['clips'].get('se', {})]
    tracker['status'] = 'generation-failed-needs-retry' if failed else 'waiting-for-results' if pending else 'south-east-clips-imported-prototype'
    TRACKER.write_text(json.dumps(tracker, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(dict(imported=len(tracker['imported']), total=15, pending=len(pending), failed=failed)), flush=True)
    if failed:
        sys.exit(2)
    if not pending:
        break
    time.sleep(30)
