# Dino Realms — starea curentă

Actualizat pe 25 octombrie 2026, după rebalansul pentru ~30 de zile (fazele 0–6 din plan). Jocul clasic Dino World a
fost scos pe 23 octombrie 2026 (rămâne în istoricul git).

## Salvarea v6 și resetul

- `Save.schemaVersion` este 6. Orice altă versiune aruncă `OutdatedSave` la încărcare: nu există migrare, jucătorul
  pornește un joc nou (`cloud.ts` întoarce `{ save: newSave(), outdated: true }`, `SignInGate` urcă imediat noua
  salvare, iar în `useCloudSync` un rând vechi nu câștigă niciodată).
- `supabase/migrations/0003_schema_floor.sql` refuză coborârea `schema_version` în `saves`, ca un client vechi din
  cache să nu suprascrie v6. Numele jucătorilor (`profiles`) și view-ul `players` rămân neatinse.
- Câmpurile noi (echipă, portal, expediții multiple, bilete pe element, sezon, construcție, colecție, lămpi, zilnicele)
  se adaugă de acum cu `??=` în `parseSave`, fără alt reset.
- Uneltele de test (butonul „i”, `devSkip`, `devResources`, `devRarityEggs`, `addGems`) există doar când
  `DEV_TOOLS = import.meta.env.DEV` e adevărat; în build-ul de producție comenzile aruncă `dev`.

## Economia

- Hrănire: `feedCost(L) = round(10 + 3L + 0,9L²)`; juvenil la nivelul 10 (~480 hrană), adult la 25 (~5.550, plus un
  cristal de evoluție), nivelul 50 la ~40.550. Butoane ×1, ×5 și „până la prag”; cristalul de evoluție dă +1 nivel.
- Fermă cu 5 niveluri (2–6 parcele, randament ×1–×1,6) și 6 culturi, de la ferigi (2 min) la ospăț (8 h).
- Habitate cu 5 niveluri (2–6 locuri, plafon 500–2.800 aur, venit ×1–×1,6), lămpi +3% (maximum 5).
- Lumile se deschid în ordine (lumea N cere lumea N−1 și etapa 3 din regiunea ei), ~100.000 aur în total.
- Clădirile se îmbunătățesc cu timp de construcție (5 min – 8 h) și un singur constructor; clădirea lucrează la nivelul
  vechi până la final. Plasarea unei clădiri și deschiderea unei lumi rămân instantanee.
- Ouă: piață (foc, apă, pământ), poveste, final de regiune (garantat), patrule (1,5%/h), ligi (10/12/15%, pity 8).
  Ouăle peste limită se vând automat (cu mesaj), cele din poveste așteaptă. `releaseDino` eliberează un dinozaur
  (nu boși, nu echipa) pentru aur; familia rămâne în colecție. Colecția: 20 de familii + 10 boși.
- Toate tabelele, cu numerele botului de ritm: [BALANCE.md](BALANCE.md).

## Expediții

- Zece regiuni × cinci etape, în ordinea lumilor; fiecare etapă se face o singură dată. Nivelul cerut fiecărui membru
  e `10 + 4(r−1) + (s−1)`, echipa are 1 / 2 / 3 membri (regiunile 1–2 / 3–5 / 6–10), proviziile = mărimea echipei
  (regiunea 1 fără). Elementul recomandat dă +20% pe membru (maximum +60%). Etapa 5: ou al regiunii, 2 bilete, 3 💎.
- Patrule după etapa 3: 1 / 3 / 8 ore, echipă 1–3, o provizie; primele trei din zi plătesc ×1,5; 3 h și 8 h aduc
  bilete. Toate sunt pe plus.
- Portalul are 1 / 2 / 3 sloturi. Un dinozaur plecat nu produce aur până se întoarce.

## Arena

- Ligile urmează lumile; treptele sunt la nivelurile B, B+2, B+4 (B = 10 + 4·(ligă−1)), deci campionul arcan e la 50.
  Ucenic: 2 adversari; Veteran: 3 adulți; Campion: 2 adversari + boss. Poarta arenei L2 deschide ligile 6–10 și dă +25%.
- Echipa (1–3 dinozauri) luptă în ștafetă; luptele se joacă singure (planificatorul din `autoBattle.ts`), cu
  „Sari peste” și viteză dublă. Prognoza (`predictFight`) simulează toată ștafeta; o luptă pierdută la prognoză cere
  confirmare („Luptă oricum”).
- Stele după HP-ul întregii echipe: 3★ la ≥50% și nimeni căzut, 2★ la ≥20%. Două stele deschid treapta următoare.
- Bilete pe element, cumpărate cu aur (5 × nivelul de bază al ligii) sau câștigate; nu se refac în timp; remiza
  returnează biletul. Odihnă după luptă: 2 / 4 / 6 min la victorie, 10 min pentru un membru căzut, 20 min la înfrângere.
- Sezon săptămânal (luni–duminică, București): 5 / 15 / 30 de victorii.

## Diamante

- Se câștigă doar din joc (~220 pe lună): bun venit, finalul fiecărui capitol, regiuni terminate, praguri de stele,
  colecție, cufărul zilnic, felia de pe roată, sezonul de arenă. Se cheltuie doar pe timp: terminare acum
  `ceil(1,2·√minute)`, boost de aur, trezirea din odihnă, o rotire sau o misiune în plus. Pachetele plătite sunt
  „în curând”; schimbul diamante → resurse a fost scos.

## Povestea

Zece capitole: capitolul I (eclozare, fermă, juvenil, portal, regiunea focului) și câte un capitol pe lume (deschide
lumea, clădirile cerute, regiunea 5/5, o victorie în ligă). Ultimul capitol cere bossul arcan și colecția 30/30; oul
lui (cryptoraptor) vine acum cu bossul, nu după colecția completă. Capitolul curent e „nivelul” jucătorului din HUD.

## Interfața

- Două fonturi: `--font-display` (Pixelify Sans) pentru titluri, cifre, timere, prețuri, și `--font-body` (Barlow,
  latin-ext, self-hosted) pentru text. Scrollbar în culorile temei.
- Ferestrele au taburi și corp cu înălțime fixă (`min(640px, 100dvh − 60px)`); doar wiki-ul și zonele `data-scroll`
  pot face scroll. Componente comune: `Tabs`, `CompactCard`, `Pager`/`usePager`, `TeamPicker`, `PanelKit`.
- Panouri: Dinozauri (roster paginat + Statistici / Creștere / Habitat), Incubator, Fermă, Atelier (Rețete / Coadă /
  Upgrade), Magazin de diamante, Zilnic, Arenă (Luptă / Echipă / Poartă, chip-uri pentru ligi și trepte),
  Expediții (Etapă / Patrulă / Active).

## Verificare

- `npm.cmd test -- --configLoader runner` (toate testele, inclusiv `pacing.test.ts`), `npx.cmd tsc -p tsconfig.json`,
  `npm run build`.
- Botul de ritm (4 sesiuni pe zi): regiunile se termină în ziua 24, totul în ziua 30; cu 3 sesiuni pe zi, ziua 33.
- Scripturile `scripts/review-*.mjs` cer Playwright (`PLAYWRIGHT_MODULE`, altfel pachetul `playwright`) și Microsoft
  Edge. `review-scroll-ui.mjs` și `review-arena-bosses.mjs` folosesc ecranele actuale; o parte din celelalte verifică
  ecrane mai vechi și trebuie adaptate înainte de folosire.

## Artă și animații (istoric)

- Toate cele 20 de familii jucabile au animații pe trei vârste (PixelLab, direcția SE); cei 10 boși au animațiile lor
  (`AnimatedBoss`). Lumile folosesc peisajele largi `public/realms/worlds/{element}-wide-v1.png`.
- Detalii: [REALMS_ANIMATION_PIPELINE.md](REALMS_ANIMATION_PIPELINE.md),
  [ANIMATED_ARENA_BOSSES.md](ANIMATED_ARENA_BOSSES.md), [ASSET_BACKLOG.md](ASSET_BACKLOG.md).

## Ce lipsește

- Pachetele de diamante plătite (sunt „în curând”).
- Recompensele repetărilor din arenă depășesc puțin prețul biletului (mai ales la Campion), deci luptele repetate
  aduc ceva aur și hrană; sunt limitate de bilete și de odihna dinozaurilor (vezi BALANCE.md).
- Validarea comenzilor pe server: salvarea în cloud are încă încredere în client, dar o pază de bază (`0004_save_guard.sql`) refuză revizii mai vechi și creșteri absurde de aur/diamante.
