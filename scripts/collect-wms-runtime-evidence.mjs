#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = join(
  root,
  process.env.WMS_EVIDENCE_DIR ??
    "docs/evidence/wms-contract-signoff/generated",
);

function sha256(path) {
  if (!existsSync(path) || !statSync(path).isFile()) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function listFiles(path) {
  if (!existsSync(path)) return [];
  const files = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(target));
    else files.push(target);
  }
  return files;
}

function relativeFiles(paths) {
  return paths.map((path) => relative(root, path).replaceAll("\\", "/"));
}

const outcomes = {
  format: process.env.FORMAT_OUTCOME ?? "not_run",
  lint: process.env.LINT_OUTCOME ?? "not_run",
  typecheck: process.env.TYPECHECK_OUTCOME ?? "not_run",
  unitTests: process.env.UNIT_TEST_OUTCOME ?? "not_run",
  envContract: process.env.ENV_CONTRACT_OUTCOME ?? "not_run",
  uatContract: process.env.UAT_CONTRACT_OUTCOME ?? "not_run",
  wwhn156Closure: process.env.WWHN_156_OUTCOME ?? "not_run",
  smokeContract: process.env.SMOKE_CONTRACT_OUTCOME ?? "not_run",
  masterSku: process.env.MASTER_SKU_OUTCOME ?? "not_run",
  wmsContract: process.env.WMS_CONTRACT_OUTCOME ?? "not_run",
  wwhn148Closure: process.env.WWHN_148_OUTCOME ?? "not_run",
  build: process.env.BUILD_OUTCOME ?? "not_run",
  health: process.env.HEALTH_OUTCOME ?? "not_run",
  apiMapping: process.env.API_MAPPING_OUTCOME ?? "not_run",
  runtimeEvidence: process.env.RUNTIME_EVIDENCE_OUTCOME ?? "not_run",
};

const sourceSha =
  process.env.WMS_SOURCE_SHA ?? process.env.SOURCE_SHA ?? process.env.GITHUB_SHA ?? null;
const executionSha =
  process.env.WMS_EXECUTION_SHA ??
  process.env.EXECUTION_SHA ??
  process.env.GITHUB_SHA ??
  sourceSha;
const artifactName = `wms-fe-closure-evidence-${sourceSha ?? "unknown"}`;
const testFiles = listFiles(join(root, "test-results"));
const screenshots = relativeFiles(
  testFiles.filter((path) => extname(path).toLowerCase() === ".png"),
);
const videos = relativeFiles(
  testFiles.filter((path) => [".webm", ".mp4"].includes(extname(path).toLowerCase())),
);
const traces = relativeFiles(
  testFiles.filter((path) => extname(path).toLowerCase() === ".zip"),
);

const manifest = {
  schemaVersion: "2.0.0",
  tasks: ["WWHN-148", "WWHN-153", "WWHN-156"],
  generatedAt: new Date().toISOString(),
  repository:
    process.env.GITHUB_REPOSITORY ??
    "Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE",
  branchOrRef: process.env.GITHUB_REF ?? null,
  sourceSha,
  executionSha,
  pullRequestNumber:
    process.env.GITHUB_EVENT_NAME === "pull_request"
      ? process.env.GITHUB_REF?.match(/^refs\/pull\/(\d+)\/merge$/u)?.[1] ?? null
      : null,
  artifactName,
  run: {
    id: process.env.GITHUB_RUN_ID ?? null,
    number: process.env.GITHUB_RUN_NUMBER ?? null,
    attempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    workflow: process.env.GITHUB_WORKFLOW ?? null,
    job: process.env.GITHUB_JOB ?? null,
  },
  environment: {
    runnerOs: process.env.RUNNER_OS ?? process.platform,
    runnerArch: process.env.RUNNER_ARCH ?? process.arch,
    node: process.version,
    appEnv: process.env.VITE_APP_ENV ?? "ci",
    apiBaseUrl: process.env.VITE_API_BASE_URL ?? null,
    healthPath: process.env.VITE_API_HEALTH_PATH ?? null,
  },
  outcomes,
  artifacts: {
    frontendHealth: {
      path: "dist/health.json",
      sha256: sha256(join(root, "dist/health.json")),
    },
    buildManifest: {
      path: "dist/build-manifest.json",
      sha256: sha256(join(root, "dist/build-manifest.json")),
    },
    wwhn156ClosureRegister: {
      path: "docs/evidence/wwhn-156/WWHN-156_CLOSURE_REGISTER.json",
      sha256: sha256(
        join(root, "docs/evidence/wwhn-156/WWHN-156_CLOSURE_REGISTER.json"),
      ),
    },
    wwhn156TaskDocument: {
      path: "docs/Task_docs_Jira/WWHN-156.md",
      sha256: sha256(join(root, "docs/Task_docs_Jira/WWHN-156.md")),
    },
    contractEvidence: {
      path: "docs/evidence/wms-contract-signoff/generated/contract-evidence.json",
      sha256: sha256(join(outputDir, "contract-evidence.json")),
    },
    screenshots,
    videos,
    traces,
  },
  evidenceBoundary: {
    feOwned:
      "Exact FE source/build, controlled responsive/UI-state/RBAC/API-error evidence and immutable CI artifact trace.",
    independent:
      "QA1 DEV/UAT smoke, DevOps deployment, BA baseline, BE direct API deny and QA2 retest remain independent evidence and are never self-signed by FE.",
  },
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(
  join(outputDir, "runtime-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

const markdown = `# WWHN-148 / WWHN-153 / WWHN-156 CI Evidence Manifest

- Artifact: \`${artifactName}\`
- Source SHA: \`${sourceSha ?? "n/a"}\`
- Execution/merge SHA: \`${executionSha ?? "n/a"}\`
- Run: \`${manifest.run.id ?? "n/a"}\` / number \`${manifest.run.number ?? "n/a"}\`
- Runner: \`${manifest.environment.runnerOs}/${manifest.environment.runnerArch}\`, Node \`${manifest.environment.node}\`
- Screenshots: ${screenshots.length}; videos: ${videos.length}; traces: ${traces.length}

## Gate outcomes

${Object.entries(outcomes)
  .map(([name, outcome]) => `- ${name}: **${outcome}**`)
  .join("\n")}

## Boundary

This artifact proves FE-owned controls from the exact SHA. It does not replace independent QA1, QA2, DevOps, BA, BAS or BE evidence.
`;
writeFileSync(join(outputDir, "runtime-manifest.md"), markdown);

console.log(
  `[wms-evidence] ${artifactName}: ${screenshots.length} screenshot(s), ${videos.length} video(s), ${traces.length} trace(s).`,
);
