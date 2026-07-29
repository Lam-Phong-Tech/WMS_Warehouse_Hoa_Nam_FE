import { useState } from "react";
import { Table, Button, Space, Tag, Input, Select, Tabs } from "antd";
import { ToolOutlined } from "@ant-design/icons";

const mockWarrantyCases = [
  {
    id: 1,
    caseCode: "WH-20260724-001",
    sku: "DCH-DRILL-DJZ10A...",
    serial: "SN-20260518-0042",
    agency: "Đại lý Hà Đông",
    defect: "DEF-MOTOR-01",
    status: "TEMP_ONLY",
    createdBy: "NV bảo hành",
    updatedAt: "10:32",
  },
  {
    id: 2,
    caseCode: "WH-20260724-002",
    sku: "DCH-GRINDER-DSM02...",
    serial: "SN-20260520-0088",
    agency: "Cửa hàng Đông Anh",
    defect: "DEF-BAT-02",
    status: "RETURN_TO_VENDOR",
    createdBy: "QL kho",
    updatedAt: "09:48",
  },
  {
    id: 3,
    caseCode: "WH-20260723-014",
    sku: "LK-DCH-PIN-20V...",
    serial: "—",
    agency: "Đối tác khác",
    defect: "DEF-PCB-03",
    status: "SCRAP",
    createdBy: "NV kho",
    updatedAt: "11:20",
  },
];

const mockWarrantyHistory = [
  {
    id: 1,
    time: "24/07/2026 10:32",
    caseCode: "WH-20260724-001",
    action: "Tạo case",
    actor: "NV bảo hành",
    note: "TEMP_ONLY",
  },
  {
    id: 2,
    time: "24/07/2026 09:48",
    caseCode: "WH-20260724-002",
    action: "Chuyển trạng thái",
    actor: "QL kho",
    note: "RETURN_TO_VENDOR",
  },
];

export default function WarrantyPage() {
  const [activeTab, setActiveTab] = useState("list");

  const statusColorMap: Record<string, string> = {
    TEMP_ONLY: "warning",
    RETURN_TO_VENDOR: "processing",
    SCRAP: "error",
    REPLACED: "success",
  };

  const columns = [
    {
      title: "Mã case",
      dataIndex: "caseCode",
      key: "caseCode",
      render: (v: string) => (
        <span style={{ fontFamily: "monospace" }}>{v}</span>
      ),
    },
    { title: "SKU", dataIndex: "sku", key: "sku" },
    {
      title: "Serial",
      dataIndex: "serial",
      key: "serial",
      render: (v: string) =>
        v === "—" ? (
          <span style={{ color: "#888" }}>—</span>
        ) : (
          <span style={{ fontFamily: "monospace" }}>{v}</span>
        ),
    },
    { title: "Agency", dataIndex: "agency", key: "agency" },
    {
      title: "Defect",
      dataIndex: "defect",
      key: "defect",
      render: (v: string) => (
        <span style={{ fontFamily: "monospace" }}>{v}</span>
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
          <a>Chuyển trạng thái</a>
        </Space>
      ),
    },
  ];

  const historyColumns = [
    { title: "Thời gian", dataIndex: "time", key: "time" },
    {
      title: "Case",
      dataIndex: "caseCode",
      key: "caseCode",
      render: (v: string) => (
        <span style={{ fontFamily: "monospace" }}>{v}</span>
      ),
    },
    { title: "Hành động", dataIndex: "action", key: "action" },
    { title: "Actor", dataIndex: "actor", key: "actor" },
    { title: "Ghi chú", dataIndex: "note", key: "note" },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "list",
            label: "Danh sách case bảo hành",
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
                      placeholder="Mã case/SKU/serial..."
                      style={{ width: 285 }}
                    />
                    <Select
                      placeholder="Trạng thái"
                      style={{ width: 125 }}
                      allowClear
                    />
                    <Select
                      placeholder="Agency"
                      style={{ width: 125 }}
                      allowClear
                    />
                    <Select
                      placeholder="Defect"
                      style={{ width: 125 }}
                      allowClear
                    />
                  </Space>
                  <Button type="primary" icon={<ToolOutlined />}>
                    ＋ Tạo case bảo hành
                  </Button>
                </div>
                <Table
                  dataSource={mockWarrantyCases}
                  columns={columns}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              </div>
            ),
          },
          {
            key: "history",
            label: "Lịch sử trạng thái",
            children: (
              <div>
                <Table
                  dataSource={mockWarrantyHistory}
                  columns={historyColumns}
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
