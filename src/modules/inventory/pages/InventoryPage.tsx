import { useState } from "react";
import { Table, Button, Space, Tag, Input, Select, Tabs } from "antd";
import { SearchOutlined } from "@ant-design/icons";

const mockInventory = [
  {
    id: 1,
    sku: "DCH-DRILL-DJZ10A-220V-V1",
    name: "Máy khoan DJZ10A",
    type: "PRODUCT",
    available: 58,
    serialQty: 58,
    boxQty: 0,
    location: "Carton/khu lưu tự do",
    reconcile: "PASS",
    updatedAt: "10:32",
  },
  {
    id: 2,
    sku: "LK-DCH-OC-VIT-M2-V1",
    name: "Ốc vít M2",
    type: "COMPONENT",
    available: 450,
    serialQty: 0,
    boxQty: 450,
    location: "BOX-LK-0042 · chưa Putaway",
    reconcile: "WARNING",
    updatedAt: "10:18",
  },
  {
    id: 3,
    sku: "LK-DCH-PIN-20V-V1",
    name: "Pin 20V",
    type: "COMPONENT",
    available: 80,
    serialQty: 80,
    boxQty: 0,
    location: "TRAY-T-03",
    reconcile: "PASS",
    updatedAt: "09:55",
  },
];

const mockMovements = [
  {
    id: 1,
    movementId: "MOV-000812",
    time: "24/07/2026 08:42",
    type: "RECEIPT_POSTED",
    sku: "DCH-DRILL-DJZ10A...",
    qty: 20,
    source: "PN-20260724-001",
    actor: "NV kho",
    chain: "Original",
  },
  {
    id: 2,
    movementId: "MOV-000826",
    time: "24/07/2026 09:48",
    type: "ISSUE_POSTED",
    sku: "DCH-GRINDER-DSM02...",
    qty: -5,
    source: "PX-20260724-004",
    actor: "NV kho",
    chain: "Original",
  },
  {
    id: 3,
    movementId: "MOV-000829",
    time: "24/07/2026 10:05",
    type: "ADJUST_IN",
    sku: "LK-DCH-SAC-20V...",
    qty: 2,
    source: "STK-20260724-01",
    actor: "QL kho",
    chain: "Adjustment",
  },
];

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState("stock");

  const columns = [
    {
      title: "SKU",
      dataIndex: "sku",
      key: "sku",
      render: (v: string) => (
        <span style={{ fontFamily: "monospace" }}>{v}</span>
      ),
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
      render: (v: string) => (
        <Tag color={v === "PRODUCT" ? "blue" : "green"}>{v}</Tag>
      ),
    },
    {
      title: "Available",
      dataIndex: "available",
      key: "available",
      render: (v: number) => (
        <span
          style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
        >
          <strong>{v}</strong>
        </span>
      ),
    },
    {
      title: "Serial qty",
      dataIndex: "serialQty",
      key: "serialQty",
      render: (v: number) => (
        <span
          style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
        >
          {v}
        </span>
      ),
    },
    {
      title: "Box qty",
      dataIndex: "boxQty",
      key: "boxQty",
      render: (v: number) => (
        <span
          style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
        >
          {v}
        </span>
      ),
    },
    { title: "Location hint", dataIndex: "location", key: "location" },
    {
      title: "Đối soát",
      dataIndex: "reconcile",
      key: "reconcile",
      render: (v: string) => (
        <Tag color={v === "PASS" ? "success" : "warning"}>{v}</Tag>
      ),
    },
    { title: "Cập nhật", dataIndex: "updatedAt", key: "updatedAt" },
    {
      title: "Action",
      key: "action",
      render: () => (
        <Space>
          <a>Chi tiết</a>
          <a>Trace</a>
        </Space>
      ),
    },
  ];

  const movementColumns = [
    {
      title: "Movement ID",
      dataIndex: "movementId",
      key: "movementId",
      render: (v: string) => (
        <span style={{ fontFamily: "monospace" }}>{v}</span>
      ),
    },
    { title: "Thời gian post", dataIndex: "time", key: "time" },
    { title: "Loại", dataIndex: "type", key: "type" },
    { title: "SKU", dataIndex: "sku", key: "sku" },
    {
      title: "Qty delta",
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
      title: "Source",
      dataIndex: "source",
      key: "source",
      render: (v: string) => (
        <span style={{ fontFamily: "monospace" }}>{v}</span>
      ),
    },
    { title: "Actor", dataIndex: "actor", key: "actor" },
    { title: "Chain", dataIndex: "chain", key: "chain" },
    {
      title: "Action",
      key: "action",
      render: () => (
        <Space>
          <a>Chi tiết</a>
          <a>Reverse</a>
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
                    />
                    <Select
                      placeholder="Loại hàng"
                      style={{ width: 125 }}
                      allowClear
                    />
                    <Select
                      placeholder="Stock status"
                      style={{ width: 125 }}
                      allowClear
                    />
                    <Select
                      placeholder="Reconcile"
                      style={{ width: 125 }}
                      allowClear
                    />
                  </Space>
                  <Space>
                    <Button icon={<SearchOutlined />}>Export</Button>
                  </Space>
                </div>
                <Table
                  dataSource={mockInventory}
                  columns={columns}
                  rowKey="id"
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
                  <b>Location hint/tray</b> chỉ giúp tìm hàng, không tham gia
                  công thức tồn và không tạo bucket tồn riêng.
                </div>
              </div>
            ),
          },
          {
            key: "movement",
            label: "Lịch sử Movement",
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
                      placeholder="Movement/document..."
                      style={{ width: 285 }}
                    />
                    <Select
                      placeholder="Loại movement"
                      style={{ width: 125 }}
                      allowClear
                    />
                    <Select
                      placeholder="Khoảng ngày"
                      style={{ width: 125 }}
                      allowClear
                    />
                  </Space>
                  <Button>Xem correction chain</Button>
                </div>
                <Table
                  dataSource={mockMovements}
                  columns={movementColumns}
                  rowKey="id"
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
