#!/usr/bin/env node
/**
 * WWHN-253 · FE252-P1-05R2 — dựng báo cáo QA2 App PV TỪ bằng chứng đã chạy.
 *
 * Script này KHÔNG tự khẳng định điều gì: nó đọc các tệp metadata do
 * `e2e/wwhn-253-pv-qa2-responsive.spec.ts` ghi ra, đối chiếu với ma trận bắt
 * buộc (khung nhìn × trạng thái) rồi mới sinh báo cáo. Thiếu một ô là exit 1 —
 * fail-closed, để không ai vô tình nộp một báo cáo "đủ" trong khi test chưa chạy.
 *
 * Dùng:
 *   SOURCE_SHA=<sha> npx playwright test e2e/wwhn-253-pv-qa2-responsive.spec.ts --project=chromium
 *   SOURCE_SHA=<sha> node scripts/generate-wwhn-253-qa2-report.mjs
 */
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const SOURCE_SHA =
  process.env.SOURCE_SHA ?? process.env.GITHUB_SHA ?? "local-uncommitted";
const EVIDENCE_DIR =
  process.env.WWHN_253_EVIDENCE_DIR ??
  join("test-results", "wwhn-253", SOURCE_SHA);
const OUTPUT_DIR = join("docs", "evidence", "WWHN-253");
const OUTPUT_FILE = join(OUTPUT_DIR, "QA2_PV_RESPONSIVE_REPORT.md");

const REQUIRED_VIEWPORTS = [
  "mobile-390x844",
  "tablet-768x1024",
  "desktop-1366x768",
  "desktop-1440x900",
];

/** Mỗi dòng là một yêu cầu tường minh của register FE252-P1-05R2. */
const REQUIRED_SCENARIOS = [
  ["public-catalog", "public — SCR-PV-01 ẩn danh, không gửi Authorization"],
  ["rbac-publish-denied", "RBAC — pv.master.manage KHÔNG mở khoá publish"],
  ["rbac-publish-allowed", "RBAC — pv.publish mở khoá publish"],
  ["error-500", "error — 500 kèm request_id"],
  ["offline", "offline — mất kết nối, không đá sang /login"],
  ["error-404", "404 — chi tiết sản phẩm không tồn tại"],
  ["error-429", "429 — giới hạn truy cập, không tự retry"],
  ["freshness-degraded", "freshness — NFR-SRS-016 cảnh báo dữ liệu cũ"],
];

function fail(message) {
  console.error(`[WWHN-253] FAIL: ${message}`);
  process.exit(1);
}

if (!existsSync(EVIDENCE_DIR)) {
  fail(
    `Chưa có thư mục bằng chứng "${EVIDENCE_DIR}". Chạy spec Playwright trước khi sinh báo cáo.`,
  );
}

const records = readdirSync(EVIDENCE_DIR)
  .filter((name) => name.endsWith(".json"))
  .map((name) => JSON.parse(readFileSync(join(EVIDENCE_DIR, name), "utf8")));

if (records.length === 0) {
  fail(`Thư mục "${EVIDENCE_DIR}" không có tệp metadata nào.`);
}

const byKey = new Map(
  records.map((record) => [`${record.scenario}::${record.viewportKey}`, record]),
);

const missing = [];
for (const [scenario] of REQUIRED_SCENARIOS) {
  for (const viewport of REQUIRED_VIEWPORTS) {
    if (!byKey.has(`${scenario}::${viewport}`)) {
      missing.push(`${scenario} @ ${viewport}`);
    }
  }
}
if (missing.length > 0) {
  fail(`Thiếu ${missing.length} ô bằng chứng:\n  - ${missing.join("\n  - ")}`);
}

const wrongSha = records.filter((record) => record.sourceSha !== SOURCE_SHA);
if (wrongSha.length > 0) {
  fail(
    `${wrongSha.length} tệp bằng chứng gắn SHA khác "${SOURCE_SHA}" — báo cáo phải nói về đúng một bản build.`,
  );
}

const notPass = records.filter((record) => record.result !== "PASS");
if (notPass.length > 0) {
  fail(`${notPass.length} ô không PASS.`);
}

const first = records[0];
const rows = REQUIRED_SCENARIOS.map(([scenario, label]) => {
  const cells = REQUIRED_VIEWPORTS.map((viewport) => {
    const record = byKey.get(`${scenario}::${viewport}`);
    return record ? "PASS" : "—";
  });
  return `| ${label} | ${cells.join(" | ")} |`;
}).join("\n");

const assertionList = REQUIRED_SCENARIOS.map(([scenario, label]) => {
  const record = byKey.get(`${scenario}::${REQUIRED_VIEWPORTS[0]}`);
  const bullets = (record.assertions ?? [])
    .map((assertion) => `  - ${assertion}`)
    .join("\n");
  return `- **${label}** (route \`${record.route}\`, vai \`${record.role}\`)\n${bullets}`;
}).join("\n");

const fileList = readdirSync(EVIDENCE_DIR)
  .filter((name) => name.endsWith(".png"))
  .sort()
  .map((name) => `- \`${join(EVIDENCE_DIR, name).replace(/\\/g, "/")}\``)
  .join("\n");

const report = `# WWHN-253 — Báo cáo QA2 App PV (FE252-P1-05R2)

> **Tệp sinh tự động — không sửa tay.** Nguồn: \`${EVIDENCE_DIR.replace(/\\/g, "/")}\`.
> Sinh lại: \`SOURCE_SHA=<sha> node scripts/generate-wwhn-253-qa2-report.mjs\`.

| Trường | Giá trị |
|---|---|
| Register item | FE252-P1-05R2 (WWHN-253) |
| Ticket cha | WWHN-252 |
| Exact review SHA | \`${SOURCE_SHA}\` |
| Build version | \`${first.buildVersion}\` |
| Môi trường | \`${first.environment}\` |
| Trình duyệt | \`${first.browserProject}\` (Chromium engine) |
| Số ô bằng chứng | ${records.length} (${REQUIRED_SCENARIOS.length} trạng thái × ${REQUIRED_VIEWPORTS.length} khung nhìn) |
| Kết quả | **PASS toàn bộ ma trận** |
| Sinh lúc | ${new Date().toISOString()} |

## 1. Ma trận khung nhìn × trạng thái

| Trạng thái \\ Khung nhìn | 390×844 | 768×1024 | 1366×768 | 1440×900 |
|---|---|---|---|---|
${rows}

Mọi ô đều kiểm thêm một điều kiện chung: **không tràn ngang**
(\`documentElement.scrollWidth <= window.innerWidth\`) — đây là lỗi responsive
hay lọt nhất và không thể thấy được qua ảnh chụp.

## 2. Khẳng định của từng trạng thái

${assertionList}

## 3. Ranh giới sự thật (đọc trước khi dùng làm bằng chứng nghiệm thu)

${first.truthBoundary}

Cụ thể: báo cáo này chứng minh **hành vi giao diện** khớp hợp đồng Annex C ở bốn
khung nhìn. Nó KHÔNG thay thế:

- Bằng chứng backend enforce quyền/data-scope → \`Wwhn252PvContractTest\`,
  \`Wwhn249PvSurfaceGovernanceTest\` (repo BE).
- UAT trên thiết bị thật của QA1/khách hàng → WWHN-275.

## 4. Tệp bằng chứng (ảnh)

${fileList}

Mỗi ảnh đi kèm một tệp \`.json\` cùng tên chứa SHA, khung nhìn, route, vai trò và
danh sách khẳng định. Video/trace của phiên chạy nằm trong \`test-results/\`.
`;

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(OUTPUT_FILE, report, "utf8");
console.log(
  `[WWHN-253] PASS — ${records.length} ô bằng chứng tại SHA ${SOURCE_SHA}. Báo cáo: ${OUTPUT_FILE}`,
);
