/**
 * Bản dịch EN cho cây điều hướng và breadcrumb.
 *
 * Tra theo KHOÁ ỔN ĐỊNH chứ không theo chuỗi tiếng Việt đang hiển thị:
 * screen-id cho từng mục (MAP-01, IN-01…), tên icon cho nhóm cấp 1. Nhờ vậy
 * sửa nhãn tiếng Việt trong `nav-data.ts` không làm rơi bản dịch EN — đó là
 * lý do bảng này KHÔNG khoá theo `label`.
 *
 * `nav-data.ts` là nguồn sự thật của cây menu và mang sẵn `i18nKey`; ở đây chỉ
 * là lớp phủ EN. Thiếu khoá thì trả lại `fallback` (nhãn tiếng Việt gốc) —
 * cùng lối fail-safe với `useT`.
 */
import { useCallback } from "react";
import { useLanguageStore } from "./language.store";

export const NAV_LABELS_EN: Record<string, string> = {
  home: "Home",

  // Nhóm
  "layout-dashboard": "Overview",
  "package-search": "Master data",
  "package-plus": "Inbound",
  "package-minus": "Outbound",
  "briefcase-medical": "Warranty & components",
  warehouse: "Inventory & traceability",
  "chart-column-big": "Reports",
  "settings-2": "System",

  // Mục
  "MAP-01": "Operations overview",
  "MST-01": "SKU list",
  "MST-CAT-01": "Product catalog",
  "AGY-01": "Agencies / recipients",
  "DEF-01": "Defect catalog",
  "IN-01": "Inbound documents",
  "PTW-00": "Components awaiting putaway",
  "OUT-01": "Outbound documents",
  "WAR-01": "Warranty cases",
  "WAR-04": "Component issue documents",
  "INV-01": "Stock lookup & reconciliation",
  "TRACE-01": "Physical code trace",
  "REV-00": "Stock adjustment documents",
  "RPT-01": "Inbound – Outbound – Stock & documents",
  "RPT-02": "Inventory & reconciliation",
  "RPT-03": "Goods traceability",
  "RPT-04": "Data entry / matching & errors",
  "RPT-05": "Packing labels – print / reprint",
  "RPT-06": "Warranty & components",
  "RPT-07": "Issues by recipient / agency",
  "RPT-08": "Documents needing evidence",
  "IAM-01": "Users & permissions",
  "PV-ADM-01": "Partition app (PV)",
  "WH-01": "Warehouse settings",
  "AUDIT-01": "System audit log",
};

/** Dịch một nhãn điều hướng. `key` rỗng (chặng ngoài cây menu) thì giữ nguyên. */
export function navLabel(
  language: string,
  key: string | undefined,
  fallback: string,
): string {
  if (language !== "en" || !key) return fallback;
  return NAV_LABELS_EN[key] ?? fallback;
}

export function useNavLabel(): (
  key: string | undefined,
  fallback: string,
) => string {
  const language = useLanguageStore((state) => state.language);
  return useCallback(
    (key: string | undefined, fallback: string) =>
      navLabel(language, key, fallback),
    [language],
  );
}
