import { useMemo, useState } from "react";
import {
  Alert,
  Checkbox,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
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
  MOVEMENT_TYPE_LABELS,
  RETURN_CONDITION_LABELS,
  SOURCE_DOCUMENT_TYPE_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import {
  useReversibleMovements,
  useCreateReversal,
} from "../hooks/use-reversal";
import type {
  CreateReversalRequest,
  ReversalReturnCondition,
  ReversibleMovement,
  ReversibleMovementLine,
} from "../types";
import { isStockRestoringMovement } from "../types";
import { formatDateTime } from "@/shared/utils/format-date";

const RETURN_CONDITION_OPTIONS: Array<{
  value: ReversalReturnCondition;
  label: string;
}> = [
  { value: "SELLABLE", label: "Có thể bán/xuất lại" },
  { value: "DEFECTIVE", label: "Hàng lỗi" },
  { value: "NON_SELLABLE", label: "Không thể bán/xuất" },
];

type ReversalDraft = Record<
  string,
  { reversal_qty?: number; reason?: string; item_ids?: string[] }
>;

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

export function ReversalCreateModal({ onClose, onCreated }: Props) {
  const [search, setSearch] = useState("");
  const [selectedMovement, setSelectedMovement] =
    useState<ReversibleMovement>();
  const [reason, setReason] = useState("");
  const [draft, setDraft] = useState<ReversalDraft>({});
  const [returnCondition, setReturnCondition] =
    useState<ReversalReturnCondition>("SELLABLE");
  const [physicalConfirmed, setPhysicalConfirmed] = useState(false);

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
        is_serial_tracked: Boolean(line.is_serial_tracked),
        item_ids: draft[line.sku]?.item_ids ?? [],
      }))
      .filter((line) => line.reversal_qty > 0);
  }, [draft, selectedMovement]);

  const serialLineMismatch = selectedLines.find(
    (line) =>
      line.is_serial_tracked && line.item_ids.length !== line.reversal_qty,
  );
  const totalQty = selectedLines.reduce(
    (sum, line) => sum + line.reversal_qty,
    0,
  );
  const invalidLine = selectedLines.find(
    (line) => line.reversal_qty > line.max,
  );
  const isIssueReversal = isStockRestoringMovement(
    selectedMovement?.movement_type,
  );
  const availableDelta =
    (isIssueReversal ? (returnCondition === "SELLABLE" ? 1 : 0) : -1) *
    totalQty;
  const missingReferenceVersion =
    Boolean(selectedMovement) && !selectedMovement?.version;
  const canSubmit =
    Boolean(selectedMovement?.can_reverse) &&
    !missingReferenceVersion &&
    selectedLines.length > 0 &&
    totalQty > 0 &&
    reason.trim().length >= 5 &&
    !invalidLine &&
    !serialLineMismatch &&
    (!isIssueReversal || (Boolean(returnCondition) && physicalConfirmed));

  function handleSelectMovement(movement: ReversibleMovement) {
    setSelectedMovement(movement);
    setReturnCondition("SELLABLE");
    setPhysicalConfirmed(false);
    setDraft(
      Object.fromEntries(
        movement.lines.map((line) => {
          const candidates = line.items ?? [];
          const defaultQty = line.can_reverse ? line.reversible_qty : 0;
          return [
            line.sku,
            {
              reversal_qty: defaultQty,
              reason: line.dependency_guard,
              item_ids: line.is_serial_tracked
                ? candidates
                    .slice(0, defaultQty)
                    .map((candidate) => candidate.item_id)
                : [],
            },
          ];
        }),
      ),
    );
  }

  function handleSubmit() {
    if (!selectedMovement) return;
    Modal.confirm({
      title: "Tạo phiếu điều chỉnh tồn kho?",
      icon: <WarningOutlined />,
      okText: "Tạo phiếu điều chỉnh",
      cancelText: "Kiểm tra lại",
      content: (
        <Space orientation="vertical">
          <Typography.Text>
            Giao dịch gốc {selectedMovement.movement_code} sẽ được giữ nguyên.
            Hệ thống tạo giao dịch đối ứng và kiểm tra các nghiệp vụ phụ thuộc
            trước khi thay đổi tồn kho.
          </Typography.Text>
          <Typography.Text strong>
            {selectedLines.length} dòng, tổng số lượng {qty(totalQty)}
          </Typography.Text>
          {isIssueReversal ? (
            <Typography.Text>
              Tình trạng hàng trả về:{" "}
              <b>
                {businessLabel(
                  RETURN_CONDITION_LABELS,
                  returnCondition,
                  "Chưa xác định",
                )}
              </b>
              . Đã xác nhận hàng vật lý quay lại kho.
            </Typography.Text>
          ) : null}
        </Space>
      ),
      onOk: async () => {
        const payload: CreateReversalRequest = {
          reference_document_id:
            selectedMovement.source_document_id || selectedMovement.id,
          reference_document_type:
            selectedMovement.source_document_type ||
            selectedMovement.movement_type,
          reference_version: selectedMovement.version,
          reason,
          ...(isIssueReversal
            ? {
                return_condition: returnCondition,
                physical_return_confirmed: physicalConfirmed,
              }
            : {}),
          lines: selectedLines.flatMap(
            ({ sku, reversal_qty, reason: lineReason, is_serial_tracked, item_ids }) =>
              is_serial_tracked
                ? item_ids.map((item_id) => ({
                    sku,
                    reversal_qty: 1,
                    reason: lineReason,
                    item_id,
                  }))
                : [{ sku, reversal_qty, reason: lineReason }],
          ),
          idempotency_key: idempotencyKey(),
        };
        try {
          const created = await createMutation.mutateAsync(payload);
          toast.success(`Đã tạo phiếu điều chỉnh ${created.reversal_code}`);
          onCreated(created.reversal_code);
        } catch (submitError) {
          const normalized = normalizeError(submitError);
          toast.error(
            normalized.status === 409 ||
              normalized.status === 412 ||
              normalized.status === 428
              ? `${normalized.message}. Dữ liệu đã thay đổi; vui lòng tải lại danh sách và chọn lại giao dịch.`
              : getApiErrorMessage(
                  submitError,
                  "Không thể tạo phiếu điều chỉnh tồn kho",
                ),
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
      mask={{ closable: false }}
      width={1100}
      title="Tạo phiếu điều chỉnh tồn kho"
      footer={null}
      onCancel={onClose}
    >
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          title="Giao dịch gốc luôn được giữ nguyên"
          description="Hệ thống tạo một giao dịch điều chỉnh đối ứng thay vì sửa hoặc xóa giao dịch gốc. Các giới hạn số lượng và điều kiện phụ thuộc được kiểm tra tự động trước khi ghi nhận."
        />

        <div className="toolbar" style={{ marginBottom: 0 }}>
          <input
            className="input search"
            placeholder="Tìm mã biến động / chứng từ gốc..."
            value={search}
            aria-label="Tìm giao dịch có thể điều chỉnh"
            onChange={(event) => setSearch(event.target.value)}
            style={{ flex: 1 }}
          />
        </div>

        {movementsQuery.isError ? (
          <ApiErrorAlert
            error={movementsQuery.error}
            title="Không thể tải các giao dịch có thể điều chỉnh"
            onRetry={() => movementsQuery.refetch()}
          />
        ) : null}

        <Table
          dataSource={movements}
          rowKey="id"
          size="small"
          loading={movementsQuery.isLoading}
          pagination={{ pageSize: 5 }}
          scroll={{ x: "max-content" }}
          locale={{ emptyText: "Chưa có giao dịch nào có thể điều chỉnh" }}
          rowClassName={(record) =>
            record.id === selectedMovement?.id ? "ant-table-row-selected" : ""
          }
          onRow={(record) => ({
            onClick: () => handleSelectMovement(record),
            style: { cursor: "pointer" },
          })}
          columns={[
            {
              title: "Mã biến động",
              dataIndex: "movement_code",
              width: 150,
              render: (value: string) => (
                <Typography.Text code>{value}</Typography.Text>
              ),
            },
            {
              title: "Loại",
              dataIndex: "movement_type",
              width: 170,
              render: (value: string) =>
                businessLabel(
                  MOVEMENT_TYPE_LABELS,
                  value,
                  "Biến động khác",
                ),
            },
            {
              title: "Chứng từ gốc",
              width: 180,
              render: (_: unknown, row: ReversibleMovement) => (
                <Space orientation="vertical" size={0}>
                  <Typography.Text>
                    {row.source_document_code || row.source_document_id}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {businessLabel(
                      SOURCE_DOCUMENT_TYPE_LABELS,
                      row.source_document_type,
                      "Chứng từ khác",
                    )}
                  </Typography.Text>
                </Space>
              ),
            },
            { title: "Kho", dataIndex: "warehouse_name", width: 140 },
            {
              title: "Thời điểm ghi nhận",
              dataIndex: "posted_at",
              width: 160,
              render: (posted_at: string) => formatDateTime(posted_at),
            },
            {
              title: "Khả năng điều chỉnh",
              width: 180,
              render: (_: unknown, row: ReversibleMovement) =>
                row.dependency_guard ? (
                  <Tag color="red">Đang bị chặn bởi nghiệp vụ liên quan</Tag>
                ) : (
                  <Tag color="green">Có thể điều chỉnh</Tag>
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
              Điều chỉnh từ {selectedMovement.movement_code}
            </Typography.Text>

            <Descriptions size="small" column={{ xs: 1, md: 3 }}>
              <Descriptions.Item label="Chứng từ nguồn">
                {businessLabel(
                  SOURCE_DOCUMENT_TYPE_LABELS,
                  selectedMovement.source_document_type,
                  "Chứng từ khác",
                )}{" "}
                ·{" "}
                {selectedMovement.source_document_code ||
                  selectedMovement.source_document_id}
              </Descriptions.Item>
              <Descriptions.Item label="Khả năng điều chỉnh">
                {selectedMovement.can_reverse ? (
                  <Tag color="green">Có thể điều chỉnh</Tag>
                ) : (
                  <Tag color="red">Đang bị chặn</Tag>
                )}
              </Descriptions.Item>
            </Descriptions>

            {selectedMovement.dependency_guard ? (
              <Alert
                type="warning"
                showIcon
                title="Còn nghiệp vụ phụ thuộc"
                description="Giao dịch này chưa thể điều chỉnh ngay vì còn dữ liệu hoặc nghiệp vụ phát sinh sau đó. Cần xử lý các nghiệp vụ liên quan theo thứ tự ngược trước."
                style={{ marginBottom: 12 }}
              />
            ) : null}

            <Form layout="vertical" style={{ marginTop: 12 }}>
              <Form.Item
                label="Lý do điều chỉnh"
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
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Nhập lý do điều chỉnh (tối thiểu 5 ký tự)..."
                />
              </Form.Item>

              {isIssueReversal ? (
                <>
                  <Form.Item
                    label="Tình trạng hàng trả về"
                    required
                    extra="Chỉ hàng có thể bán/xuất lại mới được cộng trở lại số lượng khả dụng. Hàng lỗi hoặc không thể bán/xuất vẫn được ghi nhận nhưng không cộng vào tồn khả dụng."
                  >
                    <Select<ReversalReturnCondition>
                      value={returnCondition}
                      style={{ maxWidth: 420 }}
                      options={RETURN_CONDITION_OPTIONS}
                      onChange={setReturnCondition}
                    />
                  </Form.Item>
                  <Form.Item
                    required
                    validateStatus={physicalConfirmed ? undefined : "warning"}
                    help={
                      physicalConfirmed
                        ? undefined
                        : "Chỉ được hoàn tất điều chỉnh xuất kho khi hàng vật lý đã quay lại kho."
                    }
                  >
                    <Checkbox
                      checked={physicalConfirmed}
                      onChange={(event) =>
                        setPhysicalConfirmed(event.target.checked)
                      }
                    >
                      Xác nhận hàng vật lý đã quay lại kho
                    </Checkbox>
                  </Form.Item>
                </>
              ) : null}
            </Form>

            <Table
              size="small"
              dataSource={selectedMovement.lines}
              rowKey="id"
              pagination={false}
              scroll={{ x: "max-content" }}
              columns={[
                { title: "SKU", dataIndex: "sku", width: 130 },
                { title: "Tên", dataIndex: "sku_name", width: 160 },
                {
                  title: "Số lượng gốc",
                  dataIndex: "original_qty",
                  width: 110,
                  align: "right",
                  render: qty,
                },
                {
                  title: "Đã điều chỉnh",
                  dataIndex: "reversed_qty",
                  width: 110,
                  align: "right",
                  render: qty,
                },
                {
                  title: "Còn có thể điều chỉnh",
                  dataIndex: "reversible_qty",
                  width: 150,
                  align: "right",
                  render: (value: number) => (
                    <Typography.Text strong>{qty(value)}</Typography.Text>
                  ),
                },
                {
                  title: "Số lượng điều chỉnh",
                  width: 150,
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
                  title: "Sản phẩm theo số sê-ri",
                  width: 260,
                  render: (_: unknown, line: ReversibleMovementLine) =>
                    line.is_serial_tracked ? (
                      <Select
                        mode="multiple"
                        size="small"
                        style={{ width: "100%" }}
                        placeholder="Chọn sản phẩm cần điều chỉnh"
                        disabled={!line.can_reverse}
                        value={draft[line.sku]?.item_ids ?? []}
                        options={(line.items ?? []).map((item) => ({
                          value: item.item_id,
                          label:
                            item.serial_number ||
                            item.item_code ||
                            item.item_id.slice(0, 8),
                        }))}
                        onChange={(value) =>
                          setDraft((current) => ({
                            ...current,
                            [line.sku]: {
                              ...current[line.sku],
                              item_ids: value,
                            },
                          }))
                        }
                      />
                    ) : (
                      <Typography.Text type="secondary">
                        Không quản lý theo số sê-ri
                      </Typography.Text>
                    ),
                },
                {
                  title: "Kiểm tra phụ thuộc",
                  width: 170,
                  render: (_: unknown, line: ReversibleMovementLine) =>
                    line.dependency_guard ? (
                      <Tag color="red">Đang bị chặn</Tag>
                    ) : (
                      <Tag color="green">Đạt</Tag>
                    ),
                },
              ]}
            />

            {serialLineMismatch ? (
              <Alert
                type="error"
                showIcon
                title={`SKU ${serialLineMismatch.sku}: phải chọn đúng ${serialLineMismatch.reversal_qty} sản phẩm theo số sê-ri (đang chọn ${serialLineMismatch.item_ids.length}).`}
                style={{ marginTop: 12 }}
              />
            ) : null}

            {invalidLine ? (
              <Alert
                type="error"
                showIcon
                title={`Số lượng điều chỉnh của ${invalidLine.sku} vượt số lượng còn có thể điều chỉnh.`}
                style={{ marginTop: 12 }}
              />
            ) : null}

            {missingReferenceVersion ? (
              <Alert
                type="error"
                showIcon
                data-testid="reversal-missing-version"
                title="Dữ liệu chứng từ gốc chưa đủ để tạo phiếu điều chỉnh"
                description="Hãy làm mới danh sách và chọn lại giao dịch trước khi tiếp tục."
                style={{ marginTop: 12 }}
              />
            ) : null}

            <Alert
              type={selectedMovement.can_reverse ? "success" : "error"}
              showIcon
              style={{ marginTop: 12 }}
              title={
                selectedMovement.can_reverse
                  ? `Kiểm tra phụ thuộc: Đạt · tổng số lượng có thể điều chỉnh = ${qty(
                      selectedMovement.lines.reduce(
                        (sum, line) => sum + line.reversible_qty,
                        0,
                      ),
                    )}`
                  : "Kiểm tra phụ thuộc: Đang bị chặn"
              }
              description={
                selectedMovement.can_reverse
                  ? `Ảnh hưởng dự kiến đến tồn khả dụng: ${
                      availableDelta === 0
                        ? "không thay đổi"
                        : `${availableDelta > 0 ? "+" : ""}${qty(availableDelta)}`
                    }. Giao dịch gốc vẫn được giữ nguyên.`
                  : "Cần xử lý các nghiệp vụ phụ thuộc theo thứ tự ngược trước khi điều chỉnh giao dịch này."
              }
            />

            <Space style={{ marginTop: 16 }} wrap>
              <Statistic title="Tổng số lượng điều chỉnh" value={qty(totalQty)} />
              <button
                className="btn primary"
                type="button"
                disabled={!canSubmit || createMutation.isPending}
                onClick={handleSubmit}
              >
                <RollbackOutlined style={{ marginRight: 4 }} />
                {createMutation.isPending
                  ? "Đang tạo..."
                  : "Tạo phiếu điều chỉnh"}
              </button>
            </Space>
          </div>
        ) : (
          <div className="footer-note">
            Chọn giao dịch gốc ở bảng trên để xem số lượng còn có thể điều chỉnh
            và các điều kiện liên quan.
          </div>
        )}
      </Space>
    </Modal>
  );
}
