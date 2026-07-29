import { useEffect, useState } from "react";
import {
  Table,
  Tag,
  Button,
  Space,
  Input,
  Select,
  Card,
  Modal,
  Form,
  Typography,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  ExportOutlined,
} from "@ant-design/icons";
import type { InboundDocument, InboundLine } from "../types";
import {
  fetchInboundDocuments,
  fetchInboundLines,
} from "../services/receivingService";

const statusColorMap: Record<string, string> = {
  DRAFT: "default",
  SCANNING: "processing",
  PARTIALLY_POSTED: "warning",
  POSTED: "success",
  CLOSED: "default",
  CANCELLED: "error",
};

export default function ReceivingPage() {
  const [docs, setDocs] = useState<InboundDocument[]>([]);
  const [lines, setLines] = useState<InboundLine[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<InboundDocument | null>(null);

  useEffect(() => {
    fetchInboundDocuments().then(setDocs);
  }, []);

  const columns = [
    { title: "Mã phiếu", dataIndex: "code", key: "code" },
    { title: "Nguồn hàng", dataIndex: "source", key: "source" },
    { title: "Ngày", dataIndex: "date", key: "date" },
    {
      title: "Expected",
      dataIndex: "expected",
      key: "expected",
      align: "right" as const,
    },
    {
      title: "Posted",
      dataIndex: "posted",
      key: "posted",
      align: "right" as const,
    },
    {
      title: "Remaining",
      key: "remaining",
      align: "right" as const,
      render: (_: unknown, r: InboundDocument) => (
        <strong>{r.remaining}</strong>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (v: string) => <Tag color={statusColorMap[v]}>{v}</Tag>,
    },
    { title: "Người tạo", dataIndex: "createdBy", key: "createdBy" },
    {
      title: "Action",
      key: "action",
      render: (_: unknown, r: InboundDocument) => (
        <a
          onClick={() => {
            setSelectedDoc(r);
            fetchInboundLines(r.id).then(setLines);
            setModalOpen(true);
          }}
        >
          Mở · Post tiếp
        </a>
      ),
    },
  ];

  const lineColumns = [
    { title: "SKU", dataIndex: "sku", key: "sku" },
    { title: "Đối tượng scan", dataIndex: "scanTarget", key: "scanTarget" },
    {
      title: "Expected",
      dataIndex: "expected",
      key: "expected",
      align: "right" as const,
    },
    {
      title: "Scanned",
      dataIndex: "scanned",
      key: "scanned",
      align: "right" as const,
    },
    {
      title: "Đã post",
      dataIndex: "posted",
      key: "posted",
      align: "right" as const,
    },
    {
      title: "Còn lại",
      dataIndex: "remaining",
      key: "remaining",
      align: "right" as const,
      render: (v: number) => <strong>{v}</strong>,
    },
    {
      title: "Validation",
      dataIndex: "validation",
      key: "validation",
      render: (v: string) => (
        <Tag
          color={
            v === "VALID" ? "success" : v === "UNKNOWN" ? "error" : "warning"
          }
        >
          {v}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="Phiếu nhập kho"
        extra={
          <Space>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Mã phiếu/nguồn/SKU..."
              style={{ width: 250 }}
            />
            <Select
              defaultValue=""
              style={{ width: 150 }}
              options={[
                { value: "", label: "Trạng thái" },
                { value: "POSTED", label: "POSTED" },
                { value: "PARTIALLY_POSTED", label: "PARTIALLY_POSTED" },
              ]}
            />
            <Button icon={<ExportOutlined />}>Export</Button>
            <Button type="primary" icon={<PlusOutlined />}>
              Tạo phiếu nhập
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={docs}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>

      <Modal
        title={selectedDoc?.code}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        width={800}
        footer={[
          <Button key="back" onClick={() => setModalOpen(false)}>
            Quay lại
          </Button>,
          <Button key="post" type="primary">
            Post Receipt subset
          </Button>,
          <Button key="close" type="default" danger>
            Close remainder
          </Button>,
        ]}
      >
        {selectedDoc && (
          <>
            <Form layout="inline" style={{ marginBottom: 16 }}>
              <Form.Item label="Nguồn hàng">
                <strong>{selectedDoc.source}</strong>
              </Form.Item>
              <Form.Item label="Ngày">
                <strong>{selectedDoc.date}</strong>
              </Form.Item>
              <Form.Item label="Trạng thái">
                <Tag color={statusColorMap[selectedDoc.status]}>
                  {selectedDoc.status}
                </Tag>
              </Form.Item>
              <Form.Item label="Version">
                <Typography.Text code>v{selectedDoc.version}</Typography.Text>
              </Form.Item>
            </Form>
            <Table
              dataSource={lines}
              columns={lineColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </>
        )}
      </Modal>
    </div>
  );
}
