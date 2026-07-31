import { useEffect, useState } from "react";
import { Button, Input, Space, Table, Tabs, Tag } from "antd";
import { RollbackOutlined } from "@ant-design/icons";
import { fetchReversalDocuments } from "@/modules/reverse/services/reversalService";

type Row = Record<string, unknown>;

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

function rowsOf(value: unknown): Row[] {
  if (Array.isArray(value)) return value as Row[];
  if (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { data?: unknown }).data)
  ) {
    return (value as { data: Row[] }).data;
  }
  return [];
}

export default function ReversalPage() {
  const [activeTab, setActiveTab] = useState("list");
  const [documents, setDocuments] = useState<Row[]>([]);
  const [lines, setLines] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchReversalDocuments({ per_page: 20 })
      .then((rows) => {
        setDocuments(rows);
        setLines(rows.flatMap((row) => rowsOf(row.lines)));
      })
      .catch(() => {
        setDocuments([]);
        setLines([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "list",
            label: "Danh sách hoàn đảo",
            children: (
              <>
                <Space style={{ marginBottom: 16 }}>
                  <Input.Search placeholder="Mã hoàn đảo/chứng từ gốc..." style={{ width: 285 }} />
                  <Button type="primary" icon={<RollbackOutlined />}>
                    Tạo hoàn đảo
                  </Button>
                </Space>
                <Table
                  dataSource={documents}
                  rowKey={(row) => text(row.id)}
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  columns={[
                    { title: "Mã hoàn đảo", dataIndex: "code", key: "code" },
                    { title: "Chứng từ gốc", dataIndex: "source_document_code", key: "source_document_code" },
                    { title: "Loại", dataIndex: "source_type", key: "source_type" },
                    { title: "Lý do", dataIndex: "reason", key: "reason" },
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
            key: "lines",
            label: "Dòng hoàn đảo",
            children: (
              <Table
                dataSource={lines}
                rowKey={(row) => text(row.id)}
                loading={loading}
                pagination={{ pageSize: 10 }}
                columns={[
                  { title: "SKU", dataIndex: "sku_code", key: "sku_code" },
                  { title: "Số lượng", dataIndex: "quantity", key: "quantity" },
                  { title: "Hướng", dataIndex: "direction", key: "direction" },
                  { title: "Dịch chuyển gốc", dataIndex: "source_movement_id", key: "source_movement_id" },
                  { title: "Dịch chuyển mới", dataIndex: "new_movement_id", key: "new_movement_id" },
                  { title: "Trạng thái", dataIndex: "status", key: "status" },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
