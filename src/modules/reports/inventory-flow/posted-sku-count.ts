import type { FlowDocument, LedgerMovement } from "./inventory-flow-api";

/** Count distinct SKU identities from posted evidence, never expected quantities. */
export function countPostedSkus(
  postedDocuments: FlowDocument[],
  ledger: LedgerMovement[],
  movementTypes: readonly string[],
): number {
  const documents = new Set(postedDocuments.map((row) => row.document_no));
  const skus = new Set<string>();
  for (const document of postedDocuments) {
    for (const line of document.reportLines ?? []) {
      if (line.posted > 0 && line.sku.trim()) skus.add(line.sku.trim());
    }
  }
  for (const movement of ledger) {
    if (
      documents.has(movement.source_document_no) &&
      movementTypes.includes(movement.movement_type) &&
      movement.qty_delta !== 0 &&
      movement.sku_code.trim()
    ) {
      skus.add(movement.sku_code.trim());
    }
  }
  return skus.size;
}
