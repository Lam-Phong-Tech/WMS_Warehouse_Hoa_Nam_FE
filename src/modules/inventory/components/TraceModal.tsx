import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Grid,
  SEMANTIC_LIGHT,
  Stack,
  UiAlert,
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
import { getApiErrorMessage } from "@/shared/api/api-error";
import { CameraScanModal } from "@/shared/components/forms/CameraScanModal";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components";
import { classifyScanCodes } from "@/modules/scan/services/scanService";
import { fetchWarehouses } from "@/modules/master-data/services/warehouse.service";
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
  SOURCE_DOCUMENT_TYPE_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
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
import { ActionButton, ActionIconButton } from "@/shared/components/actions";

interface Props {
  movementId: string | null;
  onClose: () => void;
}

type RawRecord = Record<string, unknown>;

type KeyedRecord = RawRecord & { __rowKey: string };

const CARRIER_LABELS: Record<string, string> = {
  QR: "QR",
  BARCODE: "Mã vạch",
  RFID: "RFID",
};

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

function statusLabel(value: unknown): string {
  const raw = text(value, "");
  if (!raw) return "Chưa xác định";
  return (
    INBOUND_STATUS_LABELS[raw as keyof typeof INBOUND_STATUS_LABELS] ??
    OUTBOUND_STATUS_LABELS[raw as keyof typeof OUTBOUND_STATUS_LABELS] ??
    MOVEMENT_STATUS_LABELS[raw as keyof typeof MOVEMENT_STATUS_LABELS] ??
    MASTER_STATUS_LABELS[raw as keyof typeof MASTER_STATUS_LABELS] ??
    PUTAWAY_STATUS_LABELS[raw as keyof typeof PUTAWAY_STATUS_LABELS] ??
    SCAN_RESULT_LABELS[raw as keyof typeof SCAN_RESULT_LABELS] ??
    "Trạng thái khác"
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
  return (
    <Stack
      direction="row"
      spacing={0.5}
      sx={{ display: "inline-flex", alignItems: "center" }}
    >
      <CodeText>{value}</CodeText>
      <ActionIconButton
        kind="copy"
        label="Sao chép"
        onClick={() => void navigator.clipboard?.writeText(value)}
      />
    </Stack>
  );
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Grid size={{ xs: 12, md: 6 }}>
      <Box sx={{ display: "block" }}>
        <UiText variant="caption" color={SEMANTIC_LIGHT.textMedium}>
          {label}
        </UiText>
      </Box>
      <UiText variant="body">{value}</UiText>
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
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        p: 2,
      }}
    >
      <Box
        component="h6"
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

const CONTAINER_ITEM_COLUMNS: ResponsiveTableColumn<KeyedRecord>[] = [
  {
    key: "container",
    header: "Vật chứa",
    width: 160,
    render: (row) => text(row.container_code),
  },
  {
    key: "type",
    header: "Loại",
    width: 120,
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
    key: "status",
    header: "Trạng thái",
    width: 140,
    render: (row) => (
      <UiStatusBadge tone="neutral" label={statusLabel(row.status)} />
    ),
  },
];

const MOVEMENT_COLUMNS: ResponsiveTableColumn<RawRecord>[] = [
  {
    key: "movement_no",
    header: "Mã biến động",
    width: 150,
    render: (row) => <CodeText>{text(row.movement_no)}</CodeText>,
  },
  {
    key: "type",
    header: "Loại",
    width: 150,
    render: (row) => (
      <UiStatusBadge
        tone="neutral"
        label={businessLabel(
          MOVEMENT_TYPE_LABELS,
          text(row.movement_type, ""),
          "Biến động khác",
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
    header: "Số lượng",
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
    header: "Chứng từ",
    width: 130,
    render: (row) => <CodeText>{text(row.doc_no)}</CodeText>,
  },
  {
    key: "time",
    header: "Thời gian",
    width: 150,
    render: (row) =>
      formatDateTime(text(row.occurred_at ?? row.created_at, "") || null),
  },
];

const TRACE_LINE_COLUMNS: ResponsiveTableColumn<KeyedRecord>[] = [
  {
    key: "sku",
    header: "SKU",
    width: 130,
    render: (row) => {
      const product = nested(row, "product");
      return text(
        row.sku ??
          row.sku_code ??
          row.product_sku ??
          row.product_code ??
          product?.code ??
          product?.sku_code,
      );
    },
  },
  {
    key: "name",
    header: "Tên",
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
    header: "Số lượng",
    width: 100,
    align: "right",
    render: (row) =>
      formatQuantity(Number(row.quantity ?? row.qty ?? row.qty_actual ?? 0)),
  },
  {
    key: "status",
    header: "Trạng thái",
    width: 130,
    render: (row) => (
      <UiStatusBadge
        tone="neutral"
        label={statusLabel(row.status ?? row.line_status)}
      />
    ),
  },
];

const CHAIN_COLUMNS: ResponsiveTableColumn<CorrectionChainNode>[] = [
  {
    key: "role",
    header: "Vai trò",
    width: 140,
    render: (row) => (
      <UiStatusBadge
        tone={row.role === "ORIGINAL" ? "info" : "error"}
        label={businessLabel(MOVEMENT_ROLE_LABELS, row.role, "Vai trò khác")}
      />
    ),
  },
  {
    key: "movement_no",
    header: "Mã biến động",
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
    header: "Loại",
    width: 150,
    render: (row) =>
      businessLabel(MOVEMENT_TYPE_LABELS, row.movement_type, "Biến động khác"),
  },
  {
    key: "qty_delta",
    header: "Thay đổi tồn",
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
    header: "Thời điểm",
    width: 160,
    render: (row) => formatDateTime(text(row.occurred_at, "") || null),
  },
  {
    key: "actor",
    header: "Người thực hiện",
    width: 150,
    render: (row) => text(row.actor),
  },
  {
    key: "reason",
    header: "Lý do",
    render: (row) =>
      text(row.reason_text ?? row.reason_code ?? row.reversal_document_no),
  },
];

/** TRACE-01 · Truy vết mã vật lý, biến động tồn và chứng từ nguồn. */
export function TraceModal({ movementId, onClose }: Props) {
  const dialog = useDialogExit(onClose);
  const [lookupCode, setLookupCode] = useState("");
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanResolveError, setScanResolveError] = useState<string | null>(null);

  const warehousesQuery = useQuery({
    queryKey: ["inventory", "trace-warehouse"],
    queryFn: () => fetchWarehouses({ status: "ACTIVE" }),
  });
  const warehouse = warehousesQuery.data?.[0];

  const movementQuery = useStockMovement(movementId);
  const traceQuery = useStockMovementTrace(movementId);
  const physicalCodeQuery = usePhysicalCodeTrace(submittedCode);

  const movement = movementQuery.data as RawRecord | undefined;
  const trace = traceQuery.data;
  const codeTrace = physicalCodeQuery.data;

  const handleLookup = () => {
    const trimmed = lookupCode.trim();
    if (!trimmed) return;
    setScanResolveError(null);
    setSubmittedCode(trimmed);
  };

  const handleCameraDetected = async (code: string) => {
    const trimmed = code.trim();
    setCameraOpen(false);
    setScanResolveError(null);
    if (!trimmed) return;
    setLookupCode(trimmed);

    if (!warehouse?.id) {
      setSubmittedCode(trimmed);
      return;
    }

    try {
      const classified = await classifyScanCodes({
        raw_code: trimmed,
        context: "TRACE",
        warehouse_id: String(warehouse.id),
      });
      setSubmittedCode(classified.normalized_code_value || trimmed);
    } catch (error) {
      setSubmittedCode(null);
      setScanResolveError(
        getApiErrorMessage(error, "Không nhận diện được mã đã quét."),
      );
    }
  };

  const resolvedObject = codeTrace?.resolved_object as
    | RawRecord
    | null
    | undefined;
  const physicalCode = codeTrace?.physical_code as RawRecord | null | undefined;

  return (
    <UiDialog
      {...dialog.dialogProps}
      maxWidth="lg"
      fullWidth
      title={
        <Box sx={{ pr: 6 }}>
          Truy vết chứng từ nguồn
          <ActionIconButton
            kind="close"
            label="Đóng"
            onClick={dialog.close}
            sx={{ position: "absolute", right: 10, top: 8 }}
          />
        </Box>
      }
    >
      <Stack spacing={2}>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ flexWrap: "wrap", rowGap: 1.5 }}
        >
          <UiTextField
            placeholder="Mã sản phẩm / Số sê-ri / Hộp / Khay / SKU / Mã vạch / QR / RFID..."
            value={lookupCode}
            slotProps={{ htmlInput: { "aria-label": "Tra cứu mã vật lý" } }}
            onChange={(event) => setLookupCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleLookup();
            }}
            sx={{ flex: 1, minWidth: 280 }}
          />
          <ActionButton
            kind="camera"
            aria-label="Quét camera để truy vết"
            onClick={() => setCameraOpen(true)}
          >
            Quét camera
          </ActionButton>
          <ActionButton
            kind="search"
            disabled={!lookupCode.trim()}
            onClick={handleLookup}
          >
            Tra cứu
          </ActionButton>
        </Stack>

        <CameraScanModal
          open={cameraOpen}
          title="Quét mã để truy vết"
          onDetected={(code) => void handleCameraDetected(code)}
          onClose={() => setCameraOpen(false)}
        />

        {scanResolveError ? (
          <UiAlert tone="warning">{scanResolveError}</UiAlert>
        ) : null}

        {!movementId && !submittedCode ? (
          <UiText variant="secondary">
            Chọn một biến động tồn kho từ danh sách hoặc nhập mã vật lý để truy
            vết.
          </UiText>
        ) : null}

        {physicalCodeQuery.isError ? (
          <ApiErrorAlert
            error={physicalCodeQuery.error}
            title="Không tìm thấy mã vật lý"
            onRetry={() => physicalCodeQuery.refetch()}
          />
        ) : null}

        {physicalCodeQuery.isLoading ? (
          <Box sx={{ textAlign: "center", py: 2 }}>
            <UiText variant="secondary">Đang tra cứu mã vật lý...</UiText>
          </Box>
        ) : null}

        {codeTrace ? (
          <>
            <DescriptionsBlock title="Kết quả tra cứu mã vật lý">
              <DetailField
                label="Mã vật lý"
                value={<CopyableCode value={text(physicalCode?.code_value)} />}
              />
              <DetailField
                label="Loại mã"
                value={
                  <UiStatusBadge
                    tone="neutral"
                    label={
                      CARRIER_LABELS[text(physicalCode?.carrier_type, "")] ??
                      "Loại mã khác"
                    }
                  />
                }
              />
              <DetailField
                label="Đối tượng gắn"
                value={
                  <UiStatusBadge
                    tone="info"
                    label={businessLabel(
                      SCAN_CLASSIFICATION_LABELS,
                      codeTrace.resolved_type,
                      "Đối tượng khác",
                    )}
                  />
                }
              />
              <DetailField
                label="Trạng thái"
                value={
                  <UiStatusBadge
                    tone={
                      text(physicalCode?.status, "") === "ACTIVE"
                        ? "success"
                        : "neutral"
                    }
                    label={statusLabel(physicalCode?.status)}
                  />
                }
              />

              {codeTrace.resolved_type === "ITEM" && resolvedObject ? (
                <>
                  <DetailField
                    label="SKU"
                    value={
                      <>
                        <CodeText>{text(resolvedObject.sku_code)}</CodeText>{" "}
                        {text(resolvedObject.sku_name)}
                      </>
                    }
                  />
                  <DetailField
                    label="Trạng thái sản phẩm"
                    value={
                      <UiStatusBadge
                        tone="neutral"
                        label={businessLabel(
                          ITEM_STATUS_LABELS,
                          text(
                            resolvedObject.status ?? resolvedObject.item_status,
                            "",
                          ),
                          "Trạng thái khác",
                        )}
                      />
                    }
                  />
                </>
              ) : null}

              {codeTrace.resolved_type === "CONTAINER" && resolvedObject ? (
                <>
                  <DetailField
                    label="Mã vật chứa"
                    value={
                      <CodeText>{text(resolvedObject.container_code)}</CodeText>
                    }
                  />
                  <DetailField
                    label="Loại vật chứa"
                    value={
                      <UiStatusBadge
                        tone="neutral"
                        label={businessLabel(
                          CONTAINER_TYPE_LABELS,
                          text(resolvedObject.container_type, ""),
                          "Vật chứa khác",
                        )}
                      />
                    }
                  />
                </>
              ) : null}

              {codeTrace.resolved_type === "SKU" && resolvedObject ? (
                <>
                  <DetailField
                    label="Mã SKU"
                    value={<CodeText>{text(resolvedObject.sku_code)}</CodeText>}
                  />
                  <DetailField
                    label="Tên SKU"
                    value={text(resolvedObject.sku_name)}
                  />
                </>
              ) : null}
            </DescriptionsBlock>

            {codeTrace.container_items.length > 0 ? (
              <div>
                <SectionLabel>
                  {`Sản phẩm trong vật chứa (${codeTrace.container_items.length})`}
                </SectionLabel>
                <ResponsiveDataTable
                  rows={codeTrace.container_items.map((row, index) =>
                    withRowKey(
                      row,
                      `${text(row.id ?? row.container_code, String(index))}-${index}`,
                    ),
                  )}
                  rowKey={(row) => row.__rowKey}
                  columns={CONTAINER_ITEM_COLUMNS}
                  loading={physicalCodeQuery.isFetching}
                  emptyText="Chưa có sản phẩm nào trong vật chứa này"
                />
              </div>
            ) : null}

            {codeTrace.movements.length > 0 ? (
              <div>
                <SectionLabel>
                  {`Lịch sử biến động (${codeTrace.movements.length})`}
                </SectionLabel>
                <ResponsiveDataTable
                  rows={codeTrace.movements}
                  rowKey={(row) => text(row.id, String(Math.random()))}
                  columns={MOVEMENT_COLUMNS}
                  loading={physicalCodeQuery.isFetching}
                  emptyText="Chưa có giao dịch nào cho mã này"
                />
              </div>
            ) : null}

            {(codeTrace.warranty_history ?? []).length > 0 ? (
              <div>
                <SectionLabel>
                  {`Lịch sử bảo hành (${codeTrace.warranty_history.length})`}
                </SectionLabel>
                <Stack spacing={1.5}>
                  {codeTrace.warranty_history.map((wc, index) => {
                    const events = Array.isArray(wc.events)
                      ? (wc.events as RawRecord[])
                      : [];
                    return (
                      <Box
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
                              "Trạng thái khác"
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
                            label="Khách hàng"
                            value={`${text(wc.customer_name)} · ${text(wc.customer_phone)}`}
                          />
                          <DetailField
                            label="Lỗi/bệnh"
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
                                —{" "}
                                {text(event.to_status ?? event.event_type)}
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

        {movementQuery.isError ? (
          <ApiErrorAlert
            error={movementQuery.error}
            title="Không thể tải chi tiết biến động"
            onRetry={() => movementQuery.refetch()}
          />
        ) : null}

        {movement ? (
          <DescriptionsBlock title="Chi tiết biến động">
            <DetailField
              label="Mã biến động"
              value={
                movement.movement_no ?? movement.code ? (
                  <CopyableCode
                    value={text(movement.movement_no ?? movement.code)}
                  />
                ) : (
                  <CopyableId value={text(movement.id)} />
                )
              }
            />
            <DetailField
              label="Thời gian"
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
              label="Loại biến động"
              value={
                <UiStatusBadge
                  tone="neutral"
                  label={businessLabel(
                    MOVEMENT_TYPE_LABELS,
                    text(movement.movement_type ?? movement.source_type, ""),
                    "Biến động khác",
                  )}
                />
              }
            />
            <DetailField
              label="SKU"
              value={text(
                movement.sku ??
                  movement.sku_code ??
                  movement.product_sku ??
                  movement.product_code ??
                  nested(movement, "product")?.code ??
                  nested(movement, "product")?.sku_code,
              )}
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
              label="Số lượng thay đổi"
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
              label="Tồn trước / sau"
              value={`${text(movement.qty_before ?? movement.balance_before)} / ${text(movement.qty_after ?? movement.balance_after)}`}
            />
            <DetailField
              label="Chứng từ nguồn"
              value={`${businessLabel(
                SOURCE_DOCUMENT_TYPE_LABELS,
                text(movement.document_type ?? movement.source_type, ""),
                "Nguồn khác",
              )} — ${text(
                movement.document_code ??
                  movement.doc_no ??
                  movement.source_code ??
                  nested(movement, "document")?.doc_no,
              )}`}
            />
          </DescriptionsBlock>
        ) : null}

        {traceQuery.isError ? (
          <ApiErrorAlert
            error={traceQuery.error}
            title="Không thể truy vết chứng từ nguồn"
            onRetry={() => traceQuery.refetch()}
          />
        ) : null}

        {traceQuery.isLoading ? (
          <Box sx={{ textAlign: "center", py: 2 }}>
            <UiText variant="secondary">Đang tải dữ liệu truy vết...</UiText>
          </Box>
        ) : null}

        {trace ? (
          <>
            <DescriptionsBlock title="Chứng từ nguồn">
              <DetailField
                label="Loại nguồn"
                value={
                  <UiStatusBadge
                    tone="neutral"
                    label={businessLabel(
                      SOURCE_DOCUMENT_TYPE_LABELS,
                      trace.sourceType,
                      "Nguồn khác",
                    )}
                  />
                }
              />
              <DetailField
                label="Mã chứng từ"
                value={<CopyableCode value={trace.sourceCode} />}
              />
              <DetailField
                label="Trạng thái"
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
                    label={statusLabel(trace.status)}
                  />
                }
              />
              <DetailField
                label="Thời điểm ghi nhận"
                value={formatDateTime(trace.postedAt || null)}
              />
              <DetailField
                label="Người thao tác"
                value={trace.actor || EMPTY_TEXT}
              />
              {/* request_id là UUID đối chiếu log (không có mã nghiệp vụ) — màn
                truy vết vẫn cần nó để báo kỹ thuật, nhưng hiển thị rút gọn +
                nút sao chép giá trị đầy đủ thay vì in nguyên chuỗi thô. */}
              <DetailField
                label="Mã yêu cầu kỹ thuật"
                value={
                  trace.requestId ? (
                    <CopyableId value={trace.requestId} />
                  ) : (
                    "-"
                  )
                }
              />
            </DescriptionsBlock>

            {trace.lines.length > 0 ? (
              <div>
                <SectionLabel>{`Dòng chứng từ (${trace.lines.length})`}</SectionLabel>
                <ResponsiveDataTable
                  rows={trace.lines.map((row, index) =>
                    withRowKey(
                      row,
                      `${text(row.id ?? row.sku ?? row.sku_code, String(index))}-${index}`,
                    ),
                  )}
                  rowKey={(row) => row.__rowKey}
                  columns={TRACE_LINE_COLUMNS}
                  loading={traceQuery.isFetching}
                  emptyText="Chưa có dòng chứng từ nào"
                />
              </div>
            ) : null}

            {trace.netEffect ? (
              <DescriptionsBlock title="Tác động tồn kho sau điều chỉnh">
                <DetailField
                  label="Giao dịch gốc"
                  value={
                    <UiStatusBadge
                      tone="neutral"
                      label={businessLabel(
                        MOVEMENT_TYPE_LABELS,
                        trace.netEffect.originalMovementType,
                        "Biến động khác",
                      )}
                    />
                  }
                />
                <DetailField
                  label="Số lượng gốc"
                  value={formatQuantity(trace.netEffect.originalQty)}
                />
                <DetailField
                  label="Đã điều chỉnh"
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
                  label="Còn điều chỉnh được"
                  value={formatQuantity(
                    trace.netEffect.remainingReversibleQty,
                  )}
                />
                <DetailField
                  label="Tác động ròng"
                  value={formatQuantity(trace.netEffect.netQtyDelta)}
                />
                <DetailField
                  label="Trạng thái"
                  value={
                    <UiStatusBadge
                      tone={trace.netEffect.fullyReversed ? "error" : "success"}
                      label={
                        trace.netEffect.fullyReversed
                          ? "Đã điều chỉnh toàn bộ"
                          : `Còn hiệu lực (${trace.netEffect.reversalCount} lần điều chỉnh)`
                      }
                    />
                  }
                />
              </DescriptionsBlock>
            ) : null}

            {(trace.chain ?? []).length > 0 ? (
              <div>
                <SectionLabel>
                  {`Chuỗi điều chỉnh (${(trace.chain ?? []).length} bút toán)`}
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
                      · chuỗi quá dài, đã rút gọn
                    </Box>
                  ) : null}
                </SectionLabel>
                <ResponsiveDataTable
                  rows={trace.chain ?? []}
                  rowKey={(row) => row.id}
                  columns={CHAIN_COLUMNS}
                  loading={traceQuery.isFetching}
                  emptyText="Chưa có bút toán điều chỉnh nào"
                />
              </div>
            ) : null}

            <div>
              <SectionLabel>Diễn biến</SectionLabel>
              {trace.timeline.length > 0 ? (
                <UiTimeline
                  items={trace.timeline.map((item, index) => {
                    const from = item.from_status
                      ? statusLabel(item.from_status)
                      : "";
                    const to = item.to_status
                      ? statusLabel(item.to_status)
                      : "";
                    const label =
                      from && to
                        ? `${from} → ${to}`
                        : text(
                            item.title ??
                              item.event ??
                              item.movement_no ??
                              item.code,
                            `Bước ${index + 1}`,
                          );
                    const time = item.created_at ?? item.changed_at;
                    const formattedTime = time
                      ? formatDateTime(String(time))
                      : EMPTY_TEXT;
                    return {
                      title: label,
                      time:
                        formattedTime === EMPTY_TEXT ? undefined : formattedTime,
                    };
                  })}
                />
              ) : (
                <UiText variant="secondary">
                  Chưa có dữ liệu diễn biến để hiển thị.
                </UiText>
              )}
            </div>
          </>
        ) : null}
      </Stack>
    </UiDialog>
  );
}
