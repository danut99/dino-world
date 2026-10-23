# Dino Realms animation pipeline

17 October 2026. Work follows `src/realms/CLAUDE_CODE_DINO_CITY_PLAN.md`.

## Current South-East delivery

The user's updated direction is **South-East**. Every age-appropriate SE clip for T-Rex fire is imported and available in the game. Baby has 8-frame idle and 12-frame walk; juvenile has six clips; adult has seven including ultimate. Total coverage is 164 frames (baby 20, juvenile 66, adult 78), including older optional NE clips. No SE jobs remain pending. Failed optional NE attempts were not retried. The viewer always opens in SE; island patrols retain the front-facing SE sprite, mirrored on return.

The importer pads 244px/252px baby canvases to 256px without resizing, registers complete clips to a shared ground pivot at y=216, and rejects registration that would crop visible pixels. The lower original pivot cropped part of the adult ultimate's effect; all atlases have been rebuilt with the corrected pivot.

## Runtime and visual changes

- Local Pixelify Sans display font, with Romanian glyph coverage; body copy retains Barlow. Font and OFL license are bundled. Dark plum panels, violet buttons and mint accents take visual direction from https://www.codedex.io/.
- Dinosaur animation manifests define real frame atlases, unequal frame durations, facing, loop/one-shot behaviour and impact metadata. Babies accept only idle/walk; ultimate belongs to adults. Invalid manifests are rejected.
- The React sprite player supports play/pause, frame stepping, SE/NE, exact canvas sizes, pivot/bounds and stage comparison. Open **Artă & referințe** in the footer.
- Canvas island rendering loads only resident families, switches idle/walk on a bounded patrol and mirrors the reverse direction. Pixel smoothing is disabled. Generated frames retain their original full canvas; frames are never cropped independently.
- Independent pixel smoke, portal sparks, farm motes and market lantern lights animate utility buildings. All ten realms have sparse elemental atmosphere; these are procedural VFX, not newly generated terrain animation atlases.
- Reduced-motion preferences stop frame playback and ambient movement. Hidden pages do not advance sprite animation. Defeat clips retain the last pose. The existing 1v1 battle renderer selects available attack/guard/ultimate/defeat clips, with a timeout that releases input.

## PixelLab source inventory

The connection was tested with account/library reads. Initial remaining allowance was 5,000 generations, active Tier 2. No credentials are stored in the project.

| Asset | PixelLab character ID | Purpose |
| --- | --- | --- |
| T-Rex fire juvenile | `b12ac2e4-7a76-4326-b105-6dd9024f2da3` | First family source |
| T-Rex fire adult | `7c961435-c293-4a02-9ae9-bd3989ed5f57` | Identity-preserving state derived from juvenile |
| T-Rex fire baby | `de86b7e8-9e36-4481-8ec8-af6962f0c52b` | Identity-preserving state derived from juvenile |

Earlier independently generated baby/adult concepts were rejected for inconsistent facial markers. Their IDs are `6f3aa55a-fe89-473d-ae35-342ec08f7392` and `97d0f274-eb53-4dad-87ef-45eebc15e611`; they remain in the user's PixelLab library and are not runtime assets. Failed juvenile and baby attempts are not used.

Source models use 192×192. PixelLab expands managed animation canvases to 256×256; the entire first family's runtime contract therefore uses 256×256. Atlases use at most eight columns and stay within 2048×2048. The generated character images remain at native pixel density, with transparent padding rather than per-frame resizing. V3 supports at most eight generated frames at this canvas: attack/death prototypes use eight; 12-frame walks and the 20-frame ultimate use PixMiniMax. These differences from initial frame estimates require visual review, not duplication of frames to meet a count.

## Reimporting completed jobs

1. Read the managed character with PixelLab MCP `get_character(include_preview=false)`.
2. Save its public text receipt as `art/realms/pixellab/{stage}.txt`. It contains public image URLs, not authentication.
3. Run `python scripts/import-realms-animation.py {stage} art/realms/pixellab/{stage}.txt` with download access. Original frames stay under ignored `art/`; runtime PNG atlases and manifests go under `public/realms/animations/`.
4. The importer updates `src/realms/animation-inventory.json`. Only imported families are fetched by the game; missing families retain clearly identified static concepts.
5. Inspect all frames, foot pivots, tail/weapon clipping, loop seams and directional consistency in the viewer. Keep manifest status `prototype` until this is validated.
6. Run `python scripts/strip-grey-ghosts.py --preview output/ghosts.png` after an import. PixelLab sometimes leaves a flat mid-grey "ghost" silhouette of its background in a few frames (first seen in raptor_wind adult `defend` 3-4). The script drops any large flat grey patch and writes a before/after contact sheet; `--dry-run` only reports. Warm greys are only dropped when the patch is large and does not repeat across frames (a baked foot shadow repeats; a ghost does not); `--no-persistence sheet.png` forces a full clean of one sheet after a visual check. Stone bases that are legitimately grey are listed in its `SKIP` set. New sheets imported later (bosses, thalassaur, ignasaur) have not been reviewed with it yet: run the dry run with `--preview` and look before applying.
7. Judge the result in context at `?mode=preview` (sidebar: every animated model; tabs: the real arena choreography and the island renderer), not only in the frame viewer.

Validation commands: `npm.cmd test`, `npm.cmd run build`, `node scripts/review-realms-animation.mjs`. Browser artifacts are in ignored `output/realms/animation/`. The older `review-realms.mjs` assumes superseded tutorial button text and cannot currently finish the tutorial.

Latest local checks: 175 tests passed, 2 skipped across 34 passing files. Production build and typecheck passed. Browser QA exercised every imported clip/facing, required SE coverage for all three ages, SE default selection, frame stepping, one-shot defeat and reduced motion on desktop/landscape, with zero page errors or missing assets. All 164 imported frames are local. No requested SE jobs remain pending; optional failed NE attempts are recorded in pixellab-animation-jobs.json and were not retried.

## Remaining scope

This is the first-family pipeline gate from the supplied plan. Other species/elements remain static concepts. Full building/terrain frame atlases, editable Aseprite layers, separate shadows/ultimate VFX, animation-impact-synchronised combat events, generic 3v3 and mobile FPS measurements remain separate unfinished work. Generated image frames are not editable layered Aseprite sources. Do not describe the entire 150-model catalog or all plan phases as completed.
