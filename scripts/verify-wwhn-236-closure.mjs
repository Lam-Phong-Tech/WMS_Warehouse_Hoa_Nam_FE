#!/usr/bin/env node
/**
 * WWHN-236 / DISP-STK-236 — nửa FE của gate Apply Adjustment DEFERRED.
 *
 * REQ-SRS-037 (Must, SRS/FRD v1.12 adopt tại WWHN-334) cấm expose Stocktake/Variance
 * ở **menu, screen, permission, API client** — không chỉ ở backend. Verifier BE
 * (`scripts/verify-wwhn236-adjustment-disposition.mjs`) khoá nửa BE; file này khoá
 * nửa FE và kiểm luôn ràng buộc chống "disposition hứa suông".
 *
 *   npm run wwhn-236:verify
 *
 * Ranh giới sở hữu (DISP-STK-236 §4 / DISP-STK-233 §12): file này thuộc WWHN-236.
 * Nhánh count/recount có verifier riêng `scripts/verify-wwhn-233-closure.mjs`.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BE_ROOT = resolve(FE_ROOT, "../../HoaNam_BE/WMS_Warehouse_Hoa_Nam_BE");

const failures = [];
const checks = [];
const notes = [];

const fail = (id, msg) => failures.push(`[${id}] ${msg}`);
const pass = (id, msg) => checks.push(`[${id}] ${msg}`);
const note = (id, msg) => notes.push(`[${id}] ${msg}`);

const toPosix = (p) => p.replace(/\\/g, "/");
const read = (root, rel) => {
  const abs = join(root, rel);
  return existsSync(abs) ? readFileSync(abs, "utf8") : null;
};

/**
 * Bề mặt bị cấm ở nhánh adjustment. Nhánh count/recount (`recount`, `cycle-count`,
 * `physical-count`) thuộc WWHN-233 và cố ý không nằm ở đây.
 */
const FORBIDDEN = ["stocktake", "apply-adjustment", "applyadjustment"];

// ── Check 1: không route kiểm kê trong bảng route FE ─────────────────────────
{
  const rel = "src/shared/constants/routes.ts";
  const src = read(FE_ROOT, rel);
  if (src === null) {
    fail("FE-ROUTES", `${rel} không tồn tại.`);
  } else {
    // Bỏ comment trước khi soi: dòng giải thích "không có route kiểm kê" là hợp lệ.
    const code = src
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const hits = FORBIDDEN.filter((f) => code.toLowerCase().includes(f));
    if (hits.length > 0) {
      fail("FE-ROUTES", `${rel} khai route bị cấm: ${hits.join(", ")}`);
    } else {
      pass("FE-ROUTES", "ROUTES: zero route stocktake/apply-adjustment");
    }
  }
}

// ── Check 2: permission catalog FE không có quyền kiểm kê / sửa tồn ──────────
{
  const rel = "src/shared/constants/wms-permissions.ts";
  const src = read(FE_ROOT, rel);
  if (src === null) {
    fail("FE-PERMISSIONS", `${rel} không tồn tại.`);
  } else {
    const code = src
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    // Chỉ soi giá trị permission code trong chuỗi, không soi tên hằng.
    const codes = [...code.matchAll(/"([a-z0-9_.]+)"/g)].map((m) => m[1]);
    const rogue = codes.filter((c) => /stocktake|adjust|variance/.test(c));
    if (rogue.length > 0) {
      fail(
        "FE-PERMISSIONS",
        `${rel} còn permission bị cấm: ${[...new Set(rogue)].join(", ")}`,
      );
    } else {
      pass(
        "FE-PERMISSIONS",
        `permission catalog: ${codes.length} code, zero stocktake/adjust/variance`,
      );
    }
  }
}

// ── Check 3: API client không khai endpoint adjustment ───────────────────────
{
  const rel = "src/shared/api/endpoints.ts";
  const src = read(FE_ROOT, rel);
  if (src === null) {
    fail("FE-ENDPOINTS", `${rel} không tồn tại.`);
  } else {
    const code = src
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const paths = [...code.matchAll(/"(\/[A-Za-z0-9._\-/:]*)"/g)].map((m) =>
      m[1].toLowerCase(),
    );
    const rogue = paths.filter(
      (p) => FORBIDDEN.some((f) => p.includes(f)) || p.includes("variance"),
    );
    if (rogue.length > 0) {
      fail(
        "FE-ENDPOINTS",
        `${rel} khai endpoint bị cấm: ${[...new Set(rogue)].join(", ")}`,
      );
    } else {
      pass(
        "FE-ENDPOINTS",
        `endpoints: ${paths.length} path, zero adjustment/stocktake/variance`,
      );
    }
  }
}

// ── Check 4: không màn hình / module kiểm kê trong cây nguồn ─────────────────
{
  const offenders = [];
  const walk = (dir) => {
    const abs = join(FE_ROOT, dir);
    if (!existsSync(abs)) return;
    for (const entry of readdirSync(abs)) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      const full = join(abs, entry);
      const rel = toPosix(relative(FE_ROOT, full));
      if (statSync(full).isDirectory()) {
        if (/stocktake|kiem-ke|adjustment/i.test(entry))
          offenders.push(`${rel}/ (thư mục)`);
        walk(rel);
      } else if (
        /\.(tsx?|jsx?)$/.test(entry) &&
        /stocktake|adjustment/i.test(entry)
      ) {
        offenders.push(rel);
      }
    }
  };
  walk("src/modules");
  walk("src/app");

  if (offenders.length > 0) {
    fail(
      "FE-SCREENS",
      `Có màn hình/module mang ngữ nghĩa bị cấm:\n    ${offenders.join("\n    ")}`,
    );
  } else {
    pass(
      "FE-SCREENS",
      "src/modules + src/app: zero màn hình/module stocktake/adjustment",
    );
  }
}

// ── Check 5: guard test FE tồn tại và thực sự assert ─────────────────────────
{
  const guards = [
    ["src/app/router/access.test.ts", "STOCKTAKE"],
    ["src/test/wms-contract-signoff-guards.test.ts", "stocktake"],
  ];
  const missing = [];
  for (const [rel, needle] of guards) {
    const src = read(FE_ROOT, rel);
    if (src === null || !src.toLowerCase().includes(needle.toLowerCase())) {
      missing.push(rel);
    }
  }
  if (missing.length > 0) {
    fail(
      "FE-GUARD-TESTS",
      `Test khoá bề mặt no-Stocktake không còn assert: ${missing.join(", ")}. ` +
        "Gỡ assertion là gỡ hàng rào, kể cả khi source đang sạch.",
    );
  } else {
    pass(
      "FE-GUARD-TESTS",
      "access.test.ts + wms-contract-signoff-guards.test.ts còn assert no-Stocktake",
    );
  }
}

// ── Check 6: chống disposition hứa suông (đối xứng với gate BE) ──────────────
{
  const rel = "docs/decision-records/DISP-STK-236-APPLY-ADJUSTMENT-DEFERRED.md";
  const doc = read(BE_ROOT, rel);

  if (doc === null) {
    // Hai repo có thể được checkout lệch nhau; không biến điều đó thành lỗi FE.
    note(
      "ANTI-DANGLING",
      `Không đọc được ${rel} ở repo BE (${toPosix(BE_ROOT)}) — bỏ qua bước đối chiếu.`,
    );
  } else {
    /** Đường dẫn thuộc repo FE mà disposition cam kết. */
    const FE_OWNED = new Set([
      "docs/HN_SRS_FRD_v1.12_FULL.md",
      "docs/HoaNam_ERD_Moi_Nhat.md",
      "docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html",
      "docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md",
      "docs/api-evidence/STOCKTAKE_GOVERNANCE_STATUS.json",
      "scripts/verify-wwhn-233-closure.mjs",
      "scripts/verify-wwhn-236-closure.mjs",
      "src/test/wwhn-236-adjustment-deferral-gate.test.ts",
      "src/test/wwhn-233-count-deferral-gate.test.ts",
      "docs/Task_docs_Jira/WWHN-236_SIGNOFF_COMMENTS.md",
      "docs/evidence/WWHN-236/FE_CLOSURE_IDENTITY.json",
    ]);

    const promised = new Set(
      [
        ...doc.matchAll(
          /`((?:docs|scripts|tests|src|e2e|config)\/[A-Za-z0-9._\-/]+)`/g,
        ),
      ].map((m) => m[1]),
    );

    const missing = [...promised].filter(
      (p) => FE_OWNED.has(p) && !existsSync(join(FE_ROOT, p)),
    );

    if (missing.length > 0) {
      fail(
        "ANTI-DANGLING",
        `DISP-STK-236 cam kết artifact FE không tồn tại:\n    ${missing.join("\n    ")}\n` +
          "    Một disposition mô tả hàng rào chưa được viết thì không phải hàng rào.",
      );
    } else {
      const checked = [...promised].filter((p) => FE_OWNED.has(p));
      pass(
        "ANTI-DANGLING",
        `${checked.length} artifact FE mà DISP-STK-236 cam kết đều tồn tại`,
      );
    }

    for (const needle of [
      "REQ-SRS-037",
      "DEFERRED",
      "WWHN-238",
      "DISP-STK-233",
    ]) {
      if (!doc.includes(needle)) {
        fail("ANTI-DANGLING", `DISP-STK-236 thiếu neo [${needle}].`);
      }
    }
  }
}

// ── Check 7: governance status (WWHN-233 sở hữu) vẫn neo REQ-SRS-037 ─────────
{
  const rel = "docs/api-evidence/STOCKTAKE_GOVERNANCE_STATUS.json";
  const raw = read(FE_ROOT, rel);
  if (raw === null) {
    note("GOVERNANCE", `${rel} chưa có mặt trên nhánh này (thuộc WWHN-233).`);
  } else {
    const status = JSON.parse(raw);
    const controlling = status?.ruleAuthority?.controllingRequirement?.id;
    if (controlling !== "REQ-SRS-037") {
      fail(
        "GOVERNANCE",
        `${rel} khai controlling requirement [${controlling}] thay vì REQ-SRS-037 — hai nhánh sẽ neo hai authority khác nhau.`,
      );
    } else {
      pass(
        "GOVERNANCE",
        "STOCKTAKE_GOVERNANCE_STATUS neo cùng controlling requirement REQ-SRS-037",
      );
    }

    const adjustment = (status?.deferralDispositions ?? []).find(
      (d) => d.dispositionId === "DISP-STK-236",
    );
    if (!adjustment) {
      note(
        "GOVERNANCE",
        `${rel} chưa liệt DISP-STK-236 trong deferralDispositions (WWHN-233 cập nhật).`,
      );
    } else if (adjustment.resolution !== "DEFERRED_NO_CODE") {
      fail(
        "GOVERNANCE",
        `${rel} ghi resolution [${adjustment.resolution}] cho DISP-STK-236, khác DEFERRED_NO_CODE.`,
      );
    } else {
      pass(
        "GOVERNANCE",
        "deferralDispositions: DISP-STK-236 = DEFERRED_NO_CODE, khớp disposition",
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// R3 — check 8..9: governance parity với nửa BE.
// Vòng R2 sạch về bề mặt nhưng nửa FE không có identity riêng, nên không ai
// chứng minh được "FE đã chạy tại đúng bản nào". Hai check dưới đây bịt chỗ đó.
// ═══════════════════════════════════════════════════════════════════════════
const { execFileSync: _exec } = await import("node:child_process");
const { createHash } = await import("node:crypto");
const { mkdirSync, writeFileSync } = await import("node:fs");
const EMIT_IDENTITY = process.argv.includes("--emit-identity");

const gitFE = (args, cwd = FE_ROOT) => {
  try {
    return _exec("git", args, { cwd, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
};
const gitOkFE = (args, cwd = FE_ROOT) => {
  try {
    _exec("git", args, { cwd, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

/** Artifact FE do WWHN-236 sở hữu. `pin_carrier` = file tự chứa hash của đợt pin. */
const FE_GOVERNED = [
  { path: "scripts/verify-wwhn-236-closure.mjs", role: "gate" },
  { path: "src/test/wwhn-236-adjustment-deferral-gate.test.ts", role: "gate-test" },
  { path: "docs/Task_docs_Jira/WWHN-236.md", role: "task-doc" },
  { path: "docs/Task_docs_Jira/WWHN-236_SIGNOFF_COMMENTS.md", role: "task-doc" },
  { path: "docs/evidence/WWHN-236/FE_CLOSURE_IDENTITY.json", role: "evidence", pin_carrier: true },
  { path: "docs/evidence/WWHN-236/SHA256SUMS", role: "evidence", pin_carrier: true },
];

const IDENTITY_REL = "docs/evidence/WWHN-236/FE_CLOSURE_IDENTITY.json";

// ── Check 8: bản ghi phê duyệt + chuỗi ticket bên BE phải tồn tại và đồng bộ ──
{
  const approvalRel = "docs/decision-records/DISP-STK-236-APPROVAL.json";
  const chainRel = "docs/evidence/WWHN-236/CHAIN_DISPOSITION.json";
  const approvalRaw = read(BE_ROOT, approvalRel);
  const chainRaw = read(BE_ROOT, chainRel);

  if (approvalRaw === null || chainRaw === null) {
    // Hai repo có thể checkout lệch nhau; không biến điều đó thành lỗi FE.
    note(
      "GOVERNANCE-R3",
      `Không đọc được ${approvalRaw === null ? approvalRel : chainRel} ở repo BE — bỏ qua bước đối chiếu governance.`,
    );
  } else {
    const problems = [];
    let approval;
    let chain;
    try {
      approval = JSON.parse(approvalRaw);
      chain = JSON.parse(chainRaw);
    } catch (e) {
      problems.push(`JSON không parse được: ${e}`);
    }

    if (approval) {
      if (approval.decision !== "DEFERRED_NO_CODE")
        problems.push(`approval.decision=[${approval.decision}] != DEFERRED_NO_CODE`);
      if (approval.controllingRequirement !== "REQ-SRS-037")
        problems.push(`approval.controllingRequirement=[${approval.controllingRequirement}] != REQ-SRS-037`);
      if (approval.limitationAccepted?.id !== "LIM-STK-236-01")
        problems.push("approval thiếu limitationAccepted LIM-STK-236-01 (giới hạn PM/PO phải chấp nhận)");
      if (approval.status === "APPROVED" && !approval.effectiveDate)
        problems.push("approval.status=APPROVED nhưng effectiveDate=null");
    }

    if (chain) {
      const blocked = (chain.tickets ?? []).filter((t) => /blocked|pending/i.test(String(t.targetStatus)));
      if (blocked.length > 0)
        problems.push(`chuỗi ticket còn Blocked/Pending: ${blocked.map((t) => t.ticket).join(", ")}`);
      for (const qa of chain.qaTasksMustNotBeBlocked ?? []) {
        const t = (chain.tickets ?? []).find((x) => x.ticket === qa);
        if (!t || !/DEFERRED|N\/A/i.test(String(t.targetStatus)))
          problems.push(`QA task ${qa} không ở DEFERRED / N/A`);
      }
    }

    if (problems.length > 0) {
      fail("GOVERNANCE-R3", `Governance BE ↔ FE lệch:\n    ${problems.join("\n    ")}`);
    } else {
      pass(
        "GOVERNANCE-R3",
        `approval record (${approval?.status}) + chain ${chain?.tickets?.length ?? 0} ticket: DEFERRED, zero Blocked/Pending`,
      );
      if (approval?.status !== "APPROVED") {
        const unsigned = Object.entries(approval?.signOff ?? {})
          .filter(([, s]) => !s.decision)
          .map(([k]) => k);
        if (unsigned.length > 0)
          note("GOVERNANCE-R3", `còn ${unsigned.length} vai trò chưa ký: ${unsigned.join(", ")}.`);
      }
    }
  }
}

// ── Check 9: identity của nửa FE — chạy tại đúng bản nào ─────────────────────
{
  const files = FE_GOVERNED.map((e) => {
    const abs = join(FE_ROOT, e.path);
    const present = existsSync(abs);
    const committed = gitFE(["rev-parse", `HEAD:${e.path}`]);
    const disk = present ? gitFE(["hash-object", e.path]) : null;
    const [last_commit = null, last_commit_date = null] = (gitFE(["log", "-1", "--format=%H|%cI", "--", e.path]) ?? "")
      .split("|");
    return {
      path: e.path,
      role: e.role,
      pin_carrier: e.pin_carrier === true,
      present,
      tracked: committed !== null,
      blob_sha: committed,
      worktree_blob_sha: disk,
      uncommitted: committed !== null && disk !== null && committed !== disk,
      sha256: present ? createHash("sha256").update(readFileSync(abs)).digest("hex") : null,
      last_commit: last_commit || null,
      last_commit_date: last_commit_date || null,
    };
  });

  const pinnable = files.filter((f) => !f.pin_carrier && f.tracked).map((f) => f.path);
  const candLine = pinnable.length > 0 ? gitFE(["log", "-1", "--format=%H|%cI|%s", "--", ...pinnable]) : null;
  const [candSha = null, candDate = null, candSubject = null] = (candLine ?? "").split("|");

  if (EMIT_IDENTITY) {
    const status = gitFE(["status", "--porcelain"]) ?? "";
    const dirty = status.split("\n").filter(Boolean).map((l) => l.slice(3).trim().replace(/^"|"$/g, ""));
    const governedPaths = new Set(files.map((f) => f.path));
    const governedDirty = files.filter((f) => f.uncommitted || (f.present && !f.tracked)).map((f) => f.path);
    const payload = {
      document: "FE_CLOSURE_IDENTITY",
      task: "WWHN-236",
      register_item: "DEV236-P1-04R3",
      disposition: "DISP-STK-236",
      repo: "FE",
      branch: gitFE(["rev-parse", "--abbrev-ref", "HEAD"]),
      head_sha: gitFE(["rev-parse", "HEAD"]),
      candidate_sha: candSha || null,
      candidate_date: candDate || null,
      candidate_subject: candSubject || null,
      candidate_rule:
        "Commit cuối cùng chạm artifact FE do WWHN-236 sở hữu (bỏ pin carrier). Không pin HEAD: m1 có nhiều phiên song song.",
      pull_request: "N/A — direct-to-m1",
      governed_working_tree: governedDirty.length === 0 ? "CLEAN" : "DIRTY",
      governed_dirty_files: governedDirty,
      foreign_dirty_files: dirty.filter((p) => !governedPaths.has(p)),
      governed_files: files,
    };
    mkdirSync(join(FE_ROOT, "docs/evidence/WWHN-236"), { recursive: true });
    writeFileSync(join(FE_ROOT, IDENTITY_REL), `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`  → ghi ${IDENTITY_REL}`);
  }

  const raw = read(FE_ROOT, IDENTITY_REL);
  if (raw === null) {
    fail(
      "FE-IDENTITY",
      `${IDENTITY_REL} không tồn tại. Chạy \`npm run wwhn-236:verify -- --emit-identity\`. ` +
        "Không có identity thì không ai chứng minh được nửa FE đã chạy tại đúng bản nào.",
    );
  } else {
    const identity = JSON.parse(raw);
    const problems = [];
    if (!identity.candidate_sha) problems.push("candidate_sha=null — sinh identity khi artifact chưa commit");
    if (identity.governed_working_tree !== "CLEAN")
      problems.push(`governed_working_tree=${identity.governed_working_tree} — [${(identity.governed_dirty_files ?? []).join(", ")}]`);
    if (identity.pull_request !== "N/A — direct-to-m1") problems.push("pull_request phải ghi N/A — direct-to-m1");
    if (identity.candidate_sha && !gitOkFE(["merge-base", "--is-ancestor", identity.candidate_sha, "HEAD"]))
      problems.push(`candidate ${identity.candidate_sha.slice(0, 7)} không phải ancestor của HEAD — pin đã mục`);

    for (const f of identity.governed_files ?? []) {
      if (!f.present) {
        problems.push(`governed file thiếu: ${f.path}`);
        continue;
      }
      if (f.pin_carrier || !f.tracked) continue;
      const now = gitFE(["rev-parse", `HEAD:${f.path}`]);
      if (now !== f.blob_sha)
        problems.push(`${f.path} đổi blob sau khi pin (${String(f.blob_sha).slice(0, 7)} → ${String(now).slice(0, 7)})`);
      const disk = gitFE(["hash-object", f.path]);
      if (disk !== now) problems.push(`${f.path} trên đĩa khác bản đã commit`);
    }

    if (problems.length > 0) fail("FE-IDENTITY", `${IDENTITY_REL}:\n    ${problems.join("\n    ")}`);
    else
      pass(
        "FE-IDENTITY",
        `candidate ${String(identity.candidate_sha).slice(0, 7)} · ${(identity.governed_files ?? []).filter((f) => !f.pin_carrier).length} governed file khớp blob · PR=N/A direct-to-m1`,
      );
  }
}

// ── Kết quả ──────────────────────────────────────────────────────────────────
console.log("WWHN-236 / DISP-STK-236 — FE closure gate\n");
for (const c of checks) console.log(`  PASS ${c}`);
for (const n of notes) console.log(`  NOTE ${n}`);

if (failures.length > 0) {
  console.error(`\n${failures.length} FAILURE(S):\n`);
  for (const f of failures) console.error(`  FAIL ${f}`);
  console.error(
    "\nREQ-SRS-037 (Must): không expose Stocktake/Variance ở menu, API, permission, entity hay report.\n" +
      "Re-enable chỉ sau approved CR + WWHN-25 GO + rebaseline SRS (DISP-STK-236 §2).\n",
  );
  process.exit(1);
}

console.log(
  `\n${checks.length}/${checks.length} check PASS — bề mặt adjustment/stocktake ở FE = zero.`,
);
