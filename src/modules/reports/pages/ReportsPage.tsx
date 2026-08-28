import { useState } from "react";
import { Box, UiTabs } from "@/shared/ui";
import { ApartmentOutlined, BarChartOutlined } from "@/shared/components/icons";
import AlignedReportsPage from "@/modules/reports/pages/AlignedReportsPage";
import Gd1ScopeReports from "@/modules/reports/pages/Gd1ScopeReports";

/** Nhãn tab kèm icon — UiTabs nhận label ReactNode (icon shim aria-hidden). */
function TabLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
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

export default function ReportsPage() {
  const [tab, setTab] = useState<"gd1" | "operations">("gd1");

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <UiTabs
          value={tab}
          onChange={(key) => setTab(key as "gd1" | "operations")}
          aria-label="Nhóm báo cáo"
          items={[
            {
              key: "gd1",
              label: (
                <TabLabel
                  icon={<ApartmentOutlined style={{ fontSize: 15 }} />}
                  text="Báo cáo theo từng thị trường"
                />
              ),
            },
            {
              key: "operations",
              label: (
                <TabLabel
                  icon={<BarChartOutlined style={{ fontSize: 15 }} />}
                  text="Báo cáo vận hành"
                />
              ),
            },
          ]}
        />
      </Box>

      {tab === "gd1" ? <Gd1ScopeReports /> : <AlignedReportsPage />}
    </>
  );
}
