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
vi.mock("@/modules/master-data/hooks/use-mvp-master", () => ({
  useMvpDefects: vi.fn(() => ({
    data: {
      data: [
        {
          defect_id: "defect-1",
          defect_code: "PWR",
          defect_name: "Không lên nguồn",
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
    sku_name: "-",
    temporary_item_code: "TEMP-0002",
    identification_type: "TEMP_ONLY" as const,
    customer_name: "Trần Thị B",
    defect: "-",
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

  it("bấm Mở mở modal chi tiết đúng case (WAR-03)", async () => {
    renderWithProviders(<WarrantyPage />, ["/warranty"]);

    const openButtons = await screen.findAllByRole("button", { name: /Mở/ });
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
});
