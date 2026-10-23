# Dino World / Dino Realms

The entry opens **Dino Realms**. Run `npm install`, then `npm run dev`. The animation scene preview (every dinosaur and champion in the real arena and habitat) is at `?mode=preview`. The original Dino World game was removed on 23 October 2026; it remains in the git history before that date.

The main island has five placeable utilities: Hatchery, Farm, Workshop, Expedition Portal and Arena Gate. Habitats remain separate elemental worlds; Ignis lives in the fire world. Full-screen pixel-art expeditions, arena and crafting include a ten-world adventure map, resumable solo battles, a timed crafting queue, material rewards and offline collection. Romanian is the default, with English in Settings. The first PixelLab T-Rex family now has all age-appropriate South-East clips and 164 imported frames across three stages; other character art, final animation validation and 3v3 remain pending. Open **Artă & referințe** for the frame viewer; it defaults to SE. See the [animation pipeline and job inventory](docs/REALMS_ANIMATION_PIPELINE.md), [adaptation status](docs/STATUS.md), [decisions](docs/DECISIONS.md), and [asset backlog](docs/ASSET_BACKLOG.md).

Validation: `npm test`, `npm run build`. Browser QA: `node scripts/review-realms.mjs` with Playwright and Microsoft Edge installed (`PLAYWRIGHT_MODULE` can point to an existing Playwright package). On Windows where PowerShell blocks npm.ps1, use `npm.cmd`.

Reference 03/05 UI checks: `node scripts/review-reference-gameplay.mjs`. If the disk is nearly full, `node scripts/build-low-space.mjs` produces a complete local build using hard links for immutable public assets; rebuild rather than editing files in `dist`. The Windows sandbox config-loader restriction can be avoided with `npm.cmd test -- --configLoader runner`.

The documentation below describes the retained classic game.

Joc de colecție cu dinozauri, în stilul Dragon City: o insulă cu habitate pe elemente, ferme, incubator,
împerechere și un atlas al speciilor. Aspectul fiecărui dinozaur vine dintr-un generator (elemente + raritate + seed)
aplicat pe schelete Spine animate.

```sh
npm install
npm run dev      # http://127.0.0.1:5173
npm test
npm run build
```

În dev, butonul ⏩ (stânga jos) avansează timpul și pornește un joc nou.

The game defaults to English. Use **Română** in the top bar, or choose a language in Settings;
the choice is saved separately from game progress. Translations are bundled in `src/i18n/en.json`
and require no browser translation or network service. Wrap displayed text with `t()`; keep IDs,
save data, and player input unchanged. Catalog templates use numbered placeholders (`{0}`, `{1}`).

## Bucla de joc

- **Insula** are parcele fixe (`SLOTS`): pe ele construiești habitate (6 elemente) sau ferme.
- **Habitatele** produc aur în timp, până la un plafon; un dinozaur locuiește doar într-un habitat cu un element al lui.
- **Fermele** cresc hrană; hrana crește nivelul dinozaurilor (și aurul pe minut).
- **Incubatorul**: ouă cumpărate sau din împerechere; puiul iese direct într-un habitat potrivit.
- **Bârlogul**: doi dinozauri de nivel 4+ dau un ou dintr-o specie ale cărei elemente le au părinții (hibrizi, epici, legendari).
- **Atlasul**: toate speciile, cele nedescoperite ca siluete.

## Structura

```text
shared/game/        Regulile, fără React (pure, deterministe, testate) — viitor comune cu serverul
  catalog.ts        Elemente, rarități, specii, clădiri, parcele, culturi: echilibrarea
  world.ts          Parcele, construire/mutare/îmbunătățire, aurul habitatelor, fermele
  dinos.ts          Ouă, eclozare, hrănire, mutare, vânzare, împerechere
  commands.ts       runCommand: o comandă pe o copie a stării (la eroare, starea rămâne neschimbată)
src/
  app/App.tsx       Cadrul: lumea pe tot ecranul + HUD (resurse, butoane)
  screens/          WorldScreen (insula, camera, parcele), BuildingPanel, ShopPanel, AtlasScreen
  world/            islands.ts (imaginea insulei + pozițiile parcelelor), BuildingArt (habitatele în SVG)
  dino-lab/         Biblioteca de dinozauri (vezi mai jos)
  hooks/useGame.ts  Starea, salvarea locală, ceasul, notificările
public/
  world/            Insulele pictate (sursele mari în art/)
  dinosaurs/        Scheletele Spine (manifest.json + câte un folder pe schelet) și runtime-ul
```

## Biblioteca de dinozauri (`src/dino-lab`)

- `engine.ts` — aplică o **rețetă** pe un schelet Spine: culori pe părți (cap, corp, coadă, picioare, brațe,
  creastă, efecte), proporții, mișcare (val, inerție, ritm, săltare). Se schimbă live.
- `generator.ts` — `generateDino({ elements, rarity, seed, rig })`: rețetă completă din paleta și temperamentul
  elementelor. Același seed → același dinozaur.
- `recipes.ts` + `recipes.json` — rețeta unei specii: cea salvată în `recipes.json` sau, altfel, cea generată.
- `DinoView.tsx` — componenta React animată; `thumbnails.ts` — PNG-uri statice (un singur context WebGL).

**Schelet nou** (raptor, triceratops, sauropod): folder în `public/dinosaurs/<rig>/` cu `skeleton.json`,
`parts.atlas`, `parts.png`, o intrare în `manifest.json`, apoi `rig: '<rig>'` la specie. Părțile se recunosc
după numele oaselor (`DEFAULT_GROUPS` în `engine.ts`).

**Artă pictată pentru clădiri**: PNG-uri în `public/world/` și o intrare în `SPRITES` din `world/BuildingArt.tsx`;
imaginea înlocuiește desenul vectorial.

## Expediții zilnice

Avanpostul oferă trei locuri de misiune și trei rezerve, schimbate la miezul nopții în `Europe/Bucharest`.
Speciile și nivelurile cerute trebuie îndeplinite de dinozauri diferiți. Un loc neînceput poate fi înlocuit
cu o rezervă pentru 5 diamante; rezerva se consumă și limita rămâne trei misiuni zilnice.

Durata explorării / recuperării: ușoară 20 / 30 minute, specializată 45 / 90 minute, dificilă 90 / 180 minute.
Recuperarea începe la întoarcere, inclusiv offline, independent de revendicare. Blochează arena, alte
expediții și împerecherea; hrănirea și venitul continuă. Timerul este vizibil în card și în scena dinozaurului.

Recompensele includ fragmente ancestrale. Echipamentul de teren are trei îmbunătățiri (25, 60, 100 fragmente),
fiecare cu +10% aur, hrană și fragmente. Recompensa este fixată la plecare. Cele trei misiuni revendicate
în aceeași zi acordă automat un cufăr de 15 fragmente și 2 diamante. Misiunile din ziua precedentă își
păstrează recompensele, fără să completeze locuri din lista nouă. Salvările cu expediții vechi rămân compatibile.
