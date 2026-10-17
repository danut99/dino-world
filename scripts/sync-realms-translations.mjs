import fs from 'node:fs';
import ts from 'typescript';
const path = new URL('../src/i18n/en.json', import.meta.url);
const dictionary = JSON.parse(fs.readFileSync(path, 'utf8'));
for (const name of ['RealmsApp.tsx', 'game.ts', 'content.ts', 'GameplayScreens.tsx', 'DinosaurCollection.tsx', 'FarmPanel.tsx', 'DinoPanels.tsx', 'World.tsx', 'RealmsWiki.tsx']) {
  const source = ts.createSourceFile(
    name,
    fs.readFileSync(new URL(`../src/realms/${name}`, import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const visit = (node) => {
    const literal = value => {
      if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text;
      if (ts.isTemplateExpression(value)) return value.head.text + value.templateSpans.map((span, index) => `{${index}}${span.literal.text}`).join('');
    };
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'tr' && node.arguments.length === 2) {
      const ro = literal(node.arguments[0]), en = literal(node.arguments[1]);
      if (ro && en) dictionary[ro] = en;
    }
    if (ts.isConditionalExpression(node)) {
      const en = literal(node.whenTrue), ro = literal(node.whenFalse);
      if (en && ro && /[ăâîșț]/i.test(ro) && !/[ăâîșț]/i.test(en)) dictionary[ro] = en;
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(source) === 'tr' &&
      node.arguments.length === 2 &&
      node.arguments.every(ts.isStringLiteral)
    )
      dictionary[node.arguments[0].text] = node.arguments[1].text;
    if (
      ts.isCallExpression(node) &&
      ['T', 'tr', 'text'].includes(node.expression.getText(source)) &&
      node.arguments.length === 3 &&
      node.arguments.slice(1).every(ts.isStringLiteral)
    )
      dictionary[node.arguments[1].text] = node.arguments[2].text;
    if (ts.isArrayLiteralExpression(node) && node.elements.length === 2 && node.elements.every(ts.isStringLiteral))
      dictionary[node.elements[0].text] = node.elements[1].text;
    ts.forEachChild(node, visit);
  };
  visit(source);
}
dictionary['Insula principală. Selectează clădiri sau folosește comenzile.'] =
  'Home island. Select buildings or use the controls.';
dictionary['Centrează insula'] = 'Center island';
fs.writeFileSync(path, JSON.stringify(dictionary, null, 2) + '\n');
