import { useNavigate } from "react-router-dom";
import { Box, SEMANTIC_LIGHT as S, TYPOGRAPHY } from "@/shared/ui";
import { HorizontalBarChart } from "@/shared/components/charts/HorizontalBarChart";
import { CHART_COLORS } from "@/shared/components/charts/chart-theme";
import { ROUTES } from "@/shared/constants/routes";
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
  const { issues } = data;

  // "Import lỗi" chứ không phải "Import/Scan lỗi": scan_record_events chỉ ghi kết
  // quả thành công (quét lỗi ném exception, không lưu dòng nào) nên hệ thống không
  // có số "scan lỗi" để đếm. Đặt tên đúng thứ đang đếm thay vì hứa một con số
  // không tồn tại.
  const items = [
    {
      label: "Đối soát tồn lệch",
      value: issues.inventory_mismatch,
      open: () => navigate(ROUTES.INVENTORY),
    },
    {
      label: "Bảo hành quá hạn",
      value: issues.warranty_overdue,
      open: onShowOverdue,
    },
    {
      label: "Import lỗi",
      value: issues.import_error,
      open: () => navigate(ROUTES.MASTER_DATA),
    },
    {
      label: "In nhãn lỗi",
      value: issues.print_failed,
      open: () => navigate(ROUTES.REPORTS),
    },
  ];

  const active = items.filter((item) => item.value > 0);

  return (
    <ChartCard
      fullWidth
      title="Vấn đề cần xử lý"
      description="Số lượng tồn đọng tính đến thời điểm hiện tại. Nhấn vào một thanh để xem chi tiết."
      footer={
        <Box sx={{ ...CAPTION_SX, mt: 1.5 }}>
          Số lần quét lỗi không được hệ thống ghi lại nên không nằm trong danh
          sách này.
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
          Đang tải số liệu…
        </Box>
      ) : active.length > 0 ? (
        <Box
          sx={{ cursor: "pointer" }}
          role="img"
          aria-label={`Biểu đồ vấn đề cần xử lý: ${active
            .map((item) => `${item.label} ${formatNumber(item.value)}`)
            .join("; ")}`}
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
          Không có vấn đề nào cần xử lý.
        </Box>
      )}
    </ChartCard>
  );
}
