#!/usr/bin/env node
/**
 * WWHN-274 / FE274-P1-02 + FE274-P2-02 — verifier cho candidate pin cua FE release sign-off.
 *
 * Review R3 (84/100) de P1-02 OPEN vi "chua pin candidate SHA chinh thuc cho reviewer".
 * Nhanh `m1` duoc nhieu phien dung chung nen pin theo HEAD rot chi sau vai phut; pin
 * hash-ca-tep cung do gia voi file DUNG CHUNG (package.json, playwright.config.ts —
 * moi ticket deu sua). Ap dung dung mo hinh da duoc chap nhan o HN-PIN-222/328/184:
 *
 *   - File THUOC SO HUU WWHN-274 (3 spec e2e, 2 script, workflow yml): pin sha256 ca tep.
 *     Workflow yml chi duoc DOC de hash — verifier khong sua/khong chay CI.
 *   - File DUNG CHUNG: pin sha256 cua phan trich xuat dung cac DOI TUONG WWHN-274
 *     so huu (cac script `wwhn-274*` trong package.json; cac project/testIgnore
 *     `wwhn-274-*` trong playwright.config.ts). Ticket khac sua phan khac -> pin van
 *     xanh; ai dung dung doi tuong WWHN-274 -> pin do, phai review lai.
 *   - implementation_range: moi commit tung cham tap artifact so huu. Verifier kiem
 *     (a) moi commit ton tai va la ancestor cua HEAD, (b) BAT BIEN DAI: toan bo lich
 *     su `git log -- <owned paths>` phai la tap con cua implementation_range va
 *     commit moi nhat phai dung bang candidate_sha — commit la cham artifact ma chua
 *     duoc review se lam pin do.
 *   - evidence_runs: manifest exact-SHA phai ton tai, dung SHA da tuyen bo, treeState
 *     clean; cac spec controlled/a11y phai IDENTICAL giua SHA sinh evidence va
 *     candidate (bang chung hop le theo dong nhat noi dung, khong theo HEAD).
 *
 * Che do chay:
 *   node scripts/verify-wwhn-274-candidate-pin.mjs
 *   node scripts/verify-wwhn-274-candidate-pin.mjs --expect-sha=<40-hex>   # cong deploy
 *   node scripts/verify-wwhn-274-candidate-pin.mjs --write                 # ghi lai pin (kem review)
 *   node scripts/verify-wwhn-274-candidate-pin.mjs --out <file.json>       # xuat report
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const PIN_PATH = "docs/evidence/WWHN-274/RC_PIN.json";

const args = process.argv.slice(2);
const write = args.includes("--write");
const expectSha =
  (args.find((a) => a.startsWith("--expect-sha=")) ?? "").split("=")[1] ?? null;

const pin = JSON.parse(fs.readFileSync(PIN_PATH, "utf8"));
const failures = [];

const sha256text = (text) =>
  crypto.createHash("sha256").update(text).digest("hex");
const sha256 = (file) => sha256text(fs.readFileSync(file));
const git = (...a) => {
  try {
    return execFileSync("git", a, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
};

/* ---- Trich xuat doi tuong WWHN-274 trong file dung chung ---- */
const EXTRACTORS = {
  "package-json-wwhn274-scripts": (content) => {
    const scripts = JSON.parse(content).scripts ?? {};
    const owned = Object.entries(scripts)
      .filter(
        ([key, value]) =>
          key.includes("wwhn-274") || String(value).includes("wwhn-274"),
      )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`);
    if (owned.length === 0) return "EXTRACTOR_MISS";

    return owned.join("\n");
  },
  "playwright-wwhn274-objects": (content) => {
    // Cac project block `{ name: "wwhn-274-..." ... },` (ket thuc o dong "    }," 4 space
    // dau tien sau block — moi khoi long ben trong thut sau hon theo prettier cua repo).
    const blocks =
      content.match(/\{\s*\n\s*name: "wwhn-274-[\s\S]*?\n {4}\},/g) ?? [];
    // Moi dong le nhac toi wwhn-274 ngoai block (vd. testIgnore cua project chromium).
    const inBlocks = blocks.join("\n");
    const lines = content
      .split("\n")
      .filter(
        (line) => line.includes("wwhn-274") && !inBlocks.includes(line.trim()),
      )
      .map((line) => line.trim())
      .sort();
    if (blocks.length === 0 && lines.length === 0) return "EXTRACTOR_MISS";

    return [...blocks, ...lines].join("\n---\n");
  },
};

/* ---- 1. Noi dung artifact ---- */
const owned = pin.owned_artifacts ?? {};
const computed = {};
for (const [relative, expected] of Object.entries(owned)) {
  const absolute = path.resolve(relative);
  if (!fs.existsSync(absolute)) {
    failures.push(`Artifact bat buoc bi thieu: ${relative}`);
    continue;
  }
  const extractorId =
    expected && typeof expected === "object" ? expected.extractor : null;
  if (extractorId) {
    const extractor = EXTRACTORS[extractorId];
    if (!extractor) {
      failures.push(
        `${relative}: khong ro extractor "${extractorId}" khai trong pin.`,
      );
      continue;
    }
    const extracted = extractor(fs.readFileSync(absolute, "utf8"));
    if (extracted === "EXTRACTOR_MISS") {
      failures.push(
        `${relative}: extractor "${extractorId}" khong tim thay doi tuong WWHN-274 — cau truc file da doi, phai review lai.`,
      );
      continue;
    }
    computed[relative] = {
      extractor: extractorId,
      sha256: sha256text(extracted),
    };
  } else {
    computed[relative] = sha256(absolute);
  }
}

if (write) {
  pin.owned_artifacts = computed;
  pin.pinned_at_head = git("rev-parse", "HEAD");
  pin.pinned_at_branch = git("rev-parse", "--abbrev-ref", "HEAD");
  fs.writeFileSync(PIN_PATH, `${JSON.stringify(pin, null, 2)}\n`);
  console.log(
    `WWHN-274 pin da ghi lai ${Object.keys(computed).length} artifact tai HEAD ${pin.pinned_at_head}.`,
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

for (const [relative, expected] of Object.entries(owned)) {
  if (computed[relative] === undefined) continue;
  if (expected === null) {
    failures.push(
      `Pin chua ghi hash cho ${relative} — chay --write kem review truoc khi dung lam evidence.`,
    );
    continue;
  }
  const isBlock = expected && typeof expected === "object";
  const expectedHash = isBlock ? expected.sha256 : expected;
  const computedHash = isBlock
    ? computed[relative]?.sha256
    : computed[relative];
  if (computedHash !== expectedHash) {
    failures.push(
      isBlock
        ? `Doi tuong WWHN-274 so huu trong ${relative} da doi so voi candidate da pin (extractor "${expected.extractor}").\n` +
            `        pinned  : ${expectedHash}\n` +
            `        current : ${computedHash}`
        : `Noi dung ${relative} da doi so voi candidate da pin.\n` +
            `        pinned  : ${expectedHash}\n` +
            `        current : ${computedHash}`,
    );
  }
}

/* ---- 2. Cong deploy: HEAD phai dung SHA duoc tuyen bo ---- */
const head = git("rev-parse", "HEAD");
if (expectSha !== null) {
  if (!/^[0-9a-f]{40}$/.test(expectSha)) {
    failures.push(
      `--expect-sha phai la SHA 40 ky tu hex, nhan duoc: ${expectSha}`,
    );
  } else if (head !== expectSha) {
    failures.push(
      `HEAD (${head}) khac SHA duoc tuyen bo (${expectSha}). Bang chung khong hop le.`,
    );
  }
}

/* ---- 3. Bat bien dai commit tren tap artifact so huu ---- */
const range = pin.implementation_range ?? [];
for (const rangeSha of range) {
  if (!/^[0-9a-f]{40}$/.test(rangeSha)) {
    failures.push(`implementation_range chua SHA khong hop le: ${rangeSha}`);
    continue;
  }
  if (git("cat-file", "-t", rangeSha) !== "commit") {
    failures.push(
      `Commit ${rangeSha} trong implementation_range khong ton tai trong repo.`,
    );
    continue;
  }
  if (head !== null && head !== rangeSha) {
    try {
      execFileSync("git", ["merge-base", "--is-ancestor", rangeSha, head], {
        stdio: "ignore",
      });
    } catch {
      failures.push(
        `Commit ${rangeSha} trong implementation_range khong con nam trong lich su cua HEAD ${head}. ` +
          "Nhanh da bi rewrite — phai review lai candidate.",
      );
    }
  }
}

const fullHashPaths = Object.entries(owned)
  .filter(([, expected]) => !(expected && typeof expected === "object"))
  .map(([relative]) => relative);
const historyRaw = git("log", "--format=%H", "HEAD", "--", ...fullHashPaths);
const history = historyRaw ? historyRaw.split("\n").filter(Boolean) : [];
if (history.length === 0) {
  failures.push("Khong doc duoc lich su commit cua tap artifact so huu.");
} else {
  const unlisted = history.filter((sha) => !range.includes(sha));
  if (unlisted.length > 0) {
    failures.push(
      `Co commit cham tap artifact WWHN-274 nhung CHUA duoc liet ke/review trong implementation_range:\n` +
        unlisted.map((sha) => `        - ${sha}`).join("\n"),
    );
  }
  if (pin.candidate_sha && history[0] !== pin.candidate_sha) {
    failures.push(
      `candidate_sha da pin (${pin.candidate_sha}) khong con la commit cuoi cham artifact ` +
        `(hien tai: ${history[0]}). Candidate da rot — phai review va re-pin.`,
    );
  }
}

/* ---- 4. Evidence runs: ton tai + dung SHA + treeState clean + dong nhat noi dung ---- */
const evidence = pin.evidence_runs ?? {};
if (evidence.exact_sha_manifest) {
  const manifestPath = path.resolve(evidence.exact_sha_manifest);
  if (!fs.existsSync(manifestPath)) {
    failures.push(
      `Manifest exact-SHA bi thieu: ${evidence.exact_sha_manifest}`,
    );
  } else {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      const manifestSha = manifest.sha ?? manifest.sourceSha ?? null;
      if (evidence.evidence_sha && manifestSha !== evidence.evidence_sha) {
        failures.push(
          `Manifest exact-SHA ghi SHA ${manifestSha}, khac evidence_sha da pin (${evidence.evidence_sha}).`,
        );
      }
      const treeState = manifest.treeState ?? manifest.tree_state ?? null;
      if (treeState !== "clean") {
        failures.push(
          `Manifest exact-SHA co treeState="${treeState}" — chi manifest sinh tren cay SACH moi dung duoc lam evidence dong task.`,
        );
      }
    } catch {
      failures.push(
        `Manifest exact-SHA khong parse duoc: ${evidence.exact_sha_manifest}`,
      );
    }
  }
}
for (const requiredFile of evidence.required_files ?? []) {
  if (!fs.existsSync(path.resolve(requiredFile))) {
    failures.push(`Evidence bat buoc bi thieu: ${requiredFile}`);
  }
}
// Bang chung hop le theo DONG NHAT NOI DUNG: cac spec sinh evidence tai evidence_sha
// phai identical voi noi dung tai candidate_sha.
if (
  evidence.evidence_sha &&
  pin.candidate_sha &&
  evidence.evidence_sha !== pin.candidate_sha
) {
  for (const specPath of evidence.content_identity_paths ?? []) {
    const atEvidence = git("show", `${evidence.evidence_sha}:${specPath}`);
    const atCandidate = git("show", `${pin.candidate_sha}:${specPath}`);
    if (atEvidence === null || atCandidate === null) {
      failures.push(
        `Khong doc duoc ${specPath} tai evidence_sha/candidate_sha de doi chieu.`,
      );
      continue;
    }
    if (sha256text(atEvidence) !== sha256text(atCandidate)) {
      failures.push(
        `${specPath} KHAC nhau giua evidence_sha ${evidence.evidence_sha.slice(0, 7)} va ` +
          `candidate_sha ${pin.candidate_sha.slice(0, 7)} — evidence khong con dai dien cho candidate, phai chay lai gate.`,
      );
    }
  }
}

const report = {
  pin_id: pin.pin_id,
  jira: pin.jira,
  checked_at_head: head,
  pinned_at_head: pin.pinned_at_head ?? null,
  candidate_sha: pin.candidate_sha ?? null,
  expect_sha: expectSha,
  artifact_count: Object.keys(owned).length,
  failures,
  status: failures.length === 0 ? "PASS" : "FAIL",
};

const outIndex = args.findIndex((a) => a === "--out");
if (outIndex !== -1 && args[outIndex + 1]) {
  fs.mkdirSync(path.dirname(path.resolve(args[outIndex + 1])), {
    recursive: true,
  });
  fs.writeFileSync(args[outIndex + 1], `${JSON.stringify(report, null, 2)}\n`);
}

if (failures.length > 0) {
  console.error("WWHN-274 candidate pin: FAIL");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(
  `WWHN-274 candidate pin: PASS (${report.artifact_count} artifact, candidate ${String(pin.candidate_sha).slice(0, 7)}, HEAD ${head})`,
);
