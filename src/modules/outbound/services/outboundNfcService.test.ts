import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/api/http", () => ({
  http: { getPage: vi.fn() },
}));

import { http } from "@/shared/api/http";
import {
  fetchOutboundNfcItems,
  fetchOutboundItemNfcHistory,
} from "./outboundNfcService";

describe("outbound NFC read contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads all issued products with server-side UID search and counts", async () => {
    const response = {
      data: [{ item_id: "item-1", nfc_status: "ASSIGNED" }],
      meta: {
        current_page: 1,
        per_page: 20,
        total: 1,
        tab_totals: { ALL: 2, ASSIGNED: 1, UNASSIGNED: 1 },
      },
    };
    vi.mocked(http.getPage).mockResolvedValue(response);

    const result = await fetchOutboundNfcItems({
      keyword: "04A1",
      nfcStatus: "ASSIGNED",
      page: 1,
      perPage: 20,
    });

    expect(http.getPage).toHaveBeenCalledWith(
      "/outbound-documents/nfc-items",
      {
        params: {
          keyword: "04A1",
          nfc_status: "ASSIGNED",
          page: 1,
          per_page: 20,
        },
        signal: undefined,
      },
    );
    expect(result.meta.tab_totals?.UNASSIGNED).toBe(1);
  });

  it("reads item history inside its outbound document", async () => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: [{ id: "event-1", action: "REVOKE_ITEM_NFC" }],
      meta: { current_page: 2, per_page: 10, total: 11 },
    });

    const result = await fetchOutboundItemNfcHistory("doc-1", "item-1", 2);

    expect(http.getPage).toHaveBeenCalledWith(
      "/outbound-documents/doc-1/items/item-1/nfc-history",
      { params: { page: 2, per_page: 10 }, signal: undefined },
    );
    expect(result.data[0].action).toBe("REVOKE_ITEM_NFC");
  });
});
