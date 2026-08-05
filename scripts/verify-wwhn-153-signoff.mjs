#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateWwhn153Signoff,
  loadWwhn153Evidence,
  sha256Buffer,
} from "./wwhn-153-signoff-core.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const requireFinal = args.has("--require-final");
const outputDir = join(
  root,
  process.env.WWHN_153_EVIDENCE_DIR ??
    process.env.WMS_EVIDENCE_DIR ??
    "docs/evidence/wms-contract-signoff/generated",
);

const evidence = loadWwhn153Evidence(root);
const result = evaluateWwhn153Signoff({
  manifest: evidence.manifest,
  permissionApproval: evidence.permissionApproval,
  root,
});
const report = {
  ...result,
  repository:
    process.env.GITHUB_REPOSITORY ??
    "Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE",
  branchOrRef: process.env.GITHUB_REF ?? "m1",
  sourceSha:
    process.env.WMS_SOURCE_SHA ??
    process.env.SOURCE_SHA ??
    process.env.GITHUB_SHA ??
    null,
  executionSha:
    process.env.WMS_EXECUTION_SHA ??
    process.env.EXECUTION_SHA ??
    process.env.GITHUB_SHA ??
    null,
  inputs: {
    signoffManifest: {
      path: "docs/evidence/wwhn-153/WWHN-153_SIGNOFF_MANIFEST.json",
      sha256: sha256Buffer(evidence.manifestText),
    },
    permissionApproval: {
      path: "docs/evidence/wwhn-153/WWHN-153_PERMISSION_APPROVAL.json",
      sha256: sha256Buffer(evidence.permissionText),
    },
  },
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(
  join(outputDir, "wwhn-153-signoff-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
const markdown = `# WWHN-153 sign-off report\n\n- Integrity: **${
  report.integrityOk ? "PASS" : "FAIL"
}**\n- Final allowed: **${
  report.finalAllowed ? "YES" : "NO — fail-closed"
}**\n- Source SHA: \`${report.sourceSha ?? "n/a"}\`\n- Open P0/P1: **${
  report.openP0
}/${report.openP1}**\n\n## Gate status\n\n${report.gates
  .map(
    (gate) =>
      `- ${gate.id}: **${gate.status}**${
        gate.blockers.length ? ` — ${gate.blockers.join("; ")}` : ""
      }`,
  )
  .join("\n")}\n\n## Integrity errors\n\n${
  report.errors.length
    ? report.errors.map((item) => `- ${item}`).join("\n")
    : "- None"
}\n`;
writeFileSync(join(outputDir, "wwhn-153-signoff-report.md"), markdown);

if (!report.integrityOk) {
  for (const error of report.errors) console.error(`[wwhn-153] ${error}`);
  process.exit(1);
}
if (requireFinal && !report.finalAllowed) {
  for (const blocker of report.blockers) {
    console.error(`[wwhn-153-final] ${blocker}`);
  }
  process.exit(1);
}
console.log(
  `[wwhn-153] PASS integrity; finalAllowed=${report.finalAllowed}; blockers=${report.blockers.length}.`,
);
