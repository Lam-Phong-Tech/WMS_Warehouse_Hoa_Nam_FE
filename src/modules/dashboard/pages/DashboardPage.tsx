import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Statistic, Table, Tag, Progress, Alert, Button, Space } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, WarningOutlined, PlusOutlined } from '@ant-design/icons';
import type { RecentDocument } from '../types';
import { fetchDashboardKPI, fetchRecentDocuments, fetchReconcileHealth, fetchAlerts } from '../services/dashboardService';

const statusColorMap: Record<string, string> = {
  PARTIALLY_POSTED: 'warning',
  POSTED: 'success',
  SCANNING: 'processing',
  REVIEWING: 'purple',
};

export default function DashboardPage() {
  const { data: kpi } = useQuery({
    queryKey: ['dashboard', 'kpi'],
    queryFn: fetchDashboardKPI,
  });
  const { data: recent = [] } = useQuery({
    queryKey: ['dashboard', 'recent'],
    queryFn: fetchRecentDocuments,
  });
  const { data: health } = useQuery({
    queryKey: ['dashboard', 'health'],
    queryFn: fetchReconcileHealth,
  });
  const { data: alerts = [] } = useQuery({
    queryKey: ['dashboard', 'alerts'],
    queryFn: fetchAlerts,
  });

  const recentColumns = [
    { title: 'Mã chứng từ', dataIndex: 'code', key: 'code' },
    { title: 'Loại', dataIndex: 'type', key: 'type', render: (v: string) => v === 'INBOUND' ? 'Nhập kho' : v === 'OUTBOUND' ? 'Xuất kho' : 'Kiểm kê' },
    { title: 'Đối tác/Nguồn', dataIndex: 'partner', key: 'partner' },
    { title: 'Tiến độ', key: 'progress', render: (_: unknown, r: RecentDocument) => <><Progress percent={r.progress} size="small" /><div style={{ fontSize: 12, color: '#888' }}>{r.posted}/{r.total} đã post</div></> },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (v: string) => <Tag color={statusColorMap[v] || 'default'}>{v}</Tag> },
    { title: 'Người cập nhật', dataIndex: 'updatedBy', key: 'updatedBy' },
    { title: 'Cập nhật', dataIndex: 'updatedAt', key: 'updatedAt' },
    { title: 'Action', key: 'action', render: () => <a>Mở</a> },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={[16, 16]}>
        <Col span={4}>
          <Card>
            <Statistic title="SKU đang hoạt động" value={kpi?.activeSku ?? 0} suffix={<small style={{ fontSize: 12, color: '#888' }}>{kpi?.productCount} PRODUCT · {kpi?.componentCount} COMPONENT</small>} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="Tồn khả dụng" value={kpi?.availableStock ?? 0} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="Chờ xếp khay" value={kpi?.pendingPutaway ?? 0} suffix="box" valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="Phiên kiểm kê mở" value={kpi?.openStocktake ?? 0} suffix={<small>{kpi?.stocktakeLines} dòng cần review</small>} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="Bảo hành đang xử lý" value={kpi?.warrantyActive ?? 0} suffix={<small>{kpi?.warrantyTempOnly} TEMP_ONLY</small>} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="⚠ Cảnh báo cần xử lý" size="small">
            {alerts.map((a, i) => <Alert key={i} message={a.message} type={a.severity === 'danger' ? 'error' : 'warning'} showIcon style={{ marginBottom: 8 }} />)}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Thao tác nhanh theo quyền" size="small">
            <Space wrap>
              <Button type="primary" icon={<PlusOutlined />}>Tạo phiếu nhập</Button>
              <Button type="primary" icon={<PlusOutlined />}>Tạo phiếu xuất</Button>
              <Button icon={<WarningOutlined />}>Demo máy quét</Button>
              <Button>+ Tạo phiên kiểm kê</Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={16}>
          <Card title="Chứng từ gần đây" size="small" extra={<a>Xem toàn bộ</a>}>
            <Table dataSource={recent} columns={recentColumns} rowKey="id" pagination={false} size="small" />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Sức khỏe đối soát" size="small">
            <Statistic title="Ledger = Balance" value={health?.ledgerBalance} valueStyle={{ color: health?.ledgerBalance === 'PASS' ? '#3f8600' : '#faad14' }} prefix={health?.ledgerBalance === 'PASS' ? <ArrowUpOutlined /> : <ArrowDownOutlined />} />
            <div style={{ fontSize: 12, color: '#888' }}>{health?.ledgerSkuCount} SKU</div>
            <Statistic title="Subledger" value={health?.subledger} valueStyle={{ color: health?.subledger === 'PASS' ? '#3f8600' : '#faad14' }} style={{ marginTop: 12 }} />
            <div style={{ fontSize: 12, color: '#888' }}>{health?.subledgerMessage}</div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}