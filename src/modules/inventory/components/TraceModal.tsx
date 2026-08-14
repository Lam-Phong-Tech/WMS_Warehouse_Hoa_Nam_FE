import { useState } from "react";
import {
  Modal,
  Descriptions,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
} from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  useStockMovement,
  useStockMovementTrace,
} from "../hooks/use-inventory";

interface Props {
  movementId: string | null;
  onClose: () => void;
}

/**
 * TRACE-01 · Truy vết mã vật lý / movement.
 * Hiển thị chi tiết movement, chứng từ nguồn, timeline chuỗi nghiệp vụ.
 */
export function TraceModal({ movementId, onClose }: Props) {
  const [lookupCode, setLookupCode] = useState("");
  const effectiveId = movementId;

  const movementQuery = useStockMovement(effectiveId);
  const traceQuery = useStockMovementTrace(effectiveId);

  const movement = movementQuery.data as Record<string, unknown> | undefined;
  const trace = traceQuery.data;

  const text = (val: unknown, fallback = "-") =>
    val === undefined || val === null ? fallback : String(val);

  const nested = (obj: Record<string, unknown> | undefined, key: string) =>
    obj?.[key] && typeof obj[key] === "object"
      ? (obj[key] as Record<string, unknown>)
      : undefined;

  return (
    <Modal
      open
      centered
      destroyOnHidden
      maskClosable={false}
      width={900}
      title="Truy vết chứng từ nguồn (TRACE-01)"
      footer={null}
      onCancel={onClose}
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <input
            className="input search"
            placeholder="Nhập mã vật lý / movement để tra cứu..."
            value={lookupCode}
            aria-label="Tra cứu mã vật lý"
            onChange={(e) => setLookupCode(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn" type="button" disabled>
            <SearchOutlined style={{ marginRight: 4 }} />
            Tra cứu
          </button>
        </div>

        {!effectiveId ? (
          <div className="footer-note">
            Chọn một movement từ danh sách tồn kho hoặc nhập mã vật lý để truy
            vết.
          </div>
        ) : null}

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
              <Tag>
                {text(movement.movement_type ?? movement.source_type)}
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
                  dataSource={trace.lines}
                  rowKey={(_, index) => String(index)}
                  pagination={false}
                  scroll={{ x: 600 }}
                  columns={[
                    {
                      title: "SKU",
                      width: 130,
                      render: (_, row) => {
                        const prod = nested(row as Record<string, unknown>, "product");
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
                        const prod = nested(row as Record<string, unknown>, "product");
                        return text(row.product_name ?? row.sku_name ?? row.name ?? prod?.name ?? prod?.sku_name);
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
                    const label = item.from_status && item.to_status
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
                            <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
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
