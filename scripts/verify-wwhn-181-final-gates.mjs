#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PINNED = Object.freeze({
  task: "WWHN-181",
  beSha: "fc534ed8c00dadd91ce60e7bac5a8660dda74d08",
  contractVersion: "1.7.0",
  beReleaseManifestSha256:
    "ba8bc5841b5865095e51d21064ead90ad4c37129ee28142a3f507b497ddcc776",
});

const args = process.argv.slice(2);
const requireFinal = args.includes("--require-final");
const evidenceArg = args.find((arg) => !arg.startsWith("--"));
const evidencePath = path.resolve(
  evidenceArg ??
    process.env.WWHN_181_FINAL_EVIDENCE ??
    "docs/evidence/WWHN-181/FINAL_GATE_EVIDENCE.json",
);

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function isSha(value, length = 40) {
  return typeof value === "string" && new RegExp(`^[a-f0-9]{${length}}$`).test(value);
}

function sameIdentity(node, identity) {
  return (
    node &&
    node.fe_sha === identity.fe_sha &&
    node.be_sha === identity.be_sha &&
    node.manifest_digest === identity.manifest_digest
  );
}

function pass(value) {
  return String(value ?? "").toUpperCase() === "PASS";
}

function add(checks, id, ok, detail) {
  checks.push({ id, pass: Boolean(ok), detail });
}

let evidence;
let raw;
try {
  raw = fs.readFileSync(evidencePath);
  evidence = JSON.parse(raw.toString("utf8"));
} catch (error) {
  const result = {
    task: PINNED.task,
    final_allowed: false,
    reason: `Cannot read final evidence: ${error instanceof Error ? error.message : String(error)}`,
    evidence_path: evidencePath,
  };
  console.error(JSON.stringify(result, null, 2));
  if (requireFinal) process.exit(1);
  process.exit(0);
}

const identity = evidence.identity ?? {};
const checks = [];
add(checks, "IDENTITY-FE-SHA", isSha(identity.fe_sha), identity.fe_sha);
add(checks, "IDENTITY-BE-SHA", identity.be_sha === PINNED.beSha, identity.be_sha);
add(
  checks,
  "IDENTITY-CONTRACT",
  identity.contract_version === PINNED.contractVersion,
  identity.contract_version,
);
add(
  checks,
  "IDENTITY-BE-MANIFEST",
  identity.be_release_manifest_sha256 === PINNED.beReleaseManifestSha256,
  identity.be_release_manifest_sha256,
);
add(
  checks,
  "IDENTITY-MANIFEST-DIGEST",
  isSha(identity.manifest_digest, 64),
  identity.manifest_digest,
);
add(
  checks,
  "IDENTITY-ARTIFACT-NAME",
  identity.artifact_name === `wwhn-181-exact-sha-evidence-${identity.fe_sha}`,
  identity.artifact_name,
);

const ci = evidence.ci ?? {};
add(checks, "CI-SAME-IDENTITY", sameIdentity(ci, identity), ci);
add(checks, "CI-PASS", pass(ci.result), ci.result);
add(checks, "CI-SHA256SUMS-PASS", pass(ci.sha256sums_verify), ci.sha256sums_verify);
add(
  checks,
  "CI-ARTIFACT-NAME",
  ci.artifact_name === identity.artifact_name,
  ci.artifact_name,
);
add(
  checks,
  "CI-ARTIFACT-DIGEST",
  isSha(ci.artifact_digest, 64),
  ci.artifact_digest,
);
add(
  checks,
  "CI-URL",
  typeof ci.url === "string" && /^https:\/\/github\.com\//.test(ci.url),
  ci.url,
);

const gates = evidence.gates ?? {};
const contract = gates.WWHN_180 ?? {};
add(checks, "WWHN-180-SAME-IDENTITY", sameIdentity(contract, identity), contract);
add(checks, "WWHN-180-PASS", pass(contract.result), contract.result);
add(
  checks,
  "WWHN-180-INDEPENDENT-REVIEWER",
  typeof contract.reviewer_account === "string" &&
    contract.reviewer_account.length > 0 &&
    typeof contract.publisher_account === "string" &&
    contract.publisher_account.length > 0 &&
    contract.reviewer_account !== contract.publisher_account,
  {
    reviewer_account: contract.reviewer_account,
    publisher_account: contract.publisher_account,
  },
);
add(
  checks,
  "WWHN-180-EVIDENCE-URL",
  typeof contract.evidence_url === "string" && contract.evidence_url.length > 0,
  contract.evidence_url,
);

const qa2 = gates.WWHN_182 ?? {};
add(checks, "WWHN-182-SAME-IDENTITY", sameIdentity(qa2, identity), qa2);
add(checks, "WWHN-182-PASS", pass(qa2.result), qa2.result);
for (const proof of [
  "happy",
  "negative",
  "rbac_403",
  "data_scope",
  "idempotency_replay",
  "idempotency_conflict",
  "race",
  "db_before_after",
  "reconcile_zero_mismatch",
]) {
  add(checks, `WWHN-182-${proof.toUpperCase()}`, pass(qa2.proof?.[proof]), qa2.proof?.[proof]);
}
add(
  checks,
  "WWHN-182-EVIDENCE-URL",
  typeof qa2.evidence_url === "string" && qa2.evidence_url.length > 0,
  qa2.evidence_url,
);

const ba = gates.WWHN_183 ?? {};
add(checks, "WWHN-183-SAME-IDENTITY", sameIdentity(ba, identity), ba);
add(checks, "WWHN-183-GO", String(ba.decision ?? "").toUpperCase() === "GO", ba.decision);
add(checks, "WWHN-183-P0-ZERO", Number(ba.open_p0) === 0, ba.open_p0);
add(checks, "WWHN-183-P1-ZERO", Number(ba.open_p1) === 0, ba.open_p1);
add(
  checks,
  "WWHN-183-EVIDENCE-URL",
  typeof ba.evidence_url === "string" && ba.evidence_url.length > 0,
  ba.evidence_url,
);

const ui = gates.runtime_ui ?? {};
add(checks, "RUNTIME-UI-SAME-IDENTITY", sameIdentity(ui, identity), ui);
add(checks, "RUNTIME-UI-PASS", pass(ui.result), ui.result);
add(
  checks,
  "RUNTIME-UI-REAL-API-ERROR",
  pass(ui.real_api_error_with_request_id),
  ui.real_api_error_with_request_id,
);
add(checks, "RUNTIME-UI-RESPONSIVE", pass(ui.responsive_matrix), ui.responsive_matrix);
add(checks, "RUNTIME-UI-HAR-SANITIZED", pass(ui.sanitized_har), ui.sanitized_har);
add(
  checks,
  "RUNTIME-UI-EVIDENCE-URL",
  typeof ui.evidence_url === "string" && ui.evidence_url.length > 0,
  ui.evidence_url,
);

const failed = checks.filter((check) => !check.pass);
const evaluation = {
  schema_version: "1.0.0",
  task: PINNED.task,
  evaluated_at: new Date().toISOString(),
  evidence_path: path.relative(process.cwd(), evidencePath).replaceAll("\\", "/"),
  evidence_sha256: sha256(raw),
  pinned: PINNED,
  identity,
  final_allowed: failed.length === 0,
  failed_check_ids: failed.map((check) => check.id),
  checks,
};

const outputDir = path.dirname(evidencePath);
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, "FINAL_GATE_EVALUATION.json");
fs.writeFileSync(outputPath, `${JSON.stringify(evaluation, null, 2)}\n`);
console.log(JSON.stringify(evaluation, null, 2));
console.log(`WWHN-181 final gate evaluation: ${evaluation.final_allowed ? "PASS" : "BLOCKED"}`);
console.log(`Output: ${outputPath}`);

if (requireFinal && !evaluation.final_allowed) process.exit(1);
