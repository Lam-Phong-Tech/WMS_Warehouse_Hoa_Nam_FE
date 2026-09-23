import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

vi.mock("@/modules/warranty/services/warrantyService", () => ({
  fetchWarrantyCases: vi.fn(),
  fetchWarrantyCase: vi.fn(),
  fetchWarrantyCaseEvents: vi.fn(),
  fetchWarrantyAttachments: vi.fn(),
  createWarrantyCase: vi.fn(),
  updateWarrantyCase: vi.fn(),
  uploadWarrantyAttachment: vi.fn(),
  deleteWarrantyAttachment: vi.fn(),
  downloadWarrantyAttachment: vi.fn(),
  makeWarrantyIdempotencyKey: vi.fn(() => "fe:test:key"),
}));
// Cố ý trả danh mục KHÔNG theo thứ tự mã (BE xếp theo created_at) để khoá luôn
// việc màn hình phải tự sắp lại — xem test "danh mục bệnh/lỗi xếp theo mã".
vi.mock("@/modules/master-data/hooks/use-mvp-master", () => ({
  useMvpDefects: vi.fn(() => ({
    data: {
      data: [
        {
          defect_id: "defect-9",
          defect_code: "DEF-009",
          defect_name: "Kêu to bất thường",
        },
        {
          defect_id: "defect-1",
          defect_code: "DEF-001",
          defect_name: "Không lên nguồn",
        },
        {
          defect_id: "defect-4",
          defect_code: "DEF-004",
          defect_name: "Chập điện",
        },
      ],
    },
    isLoading: false,
  })),
}));
vi.mock("@/modules/warranty/components/WarrantyIntakeModal", () => ({
  WarrantyIntakeModal: () => <div data-testid="intake-modal" />,
}));
vi.mock("@/modules/warranty/components/WarrantyDetailModal", () => ({
  WarrantyDetailModal: ({ caseId }: { caseId: string }) => (
    <div data-testid="detail-modal">{caseId}</div>
  ),
}));
vi.mock("@/modules/warranty/components/ComponentIssueModal", () => ({
  ComponentIssueModal: ({ caseId }: { caseId: string }) => (
    <div data-testid="component-issue-modal">{caseId}</div>
  ),
}));

import { fetchWarrantyCases } from "@/modules/warranty/services/warrantyService";
import { useAuthStore } from "@/shared/store/auth.store";
import WarrantyPage from "./WarrantyPage";

const CASES = [
  {
    id: "wc-1",
    case_code: "BH-0001",
    sku: "KT-2000",
    sku_name: "Máy khoan KT-2000",
    item_code: "SER-001",
    identification_type: "IDENTIFIED" as const,
    customer_name: "Nguyễn Văn A",
    customer_phone: "0900000001",
    defect: "Không lên nguồn",
    defect_code: "PWR",
    status: "RECEIVED" as const,
    priority: "MEDIUM" as const,
    received_at: "2026-08-10T08:00:00Z",
    created_at: "2026-08-10T08:00:00Z",
    created_by: "thukho",
    case_age_days: 3,
    version: 1,
    pii_masked: false,
  },
  {
    id: "wc-2",
    case_code: "BH-0002",
    sku: "",
    // Thiếu dữ liệu = CHUỖI RỖNG, đúng thứ warrantyService trả về sau WWHN-340.
    // Trước đó service đặt sentinel "-", làm mọi `value || EMPTY_TEXT` ở tầng
    // render mất tác dụng và người dùng thấy dấu gạch giữa bảng tiếng Việt.
    sku_name: "",
    temporary_item_code: "TEMP-0002",
    identification_type: "TEMP_ONLY" as const,
    customer_name: "Trần Thị B",
    defect: "",
    defect_code: "",
    reported_defect: "Kẹt cò",
    status: "CHECKING" as const,
    priority: "MEDIUM" as const,
    received_at: "2026-08-12T08:00:00Z",
    created_at: "2026-08-12T08:00:00Z",
    created_by: "thukho",
    case_age_days: 1,
    version: 2,
    pii_masked: false,
  },
];

function grant(permissionCodes: string[]) {
  useAuthStore.setState({ isSuperAdmin: false, permissionCodes });
}

describe("WarrantyPage (WAR-01 hub)", () => {
  beforeEach(() => {
    vi.mocked(fetchWarrantyCases).mockReset();
    vi.mocked(fetchWarrantyCases).mockResolvedValue({
      data: CASES,
      meta: { total: 2 },
    });
    grant(["warranty.manage", "warranty.component_issue"]);
  });

  afterEach(() => {
    cleanupTestState();
  });

  it("hiển thị danh sách case và nút tiếp nhận theo quyền", async () => {
    renderWithProviders(<WarrantyPage />, ["/warranty"]);

    expect(await screen.findByText("BH-0001")).toBeInTheDocument();
    expect(screen.getByText("BH-0002")).toBeInTheDocument();
    // Cột "Nhận diện" hiển thị nhãn tiếng Việt, không lộ enum thô của BE.
    expect(screen.getByText("Đã xác định")).toBeInTheDocument();
    expect(screen.getByText("Tiếp nhận tạm")).toBeInTheDocument();
    expect(screen.queryByText("TEMP_ONLY")).not.toBeInTheDocument();
    // Chi tiết nhận diện (TEMP_ONLY/mã tạm) đã chuyển hẳn vào modal "Xem chi tiết" — cột list chỉ giữ định danh case.
    expect(
      screen.getByRole("button", { name: /Tiếp nhận bảo hành/ }),
    ).toBeInTheDocument();
    // Không có warranty.pii.view => hiện ghi chú mask PII.
    expect(screen.getByText(/warranty.pii.view/)).toBeInTheDocument();
  });

  it("ẩn nút tiếp nhận khi thiếu warranty.manage", async () => {
    grant(["warranty.component_issue"]);
    renderWithProviders(<WarrantyPage />, ["/warranty"]);

    await screen.findByText("BH-0001");
    expect(
      screen.queryByRole("button", { name: /Tiếp nhận bảo hành/ }),
    ).not.toBeInTheDocument();
  });

  // §13.8: BE chặn tra theo tên/SĐT khi thiếu warranty.pii.view, nên placeholder
  // không được mời gõ thứ chắc chắn không ra kết quả.
  it("thiếu warranty.pii.view: placeholder ô tìm không hứa tên khách / SĐT", async () => {
    renderWithProviders(<WarrantyPage />, ["/warranty"]);

    await screen.findByText("BH-0001");
    const placeholder = screen
      .getByRole("textbox", { name: /Tìm hồ sơ bảo hành/ })
      .getAttribute("placeholder");
    expect(placeholder).toContain("sản phẩm");
    expect(placeholder).not.toContain("tên khách");
  });

  it("có warranty.pii.view: placeholder ô tìm hứa cả tên khách và sản phẩm", async () => {
    grant(["warranty.manage", "warranty.pii.view"]);
    renderWithProviders(<WarrantyPage />, ["/warranty"]);

    await screen.findByText("BH-0001");
    const placeholder = screen
      .getByRole("textbox", { name: /Tìm hồ sơ bảo hành/ })
      .getAttribute("placeholder");
    expect(placeholder).toContain("tên khách");
    expect(placeholder).toContain("sản phẩm");
  });

  it("bấm Cập nhật mở modal chi tiết đúng case (WAR-03)", async () => {
    renderWithProviders(<WarrantyPage />, ["/warranty"]);

    // Nhãn trình bày mới là "Cập nhật", vẫn mở modal chi tiết WAR-03.
    const openButtons = await screen.findAllByRole("button", {
      name: /Cập nhật/,
    });
    fireEvent.click(openButtons[0]);

    expect(await screen.findByTestId("detail-modal")).toHaveTextContent("wc-1");
  });

  it("deep-link ?screen=WAR-02 mở modal tiếp nhận", async () => {
    renderWithProviders(<WarrantyPage />, ["/warranty?screen=WAR-02"]);
    expect(await screen.findByTestId("intake-modal")).toBeInTheDocument();
  });

  it("deep-link ?screen=COMP-01&id=wc-9 mở modal xuất linh kiện", async () => {
    renderWithProviders(<WarrantyPage />, ["/warranty?screen=COMP-01&id=wc-9"]);
    expect(
      await screen.findByTestId("component-issue-modal"),
    ).toHaveTextContent("wc-9");
  });

  it("lọc trạng thái gọi lại API với status canonical", async () => {
    renderWithProviders(<WarrantyPage />, ["/warranty"]);
    await screen.findByText("BH-0001");

    // Bộ lọc trạng thái là MUI Select (không còn <select> gốc) — mở menu rồi
    // chọn option thay vì fireEvent.change trực tiếp lên value.
    fireEvent.mouseDown(screen.getByLabelText("Lọc trạng thái bảo hành"));
    fireEvent.click(
      await screen.findByRole("option", { name: "Đang kiểm tra" }),
    );

    await waitFor(() => {
      expect(fetchWarrantyCases).toHaveBeenCalledWith(
        expect.objectContaining({ status: "CHECKING", page: 1 }),
      );
    });
  });

  // ── WWHN-340 · UAT TC_FUNC_02 ────────────────────────────────────────────
  // Bộ lọc "Nhận diện" và "Bệnh/lỗi" của WAR-01 phải gửi ĐÚNG tham số lên API
  // và luôn quay về trang 1 — lọc xong mà còn đứng ở trang 5 thì người dùng
  // nhìn thấy bảng rỗng và kết luận "lọc không ra kết quả".

  it("lọc Nhận diện gửi identification_status và về trang 1", async () => {
    renderWithProviders(<WarrantyPage />, ["/warranty"]);
    await screen.findByText("BH-0001");

    fireEvent.mouseDown(screen.getByLabelText("Lọc loại nhận diện"));
    fireEvent.click(
      await screen.findByRole("option", { name: "Tiếp nhận tạm" }),
    );

    await waitFor(() => {
      expect(fetchWarrantyCases).toHaveBeenCalledWith(
        expect.objectContaining({
          identification_status: "TEMP_ONLY",
          page: 1,
        }),
      );
    });
  });

  // Nhãn của ô lọc phải TRÙNG TỪNG CHỮ với nhãn cột cùng tên: người kiểm thử
  // đối chiếu hai chỗ này bằng mắt, lệch chữ là họ báo "lọc trả sai dữ liệu".
  it("nhãn lựa chọn Nhận diện trùng với nhãn hiển thị ở cột", async () => {
    renderWithProviders(<WarrantyPage />, ["/warranty"]);
    await screen.findByText("BH-0001");

    fireEvent.mouseDown(screen.getByLabelText("Lọc loại nhận diện"));
    const options = (await screen.findAllByRole("option")).map(
      (option) => option.textContent,
    );

    expect(options).toContain("Đã xác định");
    expect(options).toContain("Tiếp nhận tạm");
    expect(options).not.toContain("Đã xác định sản phẩm");
  });

  it("lọc Bệnh/lỗi gửi defect_id của mục đã chọn và về trang 1", async () => {
    renderWithProviders(<WarrantyPage />, ["/warranty"]);
    await screen.findByText("BH-0001");

    fireEvent.mouseDown(screen.getByLabelText("Lọc bệnh/lỗi"));
    fireEvent.click(
      await screen.findByRole("option", { name: "DEF-004 · Chập điện" }),
    );

    await waitFor(() => {
      expect(fetchWarrantyCases).toHaveBeenCalledWith(
        expect.objectContaining({ defect_id: "defect-4", page: 1 }),
      );
    });
  });

  it("danh mục bệnh/lỗi xếp theo mã, không theo thứ tự API trả về", async () => {
    renderWithProviders(<WarrantyPage />, ["/warranty"]);
    await screen.findByText("BH-0001");

    fireEvent.mouseDown(screen.getByLabelText("Lọc bệnh/lỗi"));
    const codes = (await screen.findAllByRole("option"))
      .map((option) => option.textContent ?? "")
      .filter((text) => text.startsWith("DEF-"));

    expect(codes).toEqual([
      "DEF-001 · Không lên nguồn",
      "DEF-004 · Chập điện",
      "DEF-009 · Kêu to bất thường",
    ]);
  });

  // Ô rỗng của WMS là "Chưa có" (EMPTY_TEXT), tuyệt đối không phải dấu gạch —
  // người dùng không phân biệt được "rỗng" với "lỗi".
  it("ô Bệnh/lỗi và Sản phẩm rỗng hiện 'Chưa có', không phải dấu gạch", async () => {
    renderWithProviders(<WarrantyPage />, ["/warranty"]);
    await screen.findByText("BH-0002");

    const row = screen.getByText("BH-0002").closest("tr");
    expect(row).not.toBeNull();
    expect(row?.textContent).toContain("Chưa có");
    expect(row?.textContent).not.toMatch(/[-–—]\s*$/);
  });

  it("Sắp xếp theo: mặc định Mới nhất (desc), chọn Cũ nhất gửi asc + về trang 1", async () => {
    renderWithProviders(<WarrantyPage />, ["/warranty"]);
    await screen.findByText("BH-0001");

    // Lần tải đầu đã sắp Mới nhất ở BE (sort_order=desc trong SQL).
    expect(fetchWarrantyCases).toHaveBeenCalledWith(
      expect.objectContaining({ sort_order: "desc" }),
    );

    fireEvent.mouseDown(screen.getByLabelText("Sắp xếp danh sách bảo hành"));
    fireEvent.click(await screen.findByRole("option", { name: "Cũ nhất" }));

    await waitFor(() => {
      expect(fetchWarrantyCases).toHaveBeenCalledWith(
        expect.objectContaining({ sort_order: "asc", page: 1 }),
      );
    });
  });

  it("Áp dụng giữ nguyên tham số lọc API; Đặt lại chỉ xóa bộ lọc và giữ cỡ trang, thứ tự", async () => {
    renderWithProviders(<WarrantyPage />, ["/warranty"]);
    await screen.findByText("BH-0001");

    fireEvent.mouseDown(screen.getByLabelText("Lọc trạng thái bảo hành"));
    fireEvent.click(
      await screen.findByRole("option", { name: "Đang kiểm tra" }),
    );
    fireEvent.mouseDown(screen.getByLabelText("Lọc loại nhận diện"));
    fireEvent.click(
      await screen.findByRole("option", { name: "Tiếp nhận tạm" }),
    );
    fireEvent.mouseDown(screen.getByLabelText("Lọc bệnh/lỗi"));
    fireEvent.click(
      await screen.findByRole("option", { name: "DEF-004 · Chập điện" }),
    );
    fireEvent.mouseDown(screen.getByLabelText("Sắp xếp danh sách bảo hành"));
    fireEvent.click(await screen.findByRole("option", { name: "Cũ nhất" }));
    fireEvent.mouseDown(screen.getByLabelText("Số dòng mỗi trang"));
    fireEvent.click(await screen.findByRole("option", { name: "20 / trang" }));

    const search = screen.getByRole("textbox", { name: /Tìm hồ sơ bảo hành/ });
    fireEvent.change(search, { target: { value: "  BH-0001  " } });
    const apply = screen.getByRole("button", { name: "Áp dụng" });
    await waitFor(() => expect(apply).toBeEnabled());
    fireEvent.click(apply);
    await waitFor(() =>
      expect(fetchWarrantyCases).toHaveBeenLastCalledWith({
        search: "BH-0001",
        status: "CHECKING",
        identification_status: "TEMP_ONLY",
        defect_id: "defect-4",
        page: 1,
        per_page: 20,
        sort_order: "asc",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
    await waitFor(() =>
      expect(fetchWarrantyCases).toHaveBeenLastCalledWith({
        search: undefined,
        status: undefined,
        identification_status: undefined,
        defect_id: undefined,
        page: 1,
        per_page: 20,
        sort_order: "asc",
      }),
    );
    expect(search).toHaveValue("");
    expect(search).toHaveFocus();
  });

  it("Enter trên mã hồ sơ mở đúng modal chi tiết hiện có", async () => {
    const user = userEvent.setup();
    renderWithProviders(<WarrantyPage />, ["/warranty"]);
    const caseButton = await screen.findByRole("button", { name: "BH-0002" });
    act(() => caseButton.focus());
    await user.keyboard("{Enter}");
    expect(await screen.findByTestId("detail-modal")).toHaveTextContent("wc-2");
  });

  it("mở menu và chọn chi tiết bằng bàn phím không mở nhầm hồ sơ của dòng khác", async () => {
    const user = userEvent.setup();
    renderWithProviders(<WarrantyPage />, ["/warranty"]);
    const menuButton = await screen.findByRole("button", {
      name: "Thao tác hồ sơ BH-0002",
    });
    act(() => menuButton.focus());
    await user.keyboard(" ");
    const item = await screen.findByRole("menuitem", {
      name: "Xem chi tiết hồ sơ",
    });
    expect(screen.queryByTestId("detail-modal")).not.toBeInTheDocument();
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    act(() => item.focus());
    await user.keyboard("{Enter}");
    expect(await screen.findByTestId("detail-modal")).toHaveTextContent("wc-2");
    await waitFor(() =>
      expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
    );
  });

  it("hiển thị serial, hạn và tuổi hồ sơ do API cung cấp; không tự suy dữ liệu còn thiếu", async () => {
    vi.mocked(fetchWarrantyCases).mockResolvedValue({
      data: [
        {
          ...CASES[0],
          case_code: "BH-DATA",
          serial_number: "SN-FROM-API",
          item_code: "ITEM-ALIAS",
          estimated_completion_date: "2026-09-25",
          case_age_days: 47,
        },
        {
          ...CASES[1],
          case_code: "BH-MISSING",
          item_id: "item-internal-uuid",
          case_age_days: undefined,
        },
      ],
      meta: { total: 2 },
    });
    renderWithProviders(<WarrantyPage />, ["/warranty"]);
    const dataRow = (
      await screen.findByRole("button", { name: "BH-DATA" })
    ).closest("tr")!;
    expect(within(dataRow).getByText("SN: SN-FROM-API")).toBeInTheDocument();
    expect(within(dataRow).queryByText(/ITEM-ALIAS/)).not.toBeInTheDocument();
    expect(within(dataRow).getByText("10/08/2026")).toBeInTheDocument();
    expect(within(dataRow).getByText("25/09/2026")).toBeInTheDocument();
    expect(
      dataRow.querySelector('[data-label="Tuổi hồ sơ"]'),
    ).toHaveTextContent("47 ngày");

    const missingRow = screen
      .getByRole("button", { name: "BH-MISSING" })
      .closest("tr")!;
    expect(within(missingRow).queryByText(/^SN:/)).not.toBeInTheDocument();
    expect(
      within(missingRow).queryByText(/item-internal-uuid/),
    ).not.toBeInTheDocument();
    expect(
      missingRow.querySelector('[data-label="Tuổi hồ sơ"]'),
    ).toHaveTextContent("Chưa có");
    expect(missingRow.querySelector('[title="Hạn xử lý"]')).toHaveTextContent(
      "Chưa có",
    );
  });

  it("giữ thao tác sắp xếp Bệnh/lỗi và Nhận diện qua menu bàn phím, không gọi API khác", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchWarrantyCases).mockResolvedValue({
      data: [
        { ...CASES[0], defect_code: "Z", defect: "Lỗi Z" },
        { ...CASES[1], defect_code: "A", defect: "Lỗi A" },
      ],
      meta: { total: 2 },
    });
    renderWithProviders(<WarrantyPage />, ["/warranty"]);
    await screen.findByRole("button", { name: "BH-0001" });
    const sortButton = screen.getByRole("button", {
      name: "Sắp xếp khác cho danh sách bảo hành",
    });
    const rowCodes = () =>
      within(screen.getByRole("table", { name: "Danh sách hồ sơ bảo hành" }))
        .getAllByRole("button", { name: /^BH-000[12]$/ })
        .map((button) => button.textContent);
    const callsBefore = vi.mocked(fetchWarrantyCases).mock.calls.length;

    act(() => sortButton.focus());
    await user.keyboard("{Enter}");
    const defectSort = await screen.findByRole("menuitem", {
      name: "Sắp xếp theo bệnh/lỗi",
    });
    act(() => defectSort.focus());
    await user.keyboard("{Enter}");
    await waitFor(() => expect(rowCodes()).toEqual(["BH-0002", "BH-0001"]));

    act(() => sortButton.focus());
    await user.keyboard("{Enter}");
    const identificationSort = await screen.findByRole("menuitem", {
      name: "Sắp xếp theo nhận diện",
    });
    act(() => identificationSort.focus());
    await user.keyboard("{Enter}");
    await waitFor(() => expect(rowCodes()).toEqual(["BH-0001", "BH-0002"]));
    expect(fetchWarrantyCases).toHaveBeenCalledTimes(callsBefore);
    expect(screen.queryByTestId("detail-modal")).not.toBeInTheDocument();
  });

  it("đang tải giữ khung skeleton và không hiển thị nhầm trạng thái rỗng", async () => {
    vi.mocked(fetchWarrantyCases).mockImplementation(
      () =>
        new Promise<Awaited<ReturnType<typeof fetchWarrantyCases>>>(() => {}),
    );
    renderWithProviders(<WarrantyPage />, ["/warranty"]);

    expect(await screen.findByTestId("ui-state-loading-table")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    const table = screen.getByRole("table", {
      name: "Danh sách hồ sơ bảo hành",
    });
    const skeletonRows = table.querySelectorAll("tbody tr.hn-war-skeleton");
    expect(skeletonRows.length).toBeGreaterThan(0);
    skeletonRows.forEach((row) =>
      expect(row).toHaveAttribute("aria-hidden", "true"),
    );
    expect(table.closest(".hn-war-table-wrap")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(
      screen.queryByTestId("ui-state-empty-table"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("ui-state-error-table"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^BH-/ }),
    ).not.toBeInTheDocument();
  });

  it("danh sách thành công không có hồ sơ hiển thị rỗng và giữ tiêu đề bảng", async () => {
    vi.mocked(fetchWarrantyCases).mockResolvedValue({
      data: [],
      meta: { total: 0 },
    });
    renderWithProviders(<WarrantyPage />, ["/warranty"]);

    expect(
      await screen.findByTestId("ui-state-empty-table"),
    ).toBeInTheDocument();
    const table = screen.getByRole("table", {
      name: "Danh sách hồ sơ bảo hành",
    });
    expect(
      within(table).getByRole("columnheader", { name: /Hồ sơ/ }),
    ).toBeInTheDocument();
    expect(table.querySelectorAll("tbody tr")).toHaveLength(0);
    expect(
      screen.queryByTestId("ui-state-loading-table"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("ui-state-error-table"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Thử lại" }),
    ).not.toBeInTheDocument();
  });

  it("lỗi API hiển thị lỗi thật và Thử lại giữ nguyên trạng thái, nhận diện đã chọn", async () => {
    renderWithProviders(<WarrantyPage />, ["/warranty"]);
    await screen.findByRole("button", { name: "BH-0001" });
    fireEvent.mouseDown(screen.getByLabelText("Lọc trạng thái bảo hành"));
    fireEvent.click(
      await screen.findByRole("option", { name: "Đang kiểm tra" }),
    );
    await waitFor(() =>
      expect(fetchWarrantyCases).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "CHECKING" }),
      ),
    );
    await screen.findByRole("button", { name: "BH-0001" });

    vi.mocked(fetchWarrantyCases).mockRejectedValueOnce(
      new Error("Không kết nối được máy chủ bảo hành."),
    );
    fireEvent.mouseDown(screen.getByLabelText("Lọc loại nhận diện"));
    fireEvent.click(
      await screen.findByRole("option", { name: "Tiếp nhận tạm" }),
    );
    expect(
      await screen.findByText("Không tải được danh sách bảo hành"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("ui-state-error-table")).toBeInTheDocument();
    expect(
      screen.queryByTestId("ui-state-empty-table"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("ui-state-loading-table"),
    ).not.toBeInTheDocument();
    const failedParams = vi.mocked(fetchWarrantyCases).mock.calls.at(-1)?.[0];
    expect(failedParams).toEqual({
      search: undefined,
      status: "CHECKING",
      identification_status: "TEMP_ONLY",
      defect_id: undefined,
      page: 1,
      per_page: 10,
      sort_order: "desc",
    });
    const callsBeforeRetry = vi.mocked(fetchWarrantyCases).mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(
      await screen.findByRole("button", { name: "BH-0001" }),
    ).toBeInTheDocument();
    expect(fetchWarrantyCases).toHaveBeenCalledTimes(callsBeforeRetry + 1);
    expect(fetchWarrantyCases).toHaveBeenLastCalledWith(failedParams);
    expect(
      screen.queryByTestId("ui-state-error-table"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Lọc trạng thái bảo hành")).toHaveTextContent(
      "Đang kiểm tra",
    );
    expect(screen.getByLabelText("Lọc loại nhận diện")).toHaveTextContent(
      "Tiếp nhận tạm",
    );
  });

  it("bấm mã SKU trong dòng vẫn mở đúng modal chi tiết bảo hành hiện có", async () => {
    renderWithProviders(<WarrantyPage />, ["/warranty"]);
    const row = (
      await screen.findByRole("button", { name: "BH-0001" })
    ).closest("tr")!;
    fireEvent.click(within(row).getByText("KT-2000"));
    expect(await screen.findByTestId("detail-modal")).toHaveTextContent("wc-1");
  });
});
