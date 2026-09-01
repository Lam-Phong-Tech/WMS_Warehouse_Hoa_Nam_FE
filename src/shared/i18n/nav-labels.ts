/**
 * Bản dịch EN cho cây điều hướng và breadcrumb.
 *
 * Nav label sống trong `nav-data.ts` dưới dạng BẢNG DỮ LIỆU (một cây duy nhất
 * cho sidebar + breadcrumb + test RBAC), không phải JSX. Đổi cả bảng đó sang
 * khoá i18n sẽ kéo theo SideNav, UiBreadcrumb và bộ test đang khoá nhãn tiếng
 * Việt. Nên ở đây tra theo CHÍNH nhãn tiếng Việt: nav-data giữ nguyên là nguồn
 * sự thật, EN chỉ là một lớp phủ.
 *
 * Thiếu nhãn nào thì `useNavLabel` trả lại nguyên tiếng Việt — cùng lối
 * fail-safe với `useT`.
 */
import { useCallback } from "react";
import { useLanguageStore } from "./language.store";

export const NAV_LABELS_EN: Readonly<Record<string, string>> = {
  // Nhóm cấp 1
  "Tổng quan": "Overview",
  "Danh mục": "Master data",
  "Nhập kho": "Inbound",
  "Xuất kho": "Outbound",
  "Bảo hành & linh kiện": "Warranty & components",
  "Tồn kho & kiểm soát": "Stock & control",
  "Báo cáo": "Reports",
  "Hệ thống": "System",

  // Trang
  "Trang chủ": "Home",
  "Tổng quan kho": "Warehouse overview",
  "Danh sách SKU": "SKU list",
  "Danh mục sản phẩm": "Product catalogue",
  "Danh mục đại lý / nơi nhận": "Dealer / recipient catalogue",
  "Danh mục bệnh / lỗi": "Symptom / defect catalogue",
  "Danh sách phiếu nhập": "Receipt note list",
  "Danh sách linh kiện chờ xếp khay": "Components awaiting tray",
  "Danh sách phiếu xuất": "Issue note list",
  "Danh sách bảo hành": "Warranty list",
  "Danh sách phiếu xuất linh kiện": "Component issue note list",
  "Tra cứu tồn & đối soát": "Stock lookup & reconciliation",
  "Truy vết mã vật lý": "Physical code trace",
  "Danh sách phiếu điều chỉnh tồn kho": "Stock adjustment note list",
  "Nhập – Xuất – Tồn & Chứng từ": "Receipts – Issues – Stock & documents",
  "Tồn kho & đối soát": "Stock & reconciliation",
  "Truy vết hàng hóa": "Goods trace",
  "Nhập dữ liệu / đối chiếu & lỗi dữ liệu":
    "Data import / reconciliation & data errors",
  "Nhãn đóng gói – Print / Reprint": "Packing label – Print / Reprint",
  "Xuất theo người nhận / đại lý": "Issues by recipient / dealer",
  "Chứng từ cần bổ sung": "Documents to supplement",
  "Danh sách người dùng & phân quyền": "Users & permissions",
  "Nhật ký hệ thống": "System audit log",
  "Cấu hình kho": "Warehouse configuration",
  "Ứng dụng phân vùng (PV)": "Zoning application (PV)",
};

/** Dịch một nhãn điều hướng sang ngôn ngữ đang chọn. */
export function navLabel(language: string, label: string): string {
  return language === "en" ? (NAV_LABELS_EN[label] ?? label) : label;
}

export function useNavLabel(): (label: string) => string {
  const language = useLanguageStore((state) => state.language);
  return useCallback((label: string) => navLabel(language, label), [language]);
}
