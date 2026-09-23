import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';

const root = process.cwd();
const baselineSha = '0f789d07c22b62162066bfeff7bbe99b334c88fb';
const suites = ['src/shared/i18n', 'src/modules/inbound', 'src/modules/outbound', 'src/modules/reports', 'src/modules/master-data', 'src/modules/warranty', 'src/app/layouts', 'src/shared/constants/business-labels.test.ts'];
const clean = text => String(text).replace(/\u001b\[[0-9;]*m/g, '').replace(/\s+/g, ' ').trim();
function run(directory, files, name) {
  const reportFile = path.join(directory, 'test-results/vitest-results.json');
  fs.rmSync(reportFile, {force:true});
  let failed = false;
  try {
    const output = execFileSync('npm', ['run','test','--',...files,'--maxWorkers=4'], {cwd:directory, encoding:'utf8', maxBuffer:32*1024*1024});
    fs.writeFileSync(path.join(os.tmpdir(), `i18n-${name}.log`), output);
  } catch (error) {
    failed = true;
    fs.writeFileSync(path.join(os.tmpdir(), `i18n-${name}.log`), String(error.stdout || '') + String(error.stderr || ''));
    if (!fs.existsSync(reportFile)) {
      console.error(String(error.stderr || error.message).slice(-2000));
      throw Error(`${name}: test runner did not produce a report`);
    }
  }
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  const failures = [];
  for (const result of report.testResults ?? []) {
    const filename = path.relative(directory, result.name).replaceAll(path.sep, '/');
    for (const assertion of result.assertionResults ?? []) {
      if (assertion.status !== 'failed') continue;
      failures.push({file:filename, id:filename+' :: '+assertion.fullName, message:clean(assertion.failureMessages?.[0]).split('Ignored nodes:')[0].split('<body>')[0].slice(0,350)});
    }
  }
  if (failed && !failures.length) throw Error(`${name}: suite or runtime failure without comparable test assertions`);
  console.log(JSON.stringify({name,passed:report.numPassedTests,failed:report.numFailedTests,total:report.numTotalTests,failedFiles:[...new Set(failures.map(x=>x.file))]}));
  for (const failure of failures) console.log(JSON.stringify({name,...failure}));
  return {report,failures};
}
const current = run(root, suites, 'translated');
let existingFailures = 0;
if (current.failures.length) {
  const failedFiles = [...new Set(current.failures.map(x=>x.file))];
  if (failedFiles.some(file=>!file.startsWith('src/') || file.includes('..') || file.startsWith('src/shared/i18n/') || file.endsWith('.locale.test.tsx'))) throw Error('A localization or unexpected test failed');
  // Never hide a failing test. Re-run the same assertions against the exact
  // pre-task source to distinguish existing UI-test drift from regressions.
  execFileSync('gh',['auth','setup-git'],{stdio:'ignore'});
  execFileSync('git',['fetch','--no-tags','--depth=1','origin',baselineSha],{stdio:'ignore'});
  const baseline = fs.mkdtempSync(path.join(os.tmpdir(),'i18n-baseline-'));
  try {
    execFileSync('git',['worktree','add','--detach',baseline,baselineSha],{stdio:'ignore'});
    fs.symlinkSync(path.join(root,'node_modules'),path.join(baseline,'node_modules'),'dir');
    for (const file of failedFiles) if(!fs.existsSync(path.join(baseline,file))) throw Error(`New test failure: ${file}`);
    const original = run(baseline, failedFiles, 'baseline');
    const previous = new Map(original.failures.map(item=>[item.id,item.message]));
    const regressions = current.failures.filter(item=>previous.get(item.id)!==item.message);
    if(regressions.length) {
      for(const item of regressions) console.error(JSON.stringify({regression:item,baseline:previous.get(item.id)}));
      throw Error(`${regressions.length} new or changed assertion failures; publication blocked`);
    }
    existingFailures = current.failures.length;
  } finally {
    execFileSync('git',['worktree','remove','--force',baseline],{stdio:'ignore'});
  }
}
const summary = {passed:current.report.numPassedTests,total:current.report.numTotalTests,preExistingFailures:existingFailures,newFailures:0,baseline:baselineSha};
console.log('VALIDATION '+JSON.stringify(summary));
fs.writeFileSync(path.join(os.tmpdir(),'localization-validation.json'),JSON.stringify(summary));
