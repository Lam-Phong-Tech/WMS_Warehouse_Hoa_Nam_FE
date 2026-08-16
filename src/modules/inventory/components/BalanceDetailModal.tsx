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
      title: "Mã dịch chuyển",
      dataIndex: "movementId",
      width: 140,
      render: (value: string) => (
        <Typography.Text code>{value || "-"}</Typography.Text>
      ),
    },
    { title: "Thời gian", dataIndex: "time", width: 150 },
    {
      title: "Loại",
      dataIndex: "type",
      width: 120,
      render: (value: string) => <Tag>{value || "-"}</Tag>,
    },
    {
      title: "SL thay đổi",
      dataIndex: "qty",
      width: 110,
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
      title: "Nguồn",
      dataIndex: "source",
      width: 160,
      render: (value: string, row) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text code>{value || "-"}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.sourceType}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 80,
      fixed: "right",
      render: (_, row) =>
        onTraceMovement ? (
          <button
            className="btn small"
            type="button"
            onClick={() => onTraceMovement(String(row.id))}
          >
            <HistoryOutlined style={{ marginRight: 4 }} />
            Trace
          </button>
        ) : null,
    },
  ];

  const itemColumns: ColumnsType<RawRecord> = [
    {
      title: "Mã Item",
      width: 140,
      render: (_, row) => (
        <Typography.Text code>
          {text(row.item_code ?? row.serial_number)}
        </Typography.Text>
      ),
    },
    {
      title: "Serial",
      width: 140,
      render: (_, row) => text(row.serial_number),
    },
    {
      title: "Trạng thái",
      width: 100,
      render: (_, row) => <Tag>{text(row.status)}</Tag>,
    },
    {
      title: "Tình trạng",
      width: 100,
      render: (_, row) => text(row.condition),
    },
    {
      title: "Physical Code",
      width: 130,
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
      title: "Nhận",
      width: 130,
      render: (_, row) => text(row.received_at),
    },
  ];

  const containerColumns: ColumnsType<RawRecord> = [
    {
      title: "Mã Container",
      width: 140,
      render: (_, row) => (
        <Typography.Text code>{text(row.container_code)}</Typography.Text>
      ),
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
      render: (_, row) => numberFormatter.format(Number(row.quantity ?? 0)),
    },
    {
      title: "TT Container",
      width: 110,
      render: (_, row) => <Tag>{text(row.container_status)}</Tag>,
    },
    {
      title: "Zone",
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
          <Descriptions.Item label="Lô">{balance.lotNo}</Descriptions.Item>
          <Descriptions.Item label="Đối soát">
            <Tag color={reconcileColor(balance.reconcile)}>
              {balance.reconcile}
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
            {balance.location}
          </Descriptions.Item>
          <Descriptions.Item label="Movement gần nhất">
            {balance.lastMovementId || "-"}
          </Descriptions.Item>
        </Descriptions>

        <Space wrap size="middle">
          <Statistic
            title="Available"
            value={balance.available}
            suffix={balance.uom}
          />
          <Statistic
            title="On-hand"
            value={balance.onHand}
            suffix={balance.uom}
          />
          <Statistic
            title="Reserved"
            value={balance.reserved}
            suffix={balance.uom}
          />
          <Statistic
            title="In-transit"
            value={balance.inTransit}
            suffix={balance.uom}
          />
          <Statistic
            title="Blocked/Hold"
            value={balance.blocked}
            suffix={balance.uom}
          />
          <Statistic title="Serial qty" value={formatQty(balance.serialQty)} />
          <Statistic title="Box qty" value={formatQty(balance.boxQty)} />
        </Space>

        {/* ──── Item Subledger ──── */}
        {subledgerQuery.isError ? (
          <ApiErrorAlert
            error={subledgerQuery.error}
            title="Không tải được subledger"
            onRetry={() => subledgerQuery.refetch()}
          />
        ) : null}

        <div>
          <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
            Item Subledger ({subledger?.item_count ?? balance.serialQty})
          </Typography.Text>
          <Table
            size="small"
            dataSource={(subledger?.items as RawRecord[]) ?? []}
            columns={itemColumns}
            rowKey={(row) => text(row.id, String(Math.random()))}
            loading={subledgerQuery.isLoading}
            pagination={false}
            scroll={{ x: 860 }}
            locale={{ emptyText: "Không có item instance" }}
          />
        </div>

        {/* ──── Container Subledger ──── */}
        <div>
          <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
            Container Subledger ({subledger?.container_count ?? balance.boxQty})
          </Typography.Text>
          <Table
            size="small"
            dataSource={(subledger?.containers as RawRecord[]) ?? []}
            columns={containerColumns}
            rowKey={(row) => text(row.id, String(Math.random()))}
            loading={subledgerQuery.isLoading}
            pagination={false}
            scroll={{ x: 650 }}
            locale={{ emptyText: "Không có container" }}
          />
        </div>

        {/* ──── Movement liên quan ──── */}
        <div>
          <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>
            Movement liên quan ({movements.length})
          </Typography.Text>
          <Table
            size="small"
            dataSource={movements}
            columns={movementColumns}
            rowKey="id"
            loading={movementsQuery.isLoading}
            pagination={false}
            scroll={{ x: 760 }}
            locale={{ emptyText: "Không có movement liên quan" }}
          />
        </div>
      </Space>
    </Modal>
  );
}
