import { nullableApiNumber } from "@/shared/api/api-read-values";
import { useState, type ReactNode } from "react";
import {
  Box,
  Stack,
  UiDrawer,
  UiTabs,
  UiStatusBadge,
  UiText,
  UiTextField,
  UiTimeline,
  type BoxProps,
  type UiStatusTone,
} from "@/shared/ui";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { CopyableId } from "@/shared/components/data-display/CopyableId";
import { SkuLink } from "@/shared/components/data-display/SkuLink";
import {
  InventoryRecordList,
  type InventoryRecordField,
} from "./InventoryRecordList";
import {
  WARRANTY_STATUS_COLORS,
  WARRANTY_STATUS_LABELS,
} from "@/modules/warranty/constants";
import {
  CONTAINER_TYPE_LABELS,
  INBOUND_STATUS_LABELS,
  ITEM_STATUS_LABELS,
  MASTER_STATUS_LABELS,
  MOVEMENT_ROLE_LABELS,
  MOVEMENT_STATUS_LABELS,
  MOVEMENT_TYPE_LABELS,
  OUTBOUND_STATUS_LABELS,
  PUTAWAY_STATUS_LABELS,
  SCAN_CLASSIFICATION_LABELS,
  SCAN_RESULT_LABELS,
  REVERSAL_REASON_LABELS,
  SOURCE_DOCUMENT_TYPE_LABELS,
  WARRANTY_EVENT_TYPE_LABELS,
  businessLabel,
  enumLabelOrText,
} from "@/shared/constants/business-labels";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
import type { MessageKey } from "@/shared/i18n/messages";
import type { CorrectionChainNode } from "../services/inventoryService";
import {
  useStockMovement,
  useStockMovementTrace,
  usePhysicalCodeTrace,
} from "../hooks/use-inventory";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { formatDateTime } from "@/shared/utils/format-date";
import { formatQuantity } from "@/shared/utils/format-number";
import { EMPTY_TEXT } from "@/shared/constants/display";
import "./inventory-dialog.css";
import "./balance-detail.css";
import "./trace-drawer.css";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import { tStatic as tUi } from "@/shared/i18n/useT";

interface Props {
  movementId: string | null;
  initialCode?: string;
  onClose: () => void;
}

type RawRecord = Record<string, unknown>;

type KeyedRecord = RawRecord & { __rowKey: string };

/** QR/RFID là từ viết tắt kỹ thuật, giữ nguyên; chỉ BARCODE có bản dịch. */
const CARRIER_LABEL_KEYS: Record<string, MessageKey | undefined> = {
  BARCODE: "inventory.trace.barcode",
};
const CARRIER_LITERALS: Record<string, string> = { QR: "QR", RFID: "RFID" };

function carrierLabel(carrier: string, t: TranslateFn): string {
  const key = CARRIER_LABEL_KEYS[carrier];
  if (key) return t(key);
  return CARRIER_LITERALS[carrier] ?? t("inventory.fallback.codeType");
}

/** Màu antd Tag còn dùng trong WARRANTY_STATUS_COLORS → tone UiStatusBadge. */
const TAG_COLOR_TONES: Record<string, UiStatusTone> = {
  green: "success",
  success: "success",
  red: "error",
  error: "error",
  volcano: "error",
  orange: "warning",
  gold: "warning",
  warning: "warning",
  blue: "info",
  processing: "info",
  geekblue: "info",
  cyan: "info",
  purple: "primary",
  default: "neutral",
};

function quantityColor(value: number | null): string | undefined {
  return value === null || value === 0
    ? undefined
    : value >= 0
      ? "var(--ops-success)"
      : "var(--ops-danger)";
}
function text(value: unknown, fallback = "-"): string {
  return value === undefined || value === null ? fallback : String(value);
}

function nested(
  obj: RawRecord | undefined,
  key: string,
): RawRecord | undefined {
  const value = obj?.[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RawRecord)
    : undefined;
}

function statusLabel(value: unknown, t: TranslateFn, sourceType = ""): string {
  const raw = text(value, "");
  if (!raw) return t("inventory.trace.undetermined");
  const source = sourceType.toUpperCase();
  if (["ISSUE", "OUTBOUND", "COMPONENT_ISSUE"].includes(source)) {
    const label =
      OUTBOUND_STATUS_LABELS[raw as keyof typeof OUTBOUND_STATUS_LABELS];
    if (label) return label;
  }
  return (
    INBOUND_STATUS_LABELS[raw as keyof typeof INBOUND_STATUS_LABELS] ??
    OUTBOUND_STATUS_LABELS[raw as keyof typeof OUTBOUND_STATUS_LABELS] ??
    MOVEMENT_STATUS_LABELS[raw as keyof typeof MOVEMENT_STATUS_LABELS] ??
    MASTER_STATUS_LABELS[raw as keyof typeof MASTER_STATUS_LABELS] ??
    PUTAWAY_STATUS_LABELS[raw as keyof typeof PUTAWAY_STATUS_LABELS] ??
    SCAN_RESULT_LABELS[raw as keyof typeof SCAN_RESULT_LABELS] ??
    t("inventory.fallback.status")
  );
}

function statusTone(value: unknown): UiStatusTone {
  const status = text(value, "");
  if (["POSTED", "CLOSED", "ACTIVE", "OK", "VALID"].includes(status))
    return "success";
  if (["CANCELLED", "REVERSED", "INVALID"].includes(status)) return "error";
  if (["SCANNING", "PROCESSING"].includes(status)) return "info";
  if (["PENDING", "CHECKING"].includes(status)) return "warning";
  return "neutral";
}

function sourceLabel(value: string, t: TranslateFn): string {
  const source = value.toUpperCase();
  const key =
    source === "OUTBOUND" ? "ISSUE" : source === "INBOUND" ? "RECEIPT" : value;
  return businessLabel(
    SOURCE_DOCUMENT_TYPE_LABELS,
    key,
    t("inventory.fallback.source"),
  );
}

function withRowKey(row: RawRecord, rowKey: string) {
  return { ...row, __rowKey: rowKey } as KeyedRecord;
}

/** Identifiers have weight; backgrounds remain reserved for statuses. */
function CodeText({
  children,
  sx,
}: {
  children: ReactNode;
  sx?: BoxProps["sx"];
}) {
  return (
    <Box
      component="code"
      className="hn-inventory-code"
      sx={[
        {
          fontFamily: "var(--wms-font-family)",
          fontSize: 13,
          px: 0.5,
          borderRadius: 1,
          backgroundColor: "transparent",
          color: "var(--ops-heading)",
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children}
    </Box>
  );
}

/** Thay AntTypography.Text `code copyable`: CodeText + nút sao chép. */
function CopyableCode({ value }: { value: string }) {
  const t = useT();
  return (
    <Stack
      className="hn-trace-copy"
      direction="row"
      spacing={0.5}
      useFlexGap
      sx={{
        display: "inline-flex",
        alignItems: "center",
        minWidth: 0,
        maxWidth: "100%",
      }}
    >
      <CodeText>{value}</CodeText>
      <ActionIconButton
        kind="copy"
        label={t("inventory.trace.copy")}
        onClick={() => void navigator.clipboard?.writeText(value)}
      />
    </Stack>
  );
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="hn-trace-field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function DescriptionsBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="hn-trace-section">
      <h3>{title}</h3>
      <dl className="hn-trace-fields">{children}</dl>
    </section>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className="hn-trace-section-title">{children}</h3>;
}

const containerItemColumns = (
  t: TranslateFn,
): InventoryRecordField<KeyedRecord>[] => [
  {
    key: "container",
    header: t("inventory.trace.colContainer"),
    render: (row) => text(row.container_code),
  },
  {
    key: "type",
    header: t("inventory.trace.colType"),
    render: (row) =>
      businessLabel(
        CONTAINER_TYPE_LABELS,
        text(row.container_type, ""),
        t("inventory.fallback.container"),
      ),
  },
  {
    key: "quantity",
    header: t("inventory.trace.colQty"),
    render: (row) => formatQuantity(nullableApiNumber(row.quantity)),
  },
  {
    key: "status",
    header: t("inventory.trace.colStatus"),
    render: (row) => (
      <UiStatusBadge
        tone={statusTone(row.status)}
        label={statusLabel(row.status, t)}
      />
    ),
  },
];

const movementColumns = (t: TranslateFn): InventoryRecordField<RawRecord>[] => [
  {
    key: "movement_no",
    header: t("inventory.trace.colMovementCode"),
    render: (row) => <CodeText>{text(row.movement_no)}</CodeText>,
  },
  {
    key: "type",
    header: t("inventory.trace.colType"),
    render: (row) =>
      businessLabel(
        MOVEMENT_TYPE_LABELS,
        text(row.movement_type, ""),
        t("inventory.fallback.movementType"),
      ),
  },
  {
    key: "sku",
    header: "SKU",
    render: (row) => text(row.product_code),
  },
  {
    key: "quantity",
    header: t("inventory.trace.colQty"),
    render: (row) => {
      const qty = nullableApiNumber(row.qty_delta ?? row.quantity);
      return (
        <Box
          component="span"
          sx={{
            color: quantityColor(qty),
            fontWeight: 600,
          }}
        >
          {qty !== null && qty >= 0
            ? `+${formatQuantity(qty)}`
            : formatQuantity(qty)}
        </Box>
      );
    },
  },
  {
    key: "doc",
    header: t("inventory.trace.colDocument"),
    render: (row) => <CodeText>{text(row.doc_no)}</CodeText>,
  },
  {
    key: "time",
    header: t("inventory.trace.colTime"),
    render: (row) =>
      formatDateTime(text(row.occurred_at ?? row.created_at, "") || null),
  },
];

const traceLineColumns = (
  t: TranslateFn,
  sourceType: string,
): InventoryRecordField<KeyedRecord>[] => [
  {
    key: "sku",
    header: "SKU",
    render: (row) => {
      const product = nested(row, "product");
      return (
        <SkuLink
          id={
            text(row.sku_id ?? row.product_id ?? product?.sku_id) || undefined
          }
          code={text(
            row.sku ??
              row.sku_code ??
              row.product_sku ??
              row.product_code ??
              product?.code ??
              product?.sku_code,
          )}
        />
      );
    },
  },
  {
    key: "name",
    header: t("inventory.trace.colName"),
    render: (row) => {
      const product = nested(row, "product");
      return text(
        row.product_name ??
          row.sku_name ??
          row.name ??
          product?.name ??
          product?.sku_name,
      );
    },
  },
  {
    key: "quantity",
    header: t("inventory.trace.colQty"),
    render: (row) =>
      formatQuantity(
        nullableApiNumber(row.quantity ?? row.qty ?? row.qty_actual),
      ),
  },
  {
    key: "status",
    header: t("inventory.trace.colStatus"),
    render: (row) => (
      <UiStatusBadge
        tone={statusTone(row.status ?? row.line_status)}
        label={statusLabel(row.status ?? row.line_status, t, sourceType)}
      />
    ),
  },
];

const chainColumns = (
  t: TranslateFn,
): InventoryRecordField<CorrectionChainNode>[] => [
  {
    key: "movement_no",
    header: t("inventory.trace.colMovementCode"),
    render: (row) =>
      row.movement_no ? (
        <CodeText
          sx={{
            fontSize: 12,
            ...(row.is_subject ? { fontWeight: 600 } : {}),
          }}
        >
          {row.movement_no}
        </CodeText>
      ) : (
        <CopyableId value={row.id} />
      ),
  },
  {
    key: "role",
    header: t("inventory.trace.colRole"),
    render: (row) =>
      businessLabel(
        MOVEMENT_ROLE_LABELS,
        row.role,
        t("inventory.fallback.movementRole"),
      ),
  },
  {
    key: "type",
    header: t("inventory.trace.colType"),
    render: (row) =>
      businessLabel(
        MOVEMENT_TYPE_LABELS,
        row.movement_type,
        t("inventory.fallback.movementType"),
      ),
  },
  {
    key: "qty_delta",
    header: t("inventory.trace.colQtyChange"),
    render: (row) => (
      <Box
        component="span"
        sx={{
          color: quantityColor(nullableApiNumber(row.qty_delta)),
          fontWeight: 600,
        }}
      >
        {formatQuantity(nullableApiNumber(row.qty_delta))}
      </Box>
    ),
  },
  {
    key: "occurred_at",
    header: t("inventory.trace.colMoment"),
    render: (row) => formatDateTime(text(row.occurred_at, "") || null),
  },
  {
    key: "actor",
    header: t("inventory.trace.colPerformedBy"),
    render: (row) => text(row.actor),
  },
  {
    key: "reason",
    header: t("inventory.trace.colReason"),
    render: (row) =>
      text(
        row.reason_text ??
          (row.reason_code
            ? enumLabelOrText(REVERSAL_REASON_LABELS, row.reason_code)
            : null) ??
          row.reversal_document_no,
      ),
  },
];

/** TRACE-01 · Truy vết mã vật lý, biến động tồn và chứng từ nguồn. */
export function TraceModal({ movementId, initialCode = "", onClose }: Props) {
  const t = useT();
  const dialog = useDialogExit(onClose);
  const [activeTab, setActiveTab] = useState("overview");
  const [lookupCode, setLookupCode] = useState(initialCode);
  const [submittedCode, setSubmittedCode] = useState<string | null>(
    initialCode.trim() || null,
  );

  const movementQuery = useStockMovement(movementId);
  const traceQuery = useStockMovementTrace(movementId);
  const physicalCodeQuery = usePhysicalCodeTrace(submittedCode);

  const movement = movementQuery.data as RawRecord | undefined;
  const trace = traceQuery.data;
  const codeTrace = physicalCodeQuery.data;

  const handleLookup = () => {
    const trimmed = lookupCode.trim();
    if (!trimmed) return;
    setSubmittedCode(trimmed);
    setActiveTab("overview");
  };

  const resolvedObject = codeTrace?.resolved_object as
    RawRecord | null | undefined;
  const physicalCode = codeTrace?.physical_code as RawRecord | null | undefined;

  return (
    <UiDrawer
      {...dialog.dialogProps}
      className="hn-inventory-dialog hn-trace-drawer"
      width={720}
      slotProps={{
        paper: { role: "dialog", "aria-modal": true },
      }}
      title={
        <Box className="hn-trace-drawer-title">
          <span>{t("inventory.trace.title")}</span>
          <ActionIconButton
            kind="close"
            label={t("common.close")}
            onClick={dialog.close}
          />
        </Box>
      }
    >
      <Stack spacing={2} className="hn-inventory-dialog-body hn-trace-body">
        <Stack className="hn-inventory-lookup hn-trace-lookup">
          <UiTextField
            placeholder={t("inventory.trace.searchPlaceholder")}
            value={lookupCode}
            slotProps={{
              htmlInput: { "aria-label": t("inventory.trace.searchAria") },
            }}
            onChange={(event) => setLookupCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleLookup();
            }}
            sx={{ flex: "1 1 240px", minWidth: 0 }}
          />
          <ActionButton
            kind="search"
            disabled={!lookupCode.trim()}
            onClick={handleLookup}
          >
            {t("inventory.trace.lookup")}
          </ActionButton>
        </Stack>

        {/* UAT TC_UI_11: lỗi tải phải nằm ĐẦU thân dialog (thân cuộn được) —
            bản trước đặt cạnh khối dữ liệu tương ứng ở cuối, khuất khỏi màn
            hình nên trông như không có phản hồi. */}
        {movementQuery.isError ? (
          <ApiErrorAlert
            error={movementQuery.error}
            title={t("inventory.trace.movementLoadError")}
            onRetry={() => movementQuery.refetch()}
          />
        ) : null}
        {traceQuery.isError ? (
          <ApiErrorAlert
            error={traceQuery.error}
            title={t("inventory.trace.sourceLoadError")}
            onRetry={() => traceQuery.refetch()}
          />
        ) : null}

        {!movementId && !submittedCode ? (
          <UiText variant="secondary">{t("inventory.trace.idle")}</UiText>
        ) : null}

        {physicalCodeQuery.isError ? (
          <ApiErrorAlert
            error={physicalCodeQuery.error}
            title={t("inventory.trace.notFound")}
            onRetry={() => physicalCodeQuery.refetch()}
          />
        ) : null}

        {physicalCodeQuery.isLoading ? (
          <Box sx={{ textAlign: "center", py: 2 }}>
            <UiText variant="secondary">{t("inventory.trace.looking")}</UiText>
          </Box>
        ) : null}

        {movementQuery.isLoading ? (
          <p className="hn-trace-state" role="status">
            {t("common.loadingData")}
          </p>
        ) : null}
        {movement || trace || codeTrace ? (
          <UiTabs
            aria-label={t("inventory.trace.tabsAria")}
            value={activeTab}
            onChange={setActiveTab}
            items={[
              { key: "overview", label: t("inventory.detail.overviewTab") },
              { key: "related", label: t("inventory.trace.tabRelated") },
              { key: "history", label: t("inventory.trace.tabHistory") },
            ]}
          />
        ) : null}
        {codeTrace ? (
          <>
            {activeTab === "overview" ? (
              <DescriptionsBlock title={t("inventory.trace.resultTitle")}>
                <DetailField
                  label={t("inventory.trace.fieldPhysicalCode")}
                  value={
                    <CopyableCode value={text(physicalCode?.code_value)} />
                  }
                />
                <DetailField
                  label={t("inventory.trace.fieldCodeType")}
                  value={carrierLabel(text(physicalCode?.carrier_type, ""), t)}
                />
                <DetailField
                  label={t("inventory.trace.fieldBoundObject")}
                  value={businessLabel(
                    SCAN_CLASSIFICATION_LABELS,
                    codeTrace.resolved_type,
                    t("inventory.fallback.object"),
                  )}
                />
                <DetailField
                  label={t("inventory.trace.fieldStatus")}
                  value={
                    <UiStatusBadge
                      tone={
                        text(physicalCode?.status, "") === "ACTIVE"
                          ? "success"
                          : "neutral"
                      }
                      label={statusLabel(physicalCode?.status, t)}
                    />
                  }
                />

                {codeTrace.resolved_type === "ITEM" && resolvedObject ? (
                  <>
                    <DetailField
                      label="SKU"
                      value={
                        <>
                          <CodeText>
                            <SkuLink
                              id={text(resolvedObject.sku_id) || undefined}
                              code={text(resolvedObject.sku_code)}
                            />
                          </CodeText>{" "}
                          {text(resolvedObject.sku_name)}
                        </>
                      }
                    />
                    <DetailField
                      label={t("inventory.trace.fieldItemStatus")}
                      value={businessLabel(
                        ITEM_STATUS_LABELS,
                        text(
                          resolvedObject.status ?? resolvedObject.item_status,
                          "",
                        ),
                        t("inventory.fallback.status"),
                      )}
                    />
                  </>
                ) : null}

                {codeTrace.resolved_type === "CONTAINER" && resolvedObject ? (
                  <>
                    <DetailField
                      label={t("inventory.trace.fieldContainerCode")}
                      value={
                        <CodeText>
                          {text(resolvedObject.container_code)}
                        </CodeText>
                      }
                    />
                    <DetailField
                      label={t("inventory.trace.fieldContainerType")}
                      value={businessLabel(
                        CONTAINER_TYPE_LABELS,
                        text(resolvedObject.container_type, ""),
                        t("inventory.fallback.container"),
                      )}
                    />
                  </>
                ) : null}

                {codeTrace.resolved_type === "SKU" && resolvedObject ? (
                  <>
                    <DetailField
                      label={t("inventory.trace.fieldSkuCode")}
                      value={
                        <CodeText>
                          <SkuLink
                            id={text(resolvedObject.sku_id) || undefined}
                            code={text(resolvedObject.sku_code)}
                          />
                        </CodeText>
                      }
                    />
                    <DetailField
                      label={t("inventory.trace.fieldSkuName")}
                      value={text(resolvedObject.sku_name)}
                    />
                  </>
                ) : null}
              </DescriptionsBlock>
            ) : null}

            {activeTab === "related" && codeTrace.container_items.length > 0 ? (
              <div>
                <SectionLabel>
                  {t("inventory.trace.containerItemsTitle", {
                    count: codeTrace.container_items.length,
                  })}
                </SectionLabel>
                <InventoryRecordList
                  summaryKeys={["quantity", "status"]}
                  rows={codeTrace.container_items.map((row, index) =>
                    withRowKey(
                      row,
                      `${text(row.id ?? row.container_code, String(index))}-${index}`,
                    ),
                  )}
                  rowKey={(row) => row.__rowKey}
                  fields={containerItemColumns(t)}
                  loading={physicalCodeQuery.isFetching}
                  emptyText={t("inventory.trace.containerItemsEmpty")}
                />
              </div>
            ) : null}

            {activeTab === "related" && codeTrace.movements.length > 0 ? (
              <div>
                <SectionLabel>
                  {t("inventory.trace.movementsTitle", {
                    count: codeTrace.movements.length,
                  })}
                </SectionLabel>
                <InventoryRecordList
                  summaryKeys={["type", "quantity", "status"]}
                  rows={codeTrace.movements.map((row, index) =>
                    withRowKey(
                      row,
                      `${submittedCode ?? ""}:${text(row.id ?? row.movement_id, "")}:${index}`,
                    ),
                  )}
                  rowKey={(row) => text(row.__rowKey)}
                  fields={movementColumns(t)}
                  loading={physicalCodeQuery.isFetching}
                  emptyText={t("inventory.trace.movementsEmpty")}
                />
              </div>
            ) : null}

            {activeTab === "history" &&
            (codeTrace.warranty_history ?? []).length > 0 ? (
              <div>
                <SectionLabel>
                  {t("inventory.trace.warrantyTitle", {
                    count: codeTrace.warranty_history.length,
                  })}
                </SectionLabel>
                <Stack spacing={1.5}>
                  {codeTrace.warranty_history.map((wc, index) => {
                    const events = Array.isArray(wc.events)
                      ? (wc.events as RawRecord[])
                      : [];
                    return (
                      <Box
                        className="hn-inventory-history-card"
                        key={text(wc.warranty_case_id, String(index))}
                        sx={{
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: "var(--ops-radius-card)",
                          p: 1.5,
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={1}
                          useFlexGap
                          sx={{ alignItems: "center", flexWrap: "wrap" }}
                        >
                          <CopyableCode value={text(wc.warranty_case_code)} />
                          <UiStatusBadge
                            tone={
                              TAG_COLOR_TONES[
                                WARRANTY_STATUS_COLORS[text(wc.status, "")] ??
                                  "default"
                              ] ?? "neutral"
                            }
                            label={
                              WARRANTY_STATUS_LABELS[text(wc.status, "")] ??
                              t("inventory.fallback.status")
                            }
                          />
                          <UiText variant="caption" color={"var(--ops-muted)"}>
                            {formatDateTime(text(wc.received_at, "") || null)}
                          </UiText>
                        </Stack>
                        <dl className="hn-trace-fields">
                          <DetailField
                            label={t("inventory.trace.fieldCustomer")}
                            value={t("inventory.trace.customerValue", {
                              name: text(wc.customer_name),
                              phone: text(wc.customer_phone),
                            })}
                          />
                          <DetailField
                            label={t("inventory.trace.fieldDefect")}
                            value={text(wc.defect_name ?? wc.confirmed_defect)}
                          />
                        </dl>
                        {events.length > 0 ? (
                          <Stack spacing={0.5} sx={{ mt: 1 }}>
                            {events.map((event, eventIndex) => (
                              <UiText
                                key={text(
                                  event.warranty_event_id,
                                  String(eventIndex),
                                )}
                                variant="caption"
                                color={"var(--ops-muted)"}
                              >
                                {formatDateTime(
                                  text(event.event_at, "") || null,
                                )}{" "}
                                {/* `to_status` (RECEIVED/CHECKING…) và
                                    `event_type` (RECEIVE/UPDATE_STATUS…) đều là
                                    enum của BE — mọi dòng khác trong modal này
                                    đã đi qua bảng nhãn, riêng dòng thời gian
                                    bảo hành in thô. */}
                                —{" "}
                                {event.to_status
                                  ? businessLabel(
                                      WARRANTY_STATUS_LABELS,
                                      text(event.to_status, ""),
                                    )
                                  : businessLabel(
                                      WARRANTY_EVENT_TYPE_LABELS,
                                      text(event.event_type, ""),
                                    )}
                                {event.note ? ` (${text(event.note)})` : ""}
                              </UiText>
                            ))}
                          </Stack>
                        ) : null}
                      </Box>
                    );
                  })}
                </Stack>
              </div>
            ) : null}
          </>
        ) : null}

        {activeTab === "overview" && movement ? (
          <DescriptionsBlock title={t("inventory.trace.movementDetailTitle")}>
            <DetailField
              label={t("inventory.trace.fieldMovementCode")}
              value={
                (movement.movement_no ?? movement.code) ? (
                  <CopyableCode
                    value={text(movement.movement_no ?? movement.code)}
                  />
                ) : (
                  <CopyableId value={text(movement.id)} />
                )
              }
            />
            <DetailField
              label={t("inventory.trace.fieldTime")}
              value={formatDateTime(
                text(
                  movement.occurred_at ??
                    movement.performed_at ??
                    movement.created_at,
                  "",
                ) || null,
              )}
            />
            <DetailField
              label={t("inventory.trace.fieldMovementType")}
              value={businessLabel(
                MOVEMENT_TYPE_LABELS,
                text(movement.movement_type ?? movement.source_type, ""),
                t("inventory.fallback.movementType"),
              )}
            />
            <DetailField
              label="SKU"
              value={
                <SkuLink
                  id={text(movement.sku_id ?? movement.product_id) || undefined}
                  code={text(
                    movement.sku ??
                      movement.sku_code ??
                      movement.product_sku ??
                      movement.product_code ??
                      nested(movement, "product")?.code ??
                      nested(movement, "product")?.sku_code,
                  )}
                />
              }
            />
            <DetailField
              label={tUi("updatedUi.text_19c608bfa103")}
              value={text(
                movement.warehouse_name ??
                  movement.warehouse_code ??
                  nested(movement, "warehouse")?.name ??
                  nested(movement, "warehouse")?.code,
              )}
            />
            <DetailField
              label={t("inventory.trace.fieldQtyChange")}
              value={
                <Box
                  component="span"
                  sx={{
                    color: quantityColor(
                      nullableApiNumber(
                        movement.qty_delta ??
                          movement.qty_change ??
                          movement.quantity,
                      ),
                    ),
                    fontWeight: 600,
                  }}
                >
                  {formatQuantity(
                    nullableApiNumber(
                      movement.qty_delta ??
                        movement.qty_change ??
                        movement.quantity,
                    ),
                  )}
                </Box>
              }
            />
            <DetailField
              label={t("inventory.trace.fieldBeforeAfter")}
              value={`${text(movement.qty_before ?? movement.balance_before)} / ${text(movement.qty_after ?? movement.balance_after)}`}
            />
            <DetailField
              label={t("inventory.trace.fieldSourceDocument")}
              value={`${sourceLabel(
                text(movement.document_type ?? movement.source_type, ""),
                t,
              )} — ${text(
                movement.document_code ??
                  movement.doc_no ??
                  movement.source_code ??
                  nested(movement, "document")?.doc_no,
              )}`}
            />
          </DescriptionsBlock>
        ) : null}

        {traceQuery.isLoading ? (
          <Box sx={{ textAlign: "center", py: 2 }}>
            <UiText variant="secondary">
              {t("inventory.trace.sourceLoading")}
            </UiText>
          </Box>
        ) : null}

        {trace ? (
          <>
            {activeTab === "overview" ? (
              <DescriptionsBlock title={t("inventory.trace.sourceTitle")}>
                <DetailField
                  label={t("inventory.trace.fieldSourceType")}
                  value={sourceLabel(trace.sourceType, t)}
                />
                <DetailField
                  label={t("inventory.trace.fieldDocumentCode")}
                  value={<CopyableCode value={trace.sourceCode} />}
                />
                <DetailField
                  label={t("inventory.trace.fieldStatus")}
                  value={
                    <UiStatusBadge
                      tone={statusTone(trace.status)}
                      label={statusLabel(trace.status, t, trace.sourceType)}
                    />
                  }
                />
                <DetailField
                  label={t("inventory.trace.fieldRecordedAt")}
                  value={formatDateTime(trace.postedAt || null)}
                />
                <DetailField
                  label={t("inventory.trace.fieldOperator")}
                  value={trace.actor || EMPTY_TEXT}
                />
                {/* Không hiện request_id: đó là mã đối chiếu log kỹ thuật, không
                mang nghĩa nghiệp vụ — người dùng kho coi mọi chuỗi mã máy là lỗi
                hiển thị (phản ánh 10/09/2026). Mã chứng từ nguồn ở trên đã đủ
                để tra. */}
              </DescriptionsBlock>
            ) : null}

            {activeTab === "related" && trace.lines.length > 0 ? (
              <div>
                <SectionLabel>
                  {t("inventory.trace.linesTitle", {
                    count: trace.lines.length,
                  })}
                </SectionLabel>
                <InventoryRecordList
                  summaryKeys={["type", "quantity", "status"]}
                  rows={trace.lines.map((row, index) =>
                    withRowKey(
                      row,
                      `${text(row.id ?? row.sku ?? row.sku_code, String(index))}-${index}`,
                    ),
                  )}
                  rowKey={(row) => row.__rowKey}
                  fields={traceLineColumns(t, trace.sourceType)}
                  loading={traceQuery.isFetching}
                  emptyText={t("inventory.trace.linesEmpty")}
                />
              </div>
            ) : null}

            {activeTab === "overview" && trace.netEffect ? (
              <DescriptionsBlock title={t("inventory.trace.netEffectTitle")}>
                <DetailField
                  label={t("inventory.trace.fieldOriginalMovement")}
                  value={businessLabel(
                    MOVEMENT_TYPE_LABELS,
                    trace.netEffect.originalMovementType,
                    t("inventory.fallback.movementType"),
                  )}
                />
                <DetailField
                  label={t("inventory.trace.fieldOriginalQty")}
                  value={formatQuantity(trace.netEffect.originalQty)}
                />
                <DetailField
                  label={t("inventory.trace.fieldReversed")}
                  value={
                    <Box
                      component="span"
                      sx={{
                        color:
                          trace.netEffect.reversedQty !== null &&
                          trace.netEffect.reversedQty > 0
                            ? "var(--ops-danger)"
                            : undefined,
                        fontWeight: 600,
                      }}
                    >
                      {formatQuantity(trace.netEffect.reversedQty)}
                    </Box>
                  }
                />
                <DetailField
                  label={t("inventory.trace.fieldReversible")}
                  value={formatQuantity(trace.netEffect.remainingReversibleQty)}
                />
                <DetailField
                  label={t("inventory.trace.fieldNetEffect")}
                  value={formatQuantity(trace.netEffect.netQtyDelta)}
                />
                <DetailField
                  label={t("inventory.trace.fieldStatus")}
                  value={
                    <UiStatusBadge
                      tone={
                        trace.netEffect.fullyReversed === null ||
                        trace.netEffect.reversalCount === null
                          ? "neutral"
                          : trace.netEffect.fullyReversed
                            ? "error"
                            : "success"
                      }
                      label={
                        trace.netEffect.fullyReversed === null ||
                        trace.netEffect.reversalCount === null
                          ? t("inventory.trace.undetermined")
                          : trace.netEffect.fullyReversed
                            ? t("inventory.trace.fullyReversed")
                            : t("inventory.trace.stillEffective", {
                                count: trace.netEffect.reversalCount,
                              })
                      }
                    />
                  }
                />
              </DescriptionsBlock>
            ) : null}

            {activeTab === "history" && (trace.chain ?? []).length > 0 ? (
              <div>
                <SectionLabel>
                  {t("inventory.trace.chainTitle", {
                    count: (trace.chain ?? []).length,
                  })}
                  {trace.chainTruncated ? (
                    <Box
                      component="span"
                      sx={{
                        ml: 1,
                        fontSize: 12,
                        fontWeight: 400,
                        color: "var(--ops-danger)",
                      }}
                    >
                      {t("inventory.trace.chainTruncated")}
                    </Box>
                  ) : null}
                </SectionLabel>
                <InventoryRecordList
                  summaryKeys={["role", "type", "qty_delta"]}
                  rows={trace.chain ?? []}
                  rowKey={(row) => row.id}
                  fields={chainColumns(t)}
                  loading={traceQuery.isFetching}
                  emptyText={t("inventory.trace.chainEmpty")}
                />
              </div>
            ) : null}

            {activeTab === "history" ? (
              <div className="hn-inventory-timeline">
                <SectionLabel>
                  {t("inventory.trace.timelineTitle")}
                </SectionLabel>
                {trace.timeline.length > 0 ? (
                  <UiTimeline
                    items={trace.timeline.map((item, index) => {
                      const from = item.from_status
                        ? statusLabel(item.from_status, t, trace.sourceType)
                        : "";
                      const to = item.to_status
                        ? statusLabel(item.to_status, t, trace.sourceType)
                        : "";
                      const label =
                        from && to
                          ? `${from} → ${to}`
                          : text(
                              item.title ??
                                item.event ??
                                item.movement_no ??
                                item.code,
                              t("inventory.trace.timelineStep", {
                                index: index + 1,
                              }),
                            );
                      const time = item.created_at ?? item.changed_at;
                      const formattedTime = time
                        ? formatDateTime(String(time))
                        : EMPTY_TEXT;
                      return {
                        title: label,
                        time:
                          formattedTime === EMPTY_TEXT
                            ? undefined
                            : formattedTime,
                      };
                    })}
                  />
                ) : (
                  <UiText variant="secondary">
                    {t("inventory.trace.timelineEmpty")}
                  </UiText>
                )}
              </div>
            ) : null}
          </>
        ) : null}
        {activeTab === "related" &&
        (movement || trace || codeTrace) &&
        !(
          trace?.lines.length ||
          codeTrace?.container_items.length ||
          codeTrace?.movements.length
        ) ? (
          <p className="hn-trace-state">{t("inventory.trace.relatedEmpty")}</p>
        ) : null}
        {activeTab === "history" &&
        !trace &&
        (movement || codeTrace) &&
        !traceQuery.isLoading &&
        !(codeTrace?.warranty_history ?? []).length ? (
          <p className="hn-trace-state">{t("inventory.trace.timelineEmpty")}</p>
        ) : null}
      </Stack>
    </UiDrawer>
  );
}
