#!/usr/bin/env node
/**
 * WWHN-242 / FE242-P1-02 — chạy thật các cổng và ghim danh tính build đã chạy.
 *
 * Review từ chối "các lệnh đã liệt kê trong task doc" làm bằng chứng closure, và
 * đúng: một danh sách chứng minh ý định, không chứng minh exit code. Runner này
 * THỰC THI từng lệnh, ghi exit code / thời lượng / log thô, rồi ghim danh tính mà
 * chúng được chạy trên đó (FE SHA + trạng thái sạch/bẩn của working tree, BE SHA,
 * phiên bản node/npm, thời điểm).
 *
 * Nguyên tắc: không bịa. Lệnh nào không chạy được thì ghi PENDING kèm lý do; cổng
 * nào đỏ thì ghi đỏ, không làm tròn thành PASS.
 *
 * Dùng:
 *   node scripts/run-wwhn-242-evidence.mjs
 *   node scripts/run-wwhn-242-evidence.mjs --skip=build,test:e2e:wwhn-242
 */
import { execFileSync, execSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDir = join(root, "docs/evidence/WWHN-242");
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

/**
 * Cổng bắt buộc của WWHN-242. `lint` / `test` / `build` là ba lệnh review nêu đích
 * danh ở FE242-P1-02; phần còn lại là cổng riêng của task.
 */
const NPM_GATES = ["lint", "typecheck", "test", "build", "verify:wwhn-242"];

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
    return {
      available: false,
      reason: `${label} repository not found at ${cwd}`,
    };
  }
  const sha = git(cwd, "rev-parse HEAD");
  const status = git(cwd, "status --porcelain");
  return {
    available: sha !== null,
    label,
    path: cwd,
    branch: git(cwd, "rev-parse --abbrev-ref HEAD"),
    sha,
    // Working tree bẩn nghĩa là SHA KHÔNG mô tả đúng thứ vừa chạy. Ghi rõ để reviewer
    // không nhận nhầm một exact-SHA claim.
    workingTreeClean: status === "",
    dirtyFileCount:
      status === null ? null : status.split("\n").filter(Boolean).length,
  };
}

function toolVersion(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      shell: true,
    }).trim();
  } catch {
    return null;
  }
}

function runGate(name) {
  if (skip.has(name)) {
    return { gate: name, status: "SKIPPED", reason: "requested via --skip" };
  }

  const startedAt = new Date().toISOString();
  const started = Date.now();
  const result = spawnSync("npm", ["run", name], {
    cwd: root,
    encoding: "utf8",
    shell: true,
    maxBuffer: 64 * 1024 * 1024,
  });
  const durationMs = Date.now() - started;

  const logName = `${name.replace(/[^a-zA-Z0-9_-]+/g, "-")}.log`;
  const body = [
    `$ npm run ${name}`,
    `cwd: ${root}`,
    `startedAt: ${startedAt}`,
    `exitCode: ${result.status}`,
    "",
    "----- stdout -----",
    result.stdout ?? "",
    "----- stderr -----",
    result.stderr ?? "",
  ].join("\n");
  writeFileSync(join(logDir, logName), body, "utf8");

  return {
    gate: name,
    command: `npm run ${name}`,
    exitCode: result.status,
    status: result.status === 0 ? "PASS" : "FAIL",
    durationMs,
    startedAt,
    logFile: `logs/${logName}`,
  };
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

mkdirSync(logDir, { recursive: true });

const gates = NPM_GATES.map(runGate);

const identity = {
  ticket: "WWHN-242",
  screen: "REV-00 / REV-01",
  generatedAt: new Date().toISOString(),
  frontend: repoIdentity(root, "frontend"),
  backend: repoIdentity(backendRoot, "backend"),
  node: process.version,
  npm: toolVersion("npm", ["--version"]),
  platform: `${process.platform} ${process.arch}`,
  gates,
  summary: {
    total: gates.length,
    passed: gates.filter((gate) => gate.status === "PASS").length,
    failed: gates.filter((gate) => gate.status === "FAIL").length,
    skipped: gates.filter((gate) => gate.status === "SKIPPED").length,
  },
  truthBoundary:
    "Exit codes observed on this machine at generatedAt. Nếu workingTreeClean=false thì SHA KHÔNG mô tả đúng cây đã chạy; phải commit rồi chạy lại trước khi dùng làm exact-SHA evidence.",
};

writeFileSync(
  join(evidenceDir, "RUNTIME_IDENTITY_PIN.json"),
  `${JSON.stringify(identity, null, 2)}\n`,
  "utf8",
);

const checksumLines = readdirSync(logDir)
  .filter((name) => name.endsWith(".log"))
  .sort()
  .map((name) => `${sha256(join(logDir, name))}  logs/${name}`);
checksumLines.push(
  `${sha256(join(evidenceDir, "RUNTIME_IDENTITY_PIN.json"))}  RUNTIME_IDENTITY_PIN.json`,
);
writeFileSync(
  join(evidenceDir, "SHA256SUMS"),
  `${checksumLines.join("\n")}\n`,
  "utf8",
);

for (const gate of gates) {
  const detail =
    gate.status === "SKIPPED"
      ? gate.reason
      : `exit=${gate.exitCode} in ${gate.durationMs}ms → ${gate.logFile}`;
  console.log(`${gate.status.padEnd(7)} ${gate.gate.padEnd(18)} ${detail}`);
}
console.log(
  `\nWWHN-242 evidence → ${join(evidenceDir, "RUNTIME_IDENTITY_PIN.json")} (${identity.summary.passed}/${identity.summary.total} PASS)`,
);

process.exitCode = identity.summary.failed > 0 ? 1 : 0;
