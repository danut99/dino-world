# Animated families and commit scope

Runtime family mapping (all three ages, South-East):

| Family | PixelLab source |
| --- | --- |
| Fire T-Rex | Existing first family |
| Earth Raptor | Existing raptor family |
| Nature Triceratops | Existing triceratops family |
| Water Raptor | Water trident guardian |
| Dark Raptor | Eclipse guardian |
| Light Triceratops | Winged light guardian |

The user delegated the species mapping for the three new guardians. Existing
stats, elemental roles and saved dinosaur identities remain intact. The new
fantasy guardians replace the artwork of those specific catalog variants.
The light adult uses enhanced attack/defend; water uses the large shield.
Ice and wind have adult source models but no generated animations or age states,
so they are not registered as animated runtime families.

Run `node scripts/list-runtime-commit.mjs` after imports finish. It generates:

- `output/realms/animation/commit-runtime.txt`: changed runtime code, tests,
  fonts and only the animation assets referenced by manifests .
- `output/realms/animation/commit-tooling.txt`: importer, browser review,
  translation sync and the commit-list generator, if changed.
- `output/realms/animation/unused-animation-assets.txt`: animation files with
  no runtime reference, excluded from the runtime commit list.
- `output/realms/animation/excluded-from-runtime-commit.txt`: everything else
  in the working tree, for manual review; excluded does not mean safe to delete.

From PowerShell, inspect the lists, then stage the runtime change with:

```powershell
git add -- (Get-Content output/realms/animation/commit-runtime.txt)
git diff --cached --stat
```

The tooling list can be staged separately in the same way. No files are staged
automatically. Existing index entries are not changed by the report generator.
Do not use `git add .` for this task. Prompt receipts, generation trackers,
raw frames in `art/`, screenshots and reports in `output/`, and build output
in `dist/` are not needed for the running game. The retired static-only dinosaur sheets and prototype model PNGs have been deleted. Animated source frames remain local.

Verification: `npm.cmd test`, `npm.cmd run build`, and
`node scripts/review-realms-animation.mjs`. The asset test validates every
registered manifest, all age-appropriate clips, file existence and PNG atlas
dimensions. The browser review exercises every imported clip, frame stepping,
reduced motion and one-shot defeat.

## Static-only retirement

Only the six animated families are playable. The shop, story eggs, battle drops,
collection and ordinary opponents use that same inventory. Existing valid saves
remove retired dinosaurs and eggs, keep resources/progress, select a remaining
champion and clear battles whose dinosaur was removed. Boss artwork is retained.
The static element sheets, crop metadata and prototype model fallback files were
removed, along with their browser loading paths (39 files, 33,805,550 bytes).
