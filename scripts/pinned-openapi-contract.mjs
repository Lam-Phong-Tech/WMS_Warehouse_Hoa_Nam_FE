#!/usr/bin/env node
/**
 * Nguồn hợp đồng OpenAPI KÍN (hermetic) cho các cổng FE — WWHN-309 R2 (10/09/2026).
 *
 * VẤN ĐỀ: check:api-mapping, master-sku:verify và test wwhn-260 từng đọc `swagger-api.json`
 * — tệp bị .gitignore. Runner CI không bao giờ có nó: test wwhn-260 ném ENOENT, master-sku
 * fail cả 16 capability, còn check:api-mapping lặng lẽ tụt xuống "chỉ kiểm hằng số FE" và
 * vẫn PASS. Trên máy dev thì ngược lại: cổng tin bất kỳ bản spec nào đang nằm trên đĩa —
 * kể cả bản lệch pin — tức là fail-open.
 *
 * THIẾT KẾ: `docs/api-evidence/BE_CONTRACT_PIN.json` mang thêm `operation_index` — danh sách
 * "METHOD path" (GET/POST/PUT/PATCH/DELETE) SUY RA từ đúng spec đã pin (`spec_sha256`). Các
 * cổng chỉ cần path + method nên FE không vendor spec: spec gốc tại revision pin còn chứa
 * `example` của trường password đăng nhập (credential đã lộ, đã thu hồi), và nội dung đó
 * không bao giờ được chép vào repo FE. Chỉ mục được niêm bằng sha256 và bằng hai con số
 * `openapi_paths` / `openapi_operations` của pin; lệch bất kỳ điều gì là THROW — không có
 * chế độ cảnh báo, không có đường lùi về tệp cục bộ.
 *
 * Niêm sha256 chỉ chặn sửa dở/sửa nhầm; nguồn tin cậy vẫn là review git của tệp pin, và chỉ
 * mục kiểm lại được bất cứ lúc nào từ repo BE (không cần ghi spec ra đĩa):
 *   git -C <BE> show <be_sha>:<spec_path> | node scripts/pinned-openapi-contract.mjs --verify-spec -
 * hoặc truyền bản BE đã redact (sha ghi trong `amendments`).
 *
 * CLI:
 *   --self-test            fixture trong bộ nhớ chứng minh mọi kiểu lệch đều FAIL
 *   --verify-spec <f|->    spec (tệp hoặc stdin) phải đúng sha đã pin / đã ghi trong amendments
 *                          và suy ra ĐÚNG chỉ mục trong pin
 *   --write-index <f|->    ghi lại operation_index từ spec có sha == spec_sha256. KHÔNG re-pin:
 *                          đổi revision BE vẫn là `npm run contract:sync -- <BE_SHA> --repin`.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const PIN_RELATIVE_PATH = "docs/api-evidence/BE_CONTRACT_PIN.json";
export const HTTP_METHODS = Object.freeze(["GET", "POST", "PUT", "PATCH", "DELETE"]);

const OPENAPI_OPERATION_KEYS = new Set(HTTP_METHODS.map((method) => method.toLowerCase()));
const OPERATION_PATTERN = /^(GET|POST|PUT|PATCH|DELETE) (\/\S*)$/;
const INDEX_FORMAT =
  '"<METHOD> <path>" — method GET|POST|PUT|PATCH|DELETE, path nguyên văn trong spec; sắp theo path rồi theo đúng thứ tự method đó';

export class PinnedContractError extends Error {
  constructor(problems) {
    super(
      `Hợp đồng OpenAPI đã pin không dùng được (${PIN_RELATIVE_PATH}):\n  - ${problems.join("\n  - ")}`,
    );
    this.name = "PinnedContractError";
    this.problems = problems;
  }
}

export function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

function splitOperation(operation) {
  const space = operation.indexOf(" ");
  return [operation.slice(0, space), operation.slice(space + 1)];
}

/** Thứ tự chuẩn: theo path (so từng code unit), cùng path thì GET, POST, PUT, PATCH, DELETE. */
export function compareOperations(a, b) {
  const [methodA, pathA] = splitOperation(a);
  const [methodB, pathB] = splitOperation(b);
  if (pathA !== pathB) return pathA < pathB ? -1 : 1;
  return HTTP_METHODS.indexOf(methodA) - HTTP_METHODS.indexOf(methodB);
}

/** Suy chỉ mục "METHOD path" từ một spec OpenAPI; bỏ qua parameters/servers/head/options… */
export function deriveOperationIndex(spec) {
  const operations = [];
  for (const [path, item] of Object.entries(spec?.paths ?? {})) {
    for (const key of Object.keys(item ?? {})) {
      if (OPENAPI_OPERATION_KEYS.has(key)) operations.push(`${key.toUpperCase()} ${path}`);
    }
  }
  return operations.sort(compareOperations);
}

export function operationIndexDigest(operations) {
  return sha256Hex(`${operations.join("\n")}\n`);
}

export function buildOperationIndex(specSha256, operations) {
  return {
    source_spec_sha256: specSha256,
    format: INDEX_FORMAT,
    sha256: operationIndexDigest(operations),
    operations,
  };
}

/** Kiểm toàn bộ pin; trả mảng operation hoặc THROW PinnedContractError liệt kê mọi lỗi. */
export function validatePin(pin) {
  if (!pin || typeof pin !== "object" || Array.isArray(pin)) {
    throw new PinnedContractError(["tệp pin không phải object JSON"]);
  }
  const problems = [];
  if (!/^[0-9a-f]{40}$/.test(String(pin.be_sha ?? ""))) {
    problems.push("be_sha phải là commit SHA đủ 40 ký tự hex");
  }
  if (!/^[0-9a-f]{64}$/.test(String(pin.spec_sha256 ?? ""))) {
    problems.push("spec_sha256 phải là sha256 hex 64 ký tự");
  }
  for (const field of ["be_repo", "spec_path", "openapi_version"]) {
    if (typeof pin[field] !== "string" || pin[field].trim() === "") {
      problems.push(`thiếu trường ${field}`);
    }
  }
  for (const field of ["openapi_paths", "openapi_operations"]) {
    if (!Number.isInteger(pin[field]) || pin[field] <= 0) {
      problems.push(`${field} phải là số nguyên dương`);
    }
  }

  const index = pin.operation_index;
  if (!index || typeof index !== "object" || !Array.isArray(index.operations) || index.operations.length === 0) {
    problems.push(
      "thiếu operation_index.operations — sinh lại bằng --write-index từ đúng spec đã pin",
    );
    throw new PinnedContractError(problems);
  }

  const { operations } = index;
  if (index.source_spec_sha256 !== pin.spec_sha256) {
    problems.push(
      "operation_index.source_spec_sha256 khác spec_sha256 — chỉ mục không thuộc revision đã pin",
    );
  }
  const malformed = operations.filter(
    (operation) => typeof operation !== "string" || !OPERATION_PATTERN.test(operation),
  );
  if (malformed.length > 0) {
    problems.push(
      `${malformed.length} mục sai định dạng "METHOD /path" (vd ${JSON.stringify(malformed[0])})`,
    );
  } else {
    if (new Set(operations).size !== operations.length) {
      problems.push("operation_index có mục trùng");
    }
    const sorted = [...operations].sort(compareOperations);
    if (sorted.some((operation, position) => operation !== operations[position])) {
      problems.push("operation_index không theo thứ tự chuẩn (path, rồi GET/POST/PUT/PATCH/DELETE)");
    }
    const pathCount = new Set(operations.map((operation) => splitOperation(operation)[1])).size;
    if (operations.length !== pin.openapi_operations) {
      problems.push(`chỉ mục có ${operations.length} operation, pin khai openapi_operations=${pin.openapi_operations}`);
    }
    if (pathCount !== pin.openapi_paths) {
      problems.push(`chỉ mục có ${pathCount} path, pin khai openapi_paths=${pin.openapi_paths}`);
    }
  }
  const digest = operationIndexDigest(operations);
  if (index.sha256 !== digest) {
    problems.push(`niêm sha256 của operation_index không khớp (ghi ${index.sha256}, tính ra ${digest})`);
  }

  if (problems.length > 0) throw new PinnedContractError(problems);
  return operations;
}

/** Nạp pin đã commit. Không có đường lùi: thiếu tệp / JSON hỏng / lệch niêm đều THROW. */
export function loadPinnedContract(root = REPO_ROOT) {
  const pinPath = join(root, PIN_RELATIVE_PATH);
  if (!existsSync(pinPath)) {
    throw new PinnedContractError([`không tìm thấy ${PIN_RELATIVE_PATH} dưới ${root}`]);
  }
  let pin;
  try {
    pin = JSON.parse(readFileSync(pinPath, "utf8"));
  } catch (error) {
    throw new PinnedContractError([`JSON không hợp lệ: ${error.message}`]);
  }
  const operations = validatePin(pin);
  return {
    pin,
    operations,
    operationSet: new Set(operations),
    paths: new Set(operations.map((operation) => splitOperation(operation)[1])),
  };
}

function readSpecBytes(source) {
  return source === "-" ? readFileSync(0) : readFileSync(resolve(source));
}

function verifySpec(source) {
  const { pin, operations } = loadPinnedContract();
  const bytes = readSpecBytes(source);
  const sha = sha256Hex(bytes);
  const accepted = new Map([[pin.spec_sha256, `spec gốc tại BE ${pin.be_sha.slice(0, 12)}`]]);
  for (const amendment of pin.amendments ?? []) {
    if (/^[0-9a-f]{64}$/.test(String(amendment?.redacted_spec_sha256 ?? ""))) {
      accepted.set(amendment.redacted_spec_sha256, `bản redact ${amendment.date ?? ""}`.trim());
    }
  }
  if (!accepted.has(sha)) {
    console.error(
      `[pinned-openapi] FAIL: spec sha256 ${sha} không phải revision đã pin (chấp nhận: ${[...accepted.keys()].join(", ")}).`,
    );
    return 1;
  }
  const derived = deriveOperationIndex(JSON.parse(bytes.toString("utf8")));
  const pinned = new Set(operations);
  const fresh = new Set(derived);
  const missing = operations.filter((operation) => !fresh.has(operation));
  const extra = derived.filter((operation) => !pinned.has(operation));
  if (missing.length > 0 || extra.length > 0 || operationIndexDigest(derived) !== pin.operation_index.sha256) {
    console.error(
      `[pinned-openapi] FAIL: chỉ mục suy từ spec lệch pin (thiếu ${missing.length}, thừa ${extra.length}).`,
    );
    for (const operation of [...missing.slice(0, 10)]) console.error(`  - thiếu trong spec: ${operation}`);
    for (const operation of [...extra.slice(0, 10)]) console.error(`  + thừa trong spec: ${operation}`);
    return 1;
  }
  console.log(
    `[pinned-openapi] PASS: spec ${sha.slice(0, 12)}… (${accepted.get(sha)}) suy ra đúng ${derived.length} operation / ${new Set(derived.map((operation) => splitOperation(operation)[1])).size} path của pin (niêm ${pin.operation_index.sha256.slice(0, 12)}…).`,
  );
  return 0;
}

function writeIndex(source) {
  const pinPath = join(REPO_ROOT, PIN_RELATIVE_PATH);
  const pin = JSON.parse(readFileSync(pinPath, "utf8"));
  const bytes = readSpecBytes(source);
  const sha = sha256Hex(bytes);
  if (sha !== pin.spec_sha256) {
    console.error(
      `[pinned-openapi] TỪ CHỐI: spec sha256 ${sha} khác spec_sha256 đã pin ${pin.spec_sha256}. --write-index không re-pin; đổi revision BE dùng npm run contract:sync -- <BE_SHA> --repin.`,
    );
    return 1;
  }
  pin.operation_index = buildOperationIndex(pin.spec_sha256, deriveOperationIndex(JSON.parse(bytes.toString("utf8"))));
  validatePin(pin);
  writeFileSync(pinPath, `${JSON.stringify(pin, null, 2)}\n`, "utf8");
  console.log(
    `[pinned-openapi] Đã ghi operation_index (${pin.operation_index.operations.length} operation, niêm ${pin.operation_index.sha256.slice(0, 12)}…) vào ${PIN_RELATIVE_PATH}.`,
  );
  return 0;
}

function selfTest() {
  const specSha = "a".repeat(64);
  const fixtureSpec = {
    paths: {
      "/api/v1/b/{id}": { parameters: [], delete: {}, get: {} },
      "/api/v1/a": { post: {}, get: {}, head: {} },
    },
  };
  const derived = deriveOperationIndex(fixtureSpec);
  const goodPin = () => ({
    be_repo: "owner/repo",
    be_sha: "b".repeat(40),
    spec_path: "storage/api-docs/api-docs.json",
    spec_sha256: specSha,
    openapi_version: "1.0.0",
    openapi_paths: 2,
    openapi_operations: 4,
    operation_index: buildOperationIndex(specSha, [...derived]),
  });
  const reseal = (pin) => {
    pin.operation_index.sha256 = operationIndexDigest(pin.operation_index.operations);
  };
  const mustThrow = (mutate) => () => {
    const pin = goodPin();
    mutate(pin);
    try {
      validatePin(pin);
      return false;
    } catch (error) {
      return error instanceof PinnedContractError;
    }
  };

  const cases = [
    [
      "suy ra đúng thứ tự chuẩn, bỏ parameters/head",
      () =>
        JSON.stringify(derived) ===
        JSON.stringify(["GET /api/v1/a", "POST /api/v1/a", "GET /api/v1/b/{id}", "DELETE /api/v1/b/{id}"]),
    ],
    ["pin hợp lệ nạp được", () => validatePin(goodPin()).length === 4],
    ["thiếu operation_index → FAIL", mustThrow((pin) => delete pin.operation_index)],
    ["mất một operation → FAIL", mustThrow((pin) => pin.operation_index.operations.pop())],
    [
      "thêm operation lạ dù đã niêm lại → FAIL",
      mustThrow((pin) => {
        pin.operation_index.operations.push("GET /api/v1/zzz");
        reseal(pin);
      }),
    ],
    [
      "đảo thứ tự dù đã niêm lại → FAIL",
      mustThrow((pin) => {
        pin.operation_index.operations.reverse();
        reseal(pin);
      }),
    ],
    [
      "mục trùng dù đã niêm lại → FAIL",
      mustThrow((pin) => {
        pin.operation_index.operations[1] = pin.operation_index.operations[0];
        reseal(pin);
      }),
    ],
    [
      "sai định dạng METHOD → FAIL",
      mustThrow((pin) => {
        pin.operation_index.operations[0] = "get /api/v1/a";
        reseal(pin);
      }),
    ],
    ["chỉ mục thuộc spec khác → FAIL", mustThrow((pin) => (pin.operation_index.source_spec_sha256 = "c".repeat(64)))],
    ["be_sha rút gọn → FAIL", mustThrow((pin) => (pin.be_sha = "bbbbbbb"))],
    ["openapi_operations lệch → FAIL", mustThrow((pin) => (pin.openapi_operations = 5))],
    [
      "thiếu tệp pin → FAIL",
      () => {
        try {
          loadPinnedContract(join(REPO_ROOT, "__khong-ton-tai__"));
          return false;
        } catch (error) {
          return error instanceof PinnedContractError;
        }
      },
    ],
  ];

  let failed = 0;
  for (const [name, run] of cases) {
    let ok = false;
    try {
      ok = run() === true;
    } catch {
      ok = false;
    }
    if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  }
  console.log(failed === 0 ? "\n[pinned-openapi --self-test] PASS" : `\n[pinned-openapi --self-test] FAIL (${failed} case)`);
  return failed === 0 ? 0 : 1;
}

const invokedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (invokedDirectly) {
  const args = process.argv.slice(2);
  const valueOf = (flag) => {
    const position = args.indexOf(flag);
    return position >= 0 ? args[position + 1] : undefined;
  };
  try {
    if (args.includes("--self-test")) process.exit(selfTest());
    if (args.includes("--verify-spec")) {
      const source = valueOf("--verify-spec");
      if (!source) throw new Error("--verify-spec cần <tệp> hoặc -");
      process.exit(verifySpec(source));
    }
    if (args.includes("--write-index")) {
      const source = valueOf("--write-index");
      if (!source) throw new Error("--write-index cần <tệp> hoặc -");
      process.exit(writeIndex(source));
    }
    const { pin, operations, paths } = loadPinnedContract();
    console.log(
      `[pinned-openapi] PASS: pin BE ${pin.be_sha.slice(0, 12)} — ${operations.length} operation / ${paths.size} path, niêm ${pin.operation_index.sha256.slice(0, 12)}… hợp lệ.`,
    );
  } catch (error) {
    console.error(`[pinned-openapi] FAIL: ${error.message}`);
    process.exit(1);
  }
}
