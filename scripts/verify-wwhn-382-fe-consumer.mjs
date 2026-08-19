#!/usr/bin/env node
/**
 * WWHN-382 — cổng phía FE cho register R4 của dashboard aggregate.
 *
 * Vai trò khác với `verify-wwhn-327-closure.mjs`: bản 327 bảo vệ **cách màn hình
 * hiển thị**; bản này bảo vệ **quan hệ FE ↔ BE** — đúng mục DEV328-P1-05R4
 * ("issuelinks=[]", "pin exact WWHN-327 output consumed + current FE SHA").
 *
 * Nó chặn ba cách mà dependency giữa hai repo im lặng đứt:
 *
 *   1. Pin BE ghi SHA rút gọn hoặc ghi tên nhánh. `m1` là nhánh chung của nhiều
 *      phiên làm việc song song — một cái tên di động không phải bằng chứng.
 *   2. FE lặng lẽ tiêu thụ nhiều/ít field hơn hợp đồng đã ký. Kiểu TS là nơi
 *      duy nhất khai field set ở FE, nên nó phải bằng ĐÚNG danh sách trong pin.
 *   3. Hồ sơ mất dấu output WWHN-327 đã được hợp nhất, khiến vòng review sau
 *      không biết FE đang đứng trên bản nào.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let failures = 0;

function fail(code, message) {
  failures += 1;
  console.error(`[WWHN-382/FE] FAIL ${code}: ${message}`);
}

function pass(code, message) {
  console.log(`[WWHN-382/FE] PASS ${code}: ${message}`);
}

function read(relative) {
  const absolute = join(root, relative);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : null;
}

/**
 * Prettier ngắt dòng JSX theo độ rộng in, nên một câu hiển thị có thể nằm trên
 * nhiều dòng. So khớp phải bỏ qua cách xuống dòng — nếu không, gate đỏ chỉ vì
 * format lại và người sửa sẽ có xu hướng gỡ assertion thay vì giữ nội dung.
 */
function requirePhrase(text, phrase, context) {
  const flatten = (value) => value.replace(/\s+/g, " ").trim();
  if (!flatten(text).includes(flatten(phrase))) {
    fail("UI", `${context} phải hiển thị câu ${JSON.stringify(phrase)}`);
  }
}

const PIN_PATH = "docs/evidence/WWHN-382/FE_CONSUMER_PIN.json";
const TYPES_PATH = "src/modules/dashboard/types/index.ts";
const PAGE_PATH = "src/modules/dashboard/pages/DashboardPage.tsx";
const SERVICE_PATH = "src/modules/dashboard/services/dashboardService.ts";

// ── 1. Pin phải đầy đủ và không di động ────────────────────

const pinRaw = read(PIN_PATH);
let pin = null;
if (pinRaw === null) {
  fail("PIN", `thiếu ${PIN_PATH}`);
} else {
  try {
    pin = JSON.parse(pinRaw);
  } catch (error) {
    fail("PIN", `${PIN_PATH} không parse được: ${error.message}`);
  }
}

if (pin) {
  const sha40 = /^[0-9a-f]{40}$/;
  const sha256 = /^[0-9a-f]{64}$/;

  for (const [label, value] of [
    ["backend.sha", pin.backend?.sha],
    ["frontend.sha", pin.frontend?.sha],
    ["consumedWwhn327Output.sha", pin.consumedWwhn327Output?.sha],
  ]) {
    if (!sha40.test(String(value))) {
      fail("PIN", `${label} phải là SHA đủ 40 ký tự, đang là ${JSON.stringify(value)}`);
    }
  }

  for (const [label, node] of [
    ["backend", pin.backend],
    ["frontend", pin.frontend],
  ]) {
    if (node?.branch !== "m1") {
      fail("PIN", `${label}.branch phải là m1, đang là ${JSON.stringify(node?.branch)}`);
    }
    if (!String(node?.repo || "").startsWith("https://")) {
      fail("PIN", `${label}.repo thiếu URL canonical`);
    }
  }

  if (!sha256.test(String(pin.contractFingerprint?.openapi_operation))) {
    fail("PIN", "contractFingerprint.openapi_operation phải là sha256 của operation dashboard-quick");
  }
  if (pin.kpiMatrixVersion !== "v1.2") {
    fail("PIN", `kpiMatrixVersion phải là v1.2, đang là ${JSON.stringify(pin.kpiMatrixVersion)}`);
  }
  if (!pin.consumedWwhn327Output?.reason) {
    fail("PIN", "consumedWwhn327Output thiếu lý do — mất lý do là mất truy vết dependency");
  }
  if (failures === 0) pass("PIN", `BE ${pin.backend.sha} ↔ FE ${pin.frontend.sha}`);
}

// ── 2. Field set FE phải bằng ĐÚNG hợp đồng đã ký ──────────

const types = read(TYPES_PATH);
if (types === null) {
  fail("TYPES", `thiếu ${TYPES_PATH}`);
} else if (pin?.contractFields) {
  const block = types.slice(types.indexOf("export interface DashboardKPI"));
  const body = block.slice(block.indexOf("{"), block.indexOf("\n}"));
  const declared = [...body.matchAll(/^\s*([a-z_]+)\??:/gm)].map((match) => match[1]).sort();
  const expected = [...pin.contractFields].sort();

  const extra = declared.filter((field) => !expected.includes(field));
  const missing = expected.filter((field) => !declared.includes(field));

  if (extra.length > 0) {
    fail(
      "TYPES",
      `DashboardKPI khai field ngoài hợp đồng: ${extra.join(", ")} — KPI suy đoán là cách nhanh nhất để FE và BE lệch số.`,
    );
  }
  if (missing.length > 0) {
    fail("TYPES", `DashboardKPI thiếu field đã ký: ${missing.join(", ")}`);
  }
  if (extra.length === 0 && missing.length === 0) {
    pass("TYPES", `DashboardKPI khớp đúng ${expected.length} field của hợp đồng`);
  }
}

// ── 3. Ba quy tắc hiển thị sinh ra từ chính data-scope ─────

const page = read(PAGE_PATH);
if (page === null) {
  fail("UI", `thiếu ${PAGE_PATH}`);
} else {
  requirePhrase(page, "Phạm vi dữ liệu:", "DashboardPage");
  requirePhrase(
    page,
    "số liệu bảo hành vẫn là toàn hệ thống",
    "DashboardPage (ngoại lệ warranty GLOBAL)",
  );

  // Ngoại lệ warranty chỉ được hiện khi payload đã bị cắt theo kho. Hiện vô điều
  // kiện thì người dùng GLOBAL đọc một cảnh báo vô nghĩa và sẽ học cách bỏ qua nó.
  if (!page.includes('data.data_scope === "WAREHOUSE_SCOPED"')) {
    fail("UI", "khối ngoại lệ warranty phải có điều kiện data_scope === WAREHOUSE_SCOPED");
  }

  // Đếm bằng độ dài mảng là khiếm khuyết PAY-01: BE chỉ nhúng tối đa 50 dòng mẫu.
  if (/reconciliation_warnings\s*\.\s*length/.test(page)) {
    fail(
      "UI",
      "DashboardPage đếm cảnh báo bằng reconciliation_warnings.length — mảng đã bị BE cắt trần 50 dòng, phải dùng reconciliation_warning_count.",
    );
  }
  if (!page.includes("reconciliation_warning_count")) {
    fail("UI", "DashboardPage không đọc reconciliation_warning_count");
  }
  if (failures === 0) pass("UI", "nhãn phạm vi, ngoại lệ warranty và cách đếm cảnh báo đều đúng");
}

// ── 4. Không tự bịa endpoint aggregate mới ─────────────────

const service = read(SERVICE_PATH);
if (service === null) {
  fail("SERVICE", `thiếu ${SERVICE_PATH}`);
} else {
  const endpoints = [...service.matchAll(/["'`](\/?(?:api\/v1\/)?reports\/[a-z-]+)["'`]/g)].map(
    (match) => match[1],
  );
  const foreign = endpoints.filter((endpoint) => !endpoint.includes("dashboard-quick"));
  if (foreign.length > 0) {
    fail(
      "SERVICE",
      `dashboardService gọi thêm endpoint báo cáo ngoài hợp đồng: ${[...new Set(foreign)].join(", ")} — WWHN-328 chốt tái sử dụng đúng một endpoint aggregate.`,
    );
  } else {
    pass("SERVICE", "dashboardService chỉ gọi /reports/dashboard-quick");
  }
}

if (failures > 0) {
  console.error(`\n[WWHN-382/FE] KHÔNG ĐẠT — ${failures} lỗi.`);
  process.exit(1);
}
console.log("\n[WWHN-382/FE] ĐẠT — FE tiêu thụ đúng hợp đồng đã pin.");
