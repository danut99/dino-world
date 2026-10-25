# Dino World / Dino Realms

Joc de colecție cu dinozauri în pixel art, în stilul Dragon City: o insulă cu clădiri, zece lumi pe elemente,
expediții cu echipe și o arenă PvE în ștafetă. Conținutul e gândit pentru ~30 de zile de joc normal (3–4 sesiuni
scurte pe zi). Româna e limba implicită; engleza se alege din Setări.

```sh
npm install
npm run dev      # http://127.0.0.1:5173 (?mode=preview: scena de previzualizare a animațiilor)
```

Jocul clasic Dino World a fost scos din proiect pe 23 octombrie 2026; rămâne în istoricul git de dinainte.

## Bucla de joc

- **Insula** are clădirile utilitare: Incubator, Fermă, Atelier, Portal de expediții, Poarta arenei și Piață.
  Fiecare upgrade durează (5 min – 8 h) și există un singur constructor.
- **Lumile** (foc, apă, pământ, natură, gheață, fulger, vânt, întuneric, lumină, arcan) se deblochează în ordine,
  cu aur și materiale; fiecare are un habitat (5 niveluri) care produce aur din dinozaurii lui.
- **Ferma** crește hrană; hrana ridică nivelul dinozaurilor (pui → tânăr la 10 → adult la 25, cu cristal de evoluție).
- **Expedițiile**: zece regiuni × cinci etape, cu echipe de 1–3 dinozauri de nivelul cerut (10 → 50) și provizii;
  etapa a cincea aduce un ou al regiunii. După etapa a treia, regiunea se poate patrula (1 / 3 / 8 ore).
- **Arena**: zece ligi × trei trepte (Ucenic, Veteran, Campion cu boss). Echipa luptă în ștafetă cu 1, 2 sau 3
  dinozauri; fiecare luptă consumă un bilet al elementului ligii. Stelele deblochează treptele și dau premii.
- **Colecția**: 20 de familii jucabile + 10 boși (30/30). Ouăle vin din piață, poveste, finalurile regiunilor,
  patrule și ligi.
- **Zilnic** (ziua din București): trei misiuni, cufărul lor și roata. **Diamantele** se câștigă încet din joc
  (~220 pe lună) și cumpără doar timp.

Detalii și tabele: [docs/BALANCE.md](docs/BALANCE.md). Starea curentă: [docs/STATUS.md](docs/STATUS.md);
decizii: [docs/DECISIONS.md](docs/DECISIONS.md); conturi și cloud: [docs/SUPABASE.md](docs/SUPABASE.md); animații:
[docs/REALMS_ANIMATION_PIPELINE.md](docs/REALMS_ANIMATION_PIPELINE.md).

## Structura

```text
src/main.tsx              Intrarea: jocul (sau ?mode=preview)
src/realms/
  game.ts                 Starea (Save v6) și reducerul `command(save, comandă, acum)`; `advance` pentru timp
  content.ts              Tabele: clădiri, culturi, rețete, regiuni, ligi
  expeditionRules.ts      Planul unei etape / patrule (verificări comune pentru UI și reducer)
  arenaTeams.ts           Adversarii fiecărei trepte, recompensa pe mărimea echipei
  autoBattle.ts           Planificatorul luptelor și prognoza (`predictFight`)
  daily.ts                Misiuni zilnice, cufăr, roată, ziua din București
  pacingBot.ts            Botul de ritm (doar pentru teste: pacing.test.ts)
  cloud.ts, SignInGate.tsx, useCloudSync.ts   Conturi și salvarea în cloud (Supabase)
  *Panel.tsx, GameplayScreens.tsx, ui/        Interfața
public/realms/            Lumi, clădiri, ouă, animații (sprite-uri PixelLab)
supabase/migrations/      Tabelul `saves`, jucătorii, pragul de schemă
scripts/                  Verificări în browser (Playwright) și unelte de artă
```

## Verificare

- Teste: `npm test` (pe Windows, dacă PowerShell blochează npm.ps1: `npm.cmd test -- --configLoader runner`).
  `pacing.test.ts` rulează botul de ritm și afișează tabelul pe zile.
- Tipuri și build: `npm run build` (`tsc` + `vite build`). Dacă discul e aproape plin,
  `node scripts/build-low-space.mjs` face un build complet cu hard link-uri pentru fișierele publice.
- În browser: `node scripts/review-realms.mjs` și celelalte `scripts/review-*.mjs`, cu Playwright și Microsoft Edge
  instalate (`PLAYWRIGHT_MODULE` poate indica un pachet Playwright existent).
- Uneltele de test (butonul „i”: resurse, diamante, sărituri în timp) există doar în `npm run dev`.
