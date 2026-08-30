import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

vi.mock("@/modules/inbound/hooks/use-inbound", () => ({
  useInboundDetail: vi.fn(),
  useInboundScanEntries: vi.fn(),
  useRegisterInboundBox: vi.fn(() => ({
    isPending: false,
    mutateAsync: vi.fn(),
  })),
  // GĐ1 scan-driven: picker "Thêm dòng linh kiện" gọi ensure-component-line.
  useEnsureComponentLine: vi.fn(() => ({
    isPending: false,
    mutateAsync: vi.fn(),
  })),
  useScanInbound: vi.fn(() => ({ isPending: false, mutateAsync: vi.fn() })),
  useUnscanInbound: vi.fn(),
  usePostInboundReceipt: vi.fn(() => ({
    isPending: false,
    mutateAsync: vi.fn(),
  })),
  useCancelInbound: vi.fn(() => ({ isPending: false, mutateAsync: vi.fn() })),
  // Inbound Carton Scan v1.0 §3.3: mốc "Đã quét xong thùng" (audit-only).
  useCompleteInboundCartonScan: vi.fn(() => ({
    isPending: false,
    mutateAsync: vi.fn(),
  })),
}));
vi.mock("@/modules/master-data/hooks/use-mvp-master", () => ({
  useMvpSkus: vi.fn(() => ({ data: { data: [SKU_ROW] }, isLoading: false })),
}));
// §4.3: mã quét không composite được classify read-only để nhận diện CARTON.
vi.mock("@/modules/scan/services/scanService", () => ({
  classifyScanCodes: vi.fn(),
}));

import {
  useCancelInbound,
  useCompleteInboundCartonScan,
  useInboundDetail,
  useInboundScanEntries,
  usePostInboundReceipt,
  useScanInbound,
  useUnscanInbound,
} from "@/modules/inbound/hooks/use-inbound";
import { classifyScanCodes } from "@/modules/scan/services/scanService";
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
  completeCartonMutateAsync = vi.fn(),
) {
  vi.mocked(useCompleteInboundCartonScan).mockReturnValue({
    isPending: false,
    mutateAsync: completeCartonMutateAsync,
  } as never);
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
    expect(screen.getByText("Camera / mã")).toBeInTheDocument();
    expect(screen.getByText("Nhập tay")).toBeInTheDocument();
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

    // Gỡ mã là thao tác phá huỷ — phải qua hộp thoại xác nhận trước khi gọi
    // server; nút xác nhận trong dialog cũng mang nhãn "Gỡ mã".
    expect(await screen.findByText("Gỡ mã đã quét?")).toBeInTheDocument();
    const unscanButtons = screen.getAllByRole("button", { name: /Gỡ mã/ });
    fireEvent.click(unscanButtons[unscanButtons.length - 1]);

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

/**
 * Inbound Carton Scan v1.0 (Implementation Delta 20/08/2026) — carton scan
 * context: scan CARTON đặt "Thùng đang quét", Item quét khi thùng active mang
 * container_id, nút "Đã quét xong thùng" chỉ audit + đóng context (CTN-01/02),
 * chuyển thùng khi đang dở bị chặn (CTN-T07).
 */
describe("IN-03 · carton scan context (Đã quét xong thùng)", () => {
  const CARTON_UUID = "11111111-1111-4111-8111-111111111111";
  const CARTON_CLASSIFY = {
    classification: "CONTAINER",
    container_id: CARTON_UUID,
    container_code: "CTN-001",
    container_type: "CARTON",
    sku_id: "SKU-1",
    stock_effect: "NONE",
  };
  const CARTON_ENTRY = {
    ...ACTIVE_ENTRY,
    id: "E-CTN-1",
    itemId: "ITEM-CTN-1",
    itemCode: "ITEM-BC-000010",
    containerId: CARTON_UUID,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    grant([P.INBOUND_VIEW, P.INBOUND_SCAN, P.INBOUND_CREATE, P.INBOUND_POST]);
  });

  afterEach(() => {
    cleanupTestState();
  });

  async function scanCode(code: string) {
    const input = await screen.findByLabelText("Scan code");
    fireEvent.change(input, { target: { value: code } });
    fireEvent.keyDown(input, { key: "Enter" });
  }

  it("quét mã CARTON đặt thùng đang quét, không gọi endpoint scan", async () => {
    const scanMutate = vi.fn();
    mockHooks([]);
    vi.mocked(useScanInbound).mockReturnValue({
      isPending: false,
      mutateAsync: scanMutate,
    } as never);
    vi.mocked(classifyScanCodes).mockResolvedValue(CARTON_CLASSIFY as never);

    renderWithProviders(
      <InboundScanModal documentId="IN-1" onClose={vi.fn()} />,
    );
    await scanCode("CTN-001");

    expect(
      await screen.findByText("Thùng đang quét: CTN-001"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Đã quét xong thùng/ }),
    ).toBeInTheDocument();
    // Kích hoạt thùng là stock-neutral thuần UI — không có scan API call.
    expect(scanMutate).not.toHaveBeenCalled();
    expect(classifyScanCodes).toHaveBeenCalledWith({
      raw_code: "CTN-001",
      context: "INBOUND",
      warehouse_id: "WH-1",
    });
  });

  it("Item quét khi thùng active mang container_id của thùng (CTN-05)", async () => {
    const scanMutate = vi
      .fn()
      .mockResolvedValue([
        { code_value: "SN-0002", status: "VALID", version: 5 },
      ]);
    mockHooks([]);
    vi.mocked(useScanInbound).mockReturnValue({
      isPending: false,
      mutateAsync: scanMutate,
    } as never);
    vi.mocked(classifyScanCodes)
      .mockResolvedValueOnce(CARTON_CLASSIFY as never)
      .mockResolvedValueOnce({ classification: "ITEM" } as never);

    renderWithProviders(
      <InboundScanModal documentId="IN-1" onClose={vi.fn()} />,
    );
    await scanCode("CTN-001");
    await screen.findByText("Thùng đang quét: CTN-001");
    await scanCode("SN-0002");

    await waitFor(() => {
      expect(scanMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "IN-1",
          code: "SN-0002",
          containerId: CARTON_UUID,
        }),
      );
    });
  });

  it("bấm Đã quét xong thùng gọi audit endpoint rồi đóng context", async () => {
    const completeMutate = vi.fn().mockResolvedValue({
      documentId: "IN-1",
      containerId: CARTON_UUID,
      cartonCode: "CTN-001",
      actualItemQty: 1,
    });
    mockHooks([CARTON_ENTRY], vi.fn(), completeMutate);
    vi.mocked(classifyScanCodes).mockResolvedValue(CARTON_CLASSIFY as never);

    renderWithProviders(
      <InboundScanModal documentId="IN-1" onClose={vi.fn()} />,
    );
    await scanCode("CTN-001");
    // Count đọc từ inbound_scan_entries theo containerId (sống qua reload).
    expect(
      await screen.findByText("Thùng đang quét: CTN-001"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Đã quét xong thùng/ }));

    await waitFor(() => {
      expect(completeMutate).toHaveBeenCalledWith({
        id: "IN-1",
        containerId: CARTON_UUID,
      });
    });
    // CTN-01: đóng active carton context sau khi xác nhận.
    await waitFor(() => {
      expect(screen.queryByText("Thùng đang quét: CTN-001")).toBeNull();
    });
  });

  it("chặn chuyển thùng khi thùng hiện tại chưa bấm xong (CTN-T07)", async () => {
    mockHooks([]);
    vi.mocked(classifyScanCodes)
      .mockResolvedValueOnce(CARTON_CLASSIFY as never)
      .mockResolvedValueOnce({
        ...CARTON_CLASSIFY,
        container_id: "22222222-2222-4222-8222-222222222222",
        container_code: "CTN-002",
      } as never);

    renderWithProviders(
      <InboundScanModal documentId="IN-1" onClose={vi.fn()} />,
    );
    await scanCode("CTN-001");
    await screen.findByText("Thùng đang quét: CTN-001");
    await scanCode("CTN-002");

    // Vẫn là CTN-001; diễn biến scan ghi rõ yêu cầu bấm xong thùng trước.
    expect(
      await screen.findByText(
        /Hãy bấm "Đã quét xong thùng" trước khi chuyển sang CTN-002/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Thùng đang quét: CTN-001")).toBeInTheDocument();
    expect(screen.queryByText("Thùng đang quét: CTN-002")).toBeNull();
  });
});

/**
 * Luồng scan-driven cho LINH KIỆN theo mã HỘP (BOX-<SKU>-<seq>): quét một mã
 * hộp mở ô nhập số lượng đếm tay + nút Xác nhận; xác nhận mới gửi lên server
 * (code_value = mã hộp, không kèm line_id/container_id — server tự lo). Không
 * cần chọn SKU / thêm dòng / đăng ký hộp thủ công trước.
 */
describe("IN-03 · quét mã hộp linh kiện (scan-driven)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    grant([P.INBOUND_VIEW, P.INBOUND_SCAN, P.INBOUND_CREATE, P.INBOUND_POST]);
  });

  afterEach(() => {
    cleanupTestState();
  });

  async function scanCode(code: string) {
    const input = await screen.findByLabelText("Scan code");
    fireEvent.change(input, { target: { value: code } });
    fireEvent.keyDown(input, { key: "Enter" });
  }

  it("quét mã hộp mở ô nhập số lượng, chưa gọi endpoint scan", async () => {
    const scanMutate = vi.fn();
    mockHooks([]);
    vi.mocked(useScanInbound).mockReturnValue({
      isPending: false,
      mutateAsync: scanMutate,
    } as never);

    renderWithProviders(
      <InboundScanModal documentId="IN-1" onClose={vi.fn()} />,
    );
    await scanCode("BOX-HN-COMP-BASE-003-0001");

    // Nhận diện là hộp linh kiện, hiện panel số lượng — chưa ghi nhận.
    expect(
      await screen.findByText("Hộp linh kiện: HN-COMP-BASE-003"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Xác nhận/ }),
    ).toBeInTheDocument();
    // Không gọi classify (đã nhận diện tại client) và chưa gọi scan.
    expect(classifyScanCodes).not.toHaveBeenCalled();
    expect(scanMutate).not.toHaveBeenCalled();
  });

  it("xác nhận số lượng gửi mã hộp lên scan (không kèm line/container)", async () => {
    const scanMutate = vi
      .fn()
      .mockResolvedValue([
        { code_value: "BOX-HN-COMP-BASE-003-0001", status: "VALID", version: 5 },
      ]);
    mockHooks([]);
    vi.mocked(useScanInbound).mockReturnValue({
      isPending: false,
      mutateAsync: scanMutate,
    } as never);

    renderWithProviders(
      <InboundScanModal documentId="IN-1" onClose={vi.fn()} />,
    );
    await scanCode("BOX-HN-COMP-BASE-003-0001");
    await screen.findByText("Hộp linh kiện: HN-COMP-BASE-003");

    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Xác nhận/ }));

    await waitFor(() => {
      expect(scanMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "IN-1",
          code: "BOX-HN-COMP-BASE-003-0001",
          quantity: 5,
          includeCodeValue: true,
          ifMatch: 4,
        }),
      );
    });
    // Mã hộp tự mang SKU: server tự tạo dòng + đăng ký hộp, FE không gửi kèm.
    const arg = scanMutate.mock.calls[0][0];
    expect(arg.lineId).toBeUndefined();
    expect(arg.containerId).toBeUndefined();
  });
});

/**
 * SKU mới (mã item) lần đầu: backend trả NEW_SKU_TYPE_REQUIRED → FE hiện hộp
 * thoại chọn Sản phẩm / Linh kiện → gửi lại lần quét kèm new_sku_type.
 */
describe("IN-03 · hỏi loại SKU mới khi quét lần đầu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    grant([P.INBOUND_VIEW, P.INBOUND_SCAN, P.INBOUND_CREATE, P.INBOUND_POST]);
  });

  afterEach(() => {
    cleanupTestState();
  });

  async function scanCode(code: string) {
    const input = await screen.findByLabelText("Scan code");
    fireEvent.change(input, { target: { value: code } });
    fireEvent.keyDown(input, { key: "Enter" });
  }

  function newSkuTypeRequiredError() {
    return {
      isAxiosError: true,
      response: {
        status: 422,
        data: {
          error: {
            code: "NEW_SKU_TYPE_REQUIRED",
            message: "SKU chưa có trong hệ thống — hãy chọn loại.",
          },
        },
      },
    };
  }

  it("hỏi loại rồi gửi lại kèm new_sku_type khi chọn Linh kiện", async () => {
    const scanMutate = vi
      .fn()
      .mockRejectedValueOnce(newSkuTypeRequiredError())
      .mockResolvedValueOnce([
        {
          code_value: "HN1|SKU=NEW-SKU-9|ITEM=SN-1",
          status: "VALID",
          version: 5,
        },
      ]);
    mockHooks([]);
    vi.mocked(useScanInbound).mockReturnValue({
      isPending: false,
      mutateAsync: scanMutate,
    } as never);

    renderWithProviders(
      <InboundScanModal documentId="IN-1" onClose={vi.fn()} />,
    );
    await scanCode("HN1|SKU=NEW-SKU-9|ITEM=SN-1");

    // Composite QR → không classify; hiện hộp thoại hỏi loại kèm mã SKU.
    expect(
      await screen.findByText(/chưa có trong hệ thống/),
    ).toBeInTheDocument();
    expect(screen.getByText(/NEW-SKU-9/)).toBeInTheDocument();
    expect(classifyScanCodes).not.toHaveBeenCalled();
    expect(scanMutate).toHaveBeenCalledTimes(1);
    expect(scanMutate.mock.calls[0][0].newSkuType).toBeUndefined();

    fireEvent.click(screen.getByRole("button", { name: /Linh kiện/ }));

    await waitFor(() => {
      expect(scanMutate).toHaveBeenCalledTimes(2);
    });
    expect(scanMutate.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        id: "IN-1",
        code: "HN1|SKU=NEW-SKU-9|ITEM=SN-1",
        newSkuType: "COMPONENT",
      }),
    );
  });

  it("gửi new_sku_type=PRODUCT khi chọn Sản phẩm", async () => {
    const scanMutate = vi
      .fn()
      .mockRejectedValueOnce(newSkuTypeRequiredError())
      .mockResolvedValueOnce([
        {
          code_value: "HN1|SKU=NEW-SKU-9|ITEM=SN-1",
          status: "VALID",
          version: 5,
        },
      ]);
    mockHooks([]);
    vi.mocked(useScanInbound).mockReturnValue({
      isPending: false,
      mutateAsync: scanMutate,
    } as never);

    renderWithProviders(
      <InboundScanModal documentId="IN-1" onClose={vi.fn()} />,
    );
    await scanCode("HN1|SKU=NEW-SKU-9|ITEM=SN-1");
    await screen.findByText(/chưa có trong hệ thống/);

    fireEvent.click(screen.getByRole("button", { name: /Sản phẩm/ }));

    await waitFor(() => {
      expect(scanMutate).toHaveBeenCalledTimes(2);
    });
    expect(scanMutate.mock.calls[1][0].newSkuType).toBe("PRODUCT");
  });
});
