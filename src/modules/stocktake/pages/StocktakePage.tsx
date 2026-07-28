import { useState } from 'react';
import { Table, Button, Space, Tag, Input, Select, Tabs, Progress } from 'antd';
import { ExperimentOutlined } from '@ant-design/icons';

const mockStocktakeSessions = [
  { id: 1, code: 'STK-20260724-01', scope: 'Toàn kho', start: '24/07 08:00', progress: 84, variance: 4, movement: 6, status: 'REVIEWING', owner: 'Chị Phương' },
  { id: 2, code: 'STK-20260720-02', scope: 'SKU linh kiện', start: '20/07 14:00', progress: 100, variance: 0, movement: 0, status: 'APPLIED', owner: 'QL kho' },
];

const mockCountLines = [
  { id: 1, sku: 'DCH-DRILL-DJZ10A...', mode: 'Serial scan', snapshot: 100, movement: -10, expected: 90, actual: 90, variance: 0, warning: 'Đã xem MOV-826', lineStatus: 'PENDING' },
  { id: 2, sku: 'LK-DCH-OC-VIT-M2...', mode: 'Quantity', snapshot: 450, movement: 0, expected: 450, actual: 448, variance: -2, warning: 'Không có', lineStatus: 'PENDING' },
  { id: 3, sku: 'LK-DCH-SAC-20V...', mode: 'Serial scan', snapshot: 78, movement: 2, expected: 80, actual: 82, variance: 2, warning: 'Chưa ack', lineStatus: 'PENDING' },
];

export default function StocktakePage() {
  const [activeTab, setActiveTab] = useState('list');

  const sessionColumns = [
    { title: 'Mã phiên', dataIndex: 'code', key: 'code', render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    { title: 'Scope', dataIndex: 'scope', key: 'scope' },
    { title: 'Bắt đầu', dataIndex: 'start', key: 'start' },
    { title: 'Tiến độ đếm', dataIndex: 'progress', key: 'progress', render: (v: number) => <><Progress percent={v} size="small" /><div style={{ fontSize: 12, color: '#888' }}>{v}% dòng đã đếm</div></> },
    { title: 'Variance', dataIndex: 'variance', key: 'variance', render: (v: number) => <span style={{ color: v > 0 ? '#cf1322' : '#3f8600' }}>{v} dòng</span> },
    { title: 'Movement warning', dataIndex: 'movement', key: 'movement', render: (v: number) => v > 0 ? <Tag color="warning">{v} movement</Tag> : <Tag color="default">{v}</Tag> },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={v === 'REVIEWING' ? 'purple' : v === 'APPLIED' ? 'success' : 'default'}>{v}</Tag> },
    { title: 'Owner', dataIndex: 'owner', key: 'owner' },
    { title: 'Action', key: 'action', render: () => <Space><a>Review</a></Space> },
  ];

  const lineColumns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: 'Mode', dataIndex: 'mode', key: 'mode' },
    { title: 'Snapshot', dataIndex: 'snapshot', key: 'snapshot', render: (v: number) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</span> },
    { title: 'Movement đến cutoff', dataIndex: 'movement', key: 'movement', render: (v: number) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: v < 0 ? '#cf1322' : '#3f8600' }}>{v > 0 ? `+${v}` : v}</span> },
    { title: 'Expected', dataIndex: 'expected', key: 'expected', render: (v: number) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}><strong>{v}</strong></span> },
    { title: 'Actual', dataIndex: 'actual', key: 'actual', render: (v: number) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</span> },
    { title: 'Variance', dataIndex: 'variance', key: 'variance', render: (v: number) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: v > 0 ? '#3f8600' : v < 0 ? '#cf1322' : '#888' }}>{v > 0 ? `+${v}` : v}</span> },
    { title: 'Warning/Ack', dataIndex: 'warning', key: 'warning', render: (v: string) => <Tag color={v === 'Đã xem MOV-826' ? 'success' : 'default'}>{v}</Tag> },
    { title: 'Line status', dataIndex: 'lineStatus', key: 'lineStatus', render: (v: string) => <Tag color={v === 'PENDING' ? 'default' : v === 'APPROVED' ? 'success' : 'warning'}>{v}</Tag> },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'list',
            label: 'Danh sách phiên kiểm kê',
            children: (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Space>
                    <Input.Search placeholder="Mã phiên..." style={{ width: 285 }} />
                    <Select placeholder="Scope" style={{ width: 125 }} allowClear />
                    <Select placeholder="Trạng thái" style={{ width: 125 }} allowClear />
                  </Space>
                  <Button type="primary" icon={<ExperimentOutlined />}>＋ Tạo phiên kiểm kê</Button>
                </div>
                <Table dataSource={mockStocktakeSessions} columns={sessionColumns} rowKey="id" pagination={{ pageSize: 10 }} />
              </div>
            ),
          },
          {
            key: 'workspace',
            label: 'Workspace đếm & variance',
            children: (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Space>
                    <Input.Search placeholder="⌁ Scan batch / nhập số đếm..." style={{ width: 285 }} />
                    <Button type="primary" icon={<ExperimentOutlined />}>Demo máy quét</Button>
                    <Select placeholder="Chỉ variance" style={{ width: 125 }} allowClear />
                  </Space>
                  <Button>Kết thúc đếm</Button>
                </div>
                <Table dataSource={mockCountLines} columns={lineColumns} rowKey="id" pagination={false} size="small" />
                <div style={{ marginTop: 12, background: '#eaf1f8', border: '1px dashed #bcd2e6', borderRadius: 4, padding: 10, fontSize: 12.5, color: '#314e68' }}>
                  <b>Công thức hiển thị:</b> expected_at_count = snapshot_qty + net_movement_after_snapshot_to_count_cutoff; variance_to_apply = actual_qty - expected_at_count.
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}