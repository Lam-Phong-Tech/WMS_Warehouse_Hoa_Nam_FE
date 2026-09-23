import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';

const layout = 'src/app/layouts/MainLayout.tsx';
const oldLayout = fs.readFileSync(layout, 'utf8');
const newLayout = oldLayout.replace(/label: entry\.i18nKey\s*\? navLabel\(entry\.i18nKey, entry\.label\)\s*: entry\.label,/, 'label: navLabel(entry.i18nKey, entry.label),');
if (oldLayout === newLayout && !oldLayout.includes('label: navLabel(entry.i18nKey, entry.label),')) throw Error('Breadcrumb source changed');
fs.writeFileSync(layout, newLayout);
const controls = 'src/modules/reports/io-history/rpt08/controls.tsx';
if (fs.existsSync(controls)) {
  let code = fs.readFileSync(controls, 'utf8');
  code = code.replace(/\s*VI_TIMEZONE_LABEL,/, '').replaceAll('${VI_TIMEZONE_LABEL}', '${"Múi giờ Việt Nam"}');
  fs.writeFileSync(controls, code);
}
const output = execFileSync(process.execPath, ['scripts/localize-interface.mjs', '--apply'], {encoding:'utf8', maxBuffer:16*1024*1024});
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
const css = 'src/modules/outbound/pages/outbound-list.css';
let styles = fs.readFileSync(css, 'utf8');
styles = styles.replace('content: "Người nhận: ";', 'content: var(--out-recipient-label, "Người nhận: ");').replace('content: "Ngày tạo: ";', 'content: var(--out-date-label, "Ngày tạo: ");').replace('content: "Ghi chú: ";', 'content: var(--out-note-label, "Ghi chú: ");');
styles += '\n.hn-outbound-list:lang(en) {\n  --out-recipient-label: "Recipient: ";\n  --out-date-label: "Created on: ";\n  --out-note-label: "Note: ";\n}\n';
fs.writeFileSync(css, styles);
const review = JSON.parse(fs.readFileSync('i18n-migration-review.json', 'utf8'));
console.log(JSON.stringify({changedFiles:review.changed.length,translatedOccurrences:review.translatedOccurrences,newMessages:review.newMessages,remainingCandidates:review.issues.length}));
for (const issue of review.issues) console.log(JSON.stringify(issue));
