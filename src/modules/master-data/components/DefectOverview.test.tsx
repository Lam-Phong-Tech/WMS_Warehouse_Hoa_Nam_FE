import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MasterListParams } from "@/modules/master-data/types/mvp-master.types";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { DefectOverview } from "./DefectOverview";

const { queryDefects, refetchTotal, refetchActive, refetchInactive } =
  vi.hoisted(() => ({
    queryDefects: vi.fn(),
    refetchTotal: vi.fn().mockResolvedValue({}),
    refetchActive: vi.fn().mockResolvedValue({}),
    refetchInactive: vi.fn().mockResolvedValue({}),
  }));

vi.mock("@/modules/master-data/hooks/use-mvp-master", () => ({
  useMvpDefects: queryDefects,
}));

function countResponse(total: unknown, refetch = refetchTotal) {
  return {
    data: {
      data: [{ defect_id: "single-count-probe-row" }],
      meta: total === undefined ? {} : { total },
    },
    isSuccess: true,
    isError: false,
    isLoading: false,
    refetch,
  };
}

function mockCounts(total: unknown, active: unknown, inactive: unknown) {
  queryDefects.mockImplementation((params: MasterListParams) =>
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
  return screen.getByRole("region", { name: "Danh mục bệnh / lỗi" });
}

describe("DefectOverview global counts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryDefects.mockReset();
    useLanguageStore.setState({ language: "vi" });
  });
  afterEach(cleanup);

  it("uses unfiltered server totals rather than count-probe rows", () => {
    mockCounts("130", 80, 50);
    render(<DefectOverview />);

    expect(within(overview()).getByText("130")).toBeInTheDocument();
    expect(within(overview()).getByText("80")).toBeInTheDocument();
    expect(within(overview()).getByText("50")).toBeInTheDocument();
    expect(within(overview()).getByText("61,5%")).toBeInTheDocument();
    expect(within(overview()).getByText("38,5%")).toBeInTheDocument();
    expect(queryDefects).toHaveBeenCalledWith({ page: 1, per_page: 1 });
    expect(queryDefects).toHaveBeenCalledWith({
      status: "ACTIVE",
      page: 1,
      per_page: 1,
    });
    expect(queryDefects).toHaveBeenCalledWith({
      status: "INACTIVE",
      page: 1,
      per_page: 1,
    });
    expect(queryDefects).toHaveBeenCalledTimes(3);
    expect(
      overview().querySelector(".hn-defect-overview-segment--active"),
    ).toHaveStyle({ width: `${(80 / 130) * 100}%` });
  });

  it("refreshes all count probes when the explicit refresh key changes", () => {
    mockCounts(10, 8, 2);
    const { rerender } = render(<DefectOverview />);
    rerender(<DefectOverview />);
    for (const refetch of [refetchTotal, refetchActive, refetchInactive]) {
      expect(refetch).not.toHaveBeenCalled();
    }
    rerender(<DefectOverview refreshKey={1} />);
    rerender(<DefectOverview refreshKey={1} />);
    for (const refetch of [refetchTotal, refetchActive, refetchInactive]) {
      expect(refetch).toHaveBeenCalledTimes(1);
    }
    rerender(<DefectOverview refreshKey={2} />);
    for (const refetch of [refetchTotal, refetchActive, refetchInactive]) {
      expect(refetch).toHaveBeenCalledTimes(2);
    }
  });

  it("shows skeleton-ready unknown values during the initial list load", () => {
    mockCounts(10, 8, 2);
    const { rerender } = render(<DefectOverview loading />);
    expect(overview()).toHaveAttribute("aria-busy", "true");
    expect(overview()).toHaveAttribute("data-state", "loading");
    expect(within(overview()).getAllByText("—")).toHaveLength(3);
    expect(within(overview()).queryByText("10")).not.toBeInTheDocument();
    expect(
      overview().querySelectorAll(".hn-defect-overview-segment"),
    ).toHaveLength(0);
    rerender(<DefectOverview loading={false} />);
    expect(overview()).toHaveAttribute("aria-busy", "false");
    expect(within(overview()).getByText("10")).toBeInTheDocument();
  });

  it("also waits for unfinished count queries without displaying a false zero", () => {
    queryDefects.mockReturnValue({
      ...countResponse(0),
      isSuccess: false,
      isLoading: true,
    });
    render(<DefectOverview />);
    expect(overview()).toHaveAttribute("data-state", "loading");
    expect(within(overview()).getAllByText("—")).toHaveLength(3);
    expect(within(overview()).queryByText("0")).not.toBeInTheDocument();
  });

  it.each([undefined, null, "", " ", false, -1, 1.5, "not-a-count"])(
    "does not invent a total for invalid metadata %j",
    (total) => {
      mockCounts(total, 8, 2);
      render(<DefectOverview />);
      expect(overview()).toHaveAttribute("data-state", "unavailable");
      expect(within(overview()).getAllByText("—")).toHaveLength(3);
      expect(within(overview()).getByText("8")).toBeInTheDocument();
      expect(within(overview()).getByText("2")).toBeInTheDocument();
      expect(within(overview()).queryByText("1")).not.toBeInTheDocument();
      expect(
        overview().querySelectorAll(".hn-defect-overview-segment"),
      ).toHaveLength(0);
    },
  );

  it("does not show failed cached probes as current totals", () => {
    queryDefects.mockReturnValue({
      ...countResponse(42),
      isSuccess: false,
      isError: true,
    });
    render(<DefectOverview />);
    expect(overview()).toHaveAttribute("data-state", "unavailable");
    expect(within(overview()).getAllByText("—")).toHaveLength(5);
    expect(within(overview()).queryByText("42")).not.toBeInTheDocument();
  });

  it("renders a confirmed empty catalog without meaningless percentages", () => {
    mockCounts(0, 0, 0);
    render(<DefectOverview />);
    expect(overview()).toHaveAttribute("data-state", "ready");
    expect(within(overview()).getAllByText("0")).toHaveLength(3);
    expect(within(overview()).queryByText("—")).not.toBeInTheDocument();
    expect(
      overview().querySelectorAll(".hn-defect-overview-percent"),
    ).toHaveLength(0);
  });

  it("withholds the bar and percentages when probes observe different revisions", () => {
    mockCounts(10, 8, 3);
    render(<DefectOverview />);
    expect(within(overview()).getByText("10")).toBeInTheDocument();
    expect(within(overview()).getByText("8")).toBeInTheDocument();
    expect(within(overview()).getByText("3")).toBeInTheDocument();
    expect(within(overview()).getAllByText("—")).toHaveLength(2);
    expect(
      overview().querySelectorAll(".hn-defect-overview-segment"),
    ).toHaveLength(0);
  });

  it("retains valid cached counts only when the containing list explicitly marks its data stale", () => {
    queryDefects.mockImplementation((params: MasterListParams) => ({
      ...countResponse(
        params.status === "ACTIVE" ? 8 : params.status === "INACTIVE" ? 2 : 10,
      ),
      isSuccess: false,
      isError: true,
    }));
    const { rerender } = render(<DefectOverview stale />);
    expect(overview()).toHaveAttribute("data-state", "stale");
    expect(within(overview()).getByText("10")).toBeInTheDocument();
    expect(within(overview()).getByText("8")).toBeInTheDocument();
    expect(within(overview()).getByText("2")).toBeInTheDocument();
    expect(within(overview()).getByText("80%")).toBeInTheDocument();
    expect(within(overview()).getByText("20%")).toBeInTheDocument();
    expect(
      overview().querySelector(".hn-defect-overview-segment--active"),
    ).toHaveStyle({ width: "80%" });
    rerender(<DefectOverview stale={false} />);
    expect(overview()).toHaveAttribute("data-state", "unavailable");
    expect(within(overview()).getAllByText("—")).toHaveLength(5);
    expect(within(overview()).queryByText("10")).not.toBeInTheDocument();
  });

  it.each([undefined, "invalid-total"])(
    "does not invent cached totals from stale metadata %j",
    (total) => {
      queryDefects.mockReturnValue({
        ...countResponse(total),
        isSuccess: false,
        isError: true,
      });
      render(<DefectOverview stale />);
      expect(overview()).toHaveAttribute("data-state", "unavailable");
      expect(within(overview()).getAllByText("—")).toHaveLength(5);
      expect(within(overview()).queryByText("1")).not.toBeInTheDocument();
      expect(
        overview().querySelectorAll(".hn-defect-overview-segment"),
      ).toHaveLength(0);
    },
  );

  it("withholds a distribution when retained cached totals do not reconcile", () => {
    queryDefects.mockImplementation((params: MasterListParams) => ({
      ...countResponse(
        params.status === "ACTIVE" ? 8 : params.status === "INACTIVE" ? 3 : 10,
      ),
      isSuccess: false,
      isError: true,
    }));
    render(<DefectOverview stale />);
    expect(overview()).toHaveAttribute("data-state", "stale");
    expect(within(overview()).getByText("10")).toBeInTheDocument();
    expect(within(overview()).getAllByText("—")).toHaveLength(2);
    expect(
      overview().querySelectorAll(".hn-defect-overview-segment"),
    ).toHaveLength(0);
  });
});
