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
  useStockMovement,
  useStockMovementTrace,
  usePhysicalCodeTrace,
} from "../hooks/use-inventory";

interface Props {
  movementId: string | null;
  onClose: () => void;
}

/**
 * TRACE-01 · Truy vết mã vật lý / movement.
 * Hiển thị chi tiết movement, chứng từ nguồn, timeline chuỗi nghiệp vụ.
 * Hỗ trợ tra cứu bằng Physical Code → Item/Container/SKU → Movement chain.
 */
export function TraceModal({ movementId, onClose }: Props) {
  const [lookupCode, setLookupCode] = useState("");
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  // SRS §5.3: "Supported camera contexts: inbound, outbound, inventory trace/search và
  // warranty receive/search" — TRACE-01 phải quét được bằng camera; nhập tay là manual
  // fallback và dùng chung server validation.
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanResolveError, setScanResolveError] = useState<string | null>(null);
  // Change Pack QR/SKU: classify(TRACE) cần warehouse_id (một kho ACTIVE).
  const warehousesQuery = useQuery({
    queryKey: ["inventory", "trace-warehouse"],
    queryFn: () => fetchWarehouses({ status: "ACTIVE" }),
  });
  const warehouse = warehousesQuery.data?.[0];

  const effectiveId = movementId;

  const movementQuery = useStockMovement(effectiveId);
  const traceQuery = useStockMovementTrace(effectiveId);
  const physicalCodeQuery = usePhysicalCodeTrace(submittedCode);

  const movement = movementQuery.data as Record<string, unknown> | undefined;
  const trace = traceQuery.data;
  const codeTrace = physicalCodeQuery.data;

  const text = (val: unknown, fallback = "-") =>
    val === undefined || val === null ? fallback : String(val);

  const nested = (obj: Record<string, unknown> | undefined, key: string) =>
    obj?.[key] && typeof obj[key] === "object"
      ? (obj[key] as Record<string, unknown>)
      : undefined;

  const withRowKey = (row: Record<string, unknown>, rowKey: string) =>
    ({ ...row, __rowKey: rowKey }) as Record<string, unknown> & {
      __rowKey: string;
    };

  const handleLookup = () => {
    const trimmed = lookupCode.trim();
    if (trimmed.length > 0) {
      // Nhập tay nhận cả raw composite lẫn legacy — backend trace parse
      // authoritative (Change Pack QR/SKU §13).
      setScanResolveError(null);
      setSubmittedCode(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleLookup();
    }
  };

  /**
   * Change Pack QR/SKU (guide §9.2/§13): camera trả RAW payload -> backend
   * classify(TRACE) resolve composite -> tra cứu bằng normalized_code_value.
   * Không bao giờ tự ghép/parse raw composite ở FE; classify lỗi thì hiển thị
   * nguyên nhân (INVALID_PAYLOAD/UNKNOWN_CODE/...) thay vì đoán.
   */
  const handleCameraDetected = async (code: string) => {
    const trimmed = code.trim();
    setCameraOpen(false);
    setScanResolveError(null);
    if (trimmed.length === 0) return;
    setLookupCode(trimmed);
    if (!warehouse?.id) {
      // Chưa có warehouse để classify — backend trace tự parse composite.
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
        getApiErrorMessage(error, "Không resolve được mã đã quét."),
      );
    }
  };

  return (
    <Modal
      open
      centered
      destroyOnHidden
      mask={{ closable: false }}
      width={960}
      title="Truy vết chứng từ nguồn (TRACE-01)"
      footer={null}
      onCancel={onClose}
    >
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <input
            className="input search"
            placeholder="Item code / Serial / Box / Tray / SKU / Barcode / QR / RFID..."
            value={lookupCode}
            aria-label="Tra cứu mã vật lý"
            onChange={(e) => setLookupCode(e.target.value)}
            onKeyDown={handleKeyDown}
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
            disabled={lookupCode.trim().length === 0}
            onClick={handleLookup}
          >
            <SearchOutlined style={{ marginRight: 4 }} />
            Tra cứu
          </button>
        </div>

        <CameraScanModal
          open={cameraOpen}
          title="Quét mã để truy vết (TRACE-01)"
          onDetected={(code) => void handleCameraDetected(code)}
          onClose={() => setCameraOpen(false)}
        />

        {scanResolveError ? (
          <Alert type="warning" showIcon title={scanResolveError} />
        ) : null}

        {!effectiveId && !submittedCode ? (
          <div className="footer-note">
            Chọn một movement từ danh sách tồn kho hoặc nhập mã vật lý để truy
            vết.
          </div>
        ) : null}

        {/* ──── Physical Code Trace Results ──── */}
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
                  {text(
                    (codeTrace.physical_code as Record<string, unknown>)
                      ?.code_value,
                  )}
                </Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="Loại mã">
                <Tag>
                  {text(
                    (codeTrace.physical_code as Record<string, unknown>)
                      ?.carrier_type,
                  )}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Đối tượng gắn">
                <Tag color="blue">{text(codeTrace.resolved_type)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag
                  color={
                    text(
                      (codeTrace.physical_code as Record<string, unknown>)
                        ?.status,
                    ) === "ACTIVE"
                      ? "success"
                      : "default"
                  }
                >
                  {text(
                    (codeTrace.physical_code as Record<string, unknown>)
                      ?.status,
                  )}
                </Tag>
              </Descriptions.Item>
              {codeTrace.resolved_type === "ITEM" &&
              codeTrace.resolved_object ? (
                <>
                  <Descriptions.Item label="SKU">
                    <Typography.Text code>
                      {text(
                        (codeTrace.resolved_object as Record<string, unknown>)
                          .sku_code,
                      )}
                    </Typography.Text>{" "}
                    {text(
                      (codeTrace.resolved_object as Record<string, unknown>)
                        .sku_name,
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="Trạng thái Item">
                    <Tag>
                      {text(
                        (codeTrace.resolved_object as Record<string, unknown>)
                          .status,
                      )}
                    </Tag>
                  </Descriptions.Item>
                </>
              ) : null}
              {codeTrace.resolved_type === "CONTAINER" &&
              codeTrace.resolved_object ? (
                <>
                  <Descriptions.Item label="Mã container">
                    <Typography.Text code>
                      {text(
                        (codeTrace.resolved_object as Record<string, unknown>)
                          .container_code,
                      )}
                    </Typography.Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Loại container">
                    <Tag>
                      {text(
                        (codeTrace.resolved_object as Record<string, unknown>)
                          .container_type,
                      )}
                    </Tag>
                  </Descriptions.Item>
                </>
              ) : null}
              {codeTrace.resolved_type === "SKU" &&
              codeTrace.resolved_object ? (
                <>
                  <Descriptions.Item label="Mã SKU">
                    <Typography.Text code>
                      {text(
                        (codeTrace.resolved_object as Record<string, unknown>)
                          .sku_code,
                      )}
                    </Typography.Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Tên SKU">
                    {text(
                      (codeTrace.resolved_object as Record<string, unknown>)
                        .sku_name,
                    )}
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
                  Container Items ({codeTrace.container_items.length})
                </Typography.Text>
                <Table
                  size="small"
                  dataSource={codeTrace.container_items.map((row, index) =>
                    withRowKey(
                      row,
                      text(row.id ?? row.container_code, String(index)) +
                        `-${index}`,
                    ),
                  )}
                  rowKey="__rowKey"
                  pagination={false}
                  scroll={{ x: "max-content" }}
                  columns={[
                    {
                      title: "Container",
                      width: 160,
                      render: (_, row) => text(row.container_code),
                    },
                    {
                      title: "Loại",
                      width: 100,
                      render: (_, row) => <Tag>{text(row.container_type)}</Tag>,
                    },
                    {
                      title: "SL",
                      width: 80,
                      align: "right",
                      render: (_, row) =>
                        Number(row.quantity ?? 0).toLocaleString("vi-VN"),
                    },
                    {
                      title: "Trạng thái",
                      width: 100,
                      render: (_, row) => text(row.status, "-"),
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
                  Lịch sử movement ({codeTrace.movements.length})
                </Typography.Text>
                <Table
                  size="small"
                  dataSource={codeTrace.movements}
                  rowKey={(row) => text(row.id, String(Math.random()))}
                  pagination={false}
                  scroll={{ x: "max-content" }}
                  columns={[
                    {
                      title: "Movement",
                      width: 130,
                      render: (_, row) => (
                        <Typography.Text code>
                          {text(row.movement_no)}
                        </Typography.Text>
                      ),
                    },
                    {
                      title: "Loại",
                      width: 110,
                      render: (_, row) => <Tag>{text(row.movement_type)}</Tag>,
                    },
                    {
                      title: "SKU",
                      width: 100,
                      render: (_, row) => text(row.product_code),
                    },
                    {
                      title: "SL",
                      width: 80,
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
                        <Typography.Text code>
                          {text(row.doc_no)}
                        </Typography.Text>
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

        {/* ──── Movement-based Trace (original) ──── */}
        {movementQuery.isError ? (
          <ApiErrorAlert
            error={movementQuery.error}
            title="Không thể tải chi tiết movement"
            onRetry={() => movementQuery.refetch()}
          />
        ) : null}

        {movement ? (
          <Descriptions
            bordered
            column={{ xs: 1, md: 2 }}
            size="small"
            title="Chi tiết movement"
          >
            <Descriptions.Item label="Movement">
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
            <Descriptions.Item label="Loại">
              <Tag>{text(movement.movement_type ?? movement.source_type)}</Tag>
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
                "-",
              )}
            </Descriptions.Item>
            <Descriptions.Item label="SL thay đổi">
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
            <Descriptions.Item label="Before / After">
              {text(movement.qty_before ?? movement.balance_before)} /{" "}
              {text(movement.qty_after ?? movement.balance_after)}
            </Descriptions.Item>
            <Descriptions.Item label="Nguồn">
              {text(movement.document_type ?? movement.source_type)} —{" "}
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
            title="Không thể truy vết nguồn movement"
            onRetry={() => traceQuery.refetch()}
          />
        ) : null}

        {traceQuery.isLoading ? (
          <div style={{ padding: 16, textAlign: "center" }}>
            Đang tải trace-source...
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
                <Tag>{trace.sourceType}</Tag>
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
                  {trace.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Posted at">
                {trace.postedAt || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Người thao tác">
                {trace.actor}
              </Descriptions.Item>
              <Descriptions.Item label="Request ID">
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
                      text(row.id ?? row.sku ?? row.sku_code, String(index)) +
                        `-${index}`,
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
                        const prod = nested(
                          row as Record<string, unknown>,
                          "product",
                        );
                        return text(
                          row.sku ??
                            row.sku_code ??
                            row.product_sku ??
                            row.product_code ??
                            prod?.code ??
                            prod?.sku_code,
                        );
                      },
                    },
                    {
                      title: "Tên",
                      width: 180,
                      render: (_, row) => {
                        const prod = nested(
                          row as Record<string, unknown>,
                          "product",
                        );
                        return text(
                          row.product_name ??
                            row.sku_name ??
                            row.name ??
                            prod?.name ??
                            prod?.sku_name,
                        );
                      },
                    },
                    {
                      title: "SL",
                      width: 90,
                      align: "right",
                      render: (_, row) =>
                        Number(
                          row.quantity ?? row.qty ?? row.qty_actual ?? 0,
                        ).toLocaleString("vi-VN"),
                    },
                    {
                      title: "Trạng thái",
                      width: 110,
                      render: (_, row) =>
                        text(row.status ?? row.line_status, "-"),
                    },
                  ]}
                />
              </div>
            ) : null}

            {/*
              WWHN-240 · BR-REV-11 + §13.10 RPT-MOV-01: "Show gross movement + reversal
              chain + net effect; never hide original". Trước WWHN-240 BE chỉ trả một
              reversal duy nhất nên màn hình này không thể dựng chuỗi; nay hiển thị đủ
              movement gốc, mọi lần đảo và tác động ròng còn lại.
            */}
            {trace.netEffect ? (
              <Descriptions
                bordered
                column={{ xs: 1, md: 3 }}
                size="small"
                title="Net effect (nguồn: ledger authoritative)"
              >
                <Descriptions.Item label="Giao dịch gốc">
                  <Tag>{trace.netEffect.originalMovementType}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="SL gốc">
                  {trace.netEffect.originalQty.toLocaleString("vi-VN")}
                </Descriptions.Item>
                <Descriptions.Item label="Đã đảo">
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
                <Descriptions.Item label="Còn đảo được">
                  {trace.netEffect.remainingReversibleQty.toLocaleString(
                    "vi-VN",
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Tác động ròng">
                  {trace.netEffect.netQtyDelta.toLocaleString("vi-VN")}
                </Descriptions.Item>
                <Descriptions.Item label="Trạng thái đảo">
                  <Tag
                    color={trace.netEffect.fullyReversed ? "error" : "success"}
                  >
                    {trace.netEffect.fullyReversed
                      ? "Đã đảo toàn bộ"
                      : `Còn hiệu lực (${trace.netEffect.reversalCount} lần đảo)`}
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
                  Correction chain ({(trace.chain ?? []).length} bút toán)
                  {trace.chainTruncated ? (
                    <Typography.Text type="danger" style={{ marginLeft: 8 }}>
                      · chuỗi quá dài, đã cắt bớt
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
                      width: 110,
                      render: (_, row) => (
                        <Tag color={row.role === "ORIGINAL" ? "blue" : "red"}>
                          {row.role === "ORIGINAL" ? "Gốc" : "Đảo"}
                        </Tag>
                      ),
                    },
                    {
                      title: "Movement",
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
                    { title: "Loại", dataIndex: "movement_type", width: 130 },
                    {
                      title: "Δ Tồn",
                      width: 90,
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
                Timeline
              </Typography.Text>
              {trace.timeline.length > 0 ? (
                <Timeline
                  items={trace.timeline.map((item, index) => {
                    const label =
                      item.from_status && item.to_status
                        ? `${String(item.from_status)} → ${String(item.to_status)}${item.action ? ` (${String(item.action)})` : ""}`
                        : String(
                            item.title ??
                              item.event ??
                              item.movement_no ??
                              item.code ??
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
                  Backend chưa trả timeline/chain.
                </Typography.Text>
              )}
            </div>
          </>
        ) : null}
      </Space>
    </Modal>
  );
}
