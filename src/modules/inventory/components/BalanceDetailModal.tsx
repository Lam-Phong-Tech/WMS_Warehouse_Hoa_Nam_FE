import type { ReactNode } from "react";
import {
  Box,
  Grid,
  SEMANTIC_LIGHT,
  Stack,
  TYPOGRAPHY,
  UiDialog,
  UiStatusBadge,
  UiText,
} from "@/shared/ui";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import { CopyableId } from "@/shared/components/data-display/CopyableId";
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
import { formatQuantity } from "@/shared/utils/format-number";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";

type RawRecord = Record<string, unknown>;

function formatQty(value: number | null | undefined, uom = "") {
  const formatted = formatQuantity(value);
  if (formatted === "-") return "-";
  return `${formatted}${uom ? ` ${uom}` : ""}`;
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

/** Thay cho AntTypography.Text `code` — chữ mono trên nền soft, màu từ token. */
function CodeText({ children }: { children: ReactNode }) {
  return (
    <Box
      component="code"
      sx={{
        fontFamily: "monospace",
        fontSize: 13,
        px: 0.5,
        borderRadius: 1,
        backgroundColor: SEMANTIC_LIGHT.secondarySoft,
        color: SEMANTIC_LIGHT.textHigh,
      }}
    >
      {children}
    </Box>
  );
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Grid size={{ xs: 12, md: 6 }}>
      <Box sx={{ display: "block" }}>
        <UiText variant="caption">{label}</UiText>
      </Box>
      <UiText variant="body">{value}</UiText>
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
      <Box sx={{ display: "block" }}>
        <UiText variant="caption">{label}</UiText>
      </Box>
      <Box
        sx={{
          fontSize: TYPOGRAPHY.cardTitle.fontSize,
          fontWeight: TYPOGRAPHY.cardTitle.fontWeight,
          lineHeight: TYPOGRAPHY.cardTitle.lineHeight,
          color: SEMANTIC_LIGHT.textHigh,
        }}
      >
        {value}
      </Box>
    </Box>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        fontSize: 14,
        fontWeight: 700,
        mb: 1,
        color: SEMANTIC_LIGHT.textHigh,
      }}
    >
      {children}
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

  const movementColumns: ResponsiveTableColumn<StockMovementRow>[] = [
    {
      key: "movementId",
      header: "Mã biến động",
      width: 140,
      render: (row) =>
        row.movementId && row.movementId !== String(row.id) ? (
          <CodeText>{row.movementId}</CodeText>
        ) : (
          <CopyableId value={String(row.id)} />
        ),
    },
    {
      key: "time",
      header: "Thời gian",
      width: 150,
      render: (row) => formatDateTime(row.time),
    },
    {
      key: "type",
      header: "Loại biến động",
      width: 150,
      render: (row) => (
        <UiStatusBadge
          tone="neutral"
          label={businessLabel(
            MOVEMENT_TYPE_LABELS,
            row.type,
            "Biến động khác",
          )}
        />
      ),
    },
    {
      key: "qty",
      header: "Số lượng thay đổi",
      width: 140,
      align: "right",
      render: (row) => (
        <Box
          component="span"
          sx={{
            color:
              row.qty >= 0
                ? SEMANTIC_LIGHT.successText
                : SEMANTIC_LIGHT.errorText,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
          }}
        >
          {row.qty >= 0
            ? `+${formatQuantity(row.qty)}`
            : formatQuantity(row.qty)}
        </Box>
      ),
    },
    {
      key: "source",
      header: "Chứng từ nguồn",
      width: 180,
      render: (row) => (
        <Stack spacing={0}>
          <CodeText>{row.source || "-"}</CodeText>
          <UiText variant="caption">
            {businessLabel(
              SOURCE_DOCUMENT_TYPE_LABELS,
              row.sourceType,
              "Nguồn khác",
            )}
          </UiText>
        </Stack>
      ),
    },
  ];

  const itemColumns: ResponsiveTableColumn<RawRecord>[] = [
    {
      key: "item_code",
      header: "Mã sản phẩm",
      width: 140,
      render: (row) => (
        <CodeText>{text(row.item_code ?? row.serial_number)}</CodeText>
      ),
    },
    {
      key: "serial_number",
      header: "Số sê-ri",
      width: 140,
      render: (row) => text(row.serial_number),
    },
    {
      key: "status",
      header: "Trạng thái",
      width: 140,
      render: (row) => (
        <UiStatusBadge
          tone="neutral"
          label={businessLabel(
            ITEM_STATUS_LABELS,
            text(row.status, ""),
            "Trạng thái khác",
          )}
        />
      ),
    },
    {
      key: "condition",
      header: "Tình trạng",
      width: 130,
      render: (row) => itemConditionLabel(row.condition),
    },
    {
      key: "physical_code",
      header: "Mã vật lý",
      width: 180,
      render: (row) =>
        row.physical_code || row.rfid_code ? (
          <Stack spacing={0.25}>
            {row.physical_code ? (
              <CodeText>{text(row.physical_code)}</CodeText>
            ) : null}
            {row.rfid_code ? (
              <UiText variant="secondary">{`RFID: ${text(row.rfid_code)}`}</UiText>
            ) : null}
          </Stack>
        ) : (
          <UiText variant="secondary">-</UiText>
        ),
    },
    {
      key: "location_hint",
      header: "Vị trí",
      width: 120,
      render: (row) => text(row.location_hint),
    },
    {
      key: "received_at",
      header: "Thời điểm nhận",
      width: 150,
      render: (row) => text(row.received_at),
    },
  ];

  const containerColumns: ResponsiveTableColumn<RawRecord>[] = [
    {
      key: "container_code",
      header: "Mã vật chứa",
      width: 140,
      render: (row) => <CodeText>{text(row.container_code)}</CodeText>,
    },
    {
      key: "container_type",
      header: "Loại",
      width: 110,
      render: (row) => (
        <UiStatusBadge
          tone="neutral"
          label={businessLabel(
            CONTAINER_TYPE_LABELS,
            text(row.container_type, ""),
            "Vật chứa khác",
          )}
        />
      ),
    },
    {
      key: "quantity",
      header: "Số lượng",
      width: 100,
      align: "right",
      render: (row) => formatQuantity(Number(row.quantity ?? 0)),
    },
    {
      key: "container_status",
      header: "Trạng thái vật chứa",
      width: 160,
      render: (row) => (
        <UiStatusBadge
          tone="neutral"
          label={businessLabel(
            PUTAWAY_STATUS_LABELS,
            text(row.container_status, ""),
            "Trạng thái khác",
          )}
        />
      ),
    },
    {
      key: "zone_code",
      header: "Khu vực",
      width: 100,
      render: (row) => text(row.zone_code),
    },
    {
      key: "location_hint",
      header: "Vị trí",
      width: 120,
      render: (row) => text(row.location_hint),
    },
  ];

  return (
    <UiDialog
      {...dialog.dialogProps}
      maxWidth="lg"
      fullWidth
      title={
        <Box sx={{ position: "relative", pr: 6 }}>
          {`Chi tiết tồn kho — ${balance.sku}`}
          <ActionIconButton
            kind="close"
            label="Đóng"
            onClick={dialog.close}
            sx={{ position: "absolute", right: -8, top: -4 }}
          />
        </Box>
      }
    >
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
                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{ alignItems: "center" }}
                >
                  <CodeText>{balance.sku}</CodeText>
                  <ActionIconButton
                    kind="copy"
                    label="Sao chép"
                    onClick={() => {
                      void navigator.clipboard?.writeText(balance.sku);
                    }}
                  />
                </Stack>
              }
            />
            <DetailField label="Tên hàng" value={balance.name} />
            <DetailField label="Kho" value={balance.warehouse} />
            <DetailField
              label="Trạng thái tồn"
              value={
                <UiStatusBadge
                  tone={
                    balance.stockStatus === "AVAILABLE" ? "success" : "warning"
                  }
                  label={businessLabel(
                    INVENTORY_STOCK_STATUS_LABELS,
                    balance.stockStatus,
                    "Trạng thái khác",
                  )}
                />
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
                  <UiStatusBadge
                    tone={reconcileColor(balance.reconcile)}
                    label={businessLabel(
                      RECONCILE_STATUS_LABELS,
                      balance.reconcile,
                      "Chưa đối soát",
                    )}
                  />
                  {balance.reconcileNote ? (
                    <UiText variant="caption">{balance.reconcileNote}</UiText>
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

        <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", rowGap: 2 }}>
          <StatBox
            label="Khả dụng"
            value={formatQty(balance.available, balance.uom)}
          />
          <StatBox
            label="Tồn hiện có"
            value={formatQty(balance.onHand, balance.uom)}
          />
          <StatBox label="Số sản phẩm" value={formatQty(balance.serialQty)} />
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
          <SectionTitle>
            {`Sản phẩm cụ thể (${subledger?.item_count ?? balance.serialQty})`}
          </SectionTitle>
          <ResponsiveDataTable<RawRecord>
            rows={(subledger?.items as RawRecord[]) ?? []}
            columns={itemColumns}
            rowKey={(row) => text(row.id, String(Math.random()))}
            loading={subledgerQuery.isLoading}
            emptyText="Không có sản phẩm cụ thể"
          />
        </div>

        <div>
          <SectionTitle>
            {`Vật chứa (${subledger?.container_count ?? balance.boxQty})`}
          </SectionTitle>
          <ResponsiveDataTable<RawRecord>
            rows={(subledger?.containers as RawRecord[]) ?? []}
            columns={containerColumns}
            rowKey={(row) => text(row.id, String(Math.random()))}
            loading={subledgerQuery.isLoading}
            emptyText="Không có vật chứa"
          />
        </div>

        <div>
          <SectionTitle>
            {`Biến động liên quan (${movements.length})`}
          </SectionTitle>
          <ResponsiveDataTable<StockMovementRow>
            rows={movements}
            columns={movementColumns}
            rowKey={(row) => row.id}
            loading={movementsQuery.isLoading}
            emptyText="Không có biến động liên quan"
            renderRowActions={
              onTraceMovement
                ? (row) => (
                    <ActionButton
                      kind="history"
                      sx={{ whiteSpace: "nowrap" }}
                      onClick={() => onTraceMovement(String(row.id))}
                    >
                      Truy vết
                    </ActionButton>
                  )
                : undefined
            }
          />
        </div>
      </Stack>
    </UiDialog>
  );
}
