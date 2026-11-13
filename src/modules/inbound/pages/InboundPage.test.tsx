import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { ensureChineseMessages } from "@/shared/i18n/chinese-messages";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

vi.mock("@/modules/inbound/hooks/use-inbound", () => ({
  useInboundDocuments: vi.fn(),
}));

import { useInboundDocuments } from "@/modules/inbound/hooks/use-inbound";
import InboundPage from "./InboundPage";
import type { InboundDocument } from "@/modules/inbound/types";

function makeDocument(overrides: Partial<InboundDocument>): InboundDocument {
  return {
    id: "IN-1",
    code: "PN-001",
    source: "NCC A",
    date: "2026-09-07",
    warehouseId: "WH-1",
    expected: 1,
    scanned: 1,
    productTypes: ["PRODUCT"],
    posted: 0,
    remaining: 0,
    status: "SCANNING",
    createdBy: "nvkho",
    version: 2,
    pendingProductInfo: false,
    pendingProductInfoCount: 0,
    ...overrides,
  };
}

const ROWS = [
  makeDocument({
    id: "IN-MINI",
    code: "PN-MINI-001",
    supplier: {
      id: "SUP-1",
      code: "NCC-001",
      name: "Honda Việt Nam",
      displayName: "NCC-001 - Honda Việt Nam",
      status: "ACTIVE",
      version: 1,
    },
    pendingProductInfo: true,
    pendingProductInfoCount: 2,
  }),
  makeDocument({ id: "IN-OK", code: "PN-OK-001", productTypes: ["COMPONENT"] }),
];

describe("IN-01 · phiếu chờ bổ sung thông tin SKU", () => {
  beforeEach(() => {
    vi.mocked(useInboundDocuments).mockReturnValue({
      data: { data: ROWS, meta: { current_page: 1, last_page: 1, total: 2 } },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useInboundDocuments>);
  });

  afterEach(() => {
    cleanup();
    cleanupTestState();
    useLanguageStore.getState().setLanguage("vi");
    vi.clearAllMocks();
  });

  it("gắn nhãn ngay trên danh sách để không phải mở từng phiếu mới biết", async () => {
    renderWithProviders(<InboundPage />);
    expect(
      screen.getByRole("columnheader", { name: /Nhà cung cấp/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("NCC-001 - Honda Việt Nam")).toBeInTheDocument();

    expect(
      screen.getByRole("columnheader", { name: "Loại sản phẩm" }),
    ).toBeInTheDocument();
    // Loại hàng thực nhận nằm trong cột riêng, kể cả khi tiến độ bị ẩn.
    expect(screen.getAllByTestId("inbound-product-type")).toHaveLength(2);
    expect(screen.getByText("Sản phẩm")).toBeInTheDocument();
    expect(screen.getByText("Linh kiện")).toBeInTheDocument();

    // Phiếu Mini App có SKU mới: nhãn kèm số SKU đang thiếu.
    expect(
      await screen.findByText("Chờ bổ sung thông tin (2 SKU)"),
    ).toBeInTheDocument();
    // Phiếu đủ thông tin không bị gắn nhãn oan.
    expect(screen.getAllByText("Chờ bổ sung thông tin (2 SKU)")).toHaveLength(
      1,
    );
  });

  it.each([
    ["vi", "Loại sản phẩm", "Chưa có"],
    ["en", "Product type", "None yet"],
    ["zh", "产品类型", "暂无"],
  ] as const)(
    "shows a dedicated product-type column in %s with mixed and unknown receipts",
    async (language, heading, emptyLabel) => {
      if (language === "en") await ensureEnglishMessages();
      if (language === "zh") await ensureChineseMessages();
      useLanguageStore.getState().setLanguage(language);
      vi.mocked(useInboundDocuments).mockReturnValue({
        data: {
          data: [
            makeDocument({
              id: "mixed",
              code: "PN-MIXED",
              productTypes: ["PRODUCT", "COMPONENT"],
            }),
            makeDocument({
              id: "unknown",
              code: "PN-UNKNOWN",
              productTypes: undefined,
            }),
          ],
          meta: { total: 2 },
        },
        isLoading: false,
        isFetching: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useInboundDocuments>);
      renderWithProviders(<InboundPage />);
      expect(
        screen.getByRole("columnheader", { name: heading }),
      ).toBeInTheDocument();
      const mixedRow = screen.getByText("PN-MIXED").closest("tr")!;
      expect(
        within(mixedRow).getByTestId("inbound-product-type"),
      ).toHaveTextContent(/.+ · .+/);
      const unknownRow = screen.getByText("PN-UNKNOWN").closest("tr")!;
      expect(
        within(unknownRow).getByTestId("inbound-product-type"),
      ).toHaveTextContent(emptyLabel);
    },
  );

  it("lọc ở BE chứ không lọc sau khi phân trang", async () => {
    renderWithProviders(<InboundPage />);

    fireEvent.mouseDown(
      screen.getByLabelText("Lọc phiếu theo tình trạng thông tin SKU"),
    );
    fireEvent.click(
      await screen.findByRole("option", { name: /Chờ bổ sung thông tin$/ }),
    );

    await waitFor(() => {
      expect(useInboundDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ pendingProductInfo: true, page: 1 }),
      );
    });
  });

  it("không gửi tham số lọc khi người dùng chưa chọn", () => {
    renderWithProviders(<InboundPage />);

    expect(useInboundDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ pendingProductInfo: undefined }),
    );
  });

  it("keeps existing rows interactive during a background data refresh", () => {
    vi.mocked(useInboundDocuments).mockReturnValue({
      data: { data: ROWS, meta: { current_page: 1, last_page: 1, total: 2 } },
      isLoading: false,
      isFetching: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useInboundDocuments>);
    const { container } = renderWithProviders(<InboundPage />);
    expect(screen.getByText("PN-MINI-001")).toBeVisible();
    expect(container.querySelector(".hn-inbound-loading")).toBeNull();
  });
});

describe("IN-01 · Sắp xếp theo", () => {
  beforeEach(() => {
    vi.mocked(useInboundDocuments).mockReturnValue({
      data: { data: ROWS, meta: { current_page: 1, last_page: 1, total: 2 } },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useInboundDocuments>);
  });

  afterEach(() => {
    cleanupTestState();
    vi.clearAllMocks();
  });

  it("mặc định là Mới nhất: gửi sortOrder desc ngay lần tải đầu", () => {
    renderWithProviders(<InboundPage />);

    expect(useInboundDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrder: "desc" }),
    );
  });

  it("chọn Cũ nhất: gửi sortOrder asc và quay về trang 1 (sắp ở BE)", async () => {
    renderWithProviders(<InboundPage />);

    fireEvent.mouseDown(screen.getByLabelText("Sắp xếp danh sách phiếu nhập"));
    fireEvent.click(await screen.findByRole("option", { name: "Cũ nhất" }));

    await waitFor(() => {
      expect(useInboundDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ sortOrder: "asc", page: 1 }),
      );
    });
  });
});
