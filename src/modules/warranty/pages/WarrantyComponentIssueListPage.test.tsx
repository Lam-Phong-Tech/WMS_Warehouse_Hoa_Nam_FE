import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

vi.mock("@/modules/warranty/services/componentIssueService", () => ({
  fetchComponentIssueDocuments: vi.fn(),
  fetchComponentIssueDocument: vi.fn(),
  createComponentIssue: vi.fn(),
  scanComponentIssue: vi.fn(),
  cancelComponentIssue: vi.fn(),
  postComponentIssue: vi.fn(),
}));
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
vi.mock("@/modules/master-data/services/warehouse.service", () => ({
  fetchWarehouses: vi.fn(),
  fetchWarehouse: vi.fn(),
  updateWarehouse: vi.fn(),
}));
vi.mock(
  "@/modules/master-data/services/mvp-master.service",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/modules/master-data/services/mvp-master.service")
    >()),
    getMvpSkus: vi.fn(),
  }),
);
vi.mock("@/modules/warranty/components/ComponentIssueModal", () => ({
  ComponentIssueModal: ({
    caseId,
    documentId,
    onClose,
  }: {
    caseId: string;
    documentId?: string | null;
    onClose: () => void;
  }) => (
    <div data-testid="component-issue-modal">
      {caseId}:{documentId ?? "new"}
      <button type="button" onClick={onClose}>
        Đóng phiếu thử nghiệm
      </button>
    </div>
  ),
}));
vi.mock("@/modules/warranty/components/ComponentIssueCasePicker", () => ({
  ComponentIssueCasePicker: ({
    onSelect,
    onClose,
  }: {
    onSelect: (value: { id: string; case_code: string }) => void;
    onClose: () => void;
  }) => (
    <div role="dialog" aria-label="Chọn hồ sơ bảo hành">
      <button
        type="button"
        onClick={() => onSelect({ id: "wc-new", case_code: "BH-NEW" })}
      >
        Chọn hồ sơ đang hoạt động
      </button>
      <button type="button" onClick={onClose}>
        Đóng chọn hồ sơ
      </button>
    </div>
  ),
}));

import {
  fetchComponentIssueDocument,
  fetchComponentIssueDocuments,
  type ComponentIssueDocument,
} from "@/modules/warranty/services/componentIssueService";
import { fetchWarrantyCase } from "@/modules/warranty/services/warrantyService";
import { fetchWarehouses } from "@/modules/master-data/services/warehouse.service";
import { getMvpSkus } from "@/modules/master-data/services/mvp-master.service";
import { useAuthStore } from "@/shared/store/auth.store";
import WarrantyComponentIssueListPage from "./WarrantyComponentIssueListPage";

const DOCUMENTS: ComponentIssueDocument[] = [
  {
    id: "ci-1",
    component_issue_no: "CI-0001",
    warehouse_id: "wh-1",
    warranty_case_id: "wc-1",
    document_date: "2026-08-20T08:00:00Z",
    purpose: "WARRANTY",
    status: "SCANNING",
    version: 2,
    note: "Thay mô tơ cho khách",
    lines: [],
  },
  {
    id: "ci-2",
    component_issue_no: "CI-0002",
    warehouse_id: "wh-2",
    warranty_case_id: "wc-2",
    document_date: "2026-08-21T08:00:00Z",
    purpose: "WARRANTY",
    status: "POSTED",
    version: 1,
    note: "Đã thay gioăng",
    lines: [],
  },
];

const WAREHOUSES = [
  { id: "wh-1", code: "KHO-HCM", name: "Kho Hồ Chí Minh", status: "ACTIVE" },
  { id: "wh-2", code: "KHO-HN", name: "Kho Hà Nội", status: "ACTIVE" },
];

let documents: ComponentIssueDocument[];
let listFails: boolean;

function grant(permissionCodes: string[]) {
  useAuthStore.setState({ isSuperAdmin: false, permissionCodes });
}

function renderPage() {
  return renderWithProviders(<WarrantyComponentIssueListPage />, [
    "/warranty/component-issues?screen=WAR-04",
  ]);
}

async function selectOption(label: string, name: string) {
  fireEvent.mouseDown(screen.getByLabelText(label));
  fireEvent.click(await screen.findByRole("option", { name }));
}

describe("WarrantyComponentIssueListPage (WAR-04)", () => {
  beforeEach(() => {
    documents = DOCUMENTS;
    listFails = false;
    vi.mocked(fetchComponentIssueDocuments).mockReset();
    vi.mocked(fetchComponentIssueDocuments).mockImplementation(
      async (params = {}) => {
        const { status, keyword, page = 1, per_page = 10 } = params;
        if (listFails && per_page !== 1)
          throw new Error("Không thể tải danh sách");
        const filtered = documents.filter(
          (row) =>
            (!status || row.status === status) &&
            (!keyword || row.component_issue_no.includes(keyword)),
        );
        return {
          data: filtered.slice((page - 1) * per_page, page * per_page),
          meta: {
            total: filtered.length,
            current_page: page,
            per_page,
            last_page: Math.max(1, Math.ceil(filtered.length / per_page)),
          },
        };
      },
    );
    vi.mocked(fetchComponentIssueDocument).mockReset();
    vi.mocked(fetchComponentIssueDocument).mockImplementation(async (id) => {
      const row = documents.find((item) => item.id === id);
      if (!row) throw new Error("Phiếu không tồn tại");
      const serial = row.id === "ci-1";
      return {
        ...row,
        lines: [
          {
            id: `line-${id}`,
            sku_id: serial ? "sku-motor" : "sku-gasket",
            sku_code: serial ? "LK-MOTOR" : "LK-GASKET",
            sku_name: serial ? "Mô tơ" : "Gioăng",
            required_qty: serial ? 1 : 3,
            scanned_qty: serial ? 0 : 3,
            items: [],
          },
        ],
      };
    });
    vi.mocked(getMvpSkus).mockReset();
    vi.mocked(getMvpSkus).mockImplementation(async (params = {}) => {
      const serial = params.keyword === "LK-MOTOR";
      return {
        data: [
          {
            sku_id: serial ? "sku-motor" : "sku-gasket",
            sku_code: serial ? "LK-MOTOR" : "LK-GASKET",
            sku_name: serial ? "Mô tơ" : "Gioăng",
            sku_type: "COMPONENT",
            is_serial_tracked: serial,
            status: "ACTIVE",
            version: 1,
          },
        ],
        meta: { total: 1, current_page: 1, per_page: 50, last_page: 1 },
      };
    });
    vi.mocked(fetchWarehouses).mockReset();
    vi.mocked(fetchWarehouses).mockResolvedValue(WAREHOUSES);
    vi.mocked(fetchWarrantyCase).mockReset();
    vi.mocked(fetchWarrantyCase).mockImplementation(async (caseId) => ({
      id: String(caseId),
      case_code: caseId === "wc-1" ? "BH-0001" : "BH-0002",
      customer_name: caseId === "wc-1" ? "Nguyễn Văn A" : "Trần Thị B",
      sku: "PRODUCT-01",
      sku_name: "Sản phẩm bảo hành",
      identification_type: "IDENTIFIED",
      status: "REPAIRING",
      priority: "MEDIUM",
      defect: "",
      defect_code: "",
      received_at: "2026-08-20T08:00:00Z",
      created_at: "2026-08-20T08:00:00Z",
      created_by: "staff-1",
      version: 1,
      pii_masked: false,
    }));
    grant(["warranty.component_issue", "warranty.pii.view"]);
  });

  afterEach(() => {
    cleanupTestState();
    vi.clearAllMocks();
  });

  it("hiển thị mã case, kho, linh kiện và tổng quan từ dữ liệu API thực", async () => {
    renderPage();

    expect(
      await screen.findByRole("button", { name: "CI-0001" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CI-0002" })).toBeInTheDocument();
    expect(await screen.findByText("BH-0001")).toBeInTheDocument();
    expect(screen.getByText("BH-0002")).toBeInTheDocument();
    expect(
      await screen.findByText(/KHO-HCM · Kho Hồ Chí Minh/),
    ).toBeInTheDocument();
    expect(screen.getByText(/KHO-HN · Kho Hà Nội/)).toBeInTheDocument();
    expect(
      screen.getByLabelText("Tổng 2 phiếu xuất linh kiện"),
    ).toBeInTheDocument();
    expect(await screen.findByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(
      (await screen.findAllByText("LK-MOTOR · Mô tơ")).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("1 SKU · 3 linh kiện").length).toBeGreaterThan(
      0,
    );
    expect(fetchComponentIssueDocument).toHaveBeenCalledWith("ci-1");
    expect(fetchComponentIssueDocument).toHaveBeenCalledWith("ci-2");

    fireEvent.click(
      screen.getByRole("button", { name: "Thông tin kho xuất linh kiện" }),
    );
    expect(await screen.findByText("KHO-HCM")).toBeInTheDocument();
  });

  it("bấm mã phiếu mở đúng ComponentIssueModal và đóng được", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "CI-0002" }));

    expect(
      await screen.findByTestId("component-issue-modal"),
    ).toHaveTextContent("wc-2:ci-2");
    fireEvent.click(
      screen.getByRole("button", { name: "Đóng phiếu thử nghiệm" }),
    );
    expect(
      screen.queryByTestId("component-issue-modal"),
    ).not.toBeInTheDocument();
  });

  it("menu dòng hiển thị đúng kho/ghi chú và mở phiếu tương ứng", async () => {
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Thao tác khác CI-0002" }),
    );

    expect(
      screen.queryByTestId("component-issue-modal"),
    ).not.toBeInTheDocument();
    expect(await screen.findByText("Đã thay gioăng")).toBeInTheDocument();
    expect(
      within(screen.getByRole("menu")).getByText("Kho Hà Nội"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Mở phiếu xuất linh kiện" }),
    );
    expect(
      await screen.findByTestId("component-issue-modal"),
    ).toHaveTextContent("wc-2:ci-2");
  });

  it("nút ghi nhận mở lại đúng phiếu đang quét", async () => {
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Ghi nhận CI-0001" }),
    );
    expect(
      await screen.findByTestId("component-issue-modal"),
    ).toHaveTextContent("wc-1:ci-1");
  });

  it("lọc Đã ghi sổ gọi API danh sách riêng với POSTED và trang 1", async () => {
    renderPage();
    await screen.findByRole("button", { name: "CI-0001" });
    await selectOption("Lọc trạng thái phiếu xuất linh kiện", "Đã ghi sổ");

    await waitFor(() => {
      expect(fetchComponentIssueDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ status: "POSTED", page: 1, per_page: 10 }),
      );
      expect(
        screen.queryByRole("button", { name: "CI-0001" }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "CI-0002" })).toBeInTheDocument();
  });

  it("đặt lại xóa từ khóa/trạng thái và khôi phục danh sách", async () => {
    renderPage();
    await screen.findByRole("button", { name: "CI-0001" });
    await selectOption("Lọc trạng thái phiếu xuất linh kiện", "Đã ghi sổ");
    const search = screen.getByRole("textbox", {
      name: "Tìm phiếu xuất linh kiện",
    });
    fireEvent.change(search, { target: { value: " CI-0002 " } });

    await waitFor(() => {
      expect(fetchComponentIssueDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          keyword: "CI-0002",
          status: "POSTED",
          page: 1,
          per_page: 10,
        }),
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
    expect(search).toHaveValue("");
    expect(
      screen.getByLabelText("Lọc trạng thái phiếu xuất linh kiện"),
    ).toHaveTextContent("Tất cả");
    expect(
      await screen.findByRole("button", { name: "CI-0001" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CI-0002" })).toBeInTheDocument();
  });

  it("chuyển trang và thay cỡ trang sử dụng phân trang API, rồi quay về trang 1", async () => {
    documents = Array.from({ length: 25 }, (_, index) => ({
      ...DOCUMENTS[index % 2],
      id: `ci-${index + 1}`,
      component_issue_no: `CI-${String(index + 1).padStart(4, "0")}`,
    }));
    renderPage();
    await screen.findByRole("button", { name: "CI-0001" });
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Phân trang" })).getByRole(
        "button",
        { name: /\b2\b/ },
      ),
    );

    expect(
      await screen.findByRole("button", { name: "CI-0011" }),
    ).toBeInTheDocument();
    expect(fetchComponentIssueDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, per_page: 10 }),
    );
    await selectOption("Số dòng mỗi trang", "20 / trang");
    await waitFor(() => {
      expect(fetchComponentIssueDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, per_page: 20 }),
      );
    });
    expect(
      await screen.findByRole("button", { name: "CI-0001" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CI-0020" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "CI-0021" }),
    ).not.toBeInTheDocument();
  });

  it("lọc Serial dựa trên chi tiết phiếu và cấu hình SKU, không suy từ số mã quét", async () => {
    renderPage();
    await screen.findByRole("button", { name: "CI-0001" });
    await selectOption("Lọc theo dõi linh kiện", "Serial");

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "CI-0002" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "CI-0001" }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText("1 phiếu trên trang · 1 kết quả"),
    ).toBeInTheDocument();
    expect(getMvpSkus).toHaveBeenCalledWith({
      keyword: "LK-MOTOR",
      per_page: 50,
    });
    expect(getMvpSkus).toHaveBeenCalledWith({
      keyword: "LK-GASKET",
      per_page: 50,
    });
  });

  it("tạo phiếu chọn hồ sơ trước khi mở luồng tạo COMP-01 hiện có", async () => {
    renderPage();
    fireEvent.click(
      screen.getByRole("button", { name: "Tạo phiếu xuất linh kiện" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Chọn hồ sơ bảo hành" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("component-issue-modal"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Đóng chọn hồ sơ" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Tạo phiếu xuất linh kiện" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Chọn hồ sơ đang hoạt động" }),
    );
    expect(
      await screen.findByTestId("component-issue-modal"),
    ).toHaveTextContent("wc-new:new");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("không có kết quả cho phép xóa bộ lọc để lấy lại danh sách", async () => {
    renderPage();
    await screen.findByRole("button", { name: "CI-0001" });
    fireEvent.change(
      screen.getByRole("textbox", { name: "Tìm phiếu xuất linh kiện" }),
      {
        target: { value: "NOT-FOUND" },
      },
    );
    expect(
      await screen.findByText("Không tìm thấy phiếu phù hợp với bộ lọc."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));
    expect(
      await screen.findByRole("button", { name: "CI-0001" }),
    ).toBeInTheDocument();
  });

  it("lỗi danh sách có hành động thử lại và phục hồi dữ liệu", async () => {
    listFails = true;
    renderPage();
    const alert = (
      await screen.findByText("Không tải được danh sách phiếu xuất linh kiện")
    ).closest('[role="alert"]') as HTMLElement;
    expect(alert).toHaveTextContent(
      "Không tải được danh sách phiếu xuất linh kiện",
    );
    listFails = false;
    expect(screen.getByLabelText("Chưa có tổng số phiếu")).toHaveTextContent(
      "—",
    );
    expect(
      screen.queryByLabelText("Tổng 0 phiếu xuất linh kiện"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Phân trang" }),
    ).not.toBeInTheDocument();
    fireEvent.click(within(alert).getByRole("button", { name: "Thử lại" }));
    expect(
      await screen.findByRole("button", { name: "CI-0001" }),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("không đưa tên khách hàng nguyên bản vào DOM khi thiếu quyền xem PII", async () => {
    grant(["warranty.component_issue"]);
    renderPage();
    expect(await screen.findByText("BH-0001")).toBeInTheDocument();
    expect(screen.getByText("BH-0002")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Nguyễn Văn A");
    expect(document.body).not.toHaveTextContent("Trần Thị B");
  });

  it("sao chép mã hồ sơ chưa tải được không mở phiếu xuất", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    vi.mocked(fetchWarrantyCase).mockRejectedValue(
      new Error("Không tải được hồ sơ"),
    );
    renderPage();
    await screen.findAllByText("Chưa tải được hồ sơ");
    const row = screen
      .getByRole("button", { name: "CI-0001" })
      .closest("tr") as HTMLElement;
    await user.click(
      within(row).getByRole("button", { name: "Sao chép mã đầy đủ" }),
    );

    expect(writeText).toHaveBeenCalledWith("wc-1");
    expect(
      screen.queryByTestId("component-issue-modal"),
    ).not.toBeInTheDocument();
    writeText.mockRestore();
  });

  it("đang tải chưa có tổng phiếu không hiển thị số không hoặc trang giả", async () => {
    const fetchPage = vi
      .mocked(fetchComponentIssueDocuments)
      .getMockImplementation()!;
    let releaseList: (() => void) | undefined;
    const pendingList = new Promise<void>((resolve) => {
      releaseList = resolve;
    });
    vi.mocked(fetchComponentIssueDocuments).mockImplementation(
      async (params = {}) => {
        if (params.per_page !== 1) await pendingList;
        return fetchPage(params);
      },
    );
    renderPage();

    expect(screen.getByLabelText("Chưa có tổng số phiếu")).toHaveTextContent(
      "—",
    );
    expect(
      screen.queryByLabelText("Tổng 0 phiếu xuất linh kiện"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Phân trang" }),
    ).not.toBeInTheDocument();
    releaseList?.();
    expect(
      await screen.findByRole("button", { name: "CI-0001" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Tổng 2 phiếu xuất linh kiện"),
    ).toBeInTheDocument();
  });

  it("sắp xếp cập nhật theo ngày ghi sổ và dùng ngày lập khi chưa ghi sổ", async () => {
    documents = [
      {
        ...DOCUMENTS[1],
        document_date: "2026-08-10T08:00:00Z",
        posted_at: "2026-08-25T08:00:00Z",
      },
      DOCUMENTS[0],
    ];
    renderPage();
    const table = await screen.findByRole("table", {
      name: "Danh sách phiếu xuất linh kiện",
    });
    const codes = () =>
      within(table)
        .getAllByRole("row")
        .slice(1)
        .map(
          (row) =>
            within(row).getByRole("button", { name: /^CI-\d+$/ }).textContent,
        );
    const sort = within(
      within(table).getByRole("columnheader", { name: /Cập nhật/ }),
    ).getByRole("button");

    expect(codes()).toEqual(["CI-0002", "CI-0001"]);
    fireEvent.click(sort);
    expect(codes()).toEqual(["CI-0001", "CI-0002"]);
    fireEvent.click(sort);
    expect(codes()).toEqual(["CI-0002", "CI-0001"]);
  });

  it("giữ các trang còn lại khi máy chủ trả ít dòng hơn cỡ trang yêu cầu", async () => {
    documents = Array.from({ length: 25 }, (_, index) => ({
      ...DOCUMENTS[index % 2],
      id: `ci-${index + 1}`,
      component_issue_no: `CI-${String(index + 1).padStart(4, "0")}`,
    }));
    const fetchPage = vi
      .mocked(fetchComponentIssueDocuments)
      .getMockImplementation()!;
    vi.mocked(fetchComponentIssueDocuments).mockImplementation((params = {}) =>
      fetchPage({
        ...params,
        per_page: params.per_page === 1 ? 1 : 10,
      }),
    );
    renderPage();
    await screen.findByRole("button", { name: "CI-0001" });
    await selectOption("Số dòng mỗi trang", "20 / trang");

    const thirdPage = await within(
      await screen.findByRole("navigation", { name: "Phân trang" }),
    ).findByRole("button", { name: /\b3\b/ });
    await waitFor(() => expect(thirdPage).toBeEnabled());
    fireEvent.click(thirdPage);
    expect(
      await screen.findByRole("button", { name: "CI-0021" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Hiển thị 21–25 / 25 phiếu")).toBeInTheDocument();
  });
});
