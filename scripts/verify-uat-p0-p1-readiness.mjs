#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join } from "node:path";

// ĐÃ RÚT theo 3822d45 (dọn kho tài liệu): phần lớn gate này từng đối chiếu
// docs/Task_docs_Jira/*.md, docs/evidence/wwhn-156/WWHN-156_CLOSURE_REGISTER.json
// và hai spec e2e (auth-role-navigation-qa2, wms-runtime-evidence) — tất cả đã
// được gỡ khỏi repo. Các kiểm tra đọc artefact đó rút theo; phần còn hiệu lực
// là bộ script sinh bằng chứng UAT phải tiếp tục tồn tại và được wiring.
const root = process.cwd();
const requiredFiles = [
  "scripts/capture-permission-403-evidence.mjs",
  "scripts/capture-role-scopes-screenshots.mjs",
  "scripts/run-wwhn-156-smoke.mjs",
];

function fail(message) {
  console.error(`[uat-p0-p1] ${message}`);
  process.exitCode = 1;
}

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) fail(`Missing required file: ${file}`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log(
  "[uat-p0-p1] PASS: UAT evidence tooling remains in place (doc/register/e2e checks retired by 3822d45).",
);
