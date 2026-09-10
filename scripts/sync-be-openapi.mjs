#!/usr/bin/env node
/**
 * Tải OpenAPI của backend về `swagger-api.json` để `npm run check:api-mapping`
 * kiểm tra được FE ↔ BE thay vì chỉ kiểm tra nội bộ FE.
 *
 * LÝ DO TỒN TẠI (WWHN-309 / WWHN-311): `swagger-api.json` nằm trong .gitignore nên
 * mặc định không có trong repo FE. Khi thiếu file, `check-api-mapping.mjs` chỉ chạy
 * ở chế độ "validating FE constants/registers only" và tự khai báo rằng **đó không
 * phải BE OpenAPI sign-off**. Trước đây không có cách chuẩn nào để lấy đúng spec ở
 * đúng commit, nên phần đối chiếu contract thật hoặc bị bỏ qua, hoặc dựa vào một
 * file ai đó copy tay - không tái lập được.
 *
 * Contract BE được commit vào repo BE tại `storage/api-docs/api-docs.json`, nên có
 * thể lấy theo **exact SHA** - đó là điều kiện để evidence tái lập được.
 *
 * Dùng:
 *   node scripts/sync-be-openapi.mjs <BE_SHA|branch>     # mặc định: m1
 *   node scripts/sync-be-openapi.mjs --from <đường dẫn repo BE cục bộ>
 *
 * Sau khi tải: npm run check:api-mapping
 *
 * CẬP NHẬT 10/09/2026 (WWHN-309 R2): các cổng CI (check:api-mapping, master-sku:verify, test
 * wwhn-260) KHÔNG đọc `swagger-api.json` nữa mà đọc `operation_index` — chỉ mục path+method
 * suy từ đúng spec đã pin, commit ngay trong BE_CONTRACT_PIN.json (scripts/pinned-openapi-
 * contract.mjs). `--repin` ghi luôn chỉ mục đó; lần sync thường kiểm chỉ mục trong pin còn
 * khớp spec vừa tải. `swagger-api.json` chỉ còn là bản tra cứu cục bộ (schema/ví dụ) cho
 * người phát triển — lưu ý spec tại revision 7da26cb1cc13 chứa example của một credential
 * đã lộ (đã thu hồi), tệp gitignored và không bao giờ được commit.
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildOperationIndex,
  deriveOperationIndex,
  operationIndexDigest,
  validatePin,
} from "./pinned-openapi-contract.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "swagger-api.json");
const pinPath = join(root, "docs/api-evidence/BE_CONTRACT_PIN.json");
const BE_REPO = "Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_BE";
const BE_SPEC_PATH = "storage/api-docs/api-docs.json";

const rawArgs = process.argv.slice(2);
const repin = rawArgs.includes("--repin");
const args = rawArgs.filter((arg) => arg !== "--repin");
const fromIndex = args.indexOf("--from");

/**
 * WWHN-309 / DEV309-P1-02 - pin REVISION, không chỉ tải nội dung.
 *
 * Tải được spec chưa đủ: FE và QA phải chắc chắn đang đọc **cùng một revision BE**.
 * Trước đây mỗi bên tự lấy "bản mới nhất" nên hai bên có thể cùng báo PASS trên hai
 * bản OpenAPI khác nhau mà không ai phát hiện.
 *
 * `docs/api-evidence/BE_CONTRACT_PIN.json` khai BE SHA + SHA-256 của spec. Sau khi
 * sync, hàm này so hash; lệch là FAIL. Đổi contract có chủ đích thì chạy lại với
 * `--repin` và **phải** truyền exact SHA (không nhận branch).
 */
function reconcilePin(specText, resolvedRef) {
  const actual = createHash("sha256").update(Buffer.from(specText, "utf8")).digest("hex");

  if (repin) {
    if (!/^[0-9a-f]{40}$/.test(String(resolvedRef))) {
      console.error("[sync-be-openapi] --repin bắt buộc dùng exact SHA 40 ký tự, không nhận branch/đường dẫn.");
      process.exit(1);
    }
    const spec = JSON.parse(specText);
    const HTTP = new Set(["get", "post", "put", "patch", "delete"]);
    let operations = 0;
    for (const item of Object.values(spec.paths ?? {})) {
      for (const method of Object.keys(item ?? {})) if (HTTP.has(method)) operations += 1;
    }
    const pin = {
      task: "WWHN-309",
      note: "FE pin đúng revision OpenAPI của BE. Không sửa tay - chạy npm run contract:sync -- <BE_SHA> --repin.",
      be_repo: BE_REPO,
      be_branch: "m1",
      be_sha: resolvedRef,
      spec_path: BE_SPEC_PATH,
      spec_sha256: actual,
      openapi_version: spec.info?.version ?? null,
      openapi_paths: Object.keys(spec.paths ?? {}).length,
      openapi_operations: operations,
      operation_index: buildOperationIndex(actual, deriveOperationIndex(spec)),
    };
    try {
      validatePin(pin);
    } catch (error) {
      console.error(`[sync-be-openapi] FAIL: pin mới không tự nhất quán, không ghi.\n${error.message}`);
      process.exit(1);
    }
    writeFileSync(pinPath, JSON.stringify(pin, null, 2) + "\n", "utf8");
    console.log(
      "[sync-be-openapi] Đã ghi pin BE " + resolvedRef.slice(0, 12) + " -> docs/api-evidence/BE_CONTRACT_PIN.json",
    );
    return;
  }

  if (!existsSync(pinPath)) {
    console.warn("[sync-be-openapi] CẢNH BÁO: chưa có docs/api-evidence/BE_CONTRACT_PIN.json - chạy lại với --repin.");
    return;
  }

  const pin = JSON.parse(readFileSync(pinPath, "utf8"));
  if (actual !== pin.spec_sha256) {
    console.error("[sync-be-openapi] FAIL: spec vừa lấy KHÔNG khớp revision đã pin.");
    console.error("[sync-be-openapi]   pinned BE    " + pin.be_sha);
    console.error("[sync-be-openapi]   pinned hash  " + pin.spec_sha256);
    console.error("[sync-be-openapi]   current hash " + actual);
    console.error("[sync-be-openapi] Lấy đúng revision: npm run contract:sync -- " + pin.be_sha);
    console.error("[sync-be-openapi] Nếu BE đổi contract có chủ đích: npm run contract:sync -- <BE_SHA_MOI> --repin");
    process.exit(1);
  }
  const derivedDigest = operationIndexDigest(deriveOperationIndex(JSON.parse(specText)));
  if (pin.operation_index?.sha256 !== derivedDigest) {
    console.error("[sync-be-openapi] FAIL: operation_index trong pin không khớp chỉ mục suy từ spec đã pin.");
    console.error("[sync-be-openapi]   pin   " + (pin.operation_index?.sha256 ?? "(thiếu)"));
    console.error("[sync-be-openapi]   spec  " + derivedDigest);
    console.error("[sync-be-openapi] Sinh lại: node scripts/pinned-openapi-contract.mjs --write-index swagger-api.json");
    process.exit(1);
  }
  console.log("[sync-be-openapi] OK: spec khớp pin BE " + String(pin.be_sha).slice(0, 12) + " (kể cả operation_index)");
}

function summarize(specText, source) {
  const spec = JSON.parse(specText);
  const HTTP = new Set(["get", "post", "put", "patch", "delete"]);
  let operations = 0;
  for (const item of Object.values(spec.paths ?? {})) {
    for (const method of Object.keys(item ?? {})) {
      if (HTTP.has(method)) operations += 1;
    }
  }
  const schemas = Object.keys(spec.components?.schemas ?? {});
  console.log(`[sync-be-openapi] Nguồn: ${source}`);
  console.log(
    `[sync-be-openapi] OpenAPI ${spec.info?.version ?? "?"} — ${Object.keys(spec.paths ?? {}).length} path, ${operations} operation, ${schemas.length} schema`,
  );
  if (!schemas.includes("ApiErrorEnvelope")) {
    console.warn(
      "[sync-be-openapi] CẢNH BÁO: spec không có schema ApiErrorEnvelope — có thể là bản BE cũ trước WWHN-309.",
    );
  }
  console.log(
    "[sync-be-openapi] Đã ghi swagger-api.json. Chạy tiếp: npm run check:api-mapping",
  );
}

if (fromIndex !== -1) {
  const raw = args[fromIndex + 1];
  if (!raw) {
    console.error("[sync-be-openapi] Thiếu đường dẫn sau --from");
    process.exit(1);
  }
  const base = isAbsolute(raw) ? raw : resolve(root, raw);
  const candidate = base.endsWith(".json") ? base : join(base, BE_SPEC_PATH);
  if (!existsSync(candidate)) {
    console.error(`[sync-be-openapi] Không thấy spec tại ${candidate}`);
    process.exit(1);
  }
  copyFileSync(candidate, target);
  const localText = readFileSync(target, "utf8");
  summarize(localText, candidate);
  // Nguồn cục bộ không tự khai được SHA; muốn --repin thì truyền exact SHA của BE
  // ở tham số đầu tiên (npm run contract:sync -- <BE_SHA> --from <path>).
  reconcilePin(localText, args[0] !== "--from" ? args[0] : null);
} else {
  const ref = args[0] ?? "m1";
  const url = `https://raw.githubusercontent.com/${BE_REPO}/${ref}/${BE_SPEC_PATH}`;
  const response = await fetch(url);
  if (!response.ok) {
    console.error(
      `[sync-be-openapi] Tải thất bại (${response.status}): ${url}`,
    );
    console.error(
      "[sync-be-openapi] Kiểm tra SHA/branch, hoặc dùng --from <đường dẫn repo BE cục bộ>.",
    );
    process.exit(1);
  }
  const text = await response.text();
  writeFileSync(target, text, "utf8");
  summarize(text, url);
  if (ref === "m1") {
    console.warn(
      '[sync-be-openapi] CẢNH BÁO: đang dùng nhánh "m1", không phải exact SHA. Evidence sign-off phải pin đúng BE SHA.',
    );
  }
  reconcilePin(text, ref);
}
