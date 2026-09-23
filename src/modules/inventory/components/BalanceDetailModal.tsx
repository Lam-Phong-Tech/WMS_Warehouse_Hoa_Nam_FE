import type { CSSProperties, ReactNode } from "react";
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
  RECONCILE_REASON_LABELS,
  RECONCILE_STATUS_LABELS,
  SOURCE_DOCUMENT_TYPE_LABELS,
  businessLabel,
  enumLabelOrText,
} from "@/shared/constants/business-labels";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
import type { MessageKey } from "@/shared/i18n/messages";
import type { InventoryBalanceRow } from "../services/inventoryService";
import { useStockMovements, useBalanceSubledger } from "../hooks/use-inventory";
import type { StockMovementRow } from "../services/inventoryService";
import { formatDateTime } from "@/shared/utils/format-date";
import { formatQuantity } from "@/shared/utils/format-number";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import {
  ActionIconButton,
  RowActionButton,
} from "@/shared/components/actions";
import { EMPTY_TEXT } from "@/shared/constants/display";
import "./inventory-dialog.css";

const INVENTORY_DIALOG_TABLE_HEADER_STYLE: CSSProperties = {
  background: "var(--invd-pale)",
  color: "var(--invd-heading)",
  fontSize: 12,
  padding: "10px 9px",
  borderBottom: "1px solid var(--invd-line)",
};

type RawRecord = Record<string, unknown>;

function formatQty(value: number | null | undefined, uom = "") {
  const formatted = formatQuantity(value);
  if (formatted === EMPTY_TEXT) return EMPTY_TEXT;
  return `${formatted}${uom ? ` ${uom}` : ""}`;
}

function text(val: unknown, fallback = EMPTY_TEXT) {
  return val === undefined || val === null ? fallback : String(val);
}

function reconcileColor(status: string) {
  if (status === "MATCH" || status === "PASS") return "success";
  if (status === "MISMATCH" || status === "FAIL") return "error";
  return "warning";
}

const ITEM_CONDITION_KEYS: Record<string, MessageKey> = {
  NEW: "inventory.condition.new",
  GOOD: "inventory.condition.good",
  NORMAL: "inventory.condition.normal",
  SELLABLE: "inventory.condition.sellable",
  DEFECTIVE: "inventory.condition.defective",
  DAMAGED: "inventory.condition.damaged",
  NON_SELLABLE: "inventory.condition.nonSellable",
  QUARANTINE: "inventory.condition.quarantine",
};

function itemConditionLabel(value: unknown, t: TranslateFn): string {
  const status = text(value, "");
  const key = ITEM_CONDITION_KEYS[status];
  if (key) return t(key);
  return status ? t("inventory.fallback.condition") : EMPTY_TEXT;
}

/** Thay cho AntTypography.Text `code` — chữ mono trên nền soft, màu từ token. */
function CodeText({ children }: { children: ReactNode }) {
  return (
    <Box
      component="code"
      className="hn-inventory-code"
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
    <Grid size={{ xs: 12, md: 6 }} className="hn-inventory-detail-field">
      <Box sx={{ display: "block" }}>
        <UiText variant="caption">{label}</UiText>
      </Box>
      <UiText variant="body" className="hn-inventory-detail-value">
        {value}
      </UiText>
    </Grid>
  );
}

function StatBox({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box
      className="hn-inventory-stat"
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
      className="hn-inventory-section-title"
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
  const t = useT();
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
      header: t("inventory.detail.colMovementCode"),
      width: 140,
      // movementId nay chỉ chứa movement_no thật (normalizer đã bỏ fallback
      // `?? row.id`), nên không cần so sánh với id nữa — thiếu mã thì "—".
      render: (row) =>
        row.movementId ? <CodeText>{row.movementId}</CodeText> : EMPTY_TEXT,
    },
    {
      key: "time",
      header: t("inventory.detail.colTime"),
      width: 150,
      render: (row) => formatDateTime(row.time),
    },
    {
      key: "type",
      header: t("inventory.detail.colMovementType"),
      width: 150,
      render: (row) => (
        <UiStatusBadge
          tone="neutral"
          label={businessLabel(
            MOVEMENT_TYPE_LABELS,
            row.type,
            t("inventory.fallback.movementType"),
          )}
        />
      ),
    },
    {
      key: "qty",
      header: t("inventory.detail.colQtyChange"),
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
      header: t("inventory.detail.colSourceDocument"),
      width: 180,
      render: (row) => (
        <Stack spacing={0}>
          <CodeText>{row.source || EMPTY_TEXT}</CodeText>
          <UiText variant="caption">
            {businessLabel(
              SOURCE_DOCUMENT_TYPE_LABELS,
              row.sourceType,
              t("inventory.fallback.source"),
            )}
          </UiText>
        </Stack>
      ),
    },
  ];

  const itemColumns: ResponsiveTableColumn<RawRecord>[] = [
    {
      key: "item_code",
      header: t("inventory.detail.colProductCode"),
      width: 140,
      render: (row) => (
        <CodeText>{text(row.item_code ?? row.serial_number)}</CodeText>
      ),
    },
    {
      key: "serial_number",
      header: t("inventory.detail.colSerial"),
      width: 140,
      render: (row) => text(row.serial_number),
    },
    {
      key: "status",
      header: t("inventory.detail.colStatus"),
      width: 140,
      render: (row) => (
        <UiStatusBadge
          tone="neutral"
          label={businessLabel(
            ITEM_STATUS_LABELS,
            text(row.status, ""),
            t("inventory.fallback.status"),
          )}
        />
      ),
    },
    {
      key: "condition",
      header: t("inventory.detail.colCondition"),
      width: 130,
      render: (row) => itemConditionLabel(row.condition, t),
    },
    {
      key: "physical_code",
      header: t("inventory.detail.colPhysicalCode"),
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
          <UiText variant="secondary">{EMPTY_TEXT}</UiText>
        ),
    },
    {
      // Chip NFC được dán lúc XUẤT KHO và ghi bằng Mini App, nên phần lớn hiện
      // vật đang nằm trong kho sẽ trống ô này — đó là trạng thái nghiệp vụ bình
      // thường chứ không phải dữ liệu bị thiếu. Vì vậy ô rỗng nói rõ "chưa dán
      // chip" thay vì EMPTY_TEXT chung ("Chưa có") vốn đọc như một trường bị bỏ
      // sót. `nfc_code` là alias `NFC-<hardware_uid>` do BE trả về, chỉ có mặt
      // khi chip còn ACTIVE (chip mất/thay đã bị BE lọc ra).
      key: "nfc_code",
      header: t("inventory.detail.colNfcCode"),
      width: 180,
      render: (row) =>
        row.nfc_code || row.nfc_hardware_uid ? (
          <CodeText>{text(row.nfc_code ?? row.nfc_hardware_uid)}</CodeText>
        ) : (
          <UiText variant="secondary">
            {t("inventory.detail.nfcUnassigned")}
          </UiText>
        ),
    },
    {
      key: "location_hint",
      header: t("inventory.detail.colLocation"),
      width: 120,
      render: (row) => text(row.location_hint),
    },
    {
      key: "received_at",
      header: t("inventory.detail.colReceivedAt"),
      width: 150,
      render: (row) => text(row.received_at),
    },
  ];

  const containerColumns: ResponsiveTableColumn<RawRecord>[] = [
    {
      key: "container_code",
      header: t("inventory.detail.colContainerCode"),
      width: 140,
      render: (row) => <CodeText>{text(row.container_code)}</CodeText>,
    },
    {
      key: "container_type",
      header: t("inventory.detail.colType"),
      width: 110,
      render: (row) => (
        <UiStatusBadge
          tone="neutral"
          label={businessLabel(
            CONTAINER_TYPE_LABELS,
            text(row.container_type, ""),
            t("inventory.fallback.container"),
          )}
        />
      ),
    },
    {
      key: "quantity",
      header: t("inventory.detail.colQty"),
      width: 100,
      align: "right",
      render: (row) => formatQuantity(Number(row.quantity ?? 0)),
    },
    {
      key: "container_status",
      header: t("inventory.detail.colContainerStatus"),
      width: 160,
      render: (row) => (
        <UiStatusBadge
          tone="neutral"
          label={businessLabel(
            PUTAWAY_STATUS_LABELS,
            text(row.container_status, ""),
            t("inventory.fallback.status"),
          )}
        />
      ),
    },
    {
      key: "zone_code",
      header: t("inventory.detail.colZone"),
      width: 100,
      render: (row) => text(row.zone_code),
    },
    {
      key: "location_hint",
      header: t("inventory.detail.colLocation"),
      width: 120,
      render: (row) => text(row.location_hint),
    },
  ];

  return (
    <UiDialog
      {...dialog.dialogProps}
      className="hn-inventory-dialog"
      maxWidth="lg"
      fullWidth
      title={
        <Box sx={{ position: "relative", pr: 6 }}>
          {t("inventory.detail.title", { sku: balance.sku })}
          <ActionIconButton
            className="hn-inventory-dialog-close"
            kind="close"
            label={t("common.close")}
            onClick={dialog.close}
            sx={{ position: "absolute", right: -8, top: -4 }}
          />
        </Box>
      }
    >
      <Stack spacing={2} className="hn-inventory-dialog-body">
        <Box
          className="hn-inventory-detail-panel"
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
                  useFlexGap
                  sx={{ alignItems: "center" }}
                >
                  <CodeText>{balance.sku}</CodeText>
                  <ActionIconButton
                    kind="copy"
                    label={t("inventory.detail.copy")}
                    onClick={() => {
                      void navigator.clipboard?.writeText(balance.sku);
                    }}
                  />
                </Stack>
              }
            />
            <DetailField
              label={t("inventory.detail.fieldName")}
              value={balance.name}
            />
            <DetailField label="Kho" value={balance.warehouse} />
            <DetailField
              label={t("inventory.detail.fieldStockStatus")}
              value={
                <UiStatusBadge
                  tone={
                    balance.stockStatus === "AVAILABLE" ? "success" : "warning"
                  }
                  label={businessLabel(
                    INVENTORY_STOCK_STATUS_LABELS,
                    balance.stockStatus,
                    t("inventory.fallback.status"),
                  )}
                />
              }
            />
            <DetailField
              label={t("inventory.detail.fieldReconcile")}
              value={
                <Stack
                  direction="row"
                  spacing={1}
                  useFlexGap
                  sx={{ alignItems: "center" }}
                >
                  <UiStatusBadge
                    tone={reconcileColor(balance.reconcile)}
                    label={businessLabel(
                      RECONCILE_STATUS_LABELS,
                      balance.reconcile,
                      t("inventory.fallback.notReconciled"),
                    )}
                  />
                  {balance.reconcileNote ? (
                    // UAT TC_UI_11: mã máy (BALANCE_NOT_EQUAL_…) phải qua map
                    // nhãn tiếng Việt, không in thô ra màn nghiệp vụ.
                    <UiText variant="caption">
                      {enumLabelOrText(
                        RECONCILE_REASON_LABELS,
                        balance.reconcileNote,
                      )}
                    </UiText>
                  ) : null}
                </Stack>
              }
            />
            <DetailField
              label={t("inventory.detail.fieldUpdated")}
              // UAT TC_UI_11: từng in nguyên chuỗi ISO 2026-09-09T04:04:25+07:00.
              value={formatDateTime(balance.dataAsOf || balance.updatedAt)}
            />
            {/* DR-LOC-001: 3 mảnh thông tin vị trí độc lập, tách riêng vì mỗi
              mảnh có thời điểm xuất hiện khác nhau — mã hộp có ngay sau nhập
              kho; mã khay và vị trí chỉ có sau khi Putaway confirm, và vị trí
              (mô tả rời, có thể do người xếp khay ghi tay) không nhất thiết
              trùng mã khay. */}
            <DetailField
              label={t("inventory.detail.fieldBoxCode")}
              value={balance.containerCode || t("inventory.detail.noBoxCode")}
            />
            <DetailField
              label={t("inventory.detail.fieldTrayCode")}
              value={balance.trayCode || t("inventory.detail.noTrayCode")}
            />
            <DetailField
              label={t("inventory.detail.fieldLocation")}
              value={balance.location || t("inventory.detail.noLocation")}
            />
            {/* BE mới chỉ trả last_movement_id (UUID), chưa có movement_no
              tương ứng — hiển thị rút gọn + cho sao chép thay vì in chuỗi thô.
              Khi BE bổ sung last_movement_no thì đổi sang hiện mã đó. */}
            <DetailField
              label={t("inventory.detail.fieldLastMovement")}
              value={
                balance.lastMovementId ? (
                  <CopyableId value={balance.lastMovementId} />
                ) : (
                  EMPTY_TEXT
                )
              }
            />
          </Grid>
        </Box>

        <Stack className="hn-inventory-stats">
          <StatBox
            label={t("inventory.detail.statAvailable")}
            value={formatQty(balance.available, balance.uom)}
          />
          <StatBox
            label={t("inventory.detail.statOnHand")}
            value={formatQty(balance.onHand, balance.uom)}
          />
          <StatBox
            label={t("inventory.detail.statItems")}
            value={formatQty(balance.serialQty)}
          />
          <StatBox
            label={t("inventory.detail.statBoxes")}
            value={formatQty(balance.boxQty)}
          />
        </Stack>

        {subledgerQuery.isError ? (
          <ApiErrorAlert
            error={subledgerQuery.error}
            title={t("inventory.detail.loadError")}
            onRetry={() => subledgerQuery.refetch()}
          />
        ) : null}

        <div>
          <SectionTitle>
            {t("inventory.detail.itemsTitle", {
              count: subledger?.item_count ?? balance.serialQty,
            })}
          </SectionTitle>
          <ResponsiveDataTable<RawRecord>
            headerCellStyle={INVENTORY_DIALOG_TABLE_HEADER_STYLE}
            maxBodyHeight="clamp(240px, 45dvh, 520px)"
            rows={(subledger?.items as RawRecord[]) ?? []}
            columns={itemColumns}
            rowKey={(row) => text(row.id, String(Math.random()))}
            loading={subledgerQuery.isLoading}
            emptyText={t("inventory.detail.itemsEmpty")}
          />
        </div>

        <div>
          <SectionTitle>
            {t("inventory.detail.containersTitle", {
              count: subledger?.container_count ?? balance.boxQty,
            })}
          </SectionTitle>
          <ResponsiveDataTable<RawRecord>
            headerCellStyle={INVENTORY_DIALOG_TABLE_HEADER_STYLE}
            maxBodyHeight="clamp(240px, 45dvh, 520px)"
            rows={(subledger?.containers as RawRecord[]) ?? []}
            columns={containerColumns}
            rowKey={(row) => text(row.id, String(Math.random()))}
            loading={subledgerQuery.isLoading}
            emptyText={t("inventory.detail.containersEmpty")}
          />
        </div>

        <div>
          <SectionTitle>
            {t("inventory.detail.movementsTitle", {
              count: movements.length,
            })}
          </SectionTitle>
          <ResponsiveDataTable<StockMovementRow>
            actionColumnWidth={128}
            headerCellStyle={INVENTORY_DIALOG_TABLE_HEADER_STYLE}
            maxBodyHeight="clamp(240px, 45dvh, 520px)"
            rows={movements}
            columns={movementColumns}
            rowKey={(row) => row.id}
            loading={movementsQuery.isLoading}
            emptyText={t("inventory.detail.movementsEmpty")}
            renderRowActions={
              onTraceMovement
                ? (row) => (
                    <RowActionButton
                      kind="trace"
                      onClick={() => onTraceMovement(String(row.id))}
                    >
                      {t("inventory.detail.trace")}
                    </RowActionButton>
                  )
                : undefined
            }
          />
        </div>
      </Stack>
    </UiDialog>
  );
}
