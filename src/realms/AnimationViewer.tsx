import { PLAYABLE_DINOSAURS, isPlayableDinosaur } from './playableDinosaurs';
import { useEffect, useState } from 'react';
import { DinosaurArt } from './DinosaurArt';
import { loadAnimation, STAGE_CLIPS, type Clip, type Facing, type SpriteManifest } from './animation';
import { ELEMENTS, SPECIES, SPECIES_NAMES, type Species, type RealmId, type Stage } from './game';

export function AnimationViewer({ lang }: { lang: number }) {
  const [species, setSpecies] = useState<Species>('trex');
  const [element, setElement] = useState<RealmId>('fire');
  const [stage, setStage] = useState<Stage>('baby');
  const [clip, setClip] = useState<Clip>('idle');
  const [facing, setFacing] = useState<Facing>('se');
  const [manifest, setManifest] = useState<SpriteManifest | null>(null);
  const [playing, setPlaying] = useState(true),
    [frame, setFrame] = useState(0);
  const [scale, setScale] = useState(1),
    [dark, setDark] = useState(true),
    [bounds, setBounds] = useState(false);
  const [compare, setCompare] = useState(false);
  const tr = (ro: string, en: string) => (lang ? en : ro);
  useEffect(() => {
    let active = true;
    setManifest(null);
    setFrame(0);
    setClip('idle');
    loadAnimation(species, element, stage).then((m) => {
      if (active) {
        setManifest(m);
        setFacing('se');
        setClip(m?.clips.se?.idle ? 'idle' : m?.clips.se?.walk ? 'walk' : 'idle');
      }
    });
    return () => {
      active = false;
    };
  }, [species, element, stage]);
  const selected = manifest?.clips[facing]?.[clip];
  const size = manifest?.sourceSize ?? { width: 192, height: 192 };
  return (
    <>
      <p className="realm-intro">
        {tr(
          'Atelier de animație · modele, cadre și stadii de creștere.',
          'Animation studio · models, frames and growth stages.',
        )}
      </p>
      <div className="realm-viewer-controls">
        <select aria-label="Species" value={species} onChange={(e) => { const next = e.target.value as Species; setSpecies(next); if (!isPlayableDinosaur(next, element)) setElement(PLAYABLE_DINOSAURS.find(d => d.species === next)!.element); }}>
          {SPECIES.filter(s => PLAYABLE_DINOSAURS.some(d => d.species === s)).map((s) => (
            <option key={s} value={s}>
              {SPECIES_NAMES[s]}
            </option>
          ))}
        </select>
        <select aria-label="Element" value={element} onChange={(e) => setElement(e.target.value as RealmId)}>
          {ELEMENTS.filter(e => isPlayableDinosaur(species, e.id)).map((e) => (
            <option key={e.id} value={e.id}>
              {e.name[lang]}
            </option>
          ))}
        </select>
        <select aria-label="Stage" value={stage} onChange={(e) => setStage(e.target.value as Stage)}>
          {(['baby', 'juvenile', 'adult'] as Stage[]).map((s, i) => (
            <option key={s} value={s}>
              {(lang ? ['Baby', 'Juvenile', 'Adult'] : ['Copil', 'Juvenil', 'Adult'])[i]}
            </option>
          ))}
        </select>
        <select aria-label="Scale" value={scale} onChange={(e) => setScale(Number(e.target.value))}>
          {[1, 2, 3].map((n) => (
            <option key={n} value={n}>
              {n}×
            </option>
          ))}
        </select>
        <button onClick={() => setDark((v) => !v)}>{tr('Schimbă fundalul', 'Switch background')}</button>
      </div>
      <div className="realm-animation-toolbar">
        <select
          aria-label="Animation"
          value={clip}
          onChange={(e) => {
            setClip(e.target.value as Clip);
            setFrame(0);
          }}
        >
          {STAGE_CLIPS[stage].map((c) => (
            <option key={c} value={c} disabled={!manifest?.clips[facing]?.[c]}>
              {c}
            </option>
          ))}
        </select>
        <select aria-label="Facing" value={facing} onChange={(e) => {
          const next = e.target.value as Facing;
          setFacing(next); setFrame(0);
          const available = manifest?.clips[next];
          setClip(available?.idle ? 'idle' : STAGE_CLIPS[stage].find(c => available?.[c]) ?? 'idle');
        }}>
          <option value="se">SE ↘</option>
          <option value="ne">NE ↗</option>
        </select>
        <button
          disabled={!selected}
          onClick={() => {
            setPlaying((v) => !v);
            setFrame(0);
          }}
        >
          {playing ? tr('Pauză', 'Pause') : tr('Redă', 'Play')}
        </button>
        <button
          disabled={!selected}
          onClick={() => {
            setPlaying(false);
            setFrame((f) => (f + 1) % (selected?.durationsMs.length ?? 1));
          }}
        >
          {tr('Cadru următor', 'Next frame')} →
        </button>
        <label>
          <input type="checkbox" checked={bounds} onChange={(e) => setBounds(e.target.checked)} />
          {tr('Pivot și cadru', 'Pivot and bounds')}
        </label>
        <label>
          <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
          {tr('Compară stadiile', 'Compare stages')}
        </label>
      </div>
      <p className="realm-animation-status" role="status">
        {selected
          ? `${manifest?.status} · ${selected.durationsMs.length} ${tr('cadre', 'frames')} · ${selected.loop ? 'loop' : tr('o singură redare', 'one-shot')} · ${playing ? '▶' : `${frame + 1}/${selected.durationsMs.length}`}`
          : tr(
              'Concept static · animația acestui model nu este încă disponibilă.',
              'Static concept · animation for this model is not available yet.',
            )}
      </p>
      <div className={`realm-viewer ${dark ? '' : 'light'}`}>
        <div style={{ width: size.width * scale, height: size.height * scale, flexShrink: 0 }}>
          <DinosaurArt
            key={`${species}-${element}-${stage}-${clip}-${facing}-${playing}`}
            species={species}
            element={element}
            stage={stage}
            animation={clip}
            facing={facing}
            paused={!playing}
            frame={playing ? undefined : frame}
            bounds={bounds}
          />
        </div>
      </div>
      {compare && (
        <div className="realm-stage-comparison">
          {(['baby', 'juvenile', 'adult'] as Stage[]).map((s) => (
            <figure key={s}>
              <DinosaurArt species={species} element={element} stage={s} paused={!playing} />
              <figcaption>{s}</figcaption>
            </figure>
          ))}
        </div>
      )}
      <p className="realm-note">
        {tr(
          'Doar clipurile produse sunt redate. Cadrele de luptă nu sunt disponibile pentru copii. Modelele și animațiile PixelLab sunt marcate prototype până la verificarea vizuală.',
          'Only produced clips are played. Babies have no battle clips. PixelLab models and animations remain prototype until visual validation.',
        )}
      </p>
      <div className="realm-reference-links">
        <a href="/realms/references/01_character_evolutions.png" target="_blank" rel="noreferrer">
          {tr('Planșa evoluțiilor', 'Evolution reference')} ↗
        </a>
      </div>
    </>
  );
}
