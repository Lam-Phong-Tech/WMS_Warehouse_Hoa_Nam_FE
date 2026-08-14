import { useQuery } from "@tanstack/react-query";
import {
  fetchInventoryBalanceReport,
  fetchXntEnhancedReport,
  fetchDocumentHistoryReport,
  fetchImportMatchReport,
  fetchLabelLogReport,
  fetchOutboundByAgencyReport,
  fetchXntReport,
  fetchWarrantyDefectsReport,
  type InventoryBalanceParams,
  type XntEnhancedParams,
  type DocumentHistoryParams,
  type ImportMatchParams,
  type LabelLogParams,
  type OutboundByAgencyParams,
  type XntReportParams,
  type WarrantyReportParams,
} from "../services/reportsService";

export const reportKeys = {
  all: ["reports"] as const,
  inventoryBalance: (params: InventoryBalanceParams) =>
    [...reportKeys.all, "inventory-balance", params] as const,
  xntEnhanced: (params: XntEnhancedParams) =>
    [...reportKeys.all, "xnt-enhanced", params] as const,
  xnt: (params: XntReportParams) =>
    [...reportKeys.all, "xnt", params] as const,
  documentHistory: (params: DocumentHistoryParams) =>
    [...reportKeys.all, "document-history", params] as const,
  importMatch: (params: ImportMatchParams) =>
    [...reportKeys.all, "import-match", params] as const,
  labelLog: (params: LabelLogParams) =>
    [...reportKeys.all, "label-log", params] as const,
  outboundByAgency: (params: OutboundByAgencyParams) =>
    [...reportKeys.all, "outbound-by-agency", params] as const,
  warranty: (params: WarrantyReportParams) =>
    [...reportKeys.all, "warranty", params] as const,
};

export function useInventoryBalanceReport(
  params: InventoryBalanceParams,
  enabled = true,
) {
  return useQuery({
    queryKey: reportKeys.inventoryBalance(params),
    queryFn: () => fetchInventoryBalanceReport(params),
    enabled,
  });
}

export function useXntEnhancedReport(
  params: XntEnhancedParams,
  enabled = true,
) {
  return useQuery({
    queryKey: reportKeys.xntEnhanced(params),
    queryFn: () => fetchXntEnhancedReport(params),
    enabled,
  });
}

export function useXntReport(params: XntReportParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.xnt(params),
    queryFn: () => fetchXntReport(params),
    enabled,
  });
}

export function useDocumentHistoryReport(
  params: DocumentHistoryParams,
  enabled = true,
) {
  return useQuery({
    queryKey: reportKeys.documentHistory(params),
    queryFn: () => fetchDocumentHistoryReport(params),
    enabled,
  });
}

export function useImportMatchReport(
  params: ImportMatchParams,
  enabled = true,
) {
  return useQuery({
    queryKey: reportKeys.importMatch(params),
    queryFn: () => fetchImportMatchReport(params),
    enabled,
  });
}

export function useLabelLogReport(params: LabelLogParams, enabled = true) {
  return useQuery({
    queryKey: reportKeys.labelLog(params),
    queryFn: () => fetchLabelLogReport(params),
    enabled,
  });
}

export function useOutboundByAgencyReport(
  params: OutboundByAgencyParams,
  enabled = true,
) {
  return useQuery({
    queryKey: reportKeys.outboundByAgency(params),
    queryFn: () => fetchOutboundByAgencyReport(params),
    enabled,
  });
}

export function useWarrantyReport(
  params: WarrantyReportParams,
  enabled = true,
) {
  return useQuery({
    queryKey: reportKeys.warranty(params),
    queryFn: () => fetchWarrantyDefectsReport(params),
    enabled,
  });
}
