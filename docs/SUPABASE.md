# Conturi și salvare în cloud (Supabase)

Cu Supabase configurat, jocul se deschide pe ecranul de login (email + parolă sau Google) și pornește doar după autentificare. Progresul se păstrează **doar în cloud**, nu în browser. Fără configurare (de ex. la dezvoltare locală, sau în scripturile de verificare din `scripts/`) jocul merge ca înainte, cu salvarea în browser.

Ce face codul:
- `src/realms/SignInGate.tsx` — ecranul de login dinaintea jocului și încărcarea salvării din cloud.
- `src/realms/cloud.ts` — conexiunea, login-ul și citirea/scrierea salvării.
- `src/realms/useCloudSync.ts` — salvarea automată (la ~2,5 secunde după o schimbare și când închizi pagina).
- `src/realms/AccountPanel.tsx` — formularele de cont și fereastra **Cont** din joc (Setări sau meniul de profil pe telefon).
- `supabase/migrations/0001_cloud_saves.sql` — tabelul `saves` și regulile de securitate.

Progresul jucat înainte de conturi, păstrat în browser, se mută în cont la primul login și apoi e șters din browser. Dacă și contul are deja progres, jucătorul alege pe care îl păstrează. La fel, dacă alt dispozitiv a salvat între timp, jocul nu suprascrie nimic singur: arată ambele variante (dinozauri, nivel, stele, aur).

Rămân în browser doar preferințele (limbă, sunete, ultima lume vizitată) și sesiunea de login a Supabase.

## 1. Proiectul Supabase (≈ 3 minute)

1. Intră pe [supabase.com](https://supabase.com), creează un cont gratuit și apoi **New project**. Alege o regiune din Europa (de ex. Frankfurt) și o parolă pentru baza de date (păstreaz-o).
2. Deschide **SQL Editor → New query**, lipește tot conținutul din `supabase/migrations/0001_cloud_saves.sql` și apasă **Run**. Trebuie să apară „Success”.
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

Cât timp aplicația Google e în modul „Testing”, doar adresele trecute la **Test users** se pot loga. Pentru toată lumea, apasă **Publish app** pe ecranul de consimțământ.

## Securitate

- Fiecare jucător poate citi și scrie doar rândul lui din `saves` (Row Level Security).
- Serverul pune singur ora fiecărei scrieri; ceasul telefonului nu contează.
- Salvarea e încă validată doar în joc: un jucător priceput își poate modifica propriul progres. Pasul următor, când apar clasamente sau PvP, este verificarea acțiunilor pe server cu același `command()` din `game.ts` (Supabase Edge Functions).
