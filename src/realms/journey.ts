import { REGIONS } from './content';
import {
  COLLECTION,
  ELEMENTS,
  MARKET_ELEMENTS,
  SPECIES_NAMES,
  STORY_CHAPTERS,
  eggPrice,
  storyChapter,
  type RealmId,
  type Save,
  type Species,
  type StoryStep,
} from './game';

export type JourneyRoute = StoryStep['panel'] | 'market' | 'journey';
type Copy = readonly [string, string];

const PURPOSE: Partial<Record<StoryStep['id'], Copy>> = {
  'c1-hatch': [
    'Primul tău companion. Îl vei crește și vei explora lumile alături de el.',
    'Your first companion. Raise it and explore the worlds together.',
  ],
  'c1-farm': [
    'Hrana te ajută să-l crești până la juvenil, când poate pleca în expediții.',
    'Food helps your companion reach juvenile stage and join expeditions.',
  ],
  'w-earth-market': [
    'Mai multe familii înseamnă mai multe alegeri pentru echipă. Construiește Piața; cumpărarea unui ou rămâne opțională.',
    'More families give you more team choices. Build the Market; buying an egg stays optional.',
  ],
  'c1-grow': [
    'La nivelul 10 devine juvenil și poate explora prima regiune.',
    'At level 10 it becomes juvenile and can explore the first region.',
  ],
  'c1-portal': [
    'Prima aventură durează un minut. Echipa se întoarce cu resurse și un bilet de arenă.',
    'Your first adventure takes one minute. The team returns with resources and an arena ticket.',
  ],
  'c1-trip': [
    'Etapa 3 deschide patrulele și accesul la lumea Apei. La finalul capitolului primești un ou de Ignasaur.',
    'Stage 3 opens patrols and access to the Water world. Finish the chapter to earn an Ignasaur egg.',
  ],
};

/** Explain what an existing goal enables, without adding another gate or reward. */
export function goalPurpose(step: StoryStep): Copy {
  if (PURPOSE[step.id]) return PURPOSE[step.id]!;
  if (step.id.endsWith('-open'))
    return [
      'Un habitat nou găzduiește alte familii și deschide regiunea acelei lumi.',
      'A new habitat houses more families and opens that world’s region.',
    ];
  if (step.id.endsWith('-trip'))
    return [
      'Etapele aduc resurse; de la etapa 3 poți trimite patrule pentru reveniri mai lungi.',
      'Stages bring resources; after stage 3 you can send patrols between longer visits.',
    ];
  if (step.id.endsWith('-league'))
    return [
      'Pune în practică avantajele elementale. Stelele deschid următoarea treaptă a ligii.',
      'Put elemental advantages to work. Stars open the next league tier.',
    ];
  const byPanel: Record<StoryStep['panel'], Copy> = {
    farm: ['Mai multă hrană pentru echipele pe care le pregătești.', 'More food for the teams you are raising.'],
    workshop: [
      'Pregătește obiectele și proviziile necesare aventurilor următoare.',
      'Prepare the items and supplies your next adventures need.',
    ],
    arena: [
      'Testează ordinea echipei și avantajele elementale pentru stele și recompense.',
      'Test team order and elemental advantages for stars and rewards.',
    ],
    hatchery: ['Fă loc următorilor companioni din colecție.', 'Make room for the next companions in your collection.'],
    dino: [
      'Un companion mai puternic poate aborda provocările următoare.',
      'A stronger companion can take on the next challenges.',
    ],
    build: [
      'Pregătește insula pentru următoarea parte a aventurii.',
      'Prepare your island for the next part of the adventure.',
    ],
    expedition: [
      'Explorează pentru materiale, bilete și familii noi.',
      'Explore for materials, tickets and new families.',
    ],
    realms: ['Extinde habitatele pentru noii membri ai echipei.', 'Expand habitats for your new team members.'],
    collection: [
      'Descoperă familii diferite și construiește echipe pentru mai multe situații.',
      'Discover different families and build teams for more situations.',
    ],
  };
  return byPanel[step.panel];
}

export function nextStoryStep(save: Save): StoryStep | undefined {
  const current = storyChapter(save);
  if (!current) return undefined;
  const all = STORY_CHAPTERS.flatMap((c) => c.steps);
  return all.slice(all.findIndex((s) => s.id === current.step.id) + 1).find((s) => !save.questEggs.includes(s.id));
}

export type CollectionTarget = {
  id: string;
  species: Species;
  element: RealmId;
  name: string;
  route: JourneyRoute;
  source: Copy;
  detail: Copy;
};

/** Only recommend undiscovered families from open worlds, with a real acquisition route. */
export function collectionTargets(save: Save): CollectionTarget[] {
  const known = new Set([...save.discovered, ...save.dinos.map((d) => `${d.species}_${d.element}`)]);
  const pending = new Set([...save.eggs, ...save.owedEggs].map((e) => `${e.species}_${e.element}`));
  return COLLECTION.filter((id) => !id.startsWith('boss_') && !known.has(id))
    .map((id): CollectionTarget | null => {
      const [species, element] = id.split('_') as [Species, RealmId];
      if (!save.habitats[element]) return null;
      const base = { id, species, element, name: SPECIES_NAMES[species] };
      if (pending.has(id))
        return {
          ...base,
          route: 'hatchery' as const,
          source: ['Oul te așteaptă', 'Your egg is waiting'] as Copy,
          detail: [
            'Deschide incubatorul. Dacă raftul e plin, verifică și ouăle în așteptare.',
            'Open the hatchery. If the shelf is full, also check waiting eggs.',
          ] as Copy,
        };
      const chapter = STORY_CHAPTERS.find((c) =>
        c.steps.some((s) => s.species === species && s.element === element && !save.questEggs.includes(s.id)),
      );
      if (chapter)
        return {
          ...base,
          route: 'journey' as const,
          source: [`Recompensă în capitolul ${chapter.number}`, `Chapter ${chapter.number} reward`] as Copy,
          detail: [
            'Urmează povestea pentru acest ou garantat. Nu trebuie cumpărat.',
            'Follow the story for this guaranteed egg. No purchase needed.',
          ] as Copy,
        };
      if (MARKET_ELEMENTS.includes(element))
        return {
          ...base,
          route: 'market' as const,
          source: ['Ou în Piață', 'Egg at the Market'] as Copy,
          detail: [
            `Costă ${eggPrice(element)} aur. Poți alege familia oului înainte să cumperi.`,
            `Costs ${eggPrice(element)} gold. Choose the egg family before buying.`,
          ] as Copy,
        };
      const region = REGIONS.find((r) => r.element === element)!;
      return {
        ...base,
        route: 'expedition' as const,
        source: ['Expediții și patrule', 'Expeditions and patrols'] as Copy,
        detail: [
          `Explorează ${region.name[0]}. Ouăle sunt recompense cu șansă de obținere, nu la fiecare plecare.`,
          `Explore ${region.name[1]}. Eggs are chance rewards, not guaranteed on every trip.`,
        ] as Copy,
      };
    })
    .filter((t): t is CollectionTarget => t !== null)
    .sort(
      (a, b) =>
        Number(pending.has(b.id)) - Number(pending.has(a.id)) ||
        ELEMENTS.findIndex((e) => e.id === a.element) - ELEMENTS.findIndex((e) => e.id === b.element),
    )
    .slice(0, 3);
}
