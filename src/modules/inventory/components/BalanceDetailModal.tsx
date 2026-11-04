import { useState, type ReactNode } from "react";
import {
  Box,
  Stack,
  UiDrawer,
  UiTabs,
  UiStatusBadge,
  UiText,
} from "@/shared/ui";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  InventoryRecordList,
  type InventoryRecordField,
} from "./InventoryRecordList";
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
import { ActionIconButton, RowActionButton } from "@/shared/components/actions";
import { EMPTY_TEXT } from "@/shared/constants/display";
import "./inventory-dialog.css";
import "./balance-detail.css";
import { BoxReadDetailDialog } from "./BoxReadDetailDialog";

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

function CodeText({ children }: { children: ReactNode }) {
  return <code className="hn-inventory-code">{children}</code>;
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
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
  const [tab, setTab] = useState("overview");
  const movementsQuery = useStockMovements({
    search: balance.sku,
    per_page: 10,
  });
  const movements = movementsQuery.data?.rows ?? [];

  const subledgerQuery = useBalanceSubledger(String(balance.id));
  const subledger = subledgerQuery.data;
  const [selectedBox, setSelectedBox] = useState<{
    id: string;
    code: string;
  } | null>(null);

  const movementColumns: InventoryRecordField<StockMovementRow>[] = [
    {
      key: "movementId",
      header: t("inventory.detail.colMovementCode"),
      // movementId nay chỉ chứa movement_no thật (normalizer đã bỏ fallback
      // `?? row.id`), nên không cần so sánh với id nữa — thiếu mã thì "—".
      render: (row) =>
        row.movementId ? <CodeText>{row.movementId}</CodeText> : EMPTY_TEXT,
    },
    {
      key: "time",
      header: t("inventory.detail.colTime"),
      render: (row) => formatDateTime(row.time),
    },
    {
      key: "type",
      header: t("inventory.detail.colMovementType"),
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
      render: (row) => (
        <Box
          component="span"
          sx={{
            color:
              row.qty === null
                ? "text.secondary"
                : row.qty >= 0
                  ? "var(--ops-success)"
                  : "var(--ops-danger)",
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
          }}
        >
          {row.qty !== null && row.qty >= 0
            ? `+${formatQuantity(row.qty)}`
            : formatQuantity(row.qty)}
        </Box>
      ),
    },
    {
      key: "source",
      header: t("inventory.detail.colSourceDocument"),
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

  const itemColumns: InventoryRecordField<RawRecord>[] = [
    {
      key: "item_code",
      header: t("inventory.detail.colProductCode"),
      render: (row) => (
        <CodeText>{text(row.item_code ?? row.serial_number)}</CodeText>
      ),
    },
    {
      key: "serial_number",
      header: t("inventory.detail.colSerial"),
      render: (row) => text(row.serial_number),
    },
    {
      key: "status",
      header: t("inventory.detail.colStatus"),
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
      render: (row) => itemConditionLabel(row.condition, t),
    },
    {
      key: "physical_code",
      header: t("inventory.detail.colPhysicalCode"),
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
      render: (row) => text(row.location_hint),
    },
    {
      key: "received_at",
      header: t("inventory.detail.colReceivedAt"),
      render: (row) =>
        row.received_at ? formatDateTime(String(row.received_at)) : EMPTY_TEXT,
    },
  ];

  const containerColumns: InventoryRecordField<RawRecord>[] = [
    {
      key: "container_code",
      header: t("inventory.detail.colContainerCode"),
      render: (row) => {
        const id = text(row.container_id ?? row.id, "");
        const code = text(row.container_code);
        const isBox = text(row.container_type, "").toUpperCase() === "BOX";
        return isBox && id && subledger?.warehouse_id ? (
          <button
            type="button"
            className="hn-inventory-box-link"
            aria-label={`Xem BOX ${code}`}
            onClick={() => setSelectedBox({ id, code })}
          >
            <CodeText>{code}</CodeText>
          </button>
        ) : (
          <CodeText>{code}</CodeText>
        );
      },
    },
    {
      key: "container_type",
      header: t("inventory.detail.colType"),
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
      render: (row) => formatQuantity(Number(row.quantity)),
    },
    {
      key: "container_status",
      header: t("inventory.detail.colContainerStatus"),
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
      render: (row) => text(row.zone_code),
    },
    {
      key: "location_hint",
      header: t("inventory.detail.colLocation"),
      render: (row) => text(row.location_hint),
    },
  ];

  const items = (subledger?.items as RawRecord[]) ?? [];
  const containers = (subledger?.containers as RawRecord[]) ?? [];
  const tabItems = [
    { key: "overview", label: t("inventory.detail.overviewTab") },
    {
      key: "items",
      label: `${t("inventory.detail.productsTab")} (${formatQuantity(subledger?.item_count ?? balance.serialQty)})`,
    },
    {
      key: "containers",
      label: `${t("inventory.detail.containersTab")} (${formatQuantity(subledger?.container_count ?? balance.boxQty)})`,
    },
    { key: "movements", label: t("inventory.detail.movementsTab") },
  ];

  return (
    <>
      <UiDrawer
        {...dialog.dialogProps}
        width={800}
        className="hn-inventory-dialog hn-balance-drawer"
        title={
          <span className="hn-balance-drawer-title">
            <span
              className="hn-balance-drawer-title-text"
              title={t("inventory.detail.title", { sku: balance.sku })}
            >
              {t("inventory.detail.title", { sku: balance.sku })}
            </span>
            <ActionIconButton
              kind="close"
              label={t("common.close")}
              onClick={dialog.close}
            />
          </span>
        }
      >
        <div className="hn-balance-body">
          <div className="hn-balance-identity">
            <div className="hn-balance-identity-code">
              <strong>{balance.sku}</strong>
              <ActionIconButton
                kind="copy"
                label={t("inventory.detail.copy")}
                onClick={() => void navigator.clipboard?.writeText(balance.sku)}
              />
            </div>
            <p>{balance.name || EMPTY_TEXT}</p>
            <div className="hn-balance-identity-meta">
              <span>{balance.warehouse || EMPTY_TEXT}</span>
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
            </div>
          </div>
          <UiTabs
            items={tabItems}
            value={tab}
            onChange={setTab}
            aria-label={t("inventory.detail.title", { sku: balance.sku })}
          />
          {subledgerQuery.isError && tab !== "movements" ? (
            <ApiErrorAlert
              error={subledgerQuery.error}
              title={t("inventory.detail.loadError")}
              onRetry={() => subledgerQuery.refetch()}
            />
          ) : null}
          <section
            role="tabpanel"
            aria-label={String(
              tabItems.find((item) => item.key === tab)?.label,
            )}
            className="hn-balance-tab-panel"
            key={tab}
          >
            {tab === "overview" ? (
              <>
                <dl className="hn-balance-stats">
                  <StatBox
                    label={t("inventory.detail.statAvailable")}
                    value={formatQty(balance.available, balance.uom)}
                  />
                  <StatBox
                    label={t("inventory.detail.statOnHand")}
                    value={formatQty(balance.onHand, balance.uom)}
                  />
                  <StatBox
                    label={t("inventory.balance.colLedger")}
                    value={formatQty(balance.ledgerTotal, balance.uom)}
                  />
                  <StatBox
                    label={t("inventory.balance.colVariance")}
                    value={formatQty(balance.variance, balance.uom)}
                  />
                </dl>
                <dl className="hn-balance-fields hn-balance-overview-fields">
                  <DetailField
                    label={t("inventory.detail.fieldReconcile")}
                    value={
                      <Stack
                        direction="row"
                        spacing={1}
                        useFlexGap
                        sx={{ alignItems: "center", flexWrap: "wrap" }}
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
                          <span>
                            {enumLabelOrText(
                              RECONCILE_REASON_LABELS,
                              balance.reconcileNote,
                            )}
                          </span>
                        ) : null}
                      </Stack>
                    }
                  />
                  <DetailField
                    label={t("inventory.detail.fieldUpdated")}
                    value={formatDateTime(
                      balance.dataAsOf || balance.updatedAt,
                    )}
                  />
                  <DetailField
                    label={t("inventory.detail.fieldBoxCode")}
                    value={
                      balance.containerCode || t("inventory.detail.noBoxCode")
                    }
                  />
                  <DetailField
                    label={t("inventory.detail.fieldTrayCode")}
                    value={balance.trayCode || t("inventory.detail.noTrayCode")}
                  />
                  <DetailField
                    label={t("inventory.detail.fieldLocation")}
                    value={balance.location || t("inventory.detail.noLocation")}
                  />
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
                  <DetailField
                    label={t("inventory.detail.statItems")}
                    value={formatQty(
                      subledger?.item_count ?? balance.serialQty,
                    )}
                  />
                  <DetailField
                    label={t("inventory.detail.statBoxes")}
                    value={formatQty(
                      subledger?.container_count ?? balance.boxQty,
                    )}
                  />
                </dl>
              </>
            ) : null}
            {tab === "items" && !subledgerQuery.isError ? (
              <InventoryRecordList
                rows={items}
                fields={itemColumns}
                summaryKeys={["status", "condition"]}
                rowKey={(row) =>
                  text(
                    row.id ?? row.item_id ?? row.item_code,
                    `item-${items.indexOf(row)}`,
                  )
                }
                loading={subledgerQuery.isLoading}
                emptyText={t("inventory.detail.itemsEmpty")}
              />
            ) : null}
            {tab === "containers" && !subledgerQuery.isError ? (
              <InventoryRecordList
                rows={containers}
                fields={containerColumns}
                summaryKeys={["container_type", "quantity"]}
                rowKey={(row) =>
                  text(
                    row.id ?? row.container_id ?? row.container_code,
                    `container-${containers.indexOf(row)}`,
                  )
                }
                loading={subledgerQuery.isLoading}
                emptyText={t("inventory.detail.containersEmpty")}
              />
            ) : null}
            {tab === "movements" ? (
              movementsQuery.isError ? (
                <ApiErrorAlert
                  error={movementsQuery.error}
                  title={t("inventory.movement.loadError")}
                  onRetry={() => movementsQuery.refetch()}
                />
              ) : (
                <InventoryRecordList
                  rows={movements}
                  fields={movementColumns}
                  summaryKeys={["type", "qty"]}
                  rowKey={(row) => row.id}
                  loading={movementsQuery.isLoading}
                  emptyText={t("inventory.detail.movementsEmpty")}
                  renderAction={
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
              )
            ) : null}
          </section>
        </div>
      </UiDrawer>
      {selectedBox && subledger?.warehouse_id ? (
        <BoxReadDetailDialog
          containerId={selectedBox.id}
          warehouseId={subledger.warehouse_id}
          code={selectedBox.code}
          onClose={() => setSelectedBox(null)}
        />
      ) : null}
    </>
  );
}
