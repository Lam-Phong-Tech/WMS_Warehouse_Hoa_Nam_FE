import type { QueryKey } from "@tanstack/react-query";
import { QUERY_CACHE_REGISTRY } from "@/shared/cache/cache-policy";

const READ_ROOTS = new Set([
  "inventory",
  "putaway",
  "reversal",
  "outbound-nfc",
  "catalog-master",
  "dashboard",
  "report-document-detail",
  "document-attachments",
  ...QUERY_CACHE_REGISTRY.filter(
    ([, cacheClass]) => cacheClass === "report",
  ).map(([root]) => root),
]);

const READ_PREFIXES: Readonly<Record<string, readonly string[]>> = {
  inbound: ["list", "scan-entries"],
  "mvp-outbound": [
    "list",
    "overview",
    "recipient-options",
    "availability",
    "available-skus",
    "packing-labels",
    "printers",
  ],
  warranty: [
    "list",
    "events",
    "attachments",
    "component-issues",
    "component-issues-by-tracking",
    "component-issue-sku-index",
    "component-issue-availability",
  ],
  "mvp-master": [
    "skus",
    "agencies",
    "defects",
    "product-catalogs",
    "suppliers",
  ],
  ref: [
    "sku-catalog",
    "product-categories",
    "printer-configs",
    "agencies",
    "defects",
  ],
  scan: ["physical-codes", "batches", "events"],
  pv: ["products", "product", "product-by-code", "recommendations"],
};

/**
 * Background refresh selects existing read queries without changing their
 * filters, pagination or local drafts. Editor sources are deliberately absent:
 * warehouse detail hydrates unsaved fields, while document/warranty details own
 * captured edits and optimistic versions. Warehouse directories can also reset
 * a new inbound header, so they remain on their normal mutation/cache policy.
 */
export function isOperationalReadQueryKey(queryKey: QueryKey): boolean {
  const [root, section] = queryKey;
  if (typeof root !== "string") return false;
  const sections = READ_PREFIXES[root];
  return (
    READ_ROOTS.has(root) ||
    (typeof section === "string" &&
      Array.isArray(sections) &&
      sections.includes(section))
  );
}
