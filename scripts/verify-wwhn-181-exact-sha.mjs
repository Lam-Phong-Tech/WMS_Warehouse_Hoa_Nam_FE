#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const PINNED = Object.freeze({
  task: "WWHN-181",
  contractVersion: "1.7.0",
  beSha: "fc534ed8c00dadd91ce60e7bac5a8660dda74d08",
  beParentSha: "04026757d679446b54e1e0c54ea18c3c0a0423ed",
  beObservedFeBaselineSha: "f6e137d01ed7afec5d30e8fecde6a2cc31bb7c8b",
  beReleaseManifestSha256:
    "ba8bc5841b5865095e51d21064ead90ad4c37129ee28142a3f507b497ddcc776",
  beReleaseManifestBlobSha: "a77557dcf5ccbd58d2f36a36bf6f660ee863e4f6",
  beReleasePackSha256:
    "a20b0d8d8a9145bceb2e797c51befa20d7da9e6439be512b39f72f3d8010cdb9",
  beRepositorySha256sumsSha256:
    "0f4dcd23ceb84e39799fae5cb3f112932e6260a34ccff63b1ab7c623c839cb36",
});

// This list represents current FE evidence sources. Historical Stocktake sources
// are intentionally absent after REQ-SRS-037 / DEC-NO-STOCKTAKE-001 removed that
// capability from MVP; correction evidence now comes from append-only Reversal.
const sourceFiles = [
  ".github/workflows/ci.yml",
  ".github/workflows/wwhn-181-signoff.yml",
  "package.json",
  "docs/Task_docs_Jira/WWHN-181.md",
  "docs/api-evidence/WMS_FE_CONTRACT_BASELINE.json",
  "docs/api-evidence/M1_API_MAPPING.md",
  "docs/evidence/WWHN-181/FINAL_GATE_EVIDENCE.template.json",
  "docs/evidence/WWHN-181/RUNTIME_EVIDENCE_CHECKLIST.md",
  "scripts/run-wwhn-153-runtime-evidence.mjs",
  "scripts/run-wwhn-181-runtime-ui-evidence.mjs",
  "scripts/verify-wms-contract-signoff.mjs",
  "scripts/verify-wwhn-181-exact-sha.mjs",
  "scripts/verify-wwhn-181-final-gates.mjs",
  "src/modules/receiving/services/receivingService.ts",
  "src/modules/receiving/types/index.ts",
  "src/modules/shipping/services/shippingService.ts",
  "src/modules/shipping/types/index.ts",
  "src/modules/reverse/services/reversalService.ts",
  "src/modules/warranty/services/warrantyService.ts",
  "src/shared/api/endpoints.ts",
  "src/shared/api/http.ts",
  "src/shared/api/wms-contract-signoff.ts",
  "src/shared/api/wms-contract.ts",
  "src/test/warranty-v17-fail-closed.test.ts",
  "src/test/wms-contract-signoff-guards.test.ts",
];

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function exactSha(value, label) {
  if (!/^[a-f0-9]{40}$/.test(value ?? "")) {
    throw new Error(
      `${label} must be an exact 40-hex commit SHA, received: ${value}`,
    );
  }
  return value;
}

function gitHead() {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
}

const requestedBeSha =
  process.argv[2] ?? process.env.WWHN_181_BE_SHA ?? PINNED.beSha;
const beSha = exactSha(requestedBeSha, "BE SHA");
if (beSha !== PINNED.beSha) {
  throw new Error(
    `WWHN-181 is pinned to BE ${PINNED.beSha}; received ${beSha}. A superseding contract requires an explicit FE source review before changing the pin.`,
  );
}
const feSha = exactSha(
  process.env.WMS_SOURCE_SHA ?? process.env.GITHUB_SHA ?? gitHead(),
  "FE SHA",
);
const actualHead = gitHead();
if (process.env.GITHUB_ACTIONS === "true" && actualHead !== feSha) {
  throw new Error(
    `Checked-out HEAD ${actualHead} does not match workflow source ${feSha}`,
  );
}

for (const file of sourceFiles) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    throw new Error(`Required WWHN-181 evidence source is missing: ${file}`);
  }
}

const outputDir = path.resolve(
  process.env.WWHN_181_EVIDENCE_DIR ??
    `docs/evidence/WWHN-181/generated/${feSha}`,
);
fs.mkdirSync(outputDir, { recursive: true });

const files = sourceFiles.map((file) => ({
  path: file.replaceAll("\\", "/"),
  bytes: fs.statSync(file).size,
  sha256: sha256(fs.readFileSync(file)),
}));
const sha256sums =
  files.map((file) => `${file.sha256}  ${file.path}`).join("\n") + "\n";
fs.writeFileSync(path.join(outputDir, "SHA256SUMS"), sha256sums);
const sha256sumsDigest = sha256(Buffer.from(sha256sums));

const runUrl =
  process.env.GITHUB_SERVER_URL &&
  process.env.GITHUB_REPOSITORY &&
  process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null;
const artifactName = `wwhn-181-exact-sha-evidence-${feSha}`;

const manifestCore = {
  schema_version: "2.2.0",
  task: PINNED.task,
  disposition: "BLOCKED_FAIL_CLOSED",
  identity: {
    fe_sha: feSha,
    be_sha: beSha,
    contract_version: PINNED.contractVersion,
    be_parent_sha: PINNED.beParentSha,
    be_observed_fe_baseline_sha: PINNED.beObservedFeBaselineSha,
    be_release_manifest_sha256: PINNED.beReleaseManifestSha256,
    be_release_manifest_blob_sha: PINNED.beReleaseManifestBlobSha,
    be_release_pack_sha256: PINNED.beReleasePackSha256,
    be_repository_sha256sums_sha256: PINNED.beRepositorySha256sumsSha256,
  },
  ci: {
    workflow: "WWHN-181 Exact SHA Sign-off",
    run_url: runUrl,
    run_id: process.env.GITHUB_RUN_ID ?? null,
    run_attempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    artifact_name: artifactName,
    source_sha: feSha,
  },
  independent_be_source_review: {
    result: "CHANGES_REQUIRED",
    reviewed_be_sha: beSha,
    findings: [
      {
        id: "BE-HANDOFF-SCAN-CONTEXT-DRIFT",
        focused_artifact:
          "docs/api-contract/WWHN-180-posting-openapi.yaml: Scan context WARRANTY",
        exact_runtime:
          "Modules/Warehouse/app/Http/Controllers/ScanController.php: WARRANTY_TEMP_ONLY",
        fe_disposition:
          "Keep exact runtime WARRANTY_TEMP_ONLY; WWHN-180 must reconcile and independently approve one source.",
      },
      {
        id: "BE-HANDOFF-WARRANTY-BODY-DRIFT",
        focused_artifact:
          "WWHN-180 focused TEMP_ONLY path omits requestBody",
        exact_runtime:
          "WarrantyController requires temporary_item_code, missing_code_reason, condition_status and Idempotency-Key",
        fe_disposition:
          "No speculative FE contract rewrite; WWHN-180 remains blocked.",
      },
    ],
  },
  fe_runtime_remediations: {
    response_meta_request_id_preserved: true,
    inbound_scan_canonical_line_payload: true,
    outbound_scan_canonical_line_payload: true,
    inbound_atomic_post_body_removed: true,
    outbound_atomic_post_body_removed: true,
    posting_if_match_policy_preserved: true,
    stocktake_removed_from_mvp: true,
    reversal_only_correction_model: true,
    warranty_legacy_mutations_fail_closed: true,
    backend_authority_preserved: true,
  },
  external_gates: {
    WWHN_180: "PENDING_PASS_AND_HANDOFF_DRIFT_RESOLUTION",
    WWHN_182: "PENDING_QA2_PASS",
    WWHN_183: "PENDING_BA_DECISION",
    WWHN_337: "GITHUB_ACTIONS_RUNNER_PROVISIONING_BLOCKER",
  },
  integrity: {
    checksum_file: "SHA256SUMS",
    sha256sums_digest: sha256sumsDigest,
    source_file_count: files.length,
    files,
  },
  final_allowed: false,
};
const canonicalPayload = JSON.stringify(manifestCore);
const manifest = {
  ...manifestCore,
  canonical_payload_sha256: sha256(Buffer.from(canonicalPayload)),
  generated_at: new Date().toISOString(),
};
const manifestPath = path.join(outputDir, "manifest.json");
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
const manifestDigest = sha256(fs.readFileSync(manifestPath));
fs.writeFileSync(
  path.join(outputDir, "MANIFEST.sha256"),
  `${manifestDigest}  manifest.json\n`,
);
fs.writeFileSync(
  path.join(outputDir, "SHA256SUMS.sha256"),
  `${sha256sumsDigest}  SHA256SUMS\n`,
);
fs.writeFileSync(
  path.join(outputDir, "IDENTITY.json"),
  `${JSON.stringify(
    {
      task: PINNED.task,
      fe_sha: feSha,
      be_sha: beSha,
      contract_version: PINNED.contractVersion,
      be_release_manifest_sha256: PINNED.beReleaseManifestSha256,
      artifact_name: artifactName,
      manifest_digest: manifestDigest,
      sha256sums_digest: sha256sumsDigest,
      ci_url: runUrl,
      final_allowed: false,
    },
    null,
    2,
  )}\n`,
);

console.log(`WWHN-181 FE SHA: ${feSha}`);
console.log(`WWHN-181 BE SHA: ${beSha}`);
console.log(`Contract: ${PINNED.contractVersion}`);
console.log(`Artifact: ${artifactName}`);
console.log(`Manifest SHA256: ${manifestDigest}`);
console.log(`SHA256SUMS SHA256: ${sha256sumsDigest}`);
console.log(`Evidence directory: ${outputDir}`);
console.log(
  "Final sign-off: BLOCKED (WWHN-180/WWHN-182/WWHN-183 remain independent gates)",
);
