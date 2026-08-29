import { Box, UiStatusBadge } from "@/shared/ui";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import { businessLabel } from "@/shared/constants/business-labels";
import { fmt, fmtDateTime, text, n, type Raw } from "./report-format";
import { MOVEMENT_LABELS, statusTone } from "./report-labels";

/**
 * Bảng movement dùng cho mọi drill-down "số này ở đâu ra": bấm một bậc
 * waterfall, một cột ngày, một SKU lệch đối soát… đều mở đúng bảng này để
 * người đọc không phải học lại bố cục ở từng chỗ.
 */
export function MovementTable({
  rows,
  loading,
  emptyText = "Không có biến động nào khớp lựa chọn này.",
}: {
  rows: Raw[];
  loading?: boolean;
  emptyText?: string;
}) {
  const columns: ResponsiveTableColumn<Raw>[] = [
    {
      key: "occurred_at",
      header: "Thời gian",
      width: 160,
      render: (row) => fmtDateTime(row.occurred_at),
    },
    {
      key: "movement_type",
      header: "Loại biến động",
      width: 150,
      render: (row) => (
        <UiStatusBadge
          size="small"
          tone={row.movement_type === "REVERSAL" ? "error" : "info"}
          label={businessLabel(MOVEMENT_LABELS, text(row.movement_type, ""))}
        />
      ),
    },
    {
      key: "product_code",
      header: "SKU",
      render: (row) => (
        <Box>
          <Box sx={{ fontWeight: 600 }}>{text(row.product_code)}</Box>
          <Box sx={{ fontSize: 12, color: "text.secondary" }}>
            {text(row.product_name, "")}
          </Box>
        </Box>
      ),
    },
    {
      key: "physical_code",
      header: "Mã vật lý",
      hideOnMobile: true,
      render: (row) => text(row.physical_code),
    },
    {
      key: "warehouse_code",
      header: "Kho",
      width: 110,
      hideOnMobile: true,
      render: (row) => text(row.warehouse_code),
    },
    {
      key: "qty_delta",
      header: "SL Δ",
      align: "right",
      width: 110,
      render: (row) => {
        const value = n(row.qty_delta);
        return (
          <Box
            component="span"
            sx={{ fontWeight: 700, whiteSpace: "nowrap" }}
            data-direction={value >= 0 ? "increase" : "decrease"}
          >
            {value >= 0 ? "+" : "−"}
            {fmt(Math.abs(value))}
          </Box>
        );
      },
    },
    {
      key: "actor",
      header: "Người thực hiện",
      hideOnMobile: true,
      render: (row) => text(row.actor),
    },
    {
      key: "source_type",
      header: "Nguồn",
      hideOnMobile: true,
      render: (row) => text(row.source_type),
    },
  ];

  return (
    <ResponsiveDataTable<Raw>
      columns={columns}
      rows={rows}
      rowKey={(row) => text(row.id, String(rows.indexOf(row)))}
      loading={loading}
      emptyText={emptyText}
    />
  );
}

/** Tầng dòng SKU của một chứng từ: kế hoạch / đã quét / đã ghi nhận. */
export function DocumentLinesTable({ lines }: { lines: Raw[] }) {
  const columns: ResponsiveTableColumn<Raw>[] = [
    {
      key: "line_no",
      header: "Dòng",
      width: 70,
      align: "right",
      render: (row) => text(row.line_no),
    },
    {
      key: "product_code",
      header: "Mã SKU",
      render: (row) => text(row.product_code),
    },
    {
      key: "product_name",
      header: "Tên SKU",
      render: (row) => text(row.product_name),
    },
    {
      key: "expected_qty",
      header: "Kế hoạch",
      align: "right",
      width: 110,
      render: (row) => fmt(row.expected_qty),
    },
    {
      key: "scanned_qty",
      header: "Đã quét",
      align: "right",
      width: 110,
      render: (row) => fmt(row.scanned_qty),
    },
    {
      key: "posted_qty",
      header: "Đã ghi nhận",
      align: "right",
      width: 120,
      render: (row) => fmt(row.posted_qty),
    },
  ];

  return (
    <ResponsiveDataTable<Raw>
      columns={columns}
      rows={lines}
      rowKey={(row) => text(row.id, String(lines.indexOf(row)))}
      emptyText="Phiếu chưa có dòng SKU nào."
    />
  );
}

/** Badge trạng thái dùng lại tone chung của trang. */
export function ReportStatusBadge({
  value,
  label,
  title,
}: {
  value: unknown;
  label: string;
  /** Giải thích vì sao ra trạng thái này (vd: lệch nằm ở check nào). */
  title?: string;
}) {
  return (
    <UiStatusBadge
      size="small"
      tone={statusTone(value)}
      label={label}
      title={title}
    />
  );
}
