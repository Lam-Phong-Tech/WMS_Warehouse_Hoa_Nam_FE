#!/usr/bin/env node
/**
 * WWHN-247 (Luồng 04 · Bảo hành — FE) fail-closed closure verifier.
 *
 * Gate này chặn đúng những cách WWHN-247 đã từng trượt và có thể trượt lại trong
 * im lặng:
 *
 *  - PII/RBAC: màn WAR-01/WAR-03 render thẳng giá trị nhận từ API. Đúng lúc BE
 *    mask thì trông "ổn", nhưng mọi hồi quy BE / alias cũ / response cache đều
 *    biến thành rò rỉ PII thật (§13.8 + NFR-SRS-015).
 *  - Status enum: ma trận transition của FE trôi khỏi
 *    CurrentBaselineWarrantyController::TRANSITIONS (DEC-WAR-STATE-001) và không ai
 *    thấy, vì mỗi bên chỉ tự test chính mình.
 *  - Endpoint mismatch: FE gọi path không tồn tại/khác permission so với Annex C.
 *  - Dependency HN-WAR-001 (WWHN-244): "API chưa sẵn" không được phép là câu nói
 *    miệng — verifier đối chiếu thẳng routes của BE.
 *  - Mojibake: nguồn tiếng Việt hỏng encoding quay lại.
 *  - Evidence: register không có SHA thật, hoặc còn placeholder verdict.
 *
 * Chạy: npm run verify:wwhn-247
 *   Cross-repo mặc định trỏ ../../HoaNam_BE/WMS_Warehouse_Hoa_Nam_BE, ghi đè bằng
 *   WWHN_247_BE_ROOT=<path>. Dùng --fe-only khi CI không có BE trong workspace —
 *   khi đó phần dependency được đánh dấu SKIPPED chứ không được coi là PASS.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const feOnly = process.argv.includes("--fe-only");
const beRoot = resolve(
  process.env.WWHN_247_BE_ROOT ??
    join(root, "..", "..", "HoaNam_BE", "WMS_Warehouse_Hoa_Nam_BE"),
);

function fail(message) {
  console.error(`[WWHN-247] FAIL: ${message}`);
  process.exit(1);
}

function readRequired(path, base = root) {
  const absolute = join(base, path);
  if (!existsSync(absolute)) {
    fail(`Missing required artifact: ${path}`);
  }
  return readFileSync(absolute, "utf8");
}

function requireText(text, needle, context) {
  if (!text.includes(needle)) {
    fail(`${context} must contain ${JSON.stringify(needle)}`);
  }
}

function refuseText(text, needle, context, reason) {
  if (text.includes(needle)) {
    fail(`${context} must not contain ${JSON.stringify(needle)}: ${reason}`);
  }
}

/** So khớp nội dung người đọc thấy, bỏ qua cách Prettier ngắt dòng. */
function requirePhrase(text, phrase, context) {
  const flatten = (value) => value.replace(/\s+/g, " ").trim();
  if (!flatten(text).includes(flatten(phrase))) {
    fail(`${context} must contain the phrase ${JSON.stringify(phrase)}`);
  }
}

const feFiles = {
  constants: "src/modules/warranty/constants.ts",
  service: "src/modules/warranty/services/warrantyService.ts",
  types: "src/modules/warranty/types/index.ts",
  page: "src/modules/warranty/pages/WarrantyPage.tsx",
  detail: "src/modules/warranty/components/WarrantyDetailModal.tsx",
  intake: "src/modules/warranty/components/WarrantyIntakeModal.tsx",
  endpoints: "src/shared/api/endpoints.ts",
  closureTest: "src/test/wwhn-247-warranty-closure.test.ts",
  taskDoc: "docs/Task_docs_Jira/WWHN-247.md",
  register: "docs/evidence/WWHN-247/WWHN-247_CLOSURE_REGISTER.json",
  matrix: "docs/evidence/WWHN-247/STATUS_MATRIX.md",
  packageJson: "package.json",
};

const src = Object.fromEntries(
  Object.entries(feFiles).map(([key, path]) => [key, readRequired(path)]),
);

// ─────────────────────────────────────────────────────────────
// 1. §13.8 · PII fail-closed ở CẢ tầng service lẫn tầng render
// ─────────────────────────────────────────────────────────────
for (const helper of [
  "maskWarrantyName",
  "maskWarrantyPhone",
  "maskWarrantyAddress",
  "warrantyPiiText",
]) {
  requireText(src.constants, `export function ${helper}`, feFiles.constants);
}

requireText(src.service, "function resolveWarrantyPii", feFiles.service);
requireText(src.service, "P.WARRANTY_PII_VIEW", feFiles.service);
requireText(src.service, "pii_masked: pii.pii_masked", feFiles.service);
requireText(src.types, "pii_masked: boolean", feFiles.types);

// Service phải là cửa duy nhất: không được gán thẳng payload vào field PII nữa.
for (const rawAssignment of [
  "customer_name: text(row.customer_name",
  "customer_phone: text(row.customer_phone)",
  "customer_address: text(row.customer_address)",
]) {
  refuseText(
    src.service,
    rawAssignment,
    feFiles.service,
    "PII phải đi qua resolveWarrantyPii, không gán thẳng từ payload",
  );
}

// Tầng render của WAR-01/WAR-03 không được in thẳng field PII.
for (const [key, path] of [
  ["page", feFiles.page],
  ["detail", feFiles.detail],
]) {
  requireText(src[key], "warrantyPiiText(", path);
  for (const rawRender of [
    "{row.customer_name}",
    "{row.customer_phone}",
    "{detail.customer_name}",
    "{detail.customer_phone}",
    "{detail.customer_address}",
  ]) {
    refuseText(
      src[key],
      rawRender,
      path,
      "§13.8 cấm render PII thô; phải đi qua warrantyPiiText",
    );
  }
}

// Form tiếp nhận/hiệu chỉnh phải khoá field PII theo quyền.
requireText(src.detail, "disabled={!canViewPii}", feFiles.detail);

// ─────────────────────────────────────────────────────────────
// 2. §6 + DEC-WAR-STATE-001 · ma trận transition
// ─────────────────────────────────────────────────────────────
const DECIDED_TRANSITIONS = {
  RECEIVED: ["CANCELLED", "CHECKING"],
  CHECKING: ["CANCELLED", "COMPLETED", "REPAIRING"],
  REPAIRING: ["CANCELLED", "COMPLETED"],
  COMPLETED: ["CANCELLED", "RETURNED"],
};

function parseFeMatrix(text) {
  const block = text.match(
    /export const WARRANTY_NEXT_STATUS[\s\S]*?=\s*{([\s\S]*?)\n};/,
  );
  if (!block) fail(`${feFiles.constants}: cannot parse WARRANTY_NEXT_STATUS`);
  const matrix = {};
  for (const line of block[1].split("\n")) {
    const entry = line.match(/^\s*([A-Z_]+):\s*\[([^\]]*)\],?\s*$/);
    if (!entry) continue;
    matrix[entry[1]] = entry[2]
      .split(",")
      .map((value) => value.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean)
      .sort();
  }
  return matrix;
}

const feMatrix = parseFeMatrix(src.constants);
if (JSON.stringify(feMatrix) !== JSON.stringify(DECIDED_TRANSITIONS)) {
  fail(
    `${feFiles.constants}: WARRANTY_NEXT_STATUS lệch ma trận DEC-WAR-STATE-001.\n` +
      `  FE      = ${JSON.stringify(feMatrix)}\n` +
      `  DECIDED = ${JSON.stringify(DECIDED_TRANSITIONS)}`,
  );
}

// Guard bắt buộc của BE phải được chặn ngay trên form, không để 422 round-trip.
requireText(
  src.constants,
  "WARRANTY_DIAGNOSIS_REQUIRED_TARGETS",
  feFiles.constants,
);
requireText(src.constants, "WARRANTY_NOTE_REQUIRED_LABELS", feFiles.constants);
requireText(src.detail, "diagnosisRequired", feFiles.detail);
requireText(src.detail, "noteRequiredLabel", feFiles.detail);

// ─────────────────────────────────────────────────────────────
// 3. Annex C · endpoint catalog FE
// ─────────────────────────────────────────────────────────────
const ANNEX_C_PATHS = [
  "/warranty-cases",
  "/warranty-cases/:id",
  "/warranty-cases/:id/status",
  "/warranty-cases/:caseId/events",
  "/warranty-cases/:caseId/attachments",
  "/warranty-attachments/:id",
  "/warranty-attachments/:id/download",
  "/warranty-component-issues",
  "/warranty-component-issues/:id",
  "/warranty-component-issues/:id/scans",
  "/warranty-component-issues/:id/cancel",
  "/warranty-component-issues/:id/post",
];
for (const path of ANNEX_C_PATHS) {
  requireText(src.endpoints, `"${path}"`, feFiles.endpoints);
}
// Alias legacy của BE vẫn tồn tại để tương thích, nhưng FE không được quay lại dùng.
refuseText(
  src.endpoints,
  '"/component-issue-documents',
  feFiles.endpoints,
  "Annex C là canonical; alias legacy chỉ để BE giữ tương thích ngược",
);
refuseText(
  src.service,
  "http.patch(",
  feFiles.service,
  "transitionWarrantyStatus là POST /warranty-cases/{id}/status; PATCH là alias legacy",
);

// ─────────────────────────────────────────────────────────────
// 4. Annex D SCR-WAR-01 · skeleton / empty / error / scan-focus
// ─────────────────────────────────────────────────────────────
requireText(src.page, "loading={listQuery.isLoading", feFiles.page);
requireText(src.page, "emptyText", feFiles.page);
requireText(src.page, "ApiErrorAlert", feFiles.page);
requireText(src.page, "autoFocus", feFiles.page);
requirePhrase(src.page, 'if (event.key !== "Enter") return;', feFiles.page);
requireText(src.detail, "ApiErrorAlert", feFiles.detail);
requireText(src.detail, "loading={eventsQuery.isLoading}", feFiles.detail);

// ─────────────────────────────────────────────────────────────
// 5. Mojibake · nguồn tiếng Việt phải còn nguyên UTF-8
// ─────────────────────────────────────────────────────────────
const MOJIBAKE = ["�", "Ã¡", "Ã ", "áº", "Ä‘", "â€", "Æ°", "Ãª", "Ã´"];
for (const [key, path] of Object.entries(feFiles)) {
  if (path.endsWith(".json") || path === feFiles.packageJson) continue;
  for (const marker of MOJIBAKE) {
    refuseText(
      src[key],
      marker,
      path,
      "mojibake — file phải được lưu UTF-8 không BOM",
    );
  }
}

// ─────────────────────────────────────────────────────────────
// 6. QA · test đóng lỗi phải tồn tại và thực sự kiểm điều đã hứa
// ─────────────────────────────────────────────────────────────
for (const assertion of [
  "pii_masked",
  "N*** V*** A***",
  "*******922",
  "DECIDED_TRANSITIONS",
]) {
  requireText(src.closureTest, assertion, feFiles.closureTest);
}
requirePhrase(
  src.closureTest,
  "PII thô từ API KHÔNG bao giờ ra khỏi service",
  feFiles.closureTest,
);

// ─────────────────────────────────────────────────────────────
// 7. Dependency HN-WAR-001 / WWHN-244 · đối chiếu thẳng BE
// ─────────────────────────────────────────────────────────────
let dependencyState = "SKIPPED";
if (!existsSync(beRoot)) {
  if (!feOnly) {
    fail(
      `Không tìm thấy BE tại ${beRoot}. Đặt WWHN_247_BE_ROOT hoặc chạy --fe-only ` +
        `(khi đó dependency HN-WAR-001 KHÔNG được coi là đã đóng).`,
    );
  }
  console.warn(
    "[WWHN-247] WARN: bỏ qua đối chiếu BE (--fe-only). Dependency HN-WAR-001 = SKIPPED.",
  );
} else {
  const beRoutes = readRequired(
    "Modules/Warehouse/routes/api.php",
    beRoot,
  );
  const beController = readRequired(
    "Modules/Warehouse/app/Http/Controllers/CurrentBaselineWarrantyController.php",
    beRoot,
  );
  const beCanonical = readRequired(
    "Modules/Warehouse/app/Http/Controllers/CanonicalMvpController.php",
    beRoot,
  );
  const beMasker = readRequired("app/Support/WarrantyPiiMasker.php", beRoot);

  // 7a. Mọi path FE gọi phải có route thật ở BE.
  const beRoutePaths = new Set();
  for (const match of beRoutes.matchAll(
    /Route::(?:get|post|patch|put|delete)\(\s*'([^']+)'/g,
  )) {
    const normalized = match[1].replace(/\{[^}]+\}/g, "{}");
    beRoutePaths.add(`/${normalized}`);
  }
  for (const path of ANNEX_C_PATHS) {
    const normalized = path.replace(/:[A-Za-z]+/g, "{}");
    if (!beRoutePaths.has(normalized)) {
      fail(
        `HN-WAR-001: FE gọi ${path} nhưng BE không khai route tương ứng (${normalized}).`,
      );
    }
  }

  // 7b. Permission Annex C trên bề mặt đọc/ghi.
  requireText(
    beRoutes,
    "Route::get('warranty-cases', [CanonicalMvpController::class, 'listWarrantyCases'])->middleware('permission:warranty.view|warranty.manage')",
    "BE routes/api.php",
  );
  requireText(
    beRoutes,
    "Route::post('warranty-cases/{id}/status'",
    "BE routes/api.php",
  );

  // 7c. Ma trận BE phải trùng khít ma trận FE.
  const beBlock = beController.match(
    /const TRANSITIONS\s*=\s*\[([\s\S]*?)\n\s*\];/,
  );
  if (!beBlock) fail("BE: cannot parse CurrentBaselineWarrantyController::TRANSITIONS");
  const beMatrix = {};
  for (const line of beBlock[1].split("\n")) {
    const entry = line.match(/'([A-Z_]+)'\s*=>\s*\[([^\]]*)\]/);
    if (!entry) continue;
    const targets = entry[2]
      .split(",")
      .map((value) => value.trim().replace(/^'|'$/g, ""))
      .filter(Boolean)
      .sort();
    if (targets.length > 0) beMatrix[entry[1]] = targets;
  }
  if (JSON.stringify(beMatrix) !== JSON.stringify(feMatrix)) {
    fail(
      "Ma trận transition FE và BE đã trôi khỏi nhau.\n" +
        `  FE = ${JSON.stringify(feMatrix)}\n` +
        `  BE = ${JSON.stringify(beMatrix)}`,
    );
  }

  // 7d. BE vẫn là authority masking và có khoá bằng test.
  requireText(beMasker, "final class WarrantyPiiMasker", "BE WarrantyPiiMasker");
  requireText(
    beController,
    "hasPermission('warranty.pii.view')",
    "BE CurrentBaselineWarrantyController",
  );
  requireText(
    beController,
    "'pii_masked' =>",
    "BE CurrentBaselineWarrantyController",
  );
  requireText(beCanonical, "pii_masked = $piiHidden", "BE CanonicalMvpController");
  for (const test of [
    "tests/Feature/Wwhn244WarrantyStateMatrixTest.php",
    "tests/Feature/WarrantyFlow04ApiSurfaceTest.php",
  ]) {
    if (!existsSync(join(beRoot, test))) {
      fail(`BE phải giữ ${test} — ma trận/bề mặt API không được để trôi tự do.`);
    }
  }
  dependencyState = "VERIFIED";
}

// ─────────────────────────────────────────────────────────────
// 8. Evidence register · SHA thật, không placeholder
// ─────────────────────────────────────────────────────────────
let register;
try {
  register = JSON.parse(src.register);
} catch (error) {
  fail(`${feFiles.register} is not valid JSON: ${error.message}`);
}
for (const field of ["task", "candidate", "defects", "qa", "dependency"]) {
  if (register[field] === undefined) {
    fail(`${feFiles.register} must declare "${field}"`);
  }
}
if (register.task !== "WWHN-247") {
  fail(`${feFiles.register}.task must be "WWHN-247"`);
}
for (const key of ["feSha", "beSha"]) {
  if (!/^[0-9a-f]{40}$/.test(register.candidate?.[key] ?? "")) {
    fail(
      `${feFiles.register}.candidate.${key} phải là SHA đầy đủ 40 ký tự — ` +
        "sign-off không neo được vào revision thì không kiểm chứng lại được.",
    );
  }
}
if ((register.defects ?? []).length === 0) {
  fail(`${feFiles.register}.defects không được rỗng`);
}
for (const defect of register.defects) {
  for (const field of ["id", "severity", "title", "fix", "proof"]) {
    if (!defect[field]) {
      fail(`${feFiles.register}: defect ${defect.id ?? "?"} thiếu "${field}"`);
    }
  }
  if (!["P0", "P1", "P2"].includes(defect.severity)) {
    fail(`${feFiles.register}: severity của ${defect.id} phải là P0/P1/P2`);
  }
}
if (register.dependency?.state !== dependencyState && dependencyState !== "SKIPPED") {
  fail(
    `${feFiles.register}.dependency.state = ${register.dependency?.state} nhưng verifier ` +
      `vừa chạy ở trạng thái ${dependencyState}.`,
  );
}

for (const [text, path] of [
  [src.taskDoc, feFiles.taskDoc],
  [src.matrix, feFiles.matrix],
  [src.register, feFiles.register],
]) {
  for (const placeholder of [
    "TBD",
    "TODO",
    "VERIFIED PASS / CHANGES REQUIRED",
    "<sha>",
  ]) {
    refuseText(
      text,
      placeholder,
      path,
      "placeholder trong hồ sơ đóng task = sign-off chưa ký",
    );
  }
}

// ─────────────────────────────────────────────────────────────
// 9. Gate phải chạy được từ package.json
// ─────────────────────────────────────────────────────────────
const packageJson = JSON.parse(src.packageJson);
const script = packageJson.scripts?.["verify:wwhn-247"];
if (!script || !script.includes("verify-wwhn-247-closure.mjs")) {
  fail("package.json phải expose verify:wwhn-247 chạy verifier này");
}

console.log(
  `[WWHN-247] PASS: PII fail-closed + ma trận trạng thái + Annex C endpoint đều khớp. ` +
    `Dependency HN-WAR-001 = ${dependencyState}.`,
);
