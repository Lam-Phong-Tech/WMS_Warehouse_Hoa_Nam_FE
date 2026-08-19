#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const requireFinal = process.argv.includes("--require-final");

function fail(message) {
  console.error(`[WWHN-292] FAIL: ${message}`);
  process.exit(1);
}

function requireFile(path) {
  const absolute = join(root, path);
  if (!existsSync(absolute)) {
    fail(`Missing required task-specific artifact: ${path}`);
  }
  return readFileSync(absolute, "utf8");
}

function requireText(text, needle, context) {
  if (!text.includes(needle)) {
    fail(`${context} must contain ${JSON.stringify(needle)}`);
  }
}

const taskDocPath = "docs/Task_docs_Jira/WWHN-292.md";
const registerPath =
  "docs/evidence/wwhn-292/WWHN-292_CLOSURE_REGISTER.json";
const e2ePath = "e2e/wwhn-292-ui-responsive-rbac.spec.ts";
const workflowPath = ".github/workflows/wwhn-292-fe-closure.yml";

const taskDoc = requireFile(taskDocPath);
const registerText = requireFile(registerPath);
const e2e = requireFile(e2ePath);
const workflow = requireFile(workflowPath);
const packageJson = JSON.parse(requireFile("package.json"));

let register;
try {
  register = JSON.parse(registerText);
} catch (error) {
  fail(`Invalid JSON in ${registerPath}: ${error.message}`);
}

if (register.task !== "WWHN-292") {
  fail(`Closure register task must be WWHN-292, received ${register.task}`);
}
if (register.branch !== "m1") {
  fail(`Closure register branch must be m1, received ${register.branch}`);
}
if (register.evidencePolicy?.failClosed !== true) {
  fail("Closure register must keep failClosed=true");
}
if (register.evidencePolicy?.noSelfSignForIndependentRoles !== true) {
  fail("Independent roles must not be self-signed by FE");
}
if (register.evidencePolicy?.controlledEvidenceIsNotUat !== true) {
  fail("Controlled FE evidence must be explicitly distinct from UAT evidence");
}

const viewports = register.requiredViewports ?? [];
for (const viewport of ["1440x900", "768x1024", "375x812"]) {
  if (!viewports.includes(viewport)) {
    fail(`Required viewport ${viewport} is missing from the closure register`);
  }
  requireText(e2e, viewport.replace("x", ", height: "), e2ePath);
}

const items = new Map(
  (register.reviewItems ?? []).map((item) => [item.id, item]),
);
for (const id of [
  "FE292-P1-01",
  "FE292-P1-02",
  "FE292-P1-03",
  "FE292-P1-04",
  "FE292-P1-05",
  "FE292-P1-06",
  "FE292-P2-01",
  "FE292-P2-02",
  "FE292-P2-03",
]) {
  if (!items.has(id)) {
    fail(`Missing review item ${id}`);
  }
}

/**
 * R2 (review 80/100): the three previously external items may only leave
 * BLOCKED_EXTERNAL for the EXACT evidence-backed state below — and each state
 * is only lawful while its named evidence artifact actually exists. Any other
 * state, or a state without its artifact, fails the gate.
 */
const R2_CLOSED_STATES = {
  "FE292-P1-01": {
    state: "CLOSED_REAL_DEFECT_REGISTER_PUBLISHED",
    artifact: "docs/evidence/wwhn-292/WWHN-292_DEFECT_REGISTER.json",
  },
  "FE292-P1-03": {
    state: "CLOSED_QA2_LOCAL_RETEST",
    artifact: "docs/evidence/wwhn-292/QA2_RETEST_MATRIX.md",
    finalOnly: true,
  },
  "FE292-P1-04": {
    state: "CLOSED_BE_RUNTIME_EVIDENCE_LOCAL",
    artifact: "docs/evidence/wwhn-292/BE_AUTHZ_EVIDENCE_REF.md",
    finalOnly: true,
  },
};
for (const [externalId, contract] of Object.entries(R2_CLOSED_STATES)) {
  const state = String(items.get(externalId)?.closureState ?? "");
  const allowBlocked = state.startsWith("BLOCKED_EXTERNAL");
  if (state !== contract.state && !allowBlocked) {
    fail(
      `${externalId} closureState must be ${contract.state} (with evidence) or stay BLOCKED_EXTERNAL, received ${state}`,
    );
  }
  const artifactRequired =
    state === contract.state && (!contract.finalOnly || requireFinal);
  if (artifactRequired && !existsSync(join(root, contract.artifact))) {
    fail(
      `${externalId} claims ${contract.state} but evidence artifact ${contract.artifact} is missing`,
    );
  }
}

const acceptance = register.overallStatus?.crossRoleAcceptance;
if (
  acceptance !== "BLOCKED_EXTERNAL" &&
  acceptance !== "LOCAL_EVIDENCE_COMPLETE_UAT_ENV_PENDING"
) {
  fail(
    "Cross-role acceptance must be BLOCKED_EXTERNAL or LOCAL_EVIDENCE_COMPLETE_UAT_ENV_PENDING",
  );
}

for (const dependency of [
  "WWHN-76",
  "WWHN-286",
  "WWHN-287",
  "WWHN-288",
  "WWHN-293",
  "WWHN-20",
]) {
  requireText(taskDoc, dependency, taskDocPath);
}

for (const truthMarker of [
  "FE SOURCE REMEDIATED / EXTERNAL UAT GATES PENDING",
  "Controlled mocks validate FE behavior only",
  "Do not claim 100% project/UAT acceptance",
]) {
  requireText(taskDoc, truthMarker, taskDocPath);
}

if (taskDoc.includes("m1ee/m1") || taskDoc.includes("/tree/m1ee")) {
  fail("Invalid historical m1ee/m1 branch reference is forbidden");
}
if (taskDoc.includes("blob:")) {
  fail("Ephemeral blob: evidence URLs are forbidden in the WWHN-292 task artifact");
}

for (const metadataKey of [
  "sourceSha",
  "environment",
  "buildVersion",
  "browserProject",
  "role",
  "viewport",
  "timestamp",
  "evidenceClass: \"FE_CONTROLLED_NOT_UAT\"",
]) {
  requireText(e2e, metadataKey, e2ePath);
}

for (const requiredScript of ["wwhn-292:verify", "test:e2e:wwhn-292"]) {
  if (!packageJson.scripts?.[requiredScript]) {
    fail(`package.json is missing script ${requiredScript}`);
  }
}

for (const workflowMarker of [
  "npm run format:check",
  "npm run lint",
  "npm run typecheck",
  "npm run test",
  "npm run wwhn-292:verify",
  "npm run build",
  "npm run test:e2e:wwhn-292",
  "EXACT_GIT_SHA",
  "GITHUB_RUN_ID",
  "SHA256SUMS",
]) {
  requireText(workflow, workflowMarker, workflowPath);
}

/**
 * FE292-P1-06 — the responsive claim covers the authenticated shell, not only
 * /login, and it is pinned to the two documented sources: NFR-SRS-006 fixes the
 * desktop baseline at 1280px and the BA wireframe stacks the 300px aside at
 * 980px. Drift in either number must fail the gate rather than silently widen
 * the claim.
 */
const responsive = register.responsiveContract ?? {};
if (responsive.desktopBaselineMinWidth !== 1280) {
  fail("responsiveContract.desktopBaselineMinWidth must stay 1280 (NFR-SRS-006)");
}
if (responsive.wireframeStackBreakpoint !== 980) {
  fail("responsiveContract.wireframeStackBreakpoint must stay 980 (BA wireframe)");
}
if (responsive.desktopAsideWidth !== 300) {
  fail("responsiveContract.desktopAsideWidth must stay 300 (BA wireframe)");
}

for (const shellMarker of [
  "authenticated shell responsive",
  "WIREFRAME_STACK_BREAKPOINT",
  "DESKTOP_ASIDE_WIDTH",
  ".hn-mvp-aside",
  ".hn-mvp-main",
  "hasHorizontalOverflow",
  "primary-navigation",
]) {
  requireText(e2e, shellMarker, e2ePath);
}

/**
 * FE292-P2-03 — route fail-closed is a matrix, not a single sample, and it keeps
 * a positive control so an over-blocking guard cannot pass as a success.
 */
/**
 * WWHN-242 established REV-00 as a READ screen (SRS §3 grants V through
 * inventory.view; BE serves GET /reversal-documents with inventory.view), so
 * /reverse moved from the deny matrix to a second positive control and its
 * deny slot is IAM-02 (/system/roles). The matrix stays at 13 deny routes.
 */
const PROTECTED_ROUTES = [
  "/system/users",
  "/system/roles",
  "/master-data/skus",
  "/master-data/catalog",
  "/master-data/warehouse",
  "/master-data/agencies",
  "/master-data/defects",
  "/inbound",
  "/putaway",
  "/outbound",
  "/warranty",
  "/reports",
  "/audit-logs",
];
for (const route of PROTECTED_ROUTES) {
  requireText(e2e, `route: "${route}"`, e2ePath);
}
for (const rbacMarker of [
  "PROTECTED_ROUTE_MATRIX",
  "LIMITED_ROLE_PERMISSIONS",
  "fails closed for a limited role",
  "permitted route stays reachable for the same limited role",
  "reversal read screen stays reachable for inventory.view (WWHN-242 read semantic)",
  "/errors/403",
]) {
  requireText(e2e, rbacMarker, e2ePath);
}

for (const docMarker of [
  "FE292-P1-06",
  "FE292-P2-03",
  "NFR-SRS-006",
]) {
  requireText(taskDoc, docMarker, taskDocPath);
}

/**
 * FE292-P1-01 — the real defect register must exist, pin the CURRENT
 * controlling baseline (BRD v3.9 is HISTORICAL/SUPERSEDED per SRS L225) and
 * carry every required field on every row. An empty or partial row fails.
 */
const defectRegisterPath = "docs/evidence/wwhn-292/WWHN-292_DEFECT_REGISTER.json";
let defectRegister;
try {
  defectRegister = JSON.parse(requireFile(defectRegisterPath));
} catch (error) {
  fail(`Invalid JSON in ${defectRegisterPath}: ${error.message}`);
}
if (defectRegister.registerClass !== "REAL_DEFECT_REGISTER") {
  fail("Defect register must declare registerClass REAL_DEFECT_REGISTER");
}
if (defectRegister.closesReviewItem !== "FE292-P1-01") {
  fail("Defect register must close FE292-P1-01");
}
const baselineText = JSON.stringify(defectRegister.controllingBaseline ?? {});
for (const baselineMarker of [
  "SRS/FRD v1.12",
  "HISTORICAL / SUPERSEDED",
  "BRD v3.9",
  "SRS L225",
]) {
  if (!baselineText.includes(baselineMarker)) {
    fail(`Defect register controllingBaseline must pin ${JSON.stringify(baselineMarker)}`);
  }
}
const requiredDefectFields = defectRegister.requiredDefectFields ?? [];
if (requiredDefectFields.length < 14) {
  fail("Defect register must keep the 14 required defect fields");
}
const defects = defectRegister.defects ?? [];
if (defects.length < 6) {
  fail(`Defect register must keep all review-derived defects (found ${defects.length})`);
}
for (const defect of defects) {
  for (const field of requiredDefectFields) {
    const value = defect[field];
    const empty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "") ||
      (Array.isArray(value) && value.length === 0);
    if (empty) {
      fail(`Defect ${defect.defectId ?? "<unknown>"} is missing required field ${field}`);
    }
  }
  if (!defect.controllingSource) {
    fail(`Defect ${defect.defectId} must pin its controllingSource`);
  }
}

/**
 * FE292-P1-02 — the sign-off document may never ship template placeholders
 * again; the final identity is resolved through docs/evidence/wwhn-292/final/.
 */
const signoffPath = "docs/Task_docs_Jira/WWHN-292_SIGNOFF_COMMENTS.md";
const signoff = requireFile(signoffPath);
for (const placeholder of ["<EXACT_GIT_SHA>", "<GITHUB_RUN_ID>"]) {
  if (signoff.includes(placeholder)) {
    fail(`${signoffPath} still contains unresolved placeholder ${placeholder}`);
  }
}

/**
 * Final identity pack (--require-final): EXACT_GIT_SHA + LOCAL_RUN_ID +
 * CI_RUN_DISPOSITION + SHA256SUMS, every sum re-verified byte-for-byte, and the
 * QA2 evidence directory for that exact SHA must exist and be non-trivial.
 * Without --require-final the pack is optional (pre-candidate source gate), but
 * when present it is still validated strictly.
 */
const finalDir = join(root, "docs", "evidence", "wwhn-292", "final");
if (requireFinal && !existsSync(finalDir)) {
  fail("--require-final: docs/evidence/wwhn-292/final/ is missing");
}
if (existsSync(finalDir)) {
  const exactShaRaw = requireFile("docs/evidence/wwhn-292/final/EXACT_GIT_SHA").trim();
  if (!/^[0-9a-f]{40}$/.test(exactShaRaw)) {
    fail("final/EXACT_GIT_SHA must be a full 40-hex commit SHA");
  }
  const localRunId = requireFile("docs/evidence/wwhn-292/final/LOCAL_RUN_ID").trim();
  if (!/^WWHN-292-LOCAL-\d{8}T\d{6}Z-[A-Za-z0-9-]+$/.test(localRunId)) {
    fail("final/LOCAL_RUN_ID must match WWHN-292-LOCAL-<UTC timestamp>-<host>");
  }
  const ciDisposition = requireFile(
    "docs/evidence/wwhn-292/final/CI_RUN_DISPOSITION.md",
  );
  for (const marker of ["3000/3000", "DEFERRED", "no GITHUB_RUN_ID is claimed"]) {
    requireText(ciDisposition, marker, "final/CI_RUN_DISPOSITION.md");
  }
  const sumsText = requireFile("docs/evidence/wwhn-292/final/SHA256SUMS");
  const sumLines = sumsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (sumLines.length < 5) {
    fail("final/SHA256SUMS must cover the evidence pack (at least 5 entries)");
  }
  for (const line of sumLines) {
    const match = /^([0-9a-f]{64})\s+\*?(.+)$/.exec(line);
    if (!match) {
      fail(`final/SHA256SUMS has a malformed line: ${line}`);
    }
    const [, expectedHash, relPath] = match;
    const absolute = join(root, "docs", "evidence", "wwhn-292", relPath);
    if (!existsSync(absolute)) {
      fail(`final/SHA256SUMS references a missing file: ${relPath}`);
    }
    const actualHash = createHash("sha256")
      .update(readFileSync(absolute))
      .digest("hex");
    if (actualHash !== expectedHash) {
      fail(`SHA256 mismatch for ${relPath}: expected ${expectedHash}, got ${actualHash}`);
    }
  }
  const qa2Dir = join(root, "docs", "evidence", "wwhn-292", "qa2", exactShaRaw);
  if (!existsSync(qa2Dir)) {
    fail(`QA2 evidence directory qa2/${exactShaRaw}/ is missing for the pinned candidate`);
  }
  const qa2Files = readdirSync(qa2Dir);
  if (qa2Files.filter((name) => name.endsWith(".png")).length < 20) {
    fail("QA2 evidence must contain the full screenshot matrix (>=20 captures)");
  }
  const qa2Matrix = requireFile("docs/evidence/wwhn-292/QA2_RETEST_MATRIX.md");
  requireText(qa2Matrix, exactShaRaw, "QA2_RETEST_MATRIX.md");
  const beRef = requireFile("docs/evidence/wwhn-292/BE_AUTHZ_EVIDENCE_REF.md");
  for (const beMarker of ["request_id", "BE SHA", "401", "403"]) {
    requireText(beRef, beMarker, "BE_AUTHZ_EVIDENCE_REF.md");
  }
}

console.log(
  requireFinal
    ? "[WWHN-292] PASS (final): candidate identity, defect register, QA2 matrix and BE runtime evidence are all present and hash-verified."
    : "[WWHN-292] PASS: task-specific source controls are present; evidence-backed closure states are validated fail-closed.",
);
