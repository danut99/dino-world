import { t, useLanguage, setLanguage } from '../i18n';
// Setările: sunetul, salvarea (export și import), ajutorul, raportarea unei probleme și jocul nou. Aceeași fereastră
// întunecată ca Extinde și Atlasul (bp-modal + bara de sus), cu câte un card pe temă. Confirmările sunt în card, nu
// ferestre ale browserului.

import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { GameState } from '@shared/game';
import { parseSave, type Game } from '../hooks/useGame';
import { setSound, soundOn } from '../audio/sfx';
import { resetFirstSteps } from './FirstSteps';
import { Modal, Need, formatNumber } from './ui';
import { useNav } from './nav';
import { ReportForm } from '../app/ErrorBoundary';
import '../styles/settings.css';

const fileName = () => `dino-world-${new Date().toISOString().slice(0, 10)}.json`;

export function Settings({ game, onClose }: { game: Game; onClose: () => void }) {
  return (
    <Modal title={t('Setări')} onClose={onClose} bare className="bp-modal settings-modal">
      <div className="bp-adv" style={{ '--tint': '#f2b544' } as CSSProperties}>
        <header className="bp-bar">
          <span className="shop-bar-icon" aria-hidden="true">
            ⚙️
          </span>
          <div className="bp-bar-title">
            <h2>{t('Setări')}</h2>
          </div>
        </header>
        <div className="bp-adv-body settings">
          {/* cele două carduri mici pe primul rând, cele late dedesubt */}
          <SoundCard />
          <HelpCard />
          <LanguageCard />
          <SaveCard game={game} onClose={onClose} />
          <Card icon="🐞" title={t('Raportează o problemă')} wide>
            <ReportForm />
          </Card>
          <NewGameCard game={game} onClose={onClose} />
        </div>
      </div>
    </Modal>
  );
}

function LanguageCard() {
  const language = useLanguage();
  return (
    <Card icon="🌐" title={language === 'en' ? 'Language' : 'Limbă'} wide>
      <div className="settings-row">
        <button
          className={`bp-ghost ${language === 'en' ? 'on' : ''}`}
          lang="en"
          aria-pressed={language === 'en'}
          onClick={() => setLanguage('en')}
        >
          English
        </button>
        <button
          className={`bp-ghost ${language === 'ro' ? 'on' : ''}`}
          lang="ro"
          aria-pressed={language === 'ro'}
          onClick={() => setLanguage('ro')}
        >
          Română
        </button>
      </div>
    </Card>
  );
}

/** Un card de setări: iconiță, titlu, conținut. `wide` = pe toată lățimea. */
function Card({
  icon,
  title,
  wide,
  danger,
  children,
}: {
  icon: string;
  title: string;
  wide?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`settings-card ${wide ? 'wide' : ''} ${danger ? 'danger' : ''}`}>
      <h3>
        <span className="settings-icon" aria-hidden="true">
          {t(icon)}
        </span>
        {t(title)}
      </h3>
      {t(children)}
    </section>
  );
}

// ---------- sunet ----------

function SoundCard() {
  const [sound, setSoundState] = useState(soundOn);
  return (
    <Card icon="🔊" title={t('Sunet')}>
      <label className="settings-switch">
        <span>{t('Efecte sonore')}</span>
        <input
          type="checkbox"
          role="switch"
          checked={sound}
          onChange={(e) => {
            setSound(e.target.checked);
            setSoundState(e.target.checked);
          }}
        />
        <span className="settings-switch-track" aria-hidden="true" />
      </label>
    </Card>
  );
}

// ---------- ajutor ----------

function HelpCard() {
  const nav = useNav();
  return (
    <Card icon="📚" title={t('Ajutor')}>
      <p className="settings-note">{t('Ghidul jocului, în Wikipedia.')}</p>
      <div className="settings-row">
        <button className="bp-ghost" onClick={() => nav({ to: 'wiki', article: 'first-steps' })}>
          {t('🧭 Primii pași')}
        </button>
        <button className="bp-ghost" onClick={() => nav({ to: 'wiki', article: 'saving' })}>
          {t('💾 Despre salvare')}
        </button>
      </div>
    </Card>
  );
}

// ---------- salvarea: descarcă / copiază, încarcă din fișier / text ----------

function SaveCard({ game, onClose }: { game: Game; onClose: () => void }) {
  const [incoming, setIncoming] = useState<GameState | null>(null);
  const [paste, setPaste] = useState<string | null>(null);
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const text = () => JSON.stringify(game.state);

  const download = () => {
    const url = URL.createObjectURL(new Blob([text()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName();
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    game.toast('Salvarea a fost descărcată.');
  };
  const copy = () =>
    navigator.clipboard
      .writeText(text())
      .then(() => game.toast('Salvarea e copiată. Păstreaz-o într-o notiță sau un mesaj.'))
      .catch(() => game.toast('Nu am putut copia. Folosește „Descarcă”.', 'error'));
  const check = (raw: string) => {
    const save = parseSave(raw.trim());
    setError(save ? '' : 'Nu pare o salvare Dino World. Verifică fișierul sau textul.');
    setIncoming(save);
  };

  return (
    <Card icon="💾" title={t('Salvarea')} wide>
      <p className="settings-note">
        {t('Progresul se salvează automat ')}
        <strong>{t('doar în acest browser')}</strong>
        {t(
          '. Dacă ștergi datele site-ului sau folosești o fereastră privată, se pierde: păstrează din când în când o copie.',
        )}
      </p>

      <div className="settings-split">
        <div className="settings-group">
          <small>{t('Fă o copie')}</small>
          <div className="settings-row">
            <button className="button small" onClick={download}>
              {t('⬇ Descarcă')}
            </button>
            <button className="bp-ghost" onClick={copy}>
              {t('📋 Copiază ca text')}
            </button>
          </div>
        </div>
        <div className="settings-group">
          <small>{t('Încarcă o copie')}</small>
          <div className="settings-row">
            <button className="bp-ghost" onClick={() => file.current?.click()}>
              {t('⬆ Din fișier')}
            </button>
            <button
              className={`bp-ghost ${paste !== null ? 'on' : ''}`}
              onClick={() => setPaste(paste === null ? '' : null)}
            >
              {t('📝 Lipește text')}
            </button>
          </div>
          <input
            ref={file}
            type="file"
            accept=".json,application/json,text/plain"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void f.text().then(check);
            }}
          />
        </div>
      </div>

      {paste !== null && (
        <div className="settings-paste">
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={t('Lipește aici textul salvării')}
            rows={3}
          />
          <button className="button small" disabled={!paste.trim()} onClick={() => check(paste)}>
            {t('Verifică')}
          </button>
        </div>
      )}
      {t(error && <Need what={error} />)}
      {incoming && (
        <div className="settings-confirm">
          <strong>{t('Înlocuiești progresul actual cu această salvare?')}</strong>
          <span className="settings-chips">
            <span className="bp-chip">
              🦖 {incoming.dinos.length} {t('dinozauri')}
            </span>
            <span className="bp-chip">
              🏝️ {incoming.buildings.filter((b) => b.kind === 'habitat').length} {t('lumi')}
            </span>
            <span className="bp-chip">🪙 {t(formatNumber(incoming.gold))}</span>
          </span>
          <small>{t('Progresul de acum se pierde (descarcă-l întâi, dacă vrei să-l păstrezi).')}</small>
          <div className="settings-row">
            <button className="bp-ghost" onClick={() => setIncoming(null)}>
              {t('Anulează')}
            </button>
            <button
              className="button small"
              onClick={() => {
                game.replace(incoming);
                setIncoming(null);
                setPaste(null);
                game.toast('Salvarea a fost încărcată.');
                onClose();
              }}
            >
              {t('Da, încarcă')}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------- joc nou (zona periculoasă, cu confirmare) ----------

function NewGameCard({ game, onClose }: { game: Game; onClose: () => void }) {
  const [wipe, setWipe] = useState(false);
  return (
    <Card icon="⚠️" title={t('Joc nou')} wide danger>
      {!wipe ? (
        <div className="settings-row spread">
          <p className="settings-note">{t('Șterge tot progresul din acest browser și începe de la zero.')}</p>
          <button className="button small danger" onClick={() => setWipe(true)}>
            {t('Începe de la zero')}
          </button>
        </div>
      ) : (
        <div className="settings-confirm danger">
          <strong>{t('Sigur? Tot progresul din acest browser se șterge.')}</strong>
          <small>{t('Dacă vrei să-l poți recupera, descarcă salvarea înainte.')}</small>
          <div className="settings-row">
            <button className="bp-ghost" onClick={() => setWipe(false)}>
              {t('Anulează')}
            </button>
            <button
              className="button small danger"
              onClick={() => {
                resetFirstSteps();
                game.reset();
                game.toast('Joc nou pornit.');
                onClose();
              }}
            >
              {t('Șterge și începe')}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
