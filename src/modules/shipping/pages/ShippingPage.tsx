/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import {
  Alert,
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
import type { OutboundDocument, OutboundLine } from "../types";
import {
  fetchOutboundDocuments,
  fetchOutboundLines,
} from "../services/shippingService";

const statusColorMap: Record<string, string> = {
  DRAFT: "default",
  SCANNING: "processing",
  PARTIALLY_POSTED: "warning",
  POSTED: "success",
  CLOSED: "default",
  CANCELLED: "error",
};

export default function ShippingPage() {
  const [docs, setDocs] = useState<OutboundDocument[]>([]);
  const [lines, setLines] = useState<OutboundLine[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lineLoading, setLineLoading] = useState(false);
  const [lineErrorMessage, setLineErrorMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<OutboundDocument | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorMessage("");
    fetchOutboundDocuments({ search, status, per_page: 20 })
      .then((data) => {
        if (!cancelled) setDocs(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDocs([]);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Khong tai duoc danh sach phieu xuat.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, status]);

  const columns = [
    { title: "Mã phiếu", dataIndex: "code", key: "code" },
    { title: "Nơi nhận", dataIndex: "receiverName", key: "receiverName" },
    { title: "Ngày", dataIndex: "date", key: "date" },
    {
      title: "Dự kiến",
      dataIndex: "planned",
      key: "planned",
      align: "right" as const,
    },
    {
      title: "Đã xuất",
      dataIndex: "issued",
      key: "issued",
      align: "right" as const,
    },
    {
      title: "Còn lại",
      key: "remaining",
      align: "right" as const,
      render: (_: unknown, r: OutboundDocument) => <strong>{r.remaining}</strong>,
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
      render: (_: unknown, r: OutboundDocument) => (
        <Space>
          <Tooltip title="Mở">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedDoc(r);
                setLines([]);
                setLineErrorMessage("");
                setLineLoading(true);
                fetchOutboundLines(r.id)
                  .then(setLines)
                  .catch((error: unknown) => {
                    setLineErrorMessage(
                      error instanceof Error
                        ? error.message
                        : "Khong tai duoc dong phieu xuat.",
                    );
                  })
                  .finally(() => setLineLoading(false));
                setModalOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Ghi nhận tiếp">
            <Button type="text" icon={<CheckCircleOutlined />} disabled />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const lineColumns = [
    { title: "SKU", dataIndex: "sku", key: "sku" },
    { title: "Nguồn quét", dataIndex: "scanSource", key: "scanSource" },
    {
      title: "Khả dụng",
      dataIndex: "available",
      key: "available",
      align: "right" as const,
    },
    {
      title: "Dự kiến",
      dataIndex: "planned",
      key: "planned",
      align: "right" as const,
    },
    {
      title: "Đã xuất",
      dataIndex: "issued",
      key: "issued",
      align: "right" as const,
    },
    {
      title: "Phần mới",
      dataIndex: "subsetNew",
      key: "subsetNew",
      align: "right" as const,
      render: (v: number) => <strong>{v}</strong>,
    },
    {
      title: "Kiểm tra",
      dataIndex: "validation",
      key: "validation",
      render: (v: string) => <Tag color={v === "VALID" ? "success" : "error"}>{v}</Tag>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="Phiếu xuất kho"
        extra={
          <Space>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Mã phiếu/đại lý/SKU..."
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
                { value: "issued", label: "Đã xuất" },
                { value: "cancelled", label: "Đã hủy" },
                { value: "rejected", label: "Từ chối" },
              ]}
            />
            <Button icon={<ExportOutlined />}>Xuất file</Button>
            <Button type="primary" icon={<PlusOutlined />}>
              Tạo phiếu xuất
            </Button>
          </Space>
        }
      >
        {errorMessage && (
          <Alert
            type="error"
            message={errorMessage}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
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
            Ghi nhận một phần phiếu xuất
          </Button>,
          <Button key="close" type="default" danger>
            Đóng phần còn lại
          </Button>,
        ]}
      >
        {selectedDoc && (
          <>
            {lineErrorMessage && (
              <Alert
                type="error"
                message={lineErrorMessage}
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}
            <Form layout="inline" style={{ marginBottom: 16 }}>
              <Form.Item label="Nơi nhận">
                <strong>{selectedDoc.receiverName}</strong>
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
            <Alert
              message="Sau khi ghi nhận chỉ giảm tồn kho tổng. Không sinh số dư/dịch chuyển tăng cho đại lý."
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
            />
            <Table
              dataSource={lines}
              columns={lineColumns}
              rowKey="id"
              loading={lineLoading}
              pagination={false}
              size="small"
            />
          </>
        )}
      </Modal>
    </div>
  );
}
