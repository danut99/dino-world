# Animated arena bosses

The fire, water, earth and nature champion tiers use dedicated adult boss
animations. They are separate from the collectible dinosaur inventory:

| League | Boss | Manifest |
| --- | --- | --- |
| Fire | Ignaroth | `boss_fire_adult` |
| Water | Thalassion | `boss_water_adult` |
| Earth | Terragor | `boss_earth_adult` |
| Nature | Sylvaraa | `boss_nature_adult` |

The lobby loops idle. Battles use each boss's real walk, attack, hurt and death
clips through the existing battle choreography, including frame-based hit timing.
Defend and ultimate are available in the manifests where completed; this change
does not alter the battle reducer's enemy AI or damage rules.

All four bosses have all seven clips. Sylvaraa includes the completed 40-frame
ultimate (`TOTAL BLOOM OF THE ETERNAL FOREST`). Missing requested clips fall back
to idle; no frames are duplicated or borrowed from another character.

Boss manifests and selected atlases live in `public/realms/animations/boss_*_adult/`.
The four previous static WebPs and their local PNG sources were deleted
(8,359,379 bytes). The static ice boss is retained. The WebP builder skips the
retired four images so rebuilding artwork does not recreate them.

Completed group ZIP import:

```powershell
python scripts/import-pixellab-archive.py boss_fire path/to/fire.zip
```

For a character with a pending job, a completed-clip text receipt can be imported
using `scripts/import-realms-animation.py adult receipt.txt --variant boss_nature`.
Raw archives and frames remain ignored under `art/`.
