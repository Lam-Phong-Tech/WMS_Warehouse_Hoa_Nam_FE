import { Box, UiButton, UiDialog, SEMANTIC_LIGHT as S } from "@/shared/ui";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import { businessLabel } from "@/shared/constants/business-labels";
import { WARRANTY_STATUS_LABELS } from "@/modules/warranty/constants";
import { formatDate } from "@/shared/utils/format-date";
import type { DashboardOverdueCase } from "../types";
import { CAPTION_SX, formatNumber } from "./dashboard-styles";
import { EMPTY_TEXT } from "@/shared/constants/display";

export function OverdueWarrantyDialog({
  open,
  onClose,
  cases,
  total,
}: {
  open: boolean;
  onClose: () => void;
  cases: DashboardOverdueCase[];
  /** Tổng THẬT từ BE — `cases` có trần 50 nên length của nó không phải tổng. */
  total: number;
}) {
  return (
    <UiDialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      title="Ca bảo hành quá hạn"
      actions={
        <UiButton appearance="outlined" onClick={onClose}>
          Đóng
        </UiButton>
      }
    >
      <Box sx={{ ...CAPTION_SX, mb: 1.5 }}>
        Ca có ngày dự kiến hoàn thành đã qua nhưng chưa kết thúc xử lý. Tổng{" "}
        <Box component="span" sx={{ fontWeight: 700, color: S.errorText }}>
          {formatNumber(total)}
        </Box>{" "}
        ca
        {total > cases.length
          ? ` — đang hiển thị ${cases.length} ca cũ hạn nhất.`
          : "."}
      </Box>
      <ResponsiveDataTable
        rows={cases}
        rowKey={(row) => row.warranty_case_code}
        emptyText="Không có ca bảo hành nào quá hạn."
        columns={[
          {
            key: "code",
            header: "Mã ca",
            render: (row) => row.warranty_case_code,
          },
          {
            key: "customer",
            header: "Khách hàng",
            render: (row) => row.customer_name ?? EMPTY_TEXT,
          },
          {
            key: "status",
            header: "Trạng thái",
            render: (row) => businessLabel(WARRANTY_STATUS_LABELS, row.status),
          },
          {
            key: "due",
            header: "Hạn dự kiến",
            render: (row) => formatDate(row.estimated_completion_date),
          },
          {
            key: "overdue",
            header: "Quá hạn",
            align: "right",
            render: (row) => (
              <Box
                component="span"
                sx={{ color: S.errorText, fontWeight: 700 }}
              >
                {row.days_overdue} ngày
              </Box>
            ),
          },
        ]}
      />
    </UiDialog>
  );
}
