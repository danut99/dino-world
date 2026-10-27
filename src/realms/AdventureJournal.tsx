import { useState } from 'react';
import {
  ELEMENTS,
  GEM_SOURCES,
  LEGEND_TRIAL,
  legendTrialsLeft,
  SPECIES_NAMES,
  STORY_CHAPTERS,
  storyChapter,
  type Command,
  type Save,
} from './game';
import { collectionTargets, goalPurpose, nextStoryStep, type JourneyRoute } from './journey';
import { DinosaurArt } from './DinosaurArt';
import { Tabs, TabPanel } from './ui/Tabs';
import { Icon } from './ui/Icon';
import './journey.css';

export function CollectionGoals({
  save,
  lang,
  navigate,
}: {
  save: Save;
  lang: number;
  navigate: (route: JourneyRoute) => void;
}) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const targets = collectionTargets(save);
  return (
    <div className="collection-goals">
      <p className="journey-intro">
        {tr(
          'Alege un companion de urmărit. Aceste familii sunt din lumile pe care le-ai deschis deja.',
          'Choose a companion to work toward. These families belong to worlds you have already opened.',
        )}
      </p>
      {targets.length ? (
        targets.map((t) => (
          <article
            key={t.id}
            className="collection-goal"
            style={{ '--goal-color': ELEMENTS.find((e) => e.id === t.element)!.color } as React.CSSProperties}
          >
            <div className="collection-goal-art">
              <DinosaurArt species={t.species} element={t.element} stage="juvenile" paused frame={0} />
            </div>
            <div>
              <h3>{t.name}</h3>
              <strong>{t.source[lang]}</strong>
              <p>{t.detail[lang]}</p>
            </div>
            <button type="button" className="realm-button secondary" onClick={() => navigate(t.route)}>
              {tr('Vezi sursa', 'See source')} →
            </button>
          </article>
        ))
      ) : (
        <div className="journey-empty">
          <Icon name="collection" scale={2} />
          <h3>{tr('Ai descoperit familiile accesibile!', 'You found the available families!')}</h3>
          <p>
            {tr(
              'Continuă povestea pentru a deschide lumi și familii noi. Boșii se câștigă separat în ligile arenei.',
              'Continue the story to open more worlds and families. Bosses are earned separately in arena leagues.',
            )}
          </p>
          <button type="button" className="realm-button" onClick={() => navigate('realms')}>
            {tr('Explorează lumile', 'Explore worlds')} →
          </button>
        </div>
      )}
    </div>
  );
}

export function AdventureJournal({
  save,
  now,
  lang,
  run,
  navigate,
}: {
  save: Save;
  now: number;
  lang: number;
  run: (c: Command) => boolean;
  navigate: (route: JourneyRoute) => void;
}) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  const current = storyChapter(save);
  const [tab, setTab] = useState<'story' | 'collection'>('story');
  const [selected, setSelected] = useState(current?.chapter.number ?? 10);
  const chapter = STORY_CHAPTERS.find((c) => c.number === selected)!;
  const finale = chapter.steps.find((s) => s.species);
  const next = nextStoryStep(save);
  const complete = chapter.steps.filter((s) => save.questEggs.includes(s.id)).length;
  return (
    <div className="adventure-journal fit-panel">
      <Tabs
        idBase="journal"
        label={tr('Jurnalul aventurii', 'Adventure journal')}
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'story', label: tr('Poveste', 'Story') },
          { id: 'collection', label: tr('Descoperiri', 'Discoveries') },
        ]}
      />
      {tab === 'story' ? (
        <TabPanel idBase="journal" id="story" className="journey-story">
          <nav className="journey-chapters" aria-label={tr('Capitole', 'Chapters')}>
            {STORY_CHAPTERS.map((c) => (
              <button
                type="button"
                key={c.number}
                aria-pressed={selected === c.number}
                onClick={() => setSelected(c.number)}
                title={c.title[lang]}
              >
                {c.steps.every((s) => save.questEggs.includes(s.id)) ? '✓' : c.number}
              </button>
            ))}
          </nav>
          <div className="journey-scroll" data-scroll>
            {!current && (
              <div className="journey-prize">
                <Icon name="egg" scale={1} />
                <span>
                  {tr('Proba legendei', 'Legend trial')}:{' '}
                  <b>
                    {legendTrialsLeft(save, now)}/{LEGEND_TRIAL.perWeek}
                  </b>{' '}
                  {tr('săptămâna asta', 'left this week')}
                  <small>
                    {tr(
                      `${LEGEND_TRIAL.gold} aur + ${LEGEND_TRIAL.food} hrană → ${LEGEND_TRIAL.gems} 💎 și un ou, adesea rar sau epic.`,
                      `${LEGEND_TRIAL.gold} gold + ${LEGEND_TRIAL.food} food → ${LEGEND_TRIAL.gems} 💎 and an egg, often rare or epic.`,
                    )}
                  </small>
                </span>
                <button
                  type="button"
                  className="realm-button"
                  disabled={
                    !legendTrialsLeft(save, now) || save.gold < LEGEND_TRIAL.gold || save.food < LEGEND_TRIAL.food
                  }
                  onClick={() => run({ type: 'legendTrial' })}
                >
                  {tr('Începe proba', 'Start trial')}
                </button>
              </div>
            )}
            <header className="journey-heading">
              <span>
                {tr('CAPITOLUL', 'CHAPTER')} {chapter.number} · {complete}/{chapter.steps.length}
              </span>
              <h2>{chapter.title[lang]}</h2>
              <p>
                {selected > (current?.chapter.number ?? 10)
                  ? tr(
                      'O privire spre ce urmează. Continuă capitolul curent pentru a ajunge aici.',
                      'A preview of what lies ahead. Continue your current chapter to reach this one.',
                    )
                  : tr(
                      'Urmează pașii în ordine. Fiecare premiu revendicat te duce la următoarea țintă.',
                      'Follow the steps in order. Each claimed reward takes you to the next goal.',
                    )}
              </p>
            </header>
            {finale?.species && (
              <div className="journey-prize">
                <Icon name="egg" scale={1} />
                <span>
                  {tr('Ținta capitolului', 'Chapter goal')}: <b>{SPECIES_NAMES[finale.species]}</b> ·{' '}
                  {GEM_SOURCES.chapter} 💎
                  <small>
                    {tr(
                      'Oul se acordă la misiunea marcată mai jos.',
                      'The egg is awarded at the marked mission below.',
                    )}
                  </small>
                </span>
              </div>
            )}
            <ol className="journey-steps">
              {chapter.steps.map((step, i) => {
                const claimed = save.questEggs.includes(step.id);
                const active = current?.step.id === step.id;
                const ready = active && step.done(save);
                return (
                  <li
                    key={step.id}
                    className={`${claimed ? 'done' : active ? 'current' : 'future'}`}
                    aria-current={active ? 'step' : undefined}
                  >
                    <span className="journey-step-number">{claimed ? '✓' : i + 1}</span>
                    <div>
                      <span className="journey-step-state">
                        {claimed
                          ? tr('ÎNCHEIAT', 'COMPLETE')
                          : active
                            ? tr('ACUM', 'NOW')
                            : tr('ÎN CURÂND', 'COMING UP')}
                      </span>
                      <h3>{step.task[lang]}</h3>
                      <p>{goalPurpose(step)[lang]}</p>
                      {active && (
                        <p className="journey-how">
                          {ready
                            ? tr(
                                'Obiectiv îndeplinit. Ia premiul pentru a continua.',
                                'Goal complete. Claim your reward to continue.',
                              )
                            : step.hint[lang]}
                        </p>
                      )}
                      <small className="journey-step-reward">
                        +{step.gold} {tr('aur', 'gold')} · +{step.food} {tr('hrană', 'food')}
                        {step.species && ` · ${tr('ou de', 'egg:')} ${SPECIES_NAMES[step.species]}`}
                      </small>
                      {active && (
                        <button
                          type="button"
                          className="realm-button"
                          onClick={() => {
                            if (ready) {
                              if (run({ type: 'claimQuestEgg', questId: step.id }))
                                setSelected(next?.chapter ?? selected);
                            } else navigate(step.panel);
                          }}
                        >
                          {ready ? tr('Ia premiul', 'Claim reward') : tr('Continuă aventura', 'Continue adventure')} →
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
          {next && (
            <p className="journey-next">
              {tr('După obiectivul curent', 'After your current goal')}: <b>{next.task[lang]}</b>
            </p>
          )}
        </TabPanel>
      ) : (
        <TabPanel idBase="journal" id="collection" className="journey-scroll" data-scroll>
          <CollectionGoals
            save={save}
            lang={lang}
            navigate={(route) => {
              if (route === 'journey') {
                setSelected(current?.chapter.number ?? 10);
                setTab('story');
              } else navigate(route);
            }}
          />
          <button type="button" className="realm-link journey-open-album" onClick={() => navigate('collection')}>
            {tr('Răsfoiește întreaga colecție', 'Browse the full collection')} →
          </button>
        </TabPanel>
      )}
    </div>
  );
}
