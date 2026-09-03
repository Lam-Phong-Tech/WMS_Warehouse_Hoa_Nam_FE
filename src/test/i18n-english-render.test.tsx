/**
 * BẰNG CHỨNG CHẠY THẬT cho yêu cầu "đổi sang English là đổi đủ 100%".
 *
 * `i18n-coverage.test.ts` kiểm TĨNH (bảng chuỗi đủ khoá, file không còn chuỗi
 * trần). Test này kiểm ĐỘNG: mount một màn nghiệp vụ thật với payload thật ở
 * ngôn ngữ EN rồi quét toàn bộ text trong DOM tìm ký tự tiếng Việt. Đây đúng là
 * thứ người dùng nhìn thấy, và nó bắt được những đường mà kiểm tĩnh không thấy:
 * nhãn nghiệp vụ dựng từ enum BE, ô rỗng `EMPTY_TEXT`, nhãn mặc định của
 * `ActionButton`, ngày tháng, và mọi chuỗi bị "đóng băng" ở cấp module.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

vi.mock("@/shared/api/http", () => ({
  http: {
    get: vi.fn(),
    getPage: vi.fn(),
    post: vi.fn(),
    downloadFile: vi.fn(),
  },
}));

import { http } from "@/shared/api/http";
import { useAuthStore } from "@/shared/store/auth.store";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { ROUTES } from "@/shared/constants/routes";
import PackingLabelReportPage from "@/modules/reports/pages/PackingLabelReportPage";

const VIETNAMESE_LETTER =
  /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i;

const LABEL_ID = "ls-1";

/** Payload đúng shape BE — có ô trống để `EMPTY_TEXT` thật sự được render. */
const PAYLOAD: Record<string, unknown> = {
  "/reports/label-log": {
    rows: [
      {
        id: LABEL_ID,
        label_code: "PL-PX-0001",
        outbound_no: "PX-0001",
        outbound_date: "2026-09-01",
        // recipient rỗng ⇒ bảng phải in EMPTY_TEXT (một trong những chỗ hay
        // sót tiếng Việt nhất vì nó không đi qua t()).
        recipient: "",
        status: "PRINTED",
        applied: true,
        printer_config_id: "pc-a",
        printer_name: "Zebra ZD421",
        total_attempts: 1,
        failed_count: 0,
        reprint_count: 0,
        created_at: "2026-09-01 08:00:00",
      },
    ],
    summary: {},
  },
};

const PAGE_PAYLOAD: Record<string, unknown[]> = {
  "/label-print-events": [
    {
      id: "ev-1",
      label_snapshot_id: LABEL_ID,
      printer_config_id: "pc-a",
      created_by: "u-1",
      // Từ vựng ERD của trigger PostgreSQL — phải ra nhãn EN, không phải VI.
      status: "FAILED",
      error_code: "PAPER_OUT",
      error_message: null,
      reason: null,
      requested_at: "2026-09-02T09:00:00+07:00",
      created_at: "2026-09-02 09:00:00",
    },
  ],
  "/printer-configs": [
    { id: "pc-a", printer_code: "PRN-01", printer_name: "Zebra ZD421" },
  ],
  "/users": [{ user_id: "u-1", display_name: "Nguyen Kho Van" }],
};

/** Mọi đoạn text trong DOM, đã bỏ khoảng trắng thừa. */
function visibleTexts(root: HTMLElement): string[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out: string[] = [];
  let node = walker.nextNode();
  while (node) {
    const text = (node.textContent ?? "").trim();
    if (text) out.push(text);
    node = walker.nextNode();
  }
  return out;
}

/** Nhãn trợ năng cũng là thứ người dùng "nghe" thấy — quét luôn. */
function ariaLabels(root: HTMLElement): string[] {
  return [
    ...root.querySelectorAll<HTMLElement>("[aria-label],[title]"),
  ].flatMap((element) =>
    [
      element.getAttribute("aria-label") ?? "",
      element.getAttribute("title") ?? "",
    ].filter(Boolean),
  );
}

describe("đổi sang English · màn hình không còn chữ tiếng Việt", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset();
    vi.mocked(http.getPage).mockReset();
    vi.mocked(http.get).mockImplementation(
      async (url: unknown) => (PAYLOAD[String(url)] ?? { rows: [] }) as never,
    );
    vi.mocked(http.getPage).mockImplementation(async (url: unknown) => ({
      data: (PAGE_PAYLOAD[String(url)] ?? []) as never,
      meta: { current_page: 1, last_page: 1, total: 1 },
    }));
    useAuthStore.setState({
      isSuperAdmin: false,
      permissionCodes: ["report.view", "report.export", "REPORT_EXPORT"],
    });
    useLanguageStore.getState().setLanguage("en");
  });

  afterEach(() => {
    useLanguageStore.getState().setLanguage("vi");
    cleanupTestState();
  });

  it("RPT-05 Nhãn đóng gói: mọi chữ trên màn đều là tiếng Anh", async () => {
    const { container } = renderWithProviders(<PackingLabelReportPage />, [
      ROUTES.REPORTS_PACKING_LABEL,
    ]);

    // Chờ dữ liệu về để quét cả phần bảng, không chỉ khung tĩnh.
    expect(await screen.findByRole("table")).toBeInTheDocument();

    const offenders = [
      ...visibleTexts(container),
      ...ariaLabels(container),
    ].filter((text) => VIETNAMESE_LETTER.test(text));

    expect(offenders).toEqual([]);
  });

  it("nhãn kết quả in dịch từ từ vựng ERD của BE, không lộ mã thô", async () => {
    renderWithProviders(<PackingLabelReportPage />, [
      ROUTES.REPORTS_PACKING_LABEL,
    ]);

    const table = await screen.findByRole("table");
    // `FAILED` (trigger PostgreSQL) và `PRINT_FAILED` (nghiệp vụ) về cùng nhãn.
    expect(table).toHaveTextContent("Print failed");
    expect(table).not.toHaveTextContent("FAILED");
  });
});
