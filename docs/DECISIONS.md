# Dino Realms adaptation decisions

- Adapt the existing repository and preserve a runnable classic mode instead of deleting the working game or coercing incompatible saves. The new default is a separately saved reviewable path. New save key: `dino-realms-save-v1`; language preference: `dino-realms-language`.
- Preserve the user's explicit world structure: each habitat is a separate elemental world. Home contains utility buildings, not habitat enclosures or resident dinosaurs. All ten worlds can be visited with unique environment concepts; only fire has a playable resident so far. Do not interpret the reference board's example enclosure as permission to put habitats on home.
- World-size/detail correction: the user's latest direction requires elemental environments comparable to the large main island. Replace the small 5×2 atlas crops with ten dedicated landscape illustrations, each at least 1536×1024. Render them over the same full 1536×1024 scene rectangle as home, using high-quality environment resampling and normal CSS canvas interpolation. The earlier atlas is retained only as an unused historical concept. Do not enlarge its roughly 400px cells for gameplay. Character rendering remains independently controlled.
- Prioritize the written plan, especially sections 21–23. No extra classes or random roles. The fire T-Rex is an attacker with a fixed sword/outfit; earth's catalog role remains passive protection. Other variants remain planned until their mechanics and art are implemented.
- Keep React/TypeScript/Vite and add Canvas 2D rather than adding Phaser solely for this prototype. No new package dependency is needed. Domain commands remain independent of rendering; the legacy app is lazy-loaded.
- Use new generated concept art, not cutouts from the supplied concept boards. Static concepts are disclosed in the character panel and viewer. The player is never told that image transforms constitute finished animation. The original boards are copied unchanged to `public/realms/references` for review.
- The generated environment's traversable region is modeled conservatively as a hand-authored 12×12 isometric diamond. This is a prototype layout, not the final 32×32 island-mask/pathfinding system. Footprints are independent of the background image. Placing an invalid building or canceling costs nothing.
- Retain browser-local storage initially, with schema/content versions, revision, validation, and backup. Schema v1→v2 removes the mistaken initial-preview main-island habitat and explicitly assigns its T-Rex to the fire world. The original JSON is backed up before automatic migration. IndexedDB and additional future migrations are deferred; there is no conversion from unrelated classic data. Imported saves are local progress data, not server-authoritative proof of earned currency.
- Start with a 1v1 tutorial only. A command resolves the player's action and the enemy reply atomically, so closing the tab cannot strand a half-resolved enemy turn. This is an explicitly limited tutorial resolver, not the proposed generic 3v3 status engine. The ice sentinel's fixed stats and action are prototype encounter data. Defeat preserves the dinosaur.
- The first evolution costs the specified level-transition food (total 270 food from 1→10), with no extra currency or essence cost. Subsequent levels remain food-funded, as the prototype has no essence crafting.
- Collect/claim/hatch transitions reject repeats in the local store. A server-authoritative command-ID ledger and multi-tab synchronization are future work; no online financial guarantees are claimed.
- All runtime assets are served locally. No publication, new hosting account, or cloud save is introduced by this local repository task.

## Reference 03/05 implementation update

All five utility buildings now have independent placement and interaction, excluding habitats from home. Full-screen pixel-art map, arena and workshop scenes replace the simple dialogs. The user's updated pixel-art correction supersedes the initial smooth candidates. The map covers ten elemental destinations with bounded zoom/pan and reward/unlock definitions.

The solo resolver now supports ten expeditions and three PvE arena challenges, not generic 3v3. Battle rewards are snapshotted at start and granted once. Crafting has atomic reservations, a three-job active/queued capacity, absolute timestamps, queued cancellation/refund, offline completion and single-claim output. Schema v3 migrates v1/v2 previews with backup.

The system disk filled while duplicating public assets for validation. Reproducible dist output and stale QA screenshots were cleared; source, reference and save data were preserved. scripts/build-low-space.mjs builds the production bundle then hard-links immutable public assets. Normal npm build still clears and copies output conventionally.

## Rebalansul pentru ~30 de zile (octombrie 2026)

- **Reset v6 pentru toți.** Salvările cu altă `schemaVersion` nu se migrează: aruncă `OutdatedSave`, iar jucătorul
  pornește un joc nou (un rând vechi din cloud nu câștigă niciodată, iar trigger-ul `0003_schema_floor.sql` nu lasă un
  client vechi să coboare versiunea). Câmpurile adăugate după v6 primesc valori implicite cu `??=`, fără alt reset.
- **Diamantele cumpără doar timp.** Se câștigă încet din joc (~220 pe lună: bun venit, capitole, regiuni, stele,
  colecție, cufărul zilnic, roata, sezonul) și se cheltuie pe terminare acum, boost de aur, trezire, rotiri și misiuni
  în plus. Nu se schimbă în resurse și nu cumpără bilete; pachetele plătite rămân „în curând”.
- **Bilete de arenă pe element, fără regenerare.** Fiecare ligă cere biletul elementului ei; biletele se cumpără cu aur
  (5 × nivelul de bază al ligii) sau se câștigă (etape, patrule de 3 h / 8 h, roata, sezonul) și se consumă la luptă.
  Remiza îl returnează.
- **Echipa de arenă e opțională: 1, 2 sau 3 dinozauri în ștafetă.** Când cade unul, intră următorul cu energia goală.
  Echipa mai mare primește ×1,1 / ×1,2 la recompense; stelele se calculează pe HP-ul întregii echipe.
- **Regula `LEVEL_GAP`.** Fiecare nivel peste adversar adaugă 4% la daunele date și scade 4% din cele primite (cel mult
  10 niveluri), ca nivelurile să conteze și în ligile târzii, unde statisticile cresc încet.
- **Un singur constructor.** Upgrade-urile de clădiri au timp de construcție (5 min – 8 h), unul singur odată; clădirea
  lucrează la nivelul vechi până la final. Plasarea unei clădiri noi și deschiderea unei lumi rămân instantanee.
- **Ziua jocului e ziua din București.** Misiunile zilnice, roata, bonusul de patrule și săptămâna sezonului se schimbă la
  miezul nopții în `Europe/Bucharest` (`dailyDay`, `weekId`), nu în UTC.
- **Ritmul se verifică de un bot.** `pacing.test.ts` joacă fără diamante 4 sesiuni pe zi (08, 13, 18, 22) și 3 sesiuni
  (08, 14, 21) doar prin `command()`: regiunile nu se termină înainte de ziua 22, totul e gata între zilele 26 și 34
  (3 sesiuni: până în ziua 40), nicio resursă nu scade sub zero și nicio comandă repetată în același moment nu aduce
  resurse a doua oară. Numerele din tabele se ajustează după bot (vezi BALANCE.md).
- **Oul ultimului capitol vine cu bossul arcan**, nu cu colecția completă (altfel oul ar fi venit după ce nu mai conta).
