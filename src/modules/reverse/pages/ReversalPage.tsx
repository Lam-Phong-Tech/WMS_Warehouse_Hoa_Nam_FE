/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { Button, Input, Space, Table, Tabs, Tag } from "antd";
import { RollbackOutlined } from "@ant-design/icons";
import { fetchReversalDocuments } from "@/modules/reverse/services/reversalService";
import type { ReversalDocument } from "@/modules/reverse/types";

export default function ReversalPage() {
  const [activeTab, setActiveTab] = useState("list");
  const [documents, setDocuments] = useState<ReversalDocument[]>([]);
  const [loading, setLoading] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchReversalDocuments({ per_page: 20 })
      .then((data) => {
        if (!cancelled) setDocuments(data);
      })
      .catch(() => {
        if (!cancelled) setDocuments([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  columns={[
                    { title: "Mã hoàn đảo", dataIndex: "reversal_code", key: "reversal_code" },
                    { title: "Chứng từ gốc", dataIndex: "reference_document_code", key: "reference_document_code" },
                    { title: "Loại", dataIndex: "reversal_type", key: "reversal_type" },
                    { title: "Lý do", dataIndex: "reason", key: "reason" },
                    {
                      title: "Trạng thái",
                      dataIndex: "status",
                      key: "status",
                      render: (value: string) => <Tag>{value}</Tag>,
                    },
                    { title: "Ngày tạo", dataIndex: "created_at", key: "created_at" },
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