import { describe, expect, it } from 'vitest';
import { DINOSAURS, SPECIES, STAGES, dinosaurCell, dinosaurCrop, worldResidents, loadDinosaurArt } from './dinosaurs';
import crops from './dinosaur-crops.json';
import { ELEMENTS } from './game';

describe('reference dinosaur catalog', () => {
  it('covers every species, element and evolution without duplicate identities', async () => {
    expect(DINOSAURS).toHaveLength(50);
    expect(new Set(DINOSAURS.map(d => d.id)).size).toBe(50);
    const cells = new Set<string>();
    for (const element of ELEMENTS) {
      await loadDinosaurArt(element.id);
      expect(worldResidents(element.id).map(d => d.species)).toEqual([...SPECIES]);
      for (const species of SPECIES) for (const stage of STAGES) {
        expect(Object.keys(crops)).toContain(element.id);
        const crop = dinosaurCrop(element.id, species, stage);
        expect(crop.width).toBeGreaterThan(0);
        expect(crop.height).toBeGreaterThan(0);
        expect(crop.x).toBeGreaterThanOrEqual(0);
        expect(crop.y).toBeGreaterThanOrEqual(0);
        expect(crop.x + crop.width).toBeLessThanOrEqual(crop.sheetWidth);
        expect(crop.y + crop.height).toBeLessThanOrEqual(crop.sheetHeight);
        const { column, row } = dinosaurCell(species, stage);
        cells.add(`${element.id}:${column}:${row}`);
        expect(column).toBeGreaterThanOrEqual(0);
        expect(column).toBeLessThan(3);
        expect(row).toBeGreaterThanOrEqual(0);
        expect(row).toBeLessThan(5);
      }
    }
    expect(cells.size).toBe(150);
  });
});
