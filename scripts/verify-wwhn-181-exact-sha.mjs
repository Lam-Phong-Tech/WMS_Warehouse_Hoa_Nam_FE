#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const EXPECTED_BE_SHA = "54d5f4ff9cbaa678e16dcf322bd55836e177409a";
const task = "WWHN-181";
const feSha = process.env.GITHUB_SHA || process.env.FE_SHA;
const beSha = process.env.WWHN_181_BE_SHA || EXPECTED_BE_SHA;
const runId = process.env.GITHUB_RUN_ID || "local";
const runAttempt = process.env.GITHUB_RUN_ATTEMPT || "local";
const repository = process.env.GITHUB_REPOSITORY || "Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE";

if (!feSha || !/^[0-9a-f]{40}$/i.test(feSha)) {
  throw new Error("WWHN-181 requires an exact 40-character FE SHA via GITHUB_SHA or FE_SHA");
}
if (beSha !== EXPECTED_BE_SHA) {
  throw new Error(`WWHN-181 BE SHA mismatch: expected ${EXPECTED_BE_SHA}, received ${beSha}`);
}

const evidenceFiles = [
  "src/shared/api/wms-contract-signoff.ts",
  "docs/api-evidence/WMS_FE_CONTRACT_BASELINE.json",
  "docs/Task_docs_Jira/WWHN-181.md",
  "docs/evidence/WWHN-181/RUNTIME_EVIDENCE_CHECKLIST.md",
];

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const files = [];
for (const path of evidenceFiles) {
  const content = await readFile(path);
  files.push({ path, bytes: content.byteLength, sha256: sha256(content) });
}

const generatedAt = new Date().toISOString();
const artifactName = `wwhn-181-exact-sha-evidence-${feSha}`;
const ciUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : null;

const manifest = {
  schema_version: "1.0.0",
  task,
  disposition: "CONDITIONAL_PASS_NOT_FINAL",
  generated_at: generatedAt,
  exact_pair: {
    frontend_repository: repository,
    frontend_sha: feSha,
    backend_repository: "Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_BE",
    backend_contract_version: "1.5.0",
    backend_sha: beSha,
  },
  ci: {
    run_id: runId,
    run_attempt: runAttempt,
    url: ciUrl,
    artifact_name: artifactName,
  },
  files,
  gates: {
    WWHN_180: "PENDING_INDEPENDENT_PASS",
    WWHN_182: "PENDING_QA2_RUNTIME_PASS",
    WWHN_183: "PENDING_BA_DECISION",
    final_allowed: false,
  },
  integrity: {
    algorithm: "sha256",
    canonical_payload_sha256: null,
  },
};
manifest.integrity.canonical_payload_sha256 = sha256(
  Buffer.from(JSON.stringify({ ...manifest, integrity: { algorithm: "sha256" } })),
);

await mkdir("docs/evidence/WWHN-181", { recursive: true });
await writeFile(
  "docs/evidence/WWHN-181/exact-sha-manifest.json",
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log(`WWHN-181 exact pair verified: FE ${feSha} / BE ${beSha}`);
console.log(`Artifact: ${artifactName}`);
console.log(`Manifest digest: ${manifest.integrity.canonical_payload_sha256}`);
