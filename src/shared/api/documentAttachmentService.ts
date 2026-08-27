import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import { requireNonEmptyString } from "@/shared/api/wms-contract";

/**
 * "Chứng từ nhập/xuất/hoàn trả": ảnh/scan/PDF đính kèm phiếu nhập, phiếu xuất,
 * hoàn trả/điều chỉnh — BE gộp cả 3 loại vào một bảng/controller dùng chung
 * (Modules\Warehouse\Http\Controllers\DocumentAttachmentController, bảng
 * document_attachments), nên FE cũng dùng một service tham số hoá theo
 * documentType thay vì chép lại 3 lần theo khuôn warrantyService.ts.
 */
export type DocumentAttachmentType = "INBOUND" | "OUTBOUND" | "REVERSAL";

export type EvidenceStatus = "PROVIDED" | "PENDING" | "NOT_REQUIRED";

export type AttachmentKind =
  | "SOURCE_DOCUMENT"
  | "INVOICE"
  | "DELIVERY_NOTE"
  | "PHOTO"
  | "OTHER";

export interface DocumentAttachment {
  id: string;
  document_type: DocumentAttachmentType;
  document_id: string;
  attachment_type: AttachmentKind;
  file_name: string;
  content_type: string;
  file_size_bytes: number;
  checksum?: string;
  note?: string;
  status: "ACTIVE" | "DELETED" | "QUARANTINED";
  uploaded_at?: string;
  uploaded_by?: string;
}

export interface DocumentAttachmentList {
  attachments: DocumentAttachment[];
  evidenceStatus: EvidenceStatus;
  requiresEvidence: boolean;
}

export interface PendingEvidenceItem {
  document_type: DocumentAttachmentType;
  document_id: string;
  document_no: string;
  warehouse_id: string | null;
  status: string;
  missing_reason: string;
  created_at: string;
}

type RawRecord = Record<string, unknown>;

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

function numberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rowsOf<T>(value: T[] | { data?: T[] }): T[] {
  return Array.isArray(value)
    ? value
    : Array.isArray(value.data)
      ? value.data
      : [];
}

function endpointFor(documentType: DocumentAttachmentType): string {
  switch (documentType) {
    case "INBOUND":
      return API_ENDPOINTS.INBOUND_DOCUMENT_ATTACHMENTS;
    case "OUTBOUND":
      return API_ENDPOINTS.OUTBOUND_DOCUMENT_ATTACHMENTS;
    case "REVERSAL":
      return API_ENDPOINTS.REVERSAL_DOCUMENT_ATTACHMENTS;
  }
}

function normalizeAttachment(row: RawRecord): DocumentAttachment {
  return {
    id: text(row.id),
    document_type: text(row.document_type) as DocumentAttachmentType,
    document_id: text(row.document_id),
    attachment_type:
      (text(row.attachment_type, "OTHER") as AttachmentKind) || "OTHER",
    file_name: text(row.file_name, "-"),
    content_type: text(row.content_type),
    file_size_bytes: numberOrZero(row.file_size_bytes),
    checksum: text(row.checksum) || undefined,
    note: text(row.note) || undefined,
    status:
      (text(row.status, "ACTIVE") as DocumentAttachment["status"]) || "ACTIVE",
    uploaded_at: text(row.uploaded_at) || undefined,
    uploaded_by: text(row.uploaded_by) || undefined,
  };
}

export async function fetchDocumentAttachments(
  documentType: DocumentAttachmentType,
  documentId: string,
): Promise<DocumentAttachmentList> {
  const id = requireNonEmptyString(documentId, "documentId");
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    endpointFor(documentType).replace(":id", id),
    { params: { per_page: 100 } },
  );
  return {
    attachments: rowsOf(
      result.data as RawRecord[] | { data?: RawRecord[] },
    ).map(normalizeAttachment),
    evidenceStatus:
      (result.meta?.evidence_status as EvidenceStatus | undefined) ??
      "NOT_REQUIRED",
    requiresEvidence: Boolean(result.meta?.requires_evidence),
  };
}

export async function uploadDocumentAttachment(input: {
  documentType: DocumentAttachmentType;
  documentId: string;
  file: File;
  attachmentType?: AttachmentKind;
  note?: string;
}): Promise<DocumentAttachment> {
  const id = requireNonEmptyString(input.documentId, "documentId");
  const formData = new FormData();
  formData.append("file", input.file);
  if (input.attachmentType) {
    formData.append("attachment_type", input.attachmentType);
  }
  if (input.note) {
    formData.append("note", input.note);
  }
  const row = await http.post<RawRecord>(
    endpointFor(input.documentType).replace(":id", id),
    formData,
  );
  return normalizeAttachment(row);
}

export async function downloadDocumentAttachment(input: {
  attachmentId: string;
  fileName?: string;
}): Promise<void> {
  const attachmentId = requireNonEmptyString(
    input.attachmentId,
    "attachmentId",
  );
  const blob = await http.downloadBlob(
    API_ENDPOINTS.DOCUMENT_ATTACHMENT_DOWNLOAD.replace(":id", attachmentId),
  );
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = input.fileName || `chung-tu-${attachmentId}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function deleteDocumentAttachment(
  attachmentId: string,
): Promise<void> {
  await http.delete(
    API_ENDPOINTS.DOCUMENT_ATTACHMENT.replace(
      ":id",
      requireNonEmptyString(attachmentId, "attachmentId"),
    ),
  );
}

export async function fetchPendingEvidence(): Promise<PendingEvidenceItem[]> {
  const result = await http.getPage<RawRecord[] | { data?: RawRecord[] }>(
    API_ENDPOINTS.DOCUMENT_ATTACHMENT_PENDING_EVIDENCE,
    { params: { per_page: 100 } },
  );
  return rowsOf(result.data as RawRecord[] | { data?: RawRecord[] }).map(
    (row) => ({
      document_type: text(row.document_type) as DocumentAttachmentType,
      document_id: text(row.document_id),
      document_no: text(row.document_no),
      warehouse_id: text(row.warehouse_id) || null,
      status: text(row.status),
      missing_reason: text(row.missing_reason),
      created_at: text(row.created_at),
    }),
  );
}
