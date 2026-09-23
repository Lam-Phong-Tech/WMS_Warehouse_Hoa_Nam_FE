import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MasterListParams } from "@/modules/master-data/types/mvp-master.types";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { SkuListOverview } from "./SkuListOverview";

const { mockUseMvpSkus, refetchTotal, refetchActive, refetchInactive } =
  vi.hoisted(() => ({
    mockUseMvpSkus: vi.fn(),
    refetchTotal: vi.fn().mockResolvedValue({}),
    refetchActive: vi.fn().mockResolvedValue({}),
    refetchInactive: vi.fn().mockResolvedValue({}),
  }));

vi.mock("@/modules/master-data/hooks/use-mvp-master", () => ({
  useMvpSkus: mockUseMvpSkus,
}));

function countResponse(total?: number, refetch = refetchTotal) {
  return {
    // Every count probe returns only one record, even when the catalog is large.
    data: {
      data: [{ sku_id: "one-page-row" }],
      meta: total === undefined ? {} : { total },
    },
    isSuccess: true,
    isError: false,
    isLoading: false,
    refetch,
  };
}

function mockCounts(total?: number, active?: number, inactive?: number) {
  mockUseMvpSkus.mockImplementation((params: MasterListParams) =>
    countResponse(
      params.status === "ACTIVE"
        ? active
        : params.status === "INACTIVE"
          ? inactive
          : total,
      params.status === "ACTIVE"
        ? refetchActive
        : params.status === "INACTIVE"
          ? refetchInactive
          : refetchTotal,
    ),
  );
}

function overview() {
  return screen.getByRole("region", { name: "Danh mục SKU" });
}

describe("SkuListOverview catalog counts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMvpSkus.mockReset();
    useLanguageStore.setState({ language: "vi" });
  });

  it("uses unfiltered server totals instead of the count probe's single page row", () => {
    mockCounts(130, 80, 50);
    render(<SkuListOverview />);

    expect(within(overview()).getByText("130")).toBeInTheDocument();
    expect(within(overview()).getByText("80")).toBeInTheDocument();
    expect(within(overview()).getByText("50")).toBeInTheDocument();
    expect(within(overview()).getByText("61,5%")).toBeInTheDocument();
    expect(within(overview()).getByText("38,5%")).toBeInTheDocument();
    expect(mockUseMvpSkus).toHaveBeenCalledWith({ page: 1, per_page: 1 });
    expect(mockUseMvpSkus).toHaveBeenCalledWith({
      status: "ACTIVE",
      page: 1,
      per_page: 1,
    });
    expect(mockUseMvpSkus).toHaveBeenCalledWith({
      status: "INACTIVE",
      page: 1,
      per_page: 1,
    });
  });

  it("refreshes count queries only when the explicit refresh key changes", () => {
    mockCounts(130, 80, 50);
    const { rerender } = render(<SkuListOverview />);
    rerender(<SkuListOverview />);
    for (const refetch of [refetchTotal, refetchActive, refetchInactive]) {
      expect(refetch).not.toHaveBeenCalled();
    }

    rerender(<SkuListOverview refreshKey={1} />);
    for (const refetch of [refetchTotal, refetchActive, refetchInactive]) {
      expect(refetch).toHaveBeenCalledTimes(1);
    }
    rerender(<SkuListOverview refreshKey={1} />);
    for (const refetch of [refetchTotal, refetchActive, refetchInactive]) {
      expect(refetch).toHaveBeenCalledTimes(1);
    }

    rerender(<SkuListOverview refreshKey={2} />);
    for (const refetch of [refetchTotal, refetchActive, refetchInactive]) {
      expect(refetch).toHaveBeenCalledTimes(2);
    }
  });
  it("shows unavailable values rather than a false empty catalog while loading", () => {
    mockUseMvpSkus.mockReturnValue({
      ...countResponse(0),
      isSuccess: false,
      isLoading: true,
    });
    render(<SkuListOverview />);

    expect(overview()).toHaveAttribute("aria-busy", "true");
    expect(within(overview()).getAllByText("—")).toHaveLength(5);
    expect(within(overview()).queryByText("0")).not.toBeInTheDocument();
    expect(within(overview()).queryByText("0%")).not.toBeInTheDocument();
  });

  it("does not invent a total or percentages when metadata is missing", () => {
    mockCounts(undefined, 80, 50);
    render(<SkuListOverview />);

    expect(within(overview()).getAllByText("—")).toHaveLength(3);
    expect(within(overview()).getByText("80")).toBeInTheDocument();
    expect(within(overview()).getByText("50")).toBeInTheDocument();
    expect(within(overview()).queryByText("1")).not.toBeInTheDocument();
    expect(overview()).toHaveAttribute("data-state", "unavailable");
  });

  it("does not show cached counts as current totals after a failed request", () => {
    mockUseMvpSkus.mockReturnValue({
      ...countResponse(42),
      isSuccess: false,
      isError: true,
    });
    render(<SkuListOverview />);

    expect(within(overview()).getAllByText("—")).toHaveLength(5);
    expect(within(overview()).queryByText("42")).not.toBeInTheDocument();
    expect(overview()).toHaveAttribute("data-state", "unavailable");
  });

  it("distinguishes a successfully loaded empty catalog from unavailable counts", () => {
    mockCounts(0, 0, 0);
    render(<SkuListOverview />);

    expect(within(overview()).getAllByText("0")).toHaveLength(3);
    expect(within(overview()).getAllByText("0%")).toHaveLength(2);
    expect(within(overview()).queryByText("—")).not.toBeInTheDocument();
    expect(overview()).toHaveAttribute("data-state", "ready");
  });

  it("withholds misleading percentages when separate responses observe different revisions", () => {
    mockCounts(130, 80, 51);
    render(<SkuListOverview />);

    expect(within(overview()).getByText("130")).toBeInTheDocument();
    expect(within(overview()).getByText("80")).toBeInTheDocument();
    expect(within(overview()).getByText("51")).toBeInTheDocument();
    expect(within(overview()).getAllByText("—")).toHaveLength(2);
    expect(
      overview().querySelectorAll(".hn-sku-overview-segment"),
    ).toHaveLength(0);
  });
});
