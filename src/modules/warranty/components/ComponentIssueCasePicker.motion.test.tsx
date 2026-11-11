import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import { useAuthStore } from "@/shared/store/auth.store";
import { fetchWarrantyCases } from "@/modules/warranty/services/warrantyService";
import type { WarrantyCase } from "@/modules/warranty/types";
import { ComponentIssueCasePicker } from "./ComponentIssueCasePicker";

// Production runs with MOTION_ENABLED=true; the regular suite forces it off so
// assertions are synchronous. Keep this file separate to exercise the exit
// transition path used by the detail arrow.
vi.mock("@/shared/components/motion/motion-tokens", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/shared/components/motion/motion-tokens")
  >()),
  MOTION_ENABLED: true,
}));

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

describe("ComponentIssueCasePicker with motion enabled", () => {
  beforeEach(() => {
    vi.mocked(fetchWarrantyCases).mockReset();
    useAuthStore.setState({
      isSuperAdmin: false,
      permissionCodes: ["warranty.view", "warranty.component_issue"],
    });
  });

  afterEach(cleanupTestState);

  it("selects the case after the drawer exit transition finishes", async () => {
    const active = warrantyCase();
    vi.mocked(fetchWarrantyCases).mockResolvedValue({ data: [active] });
    const onSelect = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(
      <ComponentIssueCasePicker onSelect={onSelect} onClose={onClose} />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Chọn BH-2026-001" }),
    );

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(active), {
      timeout: 3000,
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
