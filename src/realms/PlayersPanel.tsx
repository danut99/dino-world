import { useEffect, useState } from 'react';
import { listPlayers, type PlayerSummary } from './cloud';
import { DinosaurArt } from './DinosaurArt';
import { ELEMENTS, SPECIES, type RealmId, type Species, type Stage } from './game';
import { Icon } from './ui/Icon';

const T = (lang: number, ro: string, en: string) => (lang ? en : ro);

/** "5 min ago", "3 days ago": when the player last saved. */
function lastSeen(at: string | null, lang: number) {
  if (!at) return T(lang, 'încă n-a jucat', 'not played yet');
  const minutes = Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 60_000));
  if (minutes < 2) return T(lang, 'activ acum', 'active now');
  if (minutes < 60) return T(lang, `acum ${minutes} min`, `${minutes} min ago`);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return T(lang, `acum ${hours} h`, `${hours} h ago`);
  const days = Math.round(hours / 24);
  return T(lang, days === 1 ? 'ieri' : `acum ${days} zile`, days === 1 ? 'yesterday' : `${days} days ago`);
}

/** The champion's still portrait, when the list row names a dinosaur the game knows. */
function Portrait({ p }: { p: PlayerSummary }) {
  const known =
    (SPECIES as readonly string[]).includes(p.species ?? '') &&
    ELEMENTS.some((e) => e.id === p.element) &&
    ['baby', 'juvenile', 'adult'].includes(p.stage ?? '');
  return (
    <span className="realm-player-portrait" aria-hidden="true">
      {known ? (
        <DinosaurArt species={p.species as Species} element={p.element as RealmId} stage={p.stage as Stage} paused frame={0} />
      ) : (
        <Icon name="egg" scale={2} />
      )}
    </span>
  );
}

/** Everyone who plays, most recently active first; picking one visits their world. */
export function PlayersPanel({ lang, selfId, onVisit }: { lang: number; selfId: string; onVisit: (player: PlayerSummary) => void }) {
  const tr = (ro: string, en: string) => T(lang, ro, en);
  const [search, setSearch] = useState('');
  const [players, setPlayers] = useState<PlayerSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    // Wait for typing to pause before asking the server.
    const id = window.setTimeout(() => {
      listPlayers(search).then(
        (rows) => {
          if (!active) return;
          setPlayers(rows);
          setFailed(false);
        },
        () => active && setFailed(true),
      );
    }, search ? 300 : 0);
    return () => {
      active = false;
      window.clearTimeout(id);
    };
  }, [search]);

  return (
    <div className="realm-players">
      <label className="realm-players-search">
        <input type="search" aria-label={tr('Caută un jucător', 'Search for a player')} placeholder={tr('Caută după nume…', 'Search by name…')} value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      {failed ? (
        <p className="realm-note">{tr('Lista nu s-a putut încărca. Verifică internetul.', 'The list could not load. Check your connection.')}</p>
      ) : !players ? (
        <p className="realm-note">{tr('Se încarcă jucătorii…', 'Loading players…')}</p>
      ) : !players.length ? (
        <p className="realm-note">{search ? tr('Niciun jucător cu acest nume.', 'No player by that name.') : tr('Încă nu sunt alți jucători.', 'No other players yet.')}</p>
      ) : (
        <ul>
          {players.map((p) => {
            const self = p.user_id === selfId;
            return (
              <li key={p.user_id}>
                <button className="realm-player" disabled={self} onClick={() => onVisit(p)}>
                  <Portrait p={p} />
                  <span className="realm-player-main">
                    <strong>
                      {p.name} {self && <em>{tr('tu', 'you')}</em>}
                    </strong>
                    <small>
                      {tr('Nv.', 'Lv.')} {p.level} · 🦖 {p.dinos} · ★ {p.stars} · {p.worlds} {tr(p.worlds === 1 ? 'lume' : 'lumi', p.worlds === 1 ? 'world' : 'worlds')}
                    </small>
                  </span>
                  <span className="realm-player-seen">{lastSeen(p.updated_at, lang)}</span>
                  {!self && <span className="realm-player-visit">{tr('Vizitează', 'Visit')} →</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
