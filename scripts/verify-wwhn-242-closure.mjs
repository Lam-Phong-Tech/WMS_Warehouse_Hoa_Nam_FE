#!/usr/bin/env node
/**
 * WWHN-242 — cổng closure fail-closed cho REV-00/REV-01.
 *
 * Cổng này khoá lại đúng những gì đã sửa tận gốc, để lần sau drift là ĐỎ chứ không
 * phải "review lại phát hiện":
 *
 *   1. Governance (FE242-P0-01 / P1-04): hồ sơ định đoạt phải tồn tại, phải ghim
 *      SHA-256 của bốn baseline, phải neo `REQ-SRS-037` và phải nêu rõ
 *      `WWHN-25/26` còn PENDING. Hash baseline được TÍNH LẠI tại chỗ — sửa doc mà
 *      không cập nhật hash là đỏ.
 *   2. RBAC (FE242-RBAC): route `/reverse` phải chấp nhận `inventory.view`.
 *   3. Stale recovery (FE242-STALE): chi tiết phải tự nạp lại phiếu khi 409/412/428.
 *   4. If-Match guard (FE242-IFMATCH): thiếu version thì chặn ở UI.
 *   5. Bằng chứng QA2 (FE242-P1-01 / P1-03 / P2-01): spec e2e phải phủ 4 viewport và
 *      đủ ma trận 403/409/412/422/428.
 *   6. REQ-SRS-037: không có bề mặt Stocktake nào trong FE.
 *   7. BE (nếu có repo cạnh bên): middleware data-scope reversal + 4 cột ERD bảng 33.
 *
 * Bẫy đã biết (WWHN-327): Prettier ngắt dòng theo độ rộng in nên so chuỗi thô sẽ đỏ
 * oan → mọi phép so nội dung đều chuẩn hoá khoảng trắng trước.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backendRoot =
  process.env.WMS_BACKEND_ROOT ??
  join(root, "../../HoaNam_BE/WMS_Warehouse_Hoa_Nam_BE");

const failures = [];
const notes = [];

/**
 * Bốn baseline nằm chung repo với nhiều task khác, nên hash CÓ THỂ trôi vì lý do không
 * liên quan tới hoàn đảo (ví dụ ERD-AMD-007 của WWHN-260). Cổng vẫn fail-closed, nhưng
 * `--repin` cho phép cập nhật hồ sơ trong một lệnh thay vì sửa tay — drift phải rẻ để
 * xử lý, nếu không người ta sẽ tắt cổng.
 */
const repin = process.argv.includes("--repin");

function read(relativePath, base = root) {
  const absolute = join(base, relativePath);
  if (!existsSync(absolute)) return null;
  return readFileSync(absolute, "utf8");
}

/** Chuẩn hoá khoảng trắng để Prettier không làm cổng đỏ oan. */
function flat(text) {
  return text.replace(/\s+/g, " ");
}

function requirePhrase(relativePath, phrase, why, base = root) {
  const content = read(relativePath, base);
  if (content === null) {
    failures.push(`${relativePath}: không tồn tại (${why}).`);
    return;
  }
  if (!flat(content).includes(flat(phrase))) {
    failures.push(`${relativePath}: thiếu "${phrase}" — ${why}.`);
  }
}

function requireMatch(relativePath, pattern, why, base = root) {
  const content = read(relativePath, base);
  if (content === null) {
    failures.push(`${relativePath}: không tồn tại (${why}).`);
    return;
  }
  if (!pattern.test(content)) {
    failures.push(`${relativePath}: không khớp ${pattern} — ${why}.`);
  }
}

// ───────────────────────── 1. Governance ─────────────────────────

const DISPOSITION = "docs/Task_docs_Jira/WWHN-242_SCOPE_DISPOSITION.md";
const BASELINES = [
  "docs/HN_SRS_FRD_v1.12_FULL.md",
  "docs/HoaNam_ERD_Moi_Nhat.md",
  "docs/HN_WMS_Wireframe_MVP_ALIGNED_v3.20_v1.12_20260814.html",
  "docs/WMS_Hoa_Nam_Techstack_Architecture_Dev_Guide.md",
];

let disposition = read(DISPOSITION);
if (disposition === null) {
  failures.push(`${DISPOSITION}: thiếu hồ sơ định đoạt phạm vi (FE242-P0-01).`);
} else {
  const drifted = [];
  for (const baseline of BASELINES) {
    const absolute = join(root, baseline);
    if (!existsSync(absolute)) {
      failures.push(`${baseline}: baseline không tồn tại để đối chiếu hash.`);
      continue;
    }
    const digest = createHash("sha256")
      .update(readFileSync(absolute))
      .digest("hex");
    if (!disposition.includes(digest)) {
      drifted.push({ baseline, digest });
    }
  }

  if (drifted.length > 0 && repin) {
    // Chỉ thay đúng ô hash trên dòng bảng của baseline tương ứng; không đụng nội dung khác.
    for (const { baseline, digest } of drifted) {
      const fileName = baseline.split("/").pop();
      const lines = disposition.split("\n");
      const index = lines.findIndex(
        (line) =>
          line.includes(fileName) && /\|\s*`[0-9a-f]{64}`\s*\|/.test(line),
      );
      if (index === -1) {
        failures.push(
          `${DISPOSITION}: không tìm thấy dòng hash của ${baseline} để repin; sửa tay.`,
        );
        continue;
      }
      lines[index] = lines[index].replace(/`[0-9a-f]{64}`/, `\`${digest}\``);
      disposition = lines.join("\n");
      console.log(`REPIN ${baseline} → ${digest}`);
    }
    writeFileSync(join(root, DISPOSITION), disposition, "utf8");
  } else {
    for (const { baseline, digest } of drifted) {
      failures.push(
        `${DISPOSITION}: SHA-256 hiện hành của ${baseline} là ${digest} nhưng hồ sơ không ghim giá trị này. Baseline đã đổi hoặc hồ sơ đã cũ — chạy "npm run verify:wwhn-242 -- --repin" rồi đọc lại diff trước khi ký.`,
      );
    }
  }

  // Neo thẩm quyền phải là requirement, KHÔNG phải Decision ID chưa duyệt.
  requirePhrase(
    DISPOSITION,
    "REQ-SRS-037",
    "phải neo vào requirement Must đã adopt",
  );
  requirePhrase(DISPOSITION, "WWHN-334", "phải nêu task adopt baseline");
  requirePhrase(
    DISPOSITION,
    "FORMAL APPROVAL PENDING",
    "phải nói rõ WWHN-25/26 chưa được phê duyệt chính thức",
  );
  requirePhrase(
    DISPOSITION,
    "KHÔNG được trích `DEC-NO-STOCKTAKE-001` như approved standalone Decision ID",
    "ranh giới trích dẫn phải nằm trong hồ sơ, không nằm trong đầu người viết",
  );
  requirePhrase(
    DISPOSITION,
    "REVERSAL-ONLY",
    "disposition phải phát biểu tường minh, không để reviewer tự suy",
  );
}

// ───────────────────────── 2. RBAC route ─────────────────────────

const ACCESS = "src/app/router/access.ts";
requireMatch(
  ACCESS,
  /\[ROUTES\.REVERSE\]:\s*\[\s*P\.INVENTORY_VIEW\s*,\s*P\.REVERSAL_POST\s*\]/,
  "REV-00 là màn đọc; BE cấp GET /reversal-documents bằng inventory.view nên gate route chỉ bằng REVERSAL_POST là fail-closed sai",
);

// ───────────────────── 3+4. Hành vi FE đã sửa ─────────────────────

const DETAIL = "src/modules/reverse/components/ReversalDetailModal.tsx";
requirePhrase(
  DETAIL,
  "reversal-stale-version-notice",
  "phải có mốc kiểm thử cho cảnh báo lệch version",
);
requireMatch(
  DETAIL,
  /isStaleVersion[\s\S]{0,400}docQuery\.refetch\(\)[\s\S]{0,200}linesQuery\.refetch\(\)/,
  "409/412/428 phải TỰ nạp lại header + line, không chỉ nhắc người dùng tải lại (BR-REV-02)",
);

const CREATE = "src/modules/reverse/components/ReversalCreateModal.tsx";
requirePhrase(
  CREATE,
  "missingReferenceVersion",
  "thiếu version chứng từ gốc phải chặn ở UI thay vì để BE trả 428",
);
requireMatch(
  CREATE,
  /canSubmit\s*=[\s\S]{0,400}!missingReferenceVersion/,
  "guard thiếu version phải nằm trong điều kiện cho phép gửi, không chỉ là một cảnh báo trang trí",
);

const PAGE = "src/modules/reverse/pages/ReversalPage.tsx";
requirePhrase(
  PAGE,
  "reversal-readonly-note",
  "vai chỉ đọc phải được giải thích vì sao không có nút ghi",
);

// ───────────────────── 5. Bằng chứng QA2 / responsive ─────────────────────

const E2E = "e2e/wwhn-242-reversal-qa2.spec.ts";
for (const viewport of ["1440", "1366", "768", "390"]) {
  requirePhrase(
    E2E,
    `width: ${viewport}`,
    `FE242-P2-01 yêu cầu chụp bằng chứng ở bề ngang ${viewport}`,
  );
}
for (const status of [403, 409, 412, 422, 428]) {
  requireMatch(
    E2E,
    new RegExp(`status:\\s*${status}\\b`),
    `FE242-P1-03 yêu cầu ma trận lỗi phải phủ ${status}`,
  );
}
requirePhrase(
  E2E,
  "FE_CONTROLLED_NOT_UAT",
  "bằng chứng phải tự khai ranh giới sự thật, không được đội lốt UAT",
);

const UNIT = "src/modules/reverse/wwhn-242-reversal-contract.test.tsx";
requirePhrase(
  UNIT,
  'vi.unmock("@/app/router/access")',
  "phải assert bản đồ quyền THẬT",
);

// ───────────────────── 6. REQ-SRS-037: không có Stocktake ─────────────────────

const STOCKTAKE_SURFACES = [
  ["src/shared/constants/routes.ts", /STOCKTAKE\s*:/],
  ["src/shared/constants/wms-permissions.ts", /stocktake\./i],
];
for (const [file, pattern] of STOCKTAKE_SURFACES) {
  const content = read(file);
  if (content === null) {
    failures.push(`${file}: không tồn tại.`);
    continue;
  }
  // Chỉ chặn KHAI BÁO thật; câu chú thích giải thích vì sao không có thì được phép.
  const declarations = content
    .split("\n")
    .filter(
      (line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"),
    )
    .join("\n");
  if (pattern.test(declarations)) {
    failures.push(
      `${file}: còn bề mặt Stocktake — vi phạm REQ-SRS-037 / AC-SRS-037.`,
    );
  }
}

// ───────────────────── 7. Backend (tuỳ chọn, có repo thì bắt buộc) ─────────────────────

if (!existsSync(backendRoot)) {
  notes.push(
    `Backend không có tại ${backendRoot}; bỏ qua cổng BE. Đặt WMS_BACKEND_ROOT để bật.`,
  );
} else {
  const CONTROLLER =
    "Modules/Warehouse/app/Http/Controllers/ReversalDocumentController.php";
  for (const column of [
    "reversal_documents.physical_return_status",
    "reversal_documents.condition_status",
    "reversal_documents.cancelled_at",
    "reversal_documents.cancel_reason",
  ]) {
    requirePhrase(
      CONTROLLER,
      column,
      "ERD bảng 33: thiếu cột này thì bước CONFIRMED của §6 không tồn tại trên UI (BR-REV-06)",
      backendRoot,
    );
  }
  requirePhrase(
    CONTROLLER,
    "applyWarehouseScope",
    "danh sách reversal phải lọc data scope ngay trong query để phân trang đúng",
    backendRoot,
  );

  const ROUTES_FILE = "Modules/Warehouse/routes/api.php";
  const routes = read(ROUTES_FILE, backendRoot);
  if (routes === null) {
    failures.push(`${ROUTES_FILE}: không tồn tại.`);
  } else {
    const guarded = (
      routes.match(/EnforceReversalWarehouseScope::class/g) ?? []
    ).length;
    if (guarded < 7) {
      failures.push(
        `${ROUTES_FILE}: chỉ ${guarded}/7 route reversal-documents có EnforceReversalWarehouseScope — ghi/đọc vượt biên warehouse vẫn mở.`,
      );
    }
  }

  requirePhrase(
    "tests/Feature/Wwhn242ReversalScopeAndProjectionTest.php",
    "DATA_SCOPE_DENIED",
    "phải có test chứng minh từ chối theo data scope là no-write",
    backendRoot,
  );
}

// ───────────────────────── Kết quả ─────────────────────────

for (const note of notes) console.log(`NOTE  ${note}`);

if (failures.length > 0) {
  console.error(`\nWWHN-242 closure gate: FAIL (${failures.length})`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("\nWWHN-242 closure gate: PASS");
