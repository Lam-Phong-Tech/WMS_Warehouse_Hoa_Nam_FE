import { http } from "@/shared/api/http";
import type { ReportItem, XntReportRow } from "../types";
import { API_ENDPOINTS } from "@/shared/api/endpoints";

export async function fetchReports(): Promise<ReportItem[]> {
  return http.get<ReportItem[]>(API_ENDPOINTS.REPORTS);
}

export async function fetchXntReport(): Promise<XntReportRow[]> {
  return http.get<XntReportRow[]>(API_ENDPOINTS.REPORTS_XNT);
}
