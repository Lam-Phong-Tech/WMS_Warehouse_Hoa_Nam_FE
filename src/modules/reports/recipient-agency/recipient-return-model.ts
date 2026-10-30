import type { RecipientAgencyLedgerEvent } from "./recipient-agency-api";

type IssueEvent = Pick<
  RecipientAgencyLedgerEvent,
  "event_type" | "outbound_document_id" | "outbound_no" | "occurred_at" | "quantity"
>;

export type ReturnSource = {
  id: string;
  code: string;
  postedAt: string;
  gross: number;
  reversed: number;
  net: number;
};

export type ReturnDocument = {
  id: string;
  code: string;
  sourceId: string;
  sourceCode: string;
  postedAt: string;
  quantity: number;
  status: string;
};

const value = (raw: unknown) => (typeof raw === "string" ? raw.trim() : "");
const quantity = (raw: unknown) => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

/** Join canonical POSTED reversal documents to the outbound documents in this recipient's report slice. */
export function buildRecipientReturnReconciliation(
  events: IssueEvent[],
  reversalRows: Record<string, unknown>[],
) {
  const sources = new Map<string, ReturnSource>();
  const sourceByCode = new Map<string, string>();
  for (const event of events) {
    if (event.event_type !== "ISSUE_POSTED") continue;
    const id = event.outbound_document_id;
    if (!id) continue;
    const source = sources.get(id) ?? {
      id,
      code: event.outbound_no,
      postedAt: event.occurred_at,
      gross: 0,
      reversed: 0,
      net: 0,
    };
    source.gross += event.quantity;
    sources.set(id, source);
    if (event.outbound_no) sourceByCode.set(event.outbound_no, id);
  }

  const reversals: ReturnDocument[] = [];
  const seen = new Set<string>();
  for (const row of reversalRows) {
    if (value(row.status) !== "POSTED") continue;
    const id = value(row.id);
    if (!id || seen.has(id)) continue;
    const referenceId = value(row.reference_document_id);
    const referenceCode = value(row.reference_document_code);
    const sourceId = sources.has(referenceId) ? referenceId : sourceByCode.get(referenceCode);
    if (!sourceId) continue;
    seen.add(id);
    const source = sources.get(sourceId)!;
    const reversed = quantity(row.total_qty);
    source.reversed += reversed;
    reversals.push({
      id,
      code: value(row.reversal_code) || id,
      sourceId,
      sourceCode: source.code,
      postedAt: value(row.reversed_at) || value(row.posted_at),
      quantity: reversed,
      status: value(row.status),
    });
  }

  const sourceRows = [...sources.values()];
  for (const source of sourceRows) source.net = source.gross - source.reversed;
  const gross = sourceRows.reduce((total, source) => total + source.gross, 0);
  const reversed = reversals.reduce((total, row) => total + row.quantity, 0);
  return { sources: sourceRows, reversals, totals: { gross, reversed, net: gross - reversed } };
}
