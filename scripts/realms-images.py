# Variantele ușoare (WebP) ale imaginilor Dino Realms. Sursele PNG stau în art/realms (local, nu intră în build),
# WebP-urile se scriu în public/realms, în aceeași structură de foldere:
#   worlds/<lume>-wide-v1.webp      aceeași mărime, calitate 92 (jocul le mărește deja puțin, deci nu le micșorăm)
#   worlds/<lume>-thumb.webp        480 px lățime, cardurile din lista de lumi și coperta expedițiilor
#   home-island-wide-v1.webp         insula principală, aceeași mărime
#   dinosaurs/<element>.webp         foile de dinozauri, aceeași mărime (decupajele din dinosaur-crop-data rămân valide)
#   bosses/<element>.webp            768×768: pe ecran apar la cel mult ~600 px
#   buildings/<clădire>-<n>.webp     768×768: clădirile se desenează la 220 px (×3 pe ecrane dense)
#   gameplay/*.webp, building-concepts.webp   scene și foi de clădiri, aceeași mărime
# Referințele și conceptele vechi rămân PNG: sunt doar linkuri, nu se încarcă în joc.
# Rulează după ce schimbi arta:  python scripts/realms-images.py   (sau --only worlds bosses ...)
import os
import argparse
from glob import glob
from PIL import Image

ART = os.path.join(os.path.dirname(__file__), '..', 'art', 'realms')
REALMS = os.path.join(os.path.dirname(__file__), '..', 'public', 'realms')
GROUPS = ['worlds', 'home', 'dinosaurs', 'bosses', 'buildings', 'gameplay']
parser = argparse.ArgumentParser(description='Build WebP variants of the Dino Realms runtime artwork.')
parser.add_argument('--only', nargs='+', choices=GROUPS, help='Rebuild only these groups.')
args = parser.parse_args()
groups = args.only or GROUPS
before = after = 0


def save(src, im, name, quality):
    global before, after
    out = os.path.join(REALMS, os.path.relpath(os.path.dirname(src), ART), name)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.save(out, 'WEBP', quality=quality, method=6)
    before += os.path.getsize(src)
    after += os.path.getsize(out)
    print(f'{os.path.relpath(out, REALMS):42} {os.path.getsize(src) / 1e6:5.2f} MB -> {os.path.getsize(out) / 1e6:5.2f} MB')


def same_size(path, quality):
    im = Image.open(path)
    save(path, im, os.path.splitext(os.path.basename(path))[0] + '.webp', quality)
    return im


def square(path, size, quality):
    im = Image.open(path).convert('RGBA').resize((size, size), Image.LANCZOS)
    save(path, im, os.path.splitext(os.path.basename(path))[0] + '.webp', quality)


if 'worlds' in groups:
    for path in sorted(glob(os.path.join(ART, 'worlds', '*-wide-v1.png'))):
        im = same_size(path, 92)
        thumb = im.resize((480, round(480 * im.height / im.width)), Image.LANCZOS)
        save(path, thumb, os.path.basename(path).replace('-wide-v1.png', '-thumb.webp'), 80)
if 'home' in groups:
    same_size(os.path.join(ART, 'home-island-wide-v1.png'), 92)
if 'dinosaurs' in groups:
    for path in sorted(glob(os.path.join(ART, 'dinosaurs', '*.png'))):
        same_size(path, 92)
if 'bosses' in groups:
    for path in sorted(glob(os.path.join(ART, 'bosses', '*.png'))):
        square(path, 768, 92)
if 'buildings' in groups:
    for path in sorted(glob(os.path.join(ART, 'buildings', '*.png'))):
        square(path, 768, 90)
if 'gameplay' in groups:
    for path in sorted(glob(os.path.join(ART, 'gameplay', '*.png'))) + [os.path.join(ART, 'building-concepts.png')]:
        same_size(path, 90)

print(f'total {before / 1e6:.1f} MB -> {after / 1e6:.1f} MB')
