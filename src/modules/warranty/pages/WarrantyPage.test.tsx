import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
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

  it("bấm Mở mở modal chi tiết đúng case (WAR-03)", async () => {
    renderWithProviders(<WarrantyPage />, ["/warranty"]);

    // a908c42 chuẩn hoá hành động dòng thành ActionButton kind="edit" nhãn "Sửa"
    // (trước là "Mở") — test cập nhật theo UI đã duyệt.
    const openButtons = await screen.findAllByRole("button", { name: /Sửa/ });
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
});
