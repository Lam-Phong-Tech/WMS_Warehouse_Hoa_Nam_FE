/**
 * HÀNG RÀO NGÔN NGỮ — chống tái diễn lỗi "đổi sang English mà màn hình vẫn còn
 * tiếng Việt" (phản hồi người dùng 2026-09-03).
 *
 * Ba thứ được khoá ở đây, tương ứng ba cách một chuỗi có thể lọt lưới:
 *
 *  1. `messages.ts` — mọi khoá VI phải có bản EN. `t()` cố ý rơi về tiếng Việt
 *     khi thiếu khoá (fail-safe, không bao giờ lộ khoá thô ra UI), nhưng chính
 *     cơ chế đó khiến khoá thiếu EN trở nên VÔ HÌNH: không lỗi, không cảnh báo,
 *     chỉ là một dòng tiếng Việt nằm giữa màn tiếng Anh.
 *  2. Các bảng nhãn NGOÀI messages.ts (nhãn theo enum BE, nhãn nút mặc định, ô
 *     rỗng) — đọc trực tiếp ở hai ngôn ngữ để chắc chắn chúng thật sự đổi.
 *  3. Component — không được có chuỗi tiếng Việt trần trong JSX/prop.
 *
 * Xem thêm `i18n-english-render.test.tsx`: bản kiểm ĐỘNG, mount màn thật ở EN
 * rồi quét DOM. Hai file bổ trợ nhau — tĩnh bắt chỗ chưa chuyển, động bắt chỗ
 * đã chuyển nhưng vẫn ra tiếng Việt lúc chạy.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { MESSAGES_VI } from "@/shared/i18n/messages";
import { MESSAGES_EN } from "@/shared/i18n/messages.en";
import {
  AUDIT_ACTION_LABELS,
  INBOUND_STATUS_LABELS,
  INVENTORY_STOCK_STATUS_LABELS,
  MOVEMENT_TYPE_LABELS,
  OUTBOUND_STATUS_LABELS,
  UNKNOWN_BUSINESS_LABEL,
} from "@/shared/constants/business-labels";
import { ACTION_KINDS } from "@/shared/components/actions/action-kinds";
import {
  CHECK_LABELS,
  LABELS as STOCK_RECONCILE_LABELS,
  NORM_STATE_LABELS,
} from "@/modules/reports/stock-reconcile/stock-reconcile-labels";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useLanguageStore } from "@/shared/i18n/language.store";

const SRC = join(process.cwd(), "src");

/** Ký tự chỉ có trong bảng chữ tiếng Việt (không trùng ký tự nào của EN). */
const VN =
  /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i;

/**
 * File mà tiếng Việt là DỮ LIỆU chứ không phải chuỗi giao diện chờ dịch.
 * Mỗi mục phải nêu được lý do; không thêm mục mới chỉ để test hết đỏ.
 */
const VIETNAMESE_IS_DATA: ReadonlyMap<string, string> = new Map([
  [
    "src/shared/ui/icons/icon-font-health.ts",
    "console.error chẩn đoán cho DEV khi font icon hỏng — không phải chuỗi UI; " +
      "hướng dẫn chạy lệnh yarn nên giữ tiếng Việt thô, không đi qua bảng chuỗi",
  ],
  // Bảng chuỗi và lớp phủ EN của nó.
  ["src/shared/i18n/messages.ts", "bảng chuỗi VI"],
  [
    "src/shared/i18n/messages.en.ts",
    "bảng chuỗi EN; tên ngôn ngữ giữ nguyên bản ngữ là đúng UX",
  ],
  ["src/shared/i18n/nav-labels.ts", "lớp phủ EN cho menu và tiêu đề trang"],
  ["src/shared/i18n/language.store.ts", '"Tiếng Việt" là tên ngôn ngữ'],
  // Bảng nhãn song ngữ: cả hai thứ tiếng nằm ngay trong file.
  [
    "src/shared/constants/business-labels.ts",
    "map nhãn theo enum BE, song ngữ",
  ],
  ["src/shared/constants/display.ts", "EMPTY_TEXT song ngữ"],
  [
    "src/shared/components/actions/action-kinds.tsx",
    "nhãn nút mặc định, song ngữ",
  ],
  [
    "src/modules/reports/operations/report-labels.ts",
    "map nhãn báo cáo, song ngữ",
  ],
  [
    "src/modules/reports/movement-trace/movement-trace-labels.ts",
    "map nhãn movement, song ngữ",
  ],
  [
    "src/modules/reports/warranty-components/warranty-components-model.ts",
    "map nhãn bảo hành, song ngữ",
  ],
  [
    "src/modules/reports/import-match/import-match-model.ts",
    "map nhãn import-match, song ngữ",
  ],
  [
    "src/modules/reports/stock-reconcile/stock-reconcile-labels.ts",
    "map nhãn tồn kho & đối soát, song ngữ",
  ],
  [
    "src/modules/reports/packing-label/packing-label-labels.ts",
    "map nhãn lỗi in / trạng thái bản lưu nhãn, song ngữ",
  ],
  [
    "src/modules/audit-logs/constants/audit-log-labels.ts",
    "map nhãn loại đối tượng / trường dữ liệu nhật ký, song ngữ",
  ],
  [
    "src/shared/constants/agency-place-labels.ts",
    "map thị trường song ngữ + tên tỉnh/thành (danh từ riêng, không dịch)",
  ],
  // Nguồn VI của cây menu; bản EN nằm ở nav-labels.ts.
  ["src/app/layouts/nav-data.ts", "nhãn menu VI; EN ở nav-labels.ts"],
  // Chuỗi tiếng Việt là DỮ LIỆU đối sánh / payload gửi BE, không phải nhãn.
  [
    "src/shared/api/api-error.ts",
    "câu validate BE dùng để SO SÁNH, không hiển thị",
  ],
  ["src/shared/api/http.ts", "console.warn chỉ chạy ở DEV"],
  [
    "src/modules/outbound/components/AlignedOutboundDetailModal.tsx",
    "REPRINT_REASONS là giá trị ghi vào nhật ký in ở BE; phần hiển thị đã dịch",
  ],
  [
    "src/modules/master-data/pages/ApiMasterScreens.tsx",
    'unit mặc định "cái" gửi BE, không phải nhãn',
  ],
]);

/**
 * Màn CHƯA chuyển hết sang i18n. Danh sách này chỉ được phép NGẮN ĐI.
 * Màn mới phải dùng `useT()` ngay từ đầu, không được thêm vào đây.
 */
const PENDING_FILES: ReadonlySet<string> = new Set([]);

function leafPaths(tree: unknown, prefix = ""): string[] {
  if (typeof tree !== "object" || tree === null) return [];
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [path] : leafPaths(value, path);
  });
}

function readLeaf(tree: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      tree,
    );
}

function withLanguage<T>(language: "vi" | "en", read: () => T): T {
  const previous = useLanguageStore.getState().language;
  useLanguageStore.getState().setLanguage(language);
  try {
    return read();
  } finally {
    useLanguageStore.getState().setLanguage(previous);
  }
}

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // `src/test` là hạ tầng test (fixture, setup), không phải giao diện.
      if (entry !== "test") sourceFiles(full, found);
      continue;
    }
    if (/\.tsx?$/u.test(entry) && !/\.test\.tsx?$/u.test(entry)) {
      found.push(full);
    }
  }
  return found;
}

/** Bỏ comment để chữ tiếng Việt trong ghi chú code không bị tính là chuỗi UI. */
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/(^|[^:"'`])\/\/[^\n]*/gu, "$1");
}

function hardcodedVietnamese(code: string): string[] {
  const body = stripComments(code);
  const hits: string[] = [];
  for (const match of body.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/gu)) {
    if (VN.test(match[2])) hits.push(match[2]);
  }
  for (const match of body.matchAll(/>([^<>{}]+)</gu)) {
    const text = match[1].trim();
    if (text && VN.test(text)) hits.push(text);
  }
  return hits;
}

describe("hàng rào ngôn ngữ · bảng chuỗi", () => {
  it("mọi khoá tiếng Việt đều có bản tiếng Anh", () => {
    const english = new Set(leafPaths(MESSAGES_EN));
    const missing = leafPaths(MESSAGES_VI).filter((key) => !english.has(key));
    expect(missing).toEqual([]);
  });

  it("không bản dịch EN nào bị bỏ trống hoặc chép nguyên tiếng Việt", () => {
    // Tên ngôn ngữ hiển thị bằng CHÍNH ngôn ngữ đó ở mọi giao diện — đó là quy
    // ước của bộ chọn ngôn ngữ, nên "Tiếng Việt" đứng nguyên trong bản EN.
    const languageNames = new Set([
      "topbar.languageVietnamese",
      "topbar.languageVi",
      "topbar.languageViSub",
    ]);
    const suspicious = leafPaths(MESSAGES_EN).filter((path) => {
      if (languageNames.has(path)) return false;
      // Dữ liệu mẫu của trang catalog design-system: tên riêng tiếng Việt (đại
      // lý, hãng, người) và đoạn văn mẫu để soi dấu tiếng Việt trong typography
      // — dịch sang EN thì mất đúng thứ nó đang minh hoạ.
      if (path === "catalog.longText" || path.startsWith("catalog.data."))
        return false;
      const value = readLeaf(MESSAGES_EN, path);
      return (
        typeof value === "string" && (value.trim() === "" || VN.test(value))
      );
    });
    expect(suspicious).toEqual([]);
  });

  it("placeholder {…} của bản EN khớp bản VI", () => {
    const names = (text: string) =>
      [...text.matchAll(/\{(\w+)\}/gu)].map((match) => match[1]).sort();
    const mismatched = leafPaths(MESSAGES_EN).filter((path) => {
      const vi = readLeaf(MESSAGES_VI, path);
      const en = readLeaf(MESSAGES_EN, path);
      if (typeof vi !== "string" || typeof en !== "string") return false;
      return JSON.stringify(names(vi)) !== JSON.stringify(names(en));
    });
    expect(mismatched).toEqual([]);
  });
});

describe("hàng rào ngôn ngữ · nhãn ngoài bảng chuỗi", () => {
  it("nhãn nghiệp vụ theo enum BE đổi theo ngôn ngữ", () => {
    const maps: ReadonlyArray<Record<string, string>> = [
      INBOUND_STATUS_LABELS,
      OUTBOUND_STATUS_LABELS,
      MOVEMENT_TYPE_LABELS,
      INVENTORY_STOCK_STATUS_LABELS,
      AUDIT_ACTION_LABELS,
    ];
    const leaks = maps.flatMap((map) =>
      Object.keys(map)
        .map((key) => ({ key, english: withLanguage("en", () => map[key]) }))
        .filter((entry) => VN.test(entry.english))
        .map((entry) => `${entry.key} = ${entry.english}`),
    );
    expect(leaks).toEqual([]);
  });

  // Nhãn của RPT-02 nằm ở file riêng (được miễn quét chuỗi trần), nên phải
  // kiểm chúng thật sự song ngữ — nếu không thì miễn quét = mất hàng rào.
  it("nhãn của màn Tồn kho & đối soát đổi theo ngôn ngữ", () => {
    const maps: ReadonlyArray<Record<string, string>> = [
      STOCK_RECONCILE_LABELS,
      CHECK_LABELS,
      NORM_STATE_LABELS,
    ];
    const leaks = maps.flatMap((map) =>
      Object.keys(map)
        .map((key) => ({ key, english: withLanguage("en", () => map[key]) }))
        .filter((entry) => VN.test(entry.english))
        .map((entry) => `${entry.key} = ${entry.english}`),
    );
    expect(leaks).toEqual([]);
  });

  it("nhãn nút hành động mặc định đổi theo ngôn ngữ", () => {
    const leaks = Object.entries(ACTION_KINDS)
      .map(([kind, item]) => ({
        kind,
        english: withLanguage("en", () => item.label),
      }))
      .filter((entry) => VN.test(entry.english))
      .map((entry) => `${entry.kind} = ${entry.english}`);
    expect(leaks).toEqual([]);
  });

  it("ô rỗng và nhãn 'chưa xác định' đổi theo ngôn ngữ", () => {
    expect(EMPTY_TEXT).toBe("Chưa có");
    expect(UNKNOWN_BUSINESS_LABEL).toBe("Chưa xác định");

    // `export let` là live binding: đọc lại SAU khi store phát sự kiện.
    const english = withLanguage("en", () => [
      EMPTY_TEXT,
      UNKNOWN_BUSINESS_LABEL,
    ]);
    expect(english[0]).not.toMatch(VN);
    expect(english[1]).not.toMatch(VN);

    // Và trả về đúng tiếng Việt sau khi đổi lại.
    expect(EMPTY_TEXT).toBe("Chưa có");
  });
});

describe("hàng rào ngôn ngữ · chuỗi cứng trong component", () => {
  const offenders = sourceFiles(SRC)
    .map((file) => ({
      file: relative(process.cwd(), file).split(sep).join("/"),
      hits: hardcodedVietnamese(readFileSync(file, "utf8")),
    }))
    .filter((entry) => entry.hits.length > 0)
    .filter((entry) => !VIETNAMESE_IS_DATA.has(entry.file));

  it("không file nào ngoài danh sách chờ còn chuỗi tiếng Việt trần", () => {
    const unexpected = offenders
      .filter((entry) => !PENDING_FILES.has(entry.file))
      .map((entry) => `${entry.file} (${entry.hits.length}): ${entry.hits[0]}`);
    expect(unexpected).toEqual([]);
  });

  it("danh sách chờ chỉ được ngắn đi, không dài ra", () => {
    const stale = [...PENDING_FILES].filter(
      (file) => !offenders.some((entry) => entry.file === file),
    );
    expect(
      stale,
      "File này đã sạch — xoá khỏi PENDING_FILES để không ai thêm chuỗi cứng vào lại",
    ).toEqual([]);
  });
});
