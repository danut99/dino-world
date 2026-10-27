import { useCallback, useEffect, useState } from 'react';
import {
  acceptFriend,
  fetchAcceptHelp,
  fetchFriendScores,
  fetchWeeklyRanking,
  listFriends,
  listLeaderboard,
  listPlayers,
  removeFriend,
  requestFriend,
  saveAcceptHelp,
  type Friend,
  type Leaderboard,
  type PlayerSummary,
  type RankBy,
  type RankRow,
  type Score,
} from './cloud';
import { weekStart } from './daily';
import { DinosaurArt } from './DinosaurArt';
import { ELEMENTS, SPECIES, type Command, type Dino, type RealmId, type Save, type Species, type Stage } from './game';
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

/** The top players by weekly friendly wins, dinosaurs, champion level or stars; this player's own place is pinned below. */
function LeaderboardView({
  lang,
  selfId,
  visit,
  weekly,
}: {
  lang: number;
  selfId: string;
  visit: (p: PlayerSummary) => void;
  weekly: RankRow[] | null;
}) {
  const tr = (ro: string, en: string) => T(lang, ro, en);
  const [by, setBy] = useState<RankBy | 'wins'>('wins');
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
  const kinds: [RankBy | 'wins', string][] = [
    ['wins', `⚔ ${tr('Victorii', 'Wins')}`],
    ['dinos', `🦖 ${tr('Dinozauri', 'Dinosaurs')}`],
    ['level', `⬆ ${tr('Nivel', 'Level')}`],
    ['stars', `★ ${tr('Stele', 'Stars')}`],
  ];
  const score = (p: PlayerSummary) =>
    by === 'dinos' ? `${p.dinos}` : by === 'level' ? `${tr('Nv.', 'Lv.')} ${p.level}` : `${p.stars} ★`;
  const row = (p: PlayerSummary, rank: number) => {
    const self = p.user_id === selfId;
    return (
      <li key={p.user_id} className={`realm-rank-row${self ? ' self' : ''}${rank <= 3 ? ' podium' : ''}`}>
        <button className="realm-rank" disabled={self} onClick={() => visit(p)}>
          <span className="realm-rank-place">{MEDALS[rank - 1] ?? `#${rank}`}</span>
          <Portrait p={p} />
          <strong>
            {p.name} {self && <em>{tr('tu', 'you')}</em>}
          </strong>
          <span className="realm-rank-score">{score(p)}</span>
        </button>
      </li>
    );
  };
  // Tied players share a place: each one ranks after everyone strictly ahead of them.
  const ranks = by === 'wins' ? [] : (board?.top.map((p, i, all) => all.findIndex((q) => q[by] === p[by]) + 1) ?? []);
  const weeklyRanks = weekly?.map((r, i, all) => all.findIndex((q) => q.wins === r.wins) + 1) ?? [];
  return (
    <div className="realm-leaderboard">
      <div className="pk-chips" role="group" aria-label={tr('Clasament după', 'Rank by')}>
        {kinds.map(([id, label]) => (
          <button key={id} className="pk-chip" aria-pressed={by === id} onClick={() => setBy(id)}>
            {label}
          </button>
        ))}
      </div>
      {by === 'wins' ? (
        <>
          <p className="realm-note">
            {tr('Lupte amicale câștigate de luni încoace.', 'Friendly fights won since Monday.')}
          </p>
          {!weekly ? (
            <p className="realm-note">{tr('Se încarcă…', 'Loading…')}</p>
          ) : !weekly.length ? (
            <p className="realm-note">{tr('Clasamentul nu s-a putut încărca.', 'The ranking could not load.')}</p>
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
  const [view, setView] = useState<'friends' | 'players' | 'ranking'>('friends');
  const [players, setPlayers] = useState<PlayerSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [scores, setScores] = useState<Map<string, Score>>(new Map());
  const [acceptHelp, setAcceptHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ranking, setRanking] = useState<RankRow[] | null>(null);
  const [pickDefense, setPickDefense] = useState(false);
  const defense = save.defense.map((id) => save.dinos.find((d) => d.id === id)).filter((d): d is Dino => !!d);
  const defenseEligible = useCallback((d: Dino) => (d.stage === 'baby' ? (lang ? 'baby' : 'pui') : null), [lang]);

  const reloadFriends = () => listFriends(selfId).then(setFriends, () => {});
  useEffect(() => {
    void reloadFriends();
    fetchAcceptHelp(selfId).then(setAcceptHelp, () => {});
    fetchFriendScores(selfId).then(setScores, () => {});
    fetchWeeklyRanking(new Date(weekStart(Date.now()))).then(setRanking, () => setRanking([]));
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

  return (
    <div className="realm-players">
      <Tabs
        idBase="players"
        label={tr('Jucători', 'Players')}
        active={view}
        onChange={setView}
        tabs={[
          {
            id: 'friends',
            label: tr('Prieteni', 'Friends'),
            badge: friends.filter((f) => f.status === 'pending' && f.incoming).length,
          },
          { id: 'players', label: tr('Caută', 'Find') },
          { id: 'ranking', label: `🏆 ${tr('Clasament', 'Leaderboard')}` },
        ]}
      />
      {view === 'ranking' ? (
        <TabPanel idBase="players" id="ranking">
          <LeaderboardView
            lang={lang}
            selfId={selfId}
            weekly={ranking}
            visit={(p) => onVisit(p, canHelp(friendOf(p.user_id)))}
          />
        </TabPanel>
      ) : view === 'friends' ? (
        <TabPanel idBase="players" id="friends" className="realm-players">
          <section className="realm-friends" aria-label={tr('Prieteni', 'Friends')}>
            {!friends.length ? (
              <p className="realm-note">
                {tr(
                  'Încă n-ai prieteni. Caută jucători în tabul „Caută” și apasă +.',
                  'No friends yet. Find players in the “Find” tab and press +.',
                )}
              </p>
            ) : (
              <ul>
                {friends.map((f) => {
                  const score = scores.get(f.user_id);
                  return (
                    <li key={f.user_id} className="realm-friend">
                      <span>
                        <strong>{f.name}</strong>
                        <small>
                          {f.status === 'accepted'
                            ? f.acceptHelp
                              ? tr('Prieten · acceptă ajutor', 'Friend · accepts help')
                              : tr('Prieten', 'Friend')
                            : f.incoming
                              ? tr('Vrea să fiți prieteni', 'Wants to be friends')
                              : tr('Cerere trimisă', 'Request sent')}
                        </small>
                        {score && (
                          <small className="realm-friend-score">
                            ⚔ {tr('Tu', 'You')} {score.wins} – {score.losses} {f.name}
                            {score.draws > 0 &&
                              ` · ${score.draws} ${tr(score.draws === 1 ? 'remiză' : 'remize', score.draws === 1 ? 'draw' : 'draws')}`}
                          </small>
                        )}
                      </span>
                      {f.status === 'pending' && f.incoming && (
                        <button
                          className="realm-button"
                          disabled={busy}
                          onClick={() => act(() => acceptFriend(selfId, f.user_id))}
                        >
                          {tr('Acceptă', 'Accept')}
                        </button>
                      )}
                      {f.status === 'accepted' && (
                        <button
                          className="realm-button"
                          title={tr('Luptă amicală cu echipa lui', 'Friendly fight against their team')}
                          aria-label={tr(`Provoacă-l pe ${f.name} la luptă`, `Challenge ${f.name} to a fight`)}
                          onClick={() => onChallenge(f)}
                        >
                          ⚔
                        </button>
                      )}
                      {f.status === 'accepted' && (
                        <button className="realm-button" onClick={() => onVisit(f, canHelp(f))}>
                          {tr('Vizitează', 'Visit')}
                        </button>
                      )}
                      <button
                        className="realm-button secondary"
                        disabled={busy}
                        aria-label={tr(`Elimină ${f.name}`, `Remove ${f.name}`)}
                        onClick={() => act(() => removeFriend(selfId, f.user_id))}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section className="realm-friends-settings" aria-label={tr('Setări', 'Settings')}>
            <div className="realm-friends-defense">
              <span>{tr('Echipa de apărare', 'Defense team')}</span>
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
                label={tr('Apărare', 'Defense')}
                isEligible={defenseEligible}
                onChange={(ids) => run({ type: 'setDefense', dinoIds: ids })}
              />
            )}
            <label className="realm-friends-help">
              <input type="checkbox" checked={acceptHelp} onChange={(e) => toggleHelp(e.target.checked)} />
              <span>
                {tr('Prietenii îmi pot colecta aurul', 'Friends may collect my gold')}
                <small>
                  {tr('O dată pe oră, când îți vizitează lumea.', 'Once an hour, when they visit your world.')}
                </small>
              </span>
            </label>
          </section>
        </TabPanel>
      ) : (
        <TabPanel idBase="players" id="players" className="realm-players">
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
              {players.map((p) => {
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
                        className="realm-player-add"
                        disabled={busy}
                        aria-label={tr(`Adaugă prieten: ${p.name}`, `Add friend: ${p.name}`)}
                        title={tr('Adaugă prieten', 'Add friend')}
                        onClick={() => act(() => requestFriend(selfId, p.user_id))}
                      >
                        +
                      </button>
                    )}
                    {!self && (
                      <button
                        className="realm-player-add realm-player-duel"
                        aria-label={tr(`Duel cu ${p.name}`, `Duel ${p.name}`)}
                        title={tr('Duel', 'Duel')}
                        onClick={() => onChallenge(p)}
                      >
                        ⚔
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </TabPanel>
      )}
    </div>
  );
}
