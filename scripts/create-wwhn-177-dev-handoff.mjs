#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(
  root,
  process.env.WWHN_177_HANDOFF_DIR ??
    "docs/evidence/wwhn-175/generated",
);
const requiredFiles = [
  "dist/index.html",
  "dist/health.json",
  "dist/build-manifest.json",
];

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const missing = requiredFiles.filter((path) => {
  const fullPath = join(root, path);
  return !existsSync(fullPath) || !statSync(fullPath).isFile();
});

if (missing.length > 0) {
  for (const path of missing) {
    console.error(`[wwhn-177] Missing required build artifact: ${path}`);
  }
  process.exit(1);
}

const sourceSha =
  process.env.SOURCE_SHA ?? process.env.GITHUB_SHA ?? "local-uncommitted";
const executionSha =
  process.env.EXECUTION_SHA ?? process.env.GITHUB_SHA ?? sourceSha;
const devAppUrl = (process.env.DEV_APP_URL ?? "").trim();
const deploymentMode = devAppUrl
  ? "TARGET_CONFIGURED"
  : "NOT_CONFIGURED_ARTIFACT_ONLY";

const artifacts = requiredFiles.map((path) => {
  const fullPath = join(root, path);
  return {
    path: relative(root, fullPath).replaceAll("\\", "/"),
    bytes: statSync(fullPath).size,
    sha256: sha256(fullPath),
  };
});

const manifest = {
  schemaVersion: "1.0.0",
  task: "WWHN-177",
  sourceTask: "WWHN-175",
  repository:
    process.env.GITHUB_REPOSITORY ??
    "Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE",
  branchOrRef: process.env.GITHUB_REF ?? "local",
  sourceSha,
  executionSha,
  generatedAt: new Date().toISOString(),
  targetEnvironment: "DEV",
  deploymentMode,
  liveDeploymentStatus: deploymentMode,
  devAppUrl: devAppUrl || null,
  workflowRun: {
    id: process.env.GITHUB_RUN_ID ?? null,
    number: process.env.GITHUB_RUN_NUMBER ?? null,
    attempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    url:
      process.env.GITHUB_SERVER_URL &&
      process.env.GITHUB_REPOSITORY &&
      process.env.GITHUB_RUN_ID
        ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
        : null,
  },
  deliveryArtifact: `wms-fe-closure-evidence-${sourceSha}`,
  artifacts,
  acceptanceBoundary:
    deploymentMode === "TARGET_CONFIGURED"
      ? "A target URL is configured; DevOps must still attach runtime health/smoke and rollback evidence."
      : "Artifact-only delivery is proven. No live DEV deployment is claimed until DevOps configures and verifies a real target.",
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(
  join(outputDir, "WWHN-177_DEV_HANDOFF_MANIFEST.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

const markdown = `# WWHN-177 DEV Handoff Manifest

- Source SHA: \`${sourceSha}\`
- Execution SHA: \`${executionSha}\`
- Target environment: **DEV**
- Delivery mode: **${deploymentMode}**
- DEV URL: ${devAppUrl ? `\`${devAppUrl}\`` : "not configured"}
- Artifact: \`${manifest.deliveryArtifact}\`
- Generated: \`${manifest.generatedAt}\`

## Checksums

${artifacts
  .map(
    (artifact) =>
      `- \`${artifact.path}\` — ${artifact.bytes} bytes — SHA-256 \`${artifact.sha256}\``,
  )
  .join("\n")}

## Boundary

${manifest.acceptanceBoundary}
`;

writeFileSync(
  join(outputDir, "WWHN-177_DEV_HANDOFF_MANIFEST.md"),
  markdown,
  "utf8",
);

console.log(
  `[wwhn-177] PASS: ${deploymentMode}, ${artifacts.length} immutable build artifacts recorded for ${sourceSha}.`,
);
