import {
  Box,
  Stack,
  UiButton,
  SEMANTIC_LIGHT as S,
  TYPOGRAPHY,
} from "@/shared/ui";
import { DonutChart } from "@/shared/components/charts/DonutChart";
import { WarningOutlined } from "@/shared/components/icons";
import { businessLabel } from "@/shared/constants/business-labels";
import { WARRANTY_STATUS_LABELS } from "@/modules/warranty/constants";
import type { DashboardOverview } from "../types";
import { ChartCard } from "./dashboard-ui";
import { formatNumber } from "./dashboard-styles";

/** Thứ tự vòng đời ca bảo hành — donut đọc theo chiều xử lý, không theo alphabet. */
const STATUS_ORDER = [
  "RECEIVED",
  "CHECKING",
  "REPAIRING",
  "COMPLETED",
  "RETURNED_TO_CUSTOMER",
  "RETURNED",
  "CANCELLED",
];

export function DashboardWarrantyStatus({
  data,
  loading,
  onShowOverdue,
}: {
  data: DashboardOverview;
  loading: boolean;
  onShowOverdue: () => void;
}) {
  const entries = Object.entries(data.warranty.by_status)
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => {
      const indexA = STATUS_ORDER.indexOf(a);
      const indexB = STATUS_ORDER.indexOf(b);
      return (
        (indexA === -1 ? STATUS_ORDER.length : indexA) -
        (indexB === -1 ? STATUS_ORDER.length : indexB)
      );
    });

  const overdue = data.warranty.overdue_count;

  return (
    <ChartCard
      title="Tình trạng bảo hành"
      description="Số ca theo từng trạng thái tính đến thời điểm hiện tại."
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
      ) : entries.length === 0 ? (
        <Box
          sx={{
            py: 5,
            textAlign: "center",
            fontSize: TYPOGRAPHY.fontSizeSecondary,
            color: S.textMedium,
          }}
        >
          Chưa có ca bảo hành.
        </Box>
      ) : (
        <Box
          role="img"
          aria-label={`Biểu đồ tình trạng bảo hành: ${entries
            .map(
              ([status, count]) =>
                `${businessLabel(WARRANTY_STATUS_LABELS, status)} ${formatNumber(count)}`,
            )
            .join("; ")}`}
        >
          <DonutChart
            items={entries.map(([status, count]) => ({
              label: businessLabel(WARRANTY_STATUS_LABELS, status),
              value: count,
            }))}
            centerLabel="Tổng ca"
            valueFormatter={formatNumber}
          />
        </Box>
      )}

      {/* Quá hạn tách thành ô riêng chứ không nhập vào donut: nó cắt ngang mọi
          trạng thái (một ca vừa "Đang sửa chữa" vừa quá hạn), nhét vào cùng một
          vòng tròn sẽ đếm trùng và tổng không còn đúng. */}
      <Stack
        direction="row"
        sx={{
          mt: 2,
          p: 1.5,
          borderRadius: 1,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1,
          bgcolor: overdue > 0 ? S.errorSoft : S.bgSubtle,
          border: `1px solid ${overdue > 0 ? S.error : S.border}`,
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          {overdue > 0 ? (
            <Box
              aria-hidden="true"
              sx={{ color: S.errorText, display: "flex" }}
            >
              <WarningOutlined />
            </Box>
          ) : null}
          <Box>
            <Box
              sx={{
                fontSize: TYPOGRAPHY.fontSizeSecondary,
                fontWeight: 700,
                color: overdue > 0 ? S.errorText : S.textHigh,
              }}
            >
              {formatNumber(overdue)} ca quá hạn
            </Box>
            <Box sx={{ fontSize: 12, color: S.textMedium }}>
              Đã qua ngày dự kiến hoàn thành nhưng chưa xử lý xong.
            </Box>
          </Box>
        </Stack>
        <UiButton
          size="small"
          appearance={overdue > 0 ? "filled" : "outlined"}
          disabled={overdue === 0}
          onClick={onShowOverdue}
        >
          Xem chi tiết
        </UiButton>
      </Stack>
    </ChartCard>
  );
}
