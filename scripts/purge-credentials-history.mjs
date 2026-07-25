/**
 * Purge credentials khỏi toàn bộ git history bằng git filter-branch.
 * Dùng --index-filter (nhanh, không checkout file).
 * Replacements đọc từ env var (không hardcode): PURGE_FROM_1/PURGE_TO_1 ...
 * Sau khi chạy: git push --force --all && git push --force --tags
 */
import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();

const replacements = [];
for (let i = 1; i <= 10; i++) {
  const from = process.env[`PURGE_FROM_${i}`];
  const to = process.env[`PURGE_TO_${i}`];
  if (from && to) replacements.push({ from, to });
}
if (replacements.length === 0) {
  console.error('❌ Set PURGE_FROM_*/PURGE_TO_* env var trước.');
  process.exit(1);
}
console.log(`[0/5] Loaded ${replacements.length} replacement rule(s).`);

const replacementsB64 = Buffer.from(JSON.stringify(replacements)).toString('base64');

// Inline index-filter. Chạy trong cwd = .git-rewrite/t/<commit>/. Dùng git ls-files + cat-file + hash-object + update-index.
const indexInline = `
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const replacements = JSON.parse(Buffer.from(process.env.REPL_B64, 'base64').toString('utf-8'));
let files = [];
try { files = execSync('git ls-files -z', { encoding: 'buffer', maxBuffer: 1024*1024*1024 }).toString('utf-8').split('\\0').filter(Boolean); }
catch (e) { process.exit(0); }
function q(s){return JSON.stringify(s);}
for (const f of files) {
  try {
    const line = execSync('git ls-files -s -- '+q(f), { encoding: 'utf-8' }).trim();
    if (!line) continue;
    const parts = line.split(/\\s+/);
    const mode = parts[0], blobHash = parts[1];
    let content;
    try { content = execSync('git cat-file -p '+blobHash, { encoding: 'utf-8', maxBuffer: 50*1024*1024 }); }
    catch { continue; }
    const before = content;
    for (const {from,to} of replacements) { if (content.includes(from)) content = content.split(from).join(to); }
    if (content !== before) {
      const tmp = path.join(os.tmpdir(),'cred-purge-'+Date.now()+'-'+Math.random().toString(36).slice(2));
      fs.writeFileSync(tmp, content);
      const newHash = execSync('git hash-object -w -- '+q(tmp), { encoding: 'utf-8' }).trim();
      try { fs.unlinkSync(tmp); } catch {}
      execSync('git update-index --cacheinfo '+mode+','+newHash+','+f, { stdio: 'pipe' });
    }
  } catch (e) {}
}
`;

const msgInline = `
const replacements = JSON.parse(Buffer.from(process.env.REPL_B64, 'base64').toString('utf-8'));
let msg = '';
try { msg = require('node:fs').readFileSync(0, 'utf-8'); } catch { process.exit(0); }
for (const {from,to} of replacements) msg = msg.split(from).join(to);
process.stdout.write(msg);
`;

// Script nằm trong .git/ (ngoài working tree, không bị rewrite)
const indexScript = join(REPO_ROOT, '.git', '_cred-index-filter.mjs');
const msgScript = join(REPO_ROOT, '.git', '_cred-msg-filter.mjs');
writeFileSync(indexScript, indexInline);
writeFileSync(msgScript, msgInline);

console.log('[1/5] Backup current HEAD...');
try { execSync('git branch -f backup-before-purge HEAD', { stdio: 'inherit' }); }
catch { execSync('git branch backup-before-purge HEAD', { stdio: 'inherit' }); }

console.log('[2/5] Running git filter-branch (index-filter + msg-filter)...');
const filterCmd = `git filter-branch --force --index-filter "node \\"${indexScript}\\"" --msg-filter "node \\"${msgScript}\\"" -- --all`;
try {
  execSync(filterCmd, {
    stdio: 'inherit', cwd: REPO_ROOT,
    env: { ...process.env, FILTER_BRANCH_SQUELCH_WARNING: '1', REPL_B64: replacementsB64 },
  });
} catch (e) {
  console.error('filter-branch failed:', e.message);
  try { unlinkSync(indexScript); } catch {}
  try { unlinkSync(msgScript); } catch {}
  process.exit(1);
}

console.log('[3/5] Cleanup temp scripts...');
try { unlinkSync(indexScript); } catch {}
try { unlinkSync(msgScript); } catch {}

console.log('[4/5] Verify history clean...');
try {
  for (const { from } of replacements) {
    try {
      const out = execSync(`git log --all -p`, { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 1024 });
      const c = out.split(from).length - 1;
      console.log(`      '${from}' occurrences: ${c}`);
    } catch {
      // fallback grep
      try {
        const g = execSync(`git log --all -p | findstr /c:"${from}"`, { encoding: 'utf-8' });
        console.log(`      '${from}' grep lines: ${g.split('\n').filter(Boolean).length}`);
      } catch { console.log(`      '${from}': 0 (grep found nothing)`); }
    }
  }
} catch (e) { console.log('      verify skipped'); }

console.log('[5/5] Done. Next:');
console.log('      git push --force --all && git push --force --tags');