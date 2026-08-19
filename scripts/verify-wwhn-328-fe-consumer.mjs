#!/usr/bin/env node
/**
 * WWHN-328 — cổng phía FE cho quan hệ consumer ↔ contract (DEV328-P1-04R4 / P1-05R4).
 *
 * `verify-wwhn-327-closure.mjs` bảo vệ **cách màn hình hiển thị**. Cổng này bảo vệ thứ
 * khác hẳn: **quan hệ giữa hai repo**. Register R4 mở lại P1-05 vì dependency FE ↔ BE chỉ
 * tồn tại trong lời văn của comment Jira (`issuelinks=[]`) — thứ gì chỉ sống trong lời văn
 * thì đứt mà không ai biết. Ở đây nó thành assert:
 *
 *   1. Pin khai đủ cặp SHA 40 ký tự (BE + FE) và version KPI matrix đang được ký.
 *   2. Bề mặt dashboard FE **không đổi** kể từ FE candidate — nếu đổi thì cặp mà QA2 chạy
 *      trên WWHN-329 không còn là cặp đang được ký.
 *   3. Field set FE tiêu thụ **bằng đúng** contract đã ký, không thừa không thiếu. Thừa một
 *      field là FE đang đọc thứ BE không cam kết; thiếu một field là KPI biến mất lặng lẽ.
 *   4. Register WWHN-327 và pin cùng nói một version matrix.
 *   5. Hai bẫy đọc số đã có sự cố: đếm cảnh báo bằng `reconciliation_warnings.length`
 *      (mảng có trần 50) và không khai ngoại lệ warranty GLOBAL khi đang bị giới hạn kho.
 *
 * Dùng:  node scripts/verify-wwhn-328-fe-consumer.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PIN_PATH = "docs/evidence/WWHN-327/WWHN-328_CONSUMER_PIN.json";
const SIGNED_MATRIX_VERSION = "v1.2";

const problems = [];
const notes = [];
const fail = (message) => problems.push(message);
const ok = (message) => notes.push(message);

function read(relative) {
  const absolute = join(ROOT, relative);
  if (!existsSync(absolute)) {
    fail("Thiếu artifact bắt buộc: " + relative);
    return null;
  }
  return readFileSync(absolute, "utf8");
}

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

const pinRaw = read(PIN_PATH);
const typesSource = read("src/modules/dashboard/types/index.ts");
const pageSource = read("src/modules/dashboard/pages/DashboardPage.tsx");
const registerRaw = read(
  "docs/evidence/WWHN-327/WWHN-327_CLOSURE_REGISTER.json",
);

let pin = null;
if (pinRaw) {
  try {
    pin = JSON.parse(pinRaw);
  } catch (error) {
    fail(PIN_PATH + ": không parse được JSON — " + error.message);
  }
}

// ── 1. Cặp SHA và version ───────────────────────────────────
if (pin) {
  const be = (pin.backendCandidate || {}).commit;
  const fe = (pin.frontendCandidate || {}).commit;
  if (!/^[0-9a-f]{40}$/.test(be || "")) {
    fail(
      PIN_PATH + ": backendCandidate.commit phải là SHA BE đầy đủ 40 ký tự.",
    );
  }
  if (!/^[0-9a-f]{40}$/.test(fe || "")) {
    fail(
      PIN_PATH + ": frontendCandidate.commit phải là SHA FE đầy đủ 40 ký tự.",
    );
  }
  if (pin.kpiMatrixVersion !== SIGNED_MATRIX_VERSION) {
    fail(
      PIN_PATH +
        ": kpiMatrixVersion phải là " +
        SIGNED_MATRIX_VERSION +
        ", đang là " +
        pin.kpiMatrixVersion,
    );
  }

  // ── 2. Bề mặt dashboard không đổi kể từ FE candidate ──────
  if (/^[0-9a-f]{40}$/.test(fe || "")) {
    let exists = true;
    try {
      git(["cat-file", "-e", fe + "^{commit}"]);
    } catch {
      exists = false;
      fail("FE candidate " + fe + " không tồn tại trong repo này.");
    }
    if (exists) {
      let changed = "";
      try {
        changed = git([
          "diff",
          "--name-only",
          fe,
          "HEAD",
          "--",
          "src/modules/dashboard",
        ]);
      } catch (error) {
        fail("Không so được diff dashboard từ candidate: " + error.message);
      }
      if (changed) {
        fail(
          "Bề mặt dashboard đã đổi sau FE candidate " +
            fe +
            " (" +
            changed.split(/\r?\n/).join(", ") +
            "). Cặp mà QA2 chạy trên WWHN-329 không còn là cặp đang được ký — pin lại rồi ký lại.",
        );
      } else {
        ok("bề mặt src/modules/dashboard bất biến kể từ FE candidate");
      }
    }
  }
}

// ── 3. Field set FE == contract đã ký ───────────────────────
if (pin && typesSource) {
  const declared = Array.isArray(pin.contractFields) ? pin.contractFields : [];
  if (declared.length === 0) fail(PIN_PATH + ": contractFields rỗng.");

  const block = typesSource.slice(
    typesSource.indexOf("export interface DashboardKPI"),
  );
  const consumed = (block.match(/^\s{2}([a-z_]+):/gm) || []).map((line) =>
    line.trim().replace(":", ""),
  );

  const missing = declared.filter((field) => !consumed.includes(field));
  const extra = consumed.filter((field) => !declared.includes(field));
  if (missing.length > 0) {
    fail("DashboardKPI thiếu field đã ký: " + missing.join(", "));
  }
  if (extra.length > 0) {
    fail(
      "DashboardKPI khai field ngoài contract đã ký: " +
        extra.join(", ") +
        " — FE đang đọc thứ BE không cam kết.",
    );
  }
  if (missing.length === 0 && extra.length === 0) {
    ok(declared.length + " field FE tiêu thụ khớp đúng contract đã ký");
  }
}

// ── 4. Register WWHN-327 cùng version ───────────────────────
if (registerRaw) {
  let register = null;
  try {
    register = JSON.parse(registerRaw);
  } catch (error) {
    fail("WWHN-327_CLOSURE_REGISTER.json: không parse được — " + error.message);
  }
  if (register) {
    if ((register.contract || {}).kpiMatrixVersion !== SIGNED_MATRIX_VERSION) {
      fail(
        "WWHN-327_CLOSURE_REGISTER.json: contract.kpiMatrixVersion phải là " +
          SIGNED_MATRIX_VERSION,
      );
    }
    if (register.pairedBackendTask !== "WWHN-328") {
      fail(
        "WWHN-327_CLOSURE_REGISTER.json: pairedBackendTask phải là WWHN-328",
      );
    }
    if (pin && Array.isArray(pin.contractFields)) {
      const same =
        JSON.stringify([...(register.contractFields || [])].sort()) ===
        JSON.stringify([...pin.contractFields].sort());
      if (!same) {
        fail("contractFields của register WWHN-327 lệch với pin WWHN-328.");
      } else {
        ok("register WWHN-327 và pin WWHN-328 cùng một field set");
      }
    }
  }
}

// ── 5. Hai bẫy đọc số đã từng có sự cố ──────────────────────
if (pageSource) {
  if (/reconciliation_warnings\s*\.\s*length/.test(pageSource)) {
    fail(
      "DashboardPage đếm cảnh báo bằng reconciliation_warnings.length — mảng đã bị BE cắt trần 50 dòng, con số đúng là reconciliation_warning_count.",
    );
  } else if (!pageSource.includes("reconciliation_warning_count")) {
    fail("DashboardPage không đọc reconciliation_warning_count.");
  } else {
    ok("cảnh báo đối soát đọc theo count, không theo độ dài mảng mẫu");
  }

  const hasNote = /role="note"/.test(pageSource);
  const gatedByScope = /data_scope === "WAREHOUSE_SCOPED"/.test(pageSource);
  if (!hasNote || !gatedByScope) {
    fail(
      'DashboardPage phải khai ngoại lệ warranty GLOBAL bằng khối role="note", chỉ hiện khi data_scope === "WAREHOUSE_SCOPED" (KPI matrix v1.2 §1).',
    );
  } else {
    ok("ngoại lệ warranty GLOBAL được khai trên UI đúng điều kiện phạm vi");
  }
}

if (problems.length > 0) {
  console.error(
    "[WWHN-328/FE] FAIL — " + problems.length + " điều kiện chưa đạt:",
  );
  problems.forEach((problem) => console.error("  x " + problem));
  process.exit(1);
}
notes.forEach((note) => console.log("  + " + note));
console.log(
  "[WWHN-328/FE] PASS — consumer FE khớp contract đã ký và pin còn hiệu lực.",
);
