import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { REQUIRED_GATE_JOBS } from "../../scripts/assert-ci-gates.mjs";

/**
 * CI hard gates (10/09/2026) — giữ .github/workflows/ci.yml là tập cổng CỨNG.
 *
 * Sự cố gốc: mọi bước từng được phép lỗi mềm và một script tổng đọc biến outcome. 12 outcome
 * đỏ vĩnh viễn làm một test bảo mật mới đỏ không phân biệt được với nhiễu; E2E đã gỡ vẫn chạy
 * "No tests found"; một chuỗi `&&` che guard đỏ thứ hai. Test này chặn các kiểu tụt lùi đó
 * ngay trong bộ unit (và trong job security).
 */
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const workflow = readFileSync(
  path.join(repoRoot, ".github/workflows/ci.yml"),
  "utf8",
);
const lines = workflow.split(/\r?\n/);

/** Khối YAML của một job: từ dòng `  <job>:` tới job kế tiếp cùng thụt lề. */
function jobBlock(job: string): string {
  const start = lines.findIndex((line) => line === `  ${job}:`);
  if (start < 0) return "";
  const end = lines.findIndex(
    (line, index) => index > start && /^ {2}[A-Za-z0-9_-]+:\s*$/.test(line),
  );
  return lines.slice(start, end < 0 ? undefined : end).join("\n");
}

function needsOf(block: string): string[] {
  const list = block.match(/^ {4}needs: \[([^\]]*)\]\s*$/m)?.[1] ?? "";
  return list
    .split(",")
    .map((job) => job.trim())
    .filter(Boolean)
    .sort();
}

describe("CI hard gates — .github/workflows/ci.yml", () => {
  it("không bước nào được lỗi mềm hay nuốt exit code", () => {
    expect(workflow).not.toMatch(/continue-on-error/);
    expect(workflow).not.toMatch(/\|\|\s*true\b/);
    expect(workflow).not.toMatch(/\|\|\s*exit\s+0\b/);
    expect(workflow).not.toMatch(/\bset\s+\+e\b/);
  });

  it("đủ job cổng bắt buộc; cổng tổng chạy if: always() và needs đúng các job đó", () => {
    for (const job of REQUIRED_GATE_JOBS) {
      expect(jobBlock(job), `job ${job}`).not.toBe("");
    }
    const gates = jobBlock("gates");
    expect(gates).toContain("name: Enforce all quality gate outcomes");
    expect(gates).toMatch(/^ {4}if: \$\{\{ always\(\) \}\}\s*$/m);
    expect(needsOf(gates)).toEqual([...REQUIRED_GATE_JOBS].sort());
    expect(gates).toContain("run: node scripts/assert-ci-gates.mjs\n");
  });

  it("giao hàng DEV chỉ chạy khi mọi job cổng và cổng tổng đều đạt", () => {
    expect(needsOf(jobBlock("dev-delivery"))).toEqual(
      [...REQUIRED_GATE_JOBS, "gates"].sort(),
    );
  });

  it("job security quét credential, audit dependency và chạy bộ test bảo mật", () => {
    const security = jobBlock("security");
    for (const needle of [
      "node scripts/check-known-credentials.mjs",
      "node scripts/check-known-credentials.mjs --self-test",
      "node scripts/audit-dependencies.mjs",
      "node scripts/check-frontend-security-headers.mjs --self-test",
      "src/test/sec07-supply-chain-guards.test.ts",
      "src/test/sec13-dom-xss-guards.test.ts",
      "src/test/sec-p1-refresh-token-out-of-js.test.ts",
      "src/test/auth-security-rbac-audit.test.ts",
    ]) {
      expect(security).toContain(needle);
    }
  });

  it("không còn bước gọi bộ e2e đã gỡ ở 3822d45", () => {
    expect(workflow).not.toMatch(
      /npm run (?:test:e2e|ui:visual|ui:a11y|ui:responsive)/,
    );
    expect(workflow).not.toMatch(/playwright install/);
  });
});
