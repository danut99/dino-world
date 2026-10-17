# Dinosaur art and placement

The reference catalog contains five species, ten elements, and three stages: 50 variants and 150 static stage designs. Species are T-Rex, Raptor, Triceratops, Ankylosaurus, and Brachiosaurus. All ten elemental sheets are stored in `public/realms/dinosaurs/`. Each sheet contains all five species and their baby, juvenile, and adult designs.

Artwork follows the armed fantasy direction in reference 01, reference 06, and section 21 of the written plan. Fire Raptor has twin daggers; Wind Raptor has a sword; the species retain recognizable snouts, horns, frills, armor, necks, and tails. Element-specific clothing and instruments distinguish variants beyond recoloring. These generated static designs have not been certified as final hand-cleaned, 192x192 frame animation assets.

## In the app

- Collection: ten element filters and three growth-stage filters show every design. The other four former text-only species cards now display their own art.
- Elemental worlds: five adult species previews are placed on each matching landscape. The owned Ignis replaces the Fire T-Rex preview, with his actual saved growth stage. Home remains a utility island.
- Ignis: new Fire T-Rex artwork is shared by collection, feeding/evolution screens, teams, the fire-world canvas, and battles.
- Arena: the ice Ankylosaurus appears in the lobby and as the opponent.
- Expeditions: the existing ice opponent uses the new Ice Raptor art; the arena uses Ice Ankylosaurus. Combat retains its existing ice affinity and solo encounter rules. Native elemental species appear in their own worlds; changing an opponent image never silently changes combat rules.

Only Ignis is currently recruitable and playable. Other world residents are explicitly labeled static art previews, with no new ownership or production credited to saves. The existing saved game schema and economy are unchanged. Recruitment, additional playable units, 3v3 combat, and frame-by-frame animation require their own gameplay implementation.

## Asset contract and verification

The generated layouts vary slightly in their spacing. `scripts/inspect-dinosaur-sheets.py` inspects connected alpha islands and writes bounding boxes and silhouette clip paths to `src/realms/dinosaur-crops.json`, without changing artwork pixels. Both SVG and canvas rendering use the same per-character crop and silhouette metadata. Explicit clipping prevents neighboring characters from appearing in letterboxed SVG viewports and excludes disconnected neighboring equipment. Sheets load only as their world/element is visited; CSS and canvas use pixelated/nearest-neighbor rendering for characters.

Exact generation prompts and final paths are recorded in [dinosaur-art-prompts.json](dinosaur-art-prompts.json). The built-in image generation tool was used. Immutable source and workspace copies share NTFS hard links on this low-space development machine; each workspace path holds the complete file and does not depend on the original filename continuing to exist. Create a new version before editing art in place.

Silhouette metadata is split into ten dynamically imported modules in `src/realms/dinosaur-crop-data/`, so the initial app bundle does not contain all 150 outlines. `loadDinosaurArt(element)` resolves the metadata before drawing; `dinosaurCrop(element, species, stage)` then supplies the bounding box, source dimensions, and clip path. `DinosaurArt` handles this loading for React automatically. The canvas uses the same metadata and a `Path2D` clip. `Hero` is the existing Fire T-Rex convenience wrapper; new playable families should pass their actual species and element to `DinosaurArt`.

Validation: `python scripts/inspect-dinosaur-sheets.py`, `npm.cmd run typecheck`, `npm.cmd test -- --configLoader runner`, `node scripts/build-low-space.mjs`, and `node scripts/review-dinosaur-catalog.mjs`. The browser review checks all 150 catalog views, all ten placed worlds, missing assets, JavaScript errors, and desktop/mobile layouts.
