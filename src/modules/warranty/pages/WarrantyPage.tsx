import { useEffect, useState } from "react";
import { Button, Input, Space, Table, Tabs, Tag } from "antd";
import { ToolOutlined } from "@ant-design/icons";
import {
  fetchWarrantyCaseEvents,
  fetchWarrantyCases,
} from "@/modules/warranty/services/warrantyService";

type Row = Record<string, unknown>;

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

export default function WarrantyPage() {
  const [activeTab, setActiveTab] = useState("list");
  const [cases, setCases] = useState<Row[]>([]);
  const [events, setEvents] = useState<Row[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchWarrantyCases({ per_page: 20 })
      .then((rows) => {
        setCases(rows);
        setSelectedCaseId((current) => current ?? text(rows[0]?.id, undefined));
      })
      .catch(() => setCases([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab !== "history" || !selectedCaseId) return;
    setLoading(true);
    fetchWarrantyCaseEvents(selectedCaseId)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [activeTab, selectedCaseId]);

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
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Input.Search placeholder="Mã case/SKU/serial..." style={{ width: 285 }} />
                  <Button type="primary" icon={<ToolOutlined />}>
                    Tạo case bảo hành
                  </Button>
                </Space>
                <Table
                  dataSource={cases}
                  rowKey={(row) => text(row.id)}
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  onRow={(row) => ({
                    onClick: () => setSelectedCaseId(text(row.id)),
                  })}
                  columns={[
                    { title: "Mã case", dataIndex: "case_code", key: "case_code" },
                    { title: "SKU", dataIndex: "sku_code", key: "sku_code" },
                    { title: "Serial", dataIndex: "serial_no", key: "serial_no" },
                    { title: "Đại lý", dataIndex: "agency_name", key: "agency_name" },
                    { title: "Lỗi", dataIndex: "defect_code", key: "defect_code" },
                    {
                      title: "Trạng thái",
                      dataIndex: "status",
                      key: "status",
                      render: (value: string) => <Tag>{value}</Tag>,
                    },
                    { title: "Cập nhật", dataIndex: "updated_at", key: "updated_at" },
                  ]}
                />
              </>
            ),
          },
          {
            key: "history",
            label: "Lịch sử trạng thái",
            children: (
              <Table
                dataSource={events}
                rowKey={(row) => text(row.id)}
                loading={loading}
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: "Thời gian", dataIndex: "created_at", key: "created_at" },
                  { title: "Hành động", dataIndex: "action", key: "action" },
                  { title: "Người thao tác", dataIndex: "actor_name", key: "actor_name" },
                  { title: "Trạng thái", dataIndex: "status", key: "status" },
                  { title: "Ghi chú", dataIndex: "note", key: "note" },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
