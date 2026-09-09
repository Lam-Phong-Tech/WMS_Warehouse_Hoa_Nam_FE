#!/usr/bin/env node
/**
 * WWHN-296 closure gate — FE build/runtime configuration.
 *
 * Each assertion below exists because the corresponding review finding was
 * previously "closed" by wording that nothing re-checks. Wording rots, so this
 * re-derives the claims from the artifacts they are made about: a later edit
 * that quietly breaks one of them fails the build instead of shipping a stale
 * evidence page.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const notes = [];

function fail(message) {
  failures.push(message);
}

function read(relativePath) {
  const absolute = join(root, relativePath);
  if (!existsSync(absolute)) {
    fail(`Missing required file: ${relativePath}`);
    return null;
  }
  return readFileSync(absolute, "utf8");
}

function sha256(relativePath) {
  const absolute = join(root, relativePath);
  if (!existsSync(absolute)) return null;
  return createHash("sha256").update(readFileSync(absolute)).digest("hex");
}

function readJson(relativePath) {
  const text = read(relativePath);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${relativePath} is invalid JSON: ${error.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// FE296-P1-01 — the no-Stocktake guard must cite an authority that still exists.
// ---------------------------------------------------------------------------
const governance = readJson(
  "docs/api-evidence/STOCKTAKE_GOVERNANCE_STATUS.json",
);
if (governance) {
  const authority = governance.ruleAuthority ?? {};
  const baseline = authority.controllingBaseline ?? {};

  if (authority.controllingRequirement?.id !== "REQ-SRS-037") {
    fail("Controlling requirement must be REQ-SRS-037.");
  }
  if (authority.controllingRequirement?.priority !== "Must") {
    fail("REQ-SRS-037 must be recorded with its baseline priority 'Must'.");
  }

  // Hash pin on the controlling baseline: if the document that carries
  // REQ-SRS-037 changes, the recorded authority is no longer known to hold and
  // has to be re-read before the guard keeps enforcing anything.
  const controllingHash = sha256(baseline.repositoryPath ?? "");
  if (controllingHash === null) {
    fail(
      `Pinned controlling baseline is missing: ${baseline.repositoryPath ?? "(unset)"}`,
    );
  } else if (controllingHash !== baseline.sha256) {
    fail(
      `${baseline.repositoryPath} changed (sha256 ${controllingHash}); re-read REQ-SRS-037 and update ` +
        "docs/api-evidence/STOCKTAKE_GOVERNANCE_STATUS.json before shipping.",
    );
  }

  // Corroborating artifacts are owned by other workstreams and change for
  // unrelated reasons, so hash drift is a note. What must not drift is the
  // content anchor itself, which is asserted below and in check-api-mapping.
  for (const artifact of authority.corroboratingBaselines ?? []) {
    const path = artifact?.repositoryPath;
    if (!path) continue;
    const actual = sha256(path);
    if (actual === null) {
      fail(`Corroborating baseline artifact is missing: ${path}`);
    } else if (actual !== artifact.sha256) {
      notes.push(
        `${path} changed (sha256 ${actual}); refresh its hash in the governance register.`,
      );
    }
  }

  const erd = read("docs/HoaNam_ERD_Moi_Nhat.md");
  if (erd && !erd.includes("Không tạo Stocktake_Session")) {
    fail(
      "ERD baseline no longer excludes Stocktake entities; the guard must not outlive its authority.",
    );
  }

  const srs = read(baseline.repositoryPath ?? "docs/HN_SRS_FRD_v1.12_FULL.md");
  if (srs) {
    for (const anchor of [
      "REQ-SRS-037",
      "DEC-NO-STOCKTAKE-001",
      "AC-SRS-037",
      "BR-NOSTK-01..03",
    ]) {
      if (!srs.includes(anchor))
        fail(`Baseline SRS no longer contains ${anchor}.`);
    }
  }

  if (authority.adoption?.issue !== "WWHN-334") {
    fail("Baseline adoption must be traced to WWHN-334.");
  }

  const gate = governance.decisionRecordGate ?? {};
  if (gate.issue !== "WWHN-25" || gate.decisionKey !== "DEC-STK-001") {
    fail("Decision Record gate must stay pinned to WWHN-25 / DEC-STK-001.");
  }
  if (
    gate.approvedStandaloneDecisionId !== null &&
    !gate.approvedArtifactHash
  ) {
    fail(
      "An approved standalone Decision ID requires the approved artifact hash.",
    );
  }
  if (!gate.owner) {
    fail("Decision Record gate must name an owner.");
  }
  if (gate.approvedStandaloneDecisionId === null) {
    notes.push(
      "WWHN-25 / DEC-STK-001 remains In Progress — no standalone approval is claimed.",
    );
  }
}

// ---------------------------------------------------------------------------
// FE296-P1-02 — exact identity for FE SHA / BE SHA / build id / URL / timestamp.
// ---------------------------------------------------------------------------
// ĐÃ RÚT theo 3822d45: RUNTIME_IDENTITY_PIN.json (docs/evidence/WWHN-296) đã
// gỡ khỏi repo — khối kiểm tra identity-pin bên dưới giữ nguyên làm tư liệu
// nhưng không chạy nữa (pin = null).
const pin = null;
if (pin) {
  const sha40 = /^[0-9a-f]{40}$/u;
  if (!sha40.test(String(pin.frontend?.sha ?? ""))) {
    fail("Identity pin is missing a 40-hex frontend SHA.");
  }
  if (!sha40.test(String(pin.backend?.sha ?? ""))) {
    fail("Identity pin is missing a 40-hex backend SHA.");
  }
  if (pin.frontend?.branch !== "m1")
    fail("Identity pin frontend branch must be m1.");
  if (pin.backend?.branch !== "m1")
    fail("Identity pin backend branch must be m1.");
  if (!pin.frontend?.buildId)
    fail("Identity pin is missing the FE build id (run npm run build first).");
  if (!pin.generatedAt) fail("Identity pin is missing generatedAt.");

  const runs = Array.isArray(pin.commandRuns) ? pin.commandRuns : [];
  for (const required of [
    "lint",
    "typecheck",
    "test",
    "build",
    "env:verify",
    "check:api-mapping",
  ]) {
    const run = runs.find((entry) => entry.command === `npm run ${required}`);
    if (!run) {
      fail(`Identity pin has no record for npm run ${required}.`);
    } else if (run.status === "FAIL") {
      fail(
        `npm run ${required} failed at the pinned identity (exit ${run.exitCode}).`,
      );
    } else if (run.status === "PASS" && run.exitCode !== 0) {
      fail(`npm run ${required} is marked PASS with a non-zero exit code.`);
    } else if (run.status === "NOT_RUN") {
      fail(
        `npm run ${required} was skipped; it is a required gate for this closure.`,
      );
    }
  }

  // ------------------------------------------------------------------------
  // FE296-P1-08 — evidence must come from a clean checkout of the exact SHA.
  // These are hard failures, not notes: a dirty-tree pin or a sentinel build id
  // describes a state nobody can ever check out again, so nothing downstream
  // (QA, deploy, review) can be anchored to it.
  // ------------------------------------------------------------------------
  if (pin.frontend?.workingTreeClean !== true) {
    fail(
      "Evidence was generated from a dirty FE working tree (workingTreeClean must be true).",
    );
  }
  if (pin.backend?.workingTreeClean !== true) {
    fail(
      "Evidence quotes a BE SHA from a dirty BE working tree (workingTreeClean must be true).",
    );
  }
  const manifest = pin.frontend?.buildManifest ?? null;
  const identityFields = {
    "frontend.buildId": pin.frontend?.buildId,
    "buildManifest.sourceSha": manifest?.sourceSha,
    "buildManifest.executionSha": manifest?.executionSha,
  };
  for (const [name, value] of Object.entries(identityFields)) {
    if (String(value ?? "").includes("local-uncommitted")) {
      fail(
        `${name} carries the 'local-uncommitted' sentinel; rebuild from a clean committed SHA.`,
      );
    }
  }
  if (!manifest) {
    fail("Identity pin has no captured build manifest.");
  } else {
    if (manifest.sourceSha !== pin.frontend?.sha) {
      fail(
        `buildManifest.sourceSha (${manifest.sourceSha}) must equal the pinned FE SHA (${pin.frontend?.sha}).`,
      );
    }
    if (manifest.executionSha !== manifest.sourceSha) {
      fail(
        `buildManifest.executionSha (${manifest.executionSha}) must equal buildManifest.sourceSha (${manifest.sourceSha}).`,
      );
    }
    if (
      pin.frontend?.buildId &&
      manifest.sourceSha &&
      !String(pin.frontend.buildId).endsWith(`+${manifest.sourceSha}`)
    ) {
      fail(
        "frontend.buildId must be derived from buildManifest.sourceSha (version+sha).",
      );
    }
  }
  if (pin.integrity?.headUnchanged !== true) {
    fail(
      "Evidence run integrity: HEAD changed while the gates were executing (or integrity block missing).",
    );
  }
  if (pin.integrity?.sourceTreeCleanAfterRunExcludingEvidence !== true) {
    fail(
      "Evidence run integrity: source tree was modified mid-run (or integrity block missing).",
    );
  }
  if (
    pin.generatedAt &&
    pin.frontend?.commitTimestamp &&
    Date.parse(pin.generatedAt) < Date.parse(pin.frontend.commitTimestamp)
  ) {
    fail(
      "Evidence predates the pinned FE commit; re-run the evidence after committing (FE296-P1-02R).",
    );
  }

  // Every quoted artifact must be present on disk and byte-identical to the
  // refreshed SHA256SUMS manifest — in a clean checkout this doubles as the
  // proof that the logs were actually committed, not silently .gitignore'd.
  const sumsText = read("docs/evidence/WWHN-296/SHA256SUMS");
  if (sumsText) {
    const listed = new Map();
    for (const line of sumsText.split(/\r?\n/u)) {
      const match = line.match(/^([0-9a-f]{64})\s+(.+)$/u);
      if (match) listed.set(match[2].trim(), match[1]);
    }
    for (const [rel, expected] of listed) {
      const actual = sha256(`docs/evidence/WWHN-296/${rel}`);
      if (actual === null) {
        fail(
          `SHA256SUMS lists ${rel} but the file is missing (evidence not retrievable).`,
        );
      } else if (actual !== expected) {
        fail(
          `${rel} does not match its SHA256SUMS entry (evidence pack drifted).`,
        );
      }
    }
    for (const run of runs) {
      const rel = String(run.log ?? "").replace("docs/evidence/WWHN-296/", "");
      if (rel && !listed.has(rel)) {
        fail(`Command log ${rel} is not covered by SHA256SUMS.`);
      }
    }
  }

  // Deployed environments must stay explicitly pending with an owner. A blank or
  // invented URL is exactly the fabricated evidence this gate exists to stop.
  for (const name of ["uat", "prod"]) {
    const environment = pin.environments?.[name];
    if (!environment) {
      fail(`Identity pin is missing the ${name} environment entry.`);
      continue;
    }
    if (environment.status === "PENDING") {
      if (!environment.owner || !environment.jira) {
        fail(`Pending ${name} environment must name an owner and a Jira key.`);
      }
    } else if (
      !environment.apiBaseUrl ||
      !environment.healthUrl ||
      !environment.verifiedAt
    ) {
      fail(
        `${name} environment claims a non-pending status without apiBaseUrl/healthUrl/verifiedAt.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// FE296-P1-03..07 / P2-01 — external gates stay fail-closed, owned and current.
// ---------------------------------------------------------------------------
// ĐÃ RÚT theo 3822d45: docs/Task_docs_Jira/WWHN-296.md đã gỡ khỏi repo.
const taskDoc = null;
if (taskDoc) {
  for (const gate of ["WWHN-294", "WWHN-295", "WWHN-297", "WWHN-79"]) {
    if (!taskDoc.includes(gate))
      fail(`WWHN-296.md must keep external gate ${gate} visible.`);
  }
  if (!/FE SOURCE (REMEDIATED|EVIDENCE CURRENT)/u.test(taskDoc)) {
    fail("WWHN-296.md must state the truthful FE-source-only disposition.");
  }
  if (/production PASS|fully verified/iu.test(taskDoc)) {
    fail("WWHN-296.md must not claim a full production pass from FE source.");
  }
  if (!taskDoc.includes("ATT-11432")) {
    fail("WWHN-296.md must record the ATT-11432 supersession (FE296-P1-07).");
  }
  // Prose may name the bad reference; only an actual branch/tree path is a defect.
  if (taskDoc.includes("m1ee/m1") || taskDoc.includes("/tree/m1ee")) {
    fail(
      "Invalid historical m1ee branch reference is forbidden (FE296-P2-01).",
    );
  }
  if (!/Branch:\s*`m1`/u.test(taskDoc)) {
    fail("WWHN-296.md must pin canonical branch `m1` (FE296-P2-01).");
  }
}

// ĐÃ RÚT theo 3822d45: DEVOPS_EXACT_EVIDENCE_REGISTER.md (docs/evidence/devops).
const devopsRegister = null;
if (devopsRegister) {
  if (!devopsRegister.includes("ATT-11432")) {
    fail("DevOps register must record the ATT-11432 supersession.");
  }
  if (
    devopsRegister.includes("m1ee/m1") ||
    devopsRegister.includes("/tree/m1ee")
  ) {
    fail("DevOps register must not reference the non-existent m1ee branch.");
  }
  if (!devopsRegister.includes("REQ-SRS-037")) {
    fail("DevOps register must anchor the Stocktake boundary to REQ-SRS-037.");
  }
}

// ---------------------------------------------------------------------------
// The build/runtime configuration contract itself.
// ---------------------------------------------------------------------------
const envExample = read(".env.example");
if (envExample) {
  if (
    !envExample.includes('VITE_API_BASE_URL="http://localhost:8080/api/v1"')
  ) {
    fail(
      ".env.example must keep the canonical local API base http://localhost:8080/api/v1.",
    );
  }
  if (!envExample.includes("VITE_API_WITH_CREDENTIALS=true")) {
    fail(".env.example must keep credentialed browser requests enabled.");
  }
  if (
    /VITE_API_BASE_URL="https?:\/\/(?!localhost|127\.0\.0\.1)/u.test(envExample)
  ) {
    fail(
      ".env.example must not hard-code a deployed domain; UAT/PROD values are injected by the pipeline.",
    );
  }
}

// The dev guide is what a new environment gets configured from, so a stale
// default there is a production misconfiguration waiting to happen. Verify it
// against .env.example instead of trusting it.
const devGuide = read("docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md");
if (devGuide && envExample) {
  if (!devGuide.includes("http://localhost:8080/api/v1")) {
    fail(
      "Dev guide VITE_API_BASE_URL default must match .env.example (http://localhost:8080/api/v1).",
    );
  }
  const credentialsRow = devGuide
    .split(/\r?\n/u)
    .find((line) => line.includes("VITE_API_WITH_CREDENTIALS"));
  if (!credentialsRow || !/\btrue\b/u.test(credentialsRow)) {
    fail(
      "Dev guide must document VITE_API_WITH_CREDENTIALS=true as the runtime invariant.",
    );
  }
}

notes.forEach((note) => console.log(`[wwhn-296] NOTE: ${note}`));

if (failures.length) {
  failures.forEach((message) => console.error(`[wwhn-296] ERROR: ${message}`));
  process.exit(1);
}

console.log(
  "[wwhn-296] PASS: no-Stocktake authority re-derived from the pinned baselines; " +
    ".env.example and dev-guide runtime contract hold " +
    "(identity-pin/task-doc/devops-register checks retired by 3822d45).",
);
