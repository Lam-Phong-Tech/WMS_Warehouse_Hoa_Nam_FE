import { describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryObserver,
  type QueryKey,
} from "@tanstack/react-query";
import {
  QUERY_CACHE_REGISTRY,
  classOfQueryKey,
} from "@/shared/cache/cache-policy";
import { isOperationalReadQueryKey } from "./operational-queries";

describe("operational read query selection", () => {
  it.each<QueryKey>([
    ["inbound", "list", { status: "SCANNING", page: 3 }],
    ["inbound", "scan-entries", "in-1", "ALL"],
    ["mvp-outbound", "list", "abc", "POSTED", 3, 20, "asc", "Agency"],
    ["mvp-outbound", "available-skus", "SKU"],
    ["mvp-outbound", "availability", "out-1", ["sku-1"]],
    ["mvp-outbound", "packing-labels", "out-1"],
    ["mvp-outbound", "recipient-options"],
    ["mvp-outbound", "overview", "all"],
    ["mvp-outbound", "printers"],
    ["outbound-nfc", { warehouse_id: "w-1" }, "history", "out-1", "item-1", 2],
    ["inventory", "balances", { page: 4, stock_status: "AVAILABLE" }],
    ["putaway", "trays", "overview"],
    ["reversal", "reversible", { search: "MV-1" }],
    ["warranty", "list", { page: 3 }],
    ["warranty", "events", "case-1"],
    ["warranty", "attachments", "case-1"],
    ["warranty", "component-issues", { page: 2 }],
    ["warranty", "component-issues-by-tracking", { tracking: "SERIAL" }],
    ["warranty", "component-issue-sku-index", ["sku-1"]],
    ["warranty", "component-issue-availability", ["sku-1"]],
    ["mvp-master", "skus", { information_status: "PENDING", page: 2 }],
    ["catalog-master", "brands", { page: 2 }],
    ["ref", "sku-catalog"],
    ["ref", "agencies"],
    ["ref", "defects"],
    ["ref", "product-categories"],
    ["ref", "printer-configs"],
    ["dashboard", "overview-xnt", "2026-11-01", "2026-11-06"],
    ["scan", "physical-codes", { page: 3, per_page: 20 }],
    ["scan", "batches", { page: 2, per_page: 10 }],
    ["scan", "events", { page: 4, per_page: 10 }],
    ["pv", "products", { page: 2 }],
    ["pv", "product", "sku-1"],
    ["pv", "product-by-code", "SKU-1"],
    ["pv", "recommendations", "industry-1"],
    ["report-document-detail", "OUTBOUND", "out-1"],
    ["document-attachments", "INBOUND", "in-1"],
  ])("selects a live operational read %j", (...queryKey) => {
    expect(isOperationalReadQueryKey(queryKey)).toBe(true);
  });

  it("includes every registered report family without enumerating report screens", () => {
    for (const [root, cacheClass] of QUERY_CACHE_REGISTRY) {
      if (cacheClass === "report") {
        expect(
          isOperationalReadQueryKey([root, "a-new-report", { page: 2 }]),
        ).toBe(true);
      }
    }
    expect(classOfQueryKey(["outbound-nfc"])).toBe("list");
  });

  it.each<QueryKey>([
    [],
    ["auth", "profile"],
    ["notifications", "unread-count"],
    ["iam", "users", {}],
    ["security", "alerts"],
    ["nfc", "assign", "item-1"],
    ["warehouse", "detail", "warehouse-1"],
    ["ref", "warehouses", "active"],
    ["ref", "warehouses", "directory"],
    ["inbound", "detail", "in-1"],
    ["mvp-outbound", "detail", "out-1"],
    ["warranty", "detail", "case-1"],
    ["warranty", "component-issue", "issue-1"],
    ["mvp-outbound", "import-preview", "import-1"],
    ["sku-import-report", "import-1"],
    ["sku-import-constraints"],
    ["pv", "admin", "product-profiles", {}],
    ["unknown-table", "list"],
    ["constructor", "list"],
    ["toString", "list"],
  ])("leaves editors, previews and unrelated data alone %j", (...queryKey) => {
    expect(isOperationalReadQueryKey(queryKey)).toBe(false);
  });

  it("refreshes the observed filtered page while deferring unopened pages and preserving editor data", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    const key = ["inbound", "list", { status: "SCANNING", page: 3 }] as const;
    const unopened = ["inbound", "list", { page: 8 }] as const;
    const editor = ["inbound", "detail", "in-1"] as const;
    client.setQueryData(key, ["old row"]);
    client.setQueryData(unopened, ["unopened row"]);
    client.setQueryData(editor, { version: 2, note: "captured edit" });
    const outboundEditor = ["mvp-outbound", "detail", "out-1"] as const;
    client.setQueryData(outboundEditor, {
      document: { version: 4 },
      customerPhone: "0901234567",
    });
    const observer = new QueryObserver(client, {
      queryKey: key,
      queryFn: async () => ["new row"],
      staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => {});
    try {
      await client.invalidateQueries({
        predicate: (query) => isOperationalReadQueryKey(query.queryKey),
      });
      expect(client.getQueryData(key)).toEqual(["new row"]);
      expect(client.getQueryData(unopened)).toEqual(["unopened row"]);
      expect(client.getQueryState(unopened)?.isInvalidated).toBe(true);
      expect(client.getQueryState(editor)?.isInvalidated).toBe(false);
      expect(client.getQueryData(editor)).toEqual({
        version: 2,
        note: "captured edit",
      });
      expect(client.getQueryState(outboundEditor)?.isInvalidated).toBe(false);
      expect(client.getQueryData(outboundEditor)).toEqual({
        document: { version: 4 },
        customerPhone: "0901234567",
      });
    } finally {
      unsubscribe();
      client.clear();
    }
  });
});
