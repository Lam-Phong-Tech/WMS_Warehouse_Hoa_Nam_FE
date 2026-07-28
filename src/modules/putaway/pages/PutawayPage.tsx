import { useState } from 'react';
import { Table, Button, Space, Tag, Input, Select, Tabs } from 'antd';
import { SwapOutlined } from '@ant-design/icons';

const mockPutawayTasks = [
  { id: 1, boxCode: 'BOX-LK-0042', sku: 'LK-DCH-OC-VIT-M2-V1', qty: 450, receipt: 'PN-20260724-002', status: 'RECEIVED_PENDING_PUTAWAY', locationHint: 'Khu nhập - chờ', age: '2 giờ' },
  { id: 2, boxCode: 'BOX-LK-0045', sku: 'LK-DCH-SAC-20V-V1', qty: 30, receipt: 'PN-20260723-013', status: 'RECEIVED_PENDING_PUTAWAY', locationHint: 'Gần cửa nhập', age: '1 ngày' },
];

const mockPutawayHistory = [
  { id: 1, time: '24/07/2026 11:05', box: 'BOX-LK-0038', oldTray: '—', newTray: 'TRAY-T-03', location: 'Dãy trái khu linh kiện', actor: 'NV kho', effect: '0 movement' },
  { id: 2, time: '23/07/2026 16:32', box: 'BOX-LK-0029', oldTray: 'TRAY-T-01', newTray: 'TRAY-T-05', location: 'Khu linh kiện 2', actor: 'QL kho', effect: '0 movement' },
];

export default function PutawayPage() {
  const [activeTab, setActiveTab] = useState('list');

  const columns = [
    { title: 'Box code', dataIndex: 'boxCode', key: 'boxCode', render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    { title: 'SKU linh kiện', dataIndex: 'sku', key: 'sku' },
    { title: 'Quantity', dataIndex: 'qty', key: 'qty', render: (v: number) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</span> },
    { title: 'Receipt', dataIndex: 'receipt', key: 'receipt', render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: () => <Tag color="warning">Chờ xếp khay</Tag> },
    { title: 'Location hint', dataIndex: 'locationHint', key: 'locationHint' },
    { title: 'Tuổi chờ', dataIndex: 'age', key: 'age' },
    { title: 'Action', key: 'action', render: () => <a>Xếp khay</a> },
  ];

  const historyColumns = [
    { title: 'Thời gian', dataIndex: 'time', key: 'time' },
    { title: 'Box', dataIndex: 'box', key: 'box', render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    { title: 'Tray cũ', dataIndex: 'oldTray', key: 'oldTray', render: (v: string) => v === '—' ? <span style={{ color: '#888' }}>—</span> : <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    { title: 'Tray mới', dataIndex: 'newTray', key: 'newTray', render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    { title: 'Location hint', dataIndex: 'location', key: 'location' },
    { title: 'Actor', dataIndex: 'actor', key: 'actor' },
    { title: 'Stock effect', dataIndex: 'effect', key: 'effect', render: () => <Tag color="default">0 movement</Tag> },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'list',
            label: 'Danh sách chờ xếp khay',
            children: (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Space>
                    <Input.Search placeholder="Box/SKU..." style={{ width: 285 }} />
                    <Select placeholder="Khu vực" style={{ width: 125 }} allowClear />
                    <Select placeholder="Tuổi chờ" style={{ width: 125 }} allowClear />
                  </Space>
                  <Button type="primary" icon={<SwapOutlined />}>Bắt đầu Putaway</Button>
                </div>
                <Table dataSource={mockPutawayTasks} columns={columns} rowKey="id" pagination={{ pageSize: 10 }} />
              </div>
            ),
          },
          {
            key: 'history',
            label: 'Lịch sử mapping Box → Tray',
            children: (
              <div>
                <Table dataSource={mockPutawayHistory} columns={historyColumns} rowKey="id" pagination={{ pageSize: 10 }} />
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}