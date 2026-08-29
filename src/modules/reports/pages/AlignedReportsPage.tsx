import { useState, type ReactElement } from "react";
import { Box, UiTabs, UiTabPanel } from "@/shared/ui";
import {
  AuditOutlined,
  ExportOutlined,
  PaperClipOutlined,
  NodeIndexOutlined,
  SafetyCertificateOutlined,
  StockOutlined,
  SwapOutlined,
  TagOutlined,
} from "@/shared/components/icons";
import TabInventoryFlow from "@/modules/reports/operations/TabInventoryFlow";
import TabStockReconcile from "@/modules/reports/operations/TabStockReconcile";
import TabTraceability from "@/modules/reports/operations/TabTraceability";
import TabImportQuality from "@/modules/reports/operations/TabImportQuality";
import TabPackingLabel from "@/modules/reports/operations/TabPackingLabel";
import TabWarranty from "@/modules/reports/operations/TabWarranty";
import TabRecipient from "@/modules/reports/operations/TabRecipient";
import TabPendingEvidence from "@/modules/reports/operations/TabPendingEvidence";

/**
 * Trang "Báo cáo vận hành" — 7 nhóm báo cáo theo hợp đồng nghiệp vụ mục B.
 *
 * Mỗi tab là một CÂU HỎI VẬN HÀNH trọn vẹn (biểu đồ tổng quan + bảng tra cứu +
 * drill-down xuống chứng từ/Movement), không phải một bảng dữ liệu rời như bản
 * 9 tab trước đó. Vì vậy mỗi tab tự quản lý bộ lọc và truy vấn của mình: bộ lọc
 * của tab Tồn kho (ảnh chụp hiện tại) và tab Nhập-Xuất-Tồn (theo kỳ) không cùng
 * ngữ nghĩa, gom vào một state chung sẽ tạo ra những tổ hợp bộ lọc vô nghĩa.
 *
 * Tab chỉ được MOUNT khi đang mở — mỗi tab kéo từ 2 đến 5 endpoint báo cáo, nên
 * render sẵn cả 7 tab sẽ bắn vài chục request ngay lúc vào trang.
 */

type OperationsTabKey =
  | "inventory-flow"
  | "stock-reconcile"
  | "traceability"
  | "import-quality"
  | "packing-label"
  | "warranty"
  | "recipient"
  | "pending-evidence";

const TAB_ICON_SIZE = 15;

const OPERATIONS_TABS: Array<{
  key: OperationsTabKey;
  label: string;
  icon: ReactElement;
}> = [
  {
    key: "inventory-flow",
    label: "Nhập – Xuất – Tồn & Chứng từ",
    icon: <SwapOutlined style={{ fontSize: TAB_ICON_SIZE }} />,
  },
  {
    key: "stock-reconcile",
    label: "Tồn kho & đối soát",
    icon: <StockOutlined style={{ fontSize: TAB_ICON_SIZE }} />,
  },
  {
    key: "traceability",
    label: "Truy vết hàng hóa",
    icon: <NodeIndexOutlined style={{ fontSize: TAB_ICON_SIZE }} />,
  },
  {
    key: "import-quality",
    label: "Import / Match & lỗi dữ liệu",
    icon: <AuditOutlined style={{ fontSize: TAB_ICON_SIZE }} />,
  },
  {
    key: "packing-label",
    label: "Packing Label – Print / Reprint",
    icon: <TagOutlined style={{ fontSize: TAB_ICON_SIZE }} />,
  },
  {
    key: "warranty",
    label: "Bảo hành & linh kiện",
    icon: <SafetyCertificateOutlined style={{ fontSize: TAB_ICON_SIZE }} />,
  },
  {
    key: "recipient",
    label: "Xuất theo người nhận / đại lý",
    icon: <ExportOutlined style={{ fontSize: TAB_ICON_SIZE }} />,
  },
  {
    key: "pending-evidence",
    label: "Chứng từ cần bổ sung",
    icon: <PaperClipOutlined style={{ fontSize: TAB_ICON_SIZE }} />,
  },
];

/** Nhãn tab kèm icon (UiTabs nhận label ReactNode; icon shim aria-hidden). */
function ReportTabLabel({ icon, text }: { icon: ReactElement; text: string }) {
  return (
    <Box
      component="span"
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}
    >
      {icon}
      {text}
    </Box>
  );
}

function renderTab(key: OperationsTabKey) {
  switch (key) {
    case "inventory-flow":
      return <TabInventoryFlow />;
    case "stock-reconcile":
      return <TabStockReconcile />;
    case "traceability":
      return <TabTraceability />;
    case "import-quality":
      return <TabImportQuality />;
    case "packing-label":
      return <TabPackingLabel />;
    case "warranty":
      return <TabWarranty />;
    case "recipient":
      return <TabRecipient />;
    case "pending-evidence":
      return <TabPendingEvidence />;
  }
}

export default function AlignedReportsPage() {
  const [tab, setTab] = useState<OperationsTabKey>("inventory-flow");

  return (
    <div
      className="hn-mvp-source-screen"
      data-mvp-screen="RPT-01"
      data-testid="wwhn-258-report-screen"
    >
      <Box sx={{ mb: 2 }}>
        <UiTabs
          value={tab}
          aria-label="Nhóm báo cáo vận hành"
          items={OPERATIONS_TABS.map((item) => ({
            key: item.key,
            label: <ReportTabLabel icon={item.icon} text={item.label} />,
          }))}
          onChange={(key) => setTab(key as OperationsTabKey)}
        />
      </Box>

      <UiTabPanel value={tab}>{renderTab(tab)}</UiTabPanel>
    </div>
  );
}
