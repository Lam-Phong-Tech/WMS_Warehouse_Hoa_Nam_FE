import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';

// The migration is one-shot. Normal CI checks the published source unchanged.
if (fs.existsSync('src/shared/i18n/messages.updated.en.ts')) {
  console.log('Reviewed interface translations are already published.');
  process.exit(0);
}
const translations = 'scripts/i18n-reviewed-translations.tsv';
fs.appendFileSync(translations, '\n' + fs.readFileSync('scripts/i18n-reviewed-translations-extra.tsv', 'utf8'));
// Include accessibility and mobile table labels, not identity/value attributes.
const migration = 'scripts/localize-interface.mjs';
let migrator = fs.readFileSync(migration, 'utf8');
migrator = migrator.replace('aria-(?:label|description)|helperText', 'aria-(?:label|description|valuetext)|data-(?:label|title)|primary|secondary|headerName|helperText');
migrator = migrator.replace('raw!==undefined && VI_RE.test(raw) && !isNonUi(n,source)', 'raw!==undefined && (VI_RE.test(raw) || ((ts.isJsxText(n) || ts.isJsxAttribute(n.parent) || (ts.isPropertyAssignment(n.parent) && /^(label|title|placeholder|headerName|caption)$/.test(n.parent.name.getText(source)))) && ["Kho", "In", "Toa"].includes(normal(raw)))) && !isNonUi(n,source)');
fs.writeFileSync(migration, migrator);
const layout = 'src/app/layouts/MainLayout.tsx';
const oldLayout = fs.readFileSync(layout, 'utf8');
const newLayout = oldLayout.replace(/label: entry\.i18nKey\s*\? navLabel\(entry\.i18nKey, entry\.label\)\s*: entry\.label,/, 'label: navLabel(entry.i18nKey, entry.label),');
if (oldLayout === newLayout && !oldLayout.includes('label: navLabel(entry.i18nKey, entry.label),')) throw Error('Breadcrumb source changed');
fs.writeFileSync(layout, newLayout);
const controls = 'src/modules/reports/io-history/rpt08/controls.tsx';
let code = fs.readFileSync(controls, 'utf8');
code = code.replace(/import\s*\{\s*VI_TIMEZONE_LABEL\s*\}\s*from\s*["'][^"']+["'];?\s*/g, '').replace(/\bVI_TIMEZONE_LABEL\s*,\s*/g, '').replaceAll('${VI_TIMEZONE_LABEL}', '${"Múi giờ Việt Nam"}');
fs.writeFileSync(controls, code);
const output = execFileSync(process.execPath, [migration, '--apply'], {encoding:'utf8', maxBuffer:16*1024*1024});
const records = output.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
for (const record of records) {
  if (!record.delayedConstants?.length) continue;
  const source = fs.readFileSync(record.file, 'utf8');
  const ast = ts.createSourceFile(record.file, source, ts.ScriptTarget.Latest, true, record.file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits = [];
  for (const statement of ast.statements) {
    if (!ts.isFunctionDeclaration(statement) || !record.delayedConstants.includes(statement.name?.text)) continue;
    if (!statement.body || statement.body.statements.length !== 1 || !ts.isReturnStatement(statement.body.statements[0])) throw Error(`Unsafe deferred value: ${record.file}`);
    const expression = statement.body.statements[0].expression;
    if (!expression) throw Error('Missing deferred expression');
    edits.push({start:statement.getStart(ast), end:statement.end, text:`const ${statement.name.text} = localizedUiValue(()${statement.type ? ': ' + statement.type.getText(ast) : ''} => (${expression.getText(ast)}));`});
  }
  if (edits.length !== record.delayedConstants.length) throw Error(`Deferred value mismatch: ${record.file}`);
  let changed = source;
  for (const edit of edits.sort((a,b) => b.start-a.start)) changed = changed.slice(0,edit.start)+edit.text+changed.slice(edit.end);
  changed = 'import { localizedValue as localizedUiValue } from "@/shared/i18n/localized-value";\n' + changed;
  const check = ts.createSourceFile(record.file, changed, ts.ScriptTarget.Latest, true, record.file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if (check.parseDiagnostics.length) throw Error(`Invalid deferred value syntax: ${record.file}`);
  fs.writeFileSync(record.file, changed);
}
const cssCopy = new Map(fs.readFileSync(translations, 'utf8').split('\n').filter(Boolean).map(line => line.split('\t')));
let cssId = 0;
const cssIssues = [];
function cssWalk(directory) {
  for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { cssWalk(file); continue; }
    if (!file.endsWith('.css')) continue;
    const source = fs.readFileSync(file, 'utf8');
    const variables = [];
    const next = source.replace(/content:\s*"([^"\n]+)"\s*;/g, (match, value) => {
      if (!/[À-ỹ]/u.test(value)) return match;
      const english = cssCopy.get(value.trim());
      if (!english) { cssIssues.push({file,text:value}); return match; }
      const name = `--hn-translated-content-${++cssId}`;
      const translated = value.match(/^\s*/)[0] + english + value.match(/\s*$/)[0];
      variables.push(`${name}: ${JSON.stringify(translated)};`);
      return `content: var(${name}, ${JSON.stringify(value)});`;
    });
    if (variables.length) fs.writeFileSync(file, next + '\n:root:lang(en) {\n  ' + variables.join('\n  ') + '\n}\n');
  }
}
cssWalk('src');
const review = JSON.parse(fs.readFileSync('i18n-migration-review.json', 'utf8'));
console.log(JSON.stringify({changedFiles:review.changed.length,translatedOccurrences:review.translatedOccurrences,newMessages:review.newMessages,remainingCandidates:review.issues.length,translatedCssLabels:cssId}));
for (const issue of review.issues) console.log(JSON.stringify(issue));
for (const issue of cssIssues) console.log(JSON.stringify({kind:'css-content',...issue}));
