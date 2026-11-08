import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIoHistorySnapshot } from "@/modules/reports/io-history/io-history-api";
import { SnapshotRecentTransactions } from "./SnapshotRecentTransactions";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { useLanguageStore } from "@/shared/i18n/language.store";

vi.mock("@/modules/reports/io-history/io-history-api", () => ({
  useIoHistorySnapshot: vi.fn(),
}));

afterEach(() => {
  cleanup();
  useLanguageStore.getState().setLanguage("vi");
});

describe("recent transaction report links", () => {
  it("updates headers, document types and accessible actions in both languages without changing party names", async () => {
    const rows = ["INBOUND", "OUTBOUND", "REVERSAL"].map((type, index) => ({
      id: `id-${index}`,
      documentNo: `DOC-${index}`,
      type,
      status: "POSTED",
      createdAt: "2026-11-06T04:00:00Z",
      postedAt: "2026-11-06T04:30:00Z",
      qty: index === 1 ? -2 : 1,
      actor: "Nguyễn Văn A",
      department: "Kho chính",
      party: "Công ty Hoa Nam",
      movementCount: 1,
      movementNo: `MV-${index}`,
      originalDocumentNo: "",
      skuLines: [],
    }));
    vi.mocked(useIoHistorySnapshot).mockReturnValue({
      snapshot: { rows, dataAsOf: "2026-11-06T04:30:00Z" },
      loading: false,
      fetching: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    const navigate = vi.fn();
    render(<SnapshotRecentTransactions onNavigate={navigate} />);
    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("columnheader", { name: "Ghi sổ" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Xem DOC-0" }),
    ).toBeInTheDocument();

    await act(async () => {
      useLanguageStore.getState().setLanguage("en");
      await ensureEnglishMessages();
    });
    for (const header of [
      "Posted",
      "Document",
      "Type",
      "Partner",
      "Quantity",
      "View detail",
    ]) {
      expect(
        within(table).getByRole("columnheader", { name: header }),
      ).toBeInTheDocument();
    }
    for (const type of ["Inbound", "Outbound", "Reversal"]) {
      expect(within(table).getByText(type)).toBeInTheDocument();
    }
    expect(within(table).getAllByText("Công ty Hoa Nam")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "View DOC-0" }));
    expect(navigate).toHaveBeenCalledWith(
      "/reports/inventory-flow?screen=RPT-01&document=id-0",
    );

    act(() => useLanguageStore.getState().setLanguage("vi"));
    expect(
      within(table).getByRole("columnheader", { name: "Ghi sổ" }),
    ).toBeInTheDocument();
    expect(within(table).getByText("Hoàn tác")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Xem DOC-0" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["loading", "Đang tải giao dịch…", "Loading transactions…"],
    ["error", "Không tải được giao dịch.", "Could not load transactions."],
    ["stale", "Giao dịch có thể đã cũ.", "Transactions may be out of date."],
    [
      "empty",
      "Chưa có giao dịch trong 7 ngày gần nhất",
      "No transactions in the last 7 days",
    ],
  ])(
    "updates the %s state and retry control while mounted",
    async (state, vietnamese, english) => {
      const refetch = vi.fn();
      vi.mocked(useIoHistorySnapshot).mockReturnValue({
        snapshot: {
          rows:
            state === "stale"
              ? [
                  {
                    id: "id",
                    documentNo: "DOC",
                    type: "INBOUND",
                    postedAt: "2026-11-06T04:30:00Z",
                    qty: 1,
                  },
                ]
              : [],
          dataAsOf: "2026-11-06T04:30:00Z",
        },
        loading: state === "loading",
        fetching: false,
        error:
          state === "error" || state === "stale" ? new Error("offline") : null,
        refetch,
      } as never);
      render(<SnapshotRecentTransactions onNavigate={vi.fn()} />);
      expect(screen.getByText(vietnamese)).toBeInTheDocument();
      await act(async () => {
        useLanguageStore.getState().setLanguage("en");
        await ensureEnglishMessages();
      });
      expect(screen.getByText(english)).toBeInTheDocument();
      if (state === "empty") {
        expect(
          screen.getByText(
            "Current stock is still based on the latest snapshot.",
          ),
        ).toBeInTheDocument();
      }
      if (state === "error" || state === "stale") {
        fireEvent.click(screen.getByRole("button", { name: "Retry" }));
        expect(refetch).toHaveBeenCalledOnce();
      }
      act(() => useLanguageStore.getState().setLanguage("vi"));
      expect(screen.getByText(vietnamese)).toBeInTheDocument();
    },
  );

  it.each([
    ["INBOUND", "/reports/inventory-flow?screen=RPT-01&document=selected-id"],
    ["OUTBOUND", "/reports/outbound-flow?screen=RPT-01B&document=selected-id"],
    ["REVERSAL", "/reports/pending-evidence?screen=RPT-08"],
  ])("opens the selected %s document in its matching view", (type, route) => {
    vi.mocked(useIoHistorySnapshot).mockReturnValue({
      snapshot: {
        rows: [
          {
            id: "another-id",
            documentNo: "OTHER",
            type: "INBOUND",
            postedAt: "2026-11-06T04:00:00Z",
            qty: 1,
          },
          {
            id: "selected-id",
            documentNo: "SELECTED",
            type,
            postedAt: "2026-11-06T04:30:00Z",
            qty: 1,
          },
        ],
      },
      loading: false,
      error: null,
    } as never);
    const navigate = vi.fn();
    render(<SnapshotRecentTransactions onNavigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Xem SELECTED" }));
    expect(navigate).toHaveBeenCalledExactlyOnceWith(route);
  });
});
