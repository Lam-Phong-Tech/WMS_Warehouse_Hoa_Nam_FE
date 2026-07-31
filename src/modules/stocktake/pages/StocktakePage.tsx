import { useEffect, useState } from "react";
import { Button, Input, Space, Table, Tabs, Tag } from "antd";
import { ExperimentOutlined } from "@ant-design/icons";
import {
  fetchInventorySnapshots,
  fetchStocktakeSessions,
} from "@/modules/stocktake/services/stocktakeService";

type Row = Record<string, unknown>;

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

export default function StocktakePage() {
  const [activeTab, setActiveTab] = useState("list");
  const [sessions, setSessions] = useState<Row[]>([]);
  const [snapshots, setSnapshots] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const loader = activeTab === "list" ? fetchStocktakeSessions : fetchInventorySnapshots;
    loader({ per_page: 20 })
      .then(activeTab === "list" ? setSessions : setSnapshots)
      .catch(() => (activeTab === "list" ? setSessions([]) : setSnapshots([])))
      .finally(() => setLoading(false));
  }, [activeTab]);

  return (
    <div style={{ padding: 24 }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "list",
            label: "Danh sách phiên kiểm kê",
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Input.Search placeholder="Mã phiên..." style={{ width: 285 }} />
                  <Button type="primary" icon={<ExperimentOutlined />}>
                    Tạo phiên kiểm kê
                  </Button>
                </Space>
                <Table
                  dataSource={sessions}
                  rowKey={(row) => text(row.id)}
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  columns={[
                    { title: "Mã phiên", dataIndex: "code", key: "code" },
                    { title: "Phạm vi", dataIndex: "scope", key: "scope" },
                    { title: "Bắt đầu", dataIndex: "started_at", key: "started_at" },
                    { title: "Người phụ trách", dataIndex: "owner_name", key: "owner_name" },
                    {
                      title: "Trạng thái",
                      dataIndex: "status",
                      key: "status",
                      render: (value: string) => <Tag>{value}</Tag>,
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: "snapshots",
            label: "Tồn chụp / chênh lệch",
            children: (
              <Table
                dataSource={snapshots}
                rowKey={(row) => text(row.id)}
                loading={loading}
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: "Phiên", dataIndex: "stocktake_session_id", key: "stocktake_session_id" },
                  { title: "SKU", dataIndex: "sku_code", key: "sku_code" },
                  { title: "SL tồn chụp", dataIndex: "snapshot_qty", key: "snapshot_qty" },
                  { title: "SL kỳ vọng", dataIndex: "expected_qty", key: "expected_qty" },
                  { title: "SL thực tế", dataIndex: "actual_qty", key: "actual_qty" },
                  { title: "Chênh lệch", dataIndex: "variance_qty", key: "variance_qty" },
                  { title: "Tạo lúc", dataIndex: "created_at", key: "created_at" },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
