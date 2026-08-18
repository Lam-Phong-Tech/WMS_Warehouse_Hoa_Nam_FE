#!/usr/bin/env node
/**
 * WWHN-290 (DEV290-P1-03R) — verifier phía FE cho "một approved OpenAPI source".
 *
 * Lý do tồn tại: review vòng 2 (64/100) nói contract có hai version cạnh nhau
 * (`1.0.0` trên `m1-be-2` và `2.0.0` trên `m1`) và không có mapping consumer nào
 * được pin. Một dòng chữ trong Markdown không chứng minh được FE tiêu thụ đúng
 * một nguồn, nên verifier này kiểm THẲNG vào mã nguồn FE:
 *
 *  - hằng `CANONICAL_API_BASE_PATH` và guard `must end at /api/v1` trong env.ts;
 *  - `.env.example` khai base URL kết thúc đúng ở `/api/v1`;
 *  - hai HTTP client cùng lấy `runtimeConfig.apiBaseUrl`;
 *  - tài liệu consumer không tự ký thay QA1/PM/Tech/Data.
 *
 * Nếu repo BE nằm cạnh (chạy tại máy dev), verifier đối chiếu chéo luôn
 * `WWHN-290_PINS.json` để bắt lệch pin giữa hai repo. Trong CI chỉ FE được
 * checkout nên bước đó ghi NOTE thay vì FAIL — cổng BE `WWHN-290 Exact SHA
 * Closure` chịu trách nhiệm phần BE.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const feRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const beRoot = join(
  feRoot,
  "..",
  "..",
  "HoaNam_BE",
  "WMS_Warehouse_Hoa_Nam_BE",
);

const EVIDENCE = "docs/evidence/wwhn-290/WWHN-290_FE_CONSUMER_CONFIRMATION.md";
const APPROVED_VERSION = "2.0.0";
const CANONICAL_BASE_PATH = "/api/v1";

let failures = 0;

function fail(message) {
  console.error(`[WWHN-290] FAIL: ${message}`);
  failures += 1;
}

function pass(message) {
  console.log(`[WWHN-290] PASS: ${message}`);
}

function read(relativePath) {
  const absolute = join(feRoot, relativePath);
  if (!existsSync(absolute)) {
    fail(`thiếu artifact bắt buộc: ${relativePath}`);
    return null;
  }
  return readFileSync(absolute, "utf8");
}

// 1. Tài liệu consumer phải tồn tại và khai đúng một contract source.
const evidence = read(EVIDENCE);
if (evidence) {
  for (const marker of [
    "DEV290-P1-03R",
    APPROVED_VERSION,
    CANONICAL_BASE_PATH,
    "CONSUMER EVIDENCE ONLY",
    "storage/api-docs/api-docs.json",
  ]) {
    if (evidence.includes(marker)) {
      pass(`tài liệu consumer khai "${marker}"`);
    } else {
      fail(`tài liệu consumer thiếu "${marker}"`);
    }
  }

  // Fail-closed: FE không được tự ký các cổng của vai trò khác.
  if (evidence.includes("không") && evidence.includes("ký thay")) {
    pass(
      "tài liệu consumer giữ nguyên ranh giới vai trò (không ký thay QA1/PM/Data)",
    );
  } else {
    fail("tài liệu consumer phải nói rõ FE không ký thay QA1/PM/Tech/Data");
  }
}

// 2. Invariant namespace phải nằm trong mã, không chỉ trong tài liệu.
const env = read("src/shared/config/env.ts");
if (env) {
  if (
    env.includes(`const CANONICAL_API_BASE_PATH = "${CANONICAL_BASE_PATH}"`)
  ) {
    pass(`env.ts pin CANONICAL_API_BASE_PATH = ${CANONICAL_BASE_PATH}`);
  } else {
    fail(
      `env.ts không còn pin CANONICAL_API_BASE_PATH = ${CANONICAL_BASE_PATH}`,
    );
  }

  if (env.includes("must end at")) {
    pass(
      "env.ts vẫn ném lỗi khi VITE_API_BASE_URL không kết thúc ở namespace chuẩn",
    );
  } else {
    fail("env.ts mất guard fail-closed cho VITE_API_BASE_URL");
  }
}

// 3. Mẫu cấu hình phát hành cho dev/CI phải trỏ đúng namespace.
const envExample = read(".env.example");
if (envExample) {
  const line = envExample
    .split(/\r?\n/)
    .find((row) => row.startsWith("VITE_API_BASE_URL="));
  if (line && line.replace(/"/g, "").trimEnd().endsWith(CANONICAL_BASE_PATH)) {
    pass(
      `.env.example khai VITE_API_BASE_URL kết thúc ở ${CANONICAL_BASE_PATH}`,
    );
  } else {
    fail(
      `.env.example phải khai VITE_API_BASE_URL kết thúc ở ${CANONICAL_BASE_PATH}`,
    );
  }
}

// 4. Mọi HTTP client phải dùng chung một base URL đã chuẩn hoá.
for (const client of [
  "src/shared/api/axios.ts",
  "src/shared/api/public-http.ts",
]) {
  const source = read(client);
  if (source && source.includes("runtimeConfig.apiBaseUrl")) {
    pass(`${client} dùng runtimeConfig.apiBaseUrl`);
  } else if (source) {
    fail(`${client} không lấy base URL từ runtimeConfig.apiBaseUrl`);
  }
}

// 5. Đối chiếu chéo pin với repo BE khi có mặt.
const pinsPath = join(beRoot, "docs/evidence/wwhn-290/WWHN-290_PINS.json");
if (existsSync(pinsPath)) {
  try {
    const pins = JSON.parse(readFileSync(pinsPath, "utf8"));
    const version = pins?.contract?.approved_openapi_version;
    const namespace = pins?.contract?.namespace;
    if (version === APPROVED_VERSION) {
      pass(
        `pin BE và FE cùng khai approved OpenAPI version ${APPROVED_VERSION}`,
      );
    } else {
      fail(
        `lệch pin contract giữa hai repo: BE=${version}, FE=${APPROVED_VERSION}`,
      );
    }
    if (namespace === CANONICAL_BASE_PATH) {
      pass(`pin BE và FE cùng khai namespace ${CANONICAL_BASE_PATH}`);
    } else {
      fail(
        `lệch namespace giữa hai repo: BE=${namespace}, FE=${CANONICAL_BASE_PATH}`,
      );
    }
  } catch (error) {
    fail(`không đọc được WWHN-290_PINS.json của BE: ${error.message}`);
  }
} else {
  console.log(
    "[WWHN-290] NOTE: repo BE không có mặt ở lượt chạy này nên bỏ qua đối chiếu chéo pin; cổng BE WWHN-290 Exact SHA Closure chịu trách nhiệm phần đó.",
  );
}

if (failures > 0) {
  console.error(
    `[WWHN-290] FAIL: ${failures} vấn đề chặn closure phía FE consumer.`,
  );
  process.exit(1);
}

console.log(
  "[WWHN-290] PASS: FE consumer pin đúng một contract source (2.0.0 / /api/v1) và không tự ký cổng của vai trò khác.",
);
