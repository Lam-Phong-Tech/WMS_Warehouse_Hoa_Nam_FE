import { useState, type ReactNode } from "react";
import { Table, Tag, Typography as AntTypography } from "antd";
import {
  Alert,
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { CameraScanModal } from "@/shared/components/forms/CameraScanModal";
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
import {
  useStockMovement,
  useStockMovementTrace,
  usePhysicalCodeTrace,
} from "../hooks/use-inventory";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";

interface Props {
  movementId: string | null;
  onClose: () => void;
}

type RawRecord = Record<string, unknown>;

const CARRIER_LABELS: Record<string, string> = {
  QR: "QR",
  BARCODE: "Mã vạch",
  RFID: "RFID",
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
  return { ...row, __rowKey: rowKey } as RawRecord & { __rowKey: string };
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
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
        {title}
      </Typography>
      <Grid container spacing={2}>
        {children}
      </Grid>
    </Box>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
      {children}
    </Typography>
  );
}

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
    <>
      <Dialog {...dialog.dialogProps} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ pr: 6, position: "relative" }}>
          Truy vết chứng từ nguồn
          <ActionIconButton
            kind="close"
            label="Đóng"
            onClick={dialog.close}
            sx={{ position: "absolute", right: 10, top: 8 }}
          />
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ flexWrap: "wrap", rowGap: 1.5 }}
            >
              <TextField
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
              <Alert severity="warning">{scanResolveError}</Alert>
            ) : null}

            {!movementId && !submittedCode ? (
              <Typography variant="body2" color="text.secondary">
                Chọn một biến động tồn kho từ danh sách hoặc nhập mã vật lý để
                truy vết.
              </Typography>
            ) : null}

            {physicalCodeQuery.isError ? (
              <ApiErrorAlert
                error={physicalCodeQuery.error}
                title="Không tìm thấy mã vật lý"
                onRetry={() => physicalCodeQuery.refetch()}
              />
            ) : null}

            {physicalCodeQuery.isLoading ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: "center", py: 2 }}
              >
                Đang tra cứu mã vật lý...
              </Typography>
            ) : null}

            {codeTrace ? (
              <>
                <DescriptionsBlock title="Kết quả tra cứu mã vật lý">
                  <DetailField
                    label="Mã vật lý"
                    value={
                      <AntTypography.Text code copyable>
                        {text(physicalCode?.code_value)}
                      </AntTypography.Text>
                    }
                  />
                  <DetailField
                    label="Loại mã"
                    value={
                      <Tag>
                        {CARRIER_LABELS[text(physicalCode?.carrier_type, "")] ??
                          "Loại mã khác"}
                      </Tag>
                    }
                  />
                  <DetailField
                    label="Đối tượng gắn"
                    value={
                      <Tag color="blue">
                        {businessLabel(
                          SCAN_CLASSIFICATION_LABELS,
                          codeTrace.resolved_type,
                          "Đối tượng khác",
                        )}
                      </Tag>
                    }
                  />
                  <DetailField
                    label="Trạng thái"
                    value={
                      <Tag
                        color={
                          text(physicalCode?.status, "") === "ACTIVE"
                            ? "success"
                            : "default"
                        }
                      >
                        {statusLabel(physicalCode?.status)}
                      </Tag>
                    }
                  />

                  {codeTrace.resolved_type === "ITEM" && resolvedObject ? (
                    <>
                      <DetailField
                        label="SKU"
                        value={
                          <>
                            <AntTypography.Text code>
                              {text(resolvedObject.sku_code)}
                            </AntTypography.Text>{" "}
                            {text(resolvedObject.sku_name)}
                          </>
                        }
                      />
                      <DetailField
                        label="Trạng thái sản phẩm"
                        value={
                          <Tag>
                            {businessLabel(
                              ITEM_STATUS_LABELS,
                              text(
                                resolvedObject.status ??
                                  resolvedObject.item_status,
                                "",
                              ),
                              "Trạng thái khác",
                            )}
                          </Tag>
                        }
                      />
                    </>
                  ) : null}

                  {codeTrace.resolved_type === "CONTAINER" && resolvedObject ? (
                    <>
                      <DetailField
                        label="Mã vật chứa"
                        value={
                          <AntTypography.Text code>
                            {text(resolvedObject.container_code)}
                          </AntTypography.Text>
                        }
                      />
                      <DetailField
                        label="Loại vật chứa"
                        value={
                          <Tag>
                            {businessLabel(
                              CONTAINER_TYPE_LABELS,
                              text(resolvedObject.container_type, ""),
                              "Vật chứa khác",
                            )}
                          </Tag>
                        }
                      />
                    </>
                  ) : null}

                  {codeTrace.resolved_type === "SKU" && resolvedObject ? (
                    <>
                      <DetailField
                        label="Mã SKU"
                        value={
                          <AntTypography.Text code>
                            {text(resolvedObject.sku_code)}
                          </AntTypography.Text>
                        }
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
                    <Table
                      size="small"
                      dataSource={codeTrace.container_items.map((row, index) =>
                        withRowKey(
                          row,
                          `${text(row.id ?? row.container_code, String(index))}-${index}`,
                        ),
                      )}
                      rowKey="__rowKey"
                      pagination={false}
                      scroll={{ x: "max-content" }}
                      columns={[
                        {
                          title: "Vật chứa",
                          width: 160,
                          render: (_, row) => text(row.container_code),
                        },
                        {
                          title: "Loại",
                          width: 120,
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
                          render: (_, row) =>
                            Number(row.quantity ?? 0).toLocaleString("vi-VN"),
                        },
                        {
                          title: "Trạng thái",
                          width: 140,
                          render: (_, row) => (
                            <Tag>{statusLabel(row.status)}</Tag>
                          ),
                        },
                      ]}
                    />
                  </div>
                ) : null}

                {codeTrace.movements.length > 0 ? (
                  <div>
                    <SectionLabel>
                      {`Lịch sử biến động (${codeTrace.movements.length})`}
                    </SectionLabel>
                    <Table
                      size="small"
                      dataSource={codeTrace.movements}
                      rowKey={(row) => text(row.id, String(Math.random()))}
                      pagination={false}
                      scroll={{ x: "max-content" }}
                      columns={[
                        {
                          title: "Mã biến động",
                          width: 150,
                          render: (_, row) => (
                            <AntTypography.Text code>
                              {text(row.movement_no)}
                            </AntTypography.Text>
                          ),
                        },
                        {
                          title: "Loại",
                          width: 150,
                          render: (_, row) => (
                            <Tag>
                              {businessLabel(
                                MOVEMENT_TYPE_LABELS,
                                text(row.movement_type, ""),
                                "Biến động khác",
                              )}
                            </Tag>
                          ),
                        },
                        {
                          title: "SKU",
                          width: 100,
                          render: (_, row) => text(row.product_code),
                        },
                        {
                          title: "Số lượng",
                          width: 100,
                          align: "right",
                          render: (_, row) => {
                            const qty = Number(
                              row.qty_delta ?? row.quantity ?? 0,
                            );
                            return (
                              <AntTypography.Text
                                style={{
                                  color: qty >= 0 ? "#237804" : "#cf1322",
                                  fontWeight: 600,
                                }}
                              >
                                {qty >= 0
                                  ? `+${qty.toLocaleString("vi-VN")}`
                                  : qty.toLocaleString("vi-VN")}
                              </AntTypography.Text>
                            );
                          },
                        },
                        {
                          title: "Chứng từ",
                          width: 130,
                          render: (_, row) => (
                            <AntTypography.Text code>
                              {text(row.doc_no)}
                            </AntTypography.Text>
                          ),
                        },
                        {
                          title: "Thời gian",
                          width: 150,
                          render: (_, row) =>
                            text(row.occurred_at ?? row.created_at),
                        },
                      ]}
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
                              <AntTypography.Text code copyable>
                                {text(wc.warranty_case_code)}
                              </AntTypography.Text>
                              <Tag
                                color={
                                  WARRANTY_STATUS_COLORS[text(wc.status, "")] ??
                                  "default"
                                }
                              >
                                {WARRANTY_STATUS_LABELS[text(wc.status, "")] ??
                                  "Trạng thái khác"}
                              </Tag>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {text(wc.received_at)}
                              </Typography>
                            </Stack>
                            <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                              <DetailField
                                label="Khách hàng"
                                value={`${text(wc.customer_name)} · ${text(wc.customer_phone)}`}
                              />
                              <DetailField
                                label="Lỗi/bệnh"
                                value={text(
                                  wc.defect_name ?? wc.confirmed_defect,
                                )}
                              />
                            </Grid>
                            {events.length > 0 ? (
                              <Stack spacing={0.5} sx={{ mt: 1 }}>
                                {events.map((event, eventIndex) => (
                                  <Typography
                                    key={text(
                                      event.warranty_event_id,
                                      String(eventIndex),
                                    )}
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {text(event.event_at)} —{" "}
                                    {text(event.to_status ?? event.event_type)}
                                    {event.note ? ` (${text(event.note)})` : ""}
                                  </Typography>
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
                    <AntTypography.Text code copyable>
                      {text(
                        movement.movement_no ?? movement.code ?? movement.id,
                      )}
                    </AntTypography.Text>
                  }
                />
                <DetailField
                  label="Thời gian"
                  value={text(
                    movement.occurred_at ??
                      movement.performed_at ??
                      movement.created_at,
                  )}
                />
                <DetailField
                  label="Loại biến động"
                  value={
                    <Tag>
                      {businessLabel(
                        MOVEMENT_TYPE_LABELS,
                        text(
                          movement.movement_type ?? movement.source_type,
                          "",
                        ),
                        "Biến động khác",
                      )}
                    </Tag>
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
                    <AntTypography.Text
                      style={{
                        color:
                          Number(
                            movement.qty_change ?? movement.quantity ?? 0,
                          ) >= 0
                            ? "#237804"
                            : "#cf1322",
                        fontWeight: 600,
                      }}
                    >
                      {Number(
                        movement.qty_change ?? movement.quantity ?? 0,
                      ).toLocaleString("vi-VN")}
                    </AntTypography.Text>
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
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: "center", py: 2 }}
              >
                Đang tải dữ liệu truy vết...
              </Typography>
            ) : null}

            {trace ? (
              <>
                <DescriptionsBlock title="Chứng từ nguồn">
                  <DetailField
                    label="Loại nguồn"
                    value={
                      <Tag>
                        {businessLabel(
                          SOURCE_DOCUMENT_TYPE_LABELS,
                          trace.sourceType,
                          "Nguồn khác",
                        )}
                      </Tag>
                    }
                  />
                  <DetailField
                    label="Mã chứng từ"
                    value={
                      <AntTypography.Text code copyable>
                        {trace.sourceCode}
                      </AntTypography.Text>
                    }
                  />
                  <DetailField
                    label="Trạng thái"
                    value={
                      <Tag
                        color={
                          trace.status === "POSTED" || trace.status === "CLOSED"
                            ? "success"
                            : trace.status === "CANCELLED" ||
                                trace.status === "REVERSED"
                              ? "error"
                              : "processing"
                        }
                      >
                        {statusLabel(trace.status)}
                      </Tag>
                    }
                  />
                  <DetailField
                    label="Thời điểm ghi nhận"
                    value={trace.postedAt || "-"}
                  />
                  <DetailField
                    label="Người thao tác"
                    value={trace.actor || "-"}
                  />
                  <DetailField
                    label="Mã yêu cầu kỹ thuật"
                    value={
                      <AntTypography.Text
                        copyable={Boolean(trace.requestId)}
                        style={{ fontSize: 12 }}
                      >
                        {trace.requestId || "-"}
                      </AntTypography.Text>
                    }
                  />
                </DescriptionsBlock>

                {trace.lines.length > 0 ? (
                  <div>
                    <SectionLabel>{`Dòng chứng từ (${trace.lines.length})`}</SectionLabel>
                    <Table
                      size="small"
                      dataSource={trace.lines.map((row, index) =>
                        withRowKey(
                          row,
                          `${text(row.id ?? row.sku ?? row.sku_code, String(index))}-${index}`,
                        ),
                      )}
                      rowKey="__rowKey"
                      pagination={false}
                      scroll={{ x: "max-content" }}
                      columns={[
                        {
                          title: "SKU",
                          width: 130,
                          render: (_, row) => {
                            const product = nested(row as RawRecord, "product");
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
                          title: "Tên",
                          width: 180,
                          render: (_, row) => {
                            const product = nested(row as RawRecord, "product");
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
                          title: "Số lượng",
                          width: 100,
                          align: "right",
                          render: (_, row) =>
                            Number(
                              row.quantity ?? row.qty ?? row.qty_actual ?? 0,
                            ).toLocaleString("vi-VN"),
                        },
                        {
                          title: "Trạng thái",
                          width: 130,
                          render: (_, row) => (
                            <Tag>
                              {statusLabel(row.status ?? row.line_status)}
                            </Tag>
                          ),
                        },
                      ]}
                    />
                  </div>
                ) : null}

                {trace.netEffect ? (
                  <DescriptionsBlock title="Tác động tồn kho sau điều chỉnh">
                    <DetailField
                      label="Giao dịch gốc"
                      value={
                        <Tag>
                          {businessLabel(
                            MOVEMENT_TYPE_LABELS,
                            trace.netEffect.originalMovementType,
                            "Biến động khác",
                          )}
                        </Tag>
                      }
                    />
                    <DetailField
                      label="Số lượng gốc"
                      value={trace.netEffect.originalQty.toLocaleString(
                        "vi-VN",
                      )}
                    />
                    <DetailField
                      label="Đã điều chỉnh"
                      value={
                        <AntTypography.Text
                          style={{
                            color:
                              trace.netEffect.reversedQty > 0
                                ? "#cf1322"
                                : undefined,
                            fontWeight: 600,
                          }}
                        >
                          {trace.netEffect.reversedQty.toLocaleString("vi-VN")}
                        </AntTypography.Text>
                      }
                    />
                    <DetailField
                      label="Còn điều chỉnh được"
                      value={trace.netEffect.remainingReversibleQty.toLocaleString(
                        "vi-VN",
                      )}
                    />
                    <DetailField
                      label="Tác động ròng"
                      value={trace.netEffect.netQtyDelta.toLocaleString(
                        "vi-VN",
                      )}
                    />
                    <DetailField
                      label="Trạng thái"
                      value={
                        <Tag
                          color={
                            trace.netEffect.fullyReversed ? "error" : "success"
                          }
                        >
                          {trace.netEffect.fullyReversed
                            ? "Đã điều chỉnh toàn bộ"
                            : `Còn hiệu lực (${trace.netEffect.reversalCount} lần điều chỉnh)`}
                        </Tag>
                      }
                    />
                  </DescriptionsBlock>
                ) : null}

                {(trace.chain ?? []).length > 0 ? (
                  <div>
                    <SectionLabel>
                      {`Chuỗi điều chỉnh (${(trace.chain ?? []).length} bút toán)`}
                      {trace.chainTruncated ? (
                        <Typography
                          component="span"
                          variant="caption"
                          color="error.main"
                          sx={{ ml: 1 }}
                        >
                          · chuỗi quá dài, đã rút gọn
                        </Typography>
                      ) : null}
                    </SectionLabel>
                    <Table
                      size="small"
                      dataSource={trace.chain ?? []}
                      rowKey="id"
                      pagination={false}
                      scroll={{ x: "max-content" }}
                      columns={[
                        {
                          title: "Vai trò",
                          width: 140,
                          render: (_, row) => (
                            <Tag
                              color={row.role === "ORIGINAL" ? "blue" : "red"}
                            >
                              {businessLabel(
                                MOVEMENT_ROLE_LABELS,
                                row.role,
                                "Vai trò khác",
                              )}
                            </Tag>
                          ),
                        },
                        {
                          title: "Mã biến động",
                          width: 170,
                          render: (_, row) => (
                            <AntTypography.Text
                              code
                              strong={row.is_subject}
                              style={{ fontSize: 12 }}
                            >
                              {row.movement_no ?? row.id}
                            </AntTypography.Text>
                          ),
                        },
                        {
                          title: "Loại",
                          width: 150,
                          render: (_, row) =>
                            businessLabel(
                              MOVEMENT_TYPE_LABELS,
                              row.movement_type,
                              "Biến động khác",
                            ),
                        },
                        {
                          title: "Thay đổi tồn",
                          width: 110,
                          align: "right",
                          render: (_, row) => (
                            <AntTypography.Text
                              style={{
                                color:
                                  row.qty_delta >= 0 ? "#237804" : "#cf1322",
                                fontWeight: 600,
                              }}
                            >
                              {Number(row.qty_delta).toLocaleString("vi-VN")}
                            </AntTypography.Text>
                          ),
                        },
                        {
                          title: "Thời điểm",
                          width: 160,
                          render: (_, row) => text(row.occurred_at),
                        },
                        {
                          title: "Người thực hiện",
                          width: 150,
                          render: (_, row) => text(row.actor),
                        },
                        {
                          title: "Lý do",
                          render: (_, row) =>
                            text(
                              row.reason_text ??
                                row.reason_code ??
                                row.reversal_document_no,
                            ),
                        },
                      ]}
                    />
                  </div>
                ) : null}

                <div>
                  <SectionLabel>Diễn biến</SectionLabel>
                  {trace.timeline.length > 0 ? (
                    <Stack spacing={1.25}>
                      {trace.timeline.map((item, index) => {
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
                        return (
                          <Stack
                            key={`${label}-${index}`}
                            direction="row"
                            spacing={1.25}
                            sx={{ alignItems: "flex-start" }}
                          >
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                bgcolor: "primary.main",
                                mt: "6px",
                                flexShrink: 0,
                              }}
                            />
                            <Typography variant="body2">
                              {label}
                              {time ? (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ ml: 1 }}
                                >
                                  {String(time)}
                                </Typography>
                              ) : null}
                            </Typography>
                          </Stack>
                        );
                      })}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Chưa có dữ liệu diễn biến để hiển thị.
                    </Typography>
                  )}
                </div>
              </>
            ) : null}
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
