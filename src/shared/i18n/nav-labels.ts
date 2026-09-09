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
  "MST-PV-01": "PV App products",
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
  "RPT-01": "Inbound report",
  "RPT-01B": "Outbound report",
  "RPT-02": "Inventory & reconciliation",
  "RPT-03": "Goods traceability",
  "RPT-04": "Data entry / matching & errors",
  "RPT-05": "Packing labels – print / reprint",
  "RPT-06": "Warranty & components",
  "RPT-07": "Issues by recipient / agency",
  "RPT-08": "Inbound – outbound history",
  "IAM-01": "Users & permissions",
  "PV-ADM-01": "Partition app (PV)",
  "WH-01": "Warehouse settings",
  "AUDIT-01": "System audit log",
};

/**
 * Nhãn EN cho các chặng breadcrumb KHÔNG có khoá ổn định (route ngoài cây menu
 * lấy label từ `ROUTE_META[...].title`) — tra theo đúng chuỗi VI. Sửa title VI
 * trong nav-data thì phải cập nhật khoá ở đây, nhưng nhóm route này rất nhỏ và
 * ổn định (profile / notifications / roles / khay).
 */
const NAV_FALLBACK_TITLES_EN: Record<string, string> = {
  "Vai trò & phân quyền": "Roles & permissions",
  "Hồ sơ cá nhân": "My profile",
  "Tổng quan tình trạng khay": "Tray status overview",
  "Thông báo": "Notifications",
  "Không có quyền truy cập": "No access",
};

/** Dịch một nhãn điều hướng. `key` rỗng (chặng ngoài cây menu) thì tra theo chuỗi. */
export function navLabel(
  language: string,
  key: string | undefined,
  fallback: string,
): string {
  if (language !== "en") return fallback;
  if (!key) return NAV_FALLBACK_TITLES_EN[fallback] ?? fallback;
  return NAV_LABELS_EN[key] ?? NAV_FALLBACK_TITLES_EN[fallback] ?? fallback;
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

// ── Tiêu đề + mô tả trang (SCREEN_META / ROUTE_META) ─────────────────────────

export interface ScreenMetaText {
  title: string;
  description: string;
}

/**
 * Bản EN cho header trang, khoá theo screen-id — cùng lối NAV_LABELS_EN: sửa
 * chữ VI trong nav-data không làm rơi bản dịch.
 */
export const SCREEN_META_EN: Record<string, ScreenMetaText> = {
  "MAP-01": {
    title: "Operations overview",
    description:
      "Overview of this interface's scope; the partition app is not included.",
  },
  "IAM-01": {
    title: "Users & permissions",
    description: "Users, roles, data scopes and account status.",
  },
  "MST-01": {
    title: "SKU list",
    description: "SKU list and product data editing.",
  },
  "MST-CAT-01": {
    title: "Product catalog",
    description:
      "Brands, product groups, models, power sources and packaging specs used when creating SKUs.",
  },
  "MST-PV-01": {
    title: "PV App products",
    description:
      "Products currently shown on the PV App with their images; add products, edit display info and toggle visibility.",
  },
  "WH-01": {
    title: "Warehouse settings",
    description:
      "Details, contacts and status of the single central warehouse.",
  },
  "AGY-01": {
    title: "Agencies / recipients",
    description: "Catalog of agencies / goods recipients.",
  },
  "DEF-01": {
    title: "Defect catalog",
    description: "Catalog of defects used for warranty.",
  },
  "IN-01": {
    title: "Inbound documents",
    description: "List of inbound documents.",
  },
  "PTW-00": {
    title: "Components awaiting putaway",
    description: "Components awaiting putaway — pick a box to process.",
  },
  "OUT-01": {
    title: "Outbound documents",
    description: "List of outbound documents.",
  },
  "WAR-01": {
    title: "Warranty cases",
    description: "List of warranty cases.",
  },
  "WAR-04": {
    title: "Component issue documents",
    description: "All component issue documents across warranty cases.",
  },
  "INV-01": {
    title: "Stock lookup & reconciliation",
    description: "Stock lookup and reconciliation.",
  },
  "TRACE-01": {
    title: "Physical code trace",
    description: "Trace items by physical code.",
  },
  "REV-00": {
    title: "Stock adjustment documents",
    description: "Pick a document to create a stock adjustment.",
  },
  "RPT-01": {
    title: "Inbound report",
    description:
      "Posted inbound quantities by day and by SKU, plus inbound documents.",
  },
  "RPT-01B": {
    title: "Outbound report",
    description:
      "Posted outbound quantities by day and by SKU, plus outbound documents.",
  },
  "RPT-02": {
    title: "Inventory & reconciliation",
    description: "Current stock composition and reconciliation rate by period.",
  },
  "RPT-03": {
    title: "Goods traceability",
    description: "Trace product lifecycles by physical code or SKU.",
  },
  "RPT-04": {
    title: "Data entry / matching & errors",
    description:
      "Import/Scan results over time and the most common error codes.",
  },
  "RPT-05": {
    title: "Packing labels – Print / Reprint",
    description:
      "Label print results over time and the printers failing most often.",
  },
  "RPT-06": {
    title: "Warranty & components",
    description: "Warranty status, trends and defects by SKU.",
  },
  "RPT-07": {
    title: "Issues by recipient / agency",
    description: "Issued goods broken down by recipient and recipient type.",
  },
  "RPT-08": {
    title: "Inbound – outbound history",
    description:
      "History of posted receipt / issue / reversal documents by posted_at.",
  },
  "AUDIT-01": {
    title: "System audit log",
    description: "Track the history of actions and changes in the system.",
  },
  "PV-ADM-01": {
    title: "Partition app (PV)",
    description:
      "Publish SKUs, assign industries and set suggestion priority for the PV app.",
  },
};

/**
 * Bản EN cho các route ngoài cây menu (`ROUTE_META`), khoá theo TIÊU ĐỀ VI —
 * dùng chung bảng với breadcrumb để hai chỗ không lệch nhau.
 */
const ROUTE_META_EN_BY_TITLE: Record<string, ScreenMetaText> = {
  "Vai trò & phân quyền": {
    title: "Roles & permissions",
    description:
      "Manage role templates and usage permissions per the current authorization rules.",
  },
  "Hồ sơ cá nhân": {
    title: "My profile",
    description: "Account details and the current access context.",
  },
  "Tổng quan tình trạng khay": {
    title: "Tray status overview",
    description:
      "Quick view of empty / occupied / attention-needed trays; no putaway actions here.",
  },
  "Thông báo": {
    title: "Notifications",
    description: "System notifications for this account.",
  },
  "Foundation catalog": {
    title: "Foundation catalog",
    description: "Design-system golden catalog (DEV).",
  },
  "Không có quyền truy cập": {
    title: "No access",
    description:
      "This account has not been granted access to the screen you just opened.",
  },
};

/**
 * Dịch meta trang theo ngôn ngữ. Nhận `screenId` khi caller biết (?screen= /
 * DEFAULT_SCREEN_BY_PATH); không có id thì tra theo tiêu đề VI (route ngoài
 * menu). Không khớp gì → trả nguyên bản VI (fail-safe cùng lối navLabel).
 */
export function localizeScreenMeta(
  language: string,
  meta: ScreenMetaText,
  screenId?: string | null,
): ScreenMetaText {
  if (language !== "en") return meta;
  if (screenId && SCREEN_META_EN[screenId]) return SCREEN_META_EN[screenId];
  return ROUTE_META_EN_BY_TITLE[meta.title] ?? meta;
}
