import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/api/http", () => ({ http: { getPage: vi.fn() } }));

import { http } from "@/shared/api/http";
import { fetchLabelSnapshots } from "./mvpOutboundService";

describe("label snapshot optimistic-lock version", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves the API version used by print and reprint", async () => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: [
        { id: "label-1", version: 4 },
        { id: "label-2", version: "7" },
        { id: "label-3", version: 0 },
      ],
      meta: { current_page: 1, last_page: 1, total: 3 },
    });

    const snapshots = await fetchLabelSnapshots();
    expect(snapshots.map(({ id, version }) => ({ id, version }))).toEqual([
      { id: "label-1", version: 4 },
      { id: "label-2", version: 7 },
      { id: "label-3", version: 0 },
    ]);
  });

  it("does not invent a version when the API value is missing or invalid", async () => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: [undefined, null, "", " ", "invalid", Infinity, false].map(
        (version, index) => ({ id: String(index), version }),
      ),
      meta: { current_page: 1, last_page: 1, total: 7 },
    });

    const snapshots = await fetchLabelSnapshots();
    expect(snapshots.every(({ version }) => version === undefined)).toBe(true);
  });
});
