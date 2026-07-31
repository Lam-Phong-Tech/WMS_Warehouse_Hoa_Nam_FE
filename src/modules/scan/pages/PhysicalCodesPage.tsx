import { useEffect, useState } from "react";
import { Button, Input, Space, Table, Tabs, Tag } from "antd";
import { BarcodeOutlined } from "@ant-design/icons";
import {
  createScanBatch,
  fetchScanBatches,
  fetchScanEvents,
} from "@/modules/inventory/services/inventoryService";
import { getPhysicalCodes } from "@/modules/master-data/services/master-data.service";

type Row = Record<string, unknown>;

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

export default function PhysicalCodesPage() {
  const [activeTab, setActiveTab] = useState("list");
  const [codes, setCodes] = useState<Row[]>([]);
  const [batches, setBatches] = useState<Row[]>([]);
  const [events, setEvents] = useState<Row[]>([]);
  const [scanValue, setScanValue] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    if (activeTab === "list") {
      getPhysicalCodes({ page: 1, per_page: 20 })
        .then((result) => setCodes(result.data as unknown as Row[]))
        .catch(() => setCodes([]))
        .finally(() => setLoading(false));
      return;
    }
    Promise.all([fetchScanBatches({ per_page: 20 }), fetchScanEvents({ per_page: 20 })])
      .then(([batchRows, eventRows]) => {
        setBatches(batchRows);
        setEvents(eventRows);
      })
      .catch(() => {
        setBatches([]);
        setEvents([]);
      })
      .finally(() => setLoading(false));
  }, [activeTab]);

  async function submitScan() {
    const code = scanValue.trim();
    if (!code) return;
    setLoading(true);
    try {
      await createScanBatch({ source_type: "lookup", codes: [code] });
      const [batchRows, eventRows] = await Promise.all([
        fetchScanBatches({ per_page: 20 }),
        fetchScanEvents({ per_page: 20 }),
      ]);
      setBatches(batchRows);
      setEvents(eventRows);
      setScanValue("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "list",
            label: "Danh sách mã vật lý",
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Input.Search placeholder="Giá trị mã / UID..." style={{ width: 285 }} />
                  <Button type="primary" icon={<BarcodeOutlined />}>
                    Tạo mã
                  </Button>
                </Space>
                <Table
                  dataSource={codes}
                  rowKey={(row) => text(row.id ?? row.code_value)}
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  columns={[
                    { title: "Giá trị mã", dataIndex: "code_value", key: "code_value" },
                    {
                      title: "Loại",
                      dataIndex: "code_type",
                      key: "code_type",
                      render: (value: string) => <Tag>{value}</Tag>,
                    },
                    { title: "Vật mang", dataIndex: "carrier_type", key: "carrier_type" },
                    { title: "Đối tượng", dataIndex: "target_type", key: "target_type" },
                    { title: "SKU/Container", dataIndex: "sku_code", key: "sku_code" },
                    { title: "Trạng thái", dataIndex: "status", key: "status" },
                    { title: "Vị trí gợi ý", dataIndex: "location_hint", key: "location_hint" },
                  ]}
                />
              </>
            ),
          },
          {
            key: "scan",
            label: "Lô quét / sự kiện",
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Input.Search
                    placeholder="Quét/nhập mã..."
                    value={scanValue}
                    onChange={(event) => setScanValue(event.target.value)}
                    onSearch={submitScan}
                    style={{ width: 360 }}
                  />
                  <Button type="primary" onClick={submitScan} loading={loading}>
                    Gửi quét
                  </Button>
                </Space>
                <Table
                  dataSource={batches}
                  rowKey={(row) => text(row.id)}
                  loading={loading}
                  pagination={{ pageSize: 5 }}
                  columns={[
                    { title: "Lô", dataIndex: "id", key: "id" },
                    { title: "Nguồn", dataIndex: "source_type", key: "source_type" },
                    { title: "Trạng thái", dataIndex: "status", key: "status" },
                    { title: "Tạo lúc", dataIndex: "created_at", key: "created_at" },
                  ]}
                />
                <Table
                  style={{ marginTop: 16 }}
                  dataSource={events}
                  rowKey={(row) => text(row.id)}
                  loading={loading}
                  pagination={{ pageSize: 5 }}
                  columns={[
                    { title: "Mã", dataIndex: "code_value", key: "code_value" },
                    { title: "Loại", dataIndex: "code_type", key: "code_type" },
                    { title: "Kết quả", dataIndex: "status", key: "status" },
                    { title: "Tạo lúc", dataIndex: "created_at", key: "created_at" },
                  ]}
                />
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
