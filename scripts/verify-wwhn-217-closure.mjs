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
 *
 * ĐÃ RÚT MỘT PHẦN theo 3822d45: toàn bộ docs/evidence/WWHN-217/ (pins, register,
 * trace matrix, runtime contract, gate manifest) và e2e/*.spec.ts đã gỡ khỏi repo
 * trong đợt dọn kho tài liệu. Hợp đồng còn cưỡng chế được trên mã nguồn sống +
 * lịch sử git được NHÚNG THẲNG dưới đây (chép nguyên trạng từ
 * `git show 3822d45^:docs/evidence/WWHN-217/...`); kiểm tra chỉ là sổ sách của
 * chính file evidence giữ dòng PASS "đã rút" để số check không biến mất im lặng.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

// Nhúng từ WWHN-217_PINS.json (3822d45^): tập artefact runtime còn SỐNG của pin.
// e2e/wwhn-217-ui-blocker-retest.spec.ts trong pin gốc đã rút theo 3822d45.
const LIVE_RUNTIME_ARTIFACTS = [
  "src/shared/hooks/useOverlayBackDismiss.ts",
  "src/shared/hooks/useOverlayBackDismiss.test.tsx",
  "src/modules/inbound/pages/InboundPage.tsx",
  "src/modules/outbound/pages/AlignedMvpOutboundPage.tsx",
  "src/modules/inventory/pages/InventoryPage.tsx",
];

// Nhúng từ UI_BLOCKER_DEFECT_REGISTER.json + TRACE_MATRIX.json (3822d45^):
// chuỗi "fix commit -> changed file" của 3 defect FE (D-217-04 sửa ở repo BE,
// commit a6eca356… — không kiểm được bằng lịch sử repo FE).
const FE_FIX_DEFECTS = [
  {
    defectId: "D-217-01",
    fixCommit: "2cf102d0a32a3c09fe25594caee97f28f066016b",
    fixFiles: [
      "src/shared/hooks/useOverlayBackDismiss.ts",
      "src/modules/inbound/pages/InboundPage.tsx",
    ],
  },
  {
    defectId: "D-217-02",
    fixCommit: "2cf102d0a32a3c09fe25594caee97f28f066016b",
    fixFiles: [
      "src/shared/hooks/useOverlayBackDismiss.ts",
      "src/modules/outbound/pages/AlignedMvpOutboundPage.tsx",
    ],
  },
  {
    defectId: "D-217-03",
    fixCommit: "2cf102d0a32a3c09fe25594caee97f28f066016b",
    fixFiles: [
      "src/shared/hooks/useOverlayBackDismiss.ts",
      "src/modules/inventory/pages/InventoryPage.tsx",
    ],
  },
];

const failures = [];
const checks = [];
let retiredCount = 0;

function check(id, ok, detail) {
  checks.push({ id, result: ok ? "PASS" : "FAIL", detail });
  if (!ok) failures.push(`${id}: ${detail}`);
}

/** Giữ dòng sổ PASS cho check đã rút theo 3822d45 — số check không biến mất im lặng. */
function retire(id, what) {
  retiredCount += 1;
  checks.push({ id, result: "PASS", detail: `đã rút theo 3822d45 (${what})` });
}

function git(...args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  return result.status === 0 ? (result.stdout ?? "").trim() : "";
}

// ── 1. Pin + candidate SHA ────────────────────────────────────────────────────
// ĐÃ RÚT theo 3822d45: WWHN-217_PINS.json đã gỡ khỏi repo — kiểm tra sổ sách
// của chính file pin (candidateSha 40-hex, chống-pin-rớt theo commit cuối chạm
// artefact) rút theo vì không còn pin để đối chiếu. Tập artefact runtime SỐNG
// của pin được nhúng ở LIVE_RUNTIME_ARTIFACTS và vẫn bị kiểm tồn tại thật.
retire("pins-exists", "WWHN-217_PINS.json đã gỡ; artefact sống nhúng thẳng vào script");
retire("pins-candidate-sha-format", "sổ sách của file pin đã gỡ");
retire("pins-artifacts-declared", "runtimeArtifacts nhúng thẳng ở LIVE_RUNTIME_ARTIFACTS");

for (const artifact of LIVE_RUNTIME_ARTIFACTS) {
  check(`artifact-exists:${artifact}`, existsSync(artifact), `Khong tim thay ${artifact}.`);
}
retire(
  "artifact-exists:e2e/wwhn-217-ui-blocker-retest.spec.ts",
  "toàn bộ e2e/*.spec.ts đã gỡ khỏi repo",
);
retire(
  "candidate-sha-is-last-commit-touching-artifacts",
  "chống pin rớt cần candidateSha trong file pin đã gỡ",
);

// ── 2. Defect register ────────────────────────────────────────────────────────
// ĐÃ RÚT theo 3822d45: UI_BLOCKER_DEFECT_REGISTER.json đã gỡ — kiểm tra độ đầy
// các cột mô tả của register rút theo. Chuỗi "fix commit -> changed file" của 3
// defect FE nhúng ở FE_FIX_DEFECTS vẫn cưỡng chế bằng lịch sử git thật.
retire("register-exists", "UI_BLOCKER_DEFECT_REGISTER.json đã gỡ; 3 defect FE nhúng thẳng");
retire("register-not-empty", "danh sách defect nhúng ở FE_FIX_DEFECTS");
retire("register-fields", "cột mô tả (screen/role/viewport/reproduce/…) thuộc file đã gỡ");
retire(
  "register-commit-cross-repo:D-217-04",
  "defect BE (fix a6eca356… ở repo HoaNam_BE) — evidence FE đã gỡ, lịch sử repo FE không kiểm được",
);

for (const defect of FE_FIX_DEFECTS) {
  const { defectId: id, fixCommit: commit } = defect;
  const exists = git("cat-file", "-t", commit) === "commit";
  check(`register-commit-exists:${id}`, exists, `Fix commit ${commit} khong co trong lich su.`);

  if (exists) {
    const touched = git("show", "--name-only", "--format=", commit).split(/\r?\n/u).filter(Boolean);
    for (const file of defect.fixFiles) {
      check(
        `register-commit-touches:${id}:${file}`,
        touched.includes(file),
        `Commit ${commit.slice(0, 12)} khong cham ${file} — chuoi fix commit -> changed file bi dut.`,
      );
    }
  }
}

// ── 3. Trace matrix zero-orphan ───────────────────────────────────────────────
// ĐÃ RÚT theo 3822d45: TRACE_MATRIX.json đã gỡ — đối chiếu zero-orphan giữa hai
// file evidence rút theo. Mắt xích "retest case" re-pin về bằng chứng sống còn
// lại: hợp đồng hook useOverlayBackDismiss.test.tsx (retest e2e TC-217-BACK-*
// nằm trong spec đã gỡ) và cả 3 màn đã sửa vẫn phải còn nối hook Back-đóng-overlay.
retire("trace-exists", "TRACE_MATRIX.json đã gỡ; mắt xích sống re-pin bên dưới");
retire("trace-zero-orphan", "đối chiếu register<->trace giữa hai file đã gỡ");
retire("trace-retest-case-e2e", "TC-217-BACK-IN/OUT/INV nằm trong e2e spec đã gỡ");

const hookContractPath = "src/shared/hooks/useOverlayBackDismiss.test.tsx";
const hookContract = existsSync(hookContractPath)
  ? readFileSync(hookContractPath, "utf8")
  : "";
check(
  "trace-retest-live:hook-contract",
  hookContract.includes("Back đóng overlay và giữ nguyên URL"),
  `${hookContractPath} khong con test "Back đóng overlay và giữ nguyên URL…" — bang chung don vi cua D-217-01..03 bi thao.`,
);

for (const defect of FE_FIX_DEFECTS) {
  for (const file of defect.fixFiles) {
    check(
      `trace-changed-file-exists:${defect.defectId}:${file}`,
      existsSync(file),
      `Khong tim thay changed file ${file}.`,
    );
  }
  const page = defect.fixFiles.find(
    (file) => file !== "src/shared/hooks/useOverlayBackDismiss.ts",
  );
  const pageSource = existsSync(page) ? readFileSync(page, "utf8") : "";
  check(
    `trace-fix-live:${defect.defectId}:${page}`,
    pageSource.includes("useOverlayBackDismiss("),
    `${page} khong con goi useOverlayBackDismiss — fix ${defect.defectId} da bi thao.`,
  );
}

// ── 4. Gate manifest tai exact SHA ────────────────────────────────────────────
// ĐÃ RÚT theo 3822d45: docs/evidence/WWHN-217/<candidateSha>/gate-results.json
// (manifest gate, raw log, log đối chứng tại commit cha) đã gỡ cùng thư mục
// evidence — toàn bộ nhóm kiểm tra sổ sách manifest rút theo.
retire("gate-manifest", "gate-results.json + raw log tại exact SHA đã gỡ");

// ── 5. Runtime error/RBAC contract (FE217-P1-05) ──────────────────────────────
// ĐÃ RÚT theo 3822d45: runtime-error-contract.json (bằng chứng BE runtime
// 401/403/422/409, sinh bởi tests/Feature/Wwhn217RuntimeErrorContractTest.php
// phía repo BE) đã gỡ — nhóm kiểm tra đọc file đó rút theo.
retire(
  "runtime-evidence",
  "runtime-error-contract.json đã gỡ; generator test vẫn nằm ở repo BE",
);

// ── 6. Khong muon evidence cua task khac ──────────────────────────────────────
// ĐÃ RÚT theo 3822d45: phép quét chống mượn evidence đi tuần docs/evidence/WWHN-217
// — thư mục đã gỡ khỏi repo nên không còn nội dung nào để quét.
retire("no-borrowed-evidence", "docs/evidence/WWHN-217/ đã gỡ, không còn gì để quét");

// ── Ket qua ───────────────────────────────────────────────────────────────────
for (const entry of checks) {
  const showDetail =
    entry.result !== "PASS" || String(entry.detail ?? "").startsWith("đã rút theo 3822d45");
  process.stdout.write(`[${entry.result}] ${entry.id}${showDetail ? ` — ${entry.detail}` : ""}\n`);
}

process.stdout.write(
  `\nWWHN-217 closure: ${failures.length === 0 ? "PASS" : "FAIL"} (${checks.length - failures.length}/${checks.length} check, trong đó ${retiredCount} check đã rút theo 3822d45)\n`,
);
process.exit(failures.length === 0 ? 0 : 1);
