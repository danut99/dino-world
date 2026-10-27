# Echilibrul jocului (Save v6)

Ținta: un jucător obișnuit, fără diamante cheltuite, cu 3–4 sesiuni scurte pe zi, termină tot conținutul (povestea,
50 de etape, 90★, colecția 30/30, toate habitatele la nivelul 5) în ~30 de zile, cu deblocări constante.
Toate numerele de mai jos stau în `content.ts`, `game.ts`, `expeditionRules.ts`, `arenaTeams.ts` și `daily.ts`;
`pacing.test.ts` le verifică cu botul de ritm (`pacingBot.ts`).

## Botul de ritm

Botul folosește doar `command()` și ajutoarele publice (aceleași ca interfața). Joacă sesiuni de ~12 minute (câte o
trecere la 2 minute) la orele fixe din București și nu cheltuie diamante. La fiecare trecere: revendică tot ce e gata
(ouă, recolte, fabricări, expediții, povestea, zilnicele, roata), plantează cea mai lungă cultură care încape până la
sesiunea următoare, ține atelierul ocupat (provizii, plăci, blocuri, kituri, cristale de evoluție, lămpi), deschide
lumea următoare, pornește următorul upgrade pe constructor, hrănește (întâi echipa până la nivelul etapei următoare,
apoi un dinozaur cu avantaj de element pentru ligile fără 3★, apoi echipa până la 50; un boss legendar intră în echipă
când apare devreme), luptă în arenă doar unde prognoza dă mai multe stele (sau ouă lipsă din colecție) și trimite
etapa următoare și patrule în toate sloturile portalului.

### 4 sesiuni pe zi (08, 13, 18, 22): regiunile în ziua 24, totul în ziua 30

| Ziua | Regiuni (etape) | Lumi | ★   | Colecție | Niveluri habitate | Capitol | Aur    | Hrană  | Echipa   | 💎 câștigate |
| ---- | --------------- | ---- | --- | -------- | ----------------- | ------- | ------ | ------ | -------- | ------------ |
| 1    | 0 (4)           | 1    | 0   | 1        | 1                 | I       | 551    | 147    | 14       | 11           |
| 3    | 2 (11)          | 3    | 14  | 6        | 4                 | III     | 964    | 327    | 21/18/1  | 40           |
| 7    | 4 (22)          | 5    | 38  | 13       | 12                | V       | 10.241 | 270    | 28/27/23 | 76           |
| 14   | 6 (34)          | 7    | 62  | 20       | 23                | VII     | 13.389 | 181    | 38/38/38 | 126          |
| 21   | 9 (46)          | 10   | 83  | 28       | 38                | VIII    | 191    | 1.143  | 48/47/47 | 167          |
| 26   | 10 (50)         | 10   | 89  | 30       | 45                | gata    | 8.988  | 508    | 50/50/50 | 199          |
| 30   | 10 (50)         | 10   | 90  | 30       | 50                | gata    | 15.686 | 41.086 | 50/50/50 | 213          |

### 3 sesiuni pe zi (08, 14, 21): regiunile în ziua 29, totul în ziua 33

| Ziua | Regiuni (etape) | Lumi | ★   | Colecție | Niveluri habitate | Capitol | Echipa   | 💎  |
| ---- | --------------- | ---- | --- | -------- | ----------------- | ------- | -------- | --- |
| 1    | 0 (3)           | 1    | 0   | 1        | 1                 | I       | 13       | 11  |
| 7    | 3 (17)          | 4    | 29  | 10       | 7                 | IV      | 27/24/23 | 62  |
| 14   | 6 (30)          | 7    | 58  | 20       | 21                | VII     | 38/34/34 | 124 |
| 21   | 8 (40)          | 9    | 76  | 24       | 32                | IX      | 47/42/42 | 162 |
| 26   | 9 (47)          | 10   | 83  | 29       | 41                | X       | 48/47/47 | 187 |
| 33   | 10 (50)         | 10   | 90  | 30       | 50                | gata    | 50/50/50 | 219 |

Alte orare (aceeași logică): 4 sesiuni decalate (07:30…, 08:15…, 09–13–17–21) → ziua 30; 5 sesiuni → ziua 27;
alte 3 sesiuni (07–13–20, 09–15–22) → ziua 32–33; 2 sesiuni (08, 20) → ziua 39. Resursele nu scad niciodată sub zero.

La final se închid aproape deodată: lanțul de regiuni (timp + nivel), hrana pentru echipă și pentru dinozaurii cu
avantaj de element (ultimele stele: întuneric, lumină, arcan), aurul pentru habitate și constructorul.

### De unde vin aurul și hrana (4 sesiuni, pe săptămână, aur / hrană)

| Săptămâna | Colectare (habitate + fermă) | Expediții și patrule | Arenă        | Poveste     | Zilnic      | Hrănire    | Clădiri | Lumi   |
| --------- | ---------------------------- | -------------------- | ------------ | ----------- | ----------- | ---------- | ------- | ------ |
| 1         | 2,3k / 7,8k                  | 14,4k / 4,6k         | 16k / 6,4k   | 5,2k / 3,4k | 4k / 1,9k   | — / −23,3k | −21,6k  | −10,1k |
| 2         | 11,7k / 29,6k                | 37,1k / 12,1k        | 24,7k / 9,6k | 5,6k / 3,6k | 5,3k / 2,3k | — / −55,6k | −63,8k  | −20k   |
| 3         | 24,8k / 47k                  | 53,1k / 15,6k        | 27,1k / 13k  | 1,9k / 1,2k | 6,2k / 2,7k | — / −76,6k | −59,2k  | −70k   |
| 4         | 37,8k / 44,1k                | 66,7k / 27,1k        | 17,4k / 5,3k | 9,1k / 5,8k | 4,4k / 2,1k | — / −64,4k | −129k   | —      |

## Hrănire

`feedCost(L) = round(10 + 3L + 0,9L²)` hrană pentru un nivel (și pentru evoluția de la prag).

| Nivel | 1   | 9   | 24  | 49    |
| ----- | --- | --- | --- | ----- |
| Cost  | 14  | 110 | 600 | 2.318 |

Cumulat: juvenil (nivel 10) 482, adult (25) 5.551 plus un cristal de evoluție, nivelul 50 40.550. Pragurile: pui 1–9,
juvenil 10–24, adult 25–50. Cristalul de evoluție dă +1 nivel oriunde în afară de prag. Jocul nou pornește cu
1.000 aur și 400 hrană.

## Fermă

Trei culturi, toate deschise de la început; diferă doar cât timp lipsești. Salvările vechi cu ginkgo/carne devin
cicade, cu chihlimbar devin ospăț.

| Cultură | Timp  | Cost | Hrană (×randament) |
| ------- | ----- | ---- | ------------------ |
| Ferigi  | 5 min | 0    | 10                 |
| Cicade  | 1 h   | 5    | 60                 |
| Ospăț   | 8 h   | 25   | 350                |

| Nivel | Parcele | Randament | Upgrade                                      | Construcție |
| ----- | ------- | --------- | -------------------------------------------- | ----------- |
| 1     | 2       | ×1,00     | – (ferma: 100 aur)                           | –           |
| 2     | 3       | ×1,25     | 400                                          | 5 min       |
| 3     | 4       | ×1,50     | 1.500 + 6 plăci                              | 1 h         |
| 4     | 5       | ×2,00     | 5.000 + 12 plăci + 8 blocuri                 | 4 h         |
| 5     | 6       | ×2,50     | 12.000 + 20 plăci + 16 blocuri + 10 cristale | 8 h         |

## Habitate (câte unul în fiecare lume)

| Nivel | Locuri | Plafon aur | Venit | Upgrade           | Construcție |
| ----- | ------ | ---------- | ----- | ----------------- | ----------- |
| 1     | 2      | 500        | ×1,00 | –                 | –           |
| 2     | 3      | 900        | ×1,15 | 900 + 1 kit       | 15 min      |
| 3     | 4      | 1.400      | ×1,30 | 2.500 + 1 kit     | 1 h         |
| 4     | 5      | 2.000      | ×1,45 | 7.000 + 2 kituri  | 4 h         |
| 5     | 6      | 2.800      | ×1,60 | 14.000 + 2 kituri | 8 h         |

Venit de bază pe oră: pui 3, juvenil 8, adult 15; pământul ×1,25; fiecare lampă +3% (maximum 5). Offline se
acumulează cel mult 8 ore. Toate habitatele la nivelul 5: 244.000 aur și 60 de kituri.

## Lumi

Se deschid în ordine; lumea N cere lumea N−1 și etapa 3 din regiunea ei.

| Lume      | Aur    | Materiale                         |
| --------- | ------ | --------------------------------- |
| Foc       | –      | –                                 |
| Apă       | 600    | 15 lemn                           |
| Pământ    | 1.500  | 20 piatră, 4 plăci                |
| Natură    | 3.000  | 20 lemn, 20 fibre, 4 blocuri      |
| Gheață    | 5.000  | 20 piatră, 15 cristale, 6 plăci   |
| Fulger    | 8.000  | 20 cristale, 8 plăci, 8 blocuri   |
| Vânt      | 12.000 | 30 fibre, 10 plăci, 10 blocuri    |
| Întuneric | 17.000 | 30 cristale, 14 blocuri           |
| Lumină    | 23.000 | 35 cristale, 14 plăci, 14 blocuri |
| Arcan     | 30.000 | 45 cristale, 18 plăci, 18 blocuri |

## Clădiri

Plasare (instant): fermă 100, atelier 300, portal 500, poarta arenei 800, piață 1.000 aur. Upgrade-uri (un constructor):

| Clădire                                             | Nivel 2                                | Nivel 3                                            | Nivel 4                                           |
| --------------------------------------------------- | -------------------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| Incubator (1/2/3/4 ouă)                             | 800 + 4 plăci · 10 min                 | 3.000 + 8 plăci + 8 blocuri · 2 h                  | 8.000 + 14 plăci + 14 blocuri + 10 cristale · 6 h |
| Atelier (cozi 3/5/7, linii 1/2/3, viteză 1/0,8/0,6) | 1.200 + 6 plăci + 6 blocuri · 30 min   | 4.000 + 12 plăci + 12 blocuri + 10 cristale · 3 h  | –                                                 |
| Portal (1/2/3 sloturi)                              | 3.000 + 10 plăci + 10 blocuri · 2 h    | 10.000 + 20 plăci + 20 blocuri + 20 cristale · 8 h | –                                                 |
| Poarta arenei (L2: ligile 6–10, +25%)               | 6.000 + 12 blocuri + 20 cristale · 4 h | –                                                  | –                                                 |

Rețete: provizii (2 lemn, 1 fibră, 30 hrană, 3 min), 2 plăci (10 lemn, 5 min), 2 blocuri (10 piatră, 5 min), kit de
habitat (4 plăci, 4 blocuri, 6 fibre, 20 min), cristal de evoluție (8 cristale, 6 fibre, 30 min), lampă (4 blocuri,
6 cristale, 20 min).

Ouă: piață foc 300, apă 600, pământ 1.000 (se vând înapoi cu 30%); ouăle câștigate se vând cu 250 / 400 / 600 după
raritate. Incubare: piață 10 min, poveste 20 min, câștigat 1 h (×1,5 rar, ×2 epic), boss 6 h. Eliberare: pui 50,
juvenil 200, adult 600 aur (×1,5 rar, ×2 epic).

## Regiuni

Nivelul cerut fiecărui membru: `10 + 4(r−1) + (s−1)`. Recompensa unei etape: aur = minute × (2 + 0,5r),
hrană = minute, materiale = 0,15 × minute (perechea regiunii), 1 bilet al elementului (etapa 5: 2 bilete, 3 💎 și un
ou garantat). Elementul recomandat (cel care bate regiunea): +20% pe membru, maximum +60%.

| #   | Regiune (lume)                | Etape (minute)          | Niveluri | Echipă | Provizii |
| --- | ----------------------------- | ----------------------- | -------- | ------ | -------- |
| 1   | Pasul de jar (foc)            | 5, 10, 15, 20, 30       | 10–14    | 1      | 0        |
| 2   | Reciful de safir (apă)        | 30, 45, 60, 90, 120     | 14–18    | 1      | 1        |
| 3   | Ruinele canionului (pământ)   | 90, 120, 150, 180, 240  | 18–22    | 2      | 2        |
| 4   | Poiana ferigilor (natură)     | 120, 150, 180, 240, 300 | 22–26    | 2      | 2        |
| 5   | Coroana de gheață (gheață)    | 150, 180, 240, 300, 360 | 26–30    | 2      | 2        |
| 6   | Turnul furtunii (fulger)      | 180, 240, 300, 360, 420 | 30–34    | 3      | 3        |
| 7   | Arcurile cerului (vânt)       | 240, 300, 360, 420, 480 | 34–38    | 3      | 3        |
| 8   | Pădurea șoaptelor (întuneric) | 270, 330, 390, 450, 510 | 38–42    | 3      | 3        |
| 9   | Templul zorilor (lumină)      | 300, 360, 420, 480, 540 | 42–46    | 3      | 3        |
| 10  | Sanctuarul runelor (arcan)    | 360, 420, 480, 540, 600 | 46–50    | 3      | 3        |

În total ~220 de ore de etape. Etapele nu se repetă.

## Patrule

După etapa 3 a regiunii; nivel minim = nivelul primei etape; 1 provizie.

- Pe oră: aur `20 + 8r`, hrană `8 + 4r`, materiale `3 + r`; lungime 1 h / 3 h / 8 h = ×1 / ×2,85 / ×6,8.
- Echipă 1 / 2 / 3 = ×1 / ×1,8 / ×2,5; elementul recomandat ca la etape. Primele 3 patrule revendicate în zi: ×1,5.
- Bilete: 0 / 1 / 2; șansă de ou 1,5% pe oră.

## Arenă

| Ligă      | Niveluri (Ucenic / Veteran / Campion) | Prima victorie, aur (T1 / T2 / T3) | Bilet |
| --------- | ------------------------------------- | ---------------------------------- | ----- |
| Foc       | 10 / 12 / 14                          | 200 / 360 / 560                    | 50    |
| Apă       | 14 / 16 / 18                          | 280 / 480 / 720                    | 70    |
| Pământ    | 18 / 20 / 22                          | 360 / 600 / 880                    | 90    |
| Natură    | 22 / 24 / 26                          | 440 / 720 / 1.040                  | 110   |
| Gheață    | 26 / 28 / 30                          | 520 / 840 / 1.200                  | 130   |
| Fulger    | 30 / 32 / 34                          | 600 / 960 / 1.360                  | 150   |
| Vânt      | 34 / 36 / 38                          | 680 / 1.080 / 1.520                | 170   |
| Întuneric | 38 / 40 / 42                          | 760 / 1.200 / 1.680                | 190   |
| Lumină    | 42 / 44 / 46                          | 840 / 1.320 / 1.840                | 210   |
| Arcan     | 46 / 48 / 50                          | 920 / 1.440 / 2.000                | 230   |

- Prima victorie: aur `20 · nivel · (1 + 0,5t)`, hrană `8 · nivel · (1 + 0,5t)` (t = 0/1/2), plus materialele ligii;
  ×1 / ×1,1 / ×1,2 după mărimea echipei, +25% cu Poarta L2. Repetare: 25%.
- Adversari: Ucenic 2 (×0,85), Veteran 3 adulți (×1,08), Campion 2 (×0,85) + boss (HP ×1,2, putere ×1,05, legendar).
  Ținte (`arenaBalance.test.ts`): trio neutru la nivel câștigă T1 > 95%, T2 45–75%, T3 < 35%; cu avantaj T3 > 85%.
- Element: avantaj ×1,3 daune date / ×0,8 primite (dezavantaj invers); `LEVEL_GAP` ±4% pe nivel, maximum 10 niveluri.
- Ouă: ligile fără piață (natură…arcan) 10 / 12 / 15% pe treaptă, pity 8; 75% familie nouă. Bossul dă oul lui o dată.
- Bilete: 5 × nivelul de bază al ligii, doar cu aur; se câștigă din etape (1, finalul 2), patrule 3 h / 8 h (1 / 2),
  roata (2) și sezon (3). Remiza returnează biletul.
- Odihnă: victorie 2 / 4 / 6 min (T1/T2/T3), membru căzut 10 min, înfrângere 20 min. Trezire: 3 💎 / echipa 6 💎.
- Sezon (săptămâna din București): 5 victorii → 500 aur + 3 💎; 15 → 5 💎 + cristal de evoluție + 3 bilete;
  30 → 1.500 aur + kit.
- Praguri de stele: 5, 12, 20, 30, 42, 55, 70, 90 ★ (aur 300 … 10.000, 40 💎 în total).
- Notă: repetările plătesc ceva peste prețul biletului (mai ales la Campion: 25% din prima victorie ×1,2 ×1,25), deci
  luptele repetate aduc puțin aur și hrană. Sunt limitate de bilete și de odihnă (2–6 min), nu sunt resurse în timp zero.

## Diamante

| Surse (≈ 220 / lună)       |                       | Cheltuieli (doar timp) |                                                      |
| -------------------------- | --------------------- | ---------------------- | ---------------------------------------------------- |
| Bun venit                  | 10                    | Terminare acum         | `ceil(1,2·√minute)`: 5 min 3, 1 h 10, 4 h 19, 8 h 27 |
| Finalul fiecărui capitol   | 10 × 5                | Boost de aur ×2        | 1 h 15, 4 h 45                                       |
| Etapa 5 a fiecărei regiuni | 10 × 3                | Trezire din odihnă     | 3 (echipa 6)                                         |
| Praguri de stele           | 40                    | Rotire în plus         | 8                                                    |
| Colecție (5…30)            | 30                    | Misiune în plus        | 3                                                    |
| Cufărul zilnic             | 1 / zi                |                        |                                                      |
| Roata (felia de 3 💎, 3%)  | ~3 / lună             |                        |                                                      |
| Sezonul de arenă           | până la 8 / săptămână |                        |                                                      |

Botul (fără nicio cheltuială) ajunge la ~213 💎 în ziua 30 (4 sesiuni) și ~219 în ziua 33 (3 sesiuni).

## Ce a schimbat botul (față de valorile de pornire din plan)

| Valoare                                | Înainte                           | Acum                                  | De ce                                                                                 |
| -------------------------------------- | --------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------- |
| `feedCost(L)`                          | `12 + 3L + 0,5L²` (1→50: 24.475)  | `10 + 3L + 0,9L²` (1→50: 40.550)      | hrana era din belșug: echipa ajungea la 50 în ziua 11 și totul se termina în ~17 zile |
| Hrana culturilor                       | 4 / 22 / 70 / 120 / 220 / 360     | 3 / 15 / 45 / 80 / 140 / 280          | ferma la L5 dădea ~10k hrană pe zi                                                    |
| Patrule pe oră                         | aur 30 + 15r, hrană 10 + 5r       | aur 20 + 8r, hrană 8 + 4r             | patrulele erau cea mai mare sursă de aur și hrană                                     |
| Habitat L4 / L5                        | 6.000 / 12.000                    | 7.000 / 14.000                        | habitatele se terminau prea devreme                                                   |
| Lumi vânt / întuneric / lumină / arcan | 11.000 / 15.000 / 20.000 / 26.000 | 12.000 / 17.000 / 23.000 / 30.000     | aurul de final de joc                                                                 |
| Etape regiunile 3–8                    | 60–180 … 240–480 min              | 90–240 … 270–510 min (tabelul de sus) | lanțul de regiuni se termina înainte de ziua 22                                       |
| Hrana la start                         | 300                               | 400                                   | ca primul dinozaur să ajungă juvenil cu primele două premii din poveste               |
