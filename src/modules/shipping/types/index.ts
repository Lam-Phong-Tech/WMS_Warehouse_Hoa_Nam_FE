export interface OutboundDocument {
  id: string;
  code: string;
  receiverType: "AGENCY" | "OTHER";
  receiverId: string;
  receiverName: string;
  date: string;
  planned: number;
  issued: number;
  remaining: number;
  status:
    | "DRAFT"
    | "SCANNING"
    | "PARTIALLY_POSTED"
    | "POSTED"
    | "CLOSED"
    | "CANCELLED";
  createdBy: string;
  version: number;
}

export interface OutboundLine {
  id: string;
  documentId: string;
  sku: string;
  skuName: string;
  scanSource: string;
  available: number;
  planned: number;
  issued: number;
  subsetNew: number;
  validation: "VALID" | "INVALID" | "UNKNOWN";
  selected: boolean;
}

export interface PostIssueRequest {
  documentId: string;
  lines: { lineId: string; quantity: number }[];
  idempotencyKey: string;
  ifMatch: number;
}
