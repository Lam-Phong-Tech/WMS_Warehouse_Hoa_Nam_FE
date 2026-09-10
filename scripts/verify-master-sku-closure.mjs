#!/usr/bin/env node
/**
 * WWHN-178 closure gate — R2 (2026-08-20).
 *
 * R1 của gate này forbid call-site bằng regex một-dòng
 * (`/http\.post\([^\n]*SKU_IMPORT_EXCEL/`). Prettier xuống dòng sau `(` nên
 * regex không bao giờ match — guard PASS trong khi /skus/import-excel đã được
 * gọi thật (WWHN-331). R2 đổi cơ chế: một capability master/SKU chỉ hợp lệ khi
 * path của nó TỒN TẠI trong OpenAPI đã pin. Không còn dựa vào hình dạng call-site,
 * nên refactor/format không thể làm guard câm lặng.
 *
 * R3 (10/09/2026): nguồn là chỉ mục path+method đã commit trong
 * docs/api-evidence/BE_CONTRACT_PIN.json, và gate TỰ xác minh niêm sha256 + số đếm của
 * nó (loadPinnedContract). R2 đọc swagger-api.json — tệp gitignored — và phó mặc việc
 * kiểm hash cho check:api-mapping: trên CI việc đó không bao giờ xảy ra (tệp vắng mặt),
 * còn trên máy dev một bản spec lệch pin vẫn cho PASS.
 */
import { existsSync, globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadPinnedContract } from "./pinned-openapi-contract.mjs";

const root = process.cwd();
const failures = [];

function read(path) {
  const fullPath = join(root, path);
  if (!existsSync(fullPath)) {
    failures.push(`Missing required file: ${path}`);
    return "";
  }
  return readFileSync(fullPath, "utf8");
}

function readSurface(patterns, label) {
  const files = patterns.flatMap((pattern) =>
    globSync(pattern, { cwd: root }).sort(),
  );
  if (!files.length) {
    failures.push(
      `${label}: no source file matched ${patterns.join(", ")} — the guarded surface disappeared`,
    );
    return { content: "", files: [] };
  }
  const content = files
    .map((file) => readFileSync(join(root, file), "utf8"))
    .join("\n");
  return { content, files };
}

function requirePattern(content, pattern, label) {
  if (!pattern.test(content)) failures.push(`${label}: missing ${pattern}`);
}

function forbidPattern(content, pattern, label) {
  if (pattern.test(content)) failures.push(`${label}: forbidden ${pattern}`);
}

// ---------------------------------------------------------------------------
// 1. Contract-pin gate: bề mặt master/SKU FE dùng phải nằm trong spec đã pin.
// ---------------------------------------------------------------------------
// Pin thiếu/hỏng/lệch niêm ⇒ ghi lỗi VÀ specPaths rỗng ⇒ cả 16 capability bên dưới cũng
// FAIL: không có nhánh nào cho qua khi nguồn hợp đồng không kiểm chứng được.
let specPaths = new Set();
try {
  const contract = loadPinnedContract(root);
  specPaths = contract.paths;
  console.log(
    `[master-sku-closure] pinned contract BE ${contract.pin.be_sha.slice(0, 12)}: ${contract.paths.size} path / ${contract.operations.length} operation (niêm ${contract.pin.operation_index.sha256.slice(0, 12)}…)`,
  );
} catch (error) {
  failures.push(error.message);
}

/**
 * Capability chính thức của WWHN-178 (R2). `:param` trong endpoints.ts tương
 * đương `{param}` trong OpenAPI — so khớp theo số đoạn path và đoạn tĩnh.
 */
const APPROVED_MASTER_SURFACE = [
  ["PRODUCT_LIST_CREATE", "/api/v1/products"],
  ["PRODUCT_DETAIL_UPDATE", "/api/v1/products/{id}"],
  ["PRODUCT_ENABLE", "/api/v1/products/{id}/enable"],
  ["PRODUCT_DISABLE", "/api/v1/products/{id}/disable"],
  ["PRODUCT_CATEGORIES", "/api/v1/product-categories"],
  ["BRANDS", "/api/v1/brands"],
  ["PRODUCT_MODELS", "/api/v1/product-models"],
  ["POWER_SOURCES", "/api/v1/power-sources"],
  ["PACKAGE_VARIANTS", "/api/v1/package-variants"],
  ["SKU_IMPORT_TEMPLATE", "/api/v1/skus/import-template"],
  ["SKU_IMPORT_EXCEL", "/api/v1/skus/import-excel"],
  ["SKU_IMPORT_REPORTS", "/api/v1/skus/import-reports"],
  ["SKU_IMPORT_REPORT", "/api/v1/skus/import-reports/{id}"],
  ["SKU_IMPORT_REPORT_ERROR_FILE", "/api/v1/skus/import-reports/{id}/error-file"],
  ["ITEM_INSTANCES", "/api/v1/item-instances"],
  ["PHYSICAL_CODES", "/api/v1/physical-codes"],
];

for (const [capability, path] of APPROVED_MASTER_SURFACE) {
  if (!specPaths.has(path)) {
    failures.push(
      `Capability ${capability}: path ${path} is NOT in the pinned OpenAPI — capability must fail closed`,
    );
  }
}

// Phantom endpoint: có controller BE nhưng không route/spec/bảng → FE gọi sẽ
// 404. Cấm cả định nghĩa lẫn call-site (chuỗi literal, không phụ thuộc format).
const srcSurface = readSurface(
  ["src/**/*.ts", "src/**/*.tsx"],
  "Application source surface",
);
for (const phantom of ['"/uoms"', '"/suppliers"', "'/uoms'", "'/suppliers'"]) {
  if (srcSurface.content.includes(phantom)) {
    failures.push(
      `Phantom endpoint ${phantom} referenced in src/ — no BE route/spec exists (404 RESOURCE_NOT_FOUND)`,
    );
  }
}

const endpoints = read("src/shared/api/endpoints.ts");
requirePattern(endpoints, /PRODUCTS:\s*"\/products"/, "Canonical Product endpoint");
requirePattern(
  endpoints,
  /SKU_IMPORT_EXCEL:\s*"\/skus\/import-excel"/,
  "Contract-pinned SKU import endpoint",
);

// ---------------------------------------------------------------------------
// 2. UI-state + permission guard trên bề mặt master-data hiện tại.
// ---------------------------------------------------------------------------
const pageSurface = readSurface(
  ["src/modules/master-data/pages/*.tsx"],
  "Master-data page surface",
);
const serviceSurface = readSurface(
  ["src/modules/master-data/services/*.ts"],
  "Master-data service surface",
);
const page = pageSurface.content;
const serviceTest = serviceSurface.files
  .filter((file) => /\.test\.tsx?$/.test(file))
  .map((file) => readFileSync(join(root, file), "utf8"))
  .join("\n");

requirePattern(page, /useCanManage\("sku\.manage"\)/, "SKU permission guard");
requirePattern(page, /useCanManage\("agency\.manage"\)/, "Agency permission guard");
requirePattern(serviceTest, /not\.toHaveBeenCalled\(\)|toThrow|rejects/, "Fail-closed unit test");

for (const [label, pattern] of [
  ["loading", /Đang tải dữ liệu từ API|isLoading|isFetching/i],
  ["empty", /Không có SKU phù hợp bộ lọc|emptyText|Chưa có/i],
  ["error", /ApiErrorAlert|isError|type="error"/i],
  ["success", /toast\.success|message\.success/i],
  ["disabled", /\bdisabled\b/i],
  ["responsive", /table-wrap|\bxs=|\bmd=|scroll=\{\{/i],
  ["accessibility", /aria-label|Tooltip|title=/i],
]) requirePattern(page, pattern, `Executable UI state ${label}`);

// ---------------------------------------------------------------------------
// 3. Task doc + closure register — ĐÃ RÚT theo 3822d45 (09/2026).
// ---------------------------------------------------------------------------
// docs/Task_docs_Jira/WWHN-178.md và docs/evidence/wwhn-178/*.json bị rút
// khỏi repo có chủ đích ("remove stale docs/evidence + Task_docs_Jira
// archives"). Theo nguyên tắc guard-không-sống-lâu-hơn-artefact, các check
// đọc hai artefact đó rút theo tại đây; phần 1-2 phía trên (pinned-contract
// surface, phantom-endpoint ban, RBAC/UI states trên MÃ NGUỒN đang sống)
// giữ nguyên hiệu lực — đó mới là thứ CI cần khoá mỗi commit.

if (failures.length) {
  console.error("[master-sku-closure] FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  "[master-sku-closure] PASS: 16 capability có trong hợp đồng pin (chỉ mục đã niêm), phantom-endpoint ban, RBAC/UI states enforced (task-doc/closure-register checks retired by 3822d45).",
);
