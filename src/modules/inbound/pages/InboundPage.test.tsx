import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
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
    pendingProductInfo: true,
    pendingProductInfoCount: 2,
  }),
  makeDocument({ id: "IN-OK", code: "PN-OK-001" }),
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
    cleanupTestState();
    vi.clearAllMocks();
  });

  it("gắn nhãn ngay trên danh sách để không phải mở từng phiếu mới biết", async () => {
    renderWithProviders(<InboundPage />);

    // Phiếu Mini App có SKU mới: nhãn kèm số SKU đang thiếu.
    expect(
      await screen.findByText("Chờ bổ sung thông tin (2 SKU)"),
    ).toBeInTheDocument();
    // Phiếu đủ thông tin không bị gắn nhãn oan.
    expect(screen.getAllByText("Chờ bổ sung thông tin (2 SKU)")).toHaveLength(
      1,
    );
  });

  it("lọc ở BE chứ không lọc sau khi phân trang", async () => {
    renderWithProviders(<InboundPage />);

    fireEvent.mouseDown(
      screen.getByLabelText("Lọc phiếu theo tình trạng thông tin SKU"),
    );
    fireEvent.click(await screen.findByText("Chờ bổ sung thông tin"));

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
