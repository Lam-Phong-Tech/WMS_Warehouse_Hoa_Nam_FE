#!/usr/bin/env node
/**
 * WWHN-268 — verifier fail-closed cho register defect của vòng sửa lỗi
 * WWHN-70 / HN-QA-005-ST01.
 *
 * Lý do tồn tại: review 64/100 nói bảng disposition hiện có là "generic". Một
 * bảng Markdown viết tay không thể chứng minh điều ngược lại, nên register được
 * chuyển sang JSON và verifier này từ chối mọi dòng thiếu trường, mọi chuỗi độn
 * ("TBD", "N/A", "generic"), mọi file fix/bằng chứng không tồn tại trên đĩa, và
 * mọi dòng khai FIXED nhưng retest không PASS.
 *
 * Verifier KHÔNG khẳng định QA1/QA2 đã chạy độc lập — phần đó nằm ở
 * externalGates và luôn giữ trạng thái mở cho tới khi chính vai trò đó comment.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const feRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(feRoot, "..", "..");

let failures = 0;

function fail(message) {
  console.error(`[WWHN-268] FAIL: ${message}`);
  failures += 1;
}

function readRequired(relativePath) {
  const absolute = join(feRoot, relativePath);
  if (!existsSync(absolute)) {
    console.error(`[WWHN-268] FAIL: thiếu artifact bắt buộc: ${relativePath}`);
    process.exit(1);
  }
  return readFileSync(absolute, "utf8");
}

/**
 * Đường dẫn trong register có thể trỏ sang repo BE (tiền tố `HoaNam_BE/`).
 * Cả hai repo nằm cạnh nhau dưới C:\LAM_PHONG_TECH, nên resolve theo repoRoot.
 */
function resolveEvidencePath(value) {
  if (value.startsWith("HoaNam_BE/")) {
    return join(
      repoRoot,
      "HoaNam_BE",
      "WMS_Warehouse_Hoa_Nam_BE",
      value.slice("HoaNam_BE/".length),
    );
  }
  return join(feRoot, value);
}

const PLACEHOLDER = /^(n\/?a|tbd|todo|generic|xxx|-|\.\.\.)$/i;

function requireMeaningfulText(value, context, minLength = 12) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`${context} bị bỏ trống`);
    return;
  }
  if (PLACEHOLDER.test(value.trim())) {
    fail(`${context} là chuỗi độn (${value.trim()}) — register phải cụ thể`);
    return;
  }
  if (value.trim().length < minLength) {
    fail(`${context} quá ngắn để kiểm chứng: ${JSON.stringify(value)}`);
  }
}

const registerPath = "docs/evidence/WWHN-268/DEFECT_REGISTER.json";
let register;
try {
  register = JSON.parse(readRequired(registerPath));
} catch (error) {
  console.error(
    `[WWHN-268] FAIL: ${registerPath} không phải JSON hợp lệ: ${error.message}`,
  );
  process.exit(1);
}

// --- 1. Khung register -------------------------------------------------------
if (register.task !== "WWHN-268")
  fail(`task phải là WWHN-268, nhận ${register.task}`);
if (register.parent !== "WWHN-70")
  fail(`parent phải là WWHN-70, nhận ${register.parent}`);
if (register.qaSource !== "HN-QA-005-ST01") {
  fail(`qaSource phải là HN-QA-005-ST01, nhận ${register.qaSource}`);
}
if (register.branch !== "m1")
  fail(`branch phải là m1, nhận ${register.branch}`);

for (const flag of [
  "failClosed",
  "noSelfSignForIndependentRoles",
  "controlledEvidenceIsNotUat",
  "genericRowsRejected",
]) {
  if (register.evidencePolicy?.[flag] !== true) {
    fail(`evidencePolicy.${flag} phải giữ true`);
  }
}

for (const viewport of ["1440x900", "768x1024", "375x812"]) {
  if (!(register.requiredViewports ?? []).includes(viewport)) {
    fail(`thiếu viewport bắt buộc ${viewport}`);
  }
}

const REQUIRED_UI_STATES = [
  "loading",
  "empty",
  "error",
  "success",
  "disabled",
  "confirm",
  "permission-denied",
];
for (const state of REQUIRED_UI_STATES) {
  if (!(register.uiStates ?? []).includes(state)) {
    fail(`thiếu trạng thái UI bắt buộc "${state}" theo Annex D`);
  }
}

// --- 2. Từng dòng defect -----------------------------------------------------
const VALID_STATUS = new Set([
  "FIXED",
  "VERIFIED_NO_DEFECT",
  "BLOCKED_EXTERNAL",
]);
const defects = register.defects ?? [];
if (defects.length === 0) {
  fail("register không có dòng defect nào — vòng retest phải liệt kê cụ thể");
}

const seenIds = new Set();
for (const defect of defects) {
  const id = defect.id ?? "<thiếu id>";
  if (seenIds.has(id)) fail(`trùng id defect: ${id}`);
  seenIds.add(id);

  for (const field of [
    "severity",
    "owner",
    "confirmer",
    "module",
    "route",
    "accountRole",
    "viewport",
    "environment",
  ]) {
    requireMeaningfulText(defect[field], `${id}.${field}`, 2);
  }
  for (const field of ["expected", "actual", "rootCause"]) {
    requireMeaningfulText(defect[field], `${id}.${field}`, 40);
  }
  requireMeaningfulText(defect.fix?.summary, `${id}.fix.summary`, 40);

  if (!VALID_STATUS.has(defect.status)) {
    fail(`${id}.status không hợp lệ: ${defect.status}`);
  }

  const fixFiles = defect.fix?.files ?? [];
  if (!Array.isArray(fixFiles)) {
    fail(`${id}.fix.files phải là mảng`);
  } else {
    if (defect.status === "FIXED" && fixFiles.length === 0) {
      fail(`${id} khai FIXED nhưng không liệt kê file nào đã sửa`);
    }
    for (const file of fixFiles) {
      if (!existsSync(resolveEvidencePath(file))) {
        fail(`${id}.fix.files trỏ tới file không tồn tại: ${file}`);
      }
    }
  }

  for (const key of ["evidenceBefore", "evidenceAfter"]) {
    const list = defect[key] ?? [];
    if (!Array.isArray(list)) {
      fail(`${id}.${key} phải là mảng`);
      continue;
    }
    for (const file of list) {
      if (!existsSync(resolveEvidencePath(file))) {
        fail(`${id}.${key} trỏ tới bằng chứng không tồn tại: ${file}`);
      }
    }
  }

  if (defect.status === "FIXED") {
    if (
      !Array.isArray(defect.evidenceAfter) ||
      defect.evidenceAfter.length === 0
    ) {
      fail(`${id} khai FIXED nhưng không có bằng chứng sau khi sửa`);
    }
    if (defect.retest?.result !== "PASS") {
      fail(`${id} khai FIXED nhưng retest.result = ${defect.retest?.result}`);
    }
  }

  if (defect.status === "BLOCKED_EXTERNAL") {
    requireMeaningfulText(
      defect.compensatingControl,
      `${id}.compensatingControl`,
      40,
    );
  }

  const commands = defect.retest?.commands ?? [];
  if (!Array.isArray(commands) || commands.length === 0) {
    fail(`${id} thiếu lệnh retest tái lập được`);
  }
}

// --- 3. Cổng thuộc vai trò khác ---------------------------------------------
const gates = register.externalGates ?? [];
for (const required of ["WWHN-265", "WWHN-264", "WWHN-266 / WWHN-267"]) {
  if (!gates.some((gate) => gate.reviewItem === required)) {
    fail(
      `thiếu external gate cho ${required} — FE không được tự ký thay vai trò khác`,
    );
  }
}
for (const gate of gates) {
  requireMeaningfulText(gate.owner, `externalGate ${gate.id}.owner`, 2);
  requireMeaningfulText(
    gate.requirement,
    `externalGate ${gate.id}.requirement`,
    40,
  );
  if (!["OPEN_EXTERNAL", "PARTIALLY_DELIVERED"].includes(gate.status)) {
    fail(
      `externalGate ${gate.id}.status = ${gate.status}: chỉ chính vai trò đó mới được đóng, FE giữ fail-closed`,
    );
  }
}

// --- 4. Artefact phải tồn tại thật ------------------------------------------
readRequired("e2e/wwhn-268-defect-retest.spec.ts");
readRequired("src/shared/constants/ui-state.ts");
readRequired("src/shared/constants/ui-state.test.tsx");
readRequired("docs/Task_docs_Jira/WWHN-268.md");
const workflow = readRequired(
  ".github/workflows/wwhn-268-fe-defect-closure.yml",
);
for (const needle of ["wwhn-268:verify", "test:e2e:wwhn-268", "GITHUB_SHA"]) {
  if (!workflow.includes(needle)) {
    fail(`workflow WWHN-268 phải chạy/truyền ${needle}`);
  }
}

const packageJson = JSON.parse(readRequired("package.json"));
for (const script of ["wwhn-268:verify", "test:e2e:wwhn-268"]) {
  if (!packageJson.scripts?.[script]) {
    fail(`package.json thiếu script ${script}`);
  }
}

// Hợp đồng trạng thái phải khớp giữa nguồn và spec bằng chứng.
const uiStateSource = readRequired("src/shared/constants/ui-state.ts");
const e2eSource = readRequired("e2e/wwhn-268-defect-retest.spec.ts");
for (const state of REQUIRED_UI_STATES) {
  if (!uiStateSource.includes(`"${state}"`)) {
    fail(`ui-state.ts thiếu trạng thái ${state}`);
  }
  if (!e2eSource.includes(`${state}:`) && !e2eSource.includes(`"${state}"`)) {
    fail(`spec bằng chứng không phủ trạng thái ${state}`);
  }
}

// Phạm vi regression backend phải tồn tại và đủ 5 vùng.
const scopePath = join(
  repoRoot,
  "HoaNam_BE",
  "WMS_Warehouse_Hoa_Nam_BE",
  "docs/evidence/WWHN-268/BE_REGRESSION_SCOPE.json",
);
if (!existsSync(scopePath)) {
  fail(
    "thiếu BE_REGRESSION_SCOPE.json — phạm vi regression backend không kiểm chứng được",
  );
} else {
  try {
    const scope = JSON.parse(readFileSync(scopePath, "utf8"));
    for (const area of ["stock", "reversal", "warranty", "pv", "report"]) {
      if (!(scope.areas?.[area]?.testClasses ?? []).length) {
        fail(`BE_REGRESSION_SCOPE.json thiếu class test cho vùng ${area}`);
      }
    }
  } catch (error) {
    fail(`BE_REGRESSION_SCOPE.json không hợp lệ: ${error.message}`);
  }
}

if (failures > 0) {
  console.error(`[WWHN-268] FAIL: ${failures} vấn đề chặn closure.`);
  process.exit(1);
}

console.log(
  "[WWHN-268] PASS: register defect đủ trường và truy được; bằng chứng FE-controlled tồn tại thật; cổng QA1/QA2/BE độc lập vẫn giữ fail-closed.",
);
