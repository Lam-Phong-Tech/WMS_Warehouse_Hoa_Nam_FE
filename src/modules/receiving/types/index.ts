export interface InboundDocument {
  id: string;
  code: string;
  source: string;
  date: string;
  expected: number;
  posted: number;
  remaining: number;
  status: 'DRAFT' | 'SCANNING' | 'PARTIALLY_POSTED' | 'POSTED' | 'CLOSED' | 'CANCELLED';
  createdBy: string;
  version: number;
  sourceReference?: string;
}

export interface InboundLine {
  id: string;
  documentId: string;
  sku: string;
  skuName: string;
  scanTarget: string;
  expected: number;
  scanned: number;
  posted: number;
  remaining: number;
  validation: 'VALID' | 'INVALID' | 'UNKNOWN';
  selected: boolean;
}

export interface PostReceiptRequest {
  documentId: string;
  lines: { lineId: string; quantity: number }[];
  idempotencyKey: string;
  ifMatch: number;
}

export interface CloseRemainderRequest {
  documentId: string;
  reason: string;
}