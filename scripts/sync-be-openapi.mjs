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
 */
import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "swagger-api.json");
const BE_REPO = "Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_BE";
const BE_SPEC_PATH = "storage/api-docs/api-docs.json";

const args = process.argv.slice(2);
const fromIndex = args.indexOf("--from");

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
  summarize(
    await import("node:fs").then((fs) => fs.readFileSync(target, "utf8")),
    candidate,
  );
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
}
