# References 03 and 05: visual comparison and required direction

Reviewed against the original reference images on 17 October 2026. **Implementation update:** all five utility buildings, full-screen pixel-art expedition/arena/crafting views, production bubbles and offline collection are now implemented. The map has ten destinations and bounded zoom/pan. See [STATUS.md](STATUS.md) for current coverage. Gap descriptions below are the original inspection baseline; generic 3v3 and final frame animation remain outstanding.

## Reference 03 — home island and utility buildings

The island is a large, open grassy plateau. Tall vegetation and rocks remain around the perimeter, with stepped cliff terraces, several waterfalls, small lower platforms and wooden bridges. Buildings are separate placeable objects. Placement has a visible ground grid and green/red footprint feedback.

The user's clarification takes priority over the illustrated habitat enclosure and roaming residents: **no habitats or resident dinosaurs on the main island**. Each habitat is a separate elemental world.

| Main-island building | Recognizable visual features | Current new-mode implementation |
| --- | --- | --- |
| Hatchery | Oversized speckled egg, stone/timber shrine, teal banners, torches | Present and functional |
| Farm | Golden thatch, wooden windmill, fenced crop rows, vegetables and crates | Purchasable, placeable, functional |
| Workshop | Orange/red roof, stone chimney, side crane, timber and crafting supplies | Missing; planned |
| Expedition Portal | Upright stone arch, cyan runes and swirling blue portal, grassy stone base | Missing; planned |
| Arena Gate | Fortified stone entrance, skull/horns, red banners and braziers | Missing; planned |

The current island follows the open-center/perimeter-decoration direction. Matching the reference more closely still requires its richer stepped terraces and bridges. Existing hatchery and farm concepts follow the correct motifs; the other three buildings must be separate sprites with their own placement and interaction, not baked into the island background. No breeding den is depicted in this board.

## Reference 05 — four distinct gameplay presentations

The image is a four-panel concept board showing **four separate screens**, not a single dashboard with all panels squeezed together. Each screen uses a dominant illustrated environment, substantial usable space, readable large characters/items, navy panels, warm parchment information areas and gold/stone framing. Follow the user's updated environment direction: detailed main-island-scale artwork, not coarse enlarged atlas cells.

### Expeditions

- Large illustrated adventure map occupies roughly the left two thirds.
- Regions have selectable nodes connected by a dotted route, with elemental markers and a clear selected node.
- Right side shows destination name and image, reward icons/quantities, three selected team portraits with levels/health, and a prominent Start button.
- This map is an adventure/campaign interface, separate from the habitat-world selector.

Current gap: the new mode has a centered tutorial encounter dialog. It has no illustrated route map, destination selection, three-slot team presentation or multi-encounter progression. Existing classic expedition code is a separate system and is not proof that this new presentation exists.

### Arena / battle

- Broad stone arena environment with terraces, audience, braziers and red banners.
- Three readable unit positions per side, with units standing on the arena ground.
- HP, element and level information belongs close to each unit. Add actual shield/energy/turn information required by the written plan.
- Four large bottom action tiles: Basic, Skill, Defend, Ultimate. Show real cooldowns, target selection and juvenile/adult locks.
- Board 01/06 armed character identities override the unarmed examples in board 05.

Current gap: the new mode has a functional 1v1 tutorial resolver and four action buttons inside a dialog, with static T-Rex concept art and a geometric enemy. A dedicated arena environment, proper opponent art, final frame animation, 3v3 and its generic combat systems are still missing.

### Crafting

- Workshop interior fills the scene: timber structure, tools, furnace glow and material piles.
- Left: resource inventory with clear icons and quantities.
- Center: selected recipe on a parchment work surface, input items/counts, transformation arrow and output preview.
- Prominent Craft action. Extend with categories, duration and queue display required by the written plan.
- Materials use the new plan's wood, stone, fiber and crystal definitions; do not copy classic bone/amber/meteor inventories into this design unintentionally.

Current gap: the new mode has no crafting screen, materials inventory, queue or Workshop building. A decorative screen alone must not be described as functional crafting.

### Idle / home

- The island remains the main scene, with collection bubbles anchored to productive objects and compact timers close to their source.
- An offline-results strip shows individual resource quantities and a prominent Collect action.
- Apply the user's world structure: hatchery/farm/workshop timers on the utility island; dinosaur residents and habitat income bubbles in their matching elemental worlds. A combined offline summary can aggregate across worlds.
- Distinguish accumulated-but-unclaimed rewards from resources already credited. Avoid duplicate collection after refresh.

Current gap: collection and farm/incubator timers work through controls/dialogs, but building-anchored bubbles, a dedicated offline summary and the crafting/expedition sources depicted in this board are not implemented.

## Camera correction completed

Camera movement now uses viewport- and zoom-dependent artwork boundaries. Dragging cannot reveal the empty area outside a landscape. Zoom-out and resize re-clamp the camera; picking uses the same constrained transform. Two targeted camera regression tests, the production build and 54 browser coverage checks passed across home/fire, desktop, mobile landscape and portrait. Browser checks verify opaque artwork at all four visible corners after extreme drags. Art-edge screenshots and results are in `output/realms/camera/`.

## Follow-on implementation order

1. Add Workshop, Expedition Portal and Arena Gate as independent utility buildings, with distinct art and honest system availability.
2. Replace the simple expedition dialog with the illustrated map and destination/team/reward layout.
3. Build the dedicated arena presentation around the combat engine's actual capabilities; finish the generic 3v3 systems before advertising them.
4. Add crafting domain/inventory/queue support and its workshop interface.
5. Add anchored production feedback and a correct offline-results summary to the main island and separate habitat worlds.
