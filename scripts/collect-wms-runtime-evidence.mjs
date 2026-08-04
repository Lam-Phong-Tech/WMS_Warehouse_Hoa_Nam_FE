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

const outcomes = {
  format: process.env.FORMAT_OUTCOME ?? "not_run",
  lint: process.env.LINT_OUTCOME ?? "not_run",
  typecheck: process.env.TYPECHECK_OUTCOME ?? "not_run",
  unitTests: process.env.UNIT_TEST_OUTCOME ?? "not_run",
  envContract: process.env.ENV_CONTRACT_OUTCOME ?? "not_run",
  uatContract: process.env.UAT_CONTRACT_OUTCOME ?? "not_run",
  masterSku: process.env.MASTER_SKU_OUTCOME ?? "not_run",
  wmsContract: process.env.WMS_CONTRACT_OUTCOME ?? "not_run",
  wwhn148Closure: process.env.WWHN_148_OUTCOME ?? "not_run",
  build: process.env.BUILD_OUTCOME ?? "not_run",
  health: process.env.HEALTH_OUTCOME ?? "not_run",
  apiMapping: process.env.API_MAPPING_OUTCOME ?? "not_run",
  runtimeEvidence: process.env.RUNTIME_EVIDENCE_OUTCOME ?? "not_run",
};

const testFiles = listFiles(join(root, "test-results"));
const screenshots = testFiles
  .filter((path) => extname(path).toLowerCase() === ".png")
  .map((path) => relative(root, path).replaceAll("\\", "/"));
const videos = testFiles
  .filter((path) => [".webm", ".mp4"].includes(extname(path).toLowerCase()))
  .map((path) => relative(root, path).replaceAll("\\", "/"));
const traces = testFiles
  .filter((path) => extname(path).toLowerCase() === ".zip")
  .map((path) => relative(root, path).replaceAll("\\", "/"));

const manifest = {
  schemaVersion: "1.1.0",
  tasks: ["WWHN-148", "WWHN-153"],
  generatedAt: new Date().toISOString(),
  repository:
    process.env.GITHUB_REPOSITORY ??
    "Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE",
  branchOrRef: process.env.GITHUB_REF ?? null,
  sourceSha: process.env.WMS_SOURCE_SHA ?? process.env.GITHUB_SHA ?? null,
  executionSha: process.env.WMS_EXECUTION_SHA ?? process.env.GITHUB_SHA ?? null,
  pullRequestNumber:
    process.env.GITHUB_REF_NAME?.match(/^\d+\/merge$/u)?.[0] ?? null,
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
  },
  outcomes,
  artifacts: {
    health: {
      path: "dist/health.json",
      sha256: sha256(join(root, "dist/health.json")),
    },
    contractEvidence: {
      path: "docs/evidence/wms-contract-signoff/generated/contract-evidence.json",
      sha256: sha256(join(outputDir, "contract-evidence.json")),
    },
    wwhn148Document: {
      path: "docs/Task_docs_Jira/WWHN-148.md",
      sha256: sha256(join(root, "docs/Task_docs_Jira/WWHN-148.md")),
    },
    m1ApiMapping: {
      path: "docs/api-evidence/M1_API_MAPPING.md",
      sha256: sha256(join(root, "docs/api-evidence/M1_API_MAPPING.md")),
    },
    normalizationRegister: {
      path: "docs/api-evidence/WWHN-148_NORMALIZATION_REGISTER.json",
      sha256: sha256(
        join(root, "docs/api-evidence/WWHN-148_NORMALIZATION_REGISTER.json"),
      ),
    },
    screenshots,
    videos,
    traces,
  },
  independentGateBoundary: {
    feAutomation:
      "This manifest proves FE build, mapping, controlled UI-state, responsive, RBAC and API-error evidence from the exact source SHA.",
    notSubstituted:
      "It does not replace WWHN-146 BAS approval, WWHN-147 BA approval, WWHN-149 QA2 named-backend execution, or BE1/BE2 versioned contract evidence.",
  },
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(
  join(outputDir, "runtime-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

const markdown = `# WWHN-148 / WWHN-153 CI Evidence Manifest

- Source SHA: \`${manifest.sourceSha ?? "n/a"}\`
- Execution/merge SHA: \`${manifest.executionSha ?? "n/a"}\`
- Run: \`${manifest.run.id ?? "n/a"}\` / number \`${manifest.run.number ?? "n/a"}\`
- Runner: \`${manifest.environment.runnerOs}/${manifest.environment.runnerArch}\`, Node \`${manifest.environment.node}\`
- Screenshots: ${screenshots.length}
- Videos: ${videos.length}
- Traces: ${traces.length}

## Gate outcomes

${Object.entries(outcomes)
  .map(([name, outcome]) => `- ${name}: **${outcome}**`)
  .join("\n")}

## Boundary

This evidence is generated from the exact FE source/build. It does not self-sign BAS, BA, BE, QA1 or QA2 approvals.
`;
writeFileSync(join(outputDir, "runtime-manifest.md"), markdown);

console.log(
  `[wms-evidence] Manifest written with ${screenshots.length} screenshot(s), ${videos.length} video(s), and ${traces.length} trace(s).`,
);
