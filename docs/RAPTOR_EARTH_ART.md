# Earth raptor with twin daggers

User request: a feathered dinosaur resembling the supplied tribal raptor reference, recoloured for earth, with the same growth stages and animation types as T-Rex. **New animations are South-East only.**

## Visual brief

Narrow umber snout, amber eyes, cream jaw, swept feather crest, clawed digitigrade legs and a long feathered tail. Bronze brow diadem, circular chest medallion, leather wraps and layered stone/bronze armour. Palette: ochre, sand, olive moss, bronze, slate and small jade mineral accents. Two curved flint daggers with pale stone edges and mineral veins. The supplied reference guides silhouette, feather crest and loadout; earth materials replace its fire theme.

The earth element retains its existing protector role. Technical `attack` animation uses paired dagger gestures to trace an earth ward. This art update does not change combat statistics or elemental roles.

| Stage | Model and equipment | SE clips |
| --- | --- | --- |
| Baby | Large head, little crest/tail, simple training tunic, wooden practice daggers sheathed | idle, walk |
| Juvenile | Developed legs, modest bronze/stone armour, functional twin flint daggers | idle, walk, attack, defend, hurt, death |
| Adult | Elaborate feather crest and armour, engraved twin daggers, mineral ornaments | all juvenile clips plus ultimate |

Shared facial markings, crest arrangement, tail pattern and medallion identify the same individual through growth. Child and juvenile models derive from the adult rather than unrelated generations.

## Pipeline

Adult source character: `769e2f5c-406c-4d5b-a7b8-d3ee3877d852`. Pro generation uses a native 128px canvas; runtime retains native pixel density inside transparent 256px frames. Prior v3 requests failed with database connection-pool timeouts. A style-reference attempt (`45e2bc9b-f327-4769-9a73-fa52f711db37`) failed because the 192px T-Rex reference exceeded the Pro generator's 128px output limit; it is not a runtime asset.

Generic import command: `python scripts/import-realms-animation.py adult art/realms/pixellab/raptor_earth/adult.txt --variant raptor_earth` (repeat for other stages). The default variant remains `trex_fire`, preserving its existing import workflow. The importer validates variant IDs, pads without resizing, registers entire clips and rejects visible-pixel cropping. Runtime manifests remain prototype until art review.

The browser review now selects species and element from each manifest and checks required SE coverage, every imported clip, frame stepping, final defeat pose and reduced motion for both families.

## Production status

The adult SE model has been inspected and published as a prototype portrait. Baby and juvenile are being edited directly from its SE rotation, retaining identity and avoiding unused direction generation. New animations are queued as raw-image jobs against transparent padded 256px references; JSON receipts carry explicit frame lists and reference-frame removal. The importer also retains the original managed-character text-receipt workflow, verified against unchanged T-Rex exports.

Current job IDs: [raptor-earth-production.json](raptor-earth-production.json). No raptor animation atlases are claimed complete at this checkpoint.
