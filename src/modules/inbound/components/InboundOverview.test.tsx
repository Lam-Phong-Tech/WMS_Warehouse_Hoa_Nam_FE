import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { cleanupTestState } from "@/test/setup";
import { renderWithProviders } from "@/test/test-utils";

vi.mock("@/modules/inbound/hooks/use-inbound", () => ({
  useInboundDocuments: vi.fn(),
}));

import { useInboundDocuments } from "@/modules/inbound/hooks/use-inbound";
import { InboundOverview } from "./InboundOverview";

type CountQuery = ReturnType<typeof useInboundDocuments>;

function query(
  total: unknown,
  overrides: Record<string, unknown> = {},
): CountQuery {
  return {
    // Deliberately unrelated row data: summary must never count/sum this page.
    data: { data: [{ id: "one-row", scanned: 999 }], meta: { total } },
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
    all: query(84),
    DRAFT: query(12),
    SCANNING: query(8),
    POSTED: query(64),
  };
  vi.mocked(useInboundDocuments).mockImplementation(
    (params) => responses[params.status ?? "all"],
  );
});

afterEach(() => {
  cleanupTestState();
  vi.clearAllMocks();
});

describe("IN-01 overview · authoritative totals", () => {
  it("reads all authorized receipt totals across pages and computes the posted ratio", () => {
    renderWithProviders(<InboundOverview onRefresh={vi.fn()} />);

    expect(useInboundDocuments).toHaveBeenCalledWith({ page: 1, per_page: 1 });
    for (const status of ["DRAFT", "SCANNING", "POSTED"]) {
      expect(useInboundDocuments).toHaveBeenCalledWith({
        page: 1,
        per_page: 1,
        status,
      });
    }
    expect(screen.getByText("64 / 84")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("76,2%")).toBeInTheDocument();
    expect(screen.queryByText("999")).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      String((64 / 84) * 100),
    );
  });

  it("refreshes every total query and the list from the sync action", () => {
    const onRefresh = vi.fn();
    renderWithProviders(<InboundOverview onRefresh={onRefresh} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Đồng bộ từ Scanner App" }),
    );

    for (const response of Object.values(responses)) {
      expect(response.refetch).toHaveBeenCalledTimes(1);
    }
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("keeps a confirmed empty collection at zero without inventing scan totals", async () => {
    for (const key of Object.keys(responses)) responses[key] = query(0);
    renderWithProviders(<InboundOverview onRefresh={vi.fn()} />);

    expect(screen.getByText("0 / 0")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
    const unavailable = screen.getByLabelText(
      "Mã đã quét: Chưa có số liệu tổng hợp mã quét",
    );
    expect(unavailable).toHaveTextContent("—");
    const user = userEvent.setup();
    await user.tab();
    await user.tab();
    expect(unavailable).toHaveFocus();
    await user.hover(unavailable);
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toHaveTextContent(
        "Chưa có số liệu tổng hợp mã quét",
      );
    });
  });

  it("does not present pending values as zero and disables repeat refresh", () => {
    responses.all = query(84, { isLoading: true, isFetching: true });
    responses.POSTED = query(64, { isFetching: true });
    renderWithProviders(<InboundOverview onRefresh={vi.fn()} />);

    expect(screen.getByText("— / —")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).not.toHaveAttribute(
      "aria-valuenow",
    );
    expect(
      screen.getByRole("button", { name: "Đang đồng bộ…" }),
    ).toBeDisabled();
  });

  it.each([undefined, null, -1, Number.NaN, "unavailable", 2.5])(
    "does not coerce invalid total %s into a known aggregate",
    (total) => {
      responses.all = query(total);
      renderWithProviders(<InboundOverview onRefresh={vi.fn()} />);

      expect(screen.getByText("64 / —")).toBeInTheDocument();
      expect(screen.getByRole("progressbar")).not.toHaveAttribute(
        "aria-valuenow",
      );
    },
  );

  it("exposes failed totals and retains the retry action", () => {
    responses.POSTED = query(64, { isError: true });
    renderWithProviders(<InboundOverview onRefresh={vi.fn()} />);

    expect(screen.getByText("— / 84")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Bấm đồng bộ để thử lại",
    );
    expect(
      screen.getByRole("button", { name: "Đồng bộ từ Scanner App" }),
    ).toBeEnabled();
  });

  it("does not display a percentage above 100 during independent cache updates", () => {
    responses.all = query(5);
    responses.POSTED = query(6);
    renderWithProviders(<InboundOverview onRefresh={vi.fn()} />);

    expect(screen.getByRole("progressbar")).not.toHaveAttribute(
      "aria-valuenow",
    );
    expect(screen.queryByText("120%")).not.toBeInTheDocument();
  });
});
