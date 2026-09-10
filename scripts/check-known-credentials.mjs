#!/usr/bin/env node
/**
 * P0 bảo mật 10/09/2026 — chặn credential đã lộ và bí mật dạng khoá quay lại repo FE.
 *
 * VÌ SAO: mật khẩu canonical của tài khoản SUPER_ADMIN phía BE từng được chép vào các
 * script đo hiệu năng, script seed PowerShell và test của FE. Mật khẩu đó nằm vĩnh viễn
 * trong lịch sử git nên đã bị coi là lộ; cổng này giữ để nó không quay lại qua một bản
 * sao chép tiện tay. Quét MỌI tệp được git theo dõi và không bao giờ in giá trị bí mật.
 *
 * Dùng:
 *   node scripts/check-known-credentials.mjs              # thoát 1 nếu có vi phạm
 *   node scripts/check-known-credentials.mjs --self-test
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

/** Mật khẩu ĐÃ LỘ của dự án (vẫn nằm trong lịch sử git — phải xoay vòng ở mọi môi trường). */
const COMPROMISED_PASSWORDS = ["Cntt@1234"];

/** Nơi DUY NHẤT được phép chứa mật khẩu đã lộ. Thêm mục ở đây phải qua review bảo mật. */
const COMPROMISED_ALLOWLIST = new Map([["scripts/check-known-credentials.mjs", "Chính bộ quét này."]]);

const SECRET_RULES = [
  { id: "private-key", regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/ },
  { id: "github-token", regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/ },
  { id: "aws-access-key-id", regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { id: "slack-token", regex: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { id: "google-api-key", regex: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: "stripe-live-key", regex: /\b(?:sk|rk)_live_[0-9A-Za-z]{20,}\b/ },
];

/** Bộ quét tự chứa mẫu của chính các luật ở trên. */
const SECRET_RULE_ALLOWLIST = new Set(["scripts/check-known-credentials.mjs"]);

const MAX_BYTES = 8 * 1024 * 1024;

export function scanContent(path, content) {
  const violations = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const password of COMPROMISED_PASSWORDS) {
      if (line.includes(password) && !COMPROMISED_ALLOWLIST.has(path)) {
        violations.push({ path, line: index + 1, rule: "compromised-password" });
      }
    }

    if (SECRET_RULE_ALLOWLIST.has(path)) return;

    for (const rule of SECRET_RULES) {
      if (rule.regex.test(line)) violations.push({ path, line: index + 1, rule: rule.id });
    }
  });

  return violations;
}

function trackedFiles() {
  return execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .split("\0")
    .filter(Boolean);
}

function readTextFile(path) {
  try {
    if (statSync(path).size > MAX_BYTES) return null;
    const content = readFileSync(path, "utf8");
    return content.includes("\u0000") ? null : content;
  } catch {
    // Tệp đã xoá khỏi working tree nhưng chưa commit — không có gì để quét.
    return null;
  }
}

function selfTest() {
  const password = COMPROMISED_PASSWORDS[0];
  const cases = [
    ["mật khẩu đã lộ trong script đo tải", "scripts/perf/bench.mjs", `const PASSWORD = "${password}";`, ["compromised-password"]],
    // Ghép chuỗi để chính fixture không bị hook pre-commit nhận nhầm là khoá thật.
    ["khoá riêng PEM", "keys/id.pem", `-----BEGIN ${"OPENSSH"} PRIVATE KEY-----`, ["private-key"]],
    ["GitHub token", "notes.txt", `token=${"gho_"}${"b".repeat(36)}`, ["github-token"]],
    ["Google API key", "src/maps.ts", `const key = "${"AIza"}${"c".repeat(35)}";`, ["google-api-key"]],
    ["văn bản sạch", "src/app.ts", "const password = process.env.WMS_PERF_PASSWORD;", []],
  ];

  let failed = 0;
  for (const [name, path, content, expected] of cases) {
    const rules = scanContent(path, content).map((violation) => violation.rule);
    const ok = JSON.stringify(rules) === JSON.stringify(expected);
    if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name} (rules=${JSON.stringify(rules)}, expected=${JSON.stringify(expected)})`);
  }

  console.log(failed === 0 ? "\nself-test: PASS" : `\nself-test: FAIL (${failed} case)`);
  return failed === 0 ? 0 : 1;
}

function main() {
  if (process.argv.includes("--self-test")) {
    process.exit(selfTest());
  }

  const violations = [];
  let scanned = 0;

  for (const path of trackedFiles()) {
    const content = readTextFile(path);
    if (content === null) continue;
    scanned += 1;
    violations.push(...scanContent(path, content));
  }

  if (violations.length > 0) {
    console.error(`[credentials] FAIL: ${violations.length} vi phạm trong ${scanned} tệp được theo dõi (giá trị không được in ra):`);
    for (const violation of violations) {
      console.error(`  - ${violation.path}:${violation.line}  [${violation.rule}]`);
    }
    console.error("Gỡ bí mật khỏi tệp (dùng biến môi trường/secret store). Mật khẩu đã lộ phải được xoay vòng ở mọi môi trường đã triển khai.");
    process.exit(1);
  }

  console.log(`[credentials] PASS: ${scanned} tệp được theo dõi, không có mật khẩu đã lộ hay khoá bí mật.`);
}

main();
