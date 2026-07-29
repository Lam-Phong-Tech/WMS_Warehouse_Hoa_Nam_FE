import { useState } from "react";
import { Table, Button, Space, Tag, Input, Select, Tabs } from "antd";
import { PlusOutlined, ExportOutlined, InboxOutlined } from "@ant-design/icons";

const mockInboundDocs = [
  {
    id: 1,
    code: "PN-20260724-001",
    source: "NCC Trung Quốc",
    date: "24/07/2026",
    expected: 120,
    posted: 80,
    remaining: 40,
    status: "PARTIALLY_POSTED",
    createdBy: "NV kho",
    updatedAt: "10:32",
  },
  {
    id: 2,
    code: "PN-20260724-002",
    source: "Lô linh kiện T7",
    date: "24/07/2026",
    expected: 500,
    posted: 0,
    remaining: 500,
    status: "SCANNING",
    createdBy: "NV kho",
    updatedAt: "09:48",
  },
  {
    id: 3,
    code: "PN-20260723-014",
    source: "NCC nội địa",
    date: "23/07/2026",
    expected: 30,
    posted: 30,
    remaining: 0,
    status: "POSTED",
    createdBy: "QL kho",
    updatedAt: "10:18",
  },
];

const mockInboundLines = [
  {
    id: 1,
    selected: true,
    sku: "DCH-DRILL-DJZ10A...",
    target: "CARTON-HN-0007 · 20 item",
    expected: 60,
    scanned: 60,
    posted: 40,
    remaining: 20,
    validation: "Hợp lệ",
  },
  {
    id: 2,
    selected: true,
    sku: "LK-DCH-PIN-20V-V1",
    target: "BOX-LK-0042 · 20 serial",
    expected: 40,
    scanned: 20,
    posted: 0,
    remaining: 40,
    validation: "Có thể post 20",
  },
  {
    id: 3,
    selected: false,
    sku: "—",
    target: "UNKNOWN-9988",
    expected: "—",
    scanned: 1,
    posted: 0,
    remaining: "—",
    validation: "Mã lạ",
  },
];

export default function InboundPage() {
  const [activeTab, setActiveTab] = useState("list");

  const statusColorMap: Record<string, string> = {
    PARTIALLY_POSTED: "warning",
    POSTED: "success",
    SCANNING: "processing",
    REVIEWING: "purple",
  };

  const columns = [
    {
      title: "Mã phiếu",
      dataIndex: "code",
      key: "code",
      render: (v: string) => (
        <span style={{ fontFamily: "monospace" }}>{v}</span>
      ),
    },
    { title: "Nguồn hàng", dataIndex: "source", key: "source" },
    { title: "Ngày", dataIndex: "date", key: "date" },
    {
      title: "Expected",
      dataIndex: "expected",
      key: "expected",
      render: (v: number) => (
        <span
          style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
        >
          {v}
        </span>
      ),
    },
    {
      title: "Posted",
      dataIndex: "posted",
      key: "posted",
      render: (v: number) => (
        <span
          style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
        >
          {v}
        </span>
      ),
    },
    {
      title: "Remaining",
      dataIndex: "remaining",
      key: "remaining",
      render: (v: number) => (
        <span
          style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
        >
          <strong>{v}</strong>
        </span>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (v: string) => (
        <Tag color={statusColorMap[v] || "default"}>{v}</Tag>
      ),
    },
    { title: "Người tạo", dataIndex: "createdBy", key: "createdBy" },
    { title: "Cập nhật", dataIndex: "updatedAt", key: "updatedAt" },
    {
      title: "Action",
      key: "action",
      render: () => (
        <Space>
          <a>Mở</a>
          <a>Post tiếp</a>
        </Space>
      ),
    },
  ];

  const lineColumns = [
    {
      title: "Chọn post",
      key: "selected",
      render: () => <input type="checkbox" defaultChecked />,
    },
    { title: "SKU", dataIndex: "sku", key: "sku" },
    { title: "Đối tượng scan", dataIndex: "target", key: "target" },
    {
      title: "Expected",
      dataIndex: "expected",
      key: "expected",
      render: (v: number | string) => (
        <span
          style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
        >
          {v}
        </span>
      ),
    },
    {
      title: "Scanned",
      dataIndex: "scanned",
      key: "scanned",
      render: (v: number) => (
        <span
          style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
        >
          {v}
        </span>
      ),
    },
    {
      title: "Đã post",
      dataIndex: "posted",
      key: "posted",
      render: (v: number) => (
        <span
          style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
        >
          {v}
        </span>
      ),
    },
    {
      title: "Còn lại",
      dataIndex: "remaining",
      key: "remaining",
      render: (v: number | string) => (
        <span
          style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}
        >
          <strong>{v}</strong>
        </span>
      ),
    },
    {
      title: "Validation",
      dataIndex: "validation",
      key: "validation",
      render: (v: string) => (
        <Tag
          color={
            v === "Hợp lệ" || v === "Có thể post 20" ? "success" : "danger"
          }
        >
          {v}
        </Tag>
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
            key: "list",
            label: "Danh sách phiếu nhập",
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
                      placeholder="Mã phiếu/nguồn/SKU..."
                      style={{ width: 285 }}
                    />
                    <Select
                      placeholder="Trạng thái"
                      style={{ width: 125 }}
                      allowClear
                    />
                    <Select
                      placeholder="Ngày nhập"
                      style={{ width: 125 }}
                      allowClear
                    />
                  </Space>
                  <Space>
                    <Button icon={<ExportOutlined />}>Export</Button>
                    <Button type="primary" icon={<PlusOutlined />}>
                      ＋ Tạo phiếu nhập
                    </Button>
                  </Space>
                </div>
                <Table
                  dataSource={mockInboundDocs}
                  columns={columns}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              </div>
            ),
          },
          {
            key: "scan",
            label: "Scan & đối chiếu dòng nhập",
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
                      placeholder="⌁ Scan/nhập mã..."
                      style={{ width: 285 }}
                    />
                    <Button type="primary" icon={<InboxOutlined />}>
                      Demo máy quét
                    </Button>
                    <Select
                      placeholder="Hiện lỗi"
                      style={{ width: 125 }}
                      allowClear
                    />
                  </Space>
                  <Button>Tạo mã mới</Button>
                </div>
                <Table
                  dataSource={mockInboundLines}
                  columns={lineColumns}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
                <div
                  style={{
                    marginTop: 12,
                    background: "#fff4cf",
                    border: "1px dashed #c9a227",
                    borderRadius: 4,
                    padding: 10,
                  }}
                >
                  <strong>Stock effect preview:</strong> Post subset hiện tại sẽ
                  tăng Available +40, sinh 2 posting event và 2 movement.
                  Putaway linh kiện thực hiện sau, không đổi tồn.
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
