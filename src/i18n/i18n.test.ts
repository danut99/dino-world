import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import english from './en.json';
import { getLanguage, getLocale, LANGUAGE_KEY, setLanguage, t } from './index';
import { WIKI_ARTICLES, searchWiki } from '../content/wiki';
import { BUILDINGS, GOALS, newGame, runCommand } from '@shared/game';
import { Settings } from '../components/Settings';
import type { Game } from '../hooks/useGame';

afterEach(() => {
  vi.unstubAllGlobals();
  setLanguage('en');
});

describe('in-app languages', () => {
  it('translates all goal titles, hints, and guide callouts, including icon prefixes', () => {
    setLanguage('en');
    for (const goal of GOALS) {
      expect(t(goal.title), goal.id).not.toMatch(/[ăâîșț]/i);
      expect(t(goal.hint), goal.id).not.toMatch(/[ăâîșț]/i);
      expect(t(`👉 ${goal.title}`), goal.id).toBe(`👉 ${t(goal.title)}`);
    }
    expect(t('Dinozaurii produc aur → Lume → Strânge')).toBe('Dinosaurs produce gold → World → Collect');
    expect(t('👉 Strânge primul aur')).toBe('👉 Collect your first gold');
    setLanguage('ro');
    expect(t('👉 Strânge primul aur')).toBe('👉 Strânge primul aur');
  });

  it('has translations for Romanian messages throughout the UI and game sources', () => {
    setLanguage('en');
    const files = (directory: string): string[] =>
      readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const filename = path.join(directory, entry.name);
        return entry.isDirectory()
          ? files(filename)
          : /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')
            ? [filename]
            : [];
      });
    const missing: string[] = [];
    for (const filename of [...files('src'), ...files('shared/game')]) {
      if (filename.includes(`${path.sep}i18n${path.sep}`)) continue;
      const ast = ts.createSourceFile(
        filename,
        readFileSync(filename, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      const visit = (node: ts.Node) => {
        let source: string | undefined;
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) source = node.text;
        if (ts.isTemplateExpression(node))
          source = node.head.text + node.templateSpans.map((span, index) => `{${index}}${span.literal.text}`).join('');
        // These labels intentionally identify Romanian or appear only in the Romanian language selector.
        const languageLabel =
          /(?:App|Settings)\.tsx$/.test(filename) && ['Română', 'Schimbă în engleză', 'Limbă'].includes(source ?? '');
        if (source && /[ăâîșț]/i.test(source) && !languageLabel && /[ăâîșț]/i.test(t(source)))
          missing.push(`${filename}: ${source}`);
        const displayData = /(?:shared[\\/]game|src[\\/](?:components|screens|content|world))[\\/]/.test(filename);
        if (
          displayData &&
          ts.isPropertyAssignment(node) &&
          ['name', 'title', 'hint', 'text', 'description', 'effect', 'label'].includes(node.name.getText(ast)) &&
          (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer)) &&
          /[a-zăâîșț]/i.test(node.initializer.text) &&
          !Object.hasOwn(english, node.initializer.text.trim())
        )
          missing.push(`${filename}: missing display-text entry: ${node.initializer.text}`);
        ts.forEachChild(node, visit);
      };
      visit(ast);
    }
    expect(missing).toEqual([]);
  });
  it('defaults to English independently of the browser language', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    vi.stubGlobal('navigator', { language: 'ro-RO' });
    vi.resetModules();
    const fresh = await import('./index');
    expect(fresh.getLanguage()).toBe('en');
    expect(fresh.t('Setări')).toBe('Settings');
  });

  it('persists the choice and updates the document language', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });
    vi.stubGlobal('document', { documentElement: { lang: 'en' } });
    setLanguage('ro');
    expect(getLanguage()).toBe('ro');
    expect(getLocale()).toBe('ro-RO');
    expect(setItem).toHaveBeenCalledWith(LANGUAGE_KEY, 'ro');
    expect(document.documentElement.lang).toBe('ro');
    expect(t('🐣 Eclozează')).toBe('🐣 Eclozează');
    setLanguage('en');
    expect(t('🐣 Eclozează')).toBe('🐣 Hatch');
    expect(getLocale()).toBe('en-GB');
  });

  it('switches even when storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('unavailable');
      },
    });
    expect(() => setLanguage('ro')).not.toThrow();
    expect(getLanguage()).toBe('ro');
  });

  it('translates dynamic breeding, hatching, rewards, and errors', () => {
    setLanguage('en');
    expect(t('Ignisaur a ieșit din ou!')).toBe('Ignisaur has hatched!');
    expect(t('Ou nou de Ferrankyl în incubator.')).toBe('New Ferrankyl egg in the Hatchery.');
    expect(t('Ambii părinți trebuie să fie cel puțin nivelul 4.')).toBe('Both parents must be at least level 4.');
    expect(t('Victorie! +150 aur · +5 medalii')).toBe('Victory! +150 gold · +5 medals');
    expect(t('Nu ai destul(ă) hrană (ai nevoie de 200).')).toBe('Not enough food (you need 200).');
    expect(t('🔥 Foc')).toBe('🔥 Fire');
    expect(t('foc')).toBe('fire');
    expect(t('2× Grindă de fosilă')).toBe('2× Fossil Beam');
    expect(t('  Strânge tot ')).toBe('  Collect all ');
    expect(t('Nu ai destul(ă) aur (ai nevoie de 10.000).')).toBe('Not enough gold (you need 10,000).');
    expect(t('$& a ieșit din ou!')).toBe('$& has hatched!');
    const state = newGame(0);
    const result = runCommand(state, { type: 'breed', a: 'missing', b: 'missing' }, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(t(result.error)).not.toMatch(/[ăâîșț]/i);
  });

  it('keeps every catalog placeholder intact', () => {
    for (const [source, translated] of Object.entries(english)) {
      const placeholders = (text: string) => [...text.matchAll(/\{\d+\}/g)].map((match) => match[0]).sort();
      expect(placeholders(translated), source).toEqual(placeholders(source));
      expect(translated, source).not.toMatch(/[ăâîșț]/i);
    }
  });

  it('translates every generated guide article and building name', () => {
    setLanguage('en');
    for (const building of Object.values(BUILDINGS)) expect(t(building.name)).not.toMatch(/[ăâîșț]/i);
    for (const article of WIKI_ARTICLES) {
      const texts = [
        article.title,
        article.summary,
        ...article.sections.flatMap((section) => [
          section.title,
          ...(section.paragraphs ?? []),
          ...(section.steps ?? []),
          ...(section.table?.headers ?? []),
          ...(section.table?.rows.flat() ?? []),
        ]),
      ];
      for (const text of texts) expect(t(text), `${article.id}: ${text}`).not.toMatch(/[ăâîșț]/i);
    }
    expect(searchWiki('breeding')[0]?.id).toBe('breeding');
    expect(searchWiki('hatchery', 'buildings')[0]?.id).toBe('building-hatchery');
    expect(searchWiki('warm stone').map((article) => article.id)).toContain('item-warm-stone');
  });

  it('renders Settings in either language without translating save data', () => {
    const game = { state: newGame(0, 12345) } as Game;
    const saved = JSON.stringify(game.state);
    setLanguage('en');
    const en = renderToStaticMarkup(createElement(Settings, { game, onClose: () => undefined }));
    expect(en).toContain('Sound effects');
    expect(en).toContain('Copy as text');
    expect(en).toContain('Română');
    setLanguage('ro');
    const ro = renderToStaticMarkup(createElement(Settings, { game, onClose: () => undefined }));
    expect(ro).toContain('Efecte sonore');
    expect(ro).toContain('Copiază ca text');
    expect(JSON.stringify(game.state)).toBe(saved);
    expect(readFileSync('index.html', 'utf8')).toContain('<html lang="en" translate="no">');
  });
});
