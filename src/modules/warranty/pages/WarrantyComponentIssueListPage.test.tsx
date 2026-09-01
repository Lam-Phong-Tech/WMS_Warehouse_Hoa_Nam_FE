import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
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
vi.mock("@/modules/warranty/components/ComponentIssueModal", () => ({
  ComponentIssueModal: ({
    caseId,
    documentId,
  }: {
    caseId: string;
    documentId?: string | null;
  }) => (
    <div data-testid="component-issue-modal">
      {caseId}:{documentId}
    </div>
  ),
}));

import { fetchComponentIssueDocuments } from "@/modules/warranty/services/componentIssueService";
import { fetchWarrantyCase } from "@/modules/warranty/services/warrantyService";
import { fetchWarehouses } from "@/modules/master-data/services/warehouse.service";
import { useAuthStore } from "@/shared/store/auth.store";
import WarrantyComponentIssueListPage from "./WarrantyComponentIssueListPage";

const DOCUMENTS = [
  {
    id: "ci-1",
    component_issue_no: "CI-0001",
    warehouse_id: "wh-1",
    warranty_case_id: "wc-1",
    document_date: "2026-08-20T08:00:00Z",
    purpose: "WARRANTY" as const,
    status: "SCANNING" as const,
    version: 2,
    lines: [],
  },
  {
    id: "ci-2",
    component_issue_no: "CI-0002",
    warehouse_id: "wh-2",
    warranty_case_id: "wc-2",
    document_date: "2026-08-21T08:00:00Z",
    purpose: "WARRANTY" as const,
    status: "POSTED" as const,
    version: 1,
    lines: [],
  },
];

const WAREHOUSES = [
  { id: "wh-1", code: "KHO-HCM", name: "Kho Hồ Chí Minh" },
  { id: "wh-2", code: "KHO-HN", name: "Kho Hà Nội" },
];

function grant(permissionCodes: string[]) {
  useAuthStore.setState({ isSuperAdmin: false, permissionCodes });
}

describe("WarrantyComponentIssueListPage (WAR-04)", () => {
  beforeEach(() => {
    vi.mocked(fetchComponentIssueDocuments).mockReset();
    vi.mocked(fetchComponentIssueDocuments).mockResolvedValue({
      data: DOCUMENTS,
      meta: { total: 2 },
    });
    vi.mocked(fetchWarehouses).mockReset();
    vi.mocked(fetchWarehouses).mockResolvedValue(WAREHOUSES);
    vi.mocked(fetchWarrantyCase).mockReset();
    vi.mocked(fetchWarrantyCase).mockImplementation(async (caseId) => {
      const known: Record<
        string,
        { case_code: string; customer_name: string }
      > = {
        "wc-1": { case_code: "BH-0001", customer_name: "Nguyễn Văn A" },
        "wc-2": { case_code: "BH-0002", customer_name: "Trần Thị B" },
      };
      const found = known[String(caseId)];
      return {
        id: String(caseId),
        case_code: found?.case_code ?? "",
        customer_name: found?.customer_name ?? "",
        pii_masked: false,
      } as never;
    });
    grant(["warranty.component_issue", "warranty.pii.view"]);
  });

  afterEach(() => {
    cleanupTestState();
  });

  it("hiển thị danh sách phiếu xuất linh kiện kèm mã case và tên kho đã tra", async () => {
    renderWithProviders(<WarrantyComponentIssueListPage />, [
      "/warranty/component-issues",
    ]);

    expect(await screen.findByText("CI-0001")).toBeInTheDocument();
    expect(screen.getByText("CI-0002")).toBeInTheDocument();

    // Mã case bảo hành được tra thêm (API danh sách chỉ trả warranty_case_id).
    expect(await screen.findByText("BH-0001")).toBeInTheDocument();
    expect(screen.getByText("BH-0002")).toBeInTheDocument();

    // Tên kho được tra thêm (API danh sách chỉ trả warehouse_id).
    expect(await screen.findByText(/KHO-HCM/)).toBeInTheDocument();
    expect(screen.getByText(/KHO-HN/)).toBeInTheDocument();

    expect(screen.getByText("Tổng 2 phiếu xuất linh kiện")).toBeInTheDocument();
  });

  it("bấm 1 dòng mở đúng ComponentIssueModal với caseId/documentId của dòng đó", async () => {
    renderWithProviders(<WarrantyComponentIssueListPage />, [
      "/warranty/component-issues",
    ]);

    const row = await screen.findByText("CI-0002");
    fireEvent.click(row);

    expect(
      await screen.findByTestId("component-issue-modal"),
    ).toHaveTextContent("wc-2:ci-2");
  });

  it("lọc trạng thái gọi lại API với status tương ứng", async () => {
    renderWithProviders(<WarrantyComponentIssueListPage />, [
      "/warranty/component-issues",
    ]);
    await screen.findByText("CI-0001");

    fireEvent.mouseDown(
      screen.getByLabelText("Lọc trạng thái phiếu xuất linh kiện"),
    );
    fireEvent.click(await screen.findByRole("option", { name: "Đã ghi nhận" }));

    await waitFor(() => {
      expect(fetchComponentIssueDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ status: "POSTED", page: 1 }),
      );
    });
  });
});
