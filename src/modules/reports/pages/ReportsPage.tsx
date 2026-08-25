import { Tabs } from "antd";
import AlignedReportsPage from "@/modules/reports/pages/AlignedReportsPage";
import Gd1ScopeReports from "@/modules/reports/pages/Gd1ScopeReports";

export default function ReportsPage() {
  return (
    <Tabs
      defaultActiveKey="gd1"
      items={[
        {
          key: "gd1",
          label: "Phân tích GĐ1",
          children: <Gd1ScopeReports />,
        },
        {
          key: "operations",
          label: "Báo cáo vận hành",
          children: <AlignedReportsPage />,
        },
      ]}
    />
  );
}
