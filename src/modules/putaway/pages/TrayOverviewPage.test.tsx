import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders } from "@/test/test-utils";
import type { TrayOption } from "@/modules/putaway/services/putawayService";

const { fetchTrays } = vi.hoisted(() => ({ fetchTrays: vi.fn() }));

vi.mock("@/modules/putaway/services/putawayService", () => ({
  fetchAllPutawayTrays: fetchTrays,
}));

import TrayOverviewPage from "./TrayOverviewPage";

const TRAYS: TrayOption[] = [
  {
    container_id: "a1",
    container_code: "TRAY-A1",
    status: "EMPTY",
    zone_code: "ZONE-A",
    location_hint: "Kệ 01",
    version: 1,
  },
  {
    container_id: "a2",
    container_code: "TRAY-A2",
    status: "PARTIAL",
    zone_code: "ZONE-A",
    location_hint: "Khay A-02",
    version: 1,
  },
  {
    container_id: "b1",
    container_code: "TRAY-B1",
    status: "CLOSED",
    zone_code: "ZONE-B",
    location_hint: "Kệ 02",
    version: 1,
  },
  {
    container_id: "x1",
    container_code: "TRAY-X",
    status: "EMPTY",
    zone_code: null,
    location_hint: "Khu mẫu",
    version: 1,
  },
];

function renderPage() {
  return renderWithProviders(<TrayOverviewPage />);
}

function renderPageWithClient(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TrayOverviewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TrayOverviewPage", () => {
  beforeEach(() => {
    fetchTrays.mockReset();
  });

  it("renders the map panel, status chips with counts, the result count and the unassigned strip", async () => {
    fetchTrays.mockResolvedValue(TRAYS);
    renderPage();

    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Sơ đồ khu vực khay",
      }),
    ).toBeInTheDocument();
    // Chờ query resolve — panel render ngay cả khi đang loading.
    await screen.findByText(/Hiển thị 4\/4 khay/);

    const overview = screen.getByTestId("ptw-tray-overview");
    expect(
      within(overview).getByRole("button", { name: /^Tất cả 4$/ }),
    ).toBeInTheDocument();
    expect(
      within(overview).getByRole("button", { name: /^Cần chú ý 1$/ }),
    ).toBeInTheDocument();
    expect(
      within(overview).getByRole("button", { name: /^Đang chứa 1$/ }),
    ).toBeInTheDocument();
    expect(
      within(overview).getByRole("button", { name: /^Trống 2$/ }),
    ).toBeInTheDocument();
    expect(
      within(overview).getByText(/Hiển thị 4\/4 khay/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Cuộn dọc để xem các khu vực/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");

    // Khay chưa gán nằm ở dải riêng, không nằm trong map.
    const unassigned = screen.getByRole("button", { name: /TRAY-X/ });
    expect(unassigned).toBeInTheDocument();
  });

  it("toggles the status chip pressed state and updates the shown count", async () => {
    fetchTrays.mockResolvedValue(TRAYS);
    renderPage();

    await screen.findByRole("heading", {
      level: 2,
      name: "Sơ đồ khu vực khay",
    });
    await screen.findByText(/Hiển thị 4\/4 khay/);
    const chip = screen.getByRole("button", { name: /^Cần chú ý 1$/ });
    expect(chip).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Hiển thị 1\/4 khay/)).toBeInTheDocument();

    await userEvent.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "false");
  });

  it("filters by search text and shows the no-match state", async () => {
    fetchTrays.mockResolvedValue(TRAYS);
    renderPage();

    await screen.findByRole("heading", {
      level: 2,
      name: "Sơ đồ khu vực khay",
    });
    await screen.findByText(/Hiển thị 4\/4 khay/);
    const search = screen.getByRole("textbox", {
      name: "Tìm khay theo mã hoặc khu vực",
    });

    await userEvent.type(search, "kệ 02");
    await waitFor(() => {
      expect(screen.getByText(/Hiển thị 1\/4 khay/)).toBeInTheDocument();
    });

    await userEvent.clear(search);
    await userEvent.type(search, "không tồn tại");
    expect(
      await screen.findByText("Không có khay phù hợp"),
    ).toBeInTheDocument();
  });

  it("distinguishes an empty warehouse from a filtered no-match", async () => {
    fetchTrays.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("Chưa có khay nào")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Xoá lọc" }),
    ).not.toBeInTheDocument();
  });

  it("does not show fake counts while the first load is pending", async () => {
    fetchTrays.mockReturnValue(new Promise(() => {}));
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /^Cần chú ý/ }));

    expect(screen.queryByText(/Hiển thị/)).not.toBeInTheDocument();
  });

  it("shows the load error and retries", async () => {
    fetchTrays
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(TRAYS);

    renderPage();

    expect(
      await screen.findByText("Không tải được danh sách khay"),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));

    expect(await screen.findByText("TRAY-X")).toBeInTheDocument();
  });

  it("keeps cached rows when a background refetch fails", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    fetchTrays.mockResolvedValueOnce(TRAYS);

    renderPageWithClient(queryClient);
    await screen.findByText("TRAY-X");

    fetchTrays.mockRejectedValueOnce(new Error("network"));
    await act(async () => {
      await queryClient.refetchQueries({
        queryKey: ["putaway", "trays", "overview"],
      });
    });

    expect(
      await screen.findByText("Không tải được danh sách khay"),
    ).toBeInTheDocument();
    expect(screen.getByText("TRAY-X")).toBeInTheDocument();
  });

  it("does not show fake zero counts while loading", () => {
    fetchTrays.mockReturnValue(new Promise(() => {}));
    renderPage();

    const values = screen
      .getAllByTestId("ptw-legend-count")
      .map((node) => node.textContent);

    expect(values).toEqual(["—", "—", "—", "—"]);
  });

  it("dims non-matching trays in the scene instead of removing them", async () => {
    fetchTrays.mockResolvedValue(TRAYS);
    renderPage();

    await screen.findByText(/Hiển thị 4\/4 khay/);
    await userEvent.click(
      screen.getByRole("button", { name: /^Cần chú ý 1$/ }),
    );

    const cells = screen.getAllByTestId("ptw-tray-cell");
    expect(cells).toHaveLength(3);
    expect(
      cells.filter((cell) => cell.classList.contains("is-dimmed")),
    ).toHaveLength(2);
    expect(
      cells.filter((cell) => !cell.classList.contains("is-dimmed")),
    ).toHaveLength(1);
  });

  it("opens the tray dialog from a scene tray and copies the code", async () => {
    fetchTrays.mockResolvedValue(TRAYS);
    renderPage();

    await screen.findByText(/Hiển thị 4\/4 khay/);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const cell = screen
      .getAllByTestId("ptw-tray-cell")
      .find((node) => node.textContent?.includes("TRAY-A1"));
    expect(cell).toBeDefined();
    await userEvent.click(cell as Element);

    const dialog = await screen.findByRole("dialog", {
      name: "Thông tin khay",
    });
    expect(
      within(dialog).getByRole("heading", { name: "TRAY-A1" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Trống")).toBeInTheDocument();

    await userEvent.click(
      within(dialog).getByRole("button", { name: /Sao chép mã/ }),
    );
    expect(writeText).toHaveBeenCalledWith("TRAY-A1");
  });

  it("opens the tray dialog from the unassigned strip and hides the locate action", async () => {
    fetchTrays.mockResolvedValue(TRAYS);
    renderPage();

    await screen.findByText(/Hiển thị 4\/4 khay/);
    await userEvent.click(screen.getByRole("button", { name: /TRAY-X/ }));

    const dialog = await screen.findByRole("dialog", {
      name: "Thông tin khay",
    });
    expect(
      within(dialog).getByRole("heading", { name: "TRAY-X" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: /Tìm trên sơ đồ/ }),
    ).toBeNull();
  });

  it("zooms the scene in and out with the zoom controls", async () => {
    fetchTrays.mockResolvedValue(TRAYS);
    renderPage();

    await screen.findByText(/Hiển thị 4\/4 khay/);
    expect(screen.getByText("100%")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Phóng to" }));
    expect(screen.getByText("120%")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Thu nhỏ" }));
    expect(screen.getByText("100%")).toBeInTheDocument();
  });
});
