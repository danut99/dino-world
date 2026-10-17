# Asset backlog

## Current concepts

Reference 03/05 update: pixel-art Workshop, Expedition Portal and Arena Gate sprites are integrated in `public/realms/gameplay/utility-buildings-pixel.png`. Full pixel-art arena/workshop scenes, the ten-world adventure map and a static ice-knight enemy are also integrated. Exact prompts/paths: [gameplay-art-prompts.json](gameplay-art-prompts.json). These replace rejected smooth candidates; static characters are not completed animations.

Built-in image generation was used for the new runtime concepts under `public/realms/`. Full prompts are recorded in [realms-art-prompts.md](realms-art-prompts.md). These are raster concepts, not approved production sprites. Runtime cropping is a viewport over newly generated concept strips; original reference boards are never sliced into characters.

Elemental environments now use individual full landscapes in `public/realms/worlds/`, matching the main island's spacious composition and detail. The small `elemental-world-concepts.png` sheet is historical reference only and is no longer rendered. The user's updated direction favors the main island's finer detail over coarse enlarged pixel tiles. Character animation production remains separate from this environment improvement.

## P1 visual acceptance gate

1. Approve a model sheet for fire T-Rex child/juvenile/adult, keeping snout, crest, coal markings, red scarf and equipment family recognizable.
2. Redraw at logical 192×192, or explicitly approve one consistent larger contract for sword/tail bounds. Clean pixel clusters and remove concept-strip edge contamination.
3. Produce SE and NE idle (8 frames) and walk (12 frames) for all three stages.
4. Produce juvenile/adult attack (12), defend (6), hurt (4), death (10); adult ultimate (20). Minimum reference volume: 204 body frames across all stages and views.
5. Make editable body/outfit/weapon/occlusion/VFX layers. Export packed atlas + frame timings + ground pivots + trim offsets + impact events. Weapon is fixed identity, not interchangeable equipment.
6. Add manifest validation, frame player (play/pause/step), true pivot/bounds validation, and loop/contact QA. The current static inspector does not satisfy this animation gate.
7. Replace primitive building fallbacks and prototype ice-sentinel geometry with consistent exported sprites. Separate shadows and VFX. Validate collision/access against actual art.
8. Integrate real wandering, foot contact/stride timing, animation events and visibility lifecycle; test desktop and an explicitly named mobile target before claiming FPS.

## After first family validation

Raptor wind (sword, speed support); Triceratops earth (shield/staff, no offensive damage); Ankylosaurus ice (hammer/control); Brachiosaurus water (orb staff/healing). Then the other realms, workshop, expedition portal, arena gate, inventory icons, and elemental eggs. Fire Raptor's two daggers and wind Raptor's sword must remain distinct when that extension is produced.
