import { useState } from "react";
import { Table, Button, Space, Tag, Input, Select, Tabs } from "antd";
import { BarcodeOutlined, ExperimentOutlined } from "@ant-design/icons";

const mockPhysicalCodes = [
  {
    id: 1,
    codeValue: "RFID-ITEM-000124",
    codeType: "ITEM",
    carrier: "RFID",
    target: "Item IT-000124",
    sku: "DCH-DRILL-DJZ10A...",
    status: "ACTIVE",
    location: "CARTON-HN-0007",
  },
  {
    id: 2,
    codeValue: "CARTON-HN-0007",
    codeType: "CARTON",
    carrier: "BARCODE",
    target: "Carton CT-0007",
    sku: "20 item",
    status: "ACTIVE",
    location: "Khu nhập - chờ",
  },
  {
    id: 3,
    codeValue: "BOX-LK-0042",
    codeType: "BOX",
    carrier: "QR",
    target: "Box BX-0042",
    sku: "LK-DCH-OC-VIT-M2...",
    status: "PENDING_PUTAWAY",
    location: "Chưa gán khay",
  },
  {
    id: 4,
    codeValue: "TRAY-T-01",
    codeType: "TRAY",
    carrier: "NFC",
    target: "Tray T-01",
    sku: "8 box",
    status: "ACTIVE",
    location: "Khu linh kiện",
  },
];

const mockScanResults = [
  { code: "CARTON-HN-0007", type: "CARTON", result: "VALID" },
  { code: "RFID-ITEM-000124", type: "ITEM", result: "VALID" },
  { code: "UNKNOWN-9988", type: "UNKNOWN", result: "INVALID" },
];

export default function PhysicalCodesPage() {
  const [activeTab, setActiveTab] = useState("list");

  const columns = [
    {
      title: "Code value",
      dataIndex: "codeValue",
      key: "codeValue",
      render: (v: string) => (
        <span style={{ fontFamily: "monospace" }}>{v}</span>
      ),
    },
    {
      title: "Loại",
      dataIndex: "codeType",
      key: "codeType",
      render: (v: string) => (
        <Tag
          color={
            v === "ITEM"
              ? "cyan"
              : v === "CARTON"
                ? "blue"
                : v === "BOX"
                  ? "orange"
                  : "default"
          }
        >
          {v}
        </Tag>
      ),
    },
    { title: "Carrier", dataIndex: "carrier", key: "carrier" },
    { title: "Target", dataIndex: "target", key: "target" },
    { title: "SKU/Container", dataIndex: "sku", key: "sku" },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (v: string) => {
        if (v === "ACTIVE") return <Tag color="success">Đang dùng</Tag>;
        if (v === "PENDING_PUTAWAY")
          return <Tag color="warning">Chờ xếp khay</Tag>;
        return <Tag>{v}</Tag>;
      },
    },
    { title: "Vị trí gợi ý", dataIndex: "location", key: "location" },
    {
      title: "Action",
      key: "action",
      render: () => (
        <Space>
          <a>Trace</a>
          <a>Thay chip</a>
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
            key: "list",
            label: "Danh sách Physical Code",
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
                      placeholder="Code value / UID..."
                      style={{ width: 285 }}
                    />
                    <Select
                      placeholder="Code type"
                      style={{ width: 125 }}
                      allowClear
                    />
                    <Select
                      placeholder="Carrier"
                      style={{ width: 125 }}
                      allowClear
                    />
                    <Select
                      placeholder="Trạng thái"
                      style={{ width: 125 }}
                      allowClear
                    />
                  </Space>
                  <Space>
                    <Button icon={<ExperimentOutlined />}>Demo máy quét</Button>
                    <Button type="primary" icon={<BarcodeOutlined />}>
                      ＋ Tạo mã
                    </Button>
                  </Space>
                </div>
                <Table
                  dataSource={mockPhysicalCodes}
                  columns={columns}
                  rowKey="id"
                  pagination={{ pageSize: 10 }}
                />
              </div>
            ),
          },
          {
            key: "trace",
            label: "Trace mã vật lý",
            children: (
              <div>
                <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
                  <Input.Search
                    placeholder="RFID-ITEM-000124"
                    style={{ width: 400 }}
                  />
                  <Button type="primary">Tra cứu</Button>
                </div>
                <div
                  style={{
                    background: "#f5f5f5",
                    padding: 24,
                    borderRadius: 4,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        border: "2px solid #356fa3",
                        background: "#eaf1f8",
                        padding: 12,
                        borderRadius: 4,
                        minWidth: 165,
                      }}
                    >
                      <strong>Physical Code</strong>
                      <div style={{ fontFamily: "monospace" }}>
                        RFID-ITEM-000124
                      </div>
                      <div style={{ fontSize: 12, color: "#888" }}>
                        ACTIVE · RFID
                      </div>
                    </div>
                    <span style={{ fontWeight: 900, color: "#888" }}>→</span>
                    <div
                      style={{
                        border: "1.5px solid #333",
                        background: "#fff",
                        padding: 12,
                        borderRadius: 4,
                        minWidth: 165,
                      }}
                    >
                      <strong>Item</strong>
                      <div style={{ fontFamily: "monospace" }}>IT-000124</div>
                      <div style={{ fontSize: 12, color: "#888" }}>
                        IN_STOCK
                      </div>
                    </div>
                    <span style={{ fontWeight: 900, color: "#888" }}>→</span>
                    <div
                      style={{
                        border: "1.5px solid #333",
                        background: "#fff",
                        padding: 12,
                        borderRadius: 4,
                        minWidth: 165,
                      }}
                    >
                      <strong>SKU</strong>
                      <div>DCH-DRILL-DJZ10A...</div>
                      <div style={{ fontSize: 12, color: "#888" }}>PRODUCT</div>
                    </div>
                    <span style={{ fontWeight: 900, color: "#888" }}>→</span>
                    <div
                      style={{
                        border: "1.5px solid #333",
                        background: "#fff",
                        padding: 12,
                        borderRadius: 4,
                        minWidth: 165,
                      }}
                    >
                      <strong>Container</strong>
                      <div style={{ fontFamily: "monospace" }}>
                        CARTON-HN-0007
                      </div>
                      <div style={{ fontSize: 12, color: "#888" }}>
                        IN_STOCK
                      </div>
                    </div>
                    <span style={{ fontWeight: 900, color: "#888" }}>→</span>
                    <div
                      style={{
                        border: "1.5px solid #333",
                        background: "#fff",
                        padding: 12,
                        borderRadius: 4,
                        minWidth: 165,
                      }}
                    >
                      <strong>Kho</strong>
                      <div>Kho tổng Hoa Nam</div>
                      <div style={{ fontSize: 12, color: "#888" }}>
                        available
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      border: "1px solid #e3e0d8",
                      background: "#fcfbf8",
                      padding: 12,
                      borderRadius: 4,
                    }}
                  >
                    <strong>Movement gần nhất</strong>
                    <div style={{ fontFamily: "monospace" }}>
                      RECEIPT_POSTED · MOV-000812
                    </div>
                    <div style={{ fontSize: 12, color: "#888" }}>
                      24/07/2026 08:42
                    </div>
                  </div>
                  <div
                    style={{
                      border: "1px solid #e3e0d8",
                      background: "#fcfbf8",
                      padding: 12,
                      borderRadius: 4,
                    }}
                  >
                    <strong>Warranty</strong>
                    <div>Không có case active</div>
                  </div>
                  <div
                    style={{
                      border: "1px solid #e3e0d8",
                      background: "#fcfbf8",
                      padding: 12,
                      borderRadius: 4,
                    }}
                  >
                    <strong>Code history</strong>
                    <div>UID cũ → chip hiện tại</div>
                    <div style={{ color: "#356fa3", fontWeight: 900 }}>
                      Xem chuỗi thay thế
                    </div>
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: "demo",
            label: "Demo máy quét",
            children: (
              <div>
                <div
                  style={{
                    marginBottom: 8,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11.5,
                      color: "#888",
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Nguồn
                  </span>
                  <span
                    style={{
                      fontSize: 11.5,
                      background: "#eef5fb",
                      color: "#2d638f",
                      border: "1px solid #bcd2e6",
                      padding: "3px 7px",
                      borderRadius: 3,
                    }}
                  >
                    POST /scan-batches/classify
                  </span>
                  <span
                    style={{
                      fontSize: 11.5,
                      background: "#fff4cf",
                      color: "#6b5a12",
                      border: "1px solid #c9a227",
                      padding: "3px 7px",
                      borderRadius: 3,
                    }}
                  >
                    1..500 mã/request
                  </span>
                  <span
                    style={{
                      fontSize: 11.5,
                      background: "#fff4cf",
                      color: "#6b5a12",
                      border: "1px solid #c9a227",
                      padding: "3px 7px",
                      borderRadius: 3,
                    }}
                  >
                    Không tự đổi tồn
                  </span>
                </div>
                <div
                  style={{
                    background: "#fff",
                    border: "2px solid #333",
                    borderRadius: 4,
                    padding: 20,
                    boxShadow: "4px 5px 0 rgba(43,43,43,.12)",
                  }}
                >
                  <div style={{ fontSize: 19, marginBottom: 16 }}>
                    Demo Scanner
                  </div>
                  <div style={{ display: "flex", gap: 12, marginBottom: 13 }}>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 12.5,
                          color: "#888",
                          marginBottom: 5,
                        }}
                      >
                        Ngữ cảnh *
                      </div>
                      <Select
                        defaultValue="lookup"
                        style={{ width: "100%" }}
                        options={[{ value: "lookup", label: "Tra cứu mã" }]}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 12.5,
                          color: "#888",
                          marginBottom: 5,
                        }}
                      >
                        Số mã giả lập
                      </div>
                      <Input type="number" defaultValue={5} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12, marginBottom: 13 }}>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 12.5,
                          color: "#888",
                          marginBottom: 5,
                        }}
                      >
                        Scan input
                      </div>
                      <Input placeholder="RFID-ITEM-000124" />
                      <div
                        style={{ fontSize: 11.5, color: "#888", marginTop: 4 }}
                      >
                        Auto-focus; Enter/reader event submit; giữ focus sau
                        success/error.
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 9,
                      flexWrap: "wrap",
                      marginBottom: 14,
                    }}
                  >
                    <Button type="primary" icon={<ExperimentOutlined />}>
                      ⌁ Sinh batch demo
                    </Button>
                    <Button>＋ Thêm mã tay</Button>
                    <Button style={{ borderStyle: "dashed", color: "#888" }}>
                      Xóa batch
                    </Button>
                  </div>
                  <div
                    style={{ borderTop: "1px dashed #e3e0d8", paddingTop: 13 }}
                  >
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "#888",
                        textTransform: "uppercase",
                        fontWeight: 700,
                        marginBottom: 10,
                      }}
                    >
                      Kết quả phân loại
                    </div>
                    <Table
                      dataSource={mockScanResults}
                      pagination={false}
                      size="small"
                      columns={[
                        {
                          title: "Mã",
                          dataIndex: "code",
                          key: "code",
                          render: (v: string) => (
                            <span style={{ fontFamily: "monospace" }}>{v}</span>
                          ),
                        },
                        { title: "Loại", dataIndex: "type", key: "type" },
                        {
                          title: "Kết quả",
                          dataIndex: "result",
                          key: "result",
                          render: (v: string) => (
                            <Tag color={v === "VALID" ? "success" : "danger"}>
                              {v === "VALID" ? "Hợp lệ" : "Không nhận diện"}
                            </Tag>
                          ),
                        },
                      ]}
                    />
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: "status",
            label: "Convention code status",
            children: (
              <div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th
                        style={{
                          background: "#f3f1ea",
                          color: "#888",
                          fontSize: 12.5,
                          fontWeight: 700,
                          textAlign: "left",
                          padding: 11,
                          borderBottom: "1px solid #d8d5cc",
                        }}
                      >
                        State
                      </th>
                      <th
                        style={{
                          background: "#f3f1ea",
                          color: "#888",
                          fontSize: 12.5,
                          fontWeight: 700,
                          textAlign: "left",
                          padding: 11,
                          borderBottom: "1px solid #d8d5cc",
                        }}
                      >
                        UI label
                      </th>
                      <th
                        style={{
                          background: "#f3f1ea",
                          color: "#888",
                          fontSize: 12.5,
                          fontWeight: 700,
                          textAlign: "left",
                          padding: 11,
                          borderBottom: "1px solid #d8d5cc",
                        }}
                      >
                        Rule
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td
                        style={{
                          padding: 11,
                          borderBottom: "1px solid #ece9e1",
                          fontSize: 13,
                          color: "#4a463e",
                        }}
                      >
                        ACTIVE
                      </td>
                      <td
                        style={{
                          padding: 11,
                          borderBottom: "1px solid #ece9e1",
                        }}
                      >
                        <Tag color="success">Đang dùng</Tag>
                      </td>
                      <td
                        style={{
                          padding: 11,
                          borderBottom: "1px solid #ece9e1",
                          fontSize: 13,
                          color: "#4a463e",
                        }}
                      >
                        Được scan theo permission/state.
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          padding: 11,
                          borderBottom: "1px solid #ece9e1",
                          fontSize: 13,
                          color: "#4a463e",
                        }}
                      >
                        DAMAGED
                      </td>
                      <td
                        style={{
                          padding: 11,
                          borderBottom: "1px solid #ece9e1",
                        }}
                      >
                        <Tag color="warning">Hỏng/khó đọc</Tag>
                      </td>
                      <td
                        style={{
                          padding: 11,
                          borderBottom: "1px solid #ece9e1",
                          fontSize: 13,
                          color: "#4a463e",
                        }}
                      >
                        Chặn post thường; có controlled fallback.
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          padding: 11,
                          borderBottom: "1px solid #ece9e1",
                          fontSize: 13,
                          color: "#4a463e",
                        }}
                      >
                        LOST
                      </td>
                      <td
                        style={{
                          padding: 11,
                          borderBottom: "1px solid #ece9e1",
                        }}
                      >
                        <Tag color="error">Thất lạc</Tag>
                      </td>
                      <td
                        style={{
                          padding: 11,
                          borderBottom: "1px solid #ece9e1",
                          fontSize: 13,
                          color: "#4a463e",
                        }}
                      >
                        Không tái gán code cũ.
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          padding: 11,
                          borderBottom: "1px solid #ece9e1",
                          fontSize: 13,
                          color: "#4a463e",
                        }}
                      >
                        REPLACED
                      </td>
                      <td
                        style={{
                          padding: 11,
                          borderBottom: "1px solid #ece9e1",
                        }}
                      >
                        <Tag color="default">Đã thay</Tag>
                      </td>
                      <td
                        style={{
                          padding: 11,
                          borderBottom: "1px solid #ece9e1",
                          fontSize: 13,
                          color: "#4a463e",
                        }}
                      >
                        Trace chuỗi old → new.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
