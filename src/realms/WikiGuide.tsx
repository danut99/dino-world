import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './ui/Icon';

type Entry = { id: string; category: string; title: string; paragraphs: string[]; rows?: string[]; related: string[] };
const labels = {
  all: ['Ghidul exploratorului', "Explorer’s handbook"], start: ['Primii pași', 'Getting started'],
  dinosaurs: ['Dinozaurii tăi', 'Your dinosaurs'], worlds: ['Insula și lumile', 'Island and worlds'], activities: ['Aventuri și resurse', 'Adventures and resources'],
};
const descriptions = {
  start: ['De la primul ou la prima aventură.', 'From your first egg to your first adventure.'],
  dinosaurs: ['Specii, elemente, rarități și evoluție.', 'Species, elements, rarity and evolution.'],
  worlds: ['Construiește, deblochează și dezvoltă.', 'Build, unlock and grow.'],
  activities: ['Pregătește echipa și câștigă recompense.', 'Prepare your team and earn rewards.'],
};
const categoryIcons: Record<string, IconName> = { all: 'wiki', start: 'egg', dinosaurs: 'dino', worlds: 'build', activities: 'expedition' };
const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function WikiGuide({ lang, articles, icons, gallery }: {
  lang: number; articles: Entry[]; icons: Record<string, IconName>; gallery: (id: string) => ReactNode;
}) {
  const tr = (ro: string, en: string) => lang ? en : ro;
  const [query, setQuery] = useState(''), [category, setCategory] = useState('all'), [selected, setSelected] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null), content = useRef<HTMLDivElement>(null);
  const article = articles.find(a => a.id === selected);
  const results = articles.filter(a => (category === 'all' || category === a.category) && normalize([a.title, ...a.paragraphs, ...(a.rows ?? [])].join(' ')).includes(normalize(query)));
  const open = (id: string | null) => setSelected(id);
  useEffect(() => {
    content.current?.scrollTo(0, 0);
    const scroller = root.current?.closest('.realm-window-body');
    if (scroller) scroller.scrollTop = 0;
  }, [selected, category, query]);
  const card = (a: Entry) => <button className="wiki-entry" key={a.id} onClick={() => open(a.id)}>
    <span className="wiki-entry-icon"><Icon name={icons[a.id]} /></span>
    <span className="wiki-entry-text"><strong>{a.title}</strong><span>{a.paragraphs[0].split('. ')[0]}.</span></span>
    <span className="wiki-entry-arrow" aria-hidden="true">›</span>
  </button>;
  return <div className="realms-wiki" ref={root}>
    <div className="wiki-toolbar"><span><Icon name="wiki" /> {tr('CODEXUL INSULELOR', 'ISLAND CODEX')}</span>
      <label className="realms-wiki-search"><span className="sr-only">{tr('Caută în Wikipedia', 'Search Wikipedia')}</span><input type="search" value={query} placeholder={tr('Ce vrei să afli?', 'What would you like to know?')} onChange={e => { setQuery(e.target.value); open(null); }} /></label>
    </div>
    <div className="realms-wiki-layout">
      <nav aria-label={tr('Categorii Wikipedia', 'Wikipedia categories')}>
        <small>{tr('CUPRINS', 'CONTENTS')}</small>
        {Object.entries(labels).map(([id, title]) => <button key={id} aria-pressed={category === id} onClick={() => { setCategory(id); open(null); setQuery(''); }}><Icon name={categoryIcons[id]} /><span>{title[lang]}</span><small>{id === 'all' ? articles.length : articles.filter(a => a.category === id).length}</small></button>)}
        <aside className="wiki-sidebar-note"><Icon name="star" /><p>{tr('Un pas pe rând. Crește-ți campionul, pregătește proviziile și explorează.', 'One step at a time. Raise your champion, pack supplies and explore.')}</p></aside>
      </nav>
      <div className="realms-wiki-content" ref={content}>
        {article ? <article>
          <button className="wiki-back" onClick={() => open(null)}>← {tr('Înapoi la articole', 'Back to articles')}</button>
          <header className="wiki-article-title"><span className="wiki-emblem"><Icon name={icons[article.id]} scale={3} /></span><div><small>{labels[article.category as keyof typeof labels][lang]}</small><h2>{article.title}</h2></div></header>
          <div className="wiki-takeaway"><span>{tr('DE REȚINUT', 'AT A GLANCE')}</span><p>{article.paragraphs[0].split('. ')[0]}.</p></div>
          <section className="wiki-explanation"><h3>{tr('Cum funcționează', 'How it works')}</h3>{article.paragraphs.map((p, i) => <div className="wiki-paragraph" key={p}><span>{String(i + 1).padStart(2, '0')}</span><p>{p}</p></div>)}</section>
          {gallery(article.id)}
          {article.rows && <section className="wiki-reference"><h3>{tr('În detaliu', 'Field notes')}</h3><ul>{article.rows.map((row, i) => <li key={row}><span className="wiki-row-number">{String(i + 1).padStart(2, '0')}</span><span>{row}</span></li>)}</ul></section>}
          <footer className="wiki-next"><h3>{tr('Continuă să descoperi', 'Keep exploring')}</h3><div className="realms-wiki-related">{article.related.map(id => { const a = articles.find(a => a.id === id); return a ? <button key={id} onClick={() => open(id)}><Icon name={icons[id]} /><span>{a.title}</span> →</button> : null; })}</div></footer>
        </article> : <>
          {!query && category === 'all' && <>
            <header className="wiki-welcome"><div><small>DINO REALMS / {tr('GHID DE JOC', 'GAME GUIDE')}</small><h2>{tr('Fiecare aventură începe\ncu o descoperire.', 'Every adventure starts\nwith a discovery.')}</h2><p>{tr('Tot ce ai nevoie pentru a-ți crește dinozaurii și a stăpâni cele zece lumi.', 'Everything you need to raise your dinosaurs and master the ten worlds.')}</p><button onClick={() => open('start')}>{tr('Începe aventura', 'Start your journey')} →</button></div><div className="wiki-welcome-art" aria-hidden="true"><img src="/realms/worlds/home-island-original-filled.png" alt="" /></div></header>
            <section className="wiki-path"><h3>{tr('Drumul primului campion', 'Your first champion’s journey')}</h3><div>{[['eggs', 'Eclozează', 'Hatch'], ['evolution', 'Crește și evoluează', 'Raise and evolve'], ['expeditions', 'Explorează', 'Explore']].map(([id, ro, en], i) => <button key={id} onClick={() => open(id)}><b>0{i + 1}</b><Icon name={icons[id]} /><span>{tr(ro, en)}</span><span aria-hidden="true">→</span></button>)}</div></section>
          </>}
          <div className="wiki-list-heading"><h2>{query ? tr('Rezultatele căutării', 'Search results') : category === 'all' ? tr('Ghidul Dino Realms', 'Dino Realms guide') : labels[category as keyof typeof labels][lang]}</h2><span role="status">{results.length} {tr('articole', 'articles')}</span></div>
          {!results.length && <p>{tr('Niciun rezultat. Încearcă alt cuvânt sau altă categorie.', 'No results. Try another word or category.')}</p>}
          {(category === 'all' && !query ? Object.keys(descriptions) : [category]).map(group => {
            const entries = category === 'all' && !query ? results.filter(a => a.category === group) : results;
            return <section className="wiki-topic" key={group}>{category === 'all' && !query && <header><Icon name={categoryIcons[group]} /><div><h3>{labels[group as keyof typeof labels][lang]}</h3><p>{descriptions[group as keyof typeof descriptions][lang]}</p></div></header>}<div className="realms-wiki-results">{entries.map(card)}</div></section>;
          })}
        </>}
      </div>
    </div>
  </div>;
}
