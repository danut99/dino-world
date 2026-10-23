// Plasa de siguranță: o eroare în interfață nu mai lasă ecranul alb. Jucătorul vede „Ceva n-a mers”, își poate
// descărca salvarea (citită direct din browser), poate trimite raportul și reîncarcă jocul.

import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { REPORT_EMAIL, REPORT_URL, downloadSave, logError, savedGame, sendReport } from './errors';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    logError(error, info.componentStack ?? undefined);
  }
  render() {
    return this.state.failed ? <CrashScreen /> : this.props.children;
  }
}

/** The game's own language setting, read directly so the screen works even when the app has crashed. */
function language() {
  try {
    return localStorage.getItem('dino-realms-language') === 'en' ? 1 : 0;
  } catch {
    return 0;
  }
}

function CrashScreen() {
  const lang = language();
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const hasSave = !!savedGame();
  return (
    <div className="crash">
      <section className="crash-card" role="alertdialog" aria-label={tr('Ceva n-a mers', 'Something went wrong')}>
        <span className="crash-icon" aria-hidden="true">
          🦕
        </span>
        <h1>{tr('Ceva n-a mers', 'Something went wrong')}</h1>
        <p>
          {tr('Jocul a întâlnit o eroare. ', 'The game hit an error. ')}
          {hasSave
            ? tr('Progresul tău e salvat în acest browser; reîncarcă și continui de unde ai rămas.', 'Your progress is saved in this browser; reload and continue where you left off.')
            : tr('Nu am găsit o salvare.', 'No save was found.')}
        </p>
        <div className="crash-buttons">
          <button className="button" onClick={() => window.location.reload()} autoFocus>
            {tr('↻ Reîncarcă', '↻ Reload')}
          </button>
          {hasSave && (
            <button className="button ghost" onClick={downloadSave}>
              {tr('⬇ Descarcă salvarea', '⬇ Download the save')}
            </button>
          )}
        </div>
        <ReportForm lang={lang} />
      </section>
    </div>
  );
}

/** „Trimite o problemă”: o descriere scurtă, plus detaliile tehnice adăugate automat. */
function ReportForm({ lang }: { lang: number }) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const [note, setNote] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const messages = {
    mail: tr('S-a deschis aplicația de e-mail cu raportul. Apasă Trimite acolo.', 'Your e-mail app opened with the report. Press Send there.'),
    form: tr('S-a deschis formularul. Raportul e copiat: lipește-l acolo.', 'The form opened. The report is copied: paste it there.'),
    copied: tr('Raportul e copiat. Trimite-l dezvoltatorului (mesaj sau e-mail).', 'The report is copied. Send it to the developer (message or e-mail).'),
    failed: tr('Nu am putut copia raportul. Fă o captură de ecran și descrie ce s-a întâmplat.', 'Could not copy the report. Take a screenshot and describe what happened.'),
  };
  return (
    <div className="report compact">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={tr('Ce făceai când a apărut eroarea? (opțional)', 'What were you doing when the error appeared? (optional)')}
        rows={2}
      />
      <button className="button small" onClick={() => void sendReport(note).then((r) => setResult(messages[r]))}>
        {REPORT_EMAIL ? tr('✉️ Trimite raportul', '✉️ Send the report') : REPORT_URL ? tr('📝 Deschide formularul', '📝 Open the form') : tr('📋 Copiază raportul', '📋 Copy the report')}
      </button>
      {result && <small className="report-result">{result}</small>}
    </div>
  );
}
