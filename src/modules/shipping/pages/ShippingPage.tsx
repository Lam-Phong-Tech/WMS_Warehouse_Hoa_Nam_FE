import { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Input, Select, Card, Modal, Form, Typography, Alert } from 'antd';
import { PlusOutlined, SearchOutlined, ExportOutlined } from '@ant-design/icons';
import type { OutboundDocument, OutboundLine } from '../types';
import { fetchOutboundDocuments, fetchOutboundLines } from '../services/shippingService';

const statusColorMap: Record<string, string> = {
  DRAFT: 'default', SCANNING: 'processing', PARTIALLY_POSTED: 'warning', POSTED: 'success', CLOSED: 'default', CANCELLED: 'error',
};

export default function ShippingPage() {
  const [docs, setDocs] = useState<OutboundDocument[]>([]);
  const [lines, setLines] = useState<OutboundLine[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<OutboundDocument | null>(null);

  useEffect(() => { fetchOutboundDocuments().then(setDocs); }, []);

  const columns = [
    { title: 'Mã phiếu', dataIndex: 'code', key: 'code' },
    { title: 'Nơi nhận', dataIndex: 'receiverName', key: 'receiverName' },
    { title: 'Ngày', dataIndex: 'date', key: 'date' },
    { title: 'Planned', dataIndex: 'planned', key: 'planned', align: 'right' as const },
    { title: 'Issued', dataIndex: 'issued', key: 'issued', align: 'right' as const },
    { title: 'Remaining', key: 'remaining', align: 'right' as const, render: (_: unknown, r: OutboundDocument) => <strong>{r.remaining}</strong> },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColorMap[v]}>{v}</Tag> },
    { title: 'Người tạo', dataIndex: 'createdBy', key: 'createdBy' },
    { title: 'Action', key: 'action', render: (_: unknown, r: OutboundDocument) => (
      <a onClick={() => { setSelectedDoc(r); fetchOutboundLines(r.id).then(setLines); setModalOpen(true); }}>Mở · Post tiếp</a>
    )},
  ];

  const lineColumns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: 'Scan source', dataIndex: 'scanSource', key: 'scanSource' },
    { title: 'Available', dataIndex: 'available', key: 'available', align: 'right' as const },
    { title: 'Planned', dataIndex: 'planned', key: 'planned', align: 'right' as const },
    { title: 'Đã issue', dataIndex: 'issued', key: 'issued', align: 'right' as const },
    { title: 'Subset mới', dataIndex: 'subsetNew', key: 'subsetNew', align: 'right' as const, render: (v: number) => <strong>{v}</strong> },
    { title: 'Validation', dataIndex: 'validation', key: 'validation', render: (v: string) => <Tag color={v === 'VALID' ? 'success' : 'error'}>{v}</Tag> },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title="Phiếu xuất kho" extra={
        <Space>
          <Input prefix={<SearchOutlined />} placeholder="Mã phiếu/đại lý/SKU..." style={{ width: 250 }} />
          <Select defaultValue="" style={{ width: 150 }} options={[{ value: '', label: 'Trạng thái' }, { value: 'POSTED', label: 'POSTED' }, { value: 'PARTIALLY_POSTED', label: 'PARTIALLY_POSTED' }]} />
          <Button icon={<ExportOutlined />}>Export</Button>
          <Button type="primary" icon={<PlusOutlined />}>Tạo phiếu xuất</Button>
        </Space>
      }>
        <Table dataSource={docs} columns={columns} rowKey="id" pagination={false} size="small" />
      </Card>

      <Modal title={selectedDoc?.code} open={modalOpen} onCancel={() => setModalOpen(false)} width={800} footer={[
        <Button key="back" onClick={() => setModalOpen(false)}>Quay lại</Button>,
        <Button key="post" type="primary">Post Issue subset</Button>,
        <Button key="close" type="default" danger>Close remainder</Button>,
      ]}>
        {selectedDoc && (
          <>
            <Form layout="inline" style={{ marginBottom: 16 }}>
              <Form.Item label="Nơi nhận"><strong>{selectedDoc.receiverName}</strong></Form.Item>
              <Form.Item label="Ngày"><strong>{selectedDoc.date}</strong></Form.Item>
              <Form.Item label="Trạng thái"><Tag color={statusColorMap[selectedDoc.status]}>{selectedDoc.status}</Tag></Form.Item>
              <Form.Item label="Version"><Typography.Text code>v{selectedDoc.version}</Typography.Text></Form.Item>
            </Form>
            <Alert message="Sau Post chỉ giảm tồn kho tổng. Không sinh Balance/Movement tăng cho đại lý." type="warning" showIcon style={{ marginBottom: 12 }} />
            <Table dataSource={lines} columns={lineColumns} rowKey="id" pagination={false} size="small" />
          </>
        )}
      </Modal>
    </div>
  );
}