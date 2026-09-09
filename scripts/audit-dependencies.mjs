/**
 * WWHN-SEC-13 — cổng chặn advisory cho dependency PRODUCTION (nhóm
 * `dependencies` của package.json; toolchain dev như vitest/jsdom không nằm
 * trong bundle nên không chặn build ở đây).
 *
 * Vì sao không dùng thẳng exit code của `yarn audit`: yarn 1 trả bitmask theo
 * MỌI severity tìm thấy bất kể --level, nên không phân biệt được "còn High thật"
 * với "chỉ còn Low đã chấp nhận". Script này đọc --json và tự quyết.
 *
 * Allowlist dưới đây là RỦI RO ĐÃ ĐÁNH GIÁ, mỗi mục bắt buộc có lý do + hàng
 * rào đi kèm. Thêm mục mới = một quyết định bảo mật, phải ghi ngày/người.
 */
import { execFileSync } from "node:child_process";

const ALLOWLISTED_ADVISORIES = new Map([
  // SheetJS (xlsx) 0.18.5 — bản cuối trên npm, không có bản vá trên npm.
  // Cả hai lỗ đều nằm ở ĐƯỜNG PARSE (XLSX.read/sheet_to_*), ứng dụng chỉ GHI
  // file xuất Excel và test sec07-supply-chain-guards.test.ts CẤM mọi API parse
  // ở CI. Đường xử lý thay thế: nâng lên bản cdn.sheetjs.com (0.20.3) — quyết
  // định thêm nguồn tarball ngoài registry thuộc về chủ repo.
  ["GHSA-4r6h-8v6p-xvw6", "xlsx prototype pollution — parse-path bị cấm bởi sec07 guard (09/09/2026)"],
  ["GHSA-5pgg-2g8v-p4x9", "xlsx ReDoS — parse-path bị cấm bởi sec07 guard (09/09/2026)"],
]);

const raw = (() => {
  try {
    return execFileSync("yarn", ["audit", "--groups", "dependencies", "--json"], {
      encoding: "utf8",
      shell: process.platform === "win32",
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (error) {
    // yarn audit thoát non-zero khi CÓ advisory — stdout vẫn là JSON lines.
    if (typeof error.stdout === "string" && error.stdout.length > 0) return error.stdout;
    console.error("Không chạy được yarn audit:", error.message);
    process.exit(2);
  }
})();

const blocking = [];
const accepted = [];
const informational = [];

for (const line of raw.split("\n")) {
  if (!line.trim()) continue;
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    continue;
  }
  if (entry.type !== "auditAdvisory") continue;

  const advisory = entry.data.advisory;
  const id = advisory.github_advisory_id ?? String(advisory.id);
  const label = `${id} [${advisory.severity}] ${advisory.module_name} — ${advisory.title}`;

  if (ALLOWLISTED_ADVISORIES.has(id)) {
    accepted.push(`${label}\n    lý do: ${ALLOWLISTED_ADVISORIES.get(id)}`);
  } else if (advisory.severity === "high" || advisory.severity === "critical") {
    blocking.push(label);
  } else {
    informational.push(label);
  }
}

const unique = (list) => [...new Set(list)];

if (unique(accepted).length > 0) {
  console.log("Advisory đã chấp nhận (có hàng rào đi kèm):");
  for (const item of unique(accepted)) console.log("  - " + item);
}
if (unique(informational).length > 0) {
  console.log("Advisory mức thấp/vừa (không chặn, cần theo dõi):");
  for (const item of unique(informational)) console.log("  - " + item);
}

if (unique(blocking).length > 0) {
  console.error("\nCổng dependency FAIL — advisory High/Critical chưa xử lý trong nhóm dependencies:");
  for (const item of unique(blocking)) console.error("  - " + item);
  console.error("\nXử lý bằng nâng phiên bản/resolutions, hoặc (hãn hữu) thêm vào allowlist KÈM lý do + hàng rào.");
  process.exit(1);
}

console.log("\nCổng dependency PASS — không còn advisory High/Critical chưa xử lý trong nhóm dependencies.");
