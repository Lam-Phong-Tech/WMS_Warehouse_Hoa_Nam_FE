/**
 * Danh mục sản phẩm (MST-03) — cột STT và ô Mô tả.
 *
 * Hai điểm cần khoá lại: bảng phải có STT như mọi danh sách khác, và mô tả dài
 * KHÔNG được xuống dòng làm hàng cao gấp đôi (cắt bằng CSS + tooltip title).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CatalogMasterScreen } from "@/modules/master-data/pages/CatalogMasterScreen";
import { useAuthStore } from "@/shared/store/auth.store";

const LONG_DESCRIPTION =
  "Nhóm hàng dành cho phụ tùng thay thế của máy nông nghiệp — mô tả cố ý dài để kiểm tra việc cắt chữ trong ô bảng";

const { getCatalogMasters, getActiveBrandOptions } = vi.hoisted(() => ({
  getCatalogMasters: vi.fn(),
  getActiveBrandOptions: vi.fn(),
}));

vi.mock("@/modules/master-data/services/catalog-master.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/modules/master-data/services/catalog-master.service")
  >("@/modules/master-data/services/catalog-master.service");
  return { ...actual, getCatalogMasters, getActiveBrandOptions };
});

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CatalogMasterScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CatalogMasterScreen · Danh mục sản phẩm", () => {
  beforeEach(() => {
    useAuthStore.setState({ isSuperAdmin: true, permissionCodes: [] });
    getActiveBrandOptions.mockResolvedValue([]);
    getCatalogMasters.mockResolvedValue({
      data: [
        {
          id: "cat-1",
          code: "NHOM-PT",
          name: "Phụ tùng",
          description: LONG_DESCRIPTION,
          status: "ACTIVE",
        },
        {
          id: "cat-2",
          code: "NHOM-MG",
          name: "Máy gặt",
          description: null,
          status: "ACTIVE",
        },
      ],
      meta: { current_page: 1, per_page: 10, total: 2 },
    });
  });

  it("có cột STT, đánh số theo đúng dòng dữ liệu", async () => {
    renderScreen();

    const header = await screen.findByText("STT");
    expect(header).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("NHOM-PT")).toBeInTheDocument());
    const firstRow = screen.getByText("NHOM-PT").closest('[role="row"]');
    const secondRow = screen.getByText("NHOM-MG").closest('[role="row"]');
    expect(
      within(firstRow as HTMLElement).getAllByRole("cell")[0],
    ).toHaveTextContent("1");
    expect(
      within(secondRow as HTMLElement).getAllByRole("cell")[0],
    ).toHaveTextContent("2");
  });

  it("mô tả dài nằm gọn một dòng, chữ đầy đủ ở tooltip", async () => {
    renderScreen();

    const description = await screen.findByTitle(LONG_DESCRIPTION);
    expect(description).toHaveClass("hn-truncate");
    expect(description).toHaveTextContent(LONG_DESCRIPTION);
  });
});
