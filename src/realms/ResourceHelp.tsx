import { createContext, useContext, type ReactNode } from 'react';
import { ITEMS, RECIPES, type ItemId } from './content';
import type { Save } from './game';
import { Icon, type IconName } from './ui/Icon';
import './resource-help.css';

export type HelpDestination = 'habitat' | 'farm' | 'workshop' | 'expedition' | 'build' | 'realms' | 'hatchery' | 'dino' | 'arena';
export type HelpRoute = { panel: HelpDestination; recipe?: string; realm?: string; building?: 'farm' | 'workshop' };
export const ResourceHelpContext = createContext<((route: HelpRoute) => void) | null>(null);
export function RequirementLink({ title, detail, route, action }: { title: string; detail: string; route?: HelpRoute; action?: () => void }) {
  const navigate = useContext(ResourceHelpContext);
  return <button type="button" className="requirement-link" onClick={() => action ? action() : route && navigate?.(route)}><span className="requirement-info" aria-hidden="true">i</span><span><strong>{title}</strong><small>{detail}</small></span><span aria-hidden="true">→</span></button>;
}

export function ResourceHelp({ save, lang, gold = 0, food = 0, materials = {}, children }: {
  save: Save; lang: number; gold?: number; food?: number; materials?: Partial<Record<ItemId, number>>; children?: ReactNode;
}) {
  const navigate = useContext(ResourceHelpContext);
  const tr = (ro: string, en: string) => lang ? en : ro;
  const entries: { id: string; name: string; have: number; need: number; icon: IconName; route: HelpRoute; source: string }[] = [];
  if (gold > 0) entries.push({ id: 'gold', name: tr('Aur', 'Gold'), have: Math.floor(save.gold), need: gold, icon: 'gold', route: { panel: 'habitat' }, source: tr('Colectează aurul din habitate', 'Collect gold from habitats') });
  if (food > 0) entries.push({ id: 'food', name: tr('Hrană', 'Food'), have: save.food, need: food, icon: 'food', route: { panel: save.buildings.some(b => b.kind === 'farm') ? 'farm' : 'build', building: 'farm' }, source: save.buildings.some(b => b.kind === 'farm') ? tr('Cultivă și recoltează la Fermă', 'Grow and harvest at the Farm') : tr('Construiește Ferma pentru hrană', 'Build the Farm for food') });
  for (const [item, need] of Object.entries(materials) as [ItemId, number][]) {
    if (!need) continue;
    const recipe = RECIPES.find(r => r.output === item);
    const hasWorkshop = save.buildings.some(b => b.kind === 'workshop');
    entries.push({ id: item, name: ITEMS[item].name[lang], have: save.inventory[item], need,
      icon: item === 'provisions' ? 'chest' : item,
      route: recipe ? { panel: hasWorkshop ? 'workshop' : 'build', recipe: recipe.id, building: 'workshop' } : { panel: 'expedition' },
      source: recipe ? hasWorkshop ? `${tr('Fabrică în Atelier', 'Craft in Workshop')}: ${recipe.name[lang]}` : tr('Construiește Atelierul', 'Build the Workshop') : tr('Obține din recompensele expedițiilor', 'Earn from expedition rewards'),
    });
  }
  const missing = entries.filter(e => e.have < e.need);
  if (!entries.length && !children) return null;
  return <details className={`resource-help ${missing.length ? 'has-missing' : 'ready'}`} key={missing.length ? 'missing' : 'ready'}>
    <summary><span className="requirement-info" aria-hidden="true">i</span>{missing.length ? tr(`Ce lipsește? ${missing.length} ${missing.length === 1 ? 'resursă' : 'resurse'}`, `What’s missing? ${missing.length} ${missing.length === 1 ? 'resource' : 'resources'}`) : tr('Costuri și surse', 'Costs and sources')}</summary>
    <div className="resource-help-list">{entries.map(e => {
      const short = e.have < e.need;
      return <div className={`resource-help-row ${short ? 'short' : 'enough'}`} key={e.id}><div><Icon name={e.icon} scale={1} /><strong>{e.name}</strong><span>{e.have}/{e.need} {short ? `· ${tr('Lipsesc', 'Missing')} ${Math.ceil(e.need - e.have)}` : '✓'}</span></div>{short && navigate && <button type="button" onClick={() => navigate(e.route)}>{e.source} →</button>}</div>;
    })}{children}</div>
  </details>;
}
