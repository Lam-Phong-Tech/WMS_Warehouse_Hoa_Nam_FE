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
  wwhn175Closure: process.env.WWHN_175_OUTCOME ?? "not_run",
  wwhn165Closure: process.env.WWHN_165_OUTCOME ?? "not_run",
  wwhn156Closure: process.env.WWHN_156_OUTCOME ?? "not_run",
  smokeContract: process.env.SMOKE_CONTRACT_OUTCOME ?? "not_run",
  masterSku: process.env.MASTER_SKU_OUTCOME ?? "not_run",
  wwhn178RbacContract:
    process.env.WWHN_178_RBAC_CONTRACT_OUTCOME ?? "not_run",
  wmsContract: process.env.WMS_CONTRACT_OUTCOME ?? "not_run",
  wwhn148Closure: process.env.WWHN_148_OUTCOME ?? "not_run",
  wwhn144Closure: process.env.WWHN_144_OUTCOME ?? "not_run",
  wwhn211Closure: process.env.WWHN_211_OUTCOME ?? "not_run",
  wwhn211RbacContract:
    process.env.WWHN_211_RBAC_CONTRACT_OUTCOME ?? "not_run",
  build: process.env.BUILD_OUTCOME ?? "not_run",
  health: process.env.HEALTH_OUTCOME ?? "not_run",
  apiMapping: process.env.API_MAPPING_OUTCOME ?? "not_run",
  playwrightInstall: process.env.PLAYWRIGHT_INSTALL_OUTCOME ?? "not_run",
  runtimeEvidence: process.env.RUNTIME_EVIDENCE_OUTCOME ?? "not_run",
  wwhn144E2E: process.env.WWHN_144_E2E_OUTCOME ?? "not_run",
  wwhn175E2E: process.env.WWHN_175_E2E_OUTCOME ?? "not_run",
  wwhn178E2E: process.env.WWHN_178_E2E_OUTCOME ?? "not_run",
  wwhn177Handoff: process.env.WWHN_177_HANDOFF_OUTCOME ?? "not_run",
};

const sourceSha =
  process.env.WMS_SOURCE_SHA ??
  process.env.SOURCE_SHA ??
  process.env.GITHUB_SHA ??
  null;
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
  testFiles.filter((path) =>
    [".webm", ".mp4"].includes(extname(path).toLowerCase()),
  ),
);
const traces = relativeFiles(
  testFiles.filter((path) => extname(path).toLowerCase() === ".zip"),
);

const manifest = {
  schemaVersion: "3.1.0",
  tasks: [
    "WWHN-144",
    "WWHN-148",
    "WWHN-153",
    "WWHN-156",
    "WWHN-165",
    "WWHN-175",
    "WWHN-176",
    "WWHN-177",
    "WWHN-178",
    "WWHN-179",
  ],
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
    url:
      process.env.GITHUB_SERVER_URL &&
      process.env.GITHUB_REPOSITORY &&
      process.env.GITHUB_RUN_ID
        ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
        : null,
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
    wwhn175ClosureRegister: {
      path: "docs/evidence/wwhn-175/WWHN-175_CLOSURE_REGISTER.json",
      sha256: sha256(
        join(
          root,
          "docs/evidence/wwhn-175/WWHN-175_CLOSURE_REGISTER.json",
        ),
      ),
    },
    wwhn175TaskDocument: {
      path: "docs/Task_docs_Jira/WWHN-175.md",
      sha256: sha256(join(root, "docs/Task_docs_Jira/WWHN-175.md")),
    },
    wwhn177DevHandoff: {
      path:
        "docs/evidence/wwhn-175/generated/WWHN-177_DEV_HANDOFF_MANIFEST.json",
      sha256: sha256(
        join(
          root,
          "docs/evidence/wwhn-175/generated/WWHN-177_DEV_HANDOFF_MANIFEST.json",
        ),
      ),
    },
    wwhn165ClosureRegister: {
      path: "docs/evidence/wwhn-165/WWHN-165_CLOSURE_REGISTER.json",
      sha256: sha256(
        join(
          root,
          "docs/evidence/wwhn-165/WWHN-165_CLOSURE_REGISTER.json",
        ),
      ),
    },
    wwhn165TaskDocument: {
      path: "docs/Task_docs_Jira/WWHN-165.md",
      sha256: sha256(join(root, "docs/Task_docs_Jira/WWHN-165.md")),
    },
    wwhn156ClosureRegister: {
      path: "docs/evidence/wwhn-156/WWHN-156_CLOSURE_REGISTER.json",
      sha256: sha256(
        join(
          root,
          "docs/evidence/wwhn-156/WWHN-156_CLOSURE_REGISTER.json",
        ),
      ),
    },
    wwhn156TaskDocument: {
      path: "docs/Task_docs_Jira/WWHN-156.md",
      sha256: sha256(join(root, "docs/Task_docs_Jira/WWHN-156.md")),
    },
    wwhn178TaskDocument: {
      path: "docs/Task_docs_Jira/WWHN-178.md",
      sha256: sha256(join(root, "docs/Task_docs_Jira/WWHN-178.md")),
    },
    wwhn178ContractBaseline: {
      path: "docs/api-evidence/WWHN-178_MASTER_SKU_CONTRACT_BASELINE.json",
      sha256: sha256(
        join(
          root,
          "docs/api-evidence/WWHN-178_MASTER_SKU_CONTRACT_BASELINE.json",
        ),
      ),
    },
    wwhn178DirectApiPlan: {
      path: `docs/evidence/wwhn-178/generated/${sourceSha ?? "unknown"}/WWHN-178_DIRECT_API_RBAC_PLAN.json`,
      sha256: sha256(
        join(
          root,
          "docs/evidence/wwhn-178/generated",
          sourceSha ?? "unknown",
          "WWHN-178_DIRECT_API_RBAC_PLAN.json",
        ),
      ),
    },
    contractEvidence: {
      path:
        "docs/evidence/wms-contract-signoff/generated/contract-evidence.json",
      sha256: sha256(join(outputDir, "contract-evidence.json")),
    },
    screenshots,
    videos,
    traces,
  },
  evidenceBoundary: {
    feOwned:
      "Exact FE source/build, foundation and WWHN-178 closure controls, controlled responsive/accessibility/UI-state/RBAC/API-error evidence and immutable CI/DEV handoff trace.",
    independent:
      "QA2 browser/UAT sign-off, BE/QA live direct API authorization and data-scope proof, DevOps live target/deployment acceptance, BA/BAS baseline, Tech Lead disposition and Lead final gate remain independent and are never self-signed by FE.",
  },
};

mkdirSync(outputDir, { recursive: true });
writeFileSync(
  join(outputDir, "runtime-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

const markdown = `# WWHN FE CI Evidence Manifest

- Tasks: ${manifest.tasks.join(", ")}
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

This artifact proves FE-owned controls from the exact SHA. It does not replace independent QA2, BE/QA live authorization, DevOps, BA/BAS, Tech Lead or Lead evidence.
`;
writeFileSync(join(outputDir, "runtime-manifest.md"), markdown);

console.log(
  `[wms-evidence] ${artifactName}: ${screenshots.length} screenshot(s), ${videos.length} video(s), ${traces.length} trace(s).`,
);
