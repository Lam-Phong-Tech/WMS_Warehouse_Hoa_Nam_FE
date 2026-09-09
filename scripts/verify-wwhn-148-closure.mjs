#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];
const fail = (message) => failures.push(message);

function readRequired(path) {
  const fullPath = join(root, path);
  if (!existsSync(fullPath)) {
    fail(`Missing required file: ${path}`);
    return "";
  }
  return readFileSync(fullPath, "utf8");
}

function requirePatterns(path, patterns) {
  const content = readRequired(path);
  for (const pattern of patterns) {
    if (!pattern.test(content)) fail(`${path} is missing required pattern ${pattern}`);
  }
  return content;
}

// ── Tài liệu canonical + back-reference — ĐÃ RÚT theo 3822d45 ──────────────
// docs/Task_docs_Jira/WWHN-148.md và các doc tham chiếu chéo đã được gỡ khỏi
// repo trong đợt dọn kho tài liệu (commit 3822d45); các kiểm tra đọc artefact
// đó rút theo. Kiểm tra mã nguồn sống phía dưới giữ nguyên hiệu lực.

// WWHN-296 refreshed the active M1 mapping to the current MVP baseline. Keep
// critical posting paths and explicitly prove that historical Stocktake was removed.
requirePatterns("docs/api-evidence/M1_API_MAPPING.md", [
  /POST\s+\|\s+`\/scan\/classify`/,
  /POST\s+\|\s+`\/inbound-documents\/\{id\}\/post-receipt`/,
  /POST\s+\|\s+`\/outbound-documents\/\{id\}\/post-issue`/,
  /Removed-from-MVP boundary — Stocktake/,
  /Reversal append-only/i,
  /independent gates/i,
]);

// ── Closure manifest + QA2 runbook (docs/evidence/wwhn-148) — ĐÃ RÚT ───────
// Thư mục docs/evidence đã bị gỡ khỏi repo theo 3822d45; hai kiểm tra đọc
// WWHN-148_CLOSURE_MANIFEST.json và QA2_RUNTIME_EVIDENCE_RUNBOOK.md rút theo.

const normalizationPath = "docs/api-evidence/WWHN-148_NORMALIZATION_REGISTER.json";
const normalizationText = readRequired(normalizationPath);
if (normalizationText) {
  try {
    const normalization = JSON.parse(normalizationText);
    if (normalization.task !== "WWHN-148") {
      fail(`${normalizationPath} task mismatch.`);
    }
    if (!Array.isArray(normalization.criticalFlows)) {
      fail(`${normalizationPath} must define criticalFlows.`);
    }
    for (const flow of normalization.criticalFlows ?? []) {
      if (!flow.id || !flow.service || !Array.isArray(flow.requiredCanonicalFields)) {
        fail(`${normalizationPath} has an invalid critical flow entry.`);
      }
      if (flow.legacySuccessAliasesAllowed !== true) {
        fail(
          `${flow.id} must explicitly preserve current temporary alias policy until BE contract lock.`,
        );
      }
    }
  } catch (error) {
    fail(`${normalizationPath} is invalid JSON: ${error.message}`);
  }
}

const viteConfig = readRequired("vite.config.ts");
for (const forbidden of [
  /vitest\/config/,
  /\b__dirname\b/,
  /\b__filename\b/,
  /\brequire\s*\(/,
]) {
  if (forbidden.test(viteConfig)) {
    fail(`vite.config.ts contains forbidden pattern ${forbidden}`);
  }
}
for (const required of [
  /from "vite"/,
  /from "node:path"/,
  /from "node:url"/,
  /fileURLToPath\(import\.meta\.url\)/,
]) {
  if (!required.test(viteConfig)) fail(`vite.config.ts is missing ${required}`);
}

// ── e2e/wms-runtime-evidence.spec.ts — ĐÃ RÚT theo 3822d45 (bộ e2e đã gỡ) ──

requirePatterns("src/test/wwhn-148-critical-response-contract.test.ts", [
  /accepts canonical snake_case success evidence/,
  /rejects undocumented receipt aliases/,
  /rejects undocumented issue aliases/,
  /REQ-SRS-037/,
]);

const packageJsonText = readRequired("package.json");
if (packageJsonText) {
  try {
    const packageJson = JSON.parse(packageJsonText);
    if (
      packageJson.scripts?.["wwhn-148:verify"] !==
      "node scripts/verify-wwhn-148-closure.mjs"
    ) {
      fail("package.json must expose the exact wwhn-148:verify script.");
    }
  } catch (error) {
    fail(`package.json is invalid JSON: ${error.message}`);
  }
}

requirePatterns(".github/workflows/ci.yml", [
  /Verify WWHN-148 FE closure/,
  /npm run wwhn-148:verify/,
]);

// Ranh giới independent-evidence từng nằm trong tài liệu canonical — đã rút
// theo 3822d45 cùng khối tài liệu phía trên.

if (failures.length) {
  for (const failure of failures) console.error(`[wwhn-148] ERROR: ${failure}`);
  process.exit(1);
}

console.log(
  "[wwhn-148] PASS: live-source closure checks hold (M1 mapping, normalization register, vite config, contract test, script/CI wiring); doc/evidence/e2e checks retired by 3822d45.",
);
