import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
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
import { ImportQualityBatchDrawer } from "./ImportQualityBatchDrawer";
import { buildImportBatches } from "./import-match-model";

const latest = {
  import_report_id: "report-v2",
  file_name: "sku.xlsx",
  file_sha256: "abc",
  source_file_id: "source-1",
  result_version: 2,
  mode: "DRY_RUN",
  status: "VALID",
  total_rows: 8,
  valid_rows: 8,
  error_rows: 0,
  inserted_rows: 5,
  updated_rows: 3,
  uploaded_by_name: "Nguyễn Văn An",
  uploaded_by_account: "an.nv",
  uploaded_at: "2026-11-10T02:45:00Z",
  actor_name: "Người kiểm tra",
  actor_account: "checker",
  created_at: "2026-11-14T03:00:00Z",
  completed_at: "2026-11-14T03:00:02Z",
  processing_duration_ms: 2000,
  file_size_bytes: 2048,
  sheet_name: "Danh mục",
  template_version: "v1.1.0",
  update_existing: true,
  source_file_available: true,
  source_file_status: "AVAILABLE",
  error_file_available: false,
};
const original = {
  ...latest,
  import_report_id: "report-v1",
  result_version: 1,
  mode: "COMMIT",
  status: "COMMITTED",
  total_rows: 2,
  valid_rows: 2,
  inserted_rows: 2,
  updated_rows: 0,
};

function setup() {
  vi.mocked(http.get).mockResolvedValue([latest, original]);
  vi.mocked(http.getPage).mockImplementation(
    async (path) =>
      ({
        data: path.endsWith("/versions") ? [latest, original] : [],
        meta: { total: path.endsWith("/versions") ? 2 : 0, last_page: 1 },
      }) as never,
  );
  const batch = buildImportBatches([latest], () => "fallback")[0];
  return renderWithProviders(
    <ImportQualityBatchDrawer batch={batch} onClose={vi.fn()} />,
  );
}

describe("import result history drawer", () => {
  afterEach(() => {
    cleanupTestState();
    vi.clearAllMocks();
  });

  it("shows uploader, file facts and dry-run projected counts without claiming writes", async () => {
    setup();
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Nguyễn Văn An")).toBeInTheDocument();
    expect(within(dialog).getByText("an.nv")).toBeInTheDocument();
    expect(within(dialog).getByText("2 KB")).toBeInTheDocument();
    expect(within(dialog).getByText("Danh mục")).toBeInTheDocument();
    expect(within(dialog).getByText("Dòng hợp lệ")).toBeInTheDocument();
    expect(within(dialog).queryByText("Khớp")).not.toBeInTheDocument();
    const actual = await within(dialog).findByRole("region", {
      name: "Kết quả ghi dữ liệu",
    });
    expect(
      within(actual).getByText("Không ghi").nextElementSibling,
    ).toHaveTextContent("8");
    expect(
      within(actual).getByText("Thêm mới").nextElementSibling,
    ).toHaveTextContent("0");
    expect(within(dialog).getByText(/Dự kiến thêm mới: 5/)).toBeInTheDocument();
  });

  it("switches the whole saved result and downloads the selected version", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(
      await screen.findByRole("button", { name: /Phiên bản 1/ }),
    );
    const actual = screen.getByRole("region", { name: "Kết quả ghi dữ liệu" });
    expect(
      within(actual).getByText("Thêm mới").nextElementSibling,
    ).toHaveTextContent("2");
    vi.mocked(http.downloadFile).mockResolvedValue({
      blob: new Blob(["result"]),
      fileName: "v1.xlsx",
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    await user.click(
      screen.getByRole("button", { name: "Tải báo cáo kết quả" }),
    );
    expect(http.downloadFile).toHaveBeenCalledWith(
      "/skus/import-reports/report-v1/result-file",
    );
    expect(http.getPage).toHaveBeenCalledWith(
      "/skus/import-reports/report-v1/rows",
      expect.anything(),
    );
    click.mockRestore();
  });

  it("adds a recheck version and preserves visible history on a failed subsequent recheck", async () => {
    const user = userEvent.setup();
    setup();
    vi.mocked(http.post).mockResolvedValueOnce({
      ...latest,
      import_report_id: "report-v3",
      result_version: 3,
    });
    await user.click(
      await screen.findByRole("button", { name: "Kiểm tra lại" }),
    );
    expect(
      await screen.findByRole("button", { name: /Phiên bản 3/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(http.post).toHaveBeenCalledWith(
      "/skus/import-reports/report-v2/recheck",
      {},
    );
    vi.mocked(http.post).mockRejectedValueOnce(new Error("Offline"));
    await user.click(screen.getByRole("button", { name: "Kiểm tra lại" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Phiên bản 3/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("explains unavailable legacy file actions instead of inventing size or duration", async () => {
    const batch = buildImportBatches(
      [{ import_report_id: "legacy", total_rows: 1, valid_rows: 1 }],
      () => "",
    )[0];
    vi.mocked(http.get).mockResolvedValue([]);
    vi.mocked(http.getPage).mockResolvedValue({ data: [], meta: {} } as never);
    renderWithProviders(
      <ImportQualityBatchDrawer batch={batch} onClose={vi.fn()} />,
    );
    expect(
      await screen.findByRole("button", { name: "Tải file gốc" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Kiểm tra lại" })).toBeDisabled();
    expect(
      screen.getByText("Chưa lưu file gốc cho lần nhập này."),
    ).toBeInTheDocument();
    expect(screen.queryByText("0 KB")).not.toBeInTheDocument();
  });

  it("keeps the new version selected when an earlier history refresh finishes late", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const key = ["rpt-04", "sku-import-versions", "report-v2"];
    client.setQueryData(key, [latest, original]);
    let finish!: (value: {
      data: (typeof latest)[];
      meta: { last_page: number };
    }) => void;
    const pending = new Promise<{
      data: (typeof latest)[];
      meta: { last_page: number };
    }>((resolve) => {
      finish = resolve;
    });
    vi.mocked(http.getPage).mockImplementation(async (path) =>
      path.endsWith("/versions")
        ? pending
        : ({ data: [], meta: { last_page: 1, total: 0 } } as never),
    );
    vi.mocked(http.post).mockResolvedValueOnce({
      ...latest,
      import_report_id: "report-v3",
      result_version: 3,
    });
    render(
      <QueryClientProvider client={client}>
        <ImportQualityBatchDrawer
          batch={buildImportBatches([latest], () => "")[0]}
          onClose={vi.fn()}
        />
      </QueryClientProvider>,
    );
    await screen.findByRole("button", { name: "Kiểm tra lại" });
    let refreshing!: Promise<void>;
    act(() => {
      refreshing = client.refetchQueries({ queryKey: key });
    });
    await user.click(screen.getByRole("button", { name: "Kiểm tra lại" }));
    await screen.findByRole("button", { name: /Phiên bản 3/ });
    await act(async () => {
      finish({ data: [latest, original], meta: { last_page: 1 } });
      await refreshing;
    });
    expect(client.getQueryData(key)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ import_report_id: "report-v3" }),
      ]),
    );
    expect(screen.getByRole("button", { name: /Phiên bản 3/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    client.clear();
  });

  it("uses the server expiry reason even when the client clock is behind", async () => {
    const clock = vi
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2026-01-01T00:00:00Z").getTime());
    const expired = {
      ...latest,
      error_file_available: false,
      error_file_status: "EXPIRED",
      error_file_expires_at: "2026-11-10T00:00:00Z",
    };
    vi.mocked(http.getPage).mockImplementation(
      async (path) =>
        ({
          data: path.endsWith("/versions") ? [expired] : [],
          meta: { total: 0, last_page: 1 },
        }) as never,
    );
    renderWithProviders(
      <ImportQualityBatchDrawer
        batch={buildImportBatches([expired], () => "")[0]}
        onClose={vi.fn()}
      />,
    );
    try {
      expect(
        await screen.findByText("File lỗi đã hết hạn tải."),
      ).toBeInTheDocument();
    } finally {
      clock.mockRestore();
    }
  });
});
