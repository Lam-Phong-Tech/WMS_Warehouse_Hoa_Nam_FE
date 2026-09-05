/**
 * cache:policy — guard "100% query có chính sách cache".
 *
 * Yêu cầu nghiệp vụ đứng sau guard này: mọi query trong dự án phải được PHÂN
 * LOẠI, không có nghĩa mọi query đều được persist. Nếu một màn hình mới đặt
 * `queryKey: ["thing-moi", ...]` mà không khai `thing-moi` trong
 * QUERY_CACHE_REGISTRY (src/shared/cache/cache-policy.ts), nó sẽ âm thầm rơi về
 * nhóm mặc định — đúng kiểu trôi chính sách mà đợt này dọn đi.
 *
 * Guard FAIL khi:
 *   1. Có query key root xuất hiện trong src/ nhưng không có trong registry.
 *   2. Registry khai trùng root (setQueryDefaults sẽ mập mờ).
 *   3. Có root nào trong registry không còn được dùng ở đâu (cấu hình chết).
 *
 * --self-test: chạy trên đoạn mã tổng hợp để chứng minh guard thật sự bắt lỗi.
 */
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, walk } from "./ui-guards-lib.mjs";

const POLICY_FILE = "src/shared/cache/cache-policy.ts";
// src/shared/cache/* là chính hạ tầng chính sách: nó thao tác trên query.queryKey
// của người khác chứ không tự khai queryKey nào, nên quét nó chỉ sinh nhiễu.
const EXCLUDES = [
  ".test.",
  "src/test/",
  "__tests__",
  "__snapshots__",
  "src/shared/cache/",
];

/** Root động do nơi gọi truyền vào, không thể suy tĩnh từ mã. */
const DYNAMIC_ROOT_ALLOWLIST = new Set([
  // use-autocomplete nhận `queryKey` qua option, mặc định "autocomplete".
  "autocomplete",
]);

export function readRegistryRoots(source) {
  const block = /QUERY_CACHE_REGISTRY[\s\S]*?=\s*\[([\s\S]*?)\n\];/.exec(source);
  if (!block) return [];
  const roots = [];
  const re = /\[\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\]/g;
  let m;
  while ((m = re.exec(block[1]))) roots.push({ root: m[1], cacheClass: m[2] });
  return roots;
}

/**
 * Suy ra query key root từ một file nguồn.
 *
 * Ba dạng phải nhận được, vì cả ba đều tồn tại thật trong dự án:
 *   queryKey: ["root", ...]            — literal
 *   queryKey: fooKeys.bar(x)           — factory, root nằm ở `fooKeys.all`
 *   queryKey: [...fooKeys.all, "x"]    — spread factory
 *   queryKey: SOME_CONST               — hằng số mảng khai cùng file
 */
export function extractRoots(source) {
  const roots = new Set();

  // Bảng tra: tên factory/hằng số -> root, khai ngay trong file.
  const factoryRoots = new Map();
  const factoryRe = /(?:const|let)\s+(\w+)\s*=\s*\{\s*all:\s*\[\s*"([^"]+)"/g;
  let fm;
  while ((fm = factoryRe.exec(source))) factoryRoots.set(fm[1], fm[2]);

  const constRe = /(?:const|let)\s+([A-Z][A-Z0-9_]*)\s*=\s*\[\s*"([^"]+)"/g;
  while ((fm = constRe.exec(source))) factoryRoots.set(fm[1], fm[2]);

  // Bắt cả literal nhiều dòng lẫn lời gọi factory nằm gọn trên một dòng, và cả
  // `invalidateQueries({ queryKey: [...] })` — root dùng để vô hiệu cache cũng
  // phải có chính sách, không chỉ root dùng để đọc.
  const keyRe = /queryKey:\s*([\s\S]{0,200})/g;
  let km;
  while ((km = keyRe.exec(source))) {
    const expr = km[1].trim();

    const spread = /^\[\s*\.\.\.(\w+)\.all/.exec(expr);
    if (spread) {
      if (factoryRoots.has(spread[1])) roots.add(factoryRoots.get(spread[1]));
      continue;
    }

    const literal = /^\[\s*"([^"]+)"/.exec(expr);
    if (literal) {
      roots.add(literal[1]);
      continue;
    }

    const spreadConst = /^\[\s*\.\.\.([A-Z][A-Z0-9_]*)/.exec(expr);
    if (spreadConst && factoryRoots.has(spreadConst[1])) {
      roots.add(factoryRoots.get(spreadConst[1]));
      continue;
    }

    const factoryCall = /^(\w+)\s*\./.exec(expr);
    if (factoryCall && factoryRoots.has(factoryCall[1])) {
      roots.add(factoryRoots.get(factoryCall[1]));
      continue;
    }

    const bareConst = /^([A-Z][A-Z0-9_]*)\s*$/.exec(expr);
    if (bareConst && factoryRoots.has(bareConst[1])) {
      roots.add(factoryRoots.get(bareConst[1]));
      continue;
    }

    // Biểu thức điều kiện: gom mọi literal đầu mảng bên trong.
    const nested = /\[\s*"([^"]+)"/g;
    let nm;
    while ((nm = nested.exec(expr))) roots.add(nm[1]);
    const nestedFactory = /(\w+Keys)\./g;
    while ((nm = nestedFactory.exec(expr))) {
      if (factoryRoots.has(nm[1])) roots.add(factoryRoots.get(nm[1]));
    }
  }

  return roots;
}

export function checkPolicy(files, contents, registrySource) {
  const violations = [];
  const registry = readRegistryRoots(registrySource);
  const registered = new Set(registry.map((entry) => entry.root));

  const duplicates = registry
    .map((entry) => entry.root)
    .filter((root, index, all) => all.indexOf(root) !== index);
  for (const duplicate of new Set(duplicates)) {
    violations.push(
      `QUERY_CACHE_REGISTRY khai trùng root "${duplicate}" — setQueryDefaults sẽ mập mờ.`,
    );
  }

  const usedRoots = new Map();
  for (const file of files) {
    for (const root of extractRoots(contents(file))) {
      if (!usedRoots.has(root)) usedRoots.set(root, file);
    }
  }

  for (const [root, file] of usedRoots) {
    if (!registered.has(root)) {
      violations.push(
        `${file}: queryKey root "${root}" chưa có chính sách trong ${POLICY_FILE} (QUERY_CACHE_REGISTRY).`,
      );
    }
  }

  for (const root of registered) {
    if (!usedRoots.has(root) && !DYNAMIC_ROOT_ALLOWLIST.has(root)) {
      violations.push(
        `QUERY_CACHE_REGISTRY khai root "${root}" nhưng không file nào dùng — cấu hình chết, xoá đi.`,
      );
    }
  }

  return violations;
}

function selfTest() {
  const registrySource = `
export const QUERY_CACHE_REGISTRY = [
  ["known", "master"],
  ["dup", "list"],
  ["dup", "report"],
  ["orphan", "reference"],
];
`;
  const fakeFiles = ["a.ts", "b.ts"];
  const fakeContents = (file) =>
    file === "a.ts"
      ? `const fooKeys = { all: ["unregistered"], list: () => [...fooKeys.all, "l"] };
         useQuery({ queryKey: fooKeys.list(), queryFn: f });`
      : `useQuery({ queryKey: ["known", 1], queryFn: f });
         useQuery({ queryKey: ["dup"], queryFn: f });`;

  const violations = checkPolicy(fakeFiles, fakeContents, registrySource);
  const wantsUnregistered = violations.some((v) => v.includes('"unregistered"'));
  const wantsDuplicate = violations.some((v) => v.includes("khai trùng"));
  const wantsOrphan = violations.some((v) => v.includes('"orphan"'));

  if (wantsUnregistered && wantsDuplicate && wantsOrphan) {
    console.log(
      `[cache:policy --self-test] PASS (bắt đủ 3 loại vi phạm, tổng ${violations.length})`,
    );
    return 0;
  }
  console.error("[cache:policy --self-test] FAIL — thiếu loại vi phạm:", {
    wantsUnregistered,
    wantsDuplicate,
    wantsOrphan,
    violations,
  });
  return 1;
}

if (process.argv[2] === "--self-test") process.exit(selfTest());

const files = walk(path.join(REPO_ROOT, "src"), [".ts", ".tsx"], {
  exclude: EXCLUDES,
});
const contents = (file) =>
  fs.readFileSync(path.join(REPO_ROOT, file), "utf8");
const violations = checkPolicy(
  files,
  contents,
  fs.readFileSync(path.join(REPO_ROOT, POLICY_FILE), "utf8"),
);

if (violations.length > 0) {
  console.error(`[cache:policy] FAIL — ${violations.length} vi phạm:`);
  violations.forEach((v) => console.error("  - " + v));
  process.exit(1);
}
console.log(`[cache:policy] PASS — ${files.length} file, mọi query root đều có chính sách.`);
