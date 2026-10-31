import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  acceptFriend,
  fetchAcceptHelp,
  fetchDefenses,
  fetchFriendScores,
  fetchLeagueRanking,
  listFriends,
  listLeaderboard,
  listPlayers,
  removeFriend,
  requestFriend,
  saveAcceptHelp,
  type Friend,
  type Defense,
  type Leaderboard,
  type PlayerSummary,
  type RankBy,
  type RankRow,
  type Score,
} from './cloud';
import { weekStart } from './daily';
import { DinosaurArt } from './DinosaurArt';
import {
  DUEL_SEASON_PRIZES,
  duelLeague,
  ELEMENTS,
  SPECIES,
  type Command,
  type Dino,
  type RealmId,
  type Save,
  type Species,
  type Stage,
} from './game';
import { TeamPicker } from './TeamPicker';
import { Icon } from './ui/Icon';
import { TabPanel, Tabs } from './ui/Tabs';

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
        <DinosaurArt
          species={p.species as Species}
          element={p.element as RealmId}
          stage={p.stage as Stage}
          paused
          frame={0}
        />
      ) : (
        <Icon name="egg" scale={2} />
      )}
    </span>
  );
}

type Visit = (player: { user_id: string; name: string }, canHelp: boolean) => void;

const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * `duels`: this week's league (prizes, your place, opponents your level, the table); `extra` sits under the league card.
 * `top`: all-time records by dinosaurs, champion level or stars, with this player's own place pinned below.
 */
function LeaderboardView({
  mode,
  extra,
  lang,
  selfId,
  visit,
  challenge,
  weekly,
  level,
  beaten,
}: {
  mode: 'duels' | 'top';
  extra?: ReactNode;
  lang: number;
  selfId: string;
  visit: (p: PlayerSummary) => void;
  challenge: Challenge;
  weekly: RankRow[] | null;
  /** This player's champion level: it picks the league. */
  level: number;
  /** Rivals already beaten today (no prize or ranking point again). */
  beaten: string[];
}) {
  const tr = (ro: string, en: string) => T(lang, ro, en);
  const league = duelLeague(level);
  const [suggested, setSuggested] = useState<PlayerSummary[] | null>(null);
  useEffect(() => {
    listPlayers('').then(
      (rows) =>
        setSuggested(
          rows
            .filter((p) => p.user_id !== selfId && p.level >= 10 && !beaten.includes(p.user_id))
            .filter((p) => duelLeague(p.level).id === league.id)
            .sort((a, b) => Math.abs(a.level - level) - Math.abs(b.level - level))
            .slice(0, 3),
        ),
      () => setSuggested([]),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selfId, league.id]);
  const daysLeft = Math.max(1, Math.ceil((weekStart(Date.now()) + 7 * 86_400_000 - Date.now()) / 86_400_000));
  const [by, setBy] = useState<RankBy | 'wins'>(mode === 'duels' ? 'wins' : 'dinos');
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (by === 'wins') return;
    let active = true;
    setBoard(null);
    listLeaderboard(by, selfId).then(
      (b) => {
        if (!active) return;
        setBoard(b);
        setFailed(false);
      },
      () => active && setFailed(true),
    );
    return () => {
      active = false;
    };
  }, [by, selfId]);
  const kinds: [RankBy, string][] = [
    ['dinos', `🦖 ${tr('Dinozauri', 'Dinosaurs')}`],
    ['level', `⬆ ${tr('Nivel', 'Level')}`],
    ['stars', `★ ${tr('Stele', 'Stars')}`],
  ];
  const score = (p: PlayerSummary) =>
    by === 'dinos' ? `${p.dinos} 🦖` : by === 'level' ? `${tr('Nv.', 'Lv.')} ${p.level}` : `${p.stars} ★`;
  const duel = (p: { user_id: string; name: string }) =>
    p.user_id === selfId || mode === 'top' ? null : (
      <button
        className="realm-rank-duel"
        aria-label={tr(`Duel cu ${p.name}`, `Duel ${p.name}`)}
        title={tr('Atacă-i echipa de duel', 'Attack their duel team')}
        onClick={() => challenge(p)}
      >
        ⚔ {tr('Duel', 'Duel')}
      </button>
    );
  const row = (p: PlayerSummary, rank: number, label = score(p)) => {
    const self = p.user_id === selfId;
    return (
      <li key={p.user_id} className={`realm-rank-row${self ? ' self' : ''}${rank && rank <= 3 ? ' podium' : ''}`}>
        <button className={`realm-rank${rank ? '' : ' no-place'}`} disabled={self} onClick={() => visit(p)}>
          {rank > 0 && <span className="realm-rank-place">{MEDALS[rank - 1] ?? `#${rank}`}</span>}
          <Portrait p={p} />
          <strong>
            {p.name} {self && <em>{tr('tu', 'you')}</em>}
          </strong>
          <span className="realm-rank-score">{label}</span>
        </button>
        {duel(p)}
      </li>
    );
  };
  // Tied players share a place: each one ranks after everyone strictly ahead of them.
  const ranks = by === 'wins' ? [] : (board?.top.map((p, i, all) => all.findIndex((q) => q[by] === p[by]) + 1) ?? []);
  const weeklyRanks = weekly?.map((r, i, all) => all.findIndex((q) => q.wins === r.wins) + 1) ?? [];
  const mine = weekly?.findIndex((r) => r.userId === selfId) ?? -1;
  return (
    <div className="realm-leaderboard">
      {mode === 'top' && (
        <>
          <p className="realm-note">
            {tr('Recordurile tuturor jucătorilor. Alege ce compari:', 'Records of every player. Pick what to compare:')}
          </p>
          <div className="pk-chips" role="group" aria-label={tr('Clasament după', 'Rank by')}>
            {kinds.map(([id, label]) => (
              <button key={id} className="pk-chip" aria-pressed={by === id} onClick={() => setBy(id)}>
                {label}
              </button>
            ))}
          </div>
        </>
      )}
      {by === 'wins' ? (
        <>
          <div className="realm-league">
            <strong>
              <span>
                {league.icon} {league.name[lang]}
              </span>
              <small>
                {tr('nivel', 'level')} {league.min}–{league.max} ·{' '}
                {tr(
                  `se încheie în ${daysLeft} ${daysLeft === 1 ? 'zi' : 'zile'}`,
                  `ends in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`,
                )}
              </small>
            </strong>
            <p className="realm-league-me">
              {weekly && mine >= 0
                ? tr(
                    `Locul tău: ${MEDALS[weeklyRanks[mine] - 1] ?? `#${weeklyRanks[mine]}`} · ${weekly[mine].wins} victorii săptămâna asta`,
                    `Your place: ${MEDALS[weeklyRanks[mine] - 1] ?? `#${weeklyRanks[mine]}`} · ${weekly[mine].wins} wins this week`,
                  )
                : tr(
                    'Încă n-ai victorii săptămâna asta: câștigă un duel ca să intri în clasament.',
                    'No wins this week yet: win a duel to get on the table.',
                  )}
            </p>
            <ol className="realm-league-prizes" aria-label={tr('Premii', 'Prizes')}>
              {DUEL_SEASON_PRIZES.map((p, i) => (
                <li key={i}>
                  {MEDALS[i]} {p.gems}💎
                  <small>
                    + {tr(p.rarity === 'epic' ? 'ou epic' : 'ou rar', p.rarity === 'epic' ? 'epic egg' : 'rare egg')}
                  </small>
                </li>
              ))}
            </ol>
            <small className="realm-league-rules">
              {tr(
                'Fiecare victorie în duel = 1 punct (cel mult unul pe zi pentru același adversar). Primii 3 iau premiile luni.',
                'Every duel win = 1 point (at most one a day per opponent). The top 3 get the prizes on Monday.',
              )}
            </small>
          </div>
          {extra}
          {suggested && suggested.length > 0 && (
            <section className="realm-suggested" aria-label={tr('Adversari pe măsura ta', 'Opponents your level')}>
              <h4>⚔ {tr('Adversari pe măsura ta', 'Opponents your level')}</h4>
              <ol>{suggested.map((p) => row(p, 0, `${tr('Nv.', 'Lv.')} ${p.level}`))}</ol>
            </section>
          )}
          <h4 className="realm-section-title">🏆 {tr('Clasamentul ligii', 'League table')}</h4>
          {!weekly ? (
            <p className="realm-note">{tr('Se încarcă…', 'Loading…')}</p>
          ) : !weekly.length ? (
            <p className="realm-note">
              {tr(
                'Încă nicio victorie în liga ta săptămâna asta. Fii primul!',
                'No wins in your league this week yet. Be the first!',
              )}
            </p>
          ) : (
            <ol>
              {weekly.map((r, i) => {
                const self = r.userId === selfId,
                  rank = weeklyRanks[i];
                return (
                  <li key={r.userId} className={`realm-rank-row${self ? ' self' : ''}${rank <= 3 ? ' podium' : ''}`}>
                    <button
                      className="realm-rank no-portrait"
                      disabled={self}
                      onClick={() => visit({ user_id: r.userId, name: r.name } as PlayerSummary)}
                    >
                      <span className="realm-rank-place">{MEDALS[rank - 1] ?? `#${rank}`}</span>
                      <strong>
                        {r.name} {self && <em>{tr('tu', 'you')}</em>}
                      </strong>
                      <span className="realm-rank-score">{r.wins} ⚔</span>
                    </button>
                    {duel({ user_id: r.userId, name: r.name })}
                  </li>
                );
              })}
            </ol>
          )}
        </>
      ) : null}
      {by === 'level' && (
        <p className="realm-note">{tr('Nivelul campionului fiecărui jucător.', "Each player's champion level.")}</p>
      )}
      {by === 'wins' ? null : failed ? (
        <p className="realm-note">
          {tr(
            'Clasamentul nu s-a putut încărca. Verifică internetul.',
            'The leaderboard could not load. Check your connection.',
          )}
        </p>
      ) : !board ? (
        <p className="realm-note">{tr('Se încarcă clasamentul…', 'Loading the leaderboard…')}</p>
      ) : !board.top.length ? (
        <p className="realm-note">{tr('Încă nu sunt jucători în clasament.', 'No players on the leaderboard yet.')}</p>
      ) : (
        <ol>
          {board.top.map((p, i) => row(p, ranks[i]))}
          {board.self && board.selfRank && (
            <>
              <li className="realm-rank-gap" aria-hidden="true">
                ⋯
              </li>
              {row(board.self, board.selfRank)}
            </>
          )}
        </ol>
      )}
    </div>
  );
}
type Challenge = (player: { user_id: string; name: string }) => void;

/** Friends first (requests, the help switch, score and challenge), then everyone who plays; picking one visits. */
export function PlayersPanel({
  lang,
  selfId,
  save,
  run,
  onVisit,
  onChallenge,
  onFriendsChange,
}: {
  lang: number;
  selfId: string;
  save: Save;
  run: (c: Command) => boolean;
  onVisit: Visit;
  onChallenge: Challenge;
  onFriendsChange?: () => void;
}) {
  const tr = (ro: string, en: string) => T(lang, ro, en);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'duels' | 'friends' | 'top'>('duels');
  const [players, setPlayers] = useState<PlayerSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [scores, setScores] = useState<Map<string, Score>>(new Map());
  const [acceptHelp, setAcceptHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ranking, setRanking] = useState<RankRow[] | null>(null);
  const [recent, setRecent] = useState<Defense[]>([]);
  const [pickDefense, setPickDefense] = useState(false);
  /** The friend whose extra actions (visit, remove) are unfolded. */
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const defense = save.defense.map((id) => save.dinos.find((d) => d.id === id)).filter((d): d is Dino => !!d);
  const championLevel = save.dinos.find((d) => d.id === save.champion)?.level ?? 0;
  const defenseEligible = useCallback((d: Dino) => (d.stage === 'baby' ? (lang ? 'baby' : 'pui') : null), [lang]);

  const reloadFriends = () => listFriends(selfId).then(setFriends, () => {});
  useEffect(() => {
    void reloadFriends();
    fetchAcceptHelp(selfId).then(setAcceptHelp, () => {});
    fetchFriendScores(selfId).then(setScores, () => {});
    fetchLeagueRanking(new Date(weekStart(Date.now())), new Date(Date.now() + 60_000), duelLeague(championLevel)).then(
      setRanking,
      () => setRanking([]),
    );
    fetchDefenses(selfId, new Date(Date.now() - 7 * 86_400_000).toISOString()).then(
      (d) => setRecent(d.reverse().slice(0, 8)),
      () => {},
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selfId]);
  const act = (job: () => Promise<void>) => {
    setBusy(true);
    job()
      .then(reloadFriends, () => {})
      .finally(() => {
        setBusy(false);
        onFriendsChange?.();
      });
  };
  const toggleHelp = (on: boolean) => {
    setAcceptHelp(on);
    saveAcceptHelp(selfId, on).catch(() => setAcceptHelp(!on));
  };
  const friendOf = (id: string) => friends.find((f) => f.user_id === id);
  const canHelp = (f?: Friend) => !!f && f.status === 'accepted' && f.acceptHelp;

  useEffect(() => {
    let active = true;
    // Wait for typing to pause before asking the server.
    const id = window.setTimeout(
      () => {
        listPlayers(search).then(
          (rows) => {
            if (!active) return;
            setPlayers(rows);
            setFailed(false);
          },
          () => active && setFailed(true),
        );
      },
      search ? 300 : 0,
    );
    return () => {
      active = false;
      window.clearTimeout(id);
    };
  }, [search]);

  const incoming = friends.filter((f) => f.status === 'pending' && f.incoming);
  const others = friends.filter((f) => !(f.status === 'pending' && f.incoming));
  const defenseStrip = (
    <section className="realm-friends-settings" aria-label={tr('Echipa de duel', 'Duel team')}>
      <div className="realm-friends-defense">
        <span>
          ⚔ {tr('Echipa de duel', 'Duel team')}
          <small>{tr('Atacă și te apară în dueluri.', 'Attacks and defends in duels.')}</small>
        </span>
        {defense.length ? (
          defense.map((d) => (
            <span key={d.id} className="realm-player-portrait" title={d.nickname}>
              <DinosaurArt species={d.species} element={d.element} stage={d.stage} paused frame={0} />
            </span>
          ))
        ) : (
          <small>{tr('echipa din arenă', 'your arena team')}</small>
        )}
        <button className="realm-button secondary" onClick={() => setPickDefense((v) => !v)}>
          {pickDefense ? tr('Gata', 'Done') : tr('Schimbă', 'Change')}
        </button>
      </div>
      {pickDefense && (
        <TeamPicker
          dinos={save.dinos}
          selected={defense.map((d) => d.id)}
          max={3}
          lang={lang}
          label={tr('Duel', 'Duel')}
          isEligible={defenseEligible}
          onChange={(ids) => run({ type: 'setDefense', dinoIds: ids })}
        />
      )}
    </section>
  );
  const settings = (
    <section className="realm-friends-settings" aria-label={tr('Setări', 'Settings')}>
      <label className="realm-friends-help">
        <input type="checkbox" checked={acceptHelp} onChange={(e) => toggleHelp(e.target.checked)} />
        <span>
          {tr('Prietenii îmi pot colecta aurul', 'Friends may collect my gold')}
          <small>{tr('O dată pe oră, când îți vizitează lumea.', 'Once an hour, when they visit your world.')}</small>
        </span>
      </label>
    </section>
  );

  const revenge =
    recent.length > 0 ? (
      <section className="realm-duels-recent" aria-label={tr('Cine te-a atacat', 'Who attacked you')}>
        <h3>🛡 {tr('Cine te-a atacat', 'Who attacked you')}</h3>
        <ul>
          {recent.slice(0, 3).map((r) => (
            <li key={r.at} className={r.result === 'victory' ? 'lost' : r.result === 'defeat' ? 'won' : ''}>
              <span>
                <strong>{r.attackerName}</strong>
                <small>
                  {r.result === 'victory'
                    ? tr('te-a învins', 'beat your team')
                    : r.result === 'defeat'
                      ? tr('a pierdut: echipa ta a rezistat!', 'lost: your team held!')
                      : tr('egalitate', 'draw')}{' '}
                  · {lastSeen(r.at, lang)}
                </small>
              </span>
              <button
                className="realm-button"
                onClick={() => onChallenge({ user_id: r.attackerId, name: r.attackerName })}
              >
                ⚔ {tr('Revanșă', 'Revenge')}
              </button>
            </li>
          ))}
        </ul>
      </section>
    ) : null;
  const lostRecently = recent.filter((r) => r.result === 'victory').length;

  return (
    <div className="realm-players">
      <Tabs
        idBase="players"
        label={tr('Jucători', 'Players')}
        active={view}
        onChange={setView}
        tabs={[
          { id: 'duels', label: `⚔ ${tr('Dueluri', 'Duels')}`, badge: lostRecently || undefined },
          { id: 'friends', label: `👥 ${tr('Prieteni', 'Friends')}`, badge: incoming.length },
          { id: 'top', label: `🏆 ${tr('Top', 'Top')}` },
        ]}
      />
      {view === 'duels' ? (
        <TabPanel idBase="players" id="duels">
          <LeaderboardView
            key="duels"
            mode="duels"
            extra={
              <>
                {defenseStrip}
                {revenge}
              </>
            }
            lang={lang}
            selfId={selfId}
            weekly={ranking}
            level={championLevel}
            beaten={save.daily.duelRivals}
            challenge={onChallenge}
            visit={(p) => onVisit(p, canHelp(friendOf(p.user_id)))}
          />
        </TabPanel>
      ) : view === 'top' ? (
        <TabPanel idBase="players" id="top">
          <LeaderboardView
            key="top"
            mode="top"
            lang={lang}
            selfId={selfId}
            weekly={ranking}
            level={championLevel}
            beaten={save.daily.duelRivals}
            challenge={onChallenge}
            visit={(p) => onVisit(p, canHelp(friendOf(p.user_id)))}
          />
        </TabPanel>
      ) : (
        <TabPanel idBase="players" id="friends" className="realm-players">
          {incoming.length > 0 && (
            <section className="realm-friends realm-friends-requests" aria-label={tr('Cereri', 'Requests')}>
              <h3>{tr('Cereri de prietenie', 'Friend requests')}</h3>
              <ul>
                {incoming.map((f) => (
                  <li key={f.user_id} className="realm-friend">
                    <span>
                      <strong>{f.name}</strong>
                      <small>{tr('Vrea să fiți prieteni', 'Wants to be friends')}</small>
                    </span>
                    <button
                      className="realm-button"
                      disabled={busy}
                      onClick={() => act(() => acceptFriend(selfId, f.user_id))}
                    >
                      {tr('Acceptă', 'Accept')}
                    </button>
                    <button
                      className="realm-button secondary"
                      disabled={busy}
                      aria-label={tr(`Refuză ${f.name}`, `Decline ${f.name}`)}
                      onClick={() => act(() => removeFriend(selfId, f.user_id))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="realm-friends" aria-label={tr('Prieteni', 'Friends')}>
            <h3>👥 {tr('Prietenii tăi', 'Your friends')}</h3>
            {!others.length ? (
              <p className="realm-note">
                {tr(
                  'Încă n-ai prieteni. Caută jucători mai jos și apasă „+ Prieten”.',
                  'No friends yet. Find players below and tap "+ Friend".',
                )}
              </p>
            ) : (
              <ul>
                {others.map((f) => {
                  const score = scores.get(f.user_id),
                    open = menuFor === f.user_id,
                    friend = f.status === 'accepted';
                  return (
                    <li key={f.user_id} className="realm-friend">
                      <span>
                        <strong>{f.name}</strong>
                        {friend ? (
                          <small className="realm-friend-score">
                            {score
                              ? tr(
                                  `Victorii ${score.wins} · Înfrângeri ${score.losses}${score.draws ? ` · Egal ${score.draws}` : ''}`,
                                  `Wins ${score.wins} · Losses ${score.losses}${score.draws ? ` · Draws ${score.draws}` : ''}`,
                                )
                              : tr('Încă nu v-ați luptat', 'No fights yet')}
                          </small>
                        ) : (
                          <small>
                            {tr('Cerere trimisă, așteptăm răspunsul', 'Request sent, waiting for an answer')}
                          </small>
                        )}
                      </span>
                      {open ? (
                        <button
                          className="realm-button secondary"
                          disabled={busy}
                          onClick={() => {
                            setMenuFor(null);
                            act(() => removeFriend(selfId, f.user_id));
                          }}
                        >
                          {friend ? tr('Elimină', 'Remove') : tr('Anulează', 'Cancel')}
                        </button>
                      ) : (
                        friend && (
                          <>
                            <button className="realm-button secondary" onClick={() => onVisit(f, canHelp(f))}>
                              {tr('Vizitează', 'Visit')}
                            </button>
                            <button
                              className="realm-button"
                              title={tr('Luptă amicală cu echipa lui', 'Friendly fight against their team')}
                              aria-label={tr(`Provoacă-l pe ${f.name} la luptă`, `Challenge ${f.name} to a fight`)}
                              onClick={() => onChallenge(f)}
                            >
                              ⚔ {tr('Luptă', 'Fight')}
                            </button>
                          </>
                        )
                      )}
                      <button
                        className="realm-button secondary realm-friend-more"
                        aria-expanded={open}
                        aria-label={tr(`Mai multe: ${f.name}`, `More: ${f.name}`)}
                        onClick={() => setMenuFor(open ? null : f.user_id)}
                      >
                        {open ? '×' : '⋮'}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section className="realm-friends-find" aria-label={tr('Adaugă prieteni', 'Add friends')}>
            <h3>➕ {tr('Adaugă prieteni', 'Add friends')}</h3>
            <label className="realm-players-search">
              <input
                type="search"
                aria-label={tr('Caută un jucător', 'Search for a player')}
                placeholder={tr('Caută după nume…', 'Search by name…')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            {failed ? (
              <p className="realm-note">
                {tr(
                  'Lista nu s-a putut încărca. Verifică internetul.',
                  'The list could not load. Check your connection.',
                )}
              </p>
            ) : !players ? (
              <p className="realm-note">{tr('Se încarcă jucătorii…', 'Loading players…')}</p>
            ) : !players.length ? (
              <p className="realm-note">
                {search
                  ? tr('Niciun jucător cu acest nume.', 'No player by that name.')
                  : tr('Încă nu sunt alți jucători.', 'No other players yet.')}
              </p>
            ) : (
              <ul>
                {players
                  .filter((p) => p.user_id !== selfId && !friendOf(p.user_id))
                  .slice(0, search ? 30 : 8)
                  .map((p) => {
                    const self = p.user_id === selfId;
                    const friend = friendOf(p.user_id);
                    return (
                      <li key={p.user_id} className="realm-player-row">
                        <button className="realm-player" disabled={self} onClick={() => onVisit(p, canHelp(friend))}>
                          <Portrait p={p} />
                          <span className="realm-player-main">
                            <strong>
                              {p.name} {self && <em>{tr('tu', 'you')}</em>}
                            </strong>
                            <small>
                              {tr('Nv.', 'Lv.')} {p.level} · 🦖 {p.dinos} · ★ {p.stars} · {p.worlds}{' '}
                              {tr(p.worlds === 1 ? 'lume' : 'lumi', p.worlds === 1 ? 'world' : 'worlds')}
                            </small>
                          </span>
                          <span className="realm-player-seen">{lastSeen(p.updated_at, lang)}</span>
                          {!self && <span className="realm-player-visit">{tr('Vizitează', 'Visit')} →</span>}
                        </button>
                        {!self && !friend && (
                          <button
                            className="realm-button realm-player-add-text"
                            disabled={busy}
                            aria-label={tr(`Adaugă prieten: ${p.name}`, `Add friend: ${p.name}`)}
                            onClick={() => act(() => requestFriend(selfId, p.user_id))}
                          >
                            + {tr('Prieten', 'Friend')}
                          </button>
                        )}
                      </li>
                    );
                  })}
              </ul>
            )}
          </section>
          {settings}
        </TabPanel>
      )}
    </div>
  );
}
