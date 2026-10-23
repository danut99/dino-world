# Dino Realms adaptation status

## South-East animation delivery — 17 October 2026

All requested SE clips for the first T-Rex fire family are now imported: baby idle/walk (20 frames), juvenile idle/walk/attack/defend/hurt/defeat, and adult clips including ultimate. Total imported coverage is 164 frames across three stages, including previously completed optional NE clips. SE is the default viewer and gameplay direction; island patrols use the SE sprite mirrored on return. No required SE generation jobs remain pending. Assets remain marked prototype pending full art/foot-contact approval. See [REALMS_ANIMATION_PIPELINE.md](REALMS_ANIMATION_PIPELINE.md) and [job inventory](pixellab-animation-jobs.json).

## Earlier partial PixelLab batch — 17 October 2026

The current visual/animation work is documented in [REALMS_ANIMATION_PIPELINE.md](REALMS_ANIMATION_PIPELINE.md). Three native pixel-art T-Rex fire models now share a consistent identity. The first imported juvenile atlas batch contains 34 real frames (NE idle, SE attack/defend/hurt/defeat), marked prototype. Further juvenile/adult jobs are processing in PixelLab; baby animation requests and adult idle were refused while all ten job slots were occupied. This is not completion of the first-family gate or the full catalog.

The runtime now supports atlas playback, stage-restricted clips, one-shot defeat, frame stepping, pivot/bounds, comparison and reduced motion. Utility buildings and all realms have separate procedural pixel VFX. A local pixel display font and plum/violet/mint UI theme are integrated. See the linked report for canvas-size changes, validation commands and remaining scope. Historical sections below predate this animation batch.

Updated 17 October 2026. Default: Dino Realms preview. The classic Dino World game was removed from the tree on 23 October 2026 (see git history).

## Wide elemental worlds

All ten elemental landscapes now use generated 16:9 sibling artwork at `public/realms/worlds/{element}-wide-v1.png`, following the approved wide main island. Runtime, realm thumbnails and destination previews use the new versions. Originals remain available. Landscapes keep their natural aspect ratio, centered behind the saved grid; camera bounds use actual image dimensions, allowing sideways dragging at 1x. Prompts and actual sizes: [wide-world-art-prompts.json](wide-world-art-prompts.json). Browser review: `node scripts/review-wide-worlds.mjs`.

## Implemented from references 03 and 05

## Dinosaur artwork update

All five reference species now have static pixel-art designs for all ten elements and all three stages (150 designs). The collection and visual workshop browse every design, five species previews are placed in each elemental world, and Ignis and the ice combat opponents use the new shared artwork. These are art previews rather than additional recruited units or final animation atlases. See [DINOSAUR_ART.md](DINOSAUR_ART.md) for placement, limitations, prompts, and validation.

## Buildings and gameplay

- Five independently placeable/selectable/movable utility buildings: Hatchery, Farm, Workshop, Expedition Portal, Arena Gate. Purchases are atomic; 3x3 footprints reject overlaps and out-of-bounds positions. No habitats or resident dinosaurs on home.
- Ten separate elemental habitat worlds, with 1536x1024 landscapes. Ignis lives in the fire world. Camera movement is constrained to the artwork after dragging, zooming and resizing.
- Full-screen pixel-art expedition map covering all ten worlds, destination nodes, route connections, rewards, team sidebar and unlock requirements. Bounded 1x/2x/3x map zoom and drag. Generated map source: 1619x971, rather than the 2560x1536 requested from the tool.
- PvE arena lobby with three challenge tiers; dedicated full-screen arena battle presentation with real HP, energy, cooldown, burn, defend and adult-ultimate state. Battles and reward snapshots survive refresh.
- Workshop inventory and five recipes, with input/output preview, duration and one running plus two queued jobs. Atomic material reservations, queued cancellation/refund, offline completion and single-claim outputs. Habitat kits increase fire-world income; evolution crystals grant a level without bypassing stage gates; lamps decorate home.
- Building-anchored timers and ready bubbles, fire-world income bubble, and an offline strip showing claimable resources. Collect Available claims gold, farm food and completed crafting outputs once.
- Schema v3 saves validate resources, utilities, inventory, queues, encounter progression and battles. v1/v2 previews migrate with backup, preserving dinosaurs, food, gold and active battles. Classic saves are never overwritten.
- Original egg, feeding, explicit juvenile/adult evolution, farm and offline production loop remains functional. Ten expedition encounters and three arena challenges have first-clear and reduced replay rewards. Materials come from encounters, with a small initial crafting inventory for new/migrated previews.

All new map, building, arena, workshop and enemy assets use deliberately generated pixel art. Smooth initial candidates were rejected and removed from runtime assets. Exact prompts/paths: [gameplay-art-prompts.json](gameplay-art-prompts.json). Original concept boards are not sliced into runtime sprites.

## Remaining limitations

Only the fire T-Rex is currently owned/playable. Battles remain solo 1v1; the team panel shows one real portrait and two explicitly unrecruited slots. Generic 3v3, other playable families, timed team expeditions, breeding and online economies are not implemented. Hero and enemy art is static; separate impact VFX do not constitute finished character frame animation. Final atlases, animation validation, audio, mobile FPS measurements and the reference island's exact bridge/terrace layout remain pending.

## Validation and build

- Unit/regression suite: `npm.cmd test -- --configLoader runner`.
- UI QA: `node scripts/review-reference-gameplay.mjs`. Checks five utility purchases/placements, ten-world map controls, craft queue across refresh, battle resume, arena challenges, offline collection and desktop/mobile views. Compact JPEG screenshots and report: `output/reference-gameplay/`.
- Camera report: `output/realms/camera/review.json` (54 edge checks). Older large QA screenshots were cleared to recover disk space; reports remain.
- Normal build: `npm.cmd run build -- --configLoader runner`. This environment ran out of OS disk space copying public assets. `node scripts/build-low-space.mjs` creates the production bundle and completes `dist/` using hard links to immutable public assets. Do not edit linked files in `dist`; rebuild instead. Normal npm build behavior is unchanged.
