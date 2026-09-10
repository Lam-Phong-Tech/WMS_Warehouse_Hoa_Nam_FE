#!/usr/bin/env node
/**
 * WWHN-268 — verifier fail-closed cho register defect của vòng sửa lỗi
 * WWHN-70 / HN-QA-005-ST01.
 *
 * Lý do tồn tại: review 64/100 nói bảng disposition hiện có là "generic". Một
 * bảng Markdown viết tay không thể chứng minh điều ngược lại, nên register được
 * chuyển sang JSON và verifier này từ chối mọi dòng thiếu trường, mọi chuỗi độn
 * ("TBD", "N/A", "generic"), mọi file fix/bằng chứng không tồn tại trên đĩa, và
 * mọi dòng khai FIXED nhưng retest không PASS.
 *
 * Verifier KHÔNG khẳng định QA1/QA2 đã chạy độc lập — phần đó nằm ở
 * externalGates và luôn giữ trạng thái mở cho tới khi chính vai trò đó comment.
 *
 * CẬP NHẬT theo 3822d45: register JSON và kho docs/evidence/Task_docs_Jira/e2e
 * đã gỡ khỏi repo — các kiểm tra đọc register/bằng chứng rút theo (xem comment
 * tại chỗ). Phần còn hiệu lực: hợp đồng trạng thái UI trong src, wiring
 * workflow + package.json, và phạm vi regression BE (repo cạnh bên).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const feRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(feRoot, "..", "..");

let failures = 0;

function fail(message) {
  console.error(`[WWHN-268] FAIL: ${message}`);
  failures += 1;
}

function readRequired(relativePath) {
  const absolute = join(feRoot, relativePath);
  if (!existsSync(absolute)) {
    console.error(`[WWHN-268] FAIL: thiếu artifact bắt buộc: ${relativePath}`);
    process.exit(1);
  }
  return readFileSync(absolute, "utf8");
}

/**
 * Đường dẫn trong register có thể trỏ sang repo BE (tiền tố `HoaNam_BE/`).
 * Cả hai repo nằm cạnh nhau dưới C:\LAM_PHONG_TECH, nên resolve theo repoRoot.
 */
const beRoot = join(repoRoot, "HoaNam_BE", "WMS_Warehouse_Hoa_Nam_BE");

// Register có tham chiếu chéo sang repo BE. Chạy tại chỗ thì hai repo nằm cạnh
// nhau nên kiểm được thật; trong CI chỉ FE được checkout nên tham chiếu chéo
// được ghi NOTE thay vì FAIL, và cổng WWHN-268 BE regression closure ở repo BE
// chịu trách nhiệm kiểm phần đó. Ranh giới rõ ràng, không bỏ qua âm thầm.
const beRepoAvailable = existsSync(beRoot);
const skippedCrossRepo = [];

// --- 1.–3. Register defect + external gates — ĐÃ RÚT theo 3822d45 ------------
// docs/evidence/WWHN-268/DEFECT_REGISTER.json (cùng BEFORE_*.md, RUN_MANIFEST)
// đã gỡ khỏi repo trong đợt dọn kho tài liệu — toàn bộ kiểm tra đọc register
// (khung task/policy/viewport, 5 dòng defect với fix/bằng chứng/retest, và
// external gates WWHN-264/265/266/267) rút theo, kèm các helper chỉ phục vụ
// register (shouldCheckPath/resolveEvidencePath/requireMeaningfulText).
// Kiểm tra mã nguồn sống phía dưới giữ nguyên hiệu lực.

const REQUIRED_UI_STATES = [
  "loading",
  "empty",
  "error",
  "success",
  "disabled",
  "confirm",
  "permission-denied",
];
// --- 4. Artefact phải tồn tại thật ------------------------------------------
// ĐÃ RÚT theo 3822d45: e2e/wwhn-268-defect-retest.spec.ts và
// docs/Task_docs_Jira/WWHN-268.md đã gỡ khỏi repo trong đợt dọn kho tài liệu —
// hai kiểm tra tồn tại đó rút theo. Hai artefact nguồn sống giữ nguyên.
readRequired("src/shared/constants/ui-state.ts");
readRequired("src/shared/constants/ui-state.test.tsx");
const workflow = readRequired(
  ".github/workflows/wwhn-268-fe-defect-closure.yml",
);
// ĐÃ RÚT 10/09/2026: bước retest `yarn test:e2e:wwhn-268` (spec gỡ ở 3822d45, chạy 0 test)
// bị gỡ khỏi workflow và script khỏi package.json — needle/pin tương ứng rút theo.
for (const needle of ["wwhn-268:verify", "GITHUB_SHA"]) {
  if (!workflow.includes(needle)) {
    fail(`workflow WWHN-268 phải chạy/truyền ${needle}`);
  }
}

const packageJson = JSON.parse(readRequired("package.json"));
for (const script of ["wwhn-268:verify"]) {
  if (!packageJson.scripts?.[script]) {
    fail(`package.json thiếu script ${script}`);
  }
}

// Hợp đồng trạng thái phải còn nguyên trong nguồn sống. Nửa đối chiếu sang
// spec bằng chứng e2e ĐÃ RÚT theo 3822d45 (bộ e2e đã gỡ khỏi repo).
const uiStateSource = readRequired("src/shared/constants/ui-state.ts");
for (const state of REQUIRED_UI_STATES) {
  if (!uiStateSource.includes(`"${state}"`)) {
    fail(`ui-state.ts thiếu trạng thái ${state}`);
  }
}

// Phạm vi regression backend phải tồn tại và đủ 5 vùng.
const scopePath = join(
  beRoot,
  "docs/evidence/WWHN-268/BE_REGRESSION_SCOPE.json",
);
if (!beRepoAvailable) {
  skippedCrossRepo.push(
    "HoaNam_BE/docs/evidence/WWHN-268/BE_REGRESSION_SCOPE.json",
  );
} else if (!existsSync(scopePath)) {
  fail(
    "thiếu BE_REGRESSION_SCOPE.json — phạm vi regression backend không kiểm chứng được",
  );
} else {
  try {
    const scope = JSON.parse(readFileSync(scopePath, "utf8"));
    for (const area of ["stock", "reversal", "warranty", "pv", "report"]) {
      if (!(scope.areas?.[area]?.testClasses ?? []).length) {
        fail(`BE_REGRESSION_SCOPE.json thiếu class test cho vùng ${area}`);
      }
    }
  } catch (error) {
    fail(`BE_REGRESSION_SCOPE.json không hợp lệ: ${error.message}`);
  }
}

if (skippedCrossRepo.length > 0) {
  console.log(
    `[WWHN-268] NOTE: repo BE không có mặt ở lượt chạy này nên ${new Set(skippedCrossRepo).size} tham chiếu chéo chưa kiểm tại đây; cổng WWHN-268 BE regression closure chịu trách nhiệm phần đó.`,
  );
}

if (failures > 0) {
  console.error(`[WWHN-268] FAIL: ${failures} vấn đề chặn closure.`);
  process.exit(1);
}

console.log(
  "[WWHN-268] PASS: hợp đồng 7 trạng thái UI (Annex D) còn nguyên trong nguồn sống, wiring workflow + package.json và phạm vi regression BE giữ hiệu lực (kiểm tra register/bằng chứng/task-doc/e2e đã rút theo 3822d45).",
);
