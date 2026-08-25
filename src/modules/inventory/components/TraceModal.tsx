import { useState } from "react";
import {
  Alert,
  Modal,
  Descriptions,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
} from "antd";
import { useQuery } from "@tanstack/react-query";
import { CameraOutlined, SearchOutlined } from "@ant-design/icons";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { CameraScanModal } from "@/shared/components/forms/CameraScanModal";
import { classifyScanCodes } from "@/modules/scan/services/scanService";
import { fetchWarehouses } from "@/modules/master-data/services/warehouse.service";
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

function nested(obj: RawRecord | undefined, key: string): RawRecord | undefined {
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

/** TRACE-01 · Truy vết mã vật lý, biến động tồn và chứng từ nguồn. */
export function TraceModal({ movementId, onClose }: Props) {
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

  const resolvedObject = codeTrace?.resolved_object as RawRecord | null | undefined;
  const physicalCode = codeTrace?.physical_code as RawRecord | null | undefined;

  return (
    <Modal
      open
      centered
      destroyOnHidden
      mask={{ closable: false }}
      width={960}
      title="Truy vết chứng từ nguồn"
      footer={null}
      onCancel={onClose}
    >
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <input
            className="input search"
            placeholder="Mã sản phẩm / Số sê-ri / Hộp / Khay / SKU / Mã vạch / QR / RFID..."
            value={lookupCode}
            aria-label="Tra cứu mã vật lý"
            onChange={(event) => setLookupCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleLookup();
            }}
            style={{ flex: 1 }}
          />
          <button
            className="btn"
            type="button"
            aria-label="Quét camera để truy vết"
            onClick={() => setCameraOpen(true)}
          >
            <CameraOutlined style={{ marginRight: 4 }} />
            Quét camera
          </button>
          <button
            className="btn"
            type="button"
            disabled={!lookupCode.trim()}
            onClick={handleLookup}
          >
            <SearchOutlined style={{ marginRight: 4 }} />
            Tra cứu
          </button>
        </div>

        <CameraScanModal
          open={cameraOpen}
          title="Quét mã để truy vết"
          onDetected={(code) => void handleCameraDetected(code)}
          onClose={() => setCameraOpen(false)}
        />

        {scanResolveError ? (
          <Alert type="warning" showIcon title={scanResolveError} />
        ) : null}

        {!movementId && !submittedCode ? (
          <div className="footer-note">
            Chọn một biến động tồn kho từ danh sách hoặc nhập mã vật lý để truy vết.
          </div>
        ) : null}

        {physicalCodeQuery.isError ? (
          <ApiErrorAlert
            error={physicalCodeQuery.error}
            title="Không tìm thấy mã vật lý"
            onRetry={() => physicalCodeQuery.refetch()}
          />
        ) : null}

        {physicalCodeQuery.isLoading ? (
          <div style={{ padding: 16, textAlign: "center" }}>
            Đang tra cứu mã vật lý...
          </div>
        ) : null}

        {codeTrace ? (
          <>
            <Descriptions
              bordered
              column={{ xs: 1, md: 2 }}
              size="small"
              title="Kết quả tra cứu mã vật lý"
            >
              <Descriptions.Item label="Mã vật lý">
                <Typography.Text code copyable>
                  {text(physicalCode?.code_value)}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Loại mã">
                <Tag>
                  {CARRIER_LABELS[text(physicalCode?.carrier_type, "")] ??
                    "Loại mã khác"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Đối tượng gắn">
                <Tag color="blue">
                  {businessLabel(
                    SCAN_CLASSIFICATION_LABELS,
                    codeTrace.resolved_type,
                    "Đối tượng khác",
                  )}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag
                  color={
                    text(physicalCode?.status, "") === "ACTIVE"
                      ? "success"
                      : "default"
                  }
                >
                  {statusLabel(physicalCode?.status)}
                </Tag>
              </Descriptions.Item>

              {codeTrace.resolved_type === "ITEM" && resolvedObject ? (
                <>
                  <Descriptions.Item label="SKU">
                    <Typography.Text code>
                      {text(resolvedObject.sku_code)}
                    </Typography.Text>{" "}
                    {text(resolvedObject.sku_name)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Trạng thái sản phẩm">
                    <Tag>
                      {businessLabel(
                        ITEM_STATUS_LABELS,
                        text(
                          resolvedObject.status ?? resolvedObject.item_status,
                          "",
                        ),
                        "Trạng thái khác",
                      )}
                    </Tag>
                  </Descriptions.Item>
                </>
              ) : null}

              {codeTrace.resolved_type === "CONTAINER" && resolvedObject ? (
                <>
                  <Descriptions.Item label="Mã vật chứa">
                    <Typography.Text code>
                      {text(resolvedObject.container_code)}
                    </Typography.Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Loại vật chứa">
                    <Tag>
                      {businessLabel(
                        CONTAINER_TYPE_LABELS,
                        text(resolvedObject.container_type, ""),
                        "Vật chứa khác",
                      )}
                    </Tag>
                  </Descriptions.Item>
                </>
              ) : null}

              {codeTrace.resolved_type === "SKU" && resolvedObject ? (
                <>
                  <Descriptions.Item label="Mã SKU">
                    <Typography.Text code>
                      {text(resolvedObject.sku_code)}
                    </Typography.Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Tên SKU">
                    {text(resolvedObject.sku_name)}
                  </Descriptions.Item>
                </>
              ) : null}
            </Descriptions>

            {codeTrace.container_items.length > 0 ? (
              <div>
                <Typography.Text
                  strong
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Sản phẩm trong vật chứa ({codeTrace.container_items.length})
                </Typography.Text>
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
                <Typography.Text
                  strong
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Lịch sử biến động ({codeTrace.movements.length})
                </Typography.Text>
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
                        <Typography.Text code>
                          {text(row.movement_no)}
                        </Typography.Text>
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
                        const qty = Number(row.qty_delta ?? row.quantity ?? 0);
                        return (
                          <Typography.Text
                            style={{
                              color: qty >= 0 ? "#237804" : "#cf1322",
                              fontWeight: 600,
                            }}
                          >
                            {qty >= 0
                              ? `+${qty.toLocaleString("vi-VN")}`
                              : qty.toLocaleString("vi-VN")}
                          </Typography.Text>
                        );
                      },
                    },
                    {
                      title: "Chứng từ",
                      width: 130,
                      render: (_, row) => (
                        <Typography.Text code>{text(row.doc_no)}</Typography.Text>
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
          <Descriptions
            bordered
            column={{ xs: 1, md: 2 }}
            size="small"
            title="Chi tiết biến động"
          >
            <Descriptions.Item label="Mã biến động">
              <Typography.Text code copyable>
                {text(movement.movement_no ?? movement.code ?? movement.id)}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Thời gian">
              {text(
                movement.occurred_at ??
                  movement.performed_at ??
                  movement.created_at,
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Loại biến động">
              <Tag>
                {businessLabel(
                  MOVEMENT_TYPE_LABELS,
                  text(movement.movement_type ?? movement.source_type, ""),
                  "Biến động khác",
                )}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="SKU">
              {text(
                movement.sku ??
                  movement.sku_code ??
                  movement.product_sku ??
                  movement.product_code ??
                  nested(movement, "product")?.code ??
                  nested(movement, "product")?.sku_code,
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Kho">
              {text(
                movement.warehouse_name ??
                  movement.warehouse_code ??
                  nested(movement, "warehouse")?.name ??
                  nested(movement, "warehouse")?.code,
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Số lượng thay đổi">
              <Typography.Text
                style={{
                  color:
                    Number(movement.qty_change ?? movement.quantity ?? 0) >= 0
                      ? "#237804"
                      : "#cf1322",
                  fontWeight: 600,
                }}
              >
                {Number(
                  movement.qty_change ?? movement.quantity ?? 0,
                ).toLocaleString("vi-VN")}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Tồn trước / sau">
              {text(movement.qty_before ?? movement.balance_before)} /{" "}
              {text(movement.qty_after ?? movement.balance_after)}
            </Descriptions.Item>
            <Descriptions.Item label="Chứng từ nguồn">
              {businessLabel(
                SOURCE_DOCUMENT_TYPE_LABELS,
                text(movement.document_type ?? movement.source_type, ""),
                "Nguồn khác",
              )}{" "}
              —{" "}
              {text(
                movement.document_code ??
                  movement.doc_no ??
                  movement.source_code ??
                  nested(movement, "document")?.doc_no,
              )}
            </Descriptions.Item>
          </Descriptions>
        ) : null}

        {traceQuery.isError ? (
          <ApiErrorAlert
            error={traceQuery.error}
            title="Không thể truy vết chứng từ nguồn"
            onRetry={() => traceQuery.refetch()}
          />
        ) : null}

        {traceQuery.isLoading ? (
          <div style={{ padding: 16, textAlign: "center" }}>
            Đang tải dữ liệu truy vết...
          </div>
        ) : null}

        {trace ? (
          <>
            <Descriptions
              bordered
              column={{ xs: 1, md: 2 }}
              size="small"
              title="Chứng từ nguồn"
            >
              <Descriptions.Item label="Loại nguồn">
                <Tag>
                  {businessLabel(
                    SOURCE_DOCUMENT_TYPE_LABELS,
                    trace.sourceType,
                    "Nguồn khác",
                  )}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Mã chứng từ">
                <Typography.Text code copyable>
                  {trace.sourceCode}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
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
              </Descriptions.Item>
              <Descriptions.Item label="Thời điểm ghi nhận">
                {trace.postedAt || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Người thao tác">
                {trace.actor || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Mã yêu cầu kỹ thuật">
                <Typography.Text
                  copyable={Boolean(trace.requestId)}
                  style={{ fontSize: 12 }}
                >
                  {trace.requestId || "-"}
                </Typography.Text>
              </Descriptions.Item>
            </Descriptions>

            {trace.lines.length > 0 ? (
              <div>
                <Typography.Text
                  strong
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Dòng chứng từ ({trace.lines.length})
                </Typography.Text>
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
                        <Tag>{statusLabel(row.status ?? row.line_status)}</Tag>
                      ),
                    },
                  ]}
                />
              </div>
            ) : null}

            {trace.netEffect ? (
              <Descriptions
                bordered
                column={{ xs: 1, md: 3 }}
                size="small"
                title="Tác động tồn kho sau điều chỉnh"
              >
                <Descriptions.Item label="Giao dịch gốc">
                  <Tag>
                    {businessLabel(
                      MOVEMENT_TYPE_LABELS,
                      trace.netEffect.originalMovementType,
                      "Biến động khác",
                    )}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Số lượng gốc">
                  {trace.netEffect.originalQty.toLocaleString("vi-VN")}
                </Descriptions.Item>
                <Descriptions.Item label="Đã điều chỉnh">
                  <Typography.Text
                    style={{
                      color:
                        trace.netEffect.reversedQty > 0 ? "#cf1322" : undefined,
                      fontWeight: 600,
                    }}
                  >
                    {trace.netEffect.reversedQty.toLocaleString("vi-VN")}
                  </Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="Còn điều chỉnh được">
                  {trace.netEffect.remainingReversibleQty.toLocaleString("vi-VN")}
                </Descriptions.Item>
                <Descriptions.Item label="Tác động ròng">
                  {trace.netEffect.netQtyDelta.toLocaleString("vi-VN")}
                </Descriptions.Item>
                <Descriptions.Item label="Trạng thái">
                  <Tag
                    color={trace.netEffect.fullyReversed ? "error" : "success"}
                  >
                    {trace.netEffect.fullyReversed
                      ? "Đã điều chỉnh toàn bộ"
                      : `Còn hiệu lực (${trace.netEffect.reversalCount} lần điều chỉnh)`}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            ) : null}

            {(trace.chain ?? []).length > 0 ? (
              <div>
                <Typography.Text
                  strong
                  style={{ display: "block", marginBottom: 8 }}
                >
                  Chuỗi điều chỉnh ({(trace.chain ?? []).length} bút toán)
                  {trace.chainTruncated ? (
                    <Typography.Text type="danger" style={{ marginLeft: 8 }}>
                      · chuỗi quá dài, đã rút gọn
                    </Typography.Text>
                  ) : null}
                </Typography.Text>
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
                        <Tag color={row.role === "ORIGINAL" ? "blue" : "red"}>
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
                        <Typography.Text
                          code
                          strong={row.is_subject}
                          style={{ fontSize: 12 }}
                        >
                          {row.movement_no ?? row.id}
                        </Typography.Text>
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
                        <Typography.Text
                          style={{
                            color: row.qty_delta >= 0 ? "#237804" : "#cf1322",
                            fontWeight: 600,
                          }}
                        >
                          {Number(row.qty_delta).toLocaleString("vi-VN")}
                        </Typography.Text>
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
              <Typography.Text
                strong
                style={{ display: "block", marginBottom: 8 }}
              >
                Diễn biến
              </Typography.Text>
              {trace.timeline.length > 0 ? (
                <Timeline
                  items={trace.timeline.map((item, index) => {
                    const from = item.from_status
                      ? statusLabel(item.from_status)
                      : "";
                    const to = item.to_status ? statusLabel(item.to_status) : "";
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
                    return {
                      children: (
                        <Typography.Text>
                          {label}
                          {time ? (
                            <Typography.Text
                              type="secondary"
                              style={{ marginLeft: 8, fontSize: 12 }}
                            >
                              {String(time)}
                            </Typography.Text>
                          ) : null}
                        </Typography.Text>
                      ),
                    };
                  })}
                />
              ) : (
                <Typography.Text type="secondary">
                  Chưa có dữ liệu diễn biến để hiển thị.
                </Typography.Text>
              )}
            </div>
          </>
        ) : null}
      </Space>
    </Modal>
  );
}
