import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { cleanupTestState } from "@/test/setup";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("@/modules/warranty/hooks/use-warranty", () => ({
  useComponentIssues: vi.fn(),
}));

import { useComponentIssues } from "@/modules/warranty/hooks/use-warranty";
import { ComponentIssueOverview } from "./ComponentIssueOverview";

type CountQuery = ReturnType<typeof useComponentIssues>;

function query(
  total: unknown,
  overrides: Record<string, unknown> = {},
): CountQuery {
  return {
    // One visible row must never substitute for the server's global count.
    data: { data: [{ id: "visible-row", scanned_qty: 999 }], meta: { total } },
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as CountQuery;
}

let responses: Record<string, CountQuery>;

beforeEach(() => {
  responses = {
    DRAFT: query(12),
    SCANNING: query(8),
    POSTED: query(64),
    CANCELLED: query(4),
  };
  vi.mocked(useComponentIssues).mockImplementation(
    (params) => responses[String(params.status)],
  );
});

afterEach(() => {
  cleanupTestState();
  vi.clearAllMocks();
});

describe("WAR-04 overview authoritative status totals", () => {
  it("uses server metadata for every status and the Vietnamese posted percentage", () => {
    renderWithProviders(<ComponentIssueOverview />);

    for (const status of Object.keys(responses)) {
      expect(useComponentIssues).toHaveBeenCalledWith({
        status,
        page: 1,
        per_page: 1,
      });
    }
    expect(screen.getByText("64 / 88")).toBeInTheDocument();
    expect(screen.getByText("72,7%")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.queryByText("999")).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      String((64 / 88) * 100),
    );
  });

  it.each([undefined, null, -1, Number.NaN, "12", 2.5])(
    "does not show a false total or percentage for invalid metadata %s",
    (total) => {
      responses.DRAFT = query(total);
      renderWithProviders(<ComponentIssueOverview />);

      expect(screen.getByText("64 / —")).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).not.toHaveAttribute(
        "aria-valuenow",
      );
      expect(screen.getByRole("progressbar")).toHaveAttribute(
        "aria-valuetext",
        "Chưa có dữ liệu tổng hợp",
      );
    },
  );

  it("shows unknown counts while loading or refreshing rather than stale totals", () => {
    responses.DRAFT = query(12, { isLoading: true, isFetching: true });
    responses.POSTED = query(64, { isFetching: true });
    renderWithProviders(<ComponentIssueOverview />);

    expect(
      screen.getByRole("region", { name: "Tổng quan ghi sổ" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("— / —")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).not.toHaveAttribute(
      "aria-valuenow",
    );
  });

  it("keeps a confirmed empty collection at zero", () => {
    for (const status of Object.keys(responses)) responses[status] = query(0);
    renderWithProviders(<ComponentIssueOverview />);

    expect(screen.getByText("0 / 0")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
  });

  it("marks failed counts unknown and retries all four summary requests", () => {
    responses.POSTED = query(64, { isError: true });
    renderWithProviders(<ComponentIssueOverview />);

    expect(screen.getByText("— / —")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Chưa tải được đầy đủ số liệu.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    for (const response of Object.values(responses)) {
      expect(response.refetch).toHaveBeenCalledTimes(1);
    }
  });

  it("prevents duplicate retries while the failed counts are being refreshed", () => {
    responses.POSTED = query(64, { isError: true, isFetching: true });
    renderWithProviders(<ComponentIssueOverview />);

    expect(screen.getByRole("button", { name: "Đang tải…" })).toBeDisabled();
  });

  it("allows each status to filter the list, including through the keyboard", async () => {
    const onStatusSelect = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ComponentIssueOverview onStatusSelect={onStatusSelect} />,
    );

    await user.tab();
    expect(
      screen.getByRole("button", { name: "Lọc phiếu đã ghi sổ" }),
    ).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onStatusSelect).toHaveBeenLastCalledWith("POSTED");

    for (const [name, status] of [
      ["Lọc phiếu nháp", "DRAFT"],
      ["Lọc phiếu đang quét/nhập", "SCANNING"],
      ["Lọc phiếu đã hủy", "CANCELLED"],
    ]) {
      await user.click(screen.getByRole("button", { name }));
      expect(onStatusSelect).toHaveBeenLastCalledWith(status);
    }
    expect(onStatusSelect).toHaveBeenCalledTimes(4);
  });
});
