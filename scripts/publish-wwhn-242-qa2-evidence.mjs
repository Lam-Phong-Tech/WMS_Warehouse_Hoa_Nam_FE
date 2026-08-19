#!/usr/bin/env node
/**
 * WWHN-242 — publish bằng chứng QA2 vào nơi RETRIEVABLE (FE242-P1-01/P1-03/P2-01).
 *
 * VẤN ĐỀ GỐC mà script này sửa: các vòng review trước đều để bằng chứng nằm ở
 * `test-results/wwhn-242/<sha>/`, mà `test-results/` bị `.gitignore` nuốt (dòng 52).
 * Nghĩa là bất kỳ ai clone repo tại đúng SHA đó cũng KHÔNG lấy được ảnh/JSON — đúng
 * như review nói: "cần QA2 evidence retrievable và exact frozen SHA". Bằng chứng chỉ
 * tồn tại trên máy người chạy thì về mặt hồ sơ là không tồn tại.
 *
 * Script chép bộ bằng chứng sang `docs/evidence/WWHN-242/qa2/` (được commit) và ghim
 * lại ba thứ để không thể nguỵ tạo:
 *   1. `evidenceSourceSha` — SHA 40 ký tự của cây đã chạy, KHÔNG phải "local-uncommitted".
 *   2. SHA-256 từng tệp — đổi ảnh mà không chạy lại là đỏ ở cổng verify.
 *   3. Trạng thái sạch/bẩn của ĐÚNG tập tệp thuộc phạm vi hoàn đảo. Nhánh `m1` luôn có
 *      phiên khác làm song song nên "cây sạch toàn repo" là điều kiện sai và không bao
 *      giờ đạt; điều đúng phải chứng minh là các tệp quyết định hành vi REV-00/REV-01
 *      không bẩn tại thời điểm chụp.
 *
 * Dùng:
 *   node scripts/publish-wwhn-242-qa2-evidence.mjs            # SHA = git HEAD
 *   node scripts/publish-wwhn-242-qa2-evidence.mjs --sha=<40hex>
 *   node scripts/publish-wwhn-242-qa2-evidence.mjs --allow-dirty-scope   # chỉ để soi thử
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  QA2_MATRIX,
  QA2_VIEWPORTS,
  WWHN_242_SCOPE_DIRS,
  WWHN_242_SCOPE_PATHS,
  isScopePath,
} from "./wwhn-242-scope.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEST_REL = "docs/evidence/WWHN-242/qa2";
const dest = join(root, DEST_REL);

const args = process.argv.slice(2);
const allowDirtyScope = args.includes("--allow-dirty-scope");
const shaArg = args.find((a) => a.startsWith("--sha="))?.slice("--sha=".length);
const sourceArg = args
  .find((a) => a.startsWith("--source="))
  ?.slice("--source=".length);

function git(...gitArgs) {
  return execFileSync("git", gitArgs, { cwd: root, encoding: "utf8" }).trim();
}

function die(message) {
  console.error(`WWHN-242 publish: FAIL\n  - ${message}`);
  process.exit(1);
}

// ───────────────────── 1. SHA phải là SHA thật, không phải nhãn ─────────────────────

const sha = shaArg ?? process.env.SOURCE_SHA ?? git("rev-parse", "HEAD");
if (!/^[0-9a-f]{40}$/u.test(sha)) {
  die(
    `SHA "${sha}" không phải commit 40 ký tự. Bằng chứng gắn nhãn "local-uncommitted" không dùng được để đóng task — commit trước rồi chạy lại.`,
  );
}

// ───────────────── 2. Tệp thuộc phạm vi hoàn đảo phải sạch tại SHA đó ─────────────────

const porcelain = git(
  "status",
  "--porcelain",
  "--",
  ...WWHN_242_SCOPE_PATHS,
  ...WWHN_242_SCOPE_DIRS,
);
const dirtyScopeFiles = porcelain
  .split("\n")
  .map((line) => line.slice(3).trim())
  .filter((line) => line.length > 0)
  .filter((line) => isScopePath(line));

if (dirtyScopeFiles.length > 0 && !allowDirtyScope) {
  die(
    `còn ${dirtyScopeFiles.length} tệp thuộc phạm vi WWHN-242 chưa commit, nên SHA ${sha.slice(0, 12)} KHÔNG mô tả đúng cây đã chạy:\n      ${dirtyScopeFiles.join("\n      ")}\n    Commit các tệp này rồi chạy lại (hoặc --allow-dirty-scope nếu chỉ xem thử, KHÔNG dùng để đóng task).`,
  );
}

// ───────────────────────── 3. Đọc bộ bằng chứng nguồn ─────────────────────────

const sourceDir = join(
  root,
  sourceArg ?? join("test-results", "wwhn-242", sha),
);
if (!existsSync(sourceDir)) {
  die(
    `không thấy thư mục bằng chứng ${sourceDir}. Chạy: SOURCE_SHA=${sha} npm run test:e2e:wwhn-242`,
  );
}

const sourceFiles = readdirSync(sourceDir)
  .filter((name) => name.endsWith(".png") || name.endsWith(".json"))
  .sort();
if (sourceFiles.length === 0) die(`${sourceDir} rỗng.`);

/** `WWHN-242__<scenario>__<role>__<WxH>.<ext>` */
function parseName(name) {
  const match = /^WWHN-242__(.+?)__(.+?)__(\d+x\d+)\.(png|json)$/u.exec(name);
  if (!match) return null;
  return {
    scenario: match[1],
    role: match[2],
    viewport: match[3],
    ext: match[4],
  };
}

// ───────────────── 4. Ma trận QA2 phải phủ đủ TRƯỚC khi publish ─────────────────

const seen = new Map();
for (const name of sourceFiles) {
  const parsed = parseName(name);
  if (!parsed || parsed.ext !== "png") continue;
  if (!seen.has(parsed.scenario)) seen.set(parsed.scenario, new Set());
  seen.get(parsed.scenario).add(parsed.viewport);
}

const gaps = [];
for (const row of QA2_MATRIX) {
  const viewports = seen.get(row.scenario);
  if (!viewports) {
    gaps.push(`thiếu toàn bộ ảnh cho ca "${row.scenario}" (${row.title})`);
    continue;
  }
  if (row.perViewport) {
    const missing = QA2_VIEWPORTS.filter((v) => !viewports.has(v));
    if (missing.length > 0) {
      gaps.push(`ca "${row.scenario}" thiếu khổ: ${missing.join(", ")}`);
    }
  }
}
if (gaps.length > 0) {
  die(`ma trận QA2 chưa phủ đủ:\n      ${gaps.join("\n      ")}`);
}

// ───────────────────────── 5. Chép + băm + ghi manifest ─────────────────────────

if (existsSync(dest)) {
  // Xoá bằng chứng của SHA cũ: trộn hai đợt chạy trong một thư mục là cách nhanh nhất
  // để reviewer đọc nhầm ảnh cũ thành bằng chứng mới.
  for (const name of readdirSync(dest)) {
    if (name.endsWith(".png") || name.endsWith(".json")) {
      rmSync(join(dest, name));
    }
  }
} else {
  mkdirSync(dest, { recursive: true });
}

const files = [];
for (const name of sourceFiles) {
  copyFileSync(join(sourceDir, name), join(dest, name));
  const buffer = readFileSync(join(dest, name));
  files.push({
    name,
    bytes: statSync(join(dest, name)).size,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  });
}

/** Kết quả 5 cổng của lượt chạy gần nhất, nếu có, để manifest tự mang bối cảnh. */
let gates = null;
const pinPath = join(root, "docs/evidence/WWHN-242/RUNTIME_IDENTITY_PIN.json");
if (existsSync(pinPath)) {
  try {
    const pin = JSON.parse(readFileSync(pinPath, "utf8"));
    gates = {
      sourceSha: pin.sourceSha ?? pin.headSha ?? null,
      summary: pin.summary ?? null,
    };
  } catch {
    gates = null;
  }
}

const coverage = {};
for (const [scenario, viewports] of seen) {
  coverage[scenario] = [...viewports].sort();
}

const manifest = {
  ticket: "WWHN-242",
  register: ["FE242-P1-01", "FE242-P1-03", "FE242-P2-01"],
  screen: "REV-00 / REV-01 (Hoàn đảo)",
  evidenceClass: "FE_CONTROLLED_NOT_UAT",
  evidenceSourceSha: sha,
  scopeCleanAtSha: dirtyScopeFiles.length === 0,
  dirtyScopeFiles,
  scopePaths: [...WWHN_242_SCOPE_PATHS, ...WWHN_242_SCOPE_DIRS],
  requiredViewports: QA2_VIEWPORTS,
  matrixRows: QA2_MATRIX.length,
  screenshotCount: files.filter((f) => f.name.endsWith(".png")).length,
  coverage,
  gates,
  files,
  truthBoundary:
    "Bằng chứng FE có kiểm soát (payload mock deterministic) trên đúng cây tại evidenceSourceSha. Chứng minh HÀNH VI FE trước hợp đồng reversal; KHÔNG chứng minh backend cắt data scope (việc đó do Wwhn242ReversalScopeAndProjectionTest phía BE), KHÔNG thay QA độc lập và KHÔNG phải UAT.",
};

writeFileSync(
  join(dest, "MANIFEST.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

writeFileSync(
  join(dest, "SHA256SUMS"),
  `${files.map((f) => `${f.sha256}  ${f.name}`).join("\n")}\n`,
  "utf8",
);

// ───────────────────────── 6. INDEX.md — ma trận QA2 đọc được ─────────────────────────

function evidenceLinks(scenario) {
  const names = files
    .filter(
      (f) =>
        f.name.endsWith(".png") && parseName(f.name)?.scenario === scenario,
    )
    .map((f) => f.name)
    .sort();
  return names
    .map((n) => `[${parseName(n).viewport}](./${encodeURIComponent(n)})`)
    .join("<br />");
}

const indexLines = [
  "# WWHN-242 — Ma trận bằng chứng QA2 (REV-00 / REV-01)",
  "",
  `**Exact frozen SHA:** \`${sha}\``,
  "",
  `**Lớp bằng chứng:** \`FE_CONTROLLED_NOT_UAT\` — payload mock deterministic, chạy trên đúng cây tại SHA trên.`,
  "Bằng chứng này KHÔNG thay lượt chạy độc lập của QA2 và KHÔNG phải UAT; nó là bộ",
  "ca kiểm thử + ảnh để QA2 đối chiếu và chạy lại, kèm neo tài liệu cho từng ca.",
  "",
  `**Tệp thuộc phạm vi hoàn đảo tại SHA này:** ${manifest.scopeCleanAtSha ? "sạch (đã commit toàn bộ)" : `CÒN BẨN — ${dirtyScopeFiles.length} tệp`}.`,
  "",
  "## Cách kiểm chứng lại (không cần tin lời FE)",
  "",
  "```bash",
  `git checkout ${sha}`,
  `SOURCE_SHA=${sha} npm run test:e2e:wwhn-242`,
  "npm run verify:wwhn-242",
  "```",
  "",
  "Băm lại toàn bộ ảnh và so với `SHA256SUMS` trong cùng thư mục:",
  "",
  "```bash",
  "sha256sum -c SHA256SUMS",
  "```",
  "",
  "## Ma trận",
  "",
  "| # | Ca kiểm thử | Neo tài liệu | Kỳ vọng | Ảnh (khổ màn hình) |",
  "| --- | --- | --- | --- | --- |",
];

QA2_MATRIX.forEach((row, index) => {
  indexLines.push(
    `| ${index + 1} | ${row.title} | ${row.anchor} | ${row.expected} | ${evidenceLinks(row.scenario)} |`,
  );
});

indexLines.push(
  "",
  "## Ghi chú ranh giới",
  "",
  "- Bốn khổ bắt buộc của FE242-P2-01: " + QA2_VIEWPORTS.join(", ") + ".",
  "- Mỗi ảnh có một tệp `.json` cùng tên chứa metadata (route, role, assertion, timestamp).",
  "- Data scope phía backend được chứng minh riêng bằng `Wwhn242ReversalScopeAndProjectionTest`",
  "  (7/7 PASS) trong repo BE, không phải bằng ảnh chụp UI.",
  "",
);

writeFileSync(join(dest, "INDEX.md"), `${indexLines.join("\n")}\n`, "utf8");

console.log(`WWHN-242 publish: OK`);
console.log(`  SHA          ${sha}`);
console.log(
  `  Nguồn        ${sourceArg ?? join("test-results", "wwhn-242", sha)}`,
);
console.log(`  Đích         ${DEST_REL} (được commit — retrievable)`);
console.log(`  Tệp          ${files.length} (${manifest.screenshotCount} ảnh)`);
console.log(
  `  Ma trận      ${QA2_MATRIX.length} ca, đủ 4 khổ cho ${QA2_MATRIX.filter((r) => r.perViewport).length} ca`,
);
