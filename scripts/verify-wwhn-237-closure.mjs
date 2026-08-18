#!/usr/bin/env node
/**
 * WWHN-237 closure gate, FE half — DISP-STK-237 (Variance query/report DEFERRED).
 *
 * `verify-wwhn-230-closure.mjs` đã chứng minh FE không có route/permission/menu kiểm kê.
 * Gate này khoá phần WWHN-237 nói tới mà 230 chưa phủ: **hợp đồng và bề mặt báo cáo**.
 *
 * Chỗ đứt gãy thật đã tìm thấy khi mở WWHN-237: `docs/api-evidence/WMS_FE_CONTRACT_BASELINE.json`
 * vẫn khai criticalFlow `APPLY_ADJUSTMENT` với permission `stocktake.adjust` và
 * `feDisposition: IMPLEMENTED_EXACT_V1_7_SESSION_VERSION_CAS` — tức FE *tuyên bố đã
 * implement* một capability mà REQ-SRS-037 cấm — cộng thêm `SCAN_CLASSIFY.context` liệt
 * `STOCKTAKE`, giá trị mà runtime BE nay trả 422. Không guard nào bắt được vì cả hai nằm
 * trong file hợp đồng, không nằm trong source runtime.
 *
 *   npm run wwhn-237:verify
 *   npm run wwhn-237:verify -- --with-tests
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const beRoot = resolve(root, "../../HoaNam_BE/WMS_Warehouse_Hoa_Nam_BE");
const argv = new Set(process.argv.slice(2));
const withTests = argv.has("--with-tests");

/** Bề mặt kiểm kê bị cấm. `variance` trần KHÔNG nằm đây: reconciliation variance hợp lệ. */
const FORBIDDEN_FRAGMENTS = [
  "stocktake",
  "stock-take",
  "apply-adjustment",
  "variance_line",
  "stocktake_variance",
  "discrepancy",
];

/** 9 report code MVP — phải khớp đúng registry BE (`OperationalReportController`). */
const CANONICAL_REPORT_CODES = [
  "document-history",
  "import-match",
  "inventory-balance",
  "inventory-ledger",
  "inventory-xnt",
  "label-log",
  "movement-trace",
  "outbound-by-agency",
  "warranty-defects",
];

const failures = [];
const checks = [];

const record = (id, ok, detail) => {
  checks.push({ id, status: ok ? "PASS" : "FAIL", detail });
  if (!ok) failures.push(`${id}: ${detail}`);
};

const readText = (relativePath, base = root) => {
  const abs = join(base, relativePath);
  return existsSync(abs) ? readFileSync(abs, "utf8") : null;
};

const sha256 = (relativePath, base = root) => {
  const abs = join(base, relativePath);
  return existsSync(abs) ? createHash("sha256").update(readFileSync(abs)).digest("hex") : null;
};

const git = (args, cwd) => {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
};

// ── 1. FE contract baseline không còn khai capability kiểm kê ────────────────
{
  const rel = "docs/api-evidence/WMS_FE_CONTRACT_BASELINE.json";
  const raw = readText(rel);
  if (raw === null) {
    record("FE-CONTRACT-BASELINE", false, `${rel} không tồn tại.`);
  } else {
    const baseline = JSON.parse(raw);
    const flows = baseline.criticalFlows ?? [];

    const offendingFlows = flows.filter((flow) => {
      const blob = JSON.stringify(flow).toLowerCase();
      return FORBIDDEN_FRAGMENTS.some((fragment) => blob.includes(fragment));
    });
    record(
      "FE-CONTRACT-FLOWS",
      offendingFlows.length === 0,
      offendingFlows.length === 0
        ? `${flows.length} criticalFlow: zero bề mặt kiểm kê`
        : `criticalFlow còn bề mặt kiểm kê: ${offendingFlows.map((f) => f.id).join(", ")}`,
    );

    const scan = flows.find((flow) => flow.id === "SCAN_CLASSIFY");
    const contexts = scan?.requestConstraints?.context ?? [];
    record(
      "FE-CONTRACT-SCAN-CONTEXT",
      Array.isArray(contexts) && !contexts.includes("STOCKTAKE"),
      Array.isArray(contexts)
        ? `SCAN_CLASSIFY.context = [${contexts.join(", ")}]`
        : "SCAN_CLASSIFY.context không đọc được",
    );

    const removed = baseline.removedFromMvp ?? null;
    record(
      "FE-CONTRACT-DISPOSITION",
      removed?.requirement === "REQ-SRS-037" && removed?.task === "WWHN-237",
      removed
        ? `removedFromMvp neo ${removed.requirement} / ${removed.task}`
        : "thiếu khối removedFromMvp — FE có thể suy diễn lại contract Stocktake từ artifact cũ",
    );
  }
}

// ── 2. Governance register ghi disposition WWHN-237, không over-claim approval ─
{
  const rel = "docs/api-evidence/STOCKTAKE_GOVERNANCE_STATUS.json";
  const raw = readText(rel);
  if (raw === null) {
    record("GOVERNANCE", false, `${rel} không tồn tại.`);
  } else {
    const governance = JSON.parse(raw);
    const disposition = governance.scopeDisposition ?? {};
    record(
      "GOVERNANCE-DISPOSITION",
      disposition.task === "WWHN-237" && disposition.resolution === "OPTION_A_NO_CODE_REMOVAL_CLOSURE",
      `scopeDisposition = ${disposition.task ?? "(unset)"} / ${disposition.resolution ?? "(unset)"}`,
    );

    const gate = governance.decisionRecordGate ?? {};
    record(
      "GOVERNANCE-NO-OVERCLAIM",
      !(gate.approvedStandaloneDecisionId && !gate.approvedArtifactHash),
      gate.approvedStandaloneDecisionId
        ? `WWHN-25 được ghi approved id ${gate.approvedStandaloneDecisionId}`
        : "không tuyên bố approved standalone Decision ID khi WWHN-25 còn mở",
    );
    record(
      "GOVERNANCE-REOPEN-GATE",
      typeof disposition.reintroductionGate === "string" && disposition.reintroductionGate.includes("WWHN-25"),
      "điều kiện tái mở neo vào CR/Later Phase hoặc WWHN-25",
    );
  }
}

// ── 3. Bề mặt báo cáo FE khớp đúng 9 report code MVP ─────────────────────────
{
  const rel = "src/modules/reports/pages/AlignedReportsPage.tsx";
  const source = readText(rel);
  if (source === null) {
    record("FE-REPORT-SURFACE", false, `${rel} không tồn tại.`);
  } else {
    const declared = [...new Set((source.match(/reportCode:\s*"([a-z-]+)"/g) ?? []).map((m) => m.split('"')[1]))].sort();
    const unknown = declared.filter((code) => !CANONICAL_REPORT_CODES.includes(code));
    record(
      "FE-REPORT-CODES",
      unknown.length === 0,
      unknown.length === 0
        ? `${declared.length} report code, tất cả nằm trong registry MVP`
        : `report code lạ: ${unknown.join(", ")}`,
    );

    const hits = FORBIDDEN_FRAGMENTS.filter((fragment) => source.toLowerCase().includes(fragment));
    record(
      "FE-REPORT-SURFACE",
      hits.length === 0,
      hits.length === 0 ? "trang báo cáo không có tab/cột kiểm kê" : `còn bề mặt: ${hits.join(", ")}`,
    );
  }
}

// ── 4. Không còn selector/permission chết trong source runtime ───────────────
{
  for (const rel of [
    "src/styles/hn-wms-page-normalize.css",
    "src/shared/constants/wms-permissions.ts",
    "src/shared/constants/routes.ts",
    "src/shared/api/endpoints.ts",
  ]) {
    const source = readText(rel);
    if (source === null) {
      record("FE-SOURCE", false, `${rel} không tồn tại.`);
      continue;
    }
    // Câu văn "REQ-SRS-037: MVP không có permission kiểm kê" là bằng chứng tuân thủ,
    // không phải capability — nên chỉ soi literal thực thi, bỏ dòng comment.
    const executable = source
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join("\n");
    const hits = FORBIDDEN_FRAGMENTS.filter((fragment) => executable.toLowerCase().includes(fragment));
    record(`FE-SOURCE ${rel}`, hits.length === 0, hits.length === 0 ? "sạch" : `còn: ${hits.join(", ")}`);
  }
}

// ── 5. Baseline vẫn phát biểu chính điều gate đang enforce ───────────────────
{
  const srs = readText("docs/HN_SRS_FRD_v1.12_FULL.md");
  record(
    "BASELINE-SRS",
    srs !== null && srs.includes("REQ-SRS-037") && srs.includes("Không expose Stocktake/Variance"),
    "REQ-SRS-037 còn hiệu lực trong SRS/FRD v1.12",
  );
  const erd = readText("docs/HoaNam_ERD_Moi_Nhat.md");
  record(
    "BASELINE-ERD",
    erd !== null && /Variance_Line/u.test(erd),
    "ERD §0.1 vẫn loại Variance_Line khỏi baseline",
  );
  const wireframe = readText("docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html");
  record(
    "BASELINE-WIREFRAME",
    wireframe !== null && !/stocktake|kiểm kê/iu.test(wireframe),
    "wireframe MVP không có màn hình/menu kiểm kê",
  );
}

// ── 6. Đối chiếu nửa BE ──────────────────────────────────────────────────────
{
  const beDisposition = readText("docs/decision-records/DISP-STK-237-VARIANCE-REPORT-DEFERRED.md", beRoot);
  record(
    "BE-DISPOSITION",
    beDisposition !== null && beDisposition.includes("REQ-SRS-037"),
    beDisposition === null
      ? "không thấy DISP-STK-237 phía BE — hai nửa phải cùng một disposition"
      : "DISP-STK-237 phía BE có mặt và neo REQ-SRS-037",
  );
  const beGate = readText("scripts/verify-wwhn237-variance-report-disposition.mjs", beRoot);
  record("BE-GATE", beGate !== null, beGate === null ? "thiếu gate BE" : "gate BE có mặt");
}

// ── 7. Pin định danh để QA1 tái lập WWHN-238 ────────────────────────────────
const identity = {
  schema_version: "1.0.0",
  jira_key: "WWHN-237",
  disposition: "DISP-STK-237",
  controlling_requirement: "REQ-SRS-037",
  fe: {
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"], root),
    commit_sha: git(["rev-parse", "HEAD"], root),
    working_tree_clean: git(["status", "--porcelain"], root) === "",
  },
  be: {
    branch: git(["rev-parse", "--abbrev-ref", "HEAD"], beRoot),
    commit_sha: git(["rev-parse", "HEAD"], beRoot),
  },
  baselines: {
    "docs/HN_SRS_FRD_v1.12_FULL.md": sha256("docs/HN_SRS_FRD_v1.12_FULL.md"),
    "docs/HoaNam_ERD_Moi_Nhat.md": sha256("docs/HoaNam_ERD_Moi_Nhat.md"),
    "docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html": sha256(
      "docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html",
    ),
    "docs/api-evidence/WMS_FE_CONTRACT_BASELINE.json": sha256("docs/api-evidence/WMS_FE_CONTRACT_BASELINE.json"),
  },
  baseline_hash_rule:
    "Hash ghi tại thời điểm chạy gate, không phải hằng số dán tay: ERD còn đang được cập nhật ở task khác nên guard xác minh bằng anchor text §0.1, còn hash chỉ để QA1 tái lập đúng bản đã kiểm.",
  checks,
  status: failures.length === 0 ? "PASS" : "FAIL",
};

if (withTests) {
  try {
    execFileSync("npx", ["vitest", "run", "src/test/wwhn-237-variance-report-guard.test.ts"], {
      cwd: root,
      encoding: "utf8",
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    record("FE-GUARD-TEST", true, "vitest guard WWHN-237 pass");
  } catch {
    record("FE-GUARD-TEST", false, "vitest guard WWHN-237 fail");
    identity.status = "FAIL";
  }
}

const outDir = join(root, "docs/evidence/WWHN-237");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "FE_CLOSURE_IDENTITY.json"), `${JSON.stringify(identity, null, 2)}\n`);

console.log("WWHN-237 / DISP-STK-237 — FE closure gate\n");
for (const c of checks) console.log(`  ${c.status} [${c.id}] ${c.detail}`);
console.log(`\n  identity → docs/evidence/WWHN-237/FE_CLOSURE_IDENTITY.json`);

if (failures.length > 0) {
  console.error(`\nFAIL (${failures.length}):`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`\nOK — ${checks.length} check pass.`);
