#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { evaluateWwhn153Signoff, loadWwhn153Evidence } from './wwhn-153-signoff-core.mjs';

const rootDir = process.cwd();
const requireFinal = process.argv.includes('--require-final');
const evidenceDir = path.resolve(
  rootDir,
  process.env.WWHN_153_EVIDENCE_DIR || 'docs/evidence/wwhn-153/generated/local',
);
fs.mkdirSync(evidenceDir, { recursive: true });

function git(args) {
  try {
    return execFileSync('git', args, { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const loaded = loadWwhn153Evidence(rootDir);
const sourceSha = process.env.SOURCE_SHA || process.env.WWHN_153_SOURCE_SHA || git(['rev-parse', 'HEAD']);
const executionSha = process.env.EXECUTION_SHA || process.env.WWHN_153_EXECUTION_SHA || sourceSha;
const repository = process.env.GITHUB_REPOSITORY || loaded.sourceProvenance.repository;
const branch = process.env.GITHUB_REF_NAME || git(['branch', '--show-current']) || loaded.sourceProvenance.branch;
const runId = process.env.GITHUB_RUN_ID || '';
const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
const runUrl = runId ? `${serverUrl}/${repository}/actions/runs/${runId}` : '';
const isCi = process.env.GITHUB_ACTIONS === 'true';

const sourceContext = {
  status: isCi ? 'PASS' : 'PENDING',
  isCi,
  repository,
  branch,
  sourceSha,
  executionSha,
  parentSha: process.env.WWHN_153_PARENT_SHA || git(['rev-parse', 'HEAD^']),
  treeSha: process.env.WWHN_153_TREE_SHA || git(['rev-parse', 'HEAD^{tree}']),
  runId,
  runUrl,
  artifactName: sourceSha ? `wwhn-153-signoff-integrity-${sourceSha}` : '',
};

const result = evaluateWwhn153Signoff({ ...loaded, sourceContext, rootDir });
const inputDigests = Object.fromEntries(
  Object.entries(loaded.paths).map(([key, filePath]) => [key, { path: path.relative(rootDir, filePath), sha256: sha256File(filePath) }]),
);
const report = {
  generatedAt: new Date().toISOString(),
  mode: requireFinal ? 'FINAL' : 'INTEGRITY',
  sourceContext,
  inputDigests,
  ...result,
};

const jsonPath = path.join(evidenceDir, 'wwhn-153-signoff-report.json');
const markdownPath = path.join(evidenceDir, 'wwhn-153-signoff-report.md');
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(
  markdownPath,
  [
    '# WWHN-153 sign-off report',
    '',
    `- Mode: \`${report.mode}\``,
    `- Repository/ref: \`${sourceContext.repository}@${sourceContext.branch}\``,
    `- Source SHA: \`${sourceContext.sourceSha || 'UNRESOLVED'}\``,
    `- Parent SHA: \`${sourceContext.parentSha || 'UNRESOLVED'}\``,
    `- Tree SHA: \`${sourceContext.treeSha || 'UNRESOLVED'}\``,
    `- Integrity: **${result.integrityOk ? 'PASS' : 'FAIL'}**`,
    `- Final allowed: **${result.finalAllowed ? 'YES' : 'NO'}**`,
    `- Open P0/P1/P2: **${result.openP0}/${result.openP1}/${result.openP2}**`,
    '',
    '## Gates',
    '',
    ...result.gates.map((gate) => `- ${gate.id}: **${gate.status}**`),
    '',
    '## Findings',
    '',
    ...result.findings.map((item) => `- ${item.id} (${item.severity}): **${item.status}**`),
    '',
    '## Blockers',
    '',
    ...(result.blockers.length ? result.blockers.map((item) => `- ${item}`) : ['- None']),
    '',
  ].join('\n'),
);

console.log(JSON.stringify({
  integrityOk: result.integrityOk,
  finalAllowed: result.finalAllowed,
  openP0: result.openP0,
  openP1: result.openP1,
  openP2: result.openP2,
  report: path.relative(rootDir, jsonPath),
}, null, 2));

if (!result.integrityOk || (requireFinal && !result.finalAllowed)) process.exit(1);
