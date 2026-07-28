import { http } from '@/shared/api/http';
import type { InboundDocument, InboundLine } from '../types';
import { API_ENDPOINTS } from '@/shared/api/endpoints';

export async function fetchInboundDocuments(): Promise<InboundDocument[]> {
  return http.get<InboundDocument[]>(API_ENDPOINTS.INBOUND_DOCUMENTS);
}

export async function fetchInboundLines(documentId: string): Promise<InboundLine[]> {
  return http.get<InboundLine[]>(`${API_ENDPOINTS.INBOUND_LINES.replace(':id', documentId)}`);
}

export async function fetchInboundDocument(id: string): Promise<InboundDocument> {
  return http.get<InboundDocument>(`${API_ENDPOINTS.INBOUND_DOCUMENT.replace(':id', id)}`);
}
