import { useState } from 'react';
import { Tabs, Table, Button, Space, Tag, Modal, Form, Input, Select, Switch, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

interface SKU {
  id: number;
  skuCode: string;
  skuName: string;
  skuType: string;
  brand: string;
  model: string;
  serial: boolean;
  unit: string;
  container: string;
  status: string;
}

interface Agency {
  id: number;
  code: string;
  name: string;
  contact: string;
  phone: string;
  address: string;
  status: string;
}

interface Defect {
  id: number;
  code: string;
  name: string;
  status: string;
}

// SKU types theo BRD
const SKU_TYPES = [
  { label: 'PRODUCT', value: 'PRODUCT', color: 'blue' },
  { label: 'COMPONENT', value: 'COMPONENT', color: 'green' },
];

const SERIAL_MODES = [
  { label: 'Có serial', value: true },
  { label: 'Không serial', value: false },
];

const CONTAINER_TYPES = [
  { label: 'CARTON', value: 'CARTON' },
  { label: 'BOX/TRAY', value: 'BOX/TRAY' },
];

const mockSKUs: SKU[] = [
  { id: 1, skuCode: 'DCH-DRILL-DJZ10A-220V-V1', skuName: 'Máy khoan Dongcheng DJZ10A 220V', skuType: 'PRODUCT', brand: 'DCH', model: 'DJZ10A', serial: true, unit: 'cái', container: 'CARTON', status: 'ACTIVE' },
  { id: 2, skuCode: 'DCH-GRINDER-DSM02-850W-V1', skuName: 'Máy mài góc DSM02 850W', skuType: 'PRODUCT', brand: 'DCH', model: 'DSM02', serial: true, unit: 'cái', container: 'CARTON', status: 'ACTIVE' },
  { id: 3, skuCode: 'LK-DCH-OC-VIT-M2-V1', skuName: 'Ốc vít M2 Dongcheng', skuType: 'COMPONENT', brand: 'DCH', model: 'M2', serial: false, unit: 'cái', container: 'BOX/TRAY', status: 'ACTIVE' },
];

const mockAgencies: Agency[] = [
  { id: 1, code: 'AG-HN-001', name: 'Đại lý Hà Đông', contact: 'Nguyễn Văn A', phone: '09******22', address: 'Hà Đông, Hà Nội', status: 'ACTIVE' },
  { id: 2, code: 'AG-HN-002', name: 'Cửa hàng Đông Anh', contact: 'Trần Văn B', phone: '09******11', address: 'Đông Anh, Hà Nội', status: 'ACTIVE' },
];

const mockDefects: Defect[] = [
  { id: 1, code: 'DEF-MOTOR-01', name: 'Không chạy động cơ', status: 'ACTIVE' },
  { id: 2, code: 'DEF-BAT-02', name: 'Pin không nhận sạc', status: 'ACTIVE' },
];

export default function MasterPage() {
  const [activeTab, setActiveTab] = useState('sku');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const skuColumns = [
    { title: 'SKU code', dataIndex: 'skuCode', key: 'skuCode', render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    { title: 'Tên SKU', dataIndex: 'skuName', key: 'skuName', render: (v: string) => <strong>{v}</strong> },
    { title: 'Loại', dataIndex: 'skuType', key: 'skuType', render: (v: string) => <Tag color={v === 'PRODUCT' ? 'blue' : 'green'}>{v}</Tag> },
    { title: 'Brand/Model', key: 'brandModel', render: (_: unknown, r: SKU) => <span>{r.brand} · {r.model}</span> },
    { title: 'Serial', dataIndex: 'serial', key: 'serial', render: (v: boolean) => <Tag color={v ? 'cyan' : 'default'}>{v ? 'Có serial' : 'Quantity'}</Tag> },
    { title: 'ĐVT', dataIndex: 'unit', key: 'unit' },
    { title: 'Container', dataIndex: 'container', key: 'container' },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: () => <Tag color="success">ACTIVE</Tag> },
    { title: 'Action', key: 'action', render: () => <Space><a>Chi tiết</a></Space> },
  ];

  const agencyColumns = [
    { title: 'Mã', dataIndex: 'code', key: 'code', render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    { title: 'Tên đại lý/cửa hàng', dataIndex: 'name', key: 'name', render: (v: string) => <strong>{v}</strong> },
    { title: 'Người liên hệ', dataIndex: 'contact', key: 'contact' },
    { title: 'Điện thoại', dataIndex: 'phone', key: 'phone' },
    { title: 'Địa chỉ nhận hàng', dataIndex: 'address', key: 'address' },
    { title: 'Trạng thái', key: 'status', render: () => <Tag color="success">ACTIVE</Tag> },
    { title: 'Action', key: 'action', render: () => <Space><a>Sửa</a></Space> },
  ];

  const defectColumns = [
    { title: 'Mã', dataIndex: 'code', key: 'code', render: (v: string) => <span style={{ fontFamily: 'monospace' }}>{v}</span> },
    { title: 'Tên bệnh/lỗi', dataIndex: 'name', key: 'name', render: (v: string) => <strong>{v}</strong> },
    { title: 'Trạng thái', key: 'status', render: () => <Tag color="success">ACTIVE</Tag> },
    { title: 'Action', key: 'action', render: () => <a>Sửa</a> },
  ];

  const handleSave = () => {
    form.validateFields().then(() => {
      message.success('Đã lưu');
      setIsModalOpen(false);
      form.resetFields();
    });
  };

  return (
    <div style={{ padding: 24 }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'sku',
            label: 'Danh sách SKU & Product Master',
            children: (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Space>
                    <Input.Search placeholder="Tên, SKU, model..." style={{ width: 285 }} />
                    <Select placeholder="Loại SKU" style={{ width: 125 }} allowClear />
                    <Select placeholder="Category" style={{ width: 125 }} allowClear />
                    <Select placeholder="Serial mode" style={{ width: 125 }} allowClear />
                    <Select placeholder="Trạng thái" style={{ width: 125 }} allowClear />
                  </Space>
                  <Space>
                    <Button>Import Excel</Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>＋ Tạo SKU</Button>
                  </Space>
                </div>
                <Table dataSource={mockSKUs} columns={skuColumns} rowKey="id" pagination={{ pageSize: 10 }} />
              </div>
            ),
          },
          {
            key: 'agency',
            label: 'Quản lý đại lý/cửa hàng con',
            children: (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Space>
                    <Input.Search placeholder="Mã/tên đại lý..." style={{ width: 285 }} />
                    <Select placeholder="Khu vực" style={{ width: 125 }} allowClear />
                    <Select placeholder="Trạng thái" style={{ width: 125 }} allowClear />
                  </Space>
                  <Button type="primary" icon={<PlusOutlined />}>＋ Thêm đại lý</Button>
                </div>
                <Table dataSource={mockAgencies} columns={agencyColumns} rowKey="id" pagination={{ pageSize: 10 }} />
              </div>
            ),
          },
          {
            key: 'defect',
            label: 'Danh mục bệnh/lỗi',
            children: (
              <div>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Input.Search placeholder="Mã/tên bệnh..." style={{ width: 285 }} />
                  <Button type="primary" icon={<PlusOutlined />}>＋ Thêm bệnh/lỗi</Button>
                </div>
                <Table dataSource={mockDefects} columns={defectColumns} rowKey="id" pagination={{ pageSize: 10 }} />
              </div>
            ),
          },
        ]}
      />

      <Modal title="Tạo SKU mới" open={isModalOpen} onOk={handleSave} onCancel={() => setIsModalOpen(false)} width={760}>
        <Form form={form} layout="vertical">
          <div style={{ marginBottom: 16, color: '#356fa3', fontWeight: 700 }}>Thông tin định danh</div>
          <Form.Item label="Loại SKU" name="skuType" rules={[{ required: true }]}>
            <Select options={SKU_TYPES.map(t => ({ label: t.label, value: t.value }))} />
          </Form.Item>
          <Form.Item label="SKU code" name="skuCode" rules={[{ required: true }]}>
            <Input placeholder="DCH-DRILL-DJZ10A-220V-V1" />
          </Form.Item>
          <Form.Item label="Tên SKU" name="skuName" rules={[{ required: true }]}>
            <Input placeholder="Máy khoan Dongcheng DJZ10A 220V" />
          </Form.Item>
          <Space>
            <Form.Item label="Brand" name="brand" rules={[{ required: true }]}>
              <Input placeholder="Dongcheng" />
            </Form.Item>
            <Form.Item label="Category" name="category" rules={[{ required: true }]}>
              <Input placeholder="Máy khoan" />
            </Form.Item>
          </Space>
          <Space>
            <Form.Item label="Model" name="model" rules={[{ required: true }]}>
              <Input placeholder="DJZ10A" />
            </Form.Item>
            <Form.Item label="Điện áp/Công suất" name="power">
              <Input placeholder="220V" />
            </Form.Item>
          </Space>
          <div style={{ marginBottom: 16, color: '#356fa3', fontWeight: 700 }}>Quản lý tồn</div>
          <Space>
            <Form.Item label="Theo dõi serial" name="serial" rules={[{ required: true }]}>
              <Select options={SERIAL_MODES} />
            </Form.Item>
            <Form.Item label="Container mặc định" name="container" rules={[{ required: true }]}>
              <Select options={CONTAINER_TYPES} />
            </Form.Item>
          </Space>
          <Space>
            <Form.Item label="Đơn vị tính" name="unit" rules={[{ required: true }]}>
              <Input placeholder="cái" />
            </Form.Item>
            <Form.Item label="Bảo hành áp dụng" name="warranty" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}