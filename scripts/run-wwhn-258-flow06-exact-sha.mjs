/**
 * WWHN-258 / FE258-P1-01 — chạy cổng "Flow 06 FE Exact SHA" tại LOCAL, trên đúng
 * một commit, và sinh evidence gắn SHA 40 ký tự.
 *
 * Vì sao có script này thay vì bấm lại workflow:
 * quota GitHub Actions của dự án đã dùng hết 3.000/3.000 phút, nên mọi lần chạy
 * thêm đều phát sinh chi phí. Register FE258-P1-01 đòi "Run SUCCESS + exact
 * 40-char SHA + tất cả steps PASS"; script này tái lập ĐÚNG chuỗi bước của
 * `.github/workflows/flow06-fe-exact-sha.yml` (không sửa file workflow, không
 * trigger CI) và ghi lại raw log từng bước để bằng chứng kiểm chứng lại được.
 *
 * Cách chạy mặc định (`--in-place` để chạy thẳng trên working tree):
 *   1. tạo git worktree DETACHED tại candidate SHA — nhánh `m1` có nhiều phiên
 *      làm song song nên working tree gần như luôn bẩn, chạy thẳng sẽ cho ra kết
 *      quả của "m1 + việc dở của người khác", không phải của candidate;
 *   2. nối `node_modules` của repo chính sang worktree (junction/symlink);
 *   3. chạy chuỗi bước; 4. ghi log + manifest; 5. dọn worktree.
 *
 * Lưu ý về `swagger-api.json`: file này nằm trong `.gitignore` nên KHÔNG có mặt
 * trong checkout sạch — hệt như runner của GitHub. `check:api-mapping` khi đó
 * chỉ kiểm hằng số/register phía FE và tự khai điều đó. Manifest ghi rõ trạng
 * thái này để người ký không nhầm là đã đối chiếu OpenAPI của BE.
 */
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const inPlace = args.includes("--in-place");
const shaArg = args.find((value) => value.startsWith("--sha="));
const expectShaArg = args.find((value) => value.startsWith("--expect-sha="));

function git(...gitArgs) {
  const result = spawnSync("git", gitArgs, { encoding: "utf8" });
  if (result.status !== 0) return "";
  return (result.stdout ?? "").trim();
}

/**
 * Gỡ worktree AN TOÀN: phải gỡ junction `node_modules` TRƯỚC.
 * `git worktree remove --force` xoá đệ quy, và trên Windows việc xoá đệ quy có
 * thể đi XUYÊN QUA junction rồi xoá sạch `node_modules` THẬT của repo chính —
 * đã xảy ra một lần ở WWHN-217 và làm hỏng cả các phiên đang chạy song song.
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
  spawnSync("git", ["worktree", "remove", "--force", path], {
    encoding: "utf8",
  });
}

function sha256(path) {
  return new Promise((resolvePromise, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolvePromise(hash.digest("hex")));
  });
}

const repoRoot = resolve(process.cwd());
const sourceSha = shaArg
  ? shaArg.slice("--sha=".length)
  : git("rev-parse", "HEAD");

if (!/^[0-9a-f]{40}$/u.test(sourceSha)) {
  console.error(
    `[WWHN-258] SHA không hợp lệ (${sourceSha || "<rỗng>"}). Cần đúng 40 ký tự hex.`,
  );
  process.exit(1);
}

// `--expect-sha` để người ký khẳng định TRƯỚC mình đang đo commit nào; sai thì
// dừng, thay vì lặng lẽ sinh evidence cho một commit khác (bẫy pin rot).
if (expectShaArg) {
  const expected = expectShaArg.slice("--expect-sha=".length);
  if (expected !== sourceSha) {
    console.error(
      `[WWHN-258] --expect-sha=${expected} không khớp SHA sắp đo (${sourceSha}).`,
    );
    process.exit(1);
  }
}

const branch = git("rev-parse", "--abbrev-ref", "HEAD");
const shortSha = sourceSha.slice(0, 12);
const committedAt = git("log", "-1", "--format=%cI", sourceSha);
const commitSubject = git("log", "-1", "--format=%s", sourceSha);
const porcelain = git("status", "--porcelain");
const treeState = porcelain === "" ? "clean" : "dirty";

const evidenceDir = join("docs", "evidence", "WWHN-258", sourceSha);
mkdirSync(join(repoRoot, evidenceDir), { recursive: true });

/** Sáu file mà bước "Flow 06 formatting" của workflow kiểm đích danh. */
const FORMAT_TARGETS = [
  "src/modules/outbound/services/alignedOutboundService.ts",
  "src/modules/outbound/components/AlignedOutboundDetailModal.tsx",
  "src/modules/outbound/pages/AlignedMvpOutboundPage.tsx",
  "src/modules/reports/pages/AlignedReportsPage.tsx",
  "src/test/flow06-packing-label-alignment.test.ts",
  "src/test/flow06-report-pagination-export.test.ts",
];

/**
 * Bước "Current-baseline documentation semantics" của workflow là một chuỗi
 * grep dưới `bash -e`: hai mệnh đề PHỦ ĐỊNH và bốn mệnh đề KHẲNG ĐỊNH.
 *
 * Bẫy đã dẫm (WWHN-258): khi tệp bị xoá, `! grep -Fq` vẫn "đúng" vì grep thoát
 * mã 2, còn `grep -Fq` thì hỏng — bước đỏ vì THIẾU TỆP chứ không vì sai nội
 * dung. Vì vậy ở đây tệp vắng mặt được báo là lỗi tường minh.
 */
const DOC_ASSERTIONS = [
  {
    file: "docs/HoaNam_Tai_lieu_tong_hop_Moi_Nhat.md",
    needle: "01 nhãn/item",
    mustExist: false,
  },
  {
    file: "docs/HoaNam_Tai_lieu_tong_hop_Moi_Nhat.md",
    needle: "PRODUCT bắt buộc active RFID trước Post Issue",
    mustExist: false,
  },
  {
    file: "docs/HoaNam_Tai_lieu_tong_hop_Moi_Nhat.md",
    needle: "đúng 01 Packing Label cho phiếu/lô",
    mustExist: true,
  },
  {
    file: "docs/HoaNam_ERD_Moi_Nhat.md",
    needle: "UNIQUE(outbound_document_id)",
    mustExist: true,
  },
  {
    file: "docs/HoaNam_ERD_Moi_Nhat.md",
    needle: "customer_phone",
    mustExist: true,
  },
  {
    file: "docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md",
    needle: "REPORT_EXPORT: 'report.export'",
    mustExist: true,
  },
];

/** Đúng thứ tự bước của `flow06-fe-exact-sha.yml`. */
const STEPS = [
  {
    id: "flow06-formatting",
    command: `npx prettier --check ${FORMAT_TARGETS.join(" ")}`,
  },
  { id: "documentation-semantics", kind: "doc-assertions" },
  { id: "lint", command: "npm run lint" },
  { id: "typecheck", command: "npm run typecheck" },
  {
    id: "flow06-tests",
    // Workflow chạy hai file Flow 06; WWHN-258 bổ sung bộ test hành vi PII/RBAC
    // của màn báo cáo nên nó chạy cùng chỗ, không tách ra một cổng riêng.
    command:
      "npx vitest run src/test/flow06-packing-label-alignment.test.ts src/test/flow06-report-pagination-export.test.ts src/test/wwhn-258-report-pii-rbac.test.tsx",
  },
  { id: "api-mapping", command: "npm run check:api-mapping" },
  { id: "build", command: "npm run build" },
];

let workdir = repoRoot;
let worktreePath = null;
const copiedEnvFiles = [];

if (!inPlace) {
  worktreePath = join(tmpdir(), `wwhn-258-${shortSha}`);
  if (existsSync(worktreePath)) {
    removeWorktree(worktreePath);
    rmSync(worktreePath, { recursive: true, force: true });
  }

  const add = spawnSync(
    "git",
    ["worktree", "add", "--detach", worktreePath, sourceSha],
    { encoding: "utf8" },
  );
  if (add.status !== 0) {
    console.error(
      `[WWHN-258] không tạo được worktree tại ${sourceSha}.\n${add.stderr ?? ""}`,
    );
    process.exit(1);
  }

  const link =
    process.platform === "win32"
      ? spawnSync(
          "cmd",
          [
            "/c",
            "mklink",
            "/J",
            join(worktreePath, "node_modules"),
            join(repoRoot, "node_modules"),
          ],
          { encoding: "utf8" },
        )
      : spawnSync(
          "ln",
          [
            "-s",
            join(repoRoot, "node_modules"),
            join(worktreePath, "node_modules"),
          ],
          { encoding: "utf8" },
        );
  if (link.status !== 0) {
    console.error(
      `[WWHN-258] không nối được node_modules sang worktree.\n${link.stderr ?? ""}`,
    );
    removeWorktree(worktreePath);
    process.exit(1);
  }

  for (const envFile of [".env", ".env.local", ".env.development.local"]) {
    const source = join(repoRoot, envFile);
    if (existsSync(source)) {
      copyFileSync(source, join(worktreePath, envFile));
      copiedEnvFiles.push(envFile);
    }
  }

  workdir = worktreePath;
  process.stdout.write(
    `[WWHN-258] worktree detached tại ${sourceSha} -> ${worktreePath}` +
      (copiedEnvFiles.length
        ? ` (chép env: ${copiedEnvFiles.join(", ")})`
        : "") +
      "\n",
  );
}

const results = [];
let failed = 0;

function runDocAssertions() {
  const lines = [];
  let ok = true;
  for (const assertion of DOC_ASSERTIONS) {
    const path = join(workdir, assertion.file);
    if (!existsSync(path)) {
      ok = false;
      lines.push(`FAIL  ${assertion.file} — TỆP KHÔNG TỒN TẠI`);
      continue;
    }
    const grep = spawnSync("grep", ["-Fq", assertion.needle, assertion.file], {
      cwd: workdir,
      encoding: "utf8",
    });
    const found = grep.status === 0;
    const pass = found === assertion.mustExist;
    if (!pass) ok = false;
    lines.push(
      `${pass ? "PASS" : "FAIL"}  ${assertion.mustExist ? "phải có" : "không được có"}` +
        ` "${assertion.needle}" trong ${assertion.file}`,
    );
  }
  return { ok, output: lines.join("\n") };
}

for (const step of STEPS) {
  const startedAt = Date.now();
  process.stdout.write(
    `\n[WWHN-258] ${step.id}: ${step.command ?? "kiểm ngữ nghĩa tài liệu baseline"}\n`,
  );

  let ok;
  let stdout;
  let stderr = "";
  let exitCode = 0;

  if (step.kind === "doc-assertions") {
    const outcome = runDocAssertions();
    ok = outcome.ok;
    stdout = outcome.output;
    exitCode = ok ? 0 : 1;
  } else {
    const run = spawnSync(step.command, {
      shell: true,
      cwd: workdir,
      encoding: "utf8",
      env: { ...process.env, SOURCE_SHA: sourceSha },
      maxBuffer: 64 * 1024 * 1024,
    });
    ok = run.status === 0;
    exitCode = run.status;
    stdout = run.stdout ?? "";
    stderr = run.stderr ?? "";
  }

  const durationMs = Date.now() - startedAt;
  const logFile = join(evidenceDir, `step-${step.id}.log`);
  writeFileSync(
    join(repoRoot, logFile),
    [
      `# WWHN-258 · bước ${step.id}`,
      `# candidate SHA: ${sourceSha}`,
      `# branch: ${branch}`,
      `# workdir: ${inPlace ? "repo working tree" : "detached worktree"}`,
      "",
      `$ ${step.command ?? "doc-assertions"}`,
      "",
      stdout,
      stderr,
    ].join("\n"),
    "utf8",
  );

  if (!ok) failed += 1;
  process.stdout.write(
    `[WWHN-258] ${step.id}: ${ok ? "PASS" : "FAIL"} (${Math.round(durationMs / 1000)}s) -> ${logFile}\n`,
  );

  results.push({
    id: step.id,
    command: step.command ?? "doc-assertions (grep baseline docs)",
    result: ok ? "PASS" : "FAIL",
    exitCode,
    durationMs,
    logFile: logFile.replace(/\\/gu, "/"),
    tail: `${stdout}\n${stderr}`.trim().split(/\r?\n/u).slice(-12).join("\n"),
  });
}

const swaggerPresent = existsSync(join(workdir, "swagger-api.json"));

if (worktreePath) {
  removeWorktree(worktreePath);
  process.stdout.write(`[WWHN-258] đã dọn worktree ${worktreePath}\n`);
}

const allPass = failed === 0;
const evidenceValidity =
  inPlace && treeState !== "clean"
    ? "INVALID_FOR_CLOSURE_DIRTY_TREE"
    : allPass
      ? "VALID_AT_EXACT_SHA"
      : "INVALID_FOR_CLOSURE_GATE_FAILED";

const manifest = {
  ticket: "WWHN-258",
  registerItem: "FE258-P1-01",
  repo: "WMS_Warehouse_Hoa_Nam_FE",
  branch: "m1",
  sourceSha,
  shortSha,
  commitSubject,
  committedAt,
  mirrors: ".github/workflows/flow06-fe-exact-sha.yml",
  runMode: inPlace ? "in-place-working-tree" : "detached-worktree-at-exact-sha",
  workingTreeStateOfMainCheckout: treeState,
  dirtyEntriesInMainCheckout: porcelain === "" ? [] : porcelain.split(/\r?\n/u),
  runner: "scripts/run-wwhn-258-flow06-exact-sha.mjs",
  nodeVersion: process.version,
  platform: `${process.platform}-${process.arch}`,
  copiedEnvFiles,
  overallResult: allPass ? "PASS" : "FAIL",
  evidenceValidity,
  steps: results,
  swaggerSpecPresent: swaggerPresent,
  truthBoundary: [
    "Cổng FE Flow 06 tại exact SHA, chạy LOCAL vì quota GitHub Actions đã dùng hết",
    "3.000/3.000 phút; đây không phải một run của GitHub và không có run_id.",
    swaggerPresent
      ? "swagger-api.json có mặt nên check:api-mapping đã đối chiếu BE_CONTRACT_PIN."
      : "swagger-api.json bị .gitignore nên vắng mặt trong checkout sạch — hệt runner GitHub; check:api-mapping chỉ kiểm hằng số/register FE, KHÔNG phải sign-off OpenAPI của BE.",
    "Không phải bằng chứng cưỡng chế phân quyền của backend (xem test BE ReportFlow06DocsAlignmentTest) và không phải UAT thiết bị thật của QA1.",
  ].join(" "),
};

const manifestPath = join(repoRoot, evidenceDir, "flow06-exact-sha.json");
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

const digest = await sha256(manifestPath);
writeFileSync(
  join(repoRoot, evidenceDir, "SHA256SUMS"),
  `${digest}  flow06-exact-sha.json\n`,
  "utf8",
);

process.stdout.write(
  `\n[WWHN-258] tổng: ${allPass ? "PASS" : "FAIL"} — ${evidenceValidity} @ ${sourceSha}\n` +
    `[WWHN-258] manifest digest sha256: ${digest}\n`,
);
process.exit(allPass ? 0 : 1);
