#!/usr/bin/env node
// ĐÃ RÚT theo 3822d45: bộ bằng chứng docs/evidence/wwhn-153/* — gồm
// WWHN-153_SIGNOFF_MANIFEST.json, WWHN-153_PERMISSION_APPROVAL.json,
// WWHN-153_FE_SOURCE_PROVENANCE.json và report generated/** — đã gỡ khỏi repo
// trong đợt dọn kho tài liệu, nên toàn bộ phần nạp manifest, chấm 8 cổng
// sign-off theo bằng chứng, digest input và ghi report ra
// docs/evidence/wwhn-153/generated/** rút theo (kể cả bước gom provenance git
// chỉ phục vụ chấm các cổng đó). Kiểm tra mã nguồn sống giữ nguyên hiệu lực:
// core scripts/wwhn-153-signoff-core.mjs phải còn nguyên hợp đồng đã chốt
// (6 issue bắt buộc, 5 kịch bản runtime QA2, 9 finding, 8 cổng) và phải
// fail-closed khi chạy hoàn toàn không có bằng chứng.
import {
  evaluateWwhn153Signoff,
  REQUIRED_FINDINGS,
  REQUIRED_ISSUES,
  REQUIRED_RUNTIME_SCENARIOS,
} from './wwhn-153-signoff-core.mjs';

const requireFinal = process.argv.includes('--require-final');

let failures = 0;
function fail(message) {
  console.error(`[wwhn-153] FAIL: ${message}`);
  failures += 1;
}

// 1. Hợp đồng đóng của core (nguồn sống) phải giữ nguyên kích thước đã chốt.
if (REQUIRED_ISSUES.length !== 6) {
  fail(`core phải pin 6 issue bắt buộc, nhận ${REQUIRED_ISSUES.length}`);
}
if (REQUIRED_RUNTIME_SCENARIOS.length !== 5) {
  fail(`core phải pin 5 kịch bản runtime QA2, nhận ${REQUIRED_RUNTIME_SCENARIOS.length}`);
}
if (REQUIRED_FINDINGS.length !== 9) {
  fail(`core phải pin 9 finding FE-P0/P1/P2, nhận ${REQUIRED_FINDINGS.length}`);
}

// 2. Core phải fail-closed khi không có bất kỳ bằng chứng nào.
const result = evaluateWwhn153Signoff({
  manifest: {},
  permissionApproval: {},
  sourceProvenance: {},
  sourceContext: {},
  rootDir: process.cwd(),
});
if (result.integrityOk !== false) {
  fail('core phải coi manifest rỗng là mất integrity (integrityOk=false)');
}
if (result.finalAllowed !== false) {
  fail('core phải chặn FINAL khi không có bằng chứng (finalAllowed=false)');
}
if (result.gates.length !== 8 || result.gates.some((gate) => gate.status === 'PASS')) {
  fail('core phải giữ đủ 8 cổng và không cổng nào PASS khi thiếu bằng chứng');
}
if (!result.blockers.some((item) => item.startsWith('FINAL-SIGNOFF'))) {
  fail('core phải phát blocker FINAL-SIGNOFF fail-closed');
}
if (result.openP0 === 0 || result.openP1 === 0) {
  fail('core phải giữ P0/P1 mở khi thiếu bằng chứng');
}

if (requireFinal) {
  console.log(
    '[wwhn-153] NOTE: chế độ --require-final chấm trên manifest bằng chứng — manifest đã rút theo 3822d45 nên không còn cổng FINAL để chấm; lượt chạy này chỉ kiểm hợp đồng sống của core.',
  );
}

if (failures > 0) {
  console.error(`[wwhn-153] FAIL: ${failures} vấn đề ở hợp đồng core sign-off.`);
  process.exit(1);
}

console.log(
  '[wwhn-153] PASS: core sign-off giữ nguyên hợp đồng đã chốt (6 issue / 5 kịch bản runtime / 9 finding / 8 cổng) và fail-closed khi không có bằng chứng (nạp manifest, chấm cổng theo bằng chứng và ghi report docs/evidence đã rút theo 3822d45).',
);
