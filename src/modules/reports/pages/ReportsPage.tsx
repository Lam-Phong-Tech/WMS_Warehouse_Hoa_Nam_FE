import { useState } from "react";
import { Tab, Tabs } from "@mui/material";
import { ApartmentOutlined, BarChartOutlined } from "@/shared/components/icons";
import AlignedReportsPage from "@/modules/reports/pages/AlignedReportsPage";
import Gd1ScopeReports from "@/modules/reports/pages/Gd1ScopeReports";

export default function ReportsPage() {
  const [tab, setTab] = useState<"gd1" | "operations">("gd1");

  return (
    <>
      <Tabs
        value={tab}
        onChange={(_event, value: "gd1" | "operations") => setTab(value)}
        sx={{ marginBottom: 2 }}
      >
        <Tab
          value="gd1"
          icon={<ApartmentOutlined style={{ fontSize: 15 }} />}
          iconPosition="start"
          label="Báo cáo theo từng thị trường"
          sx={{ minHeight: 40, textTransform: "none" }}
        />
        <Tab
          value="operations"
          icon={<BarChartOutlined style={{ fontSize: 15 }} />}
          iconPosition="start"
          label="Báo cáo vận hành"
          sx={{ minHeight: 40, textTransform: "none" }}
        />
      </Tabs>

      {tab === "gd1" ? <Gd1ScopeReports /> : <AlignedReportsPage />}
    </>
  );
}
