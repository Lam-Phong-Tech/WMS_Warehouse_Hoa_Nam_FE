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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = join(root, "docs/evidence/WWHN-296");
const logDir = join(evidenceDir, "logs");
const backendRoot =
  process.env.WMS_BACKEND_ROOT ?? join(root, "../../HoaNam_BE/WMS_Warehouse_Hoa_Nam_BE");

const skip = new Set(
  (process.argv.find((arg) => arg.startsWith("--skip="))?.slice("--skip=".length) ?? "")
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

function repoIdentity(cwd, label) {
  if (!existsSync(cwd)) {
    return { available: false, reason: `${label} repository not found at ${cwd}` };
  }
  const sha = git(cwd, "rev-parse HEAD");
  const status = git(cwd, "status --porcelain");
  return {
    available: sha !== null,
    branch: git(cwd, "rev-parse --abbrev-ref HEAD"),
    sha,
    // A dirty tree means the SHA does not describe what was actually executed.
    workingTreeClean: status === "",
    uncommittedFiles: status ? status.split(/\r?\n/u).length : 0,
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
  console.log(`[wwhn-296] ${exitCode === 0 ? "PASS" : "FAIL"} npm run ${script} (exit ${exitCode})`);
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
  schemaVersion: "1.0.0",
  jira: "WWHN-296",
  finding: "FE296-P1-02",
  canonicalBranch: "m1",
  generatedAt: new Date().toISOString(),
  generator: "npm run wwhn-296:evidence",
  frontend: {
    repository: "https://github.com/Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE",
    ...repoIdentity(root, "frontend"),
    nodeVersion: process.version,
    buildId: buildManifest ? `${buildManifest.artifactVersion}+${buildManifest.sourceSha}` : null,
    buildManifest,
  },
  backend: {
    repository: "https://github.com/Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_BE",
    ...repoIdentity(backendRoot, "backend"),
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
    uat: { status: "PENDING", owner: "DevOps", jira: "WWHN-294", requires: deployedRequirements },
    prod: { status: "PENDING", owner: "DevOps", jira: "WWHN-294", requires: deployedRequirements },
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
    { jira: "WWHN-79", role: "PM + DevOps + BA/QA", scope: "parent Go/No-Go", status: "Blocked/Pending" },
    {
      jira: "WWHN-25",
      role: "PM/PO + Process Owner",
      scope: "DEC-STK-001 Decision Record",
      status: "In Progress",
    },
  ],
};

writeFileSync(join(evidenceDir, "RUNTIME_IDENTITY_PIN.json"), `${JSON.stringify(pin, null, 2)}\n`);

const hashedFiles = [
  "RUNTIME_IDENTITY_PIN.json",
  ...runs.map((run) => run.log).filter(Boolean).map((log) => log.replace("docs/evidence/WWHN-296/", "")),
];
const sums = hashedFiles
  .map((rel) => {
    const absolute = join(evidenceDir, rel);
    if (!existsSync(absolute)) return null;
    return `${createHash("sha256").update(readFileSync(absolute)).digest("hex")}  ${rel}`;
  })
  .filter(Boolean)
  .join("\n");
writeFileSync(join(evidenceDir, "SHA256SUMS"), `${sums}\n`);

const failed = runs.filter((run) => run.status === "FAIL");
console.log(
  `[wwhn-296] identity pinned at FE ${pin.frontend.sha ?? "unknown"} / BE ${pin.backend.sha ?? "unknown"}; ` +
    `${runs.filter((run) => run.status === "PASS").length}/${runs.length} commands passed.`,
);
if (failed.length) {
  console.error(`[wwhn-296] FAILED: ${failed.map((run) => run.command).join(", ")}`);
  process.exit(1);
}
