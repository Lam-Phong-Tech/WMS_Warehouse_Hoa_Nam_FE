import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateMasterDerived } from "./invalidation";

describe("SKU changes refresh App PV administration and preview", () => {
  it("invalidates cached PV results so a newly created SKU is visible immediately", async () => {
    const client = new QueryClient();
    const key = ["pv", "admin", "product-profiles", {}];
    client.setQueryData(key, { data: [] });
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    await invalidateMasterDerived(client);
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    client.clear();
  });
});
