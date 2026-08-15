import { useMemo, useState } from "react";
import {
  Alert,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import { toast } from "sonner";
import { RollbackOutlined, WarningOutlined } from "@ant-design/icons";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { getApiErrorMessage, normalizeError } from "@/shared/api/api-error";
import {
  useReversibleMovements,
  useCreateReversal,
} from "../hooks/use-reversal";
import type {
  CreateReversalRequest,
  ReversibleMovement,
  ReversibleMovementLine,
} from "../types";

type ReversalDraft = Record<string, { reversal_qty?: number; reason?: string }>;

function idempotencyKey() {
  return `reversal-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const numberFormatter = new Intl.NumberFormat("vi-VN");

function qty(value?: number) {
  return numberFormatter.format(Number(value ?? 0));
}

interface Props {
  onClose: () => void;
  onCreated: (reversalCode: string) => void;
}

/**
 * REV-01 · Tạo Reversal.
 * Lookup reversible movements -> select -> enter quantities -> submit.
 */
export function ReversalCreateModal({ onClose, onCreated }: Props) {
  const [search, setSearch] = useState("");
  const [selectedMovement, setSelectedMovement] =
    useState<ReversibleMovement>();
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState<ReversalDraft>({});

  const movementsQuery = useReversibleMovements({
    search: search || undefined,
    reversible_only: true,
    per_page: 50,
  });
  const movements = movementsQuery.data ?? [];
  const createMutation = useCreateReversal();

  const selectedLines = useMemo(() => {
    if (!selectedMovement) return [];
    return selectedMovement.lines
      .filter((line) => line.can_reverse)
      .map((line) => ({
        sku: line.sku,
        reversal_qty: Number(draft[line.sku]?.reversal_qty ?? 0),
        reason: draft[line.sku]?.reason,
        max: line.reversible_qty,
      }))
      .filter((line) => line.reversal_qty > 0);
  }, [draft, selectedMovement]);

  const totalQty = selectedLines.reduce(
    (sum, line) => sum + line.reversal_qty,
    0,
  );
  const invalidLine = selectedLines.find(
    (line) => line.reversal_qty > line.max,
  );
  const canSubmit =
    Boolean(selectedMovement?.can_reverse) &&
    selectedLines.length > 0 &&
    totalQty > 0 &&
    reason.trim().length >= 5 &&
    !invalidLine;

  function handleSelectMovement(movement: ReversibleMovement) {
    setSelectedMovement(movement);
    setDraft(
      Object.fromEntries(
        movement.lines.map((line) => [
          line.sku,
          {
            reversal_qty: line.can_reverse ? line.reversible_qty : 0,
            reason: line.dependency_guard,
          },
        ]),
      ),
    );
  }

  function handleSubmit() {
    if (!selectedMovement) return;
    Modal.confirm({
      title: "Tạo chứng từ hoàn đảo?",
      icon: <WarningOutlined />,
      okText: "Tạo hoàn đảo",
      cancelText: "Kiểm tra lại",
      content: (
        <Space direction="vertical">
          <Typography.Text>
            Movement gốc {selectedMovement.movement_code} sẽ được giữ nguyên.
            Backend sẽ tạo reversal append-only và kiểm tra dependency guard
            trước khi ghi stock effect.
          </Typography.Text>
          <Typography.Text strong>
            {selectedLines.length} dòng, tổng số lượng {qty(totalQty)}
          </Typography.Text>
          <Typography.Text type="secondary">
            UI gửi Idempotency-Key và If-Match nếu lookup trả version.
          </Typography.Text>
        </Space>
      ),
      onOk: async () => {
        const payload: CreateReversalRequest = {
          reversal_type:
            selectedMovement.movement_type === "STOCKTAKE_ADJUSTMENT"
              ? "STOCKTAKE_ADJUSTMENT"
              : "MANUAL_ADJUSTMENT",
          reference_document_id:
            selectedMovement.source_document_id || selectedMovement.id,
          reference_document_type:
            selectedMovement.source_document_type ||
            selectedMovement.movement_type,
          reference_version: selectedMovement.version,
          reason,
          lines: selectedLines.map(({ sku, reversal_qty, reason }) => ({
            sku,
            reversal_qty,
            reason,
          })),
          idempotency_key: idempotencyKey(),
        };
        try {
          const created = await createMutation.mutateAsync(payload);
          toast.success(`Đã tạo hoàn đảo ${created.reversal_code}`);
          onCreated(created.reversal_code);
        } catch (submitError) {
          const normalized = normalizeError(submitError);
          toast.error(
            normalized.status === 409 ||
              normalized.status === 412 ||
              normalized.status === 428
              ? `${normalized.message}. Vui lòng lookup lại movement trước khi gửi lại.`
              : getApiErrorMessage(submitError, "Không thể tạo hoàn đảo"),
          );
        }
      },
    });
  }

  return (
    <Modal
      open
      centered
      destroyOnHidden
      maskClosable={false}
      width={1100}
      title="Tạo Reversal (REV-01)"
      footer={null}
      onCancel={onClose}
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          title="Hoàn đảo là append-only"
          description="FE không sửa/xóa movement gốc; mọi giới hạn reversible_qty, dependency guard, stock effect và audit do backend quyết định."
        />

        <div className="toolbar" style={{ marginBottom: 0 }}>
          <input
            className="input search"
            placeholder="Tìm movement / chứng từ gốc..."
            value={search}
            aria-label="Tìm movement"
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
        </div>

        {movementsQuery.isError ? (
          <ApiErrorAlert
            error={movementsQuery.error}
            title="Không thể lookup movement có thể hoàn đảo"
            onRetry={() => movementsQuery.refetch()}
          />
        ) : null}

        <Table
          dataSource={movements}
          rowKey="id"
          size="small"
          loading={movementsQuery.isLoading}
          pagination={{ pageSize: 5 }}
          scroll={{ x: 900 }}
          locale={{
            emptyText:
              "Chưa có movement reversible hoặc endpoint lookup chưa sẵn sàng",
          }}
          rowClassName={(record) =>
            record.id === selectedMovement?.id ? "ant-table-row-selected" : ""
          }
          onRow={(record) => ({
            onClick: () => handleSelectMovement(record),
            style: { cursor: "pointer" },
          })}
          columns={[
            {
              title: "Movement",
              dataIndex: "movement_code",
              width: 140,
              render: (value: string) => (
                <Typography.Text code>{value}</Typography.Text>
              ),
            },
            { title: "Loại", dataIndex: "movement_type", width: 160 },
            {
              title: "Chứng từ gốc",
              width: 160,
              render: (_: unknown, row: ReversibleMovement) =>
                row.source_document_code || row.source_document_id,
            },
            { title: "Kho", dataIndex: "warehouse_name", width: 140 },
            { title: "Posted at", dataIndex: "posted_at", width: 150 },
            {
              title: "Guard",
              width: 180,
              render: (_: unknown, row: ReversibleMovement) =>
                row.dependency_guard ? (
                  <Tag color="red">{row.dependency_guard}</Tag>
                ) : (
                  <Tag color="green">Reversible</Tag>
                ),
            },
          ]}
        />

        {selectedMovement ? (
          <div
            style={{
              background: "#fafafa",
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              padding: 16,
            }}
          >
            <Typography.Text
              strong
              style={{ display: "block", marginBottom: 12 }}
            >
              Tạo hoàn đảo từ {selectedMovement.movement_code}
            </Typography.Text>

            <Descriptions size="small" column={{ xs: 1, md: 3 }}>
              <Descriptions.Item label="Source">
                {selectedMovement.source_document_type} /{" "}
                {selectedMovement.source_document_code ||
                  selectedMovement.source_document_id}
              </Descriptions.Item>
              <Descriptions.Item label="Version">
                {selectedMovement.version ?? "Chưa có"}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                {selectedMovement.can_reverse ? (
                  <Tag color="green">Có thể hoàn đảo</Tag>
                ) : (
                  <Tag color="red">Bị chặn</Tag>
                )}
              </Descriptions.Item>
            </Descriptions>

            {selectedMovement.dependency_guard ? (
              <Alert
                type="warning"
                showIcon
                title="Dependency guard"
                description={selectedMovement.dependency_guard}
                style={{ marginBottom: 12 }}
              />
            ) : null}

            <Form layout="vertical" style={{ marginTop: 12 }}>
              <Form.Item
                label="Lý do hoàn đảo"
                required
                validateStatus={
                  reason && reason.length < 5 ? "error" : undefined
                }
                help={
                  reason && reason.length < 5
                    ? "Nhập lý do tối thiểu 5 ký tự"
                    : undefined
                }
              >
                <Input.TextArea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Nhập lý do hoàn đảo (tối thiểu 5 ký tự)..."
                />
              </Form.Item>
            </Form>

            <Table
              size="small"
              dataSource={selectedMovement.lines}
              rowKey="id"
              pagination={false}
              scroll={{ x: 780 }}
              columns={[
                { title: "SKU", dataIndex: "sku", width: 130 },
                { title: "Tên", dataIndex: "sku_name", width: 160 },
                {
                  title: "Original",
                  dataIndex: "original_qty",
                  width: 90,
                  align: "right",
                  render: qty,
                },
                {
                  title: "Đã đảo",
                  dataIndex: "reversed_qty",
                  width: 90,
                  align: "right",
                  render: qty,
                },
                {
                  title: "Còn đảo",
                  dataIndex: "reversible_qty",
                  width: 90,
                  align: "right",
                  render: (v: number) => (
                    <Typography.Text strong>{qty(v)}</Typography.Text>
                  ),
                },
                {
                  title: "SL đảo",
                  width: 130,
                  render: (_: unknown, line: ReversibleMovementLine) => (
                    <InputNumber
                      min={0}
                      max={line.reversible_qty}
                      disabled={!line.can_reverse}
                      value={draft[line.sku]?.reversal_qty}
                      size="small"
                      style={{ width: "100%" }}
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          [line.sku]: {
                            ...current[line.sku],
                            reversal_qty: Number(value ?? 0),
                          },
                        }))
                      }
                    />
                  ),
                },
                {
                  title: "Guard",
                  width: 180,
                  render: (_: unknown, line: ReversibleMovementLine) =>
                    line.dependency_guard ? (
                      <Tag color="red">{line.dependency_guard}</Tag>
                    ) : (
                      <Tag color="green">OK</Tag>
                    ),
                },
              ]}
            />

            {invalidLine ? (
              <Alert
                type="error"
                showIcon
                title={`SL đảo của ${invalidLine.sku} vượt số còn reversible`}
                style={{ marginTop: 12 }}
              />
            ) : null}

            <Space style={{ marginTop: 16 }} wrap>
              <Statistic title="Tổng SL hoàn đảo" value={qty(totalQty)} />
              <button
                className="btn primary"
                type="button"
                disabled={!canSubmit || createMutation.isPending}
                onClick={handleSubmit}
              >
                <RollbackOutlined style={{ marginRight: 4 }} />
                {createMutation.isPending
                  ? "Đang tạo..."
                  : "Tạo hoàn đảo"}
              </button>
            </Space>
          </div>
        ) : (
          <div className="footer-note">
            Chọn movement gốc ở bảng trên để xem reversible_qty và dependency
            guard.
          </div>
        )}
      </Space>
    </Modal>
  );
}
