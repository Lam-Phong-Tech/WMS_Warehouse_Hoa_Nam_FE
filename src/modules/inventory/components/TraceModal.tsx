import { useState, type CSSProperties, type ReactNode } from "react";
import {
  Box,
  Grid,
  SEMANTIC_LIGHT,
  Stack,
  UiDialog,
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
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components";
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
import { ActionButton, ActionIconButton } from "@/shared/components/actions";

interface Props {
  movementId: string | null;
  onClose: () => void;
}

const INVENTORY_DIALOG_TABLE_HEADER_STYLE: CSSProperties = {
  background: "var(--invd-pale)",
  color: "var(--invd-heading)",
  fontSize: 12,
  padding: "10px 9px",
  borderBottom: "1px solid var(--invd-line)",
};

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

function statusLabel(value: unknown, t: TranslateFn): string {
  const raw = text(value, "");
  if (!raw) return t("inventory.trace.undetermined");
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

function withRowKey(row: RawRecord, rowKey: string) {
  return { ...row, __rowKey: rowKey } as KeyedRecord;
}

/** Thay AntTypography.Text `code`: chữ monospace nền soft từ token. */
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
          fontFamily: "monospace",
          fontSize: 13,
          px: 0.5,
          borderRadius: 1,
          backgroundColor: SEMANTIC_LIGHT.secondarySoft,
          color: SEMANTIC_LIGHT.textHigh,
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
    <Grid size={{ xs: 12, md: 6 }} className="hn-inventory-detail-field">
      <Box sx={{ display: "block" }}>
        <UiText variant="caption" color={SEMANTIC_LIGHT.textMedium}>
          {label}
        </UiText>
      </Box>
      <UiText variant="body" className="hn-inventory-detail-value">
        {value}
      </UiText>
    </Grid>
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
    <Box
      className="hn-inventory-detail-panel"
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        p: 2,
      }}
    >
      <Box
        component="h6"
        className="hn-inventory-section-title"
        sx={{
          m: 0,
          mb: 1.5,
          fontSize: 14,
          fontWeight: 700,
          color: SEMANTIC_LIGHT.textHigh,
        }}
      >
        {title}
      </Box>
      <Grid container spacing={2}>
        {children}
      </Grid>
    </Box>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Box
      component="h6"
      className="hn-inventory-section-title"
      sx={{
        m: 0,
        mb: 1,
        fontSize: 14,
        fontWeight: 700,
        color: SEMANTIC_LIGHT.textHigh,
      }}
    >
      {children}
    </Box>
  );
}

const containerItemColumns = (
  t: TranslateFn,
): ResponsiveTableColumn<KeyedRecord>[] => [
  {
    key: "container",
    header: t("inventory.trace.colContainer"),
    width: 160,
    render: (row) => text(row.container_code),
  },
  {
    key: "type",
    header: t("inventory.trace.colType"),
    width: 120,
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
    header: t("inventory.trace.colQty"),
    width: 100,
    align: "right",
    render: (row) => formatQuantity(Number(row.quantity ?? 0)),
  },
  {
    key: "status",
    header: t("inventory.trace.colStatus"),
    width: 140,
    render: (row) => (
      <UiStatusBadge tone="neutral" label={statusLabel(row.status, t)} />
    ),
  },
];

const movementColumns = (
  t: TranslateFn,
): ResponsiveTableColumn<RawRecord>[] => [
  {
    key: "movement_no",
    header: t("inventory.trace.colMovementCode"),
    width: 150,
    render: (row) => <CodeText>{text(row.movement_no)}</CodeText>,
  },
  {
    key: "type",
    header: t("inventory.trace.colType"),
    width: 150,
    render: (row) => (
      <UiStatusBadge
        tone="neutral"
        label={businessLabel(
          MOVEMENT_TYPE_LABELS,
          text(row.movement_type, ""),
          t("inventory.fallback.movementType"),
        )}
      />
    ),
  },
  {
    key: "sku",
    header: "SKU",
    width: 100,
    render: (row) => text(row.product_code),
  },
  {
    key: "quantity",
    header: t("inventory.trace.colQty"),
    width: 100,
    align: "right",
    render: (row) => {
      const qty = Number(row.qty_delta ?? row.quantity ?? 0);
      return (
        <Box
          component="span"
          sx={{
            color:
              qty >= 0 ? SEMANTIC_LIGHT.successText : SEMANTIC_LIGHT.errorText,
            fontWeight: 600,
          }}
        >
          {qty >= 0 ? `+${formatQuantity(qty)}` : formatQuantity(qty)}
        </Box>
      );
    },
  },
  {
    key: "doc",
    header: t("inventory.trace.colDocument"),
    width: 130,
    render: (row) => <CodeText>{text(row.doc_no)}</CodeText>,
  },
  {
    key: "time",
    header: t("inventory.trace.colTime"),
    width: 150,
    render: (row) =>
      formatDateTime(text(row.occurred_at ?? row.created_at, "") || null),
  },
];

const traceLineColumns = (
  t: TranslateFn,
): ResponsiveTableColumn<KeyedRecord>[] => [
  {
    key: "sku",
    header: "SKU",
    width: 130,
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
    width: 180,
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
    width: 100,
    align: "right",
    render: (row) =>
      formatQuantity(Number(row.quantity ?? row.qty ?? row.qty_actual ?? 0)),
  },
  {
    key: "status",
    header: t("inventory.trace.colStatus"),
    width: 130,
    render: (row) => (
      <UiStatusBadge
        tone="neutral"
        label={statusLabel(row.status ?? row.line_status, t)}
      />
    ),
  },
];

const chainColumns = (
  t: TranslateFn,
): ResponsiveTableColumn<CorrectionChainNode>[] => [
  {
    key: "role",
    header: t("inventory.trace.colRole"),
    width: 140,
    render: (row) => (
      <UiStatusBadge
        tone={row.role === "ORIGINAL" ? "info" : "error"}
        label={businessLabel(
          MOVEMENT_ROLE_LABELS,
          row.role,
          t("inventory.fallback.movementRole"),
        )}
      />
    ),
  },
  {
    key: "movement_no",
    header: t("inventory.trace.colMovementCode"),
    width: 170,
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
    key: "type",
    header: t("inventory.trace.colType"),
    width: 150,
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
    width: 110,
    align: "right",
    render: (row) => (
      <Box
        component="span"
        sx={{
          color:
            row.qty_delta >= 0
              ? SEMANTIC_LIGHT.successText
              : SEMANTIC_LIGHT.errorText,
          fontWeight: 600,
        }}
      >
        {formatQuantity(Number(row.qty_delta))}
      </Box>
    ),
  },
  {
    key: "occurred_at",
    header: t("inventory.trace.colMoment"),
    width: 160,
    render: (row) => formatDateTime(text(row.occurred_at, "") || null),
  },
  {
    key: "actor",
    header: t("inventory.trace.colPerformedBy"),
    width: 150,
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
export function TraceModal({ movementId, onClose }: Props) {
  const t = useT();
  const dialog = useDialogExit(onClose);
  const [lookupCode, setLookupCode] = useState("");
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);

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
  };

  const resolvedObject = codeTrace?.resolved_object as
    | RawRecord
    | null
    | undefined;
  const physicalCode = codeTrace?.physical_code as RawRecord | null | undefined;

  return (
    <UiDialog
      {...dialog.dialogProps}
      className="hn-inventory-dialog"
      maxWidth="lg"
      fullWidth
      title={
        <Box sx={{ position: "relative", pr: 6 }}>
          {t("inventory.trace.title")}
          <ActionIconButton
            className="hn-inventory-dialog-close"
            kind="close"
            label={t("common.close")}
            onClick={dialog.close}
            sx={{ position: "absolute", right: 10, top: 8 }}
          />
        </Box>
      }
    >
      <Stack spacing={2} className="hn-inventory-dialog-body">
        <Stack className="hn-inventory-lookup">
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

        {codeTrace ? (
          <>
            <DescriptionsBlock title={t("inventory.trace.resultTitle")}>
              <DetailField
                label={t("inventory.trace.fieldPhysicalCode")}
                value={<CopyableCode value={text(physicalCode?.code_value)} />}
              />
              <DetailField
                label={t("inventory.trace.fieldCodeType")}
                value={
                  <UiStatusBadge
                    tone="neutral"
                    label={carrierLabel(
                      text(physicalCode?.carrier_type, ""),
                      t,
                    )}
                  />
                }
              />
              <DetailField
                label={t("inventory.trace.fieldBoundObject")}
                value={
                  <UiStatusBadge
                    tone="info"
                    label={businessLabel(
                      SCAN_CLASSIFICATION_LABELS,
                      codeTrace.resolved_type,
                      t("inventory.fallback.object"),
                    )}
                  />
                }
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
                    value={
                      <UiStatusBadge
                        tone="neutral"
                        label={businessLabel(
                          ITEM_STATUS_LABELS,
                          text(
                            resolvedObject.status ?? resolvedObject.item_status,
                            "",
                          ),
                          t("inventory.fallback.status"),
                        )}
                      />
                    }
                  />
                </>
              ) : null}

              {codeTrace.resolved_type === "CONTAINER" && resolvedObject ? (
                <>
                  <DetailField
                    label={t("inventory.trace.fieldContainerCode")}
                    value={
                      <CodeText>{text(resolvedObject.container_code)}</CodeText>
                    }
                  />
                  <DetailField
                    label={t("inventory.trace.fieldContainerType")}
                    value={
                      <UiStatusBadge
                        tone="neutral"
                        label={businessLabel(
                          CONTAINER_TYPE_LABELS,
                          text(resolvedObject.container_type, ""),
                          t("inventory.fallback.container"),
                        )}
                      />
                    }
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

            {codeTrace.container_items.length > 0 ? (
              <div>
                <SectionLabel>
                  {t("inventory.trace.containerItemsTitle", {
                    count: codeTrace.container_items.length,
                  })}
                </SectionLabel>
                <ResponsiveDataTable
                  headerCellStyle={INVENTORY_DIALOG_TABLE_HEADER_STYLE}
                  maxBodyHeight="clamp(240px, 45dvh, 520px)"
                  rows={codeTrace.container_items.map((row, index) =>
                    withRowKey(
                      row,
                      `${text(row.id ?? row.container_code, String(index))}-${index}`,
                    ),
                  )}
                  rowKey={(row) => row.__rowKey}
                  columns={containerItemColumns(t)}
                  loading={physicalCodeQuery.isFetching}
                  emptyText={t("inventory.trace.containerItemsEmpty")}
                />
              </div>
            ) : null}

            {codeTrace.movements.length > 0 ? (
              <div>
                <SectionLabel>
                  {t("inventory.trace.movementsTitle", {
                    count: codeTrace.movements.length,
                  })}
                </SectionLabel>
                <ResponsiveDataTable
                  headerCellStyle={INVENTORY_DIALOG_TABLE_HEADER_STYLE}
                  maxBodyHeight="clamp(240px, 45dvh, 520px)"
                  rows={codeTrace.movements}
                  rowKey={(row) => text(row.id, String(Math.random()))}
                  columns={movementColumns(t)}
                  loading={physicalCodeQuery.isFetching}
                  emptyText={t("inventory.trace.movementsEmpty")}
                />
              </div>
            ) : null}

            {(codeTrace.warranty_history ?? []).length > 0 ? (
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
                          borderRadius: 2,
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
                          <UiText
                            variant="caption"
                            color={SEMANTIC_LIGHT.textMedium}
                          >
                            {formatDateTime(text(wc.received_at, "") || null)}
                          </UiText>
                        </Stack>
                        <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
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
                        </Grid>
                        {events.length > 0 ? (
                          <Stack spacing={0.5} sx={{ mt: 1 }}>
                            {events.map((event, eventIndex) => (
                              <UiText
                                key={text(
                                  event.warranty_event_id,
                                  String(eventIndex),
                                )}
                                variant="caption"
                                color={SEMANTIC_LIGHT.textMedium}
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

        {movement ? (
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
              value={
                <UiStatusBadge
                  tone="neutral"
                  label={businessLabel(
                    MOVEMENT_TYPE_LABELS,
                    text(movement.movement_type ?? movement.source_type, ""),
                    t("inventory.fallback.movementType"),
                  )}
                />
              }
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
              label="Kho"
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
                    color:
                      Number(movement.qty_change ?? movement.quantity ?? 0) >= 0
                        ? SEMANTIC_LIGHT.successText
                        : SEMANTIC_LIGHT.errorText,
                    fontWeight: 600,
                  }}
                >
                  {formatQuantity(
                    Number(movement.qty_change ?? movement.quantity ?? 0),
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
              value={`${businessLabel(
                SOURCE_DOCUMENT_TYPE_LABELS,
                text(movement.document_type ?? movement.source_type, ""),
                t("inventory.fallback.source"),
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
            <DescriptionsBlock title={t("inventory.trace.sourceTitle")}>
              <DetailField
                label={t("inventory.trace.fieldSourceType")}
                value={
                  <UiStatusBadge
                    tone="neutral"
                    label={businessLabel(
                      SOURCE_DOCUMENT_TYPE_LABELS,
                      trace.sourceType,
                      t("inventory.fallback.source"),
                    )}
                  />
                }
              />
              <DetailField
                label={t("inventory.trace.fieldDocumentCode")}
                value={<CopyableCode value={trace.sourceCode} />}
              />
              <DetailField
                label={t("inventory.trace.fieldStatus")}
                value={
                  <UiStatusBadge
                    tone={
                      trace.status === "POSTED" || trace.status === "CLOSED"
                        ? "success"
                        : trace.status === "CANCELLED" ||
                            trace.status === "REVERSED"
                          ? "error"
                          : "info"
                    }
                    label={statusLabel(trace.status, t)}
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

            {trace.lines.length > 0 ? (
              <div>
                <SectionLabel>
                  {t("inventory.trace.linesTitle", {
                    count: trace.lines.length,
                  })}
                </SectionLabel>
                <ResponsiveDataTable
                  headerCellStyle={INVENTORY_DIALOG_TABLE_HEADER_STYLE}
                  maxBodyHeight="clamp(240px, 45dvh, 520px)"
                  rows={trace.lines.map((row, index) =>
                    withRowKey(
                      row,
                      `${text(row.id ?? row.sku ?? row.sku_code, String(index))}-${index}`,
                    ),
                  )}
                  rowKey={(row) => row.__rowKey}
                  columns={traceLineColumns(t)}
                  loading={traceQuery.isFetching}
                  emptyText={t("inventory.trace.linesEmpty")}
                />
              </div>
            ) : null}

            {trace.netEffect ? (
              <DescriptionsBlock title={t("inventory.trace.netEffectTitle")}>
                <DetailField
                  label={t("inventory.trace.fieldOriginalMovement")}
                  value={
                    <UiStatusBadge
                      tone="neutral"
                      label={businessLabel(
                        MOVEMENT_TYPE_LABELS,
                        trace.netEffect.originalMovementType,
                        t("inventory.fallback.movementType"),
                      )}
                    />
                  }
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
                          trace.netEffect.reversedQty > 0
                            ? SEMANTIC_LIGHT.errorText
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
                      tone={trace.netEffect.fullyReversed ? "error" : "success"}
                      label={
                        trace.netEffect.fullyReversed
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

            {(trace.chain ?? []).length > 0 ? (
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
                        color: SEMANTIC_LIGHT.error,
                      }}
                    >
                      {t("inventory.trace.chainTruncated")}
                    </Box>
                  ) : null}
                </SectionLabel>
                <ResponsiveDataTable
                  headerCellStyle={INVENTORY_DIALOG_TABLE_HEADER_STYLE}
                  maxBodyHeight="clamp(240px, 45dvh, 520px)"
                  rows={trace.chain ?? []}
                  rowKey={(row) => row.id}
                  columns={chainColumns(t)}
                  loading={traceQuery.isFetching}
                  emptyText={t("inventory.trace.chainEmpty")}
                />
              </div>
            ) : null}

            <div className="hn-inventory-timeline">
              <SectionLabel>{t("inventory.trace.timelineTitle")}</SectionLabel>
              {trace.timeline.length > 0 ? (
                <UiTimeline
                  items={trace.timeline.map((item, index) => {
                    const from = item.from_status
                      ? statusLabel(item.from_status, t)
                      : "";
                    const to = item.to_status
                      ? statusLabel(item.to_status, t)
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
          </>
        ) : null}
      </Stack>
    </UiDialog>
  );
}
