import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  ExportOutlined,
  EyeOutlined,
  PlusOutlined,
  SearchOutlined,
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
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<InboundDocument | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchInboundDocuments({ search, status, per_page: 20 })
      .then(setDocs)
      .finally(() => setLoading(false));
  }, [search, status]);

  const columns = [
    { title: "Mã phiếu", dataIndex: "code", key: "code" },
    { title: "Nguồn hàng", dataIndex: "source", key: "source" },
    { title: "Ngày", dataIndex: "date", key: "date" },
    {
      title: "Dự kiến",
      dataIndex: "expected",
      key: "expected",
      align: "right" as const,
    },
    {
      title: "Đã ghi nhận",
      dataIndex: "posted",
      key: "posted",
      align: "right" as const,
    },
    {
      title: "Còn lại",
      key: "remaining",
      align: "right" as const,
      render: (_: unknown, r: InboundDocument) => <strong>{r.remaining}</strong>,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (v: string) => <Tag color={statusColorMap[v]}>{v}</Tag>,
    },
    { title: "Người tạo", dataIndex: "createdBy", key: "createdBy" },
    {
      title: "Hành động",
      key: "action",
      render: (_: unknown, r: InboundDocument) => (
        <Space>
          <Tooltip title="Mở">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedDoc(r);
                fetchInboundLines(r.id).then(setLines);
                setModalOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Ghi nhận tiếp">
            <Button type="text" icon={<CheckCircleOutlined />} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const lineColumns = [
    { title: "SKU", dataIndex: "sku", key: "sku" },
    { title: "Đối tượng quét", dataIndex: "scanTarget", key: "scanTarget" },
    {
      title: "Dự kiến",
      dataIndex: "expected",
      key: "expected",
      align: "right" as const,
    },
    {
      title: "Đã quét",
      dataIndex: "scanned",
      key: "scanned",
      align: "right" as const,
    },
    {
      title: "Đã ghi nhận",
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
      title: "Kiểm tra",
      dataIndex: "validation",
      key: "validation",
      render: (v: string) => (
        <Tag color={v === "VALID" ? "success" : v === "UNKNOWN" ? "error" : "warning"}>
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
              allowClear
              onPressEnter={(event) => setSearch(event.currentTarget.value)}
              onChange={(event) => {
                if (!event.target.value) setSearch("");
              }}
            />
            <Select
              value={status}
              style={{ width: 150 }}
              allowClear
              placeholder="Trạng thái"
              onChange={setStatus}
              options={[
                { value: "draft", label: "Nháp" },
                { value: "pending", label: "Chờ xử lý" },
                { value: "approved", label: "Đã duyệt" },
                { value: "received", label: "Đã nhận" },
                { value: "cancelled", label: "Đã hủy" },
                { value: "rejected", label: "Từ chối" },
              ]}
            />
            <Button icon={<ExportOutlined />}>Xuất file</Button>
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
          loading={loading}
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
            Ghi nhận một phần phiếu nhập
          </Button>,
          <Button key="close" type="default" danger>
            Đóng phần còn lại
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
                <Tag color={statusColorMap[selectedDoc.status]}>{selectedDoc.status}</Tag>
              </Form.Item>
              <Form.Item label="Phiên bản">
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
