/**
 * WWHN-274 / FE274-P1-01 — Exact-SHA release sign-off runner.
 *
 * Van de goc: register FE274-P1-01 noi "khong co exact-SHA workflow PASS/artifact truy xuat
 * duoc cho HEAD dang xet". Bang PASS/FAIL go tay trong tai lieu khong truy xuat duoc vi no
 * khong gan voi commit nao ca. Script nay chay dung chuoi gate cua
 * .github/workflows/wwhn-274-fe-release-signoff.yml roi ghi manifest gan chat vao:
 *   - candidate SHA (git rev-parse HEAD),
 *   - trang thai working tree (clean/dirty),
 *   - ket qua + thoi luong + duoi log cua tung gate.
 *
 * Fail-closed:
 *   - Working tree ban => evidenceValidity = INVALID_FOR_CLOSURE (tru khi --allow-dirty
 *     duoc dat, va ke ca khi do manifest van ghi ro la khong dung de dong task).
 *   - Bat ky gate nao do => exit code khac 0 va manifest ghi FAIL.
 *
 * Manifest nay la bang chung LOCAL tai exact SHA. No khong thay the run cua GitHub Actions
 * tren cung SHA; ca hai deu phai tro ve cung mot commit thi moi duoc coi la khop.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const allowDirty = args.includes("--allow-dirty");
const withRealEnv = args.includes("--with-real-env");
const onlyArg = args.find((value) => value.startsWith("--only="));
const only = onlyArg ? onlyArg.slice("--only=".length).split(",") : null;

function git(...gitArgs) {
  const result = spawnSync("git", gitArgs, { encoding: "utf8" });
  if (result.status !== 0) return "";
  return (result.stdout ?? "").trim();
}

const sourceSha = git("rev-parse", "HEAD");
const shortSha = git("rev-parse", "--short", "HEAD");
const branch = git("rev-parse", "--abbrev-ref", "HEAD");
const committedAt = git("log", "-1", "--format=%cI");
const commitSubject = git("log", "-1", "--format=%s");
const porcelain = git("status", "--porcelain");
const treeState = porcelain === "" ? "clean" : "dirty";

if (!sourceSha) {
  console.error("WWHN-274 exact-SHA runner: khong doc duoc git HEAD.");
  process.exit(1);
}

const evidenceDir = join("docs", "evidence", "WWHN-274", sourceSha);
mkdirSync(evidenceDir, { recursive: true });

/** Chuoi gate phai giu dung thu tu cua workflow de manifest so sanh duoc 1-1. */
const GATES = [
  { id: "source-contract", command: "npm run wwhn-274:verify" },
  { id: "format", command: "npm run format:check" },
  { id: "lint", command: "npm run lint" },
  { id: "typecheck", command: "npm run typecheck" },
  { id: "unit", command: "npm run test" },
  { id: "env-contract", command: "npm run env:verify" },
  { id: "api-mapping", command: "npm run check:api-mapping" },
  { id: "build", command: "npm run build" },
  { id: "health", command: "npm run health:check" },
  { id: "e2e-controlled", command: "npm run test:e2e:wwhn-274" },
  { id: "e2e-a11y-browser-matrix", command: "npm run test:e2e:wwhn-274:a11y" },
];

if (withRealEnv) {
  GATES.push({
    id: "e2e-real-env",
    command: "npm run test:e2e:wwhn-274:real-env",
    requiresEnv: ["WWHN_274_REAL_BASE_URL", "WWHN_274_REAL_API_BASE_URL"],
  });
}

const selected = only ? GATES.filter((gate) => only.includes(gate.id)) : GATES;
if (selected.length === 0) {
  console.error(`WWHN-274 exact-SHA runner: --only khong khop gate nao (${only?.join(",")}).`);
  process.exit(1);
}

const results = [];
let failed = 0;

for (const gate of selected) {
  const missingEnv = (gate.requiresEnv ?? []).filter((key) => !process.env[key]);
  if (missingEnv.length > 0) {
    console.error(
      `[WWHN-274] ${gate.id}: thieu bien moi truong ${missingEnv.join(", ")} -> FAIL (khong duoc skip im lang).`,
    );
    results.push({
      id: gate.id,
      command: gate.command,
      result: "FAIL",
      exitCode: null,
      durationMs: 0,
      reason: `Missing required environment: ${missingEnv.join(", ")}`,
    });
    failed += 1;
    continue;
  }

  const startedAt = Date.now();
  process.stdout.write(`\n[WWHN-274] ${gate.id}: ${gate.command}\n`);
  const run = spawnSync(gate.command, {
    shell: true,
    encoding: "utf8",
    env: { ...process.env, SOURCE_SHA: sourceSha, CI: process.env.CI ?? "" },
    maxBuffer: 64 * 1024 * 1024,
  });
  const durationMs = Date.now() - startedAt;
  const stdout = run.stdout ?? "";
  const stderr = run.stderr ?? "";
  const logFile = join(evidenceDir, `gate-${gate.id}.log`);
  writeFileSync(logFile, `$ ${gate.command}\n\n${stdout}\n${stderr}\n`, "utf8");

  const ok = run.status === 0;
  if (!ok) failed += 1;
  process.stdout.write(
    `[WWHN-274] ${gate.id}: ${ok ? "PASS" : "FAIL"} (${Math.round(durationMs / 1000)}s) -> ${logFile}\n`,
  );

  results.push({
    id: gate.id,
    command: gate.command,
    result: ok ? "PASS" : "FAIL",
    exitCode: run.status,
    durationMs,
    logFile: logFile.replace(/\\/gu, "/"),
    tail: `${stdout}\n${stderr}`.trim().split(/\r?\n/u).slice(-12).join("\n"),
  });
}

const allPass = failed === 0;
const evidenceValidity =
  treeState === "clean" && allPass
    ? "VALID_AT_EXACT_SHA"
    : treeState !== "clean"
      ? "INVALID_FOR_CLOSURE_DIRTY_TREE"
      : "INVALID_FOR_CLOSURE_GATE_FAILED";

const manifest = {
  ticket: "WWHN-274",
  finding: "FE274-P1-01",
  parent: "WWHN-72",
  parentTempKey: "HN-DEVOPS-003",
  repository: "https://github.com/Lam-Phong-Tech/WMS_Warehouse_Hoa_Nam_FE",
  branch,
  sourceSha,
  shortSha,
  commitSubject,
  committedAt,
  treeState,
  dirtyEntries: porcelain === "" ? [] : porcelain.split(/\r?\n/u),
  runner: "scripts/run-wwhn-274-exact-sha-evidence.mjs",
  runnerMode: withRealEnv ? "gates+real-env" : "gates",
  generatedAt: new Date().toISOString(),
  nodeVersion: process.version,
  platform: `${process.platform}-${process.arch}`,
  overallResult: allPass ? "PASS" : "FAIL",
  evidenceValidity,
  gates: results,
  truthBoundary:
    "Bang chung local tai exact SHA cho pham vi FE-owned (build/config/UI). Khong thay the run GitHub Actions tren cung SHA, khong phai QA1 release smoke (WWHN-275) va khong phai deploy/backup/rollback cua DevOps (WWHN-272).",
};

const manifestPath = join(evidenceDir, "gate-results.json");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const signoffPath = join(evidenceDir, "release-signoff.json");
writeFileSync(
  signoffPath,
  `${JSON.stringify(
    {
      ticket: "WWHN-274",
      parent: "WWHN-72",
      evidenceClass: "FE_CONTROLLED_NOT_QA_UAT",
      sourceSha,
      branch,
      environment: process.env.VITE_APP_ENV ?? "local",
      buildVersion: process.env.VITE_APP_VERSION ?? "local",
      apiBaseUrl: process.env.VITE_API_BASE_URL ?? "",
      healthPath: process.env.VITE_API_HEALTH_PATH ?? "/health",
      overallResult: manifest.overallResult,
      evidenceValidity,
      generatedAt: manifest.generatedAt,
      truthBoundary: manifest.truthBoundary,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

process.stdout.write(
  `\nWWHN-274 exact-SHA evidence: ${manifest.overallResult} (${evidenceValidity})\n` +
    `  SHA        : ${sourceSha}\n` +
    `  branch     : ${branch}\n` +
    `  tree       : ${treeState}\n` +
    `  manifest   : ${manifestPath}\n` +
    `  signoff    : ${signoffPath}\n`,
);

if (treeState !== "clean" && !allowDirty) {
  console.error(
    "WWHN-274: working tree ban -> bang chung nay KHONG duoc dung de dong task. " +
      "Commit truoc roi chay lai, hoac chay voi --allow-dirty de chi lay tin hieu pre-flight.",
  );
  process.exit(2);
}

if (!existsSync(manifestPath)) process.exit(1);
process.exit(allPass ? 0 : 1);
