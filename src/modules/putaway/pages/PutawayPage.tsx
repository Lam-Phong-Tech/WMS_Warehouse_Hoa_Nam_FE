/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { Button, Input, Space, Table, Tabs, Tag } from "antd";
import { SwapOutlined } from "@ant-design/icons";
import {
  fetchPutawayHistory,
  fetchPutawayTasks,
} from "@/modules/putaway/services/putawayService";

type Row = Record<string, unknown>;

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

export default function PutawayPage() {
  const [activeTab, setActiveTab] = useState("list");
  const [tasks, setTasks] = useState<Row[]>([]);
  const [history, setHistory] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const loader = activeTab === "list" ? fetchPutawayTasks : fetchPutawayHistory;
    loader()
      .then((data) => {
        if (!cancelled) {
          if (activeTab === "list") {
            setTasks(data);
          } else {
            setHistory(data);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          if (activeTab === "list") {
            setTasks([]);
          } else {
            setHistory([]);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
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
            label: "Danh sách chờ xếp khay",
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Input.Search placeholder="Box/SKU..." style={{ width: 285 }} />
                  <Button type="primary" icon={<SwapOutlined />}>
                    Bắt đầu xếp khay
                  </Button>
                </Space>
                <Table
                  dataSource={tasks}
                  rowKey={(row) => text(row.id)}
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  columns={[
                    { title: "Mã box", dataIndex: "box_code", key: "box_code" },
                    { title: "SKU", dataIndex: "sku_code", key: "sku_code" },
                    { title: "Số lượng", dataIndex: "quantity", key: "quantity" },
                    { title: "Phiếu nhập", dataIndex: "receipt_code", key: "receipt_code" },
                    {
                      title: "Trạng thái",
                      dataIndex: "status",
                      key: "status",
                      render: (value: string) => <Tag color="warning">{value}</Tag>,
                    },
                    {
                      title: "Vị trí gợi ý",
                      dataIndex: "location_hint",
                      key: "location_hint",
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: "history",
            label: "Lịch sử gán box vào khay",
            children: (
              <Table
                dataSource={history}
                rowKey={(row) => text(row.id)}
                loading={loading}
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: "Thời gian", dataIndex: "created_at", key: "created_at" },
                  { title: "Box", dataIndex: "box_code", key: "box_code" },
                  { title: "Khay cũ", dataIndex: "old_tray_code", key: "old_tray_code" },
                  { title: "Khay mới", dataIndex: "new_tray_code", key: "new_tray_code" },
                  { title: "Người thao tác", dataIndex: "actor_name", key: "actor_name" },
                  {
                    title: "Ảnh hưởng tồn kho",
                    key: "stock_effect",
                    render: () => <Tag>Không phát sinh dịch chuyển</Tag>,
                  },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
