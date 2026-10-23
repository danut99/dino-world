import type { Callout } from './battleChoreography';

/** The words of an on-screen battle announcement: one or two words, shown big in the middle of the arena. */
export function calloutText(c: Callout, _name: string, lang: number) {
  const tr = (ro: string, en: string) => (lang ? en : ro);
  switch (c.kind) {
    case 'damage':
      return `−${c.amount}`;
    case 'blocked':
      return `${tr('BLOCAT', 'BLOCKED')} −${c.amount}`;
    case 'guard':
      return tr('SCUT!', 'SHIELD!');
    case 'dodge':
      return tr('ESCHIVĂ!', 'DODGE!');
    case 'reflect':
      return `${tr('REFLECTAT', 'REFLECTED')} −${c.amount}`;
    case 'ultimate':
      return tr('ERUPȚIE!', 'ERUPTION!');
    case 'ko':
      return 'K.O.!';
  }
}
