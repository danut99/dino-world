# Conturi și salvare în cloud (Supabase)

Cu Supabase configurat, jocul se deschide pe ecranul de login (email + parolă sau Google) și pornește doar după autentificare. Progresul se păstrează **doar în cloud**, nu în browser. Fără configurare (de ex. la dezvoltare locală, sau în scripturile de verificare din `scripts/`) jocul merge ca înainte, cu salvarea în browser.

Ce face codul:

- `src/realms/SignInGate.tsx` — ecranul de login dinaintea jocului și încărcarea salvării din cloud.
- `src/realms/cloud.ts` — conexiunea, login-ul și citirea/scrierea salvării.
- `src/realms/useCloudSync.ts` — salvarea automată (la ~2,5 secunde după o schimbare și când închizi pagina).
- `src/realms/AccountPanel.tsx` — formularele de cont și fereastra **Cont** din joc (Setări sau meniul de profil pe telefon).
- `supabase/migrations/0001_cloud_saves.sql` — tabelul `saves` și regulile de securitate.
- `supabase/migrations/0002_players.sql` — numele de jucător (`profiles`), lista `players` și dreptul de a vedea (nu de a modifica) lumile celorlalți.
- `supabase/migrations/0003_schema_floor.sql` — refuză coborârea `schema_version` a unei salvări (un client vechi din cache nu poate suprascrie o salvare v6).
- `supabase/migrations/0004_save_guard.sql` — paza de bază a salvărilor (trigger `saves_guard`): refuză o salvare cu `revision` mai mic decât cel din cloud (un tab vechi), diamante care cresc cu peste 200 + 20/oră sau aur cu peste 200.000 + 50.000/oră față de scrierea anterioară (timpul serverului), și valori negative sau peste 1e9. Un rând fără progres (fără dinozauri și lupte câștigate) sau trecerea la o schemă nouă sunt scutite. La refuz jocul reia salvarea din cloud. Uneltele de dezvoltare (`addGems`, `devResources`) pot fi refuzate pe un proiect cu această regulă.
- `supabase/migrations/0005_friends.sql` — prieteni (`friendships`: cerere → acceptare), bifa `profiles.accept_help` („prietenii îmi pot colecta aurul”) și `friend_helps`: un prieten acceptat golește depozitul de aur al celuilalt (funcția `help_friend`, cel mult o dată pe oră per jucător). Jocul proprietarului aplică colectarea la următoarea încărcare, la momentul în care a fost apăsat butonul.
- `supabase/migrations/0006_friend_battles.sql` — lupte amicale între prieteni (`friend_battles`: cine a atacat, pe cine, rezultatul). Fără premii; doar prietenii acceptați, cel mult o luptă pe minut. Lista de prieteni arată scorul.
- `src/realms/PlayersPanel.tsx` — lista de jucători; un click deschide lumea lor, doar pentru vizionare.

Progresul jucat înainte de conturi, păstrat în browser, se mută în cont la primul login și apoi e șters din browser. Dacă și contul are deja progres, jucătorul alege pe care îl păstrează. La fel, dacă alt dispozitiv a salvat între timp, jocul nu suprascrie nimic singur: arată ambele variante (dinozauri, nivel, stele, aur).

Rămân în browser doar preferințele (limbă, sunete, ultima lume vizitată) și sesiunea de login a Supabase.

## 1. Proiectul Supabase (≈ 3 minute)

1. Intră pe [supabase.com](https://supabase.com), creează un cont gratuit și apoi **New project**. Alege o regiune din Europa (de ex. Frankfurt) și o parolă pentru baza de date (păstreaz-o).
2. Deschide **SQL Editor → New query**, lipește tot conținutul din `supabase/migrations/0001_cloud_saves.sql` și apasă **Run**. Trebuie să apară „Success”. Repetă, într-un query nou, cu `0002_players.sql` (numele de jucător, lista de jucători și vizitarea lumilor). La fel cu `0003_schema_floor.sql` (pragul versiunii de salvare) și `0004_save_guard.sql` (paza salvărilor) și `0005_friends.sql` (prieteni și ajutor la colectare), apoi `0006_friend_battles.sql` (lupte amicale și scor).
3. **Project Settings → API Keys**: copiază **Project URL** și cheia **Publishable** (sau „anon” la proiectele mai vechi). Nu folosi niciodată cheia **secret / service_role** în joc.
4. În folderul proiectului, copiază `.env.example` ca `.env.local` și completează:

   ```sh
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_KEY=sb_publishable_...
   ```

5. Repornește `npm run dev`. Jocul se deschide acum pe ecranul de login.

## 2. Adresele de întoarcere

**Authentication → URL Configuration**:

- **Site URL**: adresa jocului publicat (până atunci `http://127.0.0.1:5173`).
- **Redirect URLs**: adaugă `http://127.0.0.1:5173/**` și, când publici jocul, `https://domeniul-tau/**`.

Fără ele, linkurile din email (confirmare, resetare parolă) și login-ul cu Google nu se întorc în joc.

## 3. Login cu email + parolă

Este activ implicit. Supabase cere confirmarea adresei: după „Creează cont” jucătorul primește un email și apasă linkul.

Atenție: serverul de email inclus în planul gratuit trimite doar câteva emailuri pe oră și e gândit pentru teste. Înainte de lansare, setează un SMTP propriu în **Authentication → Emails → SMTP Settings** (de ex. Resend sau Brevo, ambele au plan gratuit).

## 4. Login cu Google (≈ 5 minute)

1. [Google Cloud Console](https://console.cloud.google.com) → creează un proiect.
2. **APIs & Services → OAuth consent screen**: tip **External**, numele jocului, emailul tău. Salvează.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → **Web application**:
   - **Authorized JavaScript origins**: `http://127.0.0.1:5173` (și domeniul jocului publicat).
   - **Authorized redirect URIs**: adresa afișată în Supabase la **Authentication → Sign In / Providers → Google** (arată ca `https://xxxxxxxx.supabase.co/auth/v1/callback`).
4. Copiază **Client ID** și **Client secret** în Supabase: **Authentication → Sign In / Providers → Google**, activează și salvează.
5. În `.env.local` adaugă `VITE_GOOGLE_LOGIN=true` și repornește `npm run dev`. Abia acum apare butonul „Continuă cu Google” pe ecranul de login.

Cât timp aplicația Google e în modul „Testing”, doar adresele trecute la **Test users** se pot loga. Pentru toată lumea, apasă **Publish app** pe ecranul de consimțământ.

## Securitate

- Fiecare jucător poate scrie doar rândul lui din `saves` și numele lui din `profiles` (Row Level Security). Jucătorii logați pot citi salvările celorlalți, ca să le viziteze lumile; emailul nu e vizibil nimănui.
- Serverul pune singur ora fiecărei scrieri; ceasul telefonului nu contează.
- Salvarea e încă validată doar în joc: un jucător priceput își poate modifica propriul progres. Pasul următor, când apar clasamente sau PvP, este verificarea acțiunilor pe server cu același `command()` din `game.ts` (Supabase Edge Functions).

## 5. Jucători fără cont (conturi anonime)

Un jucător nou intră direct în joc, fără formular: primește automat un **cont anonim** (Supabase → **Authentication → Sign In / Providers → Allow anonymous sign-ins**, pornit). Progresul lui e în cloud din prima secundă. Când își face cont (din invitațiile din joc sau meniul de profil), emailul și parola se leagă de **același cont**, deci nu se mută nimic; apoi își alege numele (pornește de la numele aleator primit, de ex. „Raptor Curajos 482”).

- Dacă login-ul anonim e oprit sau limita e atinsă (implicit 30 conturi noi pe oră pe IP), jocul pornește tot fără cont, cu salvarea pe dispozitiv; la crearea contului progresul se mută în cloud.
- Cu confirmarea pe email pornită, jucătorul primește linkul de confirmare și abia după aceea își alege parola (așa cere Supabase pentru conturile anonime).
- Înainte de lansare: pornește **CAPTCHA** (Authentication → Attack Protection, Cloudflare Turnstile), altfel oricine poate crea conturi anonime în masă.

Câți jucători sunt (în **SQL Editor**):

```sql
select
  count(*) filter (where is_anonymous) as fara_cont,
  count(*) filter (where not is_anonymous) as cu_cont
from auth.users;
```

Curățenie: conturile anonime abandonate de peste 30 de zile (și salvările lor, prin `on delete cascade`):

```sql
delete from auth.users where is_anonymous is true and created_at < now() - interval '30 days';
```

În **Authentication → Users** conturile anonime au eticheta „Anonymous”.
