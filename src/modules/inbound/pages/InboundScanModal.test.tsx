import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

vi.mock("@/modules/inbound/hooks/use-inbound", () => ({
  useInboundDetail: vi.fn(),
  useInboundScanEntries: vi.fn(),
  useRegisterInboundBox: vi.fn(() => ({ isPending: false, mutateAsync: vi.fn() })),
  useScanInbound: vi.fn(() => ({ isPending: false, mutateAsync: vi.fn() })),
  useUnscanInbound: vi.fn(),
  usePostInboundReceipt: vi.fn(() => ({ isPending: false, mutateAsync: vi.fn() })),
  useCancelInbound: vi.fn(() => ({ isPending: false, mutateAsync: vi.fn() })),
}));
vi.mock("@/modules/master-data/hooks/use-mvp-master", () => ({
  useMvpSkus: vi.fn(() => ({ data: { data: [SKU_ROW] }, isLoading: false })),
}));

import {
  useCancelInbound,
  useInboundDetail,
  useInboundScanEntries,
  usePostInboundReceipt,
  useScanInbound,
  useUnscanInbound,
} from "@/modules/inbound/hooks/use-inbound";
import { useAuthStore } from "@/shared/store/auth.store";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";
import { InboundScanModal } from "./MvpInboundScreens";

const SKU_ROW = {
  sku_id: "SKU-1",
  sku_code: "DCH-DRILL-DJZ10A-220V-V1",
  sku_name: "Máy khoan DJZ10A",
  sku_type: "PRODUCT",
  is_serial_tracked: true,
  status: "ACTIVE",
};

const DETAIL = {
  document: {
    id: "IN-1",
    code: "IN-20260810-003",
    source: "Nhà cung cấp TQ",
    date: "2026-08-10",
    warehouseId: "WH-1",
    expected: 2,
    scanned: 1,
    posted: 0,
    remaining: 1,
    status: "SCANNING" as const,
    createdBy: "thukho",
    version: 4,
  },
  lines: [
    {
      id: "L-1",
      documentId: "IN-1",
      productId: "SKU-1",
      sku: "DCH-DRILL-DJZ10A-220V-V1",
      skuName: "Máy khoan DJZ10A",
      scanTarget: "-",
      expected: 2,
      scanned: 1,
      posted: 0,
      remaining: 1,
      validation: "VALID" as const,
      selected: false,
    },
  ],
};

const ACTIVE_ENTRY = {
  id: "E-1",
  lineId: "L-1",
  itemId: "ITEM-1",
  itemCode: "ITEM-BC-000008",
  sku: "DCH-DRILL-DJZ10A-220V-V1",
  skuName: "Máy khoan DJZ10A",
  quantity: 1,
  scanSource: "CAMERA_OR_MANUAL_CODE",
  status: "ACTIVE" as const,
};

const REMOVED_ENTRY = {
  ...ACTIVE_ENTRY,
  id: "E-2",
  itemId: "ITEM-2",
  itemCode: "ITEM-BC-000009",
  scanSource: "MANUAL",
  status: "REMOVED" as const,
};

function grant(permissionCodes: string[]) {
  useAuthStore.setState({ isSuperAdmin: false, permissionCodes });
}

function mockHooks(
  entries: Array<typeof ACTIVE_ENTRY | typeof REMOVED_ENTRY> = [ACTIVE_ENTRY],
  unscanMutateAsync = vi.fn(),
) {
  vi.mocked(useInboundDetail).mockReturnValue({
    data: DETAIL,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as never);
  vi.mocked(useInboundScanEntries).mockReturnValue({
    data: entries,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as never);
  vi.mocked(useUnscanInbound).mockReturnValue({
    isPending: false,
    mutateAsync: unscanMutateAsync,
  } as never);
  vi.mocked(useScanInbound).mockReturnValue({
    isPending: false,
    mutateAsync: vi.fn(),
  } as never);
  vi.mocked(usePostInboundReceipt).mockReturnValue({
    isPending: false,
    mutateAsync: vi.fn(),
  } as never);
  vi.mocked(useCancelInbound).mockReturnValue({
    isPending: false,
    mutateAsync: vi.fn(),
  } as never);
  return unscanMutateAsync;
}

/**
 * Annex D SCR-IN-01 + ERD bảng 28. Trước đây IN-03 chỉ có `scanLog` trong state
 * phiên nên bằng chứng quét mất sau reload, và không có đường gỡ mã quét sai.
 */
describe("IN-03 · bảng mã đã quét và gỡ mã trước Post", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    grant([P.INBOUND_VIEW, P.INBOUND_SCAN, P.INBOUND_CREATE, P.INBOUND_POST]);
  });

  afterEach(() => {
    cleanupTestState();
  });

  it("hiển thị bảng mã đã quét đọc từ server, kèm SKU và nguồn quét", async () => {
    mockHooks([ACTIVE_ENTRY, REMOVED_ENTRY]);

    renderWithProviders(
      <InboundScanModal documentId="IN-1" onClose={vi.fn()} />,
    );

    expect(await screen.findByText("Mã đã quét của phiếu")).toBeInTheDocument();
    expect(screen.getByText("ITEM-BC-000008")).toBeInTheDocument();
    expect(screen.getByText("ITEM-BC-000009")).toBeInTheDocument();
    expect(screen.getByText("CAMERA/MÃ")).toBeInTheDocument();
    expect(screen.getByText("NHẬP TAY")).toBeInTheDocument();
    // Đọc từ inbound_scan_entries nên phân biệt được dòng còn hiệu lực / đã gỡ.
    expect(screen.getByText("Hợp lệ")).toBeInTheDocument();
    expect(screen.getByText("Đã gỡ")).toBeInTheDocument();
  });

  it("đếm số mã đã gỡ ở mức phiếu chứ không theo phiên thao tác", async () => {
    mockHooks([ACTIVE_ENTRY, REMOVED_ENTRY]);

    renderWithProviders(
      <InboundScanModal documentId="IN-1" onClose={vi.fn()} />,
    );

    const removedCounterLabel = await screen.findByText("Mã đã gỡ");
    // Thẻ số "Mã đã gỡ" lấy từ inbound_scan_entries của phiếu.
    expect(removedCounterLabel.parentElement?.textContent).toContain("1");
    // Chuỗi tóm tắt được React render thành nhiều text node nên so trên document.
    expect(document.body.textContent).toContain("1 hợp lệ · 1 đã gỡ");
  });

  it("gỡ mã đã quét gửi đúng entry id và version hiện tại", async () => {
    const unscan = mockHooks(
      [ACTIVE_ENTRY],
      vi.fn().mockResolvedValue({
        documentId: "IN-1",
        lineId: "L-1",
        entryId: "E-1",
        status: "REMOVED",
        requiredQuantity: 2,
        scannedQuantity: 0,
        version: 5,
      }),
    );

    renderWithProviders(
      <InboundScanModal documentId="IN-1" onClose={vi.fn()} />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Gỡ mã/ }));

    await waitFor(() => {
      expect(unscan).toHaveBeenCalledWith({
        id: "IN-1",
        entryId: "E-1",
        ifMatch: 4,
      });
    });
  });

  it("ẩn nút gỡ mã khi người dùng không có inbound.scan", async () => {
    grant([P.INBOUND_VIEW]);
    mockHooks([ACTIVE_ENTRY]);

    renderWithProviders(
      <InboundScanModal documentId="IN-1" onClose={vi.fn()} />,
    );

    expect(await screen.findByText("ITEM-BC-000008")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gỡ mã/ })).toBeNull();
  });

  it("không cho gỡ mã khi phiếu đã POSTED", async () => {
    vi.mocked(useInboundDetail).mockReturnValue({
      data: {
        ...DETAIL,
        document: { ...DETAIL.document, status: "POSTED" as const },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useInboundScanEntries).mockReturnValue({
      data: [ACTIVE_ENTRY],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useUnscanInbound).mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    } as never);
    vi.mocked(useScanInbound).mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    } as never);
    vi.mocked(usePostInboundReceipt).mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    } as never);
    vi.mocked(useCancelInbound).mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    } as never);

    renderWithProviders(
      <InboundScanModal documentId="IN-1" onClose={vi.fn()} />,
    );

    expect(await screen.findByText("ITEM-BC-000008")).toBeInTheDocument();
    // BR-REV-01: sau Post phải đi Reversal, không được gỡ mã.
    expect(screen.queryByRole("button", { name: /Gỡ mã/ })).toBeNull();
  });
});
