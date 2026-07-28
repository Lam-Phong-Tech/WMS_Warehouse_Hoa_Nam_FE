import { useState } from 'react';
import { Table, Button, Space, Tag, Input, Select, Tabs, DatePicker } from 'antd';

const mockReportHub = [
  { id: 1, code: 'RPT-INV-01', name: 'Tồn hiện tại', desc: 'Available, serial/box qty, location_hint, reconciliation.', action: 'Mở báo cáo' },
  { id: 2, code: 'RPT-XNT-01', name: 'Xuất nhập tồn', desc: 'Opening, Receipt, Issue, Adjustment, Reversal, Closing.', action: 'Mở báo cáo' },
  { id: 3, code: 'RPT-MOV-01', name: 'Movement History', desc: 'Gross/net, correction chain, actor, request_id.', action: 'Mở báo cáo' },
  { id: 4, code: 'RPT-STK-01', name: 'Kiểm kê', desc: 'Snapshot, cutoff, expected, actual, variance, adjustment.', action: 'Mở báo cáo' },
  { id: 5, code: 'RPT-WAR-01', name: 'Bảo hành theo bệnh', desc: 'Model/SKU, defect, status, turnaround; TEMP_ONLY tách riêng.', action: 'Mở báo cáo' },
  { id: 6, code: 'RPT-IO-01', name: 'Phiếu nhập/xuất', desc: 'Planned/posted/remaining/cancelled remainder.', action: 'Mở báo cáo' },
];

const mockXNTReport = [
  { id: 1, sku: 'DCH-DRILL-DJZ10A...', opening: 38, receipt: 40, issue: 20, adjustIn: 0, adjustOut: 0, reversalNet: 0, closing: 58, partialRemaining: '40 inbound', reconcile: 'PASS' },
  { id: 2, sku: 'LK-DCH-OC-VIT-M2...', opening: 0, receipt: 450, issue: 0, adjustIn: 0, adjustOut: 0, reversalNet: 0, closing: 450, partialRemaining: 0, reconcile: 'PASS' },
];

const mockWarrantyReport = [
  { id: 1, model: 'DJZ10A', defect: 'Không chạy động cơ', total: 6, processing: 2, returned: 4, tempOnly: 0 },
  { id: 2, model: 'UNKNOWN', defect: 'Rung mạnh', total: 2, processing: 1, returned: 1, tempOnly: 2 },
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('hub');

  const hubColumns = [
    { title: 'Mã', dataIndex: 'code', key: 'code', render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    { title: 'Tên báo cáo', dataIndex: 'name', key: 'name', render: (v: string) => <strong>{v}</strong> },
    { title: 'Mô tả', dataIndex: 'desc', key: 'desc' },
    { title: 'Action', key: 'action', render: () => <a>Mở báo cáo</a> },
  ];

  const xntColumns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku', render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    { title: 'Opening', dataIndex: 'opening', key: 'opening', render: (v: number) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</span> },
    { title: 'Receipt', dataIndex: 'receipt', key: 'receipt', render: (v: number) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#3f8600' }}>+{v}</span> },
    { title: 'Issue', dataIndex: 'issue', key: 'issue', render: (v: number) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#cf1322' }}>-{v}</span> },
    { title: 'Adjust in', dataIndex: 'adjustIn', key: 'adjustIn', render: (v: number) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</span> },
    { title: 'Adjust out', dataIndex: 'adjustOut', key: 'adjustOut', render: (v: number) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</span> },
    { title: 'Reversal net', dataIndex: 'reversalNet', key: 'reversalNet', render: (v: number) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</span> },
    { title: 'Closing', dataIndex: 'closing', key: 'closing', render: (v: number) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}><strong>{v}</strong></span> },
    { title: 'Partial remaining', dataIndex: 'partialRemaining', key: 'partialRemaining', render: (v: number | string) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</span> },
    { title: 'Reconcile', dataIndex: 'reconcile', key: 'reconcile', render: (v: string) => <Tag color={v === 'PASS' ? 'success' : 'warning'}>{v}</Tag> },
  ];

  const warrantyColumns = [
    { title: 'Model/SKU', dataIndex: 'model', key: 'model' },
    { title: 'Bệnh/lỗi', dataIndex: 'defect', key: 'defect' },
    { title: 'Số case', dataIndex: 'total', key: 'total', render: (v: number) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</span> },
    { title: 'Đang xử lý', dataIndex: 'processing', key: 'processing', render: (v: number) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</span> },
    { title: 'Đã trả', dataIndex: 'returned', key: 'returned', render: (v: number) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</span> },
    { title: 'TEMP_ONLY', dataIndex: 'tempOnly', key: 'tempOnly', render: (v: number) => <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</span> },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'hub',
            label: 'Report hub',
            children: (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Space>
                    <Input.Search placeholder="Tìm báo cáo..." style={{ width: 285 }} />
                  </Space>
                  <Space>
                    <Button>Xuất PDF</Button>
                    <Button type="primary">Xuất XLSX</Button>
                  </Space>
                </div>
                <Table dataSource={mockReportHub} columns={hubColumns} rowKey="id" pagination={{ pageSize: 10 }} />
              </div>
            ),
          },
          {
            key: 'xnt',
            label: 'Báo cáo XNT',
            children: (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Space>
                    <DatePicker />
                    <DatePicker />
                    <Input.Search placeholder="SKU/category..." style={{ width: 285 }} />
                    <Select placeholder="Movement type" style={{ width: 150 }} allowClear />
                  </Space>
                  <Space>
                    <Button>Xuất PDF</Button>
                    <Button type="primary">Xuất XLSX</Button>
                  </Space>
                </div>
                <Table dataSource={mockXNTReport} columns={xntColumns} rowKey="id" pagination={{ pageSize: 10 }} />
                <div style={{ marginTop: 12, background: '#eaf1f8', border: '1px dashed #bcd2e6', borderRadius: 4, padding: 10, fontSize: 12.5, color: '#314e68' }}>
                  <b>Formula:</b> closing = opening + receipt - issue + adjust_in - adjust_out + reversal_net. Chỉ quantity đã POSTED ảnh hưởng XNT; remainder hiển thị riêng.
                </div>
              </div>
            ),
          },
          {
            key: 'warranty',
            label: 'Bảo hành theo bệnh',
            children: (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Space>
                    <DatePicker />
                    <DatePicker />
                    <Select placeholder="Model" style={{ width: 150 }} allowClear />
                    <Select placeholder="Bệnh" style={{ width: 150 }} allowClear />
                  </Space>
                  <Button type="primary">Chạy báo cáo</Button>
                </div>
                <Table dataSource={mockWarrantyReport} columns={warrantyColumns} rowKey="id" pagination={{ pageSize: 10 }} />
                <div style={{ marginTop: 12, background: '#eaf1f8', border: '1px dashed #bcd2e6', borderRadius: 4, padding: 10, fontSize: 12.5, color: '#314e68' }}>
                  <b>Privacy:</b> Báo cáo mặc định không lộ tên/SĐT. Export PII cần quyền riêng và được audit.
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}