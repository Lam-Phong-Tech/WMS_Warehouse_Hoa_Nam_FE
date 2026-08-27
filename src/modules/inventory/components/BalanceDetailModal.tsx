import type { ReactNode } from "react";
import { Table, Tag, Typography as AntTypography } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  CONTAINER_TYPE_LABELS,
  INVENTORY_STOCK_STATUS_LABELS,
  ITEM_STATUS_LABELS,
  MOVEMENT_TYPE_LABELS,
  PUTAWAY_STATUS_LABELS,
  RECONCILE_STATUS_LABELS,
  SOURCE_DOCUMENT_TYPE_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import type { InventoryBalanceRow } from "../services/inventoryService";
import { useStockMovements, useBalanceSubledger } from "../hooks/use-inventory";
import type { StockMovementRow } from "../services/inventoryService";
import { formatDateTime } from "@/shared/utils/format-date";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";

const numberFormatter = new Intl.NumberFormat("vi-VN");

type RawRecord = Record<string, unknown>;

function formatQty(value: number | null | undefined, uom = "") {
  if (value === null || value === undefined) return "-";
  return `${numberFormatter.format(value)}${uom ? ` ${uom}` : ""}`;
}

function text(val: unknown, fallback = "-") {
  return val === undefined || val === null ? fallback : String(val);
}

function reconcileColor(status: string) {
  if (status === "MATCH" || status === "PASS") return "success";
  if (status === "MISMATCH" || status === "FAIL") return "error";
  return "warning";
}

function itemConditionLabel(value: unknown): string {
  const status = text(value, "");
  const labels: Record<string, string> = {
    NEW: "Mới",
    GOOD: "Tốt",
    NORMAL: "Bình thường",
    SELLABLE: "Có thể bán/xuất",
    DEFECTIVE: "Hàng lỗi",
    DAMAGED: "Hư hỏng",
    NON_SELLABLE: "Không thể bán/xuất",
    QUARANTINE: "Chờ kiểm tra",
  };
  return labels[status] ?? (status ? "Tình trạng khác" : "-");
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Grid size={{ xs: 12, md: 6 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block" }}
      >
        {label}
      </Typography>
      <Typography variant="body2" component="div">
        {value}
      </Typography>
    </Grid>
  );
}

function StatBox({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        px: 2,
        py: 1,
        minWidth: 110,
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block" }}
      >
        {label}
      </Typography>
      <Typography variant="h6">{value}</Typography>
    </Box>
  );
}

interface Props {
  balance: InventoryBalanceRow;
  onClose: () => void;
  onTraceMovement?: (movementId: string) => void;
}

export function BalanceDetailModal({
  balance,
  onClose,
  onTraceMovement,
}: Props) {
  const dialog = useDialogExit(onClose);
  const movementsQuery = useStockMovements({
    search: balance.sku,
    per_page: 10,
  });
  const movements = movementsQuery.data?.rows ?? [];

  const subledgerQuery = useBalanceSubledger(String(balance.id));
  const subledger = subledgerQuery.data;

  const movementColumns: ColumnsType<StockMovementRow> = [
    {
      title: "Mã biến động",
      dataIndex: "movementId",
      width: 140,
      render: (value: string) => (
        <AntTypography.Text code>{value || "-"}</AntTypography.Text>
      ),
    },
    {
      title: "Thời gian",
      dataIndex: "time",
      width: 150,
      render: (time: string) => formatDateTime(time),
    },
    {
      title: "Loại biến động",
      dataIndex: "type",
      width: 150,
      render: (value: string) => (
        <Tag>
          {businessLabel(MOVEMENT_TYPE_LABELS, value, "Biến động khác")}
        </Tag>
      ),
    },
    {
      title: "Số lượng thay đổi",
      dataIndex: "qty",
      width: 140,
      align: "right",
      render: (value: number) => (
        <AntTypography.Text
          style={{
            color: value >= 0 ? "#237804" : "#cf1322",
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
          }}
        >
          {value >= 0
            ? `+${numberFormatter.format(value)}`
            : numberFormatter.format(value)}
        </AntTypography.Text>
      ),
    },
    {
      title: "Chứng từ nguồn",
      dataIndex: "source",
      width: 180,
      render: (value: string, row) => (
        <Stack spacing={0}>
          <AntTypography.Text code>{value || "-"}</AntTypography.Text>
          <Typography variant="caption" color="text.secondary">
            {businessLabel(
              SOURCE_DOCUMENT_TYPE_LABELS,
              row.sourceType,
              "Nguồn khác",
            )}
          </Typography>
        </Stack>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 100,
      fixed: "right",
      render: (_, row) =>
        onTraceMovement ? (
          <ActionButton
            kind="history"
            sx={{ whiteSpace: "nowrap" }}
            onClick={() => onTraceMovement(String(row.id))}
          >
            Truy vết
          </ActionButton>
        ) : null,
    },
  ];

  const itemColumns: ColumnsType<RawRecord> = [
    {
      title: "Mã sản phẩm",
      width: 140,
      render: (_, row) => (
        <AntTypography.Text code>
          {text(row.item_code ?? row.serial_number)}
        </AntTypography.Text>
      ),
    },
    {
      title: "Số sê-ri",
      width: 140,
      render: (_, row) => text(row.serial_number),
    },
    {
      title: "Trạng thái",
      width: 140,
      render: (_, row) => (
        <Tag>
          {businessLabel(
            ITEM_STATUS_LABELS,
            text(row.status, ""),
            "Trạng thái khác",
          )}
        </Tag>
      ),
    },
    {
      title: "Tình trạng",
      width: 130,
      render: (_, row) => itemConditionLabel(row.condition),
    },
    {
      title: "Mã vật lý",
      width: 140,
      render: (_, row) =>
        row.physical_code ? (
          <AntTypography.Text code>
            {text(row.physical_code)}
          </AntTypography.Text>
        ) : (
          <AntTypography.Text type="secondary">-</AntTypography.Text>
        ),
    },
    {
      title: "Vị trí",
      width: 120,
      render: (_, row) => text(row.location_hint),
    },
    {
      title: "Thời điểm nhận",
      width: 150,
      render: (_, row) => text(row.received_at),
    },
  ];

  const containerColumns: ColumnsType<RawRecord> = [
    {
      title: "Mã vật chứa",
      width: 140,
      render: (_, row) => (
        <AntTypography.Text code>{text(row.container_code)}</AntTypography.Text>
      ),
    },
    {
      title: "Loại",
      width: 110,
      render: (_, row) => (
        <Tag>
          {businessLabel(
            CONTAINER_TYPE_LABELS,
            text(row.container_type, ""),
            "Vật chứa khác",
          )}
        </Tag>
      ),
    },
    {
      title: "Số lượng",
      width: 100,
      align: "right",
      render: (_, row) => numberFormatter.format(Number(row.quantity ?? 0)),
    },
    {
      title: "Trạng thái vật chứa",
      width: 160,
      render: (_, row) => (
        <Tag>
          {businessLabel(
            PUTAWAY_STATUS_LABELS,
            text(row.container_status, ""),
            "Trạng thái khác",
          )}
        </Tag>
      ),
    },
    {
      title: "Khu vực",
      width: 100,
      render: (_, row) => text(row.zone_code),
    },
    {
      title: "Vị trí",
      width: 120,
      render: (_, row) => text(row.location_hint),
    },
  ];

  return (
    <>
      <Dialog {...dialog.dialogProps} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ pr: 6, position: "relative" }}>
          {`Chi tiết tồn kho — ${balance.sku}`}
          <ActionIconButton
            kind="close"
            label="Đóng"
            onClick={dialog.close}
            sx={{ position: "absolute", right: 10, top: 8 }}
          />
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Box
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                p: 2,
              }}
            >
              <Grid container spacing={2}>
                <DetailField
                  label="SKU"
                  value={
                    <AntTypography.Text code copyable>
                      {balance.sku}
                    </AntTypography.Text>
                  }
                />
                <DetailField label="Tên hàng" value={balance.name} />
                <DetailField label="Kho" value={balance.warehouse} />
                <DetailField
                  label="Trạng thái tồn"
                  value={
                    <Tag
                      color={
                        balance.stockStatus === "AVAILABLE"
                          ? "success"
                          : "warning"
                      }
                    >
                      {businessLabel(
                        INVENTORY_STOCK_STATUS_LABELS,
                        balance.stockStatus,
                        "Trạng thái khác",
                      )}
                    </Tag>
                  }
                />
                <DetailField
                  label="Đối soát"
                  value={
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center" }}
                    >
                      <Tag color={reconcileColor(balance.reconcile)}>
                        {businessLabel(
                          RECONCILE_STATUS_LABELS,
                          balance.reconcile,
                          "Chưa đối soát",
                        )}
                      </Tag>
                      {balance.reconcileNote ? (
                        <Typography variant="caption" color="text.secondary">
                          {balance.reconcileNote}
                        </Typography>
                      ) : null}
                    </Stack>
                  }
                />
                <DetailField
                  label="Cập nhật"
                  value={balance.dataAsOf || balance.updatedAt || "-"}
                />
                <DetailField
                  label="Vị trí gợi ý"
                  value={
                    [balance.containerCode, balance.location]
                      .filter(Boolean)
                      .join(" · ") || "Chưa có vị trí gợi ý"
                  }
                />
                <DetailField
                  label="Biến động gần nhất"
                  value={balance.lastMovementId || "-"}
                />
              </Grid>
            </Box>

            <Stack
              direction="row"
              spacing={2}
              sx={{ flexWrap: "wrap", rowGap: 2 }}
            >
              <StatBox
                label="Khả dụng"
                value={formatQty(balance.available, balance.uom)}
              />
              <StatBox
                label="Tồn hiện có"
                value={formatQty(balance.onHand, balance.uom)}
              />
              <StatBox
                label="Số sản phẩm"
                value={formatQty(balance.serialQty)}
              />
              <StatBox label="Số hộp" value={formatQty(balance.boxQty)} />
            </Stack>

            {subledgerQuery.isError ? (
              <ApiErrorAlert
                error={subledgerQuery.error}
                title="Không tải được chi tiết tồn kho"
                onRetry={() => subledgerQuery.refetch()}
              />
            ) : null}

            <div>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                {`Sản phẩm cụ thể (${subledger?.item_count ?? balance.serialQty})`}
              </Typography>
              <Table
                size="small"
                dataSource={(subledger?.items as RawRecord[]) ?? []}
                columns={itemColumns}
                rowKey={(row) => text(row.id, String(Math.random()))}
                loading={subledgerQuery.isLoading}
                pagination={false}
                scroll={{ x: "max-content" }}
                locale={{ emptyText: "Không có sản phẩm cụ thể" }}
              />
            </div>

            <div>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                {`Vật chứa (${subledger?.container_count ?? balance.boxQty})`}
              </Typography>
              <Table
                size="small"
                dataSource={(subledger?.containers as RawRecord[]) ?? []}
                columns={containerColumns}
                rowKey={(row) => text(row.id, String(Math.random()))}
                loading={subledgerQuery.isLoading}
                pagination={false}
                scroll={{ x: "max-content" }}
                locale={{ emptyText: "Không có vật chứa" }}
              />
            </div>

            <div>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                {`Biến động liên quan (${movements.length})`}
              </Typography>
              <Table
                size="small"
                dataSource={movements}
                columns={movementColumns}
                rowKey="id"
                loading={movementsQuery.isLoading}
                pagination={false}
                scroll={{ x: "max-content" }}
                locale={{ emptyText: "Không có biến động liên quan" }}
              />
            </div>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
