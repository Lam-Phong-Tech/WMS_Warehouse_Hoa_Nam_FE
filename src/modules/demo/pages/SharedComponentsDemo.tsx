import { useState } from 'react';
import {
  Tabs,
  Button,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Alert,
} from 'antd';
import {
  PageHeader,
  DataTable,
  StatusBadge,
  EmptyState,
  LoadingState,
  FormModal,
  FormDrawer,
  DetailDrawer,
  StatCard,
  InfoCard,
  PermissionGuard,
  ActionButton,
  ActionDropdown,
} from '@/shared/components';
import { confirmDialog } from '@/shared/components/feedback/ConfirmDialog';
import type { ActionItem } from '@/shared/components/feedback/ActionDropdown';

const { TextArea } = Input;
const { Option } = Select;

/**
 * Demo page cho Shared Components Inventory
 * Mục đích: QA/FE có thể xem trực quan tất cả shared components
 */

// Mock data cho DataTable
interface MockDataType {
  id: number;
  name: string;
  code: string;
  active: boolean;
}

const mockData: MockDataType[] = [
  { id: 1, name: 'Department A', code: 'DEPT-001', active: true },
  { id: 2, name: 'Department B', code: 'DEPT-002', active: false },
  { id: 3, name: 'Department C', code: 'DEPT-003', active: true },
];

const columns = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: 'Name', dataIndex: 'name', key: 'name' },
  { title: 'Code', dataIndex: 'code', key: 'code' },
  {
    title: 'Status',
    dataIndex: 'active',
    key: 'active',
    render: (active: boolean) => <StatusBadge active={active} />,
  },
  {
    title: 'Actions',
    key: 'actions',
    width: 150,
    render: () => {
      const items: ActionItem[] = [
        {
          key: 'view',
          label: 'View',
          onClick: () => message.info('View clicked'),
        },
        {
          key: 'edit',
          label: 'Edit',
          onClick: () => message.info('Edit clicked'),
        },
        {
          key: 'delete',
          label: 'Delete',
          danger: true,
          onClick: () => message.info('Delete clicked'),
        },
      ];
      return <ActionDropdown items={items} />;
    },
  },
];

export default function SharedComponentsDemo() {
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [form] = Form.useForm();

  const handleFormModalSubmit = async () => {
    try {
      const values = await form.validateFields();
      console.log('FormModal values:', values);
      message.success('FormModal submitted!');
      setFormModalOpen(false);
      form.resetFields();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const handleFormDrawerSubmit = async () => {
    try {
      const values = await form.validateFields();
      console.log('FormDrawer values:', values);
      message.success('FormDrawer submitted!');
      setFormDrawerOpen(false);
      form.resetFields();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const tabItems = [
    {
      key: 'data-display',
      label: 'Data Display',
      children: (
        <div style={{ padding: 24 }}>
          <h3>DataTable</h3>
          <DataTable
            columns={columns}
            dataSource={mockData}
            rowKey="id"
            loading={false}
          />

          <h3 style={{ marginTop: 48 }}>StatusBadge</h3>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <StatusBadge active={true} />
            <StatusBadge active={false} />
          </div>

          <h3>EmptyState</h3>
          <EmptyState description="No data available" />

          <h3 style={{ marginTop: 48 }}>LoadingState</h3>
          <LoadingState />
        </div>
      ),
    },
    {
      key: 'forms',
      label: 'Forms',
      children: (
        <div style={{ padding: 24 }}>
          <h3>Form Components</h3>
          <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
            <Form.Item
              label="FormInput"
              name="name"
              rules={[{ required: true }]}
            >
              <Input placeholder="Enter name" />
            </Form.Item>

            <Form.Item
              label="FormSelect"
              name="department"
              rules={[{ required: true }]}
            >
              <Select placeholder="Select department">
                <Option value="dept1">Department 1</Option>
                <Option value="dept2">Department 2</Option>
              </Select>
            </Form.Item>

            <Form.Item label="FormDatePicker" name="date">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item label="FormTextarea" name="description">
              <TextArea rows={4} placeholder="Enter description" />
            </Form.Item>
          </Form>
        </div>
      ),
    },
    {
      key: 'feedback',
      label: 'Feedback (Modal/Dialog/Drawer)',
      children: (
        <div style={{ padding: 24 }}>
          <h3>FormModal</h3>
          <Button type="primary" onClick={() => setFormModalOpen(true)}>
            Open FormModal
          </Button>

          <h3 style={{ marginTop: 48 }}>FormDrawer</h3>
          <Button type="primary" onClick={() => setFormDrawerOpen(true)}>
            Open FormDrawer
          </Button>

          <h3 style={{ marginTop: 48 }}>DetailDrawer</h3>
          <Button type="primary" onClick={() => setDetailDrawerOpen(true)}>
            Open DetailDrawer
          </Button>

          <h3 style={{ marginTop: 48 }}>ConfirmDialog (Imperative)</h3>
          <Button
            danger
            onClick={() =>
              confirmDialog({
                title: 'Confirm Action',
                content: 'Are you sure you want to proceed?',
                danger: true,
                onOk: () => {
                  message.success('Confirmed!');
                },
              })
            }
          >
            Open ConfirmDialog
          </Button>
        </div>
      ),
    },
    {
      key: 'layout',
      label: 'Layout & Cards',
      children: (
        <div style={{ padding: 24 }}>
          <h3>PageHeader</h3>
          <PageHeader
            title="Demo Page"
            subtitle="Shared Components Demo"
            extra={[
              <Button key="create" type="primary">
                Create
              </Button>,
              <Button key="export">Export</Button>,
            ]}
          />

          <h3 style={{ marginTop: 48 }}>StatCard</h3>
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <StatCard
              title="Total Users"
              value={1234}
              icon="👥"
              color="#1890ff"
            />
            <StatCard title="Active" value={987} icon="✓" color="#52c41a" />
            <StatCard title="Inactive" value={247} icon="✕" color="#ff4d4f" />
          </div>

          <h3>InfoCard</h3>
          <InfoCard
            title="System Information"
            extra={<Button type="link">View Details</Button>}
          >
            This is a demo info card showing system status and metrics.
          </InfoCard>
        </div>
      ),
    },
    {
      key: 'permission',
      label: 'Permission',
      children: (
        <div style={{ padding: 24 }}>
          <h3>PermissionGuard</h3>
          <PermissionGuard
            module="users"
            action="create"
            fallback={
              <Alert message="You don't have permission" type="warning" />
            }
          >
            <div>Content for users with 'users.create' permission</div>
          </PermissionGuard>

          <h3 style={{ marginTop: 48 }}>ActionButton</h3>
          <div style={{ display: 'flex', gap: 16 }}>
            <ActionButton
              module="users"
              action="create"
              icon={<span>+</span>}
              onClick={() => message.info('Create clicked')}
            >
              Create User
            </ActionButton>
            <ActionButton
              module="users"
              action="delete"
              danger
              icon={<span>×</span>}
              onClick={() => message.info('Delete clicked')}
            >
              Delete User
            </ActionButton>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Shared Components Demo"
        subtitle="Visual inventory của tất cả shared components"
        extra={[
          <Button
            key="docs"
            onClick={() =>
              window.open('/docs/COMPONENT_INVENTORY_AUDIT.md', '_blank')
            }
          >
            View Documentation
          </Button>,
        ]}
      />

      <div style={{ padding: 24 }}>
        <Alert
          message="Demo Purpose"
          description="Trang này giúp QA/FE xem trực quan tất cả shared components. Mỗi tab chứa một nhóm components với ví dụ sử dụng."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Tabs items={tabItems} size="large" />
      </div>

      {/* FormModal Demo */}
      <FormModal
        title="FormModal Demo"
        open={formModalOpen}
        onOk={handleFormModalSubmit}
        onCancel={() => {
          setFormModalOpen(false);
          form.resetFields();
        }}
        loading={false}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: 'Please enter name' }]}
          >
            <Input placeholder="Enter name" />
          </Form.Item>
          <Form.Item
            label="Department"
            name="department"
            rules={[{ required: true }]}
          >
            <Select placeholder="Select department">
              <Option value="dept1">Department 1</Option>
              <Option value="dept2">Department 2</Option>
            </Select>
          </Form.Item>
          <Form.Item label="Date" name="date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </FormModal>

      {/* FormDrawer Demo */}
      <FormDrawer
        title="FormDrawer Demo"
        open={formDrawerOpen}
        onOk={handleFormDrawerSubmit}
        onCancel={() => {
          setFormDrawerOpen(false);
          form.resetFields();
        }}
        loading={false}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: 'Please enter name' }]}
          >
            <Input placeholder="Enter name" />
          </Form.Item>
          <Form.Item
            label="Department"
            name="department"
            rules={[{ required: true }]}
          >
            <Select placeholder="Select department">
              <Option value="dept1">Department 1</Option>
              <Option value="dept2">Department 2</Option>
            </Select>
          </Form.Item>
          <Form.Item label="Date" name="date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </FormDrawer>

      {/* DetailDrawer Demo */}
      <DetailDrawer
        title="DetailDrawer Demo"
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
        loading={false}
        extra={
          <Button type="primary" onClick={() => message.info('Edit clicked')}>
            Edit
          </Button>
        }
      >
        <div style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <strong>Name:</strong> Demo Department
          </div>
          <div style={{ marginBottom: 16 }}>
            <strong>Code:</strong> DEMO-001
          </div>
          <div style={{ marginBottom: 16 }}>
            <strong>Status:</strong> <StatusBadge active={true} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <strong>Description:</strong> This is a demo department for
            showcasing DetailDrawer component.
          </div>
          <div>
            <strong>Created At:</strong> 2026-07-14 10:00:00
          </div>
        </div>
      </DetailDrawer>
    </div>
  );
}
