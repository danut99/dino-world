import { describe, expect, it } from 'vitest';
import { ENCOUNTERS } from './content';
import {
  EGG_DROP,
  ELEMENTS,
  RARITY_POWER,
  eggOdds,
  rewardPreview,
  command,
  newSave,
  parseSave,
  rarityOdds,
  stats,
  strikeDamage,
  type Rarity,
  type Save,
} from './game';

const now = 1_000_000;
const run = (s: Save, ...commands: Parameters<typeof command>[1][]) => commands.reduce((x, c) => command(x, c, now), s);

describe('rarity', () => {
  it('makes rarer dinosaurs stronger at the same level: +10%, +20%, +35%', () => {
    const base = stats(20, 'juvenile', 'trex');
    for (const r of ['rare', 'epic', 'legendary'] as Rarity[]) {
      const st = stats(20, 'juvenile', 'trex', r);
      expect(st.hp / base.hp).toBeCloseTo(RARITY_POWER[r], 1);
      expect(st.power / base.power).toBeCloseTo(RARITY_POWER[r], 1);
    }
    const hit = (rarity: Rarity) => strikeDamage({ level: 20, stage: 'juvenile', species: 'trex', rarity }, 'basic');
    expect(hit('epic')).toBeGreaterThan(hit('rare'));
    expect(hit('rare')).toBeGreaterThan(hit('common'));
  });
  it('pays better odds on harder arena tiers', () => {
    const tier = (n: number) => rarityOdds(ENCOUNTERS.find((e) => e.id === `arena-fire-${n}`)!);
    expect(tier(3).epic).toBeGreaterThan(tier(2).epic);
    expect(tier(2).epic).toBeGreaterThan(tier(1).epic);
    expect(rarityOdds({ id: 'training', mode: 'expedition' }).epic).toBeLessThan(tier(1).epic);
  });
  it('drops eggs more often on harder tiers, only in fight-only worlds', () => {
    const e = (id: string) => ENCOUNTERS.find((x) => x.id === id)!;
    expect([1, 2, 3].map((t) => eggOdds(e(`arena-nature-${t}`))?.chance)).toEqual(EGG_DROP.tiers);
    expect(EGG_DROP.tiers).toEqual([0.1, 0.12, 0.15]);
    for (const market of ['fire', 'water', 'earth']) expect(eggOdds(e(`arena-${market}-2`))).toBeNull();
    // The preview shows the boss egg while it is owed (market worlds too), then the real chance.
    const s = newSave(0);
    expect(rewardPreview(s, 'arena-fire-3', 1)).toMatchObject({ bossEgg: true, eggChance: undefined });
    s.bossEggsClaimed = ['fire', 'nature'];
    expect(rewardPreview(s, 'arena-fire-3', 1)).toMatchObject({ bossEgg: false, eggChance: undefined });
    expect(rewardPreview(s, 'arena-nature-3', 1)).toMatchObject({ bossEgg: false, eggChance: 0.15 });
    // A full pity counter shows the certain egg, but only where eggs drop at all.
    s.eggLuck = EGG_DROP.pity;
    expect(rewardPreview(s, 'arena-nature-1', 1)?.eggChance).toBe(1);
    expect(rewardPreview(s, 'arena-fire-1', 1)?.eggChance).toBeUndefined();
  });
  it('rolls common, rare and epic eggs from expeditions in about the expected shares', () => {
    const counts: Record<string, number> = { common: 0, rare: 0, epic: 0 };
    let s = newSave(0);
    s.dinos = [{ id: 'd', species: 'trex', element: 'fire', level: 20, stage: 'juvenile', nickname: 'T' }];
    s.champion = 'd';
    s.habitats = Object.fromEntries(ELEMENTS.map((e) => [e.id, 1])); // eggs come from worlds the market does not sell
    s.buildings.push({ id: 'p', kind: 'portal', x: 6, y: 1 });
    s.portalLevel = 1;
    // The fire region's last stage always brings an egg.
    for (let i = 0; i < 400; i++) {
      s.expeditionProgress = { training: 4 };
      s.expeditions = [];
      s.revision = i;
      const sent = command(s, { type: 'expedition', regionId: 'training', team: ['d'] }, i * 1000);
      const egg = sent.expeditions[0]?.reward.egg;
      if (egg) counts[egg.rarity ?? 'common']++;
    }
    const total = counts.common + counts.rare + counts.epic;
    expect(total).toBeGreaterThan(300);
    expect(counts.common / total).toBeGreaterThan(0.6);
    expect(counts.rare / total).toBeGreaterThan(0.1);
    expect(counts.epic / total).toBeGreaterThan(0);
    expect(counts.epic / total).toBeLessThan(0.12);
  });
  it('keeps market eggs common and passes an egg rarity on to the dinosaur that hatches', () => {
    let s = run(newSave(now), { type: 'incubate' }, { type: 'devSkip' }, { type: 'hatch' }, { type: 'devResources' });
    s = run(s, { type: 'build', kind: 'market', x: 6, y: 1 });
    const bought = run(s, { type: 'buyEgg', species: 'trex', element: 'fire' });
    expect(bought.eggs.at(-1)?.rarity).toBeUndefined();
    const epic = structuredClone(bought);
    epic.eggs.at(-1)!.rarity = 'epic';
    const egg = epic.eggs.at(-1)!;
    let hatched = run(epic, { type: 'incubate', eggId: egg.id }, { type: 'devSkip' });
    hatched = run(hatched, { type: 'hatch', eggId: egg.id });
    expect(hatched.dinos.at(-1)?.rarity).toBe('epic');
  });
  it('treats a dinosaur without a rarity as common and refuses unknown rarities', () => {
    const s = run(newSave(now), { type: 'incubate' }, { type: 'devSkip' }, { type: 'hatch' });
    const old = JSON.parse(JSON.stringify(s));
    delete old.dinos[0].rarity;
    expect(parseSave(JSON.stringify(old)).dinos[0].rarity).toBeUndefined();
    const corrupt = structuredClone(s);
    (corrupt.dinos[0] as { rarity?: string }).rarity = 'mythic';
    expect(() => parseSave(JSON.stringify(corrupt))).toThrow();
  });
});
