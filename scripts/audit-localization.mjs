import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const accents = /[\u00c0-\u00ff\u0102\u0103\u0110\u0111\u0128\u0129\u0168\u0169\u01a0\u01a1\u01af\u01b0\u1ea0-\u1ef9]/u;
function catalog(file, name) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
  const box = {exports: {}};
  vm.runInNewContext(output, box, {timeout: 1000});
  return box.exports[name];
}
function flatten(node, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(node)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[full] = value;
    else if (value && typeof value === 'object') flatten(value, full, out);
  }
  return out;
}
const vi = flatten(catalog('src/shared/i18n/messages.ts', 'MESSAGES_VI'));
const en = flatten(catalog('src/shared/i18n/messages.en.ts', 'MESSAGES_EN'));
const byText = new Map();
for (const [key, value] of Object.entries(vi)) {
  if (en[key] && !accents.test(en[key])) byText.set(value.trim().replace(/\s+/g, ' '), key);
}
const group = process.argv[2] || 'catalog';
if (group === 'catalog') {
  const missing = Object.keys(vi).filter(k => !en[k] || (accents.test(en[k]) && en[k] !== 'Tiếng Việt'));
  console.log(JSON.stringify({viKeys: Object.keys(vi).length, enKeys: Object.keys(en).length, missing: missing.length}));
  for (const key of missing) console.log(JSON.stringify({key, vi:vi[key], en:en[key]}));
} else {
  const roots = group === 'shared' ? ['src/shared', 'src/app'] : [`src/modules/${group}`];
  const found = new Map();
  let total = 0;
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const item of fs.readdirSync(dir, {withFileTypes: true})) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) {
        if (!/^(i18n|test|__tests__|__mocks__|fixtures|mocks|generated)$/.test(item.name)) walk(file);
        continue;
      }
      if (!/\.(tsx?|jsx?)$/.test(file) || /\.(test|spec|d)\./.test(file) || /vn-address-data/.test(file)) continue;
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      function visit(node) {
        if (ts.isStringLiteral(node) || ts.isJsxText(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
          const text = node.text.trim().replace(/\s+/g, ' ');
          if (accents.test(text)) {
            total++;
            const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
            const entry = found.get(text) || {text, key: byText.get(text), count:0, at: `${file}:${line}`, context: ts.SyntaxKind[node.parent.kind]};
            entry.count++;
            found.set(text, entry);
          }
        } else if (ts.isTemplateExpression(node) && accents.test(node.getText(source))) {
          const text = node.getText(source);
          const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          found.set(text, {text, template: true, count:1, at:`${file}:${line}`, context:ts.SyntaxKind[node.parent.kind]});
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  roots.forEach(walk);
  console.log(JSON.stringify({group, total, unique:found.size, reusable:[...found.values()].filter(x=>x.key).length}));
  for (const item of found.values()) if (!item.key) console.log(JSON.stringify(item));
}
