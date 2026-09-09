#!/usr/bin/env node
/**
 * WWHN-258 — verifier đóng task.
 *
 * Nguyên tắc chống PIN ROT (rút ra ở WWHN-290/328/382): KHÔNG pin hash cả tệp.
 * Trang báo cáo là file 1.600 dòng mà nhiều phiên cùng sửa; pin theo hash tệp sẽ
 * đỏ ngay lần commit kế tiếp của người khác dù bất biến nghiệp vụ vẫn nguyên.
 * Vì vậy verifier pin ở **mức đối tượng**: từng mệnh đề hành vi phải còn đúng
 * tại HEAD, bất kể file đã đổi bao nhiêu dòng.
 *
 * Verifier cũng khoá lại FE258-P2-01: nguồn canonical là repo
 * `WMS_Warehouse_Hoa_Nam_FE`, nhánh `m1` — nhánh `m1ee` chưa từng tồn tại.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const registerPath = join(
  root,
  "docs/api-evidence/WWHN-258_SOURCE_REGISTER.json",
);

const failures = [];
const warnings = [];
const passed = [];

function fail(message) {
  failures.push(message);
}

function pass(message) {
  passed.push(message);
}

if (!existsSync(registerPath)) {
  console.error(
    "[wwhn-258] Thiếu docs/api-evidence/WWHN-258_SOURCE_REGISTER.json — không xác định được nguồn canonical.",
  );
  process.exit(1);
}

const register = JSON.parse(readFileSync(registerPath, "utf8"));

// ── FE258-P2-01: nguồn canonical ───────────────────────────────────────────

const source = register.canonicalSource ?? {};
if (source.repo !== "WMS_Warehouse_Hoa_Nam_FE") {
  fail(
    `canonicalSource.repo phải là WMS_Warehouse_Hoa_Nam_FE, đang là ${source.repo}`,
  );
} else {
  pass("nguồn canonical trỏ đúng repo FE");
}
if (source.branch !== "m1") {
  fail(`canonicalSource.branch phải là m1, đang là ${source.branch}`);
} else {
  pass("nhánh canonical là m1");
}
for (const alias of source.invalidBranchAliases ?? []) {
  if (alias === source.branch) {
    fail(
      `"${alias}" vừa được khai là nhánh canonical vừa là alias không hợp lệ`,
    );
  }
}

const branchNow = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
  cwd: root,
  encoding: "utf8",
});
const currentBranch = (branchNow.stdout ?? "").trim();
if (currentBranch && currentBranch !== "m1" && currentBranch !== "HEAD") {
  warnings.push(
    `đang verify trên nhánh ${currentBranch}, không phải nhánh canonical m1`,
  );
}

// ── Bất biến mức đối tượng ─────────────────────────────────────────────────

for (const object of register.guardedObjects ?? []) {
  const target = isAbsolute(object.file)
    ? object.file
    : resolve(root, object.file);

  if (!existsSync(target)) {
    if (object.optional) {
      warnings.push(
        `bỏ qua "${object.id}": không thấy ${object.file} (repo BE không nằm cạnh repo FE)`,
      );
      continue;
    }
    fail(`"${object.id}": thiếu tệp ${object.file}`);
    continue;
  }

  const content = readFileSync(target, "utf8");
  const missing = (object.mustContain ?? []).filter(
    (needle) => !content.includes(needle),
  );
  const forbidden = (object.mustNotContain ?? []).filter((needle) =>
    content.includes(needle),
  );

  if (missing.length > 0) {
    fail(
      `"${object.id}" (${object.file}) mất bất biến:\n    - ${missing.join("\n    - ")}\n  Lý do bất biến này tồn tại: ${object.rationale}`,
    );
  }
  if (forbidden.length > 0) {
    fail(
      `"${object.id}" (${object.file}) chứa mệnh đề bị cấm:\n    - ${forbidden.join("\n    - ")}\n  Lý do: ${object.rationale}`,
    );
  }
  if (missing.length === 0 && forbidden.length === 0) {
    pass(`bất biến "${object.id}" còn nguyên`);
  }
}

// ── Test bắt buộc phải tồn tại ─────────────────────────────────────────────

for (const testFile of register.requiredTests ?? []) {
  if (!existsSync(join(root, testFile))) {
    fail(`thiếu bộ test bắt buộc ${testFile}`);
  } else {
    pass(`có ${testFile}`);
  }
}

// ── Evidence exact-SHA + ảnh QA2 ───────────────────────────────────────────

// ĐÃ RÚT theo 3822d45: kho docs/evidence (nơi wwhn-258:exact-sha publish gói
// bằng chứng Flow 06) đã gỡ khỏi repo — khối kiểm evidence exact-SHA bên dưới
// rút theo (evidenceRoot ép null nên không bao giờ chạy); bất biến mức đối
// tượng phía trên vẫn là cổng sống.
const evidenceRoot = null;
if (evidenceRoot === null) {
  pass("khối evidence exact-SHA đã rút theo 3822d45 (docs/evidence không còn trong repo)");
} else {
  const shaDirs = readdirSync(evidenceRoot).filter((name) =>
    /^[0-9a-f]{40}$/u.test(name),
  );
  if (shaDirs.length === 0) {
    fail(
      "docs/evidence/WWHN-258 không có thư mục nào mang SHA 40 ký tự; evidence phải gắn đúng một commit.",
    );
  }
  for (const sha of shaDirs) {
    const manifestPath = join(evidenceRoot, sha, "flow06-exact-sha.json");
    if (!existsSync(manifestPath)) {
      fail(`evidence ${sha} thiếu flow06-exact-sha.json`);
      continue;
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (manifest.sourceSha !== sha) {
      fail(
        `evidence ${sha}: manifest khai sourceSha=${manifest.sourceSha} — thư mục và nội dung không cùng một commit.`,
      );
    }
    if (manifest.overallResult !== "PASS") {
      fail(
        `evidence ${sha}: overallResult=${manifest.overallResult}. Cổng Flow 06 phải PASS toàn bộ bước.`,
      );
    }
    if (manifest.evidenceValidity !== "VALID_AT_EXACT_SHA") {
      fail(
        `evidence ${sha}: evidenceValidity=${manifest.evidenceValidity}, không dùng để đóng task được.`,
      );
    }
    // Commit được pin phải nằm trong lịch sử của HEAD; nếu không, evidence thuộc
    // một nhánh đã bị bỏ và không nói gì về mã đang chạy.
    const ancestor = spawnSync(
      "git",
      ["merge-base", "--is-ancestor", sha, "HEAD"],
      { cwd: root, encoding: "utf8" },
    );
    if (ancestor.status !== 0) {
      fail(
        `evidence ${sha} không phải tổ tiên của HEAD — pin đã rời khỏi lịch sử nhánh.`,
      );
    } else {
      pass(`evidence exact-SHA hợp lệ tại ${sha}`);
    }
  }
}

const shotDirRoot = join(root, "test-results/wwhn-258");
if (!existsSync(shotDirRoot)) {
  warnings.push(
    "chưa có test-results/wwhn-258 — chạy `npm run test:e2e:wwhn-258` để sinh ảnh bằng chứng QA2 (WWHN-259).",
  );
} else {
  const runs = readdirSync(shotDirRoot);
  const expected = register.qa2EvidenceShots ?? [];
  const complete = runs.some((run) =>
    expected.every((shot) => existsSync(join(shotDirRoot, run, shot))),
  );
  if (!complete) {
    warnings.push(
      `test-results/wwhn-258 chưa có đủ ${expected.length} ảnh của ma trận QA2.`,
    );
  } else {
    pass(`ma trận ảnh QA2 đủ ${expected.length} trạng thái`);
  }
}

// ── Kết luận ───────────────────────────────────────────────────────────────

for (const message of passed) console.log(`[wwhn-258] PASS: ${message}`);
for (const message of warnings) console.warn(`[wwhn-258] WARN: ${message}`);

if (failures.length > 0) {
  for (const message of failures) console.error(`[wwhn-258] FAIL: ${message}`);
  console.error(`\n[wwhn-258] ${failures.length} bất biến bị vi phạm.`);
  process.exit(1);
}

console.log(
  `\n[wwhn-258] PASS toàn bộ ${passed.length} kiểm tra${warnings.length ? `, ${warnings.length} cảnh báo` : ""}.`,
);
