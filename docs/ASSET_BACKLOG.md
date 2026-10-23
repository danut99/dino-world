# Asset backlog

Current first-family delivery: all age-appropriate South-East clips are imported for T-Rex fire, including baby idle/walk. There are 164 local frames across three stages. SE is the default; no requested SE jobs remain pending. See [animation pipeline](REALMS_ANIMATION_PIPELINE.md). Other families remain in the backlog.

## Current concepts

Reference 03/05 update: pixel-art Workshop, Expedition Portal and Arena Gate sprites are integrated in `public/realms/gameplay/utility-buildings-pixel.png`. Full pixel-art arena/workshop scenes, the ten-world adventure map and a static ice-knight enemy are also integrated. Exact prompts/paths: [gameplay-art-prompts.json](gameplay-art-prompts.json). These replace rejected smooth candidates; static characters are not completed animations.

Built-in image generation was used for the new runtime concepts under `public/realms/`. Full prompts are recorded in [realms-art-prompts.md](realms-art-prompts.md). These are raster concepts, not approved production sprites. Runtime cropping is a viewport over newly generated concept strips; original reference boards are never sliced into characters.

Elemental environments now use individual full landscapes in `public/realms/worlds/`, matching the main island's spacious composition and detail. The small `elemental-world-concepts.png` sheet is historical reference only and is no longer rendered. The user's updated direction favors the main island's finer detail over coarse enlarged pixel tiles. Character animation production remains separate from this environment improvement.

## P1 visual acceptance gate

1. Approve a model sheet for fire T-Rex child/juvenile/adult, keeping snout, crest, coal markings, red scarf and equipment family recognizable.
2. Models use 192×192; runtime animation frames share a padded 256×256 contract. Continue pixel-cluster cleanup and weapon/tail-bound review.
3. SE idle (8 frames) and walk (12 frames) are imported for all three ages. The user's latest direction prioritises SE; older NE clips remain optional and partial.
4. Juvenile/adult combat clips and adult ultimate are imported. Prototype attack/death use 8 frames rather than the initial 12/10 estimates; defend uses 6, hurt 4, ultimate 20. Review timing and motion before marking production-ready.
5. Packed atlases, timings, shared ground pivot and impact metadata are exported. Editable body/outfit/weapon/occlusion/VFX source layers remain missing. Weapon is fixed identity, not interchangeable equipment.
6. Manifest validation, play/pause/step viewer, pivot/bounds overlays and all imported-clip browser checks are implemented. Continue detailed foot-contact/loop cleanup and final art review.
7. Replace primitive building fallbacks and prototype ice-sentinel geometry with consistent exported sprites. Separate shadows and VFX. Validate collision/access against actual art.
8. SE wandering/mirrored return and visibility/reduced-motion lifecycle are integrated. Tune foot contact/stride timing, synchronise battle impact events, and measure desktop/mobile FPS on an explicitly named target.

## After first family validation

Raptor wind (sword, speed support); Triceratops earth (shield/staff, no offensive damage); Ankylosaurus ice (hammer/control); Brachiosaurus water (orb staff/healing). Then the other realms, workshop, expedition portal, arena gate, inventory icons, and elemental eggs. Fire Raptor's two daggers and wind Raptor's sword must remain distinct when that extension is produced.
