import { useState } from 'react';
import { Table, Button, Space, Tag, Input, Select, Tabs } from 'antd';
import { RollbackOutlined } from '@ant-design/icons';

const mockReversals = [
  { id: 1, code: 'REV-20260724-001', originalDoc: 'PN-20260724-001', type: 'INBOUND', reason: 'Nhầm NCC', status: 'REVIEWING', createdBy: 'NV kho', updatedAt: '10:32' },
  { id: 2, code: 'REV-20260723-014', originalDoc: 'PX-20260723-018', type: 'OUTBOUND', reason: 'Hủy đơn giao', status: 'APPLIED', createdBy: 'QL kho', updatedAt: '11:20' },
];

const mockReversalLines = [
  { id: 1, sku: 'DCH-DRILL-DJZ10A...', qty: 20, direction: 'IN', originalMovement: 'MOV-000812', newMovement: 'MOV-000835', status: 'PENDING' },
  { id: 2, sku: 'LK-DCH-OC-VIT-M2...', qty: 5, direction: 'OUT', originalMovement: 'MOV-000826', newMovement: 'MOV-000836', status: 'PENDING' },
];

export default function ReversalPage() {
  const [activeTab, setActiveTab] = useState('list');

  const statusColorMap: Record<string, string> = {
    REVIEWING: 'purple',
    APPLIED: 'success',
    REJECTED: 'error',
  };

  const columns = [
    { title: 'Mã reversal', dataIndex: 'code', key: 'code', render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    { title: 'Chứng từ gốc', dataIndex: 'originalDoc', key: 'originalDoc', render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    { title: 'Loại', dataIndex: 'type', key: 'type', render: (v: string) => <Tag color={v === 'INBOUND' ? 'blue' : 'orange'}>{v}</Tag> },
    { title: 'Lý do', dataIndex: 'reason', key: 'reason' },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColorMap[v] || 'default'}>{v}</Tag> },
    { title: 'Người tạo', dataIndex: 'createdBy', key: 'createdBy' },
    { title: 'Cập nhật', dataIndex: 'updatedAt', key: 'updatedAt' },
    { title: 'Action', key: 'action', render: () => <Space><a>Mở</a><a>Review</a></Space> },
  ];

  const lineColumns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: 'Qty', dataIndex: 'qty', key: 'qty', render: (v: number) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</span> },
    { title: 'Direction', dataIndex: 'direction', key: 'direction', render: (v: string) => <Tag color={v === 'IN' ? 'blue' : 'orange'}>{v}</Tag> },
    { title: 'Movement gốc', dataIndex: 'originalMovement', key: 'originalMovement', render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    { title: 'Movement mới', dataIndex: 'newMovement', key: 'newMovement', render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    { title: 'Line status', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'PENDING' ? 'default' : v === 'APPLIED' ? 'success' : 'warning'}>{v}</Tag> },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'list',
            label: 'Danh sách Reversal',
            children: (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Space>
                    <Input.Search placeholder="Mã reversal/chứng từ gốc..." style={{ width: 285 }} />
                    <Select placeholder="Loại" style={{ width: 125 }} allowClear />
                    <Select placeholder="Trạng thái" style={{ width: 125 }} allowClear />
                  </Space>
                  <Button type="primary" icon={<RollbackOutlined />}>＋ Tạo Reversal</Button>
                </div>
                <Table dataSource={mockReversals} columns={columns} rowKey="id" pagination={{ pageSize: 10 }} />
              </div>
            ),
          },
          {
            key: 'workspace',
            label: 'Workspace Reversal',
            children: (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Space>
                    <Input.Search placeholder="⌁ Scan/nhập mã..." style={{ width: 285 }} />
                    <Button type="primary" icon={<RollbackOutlined />}>Demo máy quét</Button>
                  </Space>
                  <Button>Apply Reversal</Button>
                </div>
                <Table dataSource={mockReversalLines} columns={lineColumns} rowKey="id" pagination={false} size="small" />
                <div style={{ marginTop: 12, background: '#fff4cf', border: '1px dashed #c9a227', borderRadius: 4, padding: 10 }}>
                  <strong>Lưu ý:</strong> Reversal không được apply nếu đã có movement/issue/warranty/reversal mới sau chứng từ gốc. Kiểm tra version và chain trước khi apply.
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}