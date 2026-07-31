import { useEffect, useState } from "react";
import { Button, Input, Select, Space, Table, Tabs, Tag, Tooltip } from "antd";
import {
  EyeOutlined,
  HistoryOutlined,
  RollbackOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  fetchInventoryBalances,
  fetchStockMovements,
  type InventoryBalanceRow,
  type StockMovementRow,
} from "../services/inventoryService";

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState("stock");
  const [balances, setBalances] = useState<InventoryBalanceRow[]>([]);
  const [movements, setMovements] = useState<StockMovementRow[]>([]);
  const [stockSearch, setStockSearch] = useState("");
  const [stockStatus, setStockStatus] = useState<string>();
  const [movementSearch, setMovementSearch] = useState("");
  const [movementType, setMovementType] = useState<string>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== "stock") return;
    setLoading(true);
    fetchInventoryBalances({ search: stockSearch, status: stockStatus, limit: 20 })
      .then(setBalances)
      .catch(() => setBalances([]))
      .finally(() => setLoading(false));
  }, [activeTab, stockSearch, stockStatus]);

  useEffect(() => {
    if (activeTab !== "movement") return;
    setLoading(true);
    fetchStockMovements({
      search: movementSearch,
      keyword: movementSearch,
      movement_type: movementType,
      per_page: 20,
    })
      .then(setMovements)
      .catch(() => setMovements([]))
      .finally(() => setLoading(false));
  }, [activeTab, movementSearch, movementType]);

  const columns = [
    {
      title: "SKU",
      dataIndex: "sku",
      key: "sku",
      render: (v: string) => <span style={{ fontFamily: "monospace" }}>{v}</span>,
    },
    {
      title: "Tên hàng",
      dataIndex: "name",
      key: "name",
      render: (v: string) => <strong>{v}</strong>,
    },
    {
      title: "Loại",
      dataIndex: "type",
      key: "type",
      render: (v: string) => <Tag color={v === "PRODUCT" ? "blue" : "green"}>{v}</Tag>,
    },
    {
      title: "Khả dụng",
      dataIndex: "available",
      key: "available",
      render: (v: number) => (
        <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          <strong>{v}</strong>
        </span>
      ),
    },
    {
      title: "SL serial",
      dataIndex: "serialQty",
      key: "serialQty",
      render: (v: number) => (
        <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          {v}
        </span>
      ),
    },
    {
      title: "SL box",
      dataIndex: "boxQty",
      key: "boxQty",
      render: (v: number) => (
        <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
          {v}
        </span>
      ),
    },
    { title: "Vị trí gợi ý", dataIndex: "location", key: "location" },
    {
      title: "Đối soát",
      dataIndex: "reconcile",
      key: "reconcile",
      render: (v: string) => <Tag color={v === "PASS" ? "success" : "warning"}>{v}</Tag>,
    },
    { title: "Cập nhật", dataIndex: "updatedAt", key: "updatedAt" },
    {
      title: "Hành động",
      key: "action",
      render: () => (
        <Space>
          <Tooltip title="Chi tiết">
            <Button type="text" icon={<EyeOutlined />} />
          </Tooltip>
          <Tooltip title="Truy vết">
            <Button type="text" icon={<HistoryOutlined />} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const movementColumns = [
    {
      title: "Mã dịch chuyển",
      dataIndex: "movementId",
      key: "movementId",
      render: (v: string) => <span style={{ fontFamily: "monospace" }}>{v}</span>,
    },
    { title: "Thời gian ghi nhận", dataIndex: "time", key: "time" },
    { title: "Loại", dataIndex: "type", key: "type" },
    { title: "SKU", dataIndex: "sku", key: "sku" },
    {
      title: "SL thay đổi",
      dataIndex: "qty",
      key: "qty",
      render: (v: number) => (
        <span
          style={{
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
            color: v > 0 ? "#3f8600" : "#cf1322",
          }}
        >
          {v > 0 ? `+${v}` : v}
        </span>
      ),
    },
    {
      title: "Nguồn",
      dataIndex: "source",
      key: "source",
      render: (v: string) => <span style={{ fontFamily: "monospace" }}>{v}</span>,
    },
    { title: "Người thao tác", dataIndex: "actor", key: "actor" },
    { title: "Chuỗi liên kết", dataIndex: "chain", key: "chain" },
    {
      title: "Hành động",
      key: "action",
      render: () => (
        <Space>
          <Tooltip title="Chi tiết">
            <Button type="text" icon={<EyeOutlined />} />
          </Tooltip>
          <Tooltip title="Hoàn đảo">
            <Button type="text" icon={<RollbackOutlined />} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "stock",
            label: "Tồn kho hiện tại",
            children: (
              <div>
                <div
                  style={{
                    marginBottom: 16,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <Space>
                    <Input.Search
                      placeholder="SKU/tên hàng..."
                      style={{ width: 285 }}
                      allowClear
                      onSearch={setStockSearch}
                    />
                    <Select
                      placeholder="Loại hàng"
                      style={{ width: 125 }}
                      allowClear
                    />
                    <Select
                      placeholder="Trạng thái tồn"
                      style={{ width: 125 }}
                      allowClear
                      value={stockStatus}
                      onChange={setStockStatus}
                      options={[
                        { value: "active", label: "Hoạt động" },
                        { value: "inactive", label: "Ngưng hoạt động" },
                      ]}
                    />
                    <Select
                      placeholder="Đối soát"
                      style={{ width: 125 }}
                      allowClear
                    />
                  </Space>
                  <Space>
                    <Button icon={<SearchOutlined />}>Xuất file</Button>
                  </Space>
                </div>
                <Table
                  dataSource={balances}
                  columns={columns}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
                <div
                  style={{
                    marginTop: 12,
                    background: "#eaf1f8",
                    border: "1px dashed #bcd2e6",
                    borderRadius: 4,
                    padding: 10,
                    fontSize: 12.5,
                    color: "#314e68",
                  }}
                >
                  <b>Vị trí gợi ý/khay</b> chỉ giúp tìm hàng, không tham gia
                  công thức tồn và không tạo bucket tồn riêng.
                </div>
              </div>
            ),
          },
          {
            key: "movement",
            label: "Lịch sử dịch chuyển",
            children: (
              <div>
                <div
                  style={{
                    marginBottom: 16,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <Space>
                    <Input.Search
                      placeholder="Dịch chuyển/chứng từ..."
                      style={{ width: 285 }}
                      allowClear
                      onSearch={setMovementSearch}
                    />
                    <Select
                      placeholder="Loại dịch chuyển"
                      style={{ width: 150 }}
                      allowClear
                      value={movementType}
                      onChange={setMovementType}
                      options={[
                        { value: "RECEIPT_IN", label: "Nhập kho" },
                        { value: "ISSUE_OUT", label: "Xuất kho" },
                        { value: "TRANSFER_OUT", label: "Chuyển đi" },
                        { value: "TRANSFER_IN", label: "Chuyển đến" },
                        { value: "TRANSFER_RETURN", label: "Trả lại" },
                        { value: "TRANSFER_LOSS", label: "Mất mát" },
                      ]}
                    />
                    <Select
                      placeholder="Khoảng ngày"
                      style={{ width: 125 }}
                      allowClear
                    />
                  </Space>
                  <Button>Xem chuỗi điều chỉnh</Button>
                </div>
                <Table
                  dataSource={movements}
                  columns={movementColumns}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
