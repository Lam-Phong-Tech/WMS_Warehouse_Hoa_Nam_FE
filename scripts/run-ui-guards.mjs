#!/usr/bin/env node
/**
 * ui:guards — chạy ĐỦ mọi guard design-system và self-test rồi mới kết luận.
 *
 * VÌ SAO KHÔNG CÒN CHUỖI `&&`: trước 10/09/2026 `ui:guards` là `a && b && c …`. Guard
 * đầu tiên đỏ làm cả chuỗi dừng, nên CI chỉ thấy lỗi đầu tiên — đợt đó `ui:architecture`
 * đỏ đã che mất `ui:tokens` cũng đang đỏ, và không ai biết cho tới khi gỡ lỗi thứ nhất.
 *
 * Runner này chạy TẤT CẢ các bước, mỗi bước một tiến trình con riêng (log đi thẳng ra
 * stdout/stderr), in bảng tổng hợp và thoát 1 nếu BẤT KỲ bước nào không thoát 0 — kể cả
 * bước không spawn được hoặc bị dừng bởi tín hiệu. Không có bước nào được phép "cảnh báo".
 *
 * Thêm guard mới: thêm một dòng vào STEPS, đừng nối lại bằng `&&` trong package.json.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const STEPS = [
  ["ui:architecture", "scripts/check-ui-architecture.mjs"],
  ["ui:tokens", "scripts/check-ui-tokens.mjs"],
  ["ui:styles", "scripts/check-ui-styles.mjs"],
  ["ui:icons", "scripts/check-ui-icons.mjs"],
  ["ui:architecture --self-test", "scripts/check-ui-architecture.mjs", "--self-test"],
  ["ui:tokens --self-test", "scripts/check-ui-tokens.mjs", "--self-test"],
  ["ui:styles --self-test", "scripts/check-ui-styles.mjs", "--self-test"],
  ["ui:icons --self-test", "scripts/check-ui-icons.mjs", "--self-test"],
  ["ui:dependencies", "scripts/check-ui-dependencies.mjs"],
  ["ui:dependencies --self-test", "scripts/check-ui-dependencies.mjs", "--self-test"],
];

const results = STEPS.map(([label, script, ...args]) => {
  console.log(`\n[ui:guards] ==> ${label}`);
  const run = spawnSync(process.execPath, [join(root, script), ...args], {
    cwd: root,
    stdio: "inherit",
  });
  const ok = !run.error && run.signal === null && run.status === 0;
  const detail = run.error
    ? `không chạy được: ${run.error.message}`
    : run.signal
      ? `bị dừng bởi tín hiệu ${run.signal}`
      : `exit ${run.status}`;
  return { label, ok, detail };
});

console.log("\n[ui:guards] Tổng hợp:");
for (const result of results) {
  console.log(`  ${result.ok ? "PASS" : "FAIL"}  ${result.label} (${result.detail})`);
}

const failed = results.filter((result) => !result.ok);
if (failed.length > 0) {
  console.error(
    `\n[ui:guards] FAIL — ${failed.length}/${results.length} bước đỏ: ${failed.map((result) => result.label).join(", ")}`,
  );
  process.exit(1);
}
console.log(`\n[ui:guards] PASS — ${results.length}/${results.length} bước xanh.`);
