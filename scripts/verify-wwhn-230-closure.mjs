#!/usr/bin/env node
/**
 * WWHN-230 closure gate, FE half — DISP-STK-230 (park/de-scope Stocktake).
 *
 * The BE gate proves the API/schema surface is absent. This one proves the FE surface is
 * absent, that the governance register records the disposition without over-claiming an
 * approval WWHN-25 has not granted, and that the wireframe baseline still corroborates the
 * rule. It also pins the exact FE + BE identity so QA1 can reproduce WWHN-232 evidence.
 *
 * Usage:
 *   npm run wwhn-230:verify
 *   npm run wwhn-230:verify -- --require-signoff
 *   npm run wwhn-230:verify -- --with-tests
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const beRoot = resolve(root, "../../HoaNam_BE/WMS_Warehouse_Hoa_Nam_BE");
const argv = new Set(process.argv.slice(2));
const requireSignoff = argv.has("--require-signoff");
const withTests = argv.has("--with-tests");

const FORBIDDEN_FRAGMENTS = ["stocktake", "stock-take", "apply-adjustment"];

const failures = [];
const checks = [];

function record(id, ok, detail) {
  checks.push({ id, status: ok ? "PASS" : "FAIL", detail });
  if (!ok) failures.push(`${id}: ${detail}`);
}

function readText(relativePath, base = root) {
  const full = join(base, relativePath);
  return existsSync(full) ? readFileSync(full, "utf8") : null;
}

function readJson(relativePath, base = root) {
  const text = readText(relativePath, base);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    failures.push(`${relativePath} is not valid JSON: ${error.message}`);
    return null;
  }
}

function sha256(relativePath, base = root) {
  const full = join(base, relativePath);
  return existsSync(full)
    ? createHash("sha256").update(readFileSync(full)).digest("hex")
    : null;
}

function git(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 1. Governance register carries the disposition, and claims nothing more
// ---------------------------------------------------------------------------

const GOVERNANCE = "docs/api-evidence/STOCKTAKE_GOVERNANCE_STATUS.json";
const DISPOSITION = "docs/api-evidence/WWHN-230_SCOPE_DISPOSITION.json";

// The shared register owns the *authority* (REQ-SRS-037, the WWHN-25 gate). The
// WWHN-230 disposition owns its own file: the Stocktake branches WWHN-230/233/236/237
// are worked in parallel, and a single shared `scopeDisposition` key means whichever
// branch writes last silently erases the others.
const disposition = readJson(DISPOSITION);
record("GOV-DISPOSITION", disposition !== null, `${DISPOSITION} must exist.`);

if (disposition) {
  record("GOV-DISP-ID", disposition.id === "DISP-STK-230", "disposition.id must be DISP-STK-230.");
  record("GOV-DISP-OPTION", disposition.optionChosen === "B", "disposition.optionChosen must be \"B\".");
  record(
    "GOV-DISP-REQUIREMENT",
    disposition.controllingRequirement === "REQ-SRS-037",
    "disposition.controllingRequirement must be REQ-SRS-037."
  );
  record(
    "GOV-DISP-SCOPE",
    ["WWHN-230", "WWHN-58", "WWHN-232"].every((issue) => (disposition.impactedIssues ?? []).includes(issue)),
    "disposition.impactedIssues must cover WWHN-230, WWHN-58 and WWHN-232."
  );
  record(
    "GOV-DISP-NOT-SELF-CLOSED",
    disposition.status === "APPROVED" ? Boolean(disposition.effectiveDate) : disposition.effectiveDate === null,
    "A disposition may not carry an effective date before it is approved, nor claim APPROVED without one."
  );
}

const governance = readJson(GOVERNANCE);
record("GOV-EXISTS", governance !== null, `${GOVERNANCE} must exist.`);

if (governance) {
  const gate = governance.decisionRecordGate ?? {};
  record(
    "GOV-NO-FALSE-DECISION",
    !gate.approvedStandaloneDecisionId || Boolean(gate.approvedArtifactHash),
    "The register claims an approved standalone Decision ID without an artifact hash."
  );
  record(
    "GOV-REQUIREMENT",
    governance.ruleAuthority?.controllingRequirement?.id === "REQ-SRS-037",
    "The controlling requirement must stay REQ-SRS-037."
  );
}

// ---------------------------------------------------------------------------
// 2. The guard must not outlive its baselines
// ---------------------------------------------------------------------------

const srs = readText("docs/HN_SRS_FRD_v1.12_FULL.md");
record("BASELINE-SRS", srs !== null && srs.includes("REQ-SRS-037"), "SRS baseline must still contain REQ-SRS-037.");
if (srs) {
  record(
    "BASELINE-SRS-TEXT",
    srs.includes("Không expose Stocktake/Variance"),
    "SRS no longer states the no-Stocktake requirement; re-review before enforcing it."
  );
}

const erd = readText("docs/HoaNam_ERD_Moi_Nhat.md");
record(
  "BASELINE-ERD",
  erd !== null && erd.includes("Không tạo Stocktake_Session"),
  "ERD section 0.1 no longer excludes Stocktake entities."
);

const wireframe = readText("docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html");
record("BASELINE-WIREFRAME-PRESENT", wireframe !== null, "Aligned wireframe baseline is missing.");
if (wireframe) {
  const lower = wireframe.toLowerCase();
  const hits = ["stocktake", "kiểm kê"].filter((needle) => lower.includes(needle));
  record("BASELINE-WIREFRAME-CLEAN", hits.length === 0, `Wireframe now shows a Stocktake surface: ${hits.join(", ")}`);
}

// ---------------------------------------------------------------------------
// 3. FE runtime surface is absent
// ---------------------------------------------------------------------------

for (const [id, path] of [
  ["SURFACE-ROUTES", "src/shared/constants/routes.ts"],
  ["SURFACE-PERMISSIONS", "src/shared/constants/wms-permissions.ts"],
  ["SURFACE-ENDPOINTS", "src/shared/api/endpoints.ts"],
]) {
  const source = readText(path);
  if (source === null) {
    record(id, false, `${path} is missing.`);
    continue;
  }

  // Comments are allowed to name the rule; declarations are not.
  const declarations = source
    .split(/\r?\n/u)
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/u.test(line))
    .join("\n")
    .toLowerCase();

  const hits = FORBIDDEN_FRAGMENTS.filter((fragment) => declarations.includes(fragment));
  record(id, hits.length === 0, `${path} declares a forbidden surface: ${hits.join(", ")}`);
}

const offendingFiles = [];
const stack = [join(root, "src")];
while (stack.length > 0) {
  const current = stack.pop();
  for (const entry of readdirSync(current)) {
    const entryPath = join(current, entry);
    if (statSync(entryPath).isDirectory()) {
      stack.push(entryPath);
      continue;
    }
    const name = entry.toLowerCase();
    if (!/\.(ts|tsx)$/u.test(name) || name.includes("wwhn-230")) continue;
    if (FORBIDDEN_FRAGMENTS.some((fragment) => name.includes(fragment))) {
      offendingFiles.push(relative(root, entryPath).split("\\").join("/"));
    }
  }
}
record("SURFACE-MODULES", offendingFiles.length === 0, `Stocktake source files found: ${offendingFiles.join(", ")}`);

// ---------------------------------------------------------------------------
// 4. Cross-repo consistency with the BE disposition record
// ---------------------------------------------------------------------------

const beReachable = existsSync(beRoot);
const APPROVAL = "docs/decision-records/DISP-STK-230-APPROVAL.json";
let approval = null;

if (!beReachable) {
  checks.push({
    id: "BE-RECORD",
    status: "PENDING",
    detail: "BE checkout is not reachable from this path; run the BE gate separately.",
  });
} else {
  const record230 = readText("docs/decision-records/DISP-STK-230-scope-disposition.md", beRoot);
  record("BE-RECORD", record230 !== null, "BE disposition record DISP-STK-230 is missing.");

  approval = readJson(APPROVAL, beRoot);
  record("BE-APPROVAL", approval !== null, "BE approval record DISP-STK-230-APPROVAL.json is missing.");
  if (approval) {
    record(
      "BE-APPROVAL-CONSISTENT",
      approval.optionChosen === (disposition?.optionChosen ?? null),
      "FE disposition file and BE approval record disagree on the chosen option."
    );
  }
}

if (requireSignoff) {
  if (!approval) {
    record("SIGNOFF", false, "Cannot enforce sign-off without the BE approval record.");
  } else {
    const missing = Object.entries(approval.signOff ?? {})
      .filter(([, value]) => !value.decision || !value.date || !value.commentUrl)
      .map(([key]) => key);
    record("SIGNOFF", missing.length === 0, `Missing recorded sign-off for: ${missing.join(", ") || "none"}`);
    record(
      "SIGNOFF-SHA",
      Boolean(approval.exactCommitSha?.frontend) && Boolean(approval.exactCommitSha?.backend),
      "exactCommitSha must be pinned for both repositories at sign-off time."
    );
  }
} else if (approval) {
  const missing = Object.entries(approval.signOff ?? {})
    .filter(([, value]) => !value.decision || !value.date || !value.commentUrl)
    .map(([key]) => key);
  checks.push({
    id: "SIGNOFF",
    status: missing.length === 0 ? "PASS" : "PENDING",
    detail: `Sign-off still open for: ${missing.join(", ") || "none"} (run with --require-signoff to enforce).`,
  });
}

// ---------------------------------------------------------------------------
// 5. Optional vitest lock
// ---------------------------------------------------------------------------

let testResult = null;
if (withTests) {
  try {
    // Spawn vitest's entrypoint through the current node binary. `npx.cmd` fails with
    // EINVAL under execFileSync on Windows, and a `.bin` shim would need a shell.
    const output = execFileSync(
      process.execPath,
      [join(root, "node_modules/vitest/vitest.mjs"), "run", "src/test/wwhn-230-stocktake-scope-guard.test.ts"],
      { cwd: root, encoding: "utf8" }
    );
    testResult = { exitCode: 0, tail: output.trim().split("\n").slice(-4).join("\n") };
    record("TEST-LOCK", true, "wwhn-230-stocktake-scope-guard passed.");
  } catch (error) {
    testResult = {
      exitCode: error.status ?? 1,
      tail: String(error.stdout ?? error.message).trim().split("\n").slice(-6).join("\n"),
    };
    record("TEST-LOCK", false, `wwhn-230-stocktake-scope-guard failed:\n${testResult.tail}`);
  }
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

const evidence = {
  schemaVersion: "1.0.0",
  jira: "WWHN-230",
  disposition: "DISP-STK-230",
  side: "frontend",
  backlogItems: ["DEV230-P1-01", "DEV230-P1-02", "DEV230-P1-03", "DEV230-P1-04"],
  mode: requireSignoff ? "final" : "pre-signoff",
  identity: {
    frontend: {
      repository: "Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE",
      branch: git(["rev-parse", "--abbrev-ref", "HEAD"], root),
      commitSha: git(["rev-parse", "HEAD"], root),
      workingTreeClean: git(["status", "--porcelain"], root) === "",
    },
    backend: beReachable
      ? {
          repository: "Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_BE",
          branch: git(["rev-parse", "--abbrev-ref", "HEAD"], beRoot),
          commitSha: git(["rev-parse", "HEAD"], beRoot),
          workingTreeClean: git(["status", "--porcelain"], beRoot) === "",
        }
      : { note: "BE checkout not reachable from this path." },
  },
  baselineDigests: {
    "docs/HN_SRS_FRD_v1.12_FULL.md": sha256("docs/HN_SRS_FRD_v1.12_FULL.md"),
    "docs/HoaNam_ERD_Moi_Nhat.md": sha256("docs/HoaNam_ERD_Moi_Nhat.md"),
    "docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html": sha256(
      "docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html"
    ),
    [GOVERNANCE]: sha256(GOVERNANCE),
    [DISPOSITION]: sha256(DISPOSITION),
  },
  checks,
  testResult,
  result: failures.length === 0 ? "PASS" : "FAIL",
  failures,
};

const evidenceDir = join(root, "docs/evidence/WWHN-230");
mkdirSync(evidenceDir, { recursive: true });
writeFileSync(join(evidenceDir, "FE_CLOSURE_EVIDENCE.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

const sums = readdirSync(evidenceDir)
  .filter((file) => file !== "SHA256SUMS")
  .sort()
  .map((file) => `${createHash("sha256").update(readFileSync(join(evidenceDir, file))).digest("hex")}  ${file}`)
  .join("\n");
writeFileSync(join(evidenceDir, "SHA256SUMS"), `${sums}\n`, "utf8");

for (const check of checks) {
  const mark = check.status === "PASS" ? "PASS" : check.status === "PENDING" ? "PEND" : "FAIL";
  console.log(`[${mark}] ${check.id}${check.status === "PASS" ? "" : ` — ${check.detail}`}`);
}
console.log(`\nEvidence: docs/evidence/WWHN-230/FE_CLOSURE_EVIDENCE.json`);

if (failures.length > 0) {
  console.error(`\nWWHN-230 FE closure gate FAILED (${failures.length}).`);
  process.exit(1);
}
console.log("\nWWHN-230 FE closure gate PASSED.");
