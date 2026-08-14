#!/usr/bin/env node
/**
 * Tạo gói bàn giao kết quả test chuẩn hóa trong test-results/:
 *   - TEST_HANDOFF_SUMMARY.json  (máy đọc — CI/QA tool)
 *   - TEST_HANDOFF_SUMMARY.md    (người đọc — gửi tester/QA)
 *
 * Cách dùng:
 *   node scripts/create-test-handoff.mjs          # chỉ tổng hợp từ file kết quả có sẵn
 *   node scripts/create-test-handoff.mjs --run    # chạy unit + e2e trước rồi tổng hợp
 *   node scripts/create-test-handoff.mjs --run --unit-only
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const resultsDir = path.join(rootDir, "test-results");
const args = new Set(process.argv.slice(2));

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function readJson(relPath) {
  const abs = path.join(rootDir, relPath);
  if (!existsSync(abs)) return null;
  try {
    return JSON.parse(readFileSync(abs, "utf8"));
  } catch {
    return null;
  }
}

function runStep(name, command, cmdArgs) {
  console.log(`\n=== [handoff] ${name}: ${command} ${cmdArgs.join(" ")} ===`);
  const result = spawnSync(command, cmdArgs, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return result.status === 0 ? "passed" : "failed";
}

const stepOutcomes = {};
if (args.has("--run")) {
  stepOutcomes.unit = runStep("Unit/integration (vitest)", "npx", [
    "vitest",
    "run",
  ]);
  if (!args.has("--unit-only")) {
    stepOutcomes.e2e = runStep("E2E (playwright)", "npx", [
      "playwright",
      "test",
    ]);
  }
}

// ---- Vitest (JSON reporter schema: numTotalTests/numPassedTests/...) ----
const vitest = readJson("test-results/vitest-results.json");
const vitestSummary = vitest
  ? {
      status: vitest.success ? "passed" : "failed",
      total: vitest.numTotalTests ?? 0,
      passed: vitest.numPassedTests ?? 0,
      failed: vitest.numFailedTests ?? 0,
      skipped: vitest.numPendingTests ?? 0,
      testSuites: vitest.numTotalTestSuites ?? 0,
      startTime: vitest.startTime ? new Date(vitest.startTime).toISOString() : null,
      reportFiles: [
        "test-results/vitest-results.json",
        "test-results/vitest-junit.xml",
      ],
    }
  : null;

// ---- Playwright (JSON reporter: stats.expected/unexpected/skipped/flaky) ----
const playwright = readJson("test-results/playwright-results.json");
const playwrightSummary = playwright?.stats
  ? {
      status: (playwright.stats.unexpected ?? 0) === 0 ? "passed" : "failed",
      passed: playwright.stats.expected ?? 0,
      failed: playwright.stats.unexpected ?? 0,
      flaky: playwright.stats.flaky ?? 0,
      skipped: playwright.stats.skipped ?? 0,
      durationMs: Math.round(playwright.stats.duration ?? 0),
      reportFiles: [
        "test-results/playwright-results.json",
        "test-results/playwright-junit.xml",
        "playwright-report/index.html",
      ],
    }
  : null;

const gateValues = [vitestSummary?.status, playwrightSummary?.status].filter(
  Boolean,
);
const overallStatus =
  gateValues.length === 0
    ? "no-results"
    : gateValues.every((s) => s === "passed")
      ? "passed"
      : "failed";

const summary = {
  schemaVersion: "1.0.0",
  project: "wms-hoa-nam-frontend",
  generatedAt: new Date().toISOString(),
  git: {
    branch: git("rev-parse --abbrev-ref HEAD"),
    sha: git("rev-parse HEAD"),
    lastCommit: git("log -1 --format=%s"),
  },
  overallStatus,
  suites: {
    unit: vitestSummary,
    e2e: playwrightSummary,
  },
  runOutcomes: Object.keys(stepOutcomes).length > 0 ? stepOutcomes : undefined,
};

mkdirSync(resultsDir, { recursive: true });
writeFileSync(
  path.join(resultsDir, "TEST_HANDOFF_SUMMARY.json"),
  `${JSON.stringify(summary, null, 2)}\n`,
);

const statusIcon = (s) =>
  s === "passed" ? "✅ PASSED" : s === "failed" ? "❌ FAILED" : "⚠️ N/A";

const md = [
  "# Gói bàn giao kết quả test — WMS Hoa Nam FE",
  "",
  `- **Thời điểm tạo:** ${summary.generatedAt}`,
  `- **Nhánh:** \`${summary.git.branch}\` — commit \`${summary.git.sha?.slice(0, 12)}\` (${summary.git.lastCommit})`,
  `- **Kết quả tổng:** ${statusIcon(overallStatus)}`,
  "",
  "## Unit / Integration (Vitest)",
  vitestSummary
    ? [
        `- Trạng thái: ${statusIcon(vitestSummary.status)}`,
        `- Tổng: ${vitestSummary.total} | Pass: ${vitestSummary.passed} | Fail: ${vitestSummary.failed} | Skip: ${vitestSummary.skipped}`,
        `- File kết quả: ${vitestSummary.reportFiles.map((f) => `\`${f}\``).join(", ")}`,
      ].join("\n")
    : "- Chưa có kết quả (chạy `yarn test` để sinh).",
  "",
  "## E2E (Playwright)",
  playwrightSummary
    ? [
        `- Trạng thái: ${statusIcon(playwrightSummary.status)}`,
        `- Pass: ${playwrightSummary.passed} | Fail: ${playwrightSummary.failed} | Flaky: ${playwrightSummary.flaky} | Skip: ${playwrightSummary.skipped}`,
        `- Thời lượng: ${(playwrightSummary.durationMs / 1000).toFixed(1)}s`,
        `- File kết quả: ${playwrightSummary.reportFiles.map((f) => `\`${f}\``).join(", ")}`,
      ].join("\n")
    : "- Chưa có kết quả (chạy `yarn test:e2e` để sinh).",
  "",
  "## Nội dung gói gửi QA",
  "- `test-results/TEST_HANDOFF_SUMMARY.json` — tóm tắt máy đọc",
  "- `test-results/TEST_HANDOFF_SUMMARY.md` — tài liệu này",
  "- `test-results/vitest-junit.xml`, `test-results/playwright-junit.xml` — chuẩn JUnit cho hệ thống quản lý test",
  "- `playwright-report/` — báo cáo HTML tương tác (trace/screenshot/video khi fail)",
  "- `coverage/` — độ phủ code (khi chạy `yarn test:coverage`)",
  "",
].join("\n");

writeFileSync(path.join(resultsDir, "TEST_HANDOFF_SUMMARY.md"), md);

console.log(`\n[handoff] Đã ghi test-results/TEST_HANDOFF_SUMMARY.{json,md}`);
console.log(`[handoff] Kết quả tổng: ${overallStatus.toUpperCase()}`);
process.exit(overallStatus === "failed" ? 1 : 0);
