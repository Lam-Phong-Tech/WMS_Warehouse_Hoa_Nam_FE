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
import { REQUIRED_GATE_JOBS } from "./assert-ci-gates.mjs";

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

/**
 * Kết quả cổng CI theo JOB (security/static/unit/contracts/build), đọc từ `toJSON(needs)` do
 * job "Enforce all quality gate outcomes" truyền vào (10/09/2026: CI tách thành job cổng
 * cứng, không còn biến *_OUTCOME từng bước). Manifest này CHỈ GHI NHẬN: chạy sau khi cổng
 * tổng đã quyết định, luôn thoát 0 và không job nào phụ thuộc nó — không thể làm cổng đỏ
 * thành xanh.
 */
function readNeeds() {
  try {
    return process.env.CI_NEEDS_JSON ? JSON.parse(process.env.CI_NEEDS_JSON) : null;
  } catch {
    return null;
  }
}
const needs = readNeeds();
const outcomes = Object.fromEntries(
  REQUIRED_GATE_JOBS.map((job) => [job, needs?.[job]?.result ?? "not_run"]),
);

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
  schemaVersion: "4.0.0",
  gateModel:
    "Mỗi job cổng CI tự FAIL cứng; outcomes dưới đây là kết quả job do cổng tổng truyền vào, chỉ để ghi nhận.",
  allRequiredGatesSucceeded: REQUIRED_GATE_JOBS.every((job) => outcomes[job] === "success"),
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
      "Exact FE source/build, security/static/unit/contract gate job results, foundation and WWHN-178 closure controls and immutable CI/DEV handoff trace. Browser (visual/a11y/responsive) evidence is NOT produced: the e2e suite was removed in 3822d45 and has not been restored.",
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

## Gate job results (reporting only)

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
