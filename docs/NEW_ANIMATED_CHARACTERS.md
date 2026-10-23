# Newly discovered animated characters

The runtime catalog now includes these complete South-East families, each with
baby idle/walk, six juvenile clips and seven adult clips:

| Runtime family | PixelLab adult ID |
| --- | --- |
| `ankylosaurus_ice` | `276d3bc1-1d54-4eba-a50a-d79f2c714fa9` |
| `raptor_wind` | `a7143de6-4636-42ae-9b45-a98b9e76bf0b` |
| `trex_lightning` | `77343465-5c56-4fa6-95f1-25790d040b35` |
| `brachiosaurus_arcane` | `66ced658-e124-4e90-ac71-06c5d9cc277f` |
| `brachiosaurus_nature` (grove guardian) | `94fa4326-b6fd-4bcf-baf3-0c1074f5ba82` |

The species mapping keeps existing game identities and elemental roles. Wind uses
the repaired adult `idle-stable-bowstring` revision saved to the character, rather
than the older idle. Public files contain only selected SE atlases and manifests.
Full ZIPs, source frames, metadata and previews remain in ignored `art/` or `output/`.

Import a completed public PixelLab character-group ZIP with:

```powershell
python scripts/import-pixellab-archive.py ankylosaurus_ice path/to/ice.zip
python scripts/import-pixellab-archive.py raptor_wind path/to/wind.zip --prefer idle=idle-stable-bowstring
```

The archive importer verifies all required ages/clips before extraction and uses
the existing atlas importer. Full source canvases are preserved, with transparent
padding and a shared safe ground pivot. It does not generate new images.

The separate `dino-anim` project contains custom mesh rigs and four clip types;
those are not PixelLab atlases and have not replaced existing runtime families.

The grove guardian is now imported with all 15 age-appropriate SE clips. It is a
separate nature family alongside the existing Triceratops shaman. Nature eggs
from battle drops can now belong to either animated family.
