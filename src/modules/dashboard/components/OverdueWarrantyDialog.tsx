import { Box, UiButton, UiDialog, SEMANTIC_LIGHT as S } from "@/shared/ui";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import { businessLabel } from "@/shared/constants/business-labels";
import { WARRANTY_STATUS_LABELS } from "@/modules/warranty/constants";
import { formatDate } from "@/shared/utils/format-date";
import { useT } from "@/shared/i18n/useT";
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
  const t = useT();
  return (
    <UiDialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      title={t("dashboard.overdueDialog.title")}
      actions={
        <UiButton appearance="outlined" onClick={onClose}>
          {t("common.close")}
        </UiButton>
      }
    >
      <Box sx={{ ...CAPTION_SX, mb: 1.5 }}>
        {t("dashboard.overdueDialog.introPrefix")}{" "}
        <Box component="span" sx={{ fontWeight: 700, color: S.errorText }}>
          {formatNumber(total)}
        </Box>{" "}
        {t("dashboard.overdueDialog.introSuffixCase")}
        {total > cases.length
          ? t("dashboard.overdueDialog.introTruncated", {
              count: cases.length,
            })
          : "."}
      </Box>
      <ResponsiveDataTable
        rows={cases}
        rowKey={(row) => row.warranty_case_code}
        emptyText={t("dashboard.overdueDialog.empty")}
        columns={[
          {
            key: "code",
            header: t("dashboard.overdueDialog.columnCode"),
            render: (row) => row.warranty_case_code,
          },
          {
            key: "customer",
            header: t("dashboard.overdueDialog.columnCustomer"),
            render: (row) => row.customer_name ?? EMPTY_TEXT,
          },
          {
            key: "status",
            header: t("dashboard.overdueDialog.columnStatus"),
            render: (row) => businessLabel(WARRANTY_STATUS_LABELS, row.status),
          },
          {
            key: "due",
            header: t("dashboard.overdueDialog.columnDue"),
            render: (row) => formatDate(row.estimated_completion_date),
          },
          {
            key: "overdue",
            header: t("dashboard.overdueDialog.columnOverdue"),
            align: "right",
            render: (row) => (
              <Box
                component="span"
                sx={{ color: S.errorText, fontWeight: 700 }}
              >
                {t("dashboard.overdueDialog.daysOverdue", {
                  days: row.days_overdue,
                })}
              </Box>
            ),
          },
        ]}
      />
    </UiDialog>
  );
}
