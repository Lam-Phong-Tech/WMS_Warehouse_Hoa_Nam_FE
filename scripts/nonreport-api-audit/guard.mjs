import fs from 'node:fs';

// A regression guard, not certification that every response field is correct.
// The inspection input contains source metadata only, never live warehouse data.
const file = process.argv[2];
if (!file) throw new Error('Usage: node scripts/nonreport-api-audit/guard.mjs <inspection.jsonl>');
const records = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
if (!records.some(record => record.kind === 'audit-totals')) throw new Error('Incomplete inspection: missing audit totals');
const violations = [];
const testDependency = /(?:\.(?:test|spec)\.[jt]sx?$|\/(?:test|tests|__tests__|__mocks__|__fixtures__)\/)/;
const businessSampleDependency = /(?:^|\/)(?:mock[-_.]?data|demo[-_.]?data|sample[-_.]?data|fixtures?)(?:[/.]|$)/i;
for (const record of records) {
  if (record.kind === 'import-graph') {
    for (const dependency of record.dependencies ?? []) {
      if (testDependency.test(dependency) || businessSampleDependency.test(dependency)) {
        violations.push({ path: record.path, dependency, reason: 'Runtime imports test or business sample data' });
      }
    }
  }
  if (record.kind === 'literal-array') {
    const text = record.text ?? '';
    const hasFixedBusinessIdentity = /\b(?:code|sku_code|skuCode|serialNumber|document_no|doc_no)\s*:\s*["'`][^"'`]+["'`]/.test(text);
    const hasFixedQuantity = /\b(?:quantity|qty|expected|scanned|on_hand_qty|available_qty)\s*:\s*-?\d+(?:\.\d+)?\s*[,}]/.test(text);
    if (hasFixedBusinessIdentity && hasFixedQuantity) {
      violations.push({ path: record.path, line: record.line, reason: 'Hard-coded business record array with a fixed quantity' });
    }
  }
}
for (const violation of violations) console.error(JSON.stringify(violation));
console.log(JSON.stringify({ kind: 'runtime-fixture-regression-guard', violations: violations.length, scope: 'non-report runtime source', certification: false }));
if (violations.length) process.exitCode = 1;
