/**
 * WWHN-217 / FE217-P1-03 — Exact-SHA gate runner cho candidate FE.
 *
 * Register doi: "Pin exact FE candidate SHA va chay lint/typecheck/test/build tren
 * candidate do", closure evidence = "Raw logs hoac CI run gan 40-char SHA".
 *
 * Van de that trong repo nay: nhanh `m1` duoc NHIEU phien lam viec song song, nen
 * working tree gan nhu luc nao cung ban vi thay doi cua task khac. Chay gate thang tren
 * working tree se cho ra ket qua cua "m1 + rac cua nguoi khac", khong phai cua candidate
 * SHA — dung loai bang chung ma register tu choi. Vi vay mac dinh runner:
 *
 *   1. tao mot git worktree DETACHED tai dung candidate SHA (khong tao nhanh moi),
 *   2. noi node_modules cua repo chinh sang worktree do (junction/symlink),
 *   3. chay chuoi gate trong worktree,
 *   4. ghi raw log + manifest gan 40-char SHA vao repo chinh,
 *   5. don worktree.
 *
 * `--in-place` chay thang tren working tree; khi do manifest tu ha
 * `evidenceValidity` xuong INVALID_FOR_CLOSURE_DIRTY_TREE neu tree ban — khong bao gio
 * im lang nhan ket qua ban la bang chung dong task.
 *
 * Quy gan trach nhiem khi gate do: KHONG co co che "bo qua". Moi gate FAIL deu duoc chay
 * LAI tai commit CHA cua candidate trong mot worktree thu hai, kem log doi chung
 * `parent-gate-<id>.log`. Do o ca hai noi = mau do co san cua ticket khac
 * (`PRE_EXISTING_NOT_CAUSED_BY_WWHN_217`); chi do o candidate = regression cua WWHN-217.
 * `overallResult` van ghi dung su that (FAIL), rieng `wwhn217Verdict` moi la ket luan
 * "WWHN-217 co lam vo gi khong".
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const inPlace = args.includes("--in-place");
const onlyArg = args.find((value) => value.startsWith("--only="));
const only = onlyArg ? onlyArg.slice("--only=".length).split(",") : null;
const shaArg = args.find((value) => value.startsWith("--sha="));

function git(...gitArgs) {
  const result = spawnSync("git", gitArgs, { encoding: "utf8" });
  if (result.status !== 0) return "";
  return (result.stdout ?? "").trim();
}

/**
 * Go worktree AN TOAN.
 *
 * BAT BUOC go junction/symlink `node_modules` TRUOC. `git worktree remove --force` xoa
 * de quy noi dung worktree; tren Windows, viec xoa de quy co the di XUYEN QUA junction va
 * xoa sach `node_modules` THAT cua repo chinh — da xay ra mot lan trong phien nay, lam
 * hong ca cac phien khac dang lam song song tren `m1`. `rmdir` (khong /s) chi go lien ket,
 * khong dung toi thu muc dich.
 */
function removeWorktree(path) {
  if (!existsSync(path)) return;

  const linkPath = join(path, "node_modules");
  if (existsSync(linkPath)) {
    if (process.platform === "win32") {
      spawnSync("cmd", ["/c", "rmdir", linkPath], { encoding: "utf8" });
    } else {
      spawnSync("rm", [linkPath], { encoding: "utf8" });
    }
  }

  spawnSync("git", ["worktree", "remove", "--force", path], { encoding: "utf8" });
}

const repoRoot = resolve(process.cwd());
const sourceSha = shaArg ? shaArg.slice("--sha=".length) : git("rev-parse", "HEAD");

if (!/^[0-9a-f]{40}$/u.test(sourceSha)) {
  console.error(
    `WWHN-217 exact-SHA runner: SHA khong hop le (${sourceSha || "<rong>"}). Can dung 40 ky tu hex.`,
  );
  process.exit(1);
}

const branch = git("rev-parse", "--abbrev-ref", "HEAD");
const shortSha = sourceSha.slice(0, 12);
const committedAt = git("log", "-1", "--format=%cI", sourceSha);
const commitSubject = git("log", "-1", "--format=%s", sourceSha);
const porcelain = git("status", "--porcelain");
const treeState = porcelain === "" ? "clean" : "dirty";

const evidenceDir = join("docs", "evidence", "WWHN-217", sourceSha);
mkdirSync(evidenceDir, { recursive: true });

/** Dung chuoi gate ma register FE217-P1-03 goi ten, cong e2e retest cua FE217-P1-02. */
const GATES = [
  { id: "lint", command: "npm run lint" },
  { id: "typecheck", command: "npm run typecheck" },
  { id: "unit", command: "npm run test" },
  { id: "build", command: "npm run build" },
  { id: "e2e-wwhn-217", command: "npm run test:e2e:wwhn-217" },
];

const selected = only ? GATES.filter((gate) => only.includes(gate.id)) : GATES;
if (selected.length === 0) {
  console.error(`WWHN-217 exact-SHA runner: --only khong khop gate nao (${only?.join(",")}).`);
  process.exit(1);
}

let workdir = repoRoot;
let worktreePath = null;
const copiedEnvFiles = [];

if (!inPlace) {
  worktreePath = join(tmpdir(), `wwhn-217-${shortSha}`);
  if (existsSync(worktreePath)) {
    removeWorktree(worktreePath);
    rmSync(worktreePath, { recursive: true, force: true });
  }

  const add = spawnSync("git", ["worktree", "add", "--detach", worktreePath, sourceSha], {
    encoding: "utf8",
  });
  if (add.status !== 0) {
    console.error(
      `WWHN-217 exact-SHA runner: khong tao duoc worktree tai ${sourceSha}.\n${add.stderr ?? ""}`,
    );
    process.exit(1);
  }

  // node_modules khong nam trong commit; noi sang thu muc cua repo chinh de khong phai
  // cai lai (va de dung DUNG bo dependency da dung khi phat trien).
  const link = process.platform === "win32"
    ? spawnSync("cmd", ["/c", "mklink", "/J", join(worktreePath, "node_modules"), join(repoRoot, "node_modules")], { encoding: "utf8" })
    : spawnSync("ln", ["-s", join(repoRoot, "node_modules"), join(worktreePath, "node_modules")], { encoding: "utf8" });

  if (link.status !== 0) {
    console.error(
      `WWHN-217 exact-SHA runner: khong noi duoc node_modules sang worktree.\n${link.stderr ?? ""}`,
    );
    removeWorktree(worktreePath);
    process.exit(1);
  }

  // File cau hinh moi truong co chu dich KHONG nam trong commit (.gitignore). Worktree
  // sach vi vay khong co .env va app se render trang rong -> e2e do vi ly do sai. Chep
  // sang va ghi ro trong manifest de nguoi doc biet gate chay voi env nao.
  for (const envFile of [".env", ".env.local", ".env.development.local"]) {
    const source = join(repoRoot, envFile);
    if (existsSync(source)) {
      copyFileSync(source, join(worktreePath, envFile));
      copiedEnvFiles.push(envFile);
    }
  }

  workdir = worktreePath;
  process.stdout.write(
    `[WWHN-217] worktree detached tai ${sourceSha} -> ${worktreePath}` +
      (copiedEnvFiles.length ? ` (chep env: ${copiedEnvFiles.join(", ")})` : "") +
      "\n",
  );
}

const results = [];
let failed = 0;

for (const gate of selected) {
  const startedAt = Date.now();
  process.stdout.write(`\n[WWHN-217] ${gate.id}: ${gate.command}\n`);
  const run = spawnSync(gate.command, {
    shell: true,
    cwd: workdir,
    encoding: "utf8",
    env: {
      ...process.env,
      SOURCE_SHA: sourceSha,
      WWHN_217_EVIDENCE_DIR: join(repoRoot, "test-results", "wwhn-217", sourceSha),
    },
    maxBuffer: 64 * 1024 * 1024,
  });
  const durationMs = Date.now() - startedAt;
  const stdout = run.stdout ?? "";
  const stderr = run.stderr ?? "";
  const logFile = join(evidenceDir, `gate-${gate.id}.log`);
  writeFileSync(
    logFile,
    [
      `# WWHN-217 gate ${gate.id}`,
      `# candidate SHA: ${sourceSha}`,
      `# branch: ${branch}`,
      `# workdir: ${inPlace ? "repo working tree" : "detached worktree"}`,
      "",
      `$ ${gate.command}`,
      "",
      stdout,
      stderr,
    ].join("\n"),
    "utf8",
  );

  const ok = run.status === 0;
  if (!ok) failed += 1;
  process.stdout.write(
    `[WWHN-217] ${gate.id}: ${ok ? "PASS" : "FAIL"} (${Math.round(durationMs / 1000)}s) -> ${logFile}\n`,
  );

  results.push({
    id: gate.id,
    command: gate.command,
    result: ok ? "PASS" : "FAIL",
    exitCode: run.status,
    durationMs,
    logFile: logFile.replace(/\\/gu, "/"),
    tail: `${stdout}\n${stderr}`.trim().split(/\r?\n/u).slice(-15).join("\n"),
  });
}

if (worktreePath) {
  removeWorktree(worktreePath);
  process.stdout.write(`[WWHN-217] da don worktree ${worktreePath}\n`);
}

/**
 * Gate do vi task khac hay do WWHN-217?
 *
 * Nhanh `m1` co nhieu phien lam song song nen mot gate co the do sang mot mau do co san
 * cua ticket khac (vd pin ROT cua tai lieu, hop dong OpenAPI vua doi). Doan nay khong
 * "bo qua" gi ca: no chay LAI dung gate do tai commit CHA cua candidate. Do o ca hai noi
 * = do co truoc, khong phai do WWHN-217; chi do o candidate = WWHN-217 lam vo.
 * Ket qua ghi vao manifest de nguoi ky doc duoc, khong bien FAIL thanh PASS.
 */
const parentSha = git("rev-parse", `${sourceSha}^`);
const failing = results.filter((entry) => entry.result === "FAIL");

if (!inPlace && failing.length > 0 && /^[0-9a-f]{40}$/u.test(parentSha)) {
  const parentPath = join(tmpdir(), `wwhn-217-parent-${parentSha.slice(0, 12)}`);
  if (existsSync(parentPath)) {
    removeWorktree(parentPath);
    rmSync(parentPath, { recursive: true, force: true });
  }

  const add = spawnSync("git", ["worktree", "add", "--detach", parentPath, parentSha], {
    encoding: "utf8",
  });

  if (add.status === 0) {
    const link = process.platform === "win32"
      ? spawnSync("cmd", ["/c", "mklink", "/J", join(parentPath, "node_modules"), join(repoRoot, "node_modules")], { encoding: "utf8" })
      : spawnSync("ln", ["-s", join(repoRoot, "node_modules"), join(parentPath, "node_modules")], { encoding: "utf8" });

    if (link.status === 0) {
      for (const envFile of copiedEnvFiles) {
        copyFileSync(join(repoRoot, envFile), join(parentPath, envFile));
      }

      for (const entry of failing) {
        process.stdout.write(`\n[WWHN-217] doi chung tai commit cha ${parentSha.slice(0, 12)}: ${entry.id}\n`);
        const run = spawnSync(entry.command, {
          shell: true,
          cwd: parentPath,
          encoding: "utf8",
          env: { ...process.env, SOURCE_SHA: parentSha },
          maxBuffer: 64 * 1024 * 1024,
        });
        entry.alsoFailsAtParent = run.status !== 0;
        entry.parentSha = parentSha;
        const parentLog = join(evidenceDir, `parent-gate-${entry.id}.log`);
        writeFileSync(
          parentLog,
          [
            `# WWHN-217 doi chung gate ${entry.id} tai commit cha`,
            `# parent SHA: ${parentSha}`,
            "",
            `$ ${entry.command}`,
            "",
            run.stdout ?? "",
            run.stderr ?? "",
          ].join("\n"),
          "utf8",
        );
        entry.parentLogFile = parentLog.replace(/\\/gu, "/");
        entry.attribution = entry.alsoFailsAtParent
          ? "PRE_EXISTING_NOT_CAUSED_BY_WWHN_217"
          : "REGRESSION_INTRODUCED_BY_CANDIDATE";
        process.stdout.write(
          `[WWHN-217] ${entry.id} tai commit cha: ${entry.alsoFailsAtParent ? "cung do (do co truoc)" : "xanh (candidate lam vo)"}\n`,
        );
      }
    }

    removeWorktree(parentPath);
  }
}

const regressions = failing.filter((entry) => entry.attribution !== "PRE_EXISTING_NOT_CAUSED_BY_WWHN_217");
const allPass = failed === 0;
const wwhn217Verdict = regressions.length === 0 ? "PASS" : "FAIL";
const evidenceValidity = inPlace && treeState !== "clean"
  ? "INVALID_FOR_CLOSURE_DIRTY_TREE"
  : allPass
    ? "VALID_AT_EXACT_SHA"
    : regressions.length === 0
      ? "VALID_AT_EXACT_SHA_WITH_PREEXISTING_FAILURES"
      : "INVALID_FOR_CLOSURE_GATE_FAILED";

const manifest = {
  ticket: "WWHN-217",
  registerItem: "FE217-P1-03",
  sourceRegister: "WWHN-217 (nhanh canonical `m1`, khong phai `m1ee`) — xem FE217-P2-01",
  branch: "m1",
  sourceSha,
  shortSha,
  commitSubject,
  committedAt,
  runMode: inPlace ? "in-place-working-tree" : "detached-worktree-at-exact-sha",
  workingTreeStateOfMainCheckout: treeState,
  dirtyEntriesInMainCheckout: porcelain === "" ? [] : porcelain.split(/\r?\n/u),
  runner: "scripts/run-wwhn-217-exact-sha-evidence.mjs",
  generatedAt: new Date().toISOString(),
  nodeVersion: process.version,
  platform: `${process.platform}-${process.arch}`,
  copiedEnvFiles,
  overallResult: allPass ? "PASS" : "FAIL",
  wwhn217Verdict,
  wwhn217VerdictRule:
    "PASS khi khong gate nao do do chinh WWHN-217. Moi gate do deu duoc chay LAI tai commit cha; do o ca hai noi = do co truoc cua ticket khac (attribution PRE_EXISTING_NOT_CAUSED_BY_WWHN_217, kem log doi chung), chi do o candidate = regression cua WWHN-217.",
  parentSha: /^[0-9a-f]{40}$/u.test(parentSha) ? parentSha : null,
  preExistingFailures: failing
    .filter((entry) => entry.attribution === "PRE_EXISTING_NOT_CAUSED_BY_WWHN_217")
    .map((entry) => entry.id),
  regressions: regressions.map((entry) => entry.id),
  evidenceValidity,
  gates: results,
  truthBoundary:
    "Gate FE tai exact SHA (lint/typecheck/unit/build + e2e retest WWHN-217). Khong phai bang chung cuong che phan quyen cua backend (xem FE217-P1-05 runtime-error-contract.json) va khong phai UAT thiet bi that cua QA1.",
};

writeFileSync(
  join(evidenceDir, "gate-results.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

process.stdout.write(
  `\n[WWHN-217] gate tong: ${allPass ? "PASS" : "FAIL"} | verdict WWHN-217: ${wwhn217Verdict} — ${evidenceValidity} @ ${sourceSha}\n`,
);
if (!allPass && wwhn217Verdict === "PASS") {
  process.stdout.write(
    `[WWHN-217] gate do co truoc (khong do WWHN-217): ${failing.map((entry) => entry.id).join(", ")}. Xem parent-gate-*.log.\n`,
  );
}
process.exit(wwhn217Verdict === "PASS" ? 0 : 1);
