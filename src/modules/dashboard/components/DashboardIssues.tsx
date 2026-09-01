import { useNavigate } from "react-router-dom";
import { Box, SEMANTIC_LIGHT as S, TYPOGRAPHY } from "@/shared/ui";
import { HorizontalBarChart } from "@/shared/components/charts/HorizontalBarChart";
import { CHART_COLORS } from "@/shared/components/charts/chart-theme";
import { ROUTES } from "@/shared/constants/routes";
import { useT } from "@/shared/i18n/useT";
import type { DashboardOverview } from "../types";
import { ChartCard } from "./dashboard-ui";
import { CAPTION_SX, formatNumber } from "./dashboard-styles";

export function DashboardIssues({
  data,
  loading,
  onShowOverdue,
}: {
  data: DashboardOverview;
  loading: boolean;
  onShowOverdue: () => void;
}) {
  const navigate = useNavigate();
  const t = useT();
  const { issues } = data;

  // "Import lỗi" chứ không phải "Import/Scan lỗi": scan_record_events chỉ ghi kết
  // quả thành công (quét lỗi ném exception, không lưu dòng nào) nên hệ thống không
  // có số "scan lỗi" để đếm. Đặt tên đúng thứ đang đếm thay vì hứa một con số
  // không tồn tại.
  const items = [
    {
      label: t("dashboard.issues.inventoryMismatch"),
      value: issues.inventory_mismatch,
      open: () => navigate(ROUTES.INVENTORY),
    },
    {
      label: t("dashboard.issues.warrantyOverdue"),
      value: issues.warranty_overdue,
      open: onShowOverdue,
    },
    {
      label: t("dashboard.issues.importError"),
      value: issues.import_error,
      open: () => navigate(ROUTES.MASTER_DATA),
    },
    {
      label: t("dashboard.issues.printFailed"),
      value: issues.print_failed,
      open: () => navigate(ROUTES.REPORTS_PACKING_LABEL),
    },
    {
      label: t("dashboard.issues.skuPendingInfo"),
      value: issues.sku_pending_info,
      open: () => navigate(`${ROUTES.MASTER_DATA}?filter=pending_info`),
    },
  ];

  const active = items.filter((item) => item.value > 0);

  return (
    <ChartCard
      fullWidth
      title={t("dashboard.issues.title")}
      description={t("dashboard.issues.description")}
      footer={
        <Box sx={{ ...CAPTION_SX, mt: 1.5 }}>
          {t("dashboard.issues.footer")}
        </Box>
      }
    >
      {loading ? (
        <Box
          sx={{
            py: 5,
            textAlign: "center",
            fontSize: TYPOGRAPHY.fontSizeSecondary,
            color: S.textMedium,
          }}
        >
          {t("common.loadingData")}
        </Box>
      ) : active.length > 0 ? (
        <Box
          sx={{ cursor: "pointer" }}
          role="img"
          aria-label={t("dashboard.issues.ariaLabel", {
            summary: active
              .map((item) => `${item.label} ${formatNumber(item.value)}`)
              .join("; "),
          })}
        >
          <HorizontalBarChart
            items={active.map((item) => ({
              label: item.label,
              value: item.value,
            }))}
            color={CHART_COLORS.danger}
            valueFormatter={formatNumber}
            onSelect={(selected) => {
              active.find((item) => item.label === selected.label)?.open();
            }}
          />
        </Box>
      ) : (
        <Box
          sx={{
            py: 5,
            textAlign: "center",
            fontSize: TYPOGRAPHY.fontSizeSecondary,
            color: S.successText,
            fontWeight: 700,
          }}
        >
          {t("dashboard.issues.empty")}
        </Box>
      )}
    </ChartCard>
  );
}
