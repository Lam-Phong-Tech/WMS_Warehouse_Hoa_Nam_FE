import { useState } from 'react';
import { Table, Button, Space, Tag, Input, Select, Tabs } from 'antd';
import { PlusOutlined, ExportOutlined, StockOutlined } from '@ant-design/icons';

const mockOutboundDocs = [
  { id: 1, code: 'PX-20260724-004', receiver: 'Đại lý Hà Đông', date: '24/07/2026', planned: 25, issued: 10, remaining: 15, status: 'PARTIALLY_POSTED', createdBy: 'NV kho', updatedAt: '09:48' },
  { id: 2, code: 'PX-20260724-005', receiver: 'Cửa hàng Đông Anh', date: '24/07/2026', planned: 40, issued: 0, remaining: 40, status: 'SCANNING', createdBy: 'NV kho', updatedAt: '10:15' },
  { id: 3, code: 'PX-20260723-018', receiver: 'Đối tượng khác', date: '23/07/2026', planned: 8, issued: 8, remaining: 0, status: 'POSTED', createdBy: 'QL kho', updatedAt: '11:20' },
];

const mockOutboundLines = [
  { id: 1, selected: true, sku: 'DCH-DRILL-DJZ10A...', source: 'CARTON-HN-0007 · 20 item', available: 58, planned: 20, issued: 0, subset: 20, validation: 'Xuất nguyên thùng' },
  { id: 2, selected: true, sku: 'DCH-GRINDER-DSM02...', source: '5 ITEM scan lẻ', available: 38, planned: 5, issued: 0, subset: 5, validation: 'Hợp lệ' },
  { id: 3, selected: false, sku: 'LK-DCH-OC-VIT-M2...', source: 'TRAY-T-01', available: 450, planned: 100, issued: 0, subset: '—', validation: 'Không được xuất khay' },
];

export default function OutboundPage() {
  const [activeTab, setActiveTab] = useState('list');

  const statusColorMap: Record<string, string> = {
    PARTIALLY_POSTED: 'warning',
    POSTED: 'success',
    SCANNING: 'processing',
    REVIEWING: 'purple',
  };

  const columns = [
    { title: 'Mã phiếu', dataIndex: 'code', key: 'code', render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    { title: 'Nơi nhận', dataIndex: 'receiver', key: 'receiver' },
    { title: 'Ngày', dataIndex: 'date', key: 'date' },
    { title: 'Planned', dataIndex: 'planned', key: 'planned', render: (v: number) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</span> },
    { title: 'Issued', dataIndex: 'issued', key: 'issued', render: (v: number) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</span> },
    { title: 'Remaining', dataIndex: 'remaining', key: 'remaining', render: (v: number) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}><strong>{v}</strong></span> },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColorMap[v] || 'default'}>{v}</Tag> },
    { title: 'Người tạo', dataIndex: 'createdBy', key: 'createdBy' },
    { title: 'Cập nhật', dataIndex: 'updatedAt', key: 'updatedAt' },
    { title: 'Action', key: 'action', render: () => <Space><a>Mở</a><a>Post tiếp</a></Space> },
  ];

  const lineColumns = [
    { title: 'Chọn post', key: 'selected', render: () => <input type="checkbox" defaultChecked /> },
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: 'Scan source', dataIndex: 'source', key: 'source' },
    { title: 'Available', dataIndex: 'available', key: 'available', render: (v: number) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</span> },
    { title: 'Planned', dataIndex: 'planned', key: 'planned', render: (v: number) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</span> },
    { title: 'Đã issue', dataIndex: 'issued', key: 'issued', render: (v: number) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</span> },
    { title: 'Subset mới', dataIndex: 'subset', key: 'subset', render: (v: number | string) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}><strong>{v}</strong></span> },
    { title: 'Validation', dataIndex: 'validation', key: 'validation', render: (v: string) => <Tag color={v === 'Hợp lệ' || v === 'Xuất nguyên thùng' ? 'success' : 'danger'}>{v}</Tag> },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'list',
            label: 'Danh sách phiếu xuất',
            children: (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Space>
                    <Input.Search placeholder="Mã phiếu/đại lý/SKU..." style={{ width: 285 }} />
                    <Select placeholder="Trạng thái" style={{ width: 125 }} allowClear />
                    <Select placeholder="Nơi nhận" style={{ width: 125 }} allowClear />
                  </Space>
                  <Button type="primary" icon={<PlusOutlined />}>＋ Tạo phiếu xuất</Button>
                </div>
                <Table dataSource={mockOutboundDocs} columns={columns} rowKey="id" pagination={{ pageSize: 10 }} />
              </div>
            ),
          },
          {
            key: 'scan',
            label: 'Scan xuất nguyên thùng / xuất lẻ / linh kiện',
            children: (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Space>
                    <Input.Search placeholder="⌁ Scan CARTON / ITEM / BOX..." style={{ width: 285 }} />
                    <Button type="primary" icon={<StockOutlined />}>Demo máy quét</Button>
                    <Select placeholder="Kiểu xuất" style={{ width: 125 }} allowClear />
                  </Space>
                  <Button icon={<ExportOutlined />}>Kiểm tra tồn lại</Button>
                </div>
                <Table dataSource={mockOutboundLines} columns={lineColumns} rowKey="id" pagination={false} size="small" />
                <div style={{ marginTop: 12, background: '#fff4cf', border: '1px dashed #c9a227', borderRadius: 4, padding: 10 }}>
                  <strong>Concurrency guard:</strong> Backend se kiem tra va chan neu subset vuot qua available hoac version stale.
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}