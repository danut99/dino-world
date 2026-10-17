import type { Save } from './game';

/** A pre-v5 save: one `dino`, one `egg`, the farm timer and the fire-world bonus. */
export function legacy(s: Save, schemaVersion: number) {
  const { dinos, champion, eggs, hatcheryLevel, habitats, questEggs, farmLevel, plots, ...rest } = s;
  void [champion, eggs, hatcheryLevel, habitats, questEggs, farmLevel, plots];
  const d = dinos[0];
  return {
    ...rest,
    // v4 already had farm levels; older saves had the single farm timer instead.
    ...(schemaVersion >= 4 ? { farmLevel, plots } : {}),
    schemaVersion,
    egg: d ? 'hatched' : 'inventory',
    hatchAt: null,
    dino: d ? { level: d.level, stage: d.stage, nickname: d.nickname, realm: 'fire' } : null,
    farmAt: null,
    worldIncomeBonus: 0,
  };
}
