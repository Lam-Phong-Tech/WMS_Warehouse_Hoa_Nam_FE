import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Dải cảnh báo "kho đang tạm dừng" ở tầng shell (Q03, BA 07/09/2026).
 *
 * Điều quan trọng nhất KHÔNG phải là nó hiện đúng lúc, mà là nó IM LẶNG khi không
 * chắc: dải này nằm trên mọi màn của mọi người dùng, nên một lần hiện nhầm là toàn bộ
 * hệ thống trông như đang dừng.
 */
const { useWarehouseDirectory } = vi.hoisted(() => ({
  useWarehouseDirectory: vi.fn(),
}));

vi.mock("@/shared/data/reference-queries", () => ({ useWarehouseDirectory }));

import { WarehousePausedBanner } from "@/app/layouts/WarehousePausedBanner";
import { useAuthStore } from "@/shared/store/auth.store";

function setup(
  queryState: Record<string, unknown>,
  permissionCodes: string[] = ["warehouse.view"],
) {
  useWarehouseDirectory.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    ...queryState,
  });
  useAuthStore.setState({
    isProfileLoaded: true,
    isSuperAdmin: false,
    permissionCodes,
  });

  return render(<WarehousePausedBanner />);
}

function banner() {
  return screen.queryByTestId("warehouse-paused-shell-banner");
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useAuthStore.setState({
    permissionCodes: [],
    isSuperAdmin: false,
    isProfileLoaded: false,
  });
});

describe("WarehousePausedBanner", () => {
  it("hiện khi không còn kho nào đang hoạt động", () => {
    setup({ data: [{ code: "KHO-TONG-HN", status: "INACTIVE" }] });

    expect(banner()).toBeInTheDocument();
    expect(
      screen.getByText(/Mọi thao tác ghi trên toàn hệ thống đang bị khoá/i),
    ).toBeInTheDocument();
  });

  it("im lặng khi kho đang hoạt động", () => {
    setup({ data: [{ code: "KHO-TONG-HN", status: "ACTIVE" }] });

    expect(banner()).not.toBeInTheDocument();
  });

  it("im lặng khi đang tải — chưa biết thì đừng nói hệ thống đang dừng", () => {
    setup({ isLoading: true, data: undefined });

    expect(banner()).not.toBeInTheDocument();
  });

  it("im lặng khi query lỗi", () => {
    setup({ isError: true, data: undefined });

    expect(banner()).not.toBeInTheDocument();
  });

  it("im lặng khi danh mục rỗng — không suy 'rỗng' thành 'đã dừng'", () => {
    setup({ data: [] });

    expect(banner()).not.toBeInTheDocument();
  });

  it("không gọi API khi tài khoản không có warehouse.view", () => {
    setup({ data: [{ code: "KHO-TONG-HN", status: "INACTIVE" }] }, []);

    expect(banner()).not.toBeInTheDocument();
    // Vai NO_PERMISSION không được để bắn một request 403 trên mỗi lần đổi màn.
    expect(useWarehouseDirectory).toHaveBeenCalledWith({ enabled: false });
  });
});
