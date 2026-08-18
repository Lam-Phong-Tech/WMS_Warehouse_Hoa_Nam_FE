#!/usr/bin/env node
/**
 * WWHN-233 closure gate (FE) — DISP-STK-233 (Count / Recount / Partial / Stale DEFERRED).
 *
 * Nửa FE của hàng rào. Nửa BE là `scripts/verify-wwhn233-count-disposition.mjs`
 * trong repo backend.
 *
 * Ba việc gate này làm mà `check:api-mapping` và `wwhn-296:verify` không làm:
 *
 *   1. ANTI-DANGLING — root cause của điểm 34/100. Khi WWHN-233 rà soát, cả 4 hạng mục
 *      hàng rào mà DISP-STK-236 §5 cam kết đều chưa tồn tại. Gate này khẳng định mọi
 *      artifact FE mà governance register cam kết là file có thật.
 *   2. PIN ROT — `wwhn-296:verify` cố ý chỉ ghi *note* khi digest của corroborating
 *      baseline lệch, vì các artifact đó thuộc workstream khác. Hệ quả không lường
 *      trước: digest ERD stale từ commit f4b8404 và không ai refresh. Gate của WWHN-233
 *      biến đúng ràng buộc đó thành *fail*, vì DEV233-P1-03 yêu cầu source register
 *      mang exact version/hash. Thiết kế của WWHN-296 được giữ nguyên, không sửa.
 *   3. COUNT SURFACE — bề mặt count/recount/partial/stale ở FE (route, menu, permission,
 *      endpoint constant, service) phải bằng zero.
 *
 *   node scripts/verify-wwhn-233-closure.mjs
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const failures = [];
const checks = [];

const fail = (id, message) => failures.push(`[${id}] ${message}`);
const pass = (id, message) => checks.push(`[${id}] ${message}`);

const readIfExists = (rel) => {
  const abs = join(ROOT, rel);
  return existsSync(abs) ? readFileSync(abs, "utf8") : null;
};

const sha256 = (rel) => {
  const abs = join(ROOT, rel);
  return existsSync(abs)
    ? createHash("sha256").update(readFileSync(abs)).digest("hex")
    : null;
};

const GOVERNANCE = "docs/api-evidence/STOCKTAKE_GOVERNANCE_STATUS.json";

/**
 * Disposition của WWHN-233 nằm ở file riêng, không phải một key trong governance
 * register dùng chung. Bốn nhánh Stocktake (230/233/236/237) chạy song song trên `m1`;
 * một key chung sẽ khiến nhánh merge sau ghi đè nhánh trước.
 */
const DISPOSITION = "docs/api-evidence/WWHN-233_DEFERRAL_DISPOSITION.json";

/**
 * Bề mặt count/recount của nhánh WWHN-59/233. Ba mảnh đầu do WWHN-236 khoá; ba mảnh
 * sau là phần riêng của task này — một màn hình đếm lại tồn kho không nhất thiết
 * mang chữ `stocktake`.
 */
const FORBIDDEN_FRAGMENTS = [
  "stocktake",
  "adjustment",
  "variance",
  "recount",
  "cycle-count",
  "physical-count",
];

/** File nguồn FE phải sạch tuyệt đối bề mặt kiểm kê. */
const RUNTIME_SOURCES = [
  "src/shared/constants/routes.ts",
  "src/shared/constants/wms-permissions.ts",
  "src/shared/api/endpoints.ts",
];

let governance = null;

// ── Check 1: governance register đọc được và neo đúng controlling requirement ─
{
  const raw = readIfExists(GOVERNANCE);
  if (raw === null) {
    fail("GOVERNANCE", `${GOVERNANCE} không tồn tại.`);
  } else {
    try {
      governance = JSON.parse(raw);
    } catch (error) {
      fail(
        "GOVERNANCE",
        `${GOVERNANCE} không parse được JSON: ${error.message}`,
      );
    }
  }

  if (governance) {
    const requirement = governance.ruleAuthority?.controllingRequirement;
    if (requirement?.id !== "REQ-SRS-037") {
      fail("GOVERNANCE", "Controlling requirement phải là REQ-SRS-037.");
    } else if (requirement.priority !== "Must") {
      fail("GOVERNANCE", "REQ-SRS-037 phải được ghi kèm priority 'Must'.");
    } else {
      pass("GOVERNANCE", "Governance register neo REQ-SRS-037 (Must).");
    }

    // DEC-NO-STOCKTAKE-001 không được nâng thành approved standalone Decision ID
    // khi WWHN-25 còn In Progress (kế thừa FE296-P1-01).
    if (governance.decisionRecordGate?.approvedStandaloneDecisionId !== null) {
      fail(
        "GOVERNANCE",
        "approvedStandaloneDecisionId phải là null khi WWHN-25 chưa đóng; " +
          "DEC-NO-STOCKTAKE-001 không phải Decision ID đã duyệt.",
      );
    } else {
      pass(
        "GOVERNANCE",
        "DEC-NO-STOCKTAKE-001 vẫn không được coi là approved standalone Decision ID.",
      );
    }
  }
}

// ── Check 2: disposition WWHN-233 tồn tại, đúng chuỗi và không tự nhận approval ─
let disposition = null;
{
  const raw = readIfExists(DISPOSITION);
  if (raw === null) {
    fail(
      "DISP-233",
      `${DISPOSITION} không tồn tại — WWHN-233 bắt buộc có disposition máy đọc được.`,
    );
  } else {
    try {
      disposition = JSON.parse(raw);
    } catch (error) {
      fail(
        "DISP-233",
        `${DISPOSITION} không parse được JSON: ${error.message}`,
      );
    }
  }

  if (disposition) {
    const problems = [];
    if (disposition.id !== "DISP-STK-233")
      problems.push("id phải là DISP-STK-233");
    if (disposition.task !== "WWHN-233") problems.push("task phải là WWHN-233");
    if (disposition.parent !== "WWHN-59")
      problems.push("parent phải là WWHN-59");
    if (disposition.qaGate !== "WWHN-235")
      problems.push("qaGate phải là WWHN-235");
    if (disposition.controllingRequirement !== "REQ-SRS-037") {
      problems.push("controllingRequirement phải là REQ-SRS-037");
    }
    if (disposition.optionChosen !== "DEFERRED_NO_CODE")
      problems.push("optionChosen phải là DEFERRED_NO_CODE");
    if (!/DEFERRED \/ N\/A/u.test(disposition.qaGateDisposition ?? "")) {
      problems.push(
        "qaGateDisposition phải nêu WWHN-235 = DEFERRED / N/A (không phải Blocked/Pending)",
      );
    }

    if (problems.length > 0) {
      fail("DISP-233", `${DISPOSITION} ghi sai: ${problems.join("; ")}`);
    } else {
      pass(
        "DISP-233",
        "DISP-STK-233 đúng chuỗi WWHN-59 → WWHN-233 → WWHN-235, DEFERRED_NO_CODE.",
      );
    }

    // Một scope disposition không phải là phê duyệt DEC-STK-001. Khi WWHN-25 còn mở
    // thì nó không được mang effective date.
    if (
      disposition.status !== "APPROVED" &&
      disposition.effectiveDate !== null
    ) {
      fail(
        "DISP-233",
        `${DISPOSITION} chưa APPROVED nhưng đã có effectiveDate — disposition không được tự nhận hiệu lực.`,
      );
    } else {
      pass(
        "DISP-233",
        `Disposition ở trạng thái ${disposition.status} / effectiveDate = ${disposition.effectiveDate}.`,
      );
    }
  }
}

// ── Check 3: ANTI-DANGLING — artifact FE được cam kết phải có thật ────────────
//
// Root cause của điểm 34/100 (DEV233-P1-02). Chỉ khẳng định phần thuộc repo FE;
// nửa BE do `scripts/verify-wwhn233-count-disposition.mjs` khẳng định, và verifier
// đó lại nằm trong danh sách gate ở đây — nên chuỗi khép kín qua hai repo.
{
  if (disposition) {
    const promised = (disposition.gates ?? [])
      .filter((gate) => gate.startsWith("FE "))
      .map((gate) => gate.slice(3));

    if (promised.length === 0) {
      fail(
        "ANTI-DANGLING",
        `${DISPOSITION} không liệt kê gate FE nào — hàng rào không thể kiểm chứng.`,
      );
    } else {
      const missing = promised.filter((path) => !existsSync(join(ROOT, path)));
      if (missing.length > 0) {
        fail(
          "ANTI-DANGLING",
          `Disposition cam kết ${missing.length} artifact FE không tồn tại: ${missing.join(", ")}. ` +
            "Một disposition chỉ đóng được register khi hàng rào của nó là file chạy được, không phải mô tả.",
        );
      } else {
        pass(
          "ANTI-DANGLING",
          `Toàn bộ ${promised.length} gate FE được cam kết đều tồn tại.`,
        );
      }
    }

    if (!disposition.antiDanglingRule?.enforcement) {
      fail(
        "ANTI-DANGLING",
        `${DISPOSITION} thiếu antiDanglingRule — bài học DEV233-P1-02 không được ghi lại.`,
      );
    }
  }

  // Con trỏ trong governance register dùng chung phải trỏ đúng file disposition.
  if (governance) {
    const pointer = (governance.deferralDispositionPointers ?? []).find(
      (entry) => entry?.dispositionId === "DISP-STK-233",
    );
    if (!pointer) {
      fail("ANTI-DANGLING", `${GOVERNANCE} thiếu con trỏ tới DISP-STK-233.`);
    } else if (pointer.file !== DISPOSITION) {
      fail(
        "ANTI-DANGLING",
        `Con trỏ DISP-STK-233 trỏ sai file: ${pointer.file}`,
      );
    } else {
      pass(
        "ANTI-DANGLING",
        "Governance register trỏ đúng file disposition của WWHN-233.",
      );
    }
  }
}

// ── Check 4: PIN ROT — digest ghi trong register phải khớp thực tế ────────────
{
  if (governance) {
    const pinned = [];
    const controlling = governance.ruleAuthority?.controllingBaseline;
    if (controlling?.repositoryPath) {
      pinned.push({
        path: controlling.repositoryPath,
        sha256: controlling.sha256,
        role: "CONTROLLING",
      });
    }
    for (const artifact of governance.ruleAuthority?.corroboratingBaselines ??
      []) {
      if (artifact?.repositoryPath) {
        pinned.push({
          path: artifact.repositoryPath,
          sha256: artifact.sha256,
          role: "CORROBORATING",
        });
      }
    }

    const drifted = [];
    for (const entry of pinned) {
      const actual = sha256(entry.path);
      if (actual === null) {
        fail("PIN-ROT", `Baseline được pin nhưng không tồn tại: ${entry.path}`);
      } else if (actual !== entry.sha256) {
        drifted.push(
          `${entry.path} (${entry.role}): register ghi ${entry.sha256}, thực tế ${actual}`,
        );
      }
    }

    if (drifted.length > 0) {
      fail(
        "PIN-ROT",
        `Digest trong ${GOVERNANCE} đã stale:\n    ${drifted.join("\n    ")}\n` +
          "    DEV233-P1-03 yêu cầu source register mang exact version/hash. Đọc lại anchor rồi refresh digest.",
      );
    } else {
      pass(
        "PIN-ROT",
        `${pinned.length} baseline được pin, digest khớp thực tế.`,
      );
    }
  }
}

// ── Check 5: anchor nội dung còn sống — rule không được sống lâu hơn căn cứ ───
{
  const srs = readIfExists("docs/HN_SRS_FRD_v1.12_FULL.md");
  if (srs === null) {
    fail("ANCHOR", "docs/HN_SRS_FRD_v1.12_FULL.md không tồn tại.");
  } else {
    for (const anchor of [
      "REQ-SRS-037",
      "Không expose Stocktake/Variance",
      "AC-SRS-037",
      "BR-NOSTK-01..03",
    ]) {
      if (!srs.includes(anchor))
        fail("ANCHOR", `SRS baseline mất anchor: ${anchor}`);
    }
  }

  const erd = readIfExists("docs/HoaNam_ERD_Moi_Nhat.md");
  if (erd === null) {
    fail("ANCHOR", "docs/HoaNam_ERD_Moi_Nhat.md không tồn tại.");
  } else if (!erd.includes("Không tạo Stocktake_Session")) {
    fail("ANCHOR", "ERD §0.1 không còn loại Stocktake khỏi baseline.");
  }

  const wireframe = readIfExists(
    "docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html",
  );
  if (wireframe === null) {
    fail("ANCHOR", "Wireframe MVP baseline không tồn tại.");
  } else if (/stocktake|kiểm kê/iu.test(wireframe)) {
    fail(
      "ANCHOR",
      "Wireframe MVP xuất hiện màn hình kiểm kê — căn cứ 'zero màn hình' không còn đúng.",
    );
  }

  if (!failures.some((entry) => entry.startsWith("[ANCHOR]"))) {
    pass("ANCHOR", "SRS / ERD / Wireframe giữ nguyên anchor no-Stocktake.");
  }
}

// ── Check 6: bề mặt count/recount ở FE bằng zero ──────────────────────────────
{
  for (const rel of RUNTIME_SOURCES) {
    const source = readIfExists(rel);
    if (source === null) {
      fail("FE-SURFACE", `${rel} không tồn tại.`);
      continue;
    }

    // Bỏ dòng comment: các file này cố ý ghi chú REQ-SRS-037 để giải thích vì sao trống.
    const executable = source
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/u.test(line))
      .join("\n")
      .toLowerCase();

    const hits = FORBIDDEN_FRAGMENTS.filter((fragment) =>
      executable.includes(fragment),
    );
    if (hits.length > 0) {
      fail("FE-SURFACE", `${rel} chứa bề mặt bị cấm: ${hits.join(", ")}`);
    }
  }

  if (!failures.some((entry) => entry.startsWith("[FE-SURFACE]"))) {
    pass(
      "FE-SURFACE",
      `${RUNTIME_SOURCES.length} file nguồn runtime: zero route/permission/endpoint kiểm kê.`,
    );
  }
}

// ── Check 7: không còn class/selector màn hình kiểm kê trong style + module ───
{
  const scanRoots = ["src/styles", "src/modules", "src/app"];
  const offenders = [];

  const walk = (base) => {
    const abs = join(ROOT, base);
    if (!existsSync(abs)) return [];
    return readdirSync(abs).flatMap((entry) => {
      const child = join(abs, entry);
      return statSync(child).isDirectory()
        ? walk(relative(ROOT, child))
        : [relative(ROOT, child)];
    });
  };

  for (const rel of scanRoots.flatMap((base) => walk(base))) {
    if (!/\.(ts|tsx|css)$/u.test(rel)) continue;
    if (/\.test\.(ts|tsx)$/u.test(rel)) continue; // test guard được phép nhắc tên để assert vắng mặt

    const source = readIfExists(rel) ?? "";
    // Selector/route/permission mang tên màn hình kiểm kê. `variance` là từ thống kê
    // hợp lệ trong báo cáo đối soát nên không tính ở đây — nó đã bị chặn ở tầng path.
    if (
      /stocktake-page|stocktake_page|StocktakePage|ROUTES\.STOCKTAKE|stocktake\.[a-z]/u.test(
        source,
      )
    ) {
      offenders.push(rel);
    }
  }

  if (offenders.length > 0) {
    fail(
      "FE-SCREEN",
      `Còn tàn dư màn hình/permission kiểm kê: ${offenders.join(", ")}`,
    );
  } else {
    pass(
      "FE-SCREEN",
      "Zero selector, route constant hoặc permission màn hình kiểm kê trong src/.",
    );
  }
}

// ── Report ────────────────────────────────────────────────────────────────────
for (const entry of checks) console.log(`  PASS ${entry}`);

if (failures.length > 0) {
  console.error(`\n[wwhn-233] FAIL (${failures.length}):`);
  for (const entry of failures) console.error(`  ${entry}`);
  process.exit(1);
}

console.log(
  "\n[wwhn-233] PASS: DISP-STK-233 được ghi nhận, hàng rào FE được cam kết đều tồn tại (ANTI-DANGLING), " +
    "digest baseline khớp thực tế (không pin rot), bề mặt count/recount ở FE bằng zero.",
);
