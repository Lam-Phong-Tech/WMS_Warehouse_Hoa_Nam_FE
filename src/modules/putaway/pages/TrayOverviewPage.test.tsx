import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("TrayOverviewPage", () => {
  beforeEach(() => {
    fetchTrays.mockReset();
  });

  it("renders KPI counts, zones and tray footprints", async () => {
    fetchTrays.mockResolvedValue(TRAYS);
    renderPage();

    await screen.findByText("TRAY-A1");

    const overview = screen.getByTestId("ptw-tray-overview");
    const values = within(overview)
      .getAllByTestId("ptw-kpi-value")
      .map((node) => node.textContent);

    expect(values).toEqual(["4", "2", "1", "1"]);
    expect(screen.getAllByTestId("ptw-tray-cell")).toHaveLength(4);

    const zoneHeadings = screen
      .getAllByRole("heading", { level: 3 })
      .map((node) => node.textContent);
    expect(zoneHeadings).toEqual(["ZONE-A", "ZONE-B", "Chưa gán khu vực"]);
  });

  it("filters by status and clears the filter", async () => {
    fetchTrays.mockResolvedValue(TRAYS);
    renderPage();

    await screen.findByText("TRAY-A1");
    await userEvent.click(
      screen.getByRole("button", { name: /Cần chú ý/ }),
    );

    expect(screen.getAllByTestId("ptw-tray-cell")).toHaveLength(1);
    expect(screen.getByText("TRAY-B1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Xoá lọc" }));

    expect(screen.getAllByTestId("ptw-tray-cell")).toHaveLength(4);
  });

  it("filters by search across code, zone and location", async () => {
    fetchTrays.mockResolvedValue(TRAYS);
    renderPage();

    await screen.findByText("TRAY-A1");
    const search = screen.getByRole("textbox", {
      name: "Tìm khay theo mã hoặc khu vực",
    });

    await userEvent.type(search, "kệ 02");
    await waitFor(() => {
      expect(screen.getAllByTestId("ptw-tray-cell")).toHaveLength(1);
    });
    expect(screen.getByText("TRAY-B1")).toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, "không tồn tại");

    expect(await screen.findByText("Không có khay phù hợp")).toBeInTheDocument();
  });

  it("distinguishes an empty warehouse from a filtered no-match", async () => {
    fetchTrays.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText("Chưa có khay nào")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Xoá lọc" }),
    ).not.toBeInTheDocument();
  });

  it("does not show fake zero counts while loading", () => {
    fetchTrays.mockReturnValue(new Promise(() => {}));
    renderPage();

    const values = screen
      .getAllByTestId("ptw-kpi-value")
      .map((node) => node.textContent);

    expect(values).toEqual(["—", "—", "—", "—"]);
  });
});
