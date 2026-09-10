#!/usr/bin/env node
/**
 * Cổng tổng "Enforce all quality gate outcomes" của .github/workflows/ci.yml (10/09/2026).
 *
 * TRƯỚC ĐÂY: mọi bước nằm trong một job và đều được phép lỗi mềm; script này đọc 34 biến
 * *_OUTCOME rồi mới quyết định. Bước chết vĩnh viễn (E2E không còn spec) giữ cả cổng đỏ nên
 * lỗi mới không phân biệt được với nhiễu, còn quên nối một biến là bước đó im lặng.
 *
 * NAY: mỗi job cổng (REQUIRED_GATE_JOBS) tự FAIL cứng. Script này KHÔNG thay thế chúng — nó
 * là MỘT check ổn định cho branch protection và chỉ có thể làm đỏ thêm, không bao giờ biến
 * một cổng đỏ thành xanh:
 *  - job bắt buộc nào không `success` (failure / cancelled / skipped) ⇒ FAIL;
 *  - job bắt buộc vắng mặt trong `needs` ⇒ FAIL (sửa ci.yml mà quên nối vào cổng tổng);
 *  - bất kỳ job nào khác có trong `needs` mà không `success` ⇒ FAIL;
 *  - CI_NEEDS_JSON thiếu hoặc hỏng ⇒ FAIL.
 * Job cổng tổng chạy `if: always()` vì GitHub tính một required check bị skip là đạt.
 *
 *   CI_NEEDS_JSON='${{ toJSON(needs) }}' node scripts/assert-ci-gates.mjs
 *   node scripts/assert-ci-gates.mjs --self-test
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const REQUIRED_GATE_JOBS = Object.freeze(["security", "static", "unit", "contracts", "build"]);

/** Trả danh sách vấn đề; mảng rỗng nghĩa là mọi job cổng đều success. */
export function evaluateGateJobs(needs, required = REQUIRED_GATE_JOBS) {
  if (!needs || typeof needs !== "object" || Array.isArray(needs)) {
    return ["CI_NEEDS_JSON không phải object `needs` hợp lệ"];
  }
  const problems = [];
  for (const job of required) {
    if (!Object.hasOwn(needs, job)) {
      problems.push(`${job}: missing — job bắt buộc không nằm trong needs của cổng tổng`);
    }
  }
  for (const [job, value] of Object.entries(needs)) {
    const result = value && typeof value === "object" ? value.result : undefined;
    if (result !== "success") problems.push(`${job}: ${result ?? "unknown"}`);
  }
  return problems;
}

function selfTest() {
  const allSuccess = Object.fromEntries(
    REQUIRED_GATE_JOBS.map((job) => [job, { result: "success", outputs: {} }]),
  );
  const withoutContracts = Object.fromEntries(
    Object.entries(allSuccess).filter(([job]) => job !== "contracts"),
  );
  const cases = [
    ["mọi job success ⇒ PASS", allSuccess, true],
    ["một job failure ⇒ FAIL", { ...allSuccess, unit: { result: "failure" } }, false],
    ["một job skipped ⇒ FAIL", { ...allSuccess, build: { result: "skipped" } }, false],
    ["một job cancelled ⇒ FAIL", { ...allSuccess, static: { result: "cancelled" } }, false],
    ["thiếu job bắt buộc ⇒ FAIL", withoutContracts, false],
    ["job ngoài danh sách không success ⇒ FAIL", { ...allSuccess, extra: { result: "failure" } }, false],
    ["kết quả không đọc được ⇒ FAIL", { ...allSuccess, security: {} }, false],
    ["needs không hợp lệ ⇒ FAIL", null, false],
  ];

  let failed = 0;
  for (const [name, needs, shouldPass] of cases) {
    const passed = evaluateGateJobs(needs).length === 0;
    const ok = passed === shouldPass;
    if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  }
  console.log(failed === 0 ? "\n[ci-gate --self-test] PASS" : `\n[ci-gate --self-test] FAIL (${failed} case)`);
  return failed === 0 ? 0 : 1;
}

function main() {
  if (process.argv.includes("--self-test")) process.exit(selfTest());

  let needs = null;
  try {
    needs = process.env.CI_NEEDS_JSON ? JSON.parse(process.env.CI_NEEDS_JSON) : null;
  } catch {
    needs = null;
  }

  const problems = evaluateGateJobs(needs);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`[ci-gate] ${problem}`);
    console.error(`[ci-gate] FAIL: ${problems.length} vấn đề — mọi job cổng bắt buộc phải success.`);
    process.exit(1);
  }
  console.log(
    `[ci-gate] PASS: ${REQUIRED_GATE_JOBS.length} job cổng bắt buộc đều success (${REQUIRED_GATE_JOBS.join(", ")}).`,
  );
}

const invokedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) main();
