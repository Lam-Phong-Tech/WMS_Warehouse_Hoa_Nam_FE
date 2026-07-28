import { http } from '@/shared/api/http';
import type { OutboundDocument, OutboundLine } from '../types';
import { API_ENDPOINTS } from '@/shared/api/endpoints';

export async function fetchOutboundDocuments(): Promise<OutboundDocument[]> {
  return http.get<OutboundDocument[]>(API_ENDPOINTS.OUTBOUND_DOCUMENTS);
}

export async function fetchOutboundLines(documentId: string): Promise<OutboundLine[]> {
  return http.get<OutboundLine[]>(`${API_ENDPOINTS.OUTBOUND_LINES.replace(':id', documentId)}`);
}
