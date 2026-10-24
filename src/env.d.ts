/** Versiunea din package.json, pusă la build (vite.config.ts → define); apare în rapoartele de probleme. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Adresa la care pleacă „Trimite o problemă” (opțional). */
  readonly VITE_REPORT_EMAIL?: string;
  /** Sau un formular (ex. Google Forms) deschis într-un tab nou (opțional). */
  readonly VITE_REPORT_URL?: string;
  /** Proiectul Supabase pentru conturi și salvări în cloud (opțional; fără el jocul rămâne local). Vezi docs/SUPABASE.md. */
  readonly VITE_SUPABASE_URL?: string;
  /** Cheia publică a proiectului (publishable / anon key), nu cheia secretă. */
  readonly VITE_SUPABASE_KEY?: string;
}
