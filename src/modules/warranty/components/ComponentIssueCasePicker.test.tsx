import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import { useAuthStore } from "@/shared/store/auth.store";
import { fetchWarrantyCases } from "@/modules/warranty/services/warrantyService";
import type { WarrantyCase } from "@/modules/warranty/types";
import { ComponentIssueCasePicker } from "./ComponentIssueCasePicker";

vi.mock(
  "@/modules/warranty/services/warrantyService",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/modules/warranty/services/warrantyService")
    >()),
    fetchWarrantyCases: vi.fn(),
  }),
);

function warrantyCase(overrides: Partial<WarrantyCase> = {}): WarrantyCase {
  return {
    id: "wc-active",
    case_code: "BH-2026-001",
    sku: "SKU-001",
    sku_name: "Máy khoan",
    customer_name: "Nguyễn Văn An",
    pii_masked: false,
    identification_type: "IDENTIFIED",
    defect: "Không hoạt động",
    defect_code: "DF-001",
    status: "REPAIRING",
    priority: "MEDIUM",
    received_at: "2026-09-20",
    created_at: "2026-09-20",
    created_by: "user-1",
    version: 3,
    ...overrides,
  };
}

describe("ComponentIssueCasePicker", () => {
  beforeEach(() => {
    vi.mocked(fetchWarrantyCases).mockReset();
    useAuthStore.setState({
      isSuperAdmin: false,
      permissionCodes: ["warranty.view", "warranty.component_issue"],
    });
  });

  afterEach(cleanupTestState);

  it("selects the real active case, masks PII and blocks every terminal status", async () => {
    const active = warrantyCase();
    const terminalStatuses = [
      "RETURNED",
      "RETURNED_TO_CUSTOMER",
      "CLOSED",
      "CANCELLED",
    ] as const;
    vi.mocked(fetchWarrantyCases).mockResolvedValue({
      data: [
        active,
        ...terminalStatuses.map((status) =>
          warrantyCase({
            id: status,
            case_code: `BH-${status}`,
            status,
          }),
        ),
      ],
    });
    const onSelect = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(
      <ComponentIssueCasePicker onSelect={onSelect} onClose={onClose} />,
    );

    const activeButton = await screen.findByRole("button", {
      name: "Chọn BH-2026-001",
    });
    expect(screen.queryByText("Nguyễn Văn An")).not.toBeInTheDocument();
    for (const status of terminalStatuses) {
      const button = screen.getByRole("button", { name: `Chọn BH-${status}` });
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(activeButton);
    expect(onSelect).toHaveBeenCalledWith(active);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("uses server pagination and resets to page one when the debounced search changes", async () => {
    vi.mocked(fetchWarrantyCases).mockImplementation(async (params) => ({
      data: [warrantyCase()],
      meta: {
        current_page: params?.page ?? 1,
        per_page: 10,
        total: 25,
        last_page: 3,
      },
    }));
    renderWithProviders(
      <ComponentIssueCasePicker onSelect={vi.fn()} onClose={vi.fn()} />,
    );
    await screen.findByRole("button", { name: "Chọn BH-2026-001" });
    fireEvent.click(screen.getByRole("button", { name: /page 2/i }));
    await waitFor(() =>
      expect(fetchWarrantyCases).toHaveBeenLastCalledWith({
        search: undefined,
        page: 2,
        per_page: 10,
      }),
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "Tìm hồ sơ bảo hành" }),
      {
        target: { value: "  BH-003  " },
      },
    );
    await waitFor(() =>
      expect(fetchWarrantyCases).toHaveBeenLastCalledWith({
        search: "BH-003",
        page: 1,
        per_page: 10,
      }),
    );
  });

  it("shows loading, offers retry for errors and renders the empty result", async () => {
    let rejectRequest: (reason: Error) => void = () => {};
    vi.mocked(fetchWarrantyCases)
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, reject) => {
            rejectRequest = reject;
          }),
      )
      .mockResolvedValueOnce({ data: [], meta: { total: 0 } });
    renderWithProviders(
      <ComponentIssueCasePicker onSelect={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByTestId("ui-state-loading-table")).toBeInTheDocument();
    rejectRequest(new Error("Không thể kết nối"));
    fireEvent.click(await screen.findByRole("button", { name: "Thử lại" }));
    expect(
      await screen.findByText("Không có phiếu bảo hành theo bộ lọc hiện tại"),
    ).toBeInTheDocument();
    expect(fetchWarrantyCases).toHaveBeenCalledTimes(2);
  });

  it("honors server PII masking even with the PII permission and cannot select without issue permission", async () => {
    useAuthStore.setState({
      permissionCodes: ["warranty.view", "warranty.pii.view"],
    });
    vi.mocked(fetchWarrantyCases).mockResolvedValue({
      data: [warrantyCase({ pii_masked: true })],
    });
    const onSelect = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(
      <ComponentIssueCasePicker onSelect={onSelect} onClose={onClose} />,
    );
    const button = await screen.findByRole("button", {
      name: "Chọn BH-2026-001",
    });
    expect(button).toBeDisabled();
    expect(screen.queryByText("Nguyễn Văn An")).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: "Đóng" })[0]);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
