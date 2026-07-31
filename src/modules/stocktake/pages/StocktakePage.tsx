/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { Button, Input, Space, Table, Tabs, Tag } from "antd";
import { ExperimentOutlined } from "@ant-design/icons";
import {
  fetchInventorySnapshots,
  fetchStocktakeSessions,
} from "@/modules/stocktake/services/stocktakeService";
import type { StocktakeSession, StocktakeSnapshot } from "@/modules/stocktake/types";

export default function StocktakePage() {
  const [activeTab, setActiveTab] = useState("list");
  const [sessions, setSessions] = useState<StocktakeSession[]>([]);
  const [snapshots, setSnapshots] = useState<StocktakeSnapshot[]>([]);
  const [loading, setLoading] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    if (activeTab === "list") {
      fetchStocktakeSessions({ per_page: 20 })
        .then((data) => {
          if (!cancelled) setSessions(data);
        })
        .catch(() => {
          if (!cancelled) setSessions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      fetchInventorySnapshots({ per_page: 20 })
        .then((data) => {
          if (!cancelled) setSnapshots(data);
        })
        .catch(() => {
          if (!cancelled) setSnapshots([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
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
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  columns={[
                    { title: "Mã phiên", dataIndex: "code", key: "code" },
                    { title: "Kho", dataIndex: "warehouse_name", key: "warehouse_name" },
                    { title: "Bắt đầu", dataIndex: "snapshot_at", key: "snapshot_at" },
                    { title: "Người tạo", dataIndex: "created_by", key: "created_by" },
                    {
                      title: "Trạng thái",
                      dataIndex: "status",
                      key: "status",
                      render: (value: string) => <Tag>{value}</Tag>,
                    },
                    { title: "SKU đã đếm", dataIndex: "counted_sku", key: "counted_sku" },
                    { title: "Chênh lệch", dataIndex: "variance_sku", key: "variance_sku" },
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
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: "SKU", dataIndex: "sku", key: "sku" },
                  { title: "Tên SKU", dataIndex: "sku_name", key: "sku_name" },
                  { title: "SL kỳ vọng", dataIndex: "expected_qty", key: "expected_qty" },
                  { title: "SL tồn chụp", dataIndex: "snapshot_qty", key: "snapshot_qty" },
                  { title: "Vị trí", dataIndex: "location_hint", key: "location_hint" },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  );
}