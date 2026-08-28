/**
 * Foundation Tab panel — khối nội dung của một tab, hiện lên mềm thay vì
 * "chớp" một cái khi người dùng đổi tab.
 *
 * VÌ SAO CẦN COMPONENT RIÊNG
 * `UiTabs` chỉ render thanh tab; phần nội dung do từng màn tự dựng nên không
 * có chỗ nào gắn hiệu ứng dùng chung được. Bản antd cũ có sẵn fade cho
 * `.ant-tabs-tabpane-active` (xem hn-motion.css §3) — component này trả lại
 * đúng hành vi đó cho các màn đã chuyển sang MUI.
 *
 * VỀ `key`
 * `key={value}` khiến React tháo khối cũ và dựng khối mới mỗi lần đổi tab, nhờ
 * đó animation chạy lại. Cần thiết cho những màn giữ NGUYÊN cây JSX và chỉ đổi
 * dữ liệu theo tab (vd CatalogMasterScreen): không đổi key thì cùng một node
 * DOM được dùng lại, CSS animation chỉ chạy một lần lúc mount đầu tiên.
 *
 * LƯU Ý KHI ĐẶT VÀO LAYOUT
 * Component chèn thêm MỘT thẻ div. Nếu cha là flex/grid có `gap`, cả khối tab
 * sẽ thành MỘT ô thay vì nhiều ô — khi đó truyền `sx`/`className` để dựng lại
 * đúng layout cũ, hoặc đặt UiTabPanel vào bên trong phần tử cha đó.
 */
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";
import { MOTION } from "@/shared/ui/tokens";

export interface UiTabPanelProps {
  /** Khóa tab đang hiển thị — đổi giá trị thì hiệu ứng chạy lại. */
  value: string;
  children: ReactNode;
  className?: string;
  sx?: SxProps<Theme>;
}

export function UiTabPanel({
  value,
  children,
  className,
  sx,
}: UiTabPanelProps) {
  return (
    <Box
      key={value}
      className={className}
      // CỐ Ý KHÔNG đặt role="tabpanel": UiTabs (MUI Tabs) không phát id cho
      // từng tab nên không có gì để `aria-labelledby` trỏ tới — một tabpanel
      // không gắn được với tab của nó gây nhiễu cho trình đọc màn hình hơn là
      // không có role. Ngoài ra ReportsPage lồng AlignedReportsPage nên sẽ
      // sinh tabpanel lồng tabpanel. Đây thuần là lớp bọc chuyển động; ngữ
      // nghĩa giữ NGUYÊN như trước khi thêm hiệu ứng.
      sx={[
        {
          // Keyframes khai báo toàn cục ở src/styles/hn-motion.css (một nguồn
          // duy nhất, dùng chung với .hn-page-transition khi đổi route).
          animation: `hn-fade-in-up ${MOTION.duration.normal}ms ${MOTION.easing.out} backwards`,
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children}
    </Box>
  );
}
