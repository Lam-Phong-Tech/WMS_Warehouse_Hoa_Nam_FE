#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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

for (const externalId of ["FE292-P1-01", "FE292-P1-03", "FE292-P1-04"]) {
  const state = String(items.get(externalId)?.closureState ?? "");
  if (!state.startsWith("BLOCKED_EXTERNAL")) {
    fail(`${externalId} must remain external/fail-closed until independent evidence exists`);
  }
}

if (register.overallStatus?.crossRoleAcceptance !== "BLOCKED_EXTERNAL") {
  fail("Cross-role acceptance must remain BLOCKED_EXTERNAL in source evidence");
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
const PROTECTED_ROUTES = [
  "/system/users",
  "/master-data/skus",
  "/master-data/catalog",
  "/master-data/warehouse",
  "/master-data/agencies",
  "/master-data/defects",
  "/inbound",
  "/putaway",
  "/outbound",
  "/warranty",
  "/reverse",
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

console.log(
  "[WWHN-292] PASS: task-specific source controls are present; independent UAT/backend gates remain explicitly fail-closed.",
);
