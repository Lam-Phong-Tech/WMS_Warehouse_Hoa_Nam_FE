#!/usr/bin/env node
/**
 * WWHN-296 / FE296-P1-02 — produce the exact identity + command evidence.
 *
 * The review rejected "the commands are listed in the task doc" as closure
 * evidence, and it was right to: a list proves intent, not an exit code. This
 * runner executes the gate commands, records the exit code/duration/log of each
 * one, and pins the identity they were executed against (FE SHA, BE SHA, build
 * id, resolved API/health URL, timestamps).
 *
 * Anything it cannot observe from source stays an explicit PENDING entry with an
 * owner and a Jira key. A deployed UAT/PROD URL is never invented here.
 */
import { execSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = join(root, "docs/evidence/WWHN-296");
const logDir = join(evidenceDir, "logs");
const backendRoot =
  process.env.WMS_BACKEND_ROOT ??
  join(root, "../../HoaNam_BE/WMS_Warehouse_Hoa_Nam_BE");

const skip = new Set(
  (
    process.argv
      .find((arg) => arg.startsWith("--skip="))
      ?.slice("--skip=".length) ?? ""
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

const GATE_COMMANDS = [
  "format:check",
  "lint",
  "typecheck",
  "test",
  "env:verify",
  "uat:p0p1:verify",
  "wms-contract:verify",
  "wwhn-148:verify",
  "build",
  "health:check",
  "check:api-mapping",
];

function git(cwd, args) {
  try {
    return execSync(`git ${args}`, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function repoIdentity(cwd, label, excludes = []) {
  if (!existsSync(cwd)) {
    return {
      available: false,
      reason: `${label} repository not found at ${cwd}`,
    };
  }
  const sha = git(cwd, "rev-parse HEAD");
  // The evidence pack this runner is about to (re)generate is excluded from the
  // cleanliness verdict — otherwise a prior pack (e.g. a committed positive
  // control log) would block its own regeneration. Everything that is SOURCE
  // must still be byte-identical to the checked-out SHA.
  const statusArgs = excludes.length
    ? `status --porcelain -- . ${excludes.map((entry) => `":(exclude)${entry}"`).join(" ")}`
    : "status --porcelain";
  const status = git(cwd, statusArgs);
  // m1 is a shared working tree between concurrent sessions, so the sanctioned
  // way to get a clean checkout of an exact SHA is a detached git worktree.
  // Detached is only accepted when the commit is actually on m1 — the pin then
  // records the canonical branch plus how the checkout was materialized.
  let branch = git(cwd, "rev-parse --abbrev-ref HEAD");
  let checkoutMode = "attached-branch";
  if (branch === "HEAD") {
    const onM1 = git(cwd, "merge-base --is-ancestor HEAD refs/heads/m1");
    if (onM1 !== null) {
      branch = "m1";
      checkoutMode = "detached-exact-sha-on-m1";
    }
  }
  return {
    available: sha !== null,
    branch,
    checkoutMode,
    sha,
    // A dirty tree means the SHA does not describe what was actually executed.
    workingTreeClean: status === "",
    uncommittedFiles: status ? status.split(/\r?\n/u).length : 0,
    dirtyCheckExcludes: excludes,
    commitTimestamp: git(cwd, "log -1 --format=%cI"),
  };
}

function parseEnvExample() {
  const content = readFileSync(join(root, ".env.example"), "utf8");
  const values = {};
  for (const line of content.split(/\r?\n/u)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/u);
    if (match) values[match[1]] = match[2].trim().replace(/^["']|["']$/gu, "");
  }
  return values;
}

function toPosix(path) {
  return path.split("\\").join("/");
}

// ---------------------------------------------------------------------------
// FE296-P1-02R / FE296-P1-08 — identity is captured BEFORE anything runs, and
// generation refuses to start at all unless both trees are clean checkouts of
// m1. Evidence generated from a dirty tree describes no commit anyone can ever
// check out again, so it is not evidence; failing here is the fix, not a
// convenience check. The identity below is therefore exactly the state every
// command in this run executed against.
// ---------------------------------------------------------------------------
const identityCapturedAt = new Date().toISOString();
const frontendIdentity = repoIdentity(root, "frontend", [
  "docs/evidence/WWHN-296",
]);
const backendIdentity = repoIdentity(backendRoot, "backend");

const preRunErrors = [];
for (const [label, identity] of [
  ["frontend", frontendIdentity],
  ["backend", backendIdentity],
]) {
  if (!identity.available) {
    preRunErrors.push(
      `${label} repository unavailable: ${identity.reason ?? "no HEAD"}`,
    );
    continue;
  }
  if (identity.branch !== "m1") {
    preRunErrors.push(
      `${label} must be on canonical branch m1 (found ${identity.branch}).`,
    );
  }
  if (identity.workingTreeClean !== true) {
    preRunErrors.push(
      `${label} working tree has ${identity.uncommittedFiles} uncommitted file(s); ` +
        "commit everything first — evidence must be generated from a clean checkout of the exact SHA.",
    );
  }
}
if (preRunErrors.length) {
  preRunErrors.forEach((message) =>
    console.error(`[wwhn-296] REFUSED: ${message}`),
  );
  process.exit(1);
}

// The build manifest resolves its SHAs from the environment and would otherwise
// fall back to the "local-uncommitted" sentinel the closure gate rejects. The
// tree was just proven clean, so HEAD is exactly what the build compiles.
process.env.SOURCE_SHA = frontendIdentity.sha;
process.env.WMS_SOURCE_SHA = frontendIdentity.sha;
process.env.EXECUTION_SHA = frontendIdentity.sha;
process.env.WMS_EXECUTION_SHA = frontendIdentity.sha;

mkdirSync(logDir, { recursive: true });

const runs = [];
for (const script of GATE_COMMANDS) {
  const logFile = join(logDir, `${script.replace(/[^a-z0-9]+/giu, "-")}.log`);
  if (skip.has(script)) {
    // Explicitly NOT_RUN, never silently absent: a missing row reads as "passed".
    writeFileSync(logFile, "NOT RUN (skipped via --skip)\n");
    runs.push({
      command: `npm run ${script}`,
      status: "NOT_RUN",
      reason: "skipped via --skip",
      exitCode: null,
      log: toPosix(relative(root, logFile)),
    });
    console.log(`[wwhn-296] NOT_RUN npm run ${script}`);
    continue;
  }

  const startedAt = new Date().toISOString();
  const started = Date.now();
  const result = spawnSync("npm", ["run", "--silent", script], {
    cwd: root,
    encoding: "utf8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  const exitCode = result.status ?? 1;
  writeFileSync(
    logFile,
    `$ npm run ${script}\n\n${result.stdout ?? ""}\n${result.stderr ?? ""}\nexit code: ${exitCode}\n`,
  );

  runs.push({
    command: `npm run ${script}`,
    status: exitCode === 0 ? "PASS" : "FAIL",
    exitCode,
    startedAt,
    durationMs: Date.now() - started,
    log: toPosix(relative(root, logFile)),
  });
  console.log(
    `[wwhn-296] ${exitCode === 0 ? "PASS" : "FAIL"} npm run ${script} (exit ${exitCode})`,
  );
}

// ---------------------------------------------------------------------------
// Post-run integrity: m1 is a shared working tree, so a parallel session can
// commit or edit source mid-run. If that happened, the identity captured above
// no longer describes what actually executed — the run is void, fail-closed.
// The generator's own outputs under docs/evidence/WWHN-296 are the only writes
// this run is allowed to have produced.
// ---------------------------------------------------------------------------
const headShaAfterRun = git(root, "rev-parse HEAD");
const dirtyOutsideEvidence = git(
  root,
  'status --porcelain -- . ":(exclude)docs/evidence/WWHN-296"',
);
const integrity = {
  identityCapturedAt,
  checkedAt: new Date().toISOString(),
  headShaAfterRun,
  headUnchanged: headShaAfterRun === frontendIdentity.sha,
  sourceTreeCleanAfterRunExcludingEvidence: dirtyOutsideEvidence === "",
  dirtyCheckExcludes: ["docs/evidence/WWHN-296"],
};
if (
  !integrity.headUnchanged ||
  !integrity.sourceTreeCleanAfterRunExcludingEvidence
) {
  console.error(
    `[wwhn-296] VOID RUN: source tree changed while the gates were executing ` +
      `(HEAD ${frontendIdentity.sha} -> ${headShaAfterRun}; dirty: ${dirtyOutsideEvidence || "none"}). ` +
      "No pin was written. Re-run when the tree is stable.",
  );
  process.exit(1);
}

const env = parseEnvExample();
const buildManifestPath = join(root, "dist/build-manifest.json");
const buildManifest = existsSync(buildManifestPath)
  ? JSON.parse(readFileSync(buildManifestPath, "utf8"))
  : null;

const deployedRequirements = [
  "VITE_API_BASE_URL",
  "FE origin",
  "CORS allow-list",
  "refresh cookie Secure/SameSite",
  "TLS",
  "static cache policy",
  "rollback evidence",
  "deployed /api/v1/health result",
];

const pin = {
  schemaVersion: "1.1.0",
  jira: "WWHN-296",
  finding: "FE296-P1-02R / FE296-P1-08",
  canonicalBranch: "m1",
  generatedAt: new Date().toISOString(),
  generator: "npm run wwhn-296:evidence",
  integrity,
  frontend: {
    repository: "https://github.com/Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE",
    ...frontendIdentity,
    nodeVersion: process.version,
    buildId: buildManifest
      ? `${buildManifest.artifactVersion}+${buildManifest.sourceSha}`
      : null,
    buildManifest,
  },
  backend: {
    repository: "https://github.com/Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_BE",
    ...backendIdentity,
  },
  environments: {
    source: {
      status: "SOURCE_VERIFIED",
      apiBaseUrl: env.VITE_API_BASE_URL ?? null,
      healthUrl:
        env.VITE_API_BASE_URL && env.VITE_API_HEALTH_PATH
          ? `${env.VITE_API_BASE_URL.replace(/\/+$/u, "")}/${env.VITE_API_HEALTH_PATH.replace(/^\/+/u, "")}`
          : null,
      withCredentials: env.VITE_API_WITH_CREDENTIALS ?? null,
      note: "Local/sample contract from .env.example. Deployed values are injected outside source.",
    },
    uat: {
      status: "PENDING",
      owner: "DevOps",
      jira: "WWHN-294",
      requires: deployedRequirements,
    },
    prod: {
      status: "PENDING",
      owner: "DevOps",
      jira: "WWHN-294",
      requires: deployedRequirements,
    },
  },
  commandRuns: runs,
  externalGates: [
    {
      jira: "WWHN-294",
      role: "DevOps",
      scope: "prod provisioning/hardening, environment matrix, rollback",
      status: "Blocked/Pending",
    },
    {
      jira: "WWHN-295",
      role: "BE1",
      scope: "backend runtime/config/health on the deployed build",
      status: "In Progress",
    },
    {
      jira: "WWHN-297",
      role: "QA1",
      scope: "security/health readiness evidence on the deployed build",
      status: "Blocked/Pending",
    },
    {
      jira: "WWHN-79",
      role: "PM + DevOps + BA/QA",
      scope: "parent Go/No-Go",
      status: "Blocked/Pending",
    },
    {
      jira: "WWHN-25",
      role: "PM/PO + Process Owner",
      scope: "DEC-STK-001 Decision Record",
      status: "In Progress",
    },
  ],
};

writeFileSync(
  join(evidenceDir, "RUNTIME_IDENTITY_PIN.json"),
  `${JSON.stringify(pin, null, 2)}\n`,
);

// SHA256SUMS covers EVERY file in the evidence pack (WWHN-231 lesson: a quoted
// artifact missing from the refreshed manifest reads as "not retrievable"), not
// just the files this particular run happened to list.
const hashedFiles = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (entry.name !== "SHA256SUMS")
      hashedFiles.push(toPosix(relative(evidenceDir, absolute)));
  }
};
walk(evidenceDir);
const sums = hashedFiles
  .sort()
  .map(
    (rel) =>
      `${createHash("sha256")
        .update(readFileSync(join(evidenceDir, rel)))
        .digest("hex")}  ${rel}`,
  )
  .join("\n");
writeFileSync(join(evidenceDir, "SHA256SUMS"), `${sums}\n`);

const failed = runs.filter((run) => run.status === "FAIL");
console.log(
  `[wwhn-296] identity pinned at FE ${pin.frontend.sha ?? "unknown"} / BE ${pin.backend.sha ?? "unknown"}; ` +
    `${runs.filter((run) => run.status === "PASS").length}/${runs.length} commands passed.`,
);
if (failed.length) {
  console.error(
    `[wwhn-296] FAILED: ${failed.map((run) => run.command).join(", ")}`,
  );
  process.exit(1);
}
