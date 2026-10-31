import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { cleanupTestState } from "@/test/setup";
import { renderWithProviders } from "@/test/test-utils";

const service = vi.hoisted(() => ({
  fetchOutboundDocuments: vi.fn(),
}));
vi.mock("@/modules/outbound/services/alignedOutboundService", () => ({
  fetchOutboundDocuments: service.fetchOutboundDocuments,
}));

import { OutboundOverview } from "./OutboundOverview";

const COUNTS: Record<string, number> = {
  all: 1284,
  DRAFT: 12,
  SCANNING: 24,
  POSTED: 1245,
  CANCELLED: 3,
};

function response(total: unknown) {
  return {
    // The summary must use meta.total, never the one returned row or its quantity.
    data: [{ id: "only-returned-row", expected: 9999, scanned: 9999 }],
    meta: { total, current_page: 1, per_page: 1 },
  };
}

function overview() {
  return screen.getByRole("region", { name: "Tình trạng xử lý phiếu" });
}

beforeEach(() => {
  service.fetchOutboundDocuments
    .mockReset()
    .mockImplementation(({ status }: { status?: string }) =>
      Promise.resolve(response(COUNTS[status ?? "all"])),
    );
});

afterEach(() => cleanupTestState());

describe("OUT-01 overview · authoritative document totals", () => {
  it("reads the complete authorized totals for all four statuses", async () => {
    renderWithProviders(<OutboundOverview />);
    await screen.findByText("1.284");
    expect(screen.getByText("Tổng phiếu xuất")).toBeInTheDocument();

    expect(service.fetchOutboundDocuments).toHaveBeenCalledTimes(5);
    expect(service.fetchOutboundDocuments).toHaveBeenCalledWith({
      page: 1,
      per_page: 1,
    });
    for (const status of ["DRAFT", "SCANNING", "POSTED", "CANCELLED"]) {
      expect(service.fetchOutboundDocuments).toHaveBeenCalledWith({
        page: 1,
        per_page: 1,
        status,
      });
    }
    expect(within(overview()).getByText("12")).toBeInTheDocument();
    expect(within(overview()).getByText("24")).toBeInTheDocument();
    expect(within(overview()).getByText("1.245")).toBeInTheDocument();
    expect(within(overview()).getByText("3")).toBeInTheDocument();
    expect(within(overview()).queryByText("9999")).not.toBeInTheDocument();
    const toggle = within(overview()).getByRole("button", { name: "Thu gọn" });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(within(overview()).queryByText("1.284")).not.toBeVisible();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(overview()).toHaveAttribute("aria-busy", "false");
  });

  it("shows unknown totals while loading instead of invented zero counts", () => {
    service.fetchOutboundDocuments.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<OutboundOverview />);

    expect(overview()).toHaveAttribute("aria-busy", "true");
    expect(within(overview()).getAllByText("—")).toHaveLength(5);
    expect(within(overview()).queryByText("0")).not.toBeInTheDocument();
  });

  it("shows a confirmed empty collection as zero", async () => {
    service.fetchOutboundDocuments.mockResolvedValue(response(0));
    renderWithProviders(<OutboundOverview />);

    await waitFor(() => {
      expect(within(overview()).getAllByText("0")).toHaveLength(5);
    });
    expect(within(overview()).queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([undefined, null, -1, Number.NaN, "unavailable", "12", 2.5])(
    "does not coerce invalid aggregate %s into an authoritative count",
    async (total) => {
      service.fetchOutboundDocuments.mockImplementation(
        ({ status }: { status?: string }) =>
          Promise.resolve(response(status ? COUNTS[status] : total)),
      );
      renderWithProviders(<OutboundOverview />);
      await screen.findByText("1.245");

      expect(within(overview()).getByText("—")).toBeInTheDocument();
      expect(within(overview()).queryByText("1.284")).not.toBeInTheDocument();
    },
  );

  it("keeps successful counts visible and retries failed totals without a page reload", async () => {
    const onRefresh = vi.fn();
    service.fetchOutboundDocuments.mockImplementation(
      ({ status }: { status?: string }) =>
        status === "POSTED"
          ? Promise.reject(new Error("service unavailable"))
          : Promise.resolve(response(COUNTS[status ?? "all"])),
    );
    renderWithProviders(<OutboundOverview onRefresh={onRefresh} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Chưa tải được đầy đủ số liệu");
    expect(within(overview()).getByText("1.284")).toBeInTheDocument();
    expect(within(overview()).getByText("—")).toBeInTheDocument();
    expect(within(overview()).queryByText("1.245")).not.toBeInTheDocument();

    service.fetchOutboundDocuments.mockImplementation(
      ({ status }: { status?: string }) =>
        Promise.resolve(response(COUNTS[status ?? "all"])),
    );
    fireEvent.click(within(alert).getByRole("button", { name: "Thử lại" }));

    await screen.findByText("1.245");
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(service.fetchOutboundDocuments).toHaveBeenCalledTimes(10);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
