/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { Button, Input, Space, Table, Tabs, Tag } from "antd";
import { ToolOutlined } from "@ant-design/icons";
import {
  fetchWarrantyCaseEvents,
  fetchWarrantyCases,
} from "@/modules/warranty/services/warrantyService";
import type { WarrantyCase, WarrantyEvent } from "@/modules/warranty/types";

export default function WarrantyPage() {
  const [activeTab, setActiveTab] = useState("list");
  const [cases, setCases] = useState<WarrantyCase[]>([]);
  const [events, setEvents] = useState<WarrantyEvent[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>();
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWarrantyCases({ per_page: 20 })
      .then((rows) => {
        if (!cancelled) {
          setCases(rows);
          setSelectedCaseId((current) => current ?? rows[0]?.id);
        }
      })
      .catch(() => {
        if (!cancelled) setCases([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (activeTab !== "history" || !selectedCaseId) return;
    let cancelled = false;
    setLoading(true);
    fetchWarrantyCaseEvents(selectedCaseId)
      .then((data) => {
        if (!cancelled) setEvents(data);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  onRow={(row) => ({
                    onClick: () => setSelectedCaseId(row.id),
                  })}
                  columns={[
                    { title: "Mã case", dataIndex: "case_code", key: "case_code" },
                    { title: "SKU", dataIndex: "sku", key: "sku" },
                    { title: "Serial", dataIndex: "serial_number", key: "serial_number" },
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
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: "Thời gian", dataIndex: "performed_at", key: "performed_at" },
                  { title: "Hành động", dataIndex: "event_type", key: "event_type" },
                  { title: "Người thao tác", dataIndex: "performed_by", key: "performed_by" },
                  { title: "Trạng thái", dataIndex: "to_status", key: "to_status" },
                  { title: "Ghi chú", dataIndex: "description", key: "description" },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
