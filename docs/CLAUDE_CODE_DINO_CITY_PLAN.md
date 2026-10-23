# Dino Realms — specificație de produs și plan de implementare pentru Claude Code

Versiune: 1.1 · 17 octombrie 2026 · Limba produsului inițial: română, cu suport pentru engleză.

## 1. Instrucțiunea de pornire pentru Claude Code

Construiește de la zero un joc 2D pixel art de colecționat, crescut și evoluat dinozauri, cu insule construibile și lupte tactice pe ture. Nume de lucru: Dino Realms. Referința de gen este Dragon City: colectare → eclozare → habitat → hrană → evoluție → luptă → deblocarea altor insule. Creează o identitate vizuală, interfață, personaje și conținut originale.

Citește întregul document înainte de implementare. Începe cu etapa P0, apoi realizează P1 ca traseu complet jucabil. Nu implementa simultan toate variantele și toate sistemele. Păstrează specificațiile și progresul în repo. Nu confunda un demo cu dreptunghiuri, imagini statice sau animații simulate prin balansarea imaginii cu produsul final.

Alegerile de mai jos sunt propuneri concrete de implementare, nu pretinse decizii istorice ale utilizatorului. Valorile economice și de echilibrare sunt valori inițiale de test, păstrate în configurație.

### Cerințe ferme ale utilizatorului

- Tot jocul folosește pixel art: dinozauri, ouă, clădiri, insule, efecte și interfață.
- Pixel art detaliat și personaje suficient de mari pentru a le citi expresiile; nu miniaturi de 16×16 pixeli.
- Cinci specii inițiale, dintre care T-Rex, Raptor și Triceratops sunt obligatorii.
- Aceeași specie există în variante elementale cu aspect propriu.
- Elementul determină rolul. Nu există selecție sau loterie de clase în interiorul aceluiași element.
- Focul este atacator. Pământul are un rol pasiv.
- Trei stadii: copil, juvenil, adult. Identitatea rămâne recognoscibilă între stadii.
- Copil: idle și mers. Juvenil: idle, mers, atac/acțiune, apărare, lovit, moarte. Adult: toate acestea plus ultimată specială.
- Insulele sunt spațioase. Clădirile cumpărate și amplasate de jucător sunt obiecte separate de fundal.

### Decizii propuse aici

- Ultimele două specii: Ankylosaurus și Brachiosaurus.
- Web-first, desktop și mobil landscape, joc single-player PvE la lansare.
- Lupte 3 contra 3, fiecare echipă având până la trei dinozauri simultan activi.
- Zece elemente în catalogul complet; doar cinci combinații specie–element în primul MVP.
- Animații pe cadre, nu personaj final animat prin rotirea unor decupaje Spine.
- Fără permadeath: animația death reprezintă înfrângerea din luptă.

## 2. Regula centrală: specie × element × stadiu

Specia determină anatomia, mersul, silueta și mici diferențe de statistici. Elementul determină rolul, abilitățile, materialele, paleta, efectele, oul și habitatul. Stadiul determină proporțiile, complexitatea designului și animațiile disponibile.

Exemple: T-Rex de foc = atacator; Triceratops de foc = atacator; Brachiosaurus de foc = atacator. Un T-Rex de pământ este protector pasiv, chiar dacă specia este asociată intuitiv cu agresivitatea. Nicio specie nu anulează rolul elementului.

Identificator de variantă: `trex_fire`. Identificator vizual: `trex_fire_adult`. Instanță deținută: UUID separat. Rolul este derivat din definiția elementului; nu se stochează ca alegere mutabilă pe instanță.

Evoluția schimbă stadiul, nu specia sau elementul. Nu există reroll de rol, multiclasă, elemente duble sau schimbare de element în v1.

## 3. Cele cinci specii

| Specie / ID | Semne permanente între evoluții | Mișcare | Diferență statistică față de medie |
| --- | --- | --- | --- |
| T-Rex / trex | cap lat, bot scurt, brațe mici, coadă grea | biped, pași grei | putere ×1,10; viteză ×0,90 |
| Raptor / raptor | bot îngust, creastă mică, coadă subțire, gheara distinctă | biped, sprint elastic | viteză ×1,15; viață ×0,90 |
| Triceratops / triceratops | trei coarne, guler osos, cap triunghiular | patruped, pas compact | viață ×1,10; viteză ×0,90 |
| Ankylosaurus / ankylosaurus | carapace segmentată, corp jos, măciucă la coadă | patruped, mers greu | apărare ×1,15; viteză ×0,85 |
| Brachiosaurus / brachiosaurus | gât lung, cap mic, umeri înalți, coadă lungă | patruped, pas lent | viață ×1,15; putere ×0,90 |

Toate sunt personaje fantasy stilizate, cu ținute și echipament propriu. La cererea actualizată a utilizatorului, membrele anterioare pot fi stilizate ca brațe care țin arme sau instrumente. Stabilește poziția de bază per specie în model sheet; nu forța aceeași anatomie sau același mers asupra tuturor. Descrierile patrupedelor din tabel indică inspirația biologică, nu interzic o postură de personaj antropomorf. Modificatorii speciei nu dau abilități suplimentare și nu creează o a doua clasă.

## 4. Elemente și roluri fixe

| Element / ID | Rol unic | Acțiune de bază | Skill juvenil | Ultimată adult | Identitate vizuală |
| --- | --- | --- | --- | --- | --- |
| Foc / fire | atacator ofensiv | lovitură de jar | flacără + arsură | Erupție: damage tuturor inamicilor | cărbune, fisuri portocalii, vârfuri de lavă |
| Apă / water | vindecător | vindecare mică aliat | vindecare + elimină un debuff | Maree: vindecare de echipă | turcoaz, aripioare, perle, valuri |
| Pământ / earth | protector pasiv și producător | Fortifică: scut aliat | scut de echipă | Bastion: scut mare + reducere damage | ocru, plăci de piatră, cristale minerale |
| Natură / nature | suport de regenerare | regenerare aliat | regenerare de echipă | Înflorire: regenerare puternică | verde, frunze, liane, flori discrete |
| Gheață / ice | control | fragment de gheață | încetinire | Iarnă: damage mic + îngheț | alb-albastru, cristale, brumă |
| Fulger / lightning | atacator exploziv | șoc electric | damage mare pe o țintă | Furtună: trei lovituri | galben-violet, marcaje zigzag |
| Vânt / wind | suport de viteză | rafală slabă | accelerează echipa | Curent ascendent: viteză + scut | mentă, pene stilizate, panglici |
| Întuneric / dark | slăbește adversarii | impuls de umbră | reduce apărarea | Eclipsă: slăbește toți inamicii | indigo, mov, rune și fum pixelat |
| Lumină / light | suport de purificare | scut luminos | elimină debuffuri | Zori: purifică și protejează echipa | crem-auriu, cristale, raze |
| Arcan / arcane | control al abilităților | proiectil arcan | sigilează skillul și ultimata țintei | Sigiliu: damage moderat + sigilare | violet-cyan, rune geometrice |

Pământul nu produce damage direct, damage reflectat sau debuff ofensiv. În luptă, butonul de bază este „Fortifică”, nu „Atacă”. Animația tehnică `attack` există pentru contractul comun de asset, dar arată plantarea picioarelor și ridicarea unui scut. Este o acțiune de sprijin. În habitat, pământul produce aur ×1,25; celelalte elemente ×1. Dacă ulterior „pasiv” trebuie să însemne exclusiv economic, aceasta este o schimbare explicită de design, nu ceva de presupus în cod.

Apă = vindecare imediată; natură = vindecare în timp; lumină = purificare/scut. Foc = presiune susținută; fulger = lovitură concentrată. Aceste distincții trebuie să fie vizibile în tooltipuri și animații.

La nivelul aceluiași element, abilitățile au aceleași reguli pentru toate speciile, dar reprezentații diferite: T-Rex de foc lovește cu sabia înflăcărată, Raptorul de foc execută o combinație cu două pumnale, Ankylosaurus de foc lovește cu ciocanul. Raptorul de vânt folosește o sabie și gesturi care sprijină echipa. Animarea diferită nu modifică pe ascuns mecanica.

## 5. Catalog și ordinea producției

Catalog complet: 5 specii × 10 elemente = 50 variante; × 3 stadii = 150 modele vizuale. Acest catalog este ținta extinsă, nu livrabilul primei etape.

| Livrare | Variante complet realizate |
| --- | --- |
| Prototip complet P1 | T-Rex de foc, toate cele trei stadii |
| MVP P2–P4 | T-Rex foc; Raptor vânt; Triceratops pământ; Ankylosaurus gheață; Brachiosaurus apă |
| Extindere A | toate cele cinci specii × foc/apă/pământ/gheață/vânt = 25 variante |
| Extindere B | natură, fulger, întuneric, lumină, arcan pentru toate speciile = 50 variante |

Jucătorul pornește cu oul T-Rex de foc. Primele misiuni oferă acces determinist la celelalte patru variante MVP. Catalogul poate descrie variante neimplementate, dar acestea au `releaseStatus: planned`, nu apar drept cumpărabile și nu folosesc imaginea altei variante drept asset final.

## 6. Etapele de creștere

| Stadiu | Nivel | Funcție | Aspect |
| --- | --- | --- | --- |
| Copil / baby | 1–9 | habitat, mers, idle, hrană; nu intră în luptă | cap relativ mare, coarne mici, semne elementale discrete |
| Juvenil / juvenile | 10–24 | luptă, skill elemental, apărare | membre dezvoltate, semne elementale clare |
| Adult / adult | 25–50 | luptă completă și ultimată | siluetă matură, semne ornamentale și efecte mai bogate |

Evoluția se confirmă prin buton după atingerea pragului; nivelul rămâne blocat la 9, respectiv 24, până la evoluție. Prima evoluție din tutorial consumă doar hrană deja oferită. Mai târziu se pot adăuga esențe, fără blocarea accesului inițial la luptă.

Păstrează minimum trei repere identice: forma botului, forma/patternul coarnelor sau crestei, distribuția petelor. Păstrează aceeași familie cromatică elementală și forma cozii. Adultul nu este doar copilul mărit, iar copilul nu este adultul micșorat.

Ecranul de evoluție prezintă înainte/după, statistici și abilități deblocate. Animația de tranziție poate fi un efect comun de lumină pixelată; nu este o animație locomotorie suplimentară per variantă.

## 7. Direcție pixel art și dimensiuni

Pixel art desenat deliberat, cu grupuri coerente de pixeli și forme lizibile. Nu se acceptă o ilustrație HD trecută printr-un filtru de pixelare ca asset final. Identitatea este fantasy cartoon, nu realism și nu stil sumbru horror.

- Cadru logic de personaj: 192×192 px pentru toate stadiile, transparent.
- Înălțime/întindere orientativă vizibilă: copil 55–85 px, juvenil 90–130 px, adult 125–170 px; coada și gâtul trebuie să încapă fără tăiere.
- Efectele de ultimată sunt straturi separate de maximum 384×384 px; nu măresc fiecare cadru al corpului.
- Corpul folosește aceeași densitate de pixeli pe insulă și în luptă. Pe ecran se afișează la scară întreagă, de exemplu 2× sau 3×.
- Contur exterior 1–2 pixeli sursă, umbre în trepte, fără blur și fără anti-alias automat.
- Paletă recomandată: 24–40 culori per variantă; palete comune pentru materiale și UI. Lumina vine din stânga sus.
- Ouă: 48×64 px; iconuri resurse: 24×24 sau 32×32 px.
- Insulă: perspectivă izometrică 2:1, celulă de teren 64×32 px. Clădirile pot avea sprite-uri înalte, dar footprintul este măsurat în celule.
- Umbra la sol este un sprite separat; nu este pictată în fiecare cadru de dinozaur.
- UI: panouri și iconuri pixel art; text foarte lizibil, inclusiv diacritice. Nu sacrifica citirea pe mobil pentru un font decorativ.

Camera folosește zoomuri discrete cu scară întreagă. Redarea folosește nearest-neighbor și coordonate finale rotunjite la pixeli. Pozițiile simulării pot fi fracționare. Nu promite pixel-perfect pe orice dimensiune CSS: testează raportul de pixeli al dispozitivului, folosește letterboxing când este necesar și evită scalarea fracționară a suprafeței de joc.

## 8. Animații: contract și criterii de calitate

Animațiile finale sunt frame-by-frame. Surse editabile recomandate: Aseprite. Livrare runtime: atlas PNG + JSON cu durate, taguri și pivoturi. Claude construiește un viewer de asseturi; nu declară o animație perfectă doar fiindcă poate reda cadrele.

| Clip | Copil | Juvenil | Adult | Cadre inițiale | FPS orientativ | Loop |
| --- | --- | --- | --- | --- | --- | --- |
| idle | da | da | da | 8 | 8 | da |
| walk | da | da | da | 12 | 12 | da |
| attack | nu | da | da | 12 | 12 | nu |
| defend | nu | da | da | 6 | 10 | nu; ține postura finală |
| hurt | nu | da | da | 4 | 12 | nu |
| death | nu | da | da | 10 | 10 | nu; ține ultimul cadru |
| ultimate | nu | nu | da | 20 | 12 | nu |

`hurt` este numele tehnic pentru damage taken. Skillul juvenil poate utiliza clipul attack împreună cu un efect separat. Heal/scut/sigilare păstrează numele tehnic attack, dar au gestica rolului, nu lovituri care fac damage imaginar.

Pentru insulă: desenează două vederi reale pentru idle și walk: SE, respectiv NE. Oglindirea lor dă SW și NW. Pentru luptă: SE/SW. Designul v1 evită text pe costume și asimetrii care fac oglindirea invalidă. Dacă se adaugă astfel de elemente, se desenează separat direcția opusă.

Cadrele nu se generează independent, fiecare din alt prompt. Se aprobă întâi model sheet-ul specie–element și cele trei evoluții; apoi key poses, apoi in-between-uri, apoi curățarea pixelilor și exportul. Generarea AI poate ajuta la concept, dar nu garantează continuitate sau animație gata de producție.

### Volumul real

Pentru o vedere: copil 20 cadre; juvenil 52; adult 72 = 144 cadre per variantă. A doua vedere de idle+walk adaugă 20 × 3 = 60. Total de referință: 204 cadre corp per variantă, fără efecte. Cinci variante MVP: 1.020 cadre. Catalog complet: 10.200 cadre. Oglindirile nu dublează cadrele desenate. Ajustările de timing pot schimba aceste totaluri.

La 192×192 RGBA, 204 cadre ocupă aproximativ 28,7 MiB de pixeli necomprimați înainte de packing. Nu încărca toate cele 50 de variante și toate stadiile simultan. Exportă atlase separate per variantă/stadiu, pagini cel mult 2048×2048 pentru ținta inițială; încarcă doar activele necesare scenei și eliberează-le la schimbare.

### QA obligatoriu

- Pivotul de contact cu solul rămâne stabil, fără salturi între cadre.
- Picioarele nu alunecă în faza de sprijin; viteza de deplasare este legată de lungimea pasului și de durata ciclului.
- Coarnele, dinții, petele, numărul de degete și accesoriile nu apar/dispar accidental.
- Idle are respirație discretă și mișcare secundară; nu doar scalarea întregului sprite.
- Attack are anticipație, contact și revenire; evenimentul impact este definit în metadata.
- Defend are intrare, postură și ieșire gestionată de controller. Hurt nu rupe permanent postura.
- Death se redă o singură dată și nu revine în idle în cadrul luptei.
- Ultimata are pregătire, efect și revenire; camera shake poate fi dezactivat.
- Viewer: play/pause, frame step, fundaluri deschis/închis, pivot, bounding box, compararea stadiilor, 1×/2×/3×, verificare de loop.

Echipamentele care trebuie să se miște independent folosesc sockets per cadru. Nu începe cu sistem universal de costume interschimbabile: crește mult costul de animație. Obiectele de inventar, clădirile, ouăle și VFX rămân separate.

## 9. Insule și amplasare

Insula principală: refugiu neutru, verde, cu spațiu liber pentru clădiri. Ulterior se deblochează zece tărâmuri elementale, fiecare cu un șablon artizanal de teren și decorațiuni distincte. „Generate” în acest plan înseamnă asseturi create și hărți asamblate controlat; nu imagini generate în timpul sesiunii și nu hărți procedurale arbitrare.

| Tărâm | Sol și margini | Elemente decorative separate |
| --- | --- | --- |
| Foc | bazalt, lavă pe margini | cratere, cristale de jar |
| Apă | plaje și lagune | corali, cascade, stânci |
| Pământ | platouri de piatră și nisip | bolovani, minereuri |
| Natură | pădure luxuriantă | arbori, rădăcini, ciuperci |
| Gheață | zăpadă și stânci înghețate | cristale, brazi |
| Fulger | platou furtunos | cristale conductive, nori |
| Vânt | pajiști înalte | arcuri de piatră, mori decorative |
| Întuneric | obsidian violet, relief clar | rune, arbori nocturni, ciuperci luminoase |
| Lumină | piatră albă, vegetație aurie | cristale luminoase, arcade |
| Arcan | rocă violetă și rune | monoliți, fragmente plutitoare |

Insula întunericului trebuie să fie lizibilă; nu un fundal aproape negru în care dispar personajele.

Grid logic inițial: 32×32 celule, cu mask de insulă, zone construibile și zone navigabile. Zona de start deblocată: aproximativ 12×12 celule utile, extinsă prin loturi. Rezervă minimum 60% din suprafața utilă pentru construcții și deplasare, nu decorațiuni imposibil de mutat.

Proiecție: screenX=(gridX−gridY)×32; screenY=(gridX+gridY)×16. Implementează și inversa pentru selecție. Ordinea de desen se bazează pe punctul de contact la sol, cu politici distincte pentru obiecte înalte; nu pe colțul sprite-ului.

Mod construcție: alegere → fantomă verde/roșie → verificare footprint, bani, zonă, acces → confirmare → debit și plasare atomică. Anulare fără cost. Mutarea unei clădiri existente este gratuită. Două orientări numai dacă există asset pentru ambele; nu roti liber un sprite izometric.

Habitatele includ o zonă interioară de plimbare. Dinozaurii circulă în această zonă prin pathfinding; nu blochează amplasarea ca obstacole permanente. Verifică accesul la clădirile funcționale. Traseele și decorațiunile sunt straturi independente.

## 10. Clădiri și economie inițială

| Clădire | Footprint | Funcție |
| --- | --- | --- |
| Cuib de eclozare | 3×3 | o coadă de incubare inițial |
| Fermă | 3×3 | produce hrană |
| Habitat elemental | 4×4 | găzduiește inițial 2 dinozauri, capacitate aur |
| Sanctuar de evoluție | 3×3 | confirmă evoluția |
| Portal de expediții | 3×3 | campanie PvE |
| Piață | 3×3 | clădiri, ouă deblocate, decorațiuni |
| Cuib de reproducere, P5 | 4×4 | produce ouă după reguli explicite |

Aur: venit pasiv și recompense; hrană: creștere; esențe: recompense și progresie târzie. Fără premium currency, reclame sau achiziții reale în MVP. Craftingul folosește suplimentar lemn, piatră, fibre și cristale, în inventarul de materiale descris în secțiunea 20.

Config tutorial: 1.200 aur, 300 hrană, cuib și habitat de foc oferite, un ou de foc. Incubare tutorial 30 secunde; celelalte ouă MVP 5 minute. Fermă: cost 100 aur, ciclu gratuit de 60 secunde → 25 hrană. Prima fermă nu are întreținere, pentru a evita blocarea economică.

Cost de hrănire pentru un nivel: `10 + 5 × (nivelCurent−1)` hrană. Creșterea 1→10 consumă 270 hrană. Pentru a putea evolua, copilul ajunge la nivelul 9, apoi comanda evolve consumă hrana pentru tranziția 9→10 și setează atomic nivel 10 + juvenile. Analog, 24→25 setează adult. Copiii se plimbă imediat după eclozare. Tutorialul aduce primul juvenil în câteva minute; evoluția acestuia este gratuită.

Producție individuală de bază: copil 10 aur/oră; juvenil 30; adult 60; multiplicatorul pământului se aplică separat. Capacitate habitat inițială 600 aur. Recoltarea este explicită, iar plinul oprește acumularea. Upgradeurile capacității, nu interogarea UI, modifică starea economiei.

Offline: acumulează `min(timpScurs, 8 ore)` și limitează la capacitatea rămasă. Stochează timpi absoluți. Colectarea repetată cu același commandId nu dublează recompensa. Ceasul local este acceptabil doar pentru prototip; versiunea cu economie online validează timpul și recompensele pe server.

Niciun nou venit nu depinde de câștigarea unei lupte cu un copil. Un dinozaur învins nu dispare din colecție și se reface după luptă în MVP.

## 11. Ouă, colecție și reproducere

Oul păstrează elementul prin paletă și simbol, iar specia printr-un mic motiv: dinte, gheară, trei coarne, carapace sau frunză alungită pentru gât lung. Datele oului includ specia și elementul înainte de incubare; eclozarea nu randomizează clasa.

Status ou: inventory → incubating → ready → hatched. Eclozarea creează exact o instanță, prin comandă idempotentă. Dacă habitatul este plin, oul rămâne ready; nu pierde dinozaurul și nu permite supraîncărcare ascunsă.

Colecția permite filtre pe specie, element, stadiu și deținut/nedescoperit. Dublurile sunt permise. Nu adăuga rarități aleatoare care multiplică din nou catalogul în MVP.

P5, reproducere: doi adulți disponibili, un singur proces activ per cuib. Aceeași specie → specia respectivă; specii diferite → 50/50 între speciile părinților. Același element → elementul respectiv; elemente diferite → 50/50 între elementele părinților. Selecțiile sunt independente, deci pot rezulta patru combinații. Nu există hibrid biologic nou. Deblochează reproducerea abia când toate combinațiile posibile ale părinților disponibili sunt implementate; nu afișa probabilități false pentru a ascunde variante lipsă. Părinții nu se consumă.

## 12. Luptă tactică

Campanie PvE, echipe de maximum 3, toate unitățile prezente. Copiii nu pot fi selectați. În tutorial sunt permise lupte 1v1; trecerea la 3v3 este graduală.

La începutul rundei, sortează unitățile vii după viteză; egalitățile folosesc tie-break determinist din seedul luptei. O acțiune per unitate per rundă. Viteza nu acordă ture suplimentare. Buffurile de viteză afectează ordinea rundei următoare.

Acțiuni: basic, elemental skill, defend; adultul are și ultimate. Skillul are cooldown 3 ture proprii. După folosire nu poate fi reutilizat în următoarele două ture; revine la a treia. Defend reduce damage primit cu 40% până la începutul turei proprii următoare. Nu adaugă scut permanent.

Ultimata cere 100 energie; începe la 0; basic acordă 25, skill 20, defend 15; energia se captează la 100. Ultimata consumă 100 și nu generează energie. Acțiunile de suport generează energie ca cele de atac; pământul nu rămâne blocat fără ultimată. Fără energie pentru damage primit în v1, pentru a evita bucle de exploatare.

Statistici: HP, power, defense, speed. Bază juvenil nivel 10: 220 HP, 40 power, 20 defense, 25 speed. Aplică modificatorii speciei; bonusuri elementale din config, inițial 1. Pentru nivel L, multiplicatorul HP/power/defense este 1 + 0,05 × (L−10), aplicat bazei de nivel 10; este liniar, nu exponențial. Statistici de luptă se calculează numai pentru L≥10. Adultul primește ×1,15 HP/power/defense; speed nu crește prin nivel. Rotunjește o singură dată la final.

Damage inițial: `max(1, floor(power × coefficient × 100/(100+defense) × affinity × guard))`. Damage non-critic, fără evasion și fără variație aleatoare în MVP. Scutul absoarbe damage înaintea HP. Guard este 0,6 în defend, altfel 1. Scutul total este limitat la 50% maxHP și expiră după două începuturi de tură ale proprietarului. Heal nu depășește maxHP.

Coeficienți inițiali: basic ofensiv 1,0; basic gheață/vânt/întuneric/arcan 0,8; basic apă vindecă 0,6×power; basic natură aplică regen 0,3×power timp de două ture; basic pământ/lumină oferă scut 0,8×power. Skills și ultimate se definesc ca liste de efecte, fără ramificații pe nume de dinozaur în motor.

Pentru primele cinci elemente, lanțul de avantaj este foc → gheață → vânt → pământ → apă → foc. Săgeata indică damage ×1,25, iar sensul invers ×0,8; celelalte perechi ×1. Matrice explicită în date, fără avantaj asupra propriei specii. Pământul nu are atac direct, deci avantajul său ofensiv rămâne nefolosit; afinitatea contează la damage primit, nu la scut. În MVP toate combinațiile cu celelalte elemente au ×1 până la balansarea extinderii. UI arată valorile reale, fără a sugera o simetrie inexistentă.

Statusuri inițiale: burn = 5% maxHP la începutul a două ture, cel mult un stack; regen = cantitate fixată la aplicare, două ture; slow = speed ×0,8 pentru următoarele două runde; haste = ×1,2; exposed = defense ×0,8; freeze = sare o acțiune, apoi imunitate la freeze pentru o tură proprie; silence = skill și ultimate indisponibile o tură proprie, basic/defend permise. Reaplicarea înlocuiește cu efectul mai puternic și reîmprospătează durata, nu creează stackuri nelimitate.

Ordinea rezolvării: efecte de început de tură → moarte dacă HP=0 → expirări/cooldownuri → verificarea controlului → comandă validată → efecte asupra țintelor în ordinea ID stabilă → energy → verificare final de luptă. Statusurile nou aplicate nu pierd durată în aceeași rezolvare. Documentează și testează limitele temporale. Burn și regen se procesează într-o ordine fixă, burn înainte de regen; o unitate moartă nu este vindecată înapoi automat.

Un motor pur calculează starea și evenimentele; stratul vizual le redă cu impact sincronizat. Frame rate-ul sau lipsa unui frame nu schimbă rezultatul luptei. Blocarea temporară a animației are watchdog și nu lasă partida agățată.

Toți inamicii învinși → victorie; toți aliații învinși → înfrângere. La 30 runde, expediția se termină ca remiză fără recompensa de victorie. Tutorialul are adversari și recompense fixe. AI folosește numai acțiuni valide, prioritizează supraviețuirea și țintele vulnerabile; nu citește alegerile viitoare ale jucătorului.

## 13. Ecrane și interacțiuni

Boot/preload; insula principală; hartă de tărâmuri; mod construcție; magazin; inventar; incubator; detaliu dinozaur; colecție; evoluție; echipă; campanie; expediții temporizate; arenă PvE; crafting; luptă; rezultate; setări.

HUD insulă: aur, hrană, progres cont, misiune curentă, construire, colecție, expediții. Detaliu dinozaur: specie, element și rol derivat, stadiu, nivel, hrană necesară, habitat, abilități curente/viitoare. Rolul nu are dropdown.

Touch: tap selectează, drag pe teren mută camera, drag explicit în mod construcție mută obiectul; nu confunda colectarea cu pan. Comenzi de minimum 44 CSS px. Desktop: click, drag, taste scurte opționale. Mobil portrait afișează o invitație clară la landscape, nu o interfață tăiată.

Tutorial: primește ou → incubare → eclozare → plimbare copil → hrană → juvenil → echipă → prima luptă → recompensă → fermă/expansiune. Sunt pași persistenți, care pot fi reluați după refresh.

Setări: volum muzică/SFX, limbă, camera shake, flash redus. Pause când tabul este ascuns; economia offline continuă prin timp, nu prin simularea tuturor cadrelor pierdute.

## 14. Arhitectură tehnică propusă

Stack de lucru: TypeScript strict, Phaser pentru scenele 2D, React pentru interfețe și formulare, Vite pentru build, Vitest pentru logică, Playwright pentru trasee UI. Aseprite pentru sursele grafice. Alegerea este web-first; nu reprezintă o cerință moștenită de la utilizator.

La inițializare, verifică documentația oficială a versiunilor instalate, fixează versiunile în lockfile și scrie un smoke test pentru atlas/animații/camera pixel art. Nu amesteca exemple Phaser din generații diferite. Nu presupune versiuni „latest” în codul din document.

Module principale:

- `src/domain`: tipuri, comenzi, validări, economie, evoluție, combat engine determinist.
- `src/content`: species, elements, variants, skills, buildings, realms, quests, encounters, balance.
- `src/game`: scene lifecycle, camera, iso projection, placement, pathfinding, animator, VFX, audio.
- `src/ui`: HUD, ferestre, tutorial, collection, settings; text localizabil.
- `src/persistence`: save repository, IndexedDB, migrations, backup, adapters pentru server ulterior.
- `src/tools`: asset viewer, content inspector, debug controls numai în dev.
- `assets/source`: surse editabile; `public/assets`: exporturi runtime și manifeste.
- `tests`: unit, integration, end-to-end, scenarii de replay și fixture-uri economice.

React nu stochează separat o a doua copie a economiei. Un singur game store deține starea; UI trimite comenzi și primește snapshoturi/evenimente. Listenerii și scenele se curăță la unmount. Separă RNG de gameplay de RNG decorativ.

Persistență MVP locală în IndexedDB, cu export/import JSON și backup anterior migrației. Economie online, conturi, multiplayer și leaderboarduri nu sunt promise de acest mod. Înainte de lansare online, mută inventarul, timpul, reproducerea și recompensele la un server autoritativ; clientul nu este sursă de adevăr pentru bani.

## 15. Contracte de date

```ts
type SpeciesId = 'trex' | 'raptor' | 'triceratops' | 'ankylosaurus' | 'brachiosaurus';
type ElementId = 'fire' | 'water' | 'earth' | 'nature' | 'ice'
  | 'lightning' | 'wind' | 'dark' | 'light' | 'arcane';
type Stage = 'baby' | 'juvenile' | 'adult';
type Clip = 'idle' | 'walk' | 'attack' | 'defend' | 'hurt' | 'death' | 'ultimate';
type Facing = 'se' | 'ne';

interface DinoInstance {
  id: string;
  variantId: string;
  level: number;
  stage: Stage;
  habitatId: string | null;
  nickname: string | null;
  createdAt: number;
}
interface VariantDefinition {
  id: string;
  speciesId: SpeciesId;
  elementId: ElementId;
  releaseStatus: 'planned' | 'prototype' | 'ready';
  assetManifestId: string;
}
interface ClipDefinition {
  frames: string[];
  durationsMs: number[];
  loop: boolean;
  impactFrame?: number;
  holdLastFrame?: boolean;
  stridePx?: number;
}
interface DinoAssetManifest {
  schemaVersion: number;
  variantId: string;
  stage: Stage;
  sourceSize: { width: 192; height: 192 };
  pivot: { x: number; y: number };
  atlasPages: string[];
  clips: Partial<Record<Facing, Partial<Record<Clip, ClipDefinition>>>>;
  socketsByFrame?: Record<string, Record<string, { x: number; y: number }>>;
}
```

Completează schema pentru ElementDefinition (role, skills, paletă), SpeciesDefinition (stat multipliers, repere), BuildingInstance (footprint, orientation, production timestamps), EggInstance, PlayerSave, EncounterDefinition, SkillDefinition și BattleEvent.

Fiecare save include schemaVersion, contentVersion, revision, updatedAt, resurse, clădiri, dinozauri, ouă, tărâmuri/loturi deblocate, questState, battle snapshot dacă există. Salvează comenzile critice atomic. Validează datele importate: numere finite, limite, ID-uri existente, capacități, enumuri. Nu executa scripturi incluse într-un save.

Exemplu traseu asset: `assets/dinos/trex/fire/juvenile/se/attack`. Metadata atlasului păstrează dimensiunea originală și offsetul de trim; decuparea automată fără aceste informații produce salturi și trebuie respinsă. Validatorul cere cele două clipuri copilului și șase/șapte pentru stadiile de luptă, plus vederea NE pentru idle/walk.

## 16. Etape de implementare și acceptanță

### P0 — fundația și contractele

Inițializează repo, configurare strictă, game shell, localizare, content schemas, persistare cu migrare, commands/events și asset viewer. Scrie `docs/DECISIONS.md`, `docs/STATUS.md`, `docs/ASSET_BACKLOG.md`. Poți folosi asseturi temporare marcate `prototype` pentru a verifica pipeline-ul.

Acceptanță: aplicația pornește, rulează un clip de test cu timing corect, pixelii rămân clari la 1×/2×/3×, refresh păstrează save-ul, un manifest invalid este respins cu mesaj util.

### P1 — traseu complet cu T-Rex de foc

O insulă, un cuib, un habitat, o fermă, ou, copil, hrană, juvenil, o luptă 1v1, recompensă, evoluție adult accesibilă prin progresie sau seed dev, ultimată. Construiește sistemele generic, nu reguli hardcodate pentru trex.

Acceptanță: traseul funcționează după închiderea și redeschiderea jocului; recompensa nu poate fi colectată dublu; utilizatorul vede toate stadiile și poate inspecta animațiile. Asseturi temporare înseamnă P1 funcțional, nu aprobare vizuală finală.

### P2 — cele cinci variante MVP și combat complet

Adaugă celelalte patru specii/elemente, statusuri, 3v3, AI, 10 întâlniri de campanie și misiuni de deblocare. Testează în mod special pământul fără damage, vindecătorii și echipele lente.

Acceptanță: toate variantele au rolul derivat corect, copilul nu intră în luptă, fiecare adult poate folosi ultimata, victorie/înfrângere/remiză se finalizează fără blocaj. Schimbarea vitezei de redare nu modifică rezultatul replay-ului.

### P3 — insule și economie

Extinderi, plasare/mutare, capacități, producție offline, inventar, harta tărâmurilor, atelier, expediții temporizate și arena PvE descrise în secțiunea 20. Livrează insula neutră și cele cinci tărâmuri MVP; celelalte sunt vizibile doar ca planificate dacă UI explică acest lucru.

Acceptanță: nu plasezi peste apă, în afara terenului sau peste clădiri; anularea nu consumă resurse; mutarea nu șterge dinozauri; colectarea și incubarea nu se dublează după refresh.

### P4 — finalizare MVP

Înlocuiește toate asseturile temporare din traseul public, validează cele 1.020 cadre estimate, adaugă audio și feedback, verifică touch/desktop, performanța și accesibilitatea. Realizează capturi și raport de limitări.

Acceptanță: typecheck, build și testele relevante trec; zero asseturi lipsă; zero clipuri care folosesc imaginea altui stadiu; niciun blocaj de tutorial. Țintă de lucru: 60 FPS desktop, minimum 30 FPS pe dispozitivul mobil de referință ales și documentat, cu 20 dinozauri vizibili și 30 clădiri. Măsoară, nu declara fără testare.

### P5 — catalog și reproducere

Extinde progresiv la 25 variante, activează reproducerea când combinațiile sunt acoperite, apoi extinde la 50 și completează celelalte tărâmuri. Rebalansează matricea și costurile pe baza sesiunilor de test. Abia ulterior: conturi/cloud save, server autoritativ, evenimente și PvP.

## 17. Teste care protejează jocul

- Unit: derivarea rolului, praguri de evoluție, damage/scut, status lifecycle, energie, cooldownuri, matrice de afinitate, producție offline, costuri și capacități.
- Integration: ou gata → eclozare o singură dată; comandă repetată → fără recompensă dublă; save vechi → migrare cu backup; import corupt → respins fără a distruge save-ul bun.
- Placement: proiecție și inversă, footprints, overlap, lot închis, acces la clădire, hit testing.
- Combat: seed identic și aceleași comenzi → stare finală identică; dinozaur mort nu mai acționează; pământul nu produce damage; echipă numai suport ajunge corect la limita de runde.
- E2E: tutorial complet, refresh în incubare, evoluție, luptă și rezultat, cumpărare/plasare/anulare, colectare offline.
- Vizual/manual: contact picioare, timing de impact, continuitate între cadre, lizibilitate pe fundal întunecat și luminos, lipsa tăierilor de coadă/coarne.

Nu scrie teste doar pentru fiecare getter sau fiecare valoare de UI. Prioritizează pierderea progresului, duplicarea resurselor, blocajele, rolurile și calitatea efectivă a redării.

## 18. Livrabile și regulile de lucru pentru Claude

Livrează repo rulabil, README cu comenzile reale, configurații de conținut, migrații, teste, asset viewer, surse și exporturi ale asseturilor disponibile, inventar clar al celor lipsă, raport de validare și status pe etapă.

La fiecare etapă: spune ce ai implementat, cum poate fi verificat, ce ai testat și ce lipsește. Nu declara compatibilitate mobilă sau animații finale fără verificare. Dacă nu ai acces la instrumente de desen/generare, construiește integrarea și backlogul exact, dar nu inventa că ai produs sprite-uri profesionale.

Nu modifica regula element→rol. Nu adăuga clase, random role, permadeath, PvP, plăți sau sisteme de echipament interschimbabil fără cerere. Nu înlocui sprite animation cu deformarea unei singure imagini și nu integra vechile asseturi cartoon HD ca artă finală.

După P1, oprește extinderea volumului de conținut până când pipeline-ul vizual și animațiile primei familii sunt validate. Continuă remedierea defectelor și livrarea unei versiuni reviewabile; nu cere utilizatorului să decidă fiecare convenție de cod sau nume de fișier.

## 19. Referințe tehnice verificate

- Phaser — animations: https://docs.phaser.io/phaser/concepts/animations
- Phaser — cameras și roundPixels: https://docs.phaser.io/phaser/concepts/cameras
- Phaser — textures și atlas: https://docs.phaser.io/phaser/concepts/textures
- Aseprite — sprite sheet: https://www.aseprite.org/docs/sprite-sheet/
- Aseprite — tags: https://www.aseprite.org/docs/tags/
- Aseprite — CLI export: https://www.aseprite.org/docs/cli/

Documentația susține pipeline-ul de animații și atlasuri, nu echilibrarea propusă. Echilibrarea, costurile, mărimile și etapizarea din acest plan sunt ipoteze de design care trebuie validate prin playtesting.

## 20. Extinderea cerută: expediții, arenă, crafting și activități idle

Această secțiune completează MVP-ul în etapa P3 și are prioritate față de omisiunile din lista inițială. Nu implică PvP sau monetizare.

### Expediții active

Hartă de aventură separată de harta de construcție. Fiecare regiune conține noduri de luptă, recompensă, explorare și boss. Primele zece întâlniri au echipe și recompense definite în content. Selectarea unui nod arată tipurile de adversari, dificultatea și recompensa înainte de pornire. Prima victorie are bonus unic; repetarea are recompensă de bază. Nu cere energie consumabilă în MVP.

Înainte de luptă: selectează până la trei juvenili/adulți disponibili. La final: aplică rezultatul și recompensa o singură dată. Harta și nodurile rămân deblocate după refresh. Acest mod folosește motorul de luptă din secțiunea 12.

### Expediții temporizate, fără luptă activă

Trimite 1–3 juvenili/adulți într-o misiune de 5, 15 sau 30 minute. Un slot de expediție inițial, doi după upgrade. Recompensa de bază este garantată; un element recomandat adaugă +20% materiale, fără șansă ascunsă de eșec. Pământul este util inclusiv aici și nu trebuie să producă damage pentru a participa.

Dinozaurii trimiși sunt rezervați până la întoarcere: nu pot intra simultan în luptă, reproducere sau altă expediție. Nu părăsesc definitiv habitatul, dar producția lor de aur este suspendată în intervalul expediției; contabilizează precis intervalele, inclusiv offline. La întoarcere reiau producția chiar dacă recompensa nu a fost încă revendicată.

Model: `ExpeditionJob { id, definitionId, dinoIds, startedAt, endsAt, rewardSnapshot, claimedAt }`. Snapshotul este calculat la pornire, nu schimbat retroactiv de un update de balans. Claim idempotent. Anularea eliberează echipa fără recompensă. Misiunile continuă offline pe baza timestampurilor.

### Arena

Arena MVP este o scară PvE, cu echipe AI prestabilite și nivel de provocare în creștere; interfața o numește explicit „Arena PvE”. Nu simula utilizatori reali, matchmaking sau clasamente online.

Zece adversari inițiali, fiecare cu 3 dinozauri și o recompensă unică la prima înfrângere. Rejucarea oferă practică și recompensă redusă definită în config; fără recompensă la remiză. Aceeași simulare, statusuri, energie și animații ca în expediții. O singură luptă activă la un moment dat.

Ecran: adversar, echipa lui, echipa proprie, condiție de deblocare, recompense, buton „Luptă”. Ecranul de luptă: trei poziții pe fiecare parte, portrete, HP/scut/energie, ordinea turelor, basic/skill/defend/ultimate, target selection, tooltip de element. Ultimata este indisponibilă la juvenil și explicată vizual, nu doar un buton fără reacție.

### Crafting

Atelier 3×3 cumpărabil după tutorial; o rețetă în lucru și două în așteptare inițial. Resurse: lemn, piatră, fibre, cristale. Materialele provin din expediții, misiuni și două clădiri de producție simplă: exploatare de lemn 3×3 și carieră 3×3. Nu defrișa automat decorațiunile rare pentru resurse.

Rețete inițiale de test:

| Rețetă | Cost | Durată | Rezultat |
| --- | --- | --- | --- |
| Plăci de construcție | 10 lemn | 30 s | 2 plăci |
| Blocuri de piatră | 10 piatră | 30 s | 2 blocuri |
| Kit habitat | 4 plăci + 4 blocuri + 5 fibre | 2 min | 1 kit, consumat la upgrade |
| Cristal de evoluție | 10 cristale + 10 fibre | 5 min | 1 cristal, pentru evoluții după tutorial |
| Lampă ornamentală | 2 blocuri + 2 cristale | 1 min | 1 decor plasabil |

Costul este rezervat și debitat atomic la adăugarea în coadă. Job queued poate fi anulat cu refund integral; job running nu poate fi anulat în MVP. Finalizarea creează un rezultat claimable; colectarea îl mută o singură dată în inventar. Când un job termină, următorul începe la timpul calculat, inclusiv când jocul este închis. Coada finită se rezolvă până la timpul curent, nu prin mii de tickuri simulate.

Nu fabrica specii noi, roluri, costume aleatoare sau arme interschimbabile în MVP. Sabia T-Rex-ului este parte din identitatea variantei, nu un item care îl poate transforma în healer. Un viitor upgrade de armă poate modifica puterea, dar nu elementul sau rolul, și necesită design separat.

Ecran crafting: categorii în stânga, rețete în centru, rezultat/cost/durată în dreapta, coadă jos. Butonul explică materialele lipsă. Prețurile și cantitățile din schițe sunt ilustrative; configurația din cod este autoritară.

### Activități idle

Dinozaurii alternează idle și walk în habitat. Idle include gesturi potrivite: copil privește/respiră, T-Rex își odihnește sabia, Raptor își ajustează poziția, protectorul sprijină scutul, healerul privește globul de apă. Aceste gesturi folosesc clipurile aprobate, nu adaugă automat noi obligații de animație.

Habitatele acumulează aur; fermele hrană; cuiburile incubează; atelierul procesează coada; expedițiile se finalizează. Feedback prin bule de colectare și timere. La revenire se afișează un rezumat separat pe sistem, cu recompense deja creditate vs. încă de revendicat clar diferențiate. Un buton „Colectează disponibil” execută comenzile eligibile fără să colecteze de două ori același rezultat.

Extinde save schema cu inventoryMaterials, craftingJobs, expeditionJobs, arenaProgress și reservation locks. Un dinozaur rezervat nu poate fi folosit simultan în sisteme incompatibile. Validează aceste reguli în domeniu, nu doar prin butoane dezactivate.

Teste suplimentare: timer peste refresh, coadă cu două joburi terminate offline, refund queued, claim repetat, dino rezervat în două locuri, prima recompensă de arenă repetată, expediție terminată fără claim și producția reluată.

## 21. Corecție de direcție: dinozaurii sunt personaje cu arme și ținute

Aceasta este cerința nouă explicită a utilizatorului și prevalează asupra oricărei interpretări de „animal elemental fără echipament”. Dinozaurii trebuie să aibă personalitate de erou: ținută, accesoriu emblematic, armă/instrument și gestică. Evită doar recolorarea pielii. Elementul fixează rolul; specia și elementul împreună fixează loadoutul vizual.

Exemple obligatorii: T-Rex foc are sabie și atac animat cu sabia. Raptor foc are două pumnale. Raptor vânt are sabie. Raptorul de vânt rămâne suport de viteză; o armă nu îl transformă în a doua clasă.

### Loadouturi propuse pentru primele cinci elemente

| Specie | Foc | Apă | Pământ | Gheață | Vânt |
| --- | --- | --- | --- | --- | --- |
| T-Rex | samurai, katana înflăcărată | medic de maree, toiag cu scoică | gardian, scut și baston mineral | războinic polar, sabie de gheață | spadasin, sabie ușoară și eșarfă |
| Raptor | luptător rapid, două pumnale de jar | alchimist marin, două fiole și sceptru | cercetaș protector, scut mic și totem | urmăritor polar, două lame de gheață | duelant, sabie lungă și panglică de vânt |
| Triceratops | cavaler, lance de foc | vindecător coral, toiag cu perlă | protector, scut mare și toiag runic | santinelă, suliță de cristal | herald, sabie scurtă și stindard |
| Ankylosaurus | fierar, ciocan de jar | vindecător de recif, clopot și talisman | păzitor, pavăză și totem de piatră | cavaler de ger, ciocan de gheață | paznic al culmilor, evantai și stindard |
| Brachiosaurus | mag de foc, toiag cu brazier | vindecător, toiag cu glob de apă | druid mineral, toiag și talisman | mag de ger, toiag de cristal | dirijor al vântului, toiag și panglici |

Pentru celelalte elemente, tema de rol este comună: natură = druid/regenerare, fulger = armă conductoare/impact, întuneric = blesteme și rune, lumină = ceremonial/purificare, arcan = sigilii/control. Specifică loadoutul fiecărei variante înainte de producerea animațiilor. Nu promite că toate sunt deja proiectate complet.

### Arme și evoluție

Copilul poartă o ținută simplificată și un simbol al viitorului echipament: sabie de lemn în teacă, mic pandantiv, baston de exercițiu. Nu are atac, nu participă la luptă. Juvenilul primește arma funcțională și un costum mai simplu. Adultul primește versiunea elaborată și gestica de ultimată. Forma emblemei, paleta și familia armei rămân recognoscibile.

### Coregrafie și separarea asseturilor

- T-Rex foc attack: trage sabia în spate → taie diagonal → impact cu arc de jar → revine în gardă. Ultimata: pregătire cu sabia ridicată → lovitură în sol → val de foc.
- Raptor foc attack: pas scurt → două tăieturi alternative cu pumnalele → retragere. Două evenimente vizuale pot corespunde unei singure acțiuni; împărțirea damage este definită explicit în skill, nu dublată accidental.
- Raptor vânt basic: pas și tăietură rapidă cu damage modest. Skill: rotire a sabiei și curent de aer care accelerează echipa. Ultimata: arc circular de vânt și protecție de echipă.
- Triceratops pământ: plantează scutul și toiagul → se ridică un bastion mineral. Niciun impact ofensiv, inclusiv la clipul numit tehnic attack.
- Ankylosaurus gheață: ridică ciocanul → lovește → val rece; controlul rămâne scopul principal.
- Brachiosaurus apă: ridică toiagul → globul pulsează → val vindecător către aliați. Nu mimează o lovitură care ar trebui să facă damage.

Sursa editabilă are layere body, outfit, weapon, hand_front/occlusion, VFX. Pentru runtime-ul inițial exportă corp+costum+armă ca sprite animat sincronizat pentru fiecare loadout fix, iar VFX/proiectilele separat. Livrează și iconul/ilustrația armei separat pentru inventar și referință. Dacă arma trebuie detașată runtime, exportă cadrele ei și sockets per frame, plus ordinea față/spate; nu roti o singură sabie HD peste un corp pixel art.

Actualizează bounding box-ul tuturor clipurilor ca sabia, pumnalele și coada să încapă. Păstrează 192×192 pentru corp și arma obișnuită dacă este suficient; dacă model sheet-ul aprobat cere 256×256, schimbă contractul întregii variante și bugetul de memorie, nu tăia arma. Efectele mari rămân separate.

## 22. Cum se folosesc planșele din pachet

Planșele sunt concepte, nu atlasuri de sprite-uri și nu hărți de coliziune. Nu decupa automat personajele cu fundal și nu le declara assets finalizate. Recreează sprite-urile la rezoluția logică stabilită și validează fiecare familie de animații.

- `references/01_character_evolutions.png`: direcția actuală de personaje înarmate, copil/juvenil/adult.
- `references/02_elemental_eggs.png`: cele zece elemente și marcajele de specie.
- `references/03_home_island_buildings.png`: teren construibil, clădiri separate și feedback de plasare.
- `references/04_elemental_realms.png`: palete, margini și spațiu liber pentru zece tărâmuri.
- `references/05_gameplay_screens.png`: organizare vizuală pentru expediții, arenă, crafting și idle. Personajele din această planșă pot proveni din direcția anterioară fără arme; pentru designul lor final prevalează planșa 01 și secțiunea 21.
- `references/06_raptor_fire_wind.png`: comparație de loadout și schițe de poziții de atac; nu este o animație frame-by-frame gata de import.

În caz de conflict, cerința scrisă și corecțiile utilizatorului au prioritate față de un detaliu generat în imagine: numărul de unități este 3v3, rolurile rămân fixe, valorile sunt în config, iar clădirile sunt obiecte independente. Textele scurte din schițe nu sunt conținutul final al UI-ului românesc.

## 23. Coeficienți inițiali pentru implementarea skillurilor

Toate valorile sunt pentru playtesting. Damage folosește formula din secțiunea 12; heal/scut/regen folosesc power direct și nu afinitatea. „Echipă” înseamnă toate unitățile vii ale acelei echipe. Nu există înviere în MVP.

| Element | Skill, cooldown 3 ture proprii | Ultimate, 100 energie |
| --- | --- | --- |
| Foc | damage 1,2 pe o țintă + burn | damage 1,3 pe fiecare inamic |
| Apă | heal 1,4 pe un aliat + elimină un debuff | heal 1,2 pe fiecare aliat |
| Pământ | scut 0,7 pe fiecare aliat | scut 1,2 pe fiecare aliat + damage primit ×0,8 până la următoarea tură a fiecăruia |
| Natură | regen 0,45 pe fiecare aliat pentru două ture | regen 0,7 pe fiecare aliat pentru trei ture |
| Gheață | damage 0,8 pe un inamic + slow | damage 0,5 pe fiecare inamic; freeze doar pe ținta primară selectată |
| Fulger | damage 1,6 pe un inamic | trei lovituri de 0,8 pe ținta selectată; retarget la primul inamic viu în ordinea stabilă dacă moare |
| Vânt | haste pentru echipă, două runde | haste două runde + scut 0,8 pentru echipă |
| Întuneric | damage 0,7 pe un inamic + exposed două ture | damage 0,6 pe fiecare inamic + exposed două ture |
| Lumină | elimină toate debuffurile unui aliat + scut 0,8 | elimină toate debuffurile echipei + scut 0,8 |
| Arcan | damage 0,8 pe o țintă + silence o tură | damage 0,7 pe fiecare inamic + silence o tură |

Bufful de protecție al pământului se combină multiplicativ cu defend: 0,8×0,6=0,48. Efecte identice nu se multiplică între ele. Pentru purificarea unui singur debuff folosește prioritatea freeze, silence, burn, exposed, slow. Nu purifica efecte pozitive. Skillurile de suport permit alegerea propriei unități ca aliat.

Pentru basic de Raptor foc, două impacturi vizuale împart coeficientul total 1,0 în 0,5+0,5. Motorul marchează o singură acțiune și acordă energie o singură dată. În general, tabelul SkillDefinition conține explicit efecte și momente; nu deduce damage din numărul efectelor grafice redate.

La moartea ultimei unități adverse se finalizează mai întâi toate efectele acelei acțiuni, apoi verdictul. Dacă ambele echipe rămân fără unități vii, rezultatul este remiză. Acțiunile de sprijin fără ținte eligibile sunt respinse înainte de consumul turei. Defend rămâne întotdeauna o acțiune validă pentru o unitate vie care poate acționa.
