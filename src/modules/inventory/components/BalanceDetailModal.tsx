import {
  Modal,
  Descriptions,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { HistoryOutlined } from "@ant-design/icons";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  CONTAINER_TYPE_LABELS,
  INVENTORY_STOCK_STATUS_LABELS,
  ITEM_STATUS_LABELS,
  MOVEMENT_TYPE_LABELS,
  PUTAWAY_STATUS_LABELS,
  RECONCILE_STATUS_LABELS,
  SOURCE_DOCUMENT_TYPE_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import type { InventoryBalanceRow } from "../services/inventoryService";
import { useStockMovements, useBalanceSubledger } from "../hooks/use-inventory";
import type { StockMovementRow } from "../services/inventoryService";

const numberFormatter = new Intl.NumberFormat("vi-VN");

type RawRecord = Record<string, unknown>;

function formatQty(value: number | null | undefined, uom = "") {
  if (value === null || value === undefined) return "-";
  return `${numberFormatter.format(value)}${uom ? ` ${uom}` : ""}`;
}

function text(val: unknown, fallback = "-") {
  return val === undefined || val === null ? fallback : String(val);
}

function reconcileColor(status: string) {
  if (status === "MATCH" || status === "PASS") return "success";
  if (status === "MISMATCH" || status === "FAIL") return "error";
  return "warning";
}

function itemConditionLabel(value: unknown): string {
  const status = text(value, "");
  const labels: Record<string, string> = {
    NEW: "Mới",
    GOOD: "Tốt",
    NORMAL: "Bình thường",
    SELLABLE: "Có thể bán/xuất",
    DEFECTIVE: "Hàng lỗi",
    DAMAGED: "Hư hỏng",
    NON_SELLABLE: "Không thể bán/xuất",
    QUARANTINE: "Chờ kiểm tra",
  };
  return labels[status] ?? (status ? "Tình trạng khác" : "-");
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
  const movementsQuery = useStockMovements({
    search: balance.sku,
    per_page: 10,
  });
  const movements = movementsQuery.data?.rows ?? [];

  const subledgerQuery = useBalanceSubledger(String(balance.id));
  const subledger = subledgerQuery.data;

  const movementColumns: ColumnsType<StockMovementRow> = [
    {
      title: "Mã biến động",
      dataIndex: "movementId",
      width: 140,
      render: (value: string) => (
        <Typography.Text code>{value || "-"}</Typography.Text>
      ),
    },
    { title: "Thời gian", dataIndex: "time", width: 150 },
    {
      title: "Loại biến động",
      dataIndex: "type",
      width: 150,
      render: (value: string) => (
        <Tag>{businessLabel(MOVEMENT_TYPE_LABELS, value, "Biến động khác")}</Tag>
      ),
    },
    {
      title: "Số lượng thay đổi",
      dataIndex: "qty",
      width: 140,
      align: "right",
      render: (value: number) => (
        <Typography.Text
          style={{
            color: value >= 0 ? "#237804" : "#cf1322",
            fontVariantNumeric: "tabular-nums",
            fontWeight: 600,
          }}
        >
          {value >= 0
            ? `+${numberFormatter.format(value)}`
            : numberFormatter.format(value)}
        </Typography.Text>
      ),
    },
    {
      title: "Chứng từ nguồn",
      dataIndex: "source",
      width: 180,
      render: (value: string, row) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text code>{value || "-"}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {businessLabel(
              SOURCE_DOCUMENT_TYPE_LABELS,
              row.sourceType,
              "Nguồn khác",
            )}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 100,
      fixed: "right",
      render: (_, row) =>
        onTraceMovement ? (
          <button
            className="btn small"
            type="button"
            onClick={() => onTraceMovement(String(row.id))}
          >
            <HistoryOutlined style={{ marginRight: 4 }} />
            Truy vết
          </button>
        ) : null,
    },
  ];

  const itemColumns: ColumnsType<RawRecord> = [
    {
      title: "Mã sản phẩm",
      width: 140,
      render: (_, row) => (
        <Typography.Text code>
          {text(row.item_code ?? row.serial_number)}
        </Typography.Text>
      ),
    },
    {
      title: "Số sê-ri",
      width: 140,
      render: (_, row) => text(row.serial_number),
    },
    {
      title: "Trạng thái",
      width: 140,
      render: (_, row) => (
        <Tag>
          {businessLabel(
            ITEM_STATUS_LABELS,
            text(row.status, ""),
            "Trạng thái khác",
          )}
        </Tag>
      ),
    },
    {
      title: "Tình trạng",
      width: 130,
      render: (_, row) => itemConditionLabel(row.condition),
    },
    {
      title: "Mã vật lý",
      width: 140,
      render: (_, row) =>
        row.physical_code ? (
          <Typography.Text code>{text(row.physical_code)}</Typography.Text>
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        ),
    },
    {
      title: "Vị trí",
      width: 120,
      render: (_, row) => text(row.location_hint),
    },
    {
      title: "Thời điểm nhận",
      width: 150,
      render: (_, row) => text(row.received_at),
    },
  ];

  const containerColumns: ColumnsType<RawRecord> = [
    {
      title: "Mã vật chứa",
      width: 140,
      render: (_, row) => (
        <Typography.Text code>{text(row.container_code)}</Typography.Text>
      ),
    },
    {
      title: "Loại",
      width: 110,
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
      render: (_, row) => numberFormatter.format(Number(row.quantity ?? 0)),
    },
    {
      title: "Trạng thái vật chứa",
      width: 160,
      render: (_, row) => (
        <Tag>
          {businessLabel(
            PUTAWAY_STATUS_LABELS,
            text(row.container_status, ""),
            "Trạng thái khác",
          )}
        </Tag>
      ),
    },
    {
      title: "Khu vực",
      width: 100,
      render: (_, row) => text(row.zone_code),
    },
    {
      title: "Vị trí",
      width: 120,
      render: (_, row) => text(row.location_hint),
    },
  ];

  return (
    <Modal
      open
      centered
      destroyOnHidden
      mask={{ closable: false }}
      width={1060}
      title={`Chi tiết tồn kho — ${balance.sku}`}
      footer={null}
      onCancel={onClose}
    >
      <Space orientation="vertical" size={16} style={{ width: "100%" }}>
        <Descriptions bordered column={{ xs: 1, md: 2 }} size="small">
          <Descriptions.Item label="SKU">
            <Typography.Text code copyable>
              {balance.sku}
            </Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="Tên hàng">{balance.name}</Descriptions.Item>
          <Descriptions.Item label="Kho">{balance.warehouse}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái tồn">
            <Tag
              color={
                balance.stockStatus === "AVAILABLE" ? "success" : "warning"
              }
            >
              {businessLabel(
                INVENTORY_STOCK_STATUS_LABELS,
                balance.stockStatus,
                "Trạng thái khác",
              )}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Đối soát">
            <Tag color={reconcileColor(balance.reconcile)}>
              {businessLabel(
                RECONCILE_STATUS_LABELS,
                balance.reconcile,
                "Chưa đối soát",
              )}
            </Tag>
            {balance.reconcileNote ? (
              <Typography.Text type="secondary" style={{ marginLeft: 6 }}>
                {balance.reconcileNote}
              </Typography.Text>
            ) : null}
          </Descriptions.Item>
          <Descriptions.Item label="Cập nhật">
            {balance.dataAsOf || balance.updatedAt || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Vị trí gợi ý">
            {[balance.containerCode, balance.location]
              .filter(Boolean)
              .join(" · ") || "Chưa có vị trí gợi ý"}
          </Descriptions.Item>
          <Descriptions.Item label="Biến động gần nhất">
            {balance.lastMovementId || "-"}
          </Descriptions.Item>
        </Descriptions>

        <Space wrap size="middle">
          <Statistic
            title="Khả dụng"
            value={balance.available}
            suffix={balance.uom}
          />
          <Statistic
            title="Tồn hiện có"
            value={balance.onHand}
            suffix={balance.uom}
          />
          <Statistic
            title="Số sản phẩm"
            value={formatQty(balance.serialQty)}
          />
          <Statistic title="Số hộp" value={formatQty(balance.boxQty)} />
        </Space>

        {subledgerQuery.isError ? (
          <ApiErrorAlert
            error={subledgerQuery.error}
            title="Không tải được chi tiết tồn kho"
            onRetry={() => subledgerQuery.refetch()}
          />
        ) : null}

        <div>
          <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
            Sản phẩm cụ thể ({subledger?.item_count ?? balance.serialQty})
          </Typography.Text>
          <Table
            size="small"
            dataSource={(subledger?.items as RawRecord[]) ?? []}
            columns={itemColumns}
            rowKey={(row) => text(row.id, String(Math.random()))}
            loading={subledgerQuery.isLoading}
            pagination={false}
            scroll={{ x: "max-content" }}
            locale={{ emptyText: "Không có sản phẩm cụ thể" }}
          />
        </div>

        <div>
          <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
            Vật chứa ({subledger?.container_count ?? balance.boxQty})
          </Typography.Text>
          <Table
            size="small"
            dataSource={(subledger?.containers as RawRecord[]) ?? []}
            columns={containerColumns}
            rowKey={(row) => text(row.id, String(Math.random()))}
            loading={subledgerQuery.isLoading}
            pagination={false}
            scroll={{ x: "max-content" }}
            locale={{ emptyText: "Không có vật chứa" }}
          />
        </div>

        <div>
          <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
            Biến động liên quan ({movements.length})
          </Typography.Text>
          <Table
            size="small"
            dataSource={movements}
            columns={movementColumns}
            rowKey="id"
            loading={movementsQuery.isLoading}
            pagination={false}
            scroll={{ x: "max-content" }}
            locale={{ emptyText: "Không có biến động liên quan" }}
          />
        </div>
      </Space>
    </Modal>
  );
}
