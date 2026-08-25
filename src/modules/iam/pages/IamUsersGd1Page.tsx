import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
} from "antd";
import type { TableColumnsType } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { http } from "@/shared/api/http";
import { getApiErrorMessage } from "@/shared/api/api-error";
import { IamUserScreen } from "@/modules/iam/pages/IamUserScreen";
import type { IamUser } from "@/modules/iam/types/iam.types";

type Raw = Record<string, unknown>;

type DepartmentForm = {
  department_code: string;
  department_name: string;
  description?: string;
};

function text(value: unknown, fallback = "—"): string {
  return value === undefined || value === null || value === ""
    ? fallback
    : String(value);
}

function DepartmentAssignment() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm<DepartmentForm>();
  const [departmentFilter, setDepartmentFilter] = useState<string>();

  const departmentsQuery = useQuery({
    queryKey: ["iam", "departments"],
    queryFn: () =>
      http.getPage<Raw[]>("/departments", {
        params: { status: "ACTIVE", per_page: 100 },
      }),
  });
  const usersQuery = useQuery({
    queryKey: ["iam", "users", "department-assignment", departmentFilter],
    queryFn: () =>
      http.getPage<IamUser[]>("/users", {
        params: {
          department_id: departmentFilter,
          page: 1,
          per_page: 100,
        },
      }),
  });

  const departments = Array.isArray(departmentsQuery.data?.data)
    ? departmentsQuery.data.data
    : [];
  const users = Array.isArray(usersQuery.data?.data) ? usersQuery.data.data : [];
  const departmentById = useMemo(
    () =>
      Object.fromEntries(
        departments.map((row) => [
          text(row.department_id, ""),
          text(row.department_name),
        ]),
      ),
    [departments],
  );
  const departmentOptions = departments.map((row) => ({
    value: text(row.department_id, ""),
    label: `${text(row.department_code, "")} · ${text(row.department_name)}`,
  }));

  const createMutation = useMutation({
    mutationFn: (values: DepartmentForm) =>
      http.post<Raw>("/departments", {
        ...values,
        department_code: values.department_code.trim().toUpperCase(),
        department_name: values.department_name.trim(),
        description: values.description?.trim() || null,
      }),
    onSuccess: async () => {
      toast.success("Đã tạo phòng ban.");
      setCreateOpen(false);
      form.resetFields();
      await queryClient.invalidateQueries({ queryKey: ["iam", "departments"] });
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Không tạo được phòng ban.")),
  });

  const assignMutation = useMutation({
    mutationFn: (input: {
      user: IamUser;
      departmentId: string | null;
    }) =>
      http.patch<IamUser>(
        `/users/${input.user.user_id}`,
        {
          department_id: input.departmentId,
          version: input.user.version,
        },
        { headers: { "If-Match": String(input.user.version) } },
      ),
    onSuccess: async () => {
      toast.success("Đã cập nhật phòng ban của người dùng.");
      await queryClient.invalidateQueries({
        queryKey: ["iam", "users", "department-assignment"],
      });
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, "Không cập nhật được phòng ban.")),
  });

  const columns: TableColumnsType<IamUser> = [
    { title: "Tài khoản", dataIndex: "username", width: 150 },
    { title: "Họ tên", dataIndex: "display_name", width: 220 },
    {
      title: "Role",
      key: "roles",
      width: 220,
      render: (_, user) => (
        <Space wrap size={4}>
          {(user.roles ?? []).map((role) => (
            <Tag key={role.role_id}>{role.role_name || role.role_code}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "Phòng ban",
      key: "department",
      width: 300,
      render: (_, user) => (
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          style={{ width: "100%" }}
          placeholder="Chưa gán phòng ban"
          value={user.department_id ?? undefined}
          options={departmentOptions}
          loading={assignMutation.isPending}
          onChange={(departmentId) =>
            assignMutation.mutate({
              user,
              departmentId: departmentId ?? null,
            })
          }
        />
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 120,
      render: (value) => <Tag>{text(value)}</Tag>,
    },
  ];

  return (
    <Space orientation="vertical" size={14} style={{ width: "100%" }}>
      <Card size="small">
        <Space wrap>
          <Select
            allowClear
            style={{ width: 280 }}
            placeholder="Lọc theo phòng ban"
            value={departmentFilter}
            options={departmentOptions}
            onChange={setDepartmentFilter}
          />
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            Tạo phòng ban
          </Button>
        </Space>
      </Card>

      <Table<IamUser>
        rowKey="user_id"
        loading={usersQuery.isLoading || departmentsQuery.isLoading}
        columns={columns}
        dataSource={users}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50],
          showTotal: (count) => `Tổng ${count} người dùng`,
        }}
        scroll={{ x: 980 }}
      />

      {departmentFilter ? (
        <Tag color="blue">
          Phòng ban: {departmentById[departmentFilter] ?? departmentFilter}
        </Tag>
      ) : null}

      <Modal
        open={createOpen}
        title="Tạo phòng ban"
        okText="Tạo"
        confirmLoading={createMutation.isPending}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
      >
        <Form<DepartmentForm>
          form={form}
          layout="vertical"
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item
            name="department_code"
            label="Mã phòng ban"
            rules={[{ required: true, message: "Nhập mã phòng ban." }]}
          >
            <Input maxLength={80} />
          </Form.Item>
          <Form.Item
            name="department_name"
            label="Tên phòng ban"
            rules={[{ required: true, message: "Nhập tên phòng ban." }]}
          >
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea maxLength={500} rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

export interface IamUsersGd1PageProps {
  openCreateOnMount?: boolean;
}

export function IamUsersGd1Page({ openCreateOnMount }: IamUsersGd1PageProps) {
  return (
    <Tabs
      defaultActiveKey={openCreateOnMount ? "users" : "users"}
      items={[
        {
          key: "users",
          label: "Người dùng & phân quyền",
          children: <IamUserScreen openCreateOnMount={openCreateOnMount} />,
        },
        {
          key: "departments",
          label: "Phòng ban",
          children: <DepartmentAssignment />,
        },
      ]}
    />
  );
}
