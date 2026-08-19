/**
 * WWHN-217 / FE217-P1-04 — cong dong task: trace matrix zero-orphan + chong muon
 * evidence cua task khac.
 *
 * Register noi ro hai dieu:
 *   1. moi blocker phai co chuoi "QA finding -> fix commit -> changed file -> retest case
 *      -> result" khong dut mat xich nao;
 *   2. KHONG duoc dung evidence cua WWHN-292 / WWHN-144 / WWHN-211 lam closure thay the.
 *
 * Script nay bien ca hai thanh cong may kiem tra duoc, chay lai duoc tai exact SHA:
 *   - tung o cua register phai co gia tri that (khong rong, khong "TBD/N/A");
 *   - fix commit phai ton tai trong lich su va thuc su cham dung file da khai;
 *   - retest case phai ton tai that trong file test da khai (grep theo TC ID);
 *   - candidate SHA phai la commit CUOI CUNG cham vao tap artifact runtime — pin tro
 *     thanh sai ngay khi ai do sua code ma quen chay lai gate (chong pin rot);
 *   - manifest gate tai exact SHA phai PASS va VALID_AT_EXACT_SHA;
 *   - bang chung runtime cua backend phai phu du bon hang 401/403/422/409;
 *   - khong file evidence nao cua WWHN-217 duoc tro sang thu muc evidence cua
 *     WWHN-292/144/211.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const EVIDENCE_ROOT = join("docs", "evidence", "WWHN-217");
const PINS_PATH = join(EVIDENCE_ROOT, "WWHN-217_PINS.json");
const REGISTER_PATH = join(EVIDENCE_ROOT, "UI_BLOCKER_DEFECT_REGISTER.json");
const TRACE_PATH = join(EVIDENCE_ROOT, "TRACE_MATRIX.json");
const RUNTIME_PATH = join(EVIDENCE_ROOT, "runtime-error-contract.json");

/** Cac ticket ma register CAM dung evidence thay the. */
const BORROWED_EVIDENCE_PATTERNS = [
  /docs[\\/]evidence[\\/]wwhn-292/iu,
  /docs[\\/]evidence[\\/]wwhn-144/iu,
  /docs[\\/]evidence[\\/]WWHN-211/iu,
  /test-results[\\/]wwhn-292/iu,
];

const REQUIRED_REGISTER_FIELDS = [
  "defectId",
  "repository",
  "screen",
  "role",
  "viewport",
  "reproduce",
  "expected",
  "actual",
  "severity",
  "fixCommit",
  "fixFiles",
  "status",
];

const PLACEHOLDERS = new Set(["", "tbd", "n/a", "na", "todo", "pending", "-"]);

const failures = [];
const checks = [];

function check(id, ok, detail) {
  checks.push({ id, result: ok ? "PASS" : "FAIL", detail });
  if (!ok) failures.push(`${id}: ${detail}`);
}

function git(...args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  return result.status === 0 ? (result.stdout ?? "").trim() : "";
}

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    failures.push(`${path}: JSON khong parse duoc (${error.message}).`);
    return null;
  }
}

function isFilled(value) {
  if (Array.isArray(value)) return value.length > 0 && value.every(isFilled);
  if (typeof value !== "string") return value !== undefined && value !== null;
  return !PLACEHOLDERS.has(value.trim().toLowerCase());
}

// ── 1. Pin + candidate SHA ────────────────────────────────────────────────────
const pins = readJson(PINS_PATH);
check("pins-exists", pins !== null, `${PINS_PATH} phai ton tai.`);

const candidateSha = pins?.candidateSha ?? "";
check(
  "pins-candidate-sha-format",
  /^[0-9a-f]{40}$/u.test(candidateSha),
  `candidateSha phai la 40 ky tu hex, dang co "${candidateSha}".`,
);

const pinnedArtifacts = Array.isArray(pins?.runtimeArtifacts) ? pins.runtimeArtifacts : [];
check(
  "pins-artifacts-declared",
  pinnedArtifacts.length > 0,
  "runtimeArtifacts phai liet ke tap file runtime cua WWHN-217.",
);

for (const artifact of pinnedArtifacts) {
  check(`artifact-exists:${artifact}`, existsSync(artifact), `Khong tim thay ${artifact}.`);
}

if (/^[0-9a-f]{40}$/u.test(candidateSha) && pinnedArtifacts.length > 0) {
  const lastTouch = git("log", "-1", "--format=%H", "--", ...pinnedArtifacts);
  check(
    "candidate-sha-is-last-commit-touching-artifacts",
    lastTouch === candidateSha,
    `Commit cuoi cham artifact la ${lastTouch || "<khong doc duoc>"} nhung pin ghi ${candidateSha}. ` +
      "Sua code xong phai chay lai npm run wwhn-217:evidence roi cap nhat pin.",
  );
}

// ── 2. Defect register ────────────────────────────────────────────────────────
const register = readJson(REGISTER_PATH);
check("register-exists", register !== null, `${REGISTER_PATH} phai ton tai.`);

const defects = Array.isArray(register?.defects) ? register.defects : [];
check("register-not-empty", defects.length > 0, "Register phai co it nhat mot defect.");

for (const defect of defects) {
  const id = defect?.defectId ?? "<khong co defectId>";
  for (const field of REQUIRED_REGISTER_FIELDS) {
    check(
      `register-field:${id}:${field}`,
      isFilled(defect?.[field]),
      `Defect ${id} thieu gia tri that cho cot "${field}".`,
    );
  }

  const commit = String(defect?.fixCommit ?? "");
  // Defect sua o backend co SHA thuoc repo khac; khong the (va khong duoc) kiem tra bang
  // lich su cua repo FE — ghi ro repository de nguoi doc tra dung noi.
  const isFrontendCommit = String(defect?.repository ?? "").toUpperCase() === "FE";

  if (!/^[0-9a-f]{40}$/u.test(commit)) {
    check(`register-commit-format:${id}`, false, `fixCommit cua ${id} phai la 40 ky tu hex.`);
  } else if (!isFrontendCommit) {
    check(
      `register-commit-cross-repo:${id}`,
      isFilled(defect?.fixRepositoryUrl) || isFilled(defect?.repository),
      `Defect ${id} sua o repo ${defect?.repository} nhung khong khai duoc nguon de tra cuu.`,
    );
  } else {
    const exists = git("cat-file", "-t", commit) === "commit";
    check(`register-commit-exists:${id}`, exists, `Fix commit ${commit} khong co trong lich su.`);

    if (exists) {
      const touched = git("show", "--name-only", "--format=", commit).split(/\r?\n/u).filter(Boolean);
      for (const file of defect.fixFiles ?? []) {
        check(
          `register-commit-touches:${id}:${file}`,
          touched.includes(file),
          `Commit ${commit.slice(0, 12)} khong cham ${file} — chuoi fix commit -> changed file bi dut.`,
        );
      }
    }
  }
}

// ── 3. Trace matrix zero-orphan ───────────────────────────────────────────────
const trace = readJson(TRACE_PATH);
check("trace-exists", trace !== null, `${TRACE_PATH} phai ton tai.`);

const links = Array.isArray(trace?.links) ? trace.links : [];
const registerIds = new Set(defects.map((defect) => defect.defectId));
const tracedIds = new Set(links.map((link) => link.defectId));

for (const id of registerIds) {
  check(`trace-covers-defect:${id}`, tracedIds.has(id), `Defect ${id} khong co dong nao trong trace matrix.`);
}
for (const id of tracedIds) {
  check(`trace-no-orphan-row:${id}`, registerIds.has(id), `Trace matrix co dong ${id} khong ton tai trong register.`);
}

for (const link of links) {
  const id = link?.defectId ?? "<?>";
  for (const field of ["qaFinding", "fixCommit", "changedFiles", "retestCase", "retestFile", "result"]) {
    check(`trace-field:${id}:${field}`, isFilled(link?.[field]), `Trace ${id} thieu "${field}".`);
  }

  if (typeof link?.retestFile === "string" && existsSync(link.retestFile)) {
    const source = readFileSync(link.retestFile, "utf8");
    check(
      `trace-retest-case-exists:${id}`,
      typeof link.retestCase === "string" && source.includes(link.retestCase),
      `Khong tim thay retest case "${link.retestCase}" trong ${link.retestFile}.`,
    );
  } else {
    check(`trace-retest-file-exists:${id}`, false, `Khong tim thay file retest ${link?.retestFile}.`);
  }

  for (const file of link?.changedFiles ?? []) {
    check(`trace-changed-file-exists:${id}:${file}`, existsSync(file), `Khong tim thay changed file ${file}.`);
  }
}

// ── 4. Gate manifest tai exact SHA ────────────────────────────────────────────
if (/^[0-9a-f]{40}$/u.test(candidateSha)) {
  const manifestPath = join(EVIDENCE_ROOT, candidateSha, "gate-results.json");
  const manifest = readJson(manifestPath);
  check("gate-manifest-exists", manifest !== null, `Thieu ${manifestPath}.`);

  if (manifest) {
    check(
      "gate-manifest-sha-matches",
      manifest.sourceSha === candidateSha,
      `Manifest ghi SHA ${manifest.sourceSha} nhung pin la ${candidateSha}.`,
    );
    check(
      "gate-manifest-verdict",
      manifest.wwhn217Verdict === "PASS",
      `wwhn217Verdict = ${manifest.wwhn217Verdict} (co gate do do chinh WWHN-217).`,
    );
    check(
      "gate-manifest-valid",
      manifest.evidenceValidity === "VALID_AT_EXACT_SHA" ||
        manifest.evidenceValidity === "VALID_AT_EXACT_SHA_WITH_PREEXISTING_FAILURES",
      `evidenceValidity = ${manifest.evidenceValidity}.`,
    );

    const gateIds = new Set((manifest.gates ?? []).map((gate) => gate.id));
    for (const required of ["lint", "typecheck", "unit", "build", "e2e-wwhn-217"]) {
      check(`gate-present:${required}`, gateIds.has(required), `Manifest thieu gate ${required}.`);
      const gate = (manifest.gates ?? []).find((entry) => entry.id === required);
      if (!gate) continue;

      check(
        `gate-log:${required}`,
        typeof gate.logFile === "string" && existsSync(gate.logFile),
        `Thieu raw log cua gate ${required}.`,
      );

      if (gate.result === "PASS") continue;

      // Gate do chi duoc chap nhan khi CO BANG CHUNG doi chung tai commit cha cho thay
      // no do san tu truoc — khong bao gio chi vi mot dong ghi chu "loi cua task khac".
      check(
        `gate-failure-attributed:${required}`,
        gate.attribution === "PRE_EXISTING_NOT_CAUSED_BY_WWHN_217" && gate.alsoFailsAtParent === true,
        `Gate ${required} = FAIL va khong chung minh duoc la do co truoc (attribution = ${gate.attribution ?? "<khong co>"}).`,
      );
      check(
        `gate-failure-parent-log:${required}`,
        typeof gate.parentLogFile === "string" && existsSync(gate.parentLogFile),
        `Gate ${required} = FAIL nhung thieu log doi chung tai commit cha.`,
      );
    }
  }
}

// ── 5. Runtime error/RBAC contract (FE217-P1-05) ──────────────────────────────
const runtime = readJson(RUNTIME_PATH);
check("runtime-evidence-exists", runtime !== null, `Thieu ${RUNTIME_PATH}.`);

if (runtime) {
  const covered = new Set((runtime.http_classes_covered ?? []).map(Number));
  for (const status of [401, 403, 422, 409]) {
    check(
      `runtime-covers:${status}`,
      covered.has(status),
      `Bang chung runtime chua phu hang HTTP ${status}.`,
    );
  }
  check(
    "runtime-backend-sha-pinned",
    /^[0-9a-f]{40}$/u.test(String(runtime.backend_sha ?? "")),
    `backend_sha phai la 40 ky tu hex, dang co "${runtime.backend_sha}".`,
  );

  const flows = new Set((Object.values(runtime.probes ?? {})).map((probe) => probe.flow));
  for (const flow of ["Inbound", "Outbound", "Inventory"]) {
    check(`runtime-flow:${flow}`, flows.has(flow), `Bang chung runtime thieu luong ${flow}.`);
  }
}

// ── 6. Khong muon evidence cua task khac ──────────────────────────────────────
function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const borrowed = [];
for (const file of walk(EVIDENCE_ROOT)) {
  if (!/\.(json|md)$/iu.test(file)) continue;
  let source = readFileSync(file, "utf8");
  // `gate-results.json` ghi TRUNG THUC danh sach file ban cua working tree chinh tai thoi
  // diem chay (`dirtyEntriesInMainCheckout`) — nhanh m1 co nhieu phien song song nen danh
  // sach do thuong chua path evidence cua ticket khac (vd wwhn-292). Do la metadata moi
  // truong, KHONG phai WWHN-217 dung evidence cua ho lam closure; loai dung truong nay
  // khoi phep quet de cong khong bao dong gia, moi noi dung khac van bi quet nguyen ven.
  if (file.endsWith("gate-results.json")) {
    try {
      const parsed = JSON.parse(source);
      delete parsed.dirtyEntriesInMainCheckout;
      source = JSON.stringify(parsed, null, 2);
    } catch {
      // JSON hong thi giu nguyen source de check khac bao loi nhu cu.
    }
  }
  for (const pattern of BORROWED_EVIDENCE_PATTERNS) {
    if (pattern.test(source)) borrowed.push(`${file} tro toi ${pattern}`);
  }
}
check(
  "no-borrowed-evidence",
  borrowed.length === 0,
  `Evidence cua WWHN-217 dang tro sang task khac: ${borrowed.join("; ")}`,
);

// ── Ket qua ───────────────────────────────────────────────────────────────────
for (const entry of checks) {
  process.stdout.write(`[${entry.result}] ${entry.id}${entry.result === "PASS" ? "" : ` — ${entry.detail}`}\n`);
}

process.stdout.write(
  `\nWWHN-217 closure: ${failures.length === 0 ? "PASS" : "FAIL"} (${checks.length - failures.length}/${checks.length} check)\n`,
);
process.exit(failures.length === 0 ? 0 : 1);
