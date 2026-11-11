import { beforeEach, describe, expect, it, vi } from "vitest";
import { http } from "@/shared/api/http";
import { fetchOutboundDocuments } from "./mvpOutboundService";

vi.mock("@/shared/api/http", () => ({
  http: { getPage: vi.fn() },
}));

const emptyPage = {
  data: [],
  meta: { current_page: 1, per_page: 10, total: 0, last_page: 1 },
};

describe("OUT-01 created-date list filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(http.getPage).mockResolvedValue(emptyPage as never);
  });

  it("sends from_date/to_date to the API without dropping existing filters", async () => {
    await fetchOutboundDocuments({
      search: "PX",
      status: "DRAFT",
      fromDate: "2026-11-01",
      toDate: "2026-11-11",
      sortOrder: "asc",
    });

    expect(http.getPage).toHaveBeenCalledWith("/outbound-documents", {
      params: {
        keyword: "PX",
        status: "DRAFT",
        from_date: "2026-11-01",
        to_date: "2026-11-11",
        page: 1,
        per_page: 10,
        sort_order: "asc",
      },
    });
  });

  it("omits both date params when the range is not selected", async () => {
    await fetchOutboundDocuments();

    expect(http.getPage).toHaveBeenCalledWith("/outbound-documents", {
      params: { page: 1, per_page: 10 },
    });
  });
});
