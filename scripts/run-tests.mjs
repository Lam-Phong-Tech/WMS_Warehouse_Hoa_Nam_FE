import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';

let out = '';
try {
  out = execSync('yarn test --run', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 50 * 1024 * 1024 });
} catch (err) {
  out = err?.stdout ?? err?.stderr ?? err?.message ?? String(err);
}
writeFileSync('test-output.txt', out, 'utf8');
// In 80 dòng cuối
const lines = out.split('\n');
console.log(lines.slice(-80).join('\n'));
console.log('=== TOTAL LINES:', lines.length);